// EJAC — "Termo EJAC": adivinhe a palavra católica do dia.
//
// Dois modos, no mesmo código:
//   /termo/              -> 1 palavra, 6 tentativas
//   /termo/?modo=dueto   -> 2 palavras ao mesmo tempo, 7 tentativas
//
// Como o term.ooo, mas com duas diferenças de propósito:
//  - o tamanho da palavra muda a cada dia, porque o vocabulário bom da
//    Igreja não cabe todo em 5 letras
//  - ao terminar, aparece o significado da palavra — o jogo também ensina
//
// Roda quase todo no navegador. A única requisição é buscar o dicionário
// de português na própria pasta (ver dicionario/LEIA-ME.md); nenhum dado
// sai daqui e o progresso fica só no localStorage de quem joga.
//
// As palavras do dia saem de uma conta em cima da data, então todo mundo
// pega as mesmas palavras no mesmo dia, sem precisar de backend.
(function () {
'use strict';

if (typeof PALAVRAS_EJAC === 'undefined' || !PALAVRAS_EJAC.length) return;

// ------------------------------------------------------------
// Modo de jogo
// ------------------------------------------------------------
const MODO = (new URLSearchParams(location.search).get('modo') === 'dueto') ? 2 : 1;
const EH_DUETO = MODO === 2;

// 6 tentativas no termo, 7 no dueto (uma a mais por tabuleiro extra)
const MAX_TENTATIVAS = 5 + MODO;

const CHAVE_JOGO = EH_DUETO ? 'ejac-dueto-jogo-v1' : 'ejac-termo-jogo-v1';
const CHAVE_ESTATISTICAS = EH_DUETO ? 'ejac-dueto-stats-v1' : 'ejac-termo-stats-v1';

// Dia 0 da brincadeira. As palavras andam a partir daqui; mudar esta data
// embaralha o calendário inteiro.
const DIA_ZERO = Date.UTC(2026, 8, 15); // 15/09/2026 (mês é 0-indexado)

// No dueto os dois tabuleiros aparecem lado a lado, então palavra longa
// não cabe no celular: duas de 6 letras já ficam com ~28px por peça.
const MAX_LETRAS_DUETO = 6;

const PREFERE_MENOS_MOVIMENTO =
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ------------------------------------------------------------
// Texto: tira acento pra comparar (quem joga digita sem acento)
// ------------------------------------------------------------
function semAcento(texto) {
  return texto
    .normalize('NFD')                  // separa a letra do acento
    .replace(/[̀-ͯ]/g, '')   // remove os acentos soltos (Ç vira C também)
    .toUpperCase();
}

// ------------------------------------------------------------
// Quais são as palavras de hoje
// ------------------------------------------------------------
function chaveDoDia(data) {
  // Usa a data LOCAL (não UTC), senão a palavra trocaria de madrugada
  const a = data.getFullYear();
  const m = String(data.getMonth() + 1).padStart(2, '0');
  const d = String(data.getDate()).padStart(2, '0');
  return `${a}-${m}-${d}`;
}

function diasDesdeOInicio(data) {
  const hoje = Date.UTC(data.getFullYear(), data.getMonth(), data.getDate());
  return Math.floor((hoje - DIA_ZERO) / 86400000);
}

function restoPositivo(valor, divisor) {
  return ((valor % divisor) + divisor) % divisor;
}

/**
 * Escolhe as palavras do dia.
 *
 * No termo, percorre a lista inteira em ordem, uma por dia — foi assim
 * desde o começo e mexer nisso trocaria o calendário já estabelecido.
 *
 * No dueto as duas palavras precisam ter o MESMO tamanho (senão os dois
 * tabuleiros ficam tortos), então primeiro se escolhe um tamanho do dia e
 * depois duas palavras daquele grupo. Palavras que são resposta do termo
 * por estes dias ficam de fora: sem isso a mesma palavra caía no dueto e,
 * dois dias depois, no termo — o que fica esquisito ainda mais agora que
 * tem ranking e todo mundo comenta a palavra do dia.
 */
const JANELA_SEM_REPETIR = 7; // dias pra trás e pra frente

// A regra de não repetir só passa a valer no dia 2 (17/09/2026). Ela muda
// quais palavras saem no dueto, e aplicar isso pra trás trocaria a palavra
// de um dia que já estava rolando — quem estivesse jogando veria o
// tabuleiro mudar debaixo do nariz. Dia que já passou é intocável.
const DIA_DA_REGRA_SEM_REPETIR = 2;

function escolherPalavras(dias, quantas) {
  if (quantas === 1) {
    return [PALAVRAS_EJAC[restoPositivo(dias, PALAVRAS_EJAC.length)]];
  }

  const recentesNoTermo = new Set();
  if (dias >= DIA_DA_REGRA_SEM_REPETIR) {
    for (let k = -JANELA_SEM_REPETIR; k <= JANELA_SEM_REPETIR; k++) {
      recentesNoTermo.add(semAcento(PALAVRAS_EJAC[restoPositivo(dias + k, PALAVRAS_EJAC.length)].palavra));
    }
  }

  const grupos = {};
  PALAVRAS_EJAC.forEach(entrada => {
    const n = semAcento(entrada.palavra).length;
    if (n > MAX_LETRAS_DUETO) return;
    if (recentesNoTermo.has(semAcento(entrada.palavra))) return;
    (grupos[n] = grupos[n] || []).push(entrada);
  });

  // só serve grupo com folga suficiente pra sortear sem repetir
  const tamanhos = Object.keys(grupos)
    .map(Number)
    .filter(n => grupos[n].length >= quantas * 2)
    .sort((a, b) => a - b);

  const tamanho = tamanhos[restoPositivo(dias, tamanhos.length)];
  const grupo = grupos[tamanho];

  const escolhidas = [];
  for (let i = 0; i < quantas; i++) {
    escolhidas.push(grupo[restoPositivo(dias * quantas + i, grupo.length)]);
  }
  return escolhidas;
}

const agora = new Date();
const DIA_HOJE = chaveDoDia(agora);
const ENTRADAS = escolherPalavras(diasDesdeOInicio(agora), MODO);
const ALVOS = ENTRADAS.map(e => semAcento(e.palavra));
const TAMANHO = ALVOS[0].length;

// Palavras que valem como tentativa. Começa com o banco embutido e recebe
// o dicionário do português quando ele chega. Assim o jogo é jogável na
// hora, mesmo antes do download terminar, e continua jogável se falhar.
const ACEITAS = new Set([
  ...PALAVRAS_EJAC.map(e => semAcento(e.palavra)),
  ...(typeof PALAVRAS_ACEITAS !== 'undefined' ? PALAVRAS_ACEITAS.map(semAcento) : []),
]);

let dicionarioCarregado = false;

// ------------------------------------------------------------
// Estado salvo no navegador
// ------------------------------------------------------------
function lerJSON(chave, padrao) {
  try {
    const bruto = localStorage.getItem(chave);
    return bruto ? JSON.parse(bruto) : padrao;
  } catch (e) {
    return padrao; // localStorage bloqueado (aba anônima, etc.) — segue sem salvar
  }
}

function gravarJSON(chave, valor) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch (e) { /* sem espaço ou bloqueado: o jogo continua, só não salva */ }
}

// O jogo salvo guarda as palavras do dia junto. Se elas mudarem (troca no
// banco de palavras, ajuste no sorteio), o progresso antigo não vale mais:
// as cores seriam recalculadas contra outra resposta e o tabuleiro ficaria
// mentindo. Nesse caso começa de novo, que é o único estado honesto.
let jogo = lerJSON(CHAVE_JOGO, null);
const ALVOS_HOJE = ALVOS.join(',');
if (!jogo || jogo.dia !== DIA_HOJE || (jogo.alvos || ALVOS_HOJE) !== ALVOS_HOJE) {
  jogo = {
    dia: DIA_HOJE,
    alvos: ALVOS_HOJE,
    tentativas: [],
    estado: 'jogando',
    inicio: null,      // marcado na primeira letra digitada, não ao abrir a página
    duracaoMs: null,   // preenchido quando a rodada termina
  };
}

const ESTATISTICAS_PADRAO = {
  jogos: 0, vitorias: 0, sequencia: 0, melhorSequencia: 0, ultimoDia: null,
};
let stats = Object.assign({}, ESTATISTICAS_PADRAO, lerJSON(CHAVE_ESTATISTICAS, {}));

// ------------------------------------------------------------
// Easter egg de um dia só (22/09/2026): o Dueto vira "João" + "Batista",
// porque o EJAC foi campeão do desfile representando João Batista. As
// duas palavras têm tamanhos diferentes (4 e 7 letras), e o motor normal
// do Dueto (logo abaixo) assume o tempo todo que as duas palavras do dia
// têm o MESMO tamanho — uma tentativa só, conferida nos dois tabuleiros
// ao mesmo tempo, célula por célula na mesma posição. Forçar tamanhos
// diferentes ali quebraria a comparação.
//
// Por isso isto é um modo à parte, sequencial: resolve "João" primeiro
// (4 tentativas do teclado, mas vale as mesmas 7 tentativas do dueto),
// depois "Batista", cada um com sua própria fila — não a mesma tentativa
// conferida nos dois ao mesmo tempo. Reaproveita avaliar()/lerJSON/
// gravarJSON do resto do arquivo (essas não mudam com tamanho), mas tem
// seu próprio desenho de tela, teclado e envio — não toca em nada do
// motor normal, que continua exatamente igual em todo outro dia.
// ------------------------------------------------------------
if (EH_DUETO && DIA_HOJE === '2026-09-22') {
  iniciarDuetoEspecial();
  return;
}

function iniciarDuetoEspecial() {
  const ENTRADAS_ESP = [
    { palavra: 'João', significado: 'João Batista, primo de Jesus, preparou o caminho do Senhor e o batizou no rio Jordão (Mt 3).' },
    { palavra: 'Batista', significado: 'É Campeão!🏆' },
  ];
  const ALVOS_ESP = ENTRADAS_ESP.map(e => semAcento(e.palavra));
  const MAX_TENT_ESP = MAX_TENTATIVAS; // 7, igual ao dueto normal, cada tabuleiro com sua cota

  const elTabuleiros = document.getElementById('tabuleiros');
  const elTeclado = document.getElementById('teclado');
  const elAviso = document.getElementById('aviso');
  const elFim = document.getElementById('fim');
  const elFimTitulo = document.getElementById('fim-titulo');
  const elFimPalavras = document.getElementById('fim-palavras');
  const elBtnCompartilhar = document.getElementById('btn-compartilhar');
  const elStats = document.getElementById('stats');
  const elTamanhoDica = document.getElementById('tamanho-dica');
  const elTitulo = document.getElementById('titulo-modo');
  const elSub = document.getElementById('jogo-sub');

  if (!elTabuleiros || !elTeclado) return;

  const CHAVE = 'ejac-dueto-especial-20260922-v1';
  let estado = lerJSON(CHAVE, null);
  if (!estado) {
    estado = { tentativas: [[], []], resultado: 'jogando', inicio: null, duracaoMs: null };
  }
  function salvar() { gravarJSON(CHAVE, estado); }

  let letras = ALVOS_ESP.map(a => Array(a.length).fill(''));
  let cursor = [0, 0];
  let travado = estado.resultado !== 'jogando';

  function travadoTab(b) {
    return estado.tentativas[b].includes(ALVOS_ESP[b]) || estado.tentativas[b].length >= MAX_TENT_ESP;
  }
  function resolvidoTab(b) {
    return estado.tentativas[b].includes(ALVOS_ESP[b]);
  }
  function linhasVisiveis(b) {
    const fim = estado.tentativas[b].indexOf(ALVOS_ESP[b]);
    return fim === -1 ? estado.tentativas[b].length : fim + 1;
  }
  function todosResolvidos() { return resolvidoTab(0) && resolvidoTab(1); }
  function todosTravados() { return travadoTab(0) && travadoTab(1); }

  // Qual tabuleiro recebe o teclado agora: o primeiro que ainda não
  // travou (resolvido ou sem mais tentativas). Assim que um trava, o
  // próximo enviar() já manda o teclado pro outro sozinho.
  let tabAtiva = travadoTab(0) ? 1 : 0;

  function montarTabuleiros() {
    elTabuleiros.innerHTML = '';
    elTabuleiros.classList.add('dueto');
    ALVOS_ESP.forEach((alvo, b) => {
      const grade = document.createElement('div');
      grade.className = 'grade';
      grade.dataset.tabuleiro = String(b);
      grade.style.setProperty('--colunas', alvo.length);
      for (let linha = 0; linha < MAX_TENT_ESP; linha++) {
        const elLinha = document.createElement('div');
        elLinha.className = 'linha';
        for (let col = 0; col < alvo.length; col++) {
          const cel = document.createElement('div');
          cel.className = 'cel';
          cel.addEventListener('click', () => selecionarCelula(b, linha, col));
          elLinha.appendChild(cel);
        }
        grade.appendChild(elLinha);
      }
      elTabuleiros.appendChild(grade);
    });
  }

  function selecionarCelula(b, linha, col) {
    if (travado || b !== tabAtiva) return;
    if (linha !== estado.tentativas[b].length) return;
    if (travadoTab(b)) return;
    cursor[b] = col;
    pintarTabuleiros(false);
  }

  function pintarTabuleiros(animarUltima) {
    ALVOS_ESP.forEach((alvo, b) => {
      const grade = elTabuleiros.querySelector(`.grade[data-tabuleiro="${b}"]`);
      const linhas = grade.querySelectorAll('.linha');
      const visiveis = linhasVisiveis(b);
      const resolvido = resolvidoTab(b);
      grade.classList.toggle('resolvido', resolvido);

      for (let i = 0; i < MAX_TENT_ESP; i++) {
        const celulas = linhas[i].querySelectorAll('.cel');
        if (i < visiveis) {
          const tentativa = estado.tentativas[b][i];
          const resultado = avaliar(tentativa, alvo);
          const ehUltima = animarUltima && i === visiveis - 1 && i === estado.tentativas[b].length - 1;
          celulas.forEach((cel, j) => {
            cel.textContent = resultado[j] === 'certo' ? ENTRADAS_ESP[b].palavra[j] : tentativa[j];
            cel.classList.add('preenchida');
            cel.classList.remove('certo', 'presente', 'ausente', 'cel-cursor', 'cel-editavel');
            if (ehUltima && !PREFERE_MENOS_MOVIMENTO) {
              cel.style.animationDelay = (j * 0.18) + 's';
              cel.classList.add('virando');
              setTimeout(() => cel.classList.add(resultado[j]), j * 180 + 130);
            } else {
              cel.classList.add(resultado[j]);
            }
          });
        } else if (b === tabAtiva && i === estado.tentativas[b].length && !resolvido) {
          celulas.forEach((cel, j) => {
            cel.textContent = letras[b][j] || '';
            cel.classList.toggle('preenchida', Boolean(letras[b][j]));
            cel.classList.toggle('cel-cursor', j === cursor[b]);
            cel.classList.add('cel-editavel');
            cel.classList.remove('certo', 'presente', 'ausente');
          });
        } else {
          celulas.forEach(cel => {
            cel.textContent = '';
            cel.classList.remove('preenchida', 'certo', 'presente', 'ausente', 'cel-cursor', 'cel-editavel');
          });
        }
      }
    });
  }

  function montarTeclado() {
    elTeclado.innerHTML = '';
    const LINHAS_TECLADO = [
      ['Q','W','E','R','T','Y','U','I','O','P'],
      ['A','S','D','F','G','H','J','K','L'],
      ['APAGAR','Z','X','C','V','B','N','M','ENTER'],
    ];
    LINHAS_TECLADO.forEach(linha => {
      const elLinha = document.createElement('div');
      elLinha.className = 'teclado-linha';
      linha.forEach(tecla => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'tecla';
        btn.dataset.tecla = tecla;
        if (tecla === 'ENTER') {
          btn.classList.add('tecla-larga');
          btn.textContent = 'Enviar';
          btn.setAttribute('aria-label', 'Enviar palavra');
        } else if (tecla === 'APAGAR') {
          btn.classList.add('tecla-larga');
          btn.textContent = '⌫';
          btn.setAttribute('aria-label', 'Apagar letra');
        } else {
          btn.textContent = tecla;
        }
        btn.addEventListener('mousedown', (e) => e.preventDefault());
        btn.addEventListener('click', () => aoPressionar(tecla));
        elLinha.appendChild(btn);
      });
      elTeclado.appendChild(elLinha);
    });
  }

  const PRIORIDADE_ESP = { ausente: 1, presente: 2, certo: 3 };
  const COR_ESP = { certo: '#2f8f4e', presente: '#b8902a', ausente: '#222' };

  function melhorPorLetra(b) {
    const melhor = {};
    const visiveis = linhasVisiveis(b);
    for (let i = 0; i < visiveis; i++) {
      const tentativa = estado.tentativas[b][i];
      const resultado = avaliar(tentativa, ALVOS_ESP[b]);
      for (let j = 0; j < ALVOS_ESP[b].length; j++) {
        const letra = tentativa[j];
        if (!melhor[letra] || PRIORIDADE_ESP[resultado[j]] > PRIORIDADE_ESP[melhor[letra]]) {
          melhor[letra] = resultado[j];
        }
      }
    }
    return melhor;
  }

  function pintarTeclado() {
    const porTabuleiro = ALVOS_ESP.map((_, b) => melhorPorLetra(b));
    elTeclado.querySelectorAll('.tecla').forEach(btn => {
      const letra = btn.dataset.tecla;
      btn.classList.remove('certo', 'presente', 'ausente', 'tecla-dupla');
      btn.style.removeProperty('--cor-a');
      btn.style.removeProperty('--cor-b');
      if (!/^[A-Z]$/.test(letra)) return;
      const a = porTabuleiro[0][letra];
      const c = porTabuleiro[1][letra];
      if (!a && !c) return;
      if (a === c) {
        btn.classList.add(a);
      } else {
        btn.classList.add('tecla-dupla');
        btn.style.setProperty('--cor-a', a ? COR_ESP[a] : '#3f3f3f');
        btn.style.setProperty('--cor-b', c ? COR_ESP[c] : '#3f3f3f');
      }
    });
  }

  let timerAviso;
  function avisar(texto) {
    elAviso.textContent = texto;
    elAviso.classList.add('visivel');
    clearTimeout(timerAviso);
    timerAviso = setTimeout(() => elAviso.classList.remove('visivel'), 2200);
  }

  function sacudirLinha() {
    if (PREFERE_MENOS_MOVIMENTO) return;
    const grade = elTabuleiros.querySelector(`.grade[data-tabuleiro="${tabAtiva}"]`);
    if (!grade) return;
    const linha = grade.querySelectorAll('.linha')[estado.tentativas[tabAtiva].length];
    if (!linha) return;
    linha.classList.remove('sacudir');
    void linha.offsetWidth;
    linha.classList.add('sacudir');
  }

  // Banco embutido (ACEITAS, já com palavras de todo tamanho) + os dois
  // dicionários completos (4 e 7 letras) — igual ao carregarDicionario()
  // normal, só que buscando dois arquivos em vez de um.
  let dicCarregado = { 4: false, 7: false };
  const ACEITAS_ESP = new Set(ACEITAS);
  function carregarDicionarioEspecial(tam) {
    fetch(`dicionario/${tam}.txt`)
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then(texto => {
        let n = 0;
        for (const linha of texto.split('\n')) {
          const p = linha.trim();
          if (p) { ACEITAS_ESP.add(p); n++; }
        }
        if (n > 0) dicCarregado[tam] = true;
      })
      .catch(() => { dicCarregado[tam] = false; });
  }

  function aoPressionar(tecla) {
    if (travado) return;
    const b = tabAtiva;
    const tam = ALVOS_ESP[b].length;

    if (tecla === 'ENTER') { enviar(); return; }
    if (tecla === 'APAGAR') {
      if (letras[b][cursor[b]]) {
        letras[b][cursor[b]] = '';
      } else if (cursor[b] > 0) {
        cursor[b] -= 1;
        letras[b][cursor[b]] = '';
      }
      pintarTabuleiros(false);
      return;
    }
    if (/^[A-Z]$/.test(tecla)) {
      if (!estado.inicio) {
        estado.inicio = Date.now();
        salvar();
      }
      letras[b][cursor[b]] = tecla;
      cursor[b] = Math.min(cursor[b] + 1, tam - 1);
      pintarTabuleiros(false);
    }
  }

  function enviar() {
    const b = tabAtiva;
    const tam = ALVOS_ESP[b].length;
    if (letras[b].some(l => !l)) {
      avisar(`Faltam letras — essa palavra tem ${tam} letras.`);
      sacudirLinha();
      return;
    }
    const tentativa = letras[b].join('');
    if (dicCarregado[tam] && !ACEITAS_ESP.has(tentativa)) {
      avisar('Essa palavra não existe.');
      sacudirLinha();
      return;
    }

    estado.tentativas[b].push(tentativa);
    letras[b] = Array(tam).fill('');
    cursor[b] = 0;

    const outro = b === 0 ? 1 : 0;
    if (travadoTab(b) && !travadoTab(outro)) tabAtiva = outro;

    if (todosResolvidos()) {
      estado.resultado = 'ganhou';
    } else if (todosTravados()) {
      estado.resultado = 'perdeu';
    }
    if (estado.resultado !== 'jogando' && !estado.duracaoMs) {
      estado.duracaoMs = estado.inicio ? Date.now() - estado.inicio : null;
    }

    salvar();
    pintarTabuleiros(true);
    pintarTeclado();

    if (estado.resultado !== 'jogando') {
      travado = true;
      registrarEstatisticasEspecial();
      const espera = PREFERE_MENOS_MOVIMENTO ? 200 : tam * 180 + 500;
      setTimeout(() => mostrarFim(false), espera);
    }
  }

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target && e.target.classList && e.target.classList.contains('tecla')) return;
    if (e.key === 'Enter') { aoPressionar('ENTER'); return; }
    if (e.key === 'Backspace') { aoPressionar('APAGAR'); return; }
    const letra = semAcento(e.key);
    if (letra.length === 1 && /^[A-Z]$/.test(letra)) aoPressionar(letra);
  });

  function registrarEstatisticasEspecial() {
    if (stats.ultimoDia === DIA_HOJE) return;
    const ganhou = estado.resultado === 'ganhou';
    stats.jogos += 1;
    if (ganhou) {
      stats.vitorias += 1;
      const ontem = new Date(agora);
      ontem.setDate(ontem.getDate() - 1);
      stats.sequencia = (stats.ultimoDia === chaveDoDia(ontem)) ? stats.sequencia + 1 : 1;
      stats.melhorSequencia = Math.max(stats.melhorSequencia, stats.sequencia);
    } else {
      stats.sequencia = 0;
    }
    stats.ultimoDia = DIA_HOJE;
    gravarJSON(CHAVE_ESTATISTICAS, stats);
  }

  function mostrarEstatisticas() {
    if (!elStats) return;
    const pct = stats.jogos ? Math.round((stats.vitorias / stats.jogos) * 100) : 0;
    elStats.innerHTML = '';
    [
      ['Jogos', stats.jogos],
      ['Vitórias', pct + '%'],
      ['Sequência', stats.sequencia],
      ['Melhor', stats.melhorSequencia],
    ].forEach(([rotulo, valor]) => {
      const item = document.createElement('div');
      item.className = 'stat';
      const n = document.createElement('span');
      n.className = 'stat-num';
      n.textContent = String(valor);
      const r = document.createElement('span');
      r.className = 'stat-rotulo';
      r.textContent = rotulo;
      item.append(n, r);
      elStats.appendChild(item);
    });
  }

  const ELOGIOS_ESP = ['Na primeira!', 'Muito bem!', 'Boa!', 'Essa foi por pouco...', 'Ufa!', 'No último suspiro!', 'No limite!'];
  function formatarTempo(ms) {
    if (!ms || ms < 0) return null;
    const s = Math.round(ms / 1000);
    return s < 60 ? `${s}s` : `${Math.floor(s / 60)}min${String(s % 60).padStart(2, '0')}`;
  }

  function mostrarFim(restaurado) {
    const ganhou = estado.resultado === 'ganhou';
    const totalTentativas = estado.tentativas[0].length + estado.tentativas[1].length;
    elFimTitulo.textContent = ganhou
      ? (ELOGIOS_ESP[Math.min(totalTentativas - 1, ELOGIOS_ESP.length - 1)] || 'Conseguiu!')
      : 'Fica pra próxima';

    elFimPalavras.innerHTML = '';
    ENTRADAS_ESP.forEach(entrada => {
      const bloco = document.createElement('div');
      bloco.className = 'fim-bloco';
      const p = document.createElement('p');
      p.className = 'fim-palavra';
      p.textContent = entrada.palavra.toUpperCase();
      const s = document.createElement('p');
      s.className = 'fim-significado';
      s.textContent = entrada.significado;
      bloco.append(p, s);
      elFimPalavras.appendChild(bloco);
    });

    const tempo = formatarTempo(estado.duracaoMs);
    if (tempo) {
      const p = document.createElement('p');
      p.className = 'fim-tempo';
      p.textContent = ganhou ? `Seu tempo: ${tempo}` : `Tempo: ${tempo}`;
      elFimPalavras.appendChild(p);
    }

    elFim.hidden = false;
    mostrarEstatisticas();
    elFim.scrollIntoView({ behavior: PREFERE_MENOS_MOVIMENTO ? 'auto' : 'smooth', block: 'nearest' });

    const detalhe = {
      dia: DIA_HOJE,
      modo: 'dueto',
      venceu: ganhou,
      tentativas: totalTentativas,
      maxTentativas: MAX_TENT_ESP * 2,
      duracaoMs: estado.duracaoMs || null,
      restaurado: !!restaurado,
    };
    document.__ejacFim = detalhe;
    document.dispatchEvent(new CustomEvent('ejac:fim', { detail: detalhe }));
  }

  const EMOJI_ESP = { certo: '🟩', presente: '🟨', ausente: '⬛' };
  function montarTextoCompartilhar() {
    const totalTentativas = estado.tentativas[0].length + estado.tentativas[1].length;
    const placar = estado.resultado === 'ganhou' ? `${totalTentativas}/${MAX_TENT_ESP * 2}` : `X/${MAX_TENT_ESP * 2}`;
    const [, m, d] = DIA_HOJE.split('-');
    const linhasMax = Math.max(estado.tentativas[0].length, estado.tentativas[1].length);
    const linhas = [];
    for (let i = 0; i < linhasMax; i++) {
      const partes = ALVOS_ESP.map((alvo, b) => {
        if (i >= estado.tentativas[b].length) return '⬜'.repeat(alvo.length);
        return avaliar(estado.tentativas[b][i], alvo).map(r => EMOJI_ESP[r]).join('');
      });
      linhas.push(partes.join(' '));
    }
    const tempo = formatarTempo(estado.duracaoMs);
    return [
      `Dueto EJAC ${d}/${m} - ${placar}${tempo ? ' em ' + tempo : ''} 🏆`,
      '',
      linhas.join('\n'),
      '',
      'https://grupoejac.com.br/termo/?modo=dueto',
    ].join('\n');
  }

  if (elBtnCompartilhar) {
    elBtnCompartilhar.addEventListener('click', async () => {
      const texto = montarTextoCompartilhar();
      const ehTelaDeToque = matchMedia('(pointer: coarse)').matches;
      if (ehTelaDeToque && navigator.share) {
        try { await navigator.share({ text: texto }); return; }
        catch (e) { if (e && e.name === 'AbortError') return; }
      }
      try {
        await navigator.clipboard.writeText(texto);
      } catch (e) {
        const temp = document.createElement('textarea');
        temp.value = texto;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand('copy');
        document.body.removeChild(temp);
      }
      const original = elBtnCompartilhar.textContent;
      elBtnCompartilhar.textContent = 'Copiado!';
      setTimeout(() => { elBtnCompartilhar.textContent = original; }, 2000);
    });
  }

  if (elTitulo) elTitulo.textContent = 'Dueto';
  document.title = 'EJAC - Dueto: duas palavras católicas por dia';
  if (elSub) elSub.textContent = `Dia especial: duas palavras de tamanhos diferentes, ${MAX_TENT_ESP} tentativas cada uma.`;
  if (elTamanhoDica) elTamanhoDica.textContent = `1ª palavra: ${ALVOS_ESP[0].length} letras · 2ª palavra: ${ALVOS_ESP[1].length} letras`;
  document.querySelectorAll('[data-modo]').forEach(link => {
    const ativo = link.dataset.modo === 'dueto';
    link.classList.toggle('modo-ativo', ativo);
    if (ativo) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  });

  carregarDicionarioEspecial(4);
  carregarDicionarioEspecial(7);
  montarTabuleiros();
  montarTeclado();
  pintarTabuleiros(false);
  pintarTeclado();
  mostrarEstatisticas();
  if (travado) mostrarFim(true);
}

