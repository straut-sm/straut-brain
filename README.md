# Straut Brain

Sistema interno da Straut Marketing para controlar conteúdos, aprovações e clientes.

## Endereços

| Rota | Quem acessa | O que é |
|---|---|---|
| `/login` | Straut | Login (Supabase Auth, e-mail e senha) |
| `/` | Straut | Painel de controle |
| `/c/[cliente]` | Straut | Página da cliente em modo de edição |
| `/p/[cliente]` | Cliente | Link compartilhado com a senha da página, sem conta |

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
