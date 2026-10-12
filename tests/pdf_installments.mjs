import assert from 'node:assert/strict';
import {parseInstallmentSchedule} from '../scripts/parse_installments.mjs';
const fixtures=[
  ['Quadro com 3 parcelas',['Seguradora TESTE\nPlano de parcelamento\nParcela 1/3 10/11/2026 R$ 100,00\nParcela 2/3 10/12/2026 R$ 100,00\nParcela 3/3 10/01/2027 R$ 101,00'],30100,'verified'],
  ['Tabela sem prefixo',['Parcelas Vencimento Valor\n01 15/10/2026 1.000,00\n02 15/11/2026 1.250,00'],225000,'verified'],
  ['Sem evidência de parcela',['Vigência 10/10/2026 a 10/10/2027\nCobertura básica 1.000,00\nPrêmio total 1.000,00'],100000,'review'],
  ['Prêmio divergente',['Parcelamento\n1/2 10/10/2026 R$ 10,00\n2/2 10/11/2026 R$ 10,00'],2101,'review'],
  ['Diferença de R$1 aceita',['Parcelamento\n1/2 10/10/2026 R$ 10,00\n2/2 10/11/2026 R$ 10,00'],2100,'verified'],
  ['Diferença de R$0,01 aceita',['Parcelamento\n1/2 10/10/2026 R$ 10,00\n2/2 10/11/2026 R$ 10,00'],2001,'verified'],
  ['Parcela repetida em página',['Parcelamento\n1/2 10/10/2026 R$ 10,00\n2/2 10/11/2026 R$ 10,00','Parcelamento\n1/2 10/10/2026 R$ 10,00\n2/2 10/11/2026 R$ 10,00'],2000,'verified'],
  ['Duplicata contraditória',['Parcelamento\n1/2 10/10/2026 R$ 10,00\n1/2 10/11/2026 R$ 10,00\n2/2 10/12/2026 R$ 10,00'],2000,'review'],
  ['Data impossível',['Parcelamento\n1/1 31/02/2026 R$ 10,00'],1000,'review'],
  ['Sem mês explicitado',['Parcelamento\n1/2 Fatura do cartão R$ 10,00\n2/2 Fatura do cartão R$ 10,00'],2000,'partial'],
  ['Allianz dia sem mês',['INFORMAÇÕES DE PAGAMENTO\nForma de pagamento\nBoleto Bancário\nem 1 parcela IOF R$ 404,85\nVencimento: 29 Preço Total (impostos inclusos)\nR$ 5.890,59\nParcelas Valor da Parcela\n1 R$ 5.890,59'],589059,'partial']
];
for(const [title,pages,premium,expected] of fixtures){
  const r=parseInstallmentSchedule(pages,{premium});
  assert.equal(r.status,expected,title+': '+r.reason);
}
const slight=parseInstallmentSchedule(fixtures[5][1],{premium:2001});
assert.equal(slight.variance,-1);
assert.equal(slight.toleranceApplied,true);
assert.equal(slight.toleranceCents,1);
const over=parseInstallmentSchedule(fixtures[3][1],{premium:2101});
assert.equal(over.status,'review');

const twoColumns=[
  'INFORMAÇÕES DE PAGAMENTO\nPARCELA VENCIMENTO VALOR (R$) PARCELA VENCIMENTO VALOR (R$)\n1 14/09/2026 8.149,60 4 20/12/2026 8.149,60\n2 20/10/2026 8.149,60 5 20/01/2027 8.149,60\n3 20/11/2026 8.149,60 6 20/02/2027 8.149,60',
  'PARCELA VENCIMENTO VALOR (R$) PARCELA VENCIMENTO VALOR (R$)\n7 20/03/2027 8.149,60 9 20/05/2027 8.149,60\n8 20/04/2027 8.149,60 10 20/06/2027 8.149,72'
];
const cla= parseInstallmentSchedule(twoColumns,{premium:8149612});
assert.equal(cla.status,'verified',cla.reason);
assert.equal(cla.plan.length,10);
assert.equal(cla.plan[0].due,'2026-09-14');
assert.equal(cla.plan[9].due,'2027-06-20');
assert.equal(cla.amountTotal,8149612);
const duplicateTwoColumn=parseInstallmentSchedule([...twoColumns,twoColumns[0]],{premium:8149612});
assert.equal(duplicateTwoColumn.status,'verified');