// ------------------------------------------------------------
// Elementos da página
// ------------------------------------------------------------
const elTabuleiros = document.getElementById('tabuleiros');
const elTeclado = document.getElementById('teclado');
const elAviso = document.getElementById('aviso');
const elFim = document.getElementById('fim');
const elFimTitulo = document.getElementById('fim-titulo');
const elFimPalavras = document.getElementById('fim-palavras');
const elBtnCompartilhar = document.getElementById('btn-compartilhar');
const elStats = document.getElementById('stats');
const elTamanhoDica = document.getElementById('tamanho-dica');
const elTitulo = document.getElementById('titulo-modo');

if (!elTabuleiros || !elTeclado) return;

// A linha sendo digitada agora não é mais só uma string que só cresce no
// fim: é um vetor de posições fixas (uma por coluna) mais um cursor, pra
// dar pra clicar em qualquer quadrado e digitar ali, não só no próximo.
let letras = Array(TAMANHO).fill('');
let cursor = 0;
let travado = jogo.estado !== 'jogando';

// ------------------------------------------------------------
// Avaliação de uma tentativa (o coração do jogo)
//
// Duas passadas, pra tratar letra repetida direito: primeiro marca as que
// estão no lugar certo e só o que sobrou pode virar "presente". Sem isso,
// "SUSTO" contra "MISSA" marcaria os dois S como presentes.
// ------------------------------------------------------------
function avaliar(tentativa, alvo) {
  const resultado = new Array(alvo.length).fill('ausente');
  const sobrando = {};

  for (let i = 0; i < alvo.length; i++) {
    if (tentativa[i] === alvo[i]) {
      resultado[i] = 'certo';
    } else {
      sobrando[alvo[i]] = (sobrando[alvo[i]] || 0) + 1;
    }
  }

  for (let i = 0; i < alvo.length; i++) {
    if (resultado[i] === 'certo') continue;
    const letra = tentativa[i];
    if (sobrando[letra] > 0) {
      resultado[i] = 'presente';
      sobrando[letra]--;
    }
  }

  return resultado;
}

