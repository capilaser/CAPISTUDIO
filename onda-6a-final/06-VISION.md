# 🎯 Capi Studio v2 — Visão Estendida do Produto

> **Status:** Documento de norte estratégico. **NÃO é roadmap de implementação.**
> **Origem:** Conversa de calibração da Onda 5 (2026-05-06). Gabriell descreveu
> a visão completa do produto final pra que decisões arquiteturais do MVP
> respeitem essa direção.
>
> **Como usar:** consultar antes de decisões arquiteturais grandes. Algumas
> features podem entrar como "ganchos" no MVP (schema preparado, UI pavimentada),
> mas implementação completa fica pra Fase 2/3.
>
> **Quem revisa:** Gabriell + Claude (chat). Claude Code não toca neste
> documento — é estratégia, não execução.

---

## 1. Identidade do produto (em 1 frase)

**Capi Studio é um Corel personalizado para corte e gravação a laser** —
mistura de Corel + Photoshop + Lightburn + Canva, mas focado **exclusivamente**
no fluxo de produção de produtos personalizados (broches, placas, etc.).

**Não é** editor de design livre. **Não é** Canva. É **ferramenta operacional
de produção** que entrega 3 coisas:

1. Arte aprovada pelo cliente em **1 minuto**
2. Arquivo SVG limpo, separado por máquina, pronto pra cortar
3. Banco vivo de tudo que já foi feito

---

## 2. Os 3 pilares fundamentais

### Pilar 1 — ARTE: banco vivo de padrões consultável

**Problema atual:** anos de trabalho, milhares de broches feitos, padrões
salvos em pastas espalhadas. Pra atender cliente, Gabriell garimpa
manualmente.

**Visão:**

- Banco massivo de padrões já feitos (acumulado de anos via curadoria)
- Interface visual rápida e intuitiva — **organização, sem efeitos**
- Cliente chega → Gabriell escolhe a melhor arte em **1 minuto**
- Cliente aprova → arte vira pedido com 1 clique

**Implicações arquiteturais:**

- Schema já tem `patterns` table — preparada
- Filtros visuais com chips horizontais (ver seção 4.4)
- Thumbnails pré-renderizados (não gerar on-the-fly)
- Categorização inteligente: por estilo, por elementos (com traço, com
  profissão, vertical, horizontal, etc.)
- Favoritos no topo da lista

### Pilar 2 — SVG: arquivo perfeito separado por máquina

**Problema atual:** depois de fazer a arte, Gabriell separa manualmente
no Corel: tira textura, separa camada de gravação da de corte, limpa
overrides, exporta cada máquina separado. Trabalho repetitivo, sujeito a
erro, gasta horas.

**Visão:**

- Cliente aprova arte → 1 botão exporta TODOS os SVGs corretos
- Cada máquina recebe **exatamente** o que precisa
- Sem texturas, sem cores extras, só geometria limpa
- Naming consistente: `{pedido}_{máquina}.svg`

**Implicações arquiteturais:**

- `LayerMeta.kind: 'visual' | 'production'` (já decidido)
- `LayerMeta.machines: string[]` (já no schema)
- `LayerMeta.operation` (já no schema)
- Onda 9 é onde isso vira realidade

### Pilar 3 — PRODUTOS: criação de padrões com regras simples e escaláveis

**Problema atual:** cada produto novo é uma decisão isolada. Não tem
sistema. Quando entra máquina nova, vira retrabalho.

**Visão:**

- Cada produto tem regra simples: "que máquina faz o quê"
- Adicionar máquina nova = adicionar 1 linha de regra, não refazer tudo
- Padrões herdam do produto, podem override

**Implicações arquiteturais:**

- `products.config` JSON flexível (já decidido)
- `product_machines` (já no schema) — N:N
- Regras de roteamento ficam em config, não hardcoded

---

## 3. Glossário operacional (vocabulário do Gabriell)

