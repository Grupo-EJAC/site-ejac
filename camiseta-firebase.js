// EJAC — Pedido de camiseta, gravado direto no Firestore (sem planilha).
//
// Sem servidor próprio: o navegador fala direto com o Firestore. A
// validação que vale de verdade é a do firestore.rules — a validação
// aqui é só "de cortesia", pra dar feedback rápido sem round-trip.
//
// Os pedidos (nome, WhatsApp, nome/número na camisa, tamanho) NÃO são
// públicos — só o painel admin (/admin/) consegue ler, editar ou
// excluir, depois de login com um e-mail autorizado (ver firestore.rules).

import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js';
import {
  getFirestore, collection, addDoc, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';
import { TAMANHOS_VALIDOS } from './catalogos.js';

const NOME_MAX = 80;
const NOME_CAMISA_MAX = 20;

const form = document.getElementById('form-pedido');
const btn = document.getElementById('btn-enviar');
const msg = document.getElementById('form-msg');

function mostrarErro(texto) {
  msg.textContent = texto;
  msg.className = 'form-msg erro';
}

function marcarInvalido(el) {
  if (window.EJAC && window.EJAC.destacarInvalido) window.EJAC.destacarInvalido(el);
}

let db = null;

if (!firebaseConfig.apiKey.includes('COLE_AQUI')) {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
}

if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!db) {
      mostrarErro('O formulário ainda não está conectado ao Firebase. Veja o README.md.');
      return;
    }

    if ((form.website && form.website.value.trim()) !== '') {
      msg.textContent = 'Pedido enviado com sucesso! 🎉';
      msg.className = 'form-msg sucesso';
      form.reset();
      return;
    }

    // Coleta e limpeza dos dados
    const nomeCompleto = form.nomeCompleto.value.trim();
    const whatsapp = form.whatsapp.value.replace(/\D/g, '');
    const nomeCamisa = form.nomeCamisa.value.trim();
    const numeroCamisa = form.numeroCamisa.value.trim();
    const tamanho = form.tamanho.value;

    // Validação no cliente (o servidor revalida tudo)
    if (!nomeCompleto || !whatsapp || !nomeCamisa || !numeroCamisa || !tamanho) {
      mostrarErro('Preencha todos os campos antes de enviar.');
      if (!nomeCompleto) marcarInvalido(form.nomeCompleto);
      if (!whatsapp) marcarInvalido(form.whatsapp);
      if (!nomeCamisa) marcarInvalido(form.nomeCamisa);
      if (!numeroCamisa) marcarInvalido(form.numeroCamisa);
      if (!tamanho) marcarInvalido(form.tamanho);
      return;
    }
    if (nomeCompleto.length > NOME_MAX || nomeCamisa.length > NOME_CAMISA_MAX) {
      mostrarErro('Algum campo está longo demais. Revise e tente de novo.');
      if (nomeCompleto.length > NOME_MAX) marcarInvalido(form.nomeCompleto);
      if (nomeCamisa.length > NOME_CAMISA_MAX) marcarInvalido(form.nomeCamisa);
      return;
    }
    if (!/^[0-9]{10,11}$/.test(whatsapp)) {
      mostrarErro('Digite um WhatsApp válido, com DDD (ex: 41999998888).');
      marcarInvalido(form.whatsapp);
      return;
    }
    if (!/^[0-9]{1,3}$/.test(numeroCamisa)) {
      mostrarErro('O número na camisa deve ter só dígitos (ex: 7).');
      marcarInvalido(form.numeroCamisa);
      return;
    }
    if (!TAMANHOS_VALIDOS.includes(tamanho)) {
      mostrarErro('Escolha um tamanho válido.');
      marcarInvalido(form.tamanho);
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Enviando...';
    msg.className = 'form-msg';
    msg.textContent = '';

    // Busca o IP público de quem está enviando (registro interno/antifraude).
    // Se o serviço falhar por qualquer motivo, o pedido segue sem IP —
    // isso nunca deve travar o envio do formulário.
    let ip = '';
    try {
      const respIp = await fetch('https://api.ipify.org?format=json');
      const dadosIp = await respIp.json();
      ip = (dadosIp && dadosIp.ip) ? String(dadosIp.ip).slice(0, 45) : '';
    } catch (err) {
      ip = '';
    }

    try {
      await addDoc(collection(db, 'camisetaPedidos'), {
        nomeCompleto, whatsapp, nomeCamisa, numeroCamisa, tamanho, ip,
        criadoEm: serverTimestamp(),
      });
      msg.textContent = 'Pedido enviado com sucesso! 🎉';
      msg.className = 'form-msg sucesso';
      if (window.EJAC && window.EJAC.tocarSucesso) window.EJAC.tocarSucesso();
      form.reset();
      if (window.EJAC && window.EJAC.atualizarPreviewNome) window.EJAC.atualizarPreviewNome();
      if (window.EJAC && window.EJAC.atualizarPreviewNumero) window.EJAC.atualizarPreviewNumero();
    } catch (err) {
      mostrarErro('Não foi possível enviar. Tente novamente em instantes.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Enviar pedido';
    }
  });
}
