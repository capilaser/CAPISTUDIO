# NOTA TÉCNICA — Onda 9 deve ler `LayerMeta.visible`, `appliqueId` e `engravingId` no export

**Origem:** 2026-05-10, calibração da Onda 7 (Pergunta 1) + Onda 8.5 (Pergunta 4)
**Status:** Contrato técnico crítico — implementação obrigatória na Onda 9

## Resumo

Quando a Onda 9 (exportação SVG por máquina/operação + PNG mockup) for implementada, a rotina de export **DEVE** ler `LayerMeta.visible` e **pular camadas com `visible === false`** no arquivo final.

## Por que isso é uma nota técnica e não uma ideia

Não é "feature futura" — é **contrato implícito** estabelecido na Onda 7 quando o painel de camadas ganhou toggle de visibilidade. O usuário (Gabriell) acordou expectativa explícita:

> "Esconder camada faz ela sumir do canvas E não vai pro export final."

Na Onda 7, só o **lado do canvas** foi implementado (`obj.set({ visible: false })`). O **lado do export** depende da Onda 9 existir.

## Por que não foi feito na Onda 7

Tentativa óbvia: usar `obj.set({ excludeFromExport: true })` quando layer fica invisível. Bug grave detectado em flight:

- `excludeFromExport: true` faz o `engine.serialize()` pular o objeto do `canvasJson` ao salvar padrão.
- Reabrir o padrão → o objeto **não existe** no canvasJson → camada desaparece completamente, não está "escondida".
- Usuário perde camada ao salvar.

Solução: **separar 2 conceitos**:

- **Persistência no canvasJson:** sempre persiste (`LayerMeta.visible: false` carregado normalmente).
- **Inclusão no export final:** filtra `LayerMeta.visible === false` no momento do export.

## O que a Onda 9 deve fazer

Em qualquer rotina que monte o output de export (PNG mockup ou SVG produção):

```ts
const exportable = canvas.getObjects().filter((obj) => {
  const id = getCapiId(obj);
  if (!id) return false; // ignora objetos sem capi id
  const meta = engine.getLayerMeta(id);
  if (!meta) return true; // sem meta → inclui (decisão default)
  return meta.visible !== false; // pula invisível
});
```

Esse filtro deve ser aplicado **tanto pro PNG mockup quanto pro SVG por máquina**.

## Roteamento por máquina/operação (adicionado Onda 8.5)

Além de filtrar por `visible`, a Onda 9 vai precisar **rotear cada camada pra máquina/operação correta** ao montar o SVG por máquina. Os campos relevantes:

- **`PrincipalLayerMeta.appliqueId`** (Onda 6.5) — link pra `appliques.metadata` (se houver), pode determinar tipo de corte/aplique pra essa peça física.
- **`VisualLayerMeta.engravingId`** (Onda 8.5) — link pra `engravings.metadata`, determina a operação real da gravação (ex: "gravação rasa", "marca-piloto") e provavelmente a máquina específica (laser de gravação vs. laser de corte).

A Onda 8.5 ainda **não popula `engraving.metadata`** (campo nullable, vazio no seed da balança-advogado). A Onda 9 vai precisar:

1. Definir schema do `metadata` (sugestão: `{ operation: string, machines: string[] }` — mesmo formato de `OperationLayerMeta`).
2. Backfill do seed `seedEngravings.ts` com `metadata` apropriado.
3. Ler `engraving.metadata` no roteamento de cada VisualLayer com `engravingId !== null`.

Sem isso, gravações cairiam num bucket genérico no export.

## Onde está o sinal

- `setLayerVisibility` no `canvas-engine.ts` tem JSDoc que aponta pra este arquivo.
- `addEngravingSvg` no `canvas-engine.ts` tem JSDoc apontando pra este arquivo (Onda 8.5).
- `VisualLayerMeta.engravingId` no `schema.ts` tem JSDoc apontando pra este arquivo (Onda 8.5).
- `docs/AI-CONTEXT.md` (rodapé das Ondas 7 e 8.5) referencia este arquivo.

## Quando implementar

**Obrigatório na Onda 9.** Se a Onda 9 começar e ignorar esta nota, o feature de "esconder camada" estará quebrado pro usuário final.
