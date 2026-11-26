-- Lixeira: o que é apagado (blocos, mídias e arquivos das clientes) fica 30 dias guardado,
-- pode ser restaurado e só depois é apagado de vez (junto com os arquivos do armazenamento).

alter table public.blocks add column if not exists deleted_at timestamptz;
alter table public.blocks add column if not exists deleted_by text;
alter table public.block_media add column if not exists deleted_at timestamptz;
alter table public.block_media add column if not exists deleted_by text;
alter table public.client_files add column if not exists deleted_at timestamptz;
alter table public.client_files add column if not exists deleted_by text;

create index if not exists blocks_deleted_idx on public.blocks (deleted_at) where deleted_at is not null;
create index if not exists block_media_deleted_idx on public.block_media (deleted_at) where deleted_at is not null;
create index if not exists client_files_deleted_idx on public.client_files (deleted_at) where deleted_at is not null;
