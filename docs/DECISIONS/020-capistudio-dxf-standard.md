# ADR 020 — CAPISTUDIO_DXF_STANDARD

**Status:** Aprovado · **Data:** 2026-05-19 · **Onda:** DXF-PRODUCTION-STANDARD

## Contexto

DXF é o formato oficial de produção do Capi Studio. PNG = mockup para cliente. SVG = formato interno/intermediário/debug. DXF = arquivo que vai para a máquina laser Ruida (RDWorks/LaserCAD).

O exportador DXF atual gera **AC1009/R12 com POLYLINEs** e texto em polylines abertas — não compatível com o padrão de produção. Este documento define o formato alvo, baseado em análise estrutural do arquivo de referência **`08-04 - BROCHE - natanepaes.dxf`** (34.772 linhas, gerado no CorelDRAW, comprovadamente funcional na máquina).

---

## 1. Versão DXF alvo

**AC1032 (AutoCAD 2018, DXF R2018), ASCII.**

| Razão                           | Detalhe                                          |
| ------------------------------- | ------------------------------------------------ |
| Compatível com SPLINE estável   | AC1009/R12 não tem SPLINE como entidade primária |
| Suportado pelo RDWorks moderno  | Versões pós-2015 leem AC1032 sem problema        |
| Espelha o arquivo de referência | `$ACADVER = AC1032` no DXF real                  |
| UTF-8 não é necessário          | Texto sempre vetorizado (ver §3)                 |

**Encoding:** ASCII puro, CRLF (`\r\n`), sem BOM, `$DWGCODEPAGE = ANSI_1252` (replica o real).

---

## 2. Entidades permitidas

**Única entidade geométrica: `SPLINE`.**

| Entidade              | Permitido      | Justificativa                                                         |
| --------------------- | -------------- | --------------------------------------------------------------------- |
| SPLINE                | ✅ obrigatório | Único tipo no arquivo de referência (67/67 entidades)                 |
| LINE                  | ❌             | Converter para SPLINE grau 3 com 4 control points colineares          |
| LWPOLYLINE / POLYLINE | ❌             | Risco de "polyline aberta quebrando letra" (problema atual)           |
| ARC / CIRCLE          | ❌             | Converter para SPLINE (4 segmentos cubic para círculo, padrão Bézier) |
| ELLIPSE               | ❌             | Converter para SPLINE                                                 |
| TEXT / MTEXT          | ❌ proibido    | Ver §3                                                                |
| INSERT / BLOCK        | ❌             | Não usados no real (apenas `*Model_Space`/`*Paper_Space` vazios)      |
| HATCH / POINT         | ❌             | Não usados                                                            |

### Anatomia obrigatória da SPLINE

Baseada na primeira SPLINE do arquivo real:

```
0
SPLINE
8         → layer name
Camada 1
62        → color (31, 250 ou 5 — ver §4)
<cor>
100
AcDbEntity
100
AcDbSpline
210/220/230 → normal vector
0.0 / 0.0 / 1.0
70        → flags (1=closed, 8=planar, 11=closed+planar)
<flags>
71        → degree
3
72        → number of knots
<n_knots>
73        → number of control points
<n_ctrl>
74        → number of fit points
0
42        → knot tolerance
1e-10
43        → control-point tolerance
1e-10
40 × n_knots → knot values (clamped, normalizados [0,1])
...
10/20/30 × n_ctrl → control points XYZ (Z sempre 0.0)
...
```

**Regras invariantes:**

- Grau **3** (cubic) sempre.
- Planar: vetor normal `(0, 0, 1)`, todos Z = 0.
- **Control-points only:** zero fit points (código 74 = 0).
- Knots **clamped + normalizados em `[0, 1]`**, multiplicidade `degree+1=4` nos extremos, `degree=3` nos internos para curva fechada.
- Curvas fechadas: flag 70 = 11 (bit 1 closed + bit 8+2 planar).
- Curvas abertas: flag 70 = 8 (planar only).

