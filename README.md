# Site EJAC — Pedido de Camiseta

Site de página única para os membros do EJAC (Esperança Jovem Aliada a Cristo) pedirem a camiseta oficial. Sem servidor, sem banco de dados — 100% gratuito, hospedado no GitHub Pages, com os pedidos caindo direto numa planilha do Google.

## Arquivos

| Arquivo | O que é |
|---|---|
| `index.html` | A página: só o conteúdo (nenhum CSS ou JS embutido) |
| `styles.css` | Todo o visual. **As cores ficam no `:root`, no topo** — mexa só ali pra mudar a identidade |
| `app.js` | A lógica: prévia ao vivo, copiar Pix, validação e envio do formulário |
| `Code.gs` | O "backend": script do Google que recebe o formulário e grava na planilha |
| `favicon.svg` | Ícone da aba, baseado no logo do EJAC |
| `assets/` | Fotos da camiseta (fundo removido) e a fonte da estampa |

> **Por que CSS e JS ficam fora do HTML:** além de organizar, isso permite uma
> política de segurança (CSP) que bloqueia *qualquer* script ou estilo injetado
> na página. Se voltar a escrever `<style>` ou `<script>` direto no HTML, o
> navegador vai bloquear — é proposital.

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

1. Abra o `app.js`
2. Procure esta linha no topo do arquivo:
   ```js
   const SHEET_SCRIPT_URL = "COLE_AQUI_A_URL_DO_SEU_APPS_SCRIPT";
   ```
3. Troque `"COLE_AQUI_A_URL_DO_SEU_APPS_SCRIPT"` pela URL que você copiou no passo anterior
4. Salve o arquivo

Pronto — os pedidos feitos no site vão aparecer como novas linhas na aba **Pedidos** da sua planilha, já organizados por Data, Nome completo, Nome na camisa, Número na camisa, Tamanho, IP e WhatsApp.

> **Nota importante:** sempre que alterar o `Code.gs` depois de já ter implantado, é preciso ir em **Implantar → Gerenciar implantações → editar (ícone de lápis) → Nova versão → Implantar** para a mudança valer. A URL do app **não muda**.

## Segurança

O site é estático (sem servidor nosso, sem senha, sem login), então a superfície de ataque é pequena. Mesmo assim, ele tem várias camadas de proteção:

- **Anti-injeção de fórmula (o mais importante):** se alguém digitar algo como `=IMPORTXML(...)` num campo, o `Code.gs` prefixa com um apóstrofo antes de gravar, então o Google Sheets trata como **texto** e nunca executa a fórmula. Isso protege quem abre a planilha.
- **Validação dupla:** os campos são validados no navegador (`app.js`) **e** de novo no servidor (`Code.gs`) — presença, tamanho máximo e lista fixa de tamanhos (P/M/G/...). Payload grande ou lixo é rejeitado.
- **Honeypot anti-bot:** um campo invisível (`website`) que humanos não veem; se vier preenchido, o envio é descartado (bots costumam preencher tudo).
- **Content-Security-Policy sem `unsafe-inline`:** a CSP nega tudo por padrão e libera só o essencial. Como nenhum CSS ou JS fica embutido no HTML, o navegador **bloqueia qualquer script ou estilo injetado** na página — a defesa mais forte contra XSS. Também bloqueia envio de formulário pra fora (`form-action 'none'`) e o site ser colocado dentro de um iframe (`frame-ancestors 'none'`, evita clickjacking).
- **`referrer: no-referrer`:** ao clicar num link externo (WhatsApp), o destino não recebe de onde a pessoa veio.
- **Links externos com `noopener noreferrer`:** a página aberta não ganha acesso à nossa via `window.opener`.
- **Registro de IP:** junto com cada pedido é gravado o IP de quem enviou (coluna `IP` da planilha), pra dar rastreabilidade em caso de pedido falso. O IP é obtido pelo navegador de quem envia, via `api.ipify.org` — ou seja, dá pra forjar num envio direto ao endpoint, então serve como indício, não como prova. Se a busca falhar, o pedido é gravado normalmente sem IP. Há um aviso discreto embaixo do botão de envio informando o registro, como manda o princípio de transparência da LGPD.
- **Sem segredos no repositório:** a URL do Apps Script, a chave Pix e os telefones são públicos por natureza (precisam ser). O acesso à planilha continua protegido pela sua conta Google, não pela URL. Arte original e PDFs de marca ficam no `.gitignore`.

**Limite honesto:** por ser um endpoint público e gratuito (sem captcha, pra não criar atrito), não dá pra impedir 100% um atacante determinado de enviar vários pedidos falsos manualmente. O honeypot + validação barram os bots comuns, que são a esmagadora maioria. Se algum dia isso virar problema, dá pra adicionar um captcha ou exigir login do Google.

## Acessibilidade

O site foi feito pra funcionar pra todo mundo, inclusive quem navega só pelo teclado ou usa leitor de tela:

- Anel de foco visível em todos os links, botões e campos (`:focus-visible`)
- Atalho "pular para o formulário" que aparece ao apertar Tab
- Contraste de texto dentro do WCAG AA (o cinza secundário é 7.4:1 no fundo preto)
- A prévia da camiseta é visual, então uma legenda em texto anuncia nome e número pra leitores de tela
- Todas as animações (faíscas, brasas, confete) desligam sozinhas se a pessoa tiver "reduzir movimento" ativado no sistema

## Passo 3 — Publicar no GitHub Pages (grátis)

1. Crie uma conta no [github.com](https://github.com) se ainda não tiver
2. Clique em **New repository**, dê um nome (ex: `site-ejac`) e crie
3. Na página do repositório, clique em **Add file → Upload files**
4. Arraste `index.html`, `styles.css`, `app.js`, `favicon.svg` e a pasta `assets/` para lá e clique em **Commit changes**
5. Vá em **Settings → Pages**
6. Em "Branch", selecione `main` e a pasta `/root`, depois clique em **Save**
7. Espere 1–2 minutos e atualize a página — vai aparecer o link do site (algo como `https://seu-usuario.github.io/site-ejac/`)

Esse é o link que vocês vão divulicar pro grupo pedir a camiseta.

## Paleta de cores oficial

| Cor | Hex |
|---|---|
| Preto | `#000001` |
| Rosa | `#E4568F` |
| Laranja | `#C14D13` |
| Branco | `#FFFFFF` |
| Cinza | `#545454` |

Todas centralizadas no topo do `<style>` do `index.html`, dentro de `:root`, caso precise ajustar algum tom. O rosa foi calibrado pra bater com a cor real da camiseta (amostrado direto da foto oficial), mais vibrante que o tom pastel do kit de marca original.

## Fontes

O kit de marca pede TAN Meringue, High Cruiser, Heading Now e Gabriel Sans — são fontes pagas, não licenciadas para uso web público, então o site usa substitutas gratuitas do Google Fonts com a mesma personalidade (bold, gráfica, street): **Unbounded** (títulos), **Plus Jakarta Sans** (texto) e **Permanent Marker** (efeito de rabisco à mão). Se a licença web das fontes originais for comprada depois, é só trocar os `font-family` no `<style>` e importar os arquivos `.woff2`.
