# Supabase backend — Lebrime

Projeto de produção: `lebrime-sistema` (região `sa-east-1`).

## Componentes

- tabela `public.records` como armazenamento central da carteira;
- bucket privado `lebrime-docs` para PDFs e imagens;
- Edge Function `lebrime-api` como camada autenticada entre a interface e o banco/storage.

## Segurança

Não versionar no GitHub chaves `service_role`, hashes de senha ou outros segredos.
A função de produção usa segredos somente no ambiente do Supabase.

## Documentos

Os arquivos devem ser enviados para `lebrime-docs` e o registro `document` deve guardar:
- `clientId`;
- `policyId` ou `proposalId` quando houver vínculo com seguro;
- `storageKey`;
- nome original, MIME type e tamanho.

A interface atual reaproveita registros de documentos pendentes quando um arquivo antigo é reanexado, evitando duplicação.


## Integração Porto — Arquivo de Retorno

A interface v19.2 possui uma área **Integrações > Porto** e a Edge Function `lebrime-api` possui as ações autenticadas:

- `integration-status`: mostra se o conector está configurado, última sincronização e arquivos recentes;
- `porto-sync`: consulta até 7 dias no Webservice oficial, baixa apenas arquivos novos e preserva o original no bucket privado.

Credenciais devem existir apenas como segredos do ambiente Supabase:

- `PORTO_SUSEP`;
- `PORTO_LOGIN`;
- `PORTO_PASSWORD`;
- `PORTO_ENDPOINT` é opcional; sem ele é usado o endpoint de produção documentado pela Porto.

**Nunca** salvar Token/Senha da Porto em `script.js`, HTML, banco em texto aberto ou GitHub.

Os arquivos originais são armazenados em `lebrime-docs/integrations/porto/<ano>/<mês>/...` e registrados como `integration_file`. Cada execução cria um `integration_sync` para auditoria.

A primeira etapa do conector faz aquisição segura e idempotente dos arquivos. A interpretação de APP/API/XPP/XPI/COM/SAP/CBS/SI2 deve respeitar o layout específico de cada arquivo; não inventar campos quando o layout ou uma amostra real ainda não estiver disponível.
