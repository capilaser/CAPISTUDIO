# 🚀 Prompt de Kickoff — Capi Studio v2

> **Como usar:** copie todo este arquivo (do título até o fim) e cole na primeira mensagem do Claude Code dentro da pasta vazia `capi-studio-v2/`. Anexe junto: `01-DATABASE.md`, `02-REQUIREMENTS.md`, `CLAUDE.md` (do v1), `ROADMAP.md` (do v1), `Untitled_whiteboard_2026-05-04.png` (fluxograma), `broches-studio_5.html` (referência visual). Anexe também o repositório do Capi Studio v1 inteiro como leitura de referência.

---

## ⚠️ ATUALIZAÇÃO PÓS-ONDA 8 (estado vigente)

Este kickoff foi escrito quando o projeto estava na Onda 0. **As Ondas 0–6.5 e a Onda 8 já foram entregues e commitadas.** O documento abaixo permanece como referência histórica do plano original, mas o estado vigente é:

### Estratégia atual (travada pós-Onda 8)

> **Construir o produto inteiro de forma sólida antes de testar com clientes.**

A operação que o Capi Studio v2 automatiza já é validada na prática diária do dono — não há "MVP pra validar mercado". O critério de pronto é **substituir o fluxo do Corel inteiro**.

**Implicações:**

- Não vender em fatias intermediárias
- Não pular ondas pra "ir mais rápido"
- Cada onda fecha completa (Plano → Implementação → Validação → Commit)
- Pós-MVP: ajustes pontuais e atualizações projetadas, não reescrita

### Estado real das ondas (atualizado)

| Onda    | Tema                                                      | Status         |
| ------- | --------------------------------------------------------- | -------------- |
| 0       | Bootstrap Tauri + React + TS                              | ✅ Fechada     |
| 1       | Banco SQLite + Seeds                                      | ✅ Fechada     |
| 2       | Home + Layout Base                                        | ✅ Fechada     |
| 3       | Canvas Fabric.js                                          | ✅ Fechada     |
| 4       | Slots + fitText                                           | ✅ Fechada     |
| 4.5     | Banco de Fontes Curado                                    | ✅ Fechada     |
| 5       | Texturas (PNGs ABS Escovado)                              | ✅ Fechada     |
| 6a      | Schema hierárquico (3 bancos novos)                       | ✅ Fechada     |
| 6b      | Parser Corel + LayerMeta hierárquico                      | ✅ Fechada     |
| 6c      | ❌ REMOVIDA — absorvida pela Onda 7                       | —              |
| 6.5     | UI Apliques completa                                      | ✅ Fechada     |
| **8**   | **Padrões salvos + reabertura (commit 17a23ae)**          | **✅ Fechada** |
| **9.5** | **Mini — Cadastrar 5 materiais novos (Acrílico)**         | **⏭️ PRÓXIMA** |
| 7       | Painel hierárquico + alinhamento Confluence               | ⏳             |
| 8.5     | Banco de Gravações + uso no canvas (categoria Profissões) | ⏳             |
| 9       | Exportação PNG + SVG por máquina                          | ⏳             |
| 10      | Telas restantes (Grid, Histórico, Banco)                  | ⏳             |
| 11      | Atalhos + Undo/Redo                                       | ⏳             |
| 12      | Polimento + build MSI                                     | ⏳             |
| 13      | Validação final + smoke test                              | ⏳             |

**Sequência travada (ordem de execução):** Mini-9.5 → Onda 7 → Onda 8.5 → Onda 9 → Onda 10 → 11 → 12 → 13.

**Justificativa da ordem:**

- Mini-9.5 primeiro: trabalho pequeno, destrava material correto pras placas
- Onda 7 antes de criar mais padrões: evita refazer com UX ruim
- Onda 8.5 antes da 9: evita refazer pipeline de export quando gravações entrarem
- Onda 10 antes de 11/12: telas são produto, atalhos/polimento são lapidação

### O que ainda vale do kickoff original