// Em que tentativa o tabuleiro foi resolvido (-1 = ainda não foi)
function indiceResolucao(b) {
  return jogo.tentativas.indexOf(ALVOS[b]);
}

function tabuleiroResolvido(b) {
  return indiceResolucao(b) !== -1;
}

function todosResolvidos() {
  return ALVOS.every((_, b) => tabuleiroResolvido(b));
}

// Quantas linhas o tabuleiro b ainda mostra: depois de acertado, ele
// congela e não recebe as tentativas seguintes.
function linhasVisiveis(b) {
  const fim = indiceResolucao(b);
  return fim === -1 ? jogo.tentativas.length : fim + 1;
}

// ------------------------------------------------------------
// Desenhar os tabuleiros
// ------------------------------------------------------------
// Clicar/tocar numa célula da linha que ainda está sendo digitada move o
// cursor pra ali — só faz sentido no tabuleiro que ainda não travou
// (no dueto, um lado pode já ter sido resolvido antes do outro).
function selecionarCelula(b, linha, col) {
  if (travado) return;
  if (linha !== jogo.tentativas.length) return;
  if (tabuleiroResolvido(b)) return;
  cursor = col;
  pintarTabuleiros(false);
}

function montarTabuleiros() {
  elTabuleiros.innerHTML = '';
  elTabuleiros.classList.toggle('dueto', EH_DUETO);

  ALVOS.forEach((_, b) => {
    const grade = document.createElement('div');
    grade.className = 'grade';
    grade.dataset.tabuleiro = String(b);
    grade.style.setProperty('--colunas', TAMANHO);

    for (let linha = 0; linha < MAX_TENTATIVAS; linha++) {
      const elLinha = document.createElement('div');
      elLinha.className = 'linha';
      for (let col = 0; col < TAMANHO; col++) {
        const cel = document.createElement('div');
        cel.className = 'cel';
        cel.addEventListener('click', () => selecionarCelula(b, linha, col));
        elLinha.appendChild(cel);
      }
      grade.appendChild(elLinha);
    }
    elTabuleiros.appendChild(grade);
  });
}