Esta seção formaliza termos que Gabriell usa no dia a dia. Toda decisão
de produto deve respeitar esse vocabulário.

### Termos de operação

| Termo        | Significado                                                                                                                                                                                                       |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Corte**    | Máquina corta o material — peça sai do material. Operação destrutiva.                                                                                                                                             |
| **Marcação** | Máquina risca o material levemente — usada como guia para colar aplique manualmente. **Mesmo arquivo SVG** pode ir pra máquina 1 (marcação) e máquina 3 (corte) — duas máquinas, mesmo desenho, ações diferentes. |
| **Gravação** | Máquina queima/grava o material — fica permanente. Tem **2 contextos** (ver abaixo).                                                                                                                              |
| **Contorno** | Linha vetorial externa de uma forma. No broche, serve como referência de centralização e base do mockup.                                                                                                          |

### Termos de elementos

| Termo             | Significado                                                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Camada 0**      | Camada base do produto (a placa em si, o broche em si). É a peça física principal.                                                   |
| **Aplique**       | Peça de outro material (acrílico, ABS) que é **colada por cima** da camada 0. Tem seu próprio corte e pode ter gravação dentro dele. |
| **Slot**          | Área editável demarcada pelo Designer (logo, nome, profissão, custom). Operador preenche.                                            |
| **Padrão Mestre** | Template reutilizável. **Nunca é alterado** ao salvar pedido.                                                                        |
| **Pedido (Arte)** | Instância de padrão preenchida com dados do cliente. Pode ter overrides do padrão original.                                          |

### Os 2 contextos de gravação (CRÍTICO)

A mesma operação `gravacao` se comporta diferente dependendo de **onde está**:

**1. Gravação na Camada 0**

- Vai direto no material base (placa/broche)
- Máquina executa diretamente sobre a peça inteira
- Exemplo: nome gravado no broche

**2. Gravação dentro de Aplique**

- Fica restrita ao aplique
- Máquina executa no aplique antes dele ser colado
- Operação interna recebe nome `gravacao-aplique` no schema
- Exemplo: detalhe gravado no acrílico dourado que será colado na placa

### Termos de produção

| Termo           | Significado                                                                                                                                                                               |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tirar miolo** | Remover áreas internas de letras/formas. Ex: letra B → fica só o contorno externo, sem as 2 bolinhas. Usado em marcação (não preciso riscar miolo se vou colar aplique inteiro por cima). |
| **Nesting**     | Empacotamento automático de SVGs num espaço de chapa. Otimiza uso de material e tempo de máquina.                                                                                         |
| **Mockup**      | PNG bonito com texturas pra mostrar ao cliente antes da produção. Não vai pra máquina.                                                                                                    |

---

## 4. Conceitos de UX já decididos

Esta seção captura decisões de UX descritas pelo Gabriell durante a
calibração da Onda 5. Ver `docs/DECISIONS/009-onda-5-layout-sidebar-topbar.md`
para a formalização técnica.

### 4.1 Sidebar esquerda fixa — fluxo hierárquico

A sidebar esquerda é o **centro do atendimento ao cliente**. Funciona em
fluxo top-down:

```
┌─────────────────────────┐
│ 1. Produto              │ ← escolhe primeiro
├─────────────────────────┤
│ 2. Material             │ ← reage ao produto
├─────────────────────────┤
│ 3. Cor                  │ ← reage ao material
├─────────────────────────┤
│ 4. Padrão               │ ← chips de templates
│    (Nome+Logo+Prof,     │   compatíveis
│     Nome+Logo,          │
│     Apenas Nome…)       │
├─────────────────────────┤
│ 5. CAMPOS DINÂMICOS     │
│    (aparecem só os      │
│     campos do padrão    │
│     escolhido)          │
└─────────────────────────┘
```

**Princípio:** a sidebar **reage** ao padrão escolhido. Se o padrão é
"Nome + Logo", aparecem só os campos de nome e logo. Profissão fica
oculta. Operador não vê o que não precisa.

