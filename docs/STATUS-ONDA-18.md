# Capi Studio — Status pós-Onda 18

> **Snapshot da sessão 2026-05-17.** Use junto com `AI-CONTEXT.md` e
> `STATUS-ONDA-17.md` pra entender estado real.
> Próxima onda planejada: **Onda 19 — UI Polish (designer findings)**.

---

## Estado real do código (baseline)

- **typecheck**: ✅ verde
- **lint**: ✅ 0 errors (5 warnings cosméticos — mesmo baseline da Onda 17)
- **testes**: ✅ 468/468 passando (+42 vs Onda 17)
- **dev server**: `npx tauri dev` na raiz do projeto

---

## Onda entregue nesta sessão

### Onda 18 — DXF Export (entregue, com checkpoint visual pendente)

Export DXF R12 (AC1009) — formato AutoCAD antigo, máxima compat com
RDWorks/LaserCAD (Ruida) e qualquer software de laser comercial. Espelha
o svg-exporter no que importa pro fluxo do operador (mesmo AssetLookup,
mesmo routing por máquina/operação, mesma honra a `LayerMeta.visible`).

**Decisões travadas (com Gabriell):**

- **Máquina alvo**: RDWorks/LaserCAD (Ruida) → DXF R12 (AC1009)
- **Fluxo**: 1 arquivo por **máquina + operação** (não por máquina só, como
  faz o SVG). Naming: `${stem}_${machineId}_${operation}.dxf`.
- **Texto**: vetorizado em polilinhas via opentype.js (paridade com SVG).
  Hoje a UI **não injeta `fontBufferLoader` no DXF dialog**, então textos
  não aparecem no DXF — segue mesmo comportamento legacy do SVG. Wiring
  fica pra Onda 19+.
- **Curvas**: flattened em polilinhas com tolerance 0.1mm (sub-precisão
  de laser pequeno). Sem SPLINE (R12 não suporta).
- **Cor por operação**: layer DXF nomeada (`corte`/`gravacao`/`marcacao`)
  com colorIndex AutoCAD (7=preto, 1=vermelho, 5=azul).
- **Coordenadas**: mm puros, Y invertido (DXF Y+ pra cima, Fabric Y+ pra
  baixo).
- **Sem dependência externa**: gerador DXF manual ~170 linhas.

**Entregas (7 arquivos novos + 1 UI edit):**

| Arquivo                                    | Responsabilidade                                                                |
| ------------------------------------------ | ------------------------------------------------------------------------------- |
| `src/core/export/dxf-writer.ts`            | Gerador R12 puro (LINE/POLYLINE/CIRCLE/layers)                                  |
| `src/core/export/path-flattener.ts`        | Bézier/Arc → polilinhas via `fabric.util.makePathSimpler + getPointOnPath`      |
| `src/core/export/dxf-exporter.ts`          | Motor por máquina+operação (espelha svg-exporter, reusa AssetLookup)            |
| `src/services/dxf-export-service.ts`       | Salva N DXFs na pasta, mesma postura "tudo ou nada" do svg                      |
| `tests/core/export/dxf-writer.test.ts`     | 14 testes — formato R12, layers, Y-flip, broche realista                        |
| `tests/core/export/path-flattener.test.ts` | 13 testes — retas, béziers cúbicas/quadráticas, círculo dentro de tolerance     |
| `tests/core/export/dxf-exporter.test.ts`   | 10 testes — routing, filtros (visible/excludeFromExport/sem-id), defensivo      |
| `tests/core/export/dxf-roundtrip.test.ts`  | 5 testes — parser DXF de teste valida DXF gerado (geometria/layers/bbox/Y-flip) |
| `src/ui/canvas/ExportSvgDialog.tsx`        | +Checkbox "Também exportar DXF" + chamada paralela ao DXF service               |

**Fix oportunista da sessão (Fase F):**

- `svg-exporter`: VisualLayerMeta sem `engravingId`/`markingId` agora
  vira **warn + skip** em vez de throw. Antes: o export inteiro travava
  porque o operador tinha um slot Nome/Profissão vazio. Agora: slot
  sem asset simplesmente não aparece no SVG/DXF. Comportamento
  validado em teste novo (`svg-exporter.test.ts:322`).

---

## Hotfixes durante a sessão (resolvidos)

### Bug 1 — `isCutStroke` agressivo demais

- **Causa**: tentei filtrar a forma de corte do produto pela cor do
  stroke (`#2a2c2e = SVG_BASE_STROKE`). Esse approach veio do
  png-exporter da Onda 17. Mas pra DXF foi catastrófico: TODOS os
  apliques/gravações/marcações usam `SVG_BASE_STROKE` por convenção
  do canvas-engine. Nada saía no DXF.
