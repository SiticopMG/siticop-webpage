// Envio de e-mail pela Gmail API com conta de serviço (delegação em todo o domínio, escopo gmail.send).
// Sem dependências: o JWT é assinado com node:crypto e as chamadas usam fetch.
//
// Variáveis de ambiente:
//   GMAIL_SERVICE_ACCOUNT_KEY  conteúdo do JSON da chave da conta de serviço
//   GMAIL_SENDER               conta do Workspace que envia (ex.: contato@siticopmg.org.br)

import { createSign } from 'node:crypto';

const ESCOPO = 'https://www.googleapis.com/auth/gmail.send';
const URL_TOKEN = 'https://oauth2.googleapis.com/token';
const URL_ENVIO = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

const base64url = (dados) => Buffer.from(dados).toString('base64url');

let tokenEmCache = null;

function lerChave() {
  const bruto = process.env.GMAIL_SERVICE_ACCOUNT_KEY;
  if (!bruto) throw new Error('GMAIL_SERVICE_ACCOUNT_KEY não configurada');
  const { client_email: email, private_key: chave } = JSON.parse(bruto);
  if (!email || !chave) throw new Error('GMAIL_SERVICE_ACCOUNT_KEY incompleta');
  return { email, chave };
}

async function obterToken(remetente) {
  const agora = Math.floor(Date.now() / 1000);
  if (tokenEmCache && tokenEmCache.remetente === remetente && tokenEmCache.expira - 60 > agora) {
    return tokenEmCache.valor;
  }

  const { email, chave } = lerChave();
  const cabecalho = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const corpo = base64url(JSON.stringify({
    iss: email,
    sub: remetente,
    scope: ESCOPO,
    aud: URL_TOKEN,
    iat: agora,
    exp: agora + 3600,
  }));
  const assinatura = createSign('RSA-SHA256').update(`${cabecalho}.${corpo}`).sign(chave, 'base64url');

  const resposta = await fetch(URL_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${cabecalho}.${corpo}.${assinatura}`,
    }),
  });
  if (!resposta.ok) throw new Error(`Google recusou a autorização (${resposta.status}): ${await resposta.text()}`);

  const { access_token: valor, expires_in: duracao } = await resposta.json();
  tokenEmCache = { remetente, valor, expira: agora + duracao };
  return valor;
}

// Cabeçalho com acentos no formato RFC 2047. Quebras de linha são removidas para impedir injeção de cabeçalhos.
const cabecalhoUtf8 = (texto) => `=?UTF-8?B?${Buffer.from(String(texto).replace(/[\r\n]+/g, ' ')).toString('base64')}?=`;

const base64Quebrado = (texto) => Buffer.from(texto).toString('base64').replace(/.{76}/g, '$&\r\n');

function montarMensagem({ de, nomeExibicao, para, responderPara, assunto, texto, html }) {
  const limite = `siticop-${Date.now().toString(36)}`;
  const linhas = [
    `From: ${nomeExibicao ? `${cabecalhoUtf8(nomeExibicao)} ` : ''}<${de}>`,
    `To: ${para}`,
    responderPara && `Reply-To: ${responderPara}`,
    `Subject: ${cabecalhoUtf8(assunto)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${limite}"`,
    '',
    `--${limite}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    base64Quebrado(texto),
    `--${limite}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    base64Quebrado(html),
    `--${limite}--`,
    '',
  ];
  return linhas.filter((linha) => linha !== undefined && linha !== false && linha !== null).join('\r\n');
}

// Envia um e-mail como GMAIL_SENDER. `responderPara` deve vir já validado (sem quebras de linha).
export async function enviarEmail({ para, responderPara, nomeExibicao, assunto, texto, html }) {
  const de = process.env.GMAIL_SENDER;
  if (!de) throw new Error('GMAIL_SENDER não configurado');
  if (/[\r\n]/.test(`${para}${responderPara ?? ''}`)) throw new Error('Endereço inválido');

  const token = await obterToken(de);
  const mensagem = montarMensagem({ de, nomeExibicao, para, responderPara, assunto, texto, html });

  const resposta = await fetch(URL_ENVIO, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: base64url(mensagem) }),
  });
  if (!resposta.ok) throw new Error(`Gmail recusou o envio (${resposta.status}): ${await resposta.text()}`);
  return resposta.json();
}