### 4.2 Adicionar campo via menu de contexto

Operador pode **adicionar slots novos** sem precisar do Modo Designer:

- Botão direito na sidebar OU no canvas → "Adicionar campo"
- Opções: Logo / Nome / Profissão / Texto custom
- Slot é criado em camada nova
- Pode ser arrastado entre camadas (ver 4.3)

**Por que importa:** maioria das exceções de cliente (~20% dos pedidos)
são pequenas adições — uma segunda logo, um QR code, um campo extra.
Sem precisar trocar pra Modo Designer.

### 4.3 Drag-and-drop entre camadas (visão Onda 6+)

Operador pode arrastar slots entre camadas no painel direito de camadas:

- Logo está na Camada 0 → arrasta pra Aplique 1
- Logo agora é gravação dentro do aplique
- Sistema **sugere ajustes** (modal): "Mudar operação pra `gravacao-aplique`?
  Mudar máquina pra `fiber-laser`?"

**Não automático no MVP** — sugestão sempre, decisão do Gabriell. Quando
acumular regras suficientes, evolui pra ajuste automático na Fase 2.

### 4.4 Topbar do canvas — chips de filtro de padrões

Padrões disponíveis aparecem **inline no canvas**, não em tela separada:

```
┌──────────────────────────────────────────────┐
│ PADRÕES DISPONÍVEIS  [todos] [com-traço]    │  ← chips
│                      [sem-traço] [...]       │
├──────────────────────────────────────────────┤
│  [thumb 1] [thumb 2] [thumb 3] [thumb 4]    │  ← previews
└──────────────────────────────────────────────┘
```

**Comportamento:**

- Chip ativo destaca em cor `laser` (vermelho `#dc2626`)
- Click no chip filtra os thumbnails
- Click no thumbnail troca o padrão no canvas em tempo real
- Operador navega padrões sem sair da tela de trabalho

### 4.5 Painel direito de camadas — Opção D-completa

Painel idêntico nos 2 modos (Operador e Designer):

- Lista de camadas (visibility, lock, nome)
- Chip de operação com cor semântica
- Chip(s) de máquina(s) atribuída(s)
- Drag-and-drop pra reordenar / mover entre grupos

**Por quê não esconder no Operador:** atendimento ao cliente exige
visibilidade total. Operador precisa entender o que vai pra cada
máquina pra responder dúvidas em tempo real.

### 4.6 Operador vs Designer é layout, não permissão

Mesmas funções nos 2 modos. **Diferença é layout:**

**Operador:**

- Layout enxuto, foco no fluxo de atendimento
- Sidebar esquerda hierárquica (Produto → Material → Cor → Padrão → Campos)
- Topbar de chips de padrões
- Painel direito de camadas
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

---

## 5. Conceito de roteamento por máquina (CRÍTICO)

Esta é a peça que **diferencia** o Capi Studio de qualquer ferramenta
genérica. Documenta com cuidado.

### Exemplo real do Gabriell — Broche

```
BROCHE
├── Máquina 1: NADA
├── Máquina 2: contorno do material + gravação
└── Máquina 3: NADA
```

**Por que máquina 1 não corta o broche?** Porque o broche já vem cortado
de fábrica. Ele só precisa do contorno como **referência de
centralização** + base do mockup pra aplicar textura. Mas o **arquivo**
do broche não vai pra máquina nenhuma — só serve como guia.

### Exemplo real do Gabriell — Placa

```
PLACA
├── Máquina 1: corte do material + marcação das letras
│            + marcação do aplique 2
│   (aplique 1 não precisa marcar, fica de fora desse arquivo)
│
├── Máquina 2: arquivos de corte dos apliques 1 e 2
│            + gravação que vai DENTRO dos apliques
│
└── Máquina 3: corte das letras
    (usa o mesmo arquivo de marcação como base)
```

