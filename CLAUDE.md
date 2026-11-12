# Straut Brain: guia para o Claude

Painel interno da Straut Marketing (https://painel.strautmarketing.com) para os conteúdos de
Instagram das clientes. Responda sempre em português. Para a arquitetura do sistema, veja o `README.md`;
para as regras do produto, veja `docs/especificacao.md`.

## Duas conversas, dois focos

O trabalho fica dividido em duas conversas. Cada uma tem um papel diferente e as duas podem mexer no
painel. Descubra pelo título da conversa qual é a sua; na dúvida, pergunte.

| | **Straut Brain · App** | **Straut Brain · Clientes** |
|---|---|---|
| Foco | Funcionalidades do painel | Dados das clientes, análises, pautas e roteiros |
| Mexe em | Código (`src/`), migrações (`supabase/migrations/`), Vercel, git | Só **linhas** do banco: `blocks`, `block_history`, `block_comments`, campos de `clients` |
| Não mexe em | Conteúdo das clientes (exceto para testar, e desfazendo depois) | Código, estrutura do banco, commits, deploy |
| Ferramentas | Editor, terminal, Supabase (migrações), Vercel | mLabs, Instagram de pesquisa (navegador do Claude), pesquisa na web, Supabase (SQL de dados) |
| Memória | Este arquivo + `README.md` + `docs/` | `clientes/` (uma ficha por cliente + `clientes/README.md`) |

**Passagem entre as duas.** Se a conversa de Clientes precisar de uma funcionalidade nova, ela não
implementa: descreve o pedido e manda para a conversa App. Se a App mudar algo que afeta o trabalho com
os dados (uma coluna nova, um formato novo, uma regra de status), ela atualiza a seção
"Como gravar no painel" em `clientes/README.md`.

## Regras que valem para as duas

- **Segredos:** nunca peça nem mostre senhas ou chaves no chat. O `.env.local` e a chave secreta do
  Supabase nunca vão para o GitHub.
- **Login:** o Claude não digita senhas. Quando precisar de login (Instagram de pesquisa, painel), o
  Guilherme entra sozinho no navegador do Claude.
- **Domínio:** não mexer no domínio principal `strautmarketing.com` nem nos registros de e-mail.
- **Dados reais:** as clientes usam o painel de verdade. Não apague nem sobrescreva blocos existentes
  sem pedir; prefira criar blocos novos.
- **Instagram de pesquisa:** só leitura. Não curtir, seguir, comentar nem mandar mensagem.

## Infraestrutura

- Supabase: projeto `phhahgfprdbdarvcgvso` (São Paulo). SQL pelo conector do Supabase.
- Vercel: deploy automático a cada push na `main` (repositório `straut-sm/straut-brain`).
- Rotas: `/` painel, `/c/[slug]` página da cliente (Straut), `/p/[slug]` link da cliente, `/login`.
- Pendências de conta, para lembrar o Guilherme quando fizer sentido: Vercel Pro (o plano Hobby não
  permite uso comercial), Supabase Pro quando o volume crescer, e confirmar que
  "Allow new users to sign up" está desligado no Supabase.
