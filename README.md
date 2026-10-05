# siticop-webpage

Site do SITICOP-MG (siticopmg.org.br).

## Branches

- `main`: página de contingência (manutenção), estática, publicada no domínio.
- `next`: novo site em Next.js, revisado pelas URLs de preview da Vercel. O merge em `main` coloca o site novo no ar.

## Página de contingência

HTML e CSS em `public/`, sem build. O único código de servidor é o envio do formulário de CCT.

```
public/
  index.html                 página única: contatos, formulário de CCT, homologação, endereço, boletos
  404.html                   qualquer URL desconhecida (inclui as antigas do WordPress)
  styles.css
  copiar.js                  botão "Copiar" do e-mail (computador)
  js/cct-regras.js           campos, convenções e validações; usado pelo navegador e pela função
  js/cct.js                  comportamento do formulário (máscaras, erros, envio)
  fonts/                     Manrope (self-hosted)
  img/                       logo, favicon e imagem do topo do site antigo
  relatorios-de-visita/      27 PDFs de fiscalização baixados do site antigo
api/
  cct.js                     Vercel Function: valida, confere o Turnstile e envia para cct@
  _lib/gmail.js              envio pela Gmail API com conta de serviço (sem dependências)
scripts/servidor-local.mjs   servidor local que imita a Vercel (headers do vercel.json + api/)
docs/configurar-envio.md     passo a passo: Google Cloud, Admin do Workspace, Turnstile e Vercel
vercel.json                  headers de segurança, cache e redirecionamentos das URLs antigas
```

Rodar localmente (Node 22, sem `npm install`):

```bash
npm run dev
```

O site abre em http://localhost:3000. Sem as variáveis de ambiente, o formulário funciona até o envio e mostra a mensagem de erro. Para enviar de verdade a partir da sua máquina, crie um `.env.local` com as variáveis de `docs/configurar-envio.md`. O arquivo é ignorado pelo Git.

### URLs antigas

| URL antiga | Destino |
|---|---|
| `/homologacao/` | `/#homologacao` |
| `/pontos-de-apoio/` | `/#onde-estamos` |
| `/relatorios-de-visita/` | `/` |
| `/wp-content/uploads/2024/04/*.pdf` | `/relatorios-de-visita/*.pdf` |
