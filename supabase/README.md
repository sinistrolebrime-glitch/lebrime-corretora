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
