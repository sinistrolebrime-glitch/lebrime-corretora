# LEBRIME — regras permanentes de ingestão de documentos (v1.0)

**Aprovado pelo usuário em 25/10/2026.** Abrange toda proposta, apólice, endosso, renovação, cotação, relatório e documento complementar recebido no chat, adicionado no portal ou colocado nas pastas de entrada autorizadas do Drive.

## 1. Entrada na engrenagem

1. Todo arquivo recebido deve obter identificador de entrada, nome original, origem, data/hora, hash SHA-256, responsável, estado e checkpoint, sem perder o original. O gatilho automático só funciona nos canais de entrada efetivamente integrados; não presumir integração de Drive/chat antes de configurar um conector/evento.
2. Verificar arquivo real (PDF `%PDF-`, tamanho, formato, permissões e legibilidade). Arquivo não legível entra em **revisão documental**, nunca desaparece nem é declarado importado.
3. Identificar PDF já recebido por hash, ID original do Drive e combinação **CPF/CNPJ + seguradora + número + vigência + tipo**. Não duplicar contrato/cliente/comissão; se documento for outra versão, endosso ou renovação, preservar separadamente e vincular ao correto.
4. Ordem de processamento: **recebido → PDF preservado → leitura automática → extração estruturada → comparação com cadastro → validação → vinculação/criação → cálculos → conferência → concluído**. Erros usam estado "revisão necessária" ou "falha recuperável", com motivo e tentativa registradas.
5. Lotes pequenos (preferencialmente 10/10; pode 20/20 e até 50 somente quando estável). Salvar checkpoint por item e após cada lote. Processar itens independentemente, sem travar toda a fila por um PDF ruim.

## 2. Leitura exaustiva com evidência

Extrair **todo campo efetivamente disponível**, sem inventar valores. Cada campo precisa guardar valor, fonte (PDF/relatório/anotação/usuário), página/evidência quando possível, estado de confiança e data da conferência.

| Grupo | Campos obrigatórios para buscar |
|---|---|
| Identificação | Nome/razão social, CPF/CNPJ, endereço, contatos, cadastro existente, corretora de origem |
| Contrato | Tipo (proposta, apólice, endosso, cotação), nº proposta, nº apólice, seguradora, ramo, sub-ramo, produto, status, datas de emissão e início/fim de vigência, proposta anterior/renovação |
| Produção | Produtor, código/nome alternativo reconhecido, **percentual da comissão cheia**, origem da evidência |
| Valores | Prêmio líquido, IOF, prêmio total, juros, adicional/fracionamento, descontos, serviços, valor assegurado/LMI/LMGA, moeda |
| Parcelamento | Quantidade, valor de **cada** parcela, vencimento exato de cada parcela quando documental, primeiro vencimento, método de pagamento, cartão/boleto/débito, identificadores de cobrança |
| Coberturas e riscos | Coberturas, limites de indenização, franquias, assistências, serviços, vigência especial, exclusões, local de risco, modalidade e cláusulas |
| Automóvel/frota | Placa, chassi, marca/modelo, ano fabricação/modelo, FIPE/código/referência, percentual FIPE, valor do veículo, coberturas de cada item, número de itens |
| Empresarial/residencial/garantia | Importância segurada, LMI/LMGA por cobertura, objeto/contrato garantido, segurado/tomador, beneficiário, locais de risco, vigência de garantia e condições |
| Documentação | Nome e hash do arquivo, link privado de abertura, natureza do documento, origem, revisão, vínculo com cliente/contrato, histórico |

Se alguma informação não constar, registrar **"Não identificado no documento — conferência necessária"**. Nunca trocar preço ou data documental por estimativa silenciosa.

## 3. Cliente, contrato e vigência

1. Localizar a ficha por CPF/CNPJ validado; nome é auxílio de busca, não identidade suficiente em caso ambíguo. Usar cliente existente e **não criar segunda ficha**.
2. **Proposta importada = contrato ativo na LEBRIME**, com o mesmo peso operacional da apólice; não exigir conversão proposta→apólice para entrar na carteira, nem suspender cobertura por estado "em análise"/"transmitida" por conta própria.
3. **Cancelamento somente quando informado expressamente pelo usuário**; vigência expirada move contrato para histórico, sem mudar status para cancelado.
4. Renovação deve ser nova vigência na mesma ficha; propostas e apólices do mesmo seguro/vigência não criam dois contratos operacionais.
5. Endosso deve permanecer na mesma ficha e referenciar a proposta/apólice principal. Sem movimento de prêmio, não soma valor nem gera comissão/parcelas adicionais. Com movimento **comprovado**, registrar impacto financeiro separado, sem duplicar contrato principal.
6. Cotação ou documento de simulação **sem contratação** deve ser classificado como cotação/revisão, não inventar emissão.
7. A ficha deve permitir abrir os PDFs (proposta, apólice, endosso) com as informações vinculadas ao período correto.

