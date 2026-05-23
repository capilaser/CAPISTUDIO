# PROJECT_VISION.md — Capi Studio (Reinício Inteligente do V2)

> Esta é a nova **alma** do projeto. Em conflito com qualquer outro documento do repositório (CLAUDE.md original, STATUS-ONDA-\*, planos antigos), **este arquivo vence**. Os documentos antigos viram referência histórica, não fonte de verdade.

---

## 0. Mudança de rumo

O V2 começou como "sistema profissional centrado em canvas, produtos, padrões reutilizáveis e pedidos independentes" e foi acumulando módulos (Padrão Mestre vs Arte do Pedido, multi-broche, Order/Revision/Marketplace, classificação de áreas, validação de templates). O motor de canvas ficou bom; o resto ficou pesado demais para o que o usuário realmente precisa hoje.

O foco agora é **operacional**, não corporativo. Voltamos ao essencial: criar uma arte, organizar em camadas, exportar arquivo de produção limpo.

---

## 0.1 Decisões fixadas (2026-05-22)

| #   | Pergunta                   | Resposta                                                                                                                                                                                 |
| --- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | Tem dados reais no SQLite? | **SIM.** 6 pedidos + 7 itens + 20 padrões + 4 logos SVG do usuário. Backup obrigatório dos 4 logos antes de qualquer faxina. Pedidos/padrões podem ser jogados fora (eram experimentos). |
| P2  | Máquinas                   | **MB, FB, DL**                                                                                                                                                                           |
| P3  | Operações                  | **corte, gravação, marcação**                                                                                                                                                            |
| P4  | Bases de produto           | DXF em curva, **uploadados** pelo usuário. **MVP só com broche 60×25mm.** Sem criador de bases.                                                                                          |
| P5  | Estratégia                 | Auditoria → plano completo → execução em **ondas grandes** → se tudo passar, cria **"Capi Studio Beta"** em pasta separada, pronto para teste real.                                      |

**Itens em aberto** (P6–P13): serão decididos dentro das ondas conforme chegarem. Não bloqueiam o início.

---

## 0.2 Regra de ouro — Fidelidade absoluta dos milímetros

> **"Tem que ser muito fiel, perfeito, sem nenhuma alteração."** — usuário, 2026-05-22

Toda curva, toda coordenada, toda transformação no pipeline geométrico do Capi Studio é **inegociavelmente fiel ao arquivo original**. Zero distorção, zero arredondamento "pra ficar bonito", zero ajuste silencioso.

Implicações concretas:

1. **Snap de 1mm** vale só na criação/drag de objetos novos. Objeto importado (DXF base, logo SVG) **entra com a geometria exata do arquivo** e não passa por snap automático.
2. **Conversões pixel↔mm** usam DPI fixo declarado, sem rounding intermediário.
3. **Vetorização de texto** (opentype.js) preserva a curva da fonte. Variable fonts com fallback **avisam o usuário** — nunca aproximação silenciosa.
4. **Path → Spline** (DXF v2) tem tolerância **explícita em ADR**, testada contra arquivo de referência abrindo no Lightburn. Desvio máximo medido em mm e documentado.
5. **Round-trip obrigatório na Onda 7** (Exportação): SVG entra → SVG sai → diff geométrico zero. DXF idem (dentro da tolerância de spline).
6. **Bitmaps nunca entram em SVG/DXF de produção.** Já é regra; reforçada aqui.
7. **Qualquer normalização** (centralizar no viewBox, transladar para origem) só em estágio explícito e reversível, nunca por baixo dos panos.

**Sinal de alerta no código:** `Math.round(x)`, `toFixed(0)`, ou snap aplicado a coordenadas vindas de arquivo importado → parar e justificar/perguntar.

---

## 1. O que o sistema É

Um **gerador de artes SVG/DXF para produção laser**, desktop (Tauri + React), com:

- **Canvas limpo** para montar a arte
- **Camadas estruturadas** que conhecem tipo de operação, máquina e cor
- **Texto editável** (fonte, tamanho, posição, vetorização para produção)
- **Inserção de assets** (logos SVG, imagens, elementos prontos)
- **Exportação PNG** (aprovação do cliente — pode ter mockup)
- **Exportação SVG/DXF** (produção — limpo, sem mockup, separado por máquina)
- **Organização automática por pastas** no filesystem
- **Base preparada** para futuras automações (IA, integrações), sem implementar agora

---

## 2. O que o sistema NÃO é

Estes itens estão **explicitamente fora de escopo**:

- ❌ ERP
- ❌ Controle de estoque
- ❌ Sistema completo de pedidos (cliente, status Kanban, marketplace, histórico de revisões em DB)
- ❌ Canva ou Figma (não é editor de design genérico)
- ❌ Sistema de "Padrão Mestre" com validação rígida de slots (TEXT_AREA/LOGO_AREA obrigatórios)
- ❌ Multi-broche em prancha como conceito de primeira classe do MVP
- ❌ Integração com OpenCloud, Telegram, WhatsApp, Olist, Shopee, Mercado Livre, Make
- ❌ IA para tratar logo, IA para atendimento

