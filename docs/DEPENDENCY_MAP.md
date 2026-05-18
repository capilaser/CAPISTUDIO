# DEPENDENCY_MAP.md — Editor + Engine + Stores (Onda 29)

> **Propósito:** snapshot factual de quem consome quem no editor.
> Gerado em 2026-05-18 como parte da Onda 29 (higiene), antes do refactor da Onda 30.
> **Não é especulação:** todas as relações abaixo foram verificadas por grep direto na branch `onda-29`.

---

## 1. Mapa de dependências do canvas

```
                   ┌─────────────────────────┐
                   │  src/core/canvas/       │
                   │  canvas-engine.ts       │  (3.412 linhas)
                   └────────────┬────────────┘
                                │
              ┌─────────────────┼─────────────────┐
              │                 │                 │
              ▼                 ▼                 ▼
       slot-manager.ts   material-applier.ts   alignment/
       (714 linhas)      corel-svg-parser.ts   snap-engine.ts
                         fit-text.ts            etc.
                         units.ts (mm↔px)

                          ▲ instancia
                          │
           ┌──────────────┴───────────────┐
           │                              │
   useBoardEngine.ts                useCanvasEngine.ts
   (767 linhas, multi-broche)       (305 linhas, single-product)
           │                              │
           │ usado por                    │ usado por
           ▼                              ▼
   NovoPedidoPage.tsx               CanvasTest.tsx (dev-only)
   (764 linhas)                     (e PadraoEditorPage NÃO usa — instancia direto)
```

### Hooks → CanvasEngine

| Hook                   | Cria CanvasEngine?                             | Usado por              | Notas                                                      |
| ---------------------- | ---------------------------------------------- | ---------------------- | ---------------------------------------------------------- |
| `useBoardEngine`       | sim (com `productWidthMm/HeightMm` da prancha) | `NovoPedidoPage.tsx`   | multi-broche, deserialize de pedido, sync material/pattern |
| `useCanvasEngine`      | sim (com dimensões do produto)                 | `CanvasTest.tsx` (dev) | single-product, save/loadPattern/clear                     |
| `PadraoEditorPage.tsx` | sim (instancia direto, **sem hook**)           | si próprio             | duplicação parcial do que `useCanvasEngine` faz            |

### Stores e hooks auxiliares consumidos pela engine

- `useCanvasStore` (Zustand) — fornece: `selectedSlotId`, `selectedLayerId`, `selectedLayerKind`, `mode`, `boardItems`, `gridVisible`, `measurementMode`, `liveMetricsEnabled`.
- `useAltKey` — ref estável que reflete tecla Alt segurada (para snap toggle).

---

## 2. Lista de "zumbis" com nível de confiança

Severidade do verdict:

- ✅ **Confirmado morto** (zero callers em produção, zero testes)
- 🟡 **Cache dormente** (escrito, nunca lido)
- 🟠 **Duplicação** (dois caminhos pro mesmo conceito, um menos usado)
- 🟢 **Falso positivo da auditoria anterior** (parece morto mas é vivo)

