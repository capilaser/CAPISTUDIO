# ADR 009 — Lógica de Exportação por Máquina e Operação

**Data:** 2026-05-07
**Status:** Aceito (especificação travada)
**Implementação:** Onda 9 (Exportação SVG por máquina/operação)

---

## Contexto

A Onda 9 é responsável por exportar SVGs de produção: arquivos vetoriais que
vão direto pra cada máquina do parque (Master Biro, Fiber Laser, Due Laser).
Cada máquina recebe **um SVG próprio**, contendo apenas as operações que ela vai
executar.

Durante o planejamento da Onda 6, o usuário forneceu **especificação completa**
da lógica de exportação esperada, incluindo 4 SVGs reais de exemplo (output de
um pedido real). Esta ADR registra essa especificação **agora**, antes da Onda 9,
para evitar perda de contexto e garantir que a Onda 9 (Opus 4.7 + alto, conforme
roadmap) tenha tudo necessário pra implementar sem reinventar.

**Não há implementação nesta ADR. Apenas registro.**

---

## Decisão

### 1. Definições de operação (com semântica do negócio)

| Operação             | Verbo                                           | Quando usar                                                                                                                                                                                                              | Saída SVG                                                                       |
| -------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| **CORTE**            | "Cortar a peça inteira"                         | Cortar a base/placa/peça que será o **suporte** das outras peças aplicadas em cima.                                                                                                                                      | Contorno externo da peça, vetor sem fill, pra máquina cortar.                   |
| **GRAVAÇÃO**         | "Gravar dentro da peça"                         | Marcar permanentemente um desenho/texto na superfície da peça. Funciona em Fiber Laser e CO2 — mesmo arquivo serve pras duas.                                                                                            | Vetor com áreas a serem gravadas (rasterizadas pela máquina).                   |
| **MARCAÇÃO**         | "Marcar contorno como referência ou pra cortar" | Dois usos distintos: **(a)** marcar na camada 0 o contorno de outro elemento (ex: aplique 2) pra **referência visual** durante gravação; **(b)** cortar peça pequena com **feature "tirar miolo"** (ex: letras avulsas). | Apenas o contorno, sem fill. Vai pra máquina específica de marcação.            |
| **APLIQUE**          | "Peça aplicada em cima de outra"                | Indica que esta camada é uma peça separada que será colada/fixada na peça principal. Não é operação de máquina propriamente — é classificação de tipo de peça.                                                           | A peça aplicada vira sua própria camada principal, com suas próprias operações. |
| **CONTORNO**         | (legado v1)                                     | Reservado pra retrocompatibilidade.                                                                                                                                                                                      | Igual a marcação.                                                               |
| **CORTE-LASER**      | (legado v1)                                     | Reservado pra retrocompatibilidade.                                                                                                                                                                                      | Igual a corte.                                                                  |
| **GRAVAÇÃO-APLIQUE** | (legado v1)                                     | Reservado pra retrocompatibilidade.                                                                                                                                                                                      | Igual a gravação.                                                               |

> **Nota:** as operações marcadas como "legado v1" estão preservadas no schema
> (ADR 003 — operations seed) mas o usuário usa apenas as 4 primeiras no fluxo
> diário. Decisão futura: deprecar legado v1 ou consolidar.

### 2. Mapeamento Máquina ↔ Operação (real do negócio do usuário)

| Máquina             | Operações que executa | Observação                                                   |
| ------------------- | --------------------- | ------------------------------------------------------------ |
| **Master Biro**     | corte, marcação       | Máquina principal de corte físico.                           |
| **Fiber Laser**     | gravação              | Gravação em metal e materiais densos.                        |
| **Due Laser (CO2)** | gravação              | Gravação em acrílico, ABS, MDF, etc. Mesmo arquivo do Fiber. |

**Regra crítica:** quando o usuário escolhe operação **gravação** numa sub-camada,
ele pode atribuir 1 ou 2 máquinas (Fiber e/ou Due). O export gera **um único SVG
de gravação** que serve pra ambas.

