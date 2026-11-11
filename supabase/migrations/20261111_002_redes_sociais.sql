-- Links das redes sociais da cliente (aparecem no cabeçalho da página dela)
alter table clients
  add column if not exists instagram_url text not null default '',
  add column if not exists tiktok_url text not null default '';
