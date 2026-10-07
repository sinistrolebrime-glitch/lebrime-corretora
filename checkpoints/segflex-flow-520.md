# LEBRIME — Checkpoint da Importação SegFlex

Salvo antes de nova tentativa no Work.

## Estado da carga
- Total de PDFs: 960
- Importados: 488
- Pendentes de revisão: 32
- Erros estruturais: 0
- Não processados: 440
- Último fluxo concluído: 520
- Próximo critério de retomada: primeiro registro de `public.segflex_source_manifest` com `status='unprocessed'`, ordenado por `folder_index`

## Próximos arquivos
1. C00001294.PDF — folder_index 521
2. C00001293.PDF — folder_index 522
3. C00001291.PDF — folder_index 523
4. C00001290.PDF — folder_index 524
5. C00001288.PDF — folder_index 525
6. C00001287.PDF — folder_index 526
7. C00001286.PDF — folder_index 527
8. C00001285.PDF — folder_index 528
9. C00001284.PDF — folder_index 529
10. C00001283.PDF — folder_index 530
11. C00001282.PDF — folder_index 531
12. C00001281.PDF — folder_index 532

## Infraestrutura
- Supabase project: `paiezoesntmicnwcmemt`
- Registros: `public.records`
- Manifest: `public.segflex_source_manifest`
- Log: `public.segflex_import_log`
- Importador: `public.import_segflex_record(jsonb)`
- Atualização do manifest: `public.refresh_segflex_manifest_status()`
- Health: `public.segflex_import_health()`
- Confiabilidade: `public.segflex_reliability_report()`
- Métrica atual: `segflex-reliability-current`
- Portal: v20.16

## Regras obrigatórias
- Processar 1 PDF por transação.
- Idempotência por `sourceDriveFileId`.
- Reutilizar cliente por CPF/CNPJ normalizado.
- Endosso não cria nova apólice.
- Não inventar dados ausentes.
- PDF ilegível ou ambíguo vai para `pending_review`.
- Não inserir parcelas manualmente quando os triggers já sincronizam.
- Produtor/comissão somente quando explícitos no documento.
- Preservar o link original e o `sourceDriveFileId`.
- Ao final de cada bloco, executar `public.refresh_segflex_manifest_status()`.

## Checkpoint no banco
Também foi salvo em:
- `public.records.id = 'segflex-import-checkpoint-current'`
- `public.records.id = 'segflex-import-checkpoint-flow-520'`

Se o Work parar ou perder contexto, retomar lendo esse checkpoint e consultando o manifest real antes de qualquer nova gravação.
