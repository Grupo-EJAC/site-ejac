// EJAC — Painel administrativo: pedidos de camiseta + cesta básica
// (com WhatsApp/IP), com login Google. Quem entra vê e pode excluir; a
// lista de quem PODE entrar mora no firestore.rules (função
// emailsAdmin()), não aqui — este arquivo não decide autorização, só
// tenta ler os dados e reage se o servidor recusar.

import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js';
import {
  getFirestore, collection, doc, query, orderBy, where, limit,
  onSnapshot, getDocs, deleteDoc, writeBatch,
} from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

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
  const colCestaContatos = collection(db, 'cestaContatos');
  const colCestaContribuicoes = collection(db, 'cestaContribuicoes');

  let pararCamiseta = null;
  let pararCesta = null;
  let pedidosCamisetaAtuais = [];

  function pararListeners() {
    if (pararCamiseta) { pararCamiseta(); pararCamiseta = null; }
    if (pararCesta) { pararCesta(); pararCesta = null; }
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

  // ---------------- Cesta básica ----------------

  function renderResumoCesta(contatos) {
    const resumoEl = document.getElementById('cesta-resumo');
    if (!resumoEl) return;
    resumoEl.textContent = '';
    const total = document.createElement('span');
    total.className = 'admin-stat admin-stat-total';
    total.textContent = `${contatos.length} contribuição${contatos.length === 1 ? '' : 'ões'}`;
    resumoEl.appendChild(total);
  }

  // Cada contribuição vira DOIS documentos (cestaContatos + cestaContribuicoes,
  // ligados pelo mesmo grupoId — veja o cesta-firebase.js). Excluir precisa
  // apagar os dois, senão o total público em /cesta/ fica errado.
  async function excluirContribuicaoCesta(contatoId, grupoId) {
    if (!confirm('Excluir esta contribuição da cesta? Essa ação não pode ser desfeita.')) return;
    try {
      await deleteDoc(doc(colCestaContatos, contatoId));
      const relacionados = await getDocs(query(colCestaContribuicoes, where('grupoId', '==', grupoId)));
      if (!relacionados.empty) {
        const lote = writeBatch(db);
        relacionados.forEach((d) => lote.delete(d.ref));
        await lote.commit();
      }
    } catch (err) {
      alert('Não foi possível excluir. Tente de novo.');
    }
  }

  function renderCesta(snapshot) {
    const tbody = document.getElementById('cesta-tbody');
    if (!tbody) return;
    tbody.textContent = '';

    const contatos = [];
    snapshot.forEach((docSnap) => contatos.push({ id: docSnap.id, ...docSnap.data() }));
    renderResumoCesta(contatos);

    if (contatos.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 6;
      td.textContent = 'Nenhuma contribuição ainda.';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    contatos.forEach((c) => {
      const tr = document.createElement('tr');
      [formatarData(c.criadoEm), c.nome, c.item, c.quantidade, c.ip || '—'].forEach((valor) => {
        const td = document.createElement('td');
        td.textContent = valor;
        tr.appendChild(td);
      });
      const tdAcao = document.createElement('td');
      tdAcao.appendChild(criarBotaoExcluir(() => excluirContribuicaoCesta(c.id, c.grupoId)));
      tr.appendChild(tdAcao);
      tbody.appendChild(tr);
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
    pararCesta = onSnapshot(query(colCestaContatos, orderBy('criadoEm', 'desc')), renderCesta);
  });
}
