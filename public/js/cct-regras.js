// Regras do pedido de Convenção Coletiva, usadas pelo navegador (public/js/cct.js)
// e pela função que envia o e-mail (api/cct.js). Mudou aqui, muda nos dois.

export const CONVENCOES = [
  '2025-2026',
  '2024-2025',
  '2023-2024',
  '2022-2023',
  '2021-2022',
  '2020-2021',
  '2019-2020',
  '2018-2019',
];

export const TIPOS = {
  trabalhador: 'Trabalhador',
  empresa: 'Empresa',
};

// Ordem e rótulos dos campos no e-mail que chega em cct@, iguais ao formulário antigo.
export const CAMPOS = {
  trabalhador: [
    ['nome', 'Nome completo'],
    ['telefone', 'Telefone'],
    ['email', 'E-mail'],
    ['cpf', 'CPF'],
    ['cnpj_empresa', 'CNPJ da empresa'],
    ['nome_empresa', 'Nome da empresa'],
    ['cargo', 'Cargo'],
    ['data_admissao', 'Data de admissão'],
    ['convencao', 'CCT'],
  ],
  empresa: [
    ['nome', 'Nome completo'],
    ['razao_social', 'Razão social'],
    ['telefone', 'Telefone'],
    ['email', 'E-mail'],
    ['cnpj', 'CNPJ'],
    ['convencao', 'CCT'],
  ],
};

export const somenteDigitos = (valor) => String(valor ?? '').replace(/\D/g, '');

export function validarCPF(valor) {
  const d = somenteDigitos(valor);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  for (const tamanho of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < tamanho; i++) soma += Number(d[i]) * (tamanho + 1 - i);
    const digito = ((soma * 10) % 11) % 10;
    if (digito !== Number(d[tamanho])) return false;
  }
  return true;
}

export function validarCNPJ(valor) {
  const d = somenteDigitos(valor);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  for (const tamanho of [12, 13]) {
    let soma = 0;
    let peso = tamanho - 7;
    for (let i = 0; i < tamanho; i++) {
      soma += Number(d[i]) * peso--;
      if (peso < 2) peso = 9;
    }
    const resto = soma % 11;
    const digito = resto < 2 ? 0 : 11 - resto;
    if (digito !== Number(d[tamanho])) return false;
  }
  return true;
}

export function formatarCPF(valor) {
  const d = somenteDigitos(valor).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
}

export function formatarCNPJ(valor) {
  const d = somenteDigitos(valor).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

export function formatarTelefone(valor) {
  const d = somenteDigitos(valor).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  const ddd = d.slice(0, 2);
  const numero = d.slice(2);
  if (numero.length <= 4) return `(${ddd}) ${numero}`;
  const corte = numero.length === 9 ? 5 : 4;
  return `(${ddd}) ${numero.slice(0, corte)}-${numero.slice(corte)}`;
}

const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[a-z]{2,}$/i;

const DOMINIOS_COMUNS = [
  'gmail.com', 'hotmail.com', 'outlook.com', 'live.com', 'icloud.com',
  'yahoo.com', 'yahoo.com.br', 'bol.com.br', 'uol.com.br', 'terra.com.br',
  'hotmail.com.br', 'outlook.com.br',
];

// Provedores reais parecidos com os comuns, que não devem receber sugestão.
const DOMINIOS_VALIDOS = ['mail.com', 'email.com', 'ymail.com', 'gmx.com', 'msn.com', 'aol.com', 'me.com'];

function distancia(a, b) {
  const linha = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let anterior = linha[0];
    linha[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const atual = linha[j];
      linha[j] = Math.min(linha[j] + 1, linha[j - 1] + 1, anterior + (a[i - 1] === b[j - 1] ? 0 : 1));
      anterior = atual;
    }
  }
  return linha[b.length];
}

// "joao@gmial.com" → "joao@gmail.com". Retorna null quando não há sugestão.
export function sugerirEmail(valor) {
  const email = String(valor ?? '').trim().toLowerCase();
  const arroba = email.lastIndexOf('@');
  if (arroba < 1) return null;
  const dominio = email.slice(arroba + 1);
  if (!dominio || DOMINIOS_COMUNS.includes(dominio) || DOMINIOS_VALIDOS.includes(dominio)) return null;
  if (dominio === 'gmail.com.br') return `${email.slice(0, arroba)}@gmail.com`;
  let melhor = null;
  let menor = 3;
  for (const comum of DOMINIOS_COMUNS) {
    const d = distancia(dominio, comum);
    if (d < menor) { menor = d; melhor = comum; }
  }
  return melhor ? `${email.slice(0, arroba)}@${melhor}` : null;
}

