const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const src=fs.readFileSync('script.js','utf8');
const op=fs.readFileSync('operacional-extras.js','utf8');
const backend=fs.readFileSync('supabase/functions/lebrime-operational-portal/index.ts','utf8');
const between=(start,end)=>{
 const a=src.indexOf(start),b=src.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a,'marcador ausente: '+start);
 return src.slice(a,b);
};
const pid='segflex-ins-3d6a8426b0bcc149b818ae07';
const cid='segflex-client-18212328368';
const eid='3ea93e77-4f13-5e1f-bdc7-d399cdf12885';
const parent={id:pid,kind:'proposal',data:{
 clientId:cid,policyNumber:'09 2375270',number:'20-28209274',start:'2025-10-10',end:'2026-10-10',premium:117450
}};
const movement={id:eid,kind:'endorsement',data:{
 clientId:cid,parentInsuranceId:pid,parentPolicyNumber:'09 2375270',number:'20-32231213',
 start:'2026-06-11',end:'2026-10-10',premium:38523,commissionPercent:15,producerName:'Leandro',
 priorVehicle:'Honda Fit',newVehicle:'Honda WR-V',premiumAdditionalConfirmed:true
}};
const commissions=[
{id:'c-main',kind:'commission',data:{proposalId:pid,expected:16407,received:16407,producerExpected:16407}},
{id:'c-end',kind:'commission',data:{proposalId:pid,endorsementId:eid,expected:5381,received:5381,producerExpected:5381}}
];
const ctx={list:kind=>kind==='commission'?commissions:kind==='endorsement'?[movement]:[],
 portfolioRows:()=>[parent],fold:v=>String(v||'').toLowerCase(),Set,Map,Number,String,
};
vm.createContext(ctx);
vm.runInContext(between('const effectiveCommissionRows=()=>{','// Regra da carteira Lebrime:')+
 '\nthis.commissionRows=effectiveCommissionRows;',ctx);
const all=ctx.commissionRows();
assert.equal(all.length,2,'A comissão do endosso não pode substituir a da proposta principal');
assert.equal(all.reduce((sum,r)=>sum+r.data.expected,0),21788);
vm.runInContext(between('const relatedEndorsementsFor=insurance=>{','const clientPortfolioState=')+
 '\nthis.linked=relatedEndorsementsFor;',ctx);
assert.equal(ctx.linked(parent).length,1,'Endosso com mesma apólice e mesma vigência');
assert.equal(ctx.linked({...parent,data:{...parent.data,policyNumber:'09 9999999'}}).length,0);
assert.equal(ctx.linked({...parent,data:{...parent.data,clientId:'outro-cliente'}}).length,0);
assert.ok(src.includes('endorsementHistoryHtml'),'Ficha gerencial precisa mostrar cronologia');
assert.ok(src.includes('premiumAdditionalConfirmed===true'),'Somar somente prêmio adicional confirmado');
assert.ok(op.includes('endorsementByContract'),'Operacional precisa agrupar endosso com contrato');
assert.ok(!/producerName|commissionPercent|producerId/.test(backend.match(/endorsements:\(endRows\|\|\[\]\)[\s\S]*?\)\),/)?.[0]||''),'Endpoint operacional não revela comissão');
assert.match(backend,/category\.includes\("endosso"\)/,'Endosso PDF visível sem ser proposta nova');
console.log('PASS: uma apólice, um endosso; comissão separada, prêmio adicional válido e sigilo operacional');