# Straut Brain

Todo o conhecimento sobre os produtos da Straut.

Sistema interno da agência Straut Marketing para controle de processos e clientes.

## Status

**Etapa 1: protótipo de visualização.** As telas funcionam com dados fictícios, que ficam salvos só no navegador.
Ainda não há banco de dados, login real nem upload de arquivos.

- `/`: painel de controle da Straut
- `/c/[cliente]`: página da cliente (modo Straut)
- `/c/[cliente]?visao=cliente`: página da cliente como a cliente vê (senha do protótipo: `straut`)

As decisões de produto estão em [docs/especificacao.md](docs/especificacao.md).

## Como rodar

Requer Node.js 20 ou superior.

```bash
npm install
npm run dev
```

Abra http://localhost:3000.

## Tecnologia

Next.js 15 (App Router) + TypeScript + Tailwind CSS 4. As fontes da marca são Bai Jamjuree e Poppins,
e a paleta segue o Manual da Identidade Visual.
