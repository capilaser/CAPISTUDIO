# V1 Research — applyMaterialToSvg e buildSvgWithPngClip

**Checkpoint C.0 — Onda 5**
**Data:** 2026-05-07
**Referência:** `C:\Users\Gabriell\Desktop\PROGRAMÃO\renderer\index.html`

---

## 1. Diferença Arquitetural Fundamental (v1 vs v2)

| Aspecto                        | v1                                                       | v2                                                  |
| ------------------------------ | -------------------------------------------------------- | --------------------------------------------------- |
| **Onde o material é aplicado** | No SVG do produto (Camada 0 / background)                | Nas camadas de usuário (Fabric.js Rect/Slot)        |
| **Formato de saída**           | String SVG modificada                                    | `fabric.Pattern` ao vivo no canvas                  |
| **Clip**                       | `<clipPath>` SVG sobre `<image>` dentro do próprio SVG   | A definir (ver Cenários abaixo)                     |
| **Cache**                      | `MATERIAL_PNG_CACHE` objeto JS plano (colorId → dataURL) | `Map<materialId, HTMLImageElement>` (a implementar) |

**Consequência:** a lógica de clip em v2 é inversa à do v1. Em v1, o clip isola o PNG dentro do contorno do produto. Em v2, já temos o produto como objeto Fabric (base locked); o clip precisa garantir que o material de uma camada de usuário não extravase o contorno do produto — ou, se o produto for não-retangular, que o fill Pattern siga o shape real.

---

## 2. Pipeline v1 Completo

### 2.1 `svgToShapeOnly(svgText)` — linhas 6832–6866

Pré-processa o SVG antes de qualquer aplicação de material.

**O que faz:**

1. Parseia o SVG com `DOMParser`
2. Remove todos os `<style>` (CorelDRAW usa classes `.fil0`, `.str0` com precedência sobre atributos inline — isso quebraria os fills aplicados depois)
3. Remove atributos `class` de todos os shapes
4. Para cada shape fechado (`path, rect, circle, ellipse, polygon`):
   - `fill` → `#cccccc` (placeholder, exceto se já era `url(...)`)
   - `stroke` → `#1a1830` se ausente ou `none`
   - `stroke-width` → `0.4` se zero ou ausente
5. Retorna SVG serializado como string

**Por que importa para v2:** expõe o padrão de "limpeza antes de processar" — limpar estilos de origem (CorelDRAW/Illustrator) é obrigatório antes de aplicar material.

---

### 2.2 `applyMaterialToSvg(svgText, colorId)` — linhas 6650–6735

Fallback de gradiente. Usado quando não há PNG em cache para o `colorId`.

**O que faz:**

1. Parseia SVG
2. Lê `MATERIALS[colorId]` → `{ stops[], brushed }`
3. Cria `<linearGradient id="mat-{colorId}">` com os stops do material
4. Se `mat.brushed === true`: adiciona `<filter>` com `feTurbulence` (baseFrequency 0.65/0.3, numOctaves 3) + `feBlend mode="multiply"` → simula aspecto de alumínio escovado
5. **Estratégia de fill por shape:**
   - Shape **com stroke**: original recebe `fill=none` (preserva o traço), clona o shape e insere o clone **antes** do original com `fill=url(#mat-{colorId})` e `stroke=none`. Isso evita que o gradiente fique por cima do contorno.
   - Shape **sem stroke**: aplica `fill=url(#mat-{colorId})` diretamente.
6. Retorna SVG serializado

**Equivalência em v2:** não há equivalência direta ainda. O fallback de gradiente mapearia para `materials.fallback_stops` (já modelado no schema). Não está no escopo imediato do Checkpoint C.

---

### 2.3 `buildSvgWithPngClip(svgText, pngDataUrl)` — linhas 13966–14035

Caminho principal quando há PNG em cache. Recebe o SVG **já pré-processado por `svgToShapeOnly`**.

**O que faz:**

1. Parseia SVG, remove `<style>` novamente (segurança)
2. Coleta todos os shapes: `path, rect, circle, ellipse, polygon`
3. Extrai `viewBox` → `vbX, vbY, vbW, vbH`
4. Calcula `vbMax = Math.max(vbW, vbH)` para espessura de stroke proporcional
5. **Cria `<clipPath id="bgPngClip">`** com clones dos shapes:
   - `fill="#000"` (obrigatório para clip funcionar)
   - `stroke` removido dos clones
