# Regras de negócio — Lebrime

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
