/**
 * EJAC — recebe os pedidos de camiseta vindos do index.html
 * e grava cada um como uma nova linha na planilha do Google Sheets.
 *
 * Segurança embutida:
 *  - valida presença e tamanho de cada campo (rejeita lixo/payload gigante)
 *  - só aceita tamanhos da lista oficial (whitelist)
 *  - honeypot anti-bot: se o campo "website" vier preenchido, ignora
 *  - neutraliza injeção de fórmula: valores que começam com = + - @ etc.
 *    ganham um apóstrofo na frente, então o Sheets trata como TEXTO e nunca
 *    executa como fórmula (protege quem abre a planilha)
 *
 * Como usar: veja o passo a passo completo no README.md.
 * IMPORTANTE: ao alterar este arquivo, é preciso reimplantar uma NOVA VERSÃO
 * (Implantar → Gerenciar implantações → editar → Nova versão → Implantar).
 */

// ID da planilha que recebe os pedidos
const SPREADSHEET_ID = '1YDek0Lrh0jUQ-njxWTnKtkxUYj8M8J2gxkyvOimeVKs';

// Limites de tamanho por campo (devem bater com o app.js)
const LIMITES = { nomeCompleto: 80, nomeCamisa: 20, numeroCamisa: 3 };

// Tamanhos aceitos (whitelist)
const TAMANHOS_VALIDOS = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'G2', 'G3', 'G4', 'G5'];

/**
 * Neutraliza injeção de fórmula (CSV/Formula Injection).
 * Se o texto começa com um caractere que o Sheets interpretaria como
 * fórmula, prefixa com apóstrofo pra forçar TEXTO. Também remove
 * quebras de linha e limita o tamanho.
 */
function sanitizar(valor, limite) {
  var texto = String(valor == null ? '' : valor);
  texto = texto.replace(/[\r\n\t]+/g, ' ').trim();
  if (texto.length > limite) texto = texto.substring(0, limite);
  if (/^[=+\-@]/.test(texto) || /^[\t\r\n]/.test(valor)) {
    texto = "'" + texto;
  }
  return texto;
}

function doPost(e) {
  try {
    var dados = (e && e.parameter) ? e.parameter : {};

    // Honeypot: bot preencheu o campo invisível -> finge sucesso e ignora
    if (dados.website && String(dados.website).trim() !== '') {
      return json({ resultado: 'sucesso' });
    }

    var nomeCompleto = String(dados.nomeCompleto || '').trim();
    var nomeCamisa   = String(dados.nomeCamisa   || '').trim();
    var numeroCamisa = String(dados.numeroCamisa || '').trim();
    var tamanho      = String(dados.tamanho      || '').trim();

    // Validação no servidor
    if (!nomeCompleto || !nomeCamisa || !numeroCamisa || !tamanho) {
      return json({ resultado: 'erro', motivo: 'campos_obrigatorios' });
    }
    if (nomeCompleto.length > LIMITES.nomeCompleto ||
        nomeCamisa.length   > LIMITES.nomeCamisa) {
      return json({ resultado: 'erro', motivo: 'campo_longo' });
    }
    if (!/^[0-9]{1,3}$/.test(numeroCamisa)) {
      return json({ resultado: 'erro', motivo: 'numero_invalido' });
    }
    if (TAMANHOS_VALIDOS.indexOf(tamanho) === -1) {
      return json({ resultado: 'erro', motivo: 'tamanho_invalido' });
    }

    var planilha = SpreadsheetApp.openById(SPREADSHEET_ID);
    var aba = planilha.getSheetByName('Pedidos') || planilha.getSheets()[0];

    // Cria o cabeçalho automaticamente se a aba estiver vazia
    if (aba.getLastRow() === 0) {
      aba.appendRow(['Data', 'Nome completo', 'Nome na camisa', 'Número na camisa', 'Tamanho']);
    }

    aba.appendRow([
      new Date(),
      sanitizar(nomeCompleto, LIMITES.nomeCompleto),
      sanitizar(nomeCamisa,   LIMITES.nomeCamisa),
      sanitizar(numeroCamisa, LIMITES.numeroCamisa),
      tamanho  // já validado contra a whitelist
    ]);

    return json({ resultado: 'sucesso' });
  } catch (err) {
    return json({ resultado: 'erro', motivo: 'excecao' });
  }
}

// Mensagem amigável se alguém abrir a URL direto no navegador (GET)
function doGet() {
  return json({ status: 'ok', mensagem: 'Endpoint de pedidos do EJAC. Use o formulário do site.' });
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
