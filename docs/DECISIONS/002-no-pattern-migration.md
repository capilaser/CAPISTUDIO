# ADR 002 — Sem migração de padrões do v1

**Data:** 2026-05-05
**Status:** Aceito

## Contexto

Os arquivos `custom-patterns.json` e `patterns.json` do v1 (localizados em
`v1-data/`) estão vazios (`[]`).

O usuário utilizou o v1 anteriormente, mas apagou todos os padrões
propositalmente para recomeçar do zero no v2 — não há padrões residuais que
valha a pena importar ou migrar.

Os seeds da Onda 1 cobrirão apenas configurações estruturais: máquinas,
produtos, materiais, fontes e outros metadados de referência.

## Decisão

**Não migrar padrões do v1.** Os seeds da Onda 1 não incluirão nenhum
`pattern` proveniente do v1.

Os padrões serão criados manualmente pelo usuário via canvas a partir das
Ondas 4–6, quando os slots de campo e a função `fitText` estiverem prontos.

## Justificativa

1. **Fonte está vazia.** Os dois JSON de padrões do v1 contêm `[]` — não há
   dado a migrar.
2. **Decisão deliberada do usuário.** O esvaziamento foi intencional: o usuário
   quer iniciar o v2 sem herdar layouts antigos.
3. **Seeds da Onda 1 têm escopo diferente.** Eles provisionam o sistema de
   referência (produtos, materiais, máquinas, fontes), não artes prontas.

## Consequências

- **Onda 1 (seeds):** incluir apenas entidades de configuração; nenhum
  `INSERT` em tabela de padrões.
- **Critério da Onda 13** (validação contra v1) precisa ser ajustado: não
  existem 7 cenários do v1 para comparar. A validação deve verificar que o
  canvas v2 funciona corretamente em cenários criados no próprio v2.
- **Padrões iniciais** serão gerados pelo usuário a partir da Onda 4–6 (slots
  - fitText), e salvos pelo fluxo "Salvar como novo padrão".

## Follow-up

- [ ] Onda 13 — atualizar critério de saída: substituir "comparar 7 cenários
      v1" por "validar N cenários criados no v2".
