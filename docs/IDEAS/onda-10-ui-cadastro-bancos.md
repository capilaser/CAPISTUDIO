# IDEIA — UI completa de cadastro dos 3 bancos (Apliques + Gravações + Marcações)

**Origem:** 2026-05-10, durante calibração da Onda 8.5
**Status:** Planejada para Onda 10 — "Banco de Ativos"

## Resumo

Onda 10 (Banco de Ativos) precisa entregar **CRUD completo** dos 3 bancos de assets do projeto: Apliques, Gravações e Marcações. Hoje (pós-Onda 8.5), todos os 3 são populados **só via seed** + arquivos bundled em `src-tauri/resources/fixtures/`.

## Problema que resolve

Atualmente o designer (Gabriell) cadastra um asset novo da seguinte forma:

1. Cria SVG no Corel
2. Coloca em `assets-pendentes/<categoria>/<nome>.svg`
3. **Pede ao Claude Code** pra: copiar pra `src-tauri/resources/fixtures/<bank>/`, renomear pra kebab-case, extrair dimensões, atualizar `seedXxx.ts`, commitar, rebuildar Tauri pra bundle aceitar a mudança.

Esse fluxo bloqueia o designer em quem tem o claude+ide. **Operacionalmente insustentável** quando o app for entregue ou quando a equipe crescer.

## Contexto técnico

Padrão dos bancos atuais (igual entre `appliques`, `engravings`, `markings`):

- Schema na tabela com `id`, `name`, `filePath`, `widthMm`, `heightMm`, `thumbnailPath`, `tags`, `metadata`, `createdAt`, `deletedAt`. Engravings tem `categoryId` (Onda 8.5).
- Repositories com `list`, `getById`, `create`, `softDelete`.
- Arquivos vivem bundled (`resource://fixtures/...`).
- Apliques têm `applique-storage.ts` com `save`/`delete`/`read` mas **só `read` está em uso** (Onda 8.5).

Helper já criado e testado, esperando a Onda 10:

- `src/lib/normalize-asset-name.ts` — kebab-case + desacentua + lowercase. Testado em `tests/lib/normalize-asset-name.test.ts`. NÃO usado em runtime nesta onda.

## Esboço de implementação

### UI

Nova rota `/banco-ativos` (renderizada na sidebar do MainLayout) com 3 abas espelhando o painel direito:

- **Apliques** — lista cards atuais + botão "Adicionar aplique" (drag-drop ou file-input)
- **Gravações** — idem + dropdown de categoria (já criado)
- **Marcações** — idem

Form de adicionar (modal shadcn `Dialog`):

- File input (drag-drop preferido)
- Nome (preenchido auto a partir do filename, editável)
- Categoria (dropdown — só Gravações)
- Tags (input de chips livre)
- Preview do SVG carregado
- Validação: passa por `parseCorelSvg` antes de salvar (mesmo erro humanizável já existente)
- Botão "Salvar" → chama:
  1. `normalizeAssetName(file.name)` → novo filePath
  2. `save<Bank>File(normalizedName, svgContent)` Tauri → grava em `appData/assets/<bank>/`
  3. `repository.create({...})` → registra no banco
  4. Toast de sucesso + atualiza lista

Form de editar: igual ao de adicionar mas com campos pré-preenchidos. Sem `save<Bank>File` (não troca o SVG, só metadata).

Form de excluir: `AlertDialog` igual ao do painel de camadas. Soft delete via `repository.softDelete`.

### Tauri commands necessários

Para cada banco, adicionar em `src-tauri/src/lib.rs`:

- `save_engraving_file(name, content)` (Apliques já tem)
- `save_marking_file(name, content)`
- `delete_engraving_file(path)` (Apliques já tem)
- `delete_marking_file(path)`

Apliques já tem `save_applique_file` e `delete_applique_file` mas não estão em uso — Onda 10 vai começar a usar.

### Storage convention (Onda 10)

Quando o asset é gravado pela UI (runtime), ele vai pra `appData/assets/<bank>/<id>.svg` (não em `resources/fixtures/`). O `filePath` no banco vai ter formato `appdata://assets/<bank>/<id>.svg` ou similar — `svgPathResolver.ts` já precisa lidar com isso.

Verificar como o resolver atual diferencia `resource://` (bundled) vs `appdata://` (runtime). Possível dívida técnica caso ainda não suporte os 2 prefixos.

## Quando faz sentido

**Onda 10** — `projeto/03-CLAUDE-CODE-KICKOFF.md` já reserva essa onda como "Telas restantes (Grid Padrões, Histórico, Banco Ativos)". O Banco de Ativos é a tela mais crítica das 3.

Não antes da Onda 9 (exportação), porque a Onda 9 vai validar o pipeline de produção ponta-a-ponta e definir o `metadata` que as gravações precisam carregar.

## Notas

- Drag-drop pra adicionar arquivos: avaliar `react-dropzone` ou implementar manual (drag/drop API é simples).
- Thumbnail auto-gerado: renderizar o SVG via Canvas 2D, salvar PNG em `appData/assets/<bank>/thumbnails/<id>.png`. Talvez ficar pra Fase 2 — hoje o `displayUrl` lê o próprio SVG.
- Validação de Corel: parser já rejeita SVGs com problemas conhecidos (text/image/use embutidos). Toast humanizável já existe.
