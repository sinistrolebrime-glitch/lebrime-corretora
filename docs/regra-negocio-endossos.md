# Regra de negócio: proposta principal e endossos durante a vigência

Registro de homologação: 11/10/2026 — caso ANTONIO CARLOS VIANA DE SOUSA.

## Decisão de classificação

1. Identificar primeiro o segurado pelo **CPF/CNPJ**, nunca apenas pelo nome. Há outros clientes de nomes semelhantes.
2. Ler o número da apólice da proposta principal e da movimentação. Quando CPF/CNPJ e número da apólice são os mesmos e a movimentação ocorre dentro da vigência principal, classificar como **endosso**, não como outro contrato.
3. Manter a proposta/apólice principal com as datas originais. O endosso é um registro do tipo `endorsement`, associado ao cliente e ao `parentInsuranceId`, `parentPolicyNumber`, com o tipo de movimento e a data efetiva.
4. Em substituição de veículo, conservar o veículo anterior e indicar o substituto e a data da troca. Não substituir silenciosamente o histórico antigo.
5. Armazenar ambos os PDFs como `document` do mesmo contrato principal, classificando corretamente `Proposta` e `Endosso` e preenchendo `endorsementId` no PDF do movimento.
6. O endosso pode ter prêmio adicional distinto. Só somar `premium` do endosso à carteira se `premiumAdditionalConfirmed===true`; se houver dúvida sobre prêmio recalculado versus adicional, marcar pendência em vez de inflar a carteira.
7. Manter parcelamento principal inalterado. Endosso cria parcela financeira separada, com `endorsementId`; respeitar índice único de parcelas e nunca inventar vencimento, baixa ou cobrança.
8. A nomenclatura **Leandro 15%**, quando confirmada pelo usuário, informa produtor Leandro e percentual de comissão de 15% em cada operação, inclusive endosso. A base de cálculo é o prêmio líquido em centavos. Na corretora Lebrime, Leandro recebe 100% dessa comissão (taxa Lebrime = 0%).
9. Endosso pode ter comissão e repasse próprios. Lançar comissão distinta vinculada por `endorsementId` sem substituir a comissão-base. A ficha gerencial exibe ambos, mas a operacional jamais recebe percentuais de comissão nem dados do produtor.
10. Se a apólice principal não estiver localizada, ou se houver conflito de CPF/CNPJ, número de apólice, vigência ou prêmio, NÃO criar outra apólice automaticamente. Colocar em conferência.

## Caso de referência conferido no banco

- Cliente existente: CPF 18212328368, ID `segflex-client-18212328368`.
- Proposta principal `20-28209274`, apólice `09 2375270`, 10/10/2025 a 10/10/2026, prêmio total R$ 1.174,50, prêmio líquido R$ 1.093,78, 10x cartão. Honda Fit 2018/2019, placa PIY9369.
- Endosso de substituição `20-32231213`, mesma apólice, 11/06/2026 a 10/10/2026, prêmio adicional R$ 385,23, prêmio líquido R$ 358,75, 1x boleto com vencimento pendente. Substitui por Honda WR-V EX Sensing 2026/2026, chassi 93HDG5820TK120990, sem placa informada.
- Leandro 15% em ambos: comissão-base R$ 164,07 e do endosso R$ 53,81. Total: R$ 217,88, sujeito às regras de recebimento/repasse já existentes.
- Prêmio acumulado da apólice com endosso confirmado: R$ 1.559,73. Uma única apólice, uma vigência original, um endosso, 11 parcelas relacionadas.
- PDFs privados no Google Drive da Lebrime, com seus próprios documentos vinculados ao cadastro e acesso condicionado a permissões do Drive.

## Testes

`tests/endorsement_history.cjs` protege o vínculo por cliente/número/apólice, a existência de duas comissões e o sigilo no endpoint operacional. A função `relatedEndorsementsFor` agrupa os movimentos pelo CPF/CNPJ cadastrado, apólice e vigência. A ficha do cliente apresenta cronologia de mudanças e documento original.

Não adotar esse caso como regra para todo tipo de endosso sem ler o PDF: inclusões, exclusões, devoluções e cancelamentos podem ter prêmio negativo, zero ou recalculado e exigem classificação própria.
