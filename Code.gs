/**
 * EJAC — recebe os pedidos de camiseta vindos do index.html
 * e grava cada um como uma nova linha na planilha do Google Sheets.
 *
 * Como usar: veja o passo a passo completo no README.md.
 */

function doPost(e) {
  var planilha = SpreadsheetApp.getActiveSpreadsheet();
  var aba = planilha.getSheetByName('Pedidos') || planilha.getActiveSheet();

  // Cria o cabeçalho automaticamente se a aba estiver vazia
  if (aba.getLastRow() === 0) {
    aba.appendRow(['Data', 'Nome completo', 'Nome na camisa', 'Número na camisa', 'Tamanho']);
  }

  var dados = e.parameter;

  aba.appendRow([
    new Date(),
    dados.nomeCompleto || '',
    dados.nomeCamisa || '',
    dados.numeroCamisa || '',
    dados.tamanho || ''
  ]);

  return ContentService
    .createTextOutput(JSON.stringify({ resultado: 'sucesso' }))
    .setMimeType(ContentService.MimeType.JSON);
}
