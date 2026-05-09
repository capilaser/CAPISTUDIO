# 📋 Capi Studio v2 — Requisitos Funcionais

**Versão:** MVP 1.0
**Plataforma:** Windows desktop
**Stack:** Tauri 2.0 + React 18 + TypeScript + Fabric.js 6 + SQLite + Drizzle ORM + shadcn/ui + Tailwind

---

## 0. Princípios não-negociáveis (do CLAUDE.md atual)

Estes princípios atravessam **todos** os requisitos abaixo. Se um requisito conflita com um princípio, **o princípio vence**.

1. **O canvas é o coração do sistema.** Toda lógica gira em torno dele.
2. **Padrão Mestre vs Arte do Pedido são entidades separadas.** Salvar pedido nunca altera o padrão.
3. **Operador não desenha.** Operador escolhe padrão, preenche campos, exporta.
4. **Funcionalidade > usabilidade > velocidade > clareza > estética** — nessa ordem.
5. **Não virar Canva.** Edição livre é fora do escopo. Ajuste fino sim, criação livre não.
6. **Camadas têm tipo.** `visual` (renderiza no PNG) ou `production` (vai pra SVG de máquina).
7. **Aproveitar o conhecimento de domínio do v1.** Não é rewrite jogando tudo fora — é re-implementação informada.

---

## 1. Autenticação

### RF-1.1 Login local

- App roda **single-user** no MVP. Login simples com senha local guardada com hash (bcrypt).
- Senha definida no primeiro boot via tela de setup.
- Sessão persiste enquanto o app está aberto (sem timeout).

### RF-1.2 Reset de senha

- Recuperação via arquivo de seed gerado no setup (instrução clara: "guarde em local seguro").

> **Fora do escopo MVP:** OAuth, multi-usuário, perfis, RBAC. Backlog Fase 2.

---

## 2. Tela: Home

### RF-2.1 Layout

- 4 atalhos visuais grandes (cards):
  1. **Novo Padrão** → abre Canvas em modo criação
  2. **Abrir Padrão** → abre Grid de Padrões
  3. **Histórico de Artes** → abre Grid de Histórico
  4. **Banco de Ativos** → abre tela de gerenciamento de assets

### RF-2.2 Dashboard mínimo

- Contadores: nº de padrões, nº de artes geradas (total e últimos 7 dias).
- Sem gráficos. Apenas números.

### RF-2.3 Acesso rápido

- Lista das 5 últimas artes editadas (clique abre direto no canvas em modo edição).

---

## 3. Tela: Canvas (Editor)

### RF-3.1 Modos do canvas

O canvas tem **dois modos** numa interface única (sem trocar de tela):

- **Modo Operador** (padrão): mostra apenas os campos editáveis do padrão (logo, nome, profissão), com mockup texturizado em tempo real. Toolbar enxuta.
- **Modo Designer**: ativado pelo botão "Edição Avançada" (toggle persistente na sessão). Libera toolbar completa: camadas, alinhamento, snap, manipulação vetorial, propriedades numéricas em mm.

### RF-3.2 Toolbar do Modo Operador

- Trocar logo (upload SVG/DXF/PNG ou escolher do banco)
- Editar nome (input de texto + seletor de fonte)
- Editar profissão (input de texto + seletor de fonte)
- Trocar textura/material
- Trocar cor (do material aplicado)
- Botão "Edição Avançada" (toggle)
- Botão "Salvar como pedido"
- Botão "Exportar PNG (cliente)"
- Botão "Exportar SVG (corte)"

### RF-3.3 Toolbar do Modo Designer

Adiciona ao toolbar Operador:

- **Camadas**: lista hierárquica (estilo Photoshop), drag para reordenar, toggle visibilidade, lock, agrupar/desagrupar.
- **Alinhamento** (estilo Confluence): centralizar H, centralizar V, alinhar por borda (top/bottom/left/right), distribuir, snap on/off.
- **Propriedades numéricas**: X, Y, W, H em **milímetros** (precisão 0,1mm). Setas e Shift+seta (10×).
- **Operações vetoriais**: ungroup (Ctrl+U), ciclo de operação (Ctrl+K), duplicar (Ctrl+D), deletar (Del).
- **Régua e guias**: réguas mm nas bordas. Guias arrastáveis. Snap a guias e a outros objetos.
- **Histórico**: undo/redo (Ctrl+Z / Ctrl+Shift+Z) com no mínimo 50 níveis.

