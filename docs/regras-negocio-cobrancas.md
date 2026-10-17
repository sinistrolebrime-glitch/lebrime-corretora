# Regras de negócio — Parcelamento e cobranças (LEBRIME)

> **ATUALIZAÇÃO VIGENTE (17/10/2026):** a tolerância de conciliação financeira passa a ser **R$ 10,00 (1.000 centavos)**; referências de R$ 1,00 adiante são históricas e estão superadas. Parcelas com vencimento anterior à implantação não são pagas automaticamente sem auditoria; preservar bloqueios de cobrança, dados originais e ausência de vencimento confirmado. Serviço financeiro de produção atualizado nas versões lebrime-api v33 e lebrime-finance-operational v6.


Versão inicial: 2026-10-10. Estas regras são obrigatórias para novas importações e reprocessamentos.

## Importação e integridade
1. Para cada proposta ou apólice, extrair do PDF: segurado, contrato, seguradora, corretora de origem, prêmio, quantidade de parcelas, número da parcela, vencimento, valor e forma de pagamento (quando presentes). Preservar o arquivo e a origem de cada dado.
2. Associar parcelas a um identificador estável do contrato e a seu cliente, distinguindo renovações por vigência. Nunca mesclar parcelas de contratos distintos do mesmo cliente.
3. Usar chave de deduplicação por contrato + vigência + número da parcela; conferir valor e vencimento antes de atualizar. Reprocessar de forma idempotente; não apagar alterações financeiras confirmadas.
4. Conferir soma das parcelas versus prêmio (considerar IOF, juros e diferenças documentadas). Diferenças absolutas **até 100 centavos (R$ 1,00 inclusive)** são aceitas como tolerância, **somente com os valores e a quantidade das parcelas documentados**; registrar a diferença sem modificar valor algum. Acima disso, marcar revisão. Datas ou valores individuais desconhecidos continuam pendentes; nunca inferir parcelas ou liberar cobranças.
5. Contratos sem quadro de parcelamento devem aparecer na fila **Parcelamento pendente de conferência**, nunca sumir silenciosamente.
6. Ao importar documentos novos, atualizar somente campos seguros, registrando fonte, data e histórico de alteração.

## Situações financeiras
- **Pago confirmado**: baixa sustentada por comprovante, retorno de seguradora, conciliação ou registro autorizado.
- **Pago por migração**: parcelas com vencimento anterior ao mês de implantação inicial conforme regra aprovada; status técnico distinto de pagamento comprovado, sem gerar cobrança automática.
- **A vencer**: vencimento futuro sem pagamento confirmado.
- **Vence hoje**: vencimento na data atual.
- **Vencida / pagamento não confirmado**: vencimento ultrapassado sem confirmação; NÃO equivale automaticamente à inadimplência comprovada.
- **Em verificação**: divergência, negociação ou dúvida; suspender cobrança automática.
- **Cancelada/substituída**: parcelas afetadas por cancelamento ou endosso, preservando histórico.

## Fluxo do operacional
- A aba **Cobranças** deve oferecer: filtros por vencimento (hoje, próximos 3/7/15 dias, vencidas), corretora, produtor, seguradora, responsável e situação; tabela com cliente, contrato, parcela, valor, vencimento, contato e última ação.
- Ações por parcela: visualizar PDF de origem, marcar pagamento com evidência, adicionar observação, agendar retorno, copiar mensagem de lembrete, copiar mensagem cordial de pendência e registrar contato.
- Mensagens exigem conferência de telefone, situação e permissão de contato; envio a terceiros/WhatsApp requer ação humana ou integração explicitamente autorizada.
- Enviar lembretes configuráveis antes do vencimento; conferir pagamento novamente antes de cobrança pós-vencimento; aplicar janela anti-duplicidade e opção de suspensão por cliente/contrato.
- Não cobrar parcelas pagas, canceladas, em verificação ou pagas por migração.

## Visão de gestores
- Indicadores separados: total a vencer, vencido sem confirmação, pagamentos confirmados, parcelas sem dados, ações pendentes e confiança da extração.
- Gestores veem agregados e exceções; operacional vê a fila prática de trabalho sem excesso de painéis. Permissões por perfil, trilha de auditoria e filtros consistentes.
- Indicador de confiabilidade deve refletir documentos conferidos versus documentos sem confirmação; jamais exibir 100% sem validação.