✅ Stack (não-negociável) — seção abaixo
✅ Estrutura de pastas — seção abaixo
✅ Regras de comportamento Claude Code — seção abaixo
✅ Design system — seção abaixo
✅ Critério de primeiro commit — **NÃO se aplica mais** (o projeto já tem dezenas de commits)

### O que NÃO vale mais do kickoff original

❌ "Comece pela Onda 0" — Onda 0 já foi feita
❌ Tabela de ondas no roadmap original (substituída pela tabela acima)
❌ Login na Onda 2 (Login removido do MVP — single-user local sem senha)

---

## CONTEXTO HISTÓRICO (mantido pra referência)

Você é o engenheiro responsável por construir o **Capi Studio v2**, um sistema desktop para Windows de criação de artes para gravação a laser e corte a laser.

**Importante: este é um RE-WRITE INFORMADO, não um projeto novo do zero.**

Existe um sistema v1 em produção (Electron + HTML monolítico de 16.000 linhas, 14 ondas concluídas) que **não está sendo usado por clientes ainda**, mas contém **conhecimento de domínio destilado** ao longo de meses. Esse v1 é a sua **fonte de verdade das regras de negócio** — você vai consultá-lo constantemente como spec executável, mas vai re-implementar em stack moderna.

A missão: construir um v2 que produz **output funcionalmente equivalente ou superior** ao v1, em arquitetura limpa, modular, testável e escalável.

---

## STACK (não negociável)

```
Shell desktop:    Tauri 2.0 (Rust backend + WebView)
Frontend:         React 18 + TypeScript 5 + Vite
Canvas:           Fabric.js 6.x (importação/exportação SVG nativa)
UI components:    shadcn/ui + Tailwind CSS 3.x
Estado global:    Zustand
Banco local:      SQLite via tauri-plugin-sql
ORM:              Drizzle (type-safe + migrations)
Forms:            React Hook Form + Zod
Atalhos:          react-hotkeys-hook
Ícones:           Lucide React
Empacotamento:    Tauri bundler → MSI installer (Windows x64)
Plataforma alvo: Windows 10/11 x64 (apenas — sem cross-platform no MVP)
```

**Justificativa da escolha** (pra você não questionar): Fabric.js é a única biblioteca canvas madura com import/export SVG nativo e 40× mais popular que alternativas, essencial pra um fluxo SVG-in/SVG-out como o nosso. Tauri é mais leve e moderno que Electron com performance superior. SQLite local elimina infra e custo recorrente.

---

## ARQUIVOS ANEXADOS QUE VOCÊ DEVE LER ANTES DE CODAR

Em ordem de prioridade:

1. **CLAUDE.md (do v1)** — princípios, fluxos, proibições. **É lei.** Estenda, não substitua.
2. **02-REQUIREMENTS.md** — requisitos funcionais detalhados deste v2.
3. **01-DATABASE.md** — schema SQLite com Drizzle, seeds, migrations.
4. **Untitled_whiteboard_2026-05-04.png** — fluxograma obrigatório do produto. **Veja primeiro.**
5. **ROADMAP.md (do v1)** — o que cada uma das 14 ondas entregou. Mapa do conhecimento de domínio.
6. **broches-studio_5.html (do v1)** — referência visual e código fonte do canvas atual. Use pra entender lógicas como `fitText`, `applyMaterialToSvg`, `extrairContornosInternos`, `buildProductionSVG`.
7. **README.md (do v1)** — visão geral do v1.
8. **TASKS.md (do v1)** — backlog técnico do v1.

---

## REGRA DE OURO DA REUTILIZAÇÃO DO V1

O v1 NÃO é "código a copiar". É **especificação executável das regras de negócio**.

**FAÇA:**

- Leia funções complexas do v1 (ex: `fitText`, `applyMaterialToSvg`) e re-implemente em TypeScript modular com testes unitários.
- Use os 7 cenários validados de broche 60×25 do v1 como **casos de aceitação**: o v2 deve produzir output visualmente equivalente.
- Migre os JSONs de `data/` do v1 (machines, products, materials, fonts, patterns) como **seeds do SQLite**.
- Preserve os nomes/conceitos do domínio: padrão mestre, arte do pedido, slot, camada, operação, máquina, contorno, gravação, aplique.