### Princípio de design extraído

Cada **elemento** do canvas (logo, aplique, fonte, contorno) responde a
**3 perguntas**:

1. **Vou pra qual(is) máquina(s)?** (0, 1, 2 ou 3 máquinas)
2. **Em cada máquina, sou que tipo de operação?** (corte / marcação / gravação)
3. **Estou DENTRO de outro elemento?** (gravação dentro de aplique vs
   gravação solta na camada base — comportam-se diferente)

### Regras de comportamento

- **Mesmo arquivo SVG pode ir pra 2 máquinas com operações diferentes**
  (ex: marcação na máquina 1 + corte na máquina 3 — usa o mesmo SVG
  fonte, máquinas executam ações diferentes)
- **Gravação tem 2 contextos** (ver glossário seção 3)
- **Brilho/textura no mockup ≠ destino do arquivo**:
  - Aplique de acrílico dourado: textura dourada no mockup, SVG vai pra
    máquina 2 como corte
  - Gravação na camada 0: cor preta no mockup, SVG vai pra máquina 1
    como gravação

### Implicação arquitetural pro MVP

A Onda 9 (exportação SVG) é onde isso vira código. Mas o **schema atual
já comporta** todo esse conceito:

```ts
LayerMeta = {
  kind: 'visual' | 'production',
  operation: 'contorno' | 'corte' | 'corte-laser' | 'gravacao'
           | 'marcacao' | 'aplique' | 'gravacao-aplique' | null,
  machines: string[]  // 0, 1, 2 ou 3 máquinas
}
```

✅ Não precisa mudar schema. Só precisa de UI inteligente pra preencher
e de algoritmo de export que respeite as regras.

---

## 6. Fluxo ideal de atendimento ao cliente

```
1. Cliente chega: "quero um broche assim [foto]"
2. Gabriell abre Capi Studio
3. Sidebar esquerda: escolhe Produto → Material → Cor → Padrão
4. Em < 1 minuto, encontra padrão similar
5. Aplica logo do cliente, nome, profissão (campos dinâmicos)
6. Mostra mockup com textura (PNG bonito)
7. Cliente aprova ou pede ajuste
8. Ajuste fino (mover, trocar fonte, trocar cor) sem trocar de modo
9. Cliente aprova
10. Aperta "Aprovar pedido"
11. Sistema gera automaticamente:
    - PNG mockup pro arquivo do cliente
    - SVGs separados por máquina pro setor de produção
    - Pedido salvo no histórico
```

**Métrica de sucesso:** 80% dos atendimentos resolvidos em **< 5 minutos**.

**Casos de exceção (~20%):**

- Cliente quer alteração específica de alinhamento
- Cliente quer 2 logos
- Cliente quer fonte que não está no banco
- Padrão novo que precisa ser criado do zero

→ Modo Operador atende a maioria via "Adicionar campo" + ajustes finos.
→ Modo Designer atende casos que precisam de slots novos do zero.

---

## 7. Banco de elementos reutilizáveis (visão completa)

Hoje, o schema cobre `logos`, `svg_bases`, `fonts`, `materials`,
`patterns`. Mas Gabriell descreveu **categorias visuais** de elementos
que ainda não estão formalizadas como UI:

### 7.1 Banco de curvas e linhas padrão

> "Quero um banco de curvas e linhas padrões que uso, é para dar
> acabamento."

**Exemplo:** traço entre logo e nome no broche, linha decorativa em
volta de placa, ornamentos.

**Implicação:** `svg_bases` já comporta. UI categoriza como
"Acabamentos" ou "Ornamentos". Sub-aba do Banco de Ativos na Onda 10.

### 7.2 Banco de apliques

**Exemplo:** os 2 apliques de bronze da placa Luh Nicolau. SVGs com
texturas associadas usados repetidamente.

**Implicação:** `svg_bases` + categoria "Aplique" + texture sugerida
vinculada. Onda 10 ou 5.5.