function pintarTabuleiros(animarUltima) {
  ALVOS.forEach((alvo, b) => {
    const grade = elTabuleiros.querySelector(`.grade[data-tabuleiro="${b}"]`);
    const linhas = grade.querySelectorAll('.linha');
    const visiveis = linhasVisiveis(b);
    const resolvido = tabuleiroResolvido(b);
    grade.classList.toggle('resolvido', resolvido);

    for (let i = 0; i < MAX_TENTATIVAS; i++) {
      const celulas = linhas[i].querySelectorAll('.cel');

      if (i < visiveis) {
        const tentativa = jogo.tentativas[i];
        const resultado = avaliar(tentativa, alvo);
        const ehUltima = animarUltima && i === visiveis - 1 && i === jogo.tentativas.length - 1;

        celulas.forEach((cel, j) => {
          // Quem digita não tem tecla de acento (o teclado só tem A-Z), então
          // "TERCO" acerta contra "TERÇO" na posição certa. Mas exibir o "C"
          // sem cedilha ensinaria a grafia errada — na posição CERTA, mostra
          // a letra de verdade, com acento, tirada da resposta original.
          cel.textContent = resultado[j] === 'certo' ? ENTRADAS[b].palavra[j] : tentativa[j];
          cel.classList.add('preenchida');
          cel.classList.remove('certo', 'presente', 'ausente', 'cel-cursor', 'cel-editavel');
          if (ehUltima && !PREFERE_MENOS_MOVIMENTO) {
            cel.style.animationDelay = (j * 0.18) + 's';
            cel.classList.add('virando');
            // a cor entra no meio do giro, quando a peça está "de lado"
            setTimeout(() => cel.classList.add(resultado[j]), j * 180 + 130);
          } else {
            cel.classList.add(resultado[j]);
          }
        });
      } else if (i === jogo.tentativas.length && !resolvido) {
        // linha que está sendo digitada agora: cada célula aceita clique
        // (por isso "cel-editavel" no cursor do mouse), e a do cursor
        // ganha destaque pra mostrar onde a próxima letra vai cair
        celulas.forEach((cel, j) => {
          cel.textContent = letras[j] || '';
          cel.classList.toggle('preenchida', Boolean(letras[j]));
          cel.classList.toggle('cel-cursor', j === cursor);
          cel.classList.add('cel-editavel');
          cel.classList.remove('certo', 'presente', 'ausente');
        });
      } else {
        celulas.forEach(cel => {
          cel.textContent = '';
          cel.classList.remove('preenchida', 'certo', 'presente', 'ausente', 'cel-cursor', 'cel-editavel');
        });
      }
    }
  });
}

