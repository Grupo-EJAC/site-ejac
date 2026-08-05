// EJAC — Mural de Neon: quadro livre colaborativo, em tempo real.
//
// Duas bases do Firebase, cada uma no que faz de melhor:
//   - Realtime Database: presença (nome + posição de quem está desenhando
//     AGORA). É feito pra isso — latência baixa, e onDisconnect() limpa
//     sozinho se a pessoa fechar a aba ou a conexão cair no meio.
//   - Firestore: traços já finalizados (permanentes). Um traço só vira
//     documento quando o dedo/mouse solta — arrastar não grava nada no
//     meio do caminho, só no fim.
//
// Login anônimo (Firebase Auth) roda por trás dos panos assim que a
// página carrega: dá um uid estável pra sessão, sem senha nem tela de
// login — só pra regras do RTDB/Firestore saberem "quem" está
// escrevendo (cada um só grava a própria presença; todo traço carrega
// o uid de quem desenhou).
//
// Coordenadas são sempre normalizadas (0 a 1, relativas ao tamanho do
// quadro) — sem isso, o desenho e os cursores apareceriam deslocados em
// telas de tamanho diferente do de quem desenhou.
//
// A validação que vale de verdade é a do firestore.rules/database.rules.json
// (o servidor) — a validação aqui é só "de cortesia".

