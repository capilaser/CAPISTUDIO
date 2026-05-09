# ADR 012 — resolveResource sem prefixo 'resources/'

**Data:** 2026-05-09
**Status:** Aceito
**Implementação:** Onda 6.5 Fase C (descoberto ao adicionar IPC de leitura de arquivo)

---

## Contexto

Durante a Onda 6.5 Fase C, foi implementado o `ApliquePanel` que usa IPC
(`read_applique_file`) para ler SVGs do disco antes de passá-los ao
`parseCorelSvg`. Ao testar, dois sintomas apareceram:

1. Thumbnails quebrados (broken-image) no `ApliquePanel`
2. IPC falhando com erro 404/path not found

Investigação no DevTools revelou que `resolveResource('resources/' + resourcePath)`
estava gerando:

```
C:\...\src-tauri\target\debug\resources\fixtures\apliques\...
                              ^^^^^^^^^
                              prefixo duplicado
```

O path real dos recursos em dev mode é:

```
C:\...\src-tauri\target\debug\fixtures\apliques\...
```

### Bug latente

Os thumbnails do `BancoApliquesPagina` (Onda 6.5 Fase B) **também estavam
quebrados desde sempre** — mas não foram detectados porque:

- O fundo escuro do card mascarava o ícone broken-image
- O foco da Fase B foi na estrutura da UI e no upload, não na validação
  visual minuciosa dos thumbnails

O bug só ficou visível na Fase C quando o IPC retornou erro explícito de
"arquivo não encontrado".

---

## Causa raiz

A API `resolveResource(path)` do Tauri 2.x **já inclui o prefixo de
resources internamente**. Concatenar `'resources/'` manualmente duplica
o prefixo no path resultante.

```typescript
// ERRADO — gera .../target/debug/resources/fixtures/...
await resolveResource('resources/' + resourcePath);

// CORRETO — gera .../target/debug/fixtures/...
await resolveResource(resourcePath);
```

---

## Decisão

Remover o concat `'resources/'` em todas as chamadas de `resolveResource`
no projeto. A função recebe o path relativo ao diretório de resources
diretamente, sem prefixo manual.

**Arquivos corrigidos:**

- `src/services/svg-path-resolver.ts`:
  - `resolveDisplayUrl`: linha `resolveResource('resources/' + resourcePath)` → `resolveResource(resourcePath)`
  - `resolveAbsolutePath`: idem

---

## Consequências

- Thumbnails de SVGs bundled (`resource://fixtures/...`) passam a renderizar
  corretamente em todas as páginas
- IPC `read_applique_file` consegue localizar e ler os arquivos
- Comportamento idêntico em dev mode e prod (Tauri resolve o prefixo nos
  dois contextos)

---

## Regra para futuras implementações

**Nunca concatenar `'resources/'` antes de `resolveResource()`.** A função
já sabe onde ficam os resources. Passar apenas o caminho relativo dentro
da pasta resources.

```typescript
// Arquivo em src-tauri/resources/fixtures/apliques/foo.svg
// filePath no DB: "resource://fixtures/apliques/foo.svg"
// resourcePath após slice: "fixtures/apliques/foo.svg"

const absolutePath = await resolveResource(resourcePath); // ✅
```

---

## Follow-up

- [ ] Validar thumbnails em prod build (não só dev mode) na Onda 13
- [ ] Considerar adicionar `console.debug` no `resolveDisplayUrl` em DEV
      para facilitar diagnóstico futuro de URLs quebradas
