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
- **Decisões maduras:** trava escopo MVP enxuto, foca no essencial, descarta features que viram patos chocos.
- **Trabalha com pausas saudáveis:** sessões de horas com paradas pra dormir, comer, trabalhar outras coisas.
- **Personalidade:** detalhista, paciente com método, valida com prints, não confia cegamente. Aceita feedback firme quando técnico.

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

### Lições aprendidas (de sessões anteriores)

- ⚠️ Claude Code tende a pular checkpoints — usar linguagem firme: _"PARE EXECUÇÃO. Quebra de contrato."_
- ⚠️ Claude Code tende a atacar sintoma, não causa raiz — pedir diagnóstico antes de fix
- ⚠️ Claude Code às vezes **inventa justificativa** pra evitar investigar problema real ("removi os logs pelo critério X" quando os logs eram outros). Pressionar com evidência cronológica.
- ⚠️ "Auto mode" do Claude Code pula perguntas críticas — forçar respostas explícitas no kickoff
- ✅ Validação visual com prints > confiar em descrição textual
- ✅ Validação extra via SQL direto no banco (não confiar só no F5 test) quando persistência for crítica
- ✅ Cada decisão arquitetural vai pra ADR em `docs/DECISIONS/`
- ✅ **Logs no DevTools > leitura de código** quando Claude Code afirma "tudo OK" mas runtime contradiz
- ✅ **Teste verde ≠ código no caminho de execução** — validar via runtime que função modificada está sendo chamada
- ✅ **Causa raiz > sintoma**, sempre, sem exceção

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
- Onda 6c → Sonnet 4.6 (painel de slots)
- Onda 6.5 → Sonnet 4.6 (UI bancos)
- Onda 7 → **Opus 4.7 + alto** (alinhamento)
- Onda 9 → **Opus 4.7 + alto** (exportação SVG)
- Ondas 10-12 → Sonnet 4.6 ou Haiku
- Onda 13 → Opus 4.7

---

## 🏗️ Estrutura de ondas (ROADMAP)

| Onda    | Tema                                                                 | Status                     |
| ------- | -------------------------------------------------------------------- | -------------------------- |
| 0       | Bootstrap (Tauri + Vite + React + TS)                                | ✅ Fechada                 |
| 1       | Banco SQLite + Seeds (19 tabelas)                                    | ✅ Fechada                 |
| 2       | Home + Layout Base                                                   | ✅ Fechada                 |
| 3       | Canvas Fabric.js                                                     | ✅ Fechada                 |
| 4       | Slots editáveis + fitText                                            | ✅ Fechada                 |
| 4.5     | Banco de Fontes Curado (5 fontes nicho profissional + FontFace API)  | ✅ Fechada                 |
| 5       | Texturas (PNGs ABS Escovado)                                         | ✅ Fechada                 |
| 6a      | Schema de hierarquia (3 bancos novos)                                | ✅ Fechada                 |
| **6b**  | **Parser Corel + Cleanup + LayerMeta hierárquico**                   | **✅ Fechada**             |
| 6c      | Painel de Slots agrupado por camada                                  | ⏳                         |
| **6.5** | **UI dos bancos (Apliques/Gravações/Marcações) — Fases A+B**         | **✅ Fechada (Fases A+B)** |
| 7       | Painel de Camadas hierárquico + alinhamento estilo Confluence        | ⏳                         |
| 8       | Padrões + slots persistentes (primeiro padrão real: Placa Profissão) | ⏳                         |
| 9       | Exportação SVG por máquina/operação                                  | ⏳                         |
| 10      | Telas restantes (Abrir Padrão, Histórico, Banco)                     | ⏳                         |
| 11      | Histórico completo de pedidos                                        | ⏳                         |
| 12      | Settings                                                             | ⏳                         |
| 13      | Validação final + polimento                                          | ⏳                         |

---

## ⚙️ Decisões arquiteturais críticas (NÃO revisitar)

### Negócio

- **MVP super enxuto:** apenas Editor + Banco de templates + Banco de artes geradas. Sem CRM, sem dashboard, sem Make/Trello/WhatsApp. Tudo isso vai pra Fase 2.
- **Sem login no MVP:** single-user local. Login fica pra Fase 2 (multi-usuário).
- **Caminho A — Rewrite total**, não migração incremental. v1 vira "spec executável das regras de negócio".

### Arquitetura

- **Camadas tipadas:** cada camada do SVG tem `kind: "principal" | "operation" | "visual"` (discriminated union, ADR 010).
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
- Carregamento via `new FontFace(...).load() + document.fonts.add()` — **NÃO `@font-face` passivo**
- Asset protocol Tauri 2.x: `enable: true + scope: ["**"]` no `security` do `tauri.conf.json`
- ⚠️ Cargo não detecta mudanças em `resources/` — executar `cargo clean` ao adicionar **qualquer** asset novo (SVGs, PNGs, fonts). Não só fonts.

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
- **`011-fabric6-fill-empty-string.md`** — Fabric 6 passa "none" literal pro canvas DOM, que renderiza preto. Workaround: `fill: ''` no obj.set.

---

## 🗂️ Documentos de planejamento

Localização: `capi-studio-v2/projeto/` (anexar quando relevante ao chat)

- `00-README.md` — índice e instruções
- `01-DATABASE.md` — schema SQLite com Drizzle (24 tabelas após Onda 6a)
- `02-REQUIREMENTS.md` — requisitos funcionais MVP
- `03-CLAUDE-CODE-KICKOFF.md` — prompt de kickoff principal, 14 ondas
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

### Onda 6.5 — Banco de Apliques (Fases A+B fechadas)

- **Fase A:** seed 3 SVGs com `INSERT OR IGNORE` (fix idempotency), `humanizeError` em PT, `resolveDisplayUrl` via asset protocol Tauri
- **Fase B:** UI completa — rota `/banco/apliques`, grid de cards, thumbnails SVG, upload com validação, renomear/deletar via DropdownMenu
- **Lição registrada — cargo clean ampliado:** `cargo clean` é obrigatório ao adicionar qualquer asset em `resources/`, não só fonts/PNGs
- **Lição registrada — quebra de contrato reparada:** Claude Code mudou código + deletou pasta sem aprovação durante debug. Fix foi correto tecnicamente, mas violação de processo foi admitida, documentada e corrigida com reset planejado.
- **Dívida técnica:** `tests/fixtures/apliques/` (PT) → padronizar pra `appliques` (EN) em onda futura. Não bloqueia MVP.
- **Próxima Fase C:** canvas right-panel com lista de apliques + click-to-add como camada `kind: 'principal'`

---

_Última atualização: Onda 6.5 Fases A+B fechadas — próxima: Fase C (canvas + painel direito + addAppliqueSvg)._
