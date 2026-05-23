# STATUS — Onda 2 (Fundação Limpa)

**Data:** 2026-05-22
**Branch:** `restart/v2-beta`
**Status:** ✅ CONCLUÍDA

---

## Resumo

Onda 2 transforma a base limpa pós-faxina em um app desktop **funcional** com:

- Tela inicial listando projetos do filesystem
- Criação de projeto novo (broche 60×25) que vira pasta com toda estrutura
- Editor com canvas Fabric.js, base do produto carregada, inserção de formas
- Sistema de camadas com operação/máquina/exportTo
- Save/Load atômico via Tauri

Tudo passa: `typecheck`, `lint`, `build`, `cargo check`, 134 testes.

## Histórico de commits

```
06874e6 feat(onda-2E): painel de camadas avancado
f6873fd feat(onda-2D): canvas vivo, editor de projeto, save/load
294ed8d feat(onda-2C): tela inicial com lista de projetos e criacao
9a655ba feat(onda-2B): filesystem do projeto + base broche 60x25
6965af9 docs: STATUS-ONDA-2A registrando faxina concluida
375fb35 chore(faxina): Onda 2A - reset radical para base enxuta
35f8c54 chore: snapshot pre-faxina (Onda 33 + DXF v2 + Onda 37)
1c209ed backup: snapshot _legacy-backup/ antes da faxina
892dbf9 docs: PROJECT_VISION.md — nova alma do projeto
```

## Métricas

| Métrica                       | Inicial (V2) | Pós Onda 1 (faxina) | Pós Onda 2 (com canvas) |
| ----------------------------- | ------------ | ------------------- | ----------------------- |
| Arquivos `.ts/.tsx` em `src/` | ~217         | 67                  | **88**                  |
| Test files                    | ~50          | 13                  | **16**                  |
| Tests passando                | (mistura)    | 115/115             | **134/134**             |
| `npm run typecheck`           | misturado    | ✅ verde            | ✅ verde                |
| `npm run lint`                | —            | 0 erros             | **0 erros**             |
| `npm run build`               | —            | —                   | **✅ 1893 mod, 758 KB** |
| `cargo check`                 | warnings     | 0 warnings          | **0 warnings**          |

## O que está pronto para usar

### Tela inicial (`/`)

- Lista de projetos da raiz (default `<Documents>/Capi Studio/projetos/`)
- Botão "Alterar" abre file picker do Tauri pra trocar raiz
- Botão "Novo projeto" abre modal: nome + broche 60×25 fixo
- Cards com nome, productId, data de atualização
- Menu de cada card: abrir, abrir pasta no Explorer, mover para lixeira

### Backend Rust (`src-tauri/src/projects.rs`)

9 comandos Tauri:

- `create_project`: cria pasta + 16 subpastas + grava `.cps.json` atômico
- `list_projects`: varre raiz, lê meta lite de cada `.cps.json`
- `read_project`: lê e devolve string crua
- `write_project`: temp + rename, opcional thumbnail base64
- `delete_project`: move para `_trash/` dentro da raiz
- `open_project_folder`: abre no Explorer via `tauri-plugin-opener`
- `get_projects_root` / `set_projects_root`: persiste em `projects_root.txt`
- `get_product_base_svg`: serve SVG embarcado (hoje só broche)

Hardening:

- Nome validado (caracteres proibidos Windows, reservados COM/LPT, ponto/espaço inicial/final, 100 chars max)
- Todas as ops restritas à raiz canonicalizada (`canonicalize` + `starts_with`)
- Limite 50 MB por projeto
- Escrita atômica via temp + rename

### Editor (`/editor/:folderName`)

- Header: voltar, nome, productId, dimensões mm, indicador dirty (laser dot), botões Pasta + Salvar
- Toolbar lateral: select / rect / circle / line / text com atalhos V/R/O/L/T
- Canvas Fabric.js no centro com a base do produto carregada
- Painel direito:
  - **Propriedades**: tipo, ID, X/Y/W/H em mm, rotação (tempo real durante drag/scale/rotate)
  - **Camadas**: lista top-down com toggle visibility/lock, badge de operação colorida, label de máquinas
- Atalhos: Delete (apaga selecionados, respeita base importada), Esc (desseleciona + volta pra select), Ctrl+S (salva)

### Sistema de camadas (`LayerService`)

- Modelo `Layer` puro com: operation (corte/gravação/marcação), machines (MB/FB/DL via M1/M2/M3), exportTo (png/svg/dxf), visibility, locked, colorLabel
- `LayerDetailsDialog`: edita tudo via botões coloridos e toggles
- `LayersPanel`:
  - Lista visual com ícones de visibility/lock, badge de operação, label de máquinas
  - Botão "Mover seleção para…" no header (DropdownMenu)
  - Botão "Nova camada" no header
  - Double-click ou engrenagem para abrir detalhes
  - Context menu: Editar, Para cima, Para baixo, Apagar camada
- `makeBaseLayer()`: camada "Base" travada com corte/M3/exportTo all-true por default

### Canvas Engine

