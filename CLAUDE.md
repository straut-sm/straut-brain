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
| Memória | Este arquivo + `README.md` + `docs/` | `straut-team/clientes/` (uma pasta por cliente; ver abaixo) |

**Passagem entre as duas.** Se a conversa de Clientes precisar de uma funcionalidade nova, ela não
implementa: descreve o pedido e manda para a conversa App. Se a App mudar algo que afeta o trabalho com
os dados (uma coluna nova, um formato novo, uma regra de status), ela atualiza a seção
"Como gravar no painel" em `clientes/README.md` (e, depois da migração, em `straut-team/clientes/README.md`).

## Memória das clientes: repositório `straut-team`

Desde 26/11/2026 a memória das clientes fica no repositório `straut-sm/straut-team`, que é
compartilhado com os bots do OpenBot (eles leem dali). A cópia local fica em
`C:UsersGuilhermeDocumentsstraut-team`.

- **Straut Brain · Clientes** lê e grava em `straut-team/clientes/<slug>/`, seguindo
  `straut-team/clientes/_modelo/`. Antes de começar: `git pull` nessa pasta. Ao terminar: commit e push
  do que mudou em `clientes/` (só fichas; essa conversa continua sem mexer em código nem deploy).
- Leia também `straut-team/CLAUDE.md` e `straut-team/equipe/regras-gerais.md`.
- A pasta local `clientes/` deste repositório (fora do git) fica como backup até a Clientes terminar a
  migração das fichas. Depois disso, não grave mais nela.
- **Nunca** grave no `straut-team`: senhas, contratos, valores, dados bancários, CPF, endereço ou dados
  de pacientes.

## Bots e lixeira

- Os bots do OpenBot acessam o painel pela API `/api/bots` (documentação em
  `straut-team/integracoes/api-dos-bots.md`). No histórico, a Straut vê o nome do bot.
- **Apagar manda para a Lixeira** (blocos, mídias e arquivos das clientes): o item fica 30 dias, pode
  ser restaurado no painel (botão Lixeira no topo) e depois é apagado de vez. Pelo SQL, nunca use
  `delete` em `blocks`, `block_media` ou `client_files`: marque `deleted_at = now()` e
  `deleted_by = 'Straut'`. Ao consultar, filtre `deleted_at is null`.

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
- Rotas: `/` painel, `/c/[slug]` página da cliente (Straut), `/p/[slug]` link da cliente, `/login`,
  `/api/bots/...` API dos bots, `/api/cron/lixeira` limpeza diária da lixeira (Vercel Cron).
- Pendências de conta, para lembrar o Guilherme quando fizer sentido: Vercel Pro (o plano Hobby não
  permite uso comercial), Supabase Pro quando o volume crescer, e confirmar que
  "Allow new users to sign up" está desligado no Supabase.
