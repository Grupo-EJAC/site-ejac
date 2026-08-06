# Site EJAC — Pedido de Camiseta, Cesta Básica e Mural

Site pros membros do EJAC (Esperança Jovem Aliada a Cristo) pedirem a camiseta oficial, colaborarem com a cesta básica do grupo e desenharem juntos no mural de neon. 100% gratuito, hospedado no GitHub Pages, sem servidor próprio — tudo (camiseta, cesta básica, mural e o painel administrativo) grava direto num banco **Firestore (Firebase)**, com atualização em tempo real; o mural também usa o **Realtime Database** pra mostrar ao vivo quem está desenhando agora. Os pedidos de camiseta também caem, em paralelo, numa planilha do Google (por pedido do grupo, como cópia/backup — o Firestore continua sendo a fonte usada pelo site e pelo painel).

## Arquivos

| Arquivo | O que é |
|---|---|
| `index.html` | A página principal: pedido de camiseta (`/`) |
| `cesta/index.html` | Página separada da cesta básica colaborativa (`/cesta/`), acessível pelo botão "Cesta básica" no menu |
| `admin/index.html` | Painel administrativo (`/admin/`, login Google) — relatório dos pedidos de camiseta e da cesta básica, com opção de excluir, e moderação do mural |
| `mural/index.html` | Página do mural de neon colaborativo (`/mural/`) — quadro de desenho ao vivo, acessível pelo botão "Mural de neon" no menu |
| `styles.css` | Todo o visual. **As cores ficam no `:root`, no topo** — mexa só ali pra mudar a identidade |
| `app.js` | Efeitos visuais e utilitários de UI compartilhados entre as páginas (prévia da camisa, copiar Pix, som, animação de campo inválido) |
| `camiseta-firebase.js` | Grava o pedido de camiseta no Firestore (principal) e também na planilha do Google, via `Code.gs` (cópia) |
| `Code.gs` | Script do Google que recebe a cópia dos pedidos de camiseta e grava na planilha — veja o Passo F |
| `cesta-firebase.js` | Lê e grava as contribuições da cesta básica no Firestore, em tempo real |
| `mural-firebase.js` | Desenho do mural: canvas local, sincronização dos traços via Firestore e cursores flutuantes ao vivo via Realtime Database |
| `admin-firebase.js` | Login Google, leitura dos dados (inclusive WhatsApp dos pedidos de camiseta e IP das duas coisas), exclusão de registros e "Limpar mural" — só funciona pra e-mails autorizados |
| `firebase-config.js` | A configuração do projeto Firebase (um só lugar, compartilhado por todos os módulos acima) |
| `catalogos.js` | Listas de referência compartilhadas: itens da cesta básica (com meta de cada um) e tamanhos de camiseta válidos |
| `firestore.rules` | Regras de segurança do Firestore — cole no Firebase Console (veja o Passo B) |
| `database.rules.json` | Regras de segurança do Realtime Database (presença de quem está desenhando no mural) — cole no Firebase Console (veja o Passo B) |
| `favicon.svg` | Ícone da aba, baseado no logo do EJAC |
| `assets/` | Fotos da camiseta (fundo removido), a fonte da estampa e o logo usado na prévia de compartilhamento |

> **Por que CSS e JS ficam fora do HTML:** além de organizar, isso permite uma
> política de segurança (CSP) que bloqueia *qualquer* script ou estilo injetado
> na página. Se voltar a escrever `<style>` ou `<script>` direto no HTML, o
> navegador vai bloquear — é proposital.

> **Por que `cesta`, `mural` e `admin` são pastas com `index.html` dentro, em vez de
> `cesta.html`/`mural.html`/`admin.html`:** assim a URL fica `/cesta/`, `/mural/` e `/admin/`, sem o
> `.html` aparecendo — GitHub Pages (como qualquer servidor estático) serve
> automaticamente o `index.html` de dentro de uma pasta quando alguém visita
> ela. Os links entre páginas usam caminho relativo (`../`, `../cesta/`
> etc.), então se mover algum arquivo de lugar, precisa ajustar esses
> caminhos nos quatro HTMLs.

