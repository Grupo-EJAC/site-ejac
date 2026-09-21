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
// Aproxima o texto ouvido do nome de livro mais parecido.
//
// A resposta só pode ser um dos 73 livros da lista — não é texto livre.
// Por isso, em vez de aceitar cru o que o reconhecimento de voz entendeu
// (que pode errar uma letra ou outra), mede a distância de edição até
// cada livro e troca pelo mais próximo, se estiver perto o bastante. Isso
// cobre a maioria dos erros de transcrição usando um modelo de voz leve
// e rápido, sem precisar de um modelo maior (e mais lento) só por causa
// da precisão.
// ------------------------------------------------------------
const LIVROS_NORMALIZADOS = LIVROS_BIBLIA.map(normalizar);

function distanciaEdicao(a, b) {
  const linha = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) linha[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let anterior = linha[0];
    linha[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = linha[j];
      linha[j] = a[i - 1] === b[j - 1]
        ? anterior
        : 1 + Math.min(anterior, linha[j], linha[j - 1]);
      anterior = temp;
    }
  }
  return linha[b.length];
}

function aproximarLivro(textoOuvido) {
  const alvo = normalizar(textoOuvido);
  if (!alvo) return textoOuvido;

  let melhorIndice = -1;
  let melhorDistancia = Infinity;
  LIVROS_NORMALIZADOS.forEach((nome, i) => {
    const d = distanciaEdicao(alvo, nome);
    if (d < melhorDistancia) { melhorDistancia = d; melhorIndice = i; }
  });

  const tolerancia = Math.max(1, Math.round(alvo.length * 0.34));
  return melhorDistancia <= tolerancia ? LIVROS_BIBLIA[melhorIndice] : textoOuvido;
}

// ------------------------------------------------------------
// Elementos da página
// ------------------------------------------------------------
const telaCarregando = document.getElementById('gbj-sl-carregando');
const telaConfig = document.getElementById('gbj-sl-config');
const telaJogo = document.getElementById('gbj-sl-jogo');
const telaFim = document.getElementById('gbj-sl-fim');

const selectTempo = document.getElementById('gbj-sl-tempo');
const checkboxModoEstudo = document.getElementById('gbj-sl-modo-estudo');
const elConfigSub = document.getElementById('gbj-sl-config-sub');
const btnComecar = document.getElementById('gbj-sl-comecar');

const elVidas = document.getElementById('gbj-sl-vidas');
const elRodada = document.getElementById('gbj-sl-rodada');
const elAcertos = document.getElementById('gbj-sl-acertos');
const elLivro = document.getElementById('gbj-sl-livro-anunciado');
const elTempoRestante = document.getElementById('gbj-sl-tempo-restante');
const formResposta = document.getElementById('gbj-sl-form-resposta');
const inputAntes = document.getElementById('gbj-sl-antes');
const inputDepois = document.getElementById('gbj-sl-depois');
const btnVozAntes = document.getElementById('gbj-sl-antes-voz');
const btnVozDepois = document.getElementById('gbj-sl-depois-voz');
const elVozStatus = document.getElementById('gbj-sl-voz-status');
const elVozPainel = document.getElementById('gbj-sl-voz-painel');
const elVozTitulo = document.getElementById('gbj-sl-voz-titulo');
const elVozBarras = document.getElementById('gbj-sl-voz-barras');
const btnVozCancelar = document.getElementById('gbj-sl-voz-cancelar');
const btnResponder = document.getElementById('gbj-sl-responder');
const elFeedback = document.getElementById('gbj-sl-feedback');
const btnProxima = document.getElementById('gbj-sl-proxima');
const btnParar = document.getElementById('gbj-sl-parar');

const elFimTitulo = document.getElementById('gbj-sl-fim-titulo');
const elFimResumo = document.getElementById('gbj-sl-fim-resumo');
const elFimSalvando = document.getElementById('gbj-sl-fim-salvando');
const elFimAcoes = document.getElementById('gbj-sl-fim-acoes');
const btnTreinarDeNovo = document.getElementById('gbj-sl-treinar-de-novo');

function mostrarTela(el) {
  [telaCarregando, telaConfig, telaJogo, telaFim].forEach((t) => { if (t) t.hidden = t !== el; });
}

