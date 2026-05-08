# ADR 009 — Onda 5: Layout do canvas — sidebar esquerda + topbar de padrões

**Status:** Aceito
**Data:** 2026-05-06
**Onda:** 5

---

## Contexto

Durante a calibração da Onda 5, Gabriell apresentou referência visual
de uma versão anterior (Broches Studio v1) com layout que difere do
modelo descrito em `02-REQUIREMENTS.md`. A discussão revelou um modelo
operacional mais alinhado com o fluxo de atendimento ao cliente:

- **Sidebar esquerda fixa** com formulário hierárquico de seleção
- **Topbar do canvas** com chips de filtro + thumbnails de padrões
  inline
- **Painel direito de camadas** sempre visível (Opção D-completa)
- **Padrões inline no canvas**, não em tela separada

Este ADR formaliza o layout do canvas decidido nessa calibração e
ajusta `02-REQUIREMENTS.md` (originalmente descrevia toolbar superior).

---

## Decisões

### 1. Sidebar esquerda fixa — fluxo hierárquico (Modo Operador)

A sidebar esquerda funciona em **fluxo top-down hierárquico**:

```
┌─────────────────────────┐
│ 1. Produto              │ ← cards de seleção
├─────────────────────────┤
│ 2. Material             │ ← reage ao produto
├─────────────────────────┤
│ 3. Cor                  │ ← reage ao material
├─────────────────────────┤
│ 4. Padrão               │ ← chips de templates
│    "Nome+Logo+Prof"     │   compatíveis com a
│    "Nome+Logo"          │   combinação produto/
│    "Apenas Nome"        │   material/cor
├─────────────────────────┤
│ 5. CAMPOS DINÂMICOS     │
│    (aparecem só os      │
│     campos do padrão    │
│     escolhido)          │
└─────────────────────────┘
```

**Princípio:** a sidebar **reage** ao padrão escolhido. Se o padrão é
"Nome + Logo", aparecem só os campos de nome e logo. Profissão fica
oculta.

**Largura:** 280px fixa (do design system, igual painel direito).

**Modo Designer:** mesma estrutura, mas com seções extras visíveis por
padrão (criação de slots, propriedades numéricas em mm).

---

### 2. Campos dinâmicos — só os que o padrão tem

**Decisão:** seção 5 da sidebar (campos) renderiza apenas slots
existentes no padrão atual.

**Exemplo padrão "Nome + Logo":**

```
┌─────────────────────────┐
│ NOME                    │
│ Texto: [Flavinha]       │
│ Fonte: [Centrale  ▼]    │
│ Tamanho: [14.0  - +]    │
├─────────────────────────┤
│ LOGO                    │
│ [📁 Coloque logo aqui]  │
└─────────────────────────┘
```

Padrão "Nome + Logo + Profissão" adiciona:

```
├─────────────────────────┤
│ PROFISSÃO               │
│ Texto: [Advogado]       │
│ Fonte: [Roboto  ▼]      │
│ Tamanho: [10.0  - +]    │
└─────────────────────────┘
```

**Por quê:** evita poluição visual. Operador não vê o que não pode
preencher. Reduz erro de UX.

---

### 3. Adicionar campo via menu de contexto

**Decisão:** botão direito na sidebar OU no canvas → menu "Adicionar
campo".

**Opções do menu:**

- Logo
- Nome
- Profissão
- Texto custom

**Comportamento ao adicionar:**

1. Sistema cria slot novo numa camada nova
2. Sidebar passa a mostrar a seção do campo recém-adicionado
3. Slot pode ser arrastado entre camadas (decisão 7 abaixo)

**Disponibilidade:** ambos os modos (Operador e Designer). Não exige
toggle "Edição Avançada".

**Implementação:** Onda 6 ou Onda 8 (não bloqueia Onda 5).

---

### 4. Topbar do canvas — chips de filtro + thumbnails de padrões

**Decisão:** padrões aparecem **inline no topo do canvas**, não em
tela separada.

```
┌───────────────────────────────────────────────────┐
│ PADRÕES DISPONÍVEIS  [todos] [com-traço]          │  ← chips
│                      [sem-traço] [...]            │
├───────────────────────────────────────────────────┤
│  [thumb 1] [thumb 2] [thumb 3] [thumb 4]         │  ← previews
└───────────────────────────────────────────────────┘
```

