const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ctx=vm.createContext({Date,Intl,Set,Map,Number,String});
vm.runInContext(fs.readFileSync('financeiro.js','utf8'),ctx);
const F=vm.runInContext('FINANCE',ctx);
const current='2026-10-10';
const cutoff='2026-10';
const policy={id:'a',kind:'policy',data:{clientId:'c1'}};
const proposal={id:'b',kind:'proposal',data:{clientId:'c1'}};
const quote={id:'q',kind:'proposal',data:{clientId:'c2'}};
const imported=F.importedIds([
  {data:{proposalId:'b',documentType:'Proposta',sourceDriveFileId:'drive-id'}},
  {data:{proposalId:'q',documentType:'Proposta'}}
]);
assert.equal(imported.has('b'),true);
assert.equal(imported.has('q'),false);
const payment=(id,contract,extra={})=>({id,kind:'payment',data:{
  clientId:contract.data.clientId,policyId:contract.kind==='policy'?contract.id:'',
  proposalId:contract.kind==='proposal'?contract.id:'',
  status:'Em aberto',due:'2026-10-12',amount:12345,installment:'2/6',
  collectionStatus:'Não iniciado',...extra
}});
const policyPay=payment('p1',policy);
const proposalPay=payment('p2',proposal);
const quotePay=payment('p3',quote);
assert.equal(F.stage(policyPay,policy,imported,cutoff,current),'A vencer');
assert.equal(F.stage(proposalPay,proposal,imported,cutoff,current),'A vencer');
assert.equal(F.stage(quotePay,quote,imported,cutoff,current),'Previsão — não cobrar');
assert.equal(F.actionable(proposalPay,proposal,imported,cutoff,current),true);
assert.equal(F.actionable(quotePay,quote,imported,cutoff,current),false);
assert.equal(F.stage(payment('p4',policy,{due:''}),policy,imported,cutoff,current),'Conferir vencimento');
assert.equal(F.stage(payment('p5',policy,{amount:0}),policy,imported,cutoff,current),'Conferir valor');
assert.equal(F.stage(payment('p6',policy,{due:'2026-09-20'}),policy,imported,cutoff,current),'Migração a conferir');
assert.equal(F.stage(payment('p7',policy,{due:'2026-10-09'}),policy,imported,cutoff,current),'Vencida — não confirmada');
assert.equal(F.stage(payment('p8',policy,{due:'2026-10-10'}),policy,imported,cutoff,current),'Vence hoje');
assert.equal(F.stage(payment('p9',policy,{status:'Pago',migrationStatus:'Paga — Migração'}),policy,imported,cutoff,current),'Pago por migração');
assert.equal(F.actionable(payment('p10',policy,{collectionStatus:'Não cobrar'}),policy,imported,cutoff,current),false);
assert.equal(F.actionable(payment('p11',policy,{status:'Cancelado'}),policy,imported,cutoff,current),false);
assert.equal(F.validDate('2026-02-30'),false);
const queue=F.queueRows([policy,proposal,quote],[policyPay,proposalPay,quotePay]);
assert.equal(queue.length,3);
const missing=F.queueRows([policy,proposal,quote],[policyPay,proposalPay]);
assert.equal(missing.length,3);
assert.equal(missing.filter(r=>r.virtual).length,1);
const msg=F.message(payment('p12',policy,{due:'2026-10-09'}),'Cliente','123',current);
assert.match(msg,/não identificamos a confirmação/i);
assert.match(msg,/desconsidere/i);
assert.equal(F.message(payment('p13',policy,{due:''}),'Cliente','123',current),'');
const summary=F.summary([policyPay,proposalPay,quotePay],r=>({p1:policy,p2:proposal,p3:quote})[r.id],imported,cutoff,current);
assert.equal(summary.forecast,1);
assert.equal(summary.openValue,24690);
console.log('PASS: classificações, propostas importadas, cobranças bloqueadas, migração, dados ausentes, mensagens e fila de revisão');
