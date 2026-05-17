# Onda 13 — Multi-broche empilhado no canvas

_Criado em 2026-05-15. Calibrado com Gabriell antes da implementação._

---

## Problema a resolver

Pedidos reais frequentemente têm múltiplos broches. Hoje o Gabriell monta isso no Corel manualmente. O Capi Studio precisa suportar esse fluxo nativamente.

---

## Decisões de produto (calibradas)

### Layout da prancha

- Broches empilhados **verticalmente**, um abaixo do outro
- Limite de **5 por coluna**
- Se houver 6 ou mais: overflow para coluna 2 (5 na primeira, resto na segunda)
- Espaçamento entre broches: a definir na calibração técnica

### Dados por broche

- Cada broche pode ter **dados diferentes** (nome, profissão, logo individuais)
- Ou pode ser **repetição** do mesmo dado (N broches idênticos)
- O sistema deve suportar os dois casos

### Padrão por broche

- Cada broche pode usar um **padrão diferente** na mesma prancha
- Ex: broche 1 com borda, broche 2 sem borda
- A prancha é mista — não há padrão único fixo pra todos

### Exportação

- Export gera **1 SVG único** com todos os broches posicionados (prancha inteira)
- A máquina de corte recebe a prancha completa
- Não há export individual por broche

---

## O que NÃO está no escopo desta onda

- Interface de gestão de pedidos (Kanban, status)
- Preview de impressão / folha A4
- Agrupamento por cliente
- Reordenação drag-and-drop dos broches na prancha

---

## Questões técnicas abertas (para Claude Code investigar antes do plano)

1. Como o `canvasJson` atual representa 1 produto — precisa de envelope para N produtos?
2. O `orderRepository` já suporta múltiplos itens por pedido no schema atual?
3. Onde vive o estado da prancha durante edição — store Zustand novo ou extensão do existente?
4. Como o motor de export SVG (Onda 9) recebe coordenadas absolutas de N broches?
