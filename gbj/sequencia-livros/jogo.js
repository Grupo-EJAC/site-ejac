// EJAC — GBJ, Sequência dos Livros: treino individual.
//
// Regra oficial da prova (pra quem for conferir o regulamento): o
// coordenador anuncia um livro, e a pessoa diz o antecessor e o sucessor
// na ordem da Bíblia Pastoral (Paulus). Começa com 3 vidas; errar tira
// uma; zerar elimina.
//
// Aqui é treino, não a prova — por isso duas coisas mudam de propósito:
//  - é sozinho: não tem "os outros 3 participantes" nem a regra de
//    perguntas alternadas do parágrafo sexto, que só faz sentido em grupo
//  - o tempo por rodada é escolhido por quem treina, não fixo em 15s/10s
//    como no dia da prova — assim dá pra ir reduzindo aos poucos
//
// Diferente do Termo, este módulo PRECISA do Firebase pra sequer abrir: é
// treino de membro logado, não um joguinho público. Por isso é módulo
// inteiro (não script clássico + módulo separado) e trava numa tela de
// carregando até confirmar o login.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js';
import {
  getFirestore, doc, getDoc, collection, addDoc, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';
import { firebaseConfig } from '../../firebase-config.js';
import { LIVROS_BIBLIA } from './livros.js';

const MODALIDADE = 'sequencia-livros';
const CHAVE_TEMPO = 'gbj-sequencia-livros-tempo';
const VIDAS_INICIAIS = 3;
const TEMPOS_PADRAO = [5, 10, 15, 20, 30, 0]; // 0 = sem limite

// ------------------------------------------------------------
// Normalização da resposta
//
// O regulamento (parágrafos 9, 10 e 11) diz que não precisa ser
// literal: ordinal por extenso vale igual ao símbolo (Primeiro Samuel =
// 1º Samuel), e prefixos como "Evangelho de", "Carta aos" ou "Epístola
// aos" não são obrigatórios. Em vez de listar variação por variação
// livro por livro, a normalização abaixo entende esse padrão de uma vez
// só: tira acento, resolve ordinal e tira prefixo descritivo.
// ------------------------------------------------------------
function semAcento(t) {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

const ORDINAL_POR_EXTENSO = {
  primeiro: '1', primeira: '1',
  segundo: '2', segunda: '2',
  terceiro: '3', terceira: '3',
};

const PREFIXO_DESCRITIVO = new RegExp(
  '^(primeiro|primeira|segundo|segunda|terceiro|terceira)?\\s*' +
  '(evangelho de|evangelho segundo|carta de sao paulo aos?|carta de sao paulo a|' +
  'carta aos?|carta a|epistola de sao paulo aos?|epistola aos?|epistola a|' +
  'livro dos|livro das|livro de|livro)\\s+'
);

function normalizar(bruto) {
  let t = semAcento(String(bruto || '')).toLowerCase().trim().replace(/\s+/g, ' ');
  t = t.replace(/[.!?]+$/, '');

  // "segunda carta aos..." -> guarda o "segunda" como número antes de
  // tirar o prefixo, senão perderia a informação de qual carta é
  t = t.replace(PREFIXO_DESCRITIVO, (m, ord) => (ord ? ORDINAL_POR_EXTENSO[ord] + ' ' : ''));

  // ordinal por extenso solto no início ("primeiro samuel")
  t = t.replace(/^(primeiro|primeira|segundo|segunda|terceiro|terceira)\s+/, (m, ord) => ORDINAL_POR_EXTENSO[ord] + ' ');

  // "1º"/"1ª"/"1o"/"1a" no início -> só o número
  t = t.replace(/^([123])[ºªoa]\.?\s*/, '$1 ');

  return t.replace(/\s+/g, ' ').trim();
}

function respostaCorreta(digitada, esperada) {
  return normalizar(digitada) === normalizar(esperada);
}

// ------------------------------------------------------------
// Elementos da página
// ------------------------------------------------------------
const telaCarregando = document.getElementById('gbj-sl-carregando');
const telaConfig = document.getElementById('gbj-sl-config');
const telaJogo = document.getElementById('gbj-sl-jogo');
const telaFim = document.getElementById('gbj-sl-fim');

const selectTempo = document.getElementById('gbj-sl-tempo');
const btnComecar = document.getElementById('gbj-sl-comecar');

const elVidas = document.getElementById('gbj-sl-vidas');
const elRodada = document.getElementById('gbj-sl-rodada');
const elAcertos = document.getElementById('gbj-sl-acertos');
const elLivro = document.getElementById('gbj-sl-livro-anunciado');
const elTempoRestante = document.getElementById('gbj-sl-tempo-restante');
const formResposta = document.getElementById('gbj-sl-form-resposta');
const inputAntes = document.getElementById('gbj-sl-antes');
const inputDepois = document.getElementById('gbj-sl-depois');
const btnResponder = document.getElementById('gbj-sl-responder');
const elFeedback = document.getElementById('gbj-sl-feedback');
const btnProxima = document.getElementById('gbj-sl-proxima');
const btnParar = document.getElementById('gbj-sl-parar');

const elFimTitulo = document.getElementById('gbj-sl-fim-titulo');
const elFimResumo = document.getElementById('gbj-sl-fim-resumo');
const btnTreinarDeNovo = document.getElementById('gbj-sl-treinar-de-novo');

function mostrarTela(el) {
  [telaCarregando, telaConfig, telaJogo, telaFim].forEach((t) => { if (t) t.hidden = t !== el; });
}

function lerTempoPreferido() {
  const salvo = Number(localStorage.getItem(CHAVE_TEMPO));
  return TEMPOS_PADRAO.includes(salvo) ? salvo : 15;
}

// ------------------------------------------------------------
// Firebase: só entra quem já está logado no /gbj/
// ------------------------------------------------------------
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let uid = null;

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    // Não tem sessão: volta pro login. É o próprio /gbj/ que autentica —
    // esta página só treina quem já entrou por lá.
    location.replace('../');
    return;
  }

  // O login (Firebase Auth) pode continuar válido mesmo depois que um
  // coordenador "exclui" o membro pelo painel — ver o comentário em
  // gbj-firebase.js sobre por que é o perfil, não a conta, que trava o
  // acesso. Confere aqui de novo, não só no /gbj/: a pessoa pode ter
  // ficado com esta aba aberta desde antes de ser desativada.
  let perfilExiste = false;
  try {
    perfilExiste = (await getDoc(doc(db, 'gbjMembros', user.uid))).exists();
  } catch (err) {
    perfilExiste = false;
  }
  if (!perfilExiste) {
    await signOut(auth);
    location.replace('../');
    return;
  }

  uid = user.uid;
  if (selectTempo) selectTempo.value = String(lerTempoPreferido());
  mostrarTela(telaConfig);
});