## Critérios de aceite
1. PDF com N parcelas gera exatamente N parcelas vinculadas ao contrato correto.
2. Importar o mesmo PDF duas vezes não duplica parcelas nem redefine baixas.
3. Renovação mantém cronogramas históricos separados.
4. Parcelas ausentes são identificadas para revisão.
5. Parcelas antigas da migração não geram cobrança; cobranças pós-vencimento dependem de checagem.
6. Gerentes e operacional compartilham a mesma base e status, com apresentações adaptadas por perfil.
7. Todas as alterações financeiras deixam registro auditável.

**Estado de implementação:** especificação registrada; funcionalidade depende de implementação no código e validação com dados reais.


## Implantação por módulos — 10/10/2026, v20.31

**Módulo 1 — Auditoria da carteira:** consultas em produção identificaram 766 contratos, 5.473 parcelas vinculadas, 5.186 sem data de vencimento, 5.125 marcadas como previsão de proposta, 677 contratos com parcelas todas sem vencimento e 36 contratos sem qualquer parcela. São contagens de referência, variáveis com as importações.

**Módulo 2 — Central de Cobranças (gestão):** arquivos `financeiro.js` e `financeiro-ui.js` no portal com fila paginada (80 por página), filtros por prioridade e corretora, status baseado em evidência, identificação de cronogramas sem data, links para contrato, mensagens copiáveis mediante validação e registro manual de contatos com responsável e histórico. A vista gerencial usa os mesmos critérios da central. Não há envio automático.

**Regras complementares para a primeira entrega:**
1. Propostas importadas com documento disponível devem aparecer no acompanhamento financeiro; propostas sem confirmação continuam como previsão não cobrável.
2. `Não cobrar` é bloqueio de cobrança até que uma pessoa revise e retire expressamente a restrição. Não remover automaticamente a restrição legada dos PDFs históricos.
3. Parcela sem vencimento válido, sem valor comprovado ou anterior ao corte da migração não gera mensagem de cobrança.
4. Gerar um registro virtual de **Conferir parcelamento** para cada contrato da carteira sem nenhuma parcela; não gravar parcelas artificiais ou presumir inadimplência.
5. Status de pagamento manual novo exige evidência anotada; pagamento por migração permanece distinto de pagamento confirmado.
6. Nunca marcar contato como enviado por simplesmente copiar a mensagem; só registro humano explícito pode confirmar o contato.
7. Indicadores de cobrança e a fila operacional devem partir da mesma fonte; perfis podem ter interfaces diferentes, sem acesso operacional às comissões.

**Módulo 3 — Importação documental a implementar:** o processo de leitura de PDF deverá produzir `installmentPlan` como array estruturado com número, valor em centavos, vencimento ISO `YYYY-MM-DD` se comprovado no PDF, `dueText` se só houver referência textual, método e página/origem. Conferir soma com prêmio; bloquear geração de cronogramas inventados. A rotina existente do banco já gera parcelas quando `installmentPlan` ou `installmentCount` são fornecidos na proposta/apólice, mas o upload atual de arquivo ainda não extrai os dados sozinho. Antes de considerar este módulo completo: testar amostras de seguradoras, repetições, renovações, migração, baixa manual preservada e recuperação do histórico.

**Módulo 4 — Portal operacional e conciliação:** o acesso `operacional.html` usa endpoint de acompanhamento independente, que deve ser corrigido para retornar os vencimentos ausentes sem risco de cobrança e para paginar a revisão. A conciliação de pagamentos com seguradoras e envios WhatsApp dependem de integrações aprovadas e evidência auditável.

