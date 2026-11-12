-- Roteiro com formato planejado: diz se o roteiro vai virar um vídeo (reels), carrossel ou foto.
-- Ao "avançar" o roteiro aprovado, o bloco passa a ter esse formato.
alter table blocks
  add column if not exists planned_format text
  check (planned_format in ('reels', 'carrossel', 'foto'));

-- O campo "notes" da cliente passa a ser o "Posicionamento da cliente":
-- contexto que a IA lê antes de produzir para ela (procedimentos, tom de voz, público, design).
comment on column clients.notes is 'Posicionamento da cliente: contexto para a IA (procedimentos, tom de voz, público, design). Só a Straut vê.';
