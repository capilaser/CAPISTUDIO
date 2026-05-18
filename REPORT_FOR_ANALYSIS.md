# Capi Studio v2 — Relatório Técnico-Operacional para Análise Externa

**Gerado em:** 2026-05-18
**Branch atual:** onda-26
**Último commit:** `cba5744` — Onda 28 (Painel de camadas Pro)
**Status:** Onda 28 em curso. Onda 27 (export por chapa) e Onda 26 (UX Novo Pedido) recém-encerradas.

---

## 1. VISÃO GERAL DO PROJETO

### 1.1 Objetivo

Capi Studio é uma **ferramenta desktop interna** para uma empresa de produtos personalizados (broches, placas) cortados/gravados a laser. Substitui um piloto HTML monolítico (`broches-studio_5.html`) que já roda em produção informal. Objetivo: criar artes de pedido **rapidamente** reusando padrões validados, e gerar **arquivos de produção** (SVG/DXF por máquina+operação) que alimentam os softwares laser (RDWorks, LaserCAD).

Não é um produto SaaS. **Single-user local**, instalado via MSI no Windows da operadora.

### 1.2 Funcionalidades Principais

1. **Arte Rápida** — escolher produto → padrão → preencher campos → ver no canvas → salvar pedido → exportar.
2. **Multi-broche por prancha** — 1 pedido pode ter N broches (mesmo ou produtos diferentes), agrupados em "chapas" (1 chapa por produto).
3. **Exportação de produção** — PNG mockup (cliente), SVG (laser), DXF R12 (RDWorks/LaserCAD), 1 arquivo por máquina×operação.
4. **Sistema de padrões mestres reutilizáveis** (com cadastro próprio em Padrões/Banco).
5. **Banco de assets**: apliques SVG, gravações SVG, marcações, materiais (PNG textura), fontes, logos.
6. **Painel de camadas estilo Photoshop/Figma** (Onda 28 em curso).

### 1.3 Fluxo Principal do Usuário

```
Início → Arte → Novo Pedido
  → Adicionar broche (escolher produto + padrão)
  → [N broches via "Adicionar broche" ou "Lote"]
  → Trocar entre broches pela sidebar esquerda (= abas por chapa)
  → Preencher campos (Nome/Profissão/Logo) em cada broche
  → Salvar pedido
  → Exportar (PNG / SVG / DXF) — multi-chapa gera 1 arquivo por chapa
```

### 1.4 Estado Atual do Desenvolvimento

- **28 ondas concluídas/em curso** (Onda 0 = bootstrap, Onda 28 = polish UI).
- Suite de testes: **545–565 testes verdes** (varia por sessão), cobertura ≥80% em `src/core/`.
- Typecheck e ESLint passam. CI roda typecheck+lint+test (sem build Tauri).
- **MVP funcional**: já é possível abrir o app, criar pedido multi-broche, salvar, reabrir, exportar.
- Stack toda decidida e travada (ADRs). Não há rewrite pendente.

### 1.5 Tecnologias

| Camada           | Tecnologia                                 |
| ---------------- | ------------------------------------------ |
| Shell desktop    | Tauri 2 (Rust + WebView)                   |
| Frontend         | React 19 + TypeScript 5.8 + Vite 7         |
| Canvas           | Fabric.js 6 (uma instância única por view) |
| UI components    | shadcn/ui (style "new-york") + Tailwind 3  |
| Estado global    | Zustand                                    |
| Banco local      | SQLite via `tauri-plugin-sql`              |
| ORM              | Drizzle                                    |
| Forms            | React Hook Form + Zod                      |
| Atalhos          | react-hotkeys-hook                         |
| Ícones           | Lucide                                     |
| Drag/drop layers | dnd-kit                                    |
| Texto → path     | opentype.js                                |
| Empacotamento    | Tauri bundler → MSI Windows x64            |
| Testes           | Vitest + RTL + jsdom                       |

### 1.6 Arquitetura Geral

Separação obrigatória (definida em CLAUDE.md, fiscalizada):

- `src/core/` — regras puras (zero DOM, testáveis em Node): canvas-engine, export, alignment, validation.
- `src/data/` — schema Drizzle + repositories + migrations + seeds.
- `src/ui/` — apresentação React (componentes, painéis, páginas). Sem regra de negócio.
- `src/stores/` — Zustand.
- `src/services/` — efeitos colaterais (file system, IPC Tauri, image loading).
- `src/hooks/` — React hooks.
- `src/lib/` — utils puros.
- `src-tauri/` — backend Rust + migrations SQL embarcadas.
- `tests/` — Vitest.
- `docs/` — ARCHITECTURE.md, DECISIONS/ (19 ADRs), STATUS-ONDA-XX.md, DEBT.md.

---

## 2. ESTRUTURA DO PROJETO

### 2.1 Árvore Principal (resumida)

