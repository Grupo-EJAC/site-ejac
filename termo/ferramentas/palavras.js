#!/usr/bin/env node
// EJAC — Ferramenta do banco de palavras do Termo.
//
// O termo/palavras.js guarda as listas em base64 (pra resposta do dia não
// ficar à vista de quem abre o arquivo). Esta ferramenta é o jeito de mexer
// nelas sem precisar codificar nada na mão.
//
//   node termo/ferramentas/palavras.js ver
//   node termo/ferramentas/palavras.js ver-aceitas
//   node termo/ferramentas/palavras.js add "NOVENA" "Oração de nove dias seguidos."
//   node termo/ferramentas/palavras.js add-aceita "IGREJINHA"
//   node termo/ferramentas/palavras.js proximas 7
//
// "add" acrescenta no FIM da lista, que é sempre seguro: não desloca o
// calendário das palavras que já estão programadas.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ARQUIVO = path.join(__dirname, '..', 'palavras.js');
const ARQUIVO_JOGO = path.join(__dirname, '..', 'jogo.js');

const semAcento = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
const cod = (txt) => Buffer.from(txt, 'utf8').toString('base64');
const dec = (b64) => Buffer.from(b64, 'base64').toString('utf8');

function carregar() {
  const ctx = { console, atob: (b) => Buffer.from(b, 'base64').toString('binary'), TextDecoder, Uint8Array };
  vm.createContext(ctx);
  vm.runInContext(
    fs.readFileSync(ARQUIVO, 'utf8') +
    '\n;globalThis.__E = PALAVRAS_EJAC; globalThis.__A = PALAVRAS_ACEITAS;',
    ctx
  );
  return { ejac: ctx.__E, aceitas: ctx.__A };
}

function validar(palavra, comSignificado, significado) {
  const limpa = semAcento(palavra);
  if (!/^[A-Z]+$/.test(limpa)) return `"${palavra}" tem caractere que não é letra (nada de espaço, hífen ou número).`;
  if (limpa.length < 4 || limpa.length > 10) return `"${palavra}" tem ${limpa.length} letras — o certo é de 4 a 10.`;
  if (comSignificado && (!significado || significado.trim().length < 5)) return `"${palavra}" precisa de um significado.`;
  return null;
}

// Reescreve só o miolo de uma das listas, preservando todo o resto do arquivo.
function regravar(marcador, linhas) {
  const fonte = fs.readFileSync(ARQUIVO, 'utf8');
  const ini = fonte.indexOf(marcador);
  if (ini === -1) throw new Error('não achei "' + marcador + '" no palavras.js');
  const abre = fonte.indexOf('[\n', ini);
  const fecha = fonte.indexOf('\n]', abre);
  if (abre === -1 || fecha === -1) throw new Error('não consegui delimitar a lista de ' + marcador);
  const novo = fonte.slice(0, abre + 2) + linhas.join('\n') + fonte.slice(fecha);
  fs.writeFileSync(ARQUIVO, novo, 'utf8');
}

const [, , comando, ...args] = process.argv;
const dados = carregar();

