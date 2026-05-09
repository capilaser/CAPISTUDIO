# ADR 013 — base_svg do produto via seed (Onda 8)

**Data:** 2026-05-09
**Status:** Aceito
**Implementação:** Onda 8 (PT-1)

---

## Contexto

A coluna `products.base_svg` existe desde a migration inicial
(`0000_lyrical_moon_knight.sql`) mas nunca foi populada pelo seed.
O `CanvasTest.tsx` carregava o SVG do produto via `fetch('/products/broche-60x25.svg')`
— um arquivo estático em `public/` — ignorando o campo `baseSvg`
já retornado pelo `productRepository`.

Na Onda 8 (PT-1), precisamos que `placa-300x90` tenha `base_svg`
populado para que o `CanvasTest` carregue a placa corretamente.

O SVG real da placa está em `tests/fixtures/camadas-base/placa-base.svg`
(exportado do Corel, validado pelo `parseCorelSvg`).

---

## Decisão

### 1. Estratégia de seed para base_svg

O seed usa `INSERT OR IGNORE` + `UPDATE WHERE base_svg IS NULL`:

```typescript
// Passo 1: INSERT OR IGNORE (idempotente — não sobrescreve registro existente)
await db.execute(`INSERT OR IGNORE INTO products (..., base_svg) VALUES (..., ?)`, [..., baseSvg]);

// Passo 2: UPDATE fallback — preenche base_svg se o INSERT foi ignorado e o campo está NULL
if (p.baseSvg) {
  await db.execute(
    `UPDATE products SET base_svg = ? WHERE id = ? AND base_svg IS NULL`,
    [p.baseSvg, p.id]
  );
}
```

Isso garante:

- Banco novo: INSERT insere com `base_svg`
- Banco existente com `base_svg = NULL`: UPDATE preenche
- Banco existente com `base_svg` já populado: nenhuma mudança (idempotente)

### 2. SVG embutido no seed via string literal

O conteúdo de `tests/fixtures/camadas-base/placa-base.svg` é incluído
diretamente como string no `seedProducts.ts`. Não usa `readFileSync` —
o seed roda no frontend Tauri (browser context, sem Node.js).

### 3. CanvasTest usa baseSvg do banco, não fetch estático

O `CanvasTest.tsx` passa a ler `p.baseSvg` (já retornado pelo
`productRepository.getProductById`) em vez de fazer `fetch('/products/...')`.

Se `p.baseSvg` for null, lança erro claro: `"Product baseSvg is not set in the database."`

---

## Limitação conhecida (exigida pelo consultor estratégico)

**Se o fixture `placa-base.svg` for editado depois do banco criado,
o seed NÃO reaplica automaticamente.** O UPDATE só preenche quando
`base_svg IS NULL`. Uma vez populado, o campo não é atualizado pelo
seed mesmo que o fixture mude.

**Para atualizar o SVG base de um produto após o banco existir:**

1. Apagar o banco manualmente (`%APPDATA%\com.capilaser.studio\capi-studio.db`)
2. Reabrir o app (banco é recriado com seed atualizado)

Isso é aceitável na Onda 8 (ambiente de desenvolvimento, 1 usuário).
**Não é aceitável em produção.**

---

## Follow-up obrigatório (onda futura)

Quando for implementado o fluxo de upload de produto pelo usuário
(previsto para Onda futura, sem data definida):

1. Criar UI de cadastro de produto com upload de SVG
2. `base_svg` passa a ser populado via upload, não via seed
3. Seed de produtos remove o campo `baseSvg` (fica só para dados estáticos
   como dimensões e configurações)
4. `CanvasTest` e canvas real leem `baseSvg` do banco (comportamento
   já implementado na Onda 8 — sem mudança)

---

## Referências

- `src/data/seeds/seedProducts.ts` — seed atualizado na Onda 8
- `src/ui/pages/dev/CanvasTest.tsx` — usa `p.baseSvg` em vez de fetch
- `tests/fixtures/camadas-base/placa-base.svg` — SVG fonte (300.2×90.2mm)
- ADR 004 — `product_layers.svg` nullable (mesma família de decisão)
- ADR 005 — viewBox autoritativo para coordenadas do canvas
