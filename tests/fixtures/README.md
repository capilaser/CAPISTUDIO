# Fixtures de Teste — Capi Studio v2

Esta pasta contém SVGs reais do negócio do usuário, usados como **caso de teste
oficial** ao longo das ondas. Todos vêm do CorelDRAW, em mm.

## Estrutura

```
tests/fixtures/
├── camadas-base/      → SVGs de bases (peça principal: broche, placa)
├── apliques/          → SVGs de apliques (peças aplicadas em cima de bases)
└── exportacoes/       → SVGs de output esperado da Onda 9 (exportação)
```

---

## camadas-base/

| Arquivo               | Dimensões          | Uso                                                      |
| --------------------- | ------------------ | -------------------------------------------------------- |
| `broche-simples.svg`  | 60.076 × 25.076 mm | Camada principal "Broche" — só o contorno                |
| `broche-completo.svg` | 60 × 25 mm         | Broche montado (logo + nome + traço) — referência visual |
| `placa-base.svg`      | 300.2 × 90.2 mm    | Camada principal "Placa" — só o contorno                 |
| `placa-completa.svg`  | 300 × 90 mm        | Placa montada (Advogada com Justiça) — referência visual |

---

## apliques/

| Arquivo                   | Dimensões       | Formato                             |
| ------------------------- | --------------- | ----------------------------------- |
| `aplique-1-formato-d.svg` | 100.2 × 90.2 mm | Formato D (retângulo + semicírculo) |
| `aplique-2-quadrado.svg`  | 100.2 × 90.2 mm | Formato quase quadrado              |
| `aplique-3-pill.svg`      | 95.2 × 15.2 mm  | Formato cápsula (pill)              |

---

## exportacoes/

Pasta reservada para a Onda 9 (exportação SVG por máquina/operação).

Cenário planejado — `pedido-placa-advogada/`:

| Arquivo                                               | Tipo   | Conteúdo                                                             |
| ----------------------------------------------------- | ------ | -------------------------------------------------------------------- |
| `INPUT_placa_inteira.svg`                             | Input  | Pedido completo — placa preta + apliques dourados + texto "ADVOGADA" |
| `OUTPUT_maquina_1_corte_camada_0_marcacao_letras.svg` | Output | Master Biro: corte da camada 0 + marcação das letras + aplique 2     |
| `OUTPUT_maquina_2_corte_gravacao_apliques.svg`        | Output | Máquina 2: corte e gravação dos apliques 1 e 2                       |
| `OUTPUT_maquina_3_marcacao.svg`                       | Output | Máquina 3: marcação final, peças soltas                              |
| `OUTPUT_maquina_3_marcacao_com_nesting.svg`           | Output | Máquina 3: mesma marcação, com peças rearranjadas (nesting)          |

**Critério de validação Onda 9:** dado o INPUT, o sistema deve gerar OUTPUTs
funcionalmente equivalentes (mesmas peças, mesmas operações, mesmas máquinas).

---

## Regras de uso (ADR 010 e ADR 009)

1. **Apenas contornos importam.** Cores, fills e fontes embutidas dos SVGs são
   descartadas pelo Capi durante importação. Apenas paths/rects/circles e
   viewBox são preservados.
2. **viewBox é fonte autoritativa de coordenadas** (ADR 005).
3. **Não modificar fixtures.** Se um SVG está com problema, registrar issue e
   manter o original.
