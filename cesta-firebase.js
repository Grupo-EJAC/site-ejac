// EJAC — Cesta básica colaborativa, com Firestore (tempo real).
//
// Sem servidor próprio: o navegador fala direto com o Firestore. A
// validação que vale de verdade é a do firestore.rules (o servidor) —
// a validação aqui é só "de cortesia", pra dar feedback rápido sem
// round-trip. Um usuário malicioso pode pular essa validação inteira e
// mesmo assim esbarra nas regras do lado do servidor.
//
// Duas coleções por contribuição, escritas juntas (mesmo grupoId):
//   - cestaContribuicoes: nome + item + quantidade — PÚBLICA (é o que
//     aparece na página, de propósito, pra dar controle ao grupo)
//   - cestaContatos: os mesmos dados + WhatsApp + IP — só leitura pelo
//     dono do projeto no Firebase Console, nunca pelo site
//
// Excluir uma contribuição errada = apagar o documento no Firebase
// Console (Firestore Database → Data). Não existe update/delete vindo
// do navegador (ver firestore.rules).

import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js';
import {
  getFirestore, collection, doc, writeBatch, onSnapshot, query, orderBy, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';
import { ITENS_CESTA, ITENS_CESTA_POR_ID } from './catalogos.js';

const NOME_MAX = 80;

// Evita "12.5" feio e usa vírgula (padrão BR); "12" continua "12"
function formatarNumero(n) {
  const arred = Math.round(n * 100) / 100;
  return String(arred).replace('.', ',');
}

let statusCesta = {};
let contribuicoesCesta = {}; // itemId -> [{ nome, quantidade }]

const cestaProgressoEl = document.getElementById('cesta-progresso');
const selectCestaItem = document.getElementById('cesta-item');
const inputCestaQtd = document.getElementById('cesta-quantidade');
const cestaHintEl = document.getElementById('cesta-hint');
const formCesta = document.getElementById('form-cesta');
const btnCesta = document.getElementById('btn-cesta-enviar');
const msgCesta = document.getElementById('cesta-msg');

function marcarInvalido(el) {
  if (window.EJAC && window.EJAC.destacarInvalido) window.EJAC.destacarInvalido(el);
}

function criarLinhaCesta(item) {
  const coletado = statusCesta[item.id] || 0;
  const pct = Math.max(0, Math.min(100, (coletado / item.meta) * 100));
  const completo = coletado >= item.meta;

  const li = document.createElement('li');
  li.className = 'cesta-item' + (completo ? ' completo' : '');

  const topo = document.createElement('div');
  topo.className = 'cesta-item-topo';

  const nomeEl = document.createElement('span');
  nomeEl.className = 'cesta-item-nome';
  nomeEl.textContent = item.nome;

  const qtdEl = document.createElement('span');
  qtdEl.className = 'cesta-item-qtd';
  if (completo) {
    const selo = document.createElement('span');
    selo.className = 'cesta-item-completo-selo';
    selo.textContent = '✓ completo';
    qtdEl.appendChild(selo);
  } else {
    const strong = document.createElement('strong');
    strong.textContent = formatarNumero(coletado);
    qtdEl.appendChild(strong);
    qtdEl.appendChild(document.createTextNode(` de ${formatarNumero(item.meta)} ${item.unidade}`));
  }

  topo.appendChild(nomeEl);
  topo.appendChild(qtdEl);

  const barra = document.createElement('div');
  barra.className = 'cesta-barra';
  const preenchida = document.createElement('div');
  preenchida.className = 'cesta-barra-preenchida';
  preenchida.style.width = pct + '%';
  barra.appendChild(preenchida);

  li.appendChild(topo);
  li.appendChild(barra);

  // Quem já colaborou com esse item — dá controle pro grupo ver na hora
  const contribuintes = contribuicoesCesta[item.id];
  if (contribuintes && contribuintes.length > 0) {
    const lista = document.createElement('ul');
    lista.className = 'cesta-contribuintes';
    contribuintes.forEach((c) => {
      const linha = document.createElement('li');
      linha.className = 'cesta-contribuinte';
      const nomeSpan = document.createElement('span');
      nomeSpan.textContent = c.nome || 'Anônimo';
      const qtdSpan = document.createElement('span');
      qtdSpan.textContent = `${formatarNumero(c.quantidade)} ${item.unidade}`;
      linha.appendChild(nomeSpan);
      linha.appendChild(qtdSpan);
      lista.appendChild(linha);
    });
    li.appendChild(lista);
  }

  return li;
}

function atualizarHintCesta() {
  if (!cestaHintEl || !selectCestaItem) return;
  const item = ITENS_CESTA_POR_ID[selectCestaItem.value];
  cestaHintEl.textContent = '';
  if (!item) {
    cestaHintEl.textContent = 'Escolha um item pra ver quanto ainda falta.';
    return;
  }
  const coletado = statusCesta[item.id] || 0;
  const falta = Math.max(0, item.meta - coletado);
  if (falta <= 0) {
    const strong = document.createElement('strong');
    strong.textContent = 'já foi completado';
    cestaHintEl.appendChild(document.createTextNode('Esse item '));
    cestaHintEl.appendChild(strong);
    cestaHintEl.appendChild(document.createTextNode(' — mas toda quantidade extra ajuda!'));
  } else {
    cestaHintEl.appendChild(document.createTextNode('Faltam '));
    const strong = document.createElement('strong');
    strong.textContent = `${formatarNumero(falta)} ${item.unidade}`;
    cestaHintEl.appendChild(strong);
    cestaHintEl.appendChild(document.createTextNode(' pra completar esse item.'));
  }
  if (inputCestaQtd) inputCestaQtd.placeholder = `Ex: ${formatarNumero(falta > 0 ? falta : item.meta)}`;
}

function renderProgressoCesta() {
  if (!cestaProgressoEl) return;
  cestaProgressoEl.textContent = '';
  ITENS_CESTA.forEach((item) => cestaProgressoEl.appendChild(criarLinhaCesta(item)));
  atualizarHintCesta();
}

function mostrarCarregando(texto) {
  if (!cestaProgressoEl) return;
  cestaProgressoEl.textContent = '';
  const li = document.createElement('li');
  li.className = 'cesta-carregando';
  li.textContent = texto;
  cestaProgressoEl.appendChild(li);
}

function mostrarErroCesta(texto) {
  if (!msgCesta) return;
  msgCesta.textContent = texto;
  msgCesta.className = 'form-msg erro';
}

if (selectCestaItem) {
  selectCestaItem.addEventListener('change', () => {
    atualizarHintCesta();
    if (window.EJAC && window.EJAC.tocarClick) window.EJAC.tocarClick();
  });
}

let db = null;
let colContribuicoes = null;
let colContatos = null;

if (firebaseConfig.apiKey.includes('COLE_AQUI')) {
  mostrarCarregando('A campanha ainda não está conectada ao Firebase.');
} else {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  colContribuicoes = collection(db, 'cestaContribuicoes');
  colContatos = collection(db, 'cestaContatos');

  // onSnapshot entrega os dados na hora (inclusive a própria escrita,
  // aplicada localmente pelo SDK antes mesmo do servidor confirmar) e
  // depois mantém tudo sincronizado sozinho — não precisa mais de
  // "atualização otimista" manual nem de re-buscar por polling.
  onSnapshot(
    query(colContribuicoes, orderBy('criadoEm', 'asc')),
    (snapshot) => {
      const novoStatus = {};
      const novasContribuicoes = {};
      snapshot.forEach((docSnap) => {
        const dados = docSnap.data();
        const itemId = dados.item;
        const quantidade = Number(dados.quantidade) || 0;
        if (!ITENS_CESTA_POR_ID[itemId]) return;
        novoStatus[itemId] = (novoStatus[itemId] || 0) + quantidade;
        if (!novasContribuicoes[itemId]) novasContribuicoes[itemId] = [];
        novasContribuicoes[itemId].push({ nome: dados.nome || 'Anônimo', quantidade });
      });
      statusCesta = novoStatus;
      contribuicoesCesta = novasContribuicoes;
      renderProgressoCesta();
    },
    () => mostrarCarregando('Não foi possível carregar o progresso agora.')
  );
}

if (formCesta) {
  formCesta.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!db) {
      mostrarErroCesta('O formulário ainda não está conectado ao Firebase. Veja o README.md.');
      return;
    }

    if ((formCesta.website && formCesta.website.value.trim()) !== '') {
      msgCesta.textContent = 'Colaboração registrada com sucesso! 🎉';
      msgCesta.className = 'form-msg sucesso';
      formCesta.reset();
      return;
    }

    const itemId = formCesta.item.value;
    const item = ITENS_CESTA_POR_ID[itemId];
    const quantidadeStr = formCesta.quantidade.value.trim();
    const quantidade = parseFloat(quantidadeStr.replace(',', '.'));
    const nomeCompleto = formCesta.nomeCompleto.value.trim();
    const whatsapp = formCesta.whatsapp.value.replace(/\D/g, '');

    if (!item) {
      mostrarErroCesta('Escolha um item da lista.');
      marcarInvalido(formCesta.item);
      return;
    }
    if (!nomeCompleto || !whatsapp || !quantidadeStr) {
      mostrarErroCesta('Preencha todos os campos antes de enviar.');
      if (!nomeCompleto) marcarInvalido(formCesta.nomeCompleto);
      if (!whatsapp) marcarInvalido(formCesta.whatsapp);
      if (!quantidadeStr) marcarInvalido(formCesta.quantidade);
      return;
    }
    if (nomeCompleto.length > NOME_MAX) {
      mostrarErroCesta('O nome está longo demais. Revise e tente de novo.');
      marcarInvalido(formCesta.nomeCompleto);
      return;
    }
    if (!/^[0-9]{10,11}$/.test(whatsapp)) {
      mostrarErroCesta('Digite um WhatsApp válido, com DDD (ex: 41999998888).');
      marcarInvalido(formCesta.whatsapp);
      return;
    }
    if (!isFinite(quantidade) || quantidade <= 0 || quantidade > item.meta * 3) {
      mostrarErroCesta('Digite uma quantidade válida pra esse item.');
      marcarInvalido(formCesta.quantidade);
      return;
    }

    btnCesta.disabled = true;
    btnCesta.textContent = 'Enviando...';
    msgCesta.className = 'form-msg';
    msgCesta.textContent = '';

    // Busca o IP público de quem está enviando (registro interno/antifraude,
    // fica só na coleção privada). Se falhar, o envio segue sem IP.
    let ip = '';
    try {
      const respIp = await fetch('https://api.ipify.org?format=json');
      const dadosIp = await respIp.json();
      ip = (dadosIp && dadosIp.ip) ? String(dadosIp.ip).slice(0, 45) : '';
    } catch (err) {
      ip = '';
    }

    const grupoId = (crypto.randomUUID) ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    try {
      const lote = writeBatch(db);
      lote.set(doc(colContribuicoes), {
        grupoId, nome: nomeCompleto, item: itemId, quantidade, criadoEm: serverTimestamp(),
      });
      lote.set(doc(colContatos), {
        grupoId, nome: nomeCompleto, whatsapp, item: itemId, quantidade, ip, criadoEm: serverTimestamp(),
      });
      await lote.commit();

      msgCesta.textContent = 'Colaboração registrada com sucesso! 🎉';
      msgCesta.className = 'form-msg sucesso';
      if (window.EJAC && window.EJAC.tocarSucesso) window.EJAC.tocarSucesso();
      formCesta.reset();
      atualizarHintCesta();
      // Não precisa de atualização otimista manual: o onSnapshot acima já
      // reflete essa escrita na hora, assim que o SDK aplica localmente.
    } catch (err) {
      mostrarErroCesta('Não foi possível enviar. Tente novamente em instantes.');
    } finally {
      btnCesta.disabled = false;
      btnCesta.textContent = 'Quero colaborar';
    }
  });
}
