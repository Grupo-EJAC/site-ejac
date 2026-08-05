// EJAC — © Esperança Jovem Aliada a Cristo
//
// Tudo roda dentro de uma IIFE em modo estrito: nada vaza pro escopo
// global da página, evitando conflito com qualquer outro script.
(function () {
'use strict';

// ------------------------------------------------------------
// Proteção anti-clickjacking via JS
// O GitHub Pages não permite configurar cabeçalhos HTTP (X-Frame-Options,
// Strict-Transport-Security), só arquivos estáticos. E a diretiva
// "frame-ancestors" da nossa CSP não funciona quando entregue por <meta>
// (só funciona por cabeçalho HTTP real — regra do próprio padrão CSP).
// Como reforço, se alguém tentar colocar o site dentro de um iframe de
// outra página, isso aqui força a navegação a sair do iframe.
// ------------------------------------------------------------
if (window.top !== window.self) {
  window.top.location = window.self.location;
}

const PREFERE_MENOS_MOVIMENTO = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ------------------------------------------------------------
// Brasas ambiente no site inteiro — bem poucas, rosa, subindo devagar
// ------------------------------------------------------------
const bgEmbersCanvas = document.getElementById('bg-embers');
if (bgEmbersCanvas && !PREFERE_MENOS_MOVIMENTO) {
  const bctx = bgEmbersCanvas.getContext('2d');
  const MAX_BRASAS = 34;
  let brasas = [];

  function ajustarTamanhoBg() {
    bgEmbersCanvas.width = window.innerWidth;
    bgEmbersCanvas.height = window.innerHeight;
  }
  ajustarTamanhoBg();
  window.addEventListener('resize', ajustarTamanhoBg);

  function criarBrasa() {
    brasas.push({
      x: Math.random() * bgEmbersCanvas.width,
      // nasce espalhada na parte de baixo (não só na borda), pra a tela
      // já começar com brasas no ar em vez de esperar elas subirem
      y: bgEmbersCanvas.height * (0.75 + Math.random() * 0.35),
      vx: (Math.random() - 0.5) * 0.3,
      vy: -Math.random() * 0.5 - 0.15,
      vida: 1,
      raio: Math.random() * 1.5 + 1,
    });
    if (brasas.length > MAX_BRASAS) brasas.splice(0, brasas.length - MAX_BRASAS);
  }

  // já começa com algumas no ar, senão a primeira tela fica vazia
  for (let i = 0; i < 10; i++) {
    criarBrasa();
    brasas[brasas.length - 1].vida = 0.3 + Math.random() * 0.7;
    brasas[brasas.length - 1].y = Math.random() * bgEmbersCanvas.height;
  }

  function loopBg() {
    requestAnimationFrame(loopBg); // agenda antes de desenhar (loop à prova de falha)
    bctx.clearRect(0, 0, bgEmbersCanvas.width, bgEmbersCanvas.height);
    brasas = brasas.filter(b => b.vida > 0);
    brasas.forEach(b => {
      b.x += b.vx;
      b.y += b.vy;
      b.vida -= 0.0025; // some bem devagar (~6.5s de vida)
      const raio = Math.max(0, b.raio * b.vida); // arc() quebra com raio negativo
      if (raio <= 0) return;
      const alfa = Math.max(0, b.vida) * 0.65;
      bctx.beginPath();
      bctx.arc(b.x, b.y, raio, 0, Math.PI * 2);
      bctx.fillStyle = `rgba(228, 86, 143, ${alfa})`;
      bctx.shadowColor = `rgba(228, 86, 143, ${alfa})`;
      bctx.shadowBlur = 6; // brilho suave, cara de brasa acesa
      bctx.fill();
    });
    bctx.shadowBlur = 0;
  }
  requestAnimationFrame(loopBg);

  (function nasceBrasa() {
    criarBrasa();
    setTimeout(nasceBrasa, 450 + Math.random() * 650);
  })();
}

// ------------------------------------------------------------
// Sons de interface — sintetizados na hora (sem arquivo externo),
// bem baixinhos (15%), só como reforço tátil discreto
// ------------------------------------------------------------
let audioCtx;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function tocarClick() {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 700;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.06);
  } catch (e) { /* áudio indisponível, ignora silenciosamente */ }
}

