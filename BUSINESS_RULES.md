# Regras de negócio — Lebrime

## Proposta com status "Transmitido" (regra permanente — 13/10/2026)
- Quando o PDF de seguro apresentar status **"Transmitido"**, tratá-lo como **proposta emitida/transmitida apta a cadastro na carteira LEBRIME**, mesmo sem número de apólice informado.
- Registrar o status original `Transmitido` e a situação comercial `Proposta emitida`; a proposta deve integrar a ficha do cliente com vigência, risco, prêmio, produtor, comissão, forma de pagamento, parcelas e PDF.
- **Não declarar apólice efetivamente emitida nem inventar número de apólice** se o documento apresentar apenas transmissão de proposta. Manter o campo da apólice não informado e atualizar quando houver comprovação posterior.
- Preservar a proteção contra duplicidade e o vínculo à renovação anterior; condições de aceitação e cobrança seguem a evidência documental. Parcelas não comprovadas continuam `Não cobrar`.
- Exemplo real: Maurício Batista Paes Landim — proposta Porto Auto Sênior de 19/08/2026, status `Transmitido`, produtor Clóvis 35%, corretora Eólica.

## Seguros Evento (regra de classificação)
- Propostas da modalidade **Eventos** (ex.: feira, exposição, congresso e evento técnico) devem ser vinculadas ao **CNPJ do proponente**, na ficha empresarial e no ramo **Eventos**, separados de Automóvel/Frotas; **não gerar `insuredItem` de veículo**.
- Registrar local do risco, período de montagem e desmontagem, dias efetivos do evento, número de participantes, modalidade do proponente e as coberturas/LMI individualizados.
- O campo agregado `insuredValue` pode exibir a maior garantia individual **desde que identificada pela respectiva cobertura**, mas nunca somar automaticamente limites não cumulativos como se fossem um único capital assegurado.
- Registrar prêmio, IOF, produtor/comissão e forma de pagamento do PDF. Não inventar vencimento de boleto; manter `Não cobrar` até confirmação adequada.
- Proposta de seguro não deve ser declarada como apólice efetivamente emitida quando o documento não apresentar número ou confirmação de emissão.
- Exemplo: Nazária Distribuidora de Produtos Farnaceuticos Ltda (filial CNPJ 07.224.991/0012-98), Porto 11-87252888, RC Expositor e Acidentes Pessoais, 18 a 24/10/2026.

## Endosso de cancelamento — regra operacional
- Endosso de **cancelamento a pedido do segurado** deve ser registrado como **movimentação do contrato existente**, nunca como nova proposta de venda, renovação ou prêmio positivo.
- Buscar a apólice original por **CPF/CNPJ, seguradora, número de apólice, placa/chassi e vigência**. Preservar integralmente contrato, comissão e pagamentos históricos, inclusive eventuais parcelas já pagas.
- Com a apólice correta identificada e a **data efetiva do cancelamento documentalmente comprovada**, registrar o evento e atualizar a situação da vigência afetada; bloquear apenas cobranças futuras cabíveis. O status do documento `Emitido` não resolve sozinho ambiguidades sobre a data efetiva.
- Quando o documento informar **sem movimento de prêmio / R$ 0,00**, **não** gerar comissão, novo prêmio, parcelas ou crédito de devolução fictício. Eventuais estornos/restituições exigem prova financeira específica.
- Se a apólice ou a ficha não puderem ser identificadas com segurança, salvar o PDF em repositório privado e abrir **tarefa de vinculação pendente**; não marcar a carteira como cancelada sem confirmação.
- Endossos devem permanecer na ficha e no histórico de documentos do contrato ao qual se referem. Evitar duplicidades por apólice + tipo de endosso + origem/identificador do PDF.
- Exemplo: Maria Dalva de Pinho Alencar, apólice Azul `09 2781937`, proposta de cancelamento `20-34059099`, Volvo XC60 placa `RSG3G12`, documento `Emitido` e movimento R$ 0,00. O arquivo cita período 13/10/2026 a 10/07/2027, mas não esclarece a data de efeito do cancelamento. Vínculo à apólice permaneceu pendente de localização.

