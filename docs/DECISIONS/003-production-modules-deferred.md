# ADR 003 — Módulos de produção por camada: adiados

**Data:** 2026-05-05
**Status:** Aceito

## Contexto

O v1 do Capi Studio possuía um campo `productionModules` no cadastro de produtos,
que associava cada tipo de operação (gravação, corte, aplique, etc.) a máquinas
específicas (MB, FB, DL) e definia parâmetros de exportação SVG por camada.

Ao migrar para o v2, esses dados foram encontrados nos produtos do `v1-data/products.json`
e precisavam de um destino na Onda 1, que foca exclusivamente em persistência e seeds.

## Decisão

Os dados de `productionModules` são **armazenados de forma inerte** no campo `config`
(TEXT/JSON) da tabela `products`, exatamente como vieram do v1, sem qualquer processamento.

Nenhuma UI, lógica de negócio ou validação referente a módulos de produção será
implementada na Onda 1.

## Justificativa

1. **Escopo da Onda 1.** A onda se limita a schema, migrations, seeds e repositórios.
   A UI de produção por camada requer planejamento de UX, modelo de dados para `layers`,
   e integração com o pipeline de exportação SVG — tudo em ondas posteriores.

2. **Dados não se perdem.** Armazenar em JSON no campo `config` preserva os valores
   do v1 sem exigir schema adicional nesta onda.

3. **Sem acoplamento prematuro.** Expor `productionModules` no repositório antes de
   haver UI ou regras de negócio criaria interfaces sem consumidores, que teriam de ser
   reescritas quando o modelo definitivo for estabelecido.

## Consequências

- **Onda 1:** campo `config` do produto contém `productionModules` como JSON opaco.
- **Onda futura (≥ Onda 7):** definir modelo de dados definitivo para camadas de produção,
  criar coluna/tabela específica se necessário, e implementar UI de associação
  operação ↔ máquina ↔ parâmetros SVG.
- O campo `config` em `products` deve ser tratado como genérico até essa onda.

## Follow-up

- [ ] Onda 7+ — projetar `product_layers` com metadados de máquina e operação definitivos.
- [ ] Decidir se `productionModules` permanece em `config` ou migra para coluna própria.
