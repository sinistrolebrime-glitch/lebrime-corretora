# LEBRIME — Ponto de implantação de renovações (11/10/2026)

## Versões
- Área gerencial: v20.42 (formulário ativado em v20.40; abas da ficha e histórico financeiro em v20.41; qualidade documental em v20.42).
- Área operacional: v20.41 (ficha separada em histórico, dados, parcelas e PDFs; endpoint `lebrime-operational-portal` v2).
- O projeto segue em `sinistrolebrime-glitch/lebrime-corretora`, branch `main`. Todos os commits geram testes de regressão e GitHub Pages.

## Lista das vigências vencidas
- Arquivo privado: https://docs.google.com/spreadsheets/d/1FoypsjQBOsuVoZIT_hofaPylHzLbpCX9nRh_Kdq-1aM/edit
- Data-base 11/10/2026: 259 clientes sem contrato no prazo e 50 com ao menos uma vigência antiga vencida e outro contrato no prazo. Não classificar automaticamente os 50 como já renovados: verificar risco e ramo.
- Nenhum PDF novo foi importado por esta etapa de desenvolvimento.

## Funcionamento atual do formulário
- Gerencial > Documentos > Importar nova proposta / Renovação, ou botão na ficha do cliente.
- Escolher cliente **existente**, opcionalmente a vigência anterior, corretora, seguradora, ramo, número, datas, prêmio, parcelas e PDF.
- O sistema verifica a existência da proposta na carteira, recarrega a carteira para reduzir colisões, valida PDF pela assinatura `%PDF-` e limita a 15 MB.
- O sistema insere o **novo contrato e o documento** no mesmo lote transacional, preservando o contrato anterior, vinculando `renewalOf` quando selecionado, e posteriormente chama a extração de pagamentos do PDF.
- Parcelamentos não comprovados ficam em revisão e sem cobrança automática; produtor, comissão e valor segurado ausentes ficam marcados como pendentes.
- O usuário tem botão para abrir a ficha atualizada após o cadastro.

## Histórico nas fichas
- Gerencial: abas Histórico, Dados, Parcelas (todos os pagamentos e vencimentos), Documentos/PDFs, Pendências/Sinistros. Comissões continuam na gestão.
- Operacional: Histórico, Dados, Parcelas (sem comissão nem produtor), PDFs vinculados ao contrato.
- Alterações na área operacional dependem da sessão autorizada, não dispensam autenticação.

## Cobertura dos dados
- Novo painel gerencial exibe dimensões documentadas separadamente: documento do cliente informado, datas de vigência corretas, PDF vinculado, produtor informado e vencimento da parcela.
- Não é correto chamar essas coberturas de precisão/confiabilidade geral; a validação depende do PDF, relatórios e pagamentos.

## Próximas etapas antes da carga em massa
1. Homologar visualmente com login gerencial e operacional e **uma proposta real de teste**, verificando histórico, PDF, parcelas, produtor e data.
2. Revisar campos extraídos automaticamente e confirmar produtor/comissões nos relatórios; o formulário ainda exige confirmação manual de informações do PDF.
3. Para lotes de muitas propostas, implementar prévia coletiva e pendências de reconhecimento, preservando reprocessamento idempotente.
4. Começar em blocos de 10 a 20 propostas; relatar contagem antes/depois e manter checkpoint a cada lote.
5. Não assumir que todas as 5.176 parcelas antigas sem vencimento podem ser recuperadas só dos PDFs; algumas dependem de fatura/cartão, boleto ou confirmação da seguradora.

## Testes
- `tests/renewal_import.cjs`: criação nova com PDF, deduplicação, confirmação da assinatura, proteção do cliente.
- `tests/manager_client_tabs.cjs`: abas gerenciais e histórico de parcelas.
- `tests/operational_extras.cjs`: busca de uma letra, PDFs, parcelas na ficha, ocultação de comissões.
- `tests/portfolio_quality.cjs`: métricas de cobertura sem percentual genérico.
- Workflow `Regressões do portal Lebrime` verifica também demais regras de comissionamento e segurança.

## Observações
- Esta fase não alterou nem importou proposta real; somente código e endpoint da área operacional foram publicados.
- O backend ainda precisa de teste funcional com credenciais válidas e documentos reais para homologação total.
## Evolução subsequente — v20.43 e v20.44 (11/10/2026)