function hojeISO() {
  const agora = new Date();
  const local = new Date(agora.getTime() - agora.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function formatarData(iso) {
  const [ano, mes, dia] = String(iso).split('-');
  return `${dia}/${mes}/${ano}`;
}

const texto = (valor, max = 150) => String(valor ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

// Valida um campo isolado. Retorna a mensagem de erro ou '' quando está certo.
export function validarCampo(nome, valor) {
  const v = typeof valor === 'string' ? valor.trim() : valor;
  switch (nome) {
    case 'tipo':
      return v in TIPOS ? '' : 'Escolha se você é trabalhador ou empresa.';
    case 'nome':
      if (!v) return 'Escreva seu nome completo.';
      return texto(v).split(' ').length < 2 ? 'Escreva nome e sobrenome.' : '';
    case 'telefone': {
      const d = somenteDigitos(v);
      if (!d) return 'Informe o telefone com DDD.';
      if (d.length !== 10 && d.length !== 11) return 'Telefone incompleto. Use o DDD, ex.: (31) 99999-9999.';
      if (d[0] === '0') return 'Escreva o DDD sem o zero, ex.: (31) 99999-9999.';
      return d.length === 11 && d[2] !== '9' ? 'Celular começa com 9 depois do DDD, ex.: (31) 99999-9999.' : '';
    }
    case 'email':
      if (!v) return 'Informe seu e-mail. A resposta será enviada para ele.';
      return EMAIL.test(v) ? '' : 'Este e-mail não parece certo. Exemplo: nome@gmail.com';
    case 'cpf':
      if (!somenteDigitos(v)) return 'Informe seu CPF.';
      if (somenteDigitos(v).length < 11) return 'CPF incompleto. São 11 números.';
      return validarCPF(v) ? '' : 'Este CPF não é válido. Confira os números.';
    case 'cnpj':
    case 'cnpj_empresa':
      if (!somenteDigitos(v)) return nome === 'cnpj' ? 'Informe o CNPJ.' : 'Informe o CNPJ da empresa.';
      if (somenteDigitos(v).length < 14) return 'CNPJ incompleto. São 14 números.';
      return validarCNPJ(v) ? '' : 'Este CNPJ não é válido. Confira os números.';
    case 'nome_empresa':
      return v ? '' : 'Informe o nome da empresa.';
    case 'razao_social':
      return v ? '' : 'Informe a razão social.';
    case 'cargo':
      return v ? '' : 'Informe seu cargo. Exemplo: Servente';
    case 'data_admissao':
      if (!v) return 'Informe a data de admissão.';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) return 'Data inválida.';
      if (v > hojeISO()) return 'A data de admissão não pode ser no futuro.';
      return v < '1950-01-01' ? 'Data inválida.' : '';
    case 'convencao':
      return CONVENCOES.includes(v) ? '' : 'Escolha a convenção.';
    default:
      return '';
  }
}

// Valida o pedido inteiro. `dados` vem do formulário (texto); devolve os erros por campo
// e, quando está tudo certo, os valores já limpos e formatados para o e-mail.
export function validarPedido(dados) {
  const erros = {};
  const erroTipo = validarCampo('tipo', dados.tipo);
  if (erroTipo) return { ok: false, erros: { tipo: erroTipo } };

  const limpo = { tipo: dados.tipo };
  for (const [campo] of CAMPOS[dados.tipo]) {
    const erro = validarCampo(campo, dados[campo]);
    if (erro) { erros[campo] = erro; continue; }
    const valor = dados[campo];
    if (campo === 'cpf') limpo.cpf = formatarCPF(valor);
    else if (campo === 'cnpj' || campo === 'cnpj_empresa') limpo[campo] = formatarCNPJ(valor);
    else if (campo === 'telefone') limpo.telefone = formatarTelefone(valor);
    else if (campo === 'email') limpo.email = String(valor).trim().toLowerCase();
    else limpo[campo] = texto(valor);
  }
  return Object.keys(erros).length ? { ok: false, erros } : { ok: true, dados: limpo };
}
