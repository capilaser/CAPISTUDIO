# IDEIA — Precisão exata em `originalBounds` após drag/scale do aplique

**Origem:** 2026-05-10, Mini-Onda 8.6, validação do Gabriell
**Status:** Proposta, sem data — limite conhecido aceito; candidata à Onda 13

## Resumo

Após drag/scale do usuário em um aplique, `PrincipalLayerMeta.originalBounds` volta a ler do estado Fabric (`obj.width × scaleX`), reintroduzindo o erro de margem do viewBox (~0.1-0.4mm, dependendo da margem interna que o Corel deixou no SVG). A precisão **exata** existe apenas na **criação** do aplique (quando `addAppliqueSvg` lê direto de `meta.widthMm/heightMm` do viewBox).

## Problema que resolve

A Mini-Onda 8.6 resolveu precisão na **criação** populando `originalBounds` direto do `CorelSvgMeta` (autoritativo, ADR 005). A partir do momento que o usuário interage com o aplique (arrasta ou redimensiona pelas alças), o handler `attachPrincipalBoundsUpdater` em `canvas-engine.ts` recalcula `originalBounds` usando `obj.width × scaleX` — e isso reintroduz o erro de margem que existia antes da Mini-Onda 8.6.

**Impacto real:** pequeno. O erro fica **congelado** em 0.1-0.4mm (não cresce com interações repetidas — é determinístico dado o SVG), o que está dentro da tolerância da maioria das máquinas laser comuns (~±0.1mm). Detectável visualmente apenas em peças que **devem casar exatamente** entre si — por exemplo, uma gravação centralizada num aplique que foi arrastado depois.

Cenário comum onde isso **não** vira problema: o usuário cria o aplique (preciso), centraliza a gravação **antes** de mover, depois move o conjunto inteiro (gravação acompanha o pai). Ali o erro entra mas não compromete o alinhamento relativo entre filho e pai.

Cenário onde vira problema: usuário move o aplique sozinho, **depois** cria gravação dentro dele (que vai herdar o `originalBounds` agora com erro). Ou move o aplique, **depois** alinha um slot pré-existente dentro dele. Em ambos, o slot/gravação herda o erro de margem na hora de centralizar.

## Contexto técnico

- O handler `attachPrincipalBoundsUpdater` em `canvas-engine.ts` escuta `object:modified` e atualiza `originalBounds` com:
  ```ts
  meta.originalBounds = {
    left: pxToMm(obj.left ?? 0),
    top: pxToMm(obj.top ?? 0),
    width: pxToMm((obj.width ?? 0) * (obj.scaleX ?? 1)),
    height: pxToMm((obj.height ?? 0) * (obj.scaleY ?? 1)),
  };
  ```
- `obj.width` aqui é o `group.width` do `fabric.util.groupSVGElements`, que carrega o erro de margem (bbox dos shapes em vez de viewBox).
- O viewBox original do SVG (autoritativo) **só está disponível** dentro de `CorelSvgMeta` no momento da criação. Após `groupSVGElements`, esse dado **se perde** — o grupo Fabric não preserva o viewBox em nenhum atributo acessível.
- Único caminho pra evitar o erro pós-interação: **persistir o viewBox original** em algum campo do `PrincipalLayerMeta` (proposta abaixo).

## Esboço de implementação

1. **Adicionar campo `originalViewBoxMm` em `PrincipalLayerMeta`** (`src/data/schema.ts`):
   ```ts
   /**
    * Dimensões originais (em mm) declaradas no viewBox do SVG no momento da
    * criação. Imutáveis — não mudam com drag/scale do usuário. Usado para
    * recomputar originalBounds.width/height com precisão exata após interação.
    */
   originalViewBoxMm?: { width: number; height: number };
   ```
2. **Popular em `addAppliqueSvg`**:
   ```ts
   originalViewBoxMm: { width: meta.widthMm, height: meta.heightMm }
   ```
3. **Reescrever `attachPrincipalBoundsUpdater`**:
   - **Drag** (left/top mudaram, scale igual): apenas atualizar `left/top`, manter `width/height` do estado anterior.
   - **Scale**: calcular fator de escala a partir do estado Fabric (`obj.scaleX / scaleAtCriacao`), aplicar sobre `originalViewBoxMm.width/height`. Não ler do Fabric.
   - **Compor drag + scale corretamente**: detectar qual mudou comparando com o estado anterior do `originalBounds` ou com um cache do `obj.scaleX/scaleY` inicial.
4. **Cuidado com scale não-uniforme** (raro hoje porque slots não rotacionam e apliques mantêm proporção, mas o caller pode aplicar `scaleX !== scaleY` no futuro): aplicar fatores separados por eixo.

### Testes propostos

- Drag puro: `originalBounds.width/height` permanecem iguais aos da criação.
- Scale 2x uniforme: `originalBounds.width/height` exatamente o dobro do `originalViewBoxMm`.
- Scale não-uniforme (scaleX=1.5, scaleY=2): cada eixo independente.
- Drag + scale combinados: posição e tamanho corretos.
- Cobertura ≥ 90% do `attachPrincipalBoundsUpdater` reescrito.

## Quando faz sentido

- **Não prioritário.** Erro pós-drag está dentro da faixa de tolerância de máquina laser comum (~±0.1mm) e é menor que a tolerância humana visual (~0.5mm).
- Bom candidato pra **Onda 13** (polimento final).
- **Ou antes**, se algum caso de uso real expuser o problema: peça produzida visivelmente fora do esperado, queixa de cliente sobre alinhamento entre 2 peças que deviam casar, etc.
- **Antes da Onda 9 (export) não precisa.** Onda 9 vai exportar SVG com bounds corretos na criação (caminho hot), e o fluxo típico é "criar padrão → exportar". Usuário raramente arrasta aplique entre criar e exportar.

## Origem

Mini-Onda 8.6 (validação do Gabriell, 2026-05-10). Decisão "A" — aceitar o limite, registrar como IDEA pra não perder o contexto. Patch notes da Mini-Onda 8.6 já documentava o comportamento como "intencional, não bug"; este arquivo formaliza o follow-up futuro.

## Notas

- A redeclaração inline de `RectMm` em `schema.ts` (Mini-Onda 8.6) será cleanup separado — ver `onda-13-cleanup-geometry-type.md`. Esta IDEA pode ser implementada antes ou depois daquela; são independentes.
- O JSDoc atual em `PrincipalLayerMeta.originalBounds` e em `attachPrincipalBoundsUpdater` já menciona "após interação a fonte é o Fabric". Quando esta IDEA for implementada, atualizar essas notas pra refletir o novo contrato (fonte volta a ser o viewBox via `originalViewBoxMm`).
