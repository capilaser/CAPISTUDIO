# IDEA — Suporte completo a fontes variable no opentype.js

**Origem:** 2026-05-11, Onda 9 Fase 9D-bis (commit `4826594`)
**Status:** Limitação conhecida com fallback graceful em produção; fix opcional pra ondas futuras

## Resumo

A Fase 9D-bis vetoriza `fabric.Text` em `<path>` SVG via `opentype.js@1.x`.
Funciona com 4 das 5 fontes bundled na Onda 4.5:

| Fonte            | Tipo               | opentype.js |
| ---------------- | ------------------ | ----------- |
| Bebas Neue       | Estática (Regular) | ✅          |
| Montserrat       | Variable           | ✅          |
| Caveat           | Variable           | ✅          |
| Playfair Display | Variable           | ✅          |
| **Roboto Slab**  | **Variable**       | **❌**      |

## O bug

`Roboto Slab Variable` falha no primeiro `font.getPath()` com:

```
substitutionType: 62 lookupType: 6 - substFormat: 2 is not yet supported
```

Origem: `opentype.js` não implementa todas as variantes da tabela GSUB
recente (`lookupType: 6` = chained context substitution; `substFormat: 2`
= class-based). Limitação genuína da biblioteca, não bug de código nosso.

## Como o sistema lida hoje (fallback implementado)

Detectado em [src/core/export/svg-text-converter.ts](../../src/core/export/svg-text-converter.ts):

1. `convertTextToSvgPath` chama `font.getPath()` envolvido em try/catch
2. Falha vira `TextConversionError({ kind: 'font-unsupported' })`
3. Resultado **cacheado** — próxima chamada com mesma fonte curto-circuita
   sem reparsear
4. `svg-exporter` captura o erro, cai pro placeholder XML
   `<!-- Texto pendente: 'Nome' (Onda 9D-bis: opentype.js) -->`
5. Callback `onTextConversionError` informa a UI pra mostrar toast

Resultado: o pedido continua exportável (apliques, gravações, marcações,
e outros textos com fontes funcionais). Só os textos com Roboto Slab
ficam como placeholder; o usuário precisa vetorizar manualmente no
software laser ou trocar pra outra fonte.

## Quando faz sentido investir no fix

Quando algum dos cenários for verdade:

- Gabriell quer oferecer Roboto Slab no painel de fontes do produto e
  usuários reclamam que "fonte sumiu no SVG de produção".
- Equipe da fábrica reclama do retrabalho manual de vetorizar textos
  em Roboto Slab.
- Aumento do banco de fontes traz outras com a mesma limitação GSUB.

Enquanto isso, o fallback atual é suficiente.

## Caminhos de fix (escolher na hora)

### Opção A — Trocar Roboto Slab por versão estática

**Esforço:** baixo. Baixar [Roboto Slab estático](https://fonts.google.com/specimen/Roboto+Slab) (não-variable), substituir em `src-tauri/resources/fonts/RobotoSlab-Variable.ttf`.

**Trade-off:** perde controle fino do peso (variable permite qualquer
valor entre 100-900; estática usa pesos pré-definidos). Aceitável se
a UI só expõe Regular/Bold.

**Atenção:** lembrar do [tauri_resources_cargo_clean](../../../.claude/projects/c--Users-Gabriell-Desktop-Capi-Studio-0-2/memory/tauri_resources_cargo_clean.md)
— qualquer mudança em `resources/` exige `cargo clean`.

### Opção B — Instalar `fontkit`

**Esforço:** médio. `fontkit` suporta variable fonts e GSUB completa,
mas é dep maior (~500KB) e tem API diferente do opentype.js. Refatorar
[svg-text-converter.ts](../../src/core/export/svg-text-converter.ts)
pra usar `fontkit.Font.layout()` em vez de `Font.getPath()`.

**Trade-off:** binário do app maior, dep extra a manter, mas suporta
todas as variable fonts atuais e futuras.

### Opção C — Substituir Roboto Slab por equivalente

**Esforço:** baixo. Roboto Slab serifada → trocar por outra serifada
suportada (Playfair Display já está bundled e funciona, mas é mais
display/elegante). Pode trazer **EB Garamond Variable** ou **Lora
Variable** (testar primeiro com opentype probe).

## Como detectar em fontes novas

Quando adicionar uma fonte nova ao banco (Onda 10 — UI cadastro):

1. No upload, testar `opentype.parse(buffer)` + `font.getPath('Teste', 0, 0, 16)`
2. Se erro: marcar fonte como "vetorização manual necessária no export"
   no banco (campo a adicionar) e mostrar warning no cadastro
3. Não bloquear cadastro — fonte ainda pode ser usada no canvas para
   visualização

Esta validação automatizada evita repetir a surpresa de descobrir só
no momento do export que a fonte X não funciona.

## Memória relacionada

- [opentype_roboto_slab.md](../../../.claude/projects/c--Users-Gabriell-Desktop-Capi-Studio-0-2/memory/opentype_roboto_slab.md)
  — registro pessoal pra sessões futuras lembrarem dessa limitação
