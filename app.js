/* ============================================================
   EJAC — lógica do site (copiar Pix, envio do form)
   Arquivo externo para permitir uma CSP estrita (script-src 'self'),
   sem nenhum script inline na página.
   ============================================================ */

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
    setTimeout(() => { btnCopiarPix.textContent = textoOriginal; }, 2000);
  });
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

if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (SHEET_SCRIPT_URL.includes('COLE_AQUI')) {
      mostrarErro('O formulário ainda não está conectado à planilha. Veja o README.md.');
      return;
    }

    // Honeypot: se o campo invisível veio preenchido, é bot. Fingimos
    // sucesso pra não dar pista, mas não enviamos nada.
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
      return;
    }
    if (nomeCompleto.length > LIMITES.nomeCompleto || nomeCamisa.length > LIMITES.nomeCamisa) {
      mostrarErro('Algum campo está longo demais. Revise e tente de novo.');
      return;
    }
    if (!/^[0-9]{1,3}$/.test(numeroCamisa)) {
      mostrarErro('O número na camisa deve ter só dígitos (ex: 7).');
      return;
    }
    if (!TAMANHOS_VALIDOS.includes(tamanho)) {
      mostrarErro('Escolha um tamanho válido.');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Enviando...';
    msg.className = 'form-msg';
    msg.textContent = '';

    const dados = new URLSearchParams({ nomeCompleto, nomeCamisa, numeroCamisa, tamanho });

    try {
      // O Apps Script não devolve cabeçalhos CORS, então usamos "no-cors":
      // não conseguimos ler a resposta, mas o envio funciona normalmente.
      await fetch(SHEET_SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: dados });
      msg.textContent = 'Pedido enviado com sucesso! 🎉';
      msg.className = 'form-msg sucesso';
      form.reset();
    } catch (err) {
      mostrarErro('Não foi possível enviar. Tente novamente em instantes.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Enviar pedido';
    }
  });
}
