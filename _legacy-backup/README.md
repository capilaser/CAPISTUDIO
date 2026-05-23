# \_legacy-backup — Snapshot do V2 antes da faxina

Conteúdo preservado em **2026-05-22** antes da reconstrução documentada em [PROJECT_VISION.md](../PROJECT_VISION.md).

## Estrutura

```
_legacy-backup/
├── README.md                          ← este arquivo
├── extract.py                         ← script de extração (reexecutável)
├── db/
│   ├── capi-studio-active.db          ← DB ativo no momento do snapshot (405 KB) [git-ignored]
│   ├── capi-studio.1779055437.db      ← backup automático mais antigo  [git-ignored]
│   └── capi-studio.1779056121.db      ← backup automático mais recente [git-ignored]
├── logos/                             ← 4 SVGs uploaded pelo usuário (versionados)
├── patterns-svg/                      ← canvasJson dos 21 padrões (versionados)
├── orders.json                        ← 6 pedidos
├── order-items.json                   ← 7 itens
├── order-revisions.json               ← 6 revisões
├── patterns.json                      ← metadata dos 21 padrões
├── logos-meta.json                    ← metadata dos 4 logos
├── products.json                      ← 2 produtos
├── materials.json                     ← 9 materiais
├── material-families.json             ← 3 famílias
├── fonts.json                         ← 5 fontes
├── machines.json                      ← 3 máquinas
├── operations.json                    ← 7 operações
├── appliques.json                     ← 3 apliques
├── engravings.json                    ← 1 gravação
└── markings.json                      ← 0 marcações (vazio mas extraído)
```

## O que importa de verdade

1. **`logos/*.svg`** — 4 arquivos SVG que o usuário uploadou no app. **Estes precisam ser reimportáveis** no Capi Studio Beta quando o sistema de assets ficar pronto (Onda 3C).
2. **`patterns-svg/*.canvas.json`** — geometria dos 21 padrões customizados (em formato Fabric.js canvas JSON serializado). Não está em SVG/DXF puro porque o V2 armazenava como canvas state.

## O que NÃO importa (pode ser descartado depois)

- Orders/order-items/order-revisions: experimentos da semana de 15–19 mai/2026 ("Novo Pedido 01–06"). Sem exports finalizados, sem dados de cliente reais.
- Apliques/engravings/markings: dados de seed de desenvolvimento.

## Como restaurar

- **Logos para o Beta:** quando a Onda 3C (assets) estiver pronta, copiar os 4 SVGs de `_legacy-backup/logos/` para `<projeto>/assets/logos/` do projeto Beta correspondente.
- **Padrões como referência visual:** abrir `patterns-svg/<nome>.canvas.json` num parser Fabric.js para inspecionar geometria. Para reconstruir como template no Beta, terá que ser refeito à mão (formato Beta vai ser diferente).
- **DB inteiro:** restaurar com `Copy-Item _legacy-backup/db/capi-studio-active.db "$env:APPDATA\com.capilaser.studio\capi-studio.db"` e reabrir o V2 antigo (não recomendado depois da faxina — schema vai estar incompatível).

## Reexecutar extração

```powershell
python _legacy-backup\extract.py
```

Lê de `_legacy-backup\db\capi-studio-active.db` e regrava os JSONs. Útil se houver mudança no script ou nos dados antes do commit final.