// ------------------------------------------------------------
// Responder por voz — a prova de verdade também é falada ("a pessoa
// diz o antecessor e o sucessor"), então dizer em vez de digitar é
// mais rápido e mais parecido com o dia real.
//
// Roda inteiro no navegador via Whisper (Transformers.js, sobre
// WebAssembly) — nada de backend, chave de API ou serviço de voz de
// terceiro que possa falhar sem aviso (foi exatamente o que aconteceu
// com a Web Speech API do navegador antes desta versão: dava erro
// "network" sem explicação, em qualquer rede). O áudio nunca sai do
// aparelho de quem treina; só o modelo (uns 30-70MB) é baixado da CDN
// na primeira vez, e fica em cache do navegador dali pra frente.
// ------------------------------------------------------------
function avisarVoz(texto) {
  if (!elVozStatus) return;
  elVozStatus.textContent = texto;
  elVozStatus.hidden = !texto;
}

const DURACAO_GRAVACAO_MS = 4000;
const MODELO_VOZ = 'Xenova/whisper-tiny';

let promessaTranscritor = null;
function carregarTranscritor() {
  if (!promessaTranscritor) {
    promessaTranscritor = import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.5')
      .then(({ pipeline }) => pipeline('automatic-speech-recognition', MODELO_VOZ));
  }
  return promessaTranscritor;
}

// Reamostra o áudio gravado (geralmente 44.1kHz ou 48kHz) pros 16kHz
// mono que o Whisper espera. OfflineAudioContext já faz a reamostragem
// sozinho ao renderizar num sampleRate diferente do original.
async function decodificarPara16kHz(blob) {
  const bruto = await blob.arrayBuffer();
  const ctxTemp = new (window.AudioContext || window.webkitAudioContext)();
  let audioBuffer;
  try {
    audioBuffer = await ctxTemp.decodeAudioData(bruto);
  } finally {
    ctxTemp.close();
  }
  const offline = new OfflineAudioContext(1, Math.ceil(audioBuffer.duration * 16000), 16000);
  const fonte = offline.createBufferSource();
  fonte.buffer = audioBuffer;
  fonte.connect(offline.destination);
  fonte.start();
  const renderizado = await offline.startRendering();
  return renderizado.getChannelData(0);
}

// ------------------------------------------------------------
// Painel de voz (compartilhado pelos dois microfones — só um grava por
// vez) e o equalizador que reage ao volume de verdade do microfone, pra
// ficar claro que está ouvindo de verdade e não travado.
// ------------------------------------------------------------
const barrasVoz = elVozBarras ? Array.from(elVozBarras.children) : [];

function zerarBarrasVoz() {
  barrasVoz.forEach((s) => s.style.setProperty('--altura', '0'));
}

function mostrarPainelVoz(titulo) {
  if (elVozTitulo) {
    elVozTitulo.textContent = titulo;
    elVozTitulo.classList.remove('gbj-sl-voz-processando');
  }
  if (elVozPainel) elVozPainel.hidden = false;
}

function marcarPainelProcessando(titulo) {
  if (elVozTitulo) {
    elVozTitulo.textContent = titulo;
    elVozTitulo.classList.add('gbj-sl-voz-processando');
  }
}

function esconderPainelVoz() {
  if (elVozPainel) elVozPainel.hidden = true;
  zerarBarrasVoz();
}

// Liga um AnalyserNode no stream do microfone e anima as barras a cada
// frame com o volume de verdade captado (por faixa de frequência, pra
// parecer um equalizador e não 7 barrinhas idênticas subindo e descendo
// juntas). Retorna uma função pra desligar tudo.
function iniciarVisualizadorVoz(stream) {
  if (barrasVoz.length === 0) return () => {};
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const fonte = ctx.createMediaStreamSource(stream);
  const analisador = ctx.createAnalyser();
  analisador.fftSize = 64;
  analisador.smoothingTimeConstant = 0.6;
  fonte.connect(analisador);
  const dados = new Uint8Array(analisador.frequencyBinCount);
  const binsPorBarra = Math.max(1, Math.floor(dados.length / barrasVoz.length));
  let rafId = null;

  function passo() {
    analisador.getByteFrequencyData(dados);
    barrasVoz.forEach((span, i) => {
      let soma = 0;
      for (let j = 0; j < binsPorBarra; j++) soma += dados[i * binsPorBarra + j];
      const nivel = Math.min((soma / binsPorBarra / 255) * 1.6, 1);
      span.style.setProperty('--altura', nivel.toFixed(2));
    });
    rafId = requestAnimationFrame(passo);
  }
  passo();

  return () => {
    if (rafId) cancelAnimationFrame(rafId);
    fonte.disconnect();
    ctx.close();
    zerarBarrasVoz();
  };
}

