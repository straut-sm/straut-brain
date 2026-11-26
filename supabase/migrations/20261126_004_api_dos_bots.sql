-- API dos bots (OpenBot): quem fez o quê e registro de acessos.

-- Nome do bot que fez a ação (null = pessoa da Straut ou cliente). A cliente vê só "Straut".
alter table public.block_history add column if not exists bot text;

-- Comentários dos bots: internos (só a Straut vê) e com o nome do bot.
alter table public.block_comments add column if not exists bot text;
alter table public.block_comments add column if not exists internal boolean not null default false;

-- Registro de cada chamada à API dos bots (também usado para o limite por minuto).
create table if not exists public.bot_requests (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  bot text not null,
  method text not null,
  route text not null,
  block_id uuid,
  status integer not null
);
create index if not exists bot_requests_bot_at_idx on public.bot_requests (bot, at desc);
create index if not exists bot_requests_at_idx on public.bot_requests (at desc);

alter table public.bot_requests enable row level security;
revoke all on public.bot_requests from anon, authenticated;
