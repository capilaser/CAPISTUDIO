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
- Onda 3 ✅ → **Opus 4.7 + alto** (Canvas Fabric.js)
- Onda 4 (atual) → Sonnet 4.6 + médio
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
- ✅ Validação visual com prints > confiar em descrição textual
- ✅ Cada decisão arquitetural vai pra ADR em `docs/DECISIONS/`

---

## 🏗️ Estrutura de ondas (ROADMAP)

| Onda | Tema                                             | Status     |
| ---- | ------------------------------------------------ | ---------- |
| 0    | Bootstrap (Tauri + Vite + React + TS)            | ✅ Fechada |
| 1    | Banco SQLite + Seeds (19 tabelas)                | ✅ Fechada |
| 2    | Home + Layout Base                               | ✅ Fechada |
| 3    | Canvas Fabric.js                                 | ✅ Fechada |
| 4    | Slots editáveis + fitText                        | 🔄 Próxima |
| 5    | Texturas (PNGs ABS Escovado)                     | ⏳         |
| 6    | Painel de camadas                                | ⏳         |
| 7    | Sistema de alinhamento estilo Confluence         | ⏳         |
| 8    | Padrões + slots persistentes                     | ⏳         |
| 9    | Exportação SVG por máquina/operação              | ⏳         |
| 10   | Telas restantes (Abrir Padrão, Histórico, Banco) | ⏳         |
| 11   | Histórico completo de pedidos                    | ⏳         |
| 12   | Settings                                         | ⏳         |
| 13   | Validação final + polimento                      | ⏳         |

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

### Visual

- **Estética industrial-utilitária** estilo Lightburn/Ableton. NÃO Canva/Figma.
- **Dark theme único.** Paleta `ink-950..ink-50` + `laser` (vermelho #dc2626).
- **Fontes:** Geist (body) + JetBrains Mono (display/code). PROIBIDO Inter, Roboto, system-ui.
- **Cores semânticas por operação:** gravação=vermelho, corte-laser=azul, aplique=roxo.

### Home (Onda 2)

- **4 cards apenas:** Novo Padrão, Abrir Padrão, Histórico de Artes, Banco de Ativos.
- **Cards mostram toast** "Em desenvolvimento — chega na Onda X" ao clicar.
- **Dev link discreto** pra `/dev/db-check` no rodapé, só em DEV.

---

## 📚 ADRs criados

- `001-fabric-vulnerabilities.md` — Aceita 6 vulnerabilidades transitivas em fabric@6 (não-exploráveis em desktop local)
- `002-no-pattern-migration.md` — Padrões do v1 vazios, sem migração
- `003-production-modules-deferred.md` — Conceito ainda imaturo, fica pra futuro
- `004-product-layers-svg-nullable.md` — Coluna nullable até product_layers ser populado de fato

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

1. **1 chat ≠ projeto inteiro.** Quebra por escopo.
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

_Última atualização: Onda 3 fechada — próxima Onda 4 (slots + fitText)_
