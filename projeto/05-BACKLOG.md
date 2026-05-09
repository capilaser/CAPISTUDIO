# 📌 BACKLOG — Capi Studio v2 (Fase 2 e além)

Este arquivo preserva tudo que **não entra no MVP** mas foi discutido durante a consultoria. Mantém o conhecimento, justifica decisões arquiteturais e organiza prioridades pós-MVP.

---

## Por que existe este arquivo

Durante a consultoria você teve **muitas ideias boas** que não cabem no MVP. Elas estão aqui pra:

1. Não serem esquecidas
2. Justificarem partes do schema/arquitetura que parecem "exageradas" pro MVP mas existem pra suportar essas evoluções
3. Servirem como roadmap claro pós-MVP

---

## 🎯 Estratégia de execução do MVP

> **Decidido pós-Onda 8:** construir o produto inteiro de forma sólida antes de testar com clientes.

A operação que o Capi Studio v2 automatiza já é validada na prática diária do Gabriell — não há "MVP pra validar mercado", há produto completo pra substituir o Corel.

**Sequência travada das ondas restantes:**

| Ordem | Onda                                                                           | Por que essa ordem                                                |
| ----- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| 1     | **Mini-9.5 — Cadastrar 5 materiais novos**                                     | Trabalho pequeno, destrava material correto pras placas           |
| 2     | **Onda 7 — Painel hierárquico + alinhamento**                                  | Designer profissional ANTES de criar mais padrões — evita refazer |
| 3     | **Onda 8.5 — Banco de Gravações + uso no canvas**                              | Antes da Onda 9 — evita refazer pipeline de export                |
| 4     | **Onda 9 — Exportação PNG + SVG por máquina**                                  | Output pra cliente + máquina                                      |
| 5     | **Onda 10 — Telas restantes** (Grid Padrões, Histórico, Banco Ativos completo) | Navegação completa                                                |
| 6     | **Onda 11 — Atalhos + Undo/Redo (50 níveis)**                                  | UX profissional                                                   |
| 7     | **Onda 12 — Polimento final + build MSI**                                      | Instalador Windows pronto                                         |
| 8     | **Onda 13 — Validação final + smoke test**                                     | QA do produto inteiro                                             |

**Não pular ondas. Não vender em fatias intermediárias. Pós-MVP: ajustes pontuais e atualizações projetadas, não reescrita.**

---

## 📋 Escopo refinado da Onda 8.5 — Banco de Gravações

> **Refinamento decidido pós-Onda 8** (após Gabriell entregar SVG da Balança da Justiça).

### O que a onda entrega

1. **Cadastro no banco `engravings`** dos SVGs em `assets-pendentes/gravacoes/profissoes/`:
   - `balanca-advogado.svg` (entregue)
   - `advogado-texto.svg` (a entregar pelo Gabriell)
   - Futuras profissões conforme Gabriell for produzindo

2. **Sistema de categorias de gravação**:
   - Categoria inicial: **"Profissões"**
   - Schema já tem `categories` table — usar `scope='engraving'`
   - Categorias futuras (Fase 2): Símbolos, Ornamentos, Decorativos

3. **Aba "Gravações" no UnifiedRightPanel**:
   - Análoga à aba "Apliques" da Onda 6.5
   - Filtro por categoria (dropdown)
   - Grid de cards com preview SVG
   - Clique adiciona gravação ao canvas

4. **Engine: `addEngravingSvg()`**:
   - Análogo a `addAppliqueSvg()` da Onda 6.5
   - Mesmas validações via `parseCorelSvg`
   - Cria `OperationLayerMeta` com `kind: 'operation', operation: 'gravacao'`
   - Posicionamento livre (Gabriell move manualmente sobre o aplique destino)

### Decisões de produto (Gabriell)

