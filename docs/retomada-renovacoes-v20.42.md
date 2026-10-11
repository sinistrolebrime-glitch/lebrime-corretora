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