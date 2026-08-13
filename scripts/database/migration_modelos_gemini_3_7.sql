-- ============================================================================
-- Migracao: gemini-3.6-flash -> gemini-3.7-flash
-- ============================================================================
--
-- Contexto:
--   O gemini-3.7-flash foi lancado e substitui o 3.6-flash como modelo padrao.
--   O gemini-3.5-flash-lite (agentes economicos) permanece inalterado.
--
--     gemini-3.6-flash  ->  gemini-3.7-flash
--
--   Sequencia de migracoes deste catalogo:
--     migration_modelos_gemini_3_6.sql  (aplicada em 2026-08-13)
--     migration_modelos_gemini_3_7.sql  (esta)
--
--   O codigo tem fallback (`GeminiService.LEGACY_MODELS`) redirecionando
--   gemini-3.6-flash -> gemini-3.7-flash, entao a aplicacao nao quebra antes
--   desta migracao rodar -- mas o select do /admin/prompts-config so fica
--   correto depois dela.
--
-- NAO altera a tabela de logs (`gemini_logs.model`): registro historico.
--
-- Uso:
--   psql "$DATABASE_URL" -f scripts/database/migration_modelos_gemini_3_7.sql
-- ============================================================================

BEGIN;

-- Conferencia previa: o que sera alterado
SELECT sistema, chave, valor
FROM configuracoes_ia
WHERE valor IN ('gemini-3.6-flash', 'google/gemini-3.6-flash')
ORDER BY sistema, chave;

UPDATE configuracoes_ia
SET valor = 'gemini-3.7-flash',
    updated_at = NOW()
WHERE valor = 'gemini-3.6-flash';

UPDATE configuracoes_ia
SET valor = 'google/gemini-3.7-flash',
    updated_at = NOW()
WHERE valor = 'google/gemini-3.6-flash';

-- Verificacao: deve retornar 0 linhas
SELECT sistema, chave, valor
FROM configuracoes_ia
WHERE valor LIKE '%gemini-3.6-flash%'
ORDER BY sistema, chave;

COMMIT;