- **SVG vetorizado pronto > texto vivo:** Gabriell exporta texto da palavra "Advogado" como SVG do Corel (mesmo método da balança), não texto editável em runtime. Vantagem: controle total da fonte e estilo, simples, faz uma vez por profissão.

- **Restrição de fonte (empírica):** Gabriell descobriu na prática que algumas fontes "bugam" no SVG exportado do Corel. Solução: ele evita essas fontes. Sem lista escrita — conhecimento operacional do dono.

- **Categoria inicial só "Profissões":** Não inflar o banco. Outras categorias entram quando houver demanda real.

### O que NÃO entra na 8.5

- ❌ Texto vetorizado em runtime (gerar SVG do texto baseado em fonte do banco) — fica pra Fase 2 quando houver volume de profissões justificando
- ❌ Editor de gravação dentro do app — Gabriell continua usando Corel pra criar
- ❌ Posicionamento automático sobre apliques — operador move manualmente
- ❌ Categorias adicionais (Símbolos, Ornamentos) — Fase 2 ou quando demandar

### Diferença entre `engravings` e `logos`

| Banco        | O que armazena                                                | Quem cadastra                                        |
| ------------ | ------------------------------------------------------------- | ---------------------------------------------------- |
| `engravings` | Gravações **reutilizáveis** do catálogo (balança, "Advogado") | Designer, 1 vez por categoria                        |
| `logos`      | Logo do **cliente final** (escritório "Silva & Associados")   | Auto-alimentado quando operador faz upload no pedido |

---

## 🪦 Ondas removidas do roadmap

### Onda 6c — Painel de slots agrupado por camada

**Status:** ❌ REMOVIDA

**Por quê:** A funcionalidade que ela entregaria (UI agrupada de slots por camada principal) é coberta pela Onda 7 (Painel de Camadas hierárquico estilo Photoshop). Manter as duas separadas seria redundância.

**Decisão tomada:** consolidar tudo na Onda 7. A Mini-onda 9.5 + Onda 7 substituem completamente o que era 6c.

---

## Fase 2 — Pedidos e CRM (provavelmente próxima onda após MVP)

### Página de Pedidos com Status

- Listagem de pedidos com pipeline de status: artes a fazer · cobrar info do cliente · aguardando confirmação · arte aprovada · em produção · entregue
- Drag-and-drop entre colunas (estilo Trello/Linear)
- Filtros por cliente, data, máquina, status
- Bulk actions (selecionar vários, mudar status em lote)

### Cadastro de Clientes (CRUD)

- Tabela `customers` com nome, contato (email, WhatsApp), endereço, CNPJ/CPF
- Histórico de pedidos por cliente
- Logos do cliente vinculadas (já temos `logos.tags` preparado pra isso)
- Notas/observações do cliente

### Dashboard de Métricas

- Pedidos do mês (gráfico de linha)
- Faturamento estimado (precisa de campo `price` em orders)
- Tempo médio por arte (de criação a aprovação)
- Padrões mais usados (top 10)
- Máquinas mais utilizadas
- Taxa de aprovação de primeira (pedidos aprovados sem reabertura)

---

## Fase 2 — Integrações (poderoso, mas requer trabalho de infra)

### 🌟 Drive Reader Inteligente (a "automação poderosa" que conversamos)

**Fluxo desejado:**

1. Make/Zapier capta pedido externo (formulário, WhatsApp, e-commerce)
2. Joga arquivo estruturado JSON na pasta sincronizada do Google Drive
3. Capi Studio detecta novo arquivo na pasta (file watcher)
4. Parseia campos: cliente, profissão, logo URL, observações
5. Notifica usuário: "Novo pedido detectado: João Silva"
6. Botão "Aplicar este pedido no template X" pré-preenche o canvas

**Implicações técnicas:**

- Precisa de file watcher cross-process (Tauri tem suporte nativo)
- Schema do JSON de entrada precisa ser definido e versionado
- UI de "fila de pedidos pendentes" antes da Home

### Integrações 1:1

