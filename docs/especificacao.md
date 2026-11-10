# Straut Brain — Especificação

Documento vivo com as decisões de produto. Atualizado a cada rascunho analisado.

## Contexto

A Straut presta serviço de social media para Instagram, principalmente para médicos (~5 clientes).
Fluxo: estratégia e posicionamento → roteiros → gravação presencial (~12 vídeos) → edição →
calendário com vídeos, fotos e carrosséis → aprovação da cliente → postagem.

### Requisitos obrigatórios

1. Calendário interativo para organizar posts
2. Interface clean
3. Página compartilhável com a cliente sem criação de conta
4. Todas as informações da cliente centralizadas na mesma página
5. Aprovação de roteiros e posts no mesmo calendário

---

## Página da cliente (compartilhada) — ✅ aprovada

**Acesso:** link único + senha da página (sem conta).

**Estrutura**
- Cabeçalho com o nome da cliente
- Menu de arquivos baixáveis: contratos, apresentações, vídeos, fotos + link do Drive
- Aviso visual e atrativo: "X conteúdos aguardando sua aprovação"
- (Opcional) Caixa com roteiros ainda não gravados, em formato de slides
- Calendário mensal com setas para trocar de mês e contagem de posts no mês
- Cada dia com post mostra um resumo: título, formato e status

**Vários posts no mesmo dia:** cada post é uma faixa compacta (ícone do formato + título curto +
bolinha de status). A linha da semana cresce para mostrar todos — nada fica oculto atrás de "+N".

### Pop-up do bloco

Comum a todos os formatos: data de postagem, status, legenda, botão **Aprovar**, edição e
formato no cabeçalho (alterável sem perder dados nem histórico).

| Formato   | Esquerda                                                  | Direita                          |
|-----------|-----------------------------------------------------------|----------------------------------|
| Roteiro   | Informações                                               | Texto do roteiro + botão Copiar  |
| Reels     | Vídeo + capa em miniatura ao lado                         | Informações                      |
| Carrossel | Várias fotos do mesmo tamanho, zoom e navegação por slides | Informações                      |
| Foto      | Foto única                                                | Informações                      |

### Bloco acompanha o conteúdo do início ao fim

Roteiro → aprovado → gravado → o bloco vira Reels → recebe vídeo/capa → post aprovado → publicado.
Sem poluição visual: no rodapé do pop-up, apenas uma linha discreta "Histórico · N versões" que
expande para uma linha do tempo com as versões anteriores.

### Permissões da cliente

- **Aprovar**
- **Sugerir alteração**: edita direto no texto; a sugestão aparece como no "controle de alterações"
  do Word (removido riscado, incluído em destaque). Status vira "Ajuste sugerido". A Straut
  **aceita ou recusa** — a versão oficial só muda com a confirmação da Straut.
- **Comentar**
- Data, formato e arquivos: somente a Straut.

**Autoria no histórico:** apenas "Cliente" ou "Straut".

### Mobile — 💡 em avaliação (ver protótipo antes de aprovar)

Ideia: mês inteiro em miniatura com pontinhos coloridos por status em cada dia; abaixo, lista dos
posts (tocar num dia rola até ele); filtro "Aguardando aprovação" com todos os pendentes do mês.
Preocupação do Guilherme: não perder a visão macro do mês.

---

## Dois modos de acesso — ✅ aprovado

| | Modo Straut (administrador) | Modo cliente |
|---|---|---|
| Acesso | Login da Straut (apenas o Guilherme, sem equipe por enquanto) | Link único + senha da página |
| Criar blocos ("+" no calendário) | ✅ | — |
| Upload de arquivos, mudar data e formato | ✅ | — |
| Editar texto oficial | ✅ | — |
| Aceitar/recusar sugestões | ✅ | — |
| Marcar como postado (manual) | ✅ | — |
| Aprovar | — | ✅ |
| Sugerir alteração / comentar | — | ✅ |

A página da cliente é a mesma nos dois modos; cada um vê apenas os controles que pode usar.

## Página de controle da Straut (página principal) — ✅ aprovada

