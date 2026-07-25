// EJAC — © Esperança Jovem Aliada a Cristo

const PREFERE_MENOS_MOVIMENTO = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ------------------------------------------------------------
// Fagulhas ambiente simples, no site inteiro (tipo fogueira) —
// bem mais discretas que as do hero, quase sempre laranja
// ------------------------------------------------------------
const bgEmbersCanvas = document.getElementById('bg-embers');
if (bgEmbersCanvas && !PREFERE_MENOS_MOVIMENTO) {
  const bctx = bgEmbersCanvas.getContext('2d');
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
      y: bgEmbersCanvas.height + 10,
      vx: (Math.random() - 0.5) * 0.3,
      vy: -Math.random() * 0.5 - 0.15,
      vida: 1,
      raio: Math.random() * 1.5 + 1,
      // quase sempre laranja, rosa só de vez em quando (fogueira, não confete)
      cor: Math.random() > 0.8 ? '228, 86, 143' : '196, 77, 19',
    });
    if (brasas.length > 40) brasas.splice(0, brasas.length - 40);
  }

  function loopBg() {
    bctx.clearRect(0, 0, bgEmbersCanvas.width, bgEmbersCanvas.height);
    brasas = brasas.filter(b => b.vida > 0);
    brasas.forEach(b => {
      b.x += b.vx;
      b.y += b.vy;
      b.vida -= 0.004;
      bctx.beginPath();
      bctx.arc(b.x, b.y, b.raio * b.vida, 0, Math.PI * 2);
      bctx.fillStyle = `rgba(${b.cor}, ${b.vida * 0.7})`;
      bctx.fill();
    });
    requestAnimationFrame(loopBg);
  }
  requestAnimationFrame(loopBg);

  (function nasceBrasa() {
    criarBrasa();
    setTimeout(nasceBrasa, 900 + Math.random() * 900);
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

  function ajustarTamanho() {
    heroCanvas.width = hero.clientWidth;
    heroCanvas.height = hero.clientHeight;
  }
  ajustarTamanho();
  window.addEventListener('resize', ajustarTamanho);

  function criarParticula(x, y) {
    particulas.push({
      x, y,
      vx: (Math.random() - 0.5) * 0.6,
      vy: -Math.random() * 0.8 - 0.2, // sobe devagar, como brasa/fagulha de fogo
      vida: 1,
      raio: Math.random() * 2 + 1.5,
      cor: Math.random() > 0.5 ? '196, 77, 19' : '228, 86, 143',
    });
    if (particulas.length > 140) particulas.splice(0, particulas.length - 140);
  }

  function loop() {
    ctx.clearRect(0, 0, heroCanvas.width, heroCanvas.height);
    particulas = particulas.filter(p => p.vida > 0);
    particulas.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vida -= 0.006; // desaparece devagar (~2.7s), pra sentir como rastro/brasa
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.raio * p.vida, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.cor}, ${p.vida})`;
      ctx.fill();
    });
    requestAnimationFrame(loop); // roda pra sempre, não desliga sozinho
  }
  requestAnimationFrame(loop);

  // Fagulhas ambiente: nascem sozinhas de tempos em tempos, mesmo sem
  // interação, pra sensação de "fogueira viva" nunca sumir de vez.
  function fagulhaAmbiente() {
    if (heroCanvas.width > 0 && heroCanvas.height > 0) {
      criarParticula(Math.random() * heroCanvas.width, heroCanvas.height * (0.6 + Math.random() * 0.4));
    }
    setTimeout(fagulhaAmbiente, 350 + Math.random() * 400);
  }
  fagulhaAmbiente();

  hero.addEventListener('mousemove', (e) => {
    const rect = hero.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    criarParticula(x, y);
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

// URL do Web App do Google Apps Script (veja o README.md pra gerar)
const SHEET_SCRIPT_URL = "https://script.google.com/macros/s/AKfycby88ta4VEGOe5GdSnphLScnKoaQvBYhgyMkEWW28JtS9LeoSevpeflbXtTld3PkW_9aYg/exec";

// Limites de validação (espelham o que o Code.gs valida no servidor)
const LIMITES = {
  nomeCompleto: 80,
  nomeCamisa: 20,
  numeroCamisa: 3,
};
const TAMANHOS_VALIDOS = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'G2', 'G3', 'G4', 'G5'];

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

function atualizarPreviewNome() {
  const texto = inputNomeCamisa.value.trim() || 'EJAC';
  previewNome.textContent = texto;
  // encolhe a fonte pra nomes mais compridos não estourarem a área impressa
  const escala = Math.min(7, 26 / texto.length);
  previewNome.style.fontSize = escala + 'cqw';
}

function atualizarPreviewNumero() {
  const texto = inputNumeroCamisa.value.trim() || '94';
  previewNumero.textContent = texto;
  const escala = Math.min(18, 34 / texto.length);
  previewNumero.style.fontSize = escala + 'cqw';
}

if (inputNomeCamisa && previewNome) {
  inputNomeCamisa.addEventListener('input', atualizarPreviewNome);
}
if (inputNumeroCamisa && previewNumero) {
  inputNumeroCamisa.addEventListener('input', atualizarPreviewNumero);
}

// ------------------------------------------------------------
// Envio do formulário para a planilha do Google
// ------------------------------------------------------------
const form = document.getElementById('form-pedido');
const btn = document.getElementById('btn-enviar');
const msg = document.getElementById('form-msg');

function mostrarErro(texto) {
  msg.textContent = texto;
  msg.className = 'form-msg erro';
}

function destacarInvalido(el) {
  if (!el || PREFERE_MENOS_MOVIMENTO) return;
  el.classList.remove('campo-invalido');
  void el.offsetWidth; // força reflow pra reiniciar a animação se já tiver a classe
  el.classList.add('campo-invalido');
  el.addEventListener('animationend', () => el.classList.remove('campo-invalido'), { once: true });
}

if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (SHEET_SCRIPT_URL.includes('COLE_AQUI')) {
      mostrarErro('O formulário ainda não está conectado à planilha. Veja o README.md.');
      return;
    }

    if ((form.website && form.website.value.trim()) !== '') {
      msg.textContent = 'Pedido enviado com sucesso! 🎉';
      msg.className = 'form-msg sucesso';
      form.reset();
      return;
    }

    // Coleta e limpeza dos dados
    const nomeCompleto = form.nomeCompleto.value.trim();
    const nomeCamisa = form.nomeCamisa.value.trim();
    const numeroCamisa = form.numeroCamisa.value.trim();
    const tamanho = form.tamanho.value;

    // Validação no cliente (o servidor revalida tudo)
    if (!nomeCompleto || !nomeCamisa || !numeroCamisa || !tamanho) {
      mostrarErro('Preencha todos os campos antes de enviar.');
      if (!nomeCompleto) destacarInvalido(form.nomeCompleto);
      if (!nomeCamisa) destacarInvalido(form.nomeCamisa);
      if (!numeroCamisa) destacarInvalido(form.numeroCamisa);
      if (!tamanho) destacarInvalido(form.tamanho);
      return;
    }
    if (nomeCompleto.length > LIMITES.nomeCompleto || nomeCamisa.length > LIMITES.nomeCamisa) {
      mostrarErro('Algum campo está longo demais. Revise e tente de novo.');
      if (nomeCompleto.length > LIMITES.nomeCompleto) destacarInvalido(form.nomeCompleto);
      if (nomeCamisa.length > LIMITES.nomeCamisa) destacarInvalido(form.nomeCamisa);
      return;
    }
    if (!/^[0-9]{1,3}$/.test(numeroCamisa)) {
      mostrarErro('O número na camisa deve ter só dígitos (ex: 7).');
      destacarInvalido(form.numeroCamisa);
      return;
    }
    if (!TAMANHOS_VALIDOS.includes(tamanho)) {
      mostrarErro('Escolha um tamanho válido.');
      destacarInvalido(form.tamanho);
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Enviando...';
    msg.className = 'form-msg';
    msg.textContent = '';

    const dados = new URLSearchParams({ nomeCompleto, nomeCamisa, numeroCamisa, tamanho });

    try {
      await fetch(SHEET_SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: dados });
      msg.textContent = 'Pedido enviado com sucesso! 🎉';
      msg.className = 'form-msg sucesso';
      tocarSucesso();
      form.reset();
      if (previewNome) atualizarPreviewNome();
      if (previewNumero) atualizarPreviewNumero();
    } catch (err) {
      mostrarErro('Não foi possível enviar. Tente novamente em instantes.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Enviar pedido';
    }
  });
}