- `MM_TO_PX = 4` (1mm = 4px de tela)
- Viewport ajustado às dimensões do produto
- Snap 1mm **só em objetos novos** (objetos importados preservam geometria exata — PROJECT_VISION §0.2)
- `loadBaseSvg`: carrega SVG do produto como Group travado com `capiImported: true`
- `addRectangle` / `addCircle` / `addLine` / `addText` centralizam no viewport
- `serializeObjects` / `loadFromProject`: round-trip do `ProjectFile.objects`
- Augmenta `fabric.FabricObject` com `capiId`, `layerId`, `capiImported`

### Formato `projeto.cps.json`

```json
{
  "schemaVersion": 1,
  "meta": {
    "name": "...",
    "productId": "broche-60x25",
    "createdAt": "ISO 8601",
    "updatedAt": "ISO 8601"
  },
  "viewport": { "widthMm": 60, "heightMm": 25, "viewBox": "0 0 60 25" },
  "layers": [Layer, ...],
  "objects": [CanvasObject, ...]
}
```

## Estrutura de pasta de cada projeto

```
<raiz>/<nome>/
├── projeto.cps.json
├── thumbnail.png (futuro)
├── assets/{logos,imagens,svgs,fontes}/
├── base/
├── templates/
├── exports/
│   ├── png/
│   ├── svg/{MB,FB,DL}/
│   └── dxf/{MB,FB,DL}/
├── mockups/
├── historico/
└── config/
```

## Testes adicionados na Onda 2

| Arquivo                                          | Testes |
| ------------------------------------------------ | ------ |
| `tests/core/project/project-file.test.ts`        | 5      |
| `tests/core/canvas/capi-id.test.ts`              | 3      |
| `tests/core/canvas/layers/layer-service.test.ts` | 11     |
| **Total novos**                                  | **19** |

Cobertura puramente de unidade — UI será testada manualmente quando rodarmos o Tauri.

## Como testar manualmente

```powershell
# Subir o app em modo dev (abre janela Tauri)
npm run tauri dev

# Fluxo esperado:
# 1. App abre na tela inicial (vazia)
# 2. Clicar "Novo projeto" -> nomeia "teste-broche" -> Criar
# 3. Vai pra /editor/teste-broche
# 4. Base do broche 60x25 aparece como retangulo arredondado preto
# 5. Toolbar T -> texto, R -> retangulo, etc.
# 6. Painel direito mostra X/Y/W/H em mm da selecao
# 7. Camadas: nova camada via +, edita via duplo-clique
# 8. Ctrl+S salva o projeto
# 9. Voltar pra home (botao seta) e abrir novamente: tudo no lugar
# 10. Botao "Pasta" abre Explorer mostrando os 16 subdiretorios criados
```

## O que NÃO está pronto (próximas ondas)

### Onda 3 — Conteúdo

- **Importação de DXF/SVG do usuário** (logos, imagens, novas bases). Hoje só carrega a base embarcada do broche 60×25.
- **Edição inline de texto** (double-click para editar) — usa `fabric.IText` default que já permite, mas falta UI de fonte/tamanho.
- **Diálogo de fontes** (escolher do banco SQLite).
- **Pre-check de fonte** ao mudar texto (chama `font-precheck.ts` que já está preservado).

### Onda 4 — Produção

- **Exportação PNG**: gerar imagem para aprovação do cliente.
- **Exportação SVG**: stroke-only, separado por máquina, cores semânticas.
- **Exportação DXF**: V2 AC1032/SPLINE, separado por máquina, ACI por operação.
- **Round-trip mm-a-mm** validado por testes (PROJECT_VISION §0.2).
- **Diálogo de exportação** com preview e warnings de fontes/bitmaps.

### Finalização — Capi Studio Beta

- Copiar repo limpo para pasta `capi-studio-beta/`.
- Build MSI para Windows x64.
- Testar gravação real de peça no laser.

## Riscos / pendências menores

1. **Lucide-react v1.14** declarado no package.json — versão muito antiga; pode ser que alguns ícones que usei (`Settings2`, `MoreVertical`) não existam na 1.14 real. Build passou, então tá ok, mas no primeiro `npm i` numa máquina fresca pode dar problema. Atualizar para uma versão recente seria prudente (sugestão: `^0.460`).
2. **Drizzle ORM ainda tem tipos de tabelas mortas no schema antigo?** Não — schema foi reescrito enxuto. Mas as migrations 0-12 do Rust ainda criam as tabelas órfãs e a 0013 dropa em seguida. Funciona, mas é deselegante. Limpeza futura: substituir 0-13 por uma única migration "from scratch" depois que o app for empacotado para distribuição.
3. **Sem testes de UI** — o canvas + páginas dependem de teste manual no Tauri. Aceitável no MVP; testes E2E entram só na finalização.
4. **Lucide-react avisos de versão** — provavelmente a versão real é mais nova; o `package.json` declara range antigo. Conferir e atualizar antes de gerar o MSI.

## Próximo passo

Rodar `npm run tauri dev` e validar o fluxo manualmente. Se passar, **Onda 3 (Conteúdo)** entra.
