# Operação LEBRIME — mutirão de 46 propostas pendentes (outubro 2026)

## Objetivo
Importar e validar **46 PDFs** sem parar a carteira quando houver falha de consulta, documento incompleto, duplicidade ou interrupção de uma ferramenta. Este documento é um procedimento de operação, não uma confirmação de 46 cadastros concluídos.

### Antes da chegada dos PDFs
- **Meta:** 46 propostas; o painel de mutirão começa com zero recebidos. Não criar cadastros imaginários para completar a meta.
- O cliente poderá organizar os arquivos em **uma pasta privada do Google Drive**, de preferência **um PDF por proposta, com produtor e percentual no nome**, mantendo os originais.
- Criar um inventário de 46 entradas com nome do arquivo, identificador privado do Drive, status, cliente, ramo, proposta, produtor/%, parcelas e conferência. Não registrar números sem ler documentos.
- Nomear lotes de execução **B01 (10), B02 (10), B03 (10), B04 (10), B05 (6)**. Só iniciar após o inventário; cada documento individual ganha identificador de execução estável para evitar importações duplicadas.

## Rotas independentes de cadastro
1. **Rota principal — renovação validada:** fila existente `lebrime_import_queue`, funções `lebrime_enqueue_renewal` e `lebrime_process_import_queue`. Requer vínculo do contrato anterior, risco compatível e PDF privado. Job a cada minuto.
2. **Rota alternativa — nova proposta/cliente sem histórico localizado:** `lebrime_assisted_import_queue`, `lebrime_stage_assisted_import` e `lebrime_process_assisted_import_queue`. Documento e identidade devem ser conferidos antes do manifesto. Job independente a cada minuto, **cinco por rodada**, isolamento de erros por proposta.
3. **Rota de contingência — cadastro assistido no Supabase:** quando a API estiver indisponível, operador autorizado pode gravar **contrato individual** com transação e gatilhos de pagamentos/comissão, usando os mesmos controles de identidade, deduplicação e origem de PDF. Confirmar registros no banco antes de atualizar checkpoint. Usar apenas conexão autenticada, sem burlar RLS. Registrar requestKey e resultado.
4. **Falha temporária das ferramentas de escrita:** **não simular gravação**. Conservar PDF privado, inventário/checkpoint e os dados extraídos com comprovante e marcá-lo `revisão` para retomada. Prosseguir com os outros arquivos.

As duas filas não compartilham worker, progresso ou bloqueio de transação longa; cada job grava **cliente (quando necessário), proposta, parcelas, comissão e referência documental** em uma operação de banco. Falhas técnicas transitórias têm tentativas limitadas; faltas de dados passam a `review`.

## Regras invioláveis
- Ler PDF antes de importar; identificar duplicatas por CPF/CNPJ, seguradora, número da proposta e risco/vigência.
- **Renovações:** manter histórico por vigência; validar cliente e veículo/risco anterior. A fila antiga exige placa: riscos sem placa, mas com chassi confirmado, devem passar pela rota assistida ou revisão manual segura.
- **Clientes novos:** a nova via procura CPF/CNPJ; só cria ficha quando não há correspondência; documento repetido no banco é enviado para revisão.
- **Formas de pagamento:** parcelas exatamente como no PDF, com datas somente quando comprovadas, `Não cobrar` como proteção. Aceitar apenas diferenças até R$ 1,00 sem reescrever os valores originais.
- **Comissões:** produtor e percentual escrito no PDF/capa/nome e relatório quando aplicável; base comissão bruta = prêmio líquido; observar regra específica Lebrime, FF/Homeni/Eólica; não inventar produtor, prêmio ou pagamento.
- **Tipos de seguro:** Auto/Frota têm itens de veículo, Empresarial/Residencial/Eventos têm coberturas e LMIs próprios sem criação de itens automóveis. Endosso/cancelamento é movimentação histórica, não nova venda; não enviar para uma fila de proposta.
- **Segurança:** não permitir uploads públicos, PDFs de terceiros sem permissão, chaves no navegador, nem liberar endpoint sem autenticação de gestor. PDF original na pasta privada, URL persistida no contrato/documento.
- **Estado:** `queued` = aguardando, `processing` = em execução, `retry` = tentativa transitória, `review` = precisa de conferência, `done` = **somente** após validação no banco.

## Critério de conclusão por arquivo (obrigatório)
- [ ] CPF/CNPJ cliente único, sem duplicidade
- [ ] Contrato/proposta com ramo, apólice/proposta e vigência corretos
- [ ] Valores de prêmio, IOF, LMIs e capital adequados ao PDF
- [ ] Produtor/corretora/comissão gravados e conferidos
- [ ] Parcelas com quantidade/soma verificadas e protegidas
- [ ] PDF privado e **documento** relacionado ao contrato
- [ ] Histórico anterior vinculado ou pendência específica (sem inventar contrato)
- [ ] Banco confirma sucesso e o inventário registra `done`

## Recuperação e diagnóstico
- Consultar primeiro os dois painéis em **Importações** e os resultados de `lebrime_import_queue_health()` e `lebrime_assisted_import_health()`.
- A nova API autenticada aceita `assisted-enqueue`, `assisted-batch` (até 10 manifestos), `assisted-status`, `assisted-process` (até 5) e `assisted-retry`.
- A rota `assisted-batch` aceita falhas por item sem interromper o lote. Não repetir automaticamente `review` sem corrigir a causa.
- A fila principal continua ativa. Cron separado para a nova via: `lebrime-assisted-import-every-minute`.
- Se uma chamada de cadastro der timeout, **consultar pelo requestKey/fingerprint/número de proposta antes de reenviar**.
- Relatório de cada bloco: recebidos, concluídos, duplicados, pendentes de revisão, arquivo disponível, total de prêmio, parcelas e comissão conferida. Não transformar parcial em concluído.

## Pontos de atenção testados no preparo
- A fila histórica estava operacional, mas não aceitava propostas sem contrato anterior. A rota assistida foi criada para esse caso, mantendo a fila original.
- A função assistida foi testada transacionalmente com dados de teste e **reversão integral**, incluindo gatilhos de duas parcelas e uma comissão, sem persistir contrato sintético.
- Permissões da nova tabela: RLS ativado; sem leitura por `anon` ou `authenticated`, serviço gestor autenticado via API.
- Nenhum dos 46 PDFs deve ser inventado/importado antes de receber e conferir os documentos.

