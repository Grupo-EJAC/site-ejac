// EJAC — Banco de palavras do "Termo EJAC"
//
// São DUAS listas, com papéis diferentes:
//
//  1. PALAVRAS_EJAC — as palavras que podem ser a resposta do dia.
//     Cada uma tem um significado, mostrado quando a rodada termina.
//     A ordem É o calendário: a resposta anda um item por dia, do começo
//     pro fim, e recomeça quando acaba.
//
//  2. PALAVRAS_ACEITAS — palavras que valem como TENTATIVA mas nunca
//     serão a resposta. Serve pra quem chuta um termo legítimo que não
//     está entre as respostas: em vez de levar "essa palavra não existe",
//     o chute é aceito normalmente.
//
// O jogo só aceita tentativas que estejam numa das duas listas. Isso é de
// propósito: como não temos um dicionário de português inteiro, o jogo é
// temático — você adivinha usando o vocabulário da Igreja. Se alguém
// reclamar que uma palavra legítima foi recusada, é só acrescentar ela em
// PALAVRAS_ACEITAS (não precisa de significado).
//
// REGRAS PRA MEXER:
//  - Só letras de A a Z (acento à vontade) — nada de espaço, hífen ou número
//  - De 4 a 10 letras, sempre. Menos de 4 fica fácil demais; mais de 10 não
//    cabe na tela do celular (a 10 letras a peça já fica com 29px no 375px)
//  - O acento é só pra exibição: quem joga digita sem acento, e o jogo
//    compara sem acento (ÁGAPE se acerta digitando "AGAPE")
//  - Acrescentar no FIM de PALAVRAS_EJAC é sempre seguro; inserir no meio
//    desloca o calendário de todas as palavras seguintes
//
// Há um teste embutido: se alguma palavra quebrar as regras acima, o jogo
// avisa no console do navegador em vez de falhar silenciosamente.

