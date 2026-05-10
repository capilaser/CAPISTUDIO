# AI-CONTEXT.md

> **Como usar:** anexe este arquivo no início de cada chat novo com Claude (chat web/app desktop). Ele dá ao assistente o contexto completo do projeto em ~2 minutos de leitura, sem você precisar reexplicar.

---

## 🎯 Sobre o projeto

**Nome:** Capi Studio v2
**O que é:** App desktop (Windows) para criação de artes de gravação e corte a laser, voltado para produtos personalizados (broches, placas, etc.)
**Stack:** Tauri 2.0 + React 18 + TypeScript + Vite + Fabric.js 6 + shadcn/ui + Tailwind + SQLite (via tauri-plugin-sql) + Drizzle ORM
**Plataforma:** Windows 10/11 x64
**Custo recorrente:** R$ 0

**Localização do projeto:** `C:\Users\Gabriell\Desktop\Capi Studio 0.2\capi-studio-v2\`

---

## 👤 Sobre o usuário (Gabriell)

- **Não programa.** Aprendeu a usar terminal nesta jornada. Dono da empresa, está contratando consultoria de IA.
- **Dono de empresa de corte/gravação a laser** em Curitiba/PR. Esposa é CEO. Eventualmente vai contratar alguém pra operar.
- **Mercado já validado.** A operação que o Capi Studio v2 vai automatizar é exatamente a que ele já executa todos os dias no Corel há anos. **Não é hipótese de produto** — é substituição de fluxo manual por software dedicado.
- **Decisões maduras:** trava escopo MVP enxuto, foca no essencial, descarta features que viram patos chocos.
- **Trabalha com pausas saudáveis:** sessões de horas com paradas pra dormir, comer, trabalhar outras coisas.
- **Personalidade:** detalhista, paciente com método, valida com prints, não confia cegamente. Aceita feedback firme quando técnico.

---

## 🎯 ESTRATÉGIA TRAVADA (decisão pós-Onda 8)

> **Construir o produto inteiro de forma sólida, antes de testar com clientes.**

A operação que o produto automatiza já é **validada na prática diária do Gabriell**. Não há "MVP pra validar mercado" — há produto completo pra substituir o Corel.

**Implicações:**

- ❌ Não vender em fatias intermediárias
- ❌ Não pular ondas pra "ir mais rápido"
- ✅ Cada onda entrega funcionalidade sólida, sem retrabalho
- ✅ Quando o produto fechar, ele substitui o fluxo do Corel inteiro
- ✅ Pós-MVP: ajustes pontuais e atualizações projetadas, não reescrita

**Critério de pronto:** Gabriell consegue fechar um pedido (criar padrão → preencher → exportar PNG + SVG corte) **sem abrir o Corel**.

---

## 🤝 MÉTODO DE CONSULTORIA (CRÍTICO — sempre seguir)

> **Este é o contrato de trabalho entre Gabriell (dono) e Claude (chat consultor). Toda nova sessão deve respeitar isto.**

### Papel do Claude (chat) — consultor estratégico

- **Eu (Claude chat) sou consultor**, não executor de código.
- **Claude Code (no VS Code) é executor.** Eu reviso planos dele, traduzo decisões de produto em texto firme, valido prints visuais.
- Decisões técnicas eu resolvo **com Claude Code** consultando-o, não com Gabriell.
- Decisões de uso/dor/objetivo eu pergunto **a Gabriell**, porque só ele pode responder.

### Como Gabriell quer ser tratado

> **REGRA DE OURO:** Gabriell é o dono que está contratando consultoria. Não é programador. Não pergunta a ele coisas técnicas que Claude Code consegue investigar. Pergunta a ele sobre **dor, objetivo, uso real, fluxo do dia a dia, validação visual**.

| O que perguntar a Gabriell                | O que NÃO perguntar                 |
| ----------------------------------------- | ----------------------------------- |
| Como você usa isso no dia a dia?          | DOMParser ou regex?                 |
| Quem mais vai operar isso?                | Onde colocar este arquivo?          |
| Quando der erro, quem resolve?            | Estender função X ou criar nova?    |
| Validação visual: print do canvas         | Estratégia de testes?               |
| Tolerância: bloqueia ou aceita meia-boca? | Discriminated union ou flat type?   |
| Quanto X mm faz diferença na produção?    | Como organizar o describe do teste? |

**Quando tiver dúvida técnica:** consulte Claude Code (pede pra ele ler código, propor abordagem, investigar). NÃO transfira a dúvida pra Gabriell.

### Estrutura padrão de uma onda

1. **Calibração:** Claude (chat) faz perguntas de produto/uso a Gabriell
2. **Geração:** Claude (chat) escreve texto firme pro Claude Code com decisões traduzidas
3. **Plano:** Claude Code propõe plano (Plano / Arquivos / Risco / Teste)
4. **Revisão:** Claude (chat) revisa o plano antes de Gabriell aprovar
5. **Execução:** Claude Code executa em fases
6. **Checkpoint mínimo:** Gabriell valida apenas onde sua validação é insubstituível (visual, mensagens humanas, decisões de produto)
7. **Confirmação:** Claude (chat) valida output e confirma fechamento

### Princípios de comunicação com Gabriell

- **Português brasileiro**, tom direto e franco
- **Analogias do mundo real DO PROGRAMA** (não cadeira de IKEA, não fora do contexto). Ex: "imagina que o Capi recebe um SVG do Corel..."
- **Listas e tabelas > parágrafos longos**
- **Push back firme** quando discordar tecnicamente, com justificativa
- **Sem bajulação** — feedback honesto vale mais
- **Checkpoints minimalistas** — só onde Gabriell precisa validar de verdade

### Regra obrigatória do Claude Code (criada na Onda 8)

Ao final de CADA fase, Claude Code DEVE incluir bloco:

```
═══════════════════════════════════════════════════════════════
ESTADO DE CONTEXTO (pro consultor estratégico)
═══════════════════════════════════════════════════════════════

