// EJAC — Painel administrativo: pedidos de camiseta (com WhatsApp/IP),
// com login Google.
// Quem entra vê e pode excluir; a lista de quem PODE entrar mora no
// firestore.rules (função emailsAdmin()), não aqui — este arquivo não
// decide autorização, só tenta ler os dados e reage se o servidor
// recusar.

import { initializeApp, deleteApp } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged,
  createUserWithEmailAndPassword,
} from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js';
import {
  getFirestore, collection, doc, query, where, orderBy, limit,
  onSnapshot, getDocs, deleteDoc, setDoc, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';
import { emailDoUsuario, normalizarUsuario } from './gbj-comum.js';

const telas = {
  carregando: document.getElementById('admin-carregando'),
  login: document.getElementById('admin-login'),
  erro: document.getElementById('admin-erro-acesso'),
  painel: document.getElementById('admin-painel'),
};

function mostrarTela(nome) {
  Object.keys(telas).forEach((chave) => {
    if (telas[chave]) telas[chave].hidden = chave !== nome;
  });
}

const btnLogin = document.getElementById('btn-login-google');
const btnLogout = document.getElementById('btn-logout');
const btnLogoutErro = document.getElementById('btn-logout-erro');
const spanUsuario = document.getElementById('admin-usuario');
const spanErroEmail = document.getElementById('erro-email');
const notaConfig = document.getElementById('admin-nota-config');

const tabsBtns = document.querySelectorAll('.admin-tab-btn');
const tabsPaineis = document.querySelectorAll('.admin-tab-painel');
tabsBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    tabsBtns.forEach((b) => { b.classList.remove('ativo'); b.setAttribute('aria-selected', 'false'); });
    btn.classList.add('ativo');
    btn.setAttribute('aria-selected', 'true');
    const alvo = btn.dataset.tab;
    tabsPaineis.forEach((p) => { p.hidden = p.dataset.tab !== alvo; });
  });
});

function formatarData(timestamp) {
  if (!timestamp || typeof timestamp.toDate !== 'function') return '—';
  return timestamp.toDate().toLocaleString('pt-BR');
}

function criarBotaoExcluir(aoClicar) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'admin-btn-excluir';
  btn.textContent = 'Excluir';
  btn.addEventListener('click', aoClicar);
  return btn;
}