---

## 3. Texto

**Texto sempre vetorizado como SPLINEs. Zero `TEXT`/`MTEXT`.**

- Pipeline: fonte → outline glyph (já implementado em `svg-text-converter.ts` + `font-precheck.ts`) → path SVG → SPLINE cubic.
- Cada letra vira **1 ou mais SPLINEs fechadas** (corpo + contracurvas como "o", "a", "p").
- Aplicar **fill-rule even-odd** ao converter para SPLINE (contracurva = subpath separado, não polyline aberta).
- **Pré-check obrigatório de fonte antes do export.** Se font não tiver outline disponível, abortar com erro claro.

---

## 4. Cores (mapeamento processo → cor DXF)

| Processo     | Cor DXF (código 62) | Nome               | Contagem no DXF real                                                 |
| ------------ | ------------------- | ------------------ | -------------------------------------------------------------------- |
| **Corte**    | **31**              | Vermelho           | 1 entidade (contorno externo do broche)                              |
| **Gravação** | **250**             | Cinza muito escuro | 66 entidades (texto + detalhes)                                      |
| **Marcação** | **5**               | Azul               | 0 (não existe no referência — convenção CLAUDE.md "Marcação = azul") |

**Cor é definida POR ENTIDADE (código 62 dentro do bloco SPLINE), não por layer.**

A cor de marcação 5 é convenção industrial padrão (CAM laser, AutoCAD ACI). **Recomendação: gerar 1 broche de teste com marcação após implementação e validar comportamento no RDWorks** antes de assumir produção.

---

## 5. Layers

**Layer única `Camada 1`. Processo codificado por cor de entidade (ver §4).**

Tabela LAYER obrigatória (replica o real):

| Name       | Color (62) | Linetype   | Flags | Lineweight |
| ---------- | ---------- | ---------- | ----- | ---------- |
| `0`        | 7          | Continuous | 0     | -3         |
| `Camada 1` | 7          | Continuous | 0     | -3         |

Toda geometria emitida vai para layer `Camada 1`. A cor `7` da layer é ignorada porque cada entidade declara sua própria cor (código 62).

**Justificativa para não usar layers por processo** (revisão da decisão prévia em conversa de planejamento):

1. RDWorks/LaserCAD na prática mapeia processo por **cor**, não por layer.
2. O DXF de referência — comprovadamente funcional — usa cor por entidade.
3. Adicionar layers redundantes aumenta complexidade do exportador sem benefício comprovado.
4. Se algum dia precisarmos abrir o DXF em outro CAM que respeite layer, adicionamos como melhoria — não como padrão inicial.

---

## 6. Coordenadas

**Sistema do DXF emitido:**

- Unidades: milímetros (`$INSUNITS = 4`).
- Origem: **(0, 0)** no canto inferior-esquerdo do bbox da arte.
- Eixo X: positivo para a direita.
- Eixo Y: **positivo para CIMA** (convenção cartesiana CAD/DXF). Y=0 fica embaixo, Y=maxY fica em cima.

**Decisão revisada (validação RDWorks 2026-05-19):** a primeira versão desta ADR especificava "Y positivo para baixo" para espelhar o canvas Fabric. **Errado** — RDWorks (e a spec DXF) interpretam Y como cartesiano puro (positivo para cima). Validação manual mostrou texto espelhado verticalmente, layout invertido, e subpaths "deslocados" no software de produção. O DXF de referência tem Y em `[-77.28, -43.77]` — Y para cima com offset do Corel; geometria em Y negativo confirma a convenção.

**Pipeline interno do Capi Studio:**

- Canvas/SVG/Fabric continuam com Y positivo para baixo (convenção natural da web).
- A conversão para DXF aplica **flip Y** em `src/core/export/dxf-coordinate-normalize.ts`:
  ```
  y_dxf = bounds.maxY - y_svg
  ```
- O flip é a ÚNICA transformação Y entre svgPathToSplines e buildDxfDocument. Aplicar uma vez. Aplicar zero vezes ou duas vezes deixa o RDWorks errado.