## 4. Regra definitiva de produtor e comissão

1. A anotação na primeira página do documento e o nome explícito do arquivo, como "LEANDRO 20%" ou "LEONARDO 30%", são fontes de produção. **Percentual é sempre comissão cheia**, sem descontar taxa FF no percentual cadastrado.
2. Prioridade: confirmação expressa mais recente do usuário → anotação explícita no PDF/nome do arquivo → relatório de produção confirmado → dado já confirmado no cadastro. Conflitos **não devem sobrescrever automaticamente**; abrir revisão com evidências.
3. Reconhecer siglas somente quando há equivalência cadastrada/confirmada (p.ex. **CL = Clovis**); não adivinhar abreviações.
4. Cálculo comissão bruta = **prêmio líquido × comissão cheia** (em centavos com arredondamento controlado).
5. FF Apolinário / Homeni / Eólica: taxa FF 30%; produtor **Leandro recebe 70%** da comissão cheia; outros produtores recebem **60%** e Lebrime fica com **10%**. Na Lebrime: **Leandro recebe 100%**, outros **60%** e Lebrime **40%**.
6. Um lançamento de comissão principal por contrato; endosso com prêmio/comissão adicionais comprovados pode ter **lançamento financeiro adicional próprio**, sem ser considerado duplicata.
7. Na regra interna, proposta importada pode marcar comissão como recebida e repasse como pago **por migração/processo**. Esses estados devem ficar separados da comprovação bancária; não inventar recibo, data de pagamento ou transferência.

## 5. Parcelas e cobrança

1. Gerar parcelas individuais vinculadas ao seguro e cliente, com valor e vencimento de cada uma **apenas quando constatado**. Quantidade do PDF não autoriza presumir datas e parcelas iguais.
2. Conferir soma das parcelas contra prêmio total; conferir diferença entre líquido + IOF + juros/adicionais = total. Informar diferença, origem e motivo; não "corrigir" valor pela conta sem verificar PDF.
3. Se o PDF mostrar número/valores, mas não vencimentos precisos, cadastrar **previsões sem cobrança automática** e indicar ausência da data.
4. Para parcelas anteriores ao mês de implantação, seguir a regra **"Paga — Migração"** quando cabível; isso não é recibo bancário. Parcela futura não é paga sem evidência.
5. Cobrança cordial e lembretes antes do vencimento somente para parcelas exigíveis e confirmadas. Não cobrar automaticamente uma projeção ou uma parcela com baixa pendente de conferência.
6. Registrar forma de pagamento, status, comprovante, fonte e atualizações; primeiro pagamento pode condicionar efetivação da seguradora, mas não presumir que está quitado.

## 6. Valor segurado/FIPE/LMI

1. Prêmio não é valor segurado. Não derivar FIPE/LMI do prêmio.
2. Frotas e veículos: somar **um valor por veículo sem duplicar itens**; FIPE 2026 com mês, modelo, código, ano e percentual quando identificáveis; se aproximado, rotular **estimado** e guardar referência.
3. Empresarial/residencial/garantia: usar os **limites contratuais documentados** adequados ao risco; não somar coberturas paralelas sobrepostas nem confundir LMGA e LMI.
4. Separar no dashboard valor comprovado de valor estimado e contabilizar ausências explicitamente.

## 7. Confiabilidade e finalização

1. Após cada entrada, revisar: CPF/CNPJ por dígito verificador, cliente válido, produtor, % com fonte, contrato e vigência, PDF acessível, prêmio líquido/IOF/total, parcelas, valor assegurado e ausência de duplicatas.
2. Indicador percentual deve mostrar **método e denominador**: preenchimento de campos NÃO significa exatidão dos PDFs. Não repetir índice antigo 99,12% sem reavaliação.
3. Registrar pendências no perfil exato do cliente, priorizando contratos dentro da vigência. O histórico também deve ser corrigido progressivamente.
4. Nunca descartar o arquivo original, apagar endosso, substituir renovação ou remover comissão legítima sem evidência.
5. Encerramento por documento exige pelo menos: **PDF armazenado e acessível, classificação correta, cliente e contrato vinculados, campos extraídos com fonte e pendências explícitas, cálculo e parcelamento revisados, resumo de resultado**.
6. Se faltar informação essencial para vínculo financeiro confiável, usar estado **revisão necessária** sem criar lançamento com valor inventado. Informar ao usuário o que foi cadastrado e o que permanece pendente.