### RF-3.4 Sistema de camadas (CRÍTICO)

Toda camada carrega obrigatoriamente:

- `kind`: `"visual"` ou `"production"`
- Se `kind === "production"`: obrigatório `operation` (1 de 7 do catálogo) + `machines` (array com 1 a 3 máquinas)
- `name`, `zIndex`, `visible`, `locked`

Painel de camadas mostra:

- Nome da camada
- Chip colorido da operação (cor do `operations.defaultColor`)
- Chips das máquinas atribuídas
- Botão para abrir editor de tags (operação + máquinas)

### RF-3.5 Renderização em tempo real

- Qualquer alteração nos campos (texto, logo, textura) reflete no canvas em **menos de 100ms**.
- Auto-fit de texto preserva o nome do `fitText` do v1: reduz tamanho da fonte progressivamente sem quebrar linha, respeitando `maxArea` do slot.
- Aplicação de textura: PNG é clipado pelo SVG da base (mesmo comportamento de `applyMaterialToSvg` do v1).

### RF-3.6 Áreas demarcadas (slots)

Ao criar padrão (Modo Designer), o usuário pode demarcar áreas:

- Slot de **Logo**: área retangular onde a logo do cliente vai. Auto-center + auto-fit.
- Slot de **Nome**: área de texto. Auto-fit (sem quebra). Fonte selecionável.
- Slot de **Profissão**: idem nome.
- Slot **Custom**: tipo "outro", recebe nome livre.

Slots têm posição (mm) + área máxima (mm). Visíveis no Modo Designer (overlay tracejado), invisíveis no Modo Operador (apenas o conteúdo aparece).

### RF-3.7 Atalhos obrigatórios

| Atalho             | Ação                      |
| ------------------ | ------------------------- |
| Ctrl+Z / Ctrl+Y    | Undo / Redo               |
| Ctrl+S             | Salvar pedido             |
| Ctrl+Shift+S       | Salvar como novo padrão   |
| Ctrl+E             | Exportar PNG              |
| Ctrl+Shift+E       | Exportar SVGs de produção |
| Ctrl+U             | Ungroup SVG selecionado   |
| Ctrl+K             | Ciclar operação da camada |
| Ctrl+D             | Duplicar                  |
| Del                | Deletar                   |
| Ctrl++ / Ctrl+-    | Zoom in / out             |
| Ctrl+0             | Zoom fit                  |
| Ctrl+1             | Zoom 100%                 |
| Setas              | Mover 1mm                 |
| Shift+Setas        | Mover 10mm                |
| Alt+Setas          | Mover 0,1mm               |
| Espaço (segurando) | Pan no canvas             |

### RF-3.8 Salvamento (3 intenções distintas — regra do CLAUDE.md)

1. **Salvar pedido**: cria/atualiza registro em `orders`. **Não toca em `patterns`.**
2. **Salvar como novo padrão**: cria registro em `patterns` com snapshot do canvas atual. Pede nome.
3. **Atualizar padrão mestre**: só aparece em modo edição de padrão. Confirmação dupla obrigatória (modal: "Tem certeza? Isso afeta TODOS os pedidos futuros que usarem este padrão.").

### RF-3.9 Exportação dual

- **PNG mockup**: render visual com texturas, dimensões 300 DPI baseadas no produto. Pra enviar ao cliente.
- **SVG de corte**: 1 arquivo por máquina envolvida no pedido. Nome `{labelPedido}_{Maquina}.svg`. Conteúdo: apenas camadas `production`, agrupadas por operação dentro de `<g>`s. Sem texturas, curvas puras.

Equivalente exato do `exportProductionSVGs()` do v1.

---

## 4. Tela: Grid de Padrões

### RF-4.1 Layout

- Grid de cards com preview visual do padrão (thumbnail do canvas).
- Cada card mostra: nome, produto associado, badges de tags, indicador de favorito.
- Filtros laterais (sidebar): produto, wave (1 estrutural / 2 visual), tags.
- Busca por nome no topo.
- Ordenação: mais recente / mais usado / alfabético.

### RF-4.2 Ações por card

- Clicar → abre Canvas em modo edição com o padrão carregado.
- Menu de contexto: duplicar, renomear, marcar favorito, deletar (soft).

### RF-4.3 Visualização rápida

- Hover no card mostra preview em tamanho maior (sem clicar).

