# Regras de negócio — Parcelamento e cobranças (LEBRIME)

Versão inicial: 2026-10-10. Estas regras são obrigatórias para novas importações e reprocessamentos.

## Importação e integridade
1. Para cada proposta ou apólice, extrair do PDF: segurado, contrato, seguradora, corretora de origem, prêmio, quantidade de parcelas, número da parcela, vencimento, valor e forma de pagamento (quando presentes). Preservar o arquivo e a origem de cada dado.
2. Associar parcelas a um identificador estável do contrato e a seu cliente, distinguindo renovações por vigência. Nunca mesclar parcelas de contratos distintos do mesmo cliente.
3. Usar chave de deduplicação por contrato + vigência + número da parcela; conferir valor e vencimento antes de atualizar. Reprocessar de forma idempotente; não apagar alterações financeiras confirmadas.
4. Conferir soma das parcelas versus prêmio (considerar IOF, juros e diferenças documentadas); se houver divergência, marcar para revisão e não inventar valores/datas.
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