- **v20.43 — Fila de até 50 PDFs por seleção:** módulo `importacao-lote.js`, no menu Gerencial > Arquivos, recebe PDFs no navegador, confere assinatura e limite de 15MB por arquivo, calcula SHA-256, identifica duplicatas dentro do lote e em documentos já cadastrados com hash, e sugere cliente **somente** por CPF/CNPJ ou nome completo no arquivo. Não salva ou cadastra documentos sem confirmação.
- Ao clicar em **Revisar**, o arquivo é transferido ao formulário validado de renovação. O gestor confirma CPF/CNPJ, seguradora, ramo, número, datas, corretora e prêmio antes de concluir. A fila marca **Importado** apenas quando o novo contrato foi gravado e o documento relacionado; é possível exportar andamento em CSV. O navegador não conserva os bytes dos PDFs após fechar a aba.
- **Antiduplicidade reforçada:** `renovacao-cadastro.js` passou a gravar `sourcePdfSha256` / `fileSha256` e um `importFingerprint` determinístico (cliente, seguradora, ramo, número, início, fim). Índice único `lebrime_unique_import_fingerprint` já aplicado em produção e versionado em `supabase/migrations/20261011_import_fingerprint.sql`. Os registros anteriores não foram modificados.
- **v20.44 — Central de pendências:** módulo `central-conferencia.js` reúne clientes com contratos vencidos, contratos sem PDF, produtor a conferir, parcelas abertas sem vencimento documentado e planos de parcelas cuja soma diverge do prêmio. Os números são derivados dos dados, com filtro de cliente e atalho para a ficha. Nenhuma cobrança ou baixa é disparada pelo painel.
- Suites adicionadas: `tests/bulk_import.cjs` e `tests/review_center.cjs`. Testes de produção incluem o carregamento dos novos arquivos. A primeira importação real com credenciais válidas ainda exige homologação manual.
- **Data sensível:** a lista privada dos 309 clientes continua no Google Sheets original, não foi inserida em arquivos do site público.
- Estado da carteira antes de carregar propostas novas: 663 clientes, 717 propostas, 49 apólices, 961 documentos, 5.473 parcelas. Nenhum novo cadastro real foi criado pela etapa de desenvolvimento.

## Evolução — prévia conservadora de propostas v20.45 (11/10/2026)

- Nova ação autenticada `proposal-preview` na Edge Function `lebrime-api` v27. Exige perfil `gestor`, content-type PDF, limite de 15 MB e assinatura `%PDF-`. Lê em memória, sem criar registro ou arquivo.
- Arquivos: `supabase/functions/lebrime-api/proposal_preview.mjs` (parser puro por rótulos e evidências) e `pdf_reader.ts` (PDF.js, até 20 páginas de texto, sem OCR). `index.ts` é gerido pelo deploy ativo no Supabase; não foi copiado ao repositório GitHub por conter informações de autenticação/segredos existentes.
- Gerencial > Arquivos > Formulário nova proposta: botão **Ler PDF e mostrar prévia**, campos identificados com página/trecho, aviso de divergência de CPF/CNPJ, confirmação manual de transferência ao formulário.
- Campos possíveis: CPF/CNPJ, segurado, seguradora, ramo, número, início/fim de vigência, prêmio total, valor assegurado/LMI total (somente rótulos explícitos). **Não** inferir FIPE/valor segurado, produtor ou comissão. Para PDF escaneado sem texto selecionável, retornar pendência manual.
- Parcelamento da prévia é apenas informativo; a quantidade de parcelas só é sugerida quando valores e todas as datas conciliam com o prêmio. **Nenhuma parcela é gravada na prévia**; a conciliação de produção ocorre no fluxo original após salvar a proposta.
- Dados só entram no formulário quando o gestor clica em Aplicar campos conferidos. A gravação do contrato e PDF continua sujeita a confirmação explícita e validações de duplicidade.
- Novos testes `tests/proposal_preview.mjs` (datas, valores, ambiguidade, arquivo sem texto) e `tests/proposal_preview_ui.cjs` (sem alteração antes da confirmação, CPF divergente). Smoke confirma que `proposal-preview` recusa tokens ausentes/inválidos.
- Estado: implementação com testes simulados, **ainda não homologada com PDF real e autenticação de gestor**. Não usar para importação massiva sem primeiro validar proposta real e dados gerados nas fichas de gerencial e operacional.
- Próximos passos: homologar PDF real de frota, empresarial, auto e renovações; melhorar reconhecimento por seguradora; incorporar checklist de revisão de producer/comissão e prova de parcelas; preservar histórico.