| #   | Item                                                     | Verdict                                | Callers confirmados                                                                                                                                                                                                                                                                                                                                 | Decisão Onda 32                                                                                                                                                                                          |
| --- | -------------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `src/ui/pages/arte/novo-pedido/PatternPanel.tsx`         | ✅ Morto                               | Zero callers em `src/`. Único import vem do próprio arquivo.                                                                                                                                                                                                                                                                                        | **Deletar**                                                                                                                                                                                              |
| 2   | `src/ui/pages/banco/BancoPage.tsx`                       | ✅ Stub                                | Renderiza só `EmptyState`. Rota `/banco` viva em `router.tsx`, mas sem conteúdo.                                                                                                                                                                                                                                                                    | **Manter rota, deletar arquivo só quando Onda 36 (Asset Library) tiver substituto pronto.**                                                                                                              |
| 3   | `computeItemPositions` em `useBoardEngine.ts`            | ✅ Morto exportado                     | Marcada `@DEPRECATED Onda 26e`. Exportada mas nenhum `import { computeItemPositions }` em produção. 2 menções em comentários.                                                                                                                                                                                                                       | **Deletar (manter export comentado se algum teste usar; testes confirmaram que não)**                                                                                                                    |
| 4   | Pastas `src/core/{patterns,orders,products,validation}/` | ✅ Vazias                              | Diretórios sem arquivos.                                                                                                                                                                                                                                                                                                                            | **Deletar diretórios vazios.**                                                                                                                                                                           |
| 5   | `BoardItemDraft.canvasJson` na store                     | 🟡 Cache dormente                      | Escrito em todos os add/duplicate (canvas-store.ts:134,191,213). **Nunca é lido pela engine**: `useBoardEngine.ts:413-468` carrega `boardCanvasJson` agregado da `orders` table, não dos itens individuais.                                                                                                                                         | **Decidir Onda 31+ (depende de IDs formais).** Por ora: manter para não causar regressão silenciosa.                                                                                                     |
| 6   | `mode: CanvasMode` na store                              | 🟢 **VIVO** (auditoria anterior errou) | Propagado em `useBoardEngine.ts:693`, `useCanvasEngine.ts:291` → `engine.setMode(mode)` → `slotManager.setMode(mode)` (slot-manager.ts:352). Esconde overlays de slots em modo operator + trava seleção de bodies + adiciona placeholder em logo vazio. 18 testes em `slot-manager.test.ts`. Consumer UI = `ModeToggle.tsx` em `/dev/canvas-test/`. | **MANTER.** Bug da auditoria. Atualizar `AUDIT_TEMPLATES_SPEC.md` com correção.                                                                                                                          |
| 7   | `pattern_layers` (tabela)                                | 🟠 Duplicação                          | `patternLayerRepository.ts` sem `update()`, sem sync com `canvasJson.capi.layers`.                                                                                                                                                                                                                                                                  | **NÃO mexer em Onda 32** — exige migration. Atacar em Onda 36+ junto com Asset Library.                                                                                                                  |
| 8   | `order_overrides` (tabela)                               | ✅ Morto                               | Declarada em schema, **não importada** em nenhum `.ts/.tsx` de `src/`.                                                                                                                                                                                                                                                                              | **NÃO mexer em Onda 32** — exige migration. Atacar em Onda 32.5 ou junto com Onda 36.                                                                                                                    |
| 9   | `useCanvasEngine` consolidação                           | 🟠 Duplicação parcial                  | Usado só em `/dev/canvas-test`. PadraoEditorPage faz seu próprio boot. Tem `save/loadPattern/clear` que `useBoardEngine` não tem.                                                                                                                                                                                                                   | **NÃO consolidar agora.** Onda 41 (Importar SVG no designer) vai refazer PadraoEditorPage e essa é a hora certa de decidir: ressuscitar `useCanvasEngine` como `useTemplateEngine`, ou removê-lo de vez. |

---

## 3. Hotspots por linha (alvos da Onda 30)

| #   | Arquivo                                               | Linhas | Plano de fatiamento (Onda 30)                                                                               |
| --- | ----------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------- |
| 1   | `src/core/canvas/canvas-engine.ts`                    | 3.412  | Quebrar em: engine-core, engine-serialization, engine-layers, engine-material, engine-objects, engine-board |
| 2   | `tests/core/canvas/canvas-engine.test.ts`             | 800    | Acompanha fatiamento (testes seguem a estrutura nova)                                                       |
| 3   | `src/ui/canvas/LayerPanel.tsx`                        | 792    | Refatorado pela Onda 28 (subcomponentes em `layer-panel/`) — fora do escopo Onda 30                         |
| 4   | `src/hooks/useBoardEngine.ts`                         | 767    | Quebrar em Onda 30 fase E (ou Onda 33+): boot, material-sync, pattern-sync, snapshot-restore                |
| 5   | `src/ui/pages/arte/NovoPedidoPage.tsx`                | 764    | Fora do escopo Onda 30. Provável Onda 45 (UI template-first)                                                |
| 6   | `src/ui/pages/arte/novo-pedido/NovoPedidoSidebar.tsx` | 751    | Idem                                                                                                        |
| 7   | `src/core/canvas/slot-manager.ts`                     | 714    | Mantido nesta onda. Avaliar fatiamento depois da Onda 37 (AREA vs ASSET)                                    |