// ------------------------------------------------------------
// Teclado na tela (essencial no celular, que é onde o grupo vive)
// ------------------------------------------------------------
const LINHAS_TECLADO = [
  ['Q','W','E','R','T','Y','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L'],
  ['APAGAR','Z','X','C','V','B','N','M','ENTER'],
];

function montarTeclado() {
  elTeclado.innerHTML = '';
  LINHAS_TECLADO.forEach(linha => {
    const elLinha = document.createElement('div');
    elLinha.className = 'teclado-linha';

    linha.forEach(tecla => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tecla';
      btn.dataset.tecla = tecla;

      if (tecla === 'ENTER') {
        btn.classList.add('tecla-larga');
        btn.textContent = 'Enviar';
        btn.setAttribute('aria-label', 'Enviar palavra');
      } else if (tecla === 'APAGAR') {
        btn.classList.add('tecla-larga');
        btn.textContent = '⌫';
        btn.setAttribute('aria-label', 'Apagar letra');
      } else {
        btn.textContent = tecla;
      }

      // Impede o botão de ficar com o foco ao ser clicado com o mouse.
      // Sem isso, o Enter do teclado físico faz DUAS coisas: envia a
      // palavra (pelo listener do documento) e "re-clica" o último botão
      // focado — digitando aquela letra de novo na linha seguinte.
      btn.addEventListener('mousedown', (e) => e.preventDefault());
      btn.addEventListener('click', () => aoPressionar(tecla));
      elLinha.appendChild(btn);
    });
    elTeclado.appendChild(elLinha);
  });
}

