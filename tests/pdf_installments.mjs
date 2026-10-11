import assert from 'node:assert/strict';
import {parseInstallmentSchedule} from '../scripts/parse_installments.mjs';
const fixtures=[
  ['Quadro com 3 parcelas',['Seguradora TESTE\nPlano de parcelamento\nParcela 1/3 10/11/2026 R$ 100,00\nParcela 2/3 10/12/2026 R$ 100,00\nParcela 3/3 10/01/2027 R$ 101,00'],30100,'verified'],
  ['Tabela sem prefixo',['Parcelas Vencimento Valor\n01 15/10/2026 1.000,00\n02 15/11/2026 1.250,00'],225000,'verified'],
  ['Sem evidência de parcela',['Vigência 10/10/2026 a 10/10/2027\nCobertura básica 1.000,00\nPrêmio total 1.000,00'],100000,'review'],
  ['Prêmio divergente',['Parcelamento\n1/2 10/10/2026 R$ 10,00\n2/2 10/11/2026 R$ 10,00'],2100,'review'],
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
console.log('PASS: parser PDF, datas, valores, duplicatas, conciliação e revisão de ambiguidades');