## Módulo 3 — Leitura de parcelamento em PDFs (v20.33; implantação 10/10/2026)
- Código versionado em \`scripts/parse_installments.mjs\` e \`supabase/functions/lebrime-api/pdf_reader.ts\`; processamento implantado na Edge Function autenticada \`lebrime-api\`, ação \`payments-extract\` (somente gestor).
- Cada PDF de proposta/apólice vinculado ao contrato, enviado pelo portal, é analisado imediatamente após salvar o documento; arquivos gerais e endossos não geram parcelas.
- Uma origem pode ser o bucket privado ou arquivo de Drive cujo ID esteja previamente registrado no documento. O servidor não recebe URL arbitrária para buscar conteúdo; arquivos privados/inacessíveis são classificados como pendentes para anexação manual. Limite 15 MB, no máximo 20 páginas analisadas.
- \`verified\`: todas as parcelas numeradas têm valor em centavos, data completa \`AAAA-MM-DD\`, somatório com diferença absoluta de até R$ 1,00 do prêmio total, com o desvio registrado, e contexto de parcelamento no PDF. Pode alimentar \`installmentPlan\` automaticamente.
- \`partial\`: valor/quantidade das parcelas conciliados ao prêmio, mas alguma parcela não tem vencimento completo. Salvar valores, número e \`dueText\`, deixando a data em branco e o financeiro na fila **Conferir vencimento**; proibir cobrança desse registro.
- \`review\`: diferença de prêmio superior a R$ 1,00, datas incorretas, números duplicados divergentes, falta de contexto, plano pré-existente diferente ou baixa confirmada conflitante. Não sobrescrever os dados financeiros.
- \`unavailable\`: PDF não acessível; registrar o impedimento no documento para evitar reprocessamento automático repetido. Permitir novo upload/reanálise manual.
- Fonte e auditabilidade: cada parcela extraída carrega página/linha, ID do documento, e cada documento carrega estado, data e motivo da tentativa. Contratos possuem \`installmentExtractionStatus\` \`Verificado\` ou \`Parcial\`.
- Na Central de Parcelas, gestor pode reprocessar **até 3 PDFs por bloco**, ver o resultado, reanalisar PDF individual ou anexar um arquivo substituto. Os blocos registram seu estado antes de avançar.
- \`sync_payments_from_insurance\` foi atualizada: suspensões manuais de cobrança não são revertidas pelo trigger; novas propostas com parcelamento integralmente verificado podem gerar parcelas a acompanhar. Parcelas anteriores a 2026-10 de proposta documentada e verificada são marcadas como pagas **por migração**. Não equiparar esse estado a pagamento confirmado.
- Nenhum WhatsApp é enviado sem revisão e ação humana; pagamentos e cobranças não são presumidos. Gestão e operacional devem partilhar os estados, ainda que tenham interfaces diferentes.

**Validação de implantação:** testes automatizados do extrator, central e regressões; o backend e a atualização da função SQL foram implantados. O teste end-to-end com sessão real e documentos históricos ainda é necessário; os 951 arquivos vinculados ao Drive não foram todos reprocessados neste lote.


## Módulo 4 — Operacional, conciliação de carteira e recuperação documental (10/10/2026, v20.34)

**Arquitetura:** serviço independente \`lebrime-finance-operational\` no Supabase, acessado por \`operacional-financeiro.js\` a partir de \`operacional.html\`. O serviço exige e valida o token HMAC da sessão do portal, restringindo-se aos perfis gestor e operacional. Comissões, percentuais dos produtores e informações comerciais estratégicas não são retornados por esse endpoint.

**Fila única de trabalho (mesmo banco da gestão):**
- Consulta todas as parcelas com paginação no servidor de 60 registros por página, inclusive sem vencimento e com bloqueio \`Não cobrar\`. A consulta anterior descartava parcelas sem data e limitava o retorno a 300.
- Situações: vencida sem confirmação, vence hoje, próximas, conferir vencimento/valor/vínculo/migração, cobrança suspensa, previsão não cobrável, paga confirmada, paga por migração e cancelada.
- Filtrar por prioridade, conferência, últimos vencimentos, próximos 7/30 dias, suspensas, pagas ou todas; pesquisar cliente, documento e contrato. Telefones do cliente e dados do contrato são apresentados ao operacional; dados de comissões nunca.
- Somente datas completas e quantias válidas de parcela efetiva são elegíveis a mensagens. Vencida sem confirmação **não significa inadimplência comprovada**.
- Lembrete de parcela ou consulta de cobrança são textos copiáveis, nunca enviados automaticamente. Alerta quando o registro já teve contato nas últimas 24 horas.
- Equipe operacional pode registrar um contato com responsável, observação e próximo acompanhamento, registrar motivo de conferência ou dar baixa como \`Pago\` com evidência obrigatória. Ações usam validação do servidor, controle de versão e histórico append-only limitado, para detectar mudanças concorrentes.
- A equipe operacional não pode liberar \`Não cobrar\`, alterar valores/vencimentos nem excluir contratos pela nova tela. As liberações de bloqueios e ajustes documentais permanecem para o gestor. A gestão passa a visualizar último contato e responsável na Central de Parcelas.

**Recuperação segura da carteira histórica — primeiro lote auditado:**
- As propostas antigas permanecem vinculadas ao cliente; nenhuma duplicata foi criada.
- A proposta 140675343, com duas cópias idênticas do quadro documental, teve dez parcelas conciliadas com os PDFs: de 14/09/2026 a 20/06/2027, valor total R$ 81.496,12. As dez parcelas preexistentes foram sincronizadas sem aumento do total de registros.
- A primeira parcela ficou \`Paga — Migração\` pelo corte da implantação. A informação é técnica, **não confirmação bancária**. Os dez bloqueios de contato \`Não cobrar\` foram preservados.
- Outras duas propostas do lote inicial foram consideradas incompletas em vencimentos e não receberam datas inferidas.
- Leitor de PDF passou a reconhecer tabelas com **duas colunas de parcelas na mesma linha**; foram criados testes para esse formato e executadas as regressões no repositório. O serviço original \`lebrime-api\` foi atualizado para v25 com o parser novo.

**Próximas verificações operacionais:** login e funcionamento real da fila com sessão operacional; desempenho da paginação com o volume total; conferência pontual de 10 PDFs por lote, preservando dados e gerando relatório de resultados e exceções. Até essas verificações, não afirmar que 100% das importações históricas foram reconciliadas.


## Conclusão técnica da etapa — v20.35 (10/10/2026)

- Corrigidos os indicadores de segurança de cobrança: registros "Não cobrar" continuam bloqueados mesmo sem data. Para a gestão, a **cobertura de vencimentos** é exibida como percentual de parcelas com data ISO válida, **não** como confiabilidade geral do projeto. Estados "Verificado" e "Parcial" são contados por contrato.
- PDF Allianz: leitor atualizado para cabeçalhos "Parcelas" isolados, tabelas de parcelas em até duas colunas, e tabelas do tipo "1 R$ 80,61 5 R$ 80,61". Todas as parcelas precisam reconciliar exatamente o prêmio; se não houver data completa, manter vazio e observação, jamais criar vencimentos a partir da vigência.
- Backend principal atualizado para \`lebrime-api\` v26 e operacional para \`lebrime-finance-operational\` v4. Regra operacional: cobranças bloqueadas também aparecem no filtro "Não cobrar / previsões" quando faltar vencimento.
- Amostra documental historicamente conferida na fonte: proposta 140675343, 10 parcelas com datas completas (R$ 81.496,12), além de três propostas com 26 parcelas de valores conciliados e datas não informadas nos PDFs: cartão em 10 × R$ 330,11 (R$ 3.301,10), cartão em 9 × R$ 80,61 + 1 × R$ 80,64 (R$ 806,13), e boleto/débito em 6 × R$ 286,97 (R$ 1.721,82).
- As 36 parcelas **já existiam**, foram reconciliadas em contratos cadastrados, e não geraram novas cobranças ou registros duplicados. Bloqueios de cobranças preservados; uma parcela antiga recebeu marcação técnica "Paga por migração".
- O legado **não** está 100% reprocessado: após o bloco, o estoque de parcelas continua 5.473, com 297 datas completas e 5.176 vencimentos sem data. A inexistência da data no PDF, especialmente para fatura de cartão, **não** deve ser classificada como erro da leitura; é pendência de comprovante/fatura/seguradora ou cronograma de cobrança.
- A ferramenta permite ao gestor continuar a análise em blocos pequenos e persistidos por documento. O operacional tem fila paginada, histórico de contato e baixa com evidência, mantendo perfis separados.
- Nunca gerar cobrança automática, nunca inventar data do cartão nem boleto futuro e nunca confundir prêmio parcelado na seguradora com contas a receber próprias da corretora. O processo precisa de conciliação documental e teste de sessão real antes de homologação financeira total.