**Decisão sobre o offset do CorelDRAW:** o arquivo real tem bbox em `X ∈ [49.95, 109.95]` e `Y ∈ [-77.28, -43.77]` — resíduo do espaço de papel do CorelDRAW. Ruida importa por bbox relativo, então **o offset arbitrário não afeta a máquina, mas é ruim para debug e testes**. O Capi Studio **normaliza** para (0, 0) — bbox final esperado para um broche 60×25mm:

```
X ∈ [0.0000, 60.0000]
Y ∈ [0.0000, 25.0000]
$EXTMIN = (0.0, 0.0, 0.0)
$EXTMAX = (60.0, 25.0, 0.0)
```

**Header vars obrigatórias** (espelham o real exceto coordenadas):

| Var                   | Valor                   | Nota                                                    |
| --------------------- | ----------------------- | ------------------------------------------------------- |
| `$ACADVER`            | `AC1032`                |                                                         |
| `$DWGCODEPAGE`        | `ANSI_1252`             |                                                         |
| `$INSUNITS`           | `4`                     | mm                                                      |
| `$MEASUREMENT`        | `1`                     | métrico (corrige a inconsistência do real, que tinha 0) |
| `$LUNITS`             | `2`                     | decimal                                                 |
| `$LUPREC`             | `4`                     | 4 casas decimais                                        |
| `$INSBASE`            | `(0, 0, 0)`             |                                                         |
| `$LIMMIN`             | `(0, 0)`                |                                                         |
| `$LIMMAX`             | bbox do produto         | ex: `(60, 25)`                                          |
| `$EXTMIN` / `$EXTMAX` | bbox real das entidades | calculado pós-emissão                                   |

---

## 7. Bounds

**Garantias:**

- Toda SPLINE emitida deve ter todos os control points dentro do bbox da área útil do produto (já validado pelo `routing-resolver.ts` antes de chegar ao exporter).
- `$EXTMIN`/`$EXTMAX` calculados **após** emitir todas as entidades (varredura dos control points).
- O bbox total do arquivo deve coincidir **exatamente** com o bbox físico do produto declarado pelo `Product.width × Product.height`. Tolerância: 0.01 mm.

**Diferença com o arquivo real:** o referência tem bbox 60×33.51mm (a logo do "natanepaes" extrapola a altura nominal do broche 60×25mm). O Capi Studio **não** vai permitir essa extrapolação — `routing-resolver.ts` já garante bounds-check em runtime.

---

## 8. Estratégia de arquivos (máquinas × processos)

**Atualizada após análise do DXF real.** Decisão prévia em conversa era "1 DXF por máquina com layers internas por processo". Como abandonamos layers por processo (§5), a nova estratégia é:

### Modelo: 1 DXF por máquina, processos codificados por cor

Para cada arte exportada, o Capi gera **até 3 arquivos DXF** — um por máquina ativa para aquela arte:

```
pedido-{id}-MB.dxf  → SPLINEs roteadas para MB, cor por processo
pedido-{id}-FB.dxf  → SPLINEs roteadas para FB, cor por processo
pedido-{id}-DL.dxf  → SPLINEs roteadas para DL, cor por processo
```

- Cada arquivo contém **apenas** as entidades cujo roteamento (`asset-routing-types.ts`) inclui aquela máquina.
- Dentro do arquivo, cada entidade carrega cor = processo (31/250/5).
- Se uma entidade tem roteamento múltiplo (ex: corte vai para MB e FB), ela aparece em ambos os arquivos.
- Se nenhuma camada está roteada para uma máquina, o arquivo correspondente **não é gerado**.

**Justificativa:**

- O operador troca de máquina, não de arquivo — abrir "o DXF do MB" na máquina MB é fluxo natural.
- Reduz risco de erro (carregar arquivo errado).
- Compatível com `routing-resolver.ts` que já existe.

---

## 9. Plano de testes

