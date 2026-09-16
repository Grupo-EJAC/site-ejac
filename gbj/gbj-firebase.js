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

const MOTIVO_TEXTO = { eliminado: 'Zerou as vidas', parou: 'Parou por conta' };

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
  const tbody = document.getElementById('gbj-historico-tbody');
  if (!tbody) return;
  tbody.textContent = '';

  const sessoes = [];
  snapshot.forEach((docSnap) => sessoes.push(docSnap.data()));

  // Ordena no cliente (mais recente primeiro) pra não depender de índice
  // composto no Firestore — a query só filtra por uid.
  sessoes.sort((a, b) => (b.criadoEm ? b.criadoEm.toMillis() : 0) - (a.criadoEm ? a.criadoEm.toMillis() : 0));

  if (sessoes.length === 0) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 6;
    td.textContent = 'Você ainda não treinou nada. Escolha uma modalidade acima pra começar.';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  sessoes.forEach((s) => {
    const tr = document.createElement('tr');
    [
      formatarData(s.criadoEm),
      s.modalidade,
      formatarTempoLimite(s.tempoLimiteSeg),
      String(s.rodadas),
      `${s.acertos}/${s.rodadas}`,
      MOTIVO_TEXTO[s.motivo] || s.motivo,
    ].forEach((valor) => {
      const td = document.createElement('td');
      td.textContent = valor;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
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

  if (!user) {
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
      const tbody = document.getElementById('gbj-historico-tbody');
      if (tbody) tbody.innerHTML = '<tr><td colspan="6">Não foi possível carregar o histórico agora.</td></tr>';
    }
  );
});
