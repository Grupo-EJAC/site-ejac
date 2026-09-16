// EJAC — GBJ: o que é compartilhado entre o login/painel, cada modalidade
// de treino e a criação de membro no painel admin.
//
// O GBJ pede só "usuário e senha", mas por baixo é e-mail+senha do próprio
// Firebase Auth (mesma base do resto do site): cada usuário vira um e-mail
// fake e ESTÁVEL, sempre calculado do mesmo jeito, nunca guardado nem
// digitado por ninguém. Ninguém precisa saber que isso existe.
const DOMINIO_FAKE = 'gbj.ejac.local';

// Só letras minúsculas sem acento, número, ponto, hífen e underline — o
// suficiente pra virar a parte local de um e-mail válido.
export function normalizarUsuario(bruto) {
  return String(bruto || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9._-]/g, '');
}

export function emailDoUsuario(usuario) {
  return `${normalizarUsuario(usuario)}@${DOMINIO_FAKE}`;
}
