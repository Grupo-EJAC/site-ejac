# Site EJAC — Pedido de Camiseta

Site de página única para os membros do EJAC (Esperança Jovem Aliada a Cristo) pedirem a camiseta oficial. Sem servidor, sem banco de dados — 100% gratuito, hospedado no GitHub Pages, com os pedidos caindo direto numa planilha do Google.

## Arquivos

- `index.html` — o site inteiro (HTML + CSS + JS num arquivo só, fácil de mexer)
- `Code.gs` — o "backend": um script do Google que recebe o formulário e grava na planilha
- `README.md` — este guia

## Passo 1 — Criar a planilha que vai receber os pedidos

1. Acesse [sheets.google.com](https://sheets.google.com) e crie uma planilha nova (pode chamar de "Pedidos Camiseta EJAC")
2. Copie o **ID da planilha** — é o trecho da URL entre `/d/` e `/edit`:
   `https://docs.google.com/spreadsheets/d/`**`ESSE-TRECHO-AQUI`**`/edit`
3. No menu, clique em **Extensões → Apps Script**
4. Apague o código de exemplo que aparece e cole todo o conteúdo do arquivo `Code.gs` deste projeto
5. Troque `'COLE_AQUI_O_ID_DA_PLANILHA'` (logo no topo do arquivo) pelo ID que você copiou no passo 2
6. Clique no ícone de salvar (💾)
7. Clique em **Implantar → Nova implantação**
8. Clique na engrenagem ⚙️ ao lado de "Selecionar tipo" e escolha **App da Web**
9. Configure assim:
   - **Executar como:** Eu (seu e-mail)
   - **Quem pode acessar:** Qualquer pessoa
10. Clique em **Implantar**
11. Na primeira vez, o Google vai pedir autorização — clique em **Autorizar acesso**, escolha sua conta, e se aparecer um aviso de "app não verificado", clique em **Acessar (nome do projeto) (não seguro)** → **Continuar** (é seguro, é o seu próprio script)
12. Copie a **URL do app da Web** que aparece (algo como `https://script.google.com/macros/s/AKfycb.../exec`)

## Passo 2 — Conectar o site à planilha

1. Abra o `index.html`
2. Procure esta linha perto do final do arquivo (dentro da tag `<script>`):
   ```js
   const SHEET_SCRIPT_URL = "COLE_AQUI_A_URL_DO_SEU_APPS_SCRIPT";
   ```
3. Troque `"COLE_AQUI_A_URL_DO_SEU_APPS_SCRIPT"` pela URL que você copiou no passo anterior
4. Salve o arquivo

Pronto — os pedidos feitos no site vão aparecer como novas linhas na aba **Pedidos** da sua planilha, já organizados por Data, Nome completo, Nome na camisa, Número na camisa e Tamanho.

> **Nota:** se você alterar o `Code.gs` depois de já ter implantado, é preciso ir em **Implantar → Gerenciar implantações → editar (ícone de lápis) → Nova versão → Implantar** para a mudança valer.

## Passo 3 — Colocar a arte real da camiseta

O site já vem com uma ilustração provisória (frente e verso) da camiseta, com um botão para alternar entre as duas visões. Quando vocês tiverem a foto real:

1. Salve as fotos como `camisa-frente.png` e `camisa-verso.png` numa pasta `assets/` ao lado do `index.html`
2. No `index.html`, dentro de cada `<div class="shirt-view">`, troque o bloco `<svg>...</svg>` por:
   ```html
   <img src="assets/camisa-frente.png" alt="Camiseta EJAC - frente" class="shirt-svg">
   ```
   (e o equivalente `camisa-verso.png` na outra `<div>`)
3. Pode apagar também o parágrafo "Arte provisória..." logo abaixo

## Passo 4 — Publicar no GitHub Pages (grátis)

1. Crie uma conta no [github.com](https://github.com) se ainda não tiver
2. Clique em **New repository**, dê um nome (ex: `site-ejac`) e crie
3. Na página do repositório, clique em **Add file → Upload files**
4. Arraste o `index.html` (e a pasta `assets/`, se já tiver as fotos da camisa) para lá e clique em **Commit changes**
5. Vá em **Settings → Pages**
6. Em "Branch", selecione `main` e a pasta `/root`, depois clique em **Save**
7. Espere 1–2 minutos e atualize a página — vai aparecer o link do site (algo como `https://seu-usuario.github.io/site-ejac/`)

Esse é o link que vocês vão divulicar pro grupo pedir a camiseta.

## Paleta de cores oficial

| Cor | Hex |
|---|---|
| Preto | `#000001` |
| Rosa | `#E97ACA` |
| Laranja | `#C14D13` |
| Branco | `#FFFFFF` |
| Cinza | `#545454` |

Todas centralizadas no topo do `<style>` do `index.html`, dentro de `:root`, caso precise ajustar algum tom.

## Fontes

O kit de marca pede TAN Meringue, High Cruiser, Heading Now e Gabriel Sans — são fontes pagas, não licenciadas para uso web público, então o site usa substitutas gratuitas do Google Fonts com a mesma personalidade (bold, gráfica, street): **Unbounded** (títulos), **Plus Jakarta Sans** (texto) e **Permanent Marker** (efeito de rabisco à mão). Se a licença web das fontes originais for comprada depois, é só trocar os `font-family` no `<style>` e importar os arquivos `.woff2`.