**NÃO FAÇA:**

- Não copie código JS direto. Re-implemente em TS com tipagem forte.
- Não duplique lógica do `index.html` no React. Quebre em módulos puros (`core/`) sem dependência de DOM.
- Não importe a stack do v1 (jQuery patterns, vanilla JS imperativo). Escreva idiomático React + TS funcional.

---

## ARQUITETURA DE PASTAS (obrigatória)

Baseada na seção "Estrutura Conceitual Recomendada" do CLAUDE.md, adaptada à stack:

```
capi-studio-v2/
├── src-tauri/                    # Rust backend
│   ├── src/
│   │   ├── main.rs
│   │   ├── commands/             # IPC commands (file_system, export, ...)
│   │   └── lib.rs
│   ├── migrations/               # SQL migrations geradas pelo Drizzle
│   ├── tauri.conf.json
│   └── Cargo.toml
│
├── src/                          # Frontend React + TS
│   ├── app/
│   │   ├── App.tsx
│   │   ├── router.tsx            # React Router (rotas das 6 telas)
│   │   └── providers.tsx         # Theme, Query, Toast providers
│   │
│   ├── core/                     # Regras de negócio puras (zero DOM)
│   │   ├── canvas/               # Adapter sobre Fabric.js
│   │   │   ├── canvas-engine.ts
│   │   │   ├── slot-manager.ts
│   │   │   ├── layer-manager.ts
│   │   │   └── fit-text.ts       # Re-implementação do fitText do v1
│   │   ├── patterns/
│   │   │   ├── pattern-service.ts
│   │   │   └── pattern-validator.ts
│   │   ├── orders/
│   │   │   ├── order-service.ts
│   │   │   └── override-engine.ts # Aplicar overrides sobre padrão base
│   │   ├── products/
│   │   ├── alignment/            # Snap, guias, distribuição
│   │   ├── export/
│   │   │   ├── png-exporter.ts
│   │   │   ├── svg-exporter.ts   # Equivalente ao buildProductionSVG do v1
│   │   │   └── route-by-machine.ts
│   │   └── validation/           # Zod schemas
│   │
│   ├── data/                     # Camada de persistência
│   │   ├── schema.ts             # Drizzle schema (do 01-DATABASE.md)
│   │   ├── client.ts             # Drizzle client (Tauri SQL)
│   │   ├── repositories/
│   │   │   ├── pattern-repo.ts
│   │   │   ├── order-repo.ts
│   │   │   ├── product-repo.ts
│   │   │   └── asset-repo.ts
│   │   ├── seed.ts
│   │   └── migrations/
│   │
│   ├── ui/                       # React components (apresentação)
│   │   ├── components/           # shadcn primitives + customs
│   │   ├── canvas/               # Componentes do canvas (toolbar, layers panel, ...)
│   │   ├── panels/               # Painéis (propriedades, alinhamento, ...)
│   │   ├── pages/                # 1 pasta por tela
│   │   │   ├── home/
│   │   │   ├── canvas-editor/
│   │   │   ├── pattern-grid/
│   │   │   ├── art-history/
│   │   │   ├── asset-bank/
│   │   │   └── login/
│   │   └── layout/
│   │
│   ├── stores/                   # Zustand stores
│   │   ├── canvas-store.ts
│   │   ├── ui-store.ts
│   │   └── selection-store.ts
│   │
│   ├── services/                 # Side-effects (file system, IPC)
│   │   ├── file-system.ts
│   │   ├── tauri-invoke.ts
│   │   └── image-loader.ts
│   │
│   ├── hooks/                    # Custom React hooks
│   ├── lib/                      # Utils (cn, format-mm, ...)
│   ├── styles/                   # Tailwind globals + tokens
│   └── main.tsx
│
├── tests/                        # Vitest + React Testing Library
│   ├── core/                     # Unit tests do core (>80% cobertura)
│   ├── integration/
│   └── fixtures/                 # SVGs/JSONs dos 7 cenários do v1
│
├── public/                       # Assets estáticos
│
├── docs/                         # Documentação interna
│   ├── ARCHITECTURE.md
│   ├── DECISIONS/                # ADRs (Architecture Decision Records)
│   └── DOMAIN.md
│
├── CLAUDE.md                     # Princípios (estendido do v1)
├── README.md
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── vite.config.ts
├── drizzle.config.ts
└── .gitignore
```

