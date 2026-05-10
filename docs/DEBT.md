# Dívidas Técnicas Conhecidas

> **Última atualização:** 2026-05-10 (Onda 7.5 fechada — bugs #3 e #4 do slot-manager resolvidos).
> **Próxima varredura sugerida:** ao iniciar a próxima onda relevante (Onda 7 painel de camadas, ou Onda 8.5 gravações).

---

## Como usar este documento

- Cada dívida tem **origem** (qual onda introduziu), **descrição**, **severidade** e indicação de **quando resolver**.
- Severidade:
  - 🔴 **Alta** — afeta entrega ao cliente final ou bloqueia ondas seguintes
  - 🟡 **Média** — afeta confiabilidade interna (testes, debug) mas não chega ao usuário
  - 🟢 **Baixa** — cosmético, polimento ou cobertura
- Quando uma dívida é resolvida, mover entrada para `## Resolvidas` no fim do documento (com hash do commit).
- Ao abrir nova dívida em qualquer onda, adicionar aqui no formato padrão.

---

## Abertas

### 1. 🟡 Fluxos de regressão da Fase B sem teste explícito

- **Origem:** Onda 7a Fase B (snap)
- **Descrição:** Quando o snap foi integrado no `CanvasEngine` via `attachSnapHandlers`, 6 fluxos não foram cobertos por testes de integração:
  1. Mover objeto isolado com snap em grade (sem outros objetos)
  2. Multi-seleção (`ActiveSelection`) durante drag
  3. Snap entre eixos diferentes simultaneamente (X e Y na mesma frame)
  4. Snap com Alt segurado (deve desativar)
  5. Recuperação após `clearUserObjects` durante drag
  6. Snap no caso "objeto sem `parentLayerId`" (filhote da placa direto)
- **Quando resolver:** suite E2E ou onda dedicada de testes de integração. Se aparecer bug de regressão, criar teste do caso e fechar a dívida.

### 2. 🟡 Bug Alt+Tab com mouse pressionado trava drag

- **Origem:** Onda 7b Fase C
- **Descrição:** Se o usuário aperta o botão do mouse num objeto, faz Alt+Tab pra outra janela e volta, o objeto fica grudado no cursor — Windows intercepta o `mouseup` durante a troca de janela. Diferente do bug Alt+Tab resolvido (esse foi do listener de Alt no keyup; este é do mouse).
- **Solução conhecida:** ouvir `blur` da `window` e abortar drag ativo no Fabric (`canvas.fire('mouse:up', { e: ... })` sintético + `canvas.discardActiveObject()`).
- **Quando resolver:** quando virar problema real (raro hoje — usuário típico não troca de janela durante drag).

### 3. 🔴 ~~Overlay tracejado vermelho do slot não segue body em redimensionamento~~ — RESOLVIDA

Movida para `## Resolvidas` (Onda 7.5).

### 4. 🔴 ~~`entry.content` (texto/logo) do slot não segue body em drag/scale/alignment~~ — RESOLVIDA

Movida para `## Resolvidas` (Onda 7.5).

### 5. 🟢 Caller do alignment sem teste de integração

- **Origem:** Onda 7b Fase D
- **Descrição:** `alignment-commands.ts` puro tem 16 testes (cobertura 100%). Mas o **caller** (`AlignmentToolbar.tsx`) que monta os `referenceBounds` a partir do estado do canvas não tem teste de integração — o bug grave da Fase D ("slot dentro de aplique alinha com canvas") passou nos 16 testes mas falhou no runtime, porque o problema estava em **como o caller construía o input**, não na função pura.
- **Solução:** mock pesado de Fabric ou suite E2E real (Tauri + Webview).
- **Quando resolver:** quando montar suite E2E (provavelmente Onda 13 — validação final). Aceito por enquanto porque mockar Fabric na unit test é over-engineering pra cobertura marginal.

### 6. 🟢 ~~`coverage/` versionado acidentalmente~~ — RESOLVIDA

Movida para `## Resolvidas` (Fase G).

---

## Resolvidas

### 6. 🟢 `coverage/` versionado acidentalmente

- **Origem:** Onda 7a (commit `8cb037f`)
- **Descrição:** Pasta de output de testes (`coverage/`) foi commitada por engano. Cada `npm test` modificava os arquivos, gerando ruído no `git status` e diffs gigantes nos PRs.
- **Resolvida em:** Onda 7b Fase G — commit `aeae83a`. Adicionado ao `.gitignore` + `git rm -r --cached coverage/`.

### 3. 🔴 Overlay tracejado vermelho do slot não segue body em redimensionamento

- **Origem:** Onda 4 (slot-manager)
- **Descrição original:** Quando o usuário redimensiona um slot via handles do Fabric, o body cresce/encolhe corretamente mas o overlay tracejado vermelho mantém o tamanho original. Slot visualmente torto durante criação de padrão.
- **Causa raiz descoberta:** `objectCaching` padrão do Fabric 6 — overlay com stroke tracejado cacheava a borda e não invalidava durante `object:scaling` rápido. Os listeners já chamavam `overlay.set({...})` corretamente; o cache é que servia frame defasada.
- **Resolvida em:** Onda 7.5 — commit `bf4610e`. `objectCaching: false` em `buildOverlayRect`. Padrão idêntico ao das measurement/proximity lines (ADR 015 §3) e referenciado no ADR 006 sobre bug de cache.

### 4. 🔴 `entry.content` (texto/logo) do slot não segue body em drag/scale/alignment

- **Origem:** Onda 4 (slot-manager)
- **Descrição original:** Quando o usuário arrasta ou redimensiona um slot, o body se move/escala mas o conteúdo interno (texto/logo) não acompanha. Exposto na Fase D (alignment) e Fase E (resize).
- **Causa raiz descoberta:** Os listeners de transformação (`object:moving`, `object:scaling`, `object:modified`) foram escritos antes do conceito de content existir (Onda 4 checkpoint inicial). Quando `addText`/`addLogo` chegaram em checkpoints posteriores, posicionaram content apenas na criação — listeners nunca foram estendidos.
- **Resolvida em:** Onda 7.5 — commit `bf4610e`. Novo helper privado `syncContentToBody(entry, phase)` chamado em 4 lugares (3 listeners + `updateSlot`). Texto recentraliza durante `transform` (60fps); refaz fitText em `commit`. Logo reescala proporcional + recentraliza (idempotente — usa `group.width` natural, não acumula scale).
- **Bug latente da Fase D resolvido de quebra:** `AlignmentToolbar` disparava `canvas.fire('object:modified', { target: child })` programaticamente após reposicionar slots — agora o handler chama `syncContentToBody`, então alignment + content ficam sincronizados.
