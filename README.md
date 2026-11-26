# Straut Brain

Sistema interno da Straut Marketing para controlar conteúdos, aprovações e clientes.

## Endereços

| Rota | Quem acessa | O que é |
|---|---|---|
| `/login` | Straut | Login (Supabase Auth, e-mail e senha) |
| `/` | Straut | Painel de controle |
| `/c/[cliente]` | Straut | Página da cliente em modo de edição |
| `/p/[cliente]` | Cliente | Link compartilhado com a senha da página, sem conta |
| `/c/[cliente]/producao/[id]` | Straut | Dia de produção: roteiros para gravar, em lista (ordem, gravado, escondido) |
| `/p/[cliente]/producao/[id]` | Cliente | O mesmo dia de produção, só para ver |
| `/api/bots/...` | Bots (OpenBot) | API dos bots, com a chave `BOTS_API_KEY` (veja abaixo) |

Produção: `painel.strautmarketing.com` (Vercel).

## Arquitetura

- **Next.js 15** (App Router) + TypeScript + Tailwind CSS 4, com a identidade visual Straut.
- **Supabase** (região São Paulo): banco Postgres, login da Straut e armazenamento privado
  (buckets `midia` e `arquivos`).
- O banco fica **fechado**: RLS ativo e nenhuma permissão para `anon` ou `authenticated`. Todo acesso
  passa por Server Actions (`src/app/actions.ts`), que conferem antes:
  - o login da Straut (o usuário precisa estar na tabela `admins`); ou
  - o cookie assinado da cliente (HMAC), criado depois de conferir a senha (bcrypt).
- Mídias e arquivos são enviados direto do navegador ao Supabase, com links de upload assinados
  pelo servidor, e exibidos por links temporários (1 h).
- A estrutura do banco está em `supabase/migrations/`.

## Variáveis de ambiente

Copie para `.env.local` (local) e para **Vercel → Settings → Environment Variables** (produção):

| Variável | Onde obter |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → API Keys → Publishable key |
| `SUPABASE_SECRET_KEY` | Supabase → API Keys → Secret keys (**nunca** comitar) |
| `CLIENT_SESSION_SECRET` | Texto aleatório com 32 caracteres ou mais |
| `BOTS_API_KEY` | Chave da API dos bots: texto aleatório com 32 caracteres ou mais, a mesma no OpenBot. Sem ela, a API fica fechada |

## API dos bots

Porta de acesso dos bots do OpenBot, em `src/app/api/bots/[...path]/route.ts` (roteador) e
`src/lib/bots.ts` (regras). A documentação completa, com as rotas e exemplos, fica no repositório do
time: `straut-team/integracoes/api-dos-bots.md`.

- Cabeçalhos: `Authorization: Bearer <BOTS_API_KEY>` e `X-Bot: <nome-do-bot>`.
- Limite de 60 requisições por minuto por bot; toda chamada fica registrada em `bot_requests`.
- Os bots podem apagar, marcar como publicado e aceitar sugestões. Aprovar, restaurar versões e o
  cadastro das clientes continuam só no painel.
- **Lixeira:** apagar (pelo painel ou pela API) só marca `deleted_at`. O item fica 30 dias na Lixeira
  (botão no topo do painel), pode ser restaurado e depois é apagado de vez, com os arquivos, pela
  rotina diária `/api/cron/lixeira` (Vercel Cron, `vercel.json`) e por uma limpeza oportunista ao abrir
  o painel. Código em `src/lib/trash.ts`.
- O histórico guarda o nome do bot em `block_history.bot`. A Straut vê "Straut · bot design"; a
  cliente vê só "Straut".
- Comentários dos bots são internos (`block_comments.internal`): só a Straut vê.
- Nunca devolve senha, dia de pagamento, observações, arquivos da cliente nem chaves.

## Dia de produção

Evento no calendário (tabela `events`, `kind = producao`). Não é post: não conta na meta e não tem status.
A página lista os roteiros da cliente ainda não gravados em outro dia de produção. A ordem e as marcações
(`production_items.state`: `pendente`, `gravado`, `oculto`) são só visuais: não mudam a data nem o status do bloco.
Apagar o evento manda para a Lixeira. Código em `src/components/ProductionView.tsx`.

## Como rodar

Requer Node.js 20 ou superior.

```bash
npm install
npm run dev
```

Abra http://localhost:3000.

## Administradores

Crie o usuário em Supabase → Authentication → Users e depois adicione-o à tabela `admins`:

```sql
insert into public.admins (user_id) select id from auth.users where email = 'email@exemplo.com';
```

Mantenha **"Allow new users to sign up"** desligado no Supabase.
