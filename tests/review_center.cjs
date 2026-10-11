const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('central-conferencia.js','utf8');
const clients=[
 {id:'c1',data:{name:'Cliente Vencido',document:'00000000001'}},
 {id:'c2',data:{name:'Cliente Misto',document:'00000000002'}},
 {id:'c3',data:{name:'Cliente Vigente',document:'00000000003'}}
];
const contracts=[
 {id:'p1',kind:'proposal',data:{clientId:'c1',number:'1001',start:'2025-10-01',end:'2026-10-01',premium:10000,installmentPlan:[{amount:10000}],producerPending:true}},
 {id:'p2',kind:'proposal',data:{clientId:'c2',number:'2001',start:'2025-09-10',end:'2026-09-10',premium:30000,installmentPlan:[{amount:30001}],producerId:'prod1'}},
 {id:'p3',kind:'proposal',data:{clientId:'c2',number:'2002',start:'2026-09-11',end:'2027-09-11',premium:60000,installmentPlan:[{amount:60000}],producerId:'prod1'}},
 {id:'p4',kind:'policy',data:{clientId:'c3',number:'3001',start:'2026-01-01',end:'2027-01-01',premium:30000,producerId:'prod2'}}
];
const documents=[{data:{proposalId:'p2',sourceDriveFileId:'123456789012345'}},{data:{proposalId:'p3',storageKey:'clients/c2/file.pdf'}}];
const payments=[
 {data:{clientId:'c1',proposalId:'p1',status:'Em aberto',collectionStatus:'Não cobrar',due:''}},
 {data:{clientId:'c2',proposalId:'p2',status:'Pago',due:''}},
 {data:{clientId:'c2',proposalId:'p3',status:'Em aberto',due:'2026-13-99'}},
 {data:{clientId:'c3',policyId:'p4',status:'Em aberto',due:'2026-10-22'}}
];
const doc={head:{appendChild(){}},createElement:()=>({textContent:''}),getElementById:id=>id==='dashboard'?{isConnected:true}:null};
const context={document:doc,Date,String,Array,Map,Set,Number,Intl,console,
 renderDashboard(){},globalThis:{},esc:x=>x};
vm.createContext(context);vm.runInContext(source,context);
const result=context.globalThis.LebrimeReviewCenter.analyze(clients,contracts,documents,payments,'2026-10-11');
assert.equal(result.counts.expiredClients,2);
assert.equal(result.counts.expiredOnly,1);
assert.equal(result.counts.expiredWithOther,1);
assert.equal(result.counts.missingPdfs,2);
assert.equal(result.counts.producerReview,1);
assert.equal(result.counts.undatedUnpaidPayments,2);
assert.equal(result.counts.mismatchedPlans,1);
assert.equal(result.issues.expired[0].clientId,'c1');
assert.equal(result.issues.plan[0].clientId,'c2');
assert.ok(result.issues.due.every(r=>!r.message.includes('Atrasada')));
console.log('PASS: pendências por cliente, documentos, produtor, diferença de parcelas e datas sem cobrança indevida');
