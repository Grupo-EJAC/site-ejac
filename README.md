# Site EJAC — Pedido de Camiseta e Cesta Básica

Site pros membros do EJAC (Esperança Jovem Aliada a Cristo) pedirem a camiseta oficial e colaborarem com a cesta básica do grupo. 100% gratuito, hospedado no GitHub Pages, sem servidor próprio — tudo (camiseta, cesta básica e o painel administrativo) grava direto num banco **Firestore (Firebase)**, com atualização em tempo real e sem planilha nenhuma.

## Arquivos

| Arquivo | O que é |
|---|---|
| `index.html` | A página principal: pedido de camiseta |
| `cesta.html` | Página separada da cesta básica colaborativa, acessível pelo botão "Cesta básica" no menu |
| `admin.html` | Painel administrativo (login Google) — relatório dos pedidos de camiseta e da cesta básica, com opção de excluir |
| `styles.css` | Todo o visual. **As cores ficam no `:root`, no topo** — mexa só ali pra mudar a identidade |
| `app.js` | Efeitos visuais e utilitários de UI compartilhados entre as páginas (prévia da camisa, copiar Pix, som, animação de campo inválido) |
| `camiseta-firebase.js` | Grava o pedido de camiseta no Firestore |
| `cesta-firebase.js` | Lê e grava as contribuições da cesta básica no Firestore, em tempo real |
| `admin-firebase.js` | Login Google, leitura dos dados (inclusive WhatsApp/IP) e exclusão de registros — só funciona pra e-mails autorizados |
| `firebase-config.js` | A configuração do projeto Firebase (um só lugar, compartilhado pelos três módulos acima) |
| `catalogos.js` | Listas de referência compartilhadas: itens da cesta básica (com meta de cada um) e tamanhos de camiseta válidos |
| `firestore.rules` | Regras de segurança do Firestore — cole no Firebase Console (veja o Passo B) |
| `favicon.svg` | Ícone da aba, baseado no logo do EJAC |
| `assets/` | Fotos da camiseta (fundo removido) e a fonte da estampa |

> **Por que CSS e JS ficam fora do HTML:** além de organizar, isso permite uma
> política de segurança (CSP) que bloqueia *qualquer* script ou estilo injetado
> na página. Se voltar a escrever `<style>` ou `<script>` direto no HTML, o
> navegador vai bloquear — é proposital.

## Como o site funciona (visão geral)

- **Camiseta** (`index.html`): formulário público, sem visibilidade nenhuma — só o painel admin lê os pedidos.
- **Cesta básica** (`cesta.html`): formulário público onde os membros escolhem um item de uma lista fixa e dizem quanto vão trazer (a quantidade toda ou só uma parte). **Nome, item e quantidade ficam visíveis na própria página** (foi um pedido do grupo, pra dar controle de quem já trouxe o quê), atualizando em tempo real pra quem estiver com a página aberta. WhatsApp e IP **nunca aparecem no site** — ficam numa coleção separada, só legível pelo painel admin.
- **Painel admin** (`admin.html`): login com conta Google. Só e-mails na lista `emailsAdmin()` do `firestore.rules` conseguem entrar — qualquer outra conta Google cai numa tela de "acesso não autorizado". De lá dá pra ver todos os pedidos de camiseta (com resumo por tamanho e exportar CSV), ver a cesta básica com WhatsApp/IP incluídos, e **excluir qualquer registro errado ou falso** direto pela interface, sem precisar abrir o Firebase Console.
- Não existe cota fixa por pessoa na cesta: qualquer um pode contribuir com qualquer item, em qualquer quantidade (até um teto de 3× a meta, só pra barrar erro de digitação). Se um item já estiver completo, a página avisa mas ainda deixa contribuir a mais.

## Passo A — Criar o projeto Firebase e o banco Firestore

