// Servidor local que imita a Vercel: serve public/ com os headers do vercel.json
// e executa as funções de api/. Lê variáveis de .env.local, se existir.
//
//   npm run dev            → http://localhost:3000
//   PORTA=4173 npm run dev

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const publico = join(raiz, 'public');
const porta = Number(process.env.PORTA) || 3000;

try {
  for (const linha of (await readFile(join(raiz, '.env.local'), 'utf8')).split('\n')) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
} catch {}

const config = JSON.parse(await readFile(join(raiz, 'vercel.json'), 'utf8'));
const regrasHeaders = config.headers.map(({ source, headers }) => ({
  regex: new RegExp(`^${source.replace(/\(\.\*\)/g, '.*').replace(/\((\w+(\|\w+)*)\)/g, '($1)')}$`),
  headers,
}));

const tipos = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.pdf': 'application/pdf',
};

async function arquivo(caminho) {
  const alvo = normalize(join(publico, caminho));
  if (!alvo.startsWith(publico)) return null;
  for (const tentativa of [alvo, `${alvo}.html`, join(alvo, 'index.html')]) {
    try {
      if ((await stat(tentativa)).isFile()) return tentativa;
    } catch {}
  }
  return null;
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  for (const regra of regrasHeaders) {
    if (regra.regex.test(url.pathname)) for (const { key, value } of regra.headers) res.setHeader(key, value);
  }

  if (url.pathname.startsWith('/api/')) {
    const nome = url.pathname.slice(5).replace(/[^a-z0-9-]/gi, '');
    let modulo;
    try {
      modulo = await import(pathToFileURL(join(raiz, 'api', `${nome}.js`)).href);
    } catch {
      res.writeHead(404).end();
      return;
    }
    const handler = modulo[req.method];
    if (!handler) {
      res.writeHead(405).end();
      return;
    }
    const partes = [];
    for await (const parte of req) partes.push(parte);
    const request = new Request(url, {
      method: req.method,
      headers: req.headers,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(partes),
    });
    const resposta = await handler(request);
    res.writeHead(resposta.status, Object.fromEntries(resposta.headers));
    res.end(Buffer.from(await resposta.arrayBuffer()));
    return;
  }

  const encontrado = await arquivo(decodeURIComponent(url.pathname));
  if (!encontrado) {
    res.writeHead(404, { 'Content-Type': tipos['.html'] }).end(await readFile(join(publico, '404.html')));
    return;
  }
  res.writeHead(200, { 'Content-Type': tipos[extname(encontrado)] ?? 'application/octet-stream' });
  res.end(await readFile(encontrado));
}).listen(porta, () => console.log(`Site local em http://localhost:${porta}`));