// ------------------------------------------------------------
// Estado da sessão de treino
// ------------------------------------------------------------
let sessao = null; // { tempoLimiteSeg, vidas, rodada, acertos, usados: Set }
let rodadaAtual = null; // { indiceAnunciado, antes, depois }
let timerId = null;
let prazoId = null;

function pararTimer() {
  if (timerId) { clearInterval(timerId); timerId = null; }
  if (prazoId) { clearTimeout(prazoId); prazoId = null; }
}

function iniciarTimer() {
  pararTimer();
  if (!sessao.tempoLimiteSeg) {
    if (elTempoRestante) elTempoRestante.textContent = '';
    return;
  }
  let restante = sessao.tempoLimiteSeg;
  if (elTempoRestante) elTempoRestante.textContent = `${restante}s`;
  timerId = setInterval(() => {
    restante -= 1;
    if (elTempoRestante) elTempoRestante.textContent = `${Math.max(restante, 0)}s`;
    if (restante <= 0) clearInterval(timerId);
  }, 1000);
  prazoId = setTimeout(() => responder(true), sessao.tempoLimiteSeg * 1000);
}

if (btnComecar) {
  btnComecar.addEventListener('click', () => {
    const tempoLimiteSeg = Number(selectTempo.value) || 0;
    localStorage.setItem(CHAVE_TEMPO, String(tempoLimiteSeg));
    sessao = {
      tempoLimiteSeg,
      vidas: VIDAS_INICIAIS,
      rodada: 0,
      acertos: 0,
      usados: new Set(),
    };
    mostrarTela(telaJogo);
    proximaRodada();
  });
}

// Sorteia um livro que ainda não caiu nesta sessão. Os dois primeiros
// livros das pontas (Gênesis e Apocalipse) ficam de fora do sorteio: um
// não tem antecessor, o outro não tem sucessor, e perguntar isso não faz
// sentido no formato desta prova.
function sortearIndice() {
  const disponiveis = [];
  for (let i = 1; i < LIVROS_BIBLIA.length - 1; i++) {
    if (!sessao.usados.has(i)) disponiveis.push(i);
  }
  if (disponiveis.length === 0) {
    sessao.usados.clear();
    return sortearIndice();
  }
  return disponiveis[Math.floor(Math.random() * disponiveis.length)];
}

