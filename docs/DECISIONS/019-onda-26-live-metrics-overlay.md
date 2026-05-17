# ADR 019 — Live Metrics Overlay (Onda 26)

**Data:** 2026-05-17
**Status:** Aceito
**Implementação:** Onda 26

---

## Contexto

O operador ajusta artes em mm com precisão de 0.1mm (regra do CLAUDE.md). Antes desta onda, o feedback numérico durante drag/resize estava **fora do ponto de ação** — operador precisava soltar o mouse e olhar o painel lateral pra ver a posição final. Em produção real (50+ broches/dia), isso vira muito ir-e-vem visual canvas→painel→canvas.

Editores profissionais (CorelDRAW, Photoshop, LightBurn) resolvem isso com **HUD numérico flutuante**: enquanto o gesto está ativo, um balão grudado no objeto mostra os números em tempo real. O olho não sai do canvas.

## Decisões

### 1. Escopo do gesto: drag + resize (rotate fica fora)

Cobrimos `object:moving` e `object:scaling`. `object:rotating` foi excluído porque:

- rotação é raríssima em broche/placa (peças padronizadas, ortogonais)
- adicionar ângulo no HUD aumenta densidade textual sem ganho prático equivalente
- se virar necessidade real, é trivial estender depois — mesma infra

### 2. Apenas seleção única

Quando o operador arrasta uma `ActiveSelection` (múltiplos selecionados), o HUD fica **escondido**. Mostrar agregados (bbox do grupo? média das posições?) seria ambíguo e dispersaria atenção. Foco em 1 objeto = feedback inequívoco.

### 3. Default ligado (`liveMetricsEnabled: true`)

Ferramenta industrial existe pra dar feedback. Padrão "rico por default, operador desliga se incomodar" se alinha com a regra do CLAUDE.md ("ferramenta operacional para produção"). Toggle global vive em `canvas-store.ts` — UI control fica pra uma próxima onda quando for necessário.

### 4. Mesmo padrão arquitetural do MeasurementOverlay (Onda 7b Fase E)

Para coerência e performance herdada:

| Aspecto                   | Decisão                                                   |
| ------------------------- | --------------------------------------------------------- |
| Render                    | DOM puro (`<div>` flutuante), sem objeto Fabric           |
| Texto                     | `font-mono` + `tabular-nums` (regra do CLAUDE.md)         |
| Atualização durante gesto | `style.transform` + `textContent` via ref — sem setState  |
| Batching                  | `requestAnimationFrame` coalesce múltiplas fontes         |
| `setState` só em          | mudanças discretas (gesto começa / termina)               |
| Fontes de invalidação     | `object:moving`, `object:scaling`, `after:render`, resize |

A justificativa para o padrão híbrido (DOM + Fabric) está no ADR 015 §2. Live Metrics não desenha linhas — só caixa — então o componente é uma versão simplificada do mesmo molde.

### 5. Ancoragem ao canto inferior-direito da bbox + offset 8px

| Alternativa               | Por que não                                                         |
| ------------------------- | ------------------------------------------------------------------- |
| Centro do objeto          | tampa o conteúdo durante drag                                       |
| Cursor do mouse           | exige rastreamento extra de eventos, e cursor não é o objeto        |
| Topo-direita              | colide com toolbars/header do app                                   |
| **Inferior-direita +8px** | fora da bbox, longe da maioria das alças, raramente sai da viewport |

Se o objeto está colado na borda direita do canvas, o HUD pode sair da viewport. Aceito — operador ajusta visualmente, e a maioria dos casos não está na borda.

### 6. Formato textual

- **Drag**: `x: 12.3 mm   y: 8.1 mm   Δx: +2.1   Δy: +0.4` — absoluto + delta. Delta é o ganho real do HUD (operador raciocina em "movi N mm da posição inicial").
- **Resize**: `w: 25.0 mm   h: 12.0 mm` — sem delta. Largura/altura **absolutas** são o que importa pra peça (operador pensa "preciso de 25mm de largura", não "+3mm").
- **Só mm.** Não mostramos %. Operador trabalha em unidade física, não razão.

### 7. Coexistência com outros overlays

Quando `measurementMode` (par de medição) e Live Metrics estão ativos ao mesmo tempo no mesmo objeto, ambos aparecem — não há conflito visual porque ancoragens são diferentes (medição: meio dos lados do "L"; live: canto inferior-direito). Se virar barulhento na prática, próxima onda decide hierarquia.

## Trade-offs aceitos

1. **Overlay pode sair da viewport** se objeto está na borda direita/inferior. Custo: irrelevante (operador percebe e move pra área útil).
2. **Não persiste `liveMetricsEnabled`** — toggle só vale pra sessão. Persistir seria salvar em settings.local; ônus desproporcional pro ganho.
3. **Resize não mostra delta de tamanho**. Operador pensa em w/h finais, não em "ganhei 3mm". Se mudar de ideia, fácil estender.

## Arquivos tocados

- `src/stores/canvas-store.ts` — novo flag `liveMetricsEnabled` + `toggleLiveMetrics`
- `src/core/canvas/format-metrics.ts` — formatadores puros (`formatMm`, `formatDeltaMm`, `composeDragLine`, `composeResizeLine`)
- `src/ui/canvas/LiveMetricsOverlay.tsx` — componente do HUD
- `src/ui/pages/dev/canvas-test/CanvasWorkspace.tsx` — mount do overlay
- `tests/core/canvas/format-metrics.test.ts` — 15 testes dos formatadores puros (seguindo regra do CLAUDE.md: testes vivem em `core/`, não em UI)
