# STATUS — Onda 2A (Faxina Cirúrgica)

**Data:** 2026-05-22
**Branch:** `restart/v2-beta`
**Status:** ✅ CONCLUÍDA

---

## Resumo

Faxina radical: tudo que está fora do escopo definido em [PROJECT_VISION.md](../PROJECT_VISION.md) foi apagado. Repositório pronto para a Onda 2B (sistema de arquivos do projeto) e Onda 2D (canvas mínimo do MVP).

## Histórico de commits

```
375fb35 chore(faxina): Onda 2A - reset radical para base enxuta
35f8c54 chore: snapshot pre-faxina (Onda 33 + DXF v2 + Onda 37)
1c209ed backup: snapshot _legacy-backup/ antes da faxina
892dbf9 docs: PROJECT_VISION.md — nova alma do projeto
```

## Métricas

| Métrica                         | Antes                        | Depois                                 |
| ------------------------------- | ---------------------------- | -------------------------------------- |
| Arquivos `.ts/.tsx` em `src/`   | ~217                         | **67**                                 |
| Arquivos de teste               | ~50                          | **13**                                 |
| Tests passando                  | (mistura de patterns/orders) | **115/115 verdes**                     |
| `npm run typecheck`             | ⚠ misturado                  | ✅ verde                               |
| `npm run lint`                  | —                            | ✅ 0 erros (5 warnings pre-existentes) |
| Linhas apagadas no commit final | —                            | **44.105**                             |

## O que sobrou em `src/`

```
src/
├── app/
│   ├── App.tsx               ← tela "Em reconstrução" (será substituída Onda 2C)
│   └── main.tsx
├── core/
│   ├── canvas/
│   │   ├── alignment/        ← snap-engine, distance/proximity calculator, guides-diff
│   │   └── units.ts          ← mmToPx / pxToMm (puro, testado)
│   └── export/
│       ├── dxf-document.ts          ─┐
│       ├── dxf-coordinate-normalize ─┤ módulos DXF baixo nível
│       ├── dxf-process-color.ts     ─┤ (do trabalho da DXF v2)
│       ├── dxf-spline-encoder.ts    ─┤ Onda 4 vai recompor exporter
│       ├── dxf-path-to-splines.ts   ─┤ por cima destes.
│       ├── dxf-writer.ts            ─┘
│       ├── path-flattener.ts        ← util de geometria
│       ├── svg-shape-to-path.ts     ← util de geometria
│       ├── svg-path-transform.ts    ← util de transformação mm
│       ├── svg-text-converter.ts    ← vetorização opentype.js
│       ├── font-precheck.ts         ← validação pré-export
│       └── pattern-thumbnail.ts     ← (legado, revisar uso)
├── data/
│   ├── client.ts             ← Drizzle + plugin-sql
│   ├── transaction.ts        ← wrapper de transação Tauri
│   ├── schema.ts             ← inteiro (limpeza fica para Onda 2B)
│   ├── migrations/           ← legacy SQL (revisar antes da Onda 2B)
│   ├── seeds/                ← machines, operations, fonts, categories,
│   │                           materials, materialFamilies, products,
│   │                           settings (8 seeds)
│   └── repositories/         ← machines, operations, fonts, categories,
│                               materials, materialFamilies, products,
│                               productLayer, settings (9 repos)
├── hooks/
│   ├── useAltKey.ts
│   └── useTauriVersion.ts
├── lib/
│   ├── cn.ts
│   ├── format-mm.ts
│   ├── machine-codes.ts      ← MB/FB/DL ↔ M1/M2/M3
│   └── normalize-asset-name.ts
├── services/
│   ├── tauri-io.ts           ← interface limpa fs/shell/path
│   └── font-buffer-loader.ts ← carregamento de fontes p/ opentype
├── stores/
│   └── canvas-store.ts       ← reset minimal (sem BoardItem)
├── styles/
│   └── globals.css
└── ui/
    ├── canvas/               ← VAZIO (Onda 2D vai recriar)
    │   └── ... (a criar)
    └── components/           ← shadcn primitives:
                                 badge, button, card, context-menu,
                                 dialog, dropdown-menu, empty-state,
                                 input, label, select, skeleton,
                                 sonner (Toaster), tabs, tooltip,
                                 FontLoader
```

## O que sobrou em `tests/`