## Cadastro e carteira
- Cliente é único por CPF/CNPJ.
- Propostas e apólices pertencem ao cliente e não devem criar cliente duplicado em renovações.
- A corretora responsável pertence à proposta/apólice, porque um mesmo cliente pode ter seguros por corretoras diferentes.
- Corretoras operadas: Lebrime, FF Apolinário, Homeni Corretora e Eólica Corretora.
- Taxa FF só existe quando a proposta/apólice estiver efetivamente vinculada a FF Apolinário, Homeni ou Eólica. Um seguro marcado apenas como Lebrime nunca recebe Taxa FF.
- Anotação manual no documento como `LEANDRO 19%` ou `LEANDRO - 15%` é definitiva para produtor e percentual de comissão.
- Sem anotação confiável, o sistema não deve inventar produtor nem percentual.
- Toda proposta/apólice deve registrar a operação como `Seguro novo` ou `Renovação` quando essa informação estiver disponível no documento.
- A operação deve ficar visível na carteira, na ficha do cliente e na ficha do produtor.
- O padrão de entrada/importação do sistema é proposta.
- Indicadores de carteira ativa devem considerar propostas e apólices vigentes, excluindo registros cancelados, recusados, convertidos ou perdidos.

## Comissão
Base: **Comissão bruta = Prêmio Líquido × percentual de comissão da proposta/apólice**.

### Corretora Lebrime
- Leandro: produtor recebe 100% da comissão bruta; Taxa FF 0%; Taxa Lebrime 0%.
- Demais produtores: produtor recebe 60% da comissão bruta; Taxa Lebrime 40%; Taxa FF 0%.
- Líquido Lebrime para demais produtores: 40% da comissão bruta.

### FF Apolinário / Homeni / Eólica
- Taxa FF = 30% da comissão bruta e é custo da Lebrime.
- O produtor comum não paga a Taxa FF e continua recebendo 60% da comissão bruta total.
- Demais produtores: produtor 60%; Taxa Lebrime 40%; Taxa FF 30%; líquido efetivo Lebrime 10%.
- Leandro: recebe 70% da comissão bruta; Taxa FF 30%; Taxa Lebrime 0%.

## Tolerância para diferenças financeiras de até R$ 1,00 (regra permanente — 12/10/2026)
- Aceitar diferenças monetárias absolutas de **até 100 centavos (R$ 1,00 inclusive)**, tanto nas importações novas quanto na revisão das antigas, quando houver evidência documental dos valores comparados.
- Exemplos: prêmio líquido repetido com arredondamento nas páginas do PDF; total de parcelas **individualmente comprovadas** versus prêmio total indicado.
- Preservar **sem alteração** todos os valores originais (prêmio líquido, prêmio total, IOF, comissão e cada parcela), documentos e evidências. Registrar variação em centavos, fonte e classificação `Diferença aceita por tolerância`.
- **Não** criar compensação artificial, reajustar última parcela, inventar vencimentos nem considerar pago/autorizar cobrança por causa da tolerância.
- Se faltar valor individual de parcela, data, aceitação do risco, identificação do cliente/contrato, documento ou qualquer outra evidência necessária, a pendência específica permanece, mesmo que a diferença nominal seja de até R$ 1,00.
- Diferença superior a R$ 1,00 exige revisão. Não aplicar esta tolerância a divergências percentuais de comissão, de vínculo, identidade ou valores de naturezas diferentes.
- Em conflito entre resumo e quadro de pagamento do mesmo contrato, manter o valor usado no cálculo original já documentado e anotar a variante, sem trocar a base de comissão automaticamente.

## Proposta ou apólice importada
- Uma proposta ou apólice com PDF importado e vinculado é considerada comissão recebida.
- Valor recebido pela Lebrime = comissão bruta menos Taxa FF, quando houver.
- Status da comissão = `Recebida`.
- Data de recebimento = data da importação do documento.
- Origem do recebimento = `Importação da proposta` ou `Importação da apólice`.
- A importação não marca automaticamente a comissão como paga ao produtor.