### 3. Roteamento — qual sub-camada vai pra qual SVG

A regra é simples: **um SVG por máquina por operação.**

```
Pedido salvo → analisar todas as sub-camadas →
  agrupar por (máquina, operação) →
    cada grupo vira um SVG separado →
      arquivos vão pra appData/exports/{ano}/{mes}/{labelPedido}_{operação}_{máquina}.svg
```

Exemplo do pedido real do usuário (Placa Advogada — `PLACA_INTEIRA`):

| Arquivo                                   | Máquina     | Operação | Conteúdo                                                                          |
| ----------------------------------------- | ----------- | -------- | --------------------------------------------------------------------------------- |
| `placa_advogada_corte_master_biro.svg`    | Master Biro | Corte    | Contorno externo da placa preta                                                   |
| `placa_advogada_marcacao_master_biro.svg` | Master Biro | Marcação | Letras "ADVOGADA" pra cortar com tirar miolo + contorno do aplique 2 (referência) |
| `placa_advogada_corte_apliques.svg`       | Master Biro | Corte    | Contornos dos apliques 1 e 2 (peças douradas a cortar separadas)                  |
| `placa_advogada_gravacao.svg`             | Fiber/Due   | Gravação | Logo da Justiça + texto "ADVOGADA" pra gravar                                     |

### 4. Regra "Marcação herda contorno"

**Regra crítica do negócio.** Quando uma sub-camada de **marcação** é adicionada
dentro de uma camada principal (ex: aplique 2), o **contorno externo daquela
camada principal** é automaticamente incluído no SVG de marcação.

**Caso de uso real do usuário:**

> "Eu uso marcação no aplique 2 pra me ajudar a fazer a gravação interna. Uso o
> contorno do aplique como referência."

**Implementação esperada:**

```
Sub-camada marcação dentro de "Aplique 2"
  → no SVG de marcação, incluir AUTOMATICAMENTE:
    1. Contorno externo do Aplique 2 (do svg.path do banco de apliques)
    2. + qualquer conteúdo manual da sub-camada de marcação
```

### 5. Feature "Tirar Miolo" (marcação de letras)

Quando o usuário escolhe **marcação** com conteúdo de **texto** (letras), ele
ativa um modo "tirar miolo":

- O SVG exportado contém apenas os **contornos das letras** (não a forma cheia)
- Cada letra vira um path fechado independente
- Ao cortar na máquina, a letra cai como peça avulsa (oca por dentro nas letras
  como A, O, P, etc — daí "tirar miolo")

**Exemplo real:** SVG `EXEMPLO_SVG_-_MAQUINA_3_-_MARCACÃO_-_FINAL.svg` — letras
"ADVOGADA" prontas pra cortar.

### 6. Nesting (otimização de aproveitamento de chapa)

**Não implementar na Onda 9 inicial.** Anotar como feature de futuro próximo
(Onda 9.5 ou Fase 2).

**Conceito:** quando o usuário tem múltiplas peças pequenas pra cortar (ex: 50
broches, ou letras avulsas), o sistema rearranja as peças no SVG pra ocupar o
mínimo de chapa, economizando material.

**Exemplo:** comparar:

- `EXEMPLO_SVG_-_MAQUINA_3_-_MARCACÃO_-_FINAL.svg` — peças soltas, cada uma na
  sua posição original
- `EXEMPLO_SVG_-_MAQUINA_3_-_MARCACÃO_-_FINAL_-_COM_NESTING.svg` — peças
  reposicionadas, agrupadas, ocupando menos área

**Implementação futura:** library externa (SVG Nest, Deepnest.io ou similar)
ou algoritmo próprio. Decisão fica pra Onda 9.5.

### 7. Estrutura interna do SVG de produção

Cada SVG exportado deve seguir as regras do v1 (`buildProductionSVG`):