```
tests/
├── core/
│   └── canvas/
│       ├── alignment/        ← 5 testes (snap, distance, proximity, guides, alignment-commands)
│       └── units.test.ts
├── data/
│   ├── transaction.test.ts
│   ├── materialRepository.test.ts
│   └── seedFonts.test.ts
├── core/export/
│   ├── dxf-writer.test.ts
│   └── path-flattener.test.ts
├── lib/
│   ├── machine-codes.test.ts
│   └── normalize-asset-name.test.ts
└── fixtures/
```

**13 test files, 115 testes — todos verdes.**

## O que foi preservado para resgate futuro

### Em `_legacy-backup/` (commit 1c209ed)

- 4 logos SVG do usuário (`logos/*.svg`)
- 21 padrões customizados (`patterns-svg/*.canvas.json`)
- DB e backups SQLite (gitignored, locais)
- Catálogos JSON (products, materials, fonts, machines, operations, etc.)
- `extract.py` reexecutável

### Em commit 35f8c54 (snapshot pre-faxina, git history)

Recuperável via `git checkout 35f8c54 -- <path>`:

- **DXF v2 completo** (ADR 020):
  - `src/core/export/dxf-exporter-v2.ts`
  - `src/core/export/routing-resolver.ts`
  - `src/core/export/asset-routing-types.ts`
  - `src/core/export/slot-content-promoter.ts`
  - `src/services/dxf-export-service-v2.ts`
  - - 8 testes correspondentes
- **Canvas engine Onda 33**:
  - `src/core/canvas/canvas-engine.ts` (2.348 linhas)
  - `src/core/canvas/engine-layers.ts` (957 linhas)
  - `src/core/canvas/engine-serialization.ts`
  - `src/core/canvas/slot-manager.ts`
  - `src/core/canvas/pattern-area-bridge.ts`
- **Exporters legados funcionais**:
  - `src/core/export/svg-exporter.ts` (estável, 426+ testes)
  - `src/core/export/png-exporter.ts`
  - `src/core/export/dxf-exporter.ts` (R12)
- **Pages**:
  - `src/ui/pages/arte/NovoPedidoPage.tsx` + subcomponentes
  - `src/ui/pages/padroes/*` (Pattern editor completo)
  - `src/ui/pages/inicial/InicialPage.tsx`
  - - outras
- **layer-panel** completo (14 componentes UI Onda 33)

### O que ficou em git history e NÃO será resgatado

- Sistema de Padrão Mestre vs Arte do Pedido (escopo morreu)
- BoardItemDraft + multi-broche (escopo morreu)
- Pattern classification UI (escopo morreu)
- Slot system (escopo morreu)
- Order/OrderItem/OrderRevision domain (substituído por filesystem)
- pages/dev/ canvas-test sandbox (refazer enxuto na Onda 2D se necessário)
- pages/banco-apliques (escopo morreu)

## Próximo passo: Onda 2B — Sistema de arquivos do projeto

Conforme [PROJECT_VISION.md §15](../PROJECT_VISION.md):

- Definir formato `projeto.cps.json` (canvas state + camadas + meta)
- Service Tauri (Rust) para CRUD de pasta de projeto:
  - criar estrutura `/projetos/<nome>/{assets,base,exports/{png,svg,dxf/{MB,FB,DL}},mockups,historico,config}`
  - listar projetos da raiz
  - ler/escrever `.cps.json`
  - gerar thumbnail
- Settings: raiz dos projetos (default `<Documents>\Capi Studio\projetos\`)
- Repository `projectFsRepository` que substitui orderRepository
- **Drop das tabelas SQL** que ficaram órfãs no schema (orders, order_items, order_revisions, order_overrides, appliques, engravings, markings, logos, slotTypes, patternLayers, patterns) + migration de remoção
- Schema final mantém: machines, operations, machineOperations, fonts, categories, materials, materialFamilies, products, productLayers, productMachines, settings

## Riscos e observações

1. **schema.ts ainda tem tabelas mortas** (orders/patterns/etc.) — não foram dropadas para evitar quebrar migrations. Onda 2B vai criar migration `drop-dead-tables` antes de adicionar novas.
2. **Repositories de produto/aplique/categoria ficaram** mesmo sem páginas — usam `schema.ts`. Vão ser usados na Onda 2B/2D para popular catálogo de produtos (broche 60×25 é seed).
3. **Migrations SQL embarcadas no Rust** (`src-tauri/migrations/`) não foram tocadas — Onda 2B revisa.
4. **`src/core/export/pattern-thumbnail.ts` ainda existe** — pode ter referência viva no Rust ou no service de export antigo. Confirmar e apagar na Onda 2B se ortogonal.
5. **`coverage/` está no working tree** (vem do vitest --coverage anterior) — adicionar ao .gitignore se ainda não estiver.
