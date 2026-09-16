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

function criarBotaoExcluir(aoClicar, texto) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'admin-btn-excluir';
  btn.textContent = texto || 'Excluir';
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
  // Nome próprio pro app, não o padrão: sem isso, o login Google daqui
  // compartilharia sessão com o anônimo do Termo e o e-mail/senha do GBJ
  // (as três coisas usam o mesmo projeto Firebase) — quem visitasse por
  // último "roubava" a sessão dos outros dois, e o login do admin nunca
  // ficava salvo de verdade.
  const app = initializeApp(firebaseConfig, 'admin');
  const auth = getAuth(app);
  const db = getFirestore(app);

  const colCamiseta = collection(db, 'camisetaPedidos');
  const colRanking = collection(db, 'termoRanking');
  const colMembrosGbj = collection(db, 'gbjMembros');

  let pararCamiseta = null;
  let pararRanking = null;
  let pararMembrosGbj = null;
  let pararHistoricoGbjFns = [];
  let pararContestadasGbj = null;
  let pedidosCamisetaAtuais = [];

  function pararListeners() {
    if (pararCamiseta) { pararCamiseta(); pararCamiseta = null; }
    if (pararRanking) { pararRanking(); pararRanking = null; }
    if (pararMembrosGbj) { pararMembrosGbj(); pararMembrosGbj = null; }
    pararHistoricoGbjFns.forEach((parar) => parar());
    pararHistoricoGbjFns = [];
    if (pararContestadasGbj) { pararContestadasGbj(); pararContestadasGbj = null; }
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

  // uid -> { usuario, nome }, pra mostrar nome de gente no histórico (que
  // só grava o uid). Atualizado toda vez que a lista de membros muda, e
  // usado tanto ali quanto pelo histórico.
  let membrosGbjPorUid = {};

  function renderMembrosGbj(snapshot) {
    const tbody = document.getElementById('gbj-membros-tbody');
    const resumoEl = document.getElementById('gbj-membros-resumo');
    if (!tbody) return;

    const membros = [];
    snapshot.forEach((docSnap) => membros.push({ id: docSnap.id, ...docSnap.data() }));
    membros.sort((a, b) => (a.usuario || '').localeCompare(b.usuario || ''));

    membrosGbjPorUid = {};
    membros.forEach((m) => { membrosGbjPorUid[m.id] = m; });
    renderHistoricoGbj();

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

  // ---------------- GBJ: histórico de treino ----------------
  //
  // Mostra o histórico de TODOS os membros (não só o próprio, como no
  // painel do GBJ) — as regras já deixam o admin ler a coleção inteira.
  // Cada modalidade grava numa coleção própria (mesmo padrão desde a
  // primeira, Sequência dos Livros); aqui elas se juntam numa tabela só.

  const NOMES_COLECOES_HISTORICO_GBJ = ['gbjHistoricoSequenciaLivros', 'gbjHistoricoQuiz'];
  const MODALIDADE_TEXTO_ADMIN = { 'sequencia-livros': 'Sequência dos Livros', quiz: 'Quiz' };
  const MOTIVO_TEXTO_ADMIN = { eliminado: 'Zerou as vidas', parou: 'Parou por conta' };
  const sessoesGbjPorColecao = {};

  function formatarTempoLimiteGbj(seg) {
    return seg > 0 ? `${seg}s` : 'sem limite';
  }

  function formatarMediaGbj(ms) {
    if (!ms) return '—';
    const s = ms / 1000;
    return s < 10 ? `${s.toFixed(1)}s` : `${Math.round(s)}s`;
  }

  async function excluirHistoricoGbj(nomeColecao, id, nomeMembro) {
    if (!confirm(`Excluir este treino de "${nomeMembro}" do histórico? Essa ação não pode ser desfeita.`)) return;
    try {
      await deleteDoc(doc(collection(db, nomeColecao), id));
    } catch (err) {
      alert('Não foi possível excluir. Tente de novo.');
    }
  }

  function renderHistoricoGbj() {
    const tbody = document.getElementById('gbj-historico-tbody');
    const resumoEl = document.getElementById('gbj-historico-resumo');
    if (!tbody) return;

    const sessoes = [].concat(...Object.values(sessoesGbjPorColecao));
    sessoes.sort((a, b) => (b.criadoEm ? b.criadoEm.toMillis() : 0) - (a.criadoEm ? a.criadoEm.toMillis() : 0));

    if (resumoEl) {
      resumoEl.textContent = '';
      const total = document.createElement('span');
      total.className = 'admin-stat admin-stat-total';
      total.textContent = `${sessoes.length} treino${sessoes.length === 1 ? '' : 's'}`;
      resumoEl.appendChild(total);
    }

    tbody.textContent = '';
    if (sessoes.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 9;
      td.textContent = 'Ninguém treinou ainda.';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    sessoes.forEach((s) => {
      const membro = membrosGbjPorUid[s.uid];
      const nomeMembro = membro ? membro.nome : '(membro excluído)';
      const tr = document.createElement('tr');
      [
        nomeMembro,
        MODALIDADE_TEXTO_ADMIN[s.modalidade] || s.modalidade,
        formatarData(s.criadoEm),
        formatarTempoLimiteGbj(s.tempoLimiteSeg),
        String(s.rodadas),
        `${s.acertos}/${s.rodadas}`,
        formatarMediaGbj(s.mediaTempoAcertosMs),
        MOTIVO_TEXTO_ADMIN[s.motivo] || s.motivo,
      ].forEach((valor) => {
        const td = document.createElement('td');
        td.textContent = valor;
        tr.appendChild(td);
      });
      const tdAcao = document.createElement('td');
      tdAcao.appendChild(criarBotaoExcluir(() => excluirHistoricoGbj(s._colecao, s.id, nomeMembro)));
      tr.appendChild(tdAcao);
      tbody.appendChild(tr);
    });
  }

  // ---------------- GBJ: perguntas contestadas do Quiz ----------------
  //
  // As perguntas foram digitadas à mão (ver gbj/quiz/perguntas.js) e o
  // gabarito pode ter erro de transcrição. Quem treina contesta uma
  // pergunta pelo botão do Quiz; aqui o coordenador vê o aviso, confere no
  // arquivo e "resolve" (exclui) depois de corrigir — ou de decidir que
  // estava certa mesmo.

  const colContestadasGbj = collection(db, 'gbjPerguntasContestadas');
  const SECAO_QUIZ_TEXTO_ADMIN = { joao: 'Evangelho de João', tobias: 'Tobias', efesios: 'Efésios', gerais: 'Perguntas gerais' };

  async function resolverContestacaoGbj(id) {
    if (!confirm('Marcar esta contestação como resolvida? Ela some da lista (não apaga a pergunta em si, só o aviso).')) return;
    try {
      await deleteDoc(doc(colContestadasGbj, id));
    } catch (err) {
      alert('Não foi possível marcar como resolvida. Tente de novo.');
    }
  }

  function renderContestadasGbj(snapshot) {
    const lista = document.getElementById('gbj-contestadas-lista');
    const resumoEl = document.getElementById('gbj-contestadas-resumo');
    if (!lista) return;

    const contestacoes = [];
    snapshot.forEach((docSnap) => contestacoes.push({ id: docSnap.id, ...docSnap.data() }));
    contestacoes.sort((a, b) => (b.criadoEm ? b.criadoEm.toMillis() : 0) - (a.criadoEm ? a.criadoEm.toMillis() : 0));

    if (resumoEl) {
      resumoEl.textContent = '';
      const total = document.createElement('span');
      total.className = 'admin-stat' + (contestacoes.length ? ' admin-stat-total' : '');
      total.textContent = `${contestacoes.length} pendente${contestacoes.length === 1 ? '' : 's'}`;
      resumoEl.appendChild(total);
    }

    lista.textContent = '';
    if (contestacoes.length === 0) {
      const p = document.createElement('p');
      p.className = 'admin-sub';
      p.textContent = 'Nenhuma contestação pendente.';
      lista.appendChild(p);
      return;
    }

    contestacoes.forEach((c) => {
      const membro = membrosGbjPorUid[c.uid];
      const nomeMembro = membro ? membro.nome : '(membro excluído)';
      const card = document.createElement('div');
      card.className = 'gbj-contestacao-card';

      const cabecalho = document.createElement('p');
      cabecalho.className = 'gbj-contestacao-cabecalho';
      cabecalho.textContent = `${SECAO_QUIZ_TEXTO_ADMIN[c.secao] || c.secao} · id ${c.perguntaId} · ${nomeMembro} · ${formatarData(c.criadoEm)}`;
      card.appendChild(cabecalho);

      const pergunta = document.createElement('p');
      pergunta.className = 'gbj-contestacao-pergunta';
      pergunta.textContent = c.pergunta;
      card.appendChild(pergunta);

      const gabarito = document.createElement('p');
      gabarito.className = 'gbj-contestacao-gabarito';
      gabarito.textContent = `Gabarito atual (marcada como certa): ${c.alternativaMarcadaCerta}`;
      card.appendChild(gabarito);

      if (c.motivo) {
        const motivo = document.createElement('p');
        motivo.className = 'gbj-contestacao-motivo';
        motivo.textContent = `"${c.motivo}"`;
        card.appendChild(motivo);
      }

      card.appendChild(criarBotaoExcluir(() => resolverContestacaoGbj(c.id), 'Marcar como resolvida'));
      lista.appendChild(card);
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
    pararHistoricoGbjFns = NOMES_COLECOES_HISTORICO_GBJ.map((nomeColecao) => onSnapshot(
      collection(db, nomeColecao),
      (snapshot) => {
        sessoesGbjPorColecao[nomeColecao] = [];
        snapshot.forEach((docSnap) => sessoesGbjPorColecao[nomeColecao].push({ id: docSnap.id, _colecao: nomeColecao, ...docSnap.data() }));
        renderHistoricoGbj();
      }
    ));
    pararContestadasGbj = onSnapshot(colContestadasGbj, renderContestadasGbj);
  });
}