import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js';
import {
  getAuth, signInAnonymously, onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js';
import {
  getFirestore, collection, addDoc, onSnapshot, query, orderBy, limit, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';
import {
  getDatabase, ref, set, remove, onDisconnect, onChildAdded, onChildChanged, onChildRemoved,
} from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-database.js';
import { firebaseConfig } from './firebase-config.js';

const NOME_MAX = 20;
const CORES = ['rosa', 'laranja'];
const COR_HEX = { rosa: '#E4568F', laranja: '#C14D13' };
const THROTTLE_MS = 120; // intervalo mínimo entre gravações de presença
const MAX_TRACOS = 400; // teto de traços mantidos vivos no quadro
const DIST_MIN_PONTO = 0.004; // decimação: só grava ponto novo se andou isso (normalizado, 0–1)
const LARGURA_TRACO = 4;
const BLUR_NEON = 12;

const quadroEl = document.getElementById('mural-quadro');
const canvas = document.getElementById('mural-canvas');
const ctx = canvas.getContext('2d');
const cursoresEl = document.getElementById('mural-cursores');
const carregandoEl = document.getElementById('mural-carregando');
const modalFundoEl = document.getElementById('mural-modal-fundo');
const formNomeEl = document.getElementById('form-mural-nome');
const inputNomeEl = document.getElementById('mural-input-nome');
const meuNomeEl = document.getElementById('mural-meu-nome');
const corIndicadorEl = document.getElementById('mural-cor-indicador');
const btnTrocarNomeEl = document.getElementById('btn-mural-trocar-nome');

// ------------------------------------------------------------
// Identidade local: nome (perguntado uma vez, guardado no localStorage)
// + cor (sorteada uma vez só, fica igual nas próximas visitas)
// ------------------------------------------------------------
function carregarIdentidade() {
  const nome = localStorage.getItem('ejac-mural-nome') || '';
  let cor = localStorage.getItem('ejac-mural-cor');
  if (!CORES.includes(cor)) {
    cor = CORES[Math.floor(Math.random() * CORES.length)];
    localStorage.setItem('ejac-mural-cor', cor);
  }
  return { nome, cor };
}

const identidade = carregarIdentidade();

function salvarNome(nome) {
  identidade.nome = nome;
  localStorage.setItem('ejac-mural-nome', nome);
  if (meuNomeEl) meuNomeEl.textContent = nome;
}

if (meuNomeEl && identidade.nome) meuNomeEl.textContent = identidade.nome;
if (corIndicadorEl) corIndicadorEl.style.background = COR_HEX[identidade.cor];

function abrirModalNome() {
  if (!modalFundoEl) return;
  modalFundoEl.hidden = false;
  if (inputNomeEl) {
    inputNomeEl.value = identidade.nome || '';
    inputNomeEl.focus();
  }
}
function fecharModalNome() {
  if (modalFundoEl) modalFundoEl.hidden = true;
}

if (!identidade.nome) abrirModalNome();

if (formNomeEl) {
  formNomeEl.addEventListener('submit', (e) => {
    e.preventDefault();
    const nome = inputNomeEl.value.trim().slice(0, NOME_MAX);
    if (!nome) return;
    salvarNome(nome);
    fecharModalNome();
  });
}
if (btnTrocarNomeEl) {
  btnTrocarNomeEl.addEventListener('click', abrirModalNome);
}

// ------------------------------------------------------------
// Canvas: o bitmap nunca é a fonte da verdade — cada traço fica
// guardado como lista de pontos normalizados, e um resize simplesmente
// redesenha tudo do zero na escala nova. Assim a tela pode girar/mudar
// de tamanho sem esticar ou cortar o que já foi desenhado.
// ------------------------------------------------------------
let tracosCarregados = []; // [{ id, pontos: [{x,y}], cor }]
const idsTracosVistos = new Set();

function medirCanvas() {
  const rect = quadroEl.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const larguraCss = Math.max(1, Math.round(rect.width));
  const alturaCss = Math.max(1, Math.round(rect.height));
  const larguraPx = Math.round(larguraCss * dpr);
  const alturaPx = Math.round(alturaCss * dpr);
  if (canvas.width !== larguraPx || canvas.height !== alturaPx) {
    canvas.width = larguraPx;
    canvas.height = alturaPx;
  }
  return { dpr };
}

function desenharLinha(pontos, cor, dims) {
  if (!pontos || pontos.length < 2) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = LARGURA_TRACO * dims.dpr;
  ctx.strokeStyle = COR_HEX[cor] || COR_HEX.rosa;
  ctx.shadowColor = COR_HEX[cor] || COR_HEX.rosa;
  ctx.shadowBlur = BLUR_NEON * dims.dpr;
  ctx.beginPath();
  ctx.moveTo(pontos[0].x * canvas.width, pontos[0].y * canvas.height);
  for (let i = 1; i < pontos.length; i++) {
    ctx.lineTo(pontos[i].x * canvas.width, pontos[i].y * canvas.height);
  }
  ctx.stroke();
  ctx.restore();
}

function redesenharTudo() {
  const dims = medirCanvas();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  tracosCarregados.forEach((t) => desenharLinha(t.pontos, t.cor, dims));
}

let redesenhoPendente = false;
function agendarRedesenho() {
  if (redesenhoPendente) return;
  redesenhoPendente = true;
  requestAnimationFrame(() => {
    redesenhoPendente = false;
    redesenharTudo();
  });
}

window.addEventListener('resize', agendarRedesenho);
if (window.ResizeObserver) new ResizeObserver(agendarRedesenho).observe(quadroEl);
medirCanvas();

// ------------------------------------------------------------
// Firebase: Firestore (traços) + Realtime Database (presença) + Auth
// anônimo, compartilhando o mesmo app/config do resto do site.
// ------------------------------------------------------------
let db = null;
let rtdb = null;
let auth = null;
let uid = null;
let colTracos = null;

function mostrarCarregando(texto) {
  if (carregandoEl) {
    carregandoEl.textContent = texto;
    carregandoEl.hidden = false;
  }
}
function esconderCarregando() {
  if (carregandoEl) carregandoEl.hidden = true;
}

if (firebaseConfig.apiKey.includes('COLE_AQUI')) {
  mostrarCarregando('O mural ainda não está conectado ao Firebase.');
} else {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  rtdb = getDatabase(app);
  auth = getAuth(app);
  colTracos = collection(db, 'muralTracos');

  onAuthStateChanged(auth, (user) => {
    if (!user) return;
    uid = user.uid;
    iniciarPresenca();
    iniciarSincroniaTracos();
  });

  signInAnonymously(auth).catch(() => {
    mostrarCarregando('Não foi possível conectar ao mural agora.');
  });
}

function iniciarSincroniaTracos() {
  const q = query(colTracos, orderBy('criadoEm', 'desc'), limit(MAX_TRACOS));
  onSnapshot(
    q,
    (snapshot) => {
      let mudou = false;
      snapshot.docChanges().forEach((mudanca) => {
        const id = mudanca.doc.id;
        if (mudanca.type === 'added' && !idsTracosVistos.has(id)) {
          const dados = mudanca.doc.data();
          tracosCarregados.push({ id, pontos: dados.pontos, cor: dados.cor });
          idsTracosVistos.add(id);
          mudou = true;
        } else if (mudanca.type === 'removed' && idsTracosVistos.has(id)) {
          tracosCarregados = tracosCarregados.filter((t) => t.id !== id);
          idsTracosVistos.delete(id);
          mudou = true;
        }
      });
      esconderCarregando();
      if (mudou) agendarRedesenho();
    },
    () => mostrarCarregando('Não foi possível carregar o mural agora.')
  );
}

// ------------------------------------------------------------
// Presença (Realtime Database): throttled, e limpa sozinha se a
// conexão cair (onDisconnect) — sem depender do navegador rodar
// nenhum código no momento da desconexão.
// ------------------------------------------------------------
let refPresencaMinha = null;
let ultimoEnvioPresenca = 0;

function iniciarPresenca() {
  refPresencaMinha = ref(rtdb, `presence/${uid}`);
  onDisconnect(refPresencaMinha).remove();
}

function enviarPresenca(xNorm, yNorm) {
  if (!refPresencaMinha) return;
  const agora = Date.now();
  if (agora - ultimoEnvioPresenca < THROTTLE_MS) return;
  ultimoEnvioPresenca = agora;
  set(refPresencaMinha, {
    nome: identidade.nome || 'Anônimo',
    x: xNorm,
    y: yNorm,
    cor: identidade.cor,
    atualizadoEm: agora,
  }).catch(() => { /* presença é "best effort" — nunca deve travar o desenho */ });
}

function limparPresenca() {
  if (refPresencaMinha) remove(refPresencaMinha).catch(() => {});
}

// ------------------------------------------------------------
// Cursores remotos: uma tag <span> por pessoa desenhando, posicionada
// via CSS transform (a suavização entre posições é a transition do
// CSS, não JS) — some assim que a pessoa solta o traço (onDisconnect
// ou remoção explícita cuidam disso do lado de quem estava desenhando).
// ------------------------------------------------------------
const tagsCursores = new Map(); // uid -> elemento <span>

function posicionarTag(el, xNorm, yNorm) {
  const rect = quadroEl.getBoundingClientRect();
  el.style.transform = `translate(${xNorm * rect.width}px, ${yNorm * rect.height}px)`;
}

if (rtdb) {
  const refTodaPresenca = ref(rtdb, 'presence');

  onChildAdded(refTodaPresenca, (snap) => {
    if (snap.key === uid) return; // não mostra a própria etiqueta pra si mesmo
    const val = snap.val();
    if (!val) return;
    const el = document.createElement('span');
    el.className = 'mural-cursor-nome';
    el.style.setProperty('--cor-cursor', COR_HEX[val.cor] || COR_HEX.rosa);
    el.textContent = val.nome || 'Anônimo';
    cursoresEl.appendChild(el);
    tagsCursores.set(snap.key, el);
    posicionarTag(el, val.x, val.y);
  });

  onChildChanged(refTodaPresenca, (snap) => {
    if (snap.key === uid) return;
    const val = snap.val();
    const el = tagsCursores.get(snap.key);
    if (!el || !val) return;
    el.textContent = val.nome || 'Anônimo';
    el.style.setProperty('--cor-cursor', COR_HEX[val.cor] || COR_HEX.rosa);
    posicionarTag(el, val.x, val.y);
  });

  onChildRemoved(refTodaPresenca, (snap) => {
    const el = tagsCursores.get(snap.key);
    if (el) el.remove();
    tagsCursores.delete(snap.key);
  });
}

// ------------------------------------------------------------
// Desenho local — Pointer Events unificam mouse, toque e caneta numa
// API só (em vez de mousedown/touchstart separados). `touch-action:
// none` no CSS já bloqueia o scroll/zoom por gesto dentro do quadro;
// o preventDefault() no pointermove é reforço, pra navegadores que
// ainda tentam interpretar o gesto como rolagem de página.
// ------------------------------------------------------------
let desenhando = false;
let pontosDoTraco = []; // pontos decimados — é o que vai pro Firestore
let ultimoPontoBruto = null; // pra desenhar local liso, sem esperar decimação
let pointerAtivoId = null; // só um traço por vez; um segundo dedo (ex.: palma no celular) é ignorado

function coordNormalizada(e) {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width;
  const y = (e.clientY - rect.top) / rect.height;
  return { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) };
}

function distancia(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function desenharSegmentoLocal(p1, p2, dims) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = LARGURA_TRACO * dims.dpr;
  ctx.strokeStyle = COR_HEX[identidade.cor];
  ctx.shadowColor = COR_HEX[identidade.cor];
  ctx.shadowBlur = BLUR_NEON * dims.dpr;
  ctx.beginPath();
  ctx.moveTo(p1.x * canvas.width, p1.y * canvas.height);
  ctx.lineTo(p2.x * canvas.width, p2.y * canvas.height);
  ctx.stroke();
  ctx.restore();
}

canvas.addEventListener('pointerdown', (e) => {
  if (!db) return;
  if (!identidade.nome) {
    abrirModalNome();
    return;
  }
  if (desenhando) return; // já tem um traço em andamento — ignora um segundo dedo/ponteiro
  desenhando = true;
  pointerAtivoId = e.pointerId;
  canvas.setPointerCapture(e.pointerId);
  const p = coordNormalizada(e);
  pontosDoTraco = [p];
  ultimoPontoBruto = p;
  enviarPresenca(p.x, p.y);
});

canvas.addEventListener('pointermove', (e) => {
  if (!desenhando || e.pointerId !== pointerAtivoId) return;
  e.preventDefault();
  const p = coordNormalizada(e);
  const dims = { dpr: window.devicePixelRatio || 1 };
  if (ultimoPontoBruto) desenharSegmentoLocal(ultimoPontoBruto, p, dims);
  ultimoPontoBruto = p;
  const ultimoSalvo = pontosDoTraco[pontosDoTraco.length - 1];
  if (!ultimoSalvo || distancia(ultimoSalvo, p) >= DIST_MIN_PONTO) {
    pontosDoTraco.push(p);
  }
  enviarPresenca(p.x, p.y);
}, { passive: false });

async function finalizarTraco(e) {
  if (!desenhando || (e && e.pointerId !== pointerAtivoId)) return;
  desenhando = false;
  pointerAtivoId = null;
  limparPresenca();

  const pontosParaSalvar = pontosDoTraco;
  pontosDoTraco = [];
  ultimoPontoBruto = null;

  if (pontosParaSalvar.length >= 2 && colTracos && uid) {
    try {
      await addDoc(colTracos, {
        uid,
        nome: identidade.nome,
        cor: identidade.cor,
        pontos: pontosParaSalvar,
        criadoEm: serverTimestamp(),
      });
      // O onSnapshot acima vai redesenhar esse traço quando a escrita
      // chegar — é o mesmo traço, no mesmo lugar, então redesenhar por
      // cima do que já foi desenhado ao vivo não causa problema nenhum.
    } catch (err) {
      // O traço já apareceu na tela de quem desenhou; só não persiste
      // pros outros se isso falhar. Não trava nem avisa erro — é uma
      // feature de brincadeira, não um formulário importante.
    }
  }
}

canvas.addEventListener('pointerup', finalizarTraco);
canvas.addEventListener('pointercancel', finalizarTraco);
canvas.addEventListener('pointerleave', (e) => { if (desenhando && e.pointerId === pointerAtivoId) finalizarTraco(e); });

window.addEventListener('beforeunload', limparPresenca);
