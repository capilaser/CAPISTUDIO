-- Migration 0013 — Drop tabelas fora de escopo (Onda 2B, restart V2).
--
-- O domínio "Pedido completo" (orders/order_items/order_revisions/order_overrides),
-- "Padrão Mestre vs Arte do Pedido" (patterns/pattern_layers) e "Banco de assets
-- por DB" (appliques/engravings/markings/logos/slot_types/svg_bases) foram
-- descartados conforme PROJECT_VISION.md. A persistência de projetos passa a ser
-- filesystem-first (/projetos/<nome>/projeto.cps.json).
--
-- O DB mantém apenas o catálogo global reutilizável: machines, operations,
-- machine_operations, fonts, categories, materials, material_families, products,
-- product_layers, product_machines, settings.
--
-- DROPs em ordem inversa de dependência (filhos antes dos pais).

DROP TABLE IF EXISTS order_overrides;
DROP TABLE IF EXISTS order_revisions;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;

DROP TABLE IF EXISTS pattern_layers;
DROP TABLE IF EXISTS patterns;

DROP TABLE IF EXISTS engravings;
DROP TABLE IF EXISTS markings;
DROP TABLE IF EXISTS appliques;
DROP TABLE IF EXISTS logos;

DROP TABLE IF EXISTS slot_types;
DROP TABLE IF EXISTS svg_bases;
