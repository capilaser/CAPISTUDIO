# 📌 BACKLOG — Capi Studio v2 (Fase 2 e além)

Este arquivo preserva tudo que **não entra no MVP** mas foi discutido durante a consultoria. Mantém o conhecimento, justifica decisões arquiteturais e organiza prioridades pós-MVP.

---

## Por que existe este arquivo

Durante a consultoria você teve **muitas ideias boas** que não cabem no MVP. Elas estão aqui pra:

1. Não serem esquecidas
2. Justificarem partes do schema/arquitetura que parecem "exageradas" pro MVP mas existem pra suportar essas evoluções
3. Servirem como roadmap claro pós-MVP

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

## Visão estendida capturada na calibração da Onda 5

Durante a calibração da Onda 5, Gabriell descreveu detalhadamente a
visão completa do produto. Tudo abaixo está formalizado no arquivo
`projeto/06-VISION.md` — esta seção é apenas índice de features
novas que entram no backlog priorizado.

### Categorias novas de elementos no Banco de Ativos

- **Banco de curvas e linhas padrão (acabamentos)**: ornamentos,
  traços decorativos, divisórias. Sub-aba do Banco de Ativos.
  Schema atual (`svg_bases`) já comporta — falta apenas UI de
  categorização. Onda 10.

- **Banco de apliques**: SVGs com texturas associadas que Gabriell
  usa repetidamente (apliques de bronze, dourado). Categoria
  "Aplique" em `svg_bases` + texture sugerida vinculada. Onda 10
  ou 5.5.

- **Histórico de uso de fontes**: rastrear quais fontes são mais
  usadas em quais slots. Adicionar campo `usage_count` em `fonts`
  ou tabela `pattern_fonts`. Refinamento Onda 10+.

- **Conjuntos de fontes pré-definidos (presets)**: abstração que
  aplica fonte diferente em cada slot ao mesmo tempo (ex: "Preset
  Profissional Liberal" = fonte X pra nome + fonte Y pra profissão).
  Simplifica criação de padrões similares. Fase 2.

### Otimizações de exportação (otimizam tempo de máquina)

- **Tirar miolo automático ("hollow letters")**: ao gerar arquivo
  de marcação, remover áreas internas de letras (ex: letra B sem
  as 2 bolinhas internas). Otimiza tempo de máquina, economiza
  material. Complexidade técnica média-alta (parsing SVG, detecção
  de holes). Fase 2.

- **Nesting automático**: empacotar SVGs no menor espaço possível
  antes de exportar pra máquina. Algoritmo de bin packing 2D
  irregular. Bibliotecas existem (SVGNest, Deepnest), avaliar
  integração. Complexidade alta. Fase 2.

- **Detecção automática de operação por contexto**: sistema detecta
  se gravação está dentro de aplique vs solta na camada 0, e propõe
  operação correta automaticamente (sem modal). Refinamento da
  decisão B do ADR 009 (modal de sugestão). Complexidade
  baixa-média. Fase 2.

### Automação de fluxo

- **Aprovação 1-clique → arquivos certos**: botão "Aprovar pedido"
  gera automaticamente PNG mockup + SVGs separados por máquina +
  salva no histórico + (Fase 3) notifica setor de produção. Onda 9
  já implementa parte do export; Onda 11/12 polem fluxo; Fase 2
  adiciona automação completa.

### Inteligência futura (Fase 3)

- **IA para busca visual de padrões**: cliente manda foto, sistema
  sugere padrões similares do banco usando embeddings visuais.
  Requer modelo de visão computacional + infra de embeddings +
  dataset rotulado. Longo prazo.

### Curadoria de broches existentes

- **Curadoria UI completa**: Gabriell tem milhares de broches em
  arquivos antigos. Decisão: NÃO migrar em massa. Curadoria manual
  controlada via UI (Onda 10). Volume estimado: ~50-100 padrões
  curados, não milhares.

  Princípios:
  - Qualidade > quantidade no banco
  - Padrões antigos ruins poluem busca
  - Curadoria é onde fica o valor real

  Início: depois do MVP fechar. Onda 10 entrega a UI de import;
  Gabriell faz curadoria offline depois.

---

## Decisões de UX já formalizadas (referência)

Estas decisões foram capturadas em ADR 008 (texturas) e ADR 009
(layout) durante a calibração da Onda 5. Documentadas aqui para
referência cruzada:

- **Operador vs Designer é layout, não permissão** (ADR 008)
- **Painel direito de camadas — Opção D-completa** (sempre visível
  nos 2 modos, ADR 009)
- **Sidebar esquerda hierárquica** (Produto → Material → Cor →
  Padrão → Campos dinâmicos, ADR 009)
- **Topbar de padrões inline** (chips + thumbnails no canvas, ADR 009)
- **Drag entre camadas com modal de sugestão** (Opção B, ADR 009)
- **Adicionar campo via menu de contexto** (botão direito, ADR 009)

---

## Como priorizar Fase 2

Quando o MVP estiver estável e em uso, sugestão de ordem:

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

**Última atualização:** 2026-05-05 (consultoria de planejamento)