// ============================================================
// 1. RESPOSTAS — podem cair como palavra do dia (100)
// ============================================================
const PALAVRAS_EJAC = [
  { palavra: 'MISSA',    significado: 'A celebração central da fé católica, onde se renova o sacrifício de Cristo.' },
  { palavra: 'TERÇO',    significado: 'Oração feita com contas, meditando os mistérios da vida de Jesus e de Maria.' },
  { palavra: 'BATISMO',  significado: 'O primeiro sacramento: torna a pessoa filha de Deus e membro da Igreja.' },
  { palavra: 'GRAÇA',    significado: 'Dom gratuito de Deus, que se aproxima de nós sem que a gente mereça.' },
  { palavra: 'PÁSCOA',   significado: 'A festa da ressurreição de Jesus, a maior de todo o ano litúrgico.' },
  { palavra: 'ALTAR',    significado: 'A mesa central da igreja, onde a Eucaristia é celebrada.' },
  { palavra: 'ÁGAPE',    significado: 'Amor generoso e sem interesse; era o nome das refeições fraternas dos primeiros cristãos.' },
  { palavra: 'CREDO',    significado: 'A oração que resume aquilo em que os cristãos acreditam.' },
  { palavra: 'QUARESMA', significado: 'Os quarenta dias de conversão que preparam para a Páscoa.' },
  { palavra: 'HÓSTIA',   significado: 'O pão consagrado que se torna o Corpo de Cristo.' },
  { palavra: 'ANJO',     significado: 'Mensageiro de Deus: ser espiritual criado para servir e anunciar.' },
  { palavra: 'PERDÃO',   significado: 'Libertar alguém da culpa — está no centro da mensagem de Jesus.' },
  { palavra: 'SALMO',    significado: 'Poema de oração do Antigo Testamento, rezado ou cantado.' },
  { palavra: 'CRISMA',   significado: 'Sacramento que confirma o batismo e fortalece com o Espírito Santo.' },
  { palavra: 'CRUZ',     significado: 'Instrumento da morte de Jesus e principal símbolo dos cristãos.' },
  { palavra: 'NOVENA',   significado: 'Oração repetida durante nove dias seguidos, com uma intenção.' },
  { palavra: 'PARÓQUIA', significado: 'A comunidade local de fiéis, conduzida por um pároco.' },
  { palavra: 'GLÓRIA',   significado: 'Louvor à grandeza de Deus; também o hino cantado na missa.' },
  { palavra: 'JEJUM',    significado: 'Abrir mão de alimento por vontade própria, como penitência e oração.' },
  { palavra: 'BÍBLIA',   significado: 'O conjunto dos livros sagrados: Antigo e Novo Testamento.' },
  { palavra: 'ADVENTO',  significado: 'Tempo de preparação para o Natal, nas quatro semanas anteriores.' },
  { palavra: 'CÁLICE',   significado: 'A taça que guarda o vinho consagrado na missa.' },
  { palavra: 'LEIGO',    significado: 'Membro da Igreja que não é padre nem religioso — a maioria de nós.' },
  { palavra: 'ORAÇÃO',   significado: 'Conversa com Deus: tanto de pedido quanto de escuta.' },
  { palavra: 'APÓSTOLO', significado: 'Cada um dos doze escolhidos por Jesus para anunciar o Evangelho.' },
  { palavra: 'SINO',     significado: 'Toca na torre da igreja para chamar os fiéis à oração.' },
  { palavra: 'DÍZIMO',   significado: 'Contribuição do fiel para sustentar a comunidade e suas obras.' },
  { palavra: 'PROFETA',  significado: 'Quem fala em nome de Deus e chama o povo à conversão.' },
  { palavra: 'CEIA',     significado: 'A última refeição de Jesus com os apóstolos, onde instituiu a Eucaristia.' },
  { palavra: 'VIRGEM',   significado: 'Título dado a Maria, a mãe de Jesus.' },
  { palavra: 'MILAGRE',  significado: 'Sinal extraordinário que revela o poder e a bondade de Deus.' },
  { palavra: 'PRECE',    significado: 'Outro nome para oração: um pedido dirigido a Deus.' },
  { palavra: 'LITURGIA', significado: 'O conjunto de ritos e orações oficiais do culto da Igreja.' },
  { palavra: 'PADRE',    significado: 'Sacerdote ordenado para celebrar os sacramentos e guiar a comunidade.' },
  { palavra: 'ESMOLA',   significado: 'Ajuda dada a quem precisa, como gesto concreto de caridade.' },
  { palavra: 'NATAL',    significado: 'A festa do nascimento de Jesus, celebrada em 25 de dezembro.' },
  { palavra: 'DIÁCONO',  significado: 'Ordenado para servir: proclama o Evangelho, batiza e cuida dos pobres.' },
  { palavra: 'ALMA',     significado: 'A dimensão espiritual e imortal do ser humano.' },
  { palavra: 'ROSÁRIO',  significado: 'Oração completa dos mistérios — mais longa que o terço.' },
  { palavra: 'PECADO',   significado: 'Aquilo que afasta a pessoa de Deus e do próximo.' },
  { palavra: 'BISPO',    significado: 'Sucessor dos apóstolos, responsável por uma diocese.' },
  { palavra: 'SAGRADO',  significado: 'Aquilo que é separado e dedicado a Deus.' },
  { palavra: 'AMÉM',     significado: 'Palavra hebraica que quer dizer "assim seja", usada para confirmar a oração.' },
  { palavra: 'CAPELA',   significado: 'Igreja pequena, ou espaço reservado para a oração.' },
  { palavra: 'MÁRTIR',   significado: 'Quem entregou a própria vida por não negar a fé.' },
  { palavra: 'SANTO',    significado: 'Pessoa reconhecida pela Igreja por ter vivido de modo exemplar.' },
  { palavra: 'UNÇÃO',    significado: 'Gesto de ungir com óleo santo, sinal da força do Espírito Santo.' },
  { palavra: 'SERMÃO',   significado: 'A pregação do padre, que explica a Palavra proclamada.' },
  { palavra: 'IGREJA',   significado: 'A comunidade dos batizados; também o prédio onde ela se reúne.' },
  { palavra: 'VIGÍLIA',  significado: 'Oração feita na véspera de uma festa, muitas vezes durante a noite.' },
  { palavra: 'PAPA',     significado: 'Bispo de Roma, sucessor de Pedro e pastor da Igreja inteira.' },
  { palavra: 'SACRÁRIO', significado: 'O lugar da igreja onde o Santíssimo fica guardado.' },
  { palavra: 'IRMÃO',    significado: 'Como os cristãos se chamam entre si, por serem filhos do mesmo Pai.' },
  { palavra: 'DOGMA',    significado: 'Verdade de fé definida oficialmente pela Igreja.' },
  { palavra: 'MONGE',    significado: 'Religioso que vive em mosteiro, dedicado à oração e ao trabalho.' },
  { palavra: 'JUBILEU',  significado: 'Ano santo de perdão, graça e reconciliação.' },
  { palavra: 'FIEL',     significado: 'Quem crê e faz parte da comunidade da Igreja.' },
  { palavra: 'CONCÍLIO', significado: 'Assembleia de bispos que decide questões importantes da Igreja.' },
  { palavra: 'CLERO',    significado: 'O conjunto dos ministros ordenados da Igreja.' },
  { palavra: 'ABADE',    significado: 'O superior de um mosteiro.' },
  { palavra: 'TRINDADE', significado: 'Um só Deus em três pessoas: Pai, Filho e Espírito Santo.' },
  { palavra: 'PÁROCO',   significado: 'O padre responsável por uma paróquia.' },
  { palavra: 'FREIRA',   significado: 'Religiosa que fez votos e vive em comunidade.' },
  { palavra: 'SÍNODO',   significado: 'Assembleia da Igreja reunida para escutar e decidir em conjunto.' },
  { palavra: 'BÊNÇÃO',   significado: 'Gesto ou palavra que invoca o bem de Deus sobre alguém.' },
  { palavra: 'INCENSO',  significado: 'Resina queimada na liturgia: a fumaça que sobe simboliza a oração.' },
  { palavra: 'MESSIAS',  significado: '"O ungido": o salvador prometido, que os cristãos reconhecem em Jesus.' },
  { palavra: 'CALVÁRIO', significado: 'O monte onde Jesus foi crucificado.' },
  { palavra: 'PARÁBOLA', significado: 'História simples que Jesus contava para ensinar uma verdade profunda.' },
  { palavra: 'CONVENTO', significado: 'Casa onde vive uma comunidade religiosa.' },
  { palavra: 'MOSTEIRO', significado: 'Casa de monges, dedicada à oração e ao trabalho.' },
  { palavra: 'PRESÉPIO', significado: 'A representação do nascimento de Jesus, montada no Natal.' },
  { palavra: 'CENÁCULO', significado: 'A sala da Última Ceia, onde também aconteceu Pentecostes.' },
  { palavra: 'ORATÓRIO', significado: 'Espaço reservado à oração dentro de uma casa ou instituição.' },
  { palavra: 'CARISMA',  significado: 'Dom dado pelo Espírito Santo para o bem de toda a comunidade.' },
  { palavra: 'MITRA',    significado: 'O chapéu alto que o bispo usa nas celebrações solenes.' },
  { palavra: 'CÚRIA',    significado: 'O conjunto de órgãos que ajudam o bispo ou o papa a governar.' },
  { palavra: 'NOVIÇO',   significado: 'Quem está em formação, antes de professar os votos religiosos.' },
  { palavra: 'OFÍCIO',   significado: 'A oração das horas, que a Igreja reza ao longo de todo o dia.' },
  { palavra: 'BATINA',   significado: 'A veste comprida usada pelos padres.' },
  { palavra: 'SUDÁRIO',  significado: 'O pano que envolveu o corpo de Jesus no sepulcro.' },
  { palavra: 'LOUVOR',   significado: 'Oração que só agradece e exalta, sem pedir nada em troca.' },
  { palavra: 'HINO',     significado: 'Canto de louvor usado na liturgia.' },
  { palavra: 'DEUS',     significado: 'O Criador de todas as coisas, Pai de todos nós.' },
  { palavra: 'CÍRIO',    significado: 'A vela grande acesa na Páscoa, sinal de Cristo ressuscitado.' },
  { palavra: 'RELÍQUIA', significado: 'Objeto ou resto mortal de um santo, guardado com veneração.' },
  { palavra: 'DIOCESE',  significado: 'O conjunto de paróquias sob o cuidado de um bispo.' },
  { palavra: 'CATEDRAL', significado: 'A igreja principal da diocese, onde fica a cátedra do bispo.' },
  { palavra: 'COMUNHÃO', significado: 'Receber o Corpo de Cristo, e a união que isso cria entre nós.' },

  // --- Liturgia e celebração ---
  { palavra: 'ALELUIA',  significado: 'Aclamação de alegria que a Igreja canta, sobretudo no tempo da Páscoa.' },
  { palavra: 'OFERTA',   significado: 'O momento da missa em que o pão, o vinho e os dons são apresentados.' },
  { palavra: 'PREFÁCIO', significado: 'O canto de ação de graças que abre a Oração Eucarística.' },
  { palavra: 'ANTÍFONA', significado: 'Verso curto cantado antes e depois de um salmo.' },
  { palavra: 'LADAINHA', significado: 'Oração feita de invocações seguidas, respondidas pela assembleia.' },
  { palavra: 'TRÍDUO',   significado: 'Os três dias santos: Quinta-feira Santa, Sexta-feira da Paixão e Sábado Santo.' },
  { palavra: 'CINZAS',   significado: 'Sinal de penitência colocado na testa no início da Quaresma.' },
  { palavra: 'RAMOS',    significado: 'O domingo que lembra a entrada de Jesus em Jerusalém.' },
  { palavra: 'OITAVA',   significado: 'Os oito dias em que a Igreja prolonga a celebração de uma grande festa.' },
  { palavra: 'INTROITO', significado: 'O canto de entrada da celebração.' },
  { palavra: 'CORO',     significado: 'O grupo que conduz o canto na liturgia.' },
  { palavra: 'VIÁTICO',  significado: 'A comunhão levada a quem está em risco de morte.' },
  { palavra: 'EXÉQUIAS', significado: 'As orações e os ritos do funeral cristão.' },
  { palavra: 'ORDEM',    significado: 'O sacramento que consagra bispos, padres e diáconos.' },

  // --- Objetos e lugares da igreja ---
  { palavra: 'TURÍBULO', significado: 'O recipiente em que se queima o incenso nas celebrações.' },
  { palavra: 'CUSTÓDIA', significado: 'A peça dourada que expõe a hóstia para a adoração.' },
  { palavra: 'CORPORAL', significado: 'O pano branco estendido no altar, onde ficam a hóstia e o cálice.' },
  { palavra: 'GALHETA',  significado: 'As jarrinhas que levam a água e o vinho ao altar.' },
  { palavra: 'MEDALHA',  significado: 'Objeto de devoção trazido junto ao corpo.' },
  { palavra: 'IMAGEM',   significado: 'Representação de Cristo, de Maria ou de um santo, usada na devoção.' },
  { palavra: 'VITRAL',   significado: 'Janela de vidro colorido que conta histórias da fé com luz.' },
  { palavra: 'NICHO',    significado: 'O vão na parede onde se coloca uma imagem.' },
  { palavra: 'TORRE',    significado: 'A parte alta da igreja, onde ficam os sinos.' },
  { palavra: 'ÁBSIDE',   significado: 'O fundo arredondado da igreja, atrás do altar.' },
  { palavra: 'PÁLIO',    significado: 'Cobertura levada sobre o Santíssimo nas procissões.' },

  // --- Vestes e paramentos ---
  { palavra: 'ALVA',     significado: 'A túnica branca usada sobre a batina nas celebrações.' },
  { palavra: 'AMITO',    significado: 'Pano branco que o sacerdote põe sobre os ombros ao se paramentar.' },
  { palavra: 'CÍNGULO',  significado: 'O cordão que aperta a alva na cintura.' },
  { palavra: 'SOLIDÉU',  significado: 'O pequeno gorro redondo usado por bispos e pelo papa.' },
  { palavra: 'MANÍPULO', significado: 'Faixa antiga usada no braço esquerdo do sacerdote.' },

  // --- Serviços e ministérios ---
  { palavra: 'ACÓLITO',  significado: 'Quem serve ao altar, ajudando o padre na celebração.' },
  { palavra: 'COROINHA', significado: 'O jovem que ajuda na missa junto ao altar.' },
  { palavra: 'LEITOR',   significado: 'Quem proclama as leituras da Palavra na celebração.' },
  { palavra: 'MINISTRO', significado: 'Quem exerce um serviço na Igreja, como distribuir a comunhão.' },
  { palavra: 'EREMITA',  significado: 'Quem vive isolado do mundo, dedicado só à oração.' },
  { palavra: 'PRELADO',  significado: 'Título de quem tem autoridade de governo na Igreja.' },
  { palavra: 'CÔNEGO',   significado: 'Padre que integra o cabido de uma catedral.' },
  { palavra: 'VIGÁRIO',  significado: 'Padre que age no lugar do bispo ou do pároco.' },
  { palavra: 'CAPELÃO',  significado: 'Padre encarregado de uma capela ou do cuidado de um grupo.' },
  { palavra: 'PASTOR',   significado: 'Quem guia e cuida do rebanho: título dado a Cristo e aos bispos.' },

  // --- Virtudes e vida em Deus ---
  { palavra: 'CARIDADE', significado: 'O amor a Deus e ao próximo: a maior de todas as virtudes.' },
  { palavra: 'POBREZA',  significado: 'Viver desapegado dos bens, confiando na providência de Deus.' },
  { palavra: 'JUSTIÇA',  significado: 'Dar a cada um o que lhe é devido, a começar por Deus.' },
  { palavra: 'SALVAÇÃO', significado: 'A libertação do pecado e da morte, dada por Cristo.' },
  { palavra: 'REDENÇÃO', significado: 'O resgate da humanidade, pago por Jesus na cruz.' },
  { palavra: 'VOCAÇÃO',  significado: 'O chamado de Deus para um modo de vida.' },
  { palavra: 'MISSÃO',   significado: 'O envio para anunciar o Evangelho aos outros.' },
  { palavra: 'PARAÍSO',  significado: 'A vida plena e eterna junto de Deus.' },
  { palavra: 'INFERNO',  significado: 'O estado de separação definitiva de Deus.' },
  { palavra: 'JUÍZO',    significado: 'O momento em que cada vida é apresentada diante de Deus.' },

  // --- Bíblia: livros que não são nome de pessoa ---
  { palavra: 'GÊNESIS',  significado: 'O primeiro livro da Bíblia, que narra a criação do mundo.' },
  { palavra: 'ÊXODO',    significado: 'O livro da saída do povo de Israel da escravidão no Egito.' },
  { palavra: 'LEVÍTICO', significado: 'Livro da Lei, com as normas do culto do povo de Israel.' },
  { palavra: 'JUÍZES',   significado: 'Livro dos líderes que Deus levantou antes dos reis.' },

  // --- Lugares ---
  { palavra: 'GÓLGOTA',  significado: 'O "lugar da caveira", o monte onde Jesus foi crucificado.' },
  { palavra: 'EMAÚS',    significado: 'Aldeia onde o Ressuscitado foi reconhecido ao partir o pão.' },
  { palavra: 'CANÁ',     significado: 'Onde Jesus fez o primeiro milagre, nas bodas.' },
  { palavra: 'JERICÓ',   significado: 'Uma das cidades mais antigas, palco de episódios marcantes da Bíblia.' },
  { palavra: 'SINAI',    significado: 'O monte onde Moisés recebeu os Dez Mandamentos.' },
  { palavra: 'TABOR',    significado: 'O monte da Transfiguração de Jesus.' },
  { palavra: 'JORDÃO',   significado: 'O rio onde Jesus foi batizado por João Batista.' },
  { palavra: 'GALILEIA', significado: 'A região onde Jesus cresceu e começou a pregar.' },
  { palavra: 'JUDEIA',   significado: 'A região de Jerusalém, centro da vida religiosa do povo judeu.' },
  { palavra: 'ROMA',     significado: 'Sede do papado e centro da Igreja Católica.' },
  { palavra: 'ÉFESO',    significado: 'Cidade onde um concílio proclamou Maria como Mãe de Deus.' },
  { palavra: 'CORINTO',  significado: 'Comunidade cristã a quem Paulo escreveu duas cartas.' },
  { palavra: 'FÁTIMA',   significado: 'Lugar em Portugal onde Nossa Senhora apareceu a três pastorinhos.' },
  { palavra: 'LOURDES',  significado: 'Santuário na França ligado às aparições de Nossa Senhora.' },
  { palavra: 'ASSIS',    significado: 'Cidade italiana de São Francisco e de Santa Clara.' },

  // --- Bíblia: Antigo Testamento ---
  { palavra: 'NÚMEROS',    significado: 'Quarto livro do Pentateuco, com os censos do povo no deserto.' },
  { palavra: 'REIS',       significado: 'Livros que narram a história dos reis de Israel e de Judá.' },
  { palavra: 'CRÔNICAS',   significado: 'Livros que recontam a história do povo a partir do Templo.' },
  { palavra: 'SALMOS',     significado: 'O livro de oração e louvor da Bíblia, com 150 poemas.' },
  { palavra: 'PROVÉRBIOS', significado: 'Coletânea de ditos breves, com sabedoria para o dia a dia.' },
  { palavra: 'CÂNTICOS',   significado: 'O Cântico dos Cânticos: poema de amor lido como imagem de Deus e seu povo.' },
  { palavra: 'SABEDORIA',  significado: 'Livro que ensina a viver segundo o projeto de Deus.' },
  { palavra: 'SIRÁCIDA',   significado: 'Também chamado Eclesiástico: livro de conselhos para a vida.' },
  { palavra: 'PENTATEUCO', significado: 'O conjunto dos cinco primeiros livros da Bíblia.' },
  { palavra: 'TESTAMENTO', significado: 'Cada uma das duas grandes partes da Bíblia: o Antigo e o Novo.' },

  // --- Bíblia: Novo Testamento ---
  { palavra: 'ATOS',       significado: 'Livro que narra os primeiros passos da Igreja depois de Pentecostes.' },
  { palavra: 'ROMANOS',    significado: 'Carta de Paulo sobre a salvação que vem pela fé.' },
  { palavra: 'CORÍNTIOS',  significado: 'Cartas de Paulo a uma comunidade dividida e cheia de problemas.' },
  { palavra: 'GÁLATAS',    significado: 'Carta de Paulo sobre a liberdade dos filhos de Deus.' },
  { palavra: 'EFÉSIOS',    significado: 'Carta que apresenta a Igreja como o Corpo de Cristo.' },
  { palavra: 'FILIPENSES', significado: 'A carta da alegria, escrita por Paulo de dentro da prisão.' },
  { palavra: 'HEBREUS',    significado: 'Carta que apresenta Cristo como o sumo sacerdote definitivo.' },
  { palavra: 'APOCALIPSE', significado: 'O último livro da Bíblia: visões de esperança em tempo de perseguição.' },
  { palavra: 'EVANGELHO',  significado: 'A Boa Nova de Jesus; também cada um dos quatro livros que a contam.' },

  // --- Governo da Igreja ---
  // Os nomes de papas (Lino, Dâmaso, Sixto, Celestino...) saíram daqui de
  // propósito: como resposta do dia ficavam impossíveis de adivinhar.
  // Sobraram só os termos da instituição, que qualquer um do grupo conhece.
  { palavra: 'VATICANO',   significado: 'O menor país do mundo, sede do papa e da Cúria Romana.' },
  { palavra: 'CONCLAVE',   significado: 'A reunião fechada dos cardeais para eleger um novo papa.' },
  { palavra: 'CARDEAL',    significado: 'Bispo que aconselha o papa e participa da eleição dele.' },
  { palavra: 'ENCÍCLICA',  significado: 'Carta que o papa dirige a toda a Igreja sobre um tema grave.' },

  // --- Sacramentos e celebrações ---
  { palavra: 'SACRAMENTO', significado: 'Sinal visível de uma graça invisível de Deus. São sete ao todo.' },
  { palavra: 'EUCARISTIA', significado: 'O sacramento do Corpo e Sangue de Cristo, centro da vida cristã.' },
  { palavra: 'CONFISSÃO',  significado: 'Sacramento em que se confessam os pecados e se recebe o perdão.' },
  { palavra: 'PENITÊNCIA', significado: 'Gesto de reparação que acompanha o arrependimento sincero.' },
  { palavra: 'ABSOLVIÇÃO', significado: 'As palavras pelas quais o padre concede o perdão de Deus.' },
  { palavra: 'CONTRIÇÃO',  significado: 'A dor sincera por ter ofendido a Deus, que abre para o perdão.' },
  { palavra: 'MATRIMÔNIO', significado: 'O sacramento do casamento cristão.' },
  { palavra: 'ORDENAÇÃO',  significado: 'A celebração em que alguém é ordenado diácono, padre ou bispo.' },
  { palavra: 'ADORAÇÃO',   significado: 'Ficar diante do Santíssimo exposto, em silêncio e louvor.' },
  { palavra: 'PROCISSÃO',  significado: 'Caminhada de fé pelas ruas, rezando e cantando juntos.' },
  { palavra: 'ANUNCIAÇÃO', significado: 'O anjo anuncia a Maria que ela será a mãe do Salvador.' },
  { palavra: 'ENCARNAÇÃO', significado: 'Deus que se faz homem em Jesus, nascido de Maria.' },
  { palavra: 'ASCENSÃO',   significado: 'A subida de Jesus ao céu, quarenta dias depois da Páscoa.' },
  { palavra: 'ASSUNÇÃO',   significado: 'Maria elevada ao céu em corpo e alma.' },
  { palavra: 'EPIFANIA',   significado: 'A manifestação de Jesus aos magos vindos do Oriente.' },
  { palavra: 'NATIVIDADE', significado: 'O nascimento de Jesus em Belém.' },
  { palavra: 'PAIXÃO',     significado: 'O sofrimento e a morte de Jesus, lembrados na Semana Santa.' },

  // --- Vida e organização da Igreja ---
  { palavra: 'CATEQUESE',  significado: 'O ensino da fé, que prepara para receber os sacramentos.' },
  { palavra: 'CATECISMO',  significado: 'O livro que reúne e explica aquilo que a Igreja crê.' },
  { palavra: 'APOSTOLADO', significado: 'O trabalho de anunciar o Evangelho na vida de todo dia.' },
  { palavra: 'PASTORAL',   significado: 'O cuidado organizado da Igreja com um grupo ou uma missão.' },
  { palavra: 'SANTUÁRIO',  significado: 'Lugar de peregrinação, ligado a uma devoção ou aparição.' },
  { palavra: 'BASÍLICA',   significado: 'Igreja de importância especial, com título concedido pelo papa.' },
  { palavra: 'SEMINÁRIO',  significado: 'A casa onde os futuros padres estudam e se formam.' },
  { palavra: 'NOVICIADO',  significado: 'O tempo de formação antes de professar os votos religiosos.' },
  { palavra: 'CLAUSURA',   significado: 'A parte do convento reservada apenas aos religiosos.' },
  { palavra: 'SACRISTIA',  significado: 'A sala onde se guardam as vestes e os objetos da missa.' },
  { palavra: 'SACRISTÃO',  significado: 'Quem cuida da sacristia e prepara tudo para a celebração.' },
  { palavra: 'BATISTÉRIO', significado: 'O lugar da igreja onde fica a pia batismal.' },
  { palavra: 'CAMPANÁRIO', significado: 'A torre da igreja onde ficam os sinos.' },
  { palavra: 'PRESBÍTERO', significado: 'Outro nome para o padre; vem do grego e quer dizer "ancião".' },
  { palavra: 'ROMARIA',    significado: 'A viagem em grupo até um santuário, por devoção.' },
  { palavra: 'PEREGRINO',  significado: 'Quem caminha até um lugar santo, movido pela fé.' },
  { palavra: 'DISCÍPULO',  significado: 'Quem segue Jesus, aprende com ele e vive o que aprendeu.' },
  { palavra: 'CRUCIFIXO',  significado: 'A cruz com a imagem de Cristo.' },
  { palavra: 'MARTÍRIO',   significado: 'Dar a própria vida por não negar a fé.' },
  { palavra: 'PURGATÓRIO', significado: 'Estado de purificação antes de entrar na glória de Deus.' },

  // --- Ordens religiosas ---
  { palavra: 'JESUÍTA',    significado: 'Membro da Companhia de Jesus, fundada por Santo Inácio.' },
  { palavra: 'CARMELITA',  significado: 'Religioso ou religiosa da Ordem do Carmo.' },
  { palavra: 'DOMINICANO', significado: 'Religioso da Ordem dos Pregadores, fundada por São Domingos.' },
  { palavra: 'BENEDITINO', significado: 'Monge que vive segundo a Regra de São Bento.' },
  { palavra: 'CAPUCHINHO', significado: 'Frade de um dos ramos da família franciscana.' },

  // --- Virtudes e vida espiritual ---
  { palavra: 'ESPERANÇA',  significado: 'A virtude de confiar nas promessas de Deus, mesmo no escuro.' },
  { palavra: 'HUMILDADE',  significado: 'Reconhecer-se pequeno diante de Deus e colocar-se a serviço.' },
  { palavra: 'CASTIDADE',  significado: 'Viver o afeto e o corpo segundo o amor verdadeiro.' },
  { palavra: 'OBEDIÊNCIA', significado: 'Escutar a vontade de Deus e segui-la de coração.' },
  { palavra: 'PRUDÊNCIA',  significado: 'A virtude de discernir e escolher bem o caminho do bem.' },
  { palavra: 'FORTALEZA',  significado: 'A virtude de manter-se firme diante das dificuldades.' },
  { palavra: 'TEMPERANÇA', significado: 'A virtude do equilíbrio, que ordena os desejos.' },
  { palavra: 'ETERNIDADE', significado: 'A vida sem fim, junto de Deus.' },
  { palavra: 'BEATITUDE',  significado: 'Cada uma das bem-aventuranças proclamadas por Jesus no monte.' },
  { palavra: 'MANDAMENTO', significado: 'Cada uma das dez palavras que Deus entregou a Moisés.' },
  { palavra: 'MAGNIFICAT', significado: 'O cântico de Maria: "A minha alma engrandece o Senhor."' },
  { palavra: 'ANGELUS',    significado: 'Oração rezada três vezes ao dia, lembrando a Encarnação.' },
  { palavra: 'ESPÍRITO',   significado: 'A terceira pessoa da Trindade, que anima e conduz a Igreja.' },
  { palavra: 'CRISTO',     significado: 'Título de Jesus: "o ungido" de Deus.' },
  { palavra: 'EMANUEL',    significado: 'Nome dado a Jesus pelo profeta: "Deus conosco".' },
  { palavra: 'SENHOR',     significado: 'Título dado a Deus e a Jesus ressuscitado.' },

  // --- Oração das horas e livros da celebração ---
  { palavra: 'LAUDES',     significado: 'A oração da manhã, no Ofício Divino.' },
  { palavra: 'VÉSPERAS',   significado: 'A oração do fim da tarde, no Ofício Divino.' },
  { palavra: 'COMPLETAS',  significado: 'A última oração do dia, rezada antes de dormir.' },
  { palavra: 'MATINAS',    significado: 'A oração da madrugada, rezada nos mosteiros.' },
  { palavra: 'BREVIÁRIO',  significado: 'O livro que reúne a oração das horas.' },
  { palavra: 'SALTÉRIO',   significado: 'O conjunto dos salmos, como a Igreja os reza.' },
  { palavra: 'MISSAL',     significado: 'O livro com os textos e as orações da missa.' },
  { palavra: 'LECIONÁRIO', significado: 'O livro com as leituras bíblicas de cada dia.' },
  { palavra: 'RITUAL',     significado: 'O livro que descreve como se celebra cada rito.' },
  { palavra: 'RUBRICA',    significado: 'A instrução em vermelho que orienta quem celebra.' },

  // --- Canto e aclamações ---
  { palavra: 'SANCTUS',    significado: 'O "Santo, Santo, Santo" cantado antes da consagração.' },
  { palavra: 'HOSANA',     significado: 'Aclamação de louvor, gritada na entrada de Jesus em Jerusalém.' },
  { palavra: 'MARANATA',   significado: 'Aclamação dos primeiros cristãos: "Vem, Senhor Jesus!"' },
  { palavra: 'MOTETO',     significado: 'Peça breve de canto sacro, cantada em várias vozes.' },
  { palavra: 'CANTOCHÃO',  significado: 'O canto tradicional da liturgia, numa só linha melódica.' },
  { palavra: 'LATIM',      significado: 'A língua antiga da liturgia romana.' },
  { palavra: 'ÔMEGA',      significado: 'A última letra grega: Cristo é o Alfa e o Ômega.' },

  // --- Mais objetos do altar ---
  { palavra: 'PÁTENA',     significado: 'O pratinho de metal que recebe a hóstia.' },
  { palavra: 'ÂMBULA',     significado: 'Vaso com tampa, usado para guardar as hóstias consagradas.' },
  { palavra: 'CIBÓRIO',    significado: 'O vaso que guarda as hóstias dentro do sacrário.' },
  { palavra: 'CREDÊNCIA',  significado: 'A mesinha lateral onde ficam as galhetas e o cálice.' },
  { palavra: 'LAVABO',     significado: 'O gesto em que o padre lava as mãos antes da consagração.' },
  { palavra: 'AMBÃO',      significado: 'O lugar de onde se proclama a Palavra de Deus.' },
  { palavra: 'PÚLPITO',    significado: 'A tribuna elevada de onde antigamente se pregava.' },
  { palavra: 'ÍCONE',      significado: 'Imagem sagrada pintada segundo a tradição do Oriente.' },
  { palavra: 'BÁCULO',     significado: 'O bastão em forma de cajado que o bispo carrega.' },
  { palavra: 'CRUZEIRO',   significado: 'A cruz erguida num adro, numa praça ou à beira do caminho.' },
  { palavra: 'OFERENDA',   significado: 'Aquilo que se apresenta a Deus no altar.' },
  { palavra: 'OBLAÇÃO',    significado: 'O ato de oferecer a Deus, e o próprio dom oferecido.' },
  { palavra: 'SACRIFÍCIO', significado: 'A entrega a Deus; na missa, o de Cristo, renovado.' },

  // --- Mais vestes ---
  { palavra: 'ESTOLA',     significado: 'A faixa de tecido que o padre usa sobre os ombros.' },
  { palavra: 'CASULA',     significado: 'A veste que o padre veste por cima de tudo, na missa.' },
  { palavra: 'DALMÁTICA',  significado: 'A veste própria do diácono na celebração.' },
  { palavra: 'HÁBITO',     significado: 'A veste própria de uma ordem religiosa.' },
  { palavra: 'TONSURA',    significado: 'O antigo corte de cabelo que marcava a entrada no clero.' },

  // --- Espaços sagrados ---
  { palavra: 'TEMPLO',     significado: 'A casa de Deus; em Jerusalém, o centro do culto do povo.' },
  { palavra: 'SINAGOGA',   significado: 'Casa de oração e de leitura da Lei, no judaísmo.' },
  { palavra: 'CRIPTA',     significado: 'A capela subterrânea de uma igreja.' },
  { palavra: 'CATACUMBA',  significado: 'Galeria subterrânea onde os primeiros cristãos sepultavam seus mortos.' },
  { palavra: 'SEPULCRO',   significado: 'O túmulo onde o corpo de Jesus foi colocado.' },
  { palavra: 'ERMIDA',     significado: 'Capelinha isolada, construída em lugar afastado.' },
  { palavra: 'ABADIA',     significado: 'Mosteiro governado por um abade.' },
  { palavra: 'PRIORADO',   significado: 'Casa religiosa menor que uma abadia.' },
  { palavra: 'REFEITÓRIO', significado: 'A sala onde a comunidade religiosa faz as refeições.' },
  { palavra: 'CELA',       significado: 'O quarto simples de um monge ou de uma religiosa.' },

  // --- Vida cristã ---
  { palavra: 'PADRINHO',   significado: 'Quem acompanha e responde pelo batizando.' },
  { palavra: 'MADRINHA',   significado: 'A mulher que acompanha e responde pela pessoa batizada.' },
  { palavra: 'AFILHADO',   significado: 'Quem é apresentado ao batismo por um padrinho.' },
  { palavra: 'ALIANÇA',    significado: 'O pacto de Deus com o seu povo; também o anel do casamento.' },
  { palavra: 'PROMESSA',   significado: 'Aquilo que a pessoa se compromete a cumprir diante de Deus.' },
  { palavra: 'CELIBATO',   significado: 'A opção de não casar, para servir a Deus em tempo integral.' },
  { palavra: 'REGRA',      significado: 'O conjunto de normas que orienta a vida de uma ordem religiosa.' },
  { palavra: 'CONFESSOR',  significado: 'O padre que escuta a confissão e dá a absolvição.' },
  { palavra: 'PENITENTE',  significado: 'Quem se confessa e busca reparar o mal que fez.' },
  { palavra: 'EXORCISMO',  significado: 'A oração pela qual a Igreja pede libertação do mal.' },
  { palavra: 'SUFRÁGIO',   significado: 'A oração oferecida em favor dos falecidos.' },
  { palavra: 'FINADOS',    significado: 'O dia em que a Igreja reza por todos os que já morreram.' },
  { palavra: 'VELÓRIO',    significado: 'A vigília feita junto ao corpo de quem morreu.' },
  { palavra: 'LUTO',       significado: 'O tempo de tristeza pela morte de alguém querido.' },

  // --- Anjos e realidades espirituais ---
  { palavra: 'ARCANJO',    significado: 'Anjo de ordem superior, como Miguel, Gabriel e Rafael.' },
  { palavra: 'QUERUBIM',   significado: 'Anjo de um dos coros mais altos, guardião do que é sagrado.' },
  { palavra: 'SERAFIM',    significado: 'Anjo do coro mais alto, que arde de amor diante de Deus.' },
  { palavra: 'DEMÔNIO',    significado: 'Anjo que se voltou contra Deus.' },
  { palavra: 'TENTAÇÃO',   significado: 'O convite ao mal, que se vence com oração e vigilância.' },
  { palavra: 'SANTÍSSIMO', significado: 'Como se chama a Eucaristia guardada no sacrário.' },
  { palavra: 'PARUSIA',    significado: 'A vinda gloriosa de Cristo no fim dos tempos.' },
  { palavra: 'LIMBO',      significado: 'Antiga explicação sobre o destino de quem morria sem batismo.' },

  // --- Pecado e perdão ---
  { palavra: 'CULPA',      significado: 'O peso que fica no coração depois da falta cometida.' },
  { palavra: 'REMISSÃO',   significado: 'O perdão que apaga a dívida do pecado.' },
  { palavra: 'EXPIAÇÃO',   significado: 'A reparação do mal cometido.' },
  { palavra: 'CONVERSÃO',  significado: 'A mudança de vida que volta o coração para Deus.' },

  // --- Ensino e transmissão da fé ---
  { palavra: 'PROFECIA',   significado: 'A palavra dita em nome de Deus.' },
  { palavra: 'REVELAÇÃO',  significado: 'Deus se dando a conhecer à humanidade.' },
  { palavra: 'TRADIÇÃO',   significado: 'A fé transmitida viva, de geração em geração.' },
  { palavra: 'MAGISTÉRIO', significado: 'O ensino oficial da Igreja, confiado aos bispos.' },
  { palavra: 'DOUTRINA',   significado: 'O conjunto daquilo que a Igreja ensina.' },
  { palavra: 'HERESIA',    significado: 'Ensino que contraria uma verdade da fé.' },
  { palavra: 'CISMA',      significado: 'A ruptura da unidade da Igreja.' },
  { palavra: 'ANÚNCIO',    significado: 'O ato de proclamar a Boa Nova a quem ainda não a conhece.' },
  { palavra: 'TESTEMUNHO', significado: 'A vida que anuncia o Evangelho mesmo sem palavras.' },

  // --- Mais virtudes ---
  { palavra: 'COMPAIXÃO',  significado: 'Sofrer junto e agir para aliviar o sofrimento do outro.' },
  { palavra: 'GRATIDÃO',   significado: 'Reconhecer o bem recebido e agradecer por ele.' },
  { palavra: 'CONFIANÇA',  significado: 'Entregar-se a Deus mesmo sem entender tudo.' },
  { palavra: 'FIDELIDADE', significado: 'Permanecer firme naquilo que se prometeu.' },
  { palavra: 'SANTIDADE',  significado: 'A vida inteiramente aberta a Deus: o chamado de todos nós.' },
  { palavra: 'PUREZA',     significado: 'A limpeza do coração e das intenções.' },
  { palavra: 'MANSIDÃO',   significado: 'A força serena de quem não responde com violência.' },
  { palavra: 'PACIÊNCIA',  significado: 'Suportar com serenidade o tempo e as dificuldades.' },

  // --- Comunidade ---
  { palavra: 'COMUNIDADE', significado: 'O grupo de fiéis que caminha, reza e celebra junto.' },
  { palavra: 'ASSEMBLEIA', significado: 'O povo reunido para celebrar.' },
  { palavra: 'PAROQUIAL',  significado: 'Aquilo que pertence à vida da paróquia.' },
  { palavra: 'DIOCESANO',  significado: 'Aquilo que diz respeito à diocese.' },
  { palavra: 'CAPELANIA',  significado: 'O serviço religioso ligado a um hospital, escola ou quartel.' },
  { palavra: 'MOVIMENTO',  significado: 'Grupo organizado dentro da Igreja, com carisma próprio.' },
];

