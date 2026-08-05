// EJAC — Listas de referência compartilhadas entre os módulos do site
// (itens da cesta básica + tamanhos de camiseta): cesta-firebase.js,
// camiseta-firebase.js e admin-firebase.js. O firestore.rules mantém
// sua PRÓPRIA cópia dessas listas (funções metas() e tamanhosValidos())
// porque regras do Firestore não conseguem importar arquivo externo —
// se mudar algo aqui, mude lá também.
export const ITENS_CESTA = [
  { id: 'arroz', nome: 'Arroz parboilizado', unidade: 'kg', meta: 12 },
  { id: 'feijao', nome: 'Feijão preto', unidade: 'kg', meta: 2 },
  { id: 'bolacha', nome: 'Bolacha sortida', unidade: 'kg', meta: 1 },
  { id: 'acucar', nome: 'Açúcar', unidade: 'kg', meta: 1 },
  { id: 'tempero', nome: 'Tempero pronto', unidade: 'pote', meta: 1 },
  { id: 'cafe', nome: 'Café', unidade: 'kg', meta: 2 },
  { id: 'macarrao', nome: 'Macarrão espaguete', unidade: 'kg', meta: 8 },
  { id: 'oleo', nome: 'Óleo', unidade: 'L', meta: 3 },
  { id: 'cha', nome: 'Chá em caixa (sachê)', unidade: 'caixa', meta: 1 },
  { id: 'suco', nome: 'Suco (mesmo sabor)', unidade: 'unidade', meta: 4 },
  { id: 'extrato', nome: 'Extrato de tomate 300g', unidade: 'unidade', meta: 10 },
  { id: 'leite', nome: 'Leite integral em caixa', unidade: 'L', meta: 2 },
  { id: 'farofa', nome: 'Farofa', unidade: 'kg', meta: 1 },
  { id: 'vinagre', nome: 'Vinagre de álcool', unidade: 'unidade', meta: 1 },
  { id: 'sal', nome: 'Sal', unidade: 'kg', meta: 1 },
  { id: 'vina', nome: 'Vina/salsicha', unidade: 'kg', meta: 8 },
  { id: 'creme_leite', nome: 'Creme de leite', unidade: 'L', meta: 2 },
  { id: 'cebola', nome: 'Cebola', unidade: 'kg', meta: 3 },
  { id: 'alho', nome: 'Alho', unidade: 'kg', meta: 0.3 },
];

export const ITENS_CESTA_POR_ID = {};
ITENS_CESTA.forEach((item) => { ITENS_CESTA_POR_ID[item.id] = item; });

// Tamanhos de camiseta aceitos (whitelist) — mesma lista do <select> no
// index.html e da função tamanhosValidos() no firestore.rules.
export const TAMANHOS_VALIDOS = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'G2', 'G3', 'G4', 'G5'];