### 7.3 Banco de fontes (com histórico de uso)

> "Já fiz uns 400 broches assim, uns 300 com as mesmas fontes."

**Implicação:** `fonts` já existe. Adicionar campo `usage_count` ou
tabela `pattern_fonts`. Não bloqueia MVP. Refinamento Onda 10+.

### 7.4 Banco de logos do cliente

Já planejado: schema tem `logos`, banco auto-alimentado conforme pedidos
forem feitos. UI vai na Onda 10.

### 7.5 Conjunto de fontes pré-definidos (visão futura)

> "Conjunto de fontes padrão (fonte X pra nome, fonte X pra profissão),
> nome longo, nome curto, traço."

**Implicação:** abstração futura — "preset de fontes" que aplica fonte
diferente em cada slot ao mesmo tempo. Simplifica criação de padrões
similares. Backlog Fase 2.

---

## 8. Otimizações de arquivo (Fase 2 — features avançadas)

Esses são os "patos brilhantes" que Gabriell mencionou — **NÃO entram
no MVP**, mas o produto fica medíocre sem eles. Documentar agora pra
priorizar Fase 2.

### 8.1 Tirar miolo automático ("Hollow letters")

**Problema:** quando Gabriell faz marcação onde vai colar letra de
acrílico, ele não precisa do miolo das letras — só do contorno externo.

**Exemplo:** letra B → tira o SVG das duas bolinhas internas, fica só o
contorno externo.

**Por que precisa:** otimiza tempo de máquina (não risca o miolo à toa)

- economiza material.

**Complexidade técnica:** parsing de SVG, detecção de holes, geração de
path otimizado. **Médio-alto.**

**Quando:** Fase 2, depois do MVP estar em uso.

### 8.2 Nesting automático

**Problema:** quando Gabriell manda 30 letras pra máquina 3, hoje ele
acomoda manualmente no Corel pra otimizar uso de chapa. Trabalho
repetitivo.

**Visão:** sistema empacota automaticamente os SVGs no menor espaço
possível antes de exportar.

**Complexidade técnica:** algoritmo de bin packing 2D irregular.
**Alto.** Bibliotecas existem (SVGNest, Deepnest), avaliar integração.

**Quando:** Fase 2.

### 8.3 Detecção automática de operação por contexto

**Princípio do Gabriell:**

- Gravação dentro de aplique → vira "gravação no aplique"
- Gravação solta na camada 0 → vira "gravação direta no material"

**Visão:** sistema detecta automaticamente baseado em hierarquia visual
e propõe operação correta (modal de sugestão B já formalizado em
ADR 009).

**Complexidade técnica:** baixa-média (geometric containment check).
**Quando:** Fase 2, refinamento pós-MVP.

### 8.4 Aprovação 1-clique → arquivos certos

**Visão:** botão "Aprovar pedido" gera automaticamente:

- PNG pro cliente
- SVGs separados por máquina
- Salva no histórico
- (Fase 3) Notifica setor de produção

**Implicação MVP:** Onda 9 já implementa export. Onda 11/12 polem o
fluxo. **Fase 2** adiciona automação completa.

### 8.5 IA para busca visual de padrões

> "Gostaria de IA (mais pra frente aaaaaaaainda)."

**Visão:** cliente manda foto, sistema sugere padrões similares do
banco usando embeddings visuais.

**Complexidade técnica:** alta. Requer modelo de visão computacional,
infra de embeddings, dataset rotulado.

**Quando:** Fase 3 (longo prazo).

---

## 9. Migração dos broches existentes — curadoria controlada

Gabriell tem **anos de trabalho** (milhares de broches) salvos em
arquivos. Decisão:

> "Gostaria de fazer uma curadoria neles, filtrar bem, e incluir no
> programa, controlado."

**Princípio:** **NÃO migrar em massa.** Curadoria manual, controlada.

