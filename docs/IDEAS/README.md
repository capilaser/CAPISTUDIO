# Pasta `IDEAS/`

> Features futuras propostas durante a construção do projeto.

## Diferença entre `IDEAS/` e `DEBT.md`

| `docs/IDEAS/`                       | `docs/DEBT.md`                                      |
| ----------------------------------- | --------------------------------------------------- |
| **Coisas novas** que queremos fazer | **Coisas erradas** no código que precisam consertar |
| Features futuras                    | Bugs e dívida técnica                               |
| Sem prioridade fixa                 | Tem severidade 🔴🟡🟢                               |
| Gabriell decide quando fazer        | Resolve quando bloquear ou na limpeza geral         |

## Formato de cada ideia (`.md`)

Cada arquivo deve ter:

1. **Resumo** — uma frase explicando a ideia
2. **Problema que resolve** — qual dor a feature atende
3. **Contexto técnico** — o que já existe relacionado, o que mudaria
4. **Esboço de implementação** — caminho técnico provável (sem detalhes)
5. **Quando faz sentido** — antes/depois de qual onda
6. **Origem** — quando foi proposta e por quem

## Como adicionar uma ideia

Gabriell fala "registra essa ideia: [descrição]" e o Claude (chat consultor) monta o `.md` correspondente.

## Ideias registradas

- `drag-and-drop-painel-camadas.md` — Drag and drop no painel de camadas (Onda 7 entregou via botões)
- `onda-9-export-respeita-layer-visible.md` — Onda 9 deve ler `LayerMeta.visible`, `appliqueId` e `engravingId` (contrato técnico crítico)
- `onda-10-ui-cadastro-bancos.md` — UI completa de cadastro dos 3 bancos (Apliques, Gravações, Marcações) — runtime copy + normalize
- `onda-13-cleanup-geometry-type.md` — Mover `RectMm` pra `src/lib/geometry.ts` neutro (cleanup arquitetural pós Mini-Onda 8.6)
