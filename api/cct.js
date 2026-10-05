// Recebe o pedido de Convenção Coletiva do formulário e envia para cct@ pela Gmail API.
// Nenhum dado do pedido é gravado nem registrado em log (LGPD).
//
// Variáveis de ambiente (além das de api/_lib/gmail.js):
//   CCT_DESTINATARIO      caixa que recebe os pedidos (padrão: cct@siticopmg.org.br)
//   TURNSTILE_SECRET_KEY  chave secreta do Cloudflare Turnstile

import { CAMPOS, TIPOS, formatarData, validarPedido } from '../public/js/cct-regras.js';
import { enviarEmail } from './_lib/gmail.js';

const TAMANHO_MAXIMO = 10_000;
const TEMPO_MINIMO_MS = 3_000;

const responder = (status, corpo) =>
  Response.json(corpo, { status, headers: { 'Cache-Control': 'no-store' } });

const escaparHtml = (texto) =>
  String(texto).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function mesmaOrigem(request) {
  const origem = request.headers.get('origin');
  if (!origem) return true;
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  try {
    return new URL(origem).host === host;
  } catch {
    return false;
  }
}

async function verificarTurnstile(token, ip) {
  const segredo = process.env.TURNSTILE_SECRET_KEY;
  if (!segredo) {
    // Sem a chave só é aceitável fora de produção (servidor local, previews sem configuração).
    if (process.env.VERCEL_ENV === 'production') throw new Error('TURNSTILE_SECRET_KEY não configurada');
    return true;
  }
  if (!token) return false;
  const resposta = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: new URLSearchParams({ secret: segredo, response: token, ...(ip && { remoteip: ip }) }),
  });
  const resultado = await resposta.json();
  return resultado.success === true;
}

function montarEmail(dados) {
  const linhas = CAMPOS[dados.tipo].map(([campo, rotulo]) => {
    let valor = dados[campo];
    if (campo === 'data_admissao') valor = formatarData(valor);
    if (campo === 'convencao') valor = `Convenção ${valor}`;
    return [rotulo, valor];
  });

  const assunto = `${TIPOS[dados.tipo]} - Solicitação de CCT ${dados.convencao}`;
  const texto = `${assunto}\n\n${linhas.map(([r, v]) => `${r}: ${v}`).join('\n')}\n\nPara responder, use "Responder": a resposta vai para ${dados.email}.\n`;
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;padding:24px;background:#f3f6f7;font-family:Arial,Helvetica,sans-serif;color:#0d2733">
<table role="presentation" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#ffffff;border:1px solid #d5e0e5">
<tr><td style="padding:20px 24px;background:#023a51;color:#ffffff;font-size:18px;font-weight:bold">${escaparHtml(assunto)}</td></tr>
<tr><td style="padding:8px 24px 16px">
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:15px">
${linhas.map(([r, v]) => `<tr><td style="padding:10px 16px 10px 0;border-bottom:1px solid #eef3f5;font-weight:bold;white-space:nowrap;vertical-align:top">${escaparHtml(r)}</td><td style="padding:10px 0;border-bottom:1px solid #eef3f5">${escaparHtml(v)}</td></tr>`).join('\n')}
</table>
<p style="margin:16px 0 0;font-size:13px;color:#3f5661">Enviado pelo formulário do site siticopmg.org.br. Use "Responder" para responder direto a ${escaparHtml(dados.email)}.</p>
</td></tr></table></body></html>`;

  return { assunto, texto, html };
}

export async function POST(request) {
  if (!mesmaOrigem(request)) return responder(403, { erro: 'origem' });
  if (!request.headers.get('content-type')?.includes('application/json')) return responder(415, { erro: 'formato' });

  const bruto = await request.text();
  if (bruto.length > TAMANHO_MAXIMO) return responder(413, { erro: 'tamanho' });

  let entrada;
  try {
    entrada = JSON.parse(bruto);
  } catch {
    return responder(400, { erro: 'formato' });
  }
  if (!entrada || typeof entrada !== 'object') return responder(400, { erro: 'formato' });

  // Robôs: campo invisível preenchido ou envio rápido demais. Responde "ok" sem enviar nada.
  const inicio = Number(entrada.inicio);
  if (entrada.site || !Number.isFinite(inicio) || Date.now() - inicio < TEMPO_MINIMO_MS) {
    return responder(200, { ok: true });
  }

  const dados = {};
  for (const [chave, valor] of Object.entries(entrada)) {
    if (typeof valor === 'string') dados[chave] = valor;
  }

  const validacao = validarPedido(dados);
  if (!validacao.ok) return responder(422, { erro: 'validacao', campos: validacao.erros });

  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim();
    if (!(await verificarTurnstile(dados['cf-turnstile-response'], ip))) {
      return responder(403, { erro: 'verificacao' });
    }

    const { assunto, texto, html } = montarEmail(validacao.dados);
    await enviarEmail({
      para: process.env.CCT_DESTINATARIO || 'cct@siticopmg.org.br',
      responderPara: validacao.dados.email,
      nomeExibicao: validacao.dados.nome,
      assunto,
      texto,
      html,
    });
    return responder(200, { ok: true });
  } catch (erro) {
    // Só a mensagem técnica; os dados da pessoa nunca vão para o log.
    console.error('[cct] falha no envio:', erro.message);
    return responder(502, { erro: 'envio' });
  }
}