## 8. Integração e responsabilidades técnicas

- **ChatGPT:** quando o usuário envia arquivo no chat e há acesso ao PDF/conector, analisar e executar cadastro durante a interação; não declarar que um chat aciona automaticamente um sistema externo sem integração ativa.
- **Portal:** ao selecionar PDF, iniciar leitura/prévia de imediato; gravação, criação do contrato e comissão exigem validação do vínculo e salvamento efetivo no backend. Versão 20.66: leitura de prévia automática, sem gravação automática.
- **Google Drive:** adicionar arquivo à pasta não implica importação contínua até existir um monitor/webhook/serviço com autorização, registro de eventos e tratamento de falhas.
- **Backend:** implementar processamento idempotente por arquivo, serviço autenticado, fila durável, extração mais ampla e persistência das evidências antes de marcar **concluído**. É proibido alegar que isto já funciona ponta-a-ponta sem testes reais.
- **Privacidade:** nunca tornar PDFs ou CPFs públicos; controlar acesso por perfil, manter auditoria de alterações e conferir permissões.

## 9. Registro de retorno obrigatório após cada PDF

Informar em linguagem objetiva: arquivo, cliente vinculado, tipo e período do contrato, produtor e comissão cheia, prêmio líquido + IOF + total, valor segurado (com origem), número/valores/vencimentos das parcelas, PDF acessível, comissões calculadas, pendências e **ID de checkpoint**.

**Esta especificação é permanente e deve orientar todas as próximas importações.** As capacidades já implementadas e as etapas ainda pendentes de automação devem ser distinguidas claramente em qualquer relatório.

## 10. Implementação evolutiva (25/10/2026)

- **API de leitura:** Supabase Edge Function `lebrime-api`, versão 34, módulo `backend/lebrime-api/pdf_enrichment.mjs`. Faz prévia por texto selecionável em PDFs de até 100 páginas e 15 MB; captura prêmio líquido, IOF, encargos, produtor/comissão quando explicitamente rotulados, forma de pagamento, corretora, coberturas/franquias, placas/chassis/FIPE e sua evidência textual. O extrator de parcelamento também examina todas as páginas dentro desse limite.
- **Interface:** Portal v20.69 mostra campos financeiros adicionais, riscos e linhas de cobertura e só sugere aplicar campos com fonte confiável. O upload de PDF preserva o original e prévia para revisão; não autoriza cobrança, cancelamento ou sobrescrita silenciosa.
- **Pasta privada de entrada monitorada:** [LEBRIME - ENTRADA AUTOMATICA DE PDFS](https://drive.google.com/drive/folders/16VUcau6FlvVvE2wknf8dTKomxRoNoVRU), sob o Drive privado do sistema. É o único diretório de entrada do monitor agendado, não todas as pastas do usuário.
- **Verificação de entrada do Drive:** tarefa recorrente a cada **uma hora**, usando os conectores Google Drive e Supabase disponíveis na execução; compara ID do arquivo e registros/checkpoints para evitar repetição, analisa PDFs novos, vincula somente quando os campos forem comprovados e notifica pendências. **Não é webhook instantâneo**, e seu primeiro processamento real ainda depende da execução agendada/validação.
- **Limites declarados:** arquivos digitalizados sem texto selecionável ainda requerem OCR autorizado ou revisão humana; PDF com mais de 100 páginas requer divisão/revisão; registros com conflito nunca são completados automaticamente. O monitor depende do conector Drive e acesso ao Supabase em cada execução; se falhar, sinalizar necessidade de intervenção sem declarar importação concluída.

### Tolerância financeira permanente — 25/10/2026

**Até R$ 10,00 (inclusive) de diferença financeira de conciliação é aceito sem pendência por essa diferença.** Isso inclui prêmio total versus prêmio líquido + IOF + adicionais documentados e soma das parcelas versus prêmio total, aplicando sempre centavos inteiros e valor absoluto do saldo. R$ 9,99 e R$ 10,00 são tolerados; R$ 10,01 exige revisão. Essa regra não justifica ausência de comprovante, vencimento, cliente, produtor ou valor. **Não alterar o prêmio, parcelas ou IOF do documento para forçar conciliação.**

- Função compartilhada no frontend: `tolerancia-financeira.js`.
- Validação SQL: `public.lebrime_financial_difference(valor_esperado_centavos, valor_encontrado_centavos)`.
- Leitura de PDFs: `lebrime-api` com `financialReconciliation`, sem alertas financeiros para diferenças toleradas.
- Aplicação: prévia, nova vigência, cobrança/parcelas, detalhes dos contratos e relatórios de auditoria.