// ============================================================
// 2. ACEITAS — valem como tentativa, mas nunca são a resposta
//    (nomes bíblicos, plurais, objetos e termos menos comuns)
// ============================================================
const PALAVRAS_ACEITAS = [
  // Nomes de pessoa: saíram das RESPOSTAS de propósito (como palavra do dia
  // ficavam difíceis demais), mas continuam valendo como palpite.
  'JESUS', 'MARIA', 'PEDRO', 'PAULO', 'MOISÉS', 'JOÃO', 'DAVI', 'LUCAS',
  'MATEUS', 'MARCOS', 'TIAGO', 'ELIAS', 'JOSUÉ', 'SAMUEL', 'ESDRAS',
  'TOBIAS', 'JUDITE', 'ESTER', 'RUTE', 'NEEMIAS', 'ISAÍAS', 'JEREMIAS',
  'EZEQUIEL', 'DANIEL', 'OSEIAS', 'JOEL', 'AMÓS', 'ABDIAS', 'JONAS',
  'NAUM', 'HABACUC', 'AGEU', 'ZACARIAS', 'MALAQUIAS', 'MIQUEIAS',
  'SOFONIAS', 'MACABEUS', 'BARUC', 'ELISEU', 'NATÃ', 'BATISTA',
  'TIMÓTEO', 'TITO', 'FILÊMON', 'JUDAS',
  'ANTÔNIO', 'BENTO', 'CLARA', 'TERESA', 'INÁCIO', 'JERÔNIMO', 'AMBRÓSIO',
  'GREGÓRIO', 'RITA', 'LÚCIA', 'CECÍLIA', 'MÔNICA', 'ROQUE', 'JORGE',
  'BÁRBARA', 'CATARINA', 'ISABEL', 'JOAQUIM', 'FRANCISCO',

  // Outros nomes bíblicos
  'ABEL', 'ANÁS', 'CAIM', 'ESAÚ', 'JACÓ', 'JOSÉ', 'LEVI', 'SARA', 'TOMÉ',
  'ANDRÉ', 'ISAAC', 'MARTA', 'SIMÃO', 'ABRAÃO', 'CAIFÁS', 'FELIPE',
  'GEDEÃO', 'LÁZARO', 'MIRIAM', 'SANSÃO', 'ANANIAS', 'BARNABÉ', 'ESTEVÃO',
  'HERODES', 'PILATOS', 'SALOMÃO', 'BARRABÁS', 'MATATIAS', 'VERÔNICA',
  'NICODEMOS', 'MAGDALENA',

  // Plurais, formas e termos soltos
  'AMAR', 'CRER', 'NAVE', 'ORAR', 'REZA', 'VELA', 'VOTO', 'ZELO', 'SIÃO',
  'ALMAS', 'ANJOS', 'BELÉM', 'CEIAS', 'CORAL', 'HINOS', 'LEIGA', 'MADRE',
  'ÓRGÃO', 'PAPAS', 'PRIOR', 'REINO', 'SANTA', 'SINOS', 'VELAS', 'VOTOS',
  'ADORAR', 'BISPOS', 'CREDOS', 'CRUZES', 'GRAÇAS', 'MISSAS', 'NAZARÉ',
  'ORANTE', 'PADRES', 'SANTAS', 'SANTOS', 'TERÇOS', 'TÚNICA', 'CÂNTICO',
  'CAPELAS', 'GALILEU', 'IGREJAS', 'MISSAIS', 'ORAÇÕES', 'PECADOS',
  'PERDÕES', 'PIEDADE', 'SERMÕES', 'ABADESSA', 'CARDEAIS', 'CARISMAS',
  'DIÁCONOS', 'JUBILEUS', 'VIGÍLIAS', 'PROCISSÕES', 'APARECIDA',
];

// ============================================================
// Teste embutido: avisa no console se alguma palavra quebrar as regras.
// Roda rápido e só uma vez, ao carregar a página.
// ============================================================
(function conferirBanco() {
  const semAcento = t => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  const problemas = [];
  const vistas = new Map();

  function conferir(palavra, origem) {
    const limpa = semAcento(palavra);
    if (!/^[A-Z]+$/.test(limpa)) problemas.push(`${palavra} (${origem}): tem caractere que não é letra`);
    if (limpa.length < 4 || limpa.length > 10) problemas.push(`${palavra} (${origem}): tem ${limpa.length} letras, fora do limite de 4 a 10`);
    if (vistas.has(limpa)) problemas.push(`${palavra} (${origem}): repetida, já está em ${vistas.get(limpa)}`);
    else vistas.set(limpa, origem);
  }

  PALAVRAS_EJAC.forEach(e => conferir(e.palavra, 'respostas'));
  PALAVRAS_ACEITAS.forEach(p => conferir(p, 'aceitas'));

  if (problemas.length) {
    console.error('[Termo EJAC] Problemas no banco de palavras:\n' + problemas.join('\n'));
  }
})();
