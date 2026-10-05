// Formulário de Convenção Coletiva: escolha trabalhador/empresa, máscaras, mensagens de erro e envio para /api/cct.

import {
  CAMPOS, formatarCNPJ, formatarCPF, formatarTelefone, sugerirEmail, validarCampo, validarPedido,
} from './cct-regras.js';

const ERRO_ENVIO = 'Houve um problema ao enviar a mensagem, tente novamente mais tarde ou entre em contato pelo telefone.';
const ERRO_VERIFICACAO = 'Não conseguimos confirmar o envio. Recarregue a página e tente de novo, ou entre em contato pelo telefone.';
const MASCARAS = { cpf: formatarCPF, cnpj: formatarCNPJ, cnpj_empresa: formatarCNPJ, telefone: formatarTelefone };

const form = document.getElementById('form-cct');
if (form) iniciar(form);

function iniciar(form) {
  const campos = form.querySelector('[data-campos]');
  const sucesso = document.getElementById('cct-sucesso');
  const erroEnvio = form.querySelector('[data-erro-envio]');
  const botao = form.querySelector('.form-cct__enviar');
  const rotuloBotao = botao.textContent;
  const sugestao = form.querySelector('[data-sugestao-email]');
  const email = form.elements.email;

  const hoje = new Date();
  hoje.setMinutes(hoje.getMinutes() - hoje.getTimezoneOffset());
  form.elements.data_admissao.max = hoje.toISOString().slice(0, 10);
  form.elements.inicio.value = Date.now();

  const tipoAtual = () => form.elements.tipo.value;

  function mostrarErro(nome, mensagem) {
    const aviso = document.getElementById(`erro-${nome}`);
    if (aviso) {
      aviso.textContent = mensagem;
      aviso.hidden = !mensagem;
    }
    const campo = form.elements[nome];
    if (campo instanceof HTMLElement) campo.setAttribute('aria-invalid', mensagem ? 'true' : 'false');
  }

  function validar(campo) {
    const mensagem = validarCampo(campo.name, campo.value);
    mostrarErro(campo.name, mensagem);
    return !mensagem;
  }

  function mostrarTipo() {
    const tipo = tipoAtual();
    campos.hidden = !tipo;
    for (const grupo of form.querySelectorAll('[data-tipo]')) grupo.disabled = grupo.dataset.tipo !== tipo;
    if (tipo) mostrarErro('tipo', '');
  }

  function sugerir() {
    const sugerido = email.value && !validarCampo('email', email.value) ? sugerirEmail(email.value) : null;
    sugestao.hidden = !sugerido;
    if (sugerido) sugestao.querySelector('button').textContent = sugerido;
  }

  function aplicarErros(erros) {
    const nomes = ['tipo', ...(CAMPOS[tipoAtual()] ?? []).map(([nome]) => nome)];
    let primeiro = null;
    for (const nome of nomes) {
      mostrarErro(nome, erros[nome] ?? '');
      if (erros[nome] && !primeiro) primeiro = nome === 'tipo' ? form.elements.tipo[0] : form.elements[nome];
    }
    primeiro?.focus();
  }

  function falha(mensagem) {
    erroEnvio.querySelector('[data-erro-mensagem]').textContent = mensagem;
    erroEnvio.hidden = false;
  }

  form.addEventListener('change', (evento) => {
    if (evento.target.name === 'tipo') mostrarTipo();
  });

  form.addEventListener('input', (evento) => {
    const campo = evento.target;
    const mascara = MASCARAS[campo.name];
    // Formata enquanto digita só quando o cursor está no fim, para não atrapalhar quem corrige no meio.
    if (mascara && campo.selectionStart === campo.value.length) campo.value = mascara(campo.value);
    if (campo.getAttribute('aria-invalid') === 'true') validar(campo);
    if (campo === email) sugestao.hidden = true;
  });

  form.addEventListener('focusout', (evento) => {
    const campo = evento.target;
    if (!campo.name || campo.type === 'radio' || campo.type === 'hidden' || campo.name === 'site') return;
    const mascara = MASCARAS[campo.name];
    if (mascara) campo.value = mascara(campo.value);
    // Só reclama de campo vazio depois de uma tentativa de envio; campo preenchido é conferido ao sair dele.
    if (campo.value.trim() || campo.getAttribute('aria-invalid') === 'true') validar(campo);
    if (campo === email) sugerir();
  });

  sugestao.querySelector('button').addEventListener('click', (evento) => {
    email.value = evento.currentTarget.textContent;
    sugestao.hidden = true;
    validar(email);
    email.focus();
  });

  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    erroEnvio.hidden = true;

    const dados = Object.fromEntries(new FormData(form));
    const resultado = validarPedido(dados);
    if (!resultado.ok) {
      aplicarErros(resultado.erros);
      return;
    }

    botao.disabled = true;
    botao.textContent = 'Enviando…';
    try {
      const resposta = await fetch('/api/cct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados),
      });
      const corpo = await resposta.json().catch(() => ({}));
      if (resposta.ok && corpo.ok) {
        form.hidden = true;
        sucesso.hidden = false;
        sucesso.focus();
      } else if (corpo.erro === 'validacao') {
        aplicarErros(corpo.campos ?? {});
      } else {
        falha(corpo.erro === 'verificacao' ? ERRO_VERIFICACAO : ERRO_ENVIO);
      }
    } catch {
      falha(ERRO_ENVIO);
    } finally {
      botao.disabled = false;
      botao.textContent = rotuloBotao;
      window.turnstile?.reset();
    }
  });

  sucesso.querySelector('[data-novo-pedido]').addEventListener('click', () => {
    form.reset();
    form.elements.inicio.value = Date.now();
    for (const aviso of form.querySelectorAll('.campo__erro')) aviso.hidden = true;
    for (const campo of form.querySelectorAll('[aria-invalid]')) campo.setAttribute('aria-invalid', 'false');
    sugestao.hidden = true;
    mostrarTipo();
    sucesso.hidden = true;
    form.hidden = false;
    form.elements.tipo[0].focus();
  });

  mostrarTipo();
}
