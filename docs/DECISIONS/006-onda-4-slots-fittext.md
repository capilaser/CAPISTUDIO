# ADR 006 — Onda 4: Slots editáveis + fitText

**Data:** 2026-05-05
**Status:** Aceito

---

## Contexto

A Onda 4 entregou os slots editáveis (logo, nome, profissão, custom) e a função `fitText`, peça crítica que reduz fonte progressivamente para texto caber em área sem quebrar linha. Implementada em 3 checkpoints com validação visual obrigatória entre cada um.

---

## Decisões consolidadas

### Comportamento do fitText

- Reduz fonte progressivamente até caber em 1 linha
- **NUNCA quebra linha** (decisão Opção 2A do Gabriell)
- Defaults: max 24pt, min 6pt, passo 0.5pt
- Quando mesmo no mínimo não cabe: retorna `fits: false` sem bloquear render
- Função 100% pura (zero DOM) — `measureFn` injetada pelo chamador para testabilidade

### v1 não tem fitText formalizado

Confirmado por busca exaustiva no `broches-studio_5.html`: não existe função `fitText` nem loop de redução de fonte. Ajuste de fonte no v1 é manual via atributo SVG direto. v2 implementa a função do zero. A Onda 13 (validação contra v1) não terá baseline para comparar `fitText` — apenas output visual final (PNG/SVG exportado).

### Arquitetura body/overlay para slots

Cada slot = 2 objetos Fabric separados:

- **Body Rect** — transparente, `selectable: true`, `evented: true`, `lockRotation: true`, carrega `capiSlot` (SlotMeta), persiste no `canvasJson`
- **Overlay Rect** — tracejado vermelho, `selectable: false`, `evented: false`, `excludeFromExport: true`, visual only, descartado ao recarregar

Alternativa rejeitada: overlay HTML (div React posicionada absolutamente sobre o canvas). Motivo: pan/zoom em HTML sobre canvas é frágil — a div não acompanha transformações de viewport. Fabric Group dentro do canvas acompanha automaticamente.

### Placeholder de logo vazio

- Implementado como `fabric.Group` gerenciado internamente pelo `SlotManager`
- `EmptyLogoPlaceholder.tsx` (componente React) foi descartado durante planejamento pela mesma justificativa do overlay tracejado
- Identificado com propriedade customizada `capiPlaceholder: true`
- `excludeFromExport: true` — não persiste no `canvasJson`

### Cor do overlay de slot

- `rgba(220, 38, 38, 0.6)` — `laser` com opacidade 0.6
- `strokeDashArray: [5, 4]`
- Decisão: idioma industrial (Lightburn-vibe) > cinza neutro. Slot é área editável, vermelho comunica isso diretamente.

### Bug do cache do Fabric 6 — lição crítica da iteração

Atribuição direta `obj.visible = false` **não** marca o `dirty` flag do objeto em Fabric 6. Fabric usa imagem cacheada para objetos inativos, então a mudança não aparece visualmente — EXCETO no objeto atualmente selecionado (que sempre recebe redraw completo).

**Regra:** sempre usar `obj.set({ visible: false })` (ou qualquer propriedade visual). Nunca atribuição direta.

**Impacto no testing:** este bug não aparece em jsdom (sem cache real). Testes automatizados podem passar enquanto o bug existe visualmente no Tauri/Chromium. Validação visual com prints é insubstituível para esta categoria de bug.

### Adapter fabricMeasure e constante PT_TO_PX

- `PT_TO_PX = (25.4 / 72) × 4 = 1.4111 px/pt` (derivado de DPI=4 px/mm)
- `fabricMeasure` cria `fabric.Text` temporário para medir `width`/`height`, retorna em mm
- Em jsdom: `measureText` usa o `canvas` npm package (node-canvas) com fonts do sistema — valores razoáveis mas não idênticos ao Chromium

### Fonte hardcoded — estado atual

- Onda 4 usa `getFirstFont()` do banco (retorna Anton, primeira em ordem alfabética)
- `@font-face` **não está carregado** no WebView Tauri — `fitText` mede com fallback `system-ui` (Times New Roman no Windows), não com a fonte real
- Funcionalmente correto; visualmente a fonte aparece errada (Anton ≠ Times)
- **Resolução planejada:** Onda 4.5 (curadoria de 5 fontes nicho profissional + injeção automática de `@font-face` no boot)

### SVG only no upload de logo

- Aceita apenas arquivos `.svg` no input de logo
- DXF removido permanentemente do escopo da Onda 4
- DXF entra junto com texturas avançadas (Onda 5+)
- Validação: extensão `.svg` + leitura via `FileReader.readAsText` + `try/catch` com `toast.error`
- Input file fica `disabled` durante leitura (previne duplo-processamento)

### fabric.Text, não fabric.IText

Texto dos slots é `fabric.Text` (estático, read-only no canvas). `fabric.IText` foi rejeitado porque habilitaria duplo-clique para edição inline, dessincroniando do input externo e bypassando `fitText`.

### Testes

- **55/55** passando ao final da Onda 4
- 49 testes herdados das Ondas 0–3 + 6 novos da Onda 4
- Tests #11 e #12 (regressão Checkpoint B, cache bug) preservados
- Test #11 foi refinado na Fase 4 para excluir `capiPlaceholder: true` do filtro — preserva a intenção original (overlays invisíveis no Operador) sem conflitar com o novo conceito de placeholder

---

## Consequências

- **Onda 4.5:** banco de fontes curado com `@font-face` automático no boot do WebView
- **Onda 5:** texturas (PNG) + DXF parsing + casos avançados de SVG load
- **Onda 6:** painel de camadas, propriedades numéricas de slot em mm via UI
- **Performance `fitText`:** não medida formalmente. Comportamento interativo sem lag perceptível observado no Tauri. Medir com `console.time` se virar suspeita de gargalo na Onda 5+.

---

## Follow-up registrado

- [ ] Onda 4.5: 5 fontes curadas com `@font-face` injetado no boot
- [ ] Onda futura: medir `fitText` com `console.time` em ambiente Tauri real e registrar no REQUIREMENTS como RF-3.5 validado