```
src/
├── app/           (2 arquivos)     — entrypoint React (App.tsx, router.tsx)
├── core/
│   ├── canvas/    (23 arquivos)    — engine Fabric, alignment, snap, slot-manager
│   ├── export/    (9 arquivos)     — PNG/SVG/DXF exporters, board-exporter, opentype
│   ├── patterns/  (vazio)          — placeholder
│   ├── orders/    (vazio)          — placeholder
│   ├── products/  (vazio)          — placeholder
│   └── validation/(vazio)          — placeholder
├── data/          (38 arquivos)    — schema.ts, repositories/, seeds/, migrations/, client.ts, transaction.ts
├── ui/            (87 arquivos)
│   ├── canvas/    (25)             — LayerPanel, overlays, dialogs
│   ├── components/(18)             — shadcn primitives
│   ├── pages/     (35)             — ArteHub, BancoPage, PadroesPage, NovoPedidoPage
│   └── layout/    (4)              — AppLayout, AppHeader
├── stores/        (1 arquivo)      — canvas-store.ts (Zustand)
├── hooks/         (6 arquivos)     — useBoardEngine, useCanvasEngine, useCanvasShortcuts…
├── services/      (11 arquivos)    — tauri-io, png/svg/dxf-export-service, asset-lookup, storage
├── lib/           (3 arquivos)     — cn, normalize-asset-name, sanitize-svg

src-tauri/         — main.rs, db_tx.rs, migrations/ (12 SQL files), capabilities/, resources/
tests/             — 42 arquivos, ~545–565 testes
docs/              — ARCHITECTURE.md, DECISIONS/ (19 ADRs), STATUS-ONDA-XX.md, DEBT.md, AI-CONTEXT.md
```

**Total:** 182 arquivos .ts/.tsx em `src/`.

### 2.2 Top 10 Arquivos Mais Longos (sinal de hotspots)

| #   | Arquivo                                               | Linhas       |
| --- | ----------------------------------------------------- | ------------ |
| 1   | `src/core/canvas/canvas-engine.ts`                    | **3.412** ⚠️ |
| 2   | `tests/core/canvas/canvas-engine.test.ts`             | 800          |
| 3   | `src/ui/canvas/LayerPanel.tsx`                        | 792          |
| 4   | `src/hooks/useBoardEngine.ts`                         | 767          |
| 5   | `src/ui/pages/arte/NovoPedidoPage.tsx`                | 764          |
| 6   | `src/ui/pages/arte/novo-pedido/NovoPedidoSidebar.tsx` | 751          |
| 7   | `src/core/canvas/slot-manager.ts`                     | 714          |
| 8   | `tests/data/orderRepository.test.ts`                  | 703          |
| 9   | `tests/core/export/board-exporter.test.ts`            | 676          |
| 10  | `src/data/schema.ts`                                  | 656          |

### 2.3 Sistema de Canvas/Editor

- **Uma instância Fabric.js** (`CanvasEngine`) por view, com pan/zoom via `setViewportTransform`.
- Snap engine **puro** (sem DOM, testável) integrado via callback no `object:moving`.
- Identidade de objetos: `obj.id` (UUID) para objetos comuns; **slots usam `obj.capiSlot.id`** (ATENÇÃO: dual-path em `getCapiId`).
- LayerMeta vive em `Map<capiId, LayerMeta>` no engine, com discriminated union: `principal | visual | operation`.
- Hierarquia rígida de 2 níveis (ADR 010). Validação tem 7 invariantes.
- Multi-broche: `useBoardEngine` posiciona N apliques em coords da prancha. Layout puro via `computeChapas()` (5 itens/coluna, gap 4mm, gap entre chapas 30mm, label-height 8mm).

### 2.4 Sistema de Exportação (Onda 27 — Fase C completa: C.1–C.4)