---

## 4. Mapa de identidade (alvo Onda 31)

```
                     ┌──────────────────┐
                     │ Fabric Object    │
                     └──────────┬───────┘
                                │ (carrega via CAPI_CUSTOM_PROPS)
                ┌───────────────┼───────────────┐
                ▼               ▼               ▼
            obj.id        obj.capiSlot.id    flags __capiBase
            (UUID)        (UUID, só em       __capiOverlay
                          slots)             __capiMaterialRect

                  │                  │
                  ▼                  ▼
        ┌──────────────┐    ┌────────────────┐
        │ findById     │    │ findByCapiId   │
        │ (152-156)    │    │ (922-926)      │
        │              │    │ (ADR Onda 7b)  │
        └──────┬───────┘    └────────┬───────┘
               │                     │
               │ usado por:          │ usado por:
               ▼                     ▼
   applyMaterialToLayer        deleteLayer, reparentLayer,
   removeMaterialFromLayer     setLayerVisibility, etc.
   STRIP-RESTORE (serialize)
   ⚠ slots NÃO recebem
     material por este caminho
```

**Conclusão para Onda 31:** padronizar tudo em `findByCapiId`. Slot manager deve setar `body.id = slot.id` na criação para eliminar o dual-path. Strip-restore precisa de teste antes da mudança.

---

## 5. Mapa de roteamento processo+máquina (informativo, alvo Onda 40)

```
        Asset cadastrado no banco
        ┌──────────────────────────────────┐
        │ appliques   { op, machines[] }   │
        │ engravings  { op, machines[] }   │  ← fonte de verdade atual
        │ markings    { op, machines[] }   │
        └──────────┬───────────────────────┘
                   │ resolved by
                   ▼
          asset-lookup.ts (3 try-orders)
                   │
                   ▼
            svg-exporter / dxf-exporter
                   │
                   │ override possível (só pra texto):
                   ▼
            textRouting Map<id, {op, machines}>


  OperationLayerMeta { kind:'operation', operation, machines[] }
  ❌ existe no schema mas NUNCA é consultada pelo export
     (svg-exporter:305-308, dxf-exporter:242 — `else continue`)
```

---

## 6. Pastas vazias em `src/core/`

Verificado por `ls`:

| Pasta                  | Conteúdo | Decisão                                                                                            |
| ---------------------- | -------- | -------------------------------------------------------------------------------------------------- |
| `src/core/patterns/`   | vazia    | Deletar em Onda 32 (provavelmente reutilizada em Onda 35+ quando o modelo de tipos da spec entrar) |
| `src/core/orders/`     | vazia    | Deletar em Onda 32                                                                                 |
| `src/core/products/`   | vazia    | Deletar em Onda 32                                                                                 |
| `src/core/validation/` | vazia    | Deletar em Onda 32                                                                                 |

Quando ondas posteriores precisarem dessas pastas, recriar com primeiro arquivo de regra. Não há perda — git não rastreia diretórios vazios.

---

## 7. Onde mexer com cuidado nas próximas ondas

| Onda | Lugar crítico                                                       | Por quê                                                                 |
| ---- | ------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 30.A | `canvas-engine.ts:2877-2944` (`serialize/deserialize`)              | STRIP-RESTORE de pattern+clipPath. Frágil a ordem.                      |
| 30.B | invariantes 1-7 em `layer-meta.ts:54-150`                           | Quebrar `LayerMeta` em arquivos diferentes não pode quebrar invariantes |
| 30.C | `applyMaterialToLayer` (1490), `removeMaterialFromLayer` (1697)     | Usam `findById` — dual-path                                             |
| 31   | `serialize()` STRIP-RESTORE + `applyPatternObjects` (3102-3160)     | Re-mapeamento de IDs por instância (resolveu bug Onda 16)               |
| 32   | nenhum item da lista 32 tem caller funcional confirmado em produção | OK conservador                                                          |

---

**Fim.** Atualizar este documento sempre que uma onda fechar e mexer em algum dos itens listados.