## Lucro realizado
- Lucro realizado = comissão efetivamente recebida pela Lebrime menos comissão efetivamente paga ao produtor.
- Taxa FF e Taxa Lebrime ficam discriminadas em colunas próprias para análise da operação.

## Parcelas e migração
- Parcelas anteriores ao mês inicial da implantação podem ser marcadas como `Paga — Migração`.
- Parcelas ligadas a propostas são previsão financeira, não cobrança efetiva de apólice.

## Documentos
- Todo PDF deve ficar vinculado ao cliente e, quando aplicável, à proposta/apólice correta.
- Arquivos enviados internamente devem permanecer armazenados no Supabase Storage.
- Na migração SegFlex, enquanto o PDF original permanecer na pasta controlada do Google Drive, o sistema pode manter o vínculo direto ao arquivo de origem, desde que ele apareça como disponível na ficha do cliente e da proposta e possa ser aberto pelo usuário.
- O vínculo documental da SegFlex deve preservar o ID do arquivo do Drive, nome original, tamanho, proposta e cliente para auditoria e deduplicação.
- Um mesmo arquivo SegFlex não pode gerar mais de um documento para a mesma proposta.
- Reanexar ou migrar fisicamente um documento já vinculado deve completar o registro existente, sem duplicar o documento.

## Renovações
- Não criar automaticamente uma nova proposta apenas porque uma apólice está próxima do vencimento.
- A central de renovações deriva a carteira vigente e permite acompanhamento por prazo, produtor, seguradora, corretora, status, prioridade e próxima ação.


## Motor da proposta
- A proposta é o ponto de entrada padrão da operação.
- Ao cadastrar/importar uma proposta, os dados estruturados devem alimentar automaticamente as demais engrenagens do sistema.
- Comissão: calculada automaticamente pelas regras da corretora/produtor.
- Parcelas: o plano de pagamento da proposta gera automaticamente registros na Central de Parcelas.
- Parcelas de proposta são classificadas como `Previsão da proposta` e não devem entrar como cobrança efetiva enquanto não houver apólice/controle financeiro definitivo.
- Se quantidade/valores do plano forem alterados, as parcelas automáticas são atualizadas; parcelas excedentes automáticas não pagas são canceladas.
- O total das parcelas geradas deve fechar com o prêmio total da proposta.
- Quando o documento informar apenas referência de vencimento, como `Fatura do cartão`, o sistema deve preservar essa referência sem inventar uma data de vencimento.
- Ao importar proposta ou apólice, comissão recebida, documentos, carteira ativa e demais vínculos devem refletir o registro sem depender de abrir manualmente cada aba.

## Endossos
- Endosso nunca cria uma nova proposta ou apólice.
- Todo endosso deve ser vinculado ao cliente e à proposta/apólice/contrato existente.
- Quando o nome do arquivo indicar `Endosso`, o sistema deve classificá-lo como Endosso e exigir a seleção do contrato correspondente.
- O endosso fica no histórico documental do contrato e na ficha consolidada do cliente.


## Importação direta Porto — produtor manual

Quando uma proposta for criada automaticamente a partir dos arquivos de retorno da Porto e o arquivo não trouxer identificação confiável do produtor:

- o sistema **não deve inventar produtor**;
- a proposta deve ser marcada com **Produtor pendente — preencher manualmente**;
- deve ser criada uma pendência operacional para definição do produtor;
- a comissão não deve ser calculada enquanto não houver produtor e percentual válidos;
- ao selecionar o produtor manualmente na proposta e salvar, a pendência de produtor deve ser concluída automaticamente;
- os metadados de origem da Porto devem ser preservados para auditoria.

Essa regra vale somente para propostas importadas diretamente da Porto sem produtor informado.


## Integração Porto — fluxo operacional simplificado