const creditCardTable=[
  'INFORMAÇÕES DE PAGAMENTO\nCartão de Crédito\nem 10 parcelas\nTotal a pagar R$ 806,13\nParcelas\n1 R$ 80,61 5 R$ 80,61 9 R$ 80,61\n2 R$ 80,61 6 R$ 80,61 10 R$ 80,64\n3 R$ 80,61 7 R$ 80,61\n4 R$ 80,61 8 R$ 80,61'
];
const partialCard=parseInstallmentSchedule(creditCardTable,{premium:80613,paymentMethod:'Cartão'});
assert.equal(partialCard.status,'partial',partialCard.reason);
assert.equal(partialCard.plan.length,10);
assert.equal(partialCard.plan[9].amount,8064);
assert.ok(partialCard.plan.every(p=>p.due===''));
assert.equal(partialCard.amountTotal,80613);
const good=parseInstallmentSchedule(fixtures[0][1],{premium:30100});
assert.equal(good.plan.length,3);
assert.deepEqual(good.plan.map(p=>p.amount),[10000,10000,10100]);
assert.deepEqual(good.plan.map(p=>p.due),['2026-11-10','2026-12-10','2027-01-10']);
assert.equal(good.variance,0);
const partial=parseInstallmentSchedule(fixtures.at(-1)[1],{premium:589059});
assert.equal(partial.plan.length,1);
assert.equal(partial.plan[0].amount,589059);
assert.equal(partial.plan[0].due,'');
assert.equal(partial.plan[0].dueText,'Vencimento: 29');
// Estruturas dos quadros Allianz observados em Auto, Empresarial e Frota reais.
const allianzAuto=[
  'INFORMAÇÕES DE PAGAMENTO\nDébito em conta bancária em 6 parcelas\n'+
  'Preço Total (impostos inclusos) R$ 2.696,03\nParcelas Valor da Parcela Parcelas Valor da Parcela\n'+
  '1 R$ 449,34 4 R$ 449,34\n2 R$ 449,34 5 R$ 449,34\n3 R$ 449,34 6 R$ 449,33'
];
const autoParse=parseInstallmentSchedule(allianzAuto,{premium:269603,paymentMethod:'Débito em conta'});
assert.equal(autoParse.status,'partial','Allianz Auto: sem datas completas não marcar vencimentos conferidos');
assert.equal(autoParse.plan.length,6);
assert.equal(autoParse.amountTotal,269603);
assert.ok(autoParse.plan.every(x=>!x.due));

const allianzCorporate=[
  'INFORMAÇÕES DE PAGAMENTO\nForma de Pagamento: Boleto Bancário Nº de Parcelas: 7\n'+
  'Prêmio Total (R$): 59.183,98\nParc. Vencimento Valor Parc. Vencimento Valor Parc. Vencimento Valor\n'+
  '1 13/08/2026 8.454,84 4 05/11/2026 8.454,84 7 05/02/2027 8.454,94\n'+
  '2 05/09/2026 8.454,84 5 05/12/2026 8.454,84\n'+
  '3 05/10/2026 8.454,84 6 05/01/2027 8.454,84'
];
const corporateParse=parseInstallmentSchedule(allianzCorporate,{premium:5918398,paymentMethod:'Boleto'});
assert.equal(corporateParse.status,'verified','Allianz Empresarial: devem ser sete parcelas com datas');
assert.equal(corporateParse.plan.length,7);
assert.equal(corporateParse.amountTotal,5918398);

const allianzFleet=[
 'INFORMAÇÕES DE PAGAMENTO\nBoleto Bancário em 8 parcelas\n'+
 'TOTAL A PAGAR (IMPOSTOS INCLUÍDOS): 9.018,77\n'+
 'PARCELA VENCIMENTO VALOR (R$) PARCELA VENCIMENTO VALOR (R$)\n'+
 '1 15/08/2026 1.127,34 5 10/12/2026 1.127,34\n'+
 '2 10/09/2026 1.127,34 6 10/01/2027 1.127,34\n'+
 '3 10/10/2026 1.127,34 7 10/02/2027 1.127,34\n'+
 '4 10/11/2026 1.127,34 8 10/03/2027 1.127,39'
];
const fleetParse=parseInstallmentSchedule(allianzFleet,{premium:901877,paymentMethod:'Boleto'});
assert.equal(fleetParse.status,'verified','Allianz Frota: oito vencimentos conferidos');
assert.equal(fleetParse.plan.length,8);
assert.equal(fleetParse.amountTotal,901877);


// Regra FF/Allianz: dia 05 explícito, meses e anos apenas projetados.
const monthlyDayOnly=[
 'INFORMAÇÕES DE PAGAMENTO\nDébito em conta bancária em 6 parcelas\n'+
 'Vencimento: 5\nPreço Total (impostos inclusos) R$ 2.696,03',
 'Parcelas Valor da Parcela Parcelas Valor da Parcela\n'+
 '1 R$ 449,34 4 R$ 449,34\n2 R$ 449,34 5 R$ 449,34\n3 R$ 449,34 6 R$ 449,33'
];
const projection=parseInstallmentSchedule(monthlyDayOnly,{
 premium:269603,paymentMethod:'Débito em conta',startDate:'2026-10-10',issueDate:'2026-10-01'
});
assert.equal(projection.status,'partial');
assert.equal(projection.dueDay,5);
assert.equal(projection.estimatedDatesAvailable,true);
assert.deepEqual(projection.plan.map(x=>x.estimatedDue),
 ['2026-10-05','2026-11-05','2026-12-05','2027-01-05','2027-02-05','2027-03-05']);
assert.ok(projection.plan.every(x=>x.due===''&&x.dueEvidence.includes('projetados')));
const noIssue=parseInstallmentSchedule(monthlyDayOnly,{premium:269603,startDate:'2026-10-10'});
assert.equal(noIssue.plan[0].estimatedDue,'2026-11-05');
const withoutAnchor=parseInstallmentSchedule(monthlyDayOnly,{premium:269603});
assert.ok(withoutAnchor.plan.every(x=>!x.estimatedDue));
const ambiguous=parseInstallmentSchedule(monthlyDayOnly.map(x=>x.replace('Vencimento: 5','Vencimento: 5\nVencimento: 10')),
 {premium:269603,startDate:'2026-10-10'});
assert.equal(ambiguous.estimatedDatesAvailable,false);
assert.ok(ambiguous.plan.every(x=>!x.estimatedDue));

console.log('PASS: parser PDF, datas, valores, duplicatas, conciliação e revisão de ambiguidades');