function proximaRodada() {
  const i = sortearIndice();
  sessao.usados.add(i);
  rodadaAtual = { indice: i, antes: LIVROS_BIBLIA[i - 1], depois: LIVROS_BIBLIA[i + 1] };

  elLivro.textContent = LIVROS_BIBLIA[i];
  elVidas.textContent = '❤️'.repeat(sessao.vidas) + '🖤'.repeat(VIDAS_INICIAIS - sessao.vidas);
  elRodada.textContent = String(sessao.rodada + 1);
  elAcertos.textContent = String(sessao.acertos);
  elFeedback.textContent = '';
  elFeedback.className = 'gbj-sl-feedback';
  inputAntes.value = '';
  inputDepois.value = '';
  inputAntes.disabled = false;
  inputDepois.disabled = false;
  btnResponder.hidden = false;
  btnProxima.hidden = true;
  formResposta.hidden = false;
  inputAntes.focus();

  iniciarTimer();
}

function responder(porTempoEsgotado) {
  pararTimer();
  inputAntes.disabled = true;
  inputDepois.disabled = true;
  btnResponder.hidden = true;

  const acertouAntes = !porTempoEsgotado && respostaCorreta(inputAntes.value, rodadaAtual.antes);
  const acertouDepois = !porTempoEsgotado && respostaCorreta(inputDepois.value, rodadaAtual.depois);
  const acertou = acertouAntes && acertouDepois;

  sessao.rodada += 1;
  if (acertou) {
    sessao.acertos += 1;
    elFeedback.textContent = 'Acertou! ✓';
    elFeedback.className = 'gbj-sl-feedback gbj-sl-feedback-certo';
  } else {
    sessao.vidas -= 1;
    const partes = [];
    if (!acertouAntes) partes.push(`antes de ${LIVROS_BIBLIA[rodadaAtual.indice]}: ${rodadaAtual.antes}`);
    if (!acertouDepois) partes.push(`depois de ${LIVROS_BIBLIA[rodadaAtual.indice]}: ${rodadaAtual.depois}`);
    elFeedback.textContent = (porTempoEsgotado ? 'Tempo esgotado. ' : 'Errou. ') + 'Certo era — ' + partes.join(' | ');
    elFeedback.className = 'gbj-sl-feedback gbj-sl-feedback-errado';
  }

  elVidas.textContent = '❤️'.repeat(Math.max(sessao.vidas, 0)) + '🖤'.repeat(VIDAS_INICIAIS - Math.max(sessao.vidas, 0));
  elAcertos.textContent = String(sessao.acertos);

  if (sessao.vidas <= 0) {
    btnProxima.hidden = true;
    setTimeout(() => encerrar('eliminado'), 1400);
  } else {
    btnProxima.hidden = false;
    btnProxima.focus();
  }
}

if (formResposta) {
  formResposta.addEventListener('submit', (e) => {
    e.preventDefault();
    responder(false);
  });
}

if (btnProxima) btnProxima.addEventListener('click', proximaRodada);

if (btnParar) {
  btnParar.addEventListener('click', () => {
    if (!sessao) return;
    if (!confirm('Parar o treino agora? O que já foi respondido fica salvo no seu histórico.')) return;
    encerrar('parou');
  });
}

async function encerrar(motivo) {
  pararTimer();
  const resumo = { rodadas: sessao.rodada, acertos: sessao.acertos, tempoLimiteSeg: sessao.tempoLimiteSeg };

  elFimTitulo.textContent = motivo === 'eliminado' ? 'Zerou as vidas' : 'Treino encerrado';
  elFimResumo.textContent = `${resumo.acertos} acerto${resumo.acertos === 1 ? '' : 's'} em ${resumo.rodadas} rodada${resumo.rodadas === 1 ? '' : 's'}.`;
  mostrarTela(telaFim);

  if (resumo.rodadas === 0) return; // não grava sessão vazia (ex: parou sem responder nada)

  try {
    await addDoc(collection(db, 'gbjHistoricoSequenciaLivros'), {
      uid,
      modalidade: MODALIDADE,
      tempoLimiteSeg: resumo.tempoLimiteSeg,
      rodadas: resumo.rodadas,
      acertos: resumo.acertos,
      motivo,
      criadoEm: serverTimestamp(),
    });
  } catch (err) {
    // O treino em si já acabou e a pessoa já viu o resultado; não vale a
    // pena travar a tela por causa disso, só avisa que não salvou.
    const aviso = document.createElement('p');
    aviso.className = 'form-msg erro';
    aviso.textContent = 'Não deu pra salvar este treino no seu histórico.';
    elFimResumo.insertAdjacentElement('afterend', aviso);
  }
}

if (btnTreinarDeNovo) {
  btnTreinarDeNovo.addEventListener('click', () => {
    sessao = null;
    if (selectTempo) selectTempo.value = String(lerTempoPreferido());
    mostrarTela(telaConfig);
  });
}