- **Sem texturas, sem fills, sem cores internas.** Apenas vetores puros.
- ViewBox no canvas inteiro (não cortado por peça).
- Camadas agrupadas em `<g>` com `id` correspondente à operação.
- Strokes finos e padronizados pra leitura da máquina.
- **Sem fontes embutidas** (texto convertido em path durante export — a máquina
  não interpreta `<text>`, só `<path>`).
- Header limpo, sem metadados do Corel.

### 8. Naming convention

```
{label_pedido_normalizado}_{operação}_{máquina_normalizada}.svg
```

Exemplos:

- `joao_silva_advogado_corte_master_biro.svg`
- `joao_silva_advogado_gravacao_fiber.svg`
- `placa_advogada_marcacao_master_biro.svg`

**Normalização:**

- Lowercase
- Espaços → underscore
- Acentos removidos (`ç → c`, `ã → a`)
- Caracteres especiais removidos

### 9. Fixtures oficiais de teste

Os 4 SVGs de exportação enviados pelo usuário ficam em
`tests/fixtures/exportacoes/` como **output esperado** pra um pedido de
referência:

```
tests/fixtures/exportacoes/
├── pedido-placa-advogada/
│   ├── INPUT_placa_inteira.svg              → PLACA_INTEIRA.svg (referência visual do pedido)
│   ├── OUTPUT_maquina_1_corte_camada_0.svg  → EXEMPLO_SVG_-_MAQUINA_1_...
│   ├── OUTPUT_maquina_2_corte_gravacao.svg  → EXEMPLO_SVG_-_MAQUINA_2_...
│   ├── OUTPUT_maquina_3_marcacao.svg        → EXEMPLO_SVG_-_MAQUINA_3_-_MARCACÃO_-_FINAL.svg
│   └── OUTPUT_maquina_3_nesting.svg         → EXEMPLO_SVG_-_MAQUINA_3_-_...COM_NESTING.svg
└── README.md
```

**Critério de validação da Onda 9:** dado o pedido "Placa Advogada" reconstruído
no Capi v2, a exportação deve produzir SVGs **funcionalmente equivalentes** aos
4 OUTPUTs acima.

"Funcionalmente equivalente" = mesmas peças, mesmas operações, mesma máquina,
mesmas dimensões. Ordem de paths e formatação interna podem variar.

---

## Consequências

### Onda 9 ganha especificação completa

A Onda 9 (Opus 4.7 + alto) recebe esta ADR + os 4 SVGs de fixture e tem tudo que
precisa pra implementar exportação correta. Não precisa reinventar regras.

### Onda 6 NÃO toca em exportação

A Onda 6 implementa apenas estrutura de camadas (ADR 008). Qualquer menção a
"exportação" no kickoff da Onda 6 está fora de escopo e deve ser rejeitada pelo
revisor (Claude do chat).

### Schema necessário pra Onda 9

Já previsto em `01-DATABASE.md`:

- `export_history` (tabela existente)
- `orders.exportedSvgPaths` (campo JSON array)

Provavelmente suficiente. Pode precisar de campo extra pra rastrear nesting
quando implementado.

---

## Não-objetivos (NÃO entra na Onda 9)

- **Nesting automático** — Onda 9.5 ou Fase 2.
- **Otimização de tempo de máquina** (ordem de paths que minimiza movimento da
  cabeça do laser) — Fase 2.
- **DXF export** — Fase 2.
- **Preview por máquina antes de exportar** — Fase 2.
- **Edição manual do SVG exportado** — não é função do Capi.

---

## Follow-up

- [ ] Onda 9 — implementar exportação seguindo todas as regras desta ADR
- [ ] Onda 9 — usar fixtures de `tests/fixtures/exportacoes/` como teste de
      regressão automatizado (Vitest + diff estrutural de SVG)
- [ ] Onda 9.5 (decisão futura) — implementar nesting com library externa
- [ ] Validar com usuário: regra "marcação herda contorno" tá correta? (ele
      confirmou em conversa, mas precisa validar com 2-3 casos reais antes
      de Onda 9 fechar)
