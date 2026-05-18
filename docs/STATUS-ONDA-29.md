# Capi Studio — Status pós-Onda 29

> **Snapshot da sessão 2026-05-18 (Onda 29).** Use junto com
> `AUDIT_TEMPLATES_SPEC.md` (raiz) e `docs/DEPENDENCY_MAP.md` pra entender o estado.
> Próxima onda planejada: **Onda 30 — Refactor cirúrgico do canvas-engine.ts** (em 4 fases A→D).

---

## Contexto

A spec "templates inteligentes" (3 docs em `CAPISTUDIO_*.md` fornecidos pela
liderança) define um modelo paramétrico com 9 tipos de elemento, processo+máquina
por camada, snapshot real do template no pedido, e Asset Library completa.
A auditoria arquitetural (`AUDIT_TEMPLATES_SPEC.md`) mapeou 25 gaps prioritizados
e desenhou plano de Ondas 29→46.

A Onda 29 abre o ciclo template-first: higiene + mapa de dependências +
preparação pra refatorar o canvas-engine sem feature nova.

---

## Estado real do código (baseline)

- **typecheck**: ✅ verde
- **lint**: ✅ 0 errors, 6 warnings (todos pré-existentes — `react-refresh/only-export-components` em shadcn + 3 do `coverage/`)
- **testes**: ✅ 565/565 passando (sem mudança vs Onda 28 — Onda 29 não tocou em código de produção, só docs)
- **branch**: `onda-29` (criada a partir de `onda-26` após o commit checkpoint `3453878`)

---

## O que entregou nesta onda

| #   | Item                                                                        | Arquivo                                       | Tipo     |
| --- | --------------------------------------------------------------------------- | --------------------------------------------- | -------- |
| 1   | Commit checkpoint Onda 27+28                                                | `3453878` em `onda-26`                        | git      |
| 2   | Branch nova `onda-29`                                                       | —                                             | git      |
| 3   | Mapa de dependências do editor (engine, hooks, stores)                      | [`docs/DEPENDENCY_MAP.md`](DEPENDENCY_MAP.md) | doc novo |
| 4   | Lista factual de zumbis (9 itens, verdict por confiança)                    | `DEPENDENCY_MAP.md` §2                        | doc      |
| 5   | Decisão: não consolidar `useCanvasEngine` agora — deferida pra Onda 41      | `DEPENDENCY_MAP.md` §2 item 9                 | doc      |
| 6   | Correção factual: `mode: CanvasMode` **não é morto** (audit anterior errou) | `AUDIT_TEMPLATES_SPEC.md` 4 lugares           | doc      |
| 7   | Débito #7 documentado: backup automático do SQLite                          | `docs/DEBT.md`                                | doc      |
| 8   | Esta página                                                                 | `docs/STATUS-ONDA-29.md`                      | doc      |

**Nada de código de produção tocado.** Onda 29 é puramente higiene + documentação.

---

## Decisões da sessão (registradas)

1. **Working tree fechado via commit único** `WIP Onda 27+28 — checkpoint`, em vez de separar commits Onda 27/28 ou abortar Onda 28. Razão: tempo > limpeza histórica; o trabalho continua usável.
2. **Backup SQLite adiado**, não cancelado. Anotado em `DEBT.md #7`. Atacar como onda paralela após Onda 32 ou quando instalar em máquina de produção real.
3. **Refactor canvas-engine** será feito em **4 PRs/commits pequenos** (Onda 30 A→D), não num PR único. Razão: 565 testes pra preservar; quebra em fases reduz risco por commit.
4. **Cleanup conservador** (Onda 32) — só deletar zumbis com zero callers confirmados. Tabelas zumbi (`pattern_layers`, `order_overrides`) ficam pra Onda 36 junto com Asset Library (exigem migration cuidadosa).
5. **Onda 46 (mm-first interno) ficou adiada definitivamente** — px com conversão nas bordas é estável, gain de mm-first é teórico.

---

## Correção factual sobre `mode: CanvasMode`

Auditoria anterior (`AUDIT_TEMPLATES_SPEC.md` §5 e §6.6) classificou `mode: CanvasMode`
da `canvas-store` como zumbi sem consumer. **Errado.** Verificação:

- Store: `canvas-store.ts:107` default `'designer'`, setter `setMode`.
- Propagado: `useBoardEngine.ts:693` e `useCanvasEngine.ts:291` →
  `engine.setMode(mode)` → `slotManager.setMode(mode)` (slot-manager.ts:352).
- Comportamento: em modo `'operator'` esconde overlays tracejados de slots,
  trava seleção dos bodies, adiciona placeholder visual em logo slot vazio.
- **18 testes** em `tests/core/canvas/slot-manager.test.ts` (linhas 205, 226, 316).
- Toggle UI existe em `src/ui/pages/dev/canvas-test/ModeToggle.tsx` (rota dev).

Em produção (NovoPedidoPage e PadraoEditorPage) o default `'designer'` não é
trocado — operador real não vê o toggle hoje. Mas a infra está completa e
pronta pra ser usada quando o fluxo template-first separar Designer/Operador
nas rotas (Onda 45). **NÃO REMOVER.**

`AUDIT_TEMPLATES_SPEC.md` foi atualizado em 4 locais com a correção.

---

## Próximo passo — Onda 30

Refactor cirúrgico do `src/core/canvas/canvas-engine.ts` (3.412 linhas).
**Sem mudar API pública.** Quebrado em 4 fases:

| Fase | Arquivo extraído                           | Responsabilidade                                                                                                                            |
| ---- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 30.A | `engine-serialization.ts`                  | `serialize`, `deserialize`, STRIP-RESTORE pattern+clipPath, `applyPatternObjects`                                                           |
| 30.B | `engine-layers.ts`                         | LayerMeta CRUD, `setLayerLocked`, `setLayerVisibility`, `reparentLayer`, validação de invariantes                                           |
| 30.C | `engine-material.ts` + `engine-objects.ts` | `applyMaterialTo*`, `removeMaterialFromLayer`, ClipPath; `addRectangle`, `addAppliqueSvg`, `addEngravingSvg`, `addMarkingSvg`, `createSlot` |
| 30.D | `engine-board.ts` + `engine-core` (resto)  | `fitBoardToViewport`, `fitRegionToViewport`, pan/zoom, viewport, dispose                                                                    |

Critério de saída de cada fase:

- typecheck verde
- lint verde
- 565 testes verdes
- arquivo `canvas-engine.ts` reduzido em ≥800 linhas por fase
- API pública (todos os métodos públicos da classe) inalterada