## Como o site funciona (visão geral)

- **Camiseta** (`/`): formulário público, sem visibilidade nenhuma — só o painel admin lê os pedidos. Grava no Firestore (é o que o site/painel realmente usa) e manda uma cópia pra planilha do Google via `Code.gs`, como backup — se a planilha falhar por algum motivo, o pedido continua seguro no Firestore.
- **Cesta básica** (`/cesta/`): formulário público onde os membros escolhem um item de uma lista fixa e dizem quanto vão trazer (a quantidade toda ou só uma parte) — só pede nome, sem WhatsApp. **Nome, item e quantidade ficam visíveis na própria página** (foi um pedido do grupo, pra dar controle de quem já trouxe o quê), atualizando em tempo real pra quem estiver com a página aberta. O IP **nunca aparece no site** — fica numa coleção separada, só legível pelo painel admin.
- **Mural de neon** (`/mural/`): quadro de desenho coletivo, sem login nenhum — na primeira visita a pessoa escolhe um nome e uma cor (livre, qualquer uma) que ficam salvos no navegador dela, e já pode desenhar com o dedo ou o mouse. O brilho neon do traço vem do efeito de sombra do canvas, não da cor escolhida, então funciona bem com qualquer tom. O traço de todo mundo aparece ao vivo pra quem estiver na página, e enquanto alguém está desenhando, o nome dela flutua junto do traço em tempo real (isso usa o Realtime Database, feito pra esse tipo de dado que muda muito rápido; o traço final, quando a pessoa solta o dedo/mouse, é que fica salvo de verdade no Firestore). Por trás dos panos cada visitante recebe uma identidade anônima do Firebase Auth (sem pedir e-mail nem senha) só pra as regras saberem que quem está desenhando é sempre a mesma pessoa que soltou o traço.
- **Painel admin** (`/admin/`): login com conta Google. Só e-mails na lista `emailsAdmin()` do `firestore.rules` conseguem entrar — qualquer outra conta Google cai numa tela de "acesso não autorizado". De lá dá pra ver todos os pedidos de camiseta (com resumo por tamanho e exportar CSV), ver a cesta básica com IP incluído, **excluir qualquer registro errado ou falso** direto pela interface sem precisar abrir o Firebase Console, e limpar o mural inteiro se alguém desenhar algo impróprio (não dá pra apagar traço por traço, só tudo de uma vez).
- Não existe cota fixa por pessoa na cesta: qualquer um pode contribuir com qualquer item, em qualquer quantidade (até um teto de 3× a meta, só pra barrar erro de digitação). Se um item já estiver completo, a página avisa mas ainda deixa contribuir a mais.

## Passo A — Criar o projeto Firebase, o Firestore e o Realtime Database

