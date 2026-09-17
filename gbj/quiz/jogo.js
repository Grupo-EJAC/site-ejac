// EJAC — GBJ, Quiz: treino individual de múltipla escolha.
//
// Regra oficial da prova (pra quem for conferir o regulamento): perguntas
// gerais (Igreja, Carmelo, Paróquia, Liturgia...) e dos livros
// pré-selecionados pro ano (Tobias, Evangelho de João, Efésios). Começa
// com 5 vidas; errar tira uma; zerar elimina.
//
// Aqui é treino, não a prova — mesma lógica do Sequência dos Livros: é
// sozinho (sem a regra de perguntas alternadas do parágrafo sexto, que só
// faz sentido em grupo), e o tempo por rodada é escolhido por quem
// treina — a prova nem define um tempo fixo pro Quiz, então aqui o padrão
// é "sem limite".
//
// As perguntas foram digitadas à mão pelo grupo (ver gbj/quiz/perguntas.js)
// e o gabarito pode ter erro de transcrição — por isso o botão "Contestar
// esta pergunta": manda um aviso pro admin rever aquela pergunta
// específica, sem travar o treino de quem está jogando.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js';
import {
  getFirestore, doc, getDoc, collection, addDoc, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';
import { firebaseConfig } from '../../firebase-config.js';
import { PERGUNTAS_QUIZ, SECOES_QUIZ } from './perguntas.js';

const MODALIDADE = 'quiz';
const CHAVE_TEMPO = 'gbj-quiz-tempo';
const VIDAS_INICIAIS = 5;
const TEMPOS_PADRAO = [5, 10, 15, 20, 30, 0]; // 0 = sem limite

// ------------------------------------------------------------
// Elementos da página
// ------------------------------------------------------------
const telaCarregando = document.getElementById('gbj-qz-carregando');
const telaConfig = document.getElementById('gbj-qz-config');
const telaJogo = document.getElementById('gbj-qz-jogo');
const telaFim = document.getElementById('gbj-qz-fim');

const selectTempo = document.getElementById('gbj-qz-tempo');
const checkboxModoEstudo = document.getElementById('gbj-qz-modo-estudo');
const elConfigSub = document.getElementById('gbj-qz-config-sub');
const btnComecar = document.getElementById('gbj-qz-comecar');

const elVidas = document.getElementById('gbj-qz-vidas');
const elRodada = document.getElementById('gbj-qz-rodada');
const elAcertos = document.getElementById('gbj-qz-acertos');
const elTempoRestante = document.getElementById('gbj-qz-tempo-restante');
const elSecao = document.getElementById('gbj-qz-secao');
const elPergunta = document.getElementById('gbj-qz-pergunta');
const elAlternativas = document.getElementById('gbj-qz-alternativas');
const elFeedback = document.getElementById('gbj-qz-feedback');
const btnContestar = document.getElementById('gbj-qz-contestar');
const btnProxima = document.getElementById('gbj-qz-proxima');
const btnParar = document.getElementById('gbj-qz-parar');

const elFimTitulo = document.getElementById('gbj-qz-fim-titulo');
const elFimResumo = document.getElementById('gbj-qz-fim-resumo');
const elFimSalvando = document.getElementById('gbj-qz-fim-salvando');
const elFimAcoes = document.getElementById('gbj-qz-fim-acoes');
const btnTreinarDeNovo = document.getElementById('gbj-qz-treinar-de-novo');

function mostrarTela(el) {
  [telaCarregando, telaConfig, telaJogo, telaFim].forEach((t) => { if (t) t.hidden = t !== el; });
}

function lerTempoPreferido() {
  const salvo = Number(localStorage.getItem(CHAVE_TEMPO));
  return TEMPOS_PADRAO.includes(salvo) ? salvo : 0;
}

const TEXTO_SUB_TREINO = 'Você começa com 5 vidas. Errar uma pergunta (ou o tempo acabar) tira uma vida; zerar encerra o treino.';
const TEXTO_SUB_ESTUDO = 'Sem vidas: erre à vontade que a resposta certa aparece na hora, e você para quando quiser.';

if (checkboxModoEstudo && elConfigSub) {
  checkboxModoEstudo.addEventListener('change', () => {
    elConfigSub.textContent = checkboxModoEstudo.checked ? TEXTO_SUB_ESTUDO : TEXTO_SUB_TREINO;
  });
}

// ------------------------------------------------------------
// Firebase: só entra quem já está logado no /gbj/
// ------------------------------------------------------------
// Mesmo nome de app usado em gbj-firebase.js e no Sequência dos Livros, de
// propósito: é o que faz esta página enxergar a sessão de quem acabou de
// logar em /gbj/, sem vazar pra/do Termo (anônimo) ou do admin (Google) —
// ver o comentário completo em gbj-firebase.js.
const app = initializeApp(firebaseConfig, 'gbj');
const auth = getAuth(app);
const db = getFirestore(app);

let uid = null;

onAuthStateChanged(auth, async (user) => {
  const ehLoginSenha = user && !user.isAnonymous && user.providerData.some((p) => p.providerId === 'password');
  if (!ehLoginSenha) {
    location.replace('../');
    return;
  }

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
let sessao = null; // { tempoLimiteSeg, vidas, rodada, acertos, usadas: Set<id>, temposAcertos: [] }
let perguntaAtual = null;
let inicioRodada = null;
let respondida = false; // trava novo clique depois de já ter respondido a rodada
let timerId = null;
let prazoId = null;

function formatarTempo(ms) {
  const s = ms / 1000;
  return s < 10 ? `${s.toFixed(1)}s` : `${Math.round(s)}s`;
}

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
  prazoId = setTimeout(() => responder(null, true), sessao.tempoLimiteSeg * 1000);
}

if (btnComecar) {
  btnComecar.addEventListener('click', () => {
    const tempoLimiteSeg = Number(selectTempo.value) || 0;
    localStorage.setItem(CHAVE_TEMPO, String(tempoLimiteSeg));
    sessao = {
      tempoLimiteSeg,
      modoEstudo: !!(checkboxModoEstudo && checkboxModoEstudo.checked),
      vidas: VIDAS_INICIAIS,
      rodada: 0,
      acertos: 0,
      usadas: new Set(),
      temposAcertos: [],
    };
    mostrarTela(telaJogo);
    proximaRodada();
  });
}

function sortearPergunta() {
  const disponiveis = PERGUNTAS_QUIZ.filter((p) => !sessao.usadas.has(p.id));
  if (disponiveis.length === 0) {
    sessao.usadas.clear();
    return sortearPergunta();
  }
  return disponiveis[Math.floor(Math.random() * disponiveis.length)];
}

function desenharVidas() {
  elVidas.textContent = sessao.modoEstudo
    ? '📖 Modo estudo'
    : '❤️'.repeat(Math.max(sessao.vidas, 0)) + '🖤'.repeat(VIDAS_INICIAIS - Math.max(sessao.vidas, 0));
}

function proximaRodada() {
  perguntaAtual = sortearPergunta();
  sessao.usadas.add(perguntaAtual.id);
  respondida = false;

  elSecao.textContent = SECOES_QUIZ[perguntaAtual.secao] || perguntaAtual.secao;
  elPergunta.textContent = perguntaAtual.pergunta;
  desenharVidas();
  elRodada.textContent = String(sessao.rodada + 1);
  elAcertos.textContent = String(sessao.acertos);
  elFeedback.textContent = '';
  elFeedback.className = 'gbj-qz-feedback';
  btnContestar.hidden = true;
  btnProxima.hidden = true;

  elAlternativas.textContent = '';
  const LETRAS = ['A', 'B', 'C', 'D'];
  perguntaAtual.alternativas.forEach((alt, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'gbj-qz-alt';
    btn.textContent = `${LETRAS[idx]}) ${alt}`;
    btn.addEventListener('click', () => responder(idx, false));
    elAlternativas.appendChild(btn);
  });

  inicioRodada = Date.now();
  iniciarTimer();
}

function responder(idxEscolhido, porTempoEsgotado) {
  if (respondida) return; // clique duplo, ou clique depois do tempo já ter estourado
  respondida = true;
  pararTimer();

  const botoes = [...elAlternativas.querySelectorAll('.gbj-qz-alt')];
  botoes.forEach((b) => { b.disabled = true; });

  const acertou = !porTempoEsgotado && idxEscolhido === perguntaAtual.correta;

  botoes[perguntaAtual.correta].classList.add('gbj-qz-alt-certa');
  if (!acertou && idxEscolhido !== null && idxEscolhido !== undefined) {
    botoes[idxEscolhido].classList.add('gbj-qz-alt-errada');
  }

  sessao.rodada += 1;
  if (acertou) {
    sessao.acertos += 1;
    sessao.temposAcertos.push(Date.now() - inicioRodada);
    elFeedback.textContent = 'Acertou! ✓';
    elFeedback.className = 'gbj-qz-feedback gbj-qz-feedback-certo';
  } else {
    if (!sessao.modoEstudo) sessao.vidas -= 1;
    elFeedback.textContent = porTempoEsgotado ? 'Tempo esgotado.' : 'Errou.';
    elFeedback.className = 'gbj-qz-feedback gbj-qz-feedback-errado';
  }

  desenharVidas();
  elAcertos.textContent = String(sessao.acertos);
  btnContestar.hidden = false;

  if (!sessao.modoEstudo && sessao.vidas <= 0) {
    btnProxima.hidden = true;
    setTimeout(() => encerrar('eliminado'), 1400);
  } else {
    btnProxima.hidden = false;
    btnProxima.focus();
  }
}

if (btnProxima) btnProxima.addEventListener('click', proximaRodada);

if (btnParar) {
  btnParar.addEventListener('click', () => {
    if (!sessao) return;
    if (!confirm('Parar o treino agora? O que já foi respondido fica salvo no seu histórico.')) return;
    encerrar('parou');
  });
}

if (btnContestar) {
  btnContestar.addEventListener('click', async () => {
    const motivo = prompt('O que parece errado nessa pergunta? (opcional — fica salvo pro coordenador rever)', '') || '';
    btnContestar.disabled = true;
    try {
      await addDoc(collection(db, 'gbjPerguntasContestadas'), {
        uid,
        perguntaId: perguntaAtual.id,
        secao: perguntaAtual.secao,
        pergunta: perguntaAtual.pergunta,
        alternativaMarcadaCerta: perguntaAtual.alternativas[perguntaAtual.correta],
        motivo: motivo.slice(0, 300),
        criadoEm: serverTimestamp(),
      });
      btnContestar.textContent = 'Contestação enviada ✓';
    } catch (err) {
      btnContestar.disabled = false;
      alert('Não foi possível enviar agora. Tente de novo.');
    }
  });
}

async function encerrar(motivo) {
  pararTimer();
  const mediaTempoAcertosMs = sessao.temposAcertos.length
    ? Math.round(sessao.temposAcertos.reduce((soma, ms) => soma + ms, 0) / sessao.temposAcertos.length)
    : null;
  const resumo = {
    rodadas: sessao.rodada, acertos: sessao.acertos, tempoLimiteSeg: sessao.tempoLimiteSeg, mediaTempoAcertosMs,
  };

  elFimTitulo.textContent = motivo === 'eliminado' ? 'Zerou as vidas' : (sessao.modoEstudo ? 'Estudo encerrado' : 'Treino encerrado');
  elFimResumo.textContent = `${resumo.acertos} acerto${resumo.acertos === 1 ? '' : 's'} em ${resumo.rodadas} rodada${resumo.rodadas === 1 ? '' : 's'}`
    + (mediaTempoAcertosMs ? ` — tempo médio dos acertos: ${formatarTempo(mediaTempoAcertosMs)}` : '') + '.';
  // Os botões "Treinar de novo"/"Voltar ao painel" só aparecem depois que
  // o histórico já foi gravado (ou já falhou) — antes disso ficam
  // escondidos de propósito, senão quem treina pode sair da página rápido
  // demais e cancelar a gravação, que ainda está em andamento.
  if (elFimAcoes) elFimAcoes.hidden = true;
  if (elFimSalvando) elFimSalvando.hidden = resumo.rodadas === 0;
  mostrarTela(telaFim);

  if (resumo.rodadas === 0) {
    if (elFimAcoes) elFimAcoes.hidden = false;
    return;
  }

  try {
    await addDoc(collection(db, 'gbjHistoricoQuiz'), {
      uid,
      modalidade: MODALIDADE,
      tempoLimiteSeg: resumo.tempoLimiteSeg,
      rodadas: resumo.rodadas,
      acertos: resumo.acertos,
      mediaTempoAcertosMs: resumo.mediaTempoAcertosMs,
      motivo,
      modoEstudo: sessao.modoEstudo,
      criadoEm: serverTimestamp(),
    });
  } catch (err) {
    const aviso = document.createElement('p');
    aviso.className = 'form-msg erro';
    aviso.textContent = 'Não deu pra salvar este treino no seu histórico.';
    elFimResumo.insertAdjacentElement('afterend', aviso);
  } finally {
    if (elFimSalvando) elFimSalvando.hidden = true;
    if (elFimAcoes) elFimAcoes.hidden = false;
  }
}

if (btnTreinarDeNovo) {
  btnTreinarDeNovo.addEventListener('click', () => {
    sessao = null;
    if (selectTempo) selectTempo.value = String(lerTempoPreferido());
    mostrarTela(telaConfig);
  });
}