Tudo acima pode existir no futuro. **Nada disso entra agora.**

---

## 3. Objetivo do MVP

O MVP está pronto quando o usuário consegue, em poucos cliques:

1. Abrir o app
2. Criar um projeto novo (vira uma pasta no filesystem)
3. Ver o canvas
4. Inserir texto (escolher fonte, tamanho, posição)
5. Inserir um logo (SVG/PNG)
6. Inserir formas básicas (linha, retângulo, círculo) — para corte/marcação
7. Organizar tudo em camadas, definindo por camada: **tipo de operação** (corte / gravação / marcação), **máquina** (MB / FB / DL), visibilidade, bloqueio
8. Exportar **PNG** para o cliente aprovar
9. Exportar **SVG limpo** e **DXF limpo** para produção, separados por máquina/operação
10. Tudo salvo automaticamente em `/projetos/<nome>/` com a estrutura definida na seção 10

Não precisa: catálogo de produtos, padrões inteligentes, validação de templates, multi-broche, banco de pedidos.

---

## 4. Fluxo principal do usuário

```
[ Tela inicial ]
      ↓ "Novo projeto" (nomeia → cria pasta)
[ Canvas vazio ] ← com painel de camadas à direita, toolbar à esquerda
      ↓ Inserir texto / logo / shape
[ Canvas com elementos ]
      ↓ Editar (mover, redimensionar, trocar texto, mudar fonte)
      ↓ Classificar camada (tipo de operação + máquina)
[ Arte pronta ]
      ↓ Exportar
[ PNG mockup ] → /exports/png/  (cliente aprova)
[ SVG produção ] → /exports/svg/<maquina>/
[ DXF produção ] → /exports/dxf/<maquina>/
      ↓ Salvar projeto (.cps.json + thumbnail)
[ Projeto na pasta, pronto pra reabrir ]
```

Reabrir um projeto carrega o `.cps.json`, reconstrói o canvas, e o usuário continua de onde parou.

---

## 5. Como o Canvas deve funcionar

**Bibliotecaria:** Fabric.js 6 — fica. É a escolha certa e o que já está aproveitável do V2.

**Comportamentos esperados:**

- Unidade interna: **milímetros** (mm). Conversão para pixels é só renderização.
- Viewport dinâmico (não hardcodar dimensões — usar viewBox do projeto).
- **Zoom**: scroll do mouse (Ctrl+scroll), atalhos +/-/0 (fit).
- **Pan**: middle-click drag ou Space+drag.
- **Seleção**: click (1), Shift+click (múltipla), Ctrl+A (todos), Esc (limpar).
- **Movimentação**: drag, setas (1mm), Shift+setas (10mm), Alt+setas (0.1mm).
- **Redimensionar**: handles com aspect-ratio livre, Shift trava proporção.
- **Snap**: grade de 1mm sempre ativa (invariante, ADR 014). Grid visível opcional.
- **Alinhamento**: centralizar H/V no canvas e entre objetos selecionados.
- **Guias**: linhas-guia visíveis durante drag (centro, bordas).
- **Atalhos**: Delete (apagar), Ctrl+D (duplicar), Ctrl+Z/Y (undo/redo), Ctrl+S (salvar).
- **HUD numérico** (já existe, manter): x/y em mm durante drag, w/h durante resize.

**O que NÃO entra no canvas:**

- Slots pré-definidos invisíveis (overlay tracejado vermelho com nome/profissão/logo). O conceito de "slot" morre.
- Áreas obrigatórias (TEXT_AREA, LOGO_AREA com `patternRole`).
- Material/textura aplicado por baixo como camada obrigatória.

Texturas/materiais podem virar **camadas opcionais** (uma camada visual marcada como "não exportar para produção", só aparece no PNG).

---

## 6. Como as camadas devem funcionar

**Camadas são o coração do sistema.** A produção laser depende delas.

Cada elemento no canvas pertence a **uma e apenas uma camada**.

### Modelo de camada (mínimo viável)

```ts
type Layer = {
  id: string;
  name: string; // editável pelo usuário
  visible: boolean;
  locked: boolean;

  // Classificação de produção (opcional no momento da criação,
  // obrigatória no momento de exportar para produção)
  operation: 'corte' | 'gravacao' | 'marcacao' | null;
  machines: Array<'MB' | 'FB' | 'DL'>; // pelo menos 1 para exportar

  // Regras de exportação
  exportTo: {
    png: boolean; // aparece no mockup de aprovação?
    svg: boolean; // vai pro SVG de produção?
    dxf: boolean; // vai pro DXF de produção?
  };

  // Visual operacional (para identificar no painel)
  colorLabel?: string; // tag colorida (não é a cor do desenho)

  // Futuro (não implementar agora, só deixar o slot no tipo)
  tags?: string[];
};
```

### Regras de cor por operação (padrão de produção laser)

| Operação | Cor SVG/DXF | Cor DXF (AutoCAD ACI) |
| -------- | ----------- | --------------------- |
| Corte    | Preto       | 31 (azul-magenta)     |
| Gravação | Vermelho    | 250                   |
| Marcação | Azul        | 5                     |

