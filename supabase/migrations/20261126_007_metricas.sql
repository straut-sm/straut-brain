-- Métricas do Instagram (vindas do mLabs pela rotina diária do Claude).
-- A cliente sem sincronização (metrics_synced_at vazio) vê os gráficos desfocados.

alter table clients
  add column if not exists mlabs_profile_id text,
  add column if not exists metrics_synced_at timestamptz;

-- Link do post publicado: liga o bloco ao post do Instagram (correção manual do pareamento).
alter table blocks add column if not exists instagram_url text not null default '';

-- Um post publicado no Instagram, com os números do mLabs.
create table if not exists ig_posts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  external_id text not null,              -- id do post no mLabs
  permalink text not null default '',     -- https://www.instagram.com/p/<código>/
  published_at timestamptz not null,
  date date not null,                     -- dia da publicação (horário de São Paulo)
  format text not null check (format in ('reels', 'carrossel', 'foto')),
  caption text not null default '',
  thumbnail_url text not null default '',
  reach integer not null default 0,
  views integer not null default 0,
  likes integer not null default 0,
  comments integer not null default 0,
  saves integer not null default 0,
  shares integer not null default 0,
  reason text not null default '',        -- "por que foi bem" (top 3 do mês)
  reason_by text,                         -- 'Claude' ou 'Straut'
  updated_at timestamptz not null default now(),
  unique (client_id, external_id)
);
create index if not exists ig_posts_client_date on ig_posts (client_id, date);

-- Seguidores por dia.
create table if not exists ig_followers (
  client_id uuid not null references clients(id) on delete cascade,
  date date not null,
  followers integer not null,
  primary key (client_id, date)
);

alter table ig_posts enable row level security;
alter table ig_followers enable row level security;
revoke all on ig_posts from anon, authenticated;
revoke all on ig_followers from anon, authenticated;