A integração da Porto deve funcionar como fonte automática de dados e auditoria, e não como uma carteira paralela.

### Fluxo principal
- Os arquivos recebidos da Porto são preservados no storage para auditoria.
- O processamento tenta identificar cliente e contrato de forma segura.
- Quando existe vínculo único e confiável, a informação é aplicada diretamente no módulo de negócio correspondente.
- Quando não existe vínculo seguro, o sistema não cria valores, clientes, parcelas, comissões ou contratos por suposição. Em vez disso, cria uma **Pendência de Integração Porto**.

### Destino por tipo de arquivo
- **XPP / XPI** → Propostas e Apólices.
- **APP / API / IRE / SRE** → Propostas e Apólices / emissão.
- **SAP / CBS** → Central de Parcelas.
- **COM** → Comissões.
- **SI2** → Pendências / Sinistros.

### Exceções
- Arquivos sem vínculo único geram uma pendência operacional clara, com origem, tipo de arquivo e destino esperado.
- A tela **Integrações** é somente administrativa: status da conexão, sincronização, quantidade de arquivos, exceções e auditoria.
- Não existe uma tela operacional separada de “Retornos Porto”.
- Arquivos em exceção devem ser reavaliados nas sincronizações/processamentos seguintes e a pendência deve ser concluída quando o vínculo for resolvido.

### Produtor em propostas Porto
- Se a Porto não informar o produtor, o sistema mantém o produtor em branco.
- A proposta recebe o indicador **Produtor pendente**.
- É criada uma pendência específica para seleção manual do produtor.
- A comissão não deve ser calculada sem produtor e percentual válidos.
- Ao definir o produtor manualmente e salvar a proposta, a pendência correspondente é concluída.

### Regras de segurança
- Nunca inventar produtor.
- Nunca duplicar cliente ou contrato quando já houver correspondência segura.
- Nunca aplicar valor financeiro sem vínculo seguro.
- Endosso não deve virar novo contrato.
- O arquivo original da Porto deve permanecer preservado para auditoria.


## Navegação operacional — clientes, contratos e renovações

### Busca de clientes
- A pesquisa de clientes é instantânea enquanto o usuário digita.
- A localização deve considerar nome, CPF/CNPJ, placa, número de proposta e número de apólice.
- A busca é somente uma forma de localizar registros existentes; ela não cria nem altera vínculos.

### Ficha do cliente
- A ficha do cliente consolida dados cadastrais, propostas, apólices, parcelas, pendências, renovações, comissões e documentos vinculados.
- O campo de corretora pertence à proposta/apólice. O mesmo cliente pode possuir contratos de corretoras diferentes.
- O filtro por corretora na ficha do cliente deve filtrar os contratos e os dados operacionais vinculados aos contratos exibidos, sem alterar os registros originais.

### Ficha da proposta/apólice
- A ficha do contrato é uma visão consolidada do registro já existente.
- Itens segurados, veículos, condutores, coberturas, parcelas, comissão, documentos, endossos, pendências e sinistros devem ser exibidos somente quando houver vínculo com aquele contrato.
- Endosso permanece como documento/evento do contrato e nunca cria automaticamente uma nova apólice.
- Informações ausentes são exibidas como não cadastradas; o sistema não deve preencher dados por suposição.

### Renovações
- A central de renovações permite consulta direta na tela por período de vencimento.
- Os filtros incluem produtor, seguradora, ramo, corretora e status.
- A exportação e o espelho são saídas da consulta; não são requisito para visualizar as renovações.
- O espelho deve refletir somente os registros que atendem aos filtros ativos.

### Preservação das regras financeiras
- Melhorias de navegação e visualização não alteram as regras de comissão.
- O sistema continua proibido de inventar produtor, percentual de comissão ou prêmio líquido.
- A comissão só é reconciliada quando prêmio líquido, percentual de comissão e produtor estiverem presentes.
- As regras especiais de Lebrime, FF Apolinário/Homeni/Eólica e Leandro permanecem vigentes conforme as seções financeiras deste documento.


