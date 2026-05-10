# NOTA TÉCNICA — Onda 9 deve ler `LayerMeta.visible` no export

**Origem:** 2026-05-10, calibração da Onda 7 (decisão da Pergunta 1)
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

## Onde está o sinal

- `setLayerVisibility` no `canvas-engine.ts` tem JSDoc que aponta pra este arquivo.
- `docs/AI-CONTEXT.md` (rodapé da Onda 7) referencia este arquivo.

## Quando implementar

**Obrigatório na Onda 9.** Se a Onda 9 começar e ignorar esta nota, o feature de "esconder camada" estará quebrado pro usuário final.