function baixarCSV(nomeArquivo, cabecalho, linhas) {
  const todas = [cabecalho, ...linhas];
  const csv = todas
    .map((linha) => linha.map((valor) => `"${String(valor == null ? '' : valor).replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
  // BOM no início: sem isso o Excel abre acentuação quebrada
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

if (firebaseConfig.apiKey.includes('COLE_AQUI')) {
  mostrarTela('login');
  if (btnLogin) btnLogin.disabled = true;
  if (notaConfig) notaConfig.hidden = false;
} else {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  const colCamiseta = collection(db, 'camisetaPedidos');
  const colRanking = collection(db, 'termoRanking');
  const colMembrosGbj = collection(db, 'gbjMembros');

  let pararCamiseta = null;
  let pararRanking = null;
  let pararMembrosGbj = null;
  let pedidosCamisetaAtuais = [];

  function pararListeners() {
    if (pararCamiseta) { pararCamiseta(); pararCamiseta = null; }
    if (pararRanking) { pararRanking(); pararRanking = null; }
    if (pararMembrosGbj) { pararMembrosGbj(); pararMembrosGbj = null; }
  }

  // ---------------- Camisetas ----------------

  function renderResumoCamiseta(pedidos) {
    const resumoEl = document.getElementById('camiseta-resumo');
    if (!resumoEl) return;
    resumoEl.textContent = '';
    const porTamanho = {};
    pedidos.forEach((p) => { porTamanho[p.tamanho] = (porTamanho[p.tamanho] || 0) + 1; });

    const total = document.createElement('span');
    total.className = 'admin-stat admin-stat-total';
    total.textContent = `${pedidos.length} pedido${pedidos.length === 1 ? '' : 's'}`;
    resumoEl.appendChild(total);

    Object.keys(porTamanho).sort().forEach((tamanho) => {
      const chip = document.createElement('span');
      chip.className = 'admin-stat';
      chip.textContent = `${tamanho}: ${porTamanho[tamanho]}`;
      resumoEl.appendChild(chip);
    });
  }

  async function excluirPedidoCamiseta(id) {
    if (!confirm('Excluir este pedido de camiseta? Essa ação não pode ser desfeita.')) return;
    try {
      await deleteDoc(doc(colCamiseta, id));
    } catch (err) {
      alert('Não foi possível excluir. Tente de novo.');
    }
  }

  function renderCamiseta(snapshot) {
    const tbody = document.getElementById('camiseta-tbody');
    if (!tbody) return;
    tbody.textContent = '';

    const pedidos = [];
    snapshot.forEach((docSnap) => pedidos.push({ id: docSnap.id, ...docSnap.data() }));
    pedidosCamisetaAtuais = pedidos;
    renderResumoCamiseta(pedidos);

    if (pedidos.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 8;
      td.textContent = 'Nenhum pedido ainda.';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    pedidos.forEach((p) => {
      const tr = document.createElement('tr');
      [
        formatarData(p.criadoEm), p.nomeCompleto, p.nomeCamisa,
        p.numeroCamisa, p.tamanho, p.whatsapp, p.ip || '—',
      ].forEach((valor) => {
        const td = document.createElement('td');
        td.textContent = valor;
        tr.appendChild(td);
      });
      const tdAcao = document.createElement('td');
      tdAcao.appendChild(criarBotaoExcluir(() => excluirPedidoCamiseta(p.id)));
      tr.appendChild(tdAcao);
      tbody.appendChild(tr);
    });
  }

  const btnExportar = document.getElementById('btn-exportar-csv');
  if (btnExportar) {
    btnExportar.addEventListener('click', () => {
      const linhas = pedidosCamisetaAtuais.map((p) => [
        formatarData(p.criadoEm), p.nomeCompleto, p.nomeCamisa,
        p.numeroCamisa, p.tamanho, p.whatsapp, p.ip || '',
      ]);
      const dataArquivo = new Date().toISOString().slice(0, 10);
      baixarCSV(
        `pedidos-camiseta-ejac-${dataArquivo}.csv`,
        ['Data', 'Nome completo', 'Nome na camisa', 'Número', 'Tamanho', 'WhatsApp', 'IP'],
        linhas
      );
    });
  }

  // ---------------- Termo: ranking ----------------
  //
  // As regras do Firestore já deixam qualquer um LER o termoRanking (é o
  // placar público) — o que só o admin pode fazer é EXCLUIR uma marca.
  // Por isso não precisa de leitura de teste aqui como tem no camiseta:
  // se chegou até o painel, já passou pela verificação de admin.

  function diaDeHoje() {
    // Mesma conta do jogo: data LOCAL, não UTC (ver termo/jogo.js)
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function formatarTempoRanking(ms) {
    if (!ms) return '—';
    const s = Math.round(ms / 1000);
    return s < 60 ? `${s}s` : `${Math.floor(s / 60)}min${String(s % 60).padStart(2, '0')}`;
  }

  async function excluirMarcaRanking(id, nome) {
    if (!confirm(`Excluir a marca de "${nome}" do placar? Essa ação não pode ser desfeita.`)) return;
    try {
      await deleteDoc(doc(colRanking, id));
    } catch (err) {
      alert('Não foi possível excluir. Tente de novo.');
    }
  }

  function renderRanking(snapshot) {
    const tbody = document.getElementById('termo-tbody');
    const resumoEl = document.getElementById('termo-resumo');
    if (!tbody) return;

    const marcas = [];
    snapshot.forEach((docSnap) => marcas.push({ id: docSnap.id, ...docSnap.data() }));

    if (resumoEl) {
      resumoEl.textContent = '';
      const total = document.createElement('span');
      total.className = 'admin-stat admin-stat-total';
      total.textContent = `${marcas.length} marca${marcas.length === 1 ? '' : 's'}`;
      resumoEl.appendChild(total);
      const vitorias = marcas.filter((m) => m.venceu).length;
      const chip = document.createElement('span');
      chip.className = 'admin-stat';
      chip.textContent = `${vitorias} ${vitorias === 1 ? 'venceu' : 'venceram'}`;
      resumoEl.appendChild(chip);
    }

    tbody.textContent = '';
    if (marcas.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 6;
      td.textContent = 'Ninguém jogou nesse dia/modo.';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    // Mesma ordem do placar público: quem venceu primeiro, depois menos
    // tentativas, depois menor tempo — pra achar rápido quem está no topo.
    marcas.sort((a, b) => {
      if (a.venceu !== b.venceu) return a.venceu ? -1 : 1;
      if (!a.venceu) return 0;
      if (a.tentativas !== b.tentativas) return a.tentativas - b.tentativas;
      return (a.duracaoMs || Infinity) - (b.duracaoMs || Infinity);
    });

    marcas.forEach((m) => {
      const tr = document.createElement('tr');
      [
        m.nome, m.venceu ? 'Venceu' : 'Não venceu', String(m.tentativas),
        formatarTempoRanking(m.duracaoMs), formatarData(m.criadoEm),
      ].forEach((valor) => {
        const td = document.createElement('td');
        td.textContent = valor;
        tr.appendChild(td);
      });
      const tdAcao = document.createElement('td');
      tdAcao.appendChild(criarBotaoExcluir(() => excluirMarcaRanking(m.id, m.nome)));
      tr.appendChild(tdAcao);
      tbody.appendChild(tr);
    });
  }

  const inputDiaRanking = document.getElementById('termo-filtro-dia');
  const selectModoRanking = document.getElementById('termo-filtro-modo');

  function assinarRanking() {
    if (pararRanking) { pararRanking(); pararRanking = null; }
    const dia = (inputDiaRanking && inputDiaRanking.value) || diaDeHoje();
    const modo = (selectModoRanking && selectModoRanking.value) || 'termo';
    pararRanking = onSnapshot(
      query(colRanking, where('dia', '==', dia), where('modo', '==', modo)),
      renderRanking,
      () => {
        const tbody = document.getElementById('termo-tbody');
        if (tbody) { tbody.textContent = ''; }
      }
    );
  }

  if (inputDiaRanking) {
    inputDiaRanking.value = diaDeHoje();
    inputDiaRanking.addEventListener('change', assinarRanking);
  }
  if (selectModoRanking) selectModoRanking.addEventListener('change', assinarRanking);

  // ---------------- GBJ: membros ----------------
  //
  // O GBJ pede "usuário e senha", mas por baixo é e-mail+senha do próprio
  // Firebase Auth — só que criar uma conta pelo SDK do cliente
  // (createUserWithEmailAndPassword) AUTOMATICAMENTE faz login como essa
  // conta nova, o que expulsaria o admin da própria sessão. A saída sem
  // servidor: um app do Firebase SEGUNDO e temporário, só pra criar a
  // conta; o admin continua logado no app principal o tempo todo.

  function renderMembrosGbj(snapshot) {
    const tbody = document.getElementById('gbj-membros-tbody');
    const resumoEl = document.getElementById('gbj-membros-resumo');
    if (!tbody) return;

    const membros = [];
    snapshot.forEach((docSnap) => membros.push({ id: docSnap.id, ...docSnap.data() }));
    membros.sort((a, b) => (a.usuario || '').localeCompare(b.usuario || ''));

    if (resumoEl) {
      resumoEl.textContent = '';
      const total = document.createElement('span');
      total.className = 'admin-stat admin-stat-total';
      total.textContent = `${membros.length} membro${membros.length === 1 ? '' : 's'}`;
      resumoEl.appendChild(total);
    }

    tbody.textContent = '';
    if (membros.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 4;
      td.textContent = 'Nenhum membro criado ainda.';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    membros.forEach((m) => {
      const tr = document.createElement('tr');
      [m.usuario, m.nome, formatarData(m.criadoEm)].forEach((valor) => {
        const td = document.createElement('td');
        td.textContent = valor;
        tr.appendChild(td);
      });
      const tdAcao = document.createElement('td');
      tdAcao.appendChild(criarBotaoExcluir(() => excluirMembroGbj(m.id, m.nome)));
      tr.appendChild(tdAcao);
      tbody.appendChild(tr);
    });
  }

  async function excluirMembroGbj(uid, nome) {
    if (!confirm(`Excluir o acesso de "${nome}" ao GBJ? A pessoa não consegue mais entrar, mas não dá pra apagar a conta em si sem servidor próprio.`)) return;
    try {
      await deleteDoc(doc(colMembrosGbj, uid));
    } catch (err) {
      alert('Não foi possível excluir. Tente de novo.');
    }
  }

  const formCriarMembro = document.getElementById('form-gbj-criar-membro');
  const msgCriarMembro = document.getElementById('gbj-criar-msg');

  if (formCriarMembro) {
    formCriarMembro.addEventListener('submit', async (e) => {
      e.preventDefault();
      msgCriarMembro.className = 'form-msg';

      const usuarioBruto = document.getElementById('gbj-novo-usuario').value;
      const nome = document.getElementById('gbj-novo-nome').value.trim();
      const senha = document.getElementById('gbj-nova-senha').value;
      const usuario = normalizarUsuario(usuarioBruto);

      if (!usuario) {
        msgCriarMembro.textContent = 'Usuário precisa ter pelo menos uma letra ou número.';
        msgCriarMembro.className = 'form-msg erro';
        return;
      }
      if (senha.length < 6) {
        msgCriarMembro.textContent = 'A senha precisa ter pelo menos 6 caracteres.';
        msgCriarMembro.className = 'form-msg erro';
        return;
      }

      const btn = formCriarMembro.querySelector('button[type="submit"]');
      btn.disabled = true;

      // App secundário só pra este cadastro — evita derrubar a sessão do
      // admin, que continua no app principal (initializeApp de cima).
      const appTemp = initializeApp(firebaseConfig, 'gbj-criar-membro-' + Date.now());
      try {
        const authTemp = getAuth(appTemp);
        const cred = await createUserWithEmailAndPassword(authTemp, emailDoUsuario(usuario), senha);
        await setDoc(doc(colMembrosGbj, cred.user.uid), {
          usuario, nome, criadoEm: serverTimestamp(),
        });
        formCriarMembro.reset();
        msgCriarMembro.textContent = `Membro "${nome}" criado. Usuário: ${usuario}`;
        msgCriarMembro.className = 'form-msg sucesso';
      } catch (err) {
        let texto = 'Não foi possível criar o membro. Tente de novo.';
        if (err && err.code === 'auth/email-already-in-use') texto = 'Esse usuário já existe.';
        else if (err && err.code === 'auth/weak-password') texto = 'Senha fraca demais — use pelo menos 6 caracteres.';
        msgCriarMembro.textContent = texto;
        msgCriarMembro.className = 'form-msg erro';
      } finally {
        btn.disabled = false;
        await deleteApp(appTemp).catch(() => {});
      }
    });
  }

  // ---------------- Login / autorização ----------------

  if (btnLogin) {
    btnLogin.addEventListener('click', async () => {
      try {
        await signInWithPopup(auth, new GoogleAuthProvider());
      } catch (err) {
        if (err && err.code === 'auth/unauthorized-domain') {
          alert(
            'Este domínio (' + location.hostname + ') ainda não está autorizado no Firebase.\n\n' +
            'No Firebase Console: Authentication → Settings → Domínios autorizados → Adicionar domínio.'
          );
        } else if (err && err.code === 'auth/popup-blocked') {
          alert('O navegador bloqueou a janela de login. Permita pop-ups pra este site e tente de novo.');
        } else if (err && err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
          alert('Não foi possível entrar (' + (err.code || err.message || 'erro desconhecido') + '). Tente de novo.');
        }
      }
    });
  }

  [btnLogout, btnLogoutErro].forEach((btn) => {
    if (btn) btn.addEventListener('click', () => signOut(auth));
  });

  onAuthStateChanged(auth, async (user) => {
    pararListeners();

    if (!user) {
      mostrarTela('login');
      return;
    }

    mostrarTela('carregando');

    // As regras do Firestore (não este código) decidem quem é admin. Faz
    // uma leitura de teste: se o servidor recusar (permission-denied),
    // essa conta não está na lista emailsAdmin() do firestore.rules.
    try {
      await getDocs(query(colCamiseta, limit(1)));
    } catch (err) {
      if (spanErroEmail) spanErroEmail.textContent = user.email || '';
      mostrarTela('erro');
      return;
    }

    if (spanUsuario) spanUsuario.textContent = user.email || '';
    mostrarTela('painel');

    pararCamiseta = onSnapshot(query(colCamiseta, orderBy('criadoEm', 'desc')), renderCamiseta);
    assinarRanking();
    pararMembrosGbj = onSnapshot(colMembrosGbj, renderMembrosGbj);
  });
}
