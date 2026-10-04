# Regras de negócio — Lebrime

## Cadastro e carteira
- Cliente é único por CPF/CNPJ.
- Propostas e apólices pertencem ao cliente e não devem criar cliente duplicado em renovações.
- A corretora responsável pertence à proposta/apólice, porque um mesmo cliente pode ter seguros por corretoras diferentes.
- Corretoras operadas: Lebrime, FF Apolinário e Homeni Corretora.
- Taxa FF só existe quando a proposta/apólice estiver efetivamente vinculada a FF Apolinário ou Homeni. Um seguro marcado apenas como Lebrime nunca recebe Taxa FF.
- Anotação manual no documento como `LEANDRO 19%` ou `LEANDRO - 15%` é definitiva para produtor e percentual de comissão.
- Sem anotação confiável, o sistema não deve inventar produtor nem percentual.
- Toda proposta/apólice deve registrar a operação como `Seguro novo` ou `Renovação` quando essa informação estiver disponível no documento.
- A operação deve ficar visível na carteira, na ficha do cliente e na ficha do produtor.

## Comissão
Base: **Comissão bruta = Prêmio Líquido × percentual de comissão da proposta/apólice**.

### Corretora Lebrime
- Leandro: produtor recebe 100% da comissão bruta; Taxa FF 0%; Taxa Lebrime 0%.
- Demais produtores: produtor recebe 60% da comissão bruta; Taxa Lebrime 40%; Taxa FF 0%.
- Líquido Lebrime para demais produtores: 40% da comissão bruta.

### FF Apolinário / Homeni
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
- O PDF original deve ficar armazenado no Supabase Storage e vinculado ao cliente e à proposta/apólice correta.
- Reanexar um documento pendente deve completar o registro existente, sem duplicar o documento.

## Renovações
- Não criar automaticamente uma nova proposta apenas porque uma apólice está próxima do vencimento.
- A central de renovações deriva a carteira vigente e permite acompanhamento por prazo, produtor, seguradora, corretora, status, prioridade e próxima ação.
