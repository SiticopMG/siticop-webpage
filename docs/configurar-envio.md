# Configurar o envio do formulário de CCT

O formulário envia para `/api/cct` (Vercel Function), que manda o e-mail pela **Gmail API** como `contato@siticopmg.org.br` para `cct@siticopmg.org.br`. Não há custo: a Gmail API faz parte do Google Workspace e a conta de serviço não precisa de faturamento.

São quatro etapas. As chaves **nunca** vão para o repositório (ele é público): ficam só nas variáveis de ambiente da Vercel.

## 1. Google Cloud: conta de serviço

1. Acesse [console.cloud.google.com](https://console.cloud.google.com) com uma conta de administrador do Workspace e crie um projeto (ex.: `siticop-site`).
2. **APIs e serviços → Biblioteca →** procure **Gmail API** → **Ativar**.
3. **IAM e administrador → Contas de serviço → Criar conta de serviço**
   - Nome: `site-formularios`. Não precisa dar nenhum papel (pode pular as etapas opcionais).
4. Abra a conta criada:
   - Em **Detalhes**, copie o **ID exclusivo** (um número longo). Ele é usado na etapa 2.
   - Em **Chaves → Adicionar chave → Criar nova chave → JSON**. O arquivo é baixado.

> Se aparecer erro dizendo que a criação de chaves está bloqueada, é a política `iam.disableServiceAccountKeyCreation` da organização. Libere para este projeto em **IAM e administrador → Políticas da organização**, como foi feito no projeto da migração.

## 2. Admin do Workspace: permissão só para enviar

1. Acesse [admin.google.com](https://admin.google.com) → **Segurança → Acesso e controle de dados → Controles de API → Gerenciar delegação em todo o domínio**.
2. **Adicionar novo**:
   - **ID do cliente:** o ID exclusivo copiado acima.
   - **Escopos OAuth:** `https://www.googleapis.com/auth/gmail.send`
3. **Autorizar**.

Com esse escopo a chave só consegue **enviar** e-mail. Ela não lê nenhuma caixa de entrada.

## 3. Cloudflare: Turnstile (antirrobô)

1. No painel da Cloudflare, abra o Turnstile pela **Pesquisa rápida** (Ctrl+K → "Turnstile") ou em **Segurança do aplicativo → Turnstile**, e clique em **Adicionar widget**.
2. Nome: `Site SITICOP`. **Hostnames:** `siticopmg.org.br` (adicione também o domínio `.vercel.app` do projeto se quiser testar nos previews). **Modo:** Gerenciado. **Pré-autorização:** Não.
3. Guarde a **Chave do site** (pública) e a **Chave secreta**.
4. A **Chave do site** fica em `public/index.html` (atributo `data-sitekey`). Já está configurada: `0x4AAAAAAFOVwO0MN_MjOQ4-`. Se o widget for recriado, troque ali.

## 4. Vercel: variáveis de ambiente

Em **Project → Settings → Environment Variables**, ambiente **Production**:

| Nome | Valor |
|---|---|
| `GMAIL_SERVICE_ACCOUNT_KEY` | O conteúdo inteiro do arquivo JSON da etapa 1 (marque como *Sensitive*) |
| `GMAIL_SENDER` | `contato@siticopmg.org.br` |
| `CCT_DESTINATARIO` | `cct@siticopmg.org.br` |
| `TURNSTILE_SECRET_KEY` | A chave secreta da etapa 3 (marque como *Sensitive*) |

Depois: **Deployments → … → Redeploy**. Apague o arquivo JSON do computador depois de colar.

Se configurar também o ambiente **Preview**, os previews enviam e-mails de verdade. Sem `TURNSTILE_SECRET_KEY`, a verificação antirrobô só é dispensada fora de produção.

## Testar

- Envie um pedido pelo site e confira a chegada em `cct@`. O assunto é `Trabalhador - Solicitação de CCT <ano>` ou `Empresa - Solicitação de CCT <ano>`, e "Responder" vai para o e-mail da pessoa.
- Se der erro, veja **Vercel → Logs** filtrando por `[cct]`. Os logs mostram só a causa técnica, nunca os dados da pessoa.

| Mensagem no log | Causa provável |
|---|---|
| `GMAIL_SERVICE_ACCOUNT_KEY não configurada` | Variável ausente ou o deploy não foi refeito |
| `Google recusou a autorização (401)` com `unauthorized_client` | Delegação da etapa 2 ausente, com ID errado ou escopo diferente |
| `Gmail recusou o envio (400)` com `failedPrecondition` | Gmail API não ativada no projeto |
| `TURNSTILE_SECRET_KEY não configurada` | Variável ausente em produção |