**Comportamento:**

- Chip ativo destaca em cor `laser` (vermelho `#dc2626`)
- Click no chip filtra os thumbnails
- Click no thumbnail troca o padrão no canvas em tempo real
- Operador navega padrões sem sair da tela de trabalho

**Por quê inline:**

- Atendimento real-time ao cliente exige troca rápida de padrão
- Tela separada quebra fluxo (volta-vai-volta)
- Bate com referência visual aprovada pelo Gabriell

**Estado dos chips:**

- "todos" — padrão ativo por default
- Demais chips: filtros derivados de tags do padrão (favoritos,
  com-traço, vertical, etc.)

**Implementação:** Onda 8 (padrões + slots persistentes). Não bloqueia
Onda 5.

---

### 5. Painel direito de camadas — Opção D-completa

**Decisão:** painel direito de camadas idêntico nos 2 modos (Operador
e Designer).

**Conteúdo do painel:**

- Lista de camadas (visibility, lock, nome)
- Chip de operação com cor semântica (gravação=vermelho,
  corte-laser=azul, aplique=roxo)
- Chip(s) de máquina(s) atribuída(s)
- Drag-and-drop pra reordenar / mover entre grupos
- Editor de tags (operação + máquina) — apenas Designer

**Por quê não esconder no Operador:**

- Atendimento ao cliente exige visibilidade total
- Operador precisa entender o que vai pra cada máquina pra responder
  dúvidas em tempo real
- Camadas é informação **viva** durante atendimento, não detalhe técnico

**Largura:** 280px fixa.

**Implementação:** Onda 6 (painel de camadas).

---

### 6. Ações destrutivas no painel de camadas — proteção via confirmação

**Risco identificado:** painel completo no Operador permite ações que
podem corromper padrão sem perceber:

- Reordenar zIndex
- Ungroup
- Editor de tags (operação/máquina)
- Renomear camada

**Decisão:** ações destrutivas exibem **confirmação** quando executadas
no Modo Operador. No Modo Designer, executam direto.

**Forma da confirmação:** modal `AlertDialog` (shadcn) com mensagem
clara: "Isso afeta como o padrão renderiza. Continuar?"

**Exceção:** toggle visibility e lock — operações reversíveis, não
exigem confirmação.

**Implementação:** Onda 6.

---

### 7. Drag-and-drop entre camadas — Opção B (sugestão via modal)

**Cenário:** operador arrasta logo da Camada 0 pra dentro de Aplique 1.

**Decisão:** sistema **sugere ajustes** via modal:

- "Você moveu a logo pra dentro do Aplique 1."
- "Quer mudar a operação pra `gravacao-aplique`?"
- "Quer mudar a máquina pra `fiber-laser`?"
- Botões: Aplicar sugestões / Manter como está / Cancelar

**Por quê não automático:**

- Gabriell sabe melhor que o sistema o que quer fazer
- Modal protege contra ajuste silencioso indesejado
- Quando o sistema acumular regras suficientes, evolui pra ajuste
  automático na Fase 2

**Implementação:** Onda 6 (painel de camadas) ou Onda 7+. **Não na
Onda 5** — Onda 5 não tem painel de camadas ainda, só painel direito
com material.

**Mapa de regras de sugestão:** documentado como follow-up. Estrutura:

```
{
  origem: 'camada-0' | 'aplique',
  destino: 'camada-0' | 'aplique',
  operação_atual: string,
  → operação_sugerida: string,
  → máquina_sugerida: string
}
```

---

### 8. Operador vs Designer é layout, não permissão

**Decisão recapitulada (também presente em ADR 008):**

**Mesmas funções nos 2 modos.** Diferença é layout:

**Operador:**

- Layout enxuto, foco no fluxo de atendimento
- Sidebar esquerda hierárquica visível
- Topbar de chips de padrões visível
- Painel direito de camadas visível
- Toggle "Edição Avançada" libera ferramentas extras

**Designer:**

- Layout completo desde o início
- Tudo que o Operador tem + ferramentas de construção sempre visíveis

**Atrás do toggle "Edição Avançada":**

- Criação/redimensionamento de slots
- Propriedades numéricas em mm (X, Y, W, H)
- Réguas e guias
- Ungroup vetorial (Ctrl+U)