(Cores conforme ADR 020 — CAPISTUDIO_DXF_STANDARD. Confirmar contigo antes de fechar.)

### Painel de camadas (UI)

- Lista hierárquica simples (sem 2 níveis obrigatórios — só grupos quando o usuário criar).
- Cada linha: ícone de tipo, nome editável, badge da operação (cor), badges das máquinas, olho (visível), cadeado (lock).
- Drag-and-drop para reordenar (z-order = ordem da lista).
- Click direito → menu: renomear, duplicar, apagar, mover pra grupo, exportar/não-exportar.

### O que NÃO entra agora

- Pattern roles (PRODUCT/APPLIQUE/CONTOUR/TEXT_AREA/LOGO_AREA) — morrem.
- Locks granulares por operação — virar simples lock binário no MVP.
- Hierarquia 2-níveis forçada (principal + children) — virar árvore livre.

---

## 7. Como o texto deve funcionar

**Estado atual:** 90% do que precisa já existe (`svg-text-converter.ts`, `font-precheck.ts`, `font-buffer-loader.ts`, `fit-text.ts`).

**No canvas:**

- Click "T" na toolbar → click no canvas → digita.
- Edição direta no canvas (double-click) ou via painel lateral.
- Propriedades editáveis: texto, família de fonte, tamanho (em mm ou pt), peso, alinhamento, espaçamento, rotação.
- Fontes vêm de **pasta do usuário** + bundle padrão (Roboto Slab, Montserrat, Caveat, Playfair Display, Bebas Neue — já tem seed).

**Na exportação:**

- **PNG**: renderiza fonte normalmente (Fabric.js cuida).
- **SVG/DXF**: vetorizar texto para `<path>` via opentype.js (já implementado, falta integrar).
- **Pre-check**: antes de exportar, validar que todas as fontes usadas conseguem ser vetorizadas. Se alguma falhar → diálogo perguntando "exportar mesmo assim?" ou "trocar fonte".

**Fora de escopo:** variable fonts complexos (já tem fallback). Curvar texto em path (futuro). Justificação avançada (futuro).

---

## 8. Como os assets devem funcionar

**Tipos suportados:**

- **Logos**: SVG (preferencial), DXF, PNG.
- **Imagens**: PNG, JPG (só para PNG de mockup — não vão para DXF).
- **SVGs avulsos**: shapes, ornamentos, divisórias.

**Origem:**

- **Banco do projeto**: pasta `/projetos/<nome>/assets/`.
- **Banco global** (futuro): pasta do app com "logos padrões, textos padrões, traços padrões, elementos padrões". Por enquanto, só copia o arquivo para o projeto.

**Fluxo de inserção:**

1. Toolbar → "Inserir asset" → file picker.
2. Arquivo é **copiado** para `/projetos/<nome>/assets/<tipo>/` (não link, cópia — o projeto é portátil).
3. Vira um elemento no canvas, na camada ativa.
4. SVG: contornos preservados, fill/stroke aplicados pela camada.
5. PNG: fica como bitmap (só vai pro PNG de mockup, ignorado em SVG/DXF de produção).

**Não entra agora:**

- Banco de assets global indexado (futuro).
- Preview thumbnails em grade (UI simples por enquanto: lista).
- Tags, busca, lastUsedAt (já existe em `logoRepository.ts` — descartar a tabela, voltar a ser filesystem-first).

---

## 9. Como a exportação deve funcionar

**Princípio absoluto: aprovação e produção são coisas diferentes.**

### PNG (aprovação do cliente)

- Cara bonita: pode ter mockup, texturas, sombras, cores reais.
- Inclui todas as camadas marcadas `exportTo.png: true`.
- Resolução escolhível (150/300/600 DPI).
- Saída: `/exports/png/<projeto>_<timestamp>.png`.

### SVG (produção)

- **Stroke-only.** Nada de fill, nada de filter, nada de texto-como-tag.
- Texto convertido para `<path>`.
- Bitmaps **excluídos** automaticamente (warning se houver).
- 1 arquivo por **máquina** (`MB.svg`, `FB.svg`, `DL.svg`).
- Cores por operação (preto/vermelho/azul).
- Saída: `/exports/svg/<maquina>/<projeto>.svg`.

### DXF (produção)

- AutoCAD 2018 (AC1032) — SPLINE como entidade preferencial. ADR 020.
- Coordenadas em mm, Y invertido (DXF é canto inferior-esquerdo).
- Layers DXF = camadas Capi (uma layer DXF por camada exportada).
- Cores ACI por operação (31 / 250 / 5).
- 1 arquivo por máquina.
- Saída: `/exports/dxf/<maquina>/<projeto>.dxf`.

### O que NUNCA vai para produção (SVG/DXF)

- Mockups
- Texturas
- Imagens bitmap
- Camadas com `visible: false`
- Camadas com `exportTo.svg/dxf: false`
- Elementos sem operação/máquina definidos (com warning antes de exportar)

