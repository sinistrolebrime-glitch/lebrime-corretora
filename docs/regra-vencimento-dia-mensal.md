# Regra de negócios — vencimentos mensais por dia informado
Implantação: 12/10/2026; portal v20.48.

Quando o PDF indicar somente o dia (por exemplo, Vencimento: 05), o sistema pode projetar as demais parcelas nesse dia de cada mês, desde que os valores do parcelamento estejam conciliados e o dia não seja contraditório.

1. Aceitar dia de 1 a 31 explicitamente informado. Vencimentos completos prevalecem e nunca são substituídos por datas calculadas.
2. Usar como primeiro mês de referência a emissão da proposta quando conhecida; caso contrário, o início da vigência. O primeiro dia previsto será a primeira ocorrência desse dia no mês de referência ou posterior.
3. Repetir mensalmente; para dias 29 a 31 em meses curtos, ajustar para o último dia do mês.
4. Registrar os cálculos no campo estimatedDue com origem projected_pdf_day. Preservar o campo due vazio até confirmação do vencimento bancário.
5. NÃO marcar como pago, não criar inadimplência, não enviar cobrança, não contar a data inferida como informação documental confirmada. Preservar cobrança Não cobrar.
6. Mostrar Previsão DD/MM/AAAA — confirmar nas fichas gerencial e operacional, mantendo alerta de conferência.
7. Se não houver emissão/vigência válida, ou houver dias divergentes ou valores sem conciliação, não gerar meses/anos estimados.

CASO LEONAM COSTA OLIVEIRA
Allianz renovação 141155424, vigência 10/10/2026 a 10/10/2027; emissão 01/10/2026; vencimento indicado: dia 5.
6 parcelas de R$ 449,34, R$ 449,34, R$ 449,34, R$ 449,34, R$ 449,34 e R$ 449,33.
Datas projetadas: 05/10/2026, 05/11/2026, 05/12/2026, 05/01/2027, 05/02/2027 e 05/03/2027.
As seis parcelas permanecem sem due confirmado e com Não cobrar no banco.

ARQUIVOS IMPLEMENTADOS
scripts/due_day_projection.mjs; scripts/parse_installments.mjs; supabase/functions/lebrime-api/due_day_projection.mjs; supabase/functions/lebrime-api/parse_installments.mjs; supabase/migrations/20261012_projected_due_day.sql; script.js; operacional-extras.js; central-conferencia.js; renovacao-previa.js.
Edge functions lebrime-api v29 e lebrime-operational-portal v4. Tests: due_day_projection.mjs, due_day_ui.cjs, pdf_installments.mjs.

Após comprovante de débito ou boleto com data completa, substituir a previsão pela data efetivamente confirmada e liberar o acompanhamento conforme as regras financeiras.