// Chamada pelo botão "Cancelar" do painel — aponta sempre pra quem está
// gravando/preparando no momento (só um microfone por vez faz sentido).
let cancelarVozAtual = null;
if (btnVozCancelar) {
  btnVozCancelar.addEventListener('click', () => { if (cancelarVozAtual) cancelarVozAtual(); });
}

let vozEmUso = false;

function configurarBotaoVoz(botao, input, aoReconhecer) {
  if (!botao) return;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) return;

  botao.hidden = false;

  let estado = 'parado'; // 'parado' | 'preparando' | 'ouvindo' | 'transcrevendo'
  let pararGravacao = null;

  botao.addEventListener('click', async () => {
    if (estado === 'transcrevendo') return; // ocupado processando, ignora clique
    if (estado !== 'parado') { if (pararGravacao) pararGravacao(); return; } // clicar de novo encerra e já manda transcrever
    if (vozEmUso) return; // o outro microfone já está gravando

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      avisarVoz('Sem acesso ao microfone. Confira a permissão do navegador.');
      return;
    }

    vozEmUso = true;
    input.value = '';
    avisarVoz('');
    let cancelado = false;
    pausarTimerRodada();

    function finalizarCancelado() {
      stream.getTracks().forEach((t) => t.stop());
      esconderPainelVoz();
      botao.classList.remove('gbj-sl-ouvindo');
      estado = 'parado';
      vozEmUso = false;
      cancelarVozAtual = null;
      retomarTimerRodada();
    }

    estado = 'preparando';
    botao.classList.add('gbj-sl-ouvindo');
    mostrarPainelVoz('Prepare-se...');
    cancelarVozAtual = () => {
      cancelado = true;
      if (pararGravacao) pararGravacao();
      else finalizarCancelado();
    };

    // Um instante antes de gravar de verdade: sem essa folga, a primeira
    // sílaba de quem já começa a falar assim que clica ("Alô" virando
    // "nalo") ficava cortada, porque MediaRecorder.start() não é instantâneo.
    await new Promise((resolver) => setTimeout(resolver, 600));
    if (cancelado) { finalizarCancelado(); return; }

    estado = 'ouvindo';
    mostrarPainelVoz('Ouvindo... fale o nome do livro');
    const pararVisualizador = iniciarVisualizadorVoz(stream);

    const pedacos = [];
    const gravador = new MediaRecorder(stream);
    gravador.addEventListener('dataavailable', (e) => { if (e.data.size > 0) pedacos.push(e.data); });
    const blobPromise = new Promise((resolve) => {
      gravador.addEventListener('stop', () => resolve(new Blob(pedacos, { type: gravador.mimeType })));
    });

    const timer = setTimeout(() => { if (pararGravacao) pararGravacao(); }, DURACAO_GRAVACAO_MS);
    pararGravacao = () => {
      clearTimeout(timer);
      pararGravacao = null;
      pararVisualizador();
      gravador.stop();
      stream.getTracks().forEach((t) => t.stop());
    };
    gravador.start();

    const blob = await blobPromise;
    botao.classList.remove('gbj-sl-ouvindo');

    if (cancelado) {
      esconderPainelVoz();
      estado = 'parado';
      vozEmUso = false;
      cancelarVozAtual = null;
      retomarTimerRodada();
      return;
    }

    estado = 'transcrevendo';
    botao.classList.add('gbj-sl-transcrevendo');
    marcarPainelProcessando('Reconhecendo...');
    cancelarVozAtual = null; // a gravação já acabou, só falta esperar o modelo

    try {
      const amostras = await decodificarPara16kHz(blob);
      const transcritor = await carregarTranscritor();
      const resultado = await transcritor(amostras, { language: 'portuguese', task: 'transcribe' });
      // Em trecho sem fala de verdade (silêncio, ruído), o Whisper às vezes
      // "alucina" marcadores tipo "[música]" ou "(risos)" em vez de dizer
      // que não ouviu nada — tira isso antes de aceitar o texto.
      const texto = (resultado.text || '')
        .replace(/[[(][^\])]*[\])]/g, '')
        .trim()
        .replace(/[.,!?]+$/, '');
      esconderPainelVoz();
      if (texto) {
        input.value = aproximarLivro(texto);
        if (aoReconhecer) aoReconhecer();
      } else {
        avisarVoz('Não entendi. Tenta de novo ou digite.');
      }
    } catch (err) {
      console.error('gbj-sl: transcrição de voz falhou —', err);
      esconderPainelVoz();
      avisarVoz('Não deu pra reconhecer agora. Pode digitar.');
    } finally {
      botao.classList.remove('gbj-sl-transcrevendo');
      estado = 'parado';
      vozEmUso = false;
      retomarTimerRodada();
    }
  });
}