### Fluxo de exportação

1. Usuário clica "Exportar".
2. Diálogo mostra: o que vai sair (lista de arquivos), quais máquinas, quais camadas, warnings (fontes, bitmaps, camadas sem operação).
3. Confirmar → escreve arquivos em pasta, abre Explorer.

---

## 10. Organização por pastas

Estrutura **autoritativa** (filesystem é a fonte de verdade, não DB):

```
/projetos/
  <nome-do-projeto>/
    projeto.cps.json          ← arquivo do projeto (canvas + camadas + meta)
    thumbnail.png             ← miniatura para a tela inicial
    /assets/
      /logos/                 ← SVGs/PNGs de logos
      /imagens/               ← PNG/JPG (só mockup)
      /svgs/                  ← shapes, ornamentos
      /fontes/                ← fontes do projeto (se não-padrão)
    /base/                    ← bases SVG/DXF do produto (se houver)
    /templates/               ← templates derivados deste projeto (opcional)
    /exports/
      /png/                   ← mockups de aprovação (timestamped)
      /svg/
        /MB/
        /FB/
        /DL/
      /dxf/
        /MB/
        /FB/
        /DL/
    /mockups/                 ← PNGs renderizados de aprovação histórica
    /historico/               ← snapshots automáticos (autosave)
    /config/                  ← settings específicos do projeto (opcional)
```

**Onde fica a raiz `/projetos/`?**

- Configurável em Settings (default: `<Documents>/Capi Studio/projetos/`).
- O app só sabe onde fica a raiz; descobre projetos via varredura da pasta.

**Implicações:**

- Não precisa de tabela SQL `projects` ou `orders`. O filesystem é o catálogo.
- Backup = copiar a pasta. Versionar = colocar em git. Compartilhar = zipar.
- DB SQLite continua existindo só para **catálogo global reutilizável** (fontes, máquinas, operações). Tudo ligado a projeto vai pra filesystem.

---

## 11. O que pode ser REAPROVEITADO do V2

Veredito da auditoria, item a item:

### APROVEITAR (mantém como está ou com adaptação leve)

- **Canvas Engine** (`canvas-engine.ts`, ~2.3K linhas) — Fabric.js bem abstraído. Só simplificar quem consome.
- **engine-layers.ts** — modelo de camada já tem operação/máquina/cor. Remover obrigatoriedade de patternRole.
- **engine-serialization.ts** — formato de serialização. Reaproveitar como base do `.cps.json`.
- **Snap/Alignment** — invariante 1mm, ADR 014. Mantém.
- **Live metrics overlay** (HUD x/y/Δ) — útil, mantém.
- **svg-exporter.ts / png-exporter.ts** — maduros, 426+ testes em SVG. Mantém.
- **svg-text-converter.ts + font-precheck.ts + font-buffer-loader.ts + fit-text.ts** — só falta integrar no pipeline de export.
- **Tauri setup** (`src-tauri/lib.rs`) — backup automático, transações. Mantém.
- **Estrutura `src/core/` × `src/ui/`** — separação correta. Mantém.
- **Documentação ADRs** — vira histórico, fonte para consulta.

### ADAPTAR (refatorar dentro do escopo)

- **canvas-store.ts** — remover `BoardItemDraft`, `selectedOrderItemIndex`, multi-broche. Substituir por estado de projeto simples.
- **Painel de camadas** (`LayerRow`, `LayerBadge`) — UI fica, lógica de patternRole sai.
- **DXF Exporter V2** (`dxf-exporter-v2.ts` e auxiliares) — terminar de integrar. ADR 020 vale.
- **Tabelas SQLite úteis**: manter `machines`, `operations`, `machineOperations`, `fonts`, `materials`/`materialFamilies` (catálogo). Resto sai.

### RECONSTRUIR (refazer do zero, pequeno)

- **Tela inicial** (lista de projetos vindos do filesystem, criar/abrir).
- **Editor de projeto** (substitui `NovoPedidoPage`).
- **Toolbar do canvas** (Insert text/logo/shape/image — simples e direto, sem o overhead de "produto/material/pattern").
- **Diálogo de exportação** — novo, com preview do que vai sair, warnings de fontes e bitmaps.
- **Sistema de arquivos do projeto** — `projeto.cps.json`, autosave, thumbnail, watcher de pasta.

### DESCARTAR (deletar, não dá pra salvar)

- **Sistema de Padrão Mestre / Padrão Inteligente**:
  - `src/core/patterns/` (validate-pattern.ts)
  - `src/core/canvas/pattern-area-bridge.ts` (não commitado — deletar agora)
  - `src/ui/pages/padroes/` (PadroesPage, PadraoEditorPage, PatternClassificationPanel, PatternValidationDialog)
  - Todos os testes de patterns
- **Slot Manager** (`slot-manager.ts`, 778 linhas) — conceito morreu.
- **Tudo que é "Pedido completo"**:
  - `src/ui/pages/arte/novo-pedido/` inteiro (revisar o que dá pra reaproveitar de Canvas/Sidebar antes de apagar)
  - Tabelas `orders`, `order_items`, `order_revisions`, `order_overrides`
  - Repositories: `orderRepository`, dependências
  - Conceito de "BoardItemDraft" / multi-broche / prancha
