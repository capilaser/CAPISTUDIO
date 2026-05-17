# ADR 018 — Largura máxima das páginas hub (Onda 25 Fase F)

**Status:** Aceito
**Data:** 2026-05-17
**Onda:** 25 (Designer + Deploy hardening)

## Contexto

Auditoria `/hm-designer` apontou que as páginas hub (`/inicial`, `/arte`) usam
`mx-auto max-w-5xl` (~1024 px de conteúdo útil). A janela Tauri tem `minWidth:
1200` mas roda em monitores típicos do operador entre 1440 px e 1920 px.
Resultado: barras laterais vazias de 200–450 px de cada lado em telas amplas.

A regra do skill é explícita: "Full-width layout como padrão. Não centralizar
conteúdo em caixas estreitas quando a tela tem espaço."

Avaliamos três opções:

1. **Full-width true** (`max-w` removido) — conteúdo ocupa toda a largura.
   Funciona pra editor/canvas, mas em listas de cards (pedidos recentes,
   hub de Arte) gera linhas com 8+ cards em 1920 px que viram cansativas
   de varrer e produzem cards muito largos individualmente.
2. **Max amplo `max-w-[1600px]`** — resolve as barras vazias em 1920 px
   mantendo legibilidade em 4K. Cada card tem largura aceitável.
3. **Manter `max-w-5xl`** — assume operador só em laptop pequeno. Mas
   a Capi Laser já usa um setup desktop com monitor grande.

## Decisão

Adotamos a **opção 2 — `max-w-[1600px]`** nas páginas hub.

Páginas afetadas:

- [`src/ui/pages/inicial/InicialPage.tsx`](../../src/ui/pages/inicial/InicialPage.tsx)
- [`src/ui/pages/arte/ArteHubPage.tsx`](../../src/ui/pages/arte/ArteHubPage.tsx)

**Páginas que NÃO ficam constrained** (já são full-width por desenho):

- `/arte/novo` — editor, ocupa tela toda
- `/padroes` — listagem densa, `p-6` sem max-w
- `/banco`, `/banco-apliques` — listagens densas, `p-6` sem max-w
- `/padroes/editar/:id`, `/padroes/novo` — editor

## Consequências

Positivas:

- Em 1920×1080 desktop, /inicial mostra mais cards de pedido por linha sem
  esforço visual. Sem barras laterais > 200 px.
- Em 4K (3840×2160) o limite de 1600 px continua amigável — não vira parede
  de cards.
- Em laptop 1366×768 (worst-case esperado), `max-w-[1600px]` é maior que a
  viewport — o layout cai para `mx-auto` natural sem mudar.

Negativas / aceitas:

- Padding lateral (`p-8`) fica relativamente menor proporcionalmente em telas
  amplas. Aceitável — o conteúdo respira via `gap-8` interno.

## Alternativa rejeitada

Full-width sem limite (opção 1) é a abordagem do editor mas não funciona em
hubs com cards. Linear/Vercel também usam max-w em landing/marketing dashboards
e full-width só em workspace.

Manter `max-w-5xl` (opção 3) viola a regra de design e tem ficou marcado
visualmente em revisões — é o tipo de detalhe que diferencia ferramenta de
template.

## Implementação

Substitui-se apenas `max-w-5xl` por `max-w-[1600px]` em InicialPage e
ArteHubPage. Grids existentes (`sm:grid-cols-2 lg:grid-cols-3`) ganham
breakpoint extra `2xl:grid-cols-4` em InicialPage pra aproveitar a largura
extra com mais densidade.

ArteHubPage tem só 3 cards (Novo / Abrir / Criar Padrão) — mantém
`md:grid-cols-3` sem expandir.
