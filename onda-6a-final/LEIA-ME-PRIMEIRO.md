# 📦 Pacote final — Onda 6a (Schema + Seeds)

> Pacote gerado pelo chat Claude Opus 4.7 após calibração com o Gabriell.
> Substitui o pacote anterior `onda-6a-handoff.zip` (que continha rascunho
> com numeração de ADR errada).

---

## ✅ O que foi decidido na calibração

| Decisão                                   | Resposta                            |
| ----------------------------------------- | ----------------------------------- |
| Numeração do ADR de camadas hierárquicas  | **010** (008 e 009 já existem)      |
| Reset do banco                            | Autorizado                          |
| Seeds antigos pós-reset (Ondas 1, 4.5, 5) | **Rodam automaticamente** (Opção A) |
| Idempotência do seed da 6a                | **Por id fixo no código**           |
| Verificação da pasta `tests/fixtures/`    | Pendente — Gabriell vai rodar `ls`  |

---

## 🚀 Como usar este pacote

### Passo 1 — Confira a pasta de fixtures no seu projeto

Abra o terminal do VS Code dentro de `capi-studio-v2/` e rode:

```bash
ls tests/fixtures/
```

**3 cenários possíveis:**

| O que aparece                                                         | Use a versão                      |
| --------------------------------------------------------------------- | --------------------------------- |
| Mostra `camadas-base/`, `apliques/`, `exportacoes/` com `.svg` dentro | **VERSAO-A**                      |
| `ls: cannot access...` ou pasta vazia                                 | **VERSAO-B**                      |
| Parcial (algumas pastas, alguns arquivos)                             | Mande print pro chat Opus decidir |

Se confirmar Versão A, rode também pra ter certeza que todos os SVGs estão lá:

```bash
ls tests/fixtures/camadas-base/
ls tests/fixtures/apliques/
```

Lista esperada (Versão A precisa de TODOS):

- `camadas-base/`: broche-simples.svg, broche-completo.svg, placa-base.svg, placa-completa.svg
- `apliques/`: aplique-1-formato-d.svg, aplique-2-pill.svg, aplique-3.svg

Se faltar 1 arquivo, **use Versão B** (kickoff cria estrutura e espera você popular).

---

### Passo 2 — Abra chat NOVO no Claude Code

- VS Code → Claude Code
- Modelo: **Sonnet 4.6 (médio)** — já decidido no roadmap
- Pasta: `capi-studio-v2/`

---

### Passo 3 — Anexe os arquivos

Anexe estes 4 arquivos (não anexe o LEIA-ME nem o KICKOFF da versão errada):

1. `AI-CONTEXT.md`
2. `06-VISION.md`
3. `PLANO-ADR-camadas-hierarquicas.md` ⚠️ (vai virar ADR 010 — primeiro passo do kickoff é criar esse ADR)
4. `01-DATABASE.md` (do `projeto/` do seu repositório)

**Versão B também precisa anexar:** 5. `README-fixtures.md`

---

### Passo 4 — Cole o KICKOFF

- **Versão A** → copie todo o conteúdo de `KICKOFF-6a-VERSAO-A.md` entre os marcadores `═══`
- **Versão B** → copie todo o conteúdo de `KICKOFF-6a-VERSAO-B.md` entre os marcadores `═══`

Cole como **primeira mensagem** no chat do Claude Code.

---

### Passo 5 — Aguarde o plano e revise comigo

Claude Code vai responder com:

1. Confirmação de leitura
2. Perguntas críticas (se houver)
3. Plano no formato `Plano / Arquivos / Risco / Teste`

**NÃO aprove o plano sozinho.** Mande print do plano pra mim (chat Opus) revisar antes de você dar OK.

---

### Passo 6 — Validação por checkpoints

Claude Code executa em 3 checkpoints (4 se for Versão B):

- **Checkpoint 0** (Versão B só) — estrutura de fixtures criada, aguardando SVGs
- **Checkpoint A** — schema + ADR 010 + migration + seeds antigos rodando
- **Checkpoint B** — seeds novos da 6a + arquivos físicos copiados
- **Checkpoint C** — repositories funcionam + lint/typecheck/test passam

A cada checkpoint, mande **print da tela `/dev/db-check` + output dos comandos SQL** pra mim revisar antes de aprovar o próximo.

---

## ⚠️ Lembretes importantes

### Lições aprendidas (do AI-CONTEXT)

- Claude Code tende a **pular checkpoints** — se ele tentar, mande mensagem firme: _"PARE EXECUÇÃO. Você está em checkpoint X. Aguarde validação."_
- Claude Code tende a **atacar sintoma vs causa raiz** — peça diagnóstico antes de fix se algo quebrar
- **Validação visual com print > confiar em descrição textual**

### Decisões que NÃO devem ser revisitadas no chat novo

- Onda 6 quebrada em 6a → 6b → 6c
- Modelos: 6a Sonnet 4.6 → 6b Opus 4.7 alto → 6c Sonnet 4.6
- SVGs ficam em disco (`appData/assets/...`), não inline no banco
- Cenário-exemplo (placa+3apliques) NÃO seedado nesta onda — só na Onda 8
- Banco capi-studio.db zerado antes da migration
- ADR 008 e 009 já existem (texturas e layout) — não tocar
- ADR de camadas hierárquicas é o **010**

### Se o Claude Code inventar caminho de arquivo ou pular passo

Mande print pro chat Opus, ele te passa correção firme.

---

## 🆘 Se algo quebrar

1. Mande print do erro pro chat Opus
2. Cite qual checkpoint tava (0, A, B ou C)
3. Cite qual versão do kickoff tá usando (A ou B)

---

_Pacote gerado em: 2026-05-08 — após calibração da Onda 6a._