- **Catálogos derivados de pedido**: `appliques`, `engravings`, `markings` (tabelas + repositories + storage services).
- **Telemetria DXF**: `dxf-debug-report.ts`, `DxfDebugPanel.tsx` — útil em desenvolvimento, fora de produção.
- **`tests/_throwaway/`** — deletar imediatamente.
- **DXF Exporter V1** (`dxf-exporter.ts` legado R12) — depois que V2 estiver integrado.

### PREPARAR PARA O FUTURO (sem implementar)

- Integrações externas (Telegram, WhatsApp, Olist, Shopee, Mercado Livre, Make, OpenCloud) — deixar `src/integrations/` vazio.
- IA (tratamento de logo, atendimento) — sem placeholder, só nota em ADR.
- Multi-broche em prancha — pode voltar como "modo lote" futuro. Não no MVP.
- Sistema de templates (padrões reutilizáveis simples) — futuro.
- Sincronização nuvem — futuro.

---

## 12. Riscos técnicos

1. **DXF v2 incompleto** — falta suporte a `clipBoundsMm` (multi-chapa). Para o MVP isso pode ser deferido se você exportar 1 peça por vez. Confirmar.
2. **Texto em DXF** — opentype gera path SVG; conversão path → SPLINE/POLYLINE para DXF precisa de testes com Lightburn real.
3. **Filesystem como banco** — concorrência (2 instâncias do app abertas no mesmo projeto) precisa de lock simples.
4. **Migração de dados existentes** — se já existem broches/padrões no SQLite que você quer manter, precisamos exportar antes de apagar tabelas. Confirmar se existe algo importante hoje no DB.
5. **Fabric.js + Tauri WebView** — todas as features do Fabric funcionam? Já temos confirmação parcial (V1 funciona), mas variable fonts podem dar dor de cabeça (já tem fallback documentado em IDEAS/).
6. **Tamanho do refactor** — ~30 arquivos não commitados de DXF-v2 + Onda 37 misturados com base estável. Risco de perder trabalho bom durante a faxina. Mitigar com branch separada e commits temáticos.

---

## 13. Perguntas para você responder

Antes da Onda 2, preciso de decisões nestes pontos:

### Sobre o catálogo atual no SQLite

**P1.** O app hoje tem **dados reais** salvos (broches, padrões, pedidos antigos) que você quer preservar? Ou pode jogar tudo fora e começar do zero?

### Sobre máquinas e operações

**P2.** As máquinas são exatamente **MB, FB, DL**? Estes são os códigos finais que vão pro nome de pasta/arquivo?
**P3.** As operações são exatamente **corte, gravação, marcação**? Sem subtipos por enquanto?
**P4.** Cores de produção: preto/vermelho/azul (SVG) e ACI 31/250/5 (DXF) — confirma?

### Sobre exportação

**P5.** **1 arquivo por máquina** está certo, ou prefere **1 arquivo por máquina+operação** (ex: `MB-corte.dxf`, `MB-gravacao.dxf`)?
**P6.** O nome do projeto vira o nome do arquivo, ou você quer escolher na hora de exportar?
**P7.** Multi-chapa (`clipBoundsMm`) é necessário no MVP, ou pode ficar para depois?

### Sobre pastas

