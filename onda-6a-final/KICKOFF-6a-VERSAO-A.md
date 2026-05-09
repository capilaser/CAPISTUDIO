# KICKOFF — Onda 6a — VERSÃO A

> **Use esta versão se** `ls tests/fixtures/` mostra as 3 pastas
> (`camadas-base/`, `apliques/`, `exportacoes/`) com TODOS os SVGs
> esperados.
>
> **Modelo recomendado:** Sonnet 4.6 (médio)
>
> **Como usar:** anexe `AI-CONTEXT.md`, `06-VISION.md`,
> `PLANO-ADR-camadas-hierarquicas.md` e `01-DATABASE.md` no chat do
> Claude Code, depois copie e cole TUDO entre os marcadores `═══`
> abaixo como primeira mensagem.

---

```
═══════════════════════════════════════════════════════════════════
KICKOFF — Onda 6a — Schema + Migration + Seeds (4 bancos novos)
Modelo recomendado: Sonnet 4.6 (médio)
═══════════════════════════════════════════════════════════════════

CONTEXTO

Você está retomando o Capi Studio v2. Ondas 0 a 5 estão fechadas
(bootstrap, banco, home, canvas, slots+fitText, fontes, texturas).

Esta é a Onda 6a — a primeira de 3 sub-ondas que compõem a Onda 6.
Escopo da 6a é EXCLUSIVAMENTE persistência:

  6a (esta) — schema novo + migration + seeds + cópia de SVGs
  6b — parser SVG do Corel + refactor LayerMeta (fica pra DEPOIS)
  6c — painel de slots agrupado (fica pra DEPOIS)

NÃO TOQUE em canvas, em LayerMeta dentro de canvasJson, ou em UI.
Se sentir vontade, é sinal que você saiu do escopo. PARE e volte.

═══════════════════════════════════════════════════════════════════

PASSO ZERO — CRIAR O ADR 010

ANTES de qualquer leitura ou planejamento de código, sua PRIMEIRA
ação é criar o arquivo:

  docs/DECISIONS/010-camadas-hierarquicas-bancos-componentes.md

Conteúdo: copie INTEGRALMENTE o conteúdo do anexo
"PLANO-ADR-camadas-hierarquicas.md" para esse novo arquivo, com
2 ajustes obrigatórios no cabeçalho:

  - Trocar "ADR 008" por "ADR 010" no título
  - Manter "Status: Aceito" e "Data: 2026-05-07"

ATENÇÃO: ADR 008 e ADR 009 já existem no projeto e são sobre OUTROS
assuntos (texturas e layout). Se você tentar criar ADR 008 ou 009,
sobrescreve documento existente. NÃO faça isso.

Após criar o ADR 010, esse é o documento de referência canônico
desta onda. Toda regra de schema/seed sai dele.

═══════════════════════════════════════════════════════════════════

LEITURA OBRIGATÓRIA ANTES DE PLANEJAR

Leia, nesta ordem:

  1. docs/DECISIONS/010-camadas-hierarquicas-bancos-componentes.md
     (que você acabou de criar) — É a especificação travada desta
     onda. Lei.
  2. AI-CONTEXT.md — princípios gerais, stack, decisões.
  3. projeto/01-DATABASE.md — schema atual da Onda 1.
  4. tests/fixtures/README.md — descrição das fixtures reais.

Se algum desses arquivos não existir no projeto, PARE imediatamente
e me pergunte. NÃO INVENTE conteúdo.

═══════════════════════════════════════════════════════════════════

ESCOPO DETALHADO DA 6a

1. RESET LIMPO DO BANCO
   - Apagar o arquivo %APPDATA%\com.capilaser.studio\capi-studio.db
     antes de qualquer coisa. O usuário autorizou explicitamente
     (banco em modo de construção, sem dados de produção).
   - No primeiro boot pós-reset, todos os seeds antigos (Ondas 1,
     4.5 e 5) DEVEM rodar automaticamente — máquinas, produtos,
     operações, fontes embarcadas, texturas ABS Escovado. NÃO
     recriar lógica de seed dessas ondas — usar a infraestrutura
     existente (comando seed_database e padrão "se tabela vazia,
     roda o seed correspondente"). Se essa infraestrutura não
     existir como descrito, PARE e me avise antes de inventar.
   - Em seguida rodam os seeds NOVOS desta onda (svg_bases +
     appliques).

2. SCHEMA NOVO (Drizzle) — fonte da verdade é ADR 010 seção 2 e 3

   Adicione em src/data/schema.ts:

   2.1 — Tabela pattern_layers (camada principal de uma peça física):
       {
         id: text PRIMARY KEY,
         patternId: text NOT NULL → patterns.id,
         name: text NOT NULL,
         zIndex: integer NOT NULL DEFAULT 0,
         visible: integer (boolean) NOT NULL DEFAULT 1,
         locked: integer (boolean) NOT NULL DEFAULT 0,
         svgFilePath: text,            // nullable
         textureId: text → textures.id, // nullable
         widthMm: real,
         heightMm: real,
         positionXmm: real NOT NULL DEFAULT 0,
         positionYmm: real NOT NULL DEFAULT 0,
         createdAt: integer (timestamp) NOT NULL,
         deletedAt: integer (timestamp)
       }

   2.2 — Tabelas appliques, engravings, markings (3 tabelas IDÊNTICAS
       no shape, mudam só o nome):
       {
         id: text PRIMARY KEY,
         name: text NOT NULL,
         filePath: text NOT NULL,      // caminho relativo no appData
         thumbnailPath: text,
         widthMm: real,
         heightMm: real,
         tags: text (JSON array) NOT NULL DEFAULT '[]',
         metadata: text (JSON),
         createdAt: integer (timestamp) NOT NULL,
         deletedAt: integer (timestamp)
       }

   2.3 — Coluna nova em pattern_slots:
       parentLayerId: text → pattern_layers.id (NULLABLE)
       NULL = slot solto, não vinculado. Slots existentes da Onda 4
       recebem NULL automaticamente na migration (default da coluna).

3. MIGRATION

   - Rodar: npx drizzle-kit generate
   - Verificar que o SQL gerado em src-tauri/migrations/ contém:
     * CREATE TABLE pattern_layers
     * CREATE TABLE appliques
     * CREATE TABLE engravings
     * CREATE TABLE markings
     * ALTER TABLE pattern_slots ADD COLUMN parentLayerId
   - Embarcar no binário via tauri-plugin-sql (já configurado).

4. CÓPIA DE FIXTURES PRO RESOURCES (embarcado no binário)

   Os SVGs já estão no projeto em:
     tests/fixtures/camadas-base/
     tests/fixtures/apliques/
     tests/fixtures/exportacoes/

   COPIE (não mova) estes arquivos pra:
     src-tauri/resources/fixtures/svg-bases/
     src-tauri/resources/fixtures/appliques/

   (engravings/ e markings/ NÃO recebem fixtures — confirmado pelo
    usuário. Os bancos ficam vazios.)

   Lista esperada:
     svg-bases/
       - broche-simples.svg
       - broche-completo.svg
       - placa-base.svg
       - placa-completa.svg
     appliques/
       - aplique-1-formato-d.svg
       - aplique-2-pill.svg
       - aplique-3.svg

   ⚠️ ANTES DE COPIAR — VERIFIQUE A EXISTÊNCIA DE CADA ARQUIVO:
   se algum dos 7 arquivos acima NÃO existir em tests/fixtures/,
   PARE imediatamente e liste pro usuário quais faltam. Não copie
   subset, não invente fallback, não use nome alternativo.

   ⚠️ APÓS A CÓPIA, RODAR `cargo clean` na raiz do projeto.
   Cargo não detecta mudanças em resources/ sozinho (lição
   aprendida da Onda 4.5 — está no AI-CONTEXT). Sem `cargo clean`,
   os arquivos novos NÃO ficam embarcados no binário.

5. SEED DE BOOT — comando Rust (Tauri)

   No primeiro boot (banco recém-criado, vazio), o app deve:

   5.1 Criar pasta de assets:
       %APPDATA%\com.capilaser.studio\assets\
         ├── svg-bases\
         ├── appliques\
         ├── engravings\
         └── markings\

   5.2 Copiar SVGs de resources/fixtures/ pra essas pastas:
       svg-bases/ → 4 arquivos (lista da seção 4)
       appliques/ → 3 arquivos (lista da seção 4)

       (engravings/ e markings/ ficam vazios)

   5.3 Inserir registros nas tabelas correspondentes:

       svg_bases (4 registros) — usar IDs FIXOS:
         - id="svg-base-broche-simples",  name="Broche Simples"
         - id="svg-base-broche-completo", name="Broche Completo"
         - id="svg-base-placa-base",      name="Placa Base"
         - id="svg-base-placa-completa",  name="Placa Completa"

       appliques (3 registros) — usar IDs FIXOS:
         - id="aplique-1-formato-d",  name="Aplique 1 — Formato D"
         - id="aplique-2-pill",       name="Aplique 2 — Pill"
         - id="aplique-3",            name="Aplique 3"

       engravings (0 registros)
       markings (0 registros)

       Para cada registro, extrair widthMm e heightMm do header do
       SVG (atributos width/height em mm). Se vier em outras unidades
       (px, in, etc), deixar NULL — NÃO converter. Respeitar a regra
       do ADR 005 (viewBox autoritativo): nunca calcular dimensão
       a partir do viewBox sozinho neste passo.

   5.4 IDEMPOTÊNCIA — chave de deduplicação é o id FIXO acima:

       Antes de inserir, verifique se existe registro com aquele id
       (SELECT id FROM appliques WHERE id = ?).
       Se existe → pula sem erro.
       Se não existe → insere.

       Mesmo princípio para arquivos físicos: antes de copiar,
       verifique se o destino já existe. Se sim, pula.

       Critério de teste: rodar o app 2 vezes seguidas NÃO duplica
       arquivos nem registros, e NÃO retorna erro.

6. REPOSITORIES MÍNIMOS

   Crie em src/data/repositories/ apenas o CRUD básico (list,
   getById, create, softDelete) para:
     - patternLayerRepo
     - appliqueRepo
     - engravingRepo
     - markingRepo

   Sem regras de negócio. Sem validações complexas. Sem hooks
   React. Sem UI. Apenas funções tipadas que falam com Drizzle,
   no padrão dos repos existentes da Onda 1.

═══════════════════════════════════════════════════════════════════

PROIBIÇÕES ABSOLUTAS NESTA ONDA

❌ NÃO mexer em canvasJson, LayerMeta, ou qualquer coisa do canvas.
❌ NÃO criar UI nova. Nenhum componente React. Nem placeholder.
❌ NÃO criar parser de SVG. NÃO descartar fills/styles. Isso é 6b.
❌ NÃO criar tabelas além das 4 + 1 coluna especificadas acima.
❌ NÃO migrar dados antigos (banco será zerado).
❌ NÃO usar alert()/prompt() nativos.
❌ NÃO inventar campos ou relacionamentos não previstos no ADR 010.
❌ NÃO criar ADR 008 ou ADR 009 — já existem com outro conteúdo.
❌ NÃO recriar lógica de seed das Ondas 1, 4.5, 5 — usar existente.

Se identificar que algo do escopo precisa ser ajustado, PARE,
documente no plano, e espere aprovação. Quebra de contrato é falha
crítica nesta colaboração.

═══════════════════════════════════════════════════════════════════

CHECKPOINTS DE VALIDAÇÃO (não pular)

CHECKPOINT A — Schema correto + ADR 010 criado
  Critério de saída:
    1. Arquivo docs/DECISIONS/010-camadas-hierarquicas-bancos-componentes.md
       existe e contém o conteúdo do anexo (ajustado p/ "ADR 010").
    2. Migration nova gerada em src-tauri/migrations/.
    3. App abre sem erro de SQL.
    4. Seeds antigos (Ondas 1, 4.5, 5) rodaram automaticamente:
       - SQL: SELECT COUNT(*) FROM machines >= 3
       - SQL: SELECT COUNT(*) FROM textures >= 4
       - SQL: SELECT COUNT(*) FROM fonts >= 5
    5. Página /dev/db-check mostra:
       - Tabela pattern_layers existe (vazia)
       - Tabela appliques existe (vazia, antes do seed da 6a)
       - Tabela engravings existe (vazia)
       - Tabela markings existe (vazia)
       - Coluna parentLayerId em pattern_slots
    6. SQL: PRAGMA table_info(pattern_slots) confirma a coluna.

  AGUARDE APROVAÇÃO antes de seguir pro B.

CHECKPOINT B — Seeds e arquivos físicos
  Critério de saída:
    1. SQL: SELECT COUNT(*) FROM svg_bases  → 4
    2. SQL: SELECT COUNT(*) FROM appliques → 3
    3. SQL: SELECT COUNT(*) FROM engravings → 0
    4. SQL: SELECT COUNT(*) FROM markings   → 0
    5. SQL: SELECT id, name, widthMm, heightMm FROM appliques
       mostra exatamente:
       - aplique-1-formato-d  | Aplique 1 — Formato D | ~100 | ~90
       - aplique-2-pill       | Aplique 2 — Pill      | ~95  | ~15
       - aplique-3            | Aplique 3             | (real)
    6. SQL: SELECT id, name FROM svg_bases mostra os 4 ids fixos
       da especificação (svg-base-*).
    7. Diretório %APPDATA%\com.capilaser.studio\assets\appliques\
       contém os 3 .svg.
    8. Diretório %APPDATA%\com.capilaser.studio\assets\svg-bases\
       contém os 4 .svg.
    9. Reabrir o app NÃO duplica registros nem arquivos
       (idempotência por id fixo + checagem de filesystem).

  AGUARDE APROVAÇÃO antes de seguir pro C.

CHECKPOINT C — Repositories funcionam
  Critério de saída:
    1. Botão temporário em /dev/db-check chama appliqueRepo.list()
       e mostra os 3 registros como JSON na tela.
    2. patternLayerRepo.list() retorna [] sem erro.
    3. lint + typecheck passam:
       npm run lint && npm run typecheck
    4. Testes existentes da Onda 1+ ainda passam:
       npm run test

  AGUARDE APROVAÇÃO antes de fechar a onda.

═══════════════════════════════════════════════════════════════════

PROCESSO

Sua primeira mensagem nesta onda deve ser EXCLUSIVAMENTE:

  1. Confirmar que leu PLANO-ADR-camadas-hierarquicas (anexo),
     AI-CONTEXT, 01-DATABASE, e o README das fixtures.
  2. Listar 3+ perguntas críticas se houver. Se não tiver, dizer
     explicitamente "sem perguntas".
  3. Apresentar o plano da 6a no formato:

     PLANO:
     - [passos numerados, ordem de execução]

     ARQUIVOS AFETADOS:
     - [lista completa]

     RISCO:
     - [pontos de atenção, ou "nenhum identificado"]

     TESTE:
     - [como validar cada checkpoint]

NÃO COMECE A CODAR ANTES DA APROVAÇÃO DO PLANO.

Após aprovação, execute em fases. Após CADA checkpoint (A, B, C),
PARE e aguarde validação visual do usuário antes de seguir.

Ao concluir tudo, forneça:

  RESUMO: o que foi feito
  ARQUIVOS ALTERADOS: lista
  COMO TESTAR: passos numerados
  RISCOS: se houver
  PRÓXIMA ONDA RECOMENDADA: 6b (parser SVG + LayerMeta refactor)

Boa execução.
═══════════════════════════════════════════════════════════════════
```
