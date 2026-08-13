-- ============================================================================
-- Migracao: atualizacao dos modelos Gemini configurados em producao
-- ============================================================================
--
-- Contexto:
--   Os modelos abaixo foram descontinuados e substituidos:
--
--     gemini-3.1-flash-lite-preview  ->  gemini-3.5-flash-lite
--     gemini-3-flash-preview         ->  gemini-3.6-flash
--     gemini-3-pro-preview           ->  gemini-3.6-flash   (Pro removido do catalogo)
--
--   Os valores ficam gravados em `configuracoes_ia` (chaves `modelo`,
--   `modelo_<agente>`, `default_model`, etc). Sem esta migracao o backend
--   continua lendo os nomes antigos do banco e o select do /admin/prompts-config
--   exibe um valor que nao existe mais na lista de opcoes.
--
--   O codigo tem um fallback (`GeminiService.LEGACY_MODELS`) que redireciona os
--   nomes antigos, entao a aplicacao nao quebra antes desta migracao rodar --
--   mas a configuracao so fica correta na UI depois dela.
--
-- NAO altera a tabela de logs (`gemini_logs.model`): aquilo e registro
-- historico do que foi efetivamente chamado.
--
-- Uso:
--   psql "$DATABASE_URL" -f scripts/database/migration_modelos_gemini_3_6.sql
-- ============================================================================

BEGIN;

-- Conferencia previa: o que sera alterado
SELECT sistema, chave, valor
FROM configuracoes_ia
WHERE valor IN (
    'gemini-3.1-flash-lite-preview',
    'gemini-3-flash-preview',
    'gemini-3-pro-preview',
    'google/gemini-3.1-flash-lite-preview',
    'google/gemini-3-flash-preview',
    'google/gemini-3-pro-preview'
)
ORDER BY sistema, chave;

-- 1) Flash Lite: 3.1-flash-lite-preview -> 3.5-flash-lite
UPDATE configuracoes_ia
SET valor = 'gemini-3.5-flash-lite',
    updated_at = NOW()
WHERE valor = 'gemini-3.1-flash-lite-preview';

UPDATE configuracoes_ia
SET valor = 'google/gemini-3.5-flash-lite',
    updated_at = NOW()
WHERE valor = 'google/gemini-3.1-flash-lite-preview';

-- 2) Flash: 3-flash-preview -> 3.6-flash
UPDATE configuracoes_ia
SET valor = 'gemini-3.6-flash',
    updated_at = NOW()
WHERE valor = 'gemini-3-flash-preview';

UPDATE configuracoes_ia
SET valor = 'google/gemini-3.6-flash',
    updated_at = NOW()
WHERE valor = 'google/gemini-3-flash-preview';

-- 3) Pro descontinuado: 3-pro-preview -> 3.6-flash
UPDATE configuracoes_ia
SET valor = 'gemini-3.6-flash',
    updated_at = NOW()
WHERE valor = 'gemini-3-pro-preview';

UPDATE configuracoes_ia
SET valor = 'google/gemini-3.6-flash',
    updated_at = NOW()
WHERE valor = 'google/gemini-3-pro-preview';

-- Verificacao: deve retornar 0 linhas
SELECT sistema, chave, valor
FROM configuracoes_ia
WHERE valor LIKE '%gemini-3-flash-preview%'
   OR valor LIKE '%gemini-3-pro-preview%'
   OR valor LIKE '%gemini-3.1-flash-lite%'
ORDER BY sistema, chave;

COMMIT;
