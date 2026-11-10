-- Straut Brain — estrutura inicial do banco
-- Acesso: todas as tabelas com RLS ativo e SEM políticas públicas.
-- O site acessa os dados apenas pelo servidor (chave secreta), depois de
-- conferir o login da Straut ou a senha da página da cliente.

create extension if not exists pgcrypto;

-- Administradores (Straut) ------------------------------------------------
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Clientes ---------------------------------------------------------------
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (length(trim(name)) > 0),
  specialty text not null default '',
  color text not null default '#b5785c',
  contract_posts integer not null default 12 check (contract_posts between 1 and 99),
  payment_day integer not null default 10 check (payment_day between 1 and 31),
  password_hash text not null,
  drive_url text not null default '',
  active boolean not null default true,
  notes text not null default '',
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Blocos de conteúdo (roteiro → post) ------------------------------------
create table public.blocks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  date date not null,
  title text not null default 'Novo conteúdo',
  format text not null default 'roteiro' check (format in ('roteiro', 'reels', 'carrossel', 'foto')),
  status text not null default 'em_producao'
    check (status in ('em_producao', 'aguardando_aprovacao', 'ajuste_sugerido', 'aprovado', 'publicado')),
  caption text not null default '',
  script text not null default '',
  -- Sugestão pendente da cliente: { field, original, proposed, at }
  suggestion jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index blocks_client_date_idx on public.blocks (client_id, date);
create index blocks_date_idx on public.blocks (date);

-- Mídias do bloco (vídeo, capa, imagens) ---------------------------------
create table public.block_media (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references public.blocks (id) on delete cascade,
  kind text not null check (kind in ('video', 'cover', 'image')),
  path text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index block_media_block_idx on public.block_media (block_id, kind, position);

-- Histórico do bloco ------------------------------------------------------
create table public.block_history (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references public.blocks (id) on delete cascade,
  at timestamptz not null default now(),
  author text not null check (author in ('Straut', 'Cliente')),
  action text not null,
  -- Versão do bloco ANTES da ação: { format, title, caption, script, date }
  before jsonb
);
create index block_history_block_idx on public.block_history (block_id, at);

-- Comentários --------------------------------------------------------------
create table public.block_comments (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references public.blocks (id) on delete cascade,
  at timestamptz not null default now(),
  author text not null check (author in ('Straut', 'Cliente')),
  text text not null check (length(trim(text)) > 0),
  seen boolean not null default false
);
create index block_comments_block_idx on public.block_comments (block_id, at);

-- Arquivos da cliente (contratos, apresentações…) ------------------------
create table public.client_files (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('contrato', 'apresentacao', 'documento', 'video', 'foto')),
  size_bytes bigint not null default 0,
  path text not null,
  created_at timestamptz not null default now()
);
create index client_files_client_idx on public.client_files (client_id, created_at desc);

-- updated_at automático ----------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger clients_touch before update on public.clients
  for each row execute function public.touch_updated_at();
create trigger blocks_touch before update on public.blocks
  for each row execute function public.touch_updated_at();

-- Segurança: RLS em tudo, nenhuma política para anon/authenticated ------
alter table public.admins enable row level security;
alter table public.clients enable row level security;
alter table public.blocks enable row level security;
alter table public.block_media enable row level security;
alter table public.block_history enable row level security;
alter table public.block_comments enable row level security;
alter table public.client_files enable row level security;

revoke all on all tables in schema public from anon, authenticated;

-- Armazenamento privado (acesso só por links assinados gerados no servidor)
insert into storage.buckets (id, name, public)
values
  ('midia', 'midia', false),
  ('arquivos', 'arquivos', false)
on conflict (id) do nothing;