6. **Insere `<image>`** com:
   - `href = pngDataUrl`
   - `x=vbX, y=vbY, width=vbW, height=vbH` (cobre todo o viewBox)
   - `preserveAspectRatio="xMidYMid slice"` (cobre sem distorção)
   - `clip-path="url(#bgPngClip)"` ← o clip acontece aqui
7. Restaura os shapes originais:
   - `fill=none` (a PNG já preenche a área via `<image>`)
   - `stroke=#1a1830` se não tinha
   - `stroke-width = vbMax * 0.0015` se era zero
8. Retorna SVG serializado

**Resultado visual:** PNG materializado dentro do contorno exato do produto, com o stroke do produto renderizado por cima.

---

### 2.4 `MATERIAL_PNG_CACHE` e `loadMaterialPngCache` — linhas 13458 e 13924–13957

```javascript
let MATERIAL_PNG_CACHE = {}; // colorId → base64 dataURL
```

`loadMaterialPngCache()` é chamado no boot como parte de um `Promise.all`. Lê a pasta `assets/svg/material/`, mapeia filename → colorId (heurística por nome de arquivo), resolve cada imagem como dataURL e popula o cache.

**Call logic (linhas 11942–11947):**

```javascript
const png = _materialPngForColor(colorId);
const processed = png ? buildSvgWithPngClip(reshape, png) : applyMaterialToSvg(reshape, colorId);
```

---

### 2.5 `MATERIALS` — linhas 6584–6633

```javascript
const MATERIALS = {
  'abs-escovado-prata': {
    family: 'ABS Escovado',
    label: 'Prata',
    swatch: '#8a8e92',
    stops: [
      /* gradiente */
    ],
    brushed: true,
  },
  // ...
};
```

Em v2, o equivalente está em `materials.fallback_stops` (JSON no banco, já modelado no schema Drizzle).

---

## 3. Diagrama do Pipeline v1

```
SVG do produto
      │
      ▼
svgToShapeOnly()
  └─ remove <style> / classes
  └─ fill=#cccccc placeholder
  └─ garante stroke
      │
      ▼
buildSvgWithPngClip(svg, pngDataUrl)        applyMaterialToSvg(svg, colorId)
  └─ clipPath com shapes clonados              └─ linearGradient dos stops
  └─ <image> clip-path="url(#bgPngClip)"       └─ feTurbulence se brushed
  └─ shapes originais: fill=none               └─ clone strategy p/ stroked shapes
      │                                              │
      └──────────────────┬───────────────────────────┘
                         ▼
               SVG final como string
               (inserido no DOM via innerHTML)
```

---

## 4. O Que v2 Precisa (Checkpoint C)

### 4.1 Onde o clip ocorre em v2

Em v2, a arquitetura é diferente:

- O produto está carregado como objetos Fabric (base SVG decomposto em paths por `loadProductSvg`)
- Os objetos de base têm `[BASE_OBJECT_FLAG] = true` e `excludeFromExport = true`
- As camadas de usuário são `fabric.Rect` (e futuramente `fabric.Path` para slots de formas customizadas)
- O `fabric.Pattern` já preenche o rect com a textura — mas sem clip, a textura aparece em toda a área do rect, mesmo que o rect extravase o contorno do produto

**O clip em v2 responde à pergunta:** como fazer o material respeitar o contorno do produto?

Para um broche circular ou formato especial: sem clip, um rect de material aplicado pelo usuário mostraria a textura em forma retangular, não circular. Com clip: a textura aparece apenas dentro do contorno do produto.

### 4.2 Cenário 1 — Fabric `clipPath` com `absolutePositioned: true`

**Como funciona:**

- Extrair os paths do SVG do produto como objetos `fabric.Path`
- Criar um `fabric.Group` (ou `fabric.Path` composto) com esses paths como clipPath
- Atribuir ao layer de usuário: `rect.clipPath = productClipPath; productClipPath.absolutePositioned = true`
- `absolutePositioned: true` faz o Fabric interpretar as coordenadas do clipPath no espaço do canvas, não relativo ao objeto

**Vantagens:**

- Nativo do Fabric.js — zero canvas 2D manual
- Funciona automaticamente com zoom/pan/rotate do objeto (quando `absolutePositioned: false` — mas isso mudaria o behavior)
- Pattern + clipPath são features bem testadas do Fabric

**Desvantagens:**