function tocarSucesso() {
  try {
    const ctx = getAudioCtx();
    [523.25, 659.25].forEach((freq, i) => { // C5, E5 — acorde curto e positivo
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const inicio = ctx.currentTime + i * 0.09;
      gain.gain.setValueAtTime(0, inicio);
      gain.gain.linearRampToValueAtTime(0.15, inicio + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, inicio + 0.25);
      osc.connect(gain).connect(ctx.destination);
      osc.start(inicio);
      osc.stop(inicio + 0.25);
    });
  } catch (e) { /* áudio indisponível, ignora silenciosamente */ }
}

const selectTamanho = document.querySelector('select[name="tamanho"]');
if (selectTamanho) selectTamanho.addEventListener('change', tocarClick);

// ------------------------------------------------------------
// Barra de progresso do scroll
// ------------------------------------------------------------
const scrollProgress = document.getElementById('scroll-progress');
if (scrollProgress) {
  const atualizarProgresso = () => {
    const altura = document.documentElement.scrollHeight - window.innerHeight;
    const pct = altura > 0 ? (window.scrollY / altura) * 100 : 0;
    scrollProgress.style.width = pct + '%';
  };
  window.addEventListener('scroll', atualizarProgresso, { passive: true });
  atualizarProgresso();
}

// ------------------------------------------------------------
// Faíscas no hero — rastro no mouse + fagulhas ambiente contínuas
// (só desktop, com mouse de verdade). O loop nunca para: mesmo parado
// o mouse, sempre tem alguma fagulha nascendo e subindo devagar.
// ------------------------------------------------------------
const heroCanvas = document.getElementById('hero-canvas');
if (heroCanvas && !PREFERE_MENOS_MOVIMENTO && window.matchMedia('(pointer: fine)').matches) {
  const ctx = heroCanvas.getContext('2d');
  const hero = heroCanvas.closest('.hero');
  let particulas = [];

  // O canvas precisa acompanhar o tamanho do hero. Só medir no load não
  // basta: a foto da camisa carrega depois e faz o hero crescer — aí o
  // canvas ficaria com resolução menor, esticado pelo CSS, e as faíscas
  // cairiam em coordenadas erradas (parecendo que "sumiram").
  function ajustarTamanho() {
    const l = Math.round(hero.clientWidth);
    const a = Math.round(hero.clientHeight);
    if (l > 0 && a > 0 && (heroCanvas.width !== l || heroCanvas.height !== a)) {
      heroCanvas.width = l;
      heroCanvas.height = a;
    }
  }
  ajustarTamanho();
  window.addEventListener('resize', ajustarTamanho);
  if (window.ResizeObserver) new ResizeObserver(ajustarTamanho).observe(hero);

  // decaimento por frame (60fps): 0.006 ≈ 2.8s de vida | 0.011 ≈ 1.5s
  const DECAI_NORMAL = 0.006;
  const DECAI_SAIDA = 0.011;
  let mouseDentro = false;

  function criarParticula(x, y, decaimento = DECAI_NORMAL) {
    particulas.push({
      x, y,
      vx: (Math.random() - 0.5) * 0.6,
      vy: -Math.random() * 0.8 - 0.2, // sobe devagar, como brasa/fagulha de fogo
      vida: 1,
      raio: Math.random() * 2 + 1.5,
      cor: Math.random() > 0.5 ? '196, 77, 19' : '228, 86, 143',
      decaimento,
    });
    if (particulas.length > 140) particulas.splice(0, particulas.length - 140);
  }

  function loop() {
    // agenda o próximo frame ANTES de desenhar: se algo falhar no meio do
    // desenho, o loop continua vivo (senão as faíscas sumiam pra sempre)
    requestAnimationFrame(loop);
    ctx.clearRect(0, 0, heroCanvas.width, heroCanvas.height);
    particulas = particulas.filter(p => p.vida > 0);
    particulas.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vida -= p.decaimento;
      // raio nunca pode ser negativo: vida acabou de ser decrementada e
      // pode ter passado de zero, e arc() com raio negativo lança erro
      const raio = Math.max(0, p.raio * p.vida);
      if (raio <= 0) return;
      ctx.beginPath();
      ctx.arc(p.x, p.y, raio, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.cor}, ${Math.max(0, p.vida)})`;
      ctx.fill();
    });
  }
  requestAnimationFrame(loop);

  // Fagulhas ambiente enquanto o mouse está sobre o hero — assim, ao sair,
  // o que resta some de vez (e não fica nascendo faísca nova no meio do fade)
  function fagulhaAmbiente() {
    if (mouseDentro && heroCanvas.width > 0 && heroCanvas.height > 0) {
      criarParticula(Math.random() * heroCanvas.width, heroCanvas.height * (0.6 + Math.random() * 0.4));
    }
    setTimeout(fagulhaAmbiente, 350 + Math.random() * 400);
  }
  fagulhaAmbiente();

  hero.addEventListener('mouseenter', () => { mouseDentro = true; });

  // Rastro do mouse: sempre que passa pelo hero, nascem faíscas na hora
  hero.addEventListener('mousemove', (e) => {
    mouseDentro = true;
    ajustarTamanho(); // garante que o canvas está no tamanho certo
    const rect = hero.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    criarParticula(x, y);
    criarParticula(x + (Math.random() - 0.5) * 6, y + (Math.random() - 0.5) * 6);
  });

  // Ao cruzar a borda do canvas: um último sopro de faíscas no ponto de
  // saída e tudo o que está na tela apaga junto, em ~1.5s
  hero.addEventListener('mouseleave', (e) => {
    mouseDentro = false;
    const rect = hero.getBoundingClientRect();
    const x = Math.min(Math.max(e.clientX - rect.left, 0), rect.width);
    const y = Math.min(Math.max(e.clientY - rect.top, 0), rect.height);
    for (let i = 0; i < 8; i++) {
      criarParticula(x + (Math.random() - 0.5) * 14, y + (Math.random() - 0.5) * 14, DECAI_SAIDA);
    }
    particulas.forEach(p => { p.decaimento = Math.max(p.decaimento, DECAI_SAIDA); });
  });
}

// ------------------------------------------------------------
// Confete ao copiar (usado no botão do Pix)
// ------------------------------------------------------------
function lancarConfete(origemEl) {
  const rect = origemEl.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const cores = ['#E4568F', '#C14D13', '#FFFFFF'];

  for (let i = 0; i < 16; i++) {
    const p = document.createElement('span');
    p.className = 'confete';
    const angulo = (Math.PI * 2 * i) / 16 + Math.random() * 0.3;
    const distancia = 60 + Math.random() * 50;
    const fimX = Math.cos(angulo) * distancia;
    const fimY = Math.sin(angulo) * distancia;
    p.style.left = cx + 'px';
    p.style.top = cy + 'px';
    p.style.background = cores[i % cores.length];
    p.style.setProperty('--confete-fim', `translate(${fimX}px, ${fimY}px)`);
    p.style.setProperty('--confete-giro', Math.round(Math.random() * 360) + 'deg');
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 750);
  }
}

// ------------------------------------------------------------
// Copiar a chave Pix
// ------------------------------------------------------------
const btnCopiarPix = document.getElementById('btn-copiar-pix');
if (btnCopiarPix) {
  btnCopiarPix.addEventListener('click', async () => {
    const chave = document.getElementById('pix-chave').textContent.trim();
    try {
      await navigator.clipboard.writeText(chave);
    } catch (err) {
      const temp = document.createElement('textarea');
      temp.value = chave;
      document.body.appendChild(temp);
      temp.select();
      document.execCommand('copy');
      document.body.removeChild(temp);
    }
    const textoOriginal = btnCopiarPix.textContent;
    btnCopiarPix.textContent = 'Copiado!';
    tocarSucesso();
    if (!PREFERE_MENOS_MOVIMENTO) lancarConfete(btnCopiarPix);
    setTimeout(() => { btnCopiarPix.textContent = textoOriginal; }, 2000);
  });
}

// ------------------------------------------------------------
// Prévia ao vivo: nome e número digitados aparecem na hora sobre
// a foto real da camiseta, no lugar de "EJAC" e "94" (exemplos)
// ------------------------------------------------------------
const inputNomeCamisa = document.querySelector('input[name="nomeCamisa"]');
const inputNumeroCamisa = document.querySelector('input[name="numeroCamisa"]');
const previewNome = document.getElementById('preview-nome');
const previewNumero = document.getElementById('preview-numero');
const previewLegenda = document.getElementById('preview-legenda');

// A prévia é desenhada visualmente sobre a foto, então leitor de tela não
// "vê" nada. Esta legenda (aria-live) narra o resultado em texto.
function atualizarLegendaPreview() {
  if (!previewLegenda) return;
  previewLegenda.textContent =
    `Prévia: nome ${previewNome.textContent}, número ${previewNumero.textContent}`;
}

// Tamanho base = o da estampa real (17cqw pra 4 letras, 57.79cqw pra 2
// dígitos), calibrado com Canvas measureText. Textos maiores que o padrão
// encolhem pra não estourar a área impressa; o scaleX fica no CSS, fixo.
const BASE_NOME = 17, BASE_NUMERO = 57.79;

function atualizarPreviewNome() {
  if (!inputNomeCamisa || !previewNome) return;
  const texto = inputNomeCamisa.value.trim() || 'EJAC';
  previewNome.textContent = texto;
  const escala = Math.min(BASE_NOME, BASE_NOME * 4 / texto.length);
  previewNome.style.fontSize = escala + 'cqw';
  atualizarLegendaPreview();
}

function atualizarPreviewNumero() {
  if (!inputNumeroCamisa || !previewNumero) return;
  const texto = inputNumeroCamisa.value.trim() || '94';
  previewNumero.textContent = texto;
  const escala = Math.min(BASE_NUMERO, BASE_NUMERO * 2 / texto.length);
  previewNumero.style.fontSize = escala + 'cqw';
  atualizarLegendaPreview();
}

if (inputNomeCamisa && previewNome) {
  inputNomeCamisa.addEventListener('input', atualizarPreviewNome);
}
if (inputNumeroCamisa && previewNumero) {
  inputNumeroCamisa.addEventListener('input', atualizarPreviewNumero);
}

function destacarInvalido(el) {
  if (!el || PREFERE_MENOS_MOVIMENTO) return;
  el.classList.remove('campo-invalido');
  void el.offsetWidth; // força reflow pra reiniciar a animação se já tiver a classe
  el.classList.add('campo-invalido');
  el.addEventListener('animationend', () => el.classList.remove('campo-invalido'), { once: true });
}

// O envio dos formulários (camiseta e cesta básica) mudou pra Firestore
// — a lógica de cada um mora em camiseta-firebase.js e cesta-firebase.js,
// carregados só na página correspondente. Esses utilitários de UI (som,
// prévia da camisa, animação de campo inválido) são compartilhados com
// esses módulos via window.EJAC, já que são <script type="module"> e não
// enxergam as funções desta IIFE diretamente.
window.EJAC = {
  tocarClick,
  tocarSucesso,
  destacarInvalido,
  atualizarPreviewNome,
  atualizarPreviewNumero,
  PREFERE_MENOS_MOVIMENTO,
};

})();
