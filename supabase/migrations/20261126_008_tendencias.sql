-- Aba Tendências: conteúdo semanal por cliente (pesquisado pela rotina de segunda às 10h).
-- A semana só aparece para a cliente depois que a Straut libera (published_at).

create table if not exists trend_items (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  week_of date not null,                       -- segunda-feira da semana
  kind text not null check (kind in ('mercado', 'referencia', 'gravar', 'stories')),
  title text not null default '',
  body text not null default '',
  handle text not null default '',             -- referência: @ do perfil
  link text not null default '',               -- referência: link do post
  stat text not null default '',               -- referência: número de destaque
  adapt text not null default '',              -- "como adaptar" para a cliente
  steps jsonb not null default '[]'::jsonb,    -- passo a passo (lista de textos)
  position integer not null default 0,
  created_by text not null default 'Straut',   -- 'Claude' ou 'Straut'
  published_at timestamptz,                    -- liberado para a cliente
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by text
);
create index if not exists trend_items_client_week on trend_items (client_id, week_of);

-- Última vez que a cliente abriu a aba (para o aviso "nova").
alter table clients add column if not exists trends_seen_at timestamptz;

alter table trend_items enable row level security;
revoke all on trend_items from anon, authenticated;