**Sempre visíveis nos 2 modos:**

- Material e cor
- Painel de camadas
- Histórico (Ctrl+Z / Ctrl+Y)
- Salvar / exportar
- Sidebar esquerda hierárquica
- Topbar de padrões

---

## Layout consolidado

```
┌──────────────────────────────────────────────────────────────┐
│ HEADER: Capi Studio | abas (Home, Banco, Histórico)           │
├──────────┬────────────────────────────────────────┬──────────┤
│          │ TOPBAR: chips + thumbnails de padrões  │          │
│ SIDEBAR  ├────────────────────────────────────────┤          │
│ ESQ      │                                        │ PAINEL   │
│ (form    │           CANVAS                       │ DIREITO  │
│ hierár-  │       (Fabric.js)                      │ (cama-   │
│ quico)   │                                        │  das +   │
│          │                                        │ material)│
│ 280px    │       [Guias] [SVG] [PNG]              │ 280px    │
└──────────┴────────────────────────────────────────┴──────────┘
```

---

## Impacto em requisitos

`projeto/02-REQUIREMENTS.md` foi atualizado com os seguintes diffs:

### RF-3.1 — Modos do canvas

Parágrafo adicionado ao final:

> ⚠️ Operador vs Designer é diferença de layout, não de permissão.
> Ambos os modos têm acesso às mesmas funções operacionais essenciais
> (logo, nome, profissão, material, cor, painel de camadas, histórico,
> salvar, exportar). O toggle "Edição Avançada" no Operador esconde
> apenas ferramentas de construção de padrão (criação/redimensionamento
> de slots, propriedades numéricas em mm, réguas e guias, ungroup
> vetorial). Material, cor e painel de camadas são acessíveis sem
> toggle em ambos os modos.

### RF-3.2 — Toolbar do Modo Operador

Seção reescrita para descrever layout em 3 zonas (sidebar + topbar +
painel direito) com as 9 ações mapeadas para suas zonas correspondentes.

### RF-3.3 — Toolbar do Modo Designer

Nota adicionada antes da lista: ferramentas ficam atrás do toggle no
Operador; exceções (Histórico e Painel de camadas) sempre visíveis.

### RF-3.10 (novo) — Aplicação de materiais às camadas

MaterialId por camada visual, 2 dropdowns encadeados, clip do PNG,
cache no boot, fallback cinza neutro.

### RF-3.11 (novo) — Sidebar esquerda hierárquica

Sidebar 280px com fluxo: Produto → Material → Cor → Padrão → Campos
dinâmicos. Adicionar campo via menu de contexto.

### RF-3.12 (novo) — Topbar de padrões inline

Chips de filtro + thumbnails inline acima do canvas.

---

## Implementação por onda

| Item                                                | Onda |
| --------------------------------------------------- | ---- |
| Schema mantém estado atual (LayerMeta + materialId) | 5    |
| Painel direito de material (decisão 5 do ADR 008)   | 5    |
| Sidebar esquerda hierárquica (UI)                   | 8    |
| Topbar de padrões inline                            | 8    |
| Painel direito de camadas completo                  | 6    |
| Drag-and-drop entre camadas + modal de sugestão     | 6/7  |
| Adicionar campo via menu de contexto                | 6/8  |
| Confirmação em ações destrutivas no Operador        | 6    |

**A Onda 5 NÃO implementa o layout completo.** Onda 5 entrega apenas o
painel direito de material. Sidebar esquerda e topbar são pavimentadas
para Ondas 6-8.

---

## Pendências futuras (follow-up)

| Item                                                  | Quando  |
| ----------------------------------------------------- | ------- |
| Mapa de regras pra sugestão de operação ao mover slot | Onda 6+ |
| Curadoria UI completa (busca avançada de padrões)     | Onda 10 |
| Conjuntos de fontes pré-definidos (preset)            | Fase 2  |
| Detecção automática de operação por contexto          | Fase 2  |
| IA para busca visual de padrões                       | Fase 3  |

---

## Referências

- ADR 005 — Canvas engine Fabric.js
- ADR 008 — Texturas como propriedade de camada
- `projeto/02-REQUIREMENTS.md` — RF-3.1, RF-3.2, RF-3.3 (modificados)
- `projeto/06-VISION.md` — visão estendida do produto
