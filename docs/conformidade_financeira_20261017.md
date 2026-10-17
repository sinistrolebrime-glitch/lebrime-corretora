# LEBRIME — conciliação financeira e de acessos (17/10/2026)

## Regra vigente
- Tolerância absoluta de até **R$ 10,00** (1.000 centavos) ao comparar o prêmio e a soma de parcelas *com valores documentalmente comprovados*.
- Diferença maior que R$ 10,00 vai para revisão; falta de vencimento/valor também exige revisão.
- O valor original de cada campo deve ser preservado: a tolerância não autoriza reajuste da última parcela, baixa, mensagem ou cobrança.
- FF Apolinário, Homeni e Eólica: taxa FF de 30%; Leandro 70%; demais produtores 60% e taxa LEBRIME efetiva de 10%.
- Corretora LEBRIME: Leandro 100%; demais produtores 60%, taxa LEBRIME 40% e sem taxa FF.
- Proposta importada: receita de comissão na corretora, mas pagamento comprovado ao produtor exige conciliação explícita; a regra operacional solicitada para a visualização de repasses deve ser implementada sem criar pagamento bancário fictício.
- Parcelas antigas sem conciliação documentada: `Conferir migração`, não `Paga` automaticamente.
- Operador: não deve receber campos de comissionamento. O controle efetivo de permissão precisa acontecer no servidor.

## Ajustes verificados no Supabase
- `lebrime-api` versão 33: leitor de parcelas atualizado para tolerância de 1.000 centavos (antes, produção usava 100 centavos).
- `lebrime-finance-operational` versão 6: diferença de parcelamento dispara revisão somente se exceder 1.000 centavos; as demais proteções de cobrança foram preservadas.
- Função SQL `sync_commission_from_insurance`: inclui as três corretoras FF e calcula Taxa LEBRIME efetiva de 10% (grupo FF, produtores comuns).
- Auditoria de somas de comissão e vínculos feita por consulta de leitura. Sem alterações em prêmios, parcelas, baixas ou repasses históricos.

## Homologação ainda necessária
1. Testar a interface com os logins reais de gestor e operador e verificar impossibilidade de acesso operacional a comissões por URL ou API.
2. Revisar os repasses dos produtores; não transformar a simples importação em transferência bancária comprovada.
3. Conciliar, com os PDFs e comprovantes, parcelas históricas marcadas como pagas, sem evidência em campo específico.
4. Testar um PDF real com divergência de exatamente R$ 10,00, outro com R$ 10,01, e um terceiro sem data de vencimento. Os dois primeiros devem preservar valores sem ajustes; R$ 10,01 exige revisão; sem data não há cobrança.
5. Confirmar execução automatizada após o próximo push e revisar manualmente o portal publicado.

## Segurança
A conferência não deve expor chaves do Supabase nem modificar registros financeiros para "passar no teste". Checkpoints e auditorias operacionais com quantidades internas devem ficar em local privado.
