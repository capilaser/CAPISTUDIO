# AUDITORIA ARQUITETURAL — Capi Studio v2 vs Spec "Templates Inteligentes"

**Data:** 2026-05-18
**Branch:** onda-26 (com working tree de Onda 28 + Onda 27 final)
**Modo:** Diagnóstico read-only. **Nenhum arquivo foi modificado.**

**Documentos de referência (spec alvo):**

- `CAPISTUDIO_FLUXO_MVP.md` — pipeline operacional 6 etapas
- `CAPISTUDIO_ARQUITETURA_TEMPLATES.md` — modelo de dados dos templates
- `CAPISTUDIO_ENGINE_CRIACAO_PADROES.md` — tela de criação

**Audits prévios usados como base:**

- `AUDIT_ONDA28.md` (working tree estática, Onda 27/28)
- `REPORT_FOR_ANALYSIS.md` (visão geral do estado)

---

## ÍNDICE

1. [Sumário executivo](#1-sumário-executivo)
2. [Visão geral da arquitetura atual](#2-visão-geral-da-arquitetura-atual)
3. [Comparação spec × atual por subsistema](#3-comparação-spec--atual-por-subsistema)
4. [Tabela mestre: 25 gaps prioritizados](#4-tabela-mestre--25-gaps-prioritizados)
5. [Gambiarras, dual-paths e zumbis](#5-gambiarras-dual-paths-e-zumbis)
6. [O que reaproveitar / refatorar / remover](#6-o-que-reaproveitar--refatorar--remover)
7. [Plano de ondas](#7-plano-de-ondas)
8. [Estimativa de risco e sequência ideal](#8-estimativa-de-risco-e-sequência-ideal)
9. [Apêndice: arquivos críticos](#9-apêndice-arquivos-críticos)

---

## 1. Sumário executivo

### O estado em uma frase

O Capi Studio v2 hoje é um **editor SVG multi-broche funcional** com pipeline de export PNG/SVG/DXF rodando end-to-end. A spec "templates inteligentes" exige um **sistema paramétrico** com classificação semântica de elementos, snapshot real do template no pedido, processos/máquinas por camada e Asset Library completa. A distância é grande mas **não é refazer o projeto** — é evoluir o modelo de tipos, o schema e duas telas (criação de template + abertura de pedido).

### As 3 distâncias mais profundas

1. **Modelo de tipos** — atual tem 3 kinds (`principal | operation | visual`) + 4 slot types (PT). Spec tem 9 tipos formais com distinção AREA vs ASSET. **Não é renomear — é re-tipar e migrar canvasJson.**
2. **Unidade interna** — engine opera em **pixels** (`MM_TO_PX = 4`, conversões em todas as bordas Fabric). Spec exige **mm internamente**. Custo alto: centenas de chamadas `mmToPx`/`pxToMm`.
3. **Snapshot do template** — pedido grava `boardCanvasJson` agregado serializado + FK `patternId` viva. Soft-delete do pattern arrebenta reabertura. Spec exige **cópia congelada do template** no pedido.

### As 3 oportunidades mais altas

1. **Asset Library** quase pronta: 5 dos 7 buckets já existem (Produtos, Apliques, Logos, Engravings, Markings). Faltam só `TextosPadrao` e `Contornos` — e Contornos é discutível (cabe em `appliques.operation='corte'`).
2. **Engine de fit** matematicamente já existe (slot-manager.addLogo + fit-text), só está espalhada. Consolidar num `FitEngine` é puramente refactor.
3. **PadraoEditorPage** já é o esqueleto da tela do designer — basta evoluí-la pra cobrir os 8 passos da spec (hoje cobre 3).

### O que está pronto, parcial, ausente

| Conceito da spec                                            | Status                                                   | Onde                                             |
| ----------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------ |
| PNG preview                                                 | ✅ Pronto                                                | `png-exporter.ts`                                |
| SVG por máquina                                             | ✅ Pronto                                                | `svg-exporter.ts`                                |
| DXF por máquina×operação                                    | ✅ Pronto                                                | `dxf-exporter.ts`                                |
| Cores oficiais CORTE/GRAV/MARC                              | ✅ Hardcoded em 2 lugares                                | `svg-exporter.ts:60`, `dxf-writer.ts:34`         |
| Texto → curva no export                                     | ✅ Pronto (variable fonts falham)                        | `svg-text-converter.ts`                          |
| Multi-chapa                                                 | ✅ Pronto                                                | `board-exporter.ts`                              |
| Snapshot por revisão (canvas serializado)                   | 🟡 Parcial — congela canvasJson, não congela pattern     | `order_revisions.items_json`/`board_canvas_json` |
| Hierarquia parent-child                                     | 🟡 Existe (2 níveis rígidos), filhos podem ficar órfãos  | `LayerMeta.parentLayerId`                        |
| TEXT_AREA / LOGO_AREA                                       | 🟡 Existe via `SlotManager`, sem distinção AREA vs ASSET | `slot-manager.ts`                                |
| Engraving/Marking                                           | 🟡 Tipados como `VisualLayerMeta` indistintos            | `canvas-engine.addEngravingSvg/addMarkingSvg`    |
| OperationLayerMeta                                          | 🟡 Existe no schema, **dormente** (export não consulta)  | `svg-exporter.ts:305-308`                        |
| Processo+máquinas por camada                                | 🟡 Modelado **no asset**, não no pedido                  | `appliques.operation/machines` em DB             |
| Locks granulares (position/scale/rotation/structure)        | ❌ Só `LayerMeta.locked: boolean` global                 | `schema.ts:189,247,269`                          |
| 9 tipos da spec (PRODUCT, CONTOUR, TEXT_PRESET, LOGO_ASSET) | ❌ Não existem como tipos formais                        | —                                                |
| Unidade interna mm                                          | ❌ Engine usa px                                         | `units.ts:1-9`                                   |
| IDs formais (templateId/nodeId/instanceId)                  | ❌ Só `obj.id` + `capiSlot.id` (dual-path)               | `capi-id.ts:35-44`                               |
| Snapshot real do template no pedido                         | ❌ Hoje é FK viva                                        | `order_items.patternId`                          |
| Bucket `TextosPadrao`                                       | ❌ Sem tabela                                            | —                                                |
| Bucket `Contornos`                                          | ❌ Sem tabela (subsumido em apliques)                    | —                                                |
| Importar SVG arbitrário no designer                         | ❌ Designer trabalha só sobre produto base               | `PadraoEditorPage.tsx:117-148`                   |
| UI de processo+máquinas no designer                         | ❌ Backend tem, frontend não expõe                       | `UploadApliqueDialog.tsx:86-87` (hardcoded)      |
| Asset Library unificada `/banco`                            | ❌ Stub vazio; banco real disperso em 4 superfícies      | `BancoPage.tsx`                                  |
| Confirmação forte em "Atualizar padrão mestre"              | ❌ Save direto sem dialog                                | `PadraoEditorPage.tsx:389-398`                   |
| Pasta por pedido no export                                  | ❌ Fase C.5 pendente                                     | UI export salva flat                             |

### Métricas de saúde herdadas dos audits prévios

| Métrica                       | Valor                             | Avaliação                                    |
| ----------------------------- | --------------------------------- | -------------------------------------------- |
| Arquivos `.ts/.tsx` em `src/` | 182                               | OK                                           |
| Testes Vitest                 | ~545–565 verdes (≥80% em `core/`) | Sólido                                       |
| TODOs/FIXMEs em `src/`        | 0                                 | Excelente                                    |
| `console.log/warn/error`      | 38 estruturados                   | Limpo                                        |
| `as any/unknown` casts        | 110 (106 em `canvas-engine.ts`)   | Localizados                                  |
| Arquivos > 500 linhas         | 8                                 | `canvas-engine.ts` 3.412 é o único alarmante |
| Migrations SQL                | 12 versões cumulativas            | Bem versionado                               |
| ADRs                          | 19                                | Decisões documentadas                        |
| Ondas concluídas              | 28 (Onda 28 em curso)             | Ciclo ativo                                  |

---

## 2. Visão geral da arquitetura atual

### 2.1 Stack (travada via CLAUDE.md v2)

| Camada        | Tech                              |
| ------------- | --------------------------------- |
| Shell         | Tauri 2 (Rust + WebView)          |
| Frontend      | React 19 + TS 5.8 + Vite 7        |
| Canvas        | Fabric.js 6                       |
| UI            | shadcn/ui "new-york" + Tailwind 3 |
| Estado        | Zustand (1 store)                 |
| Banco         | SQLite via `tauri-plugin-sql`     |
| ORM           | Drizzle                           |
| Forms         | RHF + Zod (parcial)               |
| Texto→path    | opentype.js                       |
| Drag layers   | dnd-kit                           |
| Empacotamento | Tauri bundler → MSI Win x64       |
| Testes        | Vitest + RTL + jsdom              |

### 2.2 Estrutura de pastas

```
src/
├── app/        (2)   — entrypoint, router
├── core/             — regras puras (zero DOM nominal)
│   ├── canvas/  (23) — engine Fabric, slot-manager, alignment, snap, fit-text
│   ├── export/  (9)  — png/svg/dxf exporters, board-exporter, opentype bridge
│   ├── patterns/(0)  — PASTA VAZIA
│   ├── orders/  (0)  — PASTA VAZIA
│   ├── products/(0)  — PASTA VAZIA
│   └── validation/(0)— PASTA VAZIA
├── data/       (38)  — schema, repos, seeds, migrations, client, transaction
├── ui/         (87)  — pages, components, canvas overlays, layer-panel
├── stores/     (1)   — canvas-store.ts (Zustand único)
├── hooks/      (6)   — useBoardEngine, useCanvasEngine, useCanvas/OrderShortcuts
├── services/   (11)  — tauri-io, png/svg/dxf-export-service, asset-lookup, storage
└── lib/        (3)   — cn, normalize-asset-name, sanitize-svg
src-tauri/             — main.rs, db_tx.rs, migrations/ (12 SQL)
tests/                  — 42 arquivos, ~565 testes
docs/                   — ARCHITECTURE, DECISIONS/ (19 ADRs), STATUS-ONDA-XX, DEBT
```

**Sinal arquitetural:** 4 pastas vazias em `src/core/` (`patterns/`, `orders/`, `products/`, `validation/`) indicam planejamento que nunca migrou — as regras vivem em `data/repositories/` (operações de banco) e em `useBoardEngine` (orquestração). **A separação "regra de negócio pura" não foi consumada.**

### 2.3 Top 10 hotspots (linhas)

| #   | Arquivo                                               | Linhas    |
| --- | ----------------------------------------------------- | --------- |
| 1   | `src/core/canvas/canvas-engine.ts`                    | **3.412** |
| 2   | `tests/core/canvas/canvas-engine.test.ts`             | 800       |
| 3   | `src/ui/canvas/LayerPanel.tsx`                        | 792       |
| 4   | `src/hooks/useBoardEngine.ts`                         | 767       |
| 5   | `src/ui/pages/arte/NovoPedidoPage.tsx`                | 764       |
| 6   | `src/ui/pages/arte/novo-pedido/NovoPedidoSidebar.tsx` | 751       |
| 7   | `src/core/canvas/slot-manager.ts`                     | 714       |
| 8   | `tests/data/orderRepository.test.ts`                  | 703       |
| 9   | `tests/core/export/board-exporter.test.ts`            | 676       |
| 10  | `src/data/schema.ts`                                  | 656       |

`canvas-engine.ts` é o único arquivo "perigoso" para manter no longo prazo (CLAUDE.md proíbe >300 linhas em UI; em core não há regra explícita, mas é dívida).

### 2.4 Pilares hoje (versus os 3 do CLAUDE.md)

CLAUDE.md define 3 pilares: **Canvas**, **Produtos**, **Padrões**.

- **Canvas:** sólido. Engine única `CanvasEngine` em Fabric, snap puro, alignment puro, multi-broche via `useBoardEngine`. Hierarquia 2 níveis com 7 invariantes (ADR 010).
- **Produtos:** modelado em DB (`products`, `product_layers`, `product_machines`, `materials`, `material_families`, `categories`). **Sem UI de cadastro de produto** — vem só de seeds.
- **Padrões:** modelado como tabela `patterns` com `canvasJson` serializado + tabela paralela `pattern_layers` (zumbi sem `update()`) + `pattern_slots` (cache redundante). 11 patterns seedados. UI de criação parcial em `PadraoEditorPage`.

A spec adiciona um 4º pilar implícito: **Asset Library** (7 buckets). Hoje 5 buckets existem (Produtos, Apliques, Logos, Engravings, Markings) + 1 não-spec (`svg_bases`, matéria-prima). Faltam `TextosPadrao` e `Contornos`.

---

## 3. Comparação spec × atual por subsistema

### 3.1 Canvas Engine (`src/core/canvas/canvas-engine.ts` + slot-manager)

#### Modelo de tipos

**Atual:**

```ts
type LayerMeta =
  | PrincipalLayerMeta { kind:'principal', appliqueId, materialId, originalBounds, parentLayerId: null }
  | OperationLayerMeta { kind:'operation', operation, machines[1..3], parentLayerId: string }
  | VisualLayerMeta    { kind:'visual',   materialId, engravingId?, markingId?, parentLayerId?: string }
```

**Spec:** 9 tipos formais com distinção AREA (placeholder bounds+meta) vs ASSET (vetor real).

**Mapeamento:**

| Spec              | Atual                                                                                   | Estado                                                         |
| ----------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| PRODUCT           | flag `__capiBase` no Fabric obj (fora de LayerMeta)                                     | **Conflito** — não é LayerMeta                                 |
| APPLIQUE          | `PrincipalLayerMeta` com `appliqueId`                                                   | ✅ Compatível                                                  |
| CONTOUR           | implícito em `productPaths`/`productSvgViewBox`                                         | **Ausente** como tipo                                          |
| TEXT_AREA         | `SlotMeta {type:'nome'/'profissao'/'custom'}` + body Rect com `excludeFromExport=false` | ✅ Conceito presente                                           |
| LOGO_AREA         | `SlotMeta {type:'logo'}` body Rect                                                      | ✅ Conceito presente                                           |
| LOGO_ASSET        | `entry.content: fabric.Group` em slot, `excludeFromExport=true`                         | **Conflito** — não é entidade separada, é conteúdo descartável |
| TEXT_PRESET       | `entry.content: fabric.Text`, idem                                                      | **Ausente** — não há preset formalizado                        |
| ENGRAVING_PATTERN | `VisualLayerMeta {engravingId}`                                                         | 🟡 Tipado como visual genérica                                 |
| MARKING_GUIDE     | `VisualLayerMeta {markingId}`                                                           | 🟡 Tipado como visual genérica                                 |

**Conflito crítico:** spec separa AREA (placeholder persistido só com bounds) de ASSET (vetor persistido). Atual amarra os dois numa estrutura "slot com `entry.content` excluído do export" — não há como persistir um TEXT_PRESET final dentro de TEXT_AREA, nem distinguir TEXT_PRESET solto de ENGRAVING_PATTERN solto.

#### Unidades

`units.ts:1-9`:

```ts
export const MM_TO_PX = 4;
export const mmToPx = (mm) => mm * 4;
export const pxToMm = (px) => px / 4;
```

**Engine opera em px.** Fabric guarda left/top/width/height em px. Conversão acontece **só nas bordas** (entrada via `addRectangle(xMm,...)` → mmToPx; saída via `getObjectGeometryMm` → pxToMm; snap recebe mm convertendo em cada handler).

**Custo de migração mm-first:** alto — centenas de chamadas Fabric usam px. Toda integração snap/align/serialize/deserialize teria que rebobinar. DPI ratio 4 documentado em ADR 005.

#### Hierarquia parent-child

`parentLayerId` em LayerMeta + 7 invariantes em `layer-meta.ts:54-150`. Profundidade máxima **2 níveis** (principal → operation/visual). Nunca operation → visual.

**Conflito com spec:** spec diz "aplique tem filhos CORTE/GRAVAÇÃO/MARCAÇÃO que exportam juntos e nunca ficam órfãos".

- `addEngravingSvg`/`addMarkingSvg` aceitam `parentLayerId: null` (canvas-engine.ts:1998-2009, 2069-2080) — **pode ficar órfão**.
- Export hoje **não respeita hierarquia** — `svg-exporter` agrupa por `operation+machineId`, não por aplique pai. No DXF, filtro "centro de bbox dentro da chapa" pode descartar filho enquanto preserva o pai (apliques **parcialmente órfãos no DXF**).
- `deleteLayer` faz cascata em principal→filhos (canvas-engine.ts:1240-1274) mas só se `parentLayerId === id`.

#### Locks

`LayerMeta.locked: boolean` (único). Engine mapeia pra `lockMovementX/Y` + `lockScalingX/Y` + `lockRotation` Fabric juntos (canvas-engine.ts:980-1010), com tratamento especial para slots/visuais (sempre `lockRotation=true`).

**Spec exige granularidade {position, scale, rotation, structure}.** `structure` não tem equivalente Fabric — precisaria ser camada de validação no engine (rejeitar reparent/delete de child).

#### Identidade

Dual-path documentado em `capi-id.ts:8-15`:

- `obj.id` — UUID nos objetos comuns
- `obj.capiSlot.id` — id de slot (não copiado para `obj.id`)
- `getCapiId(obj)` resolve `obj.id ?? capiSlot.id`

**Risco real:**

- `findById` (canvas-engine.ts:152-156, usa `obj.id`) coexiste com `findByCapiId` (922-926).
- `applyMaterialToLayer` (1490) e `removeMaterialFromLayer` (1697) usam `findById` — **slots não recebem material por esse caminho**.
- STRIP-RESTORE (serialize) usa `findById` — funciona por acidente porque slot bodies têm `fill: 'transparent'` (sem Pattern). Quebra no dia em que slots ganharem material.

**Spec exige 5 IDs formais:** `templateId`, `nodeId`, `instanceId`, `orderId`, `assetId`. Hoje:

- `templateId` → `patterns.id` em DB (não no canvas)
- `nodeId` → **ausente** (vive em `capiSlot.id` no JSON, sem persistência relacional)
- `instanceId` → `obj.id` de facto; **regenerado a cada `saveRevision`** (orderRepository delete-all + insert-all)
- `orderId` → `orders.id` ✅
- `assetId` → `appliques.id/engravings.id/markings.id/logos.id` ✅ (mas dispersos por kind)

#### Engine de fit (contain + preserveAspect + centered + noRotate + noStretch)

**Existe parcialmente, espalhada:**

- `fitText` (fit-text.ts:16-48) — só fit de TEXTO via busca binária de fontSize.
- `slot-manager.addLogo` (slot-manager.ts:280-298) implementa **contain + preserveAspect + centered** manualmente com `Math.min(maxW/natW, maxH/natH)`.
- `syncContentToBody` (slot-manager.ts:490-552) recalcula a cada drag/resize.
- `noRotate` via `lockRotation:true` em slot bodies (slot-manager.ts:661).
- `noStretch` implícito — não existe flag.

**Sem API unificada `FitConfig`/`FitEngine`.** Migrar pra spec exige extrair math em engine única.

#### Material (Pattern Fabric + STRIP-RESTORE)

Mecanismo `serialize()` (canvas-engine.ts:2877-2944):

1. Strip: salva `fill: Pattern` em `savedFills`, `clipPath` em `savedClipPaths`, substitui por `transparent`.
2. `canvas.toObject([...CAPI_CUSTOM_PROPS])`.
3. Restore: re-aplica pattern/clipPath nos objetos vivos.

**Razão (correta):** Pattern referencia URL Tauri stale entre installs; clipPath é derivado de `productPaths` deterministicamente.

**Riscos:**

- Ordem do strip-restore frágil — return prematuro corrompe canvas vivo.
- Usa `findById`, não `findByCapiId` — slots não levam material.
- Asset deletado → `resolveUrl` rejeita → `applyMaterialToLayer` faz `console.warn` em DEV, **silent fail em prod**.
- Bug "material dourado→prata" (DEBT.md) ainda em aberto.

#### Texto → curva no export

Atual: `fabric.Text` vivo no canvas, opentype.js vetoriza no export (`svg-exporter` + `dxf-exporter`). Variable fonts (Roboto Slab) falham silenciosamente, viram placeholder XML (SVG) ou são ignoradas (DXF). Toast estruturado no callback `onTextConversionError`.

**Compatível com spec** em conceito. Risco: falha silenciosa pode passar pro laser sem operador perceber.

---

### 3.2 Sistema de persistência (schema + repos + seeds)

#### Inventário de 22 tabelas e cobertura da Asset Library

| Bucket spec      | Tabela atual         | Status | Observação                                   |
| ---------------- | -------------------- | ------ | -------------------------------------------- |
| Produtos         | `products` (l.78)    | ✅     | base SVG inline + viewBox                    |
| Apliques         | `appliques` (l.575)  | ✅     | operation + machines obrigatórios em runtime |
| Logos            | `logos` (l.536)      | ✅     | **sem operation/machines** (assume gravação) |
| **TextosPadrao** | ❌ Ausente           | —      | Sem tabela `text_presets`                    |
| **Contornos**    | ❌ Ausente           | —      | Subsumido em `appliques.operation='corte'`   |
| GravacoesPadrao  | `engravings` (l.600) | ✅     | `categoryId` nullable FK                     |
| Marcacoes        | `markings` (l.621)   | ✅     | `categoryId` nullable FK                     |

Tabelas extras: `material_families`, `materials`, `categories`, `fonts`, `slot_types` (catálogo), `operations` (catálogo, 7 ids), `machines` (catálogo, 3 ids), `machine_operations` (N:N), `product_machines` (N:N), `product_layers`, `pattern_layers`, `pattern_slots`, `svg_bases`, `orders`, `order_items`, `order_revisions`, `order_overrides` (zumbi), `settings`, `export_history`.

#### Drifts catálogo × validação

| Lugar A                                                                                               | Lugar B                                                                           | Drift                                                 |
| ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `operations` SQL (7 ids: contorno, corte-laser, corte, gravacao, marcacao, aplique, gravacao-aplique) | `_export-validation.ts:15` (`VALID_OPERATIONS = ['corte','marcacao','gravacao']`) | **3 vs 7** — banco aceita valores que runtime rejeita |
| `slotTypes` SQL (6 ids EN: logo, name, profession, free-text, qrcode, image)                          | `SlotType` TS (4 ids PT: 'logo'\|'nome'\|'profissao'\|'custom')                   | **Conflito de idioma e cardinalidade**                |
| `pattern_slots.slot_type` (text NOT NULL)                                                             | `slot_types.id`                                                                   | Sem FK SQL — só "logical FK"                          |
| `appliques.operation` (text NOT NULL DEFAULT 'corte')                                                 | `operations.id`                                                                   | Sem FK SQL                                            |
| `appliques.machines` (text JSON DEFAULT '[]')                                                         | runtime exige `≥1`                                                                | **Banco aceita `'[]'`**, runtime quebra               |

#### Snapshot do template — ilusão de congelamento

`order_revisions` (l.498) tem `items_json TEXT NOT NULL` (cópia) + `board_canvas_json TEXT NOT NULL DEFAULT '{}'` (cópia).

**MAS:**

- `order_items.patternId` é **FK viva** (l.470). Soft-delete do pattern → `getPatternById` retorna `null` na reabertura (patternRepository filtra `deleted_at IS NULL`).
- `order_items.canvas_json` foi **zerado a `'{}'`** pela migration 0011 (linhas 47-53). Schema TS e código de write **continuam populando o campo** — drift declarativo.
- `instanceId` (order_items.id) é **regenerado** a cada `saveRevision` (orderRepository:467-470 delete-all + insert-all com `crypto.randomUUID()`). **Quebra estabilidade de ID.**
- Snapshot do canvas serializado existe; snapshot da **identidade do template** não existe — pattern continua "vivo" do ponto de vista da FK.

#### Validação Zod ausente em I/O do canvasJson

- `patternRepository.safeParseCanvasJson` (l.161-176): só `JSON.parse + typeof object + 'objects' in parsed + Array.isArray`. Não valida tipos internos, schemaVersion, formato de layers.
- `orderRepository`: cast direto `as OrderFields` (l.158), sem validação.
- `revisionRepository.parseItems` (l.52-59): só `JSON.parse + Array.isArray`.
- **`FabricCanvasJsonSchema` não existe** apesar de Zod estar instalado e usado em `seeds/schemas.ts`.

**Consequência:** JSON corrompido vira `null` silencioso (REPORT_FOR_ANALYSIS.md §5.2.4). Pedido pode "sumir".

#### Tabelas zumbi

- `pattern_layers` (l.378-397) — sem `update()`, sem caller que sincronize com `canvasJson.capi.layers`. Duplicação morta.
- `order_overrides` (l.520-532) — declarada com kind/before/after, **não importada** em nenhum hot-path.

#### Migrations — risco

12 migrations cumulativas. **3 swap clássicos** (SQLite não suporta DROP COLUMN/ALTER): 0008, 0009, 0012. Cada um com `PRAGMA foreign_keys=OFF` — falha parcial = banco quebrado. Migration 0011 zera `order_items.canvas_json` destrutivamente sem refator do write.

#### Sem backup automático do SQLite (risco existencial)

REPORT_FOR_ANALYSIS.md §10.1.5 já alarmou. Se operador formatar máquina, perde tudo. Fix trivial (30 min de código).

---

### 3.3 Pipeline de exportação

#### Topologia

```
UI (ExportPngDialog | ExportSvgDialog)
  ↓ chama com canvas vivo + layers + boardDims + chapaInfos + assetLookup
core/export (png/svg/dxf/board-exporter)
  ↓ Map<machine,svg> ou Map<bucket,dxf> ou Uint8Array PNG
services (png/svg/dxf-export-service)
  ↓ escreve via TauriIO
TauriIO real
```

**Fronteira core ↔ services limpa.** UI viola levemente: `ExportSvgDialog.tsx:29,220` importa `setSetting` direto de `data/repositories` (achado #13 do AUDIT_ONDA28.md). Multi-chapa em UI duplica lógica que deveria estar em service.

#### Cobertura conceitual

| Spec                                  | Status                                                           | Detalhe                                                                                                                                                                                              |
| ------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PNG preview de aprovação              | ✅                                                               | png-exporter.ts. Sem gate "pedido aprovado" — dialog livre                                                                                                                                           |
| SVG por máquina                       | ✅                                                               | svg-exporter.ts:139-376 — `Map<machine,svg>`                                                                                                                                                         |
| SVG por máquina **e** processo        | ❌                                                               | Junta processos no mesmo SVG, diferencia só por cor de stroke                                                                                                                                        |
| DXF por máquina×operação              | ✅                                                               | dxf-exporter.ts:96-299 — `Map<"machine\|op", dxf>`                                                                                                                                                   |
| Cores oficiais (preto/vermelho/azul)  | ✅ Hardcoded em 2 lugares                                        | svg-exporter.ts:60 + dxf-writer.ts:34                                                                                                                                                                |
| Apliques exportam JUNTO com filhos    | 🟡 Sem agrupamento explícito                                     | Filhos podem ser perdidos por filtro de chapa no DXF (centro do bbox); SVG inclui geometria fora do viewBox                                                                                          |
| Texto→curva no export                 | ✅                                                               | opentype.js; variable fonts falham                                                                                                                                                                   |
| processType+machineTargets por camada | 🟡 Modelado no asset (DB), override só pra texto (`textRouting`) | Pedido não pode redirecionar aplique/gravação sem editar o asset master                                                                                                                              |
| Snapshot por pedido                   | 🟡                                                               | Export lê canvas vivo; canvas é hidratado do `board_canvas_json` do pedido (não do pattern) → snapshot do canvas funciona, mas dependência de assets externos (material) pode falhar silenciosamente |
| Multi-chapa SVG                       | ✅                                                               | board-exporter:280-340 — translate negativo + viewBox da chapa                                                                                                                                       |
| Multi-chapa DXF                       | 🟡                                                               | board-exporter:404-431 — clipBoundsMm + filtro por centro de bbox (achado #8 AUDIT_ONDA28.md: borda fechada pode duplicar/descartar)                                                                 |
| Pasta por pedido (Fase C.5)           | ❌ Pendente                                                      | Tudo flat em `folder/`                                                                                                                                                                               |

#### Roteamento processo×máquina hoje

`asset-lookup.ts:37-56` tenta na ordem:

1. Sentinel `board-item:<id>` → hardcoded `{corte, [fiber-laser]}`
2. `appliqueRepository.getById(id)`
3. `engravingRepository.getById(id)`
4. `markingRepository.getById(id)`
5. null

**Riscos:**

- Sem cache — N queries em pedido grande.
- Colisão de id entre 3 repos não detectada (applique vence).
- `BOARD_ITEM_DEFAULT_ROUTING` hardcoded (l.24-27) — operador não pode redirecionar base sem mexer código.
- `OperationLayerMeta` **dormente** (svg-exporter.ts:305-308, dxf-exporter.ts:242 — `else continue`).

#### DXF R12 manual — capacidades

| Recurso                | Suporte                                                       |
| ---------------------- | ------------------------------------------------------------- |
| LINE                   | ✅                                                            |
| POLYLINE+VERTEX+SEQEND | ✅                                                            |
| CIRCLE                 | ✅                                                            |
| SPLINE/Bézier nativa   | ❌ pré-flattened em polilinhas (path-flattener:60 step=0.2mm) |
| LWPOLYLINE             | ❌ R12 não tem                                                |
| TEXT/MTEXT             | ❌ vetorizado                                                 |
| HATCH/SOLID            | ❌                                                            |
| BLOCK/INSERT           | ❌                                                            |
| Multi-layer            | ✅                                                            |

Risco: cada caractere complexo = milhares de VERTEX. Já existe defesa contra V8 spread limit (dxf-writer.ts:168-169).

---

### 3.4 Fluxo UI e stores

#### Rotas

| Spec                  | Atual                                                           | Status |
| --------------------- | --------------------------------------------------------------- | ------ |
| `/arte/novo`          | ✅ existe (router.tsx:48)                                       |        |
| `/padroes/novo`       | ✅ existe (router.tsx:50, modo CRIAR via `?product=X`)          |        |
| `/padroes/editar/:id` | ✅ existe (router.tsx:51)                                       |        |
| —                     | `/`, `/arte`, `/padroes`, `/banco`, `/banco/apliques`, `/dev/*` | extras |

**UX desalinhada:** `ArteHubPage.tsx:33-43` ainda mostra "Criar Padrão (em breve — Fase 11)" como card disabled, **embora `/padroes/novo` já exista**.

#### Fluxo operador — inversão da spec

Spec: passo 1 = selecionar template. Atual:

1. `NovoPedidoSidebar.tsx:165-170` mostra `ProductCascadeForm` (Categoria → Variação → Cor). **Sem template ainda.**
2. `NovoPedidoPage.tsx:364-374 handleAddBoardItem` cria `BoardItemDraft` com `patternId: null`. Broche entra no canvas só com produto+material.
3. `PatternBar.tsx` (overlay sobre canvas) permite aplicar pattern **opcionalmente**, via `engine.applyPatternObjects` (PatternBar.tsx:195-212).

**Inversão da hierarquia mental do operador.** Spec diz "template é a fonte de verdade"; atual diz "template é overlay opcional sobre produto+material".

#### Fluxo designer — passos da spec cobertos

`PadraoEditorPage.tsx` (492 linhas, CRIAR + EDITAR num componente):

| #   | Passo spec                                           | Coberto?                                                                                                  |
| --- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 1   | Importar SVG                                         | 🟡 Só importa SVG do produto base (`getProductById(pid).baseSvg`). Não importa SVG arbitrário do designer |
| 2   | Selecionar elementos (clique, SHIFT+clique, marquee) | ✅ via Fabric default                                                                                     |
| 3   | Classificar (9 tipos)                                | ❌ Só slot.type ∈ {nome,profissao,logo,custom} + layerMeta.kind ∈ {principal,operation,visual}            |
| 4   | Criar áreas inteligentes                             | 🟡 `engine.createSlot('nome'/'profissao'/'logo')` — caixas semânticas pré-fixas, não abstração geral      |
| 5   | Definir processos (CORTE/GRAV/MARC)                  | ❌ Schema tem, UI não expõe                                                                               |
| 6   | Definir máquinas (M1/M2/M3, multi)                   | ❌ Idem                                                                                                   |
| 7   | Hierarquia parent-child                              | 🟡 Modelo tem, sem reparent na UI                                                                         |
| 8   | Locks (4 granularidades)                             | ❌ Só `LayerMeta.locked: boolean` único                                                                   |

Funcionalidades reais da PadraoEditorPage:

- Input `patternName`
- Chips de `tags` editáveis (filtro da PatternBar)
- Botão Salvar (`insertPattern`/`updatePattern`)
- DropdownMenu "Adicionar campo": Nome, Profissão, Logo, Borda, Traço horizontal, Traço vertical, Retângulo livre
- `ObjectPropertiesPanel`: X/Y/W/H em mm tabular-nums com clamp
- `LayerPanel` encaixado

**Designer não pode pegar apliques do banco pra montar template novo.** BancoDrawer existe só no fluxo do operador (NovoPedidoPage).

#### Banco de Assets disperso

Spec: Asset Library unificada em 7 buckets.

Atual: dispersa em 4+ superfícies:

- `/banco` (BancoPage.tsx) — **stub vazio com EmptyState fixo**
- `/banco/apliques` (legada) — só Apliques. Tabs "Gravações"/"Marcações" disabled
- `LogoBankDialog` inline no fluxo de pedido (sem página dedicada)
- `BancoDrawer` dentro do NovoPedidoPage — Apliques, Gravações, Marcações, Fontes (em runtime, não cadastro)
- Materials/Family/Products/Fonts — **sem UI de cadastro**, vêm só de seeds

#### Stores e hooks

- `canvas-store.ts` (231 linhas) — Zustand puro, sem IO. **Útil sem grandes mudanças.** Tem `mode: 'designer'|'operator'` morto (sem consumer).
- `useBoardEngine` (767 linhas) — 7 responsabilidades misturadas. Reboot total do engine em qualquer mudança de produto/id (l.316,323). Caro para pedidos grandes. **Recuperável se quebrado em N hooks menores.**
- `useCanvasEngine` (305 linhas) — single-product, **só usado em `/dev/canvas-test`**. PadraoEditorPage instancia engine direto. **Duplicação.**
- `useCanvasShortcuts` / `useOrderShortcuts` — pequenos, focados. **Salváveis na íntegra.**

#### Componentes problemáticos (CLAUDE.md proíbe >300 linhas em UI)

- `NovoPedidoPage.tsx` (764) — orquestrador gigante
- `NovoPedidoSidebar.tsx` (751) — 3 sub-componentes embutidos
- `LayerPanel.tsx` (792) — em refactor pela Onda 28
- `PadraoEditorPage.tsx` (492) — monolítico
- `PatternBar.tsx` (458)

#### Órfãos e zumbis

- `PatternPanel.tsx` (197 linhas) — não importado pelo `BancoDrawer` (que importa só Aplique/Engraving/Marking/Fonts). **Órfão.**
- `BancoPage.tsx` — stub vazio
- `computeItemPositions` em useBoardEngine — marcada `@DEPRECATED Onda 26e`
- ~~`mode: CanvasMode` na store — sem consumer condicionando UI~~ **[CORRIGIDO Onda 29]** — vivo: propagado em `useBoardEngine.ts:693` e `useCanvasEngine.ts:291` → `engine.setMode()` → `slotManager.setMode()`. 18 testes cobrindo. Toggle UI em `/dev/canvas-test/ModeToggle.tsx`. Ver `docs/DEPENDENCY_MAP.md`.
- Pastas `src/core/{patterns,orders,products,validation}/` — todas vazias

#### Acoplamento dev↔prod

`BancoDrawer.tsx:20-22` importa `ApliquePanel`, `EngravingPanel`, `MarkingPanel` **de `@/ui/pages/dev/canvas-test/`** — 3 painéis em pasta "dev" são consumidos em produção. **Pasta dev/canvas-test não é totalmente dev.**

#### "Atualizar padrão mestre" sem confirmação forte

CLAUDE.md exige "ação protegida com confirmação forte". `PadraoEditorPage.tsx:389-398`: botão "Atualizar padrão" salva direto, só valida `name.length >= 2`. **Viola a regra.**

---

## 4. Tabela mestre — 25 gaps prioritizados

Severidade: 🔴 Crítica (bloqueia adoção da spec) · 🟠 Alta (custo alto se adiar) · 🟡 Média · 🟢 Baixa.

| #   | Sev | Gap                                                                                                                         | Onde toca                                                                                                     | Risco                                                                        | Esforço                          |
| --- | --- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------- |
| 1   | 🔴  | **9 tipos formais da spec ausentes** (PRODUCT, CONTOUR, TEXT_PRESET, LOGO_ASSET, distinção AREA/ASSET)                      | `schema.ts`, `layer-meta.ts`, `canvas-engine.ts`, `slot-manager.ts`                                           | Quebra retrocompat de `canvasJson` (precisa schemaVersion=4 + migração JSON) | Alto                             |
| 2   | 🔴  | **Snapshot real do template no pedido** ausente (FK `patternId` viva, soft-delete arrebenta reabertura)                     | `orderRepository`, `order_items`, possível nova tabela `order_item_template_snapshots`                        | Reabertura de pedido antigo pode falhar                                      | Médio                            |
| 3   | 🔴  | **Engine opera em px, não mm**                                                                                              | `units.ts`, todo `canvas-engine.ts`, `slot-manager.ts`, alignment, snap                                       | Toda integração Fabric — centenas de chamadas                                | Muito alto                       |
| 4   | 🔴  | **Sem backup automático do SQLite** (risco existencial)                                                                     | service novo + cron Tauri                                                                                     | Catastrófico se operador formatar máquina                                    | Baixo (~30 min)                  |
| 5   | 🔴  | **Dual-path identidade `obj.id`/`capiSlot.id`** — `findById` vs `findByCapiId` causa silent fails em material/strip-restore | `capi-id.ts`, `canvas-engine.ts:152,1490,1697,2917`, `slot-manager.ts`                                        | Slots não recebem material; STRIP-RESTORE funciona por acidente              | Médio                            |
| 6   | 🔴  | **Sem UI de processo+máquinas no designer** (backend tem, frontend não expõe)                                               | `PadraoEditorPage`, `ObjectPropertiesPanel`, novo `MachineRouterPanel`                                        | Designer não consegue definir produção; spec passo 5–6 não cumprido          | Médio                            |
| 7   | 🔴  | **PadraoEditorPage não importa SVG arbitrário** — designer trapado no produto base                                          | `PadraoEditorPage.tsx:117-148`, novo `ImportSvgDialog`                                                        | Spec passo 1 não cumprido                                                    | Médio                            |
| 8   | 🟠  | **Locks granulares ausentes** (só `LayerMeta.locked: boolean`)                                                              | `schema.ts:189,247,269`, `canvas-engine.setLayerLocked`, LayerPanel UI                                        | `structure` lock não tem equivalente Fabric, precisa validação no engine     | Médio                            |
| 9   | 🟠  | **OperationLayerMeta dormente** — schema tem, export ignora (`svg-exporter.ts:305-308`, `dxf-exporter.ts:242`)              | `svg-exporter`, `dxf-exporter`, `asset-lookup`                                                                | Caminho de routing paralelo ao do asset — decisão arquitetural pendente      | Médio                            |
| 10  | 🟠  | **Bucket `TextosPadrao` ausente**                                                                                           | Nova tabela `text_presets`, novo repo, seed                                                                   | Spec exige bucket; impacta Asset Library                                     | Baixo                            |
| 11  | 🟠  | **Bucket `Contornos` ausente como entidade** (subsumido em apliques)                                                        | Decisão de design: criar tabela ou marcar `appliques.kind='contour'`                                          | Spec exige bucket separado                                                   | Baixo                            |
| 12  | 🟠  | **Apliques podem ficar parcialmente órfãos no DXF** (filtro centro-de-bbox por filho)                                       | `dxf-exporter.ts:380-394`, `svg-exporter.ts:179-329`                                                          | Achado #8 AUDIT_ONDA28.md; bug em produção em chapas adjacentes              | Médio                            |
| 13  | 🟠  | **`OperationLayerMeta.machines` aceita `'[]'` no banco** mas runtime exige ≥1                                               | migration 0006 default, `_export-validation.ts`                                                               | Drift declarativo permanente                                                 | Baixo (migration + seed cleanup) |
| 14  | 🟠  | **`pattern_layers` zumbi** (sem update, sem sync com canvasJson)                                                            | `patternLayerRepository`, schema                                                                              | Tabela morta carregando dados; confunde devs                                 | Baixo (remover ou consumir)      |
| 15  | 🟠  | **`order_overrides` zumbi**                                                                                                 | `schema.ts:520-532`                                                                                           | Idem                                                                         | Baixo (remover)                  |
| 16  | 🟠  | **Engine de fit espalhada, sem API unificada**                                                                              | Novo `core/canvas/fit/` (FitEngine), refactor `addLogo`+`fit-text`                                            | Pré-requisito pra TEXT_AREA/LOGO_AREA com flags spec                         | Médio                            |
| 17  | 🟠  | **Asset Library dispersa em 4+ superfícies; `/banco` stub vazio**                                                           | Nova página unificada com tabs, refactor `BancoApliquesPagina`, integração `LogoBank`+`engravings`+`markings` | Spec exige Asset Library                                                     | Médio                            |
| 18  | 🟡  | **Sem validação Zod de canvasJson em I/O** (JSON corrompido vira null)                                                      | `patternRepository`, `orderRepository`, `revisionRepository`, novo `FabricCanvasJsonSchema`                   | Pedido pode "sumir"                                                          | Médio                            |
| 19  | 🟡  | **`instanceId` regenerado a cada saveRevision** (delete-all + insert-all)                                                   | `orderRepository:467-470`                                                                                     | Quebra estabilidade de ID exigida pela spec                                  | Médio                            |
| 20  | 🟡  | **Drift `operations` (7 ids SQL) × `VALID_OPERATIONS` (3 ids TS)**                                                          | catálogo SQL, `_export-validation.ts:15`, migration nova                                                      | Banco aceita ops que runtime rejeita                                         | Baixo                            |
| 21  | 🟡  | **Drift `slotTypes` (6 EN) × `SlotType` TS (4 PT)**                                                                         | `slot_types` seed, `types.ts:1`, `pattern_slots.slot_type`                                                    | Conflito de idioma                                                           | Baixo                            |
| 22  | 🟡  | **Cores oficiais hardcoded em 2 lugares** (svg-exporter + dxf-writer)                                                       | Novo `core/export/colors.ts`                                                                                  | Pequena duplicação; um SOT facilita evolução                                 | Baixo                            |
| 23  | 🟡  | **"Atualizar padrão mestre" sem confirmação forte**                                                                         | `PadraoEditorPage.tsx:389-398`                                                                                | Viola CLAUDE.md regra "ação protegida"                                       | Baixo                            |
| 24  | 🟡  | **`ArteHubPage` mostra "Criar Padrão (em breve)"** enquanto rota já existe                                                  | `ArteHubPage.tsx:33-43`                                                                                       | UX desalinhada                                                               | Baixo (5 min)                    |
| 25  | 🟢  | **Pastas vazias em `src/core/`** (`patterns/`, `orders/`, `products/`, `validation/`)                                       | Estrutura                                                                                                     | Sinal de planejamento inacabado                                              | Baixo (decidir: usar ou remover) |

---

## 5. Gambiarras, dual-paths e zumbis

Catalogados pra que ondas futuras saibam que existem.

### Gambiarras

1. **STRIP-RESTORE em `serialize()`** (canvas-engine.ts:2877-2944): patterns/clipPaths strip→serialize→restore. Frágil a ordem, return prematuro corrompe canvas vivo.
2. **Re-mapeamento de IDs em `applyPatternObjects`** (canvas-engine.ts:3102-3137,3147-3160): regenera IDs por instância, requer sync `obj.id ↔ capiSlot.id`. Bug "slot apareceu no broche errado" foi resolvido aqui (Onda 16.fix) — frágil.
3. **Cast `(canvas as { fire }).fire('layer-meta-changed')`** em 11+ lugares de canvas-engine.ts — evento custom não tipado. Rename quebra silente.
4. **`originalBounds` redeclarado inline em schema.ts:212-236** para evitar import circular data/ → core/canvas/ — boundary mal cortado.
5. **`__capiBase`/`__capiMaterialRect`/`__capiOverlay`** flags mágicas no Fabric obj — modelagem ad-hoc.
6. **`migrations/0011_board_canvas_json.sql:47-53`** — zera `order_items.canvas_json` para `'{}'` mas schema TS e código de write continuam populando o campo. Drift declarativo.
7. **`svgBaseRepository.softDelete`** (linhas 91-98) — função nomeada "soft" faz hard DELETE porque a tabela não tem `deleted_at`.

### Dual-paths

1. **`obj.id` vs `capiSlot.id`** — `findById` (canvas-engine.ts:152) vs `findByCapiId` (922). Slot manager não setou `body.id` direto. `findById` ainda usado em `applyMaterialToLayer` (1490), `removeMaterialFromLayer` (1697), STRIP-RESTORE (2917).
2. **Roteamento processo+máquina paralelo**: `OperationLayerMeta` (declarativa) vs `VisualLayerMeta + engravingId/markingId` (indireta via DB asset lookup). Atual usa caminho 2; spec assume caminho 1.
3. **Slot meta paralela ao LayerMeta**: `SlotMeta` em `obj.capiSlot` e `LayerMeta` registrado em paralelo (canvas-engine.ts:2168-2172). Sem sync garantido.
4. **3 fontes de verdade pra slots**: `pattern_slots` (tabela), `canvasJson.capi.layers` (LayerMeta), `objects[].capiSlot` (SlotMeta no Fabric).
5. **`pattern_layers` (tabela)** vs **`canvasJson.capi.layers`** (JSON dentro do pattern) — duplicação.

### Zumbis (declarados mas sem caller)

1. `pattern_layers` — tabela sem `update()`, sem callers que sincronizem.
2. `order_overrides` — declarada com kind/before/after, nunca importada.
3. `PatternPanel.tsx` (197 linhas) — não importado por BancoDrawer.
4. `BancoPage.tsx` — stub vazio com EmptyState.
5. `mode: 'designer'|'operator'` na store — sem consumer.
6. `BoardItemDraft.canvasJson` — cache dormente desde Onda 13.5.
7. `computeItemPositions` em useBoardEngine — @DEPRECATED Onda 26e.
8. Pastas vazias `src/core/{patterns,orders,products,validation}/`.
9. `useCanvasEngine` — só usado em `/dev/canvas-test`. PadraoEditorPage instancia engine direto.

---

## 6. O que reaproveitar / refatorar / remover

### Reaproveitar sem mexer

- `AppLayout`, `AppHeader`, `AppBreadcrumb`, `AppFooter` — chassis ok
- `ObjectPropertiesPanel` (154 linhas) — X/Y/W/H mm com clamp, modelo de painel propriedades
- `LogoBankDialog` (314 linhas) — UI mais próxima de Asset Library que existe; reutilizar como template pra outros buckets
- `RevisionsDialog` — read-only, plug-and-play
- `shadcn/ui` primitives (`Button`, `Dialog`, `Select`, etc.) e tokens Tailwind (`ink-*`, `laser`)
- `parseCorelSvg`, `corel-svg-errors`, `svg-path-resolver` — motor SVG OK
- `computeChapas` em useBoardEngine.ts:139-230 — função pura testável
- `buildChapaExportInfos` em `core/export/chapa-export-info`
- `canvas-store` (estrutura, sem `mode` morto)
- `useCanvasShortcuts`, `useOrderShortcuts`
- Snap engine puro (`core/canvas/alignment/`)
- Pipeline core/services de export (PNG/SVG/DXF) — fronteira limpa
- Texto → curva via opentype.js (com fallback estruturado pra variable fonts)

### Refatorar (custo médio)

- **`canvas-engine.ts`** (3.412 linhas) — extrair em 4-5 arquivos por responsabilidade: `engine-core`, `engine-serialization`, `engine-layers`, `engine-snap-integration`, `engine-board`. Sem mudar API pública. **Pré-requisito para qualquer mudança de tipos.**
- **`useBoardEngine`** (767 linhas) — quebrar em N hooks menores: boot, material-sync, pattern-sync, snapshot-restore, item-add/remove.
- **`NovoPedidoPage`** (764) — extrair handlers (material/banco/duplicate/bulk/export/save) em hooks ou subcomponentes.
- **`NovoPedidoSidebar`** (751) — extrair `ProductCascadeForm` (l.421-665), `ItemsList`, `ItemDetailsPanel` em arquivos.
- **`PadraoEditorPage`** (492) — quebrar antes de evoluir para os 8 passos da spec.
- **`PatternBar`** (458) — separar UI de aplicação de pattern.
- **Engine de fit** — consolidar `addLogo` math + `fit-text` em `core/canvas/fit/`.
- **Cores oficiais** — extrair pra `core/export/colors.ts` único, ler de svg-exporter + dxf-writer.
- **`SlotType` PT vs `slot_types` EN** — escolher um vocabulário e migrar.

### Substituir

- **`useCanvasEngine`** → fundir com useBoardEngine ou virar base do futuro `useTemplateEngine`.
- **`LayerMeta.locked: boolean`** → `LayerMeta.locks: { position, scale, rotation, structure }` (com migração JSON).
- **`OperationLayerMeta` dormente** → decidir: ativar como fonte primária de routing OU remover e deixar tudo em DB asset.
- **Cast `(canvas as { fire })`** → tipar o evento `layer-meta-changed` numa única declaração.

### Remover

- **`pattern_layers`** (tabela) — não sincroniza com canvasJson, sem `update()`. Decisão: remover ou virar a fonte de verdade.
- **`order_overrides`** (tabela) — declarada e nunca usada. Remover.
- **`PatternPanel.tsx`** — órfão.
- **`BancoPage.tsx`** — stub vazio (substituir por página real ou remover rota).
- ~~**`mode: CanvasMode`** na store — sem consumer.~~ **[CORRIGIDO Onda 29: vivo, ver DEPENDENCY_MAP.md]**
- **`computeItemPositions`** — deprecated, remover quando consumidores saírem.
- **Pastas vazias `src/core/{patterns,orders,products,validation}/`** — decidir: usar ou remover.
- **`BoardItemDraft.canvasJson`** — cache dormente, remover ou implementar.

### Separar / desacoplar

- **`ExportSvgDialog.tsx:29`** importa `setSetting` direto de `data/repositories` — extrair `rememberSvgFolder()` em `svg-export-service.ts` (achado #13 AUDIT_ONDA28.md).
- **`ExportSvgDialog` multi-chapa** duplica lógica que deveria estar em service (achado #10–12).
- **`BancoDrawer` importa de `dev/canvas-test/`** — mover `ApliquePanel`/`EngravingPanel`/`MarkingPanel` para fora de `dev/`.
- **`originalBounds` redeclarado inline em schema.ts** — repensar boundary `core/` vs `data/`.

### Decidir antes de implementar

- Cores oficiais tokenizadas em um único módulo? (#22)
- SVG separa por processo (1 arquivo por máquina×op) ou continua junto? (spec exige separação)
- Override de processo+máquina por pedido vai além do texto? (hoje só `textRouting`)
- Pasta por pedido (Fase C.5) — nome da subpasta?
- `OperationLayerMeta` — manter dormente ou ativar?
- Filhos de aplique cruzando borda de chapa — herdar chapa do pai ou continuar por centro?
- Variable fonts — aceitar fallback ou trocar opentype.js por fontkit?
- `pattern_layers` — remover ou virar fonte de verdade?
- "Atualizar padrão mestre" — qual UX de confirmação (digite o nome? dialog vermelho?)

---

## 7. Plano de ondas

Cada onda tem objetivo único, critério de saída claro, e ordem desenhada pra minimizar retrabalho. **Estimativas de esforço são ordem-de-grandeza** (dias-pessoa), não compromissos.

### ONDA 29 — Higiene mínima e segurança (1-2 dias)

**Objetivo:** Não-bloqueante pra ondas seguintes, mas crítico antes de qualquer evolução.

| Item                                                             | Arquivos                                                                                               | Esforço    |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------- |
| Backup automático do SQLite (cron diário → Documents)            | novo `services/db-backup.ts`                                                                           | baixo      |
| Validação Zod de canvasJson (`FabricCanvasJsonSchema`) em I/O    | `patternRepository`, `orderRepository`, `revisionRepository`, novo `core/canvas/canvas-json-schema.ts` | médio      |
| Quick wins do AUDIT_ONDA28.md (achados #1, #18, #19, #20)        | testes + componentes Onda 28                                                                           | baixo      |
| Commitar Onda 27/28 do working tree (separar ou abortar Onda 28) | git workflow                                                                                           | —          |
| Remover `ArteHubPage` "Criar Padrão (em breve)" disabled         | `ArteHubPage.tsx:33-43`                                                                                | baixíssimo |
| Confirmação forte em "Atualizar padrão mestre"                   | `PadraoEditorPage.tsx:389-398`                                                                         | baixo      |

**Risco:** baixo. **Dependências:** nenhuma. **Impacto:** salva produção contra perda de dados; destrava ondas seguintes.

---

### ONDA 30 — Refactor `canvas-engine.ts` (3-5 dias)

**Objetivo:** Quebrar arquivo de 3.412 linhas em módulos por responsabilidade **sem mudar API pública**. Pré-requisito de TODAS as ondas que mexem na engine.

**Arquivos novos:**

- `core/canvas/engine-core.ts` — boot, dispose, viewport, zoom, pan
- `core/canvas/engine-serialization.ts` — serialize/deserialize + STRIP-RESTORE
- `core/canvas/engine-layers.ts` — LayerMeta CRUD, parent-child, locks
- `core/canvas/engine-snap-integration.ts` — bridge para snap-engine puro
- `core/canvas/engine-board.ts` — multi-broche, fitBoard/fitRegion
- `core/canvas/engine-material.ts` — applyMaterialTo\*, STRIP-RESTORE de Pattern/clipPath
- `core/canvas/engine-objects.ts` — addRectangle, addAppliqueSvg, addEngravingSvg, addMarkingSvg, createSlot

**Risco:** médio. Suite de 565 testes minimiza regressão. **Dependências:** Onda 29 (working tree limpo). **Impacto:** desbloqueia evolução do modelo de tipos.

---

### ONDA 31 — Fixar identidade (eliminar dual-path) (2-3 dias)

**Objetivo:** Unificar `obj.id` ↔ `capiSlot.id`. Trocar todos os `findById` por `findByCapiId`. Garantir que slots recebam material via mesmo caminho.

**Arquivos:**

- `core/canvas/capi-id.ts` — unificar API
- `core/canvas/engine-layers.ts` (pós-Onda 30) — eliminar `findById`
- `core/canvas/engine-material.ts` — usar `findByCapiId`
- `core/canvas/engine-serialization.ts` — STRIP-RESTORE com `findByCapiId`
- `core/canvas/slot-manager.ts` — setar `body.id = slot.id` no momento da criação

**Risco:** médio. STRIP-RESTORE é caminho minado — testes E2E recomendados antes. **Dependências:** Onda 30. **Impacto:** elimina bug latente de "slot não recebe material"; preparação para 5 IDs formais da spec.

---

### ONDA 32 — Cleanup de zumbis (1 dia)

**Objetivo:** Remover código declarado e não usado. **Não é evolução, é higiene.**

- Remover `order_overrides` (tabela + schema)
- Decidir e remover `pattern_layers` (ou começar a usar)
- Deletar `PatternPanel.tsx` órfão
- Deletar `BancoPage.tsx` stub vazio (ou criar a página real — antecipa Onda 36)
- ~~Remover `mode: CanvasMode` da store~~ **[NÃO REMOVER — corrigido Onda 29: é vivo]**
- Remover `BoardItemDraft.canvasJson` dormente
- Remover `computeItemPositions` deprecated
- Decidir pastas vazias `src/core/{patterns,orders,products,validation}/`
- Mover `ApliquePanel/EngravingPanel/MarkingPanel` de `dev/canvas-test/` para `ui/banco/` (ou similar)
- Migration removendo colunas zumbi

**Risco:** baixo. **Dependências:** Onda 30 (pra mexer com confiança). **Impacto:** clareza arquitetural.

---

### ONDA 33 — Engine de fit unificada (2-3 dias)

**Objetivo:** Consolidar matemática de fit (contain + preserveAspect + centered + noRotate + noStretch) em API única. Pré-requisito de TEXT_AREA/LOGO_AREA da spec.

**Arquivos:**

- `core/canvas/fit/fit-engine.ts` (novo) — `applyFit(obj, config)` com flags da spec
- `core/canvas/fit/fit-text.ts` — re-implementação de `fit-text.ts` usando FitEngine
- `core/canvas/fit/fit-logo.ts` — extração da math de `slot-manager.addLogo`
- `core/canvas/slot-manager.ts` — refatorar pra usar FitEngine

**Risco:** baixo-médio. Testes unitários puros (sem Fabric vivo). **Dependências:** Onda 30. **Impacto:** habilita TEXT_AREA/LOGO_AREA com flags spec.

---

### ONDA 34 — Locks granulares (1-2 dias)

**Objetivo:** Substituir `LayerMeta.locked: boolean` por `LayerMeta.locks: { position, scale, rotation, structure }`.

**Arquivos:**

- `data/schema.ts` — alterar LayerMeta types + migration JSON (schemaVersion bump)
- `core/canvas/engine-layers.ts` — `setLayerLocks(id, partial)`
- `core/canvas/structure-validator.ts` (novo) — `structure` lock rejeita reparent/delete
- `ui/canvas/layer-panel/*` — UI 4 checkboxes
- Migration de canvasJson legado: `locked: true` → `locks: { position: true, scale: true, rotation: true, structure: true }`

**Risco:** médio (migration JSON in-place do canvasJson). **Dependências:** Ondas 30, 31. **Impacto:** spec passo 8 do designer.

---

### ONDA 35 — Modelo de tipos da spec — Parte 1 (PRODUCT, CONTOUR, ENGRAVING_PATTERN, MARKING_GUIDE) (3-4 dias)

**Objetivo:** Adicionar 4 tipos formais que não exigem distinção AREA/ASSET. Migrar `__capiBase` → PRODUCT formal; `productPaths` → CONTOUR formal; `VisualLayerMeta + engravingId` → ENGRAVING_PATTERN; idem MARKING_GUIDE.

**Arquivos:**

- `data/schema.ts` — discriminated union nova (paralela à antiga, com schemaVersion=4)
- `core/canvas/layer-meta.ts` — invariantes adaptados
- `core/canvas/engine-layers.ts` — CRUD por tipo
- Migration de canvasJson legado v3 → v4
- Testes (~50 novos)

**Risco:** alto (migração de schema canvasJson). Suite de 565 testes precisa rodar verde. **Dependências:** Ondas 30, 31, 34. **Impacto:** spec passo 3 do designer parcialmente cumprido.

---

### ONDA 36 — Asset Library unificada (3-5 dias)

**Objetivo:** Página `/banco` unificada com 7 tabs (Produtos, Apliques, Logos, TextosPadrao, Contornos, Engravings, Markings). Migrar `/banco/apliques` legado.

**Arquivos:**

- `ui/pages/banco/BancoPage.tsx` — nova página com tabs
- `ui/pages/banco/tabs/*` — uma por bucket
- `data/repositories/textPresetRepository.ts` (novo)
- `data/repositories/contourRepository.ts` (novo, **se** decisão for criar tabela separada)
- Migrations: `text_presets`, `contours` (se aplicável)
- Seeds básicos
- Migrar `LogoBankDialog` pra usar a tab Logos

**Risco:** médio (decisão de design: Contornos é tabela separada ou flag em apliques?). **Dependências:** Onda 32 (limpeza). **Impacto:** spec exige Asset Library; spec passo 1 do designer (importar SVG de bucket) torna-se possível.

---

### ONDA 37 — Modelo de tipos da spec — Parte 2 (AREA vs ASSET) (4-6 dias)

**Objetivo:** Separar TEXT_AREA/TEXT_PRESET e LOGO_AREA/LOGO_ASSET. Áreas persistem bounds+meta; assets persistem vetor.

**Arquivos:**

- `data/schema.ts` — discriminated union completa (9 tipos)
- `core/canvas/engine-layers.ts` — CRUD por tipo
- `core/canvas/slot-manager.ts` — refatoração profunda (slot vira ÁREA pura; conteúdo aplicado vira ASSET separado com parent=AREA)
- Migration v4 → v5
- `core/canvas/engine-serialization.ts` — testar STRIP-RESTORE com novo modelo
- Testes extensivos

**Risco:** alto. STRIP-RESTORE é o caminho mais minado da engine; mudança de modelo de slot afeta load/save/serialize/deserialize. **Dependências:** Ondas 30, 31, 33, 34, 35, 36. **Impacto:** spec passos 3 e 4 do designer; distinção AREA/ASSET no canvasJson.

---

### ONDA 38 — IDs formais (templateId, nodeId, instanceId) (2-3 dias)

**Objetivo:** Persistir os 5 IDs formais da spec. `instanceId` estável (não regenera em saveRevision). `nodeId` em LayerMeta.

**Arquivos:**

- `data/schema.ts` — adicionar `templateId`, `nodeId` em LayerMeta
- `data/repositories/orderRepository.ts:467-470` — UPSERT em vez de delete-all+insert-all
- `core/canvas/engine-layers.ts` — propagar nodeId no `applyPatternObjects`
- Migration v5 → v6

**Risco:** médio. **Dependências:** Ondas 35, 37. **Impacto:** rastreabilidade end-to-end; spec satisfeita.

---

### ONDA 39 — Snapshot real do template no pedido (2-3 dias)

**Objetivo:** Congelar pattern no pedido. Soft-delete do pattern não deve quebrar reabertura.

**Arquivos:**

- `data/schema.ts` — adicionar `order_items.template_snapshot_json TEXT NOT NULL` (cópia do pattern.canvasJson no momento da criação) OU nova tabela `order_item_template_snapshots`
- `data/repositories/orderRepository.ts` — `createWithItems` copia pattern.canvasJson
- Migration de pedidos antigos: copiar `patterns.canvasJson` atual como snapshot (degradação aceitável: pedidos antigos ficam com o estado atual do pattern, não o estado no momento da criação)

**Risco:** médio (migração de dados existentes). **Dependências:** Onda 38. **Impacto:** spec atendida; bug "soft-delete do pattern quebra reabertura" resolvido.

---

### ONDA 40 — UI de processos+máquinas no designer (2-3 dias)

**Objetivo:** Cobrir spec passos 5 e 6. Designer escolhe processType e machineTargets por camada.

**Arquivos:**

- `ui/pages/padroes/MachineRouterPanel.tsx` (novo) — painel ao lado do ObjectPropertiesPanel
- `core/canvas/engine-layers.ts` — `setOperationMachines(layerId, op, machines[])`
- Ativar `OperationLayerMeta` (decisão da fase: tornar fonte primária de routing OU manter dual-path explícito)
- Resolver drift `operations` SQL (7) vs `VALID_OPERATIONS` TS (3): escolher um

**Risco:** médio (decisão arquitetural: OperationLayer vs asset routing). **Dependências:** Ondas 35, 37. **Impacto:** spec passos 5, 6 do designer.

---

### ONDA 41 — Importar SVG arbitrário no designer (2-3 dias)

**Objetivo:** Spec passo 1 do designer. PadraoEditorPage aceita upload de SVG bruto.

**Arquivos:**

- `ui/pages/padroes/ImportSvgDialog.tsx` (novo)
- `core/canvas/svg-import.ts` (novo) — parse SVG → criar layers tipados com classificação inicial (CONTOUR/APPLIQUE)
- Integração com `parseCorelSvg` existente
- BancoDrawer dentro do designer (puxar apliques/contornos do banco)

**Risco:** baixo-médio. **Dependências:** Ondas 35, 36. **Impacto:** designer destravado; spec passo 1.

---

### ONDA 42 — Apliques com filhos atômicos no export (2-3 dias)

**Objetivo:** Resolver bug "apliques parcialmente órfãos no DXF". Filhos de aplique cruzando borda de chapa herdam a chapa do pai.

**Arquivos:**

- `core/export/dxf-exporter.ts:380-394` — agrupar por `parentLayerId` antes de clipar
- `core/export/svg-exporter.ts:179-329` — idem
- `core/export/board-exporter.ts` — propagar regra
- Decisão design: borda fechada vs aberta em `objectCenterInsideClip` (achado #8 AUDIT_ONDA28.md)

**Risco:** médio (regressão em exports validados). **Dependências:** Ondas 35, 38. **Impacto:** spec satisfeita; bug de produção resolvido.

---

### ONDA 43 — Cores oficiais tokenizadas + SVG separado por processo (1-2 dias)

**Objetivo:** Single source-of-truth pra cores; SVG separar por processo (1 arquivo por máquina×op em vez de só máquina).

**Arquivos:**

- `core/export/colors.ts` (novo)
- `core/export/svg-exporter.ts:60` — consumir
- `core/export/dxf-writer.ts:34` — consumir
- `core/export/svg-exporter.ts:342-373` — bucketing máquina×op

**Risco:** baixo. **Dependências:** nenhuma (poderia ser Onda 29.5, mas é melhor depois do refactor da engine pra evitar conflito de merge). **Impacto:** spec atendida; manutenção simplificada.

---

### ONDA 44 — Fase C.5 (pasta por pedido) + atomicidade de export (1-2 dias)

**Objetivo:** Cada pedido vai pra subpasta própria. Falhas de export são atômicas (rollback).

**Arquivos:**

- `ui/canvas/ExportSvgDialog.tsx`, `ExportPngDialog.tsx` — criar subpasta `${pedidoSlug}/`
- `services/png/svg/dxf-export-service.ts` — write atômico (temp dir → rename)
- Endereçar achados #10, #11 AUDIT_ONDA28.md

**Risco:** baixo. **Dependências:** nenhuma. **Impacto:** organização operacional.

---

### ONDA 45 — UI de fluxo template-first no operador (3-4 dias)

**Objetivo:** Inverter ordem do operador pra bater com a spec. Passo 1 = selecionar template, depois preencher.

**Arquivos:**

- `ui/pages/arte/NovoPedidoPage.tsx` — fluxo refeito: template gallery primeiro
- `ui/pages/arte/novo-pedido/NovoPedidoSidebar.tsx` — ProductCascadeForm vira segundário
- `ui/pages/arte/novo-pedido/TemplateGalleryStep.tsx` (novo)
- PatternBar pode virar BarraSecundária ou sumir

**Risco:** alto em UX (mudança visível pro operador). Requer validação visual com Gabriell. **Dependências:** Ondas 35, 37, 39. **Impacto:** spec atendida.

---

### ONDA 46 — Migração mm-first interno (5-7 dias) — **OPCIONAL**

**Objetivo:** Engine opera em mm internamente. Conversão pra px só na hora de Fabric desenhar.

**Decisão arquitetural pendente:** vale o custo? Reaproveita validação visual extensiva. Pode adiar indefinidamente se px-com-conversão-nas-bordas se mantiver estável.

**Arquivos:** essencialmente todo `canvas-engine`, `slot-manager`, `alignment/*`, `snap-engine`, hooks.

**Risco:** muito alto. **Dependências:** todas anteriores. **Impacto:** alinhamento com spec; gain operacional pequeno (precisão é a mesma com ratio=4).

**Recomendação:** **adiar definitivamente** a menos que apareça gain claro.

---

### Ondas adiadas / fora do escopo da spec

- Modo Designer/Medição (REQUIREMENTS.md) — adiar (operador não precisa)
- Wave "Produção por Camada" UI completa — coberta parcialmente nas Ondas 40+
- Bug material dourado→prata — independente; pode ser hotfix paralelo
- Variable fonts: trocar opentype por fontkit — adiar a menos que cliente real reclame

---

## 8. Estimativa de risco e sequência ideal

### Sequência ideal (linha de tempo lógica, não calendário)

```
Onda 29  →  Onda 30  →  Onda 31  →  Onda 32
(higiene)   (refactor)   (id)        (zumbis)
                            ↓
                         Onda 33  →  Onda 34
                         (fit)       (locks)
                            ↓
                         Onda 35  →  Onda 36  →  Onda 37
                         (tipos 1)   (asset lib)  (AREA/ASSET)
                            ↓
                         Onda 38  →  Onda 39
                         (IDs)       (snapshot)
                            ↓
                         Onda 40  →  Onda 41
                         (proc+maq)  (import SVG)
                            ↓
                         Onda 42  →  Onda 43  →  Onda 44
                         (filhos)    (cores+SVG) (pasta)
                            ↓
                         Onda 45 — UI template-first
                            ↓
                         (Onda 46 mm-first — adiar)
```

### Matriz risco × impacto

| Onda                        | Risco       | Impacto spec | Bloqueio futuro  |
| --------------------------- | ----------- | ------------ | ---------------- |
| 29 — Higiene + backup       | baixo       | médio        | desbloqueia tudo |
| 30 — Refactor canvas-engine | médio       | baixo        | **alto**         |
| 31 — Fixar identidade       | médio       | baixo        | alto             |
| 32 — Cleanup zumbis         | baixo       | baixo        | médio            |
| 33 — Engine de fit          | baixo-médio | médio        | médio            |
| 34 — Locks granulares       | médio       | médio        | médio            |
| 35 — Tipos parte 1          | alto        | alto         | alto             |
| 36 — Asset Library          | médio       | alto         | médio            |
| 37 — AREA vs ASSET          | alto        | crítico      | alto             |
| 38 — IDs formais            | médio       | médio        | médio            |
| 39 — Snapshot real          | médio       | crítico      | médio            |
| 40 — Proc+maq UI            | médio       | crítico      | baixo            |
| 41 — Importar SVG           | baixo-médio | crítico      | baixo            |
| 42 — Filhos atômicos        | médio       | alto         | baixo            |
| 43 — Cores+SVG-por-processo | baixo       | médio        | baixo            |
| 44 — Pasta por pedido       | baixo       | baixo        | baixo            |
| 45 — UI template-first      | alto (UX)   | crítico      | nenhum           |
| 46 — mm-first               | muito alto  | baixo        | nenhum           |

### O que entra no MVP da spec

**Mínimo para "spec entregue":** Ondas 29 → 30 → 31 → 33 → 34 → 35 → 36 → 37 → 38 → 39 → 40 → 41 → 45.

**Refinamentos (não bloqueiam adoção):** Ondas 32, 42, 43, 44.

**Adiável:** Onda 46.

### Recomendação operacional

1. **Não tocar em código** antes de fechar working tree atual (Onda 27 final + Onda 28). Audits prévios já documentam isso. Commitar ou abortar Onda 28 é pré-requisito.
2. **Onda 29 primeiro** — backup do banco salva produção em catástrofe enquanto se planeja o resto.
3. **Onda 30 é pré-requisito político**: sem quebrar o `canvas-engine.ts` em módulos, qualquer onda que mude tipos vai pisar em código frágil.
4. **Validação visual obrigatória após Ondas 35, 37, 39, 45** — são as que mudam comportamento perceptível pro operador.
5. **Suite de testes (565 verdes hoje) é o cinto de segurança**. Toda onda termina com testes verdes ou não termina.
6. **Decisões de design pendentes (lista no §6.6)** devem ser fechadas ANTES de começar cada onda que depende.

---

## 9. Apêndice: arquivos críticos

### Canvas Engine

- `src/core/canvas/canvas-engine.ts` (3.412 linhas) — mega-arquivo, alvo da Onda 30
- `src/core/canvas/types.ts` — `SlotType` PT (4 valores) — conflito com `slot_types` EN
- `src/core/canvas/layer-meta.ts` — 7 invariantes
- `src/core/canvas/slot-manager.ts` (714) — slots = TEXT_AREA/LOGO_AREA conceitual
- `src/core/canvas/fit-text.ts` — engine de fit text (parte 1 da engine de fit)
- `src/core/canvas/units.ts` — `MM_TO_PX = 4`
- `src/core/canvas/capi-id.ts` — dual-path resolver
- `src/core/canvas/material-applier.ts` — Pattern Fabric builder

### Persistência

- `src/data/schema.ts` (656) — 22 tabelas; LayerMeta linhas 151-295
- `src/data/repositories/patternRepository.ts:161-176` — `safeParseCanvasJson` sem Zod
- `src/data/repositories/orderRepository.ts:450-517` — delete-all+insert-all em saveRevision
- `src/data/repositories/_export-validation.ts:15` — drift 3 vs 7 operations
- `src/data/repositories/patternLayerRepository.ts` — sem update (zumbi)
- `src-tauri/migrations/0009_order_items_multi.sql` — maior swap, alto risco
- `src-tauri/migrations/0011_board_canvas_json.sql:47-53` — reset destrutivo

### Export

- `src/core/export/board-exporter.ts` — multi-chapa
- `src/core/export/svg-exporter.ts:60` — cores hardcoded
- `src/core/export/dxf-exporter.ts:380-394` — `objectCenterInsideClip` (achado #8)
- `src/core/export/dxf-writer.ts:34` — cores hardcoded
- `src/core/export/svg-text-converter.ts:18-32` — variable fonts falham
- `src/services/asset-lookup.ts:24-27` — sentinel hardcoded
- `src/ui/canvas/ExportSvgDialog.tsx:29` — acoplamento UI→data

### UI

- `src/app/router.tsx` — rotas
- `src/ui/pages/arte/NovoPedidoPage.tsx` (764) — orquestrador gigante
- `src/ui/pages/arte/novo-pedido/NovoPedidoSidebar.tsx` (751)
- `src/ui/pages/arte/novo-pedido/PatternBar.tsx` (458) — overlay de pattern
- `src/ui/pages/arte/novo-pedido/PatternPanel.tsx` (197) — **órfão**
- `src/ui/pages/padroes/PadraoEditorPage.tsx` (492) — designer monolítico
- `src/ui/pages/banco/BancoPage.tsx` — **stub vazio**
- `src/ui/pages/banco-apliques/BancoApliquesPagina.tsx` — legada, parcialmente desabilitada
- `src/ui/pages/arte/novo-pedido/BancoDrawer.tsx:20-22` — importa de `dev/canvas-test/`
- `src/ui/pages/arte/ArteHubPage.tsx:33-43` — "Criar Padrão (em breve)" disabled

### Stores e hooks

- `src/stores/canvas-store.ts` (231) — ~~`mode: CanvasMode` morto~~ **[CORRIGIDO Onda 29: vivo]**
- `src/hooks/useBoardEngine.ts` (767) — 7 responsabilidades
- `src/hooks/useCanvasEngine.ts` (305) — só dev/canvas-test

### Audits referenciados

- `AUDIT_ONDA28.md` — achados Onda 27/28 working tree
- `REPORT_FOR_ANALYSIS.md` — visão geral do estado

---

**Fim do relatório.**

Diagnóstico encerrado sem propor implementação concreta. Próximo passo: você decidir quais decisões de design fechar (§6.6) e qual onda iniciar.