- WhatsApp (envio de PNG mockup via API: Twilio, Z-API)
- Trello (criar cards automaticamente quando arte é exportada)
- E-mail (enviar mockup pro cliente direto do app)
- ERP (Bling, Tiny — sincronizar pedidos)

### API de Webhooks

- Endpoint local (ngrok ou Tauri exposto) que recebe webhooks de sistemas externos
- Eventos: novo pedido, aprovação, status change
- Token de autenticação por webhook

---

## Fase 2 — Catálogo Avançado

### Hierarquia de Categorias

**O que conversamos no início:** Produto → Modelo → Categoria → Subcategoria

Exemplo:

```
Placa
 └── Placa Especial
      └── Profissão
           └── Advogado
```

**Implementação:**

- Tabela `category_tree` com self-reference (`parent_id`)
- UI de tree picker no Banco de Ativos > Categorias
- Filtros multi-nível no Grid de Padrões

### Sistema de Variantes

- Mesmo padrão em diferentes tamanhos (broche 60×25, 80×30, 100×40)
- Tabela `pattern_variants` com FK pra `pattern_id` parent
- Auto-scaling de slots quando muda variante

### Tags com Cores e Ícones

- Categorias podem ter cor + ícone (Lucide name)
- Visualização rica em chips e cards

---

## Fase 2 — Multi-usuário

### Perfis e Permissões

- **Designer**: acesso total (criar padrões, editar tudo)
- **Operador**: apenas Modo Operador, não pode criar/editar padrões
- **Admin**: tudo + gerenciamento de usuários

### Cloud Sync (opcional)

- Migrar de SQLite local pra PostgreSQL remoto (Supabase ou self-hosted)
- Sync bidirecional com cache offline
- Auth via NextAuth ou similar
- Conflict resolution (last-write-wins ou manual merge)

---

## Fase 2 — Canvas Avançado

### Wave de Produção por Camada (já planejada arquiteturalmente)

**Estado atual no schema:** os campos `kind`, `operation`, `machines` já estão prontos em `LayerMeta`.

**O que falta:**

- UI completa de validação (não permitir salvar com camada production sem operation/machine)
- Indicação visual no canvas de quais elementos vão pra qual máquina
- Modo "Preview de produção" (mostra como ficaria em cada máquina separadamente)
- Validação de compatibilidade (se a máquina X não suporta operação Y, bloquear)

### Melhorias herdadas do v1

- Sub-camadas após Ctrl+U posicionadas por bbox real (não herdam `area` original)
- Cores por operação no preview SVG principal (não só overlay)
- Logo vetorial inlinada como `<g>` no export (hoje detecta SVG e inlina como `<svg>` aninhado)
- Padronizar coordenadas TOP-LEFT em todos os slots (eliminar conversão)

### Efeitos visuais avançados no mockup

- Sombra projetada do produto
- Brilho/reflexo do material (especular)
- Variação de iluminação (mockup em ambiente claro/escuro)
- Render 3D opcional (broche em perspectiva)

### Histórico Visual de Versões do Padrão

- Cada save do padrão cria snapshot
- Visualização tipo Git history com thumbnails
- Reverter pra versão anterior

### Animações de Preview

- "Como vai ficar gravado" — animação do laser passando sobre o material
- Útil pra visualização de tempo de produção estimado

---

## Fase 2 — Operações de Arquivo

### Export DXF

- Hoje só SVG. DXF é o formato preferido por algumas máquinas mais antigas.
- Library: `@yyhhenry/dxf` ou `dxf-writer`

### Import de outros formatos

- AI (Adobe Illustrator)
- PDF (extrair vetores)
- EPS

### Batch operations

- Exportar todos os pedidos de um cliente em ZIP
- Reaplicar mudança de padrão em múltiplos pedidos antigos (com confirmação)

### Versionamento de assets

- Logos com histórico: cliente mandou logo nova, preservar a antiga
- Comparação visual entre versões