**P8.** Raiz dos projetos: default `<Documents>/Capi Studio/projetos/` está bom, ou prefere outro lugar (ex: `D:\Capi Studio\projetos\`)?
**P9.** Quer "abrir projeto a partir de qualquer pasta" (file picker), ou só projetos dentro da raiz configurada aparecem na tela inicial?

### Sobre templates/padrões

**P10.** Você ainda quer um conceito leve de "template" (abrir um projeto base pré-configurado, ex: "broche redondo 5cm com nome + profissão") no MVP, ou isso pode esperar?

### Sobre tipo de produto/base

**P11.** Os "produtos" (broche, placa, etc.) e suas **bases SVG** (formato físico) entram no MVP, ou você desenha tudo na mão no canvas vazio por enquanto?
**P12.** Texturas/materiais (PNG aplicado por baixo) — entram no MVP só para mockup PNG, ou ficam para depois?

### Sobre escopo

**P13.** Faz sentido fazer a faxina (descartar padrões, slots, pedidos) **antes** de começar a Onda 2 (novo canvas), ou prefere construir o novo em paralelo e descartar depois?

---

## 14. Regras de produção laser (consolidadas)

> **Confirme cada item**. Marquei com `?` o que ainda precisa decisão.

- **Unidade**: milímetros (mm). Todas as medidas internas e exportações em mm.
- **Origem**: SVG/PNG → canto superior-esquerdo. DXF → canto inferior-esquerdo (Y invertido na exportação).
- **Cores de operação (SVG)**: corte=preto `#000000`, gravação=vermelho `#FF0000`, marcação=azul `#0000FF`. `?`
- **Cores de operação (DXF ACI)**: corte=31, gravação=250, marcação=5 (ADR 020). `?`
- **DXF**: AutoCAD 2018 (AC1032). SPLINE como entidade preferencial. ADR 020. `?`
- **Layers DXF**: 1 por camada do projeto. Nome da layer = nome da camada (ASCII safe).
- **SVG produção**: stroke-only. Sem fill, sem filter. Texto vetorizado.
- **Linha de corte**: stroke 0.01mm (hairline)? `?`
- **Tolerância de fechamento de path**: 0.01mm? `?`
- **Fontes**: variable fonts têm fallback documentado. Fonte que não vetoriza → warning antes de exportar.
- **Bitmaps**: nunca em SVG/DXF de produção. Warning na exportação se houver.

---

## 15. Plano de reconstrução em 4 ondas grandes + finalização

Estratégia: **4 ondas grandes** (não 9 fragmentadas). Cada onda é um marco visível e testável. Ao final, se tudo passa, fechamos a versão como **"Capi Studio Beta"** em pasta separada para teste real.

---

### **ONDA 1 — Auditoria, Realinhamento e Preservação** ← **CONCLUÍDA**

**O que entregou:**

- ✅ Auditoria estrutural completa do V2
- ✅ Veredito por área (aproveitar / adaptar / reconstruir / descartar)
- ✅ Este documento (`PROJECT_VISION.md`)
- ✅ Identificação de dados reais no SQLite (P1)
- ✅ Regra de ouro da fidelidade dos mm fixada
- ✅ Decisões P1–P5 registradas

**Pendência antes da Onda 2:**

- Preservar os **4 logos SVG do usuário** em `%APPDATA%\com.capilaser.studio\assets\logos\` antes de qualquer apagamento (copiar para `_legacy-backup/logos/` na raiz do repo).
- Confirmar com usuário se algum dos 20 padrões customizados merece ser preservado (export como SVG de referência), ou se podem ser todos descartados como experimentos.

---

### **ONDA 2 — Fundação Limpa (Faxina + Core do Projeto)**

**Marco visível:** o app abre numa tela inicial limpa, lista os projetos do filesystem, deixa criar um projeto novo (broche 60×25mm), abre o editor com canvas vazio e camadas funcionando. Sem exportação ainda.

**Subfases:**

**2A. Backup e faxina cirúrgica**

- Branch nova `restart/v2-beta`.
- Snapshot dos 4 logos SVG do usuário → `_legacy-backup/logos/`.
- Snapshot do db SQLite atual → `_legacy-backup/capi-studio.db`.
- Deletar:
  - `src/core/canvas/pattern-area-bridge.ts`
  - `src/core/canvas/slot-manager.ts` (depois de tirar referências)
  - `src/core/patterns/`
  - `src/ui/pages/padroes/`
  - `src/ui/pages/arte/novo-pedido/` (revisar Sidebar/CanvasArea antes — ver se algo de UI vale resgate, mas o esqueleto vai fora)
  - `tests/_throwaway/`
  - `src/core/export/dxf-debug-report.ts` + `src/ui/canvas/DxfDebugPanel.tsx`
  - `src/core/export/dxf-exporter.ts` legado (depois que V2 estiver integrado — adia para Onda 4)
- Schema Drizzle: remover tabelas `orders`, `order_items`, `order_revisions`, `order_overrides`, `appliques`, `engravings`, `markings`, `logos` (logos vai pra filesystem agora) e respectivos repositories.
- Manter no SQLite: `machines`, `operations`, `machineOperations`, `fonts`, `products`, `productLayers`, `materials`, `materialFamilies`.
- `canvas-store`: remover `BoardItemDraft`, `boardItems[]`, `selectedOrderItemIndex`, `addBoardItem`, `removeBoardItem`, `duplicateBoardItem`, `addBoardItemsBulk`, `resetBoard`.

**2B. Sistema de arquivos do projeto**

- Definir formato `projeto.cps.json` (canvas state + camadas + meta).
- Service Tauri (Rust) para CRUD de pasta de projeto: criar estrutura completa (`/assets`, `/exports`, etc.), listar projetos da raiz, ler/escrever `.cps.json`, gerar thumbnail.
- Settings: raiz dos projetos (default `<Documents>\Capi Studio\projetos\`).

**2C. Tela inicial**

- Lista de projetos (cards com thumbnail + nome + data).
- Botão "Novo projeto" → diálogo: nome + escolher base (no MVP: só "Broche 60×25mm").
- Botão "Abrir projeto" (file picker para fora da raiz padrão).
- Botão "Configurações" (raiz da pasta de projetos).

**2D. Editor de projeto — Canvas vivo**

- Página única "Editor", substitui NovoPedidoPage.
- Reutiliza `canvas-engine.ts`, snap, alignment, live-metrics.
- Toolbar esquerda: select / text / shape (line, rect, circle) / insert asset.
- Painel direito: propriedades do objeto selecionado (x, y, w, h, rotação em mm/graus).
- Atalhos: zoom, pan, undo/redo, delete, duplicate, salvar (Ctrl+S → atualiza `.cps.json`).
- Carrega a base do broche 60×25mm (DXF uploadado) como camada "base" travada por default.

**2E. Sistema de camadas (núcleo)**

- Refatorar painel de camadas — sem patternRole, sem 2 níveis forçados.
- Modelo `Layer` da seção 6 (operação, máquinas, exportTo, visible, locked, colorLabel).
- Painel: lista flat com drag-and-drop, badge da operação (cor), badges das máquinas, olho/cadeado.
- Propriedades por camada: editáveis no painel direito quando camada está selecionada.
- Atribuir/mover objeto para camada.

**Critério de saída da Onda 2:**

- `npm run typecheck` + `npm run test` verdes.
- Abrir app → criar projeto "teste-broche" → adicionar 1 retângulo na camada "corte" → adicionar 1 círculo na camada "gravação" → salvar → fechar app → reabrir → tudo no lugar.
- Estrutura `/projetos/teste-broche/` criada corretamente.
- Snap de 1mm funciona em objeto novo. Base DXF importada **não** sofre snap.

---

### **ONDA 3 — Conteúdo (Texto + Assets + Base do Produto)**

**Marco visível:** o usuário consegue montar uma arte real de broche — base 60×25mm + texto editável + logo SVG importado — tudo organizado em camadas, com fidelidade geométrica verificável.

**Subfases:**

**3A. Importação de base DXF do produto**

- Service de upload DXF: parse → SVG path interno → camada "base" trancada.
- Validação de fidelidade: ler DXF, escrever de volta, comparar geometria.
- Catálogo de produtos no SQLite: só broche 60×25mm no MVP. Schema preparado para adicionar placas depois (DXF base + viewBox + nome).

**3B. Texto editável**

- Toolbar T → click no canvas → digita.
- Edição inline (double-click) + painel direito (família, tamanho em mm OU pt, peso, alinhamento, espaçamento de letras, rotação).
- Diálogo de fontes: lista das fontes do banco SQLite (seeds já existentes) + botão "adicionar fonte" (upload .ttf/.otf para pasta global da app).
- Pre-check de vetorização (`font-precheck.ts`) acoplado: ao selecionar fonte, validar que opentype consegue ler. Se não, badge de aviso.

**3C. Assets (logos SVG, imagens)**

- Toolbar "Inserir asset" → file picker.
- Arquivo copiado para `/projetos/<nome>/assets/{logos,imagens,svgs}/` (cópia, não link).
- Painel lateral "Banco de assets" mostra os assets do projeto + drag-and-drop para canvas.
- Logo SVG entra preservando geometria exata (regra de ouro). Sem fill/stroke automático — herda da camada.
- Imagem PNG/JPG entra como bitmap, automaticamente classificada como "só PNG mockup" (`exportTo: {png: true, svg: false, dxf: false}`).

**3D. Refinamentos do canvas**

- Diálogo de propriedades por camada (popup ao clicar gear na linha do painel).
- Snapping inteligente: snap em centro, bordas e centro de outros objetos durante drag (já tem? confirmar reuso do alignment-engine).
- Réguas opcionais nas bordas (toggle).

**Critério de saída da Onda 3:**

- Criar projeto de broche → carregar base 60×25mm → escrever "Dr. Carlos Silva\nCardiologia" em 2 camadas de gravação → importar logo SVG → posicionar → salvar → reabrir → tudo idêntico.
- Round-trip do logo SVG: importar → exportar SVG → diff geométrico = 0.
- Pre-check de fonte bloqueia export se fonte falha; permite override consciente.

---

### **ONDA 4 — Produção (Exportação Fiel + Estrutura de Pastas)**

**Marco visível:** o usuário exporta arquivos PNG/SVG/DXF de produção, abre no Lightburn, **grava uma peça de teste real no laser**, e a peça sai exatamente como o canvas mostra.

**Subfases:**

**4A. Pipeline de exportação unificado**

- Decidir e documentar (novo ADR) o pipeline canônico: Canvas → IR (representação intermediária em mm) → emissor por formato.
- IR preserva: geometria exata em mm, tipo de operação, máquina, ordem z, camada, metadata.
- Eliminar duplicação entre svg-exporter e dxf-exporter (núcleo único de "iterar canvas → produzir IR").

**4B. PNG (aprovação)**

- Diálogo "Exportar PNG": resolução (150/300/600 DPI), incluir mockup/textura sim/não, fundo transparente sim/não.
- Saída em `/exports/png/<projeto>_<timestamp>.png`.

**4C. SVG (produção)**

- Stroke-only, sem fill, sem filter.
- Texto vetorizado via `svg-text-converter` (integração final).
- Cores SVG por operação: preto (corte), vermelho (gravação), azul (marcação) — confirmar P4.
- 1 arquivo por máquina (`MB.svg`, `FB.svg`, `DL.svg`) em `/exports/svg/<maquina>/`.
- Bitmaps excluídos com warning explícito.
- **Teste de round-trip obrigatório:** SVG-out lido de volta tem geometria idêntica à entrada (zero distorção).

**4D. DXF (produção, V2 finalizado)**

- ADR 020 vale: AC1032 / SPLINE / ACI 31/250/5.
- Reaproveitar `dxf-exporter-v2.ts`, `dxf-document.ts`, `dxf-spline-encoder.ts`, `dxf-path-to-splines.ts`, `dxf-coordinate-normalize.ts`, `dxf-process-color.ts`.
- Definir e documentar **tolerância de SPLINE** explícita (ex: 0.01mm de desvio máximo). Testar no Lightburn.
- 1 arquivo por máquina em `/exports/dxf/<maquina>/`.
- Conversão Y (SVG topo-esquerdo → DXF base-esquerdo) sem perda de precisão.
- **Teste de round-trip:** DXF gerado, lido por uma lib leve, geometria comparada ao SVG IR. Desvio máximo ≤ tolerância documentada.

**4E. Diálogo de exportação inteligente**

- Preview da lista de arquivos que serão gerados.
- Warnings: fontes que não vetorizam, bitmaps presentes, camadas sem operação/máquina definidos.
- Confirmação → escreve tudo → abre Explorer na pasta `/exports/`.

**4F. Autosave e histórico**

- Salvar a cada N ações (ou cada minuto, idle).
- Snapshot em `/historico/` a cada export bem-sucedido.
- Thumbnail regenerada no save.

**Critério de saída da Onda 4:**

- Exportar broche teste → abrir DXF no Lightburn → **gravar peça real no laser** → peça sai com geometria fiel ao canvas, mm a mm.
- Testes de round-trip SVG e DXF passam.
- Cobertura de testes ≥ 80% no core/canvas + core/export.
- Backup automático do `.cps.json` funcionando.

---

### **FINALIZAÇÃO — Capi Studio Beta**

Quando as Ondas 1–4 passam (typecheck verde, testes verdes, fluxo end-to-end funcionando, peça gravada com sucesso no laser):

1. Criar pasta nova `capi-studio-beta/` ao lado de `capi-studio-v2/`.
2. Copiar o estado atual (com a faxina já feita) para a nova pasta.
3. Limpar histórico de git, criar repo novo `capi-studio-beta` com commit inicial "v0.1.0 Beta".
4. Build do MSI (Tauri bundler) para Windows x64.
5. Documentação mínima: README, CHANGELOG, guia de instalação.
6. Pronto para teste real em produção paralela com o sistema atual.

**O `capi-studio-v2/` original fica como referência histórica + arquivo dos dados antigos.**

---

### Futuro (não entra em ondas numeradas)

- Templates / projetos-base reutilizáveis (broche modelo "padrão escola", "padrão consultório", etc.)
- Catálogo expandido de produtos (placas, chaveiros, etc.)
- Multi-peça em chapa (`clipBoundsMm`) e nesting básico
- Banco global de logos com tags e busca
- Integrações externas
- IA

---

## 16. Critérios de qualidade do código durante a reconstrução

- Funções pequenas, nomes claros, tipagem estrita (`strict: true`).
- `src/core/` puro (zero DOM, testável em Node).
- `src/ui/` sem lógica de negócio.
- Sem comentários óbvios. Comentar só o "porquê" não-trivial.
- Sem feature flags ou backwards-compat. O V2 antigo morreu.
- Sem `alert()`/`prompt()`. Dialog do shadcn.
- Componentes > 300 linhas viram subcomponentes.
- Cada Onda termina com `typecheck` + `test` verdes + validação manual.

---

## 17. Frase guia

> O Capi Studio é uma ferramenta operacional de produção laser. Cada decisão precisa responder à pergunta: **"isso ajuda a sair com um arquivo de produção limpo, mais rápido?"** Se não ajuda, fica fora.

---

## Anexo A — Documentos antigos e seu status

| Documento                                       | Status                                                                                                                                                                                                                                             |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CLAUDE.md` (raiz, v2)                          | Histórico. Stack obrigatória (Tauri/React/Fabric/etc.) e proibições absolutas continuam valendo. Conceitos de "Padrão Mestre vs Arte do Pedido", "Sistema de Padrões", "WAVE 1/2 de padrões", "BoardItemDraft" — **revogados** por este documento. |
| `docs/DECISIONS/001-019`                        | Histórico. Continuam válidos quando aplicáveis ao novo escopo (snap, fabric, transações).                                                                                                                                                          |
| `docs/DECISIONS/020-capistudio-dxf-standard.md` | **Vigente.** É o padrão DXF do MVP.                                                                                                                                                                                                                |
| `docs/STATUS-ONDA-*.md`                         | Histórico. Não usar como roadmap.                                                                                                                                                                                                                  |
| `docs/DEBT.md`                                  | Reler na Onda 2 e descartar dívidas que sumiram com o escopo. Backup DB continua relevante.                                                                                                                                                        |
| `docs/IDEAS/`                                   | Histórico/inspiração.                                                                                                                                                                                                                              |
| `MEMORY.md` (auto-memory)                       | Manter, atualizado com este pivô.                                                                                                                                                                                                                  |