---

## 5. Tela: Histórico de Artes

### RF-5.1 Layout

- Grid de cards com preview do PNG mockup gerado.
- Cada card: label da arte (ex: "João Silva - Advogado"), data, padrão de origem (badge), toggle Pendente/Aprovado.
- Filtros: status (Todas / Pendentes / Aprovadas), padrão de origem, intervalo de datas.
- Busca por label.

### RF-5.2 Toggle Aprovado/Pendente

- Clique no toggle inverte status. Salvo imediatamente (sem confirmação).

### RF-5.3 Detalhe da arte

- Clique no card abre modal/página de detalhe com:
  - Preview grande do PNG
  - Metadados (data, padrão, máquinas envolvidas, campos preenchidos)
  - Botões: **Baixar PNG**, **Baixar SVG(s) de corte**, **Reabrir no canvas**, **Duplicar**, **Deletar**
- Reabrir no canvas abre em **modo edição da arte** (não do padrão) — alterações só afetam aquela arte.

---

## 6. Tela: Banco de Ativos

### RF-6.1 Layout

- 8 abas no topo: **SVGs Base** | **Padrões** | **Fontes** | **Logos** | **Mockups (Materiais)** | **Apliques** | **Gravações** | **Categorias**
- Dentro de cada aba: grid/lista do conteúdo + botão "Adicionar novo" + busca.

> **Nota pós-Onda 8:** as abas Apliques e Gravações foram adicionadas após decisão de produto formalizar bancos de componentes reutilizáveis (Onda 6.5 entregou Apliques; Onda 8.5 entrega Gravações).

### RF-6.2 Aba SVGs Base

- Upload de SVG/DXF (drag and drop ou botão).
- Cada SVG: thumbnail, nome, dimensões em mm (extraídas automaticamente do viewBox), produto associado (opcional), tags.
- Ações: renomear, deletar, atribuir a produto, adicionar tags.

### RF-6.3 Aba Padrões

- Mesma listagem do "Grid de Padrões" da Home, mas com visão organizacional.
- Permite editar metadados (nome, descrição, tags, wave) sem abrir o canvas.
- Permite mover entre categorias.

### RF-6.4 Aba Fontes

- Upload de TTF/OTF.
- Cada fonte: nome de exibição, family, preview ("The quick brown fox..." e variação em PT-BR).
- Ações: renomear display name, deletar.

### RF-6.5 Aba Logos

- Lista de logos usadas em pedidos (alimentada automaticamente).
- Cada logo: thumbnail, nome (cliente), tags, data do último uso.
- Ações: renomear, adicionar tags, deletar (com confirmação se em uso por algum pedido).
- Upload manual também permitido (pra pré-cadastrar logos sem precisar criar pedido).

### RF-6.6 Aba Mockups (Materiais / Texturas)

- Lista de PNGs de material/textura.
- Agrupados por família — famílias confirmadas no MVP:
  - **ABS Escovado** (Bronze, Dourado, Prata, Rose Gold) — pra broches
  - **Acrílico Espelhado** (Dourado, Prata, Rose Gold) — pra placas
  - **Acrílico Sólido** (Branco, Preto) — pra placas
- Ações: upload novo, atribuir a produto (compatibilidade), renomear, deletar.

### RF-6.7 Aba Apliques (entregue na Onda 6.5)

- Lista de SVGs de formato (Formato D, Quadrado, Pill, e os que vierem).
- Cada aplique: thumbnail, nome, dimensões em mm.
- Ações: upload novo SVG (passa pelo parser Corel), renomear, deletar.
- Apliques são "tijolos genéricos" de formato — recebem gravações por cima no canvas.

### RF-6.8 Aba Gravações (entregue na Onda 8.5)

- Lista de SVGs vetorizados reutilizáveis (balança, palavra "Advogado", etc).
- Agrupados por categoria (uso `categories.scope='engraving'`).
- Categoria inicial obrigatória: **"Profissões"**.
- Cada gravação: thumbnail, nome, dimensões em mm, categoria.
- Ações: upload novo SVG (passa pelo parser Corel), renomear, mover entre categorias, deletar.
- **Origem dos SVGs:** exportados do Corel (texto convertido em curvas + objeto exportado como SVG). Procedimento operacional do Gabriell.
- **Restrição empírica:** algumas fontes "bugam" no SVG do Corel — Gabriell evita essas fontes. Sem lista escrita; é conhecimento do operador.
- **Diferença de `logos`:** gravação é catálogo reutilizável do Designer; logo é asset do cliente final.