---

## ROADMAP DE EXECUÇÃO (em ondas — não pule etapas)

### 🌊 Onda 0 — Bootstrap (1 sessão)

**Critério de saída:** `npm run tauri dev` abre janela vazia com "Capi Studio v2".

- [ ] Criar projeto Tauri 2.0 com template React + TS
- [ ] Instalar dependências (Fabric, Tailwind, shadcn, Drizzle, Zustand, etc.)
- [ ] Configurar Tailwind + shadcn (init com `npx shadcn@latest init`)
- [ ] Setup de paths (`@/` aliasing) no tsconfig + vite
- [ ] Setup de ESLint + Prettier + lint-staged
- [ ] Setup do Drizzle config + plugin tauri-sql
- [ ] Estrutura de pastas conforme acima (criar todas vazias com `.gitkeep`)
- [ ] Hello world: `App.tsx` renderiza "Capi Studio v2" + tema Tailwind funcionando

### 🌊 Onda 1 — Persistência e seeds

**Critério de saída:** ao abrir o app, banco SQLite é criado com seeds do v1 migradas.

- [ ] Implementar `src/data/schema.ts` exatamente como `01-DATABASE.md`
- [ ] Gerar migration inicial (`npx drizzle-kit generate`)
- [ ] Implementar `src/data/client.ts` com `tauri-plugin-sql`
- [ ] Implementar repositories básicos (CRUD bare-bone) pra cada tabela
- [ ] Implementar `seed.ts` migrando os JSONs do v1:
  - `data/machines.json` → `machines` + `machine_operations`
  - `data/products.json` → `products` + `product_machines`
  - `data/materials.json` → `textures`
  - `data/fonts.json` → `fonts`
  - `data/patterns/*.json` → `patterns` + `pattern_slots`
- [ ] Comando IPC `seed_database` que roda no primeiro boot
- [ ] Teste: abrir app duas vezes — não duplica seeds

### 🌊 Onda 2 — Login + Home

**Critério de saída:** RF-1.x e RF-2.x passam.

- [ ] Tela de Setup inicial (definir senha)
- [ ] Tela de Login
- [ ] Hash bcrypt da senha (no Rust, via crate `bcrypt`)
- [ ] Tela Home com 4 cards + dashboard mínimo + lista de últimas 5 artes
- [ ] React Router configurado
- [ ] **Aplicar skill `frontend-design`** na Home: aesthetic intencional, paleta da seção 13 deste prompt, fonte distintiva (NÃO usar Inter/Roboto/system fonts)

### 🌊 Onda 3 — Canvas mínimo (Fabric integrado)

**Critério de saída:** abrir canvas em branco, adicionar retângulo e texto, salvar/carregar JSON do banco.

- [ ] Setup do Fabric.js 6 dentro de um componente React
- [ ] `core/canvas/canvas-engine.ts`: adapter sobre Fabric com API tipada
- [ ] Renderização do produto base (SVG da `products.baseSvg`) como background
- [ ] Sistema de unidades em mm (conversão mm ↔ px usando DPI configurável)
- [ ] Persistência: serializar Fabric JSON + metadados Capi pra `patterns.canvasJson`
- [ ] Toggle Modo Operador / Modo Designer (UI ainda básica)
- [ ] Zoom (Ctrl++/-, Ctrl+0) + Pan (Espaço)

### 🌊 Onda 4 — Slots e fitText

**Critério de saída:** criar padrão com slot de nome+profissão+logo, preencher campos no Modo Operador, ver fitText em ação.

- [ ] `core/canvas/slot-manager.ts`: criar/editar/deletar slots
- [ ] Tipos de slot: logo, nome, profissão, custom
- [ ] Painel de criação de slot (Modo Designer): clicar e arrastar área, definir tipo
- [ ] **Re-implementar `fitText` em TS** (consultar v1 como spec)
- [ ] Modo Operador: toolbar com inputs de logo (upload) + nome + profissão
- [ ] Re-render em tempo real (<100ms)