**Como vai acontecer:**

- Gabriell escolhe broches valiosos (top performers, padrões mais usados)
- Importa via UI da Onda 10 (Banco de Ativos)
- Categoriza com tags ao importar
- Volume estimado: ~50-100 padrões curados, não milhares

**Por quê não migrar tudo:**

- Qualidade > quantidade no banco
- Padrões antigos ruins poluem busca
- Curadoria é onde fica o valor real

**Quando começa:** **depois do MVP fechar.** Onda 10 entrega a UI de
import; Gabriell faz curadoria offline depois.

---

## 10. Princípio guia: "fazer muito com pouco"

Síntese final do Gabriell:

> "É fazer muito com pouco. São poucos processos. Só muda algumas
> regras."

**Tradução em decisões de produto:**

- ✅ Schema simples mas extensível (config como JSON, não 50 colunas)
- ✅ UI com poucas telas (4 cards na Home)
- ✅ Roteamento de máquina por regras configuráveis, não código
- ✅ Atalhos de teclado pra fluxo rápido
- ✅ Banco de padrões > criação do zero (template-first)
- ❌ Evitar features que parecem poderosas mas raramente são usadas
- ❌ Evitar customização excessiva que confunde mais que ajuda

---

## 11. Como esta visão informa as ondas atuais

### Onda 5 (atual) — Texturas

**Mantém escopo.** Visão estendida não muda nada — texturas são
pré-requisito. Layout sidebar/topbar formalizado em ADR 009 mas
implementação UI fica em ondas posteriores.

### Onda 6 — Painel de camadas

**Refina UI.** Painel deve mostrar:

- Toggle visibilidade
- Toggle lock
- Nome da camada
- **Chip de operação** (cor + label) — visível nos 2 modos
- Chip de máquina(s) atribuída(s) — visível nos 2 modos
- Drag-and-drop entre camadas + modal de sugestão (Opção B)
- Editor de tags (apenas Designer)

### Onda 7 — Alinhamento

**Mantém escopo.**

### Onda 8 — Padrões + slots persistentes

**Refina UI.** Sidebar esquerda hierárquica entra aqui (Produto →
Material → Cor → Padrão → Campos dinâmicos).

### Onda 9 — Exportação SVG

**Refina algoritmo.** O algoritmo de export deve:

- Filtrar por máquina (cada máquina recebe só o que precisa)
- Distinguir gravação dentro-de-aplique vs gravação na camada 0
- Naming consistente: `{pedido}_{máquina}.svg`
- (Fase 2) Adicionar nesting automático
- (Fase 2) Adicionar tirar miolo automático

### Onda 10 — Banco de Ativos

**Refina aba "SVGs Base":** sub-categorias visíveis:

- Acabamentos (curvas, linhas, ornamentos)
- Apliques
- Logos
- Símbolos genéricos

UI de **curadoria/import controlado** dos broches existentes.

---

## 12. O que NÃO mudar com base nesta visão

Apesar da expansão de escopo descrita, estas decisões permanecem
travadas:

- ✅ MVP entrega Editor + Banco de templates + Banco de artes
- ✅ 14 ondas no roadmap, sem reordenar
- ✅ Schema atual é suficiente (não criar tabelas novas pra Fase 2 agora)
- ✅ Tauri + React + Fabric + SQLite + Drizzle (stack travada)
- ✅ Single-user local
- ✅ Sem integrações externas no MVP
- ✅ Sem multi-usuário no MVP

---

## 13. Compromisso de revisão

Este documento deve ser **revisado ao final de cada onda** pra
verificar se alguma decisão técnica do MVP está desviando da visão.

Se desviar, **opções**:

1. Ajustar implementação pra realinhar
2. Adicionar follow-up no backlog
3. Ajustar a visão (com justificativa)

---

_Última atualização: 2026-05-06 — durante calibração da Onda 5_
_Próxima revisão: ao fechar Onda 5_
