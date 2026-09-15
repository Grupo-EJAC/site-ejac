# Dicionário de português — de onde veio e como foi feito

Estes arquivos existem para o jogo aceitar **qualquer palavra do português**
como tentativa, e não só o vocabulário da Igreja.

## Origem e licença

São **três listas fundidas**. A primeira sozinha não bastou: ela não tinha
palavras comuníssimas como *sonho* e *susto*, e quem jogasse levaria um
"essa palavra não existe" injusto.

| Fonte | O que traz | Licença |
|---|---|---|
| [pythonprobr/palavras](https://github.com/pythonprobr/palavras) | 320.139 palavras, do corretor do LibreOffice | MPL-2.0 (`LICENSE-MPL-2.0-palavras.txt`) |
| [fserb/pt-br](https://github.com/fserb/pt-br) — `lexico` | 145.744 entradas lexicais | MIT (`LICENSE-MIT-pt-br.txt`) |
| [fserb/pt-br](https://github.com/fserb/pt-br) — `conjugações` | 195.751 formas verbais | MIT (`LICENSE-MIT-pt-br.txt`) |

A MPL-2.0 é *copyleft por arquivo*: os arquivos desta pasta continuam sob ela,
mas **isso não afeta o resto do site** — o código do EJAC segue independente.
É por isso que tudo isto fica numa pasta separada, com as duas licenças junto.

## Como foram gerados

As três listas foram processadas de uma vez só para:

1. **Tirar os acentos** (`Ç` vira `C`, `Á` vira `A`) — quem joga digita sem acento
2. **Deixar tudo em maiúsculas**
3. **Descartar o que não é palavra simples** — nada de hífen, apóstrofo, ponto ou número
4. **Filtrar de 4 a 10 letras** — o limite que o tabuleiro comporta (a 10
   letras a peça fica com 29px numa tela de 375px: apertado, mas legível)
5. **Remover duplicatas** (as três listas se sobrepõem bastante) e ordenar
6. **Separar um arquivo por tamanho**, para a página baixar só o do dia

Resultado: **295.127 palavras**, de 661.634 linhas lidas.

| Arquivo | Palavras | Tamanho |
|---|---|---|
| `4.txt` | 4.700 | 28 KB |
| `5.txt` | 13.694 | 94 KB |
| `6.txt` | 27.700 | 216 KB |
| `7.txt` | 44.792 | 394 KB |
| `8.txt` | 61.253 | 598 KB |
| `9.txt` | 70.852 | 761 KB |
| `10.txt` | 72.136 | 845 KB |

**Por que um arquivo por tamanho:** a palavra do dia tem um tamanho só, então
não faz sentido baixar as 295 mil palavras. O jogo pega só o arquivo daquele
tamanho. O caso mais comum (5 letras) são 94 KB, que o GitHub Pages entrega
comprimido em torno de 30 KB. O pior caso (10 letras) são 845 KB, ou algo
perto de 250 KB comprimidos — pesado, mas cai uma vez só e fica em cache.

**A resposta do dia é sempre aceitável**, mesmo que não esteja nestas listas:
o `jogo.js` junta o banco curado de `../palavras.js` ao dicionário antes de
validar. Isso importa porque nenhuma lista tem tudo — `PROVERBIOS`, por
exemplo, está fora das três.

## Se precisar refazer

Baixar os três arquivos das fontes acima, normalizar em `FormD`, descartar os
caracteres da categoria `NonSpacingMark`, passar para maiúsculas, manter só o
que casa com `^[A-Z]{4,10}$`, juntar tudo num conjunto sem repetição e gravar
um arquivo por tamanho.

## Limite conhecido

A cobertura foi medida com 35 palavras comuns do dia a dia: passaram 34.
A que faltou foi *medos* (plural de medo). Ou seja, ainda podem escapar
plurais e formas menos usuais. Se alguém reclamar de uma palavra legítima
recusada, dá para acrescentá-la em `PALAVRAS_ACEITAS`, no `../palavras.js`.
