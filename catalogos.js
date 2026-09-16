// EJAC — Listas de referência compartilhadas entre os módulos do site:
// camiseta-firebase.js e admin-firebase.js. O firestore.rules mantém sua
// PRÓPRIA cópia dessas listas (função tamanhosValidos()) porque regras do
// Firestore não conseguem importar arquivo externo — se mudar algo aqui,
// mude lá também.

// Tamanhos de camiseta aceitos (whitelist) — mesma lista do <select> no
// index.html e da função tamanhosValidos() no firestore.rules.
export const TAMANHOS_VALIDOS = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'G2', 'G3', 'G4', 'G5'];
