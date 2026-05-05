# ADR 001 — Aceitar vulnerabilidades transitivas de Fabric.js 6

**Data:** 2026-05-05
**Status:** Aceito

## Contexto

Após a instalação das dependências da Onda 0, `npm audit` reporta **6 vulnerabilidades transitivas** na cadeia `fabric@6 → jsdom → tar`:

- 3 high — `node-tar` (path traversal, symlink escape, hardlink target escape, Unicode race no APFS)
- 3 moderate/low — derivadas de `@mapbox/node-pre-gyp` que depende do mesmo `tar`

Nenhuma das vulnerabilidades está em código importado diretamente pelo `core/` do Capi Studio.

Resolução automática via `npm audit fix --force` faz downgrade ou upgrade major em `fabric`, quebrando a API que será usada no canvas (`Canvas`, `loadFromJSON`, exportação SVG, etc.).

## Decisão

**Aceitar as vulnerabilidades.** Não executar `npm audit fix --force`. Manter `fabric@^6` travado.

## Justificativa

1. **Transitivas, não diretas.** `tar` e `jsdom` não são chamados pelo nosso código — só pelo pipeline interno do Fabric.
2. **Surface de uso restrita.** O Fabric usa `jsdom` apenas para parsing SVG em ambientes sem DOM (Node SSR/testes). No runtime do Capi Studio (WebView do Tauri), o DOM nativo do Chromium é usado, e o caminho que toca `jsdom` raramente executa.
3. **Surface de ataque mínima.** O app roda local em desktop Tauri, sem exposição à internet, sem aceitar arquivos `.tar` de origem não-confiável, sem servidor HTTP. Os vetores de exploração das CVEs (extração de tarballs maliciosos, links simbólicos manipulados) não são alcançáveis pelo fluxo do produto.
4. **Fabric.js 6 é não-negociável.** É a única biblioteca canvas madura com import/export SVG nativo (40× mais popular que alternativas), explicitamente exigida em `03-CLAUDE-CODE-KICKOFF.md` (justificativa da escolha de stack). Trocar de canvas implicaria reescrita arquitetural.

## Consequências

- **Risco residual aceito.** As CVEs ficam no `node_modules` mas sem caminho de exploração no produto entregue.
- **Revisão mensal.** Verificar se `fabric@7+` ou patch posterior remove `jsdom`/`tar` da árvore. Quando remover, atualizar e fechar este ADR com follow-up.
- **CI:** `npm audit` exibirá os warnings indefinidamente. Se adicionarmos audit ao pipeline, configurar `--audit-level=critical` ou allowlist explícita pra essas advisories (`GHSA-34x7-hfp2-rc4v`, `GHSA-8qq5-rm4j-mr97`, `GHSA-83g3-92jg-28cx`, `GHSA-qffp-2rhf-9h96`, `GHSA-9ppj-qmqm-q256`, `GHSA-r6q2-hw4h-h46w`).
- **Documentação:** este ADR é referência única ao revisar `npm audit` no futuro — não revisitar a decisão sem evidência nova de exploração real.

## Follow-up

- [ ] 2026-06-05 — checar se `fabric@7` ou `fabric@6.x` posterior removeu `jsdom`/`tar`.
- [ ] Se sim, atualizar e marcar este ADR como `Substituído por ADR-NNN`.