- **Fix**: removido `isCutStroke()`. Discriminador correto é "tem id
  capi e tem LayerMeta?" — a forma de corte do produto não passa por
  `addAppliqueSvg`/etc, então não tem id capi. O check `getCapiId() +
layerById.has(id)` já filtra naturalmente.

### Bug 2 — Stack overflow no `DxfBuilder.build()`

- **Causa**: `parts.push(...this.entities)` com spread. V8 limita
  ~125k args em `apply`; broches com curvas flattened geram dezenas
  de milhares de tokens VERTEX.
- **Fix**: substituído spread por `for (const e of this.entities) parts.push(e)`.
  Escala linearmente sem limite.

### Bug 3 — Parser DXF de teste quebrado

- **Causa**: primeira versão do parser misturava avanço de cursor por
  par e por token, confundia LAYER header com LAYER entry, perdia
  entidades.
- **Fix**: parser reescrito como state machine baseada em SECTION
  boundaries. Lê tokens em pares determinísticos (code/value),
  delimita cada section por SECTION/ENDSEC, trata sub-blocos
  (LAYER entry, POLYLINE+VERTEX+SEQEND) com cursors locais. 5
  testes roundtrip passam.

---

## Bugs conhecidos / Débito técnico

### Aberto nesta sessão

- **Bug do material: dourado selecionado → broche renderiza prata**
  ([print do Gabriell na sessão 2026-05-17]). Investigação estática
  inconclusiva. Possíveis causas a confirmar com runtime:
  1. Seed `defaultMaterialId = 'abs-escovado-prata'` em
     `seedSettings.ts:8` está sobrescrevendo seleção do operador num
     fluxo que não enxergamos.
  2. `materialImageCache` por `materialId` em `canvas-engine.ts:160`
     poderia cruzar Promises se houver bug de id; pouco provável pela
     design.
  3. Race condition: troca de material persiste no store antes do
     boot do canvas terminar; canvas aplica último valor não-rendered.
     **Próximo passo**: coletar logs no DevTools no momento do bug
     (qual `materialId` chega em `applyMaterialToLayer`, qual URL é
     passada, se a Image cacheada bate). Sem evidência runtime, fix é chute.
     Documentado em [[debt_material_dourado_prata]] (memory) e candidato
     pra Onda 19+ (ou onda dedicada se piorar). **Workaround atual**:
     trocar o material via MaterialChanger depois do boot funciona — só
     o estado inicial fica errado.

- **Onda 18 sem checkpoint visual no RDWorks**: testes roundtrip do
  DXF gerado validam estrutura/geometria/bbox/Y-flip, mas o
  arquivo nunca foi aberto no software real. Risco residual: quirk
  de parser do RDWorks que tests não capturariam. **Próximo passo**:
  Gabriell abre 1 DXF no RDWorks (qualquer pedido com aplique +
  gravação) e confirma visual; se OK, esse débito sai. Se quebrar,
  vira issue dedicada.

### Herdados da Onda 17

