-- Onda 14b-schema (migration v12) — Limpa gambiarra documentada da Onda 13.7.
--
-- Antes: o snapshot do canvas único da prancha (com todos os broches juntos)
-- era gravado em `order_items` na posição 0 (items[0].canvas_json), enquanto
-- items[1+].canvas_json ficavam '{}'. Isso violava a semântica esperada de
-- order_items[i].canvas_json (que deveria ser o canvas DAQUELE broche, não
-- da prancha inteira).
--
-- Depois: cada `orders` ganha sua própria coluna `board_canvas_json` pra
-- guardar o snapshot da prancha. Idem `order_revisions`. items[i].canvas_json
-- fica '{}' pra todos por enquanto — refator de salvar canvas individual por
-- broche fica pra futuro (Fase D ou onda dedicada).
--
-- Migração de dados:
--   orders.board_canvas_json          ← order_items[position=0].canvas_json
--   order_revisions.board_canvas_json ← json_extract(items_json, '$[0].canvasJson')
--
-- Em dev o banco pode ser dropado livremente; em prod a migração preserva
-- o snapshot que estava na "gambiarra" pra reabertura continuar funcionando.

-- ── 1. orders.board_canvas_json ─────────────────────────────────────────────
ALTER TABLE `orders` ADD COLUMN `board_canvas_json` TEXT NOT NULL DEFAULT '{}';
--> statement-breakpoint

UPDATE `orders` SET `board_canvas_json` = COALESCE(
  (SELECT `canvas_json` FROM `order_items`
    WHERE `order_id` = `orders`.`id` AND `position` = 0
    LIMIT 1),
  '{}'
);
--> statement-breakpoint

-- ── 2. order_revisions.board_canvas_json ────────────────────────────────────
ALTER TABLE `order_revisions` ADD COLUMN `board_canvas_json` TEXT NOT NULL DEFAULT '{}';
--> statement-breakpoint

-- json_extract retorna NULL se o path não existe ou o JSON está vazio — COALESCE
-- normaliza pra '{}'. Note: o snapshot dentro de items_json[0].canvasJson é o
-- objeto serializado (string JSON dentro de string JSON), então json_extract
-- pode retornar tanto string (preferível) quanto null.
UPDATE `order_revisions` SET `board_canvas_json` = COALESCE(
  json_extract(`items_json`, '$[0].canvasJson'),
  '{}'
);
--> statement-breakpoint

-- ── 3. Zera order_items.canvas_json (todos) — reset semântico ──────────────
-- A partir de v12, items[i].canvas_json deixa de ser "snapshot da prancha".
-- Como o refator de salvar canvas individual por item ainda não existe,
-- todos viram '{}'. Pedidos legados perdem o conteúdo individual (que era
-- '{}' pra position>0 e snapshot pra position=0; este último já foi copiado
-- pra orders.board_canvas_json acima).
UPDATE `order_items` SET `canvas_json` = '{}';