Página inicial da Straut, vem antes das páginas das clientes e reúne tudo.

**Estrutura**
- Lista de clientes ativas, cada uma com o link da sua página
- Caixa **"Precisa da sua atenção"**: ajustes sugeridos e comentários novos de todas as clientes
- Calendário com todos os posts de todas as clientes (visão macro)
  - Cada cliente tem uma **cor**; o bloco mostra também o **nome da cliente**, além de título,
    formato e status
  - Filtros: posts / roteiros e por cliente
  - Filtro por cliente: o 1º clique mostra **só** aquela cliente e risca as demais; os cliques seguintes
    somam ou retiram clientes; quando todas ficam selecionadas (ou nenhuma), volta a mostrar todas.
    Botão "Mostrar todas" para limpar o filtro.
  - Mesma mecânica de pop-up do bloco, **somente visualização** (sem aprovação)
  - Pop-up mostra: conteúdo, data de postagem, aprovado ou não, postado ou não, legenda
- Painel lateral: **barra de progresso em camadas** por cliente, com a meta do contrato (ex.: 10/16)
  - Cor forte = publicados · cor média = aprovados aguardando postagem ·
    cor clara = em andamento · vazio = falta criar
  - **Roteiros aparecem só como "em andamento" e não entram na contagem de posts**

**Postado:** marcação manual pela Straut (integração com Instagram fica para uma fase futura).

## Gestão de clientes — ✅ aprovada (protótipo)

- Botão **"+ Nova cliente"** ao lado de "Clientes ativas" no painel
- Ícone de **gestão** em cada card de cliente (e botão "Gestão" na página da cliente, modo Straut)
- **Foto da cliente** (recorte quadrado), exibida na visualização de feed; sem foto, mostra as iniciais
- Campos: nome, nicho/especialidade, posts por mês (contrato), **dia de pagamento**, senha da página,
  link do Drive, cor no calendário, observações internas (não aparecem para a cliente)
- **Desativar página** (contrato cancelado): pede confirmação; a cliente perde acesso ao link
  ("página não está mais disponível"), sai do painel, do calendário geral e das barras de progresso.
  Conteúdos e histórico ficam guardados. Desativadas aparecem em "Páginas desativadas" e podem ser
  reativadas com a mesma senha.

## Arquivos da cliente — ✅ aprovado (protótipo)

- No modo Straut, a aba **Arquivos** tem a área **"Adicionar documento"**: tipo (automático, contrato,
  apresentação, documento, vídeo, foto) + **Escolher arquivos** (vários de uma vez)
- O tipo automático é definido pelo arquivo: vídeo, imagem, nome com "contrato", .ppt/.key ou "apresenta"
- Cada arquivo tem um botão para remover (com confirmação) — só a Straut vê
- A cliente vê somente a lista para baixar e o link do Drive

## Pop-up de Reels

- O título aparece só no cabeçalho do pop-up, e não mais sobre o vídeo.

## Visualização de feed — ✅ aprovada (protótipo)

- Botão **"Visualização de feed"** ao lado do título do calendário na página da cliente
- Pop-up no formato de perfil do Instagram: grade de 3 colunas, só a imagem do post
  (capa do Reels, 1ª imagem do carrossel ou a foto), do mais recente (topo) ao mais antigo
- Miniaturas sem título por cima, só a imagem, como no Instagram
- Ícone de formato (Reels/Carrossel), data e bolinha de status em cada miniatura
- Filtro: todos os planejados / só aprovados. Clicar na miniatura abre o pop-up do post.

## Ajustes visuais feitos após o primeiro teste

- Removido "Brain" ao lado do logo
- Painel lateral alinhado com o calendário geral (filtros movidos para dentro do cartão do calendário)

## Mobile — protótipo disponível para avaliação

A ideia da seção "Mobile" acima já está implementada no protótipo e aguarda a aprovação do Guilherme.

---

## Próximos passos

- [ ] Feedback final do protótipo
- [ ] Etapa 2: banco de dados, login da Straut, senha por cliente no servidor, upload de mídia,
      publicação na internet