## Financeiro e operação — filtros e tratamento

### Central de parcelas
- Previsões de proposta e parcelas efetivas permanecem separadas por origem financeira.
- A tela pode filtrar por período, tipo, status, etapa de cobrança, corretora e seguradora sem alterar os dados.
- “Somente atrasadas” considera apenas parcelas efetivas em aberto com vencimento anterior à data atual.
- Parcelas anteriores ao corte de implantação continuam respeitando a regra de migração já definida; a melhoria de tela não altera essa regra.
- Uma parcela deve estar vinculada a apenas uma proposta ou apólice.

### Comissões
- Os filtros de produtor, corretora, seguradora, status e data de recebimento são somente de consulta.
- Lucro realizado continua sendo **comissão recebida − comissão paga ao produtor**.
- Taxa FF não é tratada como despesa adicional no cálculo do lucro realizado; ela permanece parte do desdobramento da comissão conforme a regra financeira.
- Nenhuma melhoria visual pode criar comissão sem prêmio líquido, percentual de comissão e produtor válidos.

### Pendências
- Pendências podem ser filtradas por prazo, status, origem, destino e responsável.
- Exceções de integração permanecem na fila operacional enquanto não houver vínculo seguro.
- Uma pendência pode estar vinculada a uma proposta ou a uma apólice, nunca às duas simultaneamente.
- O vínculo da pendência serve para navegação e acompanhamento e não deve criar um novo contrato.


### Documentos e endossos — centro documental
- A biblioteca documental pode ser filtrada por tipo, status, disponibilidade do arquivo e corretora.
- O documento pode estar vinculado a um cliente e, quando aplicável, a uma única proposta ou apólice.
- Se houver contrato selecionado, ele deve pertencer ao cliente informado.
- Endosso exige vínculo com a proposta ou apólice correspondente.
- Endosso continua sendo documento/evento do contrato e não cria um novo contrato.
- Filtros e navegação da biblioteca não alteram conteúdo, vínculo financeiro ou situação da apólice.


## Sinistros e visão do produtor

### Sinistros
- Sinistro é um registro operacional vinculado a uma apólice existente; ele não cria proposta, apólice ou contrato paralelo.
- O sinistro deve estar vinculado ao cliente e à apólice correspondente.
- A apólice selecionada deve pertencer ao cliente informado.
- Quando houver item/risco selecionado, ele deve pertencer à apólice vinculada.
- O sistema não inventa número do sinistro, datas, oficina, responsável, status ou dados do evento.
- A combinação número do sinistro + apólice não pode ser duplicada.
- Filtros de sinistro por período, seguradora, ramo, status e responsável são apenas de consulta.
- O painel e a ficha do cliente podem exibir sinistros em acompanhamento sem alterar os registros originais.

### Produtores
- A visão do produtor consolida apenas contratos realmente vinculados ao produtor.
- Indicadores financeiros do produtor devem usar os mesmos registros de comissão da carteira; não devem recalcular ou sobrescrever valores manualmente lançados sem regra.
- Comissão bruta prevista e comissão do produtor prevista seguem as regras financeiras vigentes.
- Valores “recebida pela Lebrime” e “paga ao produtor” refletem os registros de comissão associados aos contratos do produtor.
- A navegação pela ficha do produtor para cliente ou contrato é somente consulta e não altera vínculos.