// Cada tecla mostra o melhor resultado já obtido com aquela letra:
// verde ganha de amarelo, que ganha de cinza.
const PRIORIDADE = { ausente: 1, presente: 2, certo: 3 };
const COR = { certo: '#2f8f4e', presente: '#b8902a', ausente: '#222' };

function melhorPorLetra(b) {
  const melhor = {};
  const visiveis = linhasVisiveis(b);
  for (let i = 0; i < visiveis; i++) {
    const tentativa = jogo.tentativas[i];
    const resultado = avaliar(tentativa, ALVOS[b]);
    for (let j = 0; j < TAMANHO; j++) {
      const letra = tentativa[j];
      if (!melhor[letra] || PRIORIDADE[resultado[j]] > PRIORIDADE[melhor[letra]]) {
        melhor[letra] = resultado[j];
      }
    }
  }
  return melhor;
}

function pintarTeclado() {
  // No dueto cada tabuleiro tem o seu próprio estado por letra, então a
  // tecla é dividida ao meio: metade esquerda = tabuleiro 1, direita = 2.
  const porTabuleiro = ALVOS.map((_, b) => melhorPorLetra(b));

  elTeclado.querySelectorAll('.tecla').forEach(btn => {
    const letra = btn.dataset.tecla;
    btn.classList.remove('certo', 'presente', 'ausente', 'tecla-dupla');
    btn.style.removeProperty('--cor-a');
    btn.style.removeProperty('--cor-b');

    if (!/^[A-Z]$/.test(letra)) return;

    if (!EH_DUETO) {
      const estado = porTabuleiro[0][letra];
      if (estado) btn.classList.add(estado);
      return;
    }

    const a = porTabuleiro[0][letra];
    const b = porTabuleiro[1][letra];
    if (!a && !b) return;

    if (a === b) {
      btn.classList.add(a);
    } else {
      btn.classList.add('tecla-dupla');
      btn.style.setProperty('--cor-a', a ? COR[a] : '#3f3f3f');
      btn.style.setProperty('--cor-b', b ? COR[b] : '#3f3f3f');
    }
  });
}

// ------------------------------------------------------------
// Avisos curtos
// ------------------------------------------------------------
let timerAviso;
function avisar(texto) {
  elAviso.textContent = texto;
  elAviso.classList.add('visivel');
  clearTimeout(timerAviso);
  timerAviso = setTimeout(() => elAviso.classList.remove('visivel'), 2200);
}

function sacudirLinha() {
  if (PREFERE_MENOS_MOVIMENTO) return;
  elTabuleiros.querySelectorAll('.grade').forEach((grade, b) => {
    if (tabuleiroResolvido(b)) return;
    const linha = grade.querySelectorAll('.linha')[jogo.tentativas.length];
    if (!linha) return;
    linha.classList.remove('sacudir');
    void linha.offsetWidth; // reinicia a animação
    linha.classList.add('sacudir');
  });
}