- O clipPath precisa ser recriado ou clonado para CADA layer de usuário (não se compartilha diretamente entre objetos Fabric sem deep clone)
- Com `absolutePositioned: true`: o clip usa coordenadas do canvas. Se o objeto se mover, o clip "fica parado" — comportamento estranho
- Com `absolutePositioned: false` (padrão): o clip usa coordenadas locais do objeto, o que significa que precisaria ser escalonado/posicionado para cobrir o objeto. Mais complexo para coordenadas arbitrárias.
- Perf: Fabric re-renderiza o clipPath a cada frame

**Veredito:** Viável, mas `absolutePositioned` cria acoplamento posicional não trivial. Requer prototipação.

### 4.3 Cenário 2 — Canvas 2D pré-render (off-screen)

**Como funciona:**

1. Criar um `<canvas>` off-screen com as dimensões do produto (em pixels MM_TO_PX)
2. Desenhar o PNG do material escalado para cobrir o canvas
3. Usar o shape SVG do produto como clip via `ctx.clip()` (CanvasRenderingContext2D)
4. Usar o canvas resultante como `source` do `fabric.Pattern`

**Vantagens:**

- O clip já está "assado" na imagem — fabric.Pattern se comporta exatamente como no Checkpoint B
- Sem overhead de re-renderização de clipPath por frame
- Independente de `absolutePositioned`
- Testável puro (canvas 2D é disponível em jsdom)

**Desvantagens:**

- Requer parsear o SVG do produto e renderizar via `Path2D` no canvas 2D
- O canvas pré-renderizado tem dimensões fixas (produto) — se o usuário escalar o rect além do produto, a textura repete ou corta
- Mais difícil de "reutilizar" se o produto muda

**Veredito:** Mais simples de implementar corretamente, comportamento mais previsível.

### 4.4 Cenário 3 — Conflito arquitetural

Não aplicável aqui. Os dois cenários são implementáveis. O Checkpoint C é sobre escolher entre 1 e 2.

---

## 5. Recomendação

**Cenário 2 (canvas 2D pré-render)** para o Checkpoint C.

Razões:

1. **Consistência com Checkpoint B**: o Pattern continua sendo a única abstração — o Fabric não precisa saber nada sobre clipPath. A camada de clip fica toda em `material-applier.ts` (pure, testável).
2. **Performance**: clip "assado" na imagem = zero overhead por frame de render do Fabric.
3. **Testabilidade**: `canvas 2D` está disponível em jsdom (via `document.createElement('canvas')`). `Path2D` está disponível no jsdom moderno. A função permanece pura e injetável.
4. **Alinhamento com v1**: `buildSvgWithPngClip` em v1 também "assava" o clip na saída final — não havia recalculo por frame.
5. **Risco baixo**: o Fabric.js `clipPath` com `absolutePositioned` tem comportamento não intuitivo documentado nos issues do Fabric — evitar para não adicionar bugs difíceis de reproduzir.

**Função nova proposta em `material-applier.ts`:**

```typescript
export async function buildClippedMaterialPattern(
  assetUrl: string,
  productPaths: string[], // path "d" attributes do SVG do produto
  productWidthPx: number,
  productHeightPx: number,
  loader?: (url: string) => Promise<HTMLImageElement>
): Promise<fabric.Pattern>;
```

A função:

1. Carrega o PNG via `loader`
2. Cria canvas off-screen `productWidthPx × productHeightPx`
3. Constrói `Path2D` a partir de cada path do produto e faz `ctx.clip()`
4. Desenha o PNG escalado (cover)
5. Retorna `new fabric.Pattern({ source: offscreenCanvas, repeat: 'no-repeat', patternTransform: [...] })`

O resultado é um Pattern que, ao preencher um rect do tamanho do produto, mostra a textura clippada ao contorno.

---

## 6. Questões em Aberto para Gabriell

1. **Escopo do clip:** O clip deve ser aplicado apenas quando o layer é do mesmo tamanho que o produto inteiro? Ou também para rects menores (slot de área parcial)? Se for slot parcial, o clip muda de "contorno do produto" para "contorno do slot".

2. **Fallback sem clip:** Se o produto não tiver SVG com paths (ex: produto com background PNG), aplicar Pattern sem clip (comportamento atual do Checkpoint B) ou bloquear a aplicação de material?

3. **Cache de imagem:** A proposta C.2 é um `Map<materialId, HTMLImageElement>` pré-carregado no boot. O off-screen canvas gerado (já clippado) também deve ser cacheado? Isso economizaria o re-render do clip a cada `applyMaterialToLayer`, mas aumenta uso de memória.

---

_Aguardando aprovação antes de propor o plano técnico C.1 + C.2 + C.3._
