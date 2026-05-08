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

- **Não programa.** Aprendeu a usar terminal nesta jornada. Trate explicações com clareza e analogias do mundo real, evite jargão técnico desnecessário.
- **Dono de empresa de corte/gravação a laser** em Curitiba/PR.
- **Decisões maduras:** trava escopo MVP enxuto, foca no essencial, descarta features que viram patos chocos.
- **Trabalha com pausas saudáveis:** sessões de horas com paradas pra dormir, comer, trabalhar outras coisas.
- **Personalidade:** detalhista, paciente com método, valida com prints, não confia cegamente. Aceita feedback firme quando técnico.

---

## 🤖 Como o trabalho está organizado

**Dois "Claudes" diferentes envolvidos:**

| Onde                                      | Função                                                                 | Modelo recomendado          |
| ----------------------------------------- | ---------------------------------------------------------------------- | --------------------------- |
| **App desktop Claude (você, lendo isso)** | Estratégia, validação visual, revisão de planos, escrita de instruções | **Opus 4.7**                |
| **Claude Code (no VS Code)**              | Execução: criar arquivos, rodar código, debug                          | Varia por onda (ver tabela) |

**Modelos do Claude Code por onda:**

- Onda 0 ✅ → Sonnet 4.6
- Onda 1 ✅ → Opus 4.7 (banco SQLite)
- Onda 2 ✅ → Sonnet 4.6 + médio
- Onda 3 ✅ → Opus 4.7 + alto (Canvas Fabric.js)
- Onda 4 ✅ → Sonnet 4.6 + médio (slots + fitText)
- Onda 4.5 → Sonnet 4.6 (download/seed simples)
- Ondas 5-6 → Sonnet 4.6
- Onda 7 → **Opus 4.7 + alto** (alinhamento)
- Onda 9 → **Opus 4.7 + alto** (exportação SVG)
- Ondas 10-12 → Sonnet 4.6 ou Haiku
- Onda 13 → Opus 4.7

---

## 📋 Método de trabalho que funciona

1. **Eu (chat) calibro** o texto pro Claude Code
2. **Claude Code propõe plano** no formato: Plano / Arquivos / Risco / Teste
3. **Eu (chat) reviso o plano** antes de Gabriell aprovar
4. **Claude Code executa em fases** com **checkpoints A, B, C**
5. **Gabriell valida visualmente** com prints em cada checkpoint
6. **Eu (chat) confirmo** OK pro próximo checkpoint

**Lições aprendidas:**

- ⚠️ Claude Code tende a pular checkpoints — usar linguagem firme: _"PARE EXECUÇÃO. Quebra de contrato."_
- ⚠️ Claude Code tende a atacar sintoma, não causa raiz — pedir diagnóstico antes de fix
- ⚠️ "Auto mode" do Claude Code pula perguntas críticas — forçar respostas explícitas no kickoff
- ✅ Validação visual com prints > confiar em descrição textual
- ✅ Validação extra via SQL direto no banco (não confiar só no F5 test) quando persistência for crítica
- ✅ Cada decisão arquitetural vai pra ADR em `docs/DECISIONS/`

---

## 🏗️ Estrutura de ondas (ROADMAP)

| Onda | Tema                                                                     | Status     |
| ---- | ------------------------------------------------------------------------ | ---------- |
| 0    | Bootstrap (Tauri + Vite + React + TS)                                    | ✅ Fechada |
| 1    | Banco SQLite + Seeds (19 tabelas)                                        | ✅ Fechada |
| 2    | Home + Layout Base                                                       | ✅ Fechada |
| 3    | Canvas Fabric.js                                                         | ✅ Fechada |
| 4    | Slots editáveis + fitText                                                | ✅ Fechada |
| 4.5  | Banco de Fontes Curado (5 fontes nicho profissional + FontFace API)      | ✅ Fechada |
| 5    | Texturas (PNGs ABS Escovado)                                             | ✅ Fechada |
| 6a   | Schema + Seeds + Bancos (apliques, engravings, markings, pattern_layers) | ✅ Fechada |
| 6.5  | UI dos bancos (Apliques/Gravações/Marcações)                             | ⏳         |
| 7    | Painel de Camadas hierárquico (poder, edição TIPO+MÁQUINA)               | ⏳         |
| 7    | Sistema de alinhamento estilo Confluence                                 | ⏳         |
| 8    | Padrões + slots persistentes                                             | ⏳         |
| 9    | Exportação SVG por máquina/operação                                      | ⏳         |
| 10   | Telas restantes (Abrir Padrão, Histórico, Banco)                         | ⏳         |
| 11   | Histórico completo de pedidos                                            | ⏳         |
| 12   | Settings                                                                 | ⏳         |
| 13   | Validação final + polimento                                              | ⏳         |

---

## ⚙️ Decisões arquiteturais críticas (NÃO revisitar)

### Negócio

- **MVP super enxuto:** apenas Editor + Banco de templates + Banco de artes geradas. Sem CRM, sem dashboard, sem Make/Trello/WhatsApp. Tudo isso vai pra Fase 2.
- **Sem login no MVP:** single-user local. Login fica pra Fase 2 (multi-usuário).
- **Caminho A — Rewrite total**, não migração incremental. v1 vira "spec executável das regras de negócio".

### Arquitetura

