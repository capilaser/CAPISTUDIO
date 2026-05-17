-- Onda 14 — Limpa patterns de teste/dev acumulados nas Ondas 8/12.
--
-- Patterns que entraram via /dev/canvas-test e via fluxos quebrados ficaram
-- no banco com nomes lixo ("Dev Test", "s", "f", "KKK", "placa", etc),
-- inflacionando a galeria do operador.
--
-- Estratégia em dev (banco pode ser apagado): soft-delete tudo que existe.
-- O seed da Onda 14 popula a tabela com patterns Wave 1 reais (com-borda,
-- sem-borda, 1-traço, 2-traços, logo+nome) — esses nascem com wave=14
-- pra distinguir de qualquer pattern legado que sobreviva.
--
-- NÃO usamos DELETE: soft-delete preserva FK constraint em order_items
-- (que pode referenciar patternId mesmo se o pattern foi descontinuado).
-- O seed roda depois e usa INSERT OR IGNORE.

UPDATE patterns
   SET deleted_at = unixepoch()
 WHERE deleted_at IS NULL;