// ------------------------------------------------------------
// Entrada de teclas
// ------------------------------------------------------------
function aoPressionar(tecla) {
  if (travado) return;

  if (tecla === 'ENTER') { enviar(); return; }
  if (tecla === 'APAGAR') {
    // Se a célula do cursor já tem letra, só apaga ela (backspace "no
    // lugar"). Se já estava vazia, volta uma casa e apaga a de lá — é o
    // comportamento que qualquer um já espera de um campo de texto.
    if (letras[cursor]) {
      letras[cursor] = '';
    } else if (cursor > 0) {
      cursor -= 1;
      letras[cursor] = '';
    }
    pintarTabuleiros(false);
    return;
  }
  if (/^[A-Z]$/.test(tecla)) {
    // O cronômetro começa na PRIMEIRA letra, não ao abrir a página: senão
    // quem deixa a aba aberta e volta depois aparece com um tempo absurdo.
    // Testa com "!" e não "=== null" porque jogo salvo antes desta versão
    // não tem o campo — aí vale começar a contar a partir de agora.
    if (!jogo.inicio) {
      jogo.inicio = Date.now();
      gravarJSON(CHAVE_JOGO, jogo);
    }
    letras[cursor] = tecla;
    // Anda pro próximo quadrado, sem passar do último — clicar em algum
    // quadrado específico antes de digitar só muda de onde essa andada
    // começa, não muda a regra.
    cursor = Math.min(cursor + 1, TAMANHO - 1);
    pintarTabuleiros(false);
  }
}

function enviar() {
  if (letras.some(letra => !letra)) {
    // Concorda com o modo: uma palavra no termo, duas no dueto. Pega tanto
    // quem não terminou de digitar quanto quem clicou num quadrado do meio
    // e pulou uma célula sem querer.
    avisar(EH_DUETO
      ? `Faltam letras — as palavras de hoje têm ${TAMANHO} letras.`
      : `Faltam letras — a palavra de hoje tem ${TAMANHO} letras.`);
    sacudirLinha();
    return;
  }

  const tentativa = letras.join('');

  // Só vale chutar palavra que existe. Enquanto o dicionário do português
  // não chega, vale qualquer coisa — é melhor deixar jogar do que travar a
  // pessoa por causa de um download lento.
  if (dicionarioCarregado && !ACEITAS.has(tentativa)) {
    avisar('Essa palavra não existe.');
    sacudirLinha();
    return;
  }

  jogo.tentativas.push(tentativa);
  letras = Array(TAMANHO).fill('');
  cursor = 0;

  if (todosResolvidos()) {
    jogo.estado = 'ganhou';
  } else if (jogo.tentativas.length >= MAX_TENTATIVAS) {
    jogo.estado = 'perdeu';
  }

  if (jogo.estado !== 'jogando' && !jogo.duracaoMs) {
    jogo.duracaoMs = jogo.inicio ? Date.now() - jogo.inicio : null;
  }

  gravarJSON(CHAVE_JOGO, jogo);
  pintarTabuleiros(true);
  pintarTeclado();

  if (jogo.estado !== 'jogando') {
    travado = true;
    registrarEstatisticas();
    const espera = PREFERE_MENOS_MOVIMENTO ? 200 : TAMANHO * 180 + 500;
    setTimeout(() => mostrarFim(false), espera);
  }
}

document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  // Se o foco está numa tecla da tela (quem navega por Tab), deixa o
  // próprio botão agir — senão o Enter contaria duas vezes.
  if (e.target && e.target.classList && e.target.classList.contains('tecla')) return;

  if (e.key === 'Enter') { aoPressionar('ENTER'); return; }
  if (e.key === 'Backspace') { aoPressionar('APAGAR'); return; }

  // aceita letra com acento digitada por engano (Á vira A)
  const letra = semAcento(e.key);
  if (letra.length === 1 && /^[A-Z]$/.test(letra)) aoPressionar(letra);
});

// ------------------------------------------------------------
// Estatísticas
// ------------------------------------------------------------
function registrarEstatisticas() {
  if (stats.ultimoDia === DIA_HOJE) return; // já contou hoje

  const ganhou = jogo.estado === 'ganhou';
  stats.jogos += 1;

  if (ganhou) {
    stats.vitorias += 1;
    const ontem = new Date(agora);
    ontem.setDate(ontem.getDate() - 1);
    stats.sequencia = (stats.ultimoDia === chaveDoDia(ontem)) ? stats.sequencia + 1 : 1;
    stats.melhorSequencia = Math.max(stats.melhorSequencia, stats.sequencia);
  } else {
    stats.sequencia = 0;
  }

  stats.ultimoDia = DIA_HOJE;
  gravarJSON(CHAVE_ESTATISTICAS, stats);
}

function mostrarEstatisticas() {
  if (!elStats) return;
  const pct = stats.jogos ? Math.round((stats.vitorias / stats.jogos) * 100) : 0;
  elStats.innerHTML = '';

  [
    ['Jogos', stats.jogos],
    ['Vitórias', pct + '%'],
    ['Sequência', stats.sequencia],
    ['Melhor', stats.melhorSequencia],
  ].forEach(([rotulo, valor]) => {
    const item = document.createElement('div');
    item.className = 'stat';
    const n = document.createElement('span');
    n.className = 'stat-num';
    n.textContent = String(valor);
    const r = document.createElement('span');
    r.className = 'stat-rotulo';
    r.textContent = rotulo;
    item.append(n, r);
    elStats.appendChild(item);
  });
}

// ------------------------------------------------------------
// Fim de jogo: resultado + significado das palavras
// ------------------------------------------------------------
const ELOGIOS = ['Na primeira!', 'Muito bem!', 'Boa!', 'Essa foi por pouco...', 'Ufa!', 'No último suspiro!', 'No limite!'];