- **Camadas tipadas:** cada camada do SVG tem `kind: "visual" | "production"`. Visual renderiza no PNG mockup. Production exporta SVG limpo pra máquina.
- **Banco de logos auto-alimentado:** toda logo usada vira asset salvo automaticamente.
- **Materiais = PNGs reais**, não gradientes SVG. 4 PNGs do "ABS Escovado" (prata, rose, dourado, bronze) são seed da Onda 1.
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
- Carregamento via `new FontFace(...).load() + document.fonts.add()` — **NÃO `@font-face` passivo** (gera falso negativo no `check()`, browser só baixa quando algum elemento usa a fonte)
- Asset protocol Tauri 2.x: `enable: true + scope: ["**"]` no `security` do `tauri.conf.json` — **sem isso → ERR_CONNECTION_REFUSED**
- ⚠️ Cargo não detecta mudanças em `resources/` — executar `cargo clean` ao adicionar PNGs/fonts novas
- Pré-release: revisar scope `["**"]` para algo mais restrito (ex: `["$RESOURCE/**"]`)

### Slots e fitText (Onda 4)

- Cada slot = body Rect (persistente, arrastável) + overlay Rect (descartável, só Designer)
- `fitText` reduz fonte sem quebrar linha; min 6pt, max 24pt, passo 0.5pt; função pura com `measureFn` injetada
- Placeholder de logo vazio = `fabric.Group` gerenciado pelo `SlotManager`, não componente React
- Conteúdo dos slots = `fabric.Text` (read-only), nunca `fabric.IText`
- ⚠️ **Cache do Fabric 6:** usar `.set({ prop: value })`, nunca atribuição direta. Bug só aparece no Tauri (Chromium), não em jsdom — testes passam mas bug existe visualmente.
- `@font-face` não carregado no WebView ainda — `fitText` mede com fallback `system-ui`. Corrige na Onda 4.5.

### Texturas (Onda 5)

- Materiais aplicados via `fabric.Pattern` como fill da camada, com `clipPath` baseado no contorno do produto (`absolutePositioned: true`)
- Cenário 1 (clipPath + Pattern ortogonal) escolhido após refute do Cenário 2 (canvas pré-renderizado) por bug de patternTransform com objeto maior que produto
- Strip + restore simétrico de fill e clipPath em `serialize()` preserva invariante: serialize não modifica estado visual do canvas
- Cache `materialImageCache` + `preloadMaterials` reduz trocas para < 0.5ms (meta RF-8.1 era < 200ms — 1000× mais rápido)
- ⚠️ Riscos conhecidos Fabric 6.9.1: Issue #8517 (toDataUrl + absolutePositioned) → follow-up Onda 9; Issue #7742 (Group clipPath) → mitigado via compound path string

### Onda 6a — Schema hierárquico + bancos de componentes

- 4 tabelas novas: `pattern_layers`, `appliques`, `engravings`, `markings` — todas seguem mesmo shape (id, name, filePath, thumbnail, dimensões, tags, metadata, soft delete)
- Coluna `parent_layer_id` em `pattern_slots` (nullable, FK lógica → `pattern_layers`)
- Convenção dual de filePath: `"resource://"` (fixtures embutidas) e `"appdata://"` (uploads do usuário). Resolver em `src/services/svgPathResolver.ts`
- Fixtures de seed (4 svg-bases + 3 apliques) ficam em `src-tauri/resources/fixtures/`, **NUNCA copiadas pra appData**. Padrão coerente com Onda 4.5 (banco de fontes)
- `INSERT OR REPLACE` em seeds — revisitar quando `pattern_layers` virar FK para `svg_bases` (Onda 6b+)
- ADR 010 documenta hierarquia de camadas em 2 níveis fixos (principal → operação)

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
- `006-onda-4-slots-fittext.md` — Slots, fitText, body/overlay, placeholder, bug cache Fabric 6
- `007-onda-4.5-banco-fontes.md` — 5 fontes curadas, FontFace API ativa, asset protocol Tauri 2.x OPT-IN, cargo clean obrigatório
- `008-onda-5-texturas-camada.md` — Texturas via fabric.Pattern + clipPath, cache de imagens, strip+restore em serialize, riscos Fabric 6.9.1 (issues #8517, #7742)
- `009-onda-5-layout-sidebar-topbar.md` — Layout sidebar esquerda hierárquica + topbar de chips de padrões + painel direito de camadas Opção D-completa
- `010-camadas-hierarquicas-bancos-componentes.md` — Hierarquia de camadas em 2 níveis, tabelas de bancos, convenção dual filePath resource://+appdata://, FK parentLayerId

---

## 🗂️ Documentos de planejamento

Localização: `capi-studio-v2/projeto/` (anexar quando relevante ao chat)

- `00-README.md` — índice e instruções
- `01-DATABASE.md` — schema SQLite com Drizzle (19 tabelas)
- `02-REQUIREMENTS.md` — requisitos funcionais MVP
- `03-CLAUDE-CODE-KICKOFF.md` — prompt de kickoff principal, 14 ondas
- `04-STITCH-PROMPT.md` — prompt em inglês pra Google Stitch
- `05-BACKLOG.md` — Fase 2/3 documentadas

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

**Quando rodar:** sempre que sentir dúvida se vale continuar nesse chat ou abrir novo.

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

## 💬 Estilo de comunicação preferido

- **Português brasileiro**, tom direto e franco
- **Analogias do mundo real** quando explicar conceito técnico
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

_Última atualização: Onda 6a fechada — próxima Onda 6b (parser SVG + LayerMeta refactor)_
