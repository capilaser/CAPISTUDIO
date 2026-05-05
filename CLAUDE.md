# CLAUDE.md — Capi Studio

## Missão do Projeto

O Capi Studio é um sistema desktop para criação de artes, mockups e arquivos de produção para produtos personalizados.

O sistema deve ser profissional, modular, escalável e fácil de manter.

Ele deve permitir criar artes rapidamente, reaproveitar padrões validados, gerar arquivos de pedido e preparar a base para futuras integrações e recursos de produção.

Este projeto deve ser tratado como software sério de empresa, e não como experimento improvisado.

---

## Princípio Central

O **canvas é a base central do sistema**.

Toda a lógica principal do produto gira em torno dele.

O canvas deve ser o centro operacional para:

- aplicar padrões
- preencher campos
- editar arte em tempo real
- visualizar mockup
- alinhar elementos
- fazer ajustes finos
- controlar camadas
- salvar pedido
- reabrir pedido
- exportar arquivos

---

## Pilares do Sistema

O sistema deve ser construído sobre 3 pilares centrais:

1. **Canvas**
2. **Sistema de Produtos**
3. **Sistema de Padrões**

---

## Visão do Produto

O Capi Studio deve funcionar como uma ferramenta operacional para produção de personalizados, com velocidade, reaproveitamento e precisão.

Ele combina ideias de:

- editor visual
- CorelDRAW
- Canva
- ferramenta técnica de produção

Mas a prioridade é:

1. funcionalidade
2. usabilidade
3. velocidade
4. clareza
5. visual limpo

---

## Fluxos Principais

### 1. Arte Rápida

Fluxo principal do MVP.

Objetivo: usar padrões prontos para gerar rapidamente uma arte específica de pedido.

Fluxo:

1. escolher produto
2. escolher base do produto
3. escolher textura/material
4. escolher cor
5. escolher padrão
6. preencher campos
7. visualizar no canvas
8. ajustar se necessário
9. salvar pedido
10. exportar preview e/ou arquivo de produção

---

### 2. Criar Padrões / Produtos

Fluxo de abastecimento do sistema.

Objetivo: criar os produtos, bases, padrões e recursos reutilizáveis do sistema.

Inclui:

- criar produtos
- cadastrar bases SVG/DXF
- cadastrar texturas
- criar padrões
- definir módulos
- definir áreas úteis
- definir campos
- definir regras de posição
- definir regras de tamanho
- definir borda/divisores
- salvar cenários validados

---

## Sistema de Produtos

Produto define a base física e técnica.

Exemplos:

- broche
- placa

Cada produto pode ter:

- id
- nome
- categoria
- largura
- altura
- unidade
- base SVG/DXF
- área útil
- configurações de textura
- regras de exportação
- configurações de produção

### Regra importante da base visual

A base do produto pode funcionar como composição entre:

- **base vetorial**: SVG/DXF
- **textura/material**: PNG
- **elementos aplicados** por cima

Exemplo real do sistema:

- o usuário escolhe uma base de produto em SVG
- depois escolhe a textura
- a textura é um PNG
- esse PNG é carregado dentro da área do SVG/base, cobrindo a área definida

Essa lógica deve ser preservada e bem modelada.

---

## Sistema de Padrões

O sistema de padrões é um dos pilares centrais do Capi Studio.

Ele existe para reaproveitar layouts recorrentes com rapidez.

### Definição de padrão

Um padrão é uma configuração validada de layout aplicada sobre um produto.

Ele pode definir:

- posição de logo
- área máxima da logo
- posição de nome
- área máxima do nome
- posição de profissão
- borda
- divisores/traços
- espaçamentos
- alinhamentos
- módulos ativos
- estrutura do layout

---

### WAVE 1 — Padrões estruturais / posicionais

A primeira wave deve focar em padrões estruturais.

Exemplos:

- com borda
- sem borda
- com 1 traço
- sem traço
- com 2 traços
- logo em área demarcada
- nome em área demarcada
- profissão em área demarcada

Também deve existir:

- destaque de padrões rápidos
- possibilidade de favoritos
- cenários validados prontos para uso

---

### WAVE 2 — Padrões visuais / estilizados

A segunda wave deve focar em padrões mais fechados visualmente.

Podem incluir:

- fonte específica
- cor específica
- material específico
- aplique específico
- logo fixa
- combinação visual pronta

---

## Regra Crítica — Padrão Mestre vs Arte do Pedido

O sistema deve separar claramente:

1. **Padrão mestre**
2. **Arte do pedido**

### Padrão mestre

É o layout validado e reutilizável.

Define:

- estrutura
- posições padrão
- módulos
- áreas máximas
- bordas
- traços
- regras de alinhamento

O padrão mestre não deve ser alterado no fluxo normal de pedidos.

---

### Arte do pedido

Quando o usuário escolhe um padrão e preenche os dados de um cliente, o sistema deve criar uma arte específica do pedido.

Essa arte pode ter:

- nome do cliente
- profissão
- logo do cliente
- ajustes finos
- alterações de alinhamento
- mudanças pequenas de posição
- overrides de escala
- overrides de fonte
- overrides de módulo

### Regra obrigatória

Ao salvar um pedido:

- não alterar o padrão mestre
- criar ou atualizar o arquivo do pedido
- salvar referência ao padrão base
- salvar os campos preenchidos
- salvar os arquivos usados
- salvar os ajustes finos
- salvar overrides de posição, alinhamento, escala e estilo

---

## Regras de Salvamento

Devem existir pelo menos 3 intenções de salvamento:

### 1. Salvar pedido

Uso normal.

Salva a arte do cliente/pedido.

### 2. Salvar como novo padrão

Cria um novo padrão com base no layout atual.

### 3. Atualizar padrão mestre

Ação protegida.

Só deve existir em fluxo de edição de padrão, com confirmação forte.

---

## Sistema de Alinhamento e Ajustes Finos

Mesmo com foco em padrões, o sistema deve permitir ajustes leves em cada arte.

Recursos desejados:

- centralizar horizontalmente
- centralizar verticalmente
- alinhar por borda
- snap
- linhas-guia
- indicação de distâncias
- movimentação precisa
- ajustes finos em milímetros
- possibilidade de ajuste em 0,1 mm

Esses ajustes pertencem à arte do pedido, não ao padrão mestre.

---

## Sistema de Camadas

O canvas deve ter um sistema de camadas forte e organizado.

Cada camada deve poder:

- ser editada
- ser apagada
- ser reordenada
- ser ativada/desativada
- ser selecionada
- receber propriedades

Exemplos de camadas:

- base
- textura
- borda
- logo
- nome
- profissão
- traço/divisor
- aplique
- QR code
- marcações técnicas

---

## Wave Futura — Produção por Camada

Em uma próxima wave, o sistema deve preparar a camada para receber metadados técnicos de produção.

### Máquinas disponíveis

- MB
- FB
- DL

### Cada camada deve ter dois grupos de classificação

#### 1. Tipo de operação — obrigatório

Escolha única obrigatória:

- Corte = preto
- Gravação = vermelho
- Marcação = azul

#### 2. Máquinas — obrigatório escolher ao menos 1

Escolha múltipla:

- MB
- FB
- DL

Regras:

- no mínimo 1 máquina
- no máximo 3 máquinas
- tipo sempre obrigatório
- máquina sempre obrigatória com pelo menos 1 opção marcada

### Regra atual

Nesta fase inicial, isso deve ser tratado como planejamento arquitetural.

Antes de implementar:

1. definir modelo de dados
2. definir UI
3. definir persistência
4. definir impacto na exportação
5. definir impacto no pedido
6. definir impacto no padrão
7. só depois implementar

---

## Estrutura Conceitual Recomendada

A estrutura pode variar conforme a stack, mas a separação de responsabilidades deve existir.

Exemplo conceitual:

```text
src/
  app/
    main/
    renderer/

  core/
    products/
    patterns/
    orders/
    canvas/
    layers/
    alignment/
    export/
    validation/

  data/
    products/
    patterns/
    textures/
    resources/
    sample-orders/

  ui/
    components/
    panels/
    canvas/
    controls/
    layout/

  services/
    file-system/
    image/
    svg/
    storage/

  integrations/
    future/

  assets/
    icons/
    textures/
    mockups/

  docs/
  tests/
```

---

## Separação de Responsabilidades

### Front-end

Responsável por:

- interface
- canvas
- painéis
- inputs
- interação
- feedback visual

### Core

Responsável por:

- regras de produto
- regras de padrão
- regras de pedido
- regras de camadas
- alinhamento
- renderização lógica
- exportação
- validação

### Services

Responsáveis por:

- leitura/escrita de arquivos
- processamento de SVG
- texturas/imagens
- persistência local

### Integrações

Responsáveis por:

- recursos futuros
- APIs externas
- ERP
- automações
- serviços de terceiros

---

## Regras de UX

A interface deve ser:

- compacta
- clara
- rápida
- confortável
- prática
- pensada para produção real

Evitar:

- telas gigantes
- excesso de espaço vazio
- painéis confusos
- informação repetida
- elementos bonitos porém improdutivos

Prioridade:

1. funcionalidade
2. usabilidade
3. clareza
4. velocidade
5. estética

---

## Regras de Código

Preferir:

- funções pequenas
- componentes reutilizáveis
- nomes claros
- tipagem quando possível
- estrutura organizada
- documentação
- testes em regras críticas

Evitar:

- arquivos gigantes
- lógica duplicada
- gambiarras
- interface misturada com regra de negócio
- efeitos colaterais escondidos
- dependências desnecessárias

---

## Processo de Trabalho no Claude Code

Para cada tarefa:

1. ler arquivos relevantes
2. entender antes de alterar
3. explicar diagnóstico
4. propor plano curto
5. aguardar aprovação se a mudança for grande
6. implementar em partes pequenas
7. validar/testar
8. explicar o que mudou
9. listar arquivos alterados
10. apontar próximo passo

---

## Formato Esperado de Resposta ao Alterar Código

Sempre responder com:

```text
Resumo:
- o que foi feito

Arquivos alterados:
- arquivo 1
- arquivo 2

Como testar:
- passo 1
- passo 2

Riscos:
- se houver

Próximo passo recomendado:
- próximo passo
```

---

## Regra para Auditoria do Projeto Piloto

Antes de grandes mudanças, classificar tudo em:

- manter
- refatorar
- reescrever
- descartar
- mover para wave futura

Nunca presumir que:

- tudo do piloto é ruim
- tudo do piloto pode ser mantido

Auditar com critério.

---

## Critério de MVP Pronto

O MVP só pode ser considerado pronto quando o usuário consegue:

1. abrir o app
2. escolher um produto
3. carregar a base do produto
4. escolher textura/material
5. escolher um padrão
6. preencher campos
7. ver a arte no canvas em tempo real
8. usar alinhamento básico
9. fazer pequenos ajustes
10. salvar como pedido
11. reabrir o pedido
12. exportar preview
13. manter o padrão mestre intacto

---

## Proibições

Não fazer:

- refatoração gigante sem plano
- feature nova antes do fluxo principal estar sólido
- editar padrão mestre durante pedido comum
- misturar dados do pedido com estrutura do padrão
- sair implementando wave de máquinas sem planejamento
- criar visual bonito que atrapalha operação
- esconder lógica importante sem documentação

---

## Frase Guia

O Capi Studio deve ser construído como um sistema profissional centrado em canvas, produtos, padrões reutilizáveis e pedidos independentes, com base sólida para evolução técnica e operacional.

---

# Extensões v2 (este repositório)

> Estas regras são aditivas ao CLAUDE.md original (acima). Em conflito, **as regras v2 vencem** porque refletem a stack escolhida.

## Stack obrigatória

