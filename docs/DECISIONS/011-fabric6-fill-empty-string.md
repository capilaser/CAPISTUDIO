# ADR 011 — Fabric 6: workaround para fill="none" no canvas DOM

**Data:** 2026-05-09
**Status:** Aceito
**Implementação:** Onda 6b (Fase B-fix)

---

## Contexto

Durante a Onda 6b (Fase B), o `cleanCorelSvg` foi implementado para descartar
informações de cor do SVG do Corel (ADR 010 §3 — "Capi controla cores via texturas
PNG, não via SVG"). Como parte do passo 9 do cleanup, o atributo `fill="none"`
é injetado em todos os shape elements (`path`, `rect`, `circle`, etc.) para
garantir que paths sem fill explícito não recebam o default preto do Fabric 6
ao serem parseados.

Ao final da Fase B, o broche (placeholder em `public/products/broche-60x25.svg`)
passou a renderizar **preto sólido** no canvas, apesar do SVG raw chegar ao
Fabric com `fill="none"` corretamente injetado.

---

## Diagnóstico

Após sessão de logs no DevTools do Tauri (4 console.logs em 4 pontos do
pipeline), foi comprovado que:

1. SVG raw chega ao `fabric.loadSVGFromString` com `fill="none"` no `<rect>`
2. Após `loadSVGFromString`, objetos do Fabric reportam `fill: "none"`
3. Após `obj.set({ fill: 'none' })`, objetos continuam com `fill: "none"`
4. Após `groupSVGElements`, grupo reporta `fill: "none"`
5. Após `canvas.add`, base object reporta `fill: "none"`
6. **Mas o canvas renderiza preto sólido.**

### Causa raiz

Fabric 6 passa o valor literal `"none"` como `fillStyle` para o contexto 2D
do `<canvas>` HTML. O Canvas API do navegador **não conhece o valor `"none"`**
(que é semântica SVG, não CSS). Sem reconhecer, faz fallback para preto.

**SVG entende:** `fill="none"` = sem preenchimento
**Canvas API entende:** apenas cores CSS válidas (`rgb`, `rgba`, hex,
`transparent`)
**Fabric 6 não traduz** entre os dois neste cenário específico (paths
isolados, fora de groups complexos).

---

## Decisão

**No SVG raw (cleanCorelSvg passo 9):** manter `fill="none"`. SVG é semântico,
DOMParser e XMLSerializer respeitam.

**No engine (canvas-engine.ts):** trocar `fill: 'none'` por `fill: ''` (string
vazia) no `obj.set` aplicado dentro de `loadProductSvgFromMeta` e
`loadProductSvg`.

```typescript
// ANTES (renderizava preto)
obj.set({ fill: 'none', stroke: SVG_BASE_STROKE, strokeWidth: 1, strokeUniform: true });

// DEPOIS (renderiza transparente)
obj.set({ fill: '', stroke: SVG_BASE_STROKE, strokeWidth: 1, strokeUniform: true });
```

Fabric 6 trata `fill: ''` como "sem preenchimento" e não passa nada pro canvas
context (skip do `fillStyle` setter), resultando em renderização transparente.

---

## Justificativa

1. **`fill: ''` é o idiomático Fabric 6** para "sem preenchimento". Documentado
   informalmente em issues do projeto Fabric.
2. **`fill: 'transparent'` também funciona**, mas força o Fabric a setar
   `fillStyle = "transparent"`, gastando ciclo de canvas API. `''` é mais
   eficiente (skip).
3. **`fill: null`** quebra tipagem TypeScript do Fabric 6 (espera string).
4. **Manter `fill="none"` no SVG raw** preserva semântica SVG correta. Em caso
   de export futuro do Capi de volta pra SVG, o output respeita SVG spec.

---

## Consequências

- **Engine** (`canvas-engine.ts`): default `fill: ''` em ambos os métodos de
  carga (`loadProductSvg`, `loadProductSvgFromMeta`).
- **Cleanup** (`corel-svg-parser.ts`): step 9 mantém `fill="none"` no SVG raw
  (sem mudança).
- **Teste de integração** (`canvas-engine.test.ts`): assert atualizado de
  `fill === 'none'` para `fill === ''`.
- **Bug invisível ao TypeScript:** TS aceita ambos os valores. Validação só via
  runtime. Documentado como armadilha conhecida.

---

## Risco residual

- Se um dia o Capi precisar **exportar** o canvas de volta pra SVG (Onda 9 ou
  Fase 2), o método de export precisa traduzir `fill: ''` de volta pra
  `fill="none"` no atributo SVG. Ou pular o atributo (default SVG é preto, mas
  isso não importa porque nossas peças sempre vêm com textura PNG por cima).
  Decisão deferida pra Onda 9.
- Outras versões do Fabric (futuras 7.x) podem mudar comportamento. Re-validar
  ao atualizar.

---

## Lição arquitetural

**Testes verdes não provam que o código novo está no caminho de execução.**

Durante a Fase B, 148 testes passaram. Mas o runtime do Tauri continuava
preto. A causa: o teste de integração validava `fill === 'none'` no objeto
Fabric (que está correto), mas não validava a renderização real do canvas
DOM. O bug ficou invisível pros testes.

**Para regressões futuras:** considerar testes que vão até a renderização
real (canvas.toDataURL + análise de pixel, ou snapshot visual com Playwright).
Hoje não temos infra pra isso — ficou como follow-up.

---

## Follow-up

- [ ] Onda 9 — implementar `fill: ''` → `fill="none"` na exportação SVG
- [ ] Fase 2 — avaliar adição de testes de regressão visual (Playwright +
      snapshot do canvas)
- [ ] Re-validar este workaround ao atualizar Fabric.js além de 6.x