### 🌊 Onda 5 — Texturas (camada visual)

**Critério de saída:** aplicar PNG de material sobre SVG da base, ver mockup no canvas.

- [ ] Aba Mockups do Banco de Ativos (CRUD básico)
- [ ] **Re-implementar `applyMaterialToSvg`** com clone strategy
- [ ] Picker de textura no toolbar do canvas
- [ ] Cache de PNGs como `MATERIAL_PNG_CACHE` (equivalente ao do v1)
- [ ] Trocar cor do material quando o material tem variações

### 🌊 Onda 6 — Sistema de camadas

**Critério de saída:** painel de camadas estilo Photoshop, com kind tipado, drag-reorder, lock, visibility.

- [ ] `core/canvas/layer-manager.ts`
- [ ] Painel lateral de camadas (componente `<LayersPanel />`)
- [ ] Kind tipado: `visual` | `production`
- [ ] Operação + máquinas tagging (chips coloridos)
- [ ] Validação: camada `production` exige operation + ≥1 machine
- [ ] Atalhos: Ctrl+U (ungroup), Ctrl+K (cycle operation)

### 🌊 Onda 7 — Alinhamento estilo Confluence

**Critério de saída:** snap inteligente + guias arrastáveis + indicação de distâncias.

- [ ] Linhas-guia tracejadas durante drag (smart guides)
- [ ] Snap a centros, bordas, e equidistância (3+ objetos)
- [ ] Réguas em mm
- [ ] Guias arrastáveis a partir das réguas
- [ ] Comandos de alinhamento: align-left/center/right, top/middle/bottom, distribute
- [ ] Indicação de distância em mm ao selecionar 2+ objetos

### 🌊 Onda 8 — Salvamento + Pedidos

**Critério de saída:** as 3 intenções de salvamento do CLAUDE.md funcionam corretamente.

- [ ] "Salvar pedido": cria/atualiza `orders` SEM tocar `patterns`
- [ ] "Salvar como novo padrão": cria `patterns` novo
- [ ] "Atualizar padrão mestre": só em modo edição, com confirmação dupla
- [ ] Sistema de overrides: ajustes finos do pedido vão pra `order_overrides`, padrão mestre fica intacto
- [ ] Reabrir pedido: aplica overrides sobre o padrão base e renderiza no canvas

### 🌊 Onda 9 — Exportação (PNG + SVGs por máquina)

**Critério de saída:** RF-3.9 completo. Output equivalente ao v1 pros 7 cenários validados.

- [ ] `core/export/png-exporter.ts`: render do canvas em 300 DPI com texturas
- [ ] **Re-implementar `buildProductionSVG`** em TS modular
- [ ] `core/export/route-by-machine.ts`: agrupar camadas por máquina
- [ ] Naming `{labelPedido}_{Maquina}.svg`
- [ ] Pasta padrão `{appData}/Capi Studio/exports/{ano}/{mes}/`
- [ ] Histórico de exports na tabela `export_history`

### 🌊 Onda 10 — Telas restantes

- [ ] Grid de Padrões (RF-4)
- [ ] Histórico de Artes (RF-5)
- [ ] Banco de Ativos com 6 abas (RF-6)
- [ ] Banco de Logos auto-alimentado: toda logo usada em pedido vai pra `logos`

### 🌊 Onda 11 — Atalhos + Undo/Redo

- [ ] Todos os atalhos de RF-3.7
- [ ] Undo/redo com 50 níveis (extensão do `historySnapshot` do v1)

### 🌊 Onda 12 — Polimento + Build

- [ ] Aplicar `frontend-design` em todas as telas (revisão estética final)
- [ ] Acessibilidade básica (foco, ARIA labels)
- [ ] Tela de erro/404
- [ ] Logging de erros pra arquivo
- [ ] Build do MSI installer
- [ ] Smoke test no Windows: instalar, abrir, rodar os 17 passos do RF-12 (critério de aceitação)

### 🌊 Onda 13 — Validação contra v1

