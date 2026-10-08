# LEBRIME — Checkpoint SegFlex — fluxo 638

Salvo em 08/10/2026 antes de migrar para um novo chat.

## Estado confirmado no Supabase
- Total: 960 PDFs
- Importados: 566
- Em revisão: 72
- Não processados: 322
- Último fluxo concluído: 638
- Último arquivo concluído: C00001170.PDF
- Próximo arquivo: C00001169.PDF
- Próximo folder_index: 639
- Tamanho de lote preferido: 10

## Regra de retomada
Sempre consultar primeiro:
`public.segflex_source_manifest`
com:
`status='unprocessed' order by folder_index`

Não confiar apenas no número do fluxo se o banco tiver avançado.

## Infraestrutura
- Supabase: paiezoesntmicnwcmemt
- `public.records`
- `public.segflex_source_manifest`
- `public.segflex_import_log`
- `public.import_segflex_record(jsonb)`
- `public.refresh_segflex_manifest_status()`
- `public.segflex_reliability_report()`

## Regras obrigatórias
- idempotência por sourceDriveFileId
- reutilizar cliente por CPF/CNPJ normalizado
- endosso não cria nova apólice
- não inventar dados ausentes
- PDF ilegível/ambíguo -> pending_review
- produtor/comissão somente quando explícitos no documento
- e-mail com nome de produtor não vale como anotação de produção
- preservar link/sourceDriveFileId
- em propostas, preferir a seção Forma de Pagamento quando houver divergência com resumo anterior, registrando a divergência em notes
- atualizar o manifest ao final de cada lote
- continuar em lotes de 10, mas gravar cada PDF de forma idempotente

## Checkpoints no banco
- segflex-import-checkpoint-current
- segflex-import-checkpoint-flow-638