- ~~**`CAPI_CUSTOM_PROPS` incompleto**~~ — **investigado e resolvido na própria Onda 18 (sessão pós-fechamento)**:
  era diagnóstico errado da Onda 17. Os 3 flags vivem em objetos com
  `excludeFromExport: true`; Fabric filtra `_objects.filter(t => !t.excludeFromExport)`
  ANTES de aplicar CAPI_CUSTOM_PROPS, então adicionar à lista seria no-op.
  Os objetos são recriados pelo boot, não pelo deserialize. Comentário em
  [canvas-engine.ts:24-56](src/core/canvas/canvas-engine.ts#L24) atualizado
  pra documentar a exclusão deliberada e prevenir reabertura do falso-débito.
  Memory `project-capi-custom-props-incompleto` reescrita como "não-débito".

### Herdados da Onda 16

- **`useCanvasStore()` sem selector** em `useBoardEngine` (linha 138)
- **`getLayersHierarchy` O(N log N)** em cada evento canvas

### Novo, da Onda 18

- **Duplicação consciente entre svg-exporter e dxf-exporter**: a lógica
  de "iterar canvas → resolver routing → coletar máquinas" é cópia
  adaptada (~80 linhas). Não extraí função compartilhada pra não
  arriscar regressão nos 426 testes do SVG. Refactor DRY fica pra
  Onda 24 (hardening).
- **Texto não vai pro DXF**: `dxf-exporter` skipa textos quando
  `fontBufferLoader` não é injetado. Hoje a UI não injeta. Wiring de
  fontes fica pra Onda 19+ (UI polish + features de texto).

---

## Lições críticas desta sessão

1. **Filtro por característica visual (cor de stroke) é frágil**: a
   convenção `SVG_BASE_STROKE` é compartilhada entre forma de corte
   E todos os apliques/gravações. Usar essa cor como discriminador
   funcionou só no contexto restrito do png-exporter (onde só sobrava
   a forma de corte pra esconder). Em outros contextos, o filtro
   correto é "tem LayerMeta?" (estrutura de domínio, não pixel).

2. **Spread (`...arr`) é uma armadilha em arrays grandes**: V8
   limita ~125k args em `Function.prototype.apply`. Pra arrays que
   podem crescer (entities de DXF, polylines flattened), sempre
   `for...of` + `push`.

3. **Parser de validação > confiança cega no writer**: o teste
   roundtrip (Fase E) achou bugs no próprio parser de teste antes
   de validar o writer. Vale a pena escrever parser de validação
   pra qualquer formato binário/proprietário sendo gerado — sem ele,
   "passou no Vitest" não prova nada sobre o arquivo.

4. **`obj.toSVG()` do Fabric é tentador mas frágil pra DXF**: emite
   wrapper `<g transform="matrix(...)">` que exige reparse + álgebra
   de matriz. Acesso direto via `obj.path + obj.calcTransformMatrix() +
obj.pathOffset + fabric.util.transformPoint` é mais previsível.

5. **Throw em export é hostil pro operador**: o svg-exporter da Onda 9
   lançava em qualquer slot vazio. Cenário comum (slot Nome sem texto)
   travava export inteiro. `warn + skip` desbloqueia trabalho real.
   Trade-off aceito: slot vazio = sem geometria = nada no arquivo.

---

## Roadmap atualizado pós-Onda 18

### Próxima — Onda 19: UI Polish (designer findings)

- Hierarquia tipográfica (mono só pra valores, body em labels)
- 4 níveis de superfície (`#0A0A0B` → `#1C1D22`)
- Botão Aprovar translúcido (não verde gritante)
- Micro-interações 200ms ease-out
- Estados vazios desenhados
- PatternBar com filtros agrupados

### Onda 20: Atalhos

- Ctrl+S, Ctrl+E (export SVG), Ctrl+P (PNG), Ctrl+D (duplicar)
- Tab/Shift+Tab navega entre slots
- Delete remove camada
- `?` mostra cheatsheet

### Onda 21: Banco de logos usável

- Busca por nome + tag, filtro "usado nos últimos N dias"
- Preview SVG no hover, drag-and-drop pro slot

### Onda 22: Copiar pedido + Revisões

### Onda 23: Validações + estados de erro

### Onda 24: Hardening final

- Sessão 4h sem memory leak
- Testes RTL críticos, `npm audit fix`, sanitização SVG, MSI installer
- **Refactor DRY svg-exporter ↔ dxf-exporter** (débito Onda 18)
- ~~Resolver `CAPI_CUSTOM_PROPS`~~ — investigação na própria Onda 18
  concluiu que era não-débito (ver seção "Herdados da Onda 17")

**Meta**: MVP rodando 30 pedidos/dia, offline desktop.

---

## Comandos essenciais

```bash
# Rodar
npx tauri dev

# Resetar banco em dev (forçar re-seed)
del "%APPDATA%\com.capi-studio.app\capi-studio.db"

# Validações
npm run typecheck
npm run lint
npx vitest run
```

---

## Arquivos-chave (índice rápido — onda 18)

- **DXF writer**: `src/core/export/dxf-writer.ts` (R12 puro, layers, Y-flip helper)
- **Path flattener**: `src/core/export/path-flattener.ts` (Bézier→polyline, tolerance 0.1mm)
- **DXF exporter**: `src/core/export/dxf-exporter.ts` (motor por máquina+operação)
- **DXF service**: `src/services/dxf-export-service.ts` (salva N arquivos)
- **Export dialog**: `src/ui/canvas/ExportSvgDialog.tsx` (checkbox DXF + chamada paralela)
- **SVG exporter (mod)**: `src/core/export/svg-exporter.ts:288` (slot avulso = warn+skip)

---

_Última atualização: **Onda 18 fechada — DXF Export R12 + svg-exporter tolerante**. Sessão 2026-05-17._
_Próxima onda: 19 — UI Polish._
_Checkpoint visual no RDWorks: **PENDENTE** — Gabriell precisa abrir 1 .dxf gerado e confirmar visual._