- **Shell desktop:** Tauri 2.0 (Rust backend + WebView)
- **Frontend:** React 19 + TypeScript 5 + Vite 7
- **Canvas:** Fabric.js 6.x
- **UI components:** shadcn/ui (style "new-york") + Tailwind 3 + tailwindcss-animate
- **Estado global:** Zustand
- **Banco local:** SQLite via `tauri-plugin-sql`
- **ORM:** Drizzle (type-safe + migrations)
- **Forms:** React Hook Form + Zod
- **Atalhos:** react-hotkeys-hook
- **Ícones:** Lucide React
- **Empacotamento:** Tauri bundler → MSI installer (Windows x64)

Não trocar de stack sem decisão explícita registrada em `docs/DECISIONS/`.

## Estrutura de pastas

A separação obrigatória é:

- `src/app/` — entrypoint React (App.tsx, router.tsx, providers.tsx)
- `src/core/` — regras de negócio puras (zero DOM, testáveis em Node): canvas, patterns, orders, products, alignment, export, validation
- `src/data/` — schema Drizzle + repositories + migrations + seeds
- `src/ui/` — apresentação React (componentes, painéis, páginas, layout). Sem regra de negócio.
- `src/stores/` — stores Zustand
- `src/services/` — side-effects (file system, IPC Tauri, image loading)
- `src/hooks/` — custom React hooks
- `src/lib/` — utils puros (cn, format-mm, …)
- `src/styles/` — Tailwind globals + tokens
- `src-tauri/` — backend Rust + migrations SQL embarcadas
- `tests/` — Vitest + RTL (≥80% cobertura no `core/`)
- `docs/` — ARCHITECTURE.md, DECISIONS/ (ADRs), DOMAIN.md

## Regras de design (skill `frontend-design` aplicado)

Estética: **ferramenta industrial-utilitária refinada** (DAW pro × LightBurn). Não Canva, não Figma.

- Tema **dark por padrão**. Light disponível.
- Paleta tokenizada em `tailwind.config.ts`: `ink-{50..950}`, `laser`, `op-*`, `ok/warn/danger`.
- Fontes: `font-display` e `font-mono` = JetBrains Mono. `font-body` = Geist Variable. **Nunca Inter, Roboto, ou system-ui** como fonte primária.
- `tabular-nums` em qualquer input numérico.
- Focus rings 2px laser-muted, offset 2px.
- Sombras restritas: `shadow-sm` em cards, `shadow-md` em popovers, `shadow-xl` em dialogs.
- Animações 150-200ms ease-out. Sem bounce/spring.

## Proibições absolutas

Em adição às do v1:

- ❌ `alert()`/`prompt()` nativos. Usar `AlertDialog`/`Dialog` do shadcn ou `sonner` toasts.
- ❌ Hardcodar dimensões de produto (60/25). Usar `viewBox` dinâmico.
- ❌ Importar Inter/Roboto/system-ui como fonte primária.
- ❌ Componentes monolíticos > 300 linhas. Quebrar em subcomponentes.
- ❌ Editar `patterns.canvasJson` no fluxo de salvar pedido — só em "Atualizar padrão mestre".
- ❌ Lógica de negócio em componentes UI. Sempre em `core/` ou repositories.
- ❌ Refatoração gigante sem plano aprovado.

## Regra de ouro da reutilização do v1

O v1 (HTML monolítico, em `Downloads/broches-studio_5.html` e/ou repositório separado) é **especificação executável das regras de negócio**, não código a copiar.

**FAÇA:** ler funções (ex: `fitText`, `applyMaterialToSvg`, `extrairContornosInternos`, `buildProductionSVG`) e re-implementar em TS modular com testes unitários.

**NÃO FAÇA:** copiar JS direto, importar jQuery/vanilla DOM imperativo, duplicar lógica do `index.html` em React.

## Roadmap por ondas

Ver `../03-CLAUDE-CODE-KICKOFF.md` (raiz da pasta de planejamento). 13 ondas de Onda 0 (bootstrap) a Onda 13 (validação contra v1).

**Cada onda termina** quando:

1. critério de saída da onda é cumprido
2. typecheck + lint passam
3. testes unitários do `core/` adicionado nesta onda passam (cobertura ≥80%)
4. usuário valida o resultado

Não pular etapas.