if (comando === 'ver') {
  dados.ejac.forEach((e, i) => console.log(String(i).padStart(3) + '  ' + e.palavra.padEnd(12) + e.significado));
  console.log('\ntotal: ' + dados.ejac.length + ' respostas');

} else if (comando === 'ver-aceitas') {
  console.log(dados.aceitas.join(', '));
  console.log('\ntotal: ' + dados.aceitas.length + ' aceitas');

} else if (comando === 'add') {
  const [palavra, significado] = args;
  if (!palavra || !significado) {
    console.error('uso: node termo/ferramentas/palavras.js add "PALAVRA" "significado"');
    process.exit(1);
  }
  const erro = validar(palavra, true, significado);
  if (erro) { console.error('recusado: ' + erro); process.exit(1); }
  if (dados.ejac.some(e => semAcento(e.palavra) === semAcento(palavra))) {
    console.error('recusado: "' + palavra + '" já está na lista de respostas.');
    process.exit(1);
  }
  const linhas = dados.ejac.map(e => "  '" + cod(JSON.stringify([e.palavra, e.significado])) + "',");
  linhas.push("  '" + cod(JSON.stringify([palavra.toUpperCase(), significado])) + "',");
  regravar('const PALAVRAS_EJAC', linhas);
  console.log('ok: "' + palavra.toUpperCase() + '" entrou como resposta #' + dados.ejac.length + ' (vai cair daqui a ' + dados.ejac.length + ' dias, contando do começo do ciclo).');

} else if (comando === 'add-aceita') {
  const [palavra] = args;
  if (!palavra) { console.error('uso: node termo/ferramentas/palavras.js add-aceita "PALAVRA"'); process.exit(1); }
  const erro = validar(palavra, false);
  if (erro) { console.error('recusado: ' + erro); process.exit(1); }
  const todas = [...dados.ejac.map(e => semAcento(e.palavra)), ...dados.aceitas.map(semAcento)];
  if (todas.includes(semAcento(palavra))) { console.error('recusado: "' + palavra + '" já é aceita.'); process.exit(1); }
  const linhas = [...dados.aceitas, palavra.toUpperCase()].map(p => "  '" + cod(p) + "',");
  regravar('const PALAVRAS_ACEITAS', linhas);
  console.log('ok: "' + palavra.toUpperCase() + '" agora vale como tentativa.');

} else if (comando === 'proximas') {
  const quantos = Number(args[0]) || 7;
  const fonte = fs.readFileSync(ARQUIVO_JOGO, 'utf8');
  const mZero = fonte.match(/const DIA_ZERO = Date\.UTC\((\d+),\s*(\d+),\s*(\d+)\)/);
  const mMax = fonte.match(/const MAX_LETRAS_DUETO = (\d+)/);
  const DIA_ZERO = Date.UTC(+mZero[1], +mZero[2], +mZero[3]);
  const MAX_LETRAS_DUETO = +mMax[1];
  // lê do jogo.js pra não divergir do que o site realmente sorteia
  const JANELA = +fonte.match(/const JANELA_SEM_REPETIR = (\d+)/)[1];
  const CORTE = +fonte.match(/const DIA_DA_REGRA_SEM_REPETIR = (\d+)/)[1];
  const resto = (v, d) => ((v % d) + d) % d;

  const escolher = (dias, quantas) => {
    if (quantas === 1) return [dados.ejac[resto(dias, dados.ejac.length)]];
    const recentes = new Set();
    if (dias >= CORTE) {
      for (let k = -JANELA; k <= JANELA; k++) recentes.add(semAcento(dados.ejac[resto(dias + k, dados.ejac.length)].palavra));
    }
    const grupos = {};
    dados.ejac.forEach(e => {
      const n = semAcento(e.palavra).length;
      if (n > MAX_LETRAS_DUETO) return;
      if (recentes.has(semAcento(e.palavra))) return;
      (grupos[n] = grupos[n] || []).push(e);
    });
    const tams = Object.keys(grupos).map(Number).filter(n => grupos[n].length >= quantas * 2).sort((a, b) => a - b);
    const g = grupos[tams[resto(dias, tams.length)]];
    return Array.from({ length: quantas }, (_, i) => g[resto(dias * quantas + i, g.length)]);
  };

  const hoje = new Date();
  for (let i = 0; i < quantos; i++) {
    const d = new Date(hoje.getTime() + i * 86400000);
    const dia = Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - DIA_ZERO) / 86400000);
    const data = String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
    console.log(data + (i === 0 ? ' (hoje)' : '') +
      '  termo: ' + escolher(dia, 1)[0].palavra.padEnd(11) +
      '  dueto: ' + escolher(dia, 2).map(e => e.palavra).join(' + '));
  }

} else {
  console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(1, 16).map(l => l.replace(/^\/\/ ?/, '')).join('\n'));
}