configurarBotaoVoz(btnVozAntes, inputAntes, () => inputDepois.focus());
configurarBotaoVoz(btnVozDepois, inputDepois, () => btnResponder.focus());

// Começa a preparar o modelo assim que a página abre, em segundo plano —
// se der tempo antes da pessoa clicar no microfone pela primeira vez,
// ela nem percebe a espera do download.
carregarTranscritor().catch((err) => {
  console.error('gbj-sl: não consegui preparar o reconhecimento de voz —', err);
});

function lerTempoPreferido() {
  const salvo = Number(localStorage.getItem(CHAVE_TEMPO));
  return TEMPOS_PADRAO.includes(salvo) ? salvo : 15;
}

const TEXTO_SUB_TREINO = 'Você começa com 3 vidas. Errar uma pergunta (ou o tempo acabar) tira uma vida; zerar encerra o treino.';
const TEXTO_SUB_ESTUDO = 'Sem vidas: erre à vontade que a resposta certa aparece na hora, e você para quando quiser.';

if (checkboxModoEstudo && elConfigSub) {
  checkboxModoEstudo.addEventListener('change', () => {
    elConfigSub.textContent = checkboxModoEstudo.checked ? TEXTO_SUB_ESTUDO : TEXTO_SUB_TREINO;
  });
}

// ------------------------------------------------------------
// Firebase: só entra quem já está logado no /gbj/
// ------------------------------------------------------------
// Mesmo nome de app usado em gbj-firebase.js, de propósito: é o que faz
// esta página enxergar a sessão de quem acabou de logar em /gbj/. Um nome
// diferente do padrão evita que o Termo (anônimo) ou o admin (Google)
// substituam essa sessão sem querer — as três coisas usam o mesmo
// projeto Firebase.
const app = initializeApp(firebaseConfig, 'gbj');
const auth = getAuth(app);
const db = getFirestore(app);

let uid = null;