function formatarTempo(ms) {
  if (!ms || ms < 0) return null;
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}min${String(s % 60).padStart(2, '0')}`;
}

// restaurado = a partida já estava terminada quando a página abriu (recarregou
// ou voltou depois). Muda o comportamento do ranking: quem só voltou pra ver o
// resultado não leva um modal na cara pedindo nome.
function mostrarFim(restaurado) {
  const ganhou = jogo.estado === 'ganhou';
  elFimTitulo.textContent = ganhou
    ? (ELOGIOS[jogo.tentativas.length - 1] || 'Conseguiu!')
    : 'Fica pra próxima';

  elFimPalavras.innerHTML = '';
  ENTRADAS.forEach(entrada => {
    const bloco = document.createElement('div');
    bloco.className = 'fim-bloco';

    const p = document.createElement('p');
    p.className = 'fim-palavra';
    p.textContent = entrada.palavra.toUpperCase();

    const s = document.createElement('p');
    s.className = 'fim-significado';
    s.textContent = entrada.significado;

    bloco.append(p, s);
    elFimPalavras.appendChild(bloco);
  });

  const tempo = formatarTempo(jogo.duracaoMs);
  if (tempo) {
    const p = document.createElement('p');
    p.className = 'fim-tempo';
    p.textContent = ganhou ? `Seu tempo: ${tempo}` : `Tempo: ${tempo}`;
    elFimPalavras.appendChild(p);
  }

  elFim.hidden = false;
  mostrarEstatisticas();
  elFim.scrollIntoView({ behavior: PREFERE_MENOS_MOVIMENTO ? 'auto' : 'smooth', block: 'nearest' });

  // O ranking vive em ranking.js (módulo separado, porque usa Firebase e
  // este arquivo é script clássico). Ele escuta este evento — se não
  // carregar, ou se o Firebase cair, o jogo em si não sente nada.
  const detalhe = {
    dia: DIA_HOJE,
    modo: EH_DUETO ? 'dueto' : 'termo',
    venceu: ganhou,
    tentativas: jogo.tentativas.length,
    maxTentativas: MAX_TENTATIVAS,
    // partida salva antes do cronômetro existir não tem duração nenhuma:
    // vira null de propósito, e não undefined, que o Firestore recusa
    duracaoMs: jogo.duracaoMs || null,
    restaurado: !!restaurado,
  };

  // O evento sozinho não basta: este arquivo é script clássico com defer e o
  // ranking.js é módulo, então na hora que a página abre com uma partida já
  // terminada este dispatch acontece ANTES do ranking existir pra escutar.
  // Por isso o resultado também fica pendurado aqui, e o ranking lê quando
  // subir. Assim funciona nas duas ordens, sem depender de quem carrega antes.
  document.__ejacFim = detalhe;
  document.dispatchEvent(new CustomEvent('ejac:fim', { detail: detalhe }));
}

// ------------------------------------------------------------
// Compartilhar — é o que faz o jogo circular no grupo do WhatsApp
// ------------------------------------------------------------
const EMOJI = { certo: '🟩', presente: '🟨', ausente: '⬛' };

function montarTextoCompartilhar() {
  const placar = jogo.estado === 'ganhou'
    ? `${jogo.tentativas.length}/${MAX_TENTATIVAS}`
    : `X/${MAX_TENTATIVAS}`;
  const [, m, d] = DIA_HOJE.split('-');
  const nome = EH_DUETO ? 'Dueto EJAC' : 'Termo EJAC';

  // No dueto os dois tabuleiros vão lado a lado, separados por um espaço,
  // igual ao term.ooo — assim cabe na mensagem sem virar um textão.
  const linhas = [];
  for (let i = 0; i < jogo.tentativas.length; i++) {
    const partes = ALVOS.map((alvo, b) => {
      if (i >= linhasVisiveis(b)) return '⬜'.repeat(TAMANHO);
      return avaliar(jogo.tentativas[i], alvo).map(r => EMOJI[r]).join('');
    });
    linhas.push(partes.join(' '));
  }

  const tempo = formatarTempo(jogo.duracaoMs);

  return [
    `${nome} ${d}/${m} - ${placar}${tempo ? ' em ' + tempo : ''}`,
    '',
    linhas.join('\n'),
    '',
    `https://grupoejac.com.br/termo/${EH_DUETO ? '?modo=dueto' : ''}`,
  ].join('\n');
}

if (elBtnCompartilhar) {
  elBtnCompartilhar.addEventListener('click', async () => {
    const texto = montarTextoCompartilhar();

    // No celular abre o menu nativo (WhatsApp direto). No desktop, copia.
    // "navigator.share existe" não basta pra saber isso: Windows/Chromium
    // hoje tem a API no PC também, só que aí ela abre o painel de
    // compartilhamento do próprio Windows (sem opção de copiar o texto)
    // em vez de simplesmente copiar — por isso confere se é uma tela de
    // toque (celular/tablet de verdade), não só se a API existe.
    const ehTelaDeToque = matchMedia('(pointer: coarse)').matches;
    if (ehTelaDeToque && navigator.share) {
      try {
        await navigator.share({ text: texto });
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return; // a pessoa fechou o menu
      }
    }

    try {
      await navigator.clipboard.writeText(texto);
    } catch (e) {
      const temp = document.createElement('textarea');
      temp.value = texto;
      document.body.appendChild(temp);
      temp.select();
      document.execCommand('copy');
      document.body.removeChild(temp);
    }

    const original = elBtnCompartilhar.textContent;
    elBtnCompartilhar.textContent = 'Copiado!';
    setTimeout(() => { elBtnCompartilhar.textContent = original; }, 2000);
  });
}

// ------------------------------------------------------------
// Dicionário do português
// ------------------------------------------------------------
function carregarDicionario() {
  fetch(`dicionario/${TAMANHO}.txt`)
    .then(resposta => {
      if (!resposta.ok) throw new Error('HTTP ' + resposta.status);
      return resposta.text();
    })
    .then(texto => {
      let n = 0;
      for (const linha of texto.split('\n')) {
        const p = linha.trim();
        if (p) { ACEITAS.add(p); n++; }
      }
      if (n > 0) dicionarioCarregado = true;
    })
    .catch(() => {
      // Sem dicionário: segue valendo qualquer palavra, em vez de recusar
      // chutes legítimos por engano.
      dicionarioCarregado = false;
    });
}

// ------------------------------------------------------------
// Início
// ------------------------------------------------------------
if (elTitulo && EH_DUETO) elTitulo.textContent = 'Dueto';
document.title = EH_DUETO
  ? 'EJAC - Dueto: duas palavras católicas por dia'
  : 'EJAC - Termo: a palavra católica do dia';

// O texto padrão da página fala em 6 tentativas (o modo termo). No dueto
// são 7, então corrige aqui em vez de deixar a página mentindo.
const elSub = document.getElementById('jogo-sub');
if (elSub && EH_DUETO) {
  elSub.textContent = `Adivinhe as duas palavras do dia em ${MAX_TENTATIVAS} tentativas. São sempre palavras da nossa fé.`;
}

if (elTamanhoDica) {
  elTamanhoDica.textContent = EH_DUETO
    ? `2 palavras de ${TAMANHO} letras, ${MAX_TENTATIVAS} tentativas`
    : `${TAMANHO} letras`;
}

// marca qual modo está ativo na barra de modos
document.querySelectorAll('[data-modo]').forEach(link => {
  const ativo = (link.dataset.modo === 'dueto') === EH_DUETO;
  link.classList.toggle('modo-ativo', ativo);
  if (ativo) link.setAttribute('aria-current', 'page');
  else link.removeAttribute('aria-current');
});

carregarDicionario();
montarTabuleiros();
montarTeclado();
pintarTabuleiros(false);
pintarTeclado();
mostrarEstatisticas();

// Quem recarrega a página depois de já ter terminado vê o resultado de novo
if (travado) mostrarFim(true);

})();