## Identificação de veículos somente pelo chassi (regra permanente — 12/10/2026)
- Em propostas de automóvel/frota é **normal** que um veículo venha apenas com **chassi**, sem placa. Isso **não é motivo para paralisar o lote ou criar um cliente/contrato duplicado**.
- Para identificar o risco, conferir primeiro **CPF/CNPJ do segurado + chassi completo + vigência + seguradora + histórico contratual**. O chassi informado no documento novo deve coincidir exatamente com o chassi do item segurado no contrato anterior (17 caracteres quando aplicável); confirmar pelo PDF original ou cadastro de itens vinculados ao contrato anterior.
- Quando a placa anterior estiver vazia, ausente ou como marcador (ex.: `AAVISAR`), o **chassi confirmado substitui a placa somente como evidência de vínculo**. A placa do novo documento pode ser registrada no novo contrato, mas **nunca inventar placa nem preencher retroativamente a do histórico**.
- Se a nova proposta também vier **sem placa**, cadastrar como risco identificado por chassi, mantendo a placa desconhecida/pendente e sem usar código fictício; a regra deve ser suportada pelo motor de importação e pelos itens/riscos do sistema.
- Se houver conflito de chassi, múltiplos riscos compatíveis, CPF/CNPJ divergente ou placa anterior válida incompatível, exigir revisão documentada. Nunca aceitar só semelhança de nome/modelo; troca real de veículo requer vínculo explícito e histórico separado.
- Checar idempotência por **cliente + seguradora + proposta/apólice + vigência + chassi** quando não houver placa; manter contrato anterior e PDF intactos, com novas parcelas/comissão vinculadas à nova vigência.
- Falha isolada de identificação deve ir para revisão, **sem travar os demais PDFs**. O caso real `VILMA MUTSUE TAKEUCHI AYRES`, Fiat Pulse chassi `9BD363ANPTYT36106`, tinha placa histórica `AAVISAR`, e a renovação de 2026 foi confirmada pelo chassi e cadastrada, preservando a ficha.
- **Estado da implementação (12/10/2026):** a confirmação assistida pelo chassi foi usada nesse caso real. A aceitação automática de propostas sem placa no processador autenticado ainda requer implementação e teste; não afirmar que já está coberta automaticamente.

## Motor de importação contínua — chat + Drive + sistema (12/10/2026)
- **O projeto LEBRIME nesta conversa é a base de coordenação.** PDFs chegam aqui ou pelo link do Drive; o Work é opcional para tarefas pesadas, nunca requisito geral.
- **Uma ficha só está atualizada após gravação e consulta confirmadas no Supabase**, incluindo seguro/cliente corretos, nova vigência, produtor/comissão, documento e parcelas. PDF em Drive ou checkpoint não é cadastro.
- As importações plenamente revisadas podem entrar em `public.lebrime_import_queue`, com deduplicação por identidade do contrato e data. Agendador `lebrime-import-queue-every-minute` executa lotes de até 10 registros por minuto; cada falha é isolada em revisão ou nova tentativa.
- A API `lebrime-import-queue` exige sessão **gestor**, verificada no servidor. Não expor chave de serviço, banco ou PDFs em endpoints públicos; funções SQL da fila são restritas a funções privilegiadas, com RLS habilitado.
- Os estados são **queued**, **processing**, **retry**, **review** e **done**. Itens em `review` não são ignorados nem aprovados automaticamente. O histórico original e os anexos não devem ser sobrescritos.
- A rotina autenticada exige confirmação do **mesmo veículo do contrato anterior**. Quando houver troca de veículo, mudança de risco, produtor não comprovado ou qualquer identidade ambígua, colocar em revisão e cadastrar somente após vínculo correto ser confirmado.
- **Cobranças**: nunca inferir datas ou valores; itens com vencimento não comprovado ficam **Não cobrar**. A tolerância financeira de R$ 1,00 não permite completar parcelas desconhecidas.
- Falha do conector no chat não autoriza outro canal a contornar segurança. Se a proposta já está na fila do servidor, o processamento continua; se ainda não entrou, usar o fluxo autenticado de entrada/manifesto no portal ou preservar PDF/checkpoint até o envio regular.
- O agendador trata trabalhos já preparados; **não acessa automaticamente PDFs privados do Google Drive nem opera o ChatGPT durante a ausência da conversa**. A integração automática entre Drive e servidor exige configuração explícita de acesso próprio. Nem mesmo um serviço agendado elimina todas as indisponibilidades; monitorar e alertar falhas.
- Acompanhamento pela seção **Arquivos → Importações contínuas**, incluindo revisão humana, evitando duplicidade de cliente e período.
