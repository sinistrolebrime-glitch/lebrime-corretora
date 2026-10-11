import assert from "node:assert/strict";
import {previewProposalFromPages} from "../supabase/functions/lebrime-api/proposal_preview.mjs";

// Casos adaptados de layouts REAIS Allianz da carteira; dados pessoais substituídos.
const auto=[
 "Olá MARIA CLIENTE, Agradecemos por escolher a Allianz para proteger o seu carro.\n"+
 "Página 1 de 7 Nº Proposta: 141155424\nAUTO\nAUTOMÓVEL\nALLIANZ\nPROPOSTA\n"+
 "SUAS INFORMAÇÕES\nNome: MARIA CLIENTE\nCPF/CNPJ: 877.374.423-91 Tel: 86981155151\n"+
 "INFORMAÇÕES DO CONDUTOR PRINCIPAL\nNome: MARIA CLIENTE CPF: 877.374.423-91\n"+
 "INFORMAÇÕES DO SEU SEGURO\n"+
 "Vigência: das 24H de 10/10/2026 às 24H de 10/10/2027 Nº da Proposta: 141155424\n"+
 "Tipo de Seguro: Renovação Allianz sem sinistro Ramo: 31 - Automóvel\n"+
 "Cód. FIPE: 017075-5\n"+
 "INFORMAÇÕES DA RENOVAÇÃO\nNº. Apólice Anterior: 2105725",
 "OFERTA ESCOLHIDA\nCasco - Básica 100% FIPE * R$ 1.032,62\n"+
 "Preço Líquido R$ 2.510,75\nPreço Total (IOF + Juros inclusos) R$ 2.696,03",
 "INFORMAÇÕES DE PAGAMENTO\nPreço líquido: R$ 2.510,74\nPreço Total (impostos inclusos)\nR$ 2.696,03",
 "Parcelas Valor da Parcela Parcelas Valor da Parcela\n"+
 "1 R$ 449,34 4 R$ 449,34\n2 R$ 449,34 5 R$ 449,34\n3 R$ 449,34 6 R$ 449,33"
];
const empresarial=[
 "Allianz Empresarial\nPágina 1 de 5 Nº Apólice: 5177202611180129465\n"+
 "Apólice Nº. da Proposta: 140094811\nNº. da Apólice:\n5177202611180129465\n"+
 "SUAS INFORMAÇÕES\nNome: EMPRESA TESTE SHOPPING LTDA CNPJ: 05.635.656/0001-02\n"+
 "INFORMAÇÕES DO SEGURO\n"+
 "Produto | Ramo: 18 - Empresa Corporate\n"+
 "Limite Máximo de Garantia da Apólice*: 102.000.000,00\n"+
 "Vigência: das 24h de 03/08/2026 às 24h de 03/08/2027",
 "VALOR EM RISCO\nDanos Materiais: 100.000.000,00\nDespesas Fixas: 2.000.000,00\n"+
 "Incêndio e Complementares 100.000.000,00 24.875,93\nDanos Elétricos 1.500.000,00",
 "INFORMAÇÕES DE PAGAMENTO\n"+
 "Forma de Pagamento: Boleto Bancário Nº de Parcelas: 7\n"+
 "Prêmio Líquido: (R$): 55.116,39\n"+
 "Prêmio Total (R$): 59.183,98 IOF (R$): 4.067,59\n"+
 "Parc. Vencimento Valor Parc. Vencimento Valor Parc. Vencimento Valor\n"+
 "1 13/08/2026 8.454,84 4 05/11/2026 8.454,84 7 05/02/2027 8.454,94\n"+
 "2 05/09/2026 8.454,84 5 05/12/2026 8.454,84\n"+
 "3 05/10/2026 8.454,84 6 05/01/2027 8.454,84"
];
const frota=[
 "REDEMAQUINAS COMERCIO E SERVICOS DE MAQUINAS, Obrigado por pensar na Allianz.\n"+
 "PROPOSTA\nALLIANZ\nAUTO\nPágina 1 de 9 Nº Proposta: 138374114\nFROTA\n"+
 "SUAS INFORMAÇÕES\nREDEMAQUINAS COMERCIO E SERVICOS DE MAQUINAS\n"+
 "CPF/CNPJ: 06.094.934/0001-16\nINFORMAÇÕES DO SEU SEGURO\n"+
 "Proposta Nº: 138374114 Ramo: 31 - Frota Automóvel Digital\n"+
 "Apólice Nº: 5177202611311242748\n"+
 "Quantidade de Itens: 00005 Versão: 000158/00157.05 Tipo de Seguro: Renovação\n"+
 "Vigência: das 24H de 05/08/2026 às 24H de 10/06/2027",
 "COBERTURAS - VALORES MÁXIMOS DE INDENIZAÇÃO\n"+
 "ITEM LIMITE MÁXIMO DE INDENIZAÇÃO (% FIPE)\n"+
 "71-I 100% * 200.000,00 200.000,00\n72-I 100% * 200.000,00",
 "INFORMAÇÕES DE PAGAMENTO\nBoleto Bancário\n"+
 "em 8 parcelas Preço líquido: 8.398,93\n"+
 "TOTAL A PAGAR (IMPOSTOS INCLUÍDOS): 9.018,77\n"+
 "PARCELA VENCIMENTO VALOR (R$) PARCELA VENCIMENTO VALOR (R$)\n"+
 "1 15/08/2026 1.127,34 5 10/12/2026 1.127,34\n"+
 "2 10/09/2026 1.127,34 6 10/01/2027 1.127,34\n"+
 "3 10/10/2026 1.127,34 7 10/02/2027 1.127,34\n"+
 "4 10/11/2026 1.127,34 8 10/03/2027 1.127,39"
];
const autoR=previewProposalFromPages(auto);
const empR=previewProposalFromPages(empresarial);
const frotaR=previewProposalFromPages(frota);
function same(name,got,want){
 assert.equal(got,want,name+" (recebido: "+String(got)+")");
}
same("Auto CPF",autoR.fields.insuredDocument?.value,"87737442391");
same("Auto segurado",autoR.fields.insuredName?.value,"MARIA CLIENTE");
same("Auto seguradora",autoR.fields.insurer?.value,"Allianz");
same("Auto ramo",autoR.fields.branch?.value,"Automóvel");
same("Auto proposta",autoR.fields.number?.value,"141155424");
same("Auto início",autoR.fields.start?.value,"2026-10-10");
same("Auto fim",autoR.fields.end?.value,"2027-10-10");
same("Auto prêmio",autoR.fields.premium?.value,269603);
same("Auto FIPE não monetário",autoR.fields.insuredValue,null);
assert.ok(autoR.warnings.some(x=>x.includes("FIPE")));
same("Empresarial CNPJ",empR.fields.insuredDocument?.value,"05635656000102");
same("Empresarial segurado",empR.fields.insuredName?.value,"EMPRESA TESTE SHOPPING LTDA");
same("Empresarial ramo",empR.fields.branch?.value,"Empresarial");
same("Empresarial apólice",empR.fields.number?.value,"5177202611180129465");
same("Empresarial prêmio",empR.fields.premium?.value,5918398);
same("Empresarial limite global sem soma dos sublimites",empR.fields.insuredValue?.value,10200000000);
same("Empresarial início",empR.fields.start?.value,"2026-08-03");
same("Empresarial fim",empR.fields.end?.value,"2027-08-03");
same("Frota CNPJ",frotaR.fields.insuredDocument?.value,"06094934000116");
same("Frota segurado",frotaR.fields.insuredName?.value,"REDEMAQUINAS COMERCIO E SERVICOS DE MAQUINAS");
same("Frota ramo",frotaR.fields.branch?.value,"Frota");
same("Frota proposta",frotaR.fields.number?.value,"138374114");
same("Frota início",frotaR.fields.start?.value,"2026-08-05");
same("Frota fim",frotaR.fields.end?.value,"2027-06-10");
same("Frota prêmio",frotaR.fields.premium?.value,901877);
same("Frota FIPE não é R$",frotaR.fields.insuredValue,null);
same("Frota 5 itens",frotaR.itemCount?.value,5);
console.log("PASS: Allianz Auto, Empresarial e Frota, CNPJ, vigências, prêmios, limite global e FIPE pendente");
