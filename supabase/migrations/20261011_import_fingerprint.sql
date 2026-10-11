-- LEBRIME: bloqueio persistente de importação repetida do mesmo seguro.
-- Aplicado em produção em 11/10/2026. Reexecutável.
-- Não altera contratos antigos, pois a chave só existe nos novos cadastros.
CREATE UNIQUE INDEX IF NOT EXISTS lebrime_unique_import_fingerprint
ON public.records ((data->>'importFingerprint'))
WHERE kind IN ('proposal','policy')
AND NULLIF(data->>'importFingerprint','') IS NOT NULL;
