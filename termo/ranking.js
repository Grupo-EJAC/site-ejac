// EJAC — Ranking diário do Termo.
//
// Mora separado do jogo.js de propósito: aquele é script clássico e roda
// 100% offline; este é módulo (o SDK do Firebase é ESM) e é a única parte
// que fala com a rede. Os dois só se falam pelo evento 'ejac:fim', então
// se o Firebase cair, demorar ou estiver bloqueado, o jogo continua
// inteiro — só o placar não aparece.
//
// Como funciona:
//  - login anônimo dá um uid estável pro navegador, sem pedir nada
//  - a pessoa escolhe um nome (fica no localStorage, dá pra trocar)
//  - o id do documento é dia_modo_uid, então cada um manda UMA marca por
//    dia por modo; as regras do Firestore não deixam atualizar depois
//
// Sobre trapaça: isso aqui é honesto, não é à prova de fraude. O tempo vem
// do navegador de quem joga e as palavras estão no próprio site, então
// quem quiser burlar, burla. O ranking é pra brincar junto, não pra valer
// prêmio — por isso não gastamos um backend inteiro pra blindar.

import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js';
import {
  getAuth, signInAnonymously, onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js';
import {
  getFirestore, collection, doc, setDoc, updateDoc, onSnapshot, query, where, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';
import { firebaseConfig } from '../firebase-config.js';

const NOME_MAX = 20;
const CHAVE_NOME = 'ejac-termo-nome';

const elSecao = document.getElementById('ranking');
const elLista = document.getElementById('ranking-lista');
const elAviso = document.getElementById('ranking-aviso');
const elBtnNome = document.getElementById('btn-ranking-nome');
const elModalFundo = document.getElementById('ranking-modal-fundo');
const elForm = document.getElementById('form-ranking-nome');
const elInputNome = document.getElementById('ranking-input-nome');

if (elSecao && elLista && !firebaseConfig.apiKey.includes('COLE_AQUI')) {
  iniciar();
}

function iniciar() {
  const MODO = new URLSearchParams(location.search).get('modo') === 'dueto' ? 'dueto' : 'termo';

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const auth = getAuth(app);
  const colMarcas = collection(db, 'termoRanking');

  let uid = null;
  let pendente = null; // resultado esperando o login anônimo terminar
  let optIn = null;    // resultado esperando a pessoa QUERER entrar no placar

  // ----------------------------------------------------------
  // Nome de quem joga
  // ----------------------------------------------------------
  function lerNome() {
    try { return localStorage.getItem(CHAVE_NOME) || ''; } catch (e) { return ''; }
  }
  function gravarNome(n) {
    try { localStorage.setItem(CHAVE_NOME, n); } catch (e) { /* aba anônima: só não lembra */ }
  }

  function abrirModal() {
    if (!elModalFundo) return;
    elModalFundo.hidden = false;
    if (elInputNome) {
      elInputNome.value = lerNome();
      elInputNome.focus();
    }
  }
  function fecharModal() {
    if (elModalFundo) elModalFundo.hidden = true;
  }

  if (elForm) {
    elForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const nome = elInputNome.value.trim().slice(0, NOME_MAX);
      if (!nome) return;
      gravarNome(nome);
      fecharModal();
      const esperando = pendente || optIn;
      if (esperando) { optIn = null; enviar(esperando); }
      else renomearMarca(nome);
    });
  }
  if (elBtnNome) elBtnNome.addEventListener('click', abrirModal);

  // Trocar o nome depois de já ter mandado. É um update de um campo só, e
  // não um reenvio: as regras deixam mexer no nome, mas não no tempo nem
  // nas tentativas — senão daria pra "corrigir" a própria marca depois.
  async function renomearMarca(nome) {
    const marca = lerMarcaLocal();
    if (!marca || !uid) return;
    try {
      await updateDoc(doc(colMarcas, `${marca.dia}_${marca.modo}_${uid}`), { nome });
      gravarMarcaLocal(Object.assign({}, marca, { nome }));
    } catch (err) {
      if (elAviso) elAviso.textContent = 'Não deu pra trocar o nome agora.';
    }
  }

  // Guarda o que foi enviado hoje, pra conseguir regravar com outro nome.
  const CHAVE_MARCA = `ejac-termo-marca-${MODO}`;
  function lerMarcaLocal() {
    try { return JSON.parse(localStorage.getItem(CHAVE_MARCA) || 'null'); } catch (e) { return null; }
  }
  function gravarMarcaLocal(m) {
    try { localStorage.setItem(CHAVE_MARCA, JSON.stringify(m)); } catch (e) { /* segue */ }
  }

  // ----------------------------------------------------------
  // Envio
  // ----------------------------------------------------------
  async function enviar(resultado) {
    if (!uid) { pendente = resultado; return; }

    const nome = resultado.nome || lerNome();
    if (!nome) { pendente = resultado; abrirModal(); return; }

    pendente = null;
    if (elAviso) elAviso.textContent = '';
    if (elBtnNome) elBtnNome.textContent = 'Trocar meu nome';
    const marca = {
      dia: resultado.dia,
      modo: resultado.modo,
      venceu: resultado.venceu,
      tentativas: resultado.tentativas,
      duracaoMs: resultado.duracaoMs,
      nome,
    };
    gravarMarcaLocal(marca);

    try {
      await setDoc(doc(colMarcas, `${marca.dia}_${marca.modo}_${uid}`), {
        uid,
        nome: marca.nome,
        dia: marca.dia,
        modo: marca.modo,
        venceu: marca.venceu,
        tentativas: marca.tentativas,
        duracaoMs: Number(marca.duracaoMs) || 0,
        criadoEm: serverTimestamp(),
      });
    } catch (err) {
      // Pode ser a segunda tentativa do dia (as regras barram atualizar) ou
      // rede ruim. Nos dois casos o jogo já acabou e o placar é acessório.
      if (elAviso) elAviso.textContent = 'Não deu pra enviar sua marca de hoje.';
    }
  }

  // Chamado uma vez por carregamento de página, venha o resultado pelo evento
  // (partida terminando agora) ou pendurado no document (partida que já estava
  // terminada quando a página abriu — aí o jogo.js dispara antes deste módulo
  // sequer existir). A trava evita mandar a mesma marca duas vezes.
  let jaTratado = false;
  function aoFim(detalhe) {
    if (jaTratado || !detalhe) return;
    jaTratado = true;
    elSecao.hidden = false;

    // Já mandou a marca de hoje: só mostra o placar. Reenviar daria erro, porque
    // as regras não deixam reescrever a marca do dia.
    const marca = lerMarcaLocal();
    if (marca && marca.dia === detalhe.dia) return;

    // Quem só recarregou a página pra rever o resultado não leva modal na cara:
    // vê o placar e entra nele se quiser, clicando.
    if (detalhe.restaurado && !lerNome()) {
      optIn = detalhe;
      if (elAviso) elAviso.textContent = 'Você já jogou hoje. Quer aparecer no placar?';
      if (elBtnNome) elBtnNome.textContent = 'Entrar no placar';
      return;
    }

    enviar(detalhe);
  }

  document.addEventListener('ejac:fim', (e) => aoFim(e.detail));
  aoFim(document.__ejacFim);

  // ----------------------------------------------------------
  // Placar do dia, ao vivo
  // ----------------------------------------------------------
  function formatarTempo(ms) {
    if (!ms || ms < 0) return '—';
    const s = Math.round(ms / 1000);
    return s < 60 ? `${s}s` : `${Math.floor(s / 60)}min${String(s % 60).padStart(2, '0')}`;
  }

  function render(snapshot) {
    const marcas = [];
    snapshot.forEach(d => marcas.push(d.data()));

    // Quem venceu vem antes; entre vencedores, menos tentativas e depois
    // menor tempo. Quem não venceu fica no fim, sem ordem de tempo (não
    // faz sentido premiar quem desistiu rápido).
    marcas.sort((a, b) => {
      if (a.venceu !== b.venceu) return a.venceu ? -1 : 1;
      if (!a.venceu) return 0;
      if (a.tentativas !== b.tentativas) return a.tentativas - b.tentativas;
      return (a.duracaoMs || Infinity) - (b.duracaoMs || Infinity);
    });

    elLista.textContent = '';
    if (!marcas.length) {
      const vazio = document.createElement('li');
      vazio.className = 'ranking-vazio';
      vazio.textContent = 'Ninguém jogou hoje ainda. Seja o primeiro!';
      elLista.appendChild(vazio);
      return;
    }

    marcas.forEach((m, i) => {
      const li = document.createElement('li');
      li.className = 'ranking-item' + (m.uid === uid ? ' ranking-eu' : '');

      const pos = document.createElement('span');
      pos.className = 'ranking-pos';
      pos.textContent = m.venceu ? `${i + 1}º` : '—';

      const nome = document.createElement('span');
      nome.className = 'ranking-nome';
      nome.textContent = m.nome;

      const placar = document.createElement('span');
      placar.className = 'ranking-placar';
      placar.textContent = m.venceu ? `${m.tentativas} tentativa${m.tentativas === 1 ? '' : 's'}` : 'não foi dessa vez';

      const tempo = document.createElement('span');
      tempo.className = 'ranking-tempo';
      tempo.textContent = m.venceu ? formatarTempo(m.duracaoMs) : '';

      li.append(pos, nome, placar, tempo);
      elLista.appendChild(li);
    });
  }

  function ouvirPlacar(dia) {
    onSnapshot(
      query(colMarcas, where('dia', '==', dia), where('modo', '==', MODO)),
      render,
      () => { if (elAviso) elAviso.textContent = 'Não deu pra carregar o placar agora.'; }
    );
  }

  onAuthStateChanged(auth, (user) => {
    if (!user) return;
    uid = user.uid;
    const hoje = new Date();
    const dia = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
    ouvirPlacar(dia);
    if (pendente) enviar(pendente);
  });

  signInAnonymously(auth).catch(() => {
    if (elAviso) elAviso.textContent = 'Não deu pra conectar no placar agora.';
  });
}