Contexto restante: ~XX%
Última operação custosa: [...]
Próxima fase prevista: [...]
Recomendação: [Pode seguir / Sugiro compactar / Sugiro reiniciar]
Justificativa: [...]
═══════════════════════════════════════════════════════════════
```

### Lições aprendidas (de sessões anteriores)

- ⚠️ Claude Code tende a pular checkpoints — usar linguagem firme: _"PARE EXECUÇÃO. Quebra de contrato."_
- ⚠️ Claude Code tende a atacar sintoma, não causa raiz — pedir diagnóstico antes de fix
- ⚠️ Claude Code às vezes **inventa justificativa** pra evitar investigar problema real ("removi os logs pelo critério X" quando os logs eram outros). Pressionar com evidência cronológica.
- ⚠️ "Auto mode" do Claude Code pula perguntas críticas — forçar respostas explícitas no kickoff
- ⚠️ Claude Code esquece o bloco "ESTADO DE CONTEXTO" se não for lembrado — exigir até virar hábito
- ✅ Validação visual com prints > confiar em descrição textual
- ✅ Validação extra via SQL direto no banco (não confiar só no F5 test) quando persistência for crítica
- ✅ Cada decisão arquitetural vai pra ADR em `docs/DECISIONS/`
- ✅ **Logs no DevTools > leitura de código** quando Claude Code afirma "tudo OK" mas runtime contradiz
- ✅ **Teste verde ≠ código no caminho de execução** — validar via runtime que função modificada está sendo chamada
- ✅ **Causa raiz > sintoma**, sempre, sem exceção
- ✅ **Validação manual com print do Gabriell substitui infra de teste de banco real** (decidido na Onda 8 — viável com dono de operação validada)

---

## 🤖 Modelos do Claude Code por onda

| Onde                               | Função                                                                 | Modelo recomendado          |
| ---------------------------------- | ---------------------------------------------------------------------- | --------------------------- |
| **App desktop Claude (consultor)** | Estratégia, validação visual, revisão de planos, escrita de instruções | **Opus 4.7**                |
| **Claude Code (no VS Code)**       | Execução: criar arquivos, rodar código, debug                          | Varia por onda (ver tabela) |

**Modelos do Claude Code por onda:**

- Onda 0 ✅ → Sonnet 4.6
- Onda 1 ✅ → Opus 4.7 (banco SQLite)
- Onda 2 ✅ → Sonnet 4.6 + médio
- Onda 3 ✅ → Opus 4.7 + alto (Canvas Fabric.js)
- Onda 4 ✅ → Sonnet 4.6 + médio (slots + fitText)
- Onda 4.5 ✅ → Sonnet 4.6 (download/seed simples)
- Onda 5 ✅ → Sonnet 4.6
- Onda 6a ✅ → Sonnet 4.6 (schema)
- Onda 6b ✅ → Opus 4.7 alto (parser + LayerMeta + bug Fabric)
- Onda 6.5 ✅ → Sonnet 4.6 (UI Apliques completa)
- Onda 8 ✅ → Sonnet 4.6 (padrões salvos + reabertura)
- Mini-9.5 ✅ → Sonnet 4.6 (cadastrar materiais — fechada commit 94de574)
- Onda 7a ✅ → Opus 4.7 + alto (motor de snap + integração Fabric)
- **Onda 7b Fases C+D ✅ → Opus 4.7 1M** (guias visuais, toolbar de alinhamento)
- **Onda 7b Fase E → Opus 4.7 + alto** (modo medição)
- **Onda 8.5 → Sonnet 4.6** (gravações sobre apliques)
- **Onda 9 → Opus 4.7 + alto** (exportação SVG por máquina/operação)
- Ondas 10-12 → Sonnet 4.6 ou Haiku
- Onda 13 → Opus 4.7

---

## 🏗️ Estrutura de ondas (ROADMAP)

| Onda    | Tema                                                                      | Status                                       |
| ------- | ------------------------------------------------------------------------- | -------------------------------------------- |
| 0       | Bootstrap (Tauri + Vite + React + TS)                                     | ✅ Fechada                                   |
| 1       | Banco SQLite + Seeds (24 tabelas pós-6a)                                  | ✅ Fechada                                   |
| 2       | Home + Layout Base                                                        | ✅ Fechada                                   |
| 3       | Canvas Fabric.js                                                          | ✅ Fechada                                   |
| 4       | Slots editáveis + fitText                                                 | ✅ Fechada                                   |
| 4.5     | Banco de Fontes Curado (5 fontes)                                         | ✅ Fechada                                   |
| 5       | Texturas (PNGs ABS Escovado)                                              | ✅ Fechada                                   |
| 6a      | Schema de hierarquia (3 bancos novos)                                     | ✅ Fechada                                   |
| 6b      | Parser Corel + Cleanup + LayerMeta hierárquico                            | ✅ Fechada                                   |
| 6c      | ❌ **REMOVIDA** — funcionalidade absorvida pela Onda 7                    | ❌ Removida                                  |
| 6.5     | UI Apliques completa                                                      | ✅ Fechada                                   |
| **8**   | **Padrões salvos + reabertura (Placa Advogado)**                          | **✅ Fechada (commit 17a23ae)**              |
| **9.5** | **Mini-onda — Cadastrar 5 materiais novos (Acrílico Espelhado + Sólido)** | **✅ Fechada (commit 94de574)**              |
| **7a**  | **Snap (Fases A+B) — motor matemático + integração Fabric**               | **✅ Fechada (commit 8cb037f)**              |
| **7b**  | **Snap Fase C — guias visuais cyan + fix Alt+Tab**                        | **✅ Fechada (commit 0ccd989)**              |
| **7b**  | **Snap Fase D — toolbar de alinhamento (6 botões)**                       | **✅ Fechada (06d7442 + 9713f3b + db84315)** |
| **7b**  | **Snap Fase E — modo medição (V+H entre objs)**                           | **✅ Fechada (commit ad65cfe)**              |
| **7b**  | **Snap Fase E2 — proximidade do entorno (1 obj selecionado)**             | **✅ Fechada (commit 4e8f072)**              |
| **7b**  | **Snap Fase F — pontinhos da grade (toggle)**                             | **✅ Fechada (commit 0557cc3)**              |
| **7b**  | **Snap Fase G — costura final + ADR 015 + DEBT.md**                       | **✅ Fechada (cleanup aeae83a)**             |
| 7       | Painel de Camadas hierárquico (ex-7b original, renomeado)                 | ⏳                                           |
| 8.5     | Gravações sobre apliques (balança + texto profissão)                      | ⏳                                           |
| 9       | Exportação SVG por máquina/operação + PNG mockup                          | ⏳                                           |
| 10      | Telas restantes (Grid Padrões, Histórico, Banco Ativos)                   | ⏳                                           |
| 11      | Atalhos globais + Undo/Redo (50 níveis)                                   | ⏳                                           |
| 12      | Polimento final + build MSI Windows                                       | ⏳                                           |
| 13      | Validação final + smoke test do MVP completo                              | ⏳                                           |

**Sequência travada (ordem de execução):**

1. Mini-9.5 (materiais)
2. Onda 7 (painel hierárquico + alinhamento)
3. Onda 8.5 (gravações)
4. Onda 9 (exportação)
5. Ondas 10-13 (telas, atalhos, polimento, validação)

**Justificativa da ordem:**

- Mini-9.5 primeiro: trabalho pequeno, destrava material correto pras placas
- Onda 7 antes de criar mais padrões: evita refazer padrões com UX ruim
- Onda 8.5 antes da 9: evita refazer pipeline de export quando gravações entrarem
- Onda 10 antes de 11/12: telas são produto, atalhos/polimento são lapidação

---

## ⚙️ Decisões arquiteturais críticas (NÃO revisitar)

### Negócio

- **MVP super enxuto:** apenas Editor + Banco de templates + Banco de artes geradas. Sem CRM, sem dashboard, sem Make/Trello/WhatsApp. Tudo isso vai pra Fase 2.
- **Sem login no MVP:** single-user local. Login fica pra Fase 2 (multi-usuário).
- **Caminho A — Rewrite total**, não migração incremental. v1 vira "spec executável das regras de negócio".
- **Estratégia "produto completo antes de testar"** — operação já validada na prática, não vender em fatias.

### Arquitetura

- **Camadas tipadas:** cada camada do SVG tem `kind: "principal" | "operation" | "visual"` (discriminated union, ADR 010).
- **Banco de logos auto-alimentado:** toda logo usada vira asset salvo automaticamente.
- **Materiais = PNGs reais**, não gradientes SVG. Famílias confirmadas:
  - **ABS Escovado** (Bronze, Dourado, Prata, Rose Gold) — uso em **broches e outros produtos**
  - **Acrílico Espelhado** (Dourado, Prata, Rose Gold) — uso em **placas profissão**
  - **Acrílico Sólido** (Branco, Preto) — uso em **placas profissão**
- **Sem fonte padrão por slot.** Fonte é escolhida no momento de criar o slot.
- **Production modules deferidos** pro backlog (ADR 003).

### Canvas (Onda 3)

- **Fabric.js 6** como engine. Unidades em **mm** com DPI = **4 px/mm** constante.
- **viewBox do produto (banco) é fonte autoritativa de coordenadas.** Nunca confiar em `group.width` do Fabric pós-parse.
- SVGs externos passam por `parseAndStripRootDimensions` (DOMParser, só na raiz) antes de `loadSVGFromString`.
- Custom properties Capi serializadas via lista explícita em `CAPI_CUSTOM_PROPS` (`['id', 'capiSlot']`) no `toJSON([...])`.
- Cleanup obrigatório com `engine.dispose()` no useEffect do React.
- Pan mode com `selection = false` + `selectable = false` em user objects (não na base).
- Round-trip canvas ↔ `patterns.canvasJson` via Drizzle, com upsert idempotente.

### Fontes (Onda 4.5)

- 5 famílias curadas embutidas em `src-tauri/resources/fonts/` (variable fonts + Bebas Neue estática)
- Variable fonts cobrem regular + bold no mesmo arquivo (peso `100 900`)
- Carregamento via `new FontFace(...).load() + document.fonts.add()` — **NÃO `@font-face` passivo**
- Asset protocol Tauri 2.x: `enable: true + scope: ["**"]` no `security` do `tauri.conf.json`
- ⚠️ Cargo não detecta mudanças em `resources/` — executar `cargo clean` ao adicionar PNGs/fonts novas

### Slots e fitText (Onda 4)

- Cada slot = body Rect (persistente, arrastável) + overlay Rect (descartável, só Designer)
- `fitText` reduz fonte sem quebrar linha; min 6pt, max 24pt, passo 0.5pt; função pura com `measureFn` injetada
- Placeholder de logo vazio = `fabric.Group` gerenciado pelo `SlotManager`, não componente React
- Conteúdo dos slots = `fabric.Text` (read-only), nunca `fabric.IText`
- ⚠️ **Cache do Fabric 6:** usar `.set({ prop: value })`, nunca atribuição direta

### Onda 6b (parser Corel + cleanup + LayerMeta)

- **Parser Corel SVG** puro em `src/core/canvas/corel-svg-parser.ts`. Valida: dimensões em mm, aspect ratio uniforme, sem `<text>`/`<image>`/`<use>` (rejeita com mensagens humanas em PT). Postura: rigor + clareza + sem mágica.
- **cleanCorelSvg** descarta `<style>`, `<font>`, `<metadata>`, fills, strokes, classes CSS. Promove `fill-rule`/`clip-rule` de inline style pra atributo SVG próprio (ADR 010 §3 cumprido).
- **fill nos shape elements:** SVG raw recebe `fill="none"` (SVG entende). No Fabric, `obj.set({ fill: '' })` — Fabric 6 passa "none" literal pro canvas DOM, que renderiza preto. String vazia evita o bug. Documentado em ADR 011.
- **LayerMeta como discriminated union** com 3 variantes (Principal/Operation/Visual) + 7 invariantes validadas em runtime. TypeScript barra combinações inválidas em compile-time.
- **schemaVersion: 2** no canvasJson. Migration trivial (banco vazio).
- **Lição crítica da Onda 6b:** testes verdes não provam que código novo está no caminho de execução. Sempre validar via DevTools que função modificada está sendo chamada no runtime real. Bug pode estar em "qual porta o runtime usa", não em "como a porta funciona". Adicionar testes de integração que exercitem o MESMO caminho do runtime — não só o caminho ideal.

### Onda 7b Fases C+D (guias visuais + toolbar de alinhamento)

- **Linhas-guia visuais cyan** (`#00d4ff`, 1px tracejado [8,4], `strokeUniform`) renderizadas em `fabric.Line` dentro do canvas (vivem no espaço de coordenadas do produto, com `excludeFromExport: true`). Render-on-change: só redesenha quando snap muda; remove instantâneo quando guia some no meio do drag; fade-out 200ms só no `mouse:up`. Cancelamento explícito de `fabric.util.animate` quando novo drag começa antes do fade terminar.
- **`guides-diff.ts` (função pura)**: decide por eixo entre `create | update | remove | noop`. Lógica testável em Node sem Fabric. Padrão repetido da Fase A — separar matemática pura de efeitos.
- **Fix Alt+Tab**: `useAltKey` registra listener de `blur` na window. Windows intercepta `keyup` do Alt em Alt+Tab e o snap ficaria desligado pra sempre sem esse reset. Comentário no código preserva o "porquê" (alguém pode achar redundante e remover).
- **Toolbar de alinhamento** = segunda linha condicional, aparece quando há ≥1 objeto selecionado. 6 botões: alinhar L/CenterH/R/Top/CenterV/Bottom (ícones `lucide-react`). Slide-down 150ms ao abrir, saída instantânea. State local `hasSelection` via `selection:created/updated/cleared` direto no canvas — sem store global (toolbar é UI, não domínio).
- **`alignment-commands.ts` (função pura)**: 6 funções + dispatcher. 1 obj usa `referenceBounds` (caller decide); 2+ objs ignora ref e calcula min/max/média entre os próprios rects (Figma-style). 16 testes, cobertura 100%.
- **Multi-seleção em ActiveSelection**: usa padrão **desagrupar/reagrupar** (`discardActiveObject` → `set` absoluto em cada filho top-level → `new ActiveSelection(filhos, { canvas })`). Robusto a transformações futuras (rotação, escala) — matemática manual de matriz quebra com transforms.
- **`getCapiId(obj)` (função pura, Fix #1)**: helper canônico para resolver id capi. Caminho 1: `obj.id` (rect, aplique). Caminho 2: `obj.capiSlot.id` (slot — slot-manager nunca seta `body.id`). Sem essa abstração, slots silently faziam fallback pra canvas em alignment.
- **`createSlot(type, parentLayerId?)` aceita pai opcional (Fix #2)**: `SlotCreatorButtons.resolveParentAppliqueId(engine)` percorre seleção e retorna primeiro objeto com `kind === 'principal'`. Critério unificado, sem heurística geométrica. Resolve ADR 014 §6 no caminho de criação (slot dentro de aplique nasce com `parentLayerId = aplique.id`).
- **Lição reforçada da Onda 6b**: testes da função pura passaram (com `parentBounds = aplique`), mas runtime falhou porque o **caller** montava `referenceBounds` errado (mismatch obj.id vs capiSlot.id). Diagnóstico: leitura cuidadosa do código eliminou as 4 hipóteses sem precisar de runtime do Gabriell. Testes verdes ≠ caminho de execução real.
- **Dívidas técnicas conhecidas (registrar no ADR 015 da Fase G):**
  1. 6 fluxos de regressão da Fase B não testados explicitamente
  2. Bug Alt+Tab com **mouse pressionado** trava drag (mouseup interceptado pelo Windows). Diferente do bug do Alt resolvido — esse continua aberto como follow-up.
  3. `entry.content` (texto fitText, logo) dentro do slot não segue o body em drag/scale/alignment (bug pré-existente do slot-manager, não introduzido pela Onda 7b).
  4. Caller do alignment (`AlignmentToolbar`) não tem teste de integração (exigiria mock pesado de Fabric — over-engineering aceito).
  5. `coverage/` foi commitado acidentalmente na Onda 7a (`8cb037f`); migrar pra `.gitignore` em commit separado quando conveniente.

### Onda 8 (padrões salvos + reabertura)

- **insertPattern()** cria registro novo com `crypto.randomUUID()` — separado de `upsertPatternCanvas()` (que sempre escreve em ID fixo do dev).
- **listByProduct(productId)** filtra por produto — padrões antigos do broche não aparecem na lista de placas.
- **SaveAsPatternDialog + LoadPatternDialog** = shadcn Dialog, NUNCA `prompt()` ou `alert()` nativos.
- **base_svg da placa-300x90** vem de fixture (`tests/fixtures/camadas-base/placa-base.svg`) via seed (ADR 013). Limitação documentada: editar fixture exige `del banco + reseed`.
- **Round-trip de padrão validado**: 7 testes de integração (mock do banco) + validação manual do Gabriell com 6 prints.
- **Validação manual com print do Gabriell** substitui infra de teste de banco real — viável porque a operação já é validada na prática diária.

### Visual

- **Estética industrial-utilitária** estilo Lightburn/Ableton. NÃO Canva/Figma.
- **Dark theme único.** Paleta `ink-950..ink-50` + `laser` (vermelho #dc2626).
- **Fontes:** Geist (body) + JetBrains Mono (display/code). PROIBIDO Inter, Roboto, system-ui.
- **Cores semânticas por operação:** gravação=vermelho, corte-laser=azul, aplique=roxo.

### Home (Onda 2)

- **4 cards apenas:** Novo Padrão, Abrir Padrão, Histórico de Artes, Banco de Ativos.
- **Cards mostram toast** "Em desenvolvimento — chega na Onda X" ao clicar.
- **Dev link discreto** pra `/dev/db-check` e `/dev/canvas-test` no rodapé, só em DEV.

---

## 📚 ADRs criados

- `001-fabric-vulnerabilities.md` — Aceita 6 vulnerabilidades transitivas em fabric@6 (não-exploráveis em desktop local)
- `002-no-pattern-migration.md` — Padrões do v1 vazios, sem migração
- `003-production-modules-deferred.md` — Conceito ainda imaturo, fica pra futuro
- `004-product-layers-svg-nullable.md` — Coluna nullable até product_layers ser populado de fato
- `005-canvas-engine-fabric-mm.md` — Canvas em mm com DPI=4, viewBox autoritativo do banco
- `006-onda-4-slots-fittext.md` — Slots editáveis, fitText, body/overlay, placeholder, bug cache Fabric 6
- `007-onda-4.5-banco-fontes.md` — 5 fontes curadas, FontFace API ativa, asset protocol Tauri 2.x OPT-IN, cargo clean obrigatório ao adicionar resources
- `008-camadas-hierarquicas-bancos-componentes.md` — Camadas em 2 níveis (principal → operação) + 3 bancos novos (apliques/gravações/marcações)
- `009-exportacao-maquina-operacao.md` — Spec completa da Onda 9: 1 SVG por (máquina, operação). Regra "marcação herda contorno". Feature "tirar miolo".
- `010-camadas-hierarquicas.md` — Estrutura hierárquica de camadas + bancos de componentes
- `011-fabric6-fill-empty-string.md` — Fabric 6 passa "none" literal pro canvas DOM, que renderiza preto. Workaround: `fill: ''` no obj.set.
- `013-base-svg-seed-onda8.md` — base_svg vem de fixture via seed (INSERT OR IGNORE + UPDATE WHERE NULL). Limitação: editar fixture exige reseed manual.
- `014-snap-system.md` — Sistema de snap completo (Onda 7a Fases A+B): motor puro, integração Fabric, race condition resolvida, decisões de tolerância/Alt/grade.
- `015-onda-7b-decisoes-visuais.md` — Decisões visuais da Onda 7b inteira: hierarquia de cores entre 4 sistemas (snap/medição/proximidade/grade), render híbrido Fabric+DOM, render-on-change para guias, fade-out cancelável, getCapiId canônico, Pattern para grade.

---

## 🧾 Dívidas técnicas

Ver `docs/DEBT.md` — lista durável de dívidas conhecidas com origem, severidade e indicação de quando resolver. Atualizada na costura de cada onda.

---

## 🗂️ Documentos de planejamento

Localização: `capi-studio-v2/projeto/` (anexar quando relevante ao chat)

- `00-README.md` — índice e instruções
- `01-DATABASE.md` — schema SQLite com Drizzle (24 tabelas após Onda 6a)
- `02-REQUIREMENTS.md` — requisitos funcionais MVP
- `03-CLAUDE-CODE-KICKOFF.md` — prompt de kickoff principal, ondas atualizadas
- `04-STITCH-PROMPT.md` — prompt em inglês pra Google Stitch
- `05-BACKLOG.md` — Fase 2/3 documentadas
- `06-VISION.md` — norte estratégico do produto

---

## 🪟 Boas práticas de janela de contexto

### Princípios

1. **1 chat ≠ projeto inteiro.** Quebra por escopo — geralmente 1 chat por onda.
2. **Anexa docs ao recomeçar.** Não me peça pra "lembrar".
3. **Documenta fora do chat.** ADRs e docs no projeto.
4. **Corta cedo, não tarde.** Quando sentir que estou amolecendo.
5. **Não desperdice tokens** com agradecimentos longos. Seja direto.

### Sinais de alerta na conversa

🟡 **Atenção:**

- Conversa passou de 50 mensagens longas
- Mais de 5 documentos anexados
- Mais de 10 prints

🔴 **Hora de cortar:**

- Eu confundo decisões antigas
- Eu repito orientações já dadas
- Minhas respostas ficam mais curtas/genéricas
- Você sente que "amoleci"

### Quando começar chat novo

Modelo de mensagem inicial:

```
Olá! Continuando trabalho no Capi Studio v2.

[ANEXA: AI-CONTEXT.md + docs relevantes da onda atual]

ESTADO ATUAL:
- Última onda concluída: Onda X
- Próxima onda: Onda Y

Quero começar a Onda Y. Qual a primeira pergunta que você
precisa me fazer pra calibrar o texto pro Claude Code?
```

---

## 🤖 Comando de auditoria automática

Em qualquer momento, cole no chat:

```
/auditoria-contexto
```

E eu vou rodar este checklist e te responder objetivamente:

| #   | Verificação                                             |
| --- | ------------------------------------------------------- |
| 1   | Tamanho estimado da conversa (% da janela)              |
| 2   | Decisões críticas que ainda lembro                      |
| 3   | Decisões que provavelmente esqueci                      |
| 4   | Sinto degradação na qualidade? Sim/Não + razão          |
| 5   | Recomendação: continua / considere cortar / corte agora |
| 6   | Se cortar: template do próximo chat já preenchido       |

---

## 🛠️ Stack e versões fixadas

- Tauri: 2.x
- React: 18
- TypeScript: 5.x
- Vite: 5.x
- Fabric.js: 6.x
- Tailwind: 3.x
- shadcn/ui: latest
- Drizzle ORM: latest
- tauri-plugin-sql: 2.x
- Vitest + jsdom + node-canvas (testes do canvas)

**Banco:** `%APPDATA%\com.capilaser.studio\capi-studio.db` (Windows)

---

## 📦 Assets pendentes esperando cadastro

**Localização (FORA do projeto Tauri, na "caixa de entrada" do Gabriell):**

```
C:\Users\Gabriell\Desktop\Capi Studio 0.2\assets-pendentes\
├── materiais\
│   ├── acrilico-espelhado-dourado.png   ← Mini-9.5
│   ├── acrilico-espelhado-prata.png     ← Mini-9.5
│   ├── acrilico-espelhado-rose-gold.png ← Mini-9.5
│   ├── acrilico-solido-branco.png       ← Mini-9.5
│   └── acrilico-solido-preto.png        ← Mini-9.5
└── gravacoes\
    └── profissoes\
        ├── balanca-advogado.svg         ← Onda 8.5 (entregue)
        └── advogado-texto.svg           ← Onda 8.5 (a entregar)
        (futuro: medico, dentista, engenheiro, arquiteto...)
```

**Por que "assets-pendentes" fica FORA do projeto:**

A pasta é a **caixa de entrada** do Gabriell — ele coloca arquivos lá quando ficam prontos no Corel/ChatGPT, e o Claude Code copia pra dentro do projeto na onda apropriada.

Mantê-la fora do projeto evita:

- Conflito com seeds/migrations
- Commits acidentais de arquivos de trabalho
- Confusão entre "asset cadastrado" vs "asset pra cadastrar"

**Fluxo:**

1. Gabriell coloca o arquivo em `assets-pendentes/<categoria>/`
2. Onda apropriada roda (Mini-9.5 ou 8.5)
3. Claude Code copia pro projeto e cadastra no banco
4. Gabriell pode apagar de `assets-pendentes/` depois (opcional)

### Materiais (Mini-9.5)

5 PNGs aprovados visualmente pelo consultor + Gabriell. Resolução: 1600×900 px. PNG opaco. Estilo: foto realista de chapa de material em vista frontal, iluminação upper-left difusa.

**Compatibilidade decidida:**

- Acrílico Espelhado + Sólido → uso em **placas** (placa-300x90)
- ABS Escovado (já cadastrado) → uso em **broches** e outros produtos

### Gravações (Onda 8.5)

SVGs exportados do Corel (vetorizados em curvas), categoria **"Profissões"**, vão pra tabela `engravings`.

**Procedimento padrão de exportação (do Corel):**

1. Escreve/desenha no Corel
2. Seleciona texto/objeto
3. Converte em curvas (botão direito → Converter em curvas)
4. Exporta como SVG
5. Salva em `assets-pendentes/gravacoes/profissoes/<nome>.svg`

**Restrição operacional descoberta na prática (Gabriell):**

> Algumas fontes "bugam" no SVG exportado pelo Corel. Solução: Gabriell evita essas fontes. Não há lista escrita — é conhecimento empírico do operador. Se uma gravação vier com problema visual após cadastro, primeiro suspeito é a fonte usada.

**Diferença entre `engravings` e `logos`:**

| Banco        | O que armazena                                                         | Quem cadastra                                        |
| ------------ | ---------------------------------------------------------------------- | ---------------------------------------------------- |
| `engravings` | Gravações **reutilizáveis** do catálogo (balança, "Advogado", caduceu) | Designer, 1 vez por categoria                        |
| `logos`      | Logo do **cliente final** (escritório "Silva & Associados")            | Auto-alimentado quando operador faz upload no pedido |

---

## 💬 Estilo de comunicação preferido

- **Português brasileiro**, tom direto e franco
- **Analogias do mundo real DO PROGRAMA** quando explicar conceito técnico (não cadeira de IKEA, não fora de contexto)
- **Listas e tabelas** > parágrafos longos
- **Emojis** OK em moderação (estrutura, não decoração)
- **Não bajulação** — feedback honesto vale mais
- **Push back** quando discordar tecnicamente, com justificativa

---

## 🎯 Comando rápido — como começar bem

Em qualquer chat novo, depois de anexar este arquivo, comece com:

```
Olá! Anexei AI-CONTEXT.md.

[O QUE QUERO FAZER AGORA]

Pergunta de calibração antes de prosseguir?
```

Eu leio o contexto, faço perguntas estratégicas se necessário, e começamos com qualidade desde o primeiro turno.

---

_Última atualização: **Onda 7b INTEIRA fechada** (Fases C+D+E+E2+F+G). 4 sistemas visuais coexistem: snap (cyan vivo `#00d4ff`), medição (sky-300 `#7dd3fc`), proximidade (violet-400 `#a78bfa`), grade (ink-600 `#3a3d3f` via `fabric.Pattern`). 8 commits: 0ccd989 (C), 06d7442 (D), 9713f3b (Fix#1), db84315 (Fix#2), ad65cfe (E), 4e8f072 (E2), 0557cc3 (F), aeae83a (cleanup). 231 testes verdes. ADR 015 escrito. `docs/DEBT.md` criado com 5 dívidas abertas + 1 resolvida (`coverage/` versionado). Próxima: Onda 7 (painel de camadas hierárquico — sequência travada). **Antes da 8.5, considerar onda dedicada de "consertos do slot-manager"** (DEBT #3 e #4 — overlay e content do slot não seguem body)._
