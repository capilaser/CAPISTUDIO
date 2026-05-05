# ADR 004 — product_layers.svg: coluna nullable

**Data:** 2026-05-05
**Status:** Aceito

## Contexto

A tabela `product_layers` armazena as camadas visuais de cada produto (ex: base, textura,
borda). Cada camada pode ter um SVG associado — o arquivo vetorial que define a forma
da camada no canvas.

Ao modelar a tabela no schema Drizzle (Onda 1), surgiu a questão: o campo `svg` deve
ser NOT NULL ou nullable?

No v1, algumas camadas de produto (em particular a camada de textura/material) não
possuíam um SVG próprio — elas eram preenchidas por um PNG ou gradiente em tempo
de renderização, sem arquivo vetorial estático.

## Decisão

O campo `svg` em `product_layers` é **nullable** (`text('svg')` sem `.notNull()`).

## Justificativa

1. **Camadas sem SVG existem no v1.** A camada de textura/material é um exemplo
   confirmado: seu conteúdo visual é determinado pelo PNG do material selecionado,
   não por um SVG da camada.

2. **Forçar NOT NULL quebraria seeds.** Qualquer produto com camada de textura
   teria de fornecer um SVG placeholder inválido apenas para satisfazer a constraint,
   gerando dados incorretos desde o início.

3. **Nullable é semanticamente correto.** `NULL` expressa "esta camada ainda não tem
   SVG definido" ou "o SVG é determinado em runtime" — ambos estados legítimos.

4. **Camadas com SVG obrigatório podem ser validadas na camada de aplicação.**
   O repositório ou regra de negócio pode verificar `svg IS NOT NULL` para camadas
   que exigem vetor (ex: camada de borda ou contorno).

## Consequências

- **Schema:** `product_layers.svg TEXT` (sem NOT NULL).
- **Seeds:** camadas de textura/material podem ser inseridas com `svg = NULL`.
- **Repositório:** `productLayerRepository` mapeia `svg` como `string | null`.
- **Canvas (Onda 3+):** renderização de camada deve tratar `svg === null` como
  "camada sem vetor — usar PNG do material ou renderização programática".

## Follow-up

- [ ] Onda 3 — definir estratégia de renderização para camadas com `svg = NULL`.
- [ ] Validar: apenas camadas do tipo textura/material devem ter `svg = NULL`
      em dados de produção.