- **PNG mockup** (300 DPI, fundo #F4F4F2, sombra) — `src/core/export/png-exporter.ts`.
- **SVG por máquina** (mm puros via wrapper `<g scale(0.25)>`, cor stroke = operação) — `src/core/export/svg-exporter.ts`.
- **DXF R12** (1 arquivo por máquina×operação, paths flattened em polilinhas, Y-flipped) — `src/core/export/dxf-exporter.ts` + `dxf-writer.ts`.
- **Multi-chapa**: orquestrado por `src/core/export/board-exporter.ts`:
  - SVG: translate negativo + viewBox da chapa (Fase C.3).
  - DXF: motor recebe `clipBoundsMm`, filtra por centro de bbox e aplica offset (Fase C.4).
- **Asset routing**: `src/services/asset-lookup.ts` resolve `appliqueId/engravingId/markingId` → `{operation, machines[]}`.
- **Texto vetorizado**: `opentype.js` via `svg-text-converter.ts` + override de roteamento (Fase 9F).

### 2.5 Sistema de Templates ("Padrões")

- Tabela `patterns` no banco com `canvasJson` (estrutura serializada).
- `patternRepository.ts` faz parse lazy (listagem leve; detalhe pesado).
- **Regra crítica (CLAUDE.md)**: padrão mestre é IMUTÁVEL no fluxo normal. Salvar pedido NÃO toca em `patterns.canvasJson`. Só "Atualizar padrão mestre" (ação separada) pode modificar.
- Em `order_items` existe `patternId` (FK) + customizações próprias (`fieldsJson`, `canvasJson` do item).

### 2.6 Stores / State

**Uma única store Zustand** (`canvas-store.ts`):

- `boardItems: BoardItemDraft[]` (lista de broches em memória, local-session id)
- `selectedOrderItemIndex`
- Bulk ops (`duplicateBoardItem`, `addBoardItemsBulk`)
- Store é **estado puro** — não fala com repository nem com IO. Integração externa fica no `NovoPedidoPage`.

### 2.7 Hooks

- **`useBoardEngine`** (767 linhas, crítico): boot do canvas multi-broche, calcula offsets, aplica materiais, propaga snapshot pra reabertura.
- `useCanvasEngine` (single-product, usado em Padrões/Banco).
- `useCanvasShortcuts`, `useOrderShortcuts`.

### 2.8 Services

| Serviço                                                                                | Função                                                 |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `tauri-io.ts`                                                                          | Adapter para writeFile/openFolder/joinPath/documentDir |
| `png-export-service.ts`                                                                | savePng + buildPngFilename + getDefaultExportFolder    |
| `svg-export-service.ts`                                                                | saveSvgs + getDefaultSvgFolder                         |
| `dxf-export-service.ts`                                                                | saveDxfs + parseDxfBucketKey integration               |
| `asset-lookup.ts`                                                                      | Compositor dos 3 repos (applique/engraving/marking)    |
| `applique-storage.ts`, `logo-storage.ts`, `marking-storage.ts`, `engraving-storage.ts` | File system ops                                        |
| `svg-path-resolver.ts`                                                                 | Bridge opentype.js                                     |

### 2.9 APIs / Integrações Externas

- **Tauri plugins**: sql, dialog, fs, shell, opener.
- **opentype.js**: texto → SVG path (variable fonts como Roboto Slab podem falhar — fallback estruturado).
- **jsdom**: ambiente de teste.
- **Nenhuma API externa de rede.** 100% offline.

---

## 3. FUNCIONALIDADES IMPLEMENTADAS

### 3.1 ✅ O QUE JÁ FUNCIONA

- App abre, renderiza, navega entre seções (Início, Arte, Padrões, Banco).
- Criar pedido novo + escolher produto + escolher padrão + preencher campos.
- Multi-broche na mesma prancha (mesmo produto ou produtos diferentes).
- Multi-chapa: chapas separadas visualmente por produto, label em cima de cada uma.
- Trocar broche ativo via sidebar esquerda funciona como "aba" (Onda 27 final): canvas dá pan/zoom pra enquadrar só a chapa do broche ativo (`fitRegionToViewport`).
- Edição: drag, resize, alignment, snap (1mm sempre ativo), atalhos.
- Painel de camadas com visibilidade, lock, opacity, blend mode, drag-reorder.
- Salvar pedido + reabrir + histórico de revisões (`order_revisions`).
- **Exportação completa**:
  - PNG mockup (single e multi-chapa) com preview thumbnail no dialog.
  - SVG por máquina (single e multi-chapa via Fase C.3).
  - DXF R12 por máquina×operação (single e multi-chapa via Fase C.4).
- Cadastro/listagem/edição de apliques, gravações, marcações, materiais, fontes, logos via páginas em Banco e Padrões.
- Texto vetorizado via opentype.js no SVG/DXF.
- Override de roteamento de texto (Fase 9F dialog).

### 3.2 🟡 PARCIAL / INCOMPLETO

- **Onda 28** em curso: Painel de camadas estilo Photoshop/Figma. Arquivos novos em `src/ui/canvas/layer-panel/`: `LayerContextMenu.tsx`, `LayerOpacitySlider.tsx`, `LayerThumbnail.tsx`, `PanelFooter.tsx`, `PanelHeader.tsx`, `SortableLayerRow.tsx`. Modificações pendentes em `canvas-engine.ts`, `schema.ts`, `LayerPanel.tsx`, `LayerRow.tsx`.
- **Fase C.5** (pasta por pedido como root da exportação) — pendente. Hoje exportação salva todos os arquivos na mesma pasta destino (com prefixo no nome).
- **Texto com variable fonts** (Roboto Slab) — opentype.js falha → toast estruturado, vira placeholder XML no SVG, ignorado no DXF.
- **Modos Designer / Medição** previstos em REQUIREMENTS.md — apenas Modo Operador (padrão) está pleno.

### 3.3 🔬 EXPERIMENTAL / NÃO PROVADO

- **`fitRegionToViewport`** (Onda 27 final, sessão atual) — funciona em typecheck/lint, mas sem testes unitários nem validação visual reportada.
- Pastas vazias em `src/core/` (`patterns/`, `orders/`, `products/`, `validation/`): estrutura está aí mas regras estão dentro de `data/repositories/` e dentro de `useBoardEngine` — sinal de planejamento inacabado.
- **Cache `BoardItemDraft.canvasJson`** (Onda 13.5) dormente: engine sempre recria do baseSvg. Comentário no código: "vai voltar quando repensado".

### 3.4 ❌ NÃO IMPLEMENTADO (mas previsto em planos)

- Wave de "Produção por Camada" (campos `operation`+`machines` por camada na UI do operador) — **planejamento existe**, implementação ainda não exposta no fluxo do operador (só backend + dialog 9F).
- Backlog futuro (CRM, mobile, ERP integration) — Fase 2-3 documentada em `projeto/05-BACKLOG.md`.
- Validação contra v1 (Onda 13 do roadmap original) — não evidenciada.

---

## 4. MVP REAL

### 4.1 O MVP atual É:

> **"Operador abre o app, monta um pedido com 1–10 broches (mesmo ou produtos diferentes), preenche nome/profissão por broche, e gera os arquivos PNG (cliente) + SVG/DXF (laser) prontos pra produção."**

Esse fluxo **funciona end-to-end** no estado atual.

### 4.2 O Que Falta Pro Dia-a-Dia

1. **Validação em produção real** dos arquivos SVG/DXF da Onda 27 Fase C.3/C.4 nas máquinas (RDWorks/LaserCAD com pedido multi-chapa). Existe checkpoint visual planejado no DEBT.md mas não confirmado.
2. **Conclusão da Onda 28** (painel de camadas Pro) — está mid-flight, oito arquivos modified+não-comitados no working tree.
3. **Fase C.5** (pasta por pedido) — não é bloqueante mas ajuda organização do operador quando ele exporta dezenas de pedidos.
4. **Bug material dourado→prata** (DEBT.md) — em aberto, requer coleta runtime antes de fix.
5. **Persistência confiável**: tudo passa por SQLite local. **Sem backup automático** — se o operador apagar o `.db` ou der HD-fail, perde tudo. Sem nuvem prevista no MVP.

### 4.3 Gargalos Principais

1. **`canvas-engine.ts` com 3.412 linhas** — concentra demais. Qualquer bug exige caçar em arquivo gigante. Refactor adiado pra "Onda 24 hardening" (que ainda não veio).
2. **`useBoardEngine` recria engine inteira ao mudar boardItems** — sem diff incremental. Pedidos grandes (~50 broches) podem laggar em add/remove.
3. **Variable fonts no opentype.js** — falha silenciosa (toast). Operador pode passar texto pro laser virar placeholder sem perceber.
4. **Validação Zod ausente em leitura de canvasJson** (`patternRepository.ts:173`): JSON corrupto vira `null` sem throw. Pode aparecer como "pedido sumiu" no UI.
5. **Hierarquia de camadas rígida de 2 níveis hardcoded** — refactor futuro custaria caro.

### 4.4 Funcionalidades REALMENTE CRÍTICAS

| Crítica? | Funcionalidade                                                                  |
| -------- | ------------------------------------------------------------------------------- |
| 🟥 SIM   | Criar pedido + adicionar broche + preencher campos                              |
| 🟥 SIM   | Salvar + reabrir pedido                                                         |
| 🟥 SIM   | Exportar SVG correto pra laser (sem isso, app é inútil)                         |
| 🟥 SIM   | Exportar DXF correto pra RDWorks                                                |
| 🟥 SIM   | Snap + alinhamento básico                                                       |
| 🟧 ALTA  | Multi-chapa por produto                                                         |
| 🟧 ALTA  | PNG mockup pro cliente                                                          |
| 🟨 MÉDIA | Banco de assets (apliques, gravações, materiais)                                |
| 🟨 MÉDIA | Histórico de revisões                                                           |
| 🟦 BAIXA | Painel de camadas Photoshop-style (Onda 28) — operador não precisa pra produção |
| 🟦 BAIXA | Modo Designer / Medição (REQUIREMENTS.md)                                       |

---

## 5. PROBLEMAS TÉCNICOS

### 5.1 Bugs Conhecidos (DEBT.md + análise)

- **Bug material dourado→prata** (DEBT.md, débito Onda 18). Material Dourado selecionado renderiza Prata. Precisa coleta runtime antes do fix.
- **Regressão snap sem teste** (DEBT.md, alta). Snap ocasionalmente "gruda" errado em padrões antigos.
- **Alt+Tab durante drag deixa objeto travado** (DEBT.md, média).
- **Overlay sem teste E2E** (DEBT.md, média).

### 5.2 Partes Frágeis

1. **`canvas-engine.ts` serialização STRIP-RESTORE**: `toObject` é chamado entre strip de patterns/clipPaths e restore. Uma linha fora da ordem corrompe save/load.
2. **`fitRegionToViewport` recém-adicionado** sem testes unitários.
3. **Heurística "centro de bbox dentro da chapa"** no DXF Fase C.4: objetos cruzando borda da chapa podem ser descartados erradamente. Pragmático mas pode pegar o operador de surpresa.
4. **JSON parse silencioso** em `patternRepository.safeParseCanvasJson` — corrupção vira null sem alarme.
5. **Material reload async sem retry** (`canvas-engine.ts:3339`) — se `resolveUrl()` falhar (asset deletado), layer fica sem material (silent fail).
6. **`useBoardEngine` reload caro** — boardItems mudou? Engine inteiro recriado.

### 5.3 Código Complexo (concentrado em poucos arquivos)

- `canvas-engine.ts` (3.412 linhas, 106 casts `as unknown`) — Fabric.js requer casts por tipos incompletos. Casts são localizados e seguros, mas o arquivo é mega.
- `useBoardEngine.ts` (767 linhas) — múltiplas responsabilidades misturadas.
- `slot-manager.ts` (714 linhas).
- `LayerPanel.tsx` (792 linhas) — em refactor pela Onda 28 (sendo quebrado em subcomponentes em `layer-panel/`).

### 5.4 Possíveis Overengineerings

- **Hierarquia rígida de camadas (3 kinds com 7 invariantes)**: defendida pelos ADRs, mas pode estar superdimensionada pra um single-user de uma empresa pequena. Operador real lida com ~5 conceitos: aplique, texto, logo, traço, base.
- **DxfBuilder escrito à mão (R12 manual)**: poderia ter usado lib pronta. Decisão consciente (`ADR 016`) por controle exato, mas custa manutenção.
- **3 ondas separadas pra PNG/SVG/DXF por chapa** (C.1+C.2, C.3, C.4): o motor de cada formato é bem isolado, mas a abstração `chapa-export-info.ts` poderia ter sido pensada pra cobrir os três de uma vez no início.
- **Modo Designer / Modo Medição** (REQUIREMENTS.md) — operação real provavelmente nunca precisa.

### 5.5 Riscos Arquiteturais

1. **Patterns + clipPaths NÃO persistem em canvasJson** (decisão correta), mas deserialize precisa OBRIGATORIAMENTE resolver via assetLookup. Asset deletado = layer sem material **silenciosamente**.
2. **Sem backup automático do SQLite**. Se operador formatar PC, perde tudo.
3. **Multi-user não previsto** — atualizar pra 2 operadoras simultâneas vai precisar repensar (locks, sync).
4. **Migrations destrutivas SWAP** (v12) — bem implementadas, mas se falham no meio, recovery é manual.

### 5.6 Difíceis de Manter

- **`canvas-engine.ts`** (3.412 linhas).
- **Schema com nullable suspeitos** (`productLayers.svg`, `patternLayers.materialId`) — semânticas pouco claras pra dev novo.
- **`useBoardEngine`** acoplamento engine ↔ store ↔ repository.
- **Roteamento de texto** (svg-exporter `resolveTextRouting`): herança via parentLayerId com override map; 4 caminhos possíveis.

### 5.7 Funcionalidades Que Podem Quebrar Facilmente

- **Reabrir pedido salvo em versão antiga** — schemaVersion mudou 3 vezes (v0–v3). Retrocompat existe mas não tem matrix de teste cobrindo todas as combinações.
- **Adicionar broche durante drag de outro** — eventos Fabric podem interferir.
- **Exportar pedido com asset deletado entre criação e exportação** — silent fail.
- **Texto com fonte deletada do banco** — opentype falha, vira placeholder, operador pode não perceber.

---

## 6. FLUXO OPERACIONAL

### 6.1 Entrada do Pedido

1. Operador abre o app (Tauri MSI Windows).
2. Início → "Novo Pedido" (ou Arte → Novo Pedido).
3. Pedido nasce com label auto-incrementado ("Novo Pedido N").

### 6.2 Criação da Arte

1. Clica "Adicionar broche" → escolhe produto (`broche 60x25`, `placa 300x90`, …).
2. Escolhe padrão (templates pré-cadastrados via Padrões).
3. Escolhe material (textura PNG aplicada como Pattern Fabric).
4. Preenche campos: nome, profissão, logo. Texto é renderizado em tempo real (`fitText` automático).
5. Repete pra cada broche. Múltiplos broches do mesmo produto = mesma chapa. Produtos diferentes = chapas diferentes.

### 6.3 Edição

- Sidebar esquerda lista broches. Clicar troca o "ativo" e enquadra a chapa correspondente no canvas (Onda 27 final).
- Drag/resize com snap 1mm. Alt desliga snap.
- Painel de camadas direito: visibilidade, lock, opacity, blend mode, reorder via dnd-kit.
- Atalhos via react-hotkeys-hook.

### 6.4 Salvamento

- "Salvar" persiste `orders` + `order_items` (1 por broche) + cria entrada em `order_revisions` (snapshot completo).
- Transação atômica via `executeTransaction` (ADR 017).
- Snapshot da prancha inteira (`boardCanvasJson`) persistido pra reabertura idêntica.

### 6.5 Exportação

1. Botão "Exportar" → submenu (PNG / SVG / DXF).
2. Dialog mostra:
   - Nome do arquivo (auto-gerado: cliente-profissao_data; lote_Nx se multi-broche; chapaToken se multi-chapa).
   - Preview (PNG: thumbnail por chapa; SVG/DXF: lista de filenames previstos).
   - Pasta destino (persistida em settings).
   - Checkbox "Também exportar DXF" no dialog SVG.
3. Operador clica "Exportar" → arquivos salvos → Explorer abre na pasta.

### 6.6 Aprovação

- Botão "Aprovar" no header do pedido (mudança de status).
- Atualmente apenas marca; não dispara workflow externo.

### 6.7 Produção

- Operador abre os SVGs no RDWorks/LaserCAD (1 arquivo por máquina × operação).
- O laser executa: corte (preto), gravação (vermelho), marcação (azul).
- DXF é alternativa para softwares antigos que importam mal SVG.

---

## 7. CONTEXTO DOS DOCUMENTOS

### 7.1 Documentos do Briefing — Existência

| Documento solicitado  | Existe? | Substituído por                                                |
| --------------------- | ------- | -------------------------------------------------------------- |
| PROJECT_CONTEXT.md    | ❌      | `docs/AI-CONTEXT.md`                                           |
| MVP_SCOPE.md          | ❌      | `projeto/02-REQUIREMENTS.md` + CLAUDE.md                       |
| ROADMAP.md            | ❌      | `docs/STATUS-ONDA-XX.md` + `projeto/03-CLAUDE-CODE-KICKOFF.md` |
| ARCHITECTURE_RULES.md | ❌      | `CLAUDE.md` (extensões v2) + `docs/DECISIONS/` (19 ADRs)       |
| CURRENT_BUGS.md       | ❌      | `docs/DEBT.md` + `docs/STATUS-ONDA-XX.md`                      |

O projeto adotou formato **status-ondas + ADRs** ao invés de documentos monolíticos. Funcionalmente cobre tudo.

### 7.2 Documentos-Chave (resumo)

**`CLAUDE.md`** (raiz, instrução mestra):

- Canvas como coração central.
- 3 pilares: Canvas, Produtos, Padrões.
- Padrão Mestre ≠ Arte do Pedido (regra crítica).
- Stack travada (Tauri/React/Fabric/SQLite/Drizzle).
- Estrutura de pastas obrigatória.
- Proibições: alert/prompt nativos, hardcode 60/25, fonte Inter/Roboto/system-ui, componentes >300 linhas, lógica em UI.

**`docs/AI-CONTEXT.md`** (executivo, parcialmente desatualizado — congelado em Onda 12):

- Método de consultoria (Gabriell dono ↔ Claude consultor ↔ Claude Code executor).
- 19 ADRs criados.
- Single-user local, MVP completo antes de testar clientes, rewrite total.
- 7 lições de debugging (canvas nunca condicional, Group.width não-escaled, validação visual obrigatória).

**`docs/DEBT.md`** (durável):

- 5 dívidas abertas.
- 3 resolvidas em Onda 7.5.
- Severidade clara (🔴/🟡/🟢).
- Costurado ao fim de cada onda.

**`docs/STATUS-ONDA-18.md`** (snapshot mais recente do tipo "status"):

- DXF Export completo, 7 arquivos novos, 42 testes adicionados.
- 3 hotfixes durante sessão.
- Bug material dourado→prata pendente.

**`docs/DECISIONS/` — 19 ADRs**:

- ADR 005: Canvas em mm, DPI=4.
- ADR 010: Hierarquia de camadas discriminada (principal/visual/operation).
- ADR 011: Fabric 6 fill workaround.
- ADR 014: Sistema de snap (motor puro).
- ADR 016: Export (cores semânticas, opentype, PNG 300 DPI).
- ADR 017: Transações via DbInstances.

**`projeto/02-REQUIREMENTS.md`**:

- 17 RFs do MVP.
- 7 princípios não-negociáveis.
- 3 modos canvas (Operador/Designer/Medição).
- Critério de aceitação: 17 passos validáveis.

**`projeto/06-VISION.md`** (estratégico, não roadmap):

- 3 pilares: ARTE (banco vivo), SVG (arquivo perfeito por máquina), PRODUTOS (criação com regras).
- Identidade: "Corel personalizado para laser", NOT Canva.

### 7.3 Sinais de Maturidade dos Docs

- 120 arquivos em `src/` referenciam "Onda XX" — projeto iterativo, documentado.
- 0 TODOs/FIXMEs em `src/` (apenas 2 menções incidentais a "todos" em português).
- Última ONDA documentada: 28 (em curso).

---

## 8. ESTADO ATUAL DO FRONTEND

### 8.1 Como Funciona o Editor

- **NovoPedidoPage** orquestra: monta canvas via `useBoardEngine`, escuta mudanças em `boardItems` (Zustand), passa snapshot pra hidratar.
- **NovoPedidoCanvasArea** renderiza o `<canvas>` em si + overlays (snap guides, proximity, measurement, live metrics).
- **NovoPedidoLayerSidebar** (direita) = `LayerPanel` integrado.
- **NovoPedidoSidebar** (esquerda) = lista de broches (atuando como abas após Onda 27 final).

### 8.2 Bibliotecas Visuais

- **shadcn/ui** (style "new-york"): Button, Dialog, Input, Select, Tooltip, etc — primitives Radix.
- **Tailwind 3** com tokens custom: paleta `ink-{50..950}`, `laser`, `op-*`, `ok/warn/danger`. **Tema dark por padrão**.
- **Fontes obrigatórias**: `font-display`/`font-mono` = JetBrains Mono, `font-body` = Geist Variable. CLAUDE.md proíbe Inter/Roboto/system-ui.
- **Lucide React** para ícones.
- **dnd-kit** para drag-drop de camadas (Onda 28).

### 8.3 Renderização

- **WebView Tauri** roda Vite-built React 19. Hot reload em dev.
- Canvas Fabric é **um único elemento DOM** com pan/zoom via `setViewportTransform`. Sem virtualização.
- `requestRenderAll()` lazy vs `renderAll()` immediate em animações.
- Material cache (`Map<materialId, Promise<HTMLImageElement>>`) deduplica fetches em multi-broche.
- Grid de pontos = 1 `fabric.Rect` com `fabric.Pattern` (não 27.000 dots), zoom-aware (ADR 015).
- Snap guides com fade-out via `ValueAnimation`, cancellable.

### 8.4 Canvas (Fabric.js v6)

- Detalhado na seção 2.3. Pontos-chave:
  - 1 instância Fabric por view.
  - Identidade: `obj.id` UUID (dual-path com `obj.capiSlot.id` para slots).
  - LayerMeta map paralelo aos objetos.
  - Strip-restore pattern em serialize/deserialize (patterns + clipPaths não persistem).

### 8.5 Manipulação de Objetos

- Drag/resize: handlers Fabric padrão.
- Snap 1mm sempre ativo (Alt desliga).
- Alinhamento por grupo: `AlignmentToolbar` chama comandos puros em `core/canvas/alignment/`.
- Atalhos: `useCanvasShortcuts` (delete, escape, ctrl+d, etc.).

### 8.6 Exportação SVG (detalhe frontend)

- `ExportSvgDialog`:
  - Aceita `chapaInfos[]` (do `NovoPedidoPage` via useMemo).
  - Modo single-chapa: chama `exportSvgByMachine` direto.
  - Modo multi-chapa (`chapaInfos.length >= 2`): chama `exportBoardSvgByChapa`.
  - Checkbox DXF habilitada nos dois modos.
- Lista de filenames previstos mostrada no dialog antes do export.
- Persistência da última pasta em `settings` (key `export.svg.lastFolder`).

### 8.7 Gerenciamento de Estado

- **Zustand store única** (`canvas-store.ts`): `boardItems`, `selectedOrderItemIndex`, ações.
- **Estado puro**: sem fetches/IO.
- **Persistência via repository** em `NovoPedidoPage` (chamadas a `orderRepository.saveRevision` etc.).
- `BoardItemDraft.canvasJson` cache dormente (Onda 13.5) — pretendido mas não usado.

### 8.8 Sistema de Templates

- Página `PadroesPage` (CRUD de padrões).
- Cadastro via canvas dedicado (modo padrão) — não através do fluxo de pedido.
- Listagem leve (sem parse de canvasJson).
- Edição abre o canvas com canvasJson hidratado.
- "Atualizar padrão mestre" é botão SEPARADO (não disponível no fluxo de pedido).

---

## 9. PRINCIPAIS GARGALOS

### 9.1 O Que Mais Está Atrasando o Desenvolvimento

1. **`canvas-engine.ts` mega-arquivo (3.412 linhas)**: navegar pra mexer em qualquer comportamento exige skim de centenas de linhas. Cada Onda nova acrescenta.
2. **Validação visual depende do Gabriell (operador)**: não há testes E2E (Playwright/Cypress). Vai pra console DevTools manual + screenshots.
3. **Ondas frequentes (28 ondas no total)** sem ondas dedicadas a refactor/hardening — pile-up de complexidade. ADR 016 e DEBT.md mencionam "Onda 24 hardening" que NÃO veio.
4. **Bug material dourado→prata em aberto há semanas** (desde Onda 18) — sem ataque resolutivo planejado.

### 9.2 O Que Está Complexo Demais

1. **Hierarquia de camadas com 7 invariantes** — operador real lida com ~5 conceitos.
2. **Override de roteamento de texto via Map + parent inheritance** — 4 caminhos possíveis em `resolveTextRouting`.
3. **Strip-restore de patterns/clipPaths em serialize** — sensível a ordem, mexer aqui é caminhar em campo minado.
4. **`useBoardEngine` 767 linhas** misturando boot/layout/material/snapshot/eventos.

### 9.3 O Que Deveria Ser Simplificado

1. **Quebrar `canvas-engine.ts`** em ao menos: `engine-core.ts`, `engine-serialization.ts`, `engine-layers.ts`, `engine-snap-integration.ts`, `engine-board.ts`. Pode ser cirúrgico (cada subarquivo expõe métodos compatíveis).
2. **Unificar `chapa-export-info.ts` com fontes únicas pra PNG/SVG/DXF**: hoje cada formato consome bbox de forma sutilmente diferente.
3. **Modo Designer / Medição (REQUIREMENTS.md)** — adiar definitivamente. Operador não precisa.
4. **Schemas `productLayers.svg` nullable, `patternLayers.materialId` nullable** — auditar e tornar NOT NULL onde aplicável.

### 9.4 O Que Deveria Ser Adiado

- **Painel de camadas Photoshop/Figma (Onda 28)** — bonito mas operador real só usa visibilidade/lock. Polish UX antes de produção real é desperdício.
- **Cache `BoardItemDraft.canvasJson`** (Onda 13.5 dormente) — não trazer de volta até ter evidência de gargalo.
- **Fase C.5 (pasta por pedido)** — pode ser ganha rápida (1 dia), mas não bloqueia produção.
- **Wave futura "Produção por Camada"** (tipo+máquinas obrigatórios na UI do operador) — adiar até alguém pedir.

---

## 10. RECOMENDAÇÕES

### 10.1 Melhorias Rápidas (1-3 dias)

1. **Validar Fase C.3/C.4 nas máquinas reais** (RDWorks + LaserCAD com pedido multi-chapa). Sem isso a Onda 27 é teórica.
2. **Resolver bug material dourado→prata** (DEBT.md): instrumentar com logs estruturados na seleção+aplicação de material, reproduzir, fixar.
3. **Adicionar testes de `fitRegionToViewport`** (Onda 27 final).
4. **Adicionar 1 teste E2E real** (Playwright): abrir app, criar pedido com 2 produtos, exportar SVG, validar contagem de arquivos. Mata 80% dos riscos de regressão.
5. **Backup automático do SQLite** (cron diário pra pasta Documents) — 30 minutos de código, salva o operador de catástrofe.

### 10.2 Simplificações (1-2 semanas)

1. **Refactor de `canvas-engine.ts`**: extrair em 4-5 arquivos por responsabilidade (serialização, layers, snap-integração, board). Sem mudar API pública.
2. **Substituir `useBoardEngine` recria-tudo por diff incremental**: detectar boardItems mudados e só atualizar/adicionar/remover.
3. **Schemas: tornar NOT NULL os campos `productId`, `patternId`, `materialId` em `orderItems`** (com migration). Operador não deve poder salvar pedido vazio.

### 10.3 Prioridades Reais (em ordem)

1. **Encerrar Onda 28** ou descartar (working tree tem 8 arquivos pendentes — limbo é pior que abandonado).
2. **Validar exportação multi-chapa nas máquinas** (PRODUÇÃO REAL, com operador, com material).
3. **Backup automático do banco** (risco existencial).
4. **Fix material dourado→prata**.
5. **Refactor cirúrgico de `canvas-engine.ts`** (preparar próximas ondas).
6. **Fase C.5 (pasta por pedido)** se operador pedir.
7. Adiar Modo Designer/Medição, Painel Pro polish, wave "Produção por Camada".

### 10.4 Menor Caminho Para Produção Diária

```
1. Limpar working tree (terminar OU abortar Onda 28)
2. Empacotar MSI Windows da versão atual
3. Instalar na máquina do operador real
4. Rodar 1 SEMANA em produção com pedidos reais (com backup manual diário)
5. Listar TODOS os atritos que aparecerem
6. Atacar APENAS os atritos top-3 antes de continuar features
```

**Não há razão técnica pra adiar uso real.** O MVP funciona. O risco é catastrófico se o banco corromper (sem backup), então **adicionar backup automático é o ÚNICO bloqueador real**.

---

## SINAIS QUANTITATIVOS — MÉTRICAS DE SAÚDE

| Métrica                         | Valor                               | Avaliação                              |
| ------------------------------- | ----------------------------------- | -------------------------------------- |
| Arquivos `.ts/.tsx` em `src/`   | 182                                 | Razoável pra projeto desse porte       |
| Testes (vitest)                 | ~545–565 verdes                     | Sólido (≥80% cobertura em `core/`)     |
| TODOs/FIXMEs/HACKs em `src/`    | 0                                   | Excelente                              |
| `console.log/warn/error`        | 38, estruturados                    | Limpo                                  |
| `as any/unknown` casts          | 110 (106 em canvas-engine)          | Localizados, justificáveis             |
| `@ts-ignore`/`@ts-expect-error` | 0                                   | Excelente                              |
| `eslint-disable` em src/        | 8 (todos exhaustive-deps legítimos) | Limpo                                  |
| Arquivos >500 linhas            | 8                                   | `canvas-engine.ts` é o único alarmante |
| Migrations SQL                  | 12 versões cumulativas              | Bem versionado                         |
| ADRs                            | 19                                  | Decisões documentadas                  |
| Ondas concluídas                | 28 (Onda 28 em curso)               | Ciclo ativo                            |
| CI/CD                           | Typecheck+lint+test (sem build)     | Baseline ok, falta CD                  |
| Husky pre-commit                | Sim (eslint+prettier lint-staged)   | Bom                                    |

---

## DIAGNÓSTICO FINAL

**O projeto é tecnicamente saudável.** Cobertura sólida, type safety bem cuidada, decisões documentadas, ciclo iterativo. O fluxo crítico (criar pedido → exportar laser) **funciona end-to-end**.

**Os 3 riscos reais:**

1. **Sem backup automático** (risco existencial, fix trivial).
2. **Bug material dourado→prata em aberto** (pode aparecer em produção real).
3. **`canvas-engine.ts` é o único arquivo "perigoso"** pra manter no longo prazo.

**A maior oportunidade:** **parar de adicionar features e colocar em produção real por 1 semana.** A maioria dos problemas que vão importar de verdade só aparecem com pedidos reais nas mãos do operador. Continuar polindo o painel de camadas (Onda 28) ou planejando modos Designer/Medição é otimização prematura.

O MVP está pronto. Falta usar.
