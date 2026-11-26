-- Eventos no calendário (por enquanto só "Produção de conteúdo") e a lista do dia de produção.
-- O evento não é um post: não conta na meta, não tem status nem mídia.

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  date date not null,
  kind text not null default 'producao' check (kind in ('producao')),
  title text not null default 'Produção de conteúdo',
  notes text not null default '',
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by text
);
create index if not exists events_client_idx on public.events (client_id, date);
create index if not exists events_deleted_idx on public.events (deleted_at) where deleted_at is not null;

-- Marcação de cada roteiro no dia de produção. Só identificação visual: não muda o bloco.
-- pendente = para gravar · gravado = já gravado · oculto = escondido (não será gravado nesse dia)
create table if not exists public.production_items (
  event_id uuid not null references public.events(id) on delete cascade,
  block_id uuid not null references public.blocks(id) on delete cascade,
  position integer not null default 0,
  state text not null default 'pendente' check (state in ('pendente', 'gravado', 'oculto')),
  updated_at timestamptz not null default now(),
  primary key (event_id, block_id)
);
create index if not exists production_items_block_idx on public.production_items (block_id);

alter table public.events enable row level security;
alter table public.production_items enable row level security;
revoke all on public.events from anon, authenticated;
revoke all on public.production_items from anon, authenticated;
