# 📦 Capi Studio v2 — Pacote de Planejamento

Resultado da consultoria estruturada. Este pacote contém **tudo que você precisa pra começar o projeto do jeito certo** — sem improviso, sem refazer planejamento.

---

## 📂 Arquivos do pacote (ordem de leitura recomendada)

### 1. `01-DATABASE.md` — Modelagem do banco

Schema SQLite completo em Drizzle TypeScript. Tabelas, relações, tipos, seeds, migrations.

- 13 tabelas principais
- Migração 100% mapeada dos JSONs do Capi v1
- Tabelas futuras já comentadas pra preservar arquitetura

### 2. `02-REQUIREMENTS.md` — Requisitos funcionais

Especificação completa do MVP, agrupada em 13 seções. Inclui critério de aceitação (17 passos).

- Princípios não-negociáveis do CLAUDE.md preservados
- Todos os RFs identificados (RF-1.1, RF-2.1, etc.)
- Backlog Fase 2 documentado no final

### 3. `03-CLAUDE-CODE-KICKOFF.md` — Prompt para Claude Code ⭐

**Este é o prompt principal.** Cole inteiro na primeira mensagem do Claude Code.

- Roadmap de 13 ondas de execução
- Arquitetura de pastas obrigatória
- Skill `frontend-design` aplicado
- Regras de comportamento + proibições
- Critério de primeiro commit

### 4. `04-STITCH-PROMPT.md` — Prompt para Google Stitch

Prompt em inglês (Stitch funciona melhor em inglês) pra gerar protótipos visuais das 6 telas.

- Direção estética detalhada
- Paleta de cores em CSS variables
- Layout de cada tela com ASCII art
- Conteúdo realista em PT-BR pra preview

### 5. `05-BACKLOG.md` — Tudo que NÃO entra no MVP

Preserva o conhecimento da consultoria. Justifica decisões arquiteturais.

- Fase 2: Pedidos, CRM, Drive Reader inteligente
- Fase 3: Marketplace, IA, mobile
- Não-objetivos explícitos

---

## 🎯 Como usar este pacote

### Passo 1 — Antes de tudo

Crie pasta nova `capi-studio-v2/` (vazia). **Não** misture com a pasta do v1.

### Passo 2 — Stitch primeiro (opcional, mas recomendado)

1. Abra https://stitch.withgoogle.com
2. Cole o conteúdo de `04-STITCH-PROMPT.md`
3. Anexe os arquivos `broches-studio_5.html` e o fluxograma
4. Gere os protótipos das 6 telas
5. **Use os protótipos como referência visual ao falar com Claude Code** — anexe screenshots no kickoff

### Passo 3 — Claude Code

1. Abra Claude Code dentro da pasta `capi-studio-v2/`
2. Cole `03-CLAUDE-CODE-KICKOFF.md` na primeira mensagem
3. Anexe junto:
   - `01-DATABASE.md`
   - `02-REQUIREMENTS.md`
   - `CLAUDE__1_.md` (do v1) renomeado pra `CLAUDE-V1.md`
   - `ROADMAP.md` (do v1)
   - `Untitled_whiteboard_2026-05-04.png` (fluxograma)
   - `broches-studio_5.html` (referência visual)
   - Screenshots dos protótipos do Stitch (se gerou)
4. Aguarde o Claude Code:
   - Confirmar leitura
   - Fazer perguntas críticas
   - Propor plano da Onda 0
5. **Aprove a Onda 0 antes** dele começar a codar

### Passo 4 — Acompanhamento

Cada onda do roadmap (00 a 13) é um "milestone" de aprovação.

- Onda termina → você valida → próxima onda começa
- Isso evita ele se perder em refatoração gigante sem fim

---

## 🧭 Decisões já tomadas (não revisitar)

Pra você não ficar perdido, eis o que foi decidido na consultoria:

✅ **Stack:** Tauri + React + TS + Fabric.js + SQLite + Drizzle + shadcn/ui + Tailwind
✅ **Plataforma:** Windows desktop (apenas)
✅ **Caminho:** rewrite total com aproveitamento cirúrgico do v1 como spec
✅ **Login:** single-user local (multi-user fica pra Fase 2)
✅ **MVP escopo:** 7 telas, foco no canvas, sem CRM/pedidos completos
✅ **Estética:** industrial-utilitária, dark theme, fontes mono+geist
✅ **7 cenários do v1** servem como teste de aceitação visual

---

## ❓ Perguntas frequentes (que você pode ter agora)

**"E se eu não souber configurar Tauri?"**
O Claude Code te guia. Onda 0 inteira é dedicada a isso. Não pule.

**"E se eu quiser mudar a stack depois?"**
Não mude no MVP. Cada troca de stack adiciona 2-3 semanas. Foque em entregar o MVP, depois reavalia.

**"E se o Stitch gerar coisa feia?"**
Use o prompt do Claude Code (`03-CLAUDE-CODE-KICKOFF.md`) sem os protótipos do Stitch. O skill `frontend-design` aplicado lá já garante boa direção visual.

**"Preciso reutilizar código do v1?"**
**Não.** O v1 é spec executável das regras de negócio, não código pra copiar. Re-implemente em TypeScript modular.

**"Quanto tempo leva o MVP?"**
Estimativa honesta com Claude Code: 4-8 semanas em ritmo intenso, 8-16 semanas em ritmo normal. Depende de quanto tempo/dia você pode dedicar.

---

## 📞 Próximos passos imediatos

1. Ler este README
2. Ler `02-REQUIREMENTS.md` inteiro (é a fonte de verdade do escopo)
3. Decidir: começa pelo Stitch (visual) ou pelo Claude Code (código)?
4. Reservar pasta nova e começar

Boa execução. Esse projeto tem ossos bons.