### RF-6.9 Aba Categorias

- Lista de tags/categorias gerenciáveis.
- Cada categoria: nome, escopo (padrão/produto/logo/svg), cor (hex).
- Ações: criar, editar, mesclar (merge entre 2 categorias), deletar.

---

## 7. Sistema de Alinhamento (referência: Confluence)

### RF-7.1 Linhas-guia inteligentes

- Quando arrasta um objeto, exibir linhas tracejadas mostrando alinhamento com:
  - Centro horizontal/vertical do canvas
  - Bordas e centros de outros objetos
  - Espaçamento equidistante entre objetos (3+ objetos)
- Snap automático com tolerância de 2px (configurável).

### RF-7.2 Indicação de distâncias

- Ao selecionar 2+ objetos, mostrar distâncias entre eles em mm (como o Figma).

### RF-7.3 Comandos de alinhamento (toolbar)

- Alinhar à esquerda / centro horizontal / direita
- Alinhar ao topo / centro vertical / base
- Distribuir horizontalmente / verticalmente

### RF-7.4 Réguas

- Réguas em mm nas bordas superior e esquerda do canvas.
- Guias arrastáveis (do clique e arrasto da régua pra dentro do canvas).

---

## 8. Performance

### RF-8.1 Tempos máximos

- Boot do app: ≤ 3s até a Home renderizar.
- Abrir padrão no canvas: ≤ 1s.
- Trocar campo de texto: re-render em ≤ 100ms.
- Trocar textura: re-render em ≤ 200ms.
- Exportar PNG: ≤ 2s para broche 60×25 a 300 DPI.
- Exportar SVGs de produção: ≤ 1s para 1-3 máquinas.

### RF-8.2 Limites técnicos

- Suporte a padrões com até 50 camadas sem degradação visível.
- SQLite com até 10.000 pedidos sem lentidão de busca.

---

## 9. Erros e validações

### RF-9.1 Validação de camada de produção

- Tentar salvar padrão com camada `production` sem `operation` → bloqueia salvamento, mostra erro inline.
- Tentar salvar com camada `production` sem máquina atribuída → idem.

### RF-9.2 Validação de área útil

- Avisar (warning, não bloqueia) se um slot extrapola a área útil definida no produto.

### RF-9.3 Erros de export

- Falha na escrita de arquivo: notificação com sugestão de mudar pasta de destino.
- Pasta de export padrão: `{appData}/Capi Studio/exports/{ano}/{mes}/`.

### RF-9.4 Mensagens

- **Nunca** usar `alert()` ou `prompt()` nativos. Usar componentes do shadcn (`AlertDialog`, `Sonner` para toasts).

---

## 10. Telemetria local (opt-out)

### RF-10.1 Logs locais

- Erros logados em `{appData}/Capi Studio/logs/error-{data}.log`.
- Ações de export logadas em `export_history` (já no schema).
- **Nada enviado pra fora**. Tudo local.

---

## 11. Atualizações

### RF-11.1 Updater

- Tauri Updater configurado, mas apontando inicialmente pra **endpoint local** (sem servidor de updates no MVP).
- Atualização manual: usuário baixa novo `.msi` e instala por cima. Banco e assets preservados.

---

## 12. Critério de aceitação do MVP

> **Atualização pós-Onda 8:** estratégia travada é **construir o produto inteiro de forma sólida antes de testar com clientes**. A operação que o Capi Studio v2 automatiza já é validada na prática diária do Gabriell — o critério de pronto é **substituir o fluxo do Corel**, não validar mercado.

### 12.1 Critério principal — Substituir o Corel

O MVP só é considerado pronto quando o Gabriell consegue **fechar um pedido completo sem abrir o Corel**:

1. ✅ Abrir o app em ≤ 3s
2. ✅ Escolher um produto na Home → "Novo Padrão"
3. ✅ Carregar a base do produto (SVG do banco)
4. ✅ Escolher textura/material (ABS Escovado, Acrílico Espelhado ou Acrílico Sólido)
5. ✅ Demarcar slots de logo, nome, profissão
6. ✅ Adicionar apliques (Formato D, Quadrado, Pill — banco de apliques)
7. ✅ Adicionar gravações sobre apliques (balança, palavra "Advogado", etc — banco de gravações)
8. ✅ Salvar como padrão (com nome humano)
9. ✅ Voltar à Home → "Abrir Padrão"
10. ✅ Selecionar o padrão criado → canvas abre carregado
11. ✅ Preencher os campos (logo upload, nome, profissão)
12. ✅ Ver arte no canvas em tempo real
13. ✅ Usar Modo Designer pra ajuste fino (mover nome 0,5mm pra cima — painel de alinhamento)
14. ✅ Salvar como pedido (com label "João Silva - Advogado")
15. ✅ Exportar PNG mockup (vai pro `exports/`)
16. ✅ Voltar ao Histórico → marcar como Aprovado
17. ✅ Reabrir o pedido → exportar SVG de corte (1 SVG por máquina envolvida)
18. ✅ Verificar: padrão mestre intacto, pedido salvo com overrides
19. ✅ **Resultado:** Corel não foi aberto em momento nenhum

**Todos esses passos com:** sem alert nativo, sem perda de dados, sem trava de UI > 200ms.

### 12.2 Critério de qualidade — Não vender em fatias

- ❌ Onda intermediária NÃO conta como "produto vendável" — entrega parcial não substitui o Corel
- ❌ Não pular ondas pra "ir mais rápido"
- ✅ Cada onda fecha completa (Plano → Implementação → Validação → Commit)
- ✅ Pós-MVP: ajustes pontuais e atualizações projetadas, não reescrita

### 12.3 Sequência travada das ondas até o MVP completo

(Atualizado pós-Onda 8. Ver detalhes no `05-BACKLOG.md` e `03-CLAUDE-CODE-KICKOFF.md`)

| Ordem | Onda                                                 | Status      |
| ----- | ---------------------------------------------------- | ----------- |
| -     | Ondas 0–6.5, 8                                       | ✅ Fechadas |
| 1     | Mini-9.5 — Cadastrar 5 materiais novos (Acrílico)    | ⏭️ Próxima  |
| 2     | Onda 7 — Painel hierárquico + alinhamento Confluence | ⏳          |
| 3     | Onda 8.5 — Gravações sobre apliques                  | ⏳          |
| 4     | Onda 9 — Exportação PNG + SVG por máquina            | ⏳          |
| 5     | Onda 10 — Telas restantes (Grid, Histórico, Banco)   | ⏳          |
| 6     | Onda 11 — Atalhos + Undo/Redo (50 níveis)            | ⏳          |
| 7     | Onda 12 — Polimento final + build MSI                | ⏳          |
| 8     | Onda 13 — Validação final + smoke test do MVP        | ⏳          |

> **Onda 6c REMOVIDA** — funcionalidade absorvida pela Onda 7.

---

## 13. Backlog Fase 2 (NÃO entra no MVP)

Documentado pra preservar o conhecimento e justificar arquitetura:

### Pedidos

- Página de pedidos com status (artes a fazer / cobrar info / aguardando confirmação / aprovada / produzida / entregue)
- Cadastro de clientes (CRUD + histórico)
- Dashboard de métricas (faturamento, tempo médio por arte, padrões mais usados)

### Integrações

- Make / Trello / WhatsApp (notificações automáticas, atualização de status)
- **Drive Reader inteligente**: lê pasta sincronizada via Make, parseia arquivo estruturado de pedido, oferece "aplicar este pedido" no template
- API de webhooks pra integração com automações externas

### Catálogo

- Hierarquia de categorias (Produto → Modelo → Categoria → Subcategoria)
- Sistema de variantes (mesmo padrão em diferentes tamanhos)

### Multi-usuário

- Perfis: Designer (acesso total), Operador (apenas Modo Operador), Admin
- Cloud sync opcional (postgres remoto + auth)

### Canvas avançado

- Wave de Produção por Camada: UI completa de máquinas + operações com validações estritas
- Sub-camadas após Ctrl+U posicionadas por bbox real (não herdam `area` original)
- Cores por operação no preview principal (não só overlay)
- Efeitos visuais avançados (sombra, brilho) no mockup
- Histórico visual de versões do padrão (undo entre saves)

### Outros

- Export DXF (hoje só SVG)
- Logo vetorial inlinada como `<g>` no export (hoje detecta SVG e inlina como `<svg>` aninhado)
- Padronizar coordenadas TOP-LEFT em todos os slots
- Testes automatizados do motor de render (visual regression)