1. Acesse [console.firebase.google.com](https://console.firebase.google.com) (usa a mesma conta Google de sempre) e clique em **Criar projeto**
2. Dê um nome (ex: `site-ejac`) e siga o assistente — pode **desativar o Google Analytics**, não precisa dele pra esse projeto
3. Dentro do projeto, no menu lateral, vá em **Compilação → Firestore Database** → **Criar banco de dados**
4. Escolha **Modo de produção** (não "modo de teste" — vamos colar nossas próprias regras já no Passo B) e a região **`southamerica-east1 (São Paulo)`** → **Ativar**
5. Ainda no menu lateral, vá em **Compilação → Realtime Database** → **Criar banco de dados** (esse é o banco que dá a parte "ao vivo" do mural — os cursores flutuantes enquanto alguém desenha) — a região vem fixa em `us-central1`, não tem opção de São Paulo aqui — e comece em **modo bloqueado** (vamos colar nossas próprias regras já no Passo B) → **Ativar**

## Passo B — Ativar o login e definir quem é admin

1. No menu lateral, vá em **Compilação → Authentication** → **Vamos começar**
2. Na lista de provedores, clique em **Google** → ative o botão **Ativar** → escolha um e-mail de suporte (o seu mesmo) → **Salvar**
3. Ainda na lista de provedores, clique em **Anônimo** → **Ativar** → **Salvar** — é o que deixa qualquer visitante desenhar no mural sem precisar criar conta: o Firebase só dá um ID técnico pro navegador da pessoa, sem pedir e-mail nem senha
4. Abra o arquivo `firestore.rules` deste projeto e troque os e-mails de exemplo dentro da função `emailsAdmin()` pelos e-mails Gmail reais de quem vai coordenar (Diego, Jaque, Leandro, Lucas, etc. — um por linha, entre aspas)
5. Ainda no Firebase Console, vá em **Firestore Database → Regras**, apague o conteúdo padrão e cole todo o conteúdo (já com os e-mails trocados) do `firestore.rules` → **Publicar**
6. Vá em **Realtime Database → Regras**, apague o conteúdo padrão e cole todo o conteúdo do `database.rules.json` deste projeto → **Publicar**

> Só quem estiver nessa lista consegue entrar em `/admin/`. Pra adicionar ou remover um coordenador depois, é só editar a lista e publicar as regras de novo — não precisa mexer em mais nada.

## Passo C — Conectar o site ao Firebase

1. No Firebase Console, clique no ícone de engrenagem ⚙️ (ao lado de "Visão geral do projeto") → **Configurações do projeto**
2. Em "Seus apps", clique no ícone **`</>`** (Web) pra registrar um app novo
3. Dê um apelido (ex: `site-ejac`) → **Registrar app** — não precisa marcar Firebase Hosting
4. Copie o objeto `firebaseConfig` que aparece (algo como `{ apiKey: "...", authDomain: "...", ... }`)
5. Abra o `firebase-config.js` deste projeto e troque os valores `'COLE_AQUI...'` pelos valores reais que você copiou — **é o único lugar que precisa dessa config**, os outros arquivos importam dali (não precisa adicionar `databaseURL` à mão: o SDK descobre sozinho o endereço do Realtime Database a partir do `projectId`)
6. Salve, faça commit e publique (Passo E, abaixo) — pronto, o site inteiro já fica em tempo real

> **Sobre a config não ser segredo:** ao contrário de uma senha, o `firebaseConfig` de um app web **é público por natureza** — ele só identifica o projeto, não dá acesso a nada sozinho. Quem protege os dados de verdade são as regras do Passo B. Por isso não tem problema esse objeto ficar no repositório.

## Passo D — Testar o painel admin e o mural

1. Publique o site (Passo E) ou abra localmente
2. Vá em `/admin/` (tem um link discreto "Painel" no rodapé de todas as páginas) e clique em **Entrar com Google**
3. Entre com um e-mail que você colocou em `emailsAdmin()` — deve cair direto no painel
4. Teste com outra conta Google (uma pessoal, por exemplo) pra confirmar que aparece a tela de "acesso não autorizado"
5. Vá em `/mural/`, escolha um nome e desenhe um traço — abra em outra aba (ou peça pra outra pessoa abrir) pra confirmar que o traço e o nome flutuante aparecem ao vivo do outro lado
6. Volte no painel, aba "Mural", e confirme que a contagem de traços bate com o que você desenhou no teste

Se a lista de itens da cesta ou de tamanhos mudar, atualize em **três lugares**: `catalogos.js` (usado pelos formulários e pelo painel), a função `metas()`/`tamanhosValidos()` no `firestore.rules` (regras do Firestore não conseguem importar arquivo externo), e as opções do `<select>` em `cesta/index.html`.

### Custo

O plano gratuito do Firestore (Spark) libera 50 mil leituras e 20 mil escritas por dia, o Realtime Database libera 1 GB de tráfego por mês, e tanto o login com Google quanto o anônimo no Firebase Auth são gratuitos — tudo muito acima do que uma campanha de grupo como essa usa. Não precisa cadastrar cartão de crédito.

## Segurança

O site é estático (sem servidor nosso), então a superfície de ataque é pequena. Mesmo assim, tem várias camadas de proteção:

- **As regras do Firestore são a validação que vale de verdade** (`firestore.rules`): tamanho de campo, formato de WhatsApp, item/tamanho dentro da lista oficial, quantidade dentro do razoável. A validação no navegador (`camiseta-firebase.js`/`cesta-firebase.js`) é só "de cortesia", pra dar feedback rápido — um usuário malicioso pode pular ela inteira e mesmo assim esbarra nas regras do servidor.
- **Ninguém lê dado sensível sem estar autorizado:** os pedidos de camiseta (nome + WhatsApp) e o IP da cesta só são legíveis por quem faz login Google **e** está na lista `emailsAdmin()` das regras. Ninguém mais consegue ler essas coleções, nem o próprio código do site — as regras barram no servidor, não é só uma questão de "a página não mostra".
- **Ninguém edita ou apaga nada, exceto o admin:** criar um pedido/contribuição é público (é o formulário), mas alterar ou excluir só é permitido pra quem está autenticado como admin. Isso é forçado pelas regras, não pela interface.
- **Mural: identidade anônima, sem dado pessoal.** Quem desenha entra automaticamente com login anônimo do Firebase Auth (sem e-mail, sem senha, só um ID técnico do navegador) — as regras usam esse ID só pra garantir que cada sessão cria traço em nome dela mesma; **nem o autor original consegue editar um traço depois de criado**, só o admin consegue apagar, e sempre tudo de uma vez, não traço por traço. A posição do cursor enquanto alguém está desenhando (pro nome flutuar ao vivo pros outros) fica no Realtime Database, não no Firestore — some sozinha assim que a pessoa solta o traço ou fecha a aba (`onDisconnect`), não fica guardada em lugar nenhum depois disso.
- **Honeypot anti-bot:** um campo invisível (`website`) que humanos não veem; se vier preenchido, o envio é descartado (bots costumam preencher tudo).
- **Content-Security-Policy sem `unsafe-inline`:** a CSP nega tudo por padrão e libera só o essencial (o próprio domínio, as fontes do Google, o SDK do Firebase via `gstatic.com`, e os endpoints do Firestore/Auth). Como nenhum CSS ou JS fica embutido no HTML, o navegador **bloqueia qualquer script ou estilo injetado** na página — a defesa mais forte contra XSS. Também bloqueia envio de formulário pra fora (`form-action 'none'`) e o site ser colocado dentro de um iframe (`frame-ancestors 'none'`, evita clickjacking). Só o `/mural/` libera um domínio coringa (`*.firebaseio.com`, em vez do domínio nomeado do banco): o Realtime Database redireciona a conexão de verdade pra um host de shard que muda a cada sessão, então não dá pra travar num hostname fixo sem quebrar o próprio recurso.
- **`referrer: no-referrer`:** ao clicar num link externo (WhatsApp), o destino não recebe de onde a pessoa veio.
- **Links externos com `noopener noreferrer`:** a página aberta não ganha acesso à nossa via `window.opener`.
- **Registro de IP:** junto com cada pedido/contribuição é gravado o IP de quem enviou, pra dar rastreabilidade em caso de pedido falso. O IP é obtido pelo navegador via `api.ipify.org` — ou seja, dá pra forjar num envio direto ao Firestore, então serve como indício, não como prova. Se a busca falhar, o envio segue normalmente sem IP. Há um aviso discreto nos formulários informando o registro, como manda o princípio de transparência da LGPD.
- **Anti-injeção de fórmula na planilha:** a cópia dos pedidos de camiseta que cai no Google Sheets passa pelo `Code.gs`, que prefixa com apóstrofo qualquer valor começando com `=`, `+`, `-` ou `@` antes de gravar — assim o Sheets trata como **texto** e nunca executa como fórmula, protegendo quem abre a planilha.
- **`/admin/` tem `noindex, nofollow`:** não aparece em buscadores. Isso não é a proteção real (quem protege são as regras + login), é só pra não aparecer por acidente numa busca.
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
4. Arraste `index.html`, `styles.css`, `app.js`, `camiseta-firebase.js`, `cesta-firebase.js`, `mural-firebase.js`, `admin-firebase.js`, `firebase-config.js`, `catalogos.js`, `favicon.svg` e as pastas `assets/`, `cesta/`, `mural/` e `admin/` (arrastando a pasta inteira, não só o `index.html` de dentro dela, pra manter `cesta/index.html`, `mural/index.html` e `admin/index.html` no lugar certo) e clique em **Commit changes** (`firestore.rules` e `database.rules.json` não precisam subir pro GitHub Pages, só pro Firebase Console — Passo B; `Code.gs` só vai no editor do Apps Script — Passo F)
5. Vá em **Settings → Pages**
6. Em "Branch", selecione `main` e a pasta `/root`, depois clique em **Save**
7. Espere 1–2 minutos e atualize a página — vai aparecer o link do site (algo como `https://seu-usuario.github.io/site-ejac/`)

Esse é o link que vocês vão divulgar pro grupo pedir a camiseta e colaborar com a cesta.

## Passo F — Conectar a cópia dos pedidos de camiseta na planilha

O Firestore já é suficiente pro site e pro painel funcionarem — esse passo é só pra também termos uma cópia dos pedidos de camiseta numa planilha do Google, por preferência do grupo.

1. Acesse [sheets.google.com](https://sheets.google.com) e crie uma planilha nova (ex: "Pedidos Camiseta EJAC")
2. Copie o **ID da planilha** — o trecho da URL entre `/d/` e `/edit`: `https://docs.google.com/spreadsheets/d/`**`ESSE-TRECHO-AQUI`**`/edit`
3. No menu da planilha, clique em **Extensões → Apps Script**, apague o código de exemplo e cole todo o conteúdo do `Code.gs` deste projeto
4. Troque `'COLE_AQUI_O_ID_DA_PLANILHA'` (topo do arquivo) pelo ID copiado no passo 2 → salve (💾)
5. **Implantar → Nova implantação** → ⚙️ → **App da Web** → Executar como **Eu**, Quem pode acessar **Qualquer pessoa** → **Implantar**
6. Na primeira vez, autorize o acesso (é o seu próprio script, pode confiar mesmo com o aviso de "não verificado")
7. Copie a **URL do app da Web** (`https://script.google.com/macros/s/.../exec`) e cole no `camiseta-firebase.js`, na constante `SHEET_SCRIPT_URL` (topo do arquivo)
8. No `index.html`, confira se o CSP (`connect-src`) já libera `https://script.google.com` e `https://script.googleusercontent.com` — se você recriou o projeto do zero, pode ter tirado essas linhas junto com a limpeza do Firebase

> **Nota:** sempre que alterar o `Code.gs` depois de implantado, é preciso ir em **Implantar → Gerenciar implantações → editar (lápis) → Nova versão → Implantar** pra mudança valer. A URL não muda.

Como a gravação na planilha usa `mode: 'no-cors'`, o navegador nunca sabe se ela deu certo ou não — por isso ela **nunca bloqueia nem exibe erro** pro usuário. Se a planilha parar de receber pedidos por algum motivo (deployment revogado, etc.), o site continua funcionando normal e nada se perde: os pedidos continuam chegando no Firestore, visíveis no painel `/admin/`.

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