onAuthStateChanged(auth, async (user) => {
  // O login anônimo do Termo e o login Google do /admin/ usam o mesmo
  // projeto Firebase (e o mesmo app "padrão"), então a sessão de um vaza
  // pro outro: alguém pode chegar aqui "autenticado" com uma conta que
  // nunca foi de membro do GBJ. Nesse caso não é sessão nossa pra
  // desconectar — só manda pro login do GBJ, sem mexer em nada.
  const ehLoginSenha = user && !user.isAnonymous && user.providerData.some((p) => p.providerId === 'password');
  if (!ehLoginSenha) {
    // Não tem sessão do GBJ: volta pro login. É o próprio /gbj/ que
    // autentica — esta página só treina quem já entrou por lá.
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
let sessao = null; // { tempoLimiteSeg, vidas, rodada, acertos, usados: Set, temposAcertos: [] }
let rodadaAtual = null; // { indiceAnunciado, antes, depois }
let inicioRodada = null; // Date.now() de quando o livro apareceu na tela
let timerId = null;
let prazoId = null;
let restanteSeg = null; // segundos restantes na rodada atual; null = sem limite de tempo

function formatarTempo(ms) {
  const s = ms / 1000;
  return s < 10 ? `${s.toFixed(1)}s` : `${Math.round(s)}s`;
}

function pararTimer() {
  if (timerId) { clearInterval(timerId); timerId = null; }
  if (prazoId) { clearTimeout(prazoId); prazoId = null; }
}

function rodarTimer() {
  if (elTempoRestante) elTempoRestante.textContent = `${restanteSeg}s`;
  timerId = setInterval(() => {
    restanteSeg -= 1;
    if (elTempoRestante) elTempoRestante.textContent = `${Math.max(restanteSeg, 0)}s`;
    if (restanteSeg <= 0) clearInterval(timerId);
  }, 1000);
  prazoId = setTimeout(() => responder(true), restanteSeg * 1000);
}

function iniciarTimer() {
  pararTimer();
  if (!sessao.tempoLimiteSeg) {
    restanteSeg = null;
    if (elTempoRestante) elTempoRestante.textContent = '';
    return;
  }
  restanteSeg = sessao.tempoLimiteSeg;
  rodarTimer();
}

// Enquanto grava ou reconhece a voz, o cronômetro da rodada fica pausado —
// não seria justo perder a rodada por causa da demora do reconhecimento,
// só de verdade por não responder a tempo.
function pausarTimerRodada() {
  pararTimer();
}

function retomarTimerRodada() {
  if (restanteSeg === null || restanteSeg <= 0) return; // sem limite, ou já esgotado
  // A gravação/reconhecimento roda em segundo plano e pode terminar depois
  // que a rodada já foi respondida por outro caminho (digitou e enviou, ou
  // parou o treino) — nesse caso não faz sentido religar o cronômetro.
  if (!telaJogo || telaJogo.hidden) return;
  if (!btnResponder || btnResponder.hidden) return;
  rodarTimer();
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
      usados: new Set(),
      temposAcertos: [], // ms de cada rodada acertada, pra tirar a média no fim
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

function desenharVidas() {
  elVidas.textContent = sessao.modoEstudo
    ? '📖 Modo estudo'
    : '❤️'.repeat(Math.max(sessao.vidas, 0)) + '🖤'.repeat(VIDAS_INICIAIS - Math.max(sessao.vidas, 0));
}

function proximaRodada() {
  const i = sortearIndice();
  sessao.usados.add(i);
  rodadaAtual = { indice: i, antes: LIVROS_BIBLIA[i - 1], depois: LIVROS_BIBLIA[i + 1] };

  elLivro.textContent = LIVROS_BIBLIA[i];
  desenharVidas();
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

  inicioRodada = Date.now();
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
    sessao.temposAcertos.push(Date.now() - inicioRodada);
    elFeedback.textContent = 'Acertou! ✓';
    elFeedback.className = 'gbj-sl-feedback gbj-sl-feedback-certo';
  } else {
    if (!sessao.modoEstudo) sessao.vidas -= 1;
    const livroAnunciado = LIVROS_BIBLIA[rodadaAtual.indice];
    const prefixo = porTempoEsgotado ? 'Tempo esgotado.' : 'Errou.';
    elFeedback.textContent = `${prefixo} A sequência é ${rodadaAtual.antes}, ${livroAnunciado}, ${rodadaAtual.depois}.`;
    elFeedback.className = 'gbj-sl-feedback gbj-sl-feedback-errado';
  }

  desenharVidas();
  elAcertos.textContent = String(sessao.acertos);

  if (!sessao.modoEstudo && sessao.vidas <= 0) {
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

  if (resumo.rodadas === 0) { // não grava sessão vazia (ex: parou sem responder nada)
    if (elFimAcoes) elFimAcoes.hidden = false;
    return;
  }

  try {
    await addDoc(collection(db, 'gbjHistoricoSequenciaLivros'), {
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
    // O treino em si já acabou e a pessoa já viu o resultado; não vale a
    // pena travar a tela por causa disso, só avisa que não salvou.
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