### 9.1. Testes unitários (`tests/core/export/dxf-*.test.ts`)

Cobertura mínima 80%. Suítes obrigatórias:

| Suite                              | Asserts principais                                                                                            |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `dxf-spline-encoder.test.ts`       | knots clamped corretos · grau 3 · planar · closed flag · z=0 sempre                                           |
| `dxf-path-to-spline.test.ts`       | path SVG cubic Bézier → SPLINE 1:1 · arco SVG → SPLINE aprox. (erro < 0.01mm) · linha SVG → SPLINE degenerada |
| `dxf-header.test.ts`               | AC1032 · INSUNITS=4 · MEASUREMENT=1 · EXTMIN/MAX consistentes                                                 |
| `dxf-color-mapping.test.ts`        | corte=31 · gravação=250 · marcação=5                                                                          |
| `dxf-coordinate-normalize.test.ts` | bbox de entrada deslocado → saída normalizada a (0,0)                                                         |
| `dxf-routing-split.test.ts`        | mesma arte com 3 roteamentos → 3 arquivos DXF distintos                                                       |

### 9.2. Teste de regressão estrutural

Suite `tests/integration/dxf-production-standard.test.ts`:

1. Carregar `docs/DOCS/REFERENCE/DXF/08-04 - BROCHE - natanepaes.dxf` (referência).
2. Gerar DXF do Capi para a mesma geometria (recriar visualmente o broche natanepaes via fixture).
3. Comparar:
   - Versão (`$ACADVER`).
   - Contagem por tipo de entidade (todas devem ser SPLINE, mesma contagem ±10%).
   - Cores únicas e contagens (`62 → {31, 250}` com proporções ~equivalentes).
   - Bbox dentro de tolerância 1mm.
   - Zero TEXT/MTEXT.
   - Zero POLYLINE.

### 9.3. Teste manual de máquina (gate de aprovação)

**Antes de declarar a onda concluída:**

1. Exportar 3 broches-teste do Capi cobrindo: (a) só corte, (b) corte + gravação, (c) corte + gravação + marcação.
2. Importar cada um no RDWorks/LaserCAD da máquina.
3. Validar visualmente: layers detectadas, cores corretas, sem entidades fantasma.
4. Rodar 1 broche real em material de teste por cada combinação.
5. Comparar com broche feito pelo fluxo CorelDRAW antigo (mesmo design).

Se falhar em qualquer passo → abrir débito, não fechar onda.

---

## Limites desta ADR

**Não escopo desta onda:**

- Mudar UX de exportação.
- Mexer em PadraoEditor, Asset Library, fluxo de pedidos.
- Re-arquitetar SVG export.
- Resolver débito de material dourado→prata (Onda 18).
- Implementar marcação azul em fluxo de produto (UX para usuário marcar camada como "marcação" já existe).

**Decisões adiadas (TBD após teste de máquina):**

- Cor exata de marcação (5 é o default, pode mudar para 150 se RDWorks tratar 5 como genérico).
- Threshold de tolerância de aproximação ARC→SPLINE (default 0.01mm, ajustar se gerar SPLINEs com poucos control points causar visíveis "chanfros").

---

## Próximas sub-ondas

| Sub-onda | Entrega                                                                      |
| -------- | ---------------------------------------------------------------------------- |
| DXF-1    | Encoder SPLINE puro (`core/export/dxf-spline-encoder.ts`) + testes unitários |
| DXF-2    | Converter path SVG → SPLINE (cubic Bézier passthrough, arc/line → cubic)     |
| DXF-3    | Header AC1032 + tabela LAYER + estrutura SECTIONs                            |
| DXF-4    | Pipeline completo: arte normalizada → 1..3 DXFs por máquina                  |
| DXF-5    | Teste de regressão estrutural contra o DXF de referência                     |
| DXF-6    | **Gate manual:** rodar em máquina, validar, declarar produção-ready          |

Cada sub-onda termina com typecheck + lint + testes verdes + STATUS-ONDA escrito.