**Esta é a onda de QA.** Pra cada um dos 7 cenários validados de broche 60×25 do v1:

- [ ] Replicar no v2 (mesmo padrão, mesmos dados)
- [ ] Comparar PNG mockup gerado (diff visual com tolerância)
- [ ] Comparar SVGs de produção (diff estrutural — mesmas camadas, operações, máquinas)
- [ ] Documentar diferenças em `docs/V1_PARITY.md`
- [ ] Resolver discrepâncias críticas

---

## REGRAS DE COMPORTAMENTO PRA VOCÊ (Claude Code)

(estendendo o "Processo de Trabalho no Claude Code" do CLAUDE.md original)

### Antes de implementar qualquer coisa:

1. Leia os arquivos relevantes (CLAUDE.md, requisitos, v1 quando aplicável)
2. Proponha um plano curto neste formato:
   ```
   Plano:
   - [passos específicos]
   Arquivos afetados:
   - [lista]
   Risco:
   - [se houver]
   Teste:
   - [como validar]
   ```
3. **Aguarde aprovação** antes de começar mudanças grandes (>3 arquivos ou >100 linhas).

### Ao implementar:

- Em partes pequenas. Cada commit lógico = 1 unidade testável.
- Sempre rodar lint + typecheck antes de declarar pronto.
- Testes unitários obrigatórios pra `core/` (target: 80%+ cobertura).
- Componentes UI sem regra de negócio. Toda regra fica em `core/` ou repositories.

### Ao concluir:

```
Resumo: o que foi feito
Arquivos alterados: lista
Como testar: passos
Riscos: se houver
Próximo passo recomendado: ...
```

### Proibições absolutas:

- ❌ Não usar `alert()` ou `prompt()` nativos. Usar shadcn (`AlertDialog`, `Sonner`).
- ❌ Não hardcodar dimensões de produto (60/25). Usar viewBox dinâmico.
- ❌ Não importar Inter, Roboto, ou fontes "system" como fonte primária da UI (skill `frontend-design`).
- ❌ Não criar componentes monolíticos > 300 linhas. Quebrar.
- ❌ Não duplicar lógica que já existe em `core/`.
- ❌ Não editar `patterns.canvasJson` no fluxo de salvar pedido — só em "Atualizar padrão mestre".
- ❌ Não fazer feature nova antes do fluxo principal (Onda atual) estar sólido.
- ❌ Não fazer refatoração gigante sem plano aprovado.

### Ao encontrar ambiguidade:

- Pergunte. Não invente.
- Se a ambiguidade for sobre regra de negócio, **consulte o v1 antes** (provavelmente está respondida lá).

---

## DESIGN SYSTEM (skill `frontend-design` aplicado)

### Direção estética obrigatória

**Tom:** ferramenta industrial-utilitária, mas refinada. Pense em "DAW profissional" (Ableton, Logic) cruzado com "ferramenta de gravação" (Lightburn, RDWorks) — não em "app de design" (Figma, Canva). É um sistema de produção, não de exploração criativa.

**O que isso significa:**

- Densidade de informação alta, mas legível.
- Cores funcionais (operações têm cores semânticas — vermelho = gravação, azul = corte-laser, etc.). Estética emerge da função.
- Tipografia técnica e precisa.
- Micro-interações **sutis e funcionais** (hover states, focus rings nítidos, feedback de ação). Sem celebrações exageradas.
- **Sem** purple-gradients-on-white. **Sem** glassmorphism. **Sem** ilustrações fofas.

### Tokens (Tailwind theme — `tailwind.config.ts`)