### Upload de produto pelo usuário (substituir ADR 013)

- Hoje `base_svg` da placa-300x90 vem de fixture via seed (ADR 013)
- Pós-MVP: criar fluxo de upload de SVG → cadastrar produto novo → preencher base_svg
- Substitui a estratégia "INSERT OR IGNORE + UPDATE WHERE NULL" por upload real

---

## Fase 2 — Operação Real

### Fila de Produção

- Vincular pedidos a slots de tempo nas máquinas
- Estimativa de tempo por pedido (baseado em comprimento total de gravação/corte)
- Calendário de produção

### Gestão de Estoque de Materiais

- Tracking de chapas/lâminas em estoque
- Alerta de baixo estoque
- Vinculação de pedido → consumo de material

### Custos e Precificação

- Custo por mm² de material
- Custo por minuto de máquina
- Cálculo automático de preço de venda
- Margem configurável

---

## Fase 3 — Plataforma

### Marketplace de Padrões

- Compartilhar/vender padrões entre usuários do Capi Studio
- Curadoria de padrões validados pela comunidade

### IA Assistente

- "Crie um padrão de broche pra advogado" → IA gera variações
- Sugestões de fonte baseadas no contexto da profissão
- Auto-tag de logos por reconhecimento

### Mobile companion

- App mobile pra ver pedidos, aprovar artes, comunicar com cliente
- Não pra edição (canvas precisa de tela grande)

---

## Decisões arquiteturais que esses backlogs justificam

Algumas escolhas do MVP parecem "overkill" mas existem pra suportar evolução:

| Decisão MVP                                           | Justificativa Fase 2                  |
| ----------------------------------------------------- | ------------------------------------- |
| Tabelas `customers`, `order_status_history` previstas | Página de Pedidos + CRM               |
| `logos.tags` como JSON array                          | Vinculação a clientes, busca avançada |
| `LayerMeta.kind` + `machines[]`                       | Wave de Produção por Camada           |
| Drizzle migrations versionadas                        | Migração pra PostgreSQL na cloud      |
| `export_history` separado                             | Auditoria + integrações               |
| Soft delete (`deleted_at`)                            | Restore + auditoria                   |
| `categories.scope`                                    | Hierarquia futura                     |
| Tauri (em vez de só Web)                              | File watcher pra Drive Reader         |

---

## Não-objetivos explícitos (NUNCA serão feitos)

Pra deixar claro o que o produto NÃO é:

- ❌ **Editor de design livre** (Canva, Figma) — Capi é ferramenta de produção, não criação livre
- ❌ **Editor 3D** — produtos são planos, gravação é 2D
- ❌ **Suite de design generalista** — foco exclusivo em personalização para gravação/corte laser
- ❌ **Sistema de e-commerce** — integra com plataformas existentes, não substitui
- ❌ **Software para hobbyista** — é ferramenta profissional pra produção em escala

---

## Como priorizar Fase 2

Quando o MVP completo estiver entregue e em uso, sugestão de ordem:

1. **Drive Reader Inteligente** (alto valor, viabiliza automação completa)
2. **Página de Pedidos com Status** (organização operacional)
3. **Banco de Logos auto-alimentado** (já no MVP, mas refinamento de busca)
4. **Wave de Produção por Camada — UI completa** (já no schema, falta UX)
5. **Cadastro de Clientes** (suporte a CRM básico)
6. **Dashboard de Métricas** (insights de operação)
7. **Integração WhatsApp** (envio direto de mockups)
8. **Hierarquia de Categorias** (escalabilidade do catálogo)
9. **Multi-usuário** (quando a operação crescer)
10. **Cloud sync** (quando precisar de acesso remoto)

---

**Última atualização:** Pós-Onda 8 (commit 17a23ae). Estratégia "produto completo antes de testar" travada. Sequência das ondas restantes definida. Onda 6c removida do roadmap.
