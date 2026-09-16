// EJAC — GBJ: tela de login (usuário/senha) e painel (modalidades +
// histórico). Cada modalidade de treino (ex: sequencia-livros/) faz seu
// próprio login gate e grava o próprio histórico — este arquivo só cuida
// desta página.

import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js';
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js';
import {
  getFirestore, doc, getDoc, collection, query, where, onSnapshot,
} from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';
import { firebaseConfig } from '../firebase-config.js';
import { emailDoUsuario } from '../gbj-comum.js';

const telas = {
  carregando: document.getElementById('gbj-carregando'),
  login: document.getElementById('gbj-login'),
  painel: document.getElementById('gbj-painel'),
};

function mostrarTela(nome) {
  Object.keys(telas).forEach((chave) => {
    if (telas[chave]) telas[chave].hidden = chave !== nome;
  });
}

function formatarData(timestamp) {
  if (!timestamp || typeof timestamp.toDate !== 'function') return '—';
  return timestamp.toDate().toLocaleString('pt-BR');
}

function formatarTempoLimite(seg) {
  return seg > 0 ? `${seg}s por rodada` : 'sem limite';
}

function formatarMedia(ms) {
  if (!ms) return null;
  const s = ms / 1000;
  return s < 10 ? `${s.toFixed(1)}s` : `${Math.round(s)}s`;
}

const MOTIVO_TEXTO = { eliminado: 'Zerou as vidas', parou: 'Parou por conta' };
const MODALIDADE_TEXTO = { 'sequencia-livros': 'Sequência dos Livros' };

const form = document.getElementById('form-gbj-login');
const inputUsuario = document.getElementById('gbj-input-usuario');
const inputSenha = document.getElementById('gbj-input-senha');
const msgLogin = document.getElementById('gbj-login-msg');
const btnLogout = document.getElementById('btn-gbj-logout');
const spanNome = document.getElementById('gbj-usuario-nome');

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let pararHistorico = null;

function renderHistorico(snapshot) {
  const grid = document.getElementById('gbj-historico-grid');
  if (!grid) return;
  grid.textContent = '';

  const sessoes = [];
  snapshot.forEach((docSnap) => sessoes.push(docSnap.data()));

  // Ordena no cliente (mais recente primeiro) pra não depender de índice
  // composto no Firestore — a query só filtra por uid.
  sessoes.sort((a, b) => (b.criadoEm ? b.criadoEm.toMillis() : 0) - (a.criadoEm ? a.criadoEm.toMillis() : 0));

  if (sessoes.length === 0) {
    const p = document.createElement('p');
    p.className = 'admin-sub';
    p.textContent = 'Você ainda não treinou nada. Escolha uma modalidade acima pra começar.';
    grid.appendChild(p);
    return;
  }

  sessoes.forEach((s) => {
    const card = document.createElement('article');
    card.className = 'gbj-historico-card';

    const modalidade = document.createElement('span');
    modalidade.className = 'gbj-historico-modalidade';
    modalidade.textContent = MODALIDADE_TEXTO[s.modalidade] || s.modalidade;

    const quando = document.createElement('span');
    quando.className = 'gbj-historico-quando';
    quando.textContent = formatarData(s.criadoEm);

    const stats = document.createElement('span');
    stats.className = 'gbj-historico-stats';
    stats.textContent = `${formatarTempoLimite(s.tempoLimiteSeg)} · ${s.rodadas} rodada${s.rodadas === 1 ? '' : 's'} · ${s.acertos}/${s.rodadas} acertos`;

    const media = document.createElement('span');
    media.className = 'gbj-historico-stats';
    const tempoMedio = formatarMedia(s.mediaTempoAcertosMs);
    media.textContent = tempoMedio ? `Tempo médio dos acertos: ${tempoMedio}` : 'Sem acerto pra tirar média';

    const resultado = document.createElement('span');
    resultado.className = 'gbj-historico-resultado' + (s.motivo === 'eliminado' ? ' gbj-historico-resultado-eliminado' : '');
    resultado.textContent = MOTIVO_TEXTO[s.motivo] || s.motivo;

    card.append(modalidade, quando, stats, media, resultado);
    grid.appendChild(card);
  });
}

if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msgLogin.className = 'form-msg';
    const usuario = inputUsuario.value;
    const senha = inputSenha.value;
    if (!usuario || !senha) return;

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      await signInWithEmailAndPassword(auth, emailDoUsuario(usuario), senha);
      inputSenha.value = '';
    } catch (err) {
      let texto = 'Não deu pra entrar. Tente de novo.';
      if (err && (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found')) {
        texto = 'Usuário ou senha incorretos.';
      } else if (err && err.code === 'auth/too-many-requests') {
        texto = 'Muitas tentativas seguidas. Espere um pouco e tente de novo.';
      } else if (err && err.code === 'auth/network-request-failed') {
        texto = 'Sem conexão. Confira sua internet e tente de novo.';
      }
      msgLogin.textContent = texto;
      msgLogin.className = 'form-msg erro';
    } finally {
      btn.disabled = false;
    }
  });
}

if (btnLogout) {
  btnLogout.addEventListener('click', () => signOut(auth));
}

onAuthStateChanged(auth, async (user) => {
  if (pararHistorico) { pararHistorico(); pararHistorico = null; }

  // O login anônimo do Termo e o login Google do /admin/ usam o MESMO
  // projeto Firebase (e o mesmo app "padrão", já que ninguém aqui dá nome
  // pro initializeApp). Isso significa que a sessão de um vaza pro outro:
  // quem jogou o Termo ou é coordenador logado no admin chega aqui já
  // "autenticado" com uma conta que nunca foi de membro do GBJ — e sem
  // este filtro, isso mostrava "sua conta não está mais ativa", uma
  // mensagem alarmante e errada pra quem nunca tentou entrar no GBJ.
  const ehLoginSenha = user && !user.isAnonymous && user.providerData.some((p) => p.providerId === 'password');
  if (!ehLoginSenha) {
    mostrarTela('login');
    return;
  }

  mostrarTela('carregando');

  // O perfil em gbjMembros/{uid} não é só o nome pra cumprimentar: é ele
  // que diz se a conta ainda está ativa. Login e senha continuam válidos
  // no Firebase Auth mesmo depois que um coordenador "exclui" o membro
  // pelo painel — apagar a conta de outra pessoa não dá pra fazer só com
  // o SDK do cliente, sem servidor próprio. O que dá pra fazer, e é o que
  // de fato tranca o acesso, é exigir que este documento exista pra
  // passar da tela de login.
  let perfil;
  try {
    perfil = await getDoc(doc(db, 'gbjMembros', user.uid));
  } catch (err) {
    perfil = null;
  }

  if (!perfil || !perfil.exists()) {
    await signOut(auth);
    msgLogin.textContent = 'Sua conta não está mais ativa. Fale com um coordenador.';
    msgLogin.className = 'form-msg erro';
    mostrarTela('login');
    return;
  }

  if (spanNome) spanNome.textContent = perfil.data().nome || 'membro';

  mostrarTela('painel');

  pararHistorico = onSnapshot(
    query(collection(db, 'gbjHistoricoSequenciaLivros'), where('uid', '==', user.uid)),
    renderHistorico,
    () => {
      const grid = document.getElementById('gbj-historico-grid');
      if (grid) grid.innerHTML = '<p class="admin-sub">Não foi possível carregar o histórico agora.</p>';
    }
  );
});