```ts
// Paleta extraída do v1, refinada pra v2
const colors = {
  // Background / surface
  ink: {
    950: '#0e0f10', // canvas backdrop
    900: '#16181a',
    800: '#1f2123', // panels
    700: '#2a2c2e',
    600: '#3a3d40',
    500: '#5a5d61',
    400: '#8a8e92',
    300: '#b4b8bc',
    200: '#d4d7da',
    100: '#ebeef0',
    50: '#f6f7f8',
  },
  // Acento principal — laser red (gravação)
  laser: {
    DEFAULT: '#dc2626',
    hover: '#b91c1c',
    muted: '#fca5a5',
  },
  // Operação cores (semânticas — usar nos chips de máquina/op)
  op: {
    contorno: '#000000',
    corte: '#000000',
    'corte-laser': '#2563eb',
    gravacao: '#dc2626',
    marcacao: '#2563eb',
    aplique: '#7c3aed',
    'gravacao-aplique': '#d97706',
  },
  // Estado / feedback
  ok: '#15803d',
  warn: '#d4aa3a',
  danger: '#dc2626',
};
```

### Tipografia (NÃO use Inter)

```ts
// Display + UI: JetBrains Mono ou IBM Plex Mono (ferramentas técnicas)
// Body: Geist (técnica mas humana) ou Söhne se disponível
// Numérica/dimensional (mm): JetBrains Mono com tabular-nums
fontFamily: {
  display: ['"JetBrains Mono"', 'monospace'],
  body: ['"Geist"', 'system-ui', 'sans-serif'],
  mono: ['"JetBrains Mono"', 'monospace'],
}
```

Se não conseguir embutir essas fontes no Tauri, use **Geist** (open-source, da Vercel) como fallback unificado — é distintivo o suficiente.

### Densidade

- Toolbar do canvas: 40px de altura, ícones 20px.
- Painéis laterais: 280px de largura padrão, redimensionáveis.
- Inputs numéricos: tabular-nums, monoespaçados, com unidades inline (`8.0 mm`).

### Detalhes de excelência (do skill `frontend-design`)

- Focus rings de 2px, cor `laser-muted`, offset 2px.
- Sombras restritas: `shadow-sm` em cards, `shadow-md` em popovers, `shadow-xl` em dialogs. Nada exagerado.
- Bordas nítidas (1px sólido, `ink-700` no dark, `ink-200` no light).
- Tema dark por padrão (ferramenta industrial). Tema light disponível.
- Animações: 150ms ease-out pra hover, 200ms pra transições maiores. **Não** usar bounce/spring exceto em micro-interações conscientes.

---

## INTEGRAÇÃO DO FLUXOGRAMA NO PRODUTO

O fluxograma anexado (`Untitled_whiteboard_2026-05-04.png`) é a **espinha dorsal do produto**. Os 3 caminhos centrais são:

1. **Arte Rápida** (uso diário): produto → material → cor → padrão → preencher → exportar
2. **Canvas** (centro): edição em tempo real, camadas, alinhamento, ajustes finos
3. **Criar Padrões/Produtos** (alimentação): bancos (logos, fontes, padrões, apliques, texturas) + criação

Toda decisão de UX deve respeitar o fluxograma. Quando estiver em dúvida sobre uma navegação, volte ao fluxograma.

---

## CRITÉRIO DE PRIMEIRO COMMIT

Você está autorizado a fazer o **primeiro commit** assim que:

1. Tiver lido CLAUDE.md, REQUIREMENTS, DATABASE
2. Tiver visto o fluxograma
3. Tiver feito a Onda 0 (bootstrap) completa
4. `npm run tauri dev` abrir janela com "Capi Studio v2" renderizado em tema dark

Mensagem do primeiro commit (sugestão):

```
Onda 0: bootstrap Tauri + React + TS + Tailwind + shadcn

- Stack instalada e configurada
- Estrutura de pastas conforme docs/ARCHITECTURE.md
- Theme dark por padrão, paleta industrial
- Skill frontend-design aplicada (Geist + JetBrains Mono)

Refs: CLAUDE.md, REQUIREMENTS.md
```

---

## COMECE AQUI

Sua primeira mensagem deve ser:

1. Confirmar que leu CLAUDE.md, REQUIREMENTS, DATABASE e viu o fluxograma.
2. Listar **3 ou mais perguntas críticas** que você tem antes de começar (se houver).
3. Propor o **plano da Onda 0** no formato `Plano / Arquivos / Risco / Teste`.

**Não comece a codar antes que eu aprove a Onda 0.**

Boa sorte. Faça um software que eu vou orgulho de mostrar.