1. Acesse [console.firebase.google.com](https://console.firebase.google.com) (usa a mesma conta Google de sempre) e clique em **Criar projeto**
2. Dê um nome (ex: `site-ejac`) e siga o assistente — pode **desativar o Google Analytics**, não precisa dele pra esse projeto
3. Dentro do projeto, no menu lateral, vá em **Compilação → Firestore Database** → **Criar banco de dados**
4. Escolha **Modo de produção** (não "modo de teste" — vamos colar nossas próprias regras já no Passo B) e a região **`southamerica-east1 (São Paulo)`** → **Ativar**

## Passo B — Ativar o login Google e definir quem é admin

1. No menu lateral, vá em **Compilação → Authentication** → **Vamos começar**
2. Na lista de provedores, clique em **Google** → ative o botão **Ativar** → escolha um e-mail de suporte (o seu mesmo) → **Salvar**
3. Abra o arquivo `firestore.rules` deste projeto e troque os e-mails de exemplo dentro da função `emailsAdmin()` pelos e-mails Gmail reais de quem vai coordenar (Diego, Jaque, Leandro, Lucas, etc. — um por linha, entre aspas)
4. Ainda no Firebase Console, vá em **Firestore Database → Regras**, apague o conteúdo padrão e cole todo o conteúdo (já com os e-mails trocados) do `firestore.rules` → **Publicar**

> Só quem estiver nessa lista consegue entrar no `admin.html`. Pra adicionar ou remover um coordenador depois, é só editar a lista e publicar as regras de novo — não precisa mexer em mais nada.

## Passo C — Conectar o site ao Firebase

1. No Firebase Console, clique no ícone de engrenagem ⚙️ (ao lado de "Visão geral do projeto") → **Configurações do projeto**
2. Em "Seus apps", clique no ícone **`</>`** (Web) pra registrar um app novo
3. Dê um apelido (ex: `site-ejac`) → **Registrar app** — não precisa marcar Firebase Hosting
4. Copie o objeto `firebaseConfig` que aparece (algo como `{ apiKey: "...", authDomain: "...", ... }`)
5. Abra o `firebase-config.js` deste projeto e troque os valores `'COLE_AQUI...'` pelos valores reais que você copiou — **é o único lugar que precisa dessa config**, os outros arquivos importam dali
6. Salve, faça commit e publique (Passo E, abaixo) — pronto, o site inteiro já fica em tempo real

> **Sobre a config não ser segredo:** ao contrário de uma senha, o `firebaseConfig` de um app web **é público por natureza** — ele só identifica o projeto, não dá acesso a nada sozinho. Quem protege os dados de verdade são as regras do Passo B. Por isso não tem problema esse objeto ficar no repositório.

## Passo D — Testar o painel admin

1. Publique o site (Passo E) ou abra localmente
2. Vá em `/admin.html` (tem um link discreto "Painel" no rodapé de todas as páginas) e clique em **Entrar com Google**
3. Entre com um e-mail que você colocou em `emailsAdmin()` — deve cair direto no painel
4. Teste com outra conta Google (uma pessoal, por exemplo) pra confirmar que aparece a tela de "acesso não autorizado"

Se a lista de itens da cesta ou de tamanhos mudar, atualize em **três lugares**: `catalogos.js` (usado pelos formulários e pelo painel), a função `metas()`/`tamanhosValidos()` no `firestore.rules` (regras do Firestore não conseguem importar arquivo externo), e as opções do `<select>` no `cesta.html`.

### Custo

O plano gratuito do Firestore (Spark) libera 50 mil leituras e 20 mil escritas por dia, e o login com Google no Firebase Auth também é gratuito — muito acima do que uma campanha de grupo como essa usa. Não precisa cadastrar cartão de crédito.

## Segurança

O site é estático (sem servidor nosso), então a superfície de ataque é pequena. Mesmo assim, tem várias camadas de proteção:

- **As regras do Firestore são a validação que vale de verdade** (`firestore.rules`): tamanho de campo, formato de WhatsApp, item/tamanho dentro da lista oficial, quantidade dentro do razoável. A validação no navegador (`camiseta-firebase.js`/`cesta-firebase.js`) é só "de cortesia", pra dar feedback rápido — um usuário malicioso pode pular ela inteira e mesmo assim esbarra nas regras do servidor.
- **Ninguém lê dado sensível sem estar autorizado:** os pedidos de camiseta (nome + WhatsApp) e o WhatsApp/IP da cesta só são legíveis por quem faz login Google **e** está na lista `emailsAdmin()` das regras. Ninguém mais consegue ler essas coleções, nem o próprio código do site — as regras barram no servidor, não é só uma questão de "a página não mostra".
- **Ninguém edita ou apaga nada, exceto o admin:** criar um pedido/contribuição é público (é o formulário), mas alterar ou excluir só é permitido pra quem está autenticado como admin. Isso é forçado pelas regras, não pela interface.
- **Honeypot anti-bot:** um campo invisível (`website`) que humanos não veem; se vier preenchido, o envio é descartado (bots costumam preencher tudo).
- **Content-Security-Policy sem `unsafe-inline`:** a CSP nega tudo por padrão e libera só o essencial (o próprio domínio, as fontes do Google, o SDK do Firebase via `gstatic.com`, e os endpoints do Firestore/Auth). Como nenhum CSS ou JS fica embutido no HTML, o navegador **bloqueia qualquer script ou estilo injetado** na página — a defesa mais forte contra XSS. Também bloqueia envio de formulário pra fora (`form-action 'none'`) e o site ser colocado dentro de um iframe (`frame-ancestors 'none'`, evita clickjacking).
- **`referrer: no-referrer`:** ao clicar num link externo (WhatsApp), o destino não recebe de onde a pessoa veio.
- **Links externos com `noopener noreferrer`:** a página aberta não ganha acesso à nossa via `window.opener`.
- **Registro de IP:** junto com cada pedido/contribuição é gravado o IP de quem enviou, pra dar rastreabilidade em caso de pedido falso. O IP é obtido pelo navegador via `api.ipify.org` — ou seja, dá pra forjar num envio direto ao Firestore, então serve como indício, não como prova. Se a busca falhar, o envio segue normalmente sem IP. Há um aviso discreto nos formulários informando o registro, como manda o princípio de transparência da LGPD.
- **`admin.html` tem `noindex, nofollow`:** não aparece em buscadores. Isso não é a proteção real (quem protege são as regras + login), é só pra não aparecer por acidente numa busca.
- **Sem segredos no repositório:** a config do Firebase, a chave Pix e os telefones são públicos por natureza (precisam ser). Arte original e PDFs de marca ficam no `.gitignore`.

**Limite honesto:** por ser um formulário público e gratuito (sem captcha, pra não criar atrito), não dá pra impedir 100% um atacante determinado de enviar vários pedidos falsos manualmente. O honeypot + validação barram os bots comuns, que são a esmagadora maioria — e agora, diferente da planilha, dá pra **excluir qualquer pedido falso em segundos pelo painel admin**.

## Acessibilidade

O site foi feito pra funcionar pra todo mundo, inclusive quem navega só pelo teclado ou usa leitor de tela:

- Anel de foco visível em todos os links, botões e campos (`:focus-visible`)
- Atalho "pular para o formulário" que aparece ao apertar Tab
- Contraste de texto dentro do WCAG AA (o cinza secundário é 7.4:1 no fundo preto)
- A prévia da camiseta é visual, então uma legenda em texto anuncia nome e número pra leitores de tela
- Todas as animações (faíscas, brasas, confete) desligam sozinhas se a pessoa tiver "reduzir movimento" ativado no sistema

## Passo E — Publicar no GitHub Pages (grátis)

1. Crie uma conta no [github.com](https://github.com) se ainda não tiver
2. Clique em **New repository**, dê um nome (ex: `site-ejac`) e crie
3. Na página do repositório, clique em **Add file → Upload files**
4. Arraste `index.html`, `cesta.html`, `admin.html`, `styles.css`, `app.js`, `camiseta-firebase.js`, `cesta-firebase.js`, `admin-firebase.js`, `firebase-config.js`, `catalogos.js`, `favicon.svg` e a pasta `assets/` para lá e clique em **Commit changes** (o `firestore.rules` não precisa subir pro GitHub Pages — ele só é usado dentro do Firebase Console, no Passo B)
5. Vá em **Settings → Pages**
6. Em "Branch", selecione `main` e a pasta `/root`, depois clique em **Save**
7. Espere 1–2 minutos e atualize a página — vai aparecer o link do site (algo como `https://seu-usuario.github.io/site-ejac/`)

Esse é o link que vocês vão divulgar pro grupo pedir a camiseta e colaborar com a cesta.

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
