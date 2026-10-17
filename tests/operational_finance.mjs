import assert from 'node:assert/strict';
import {stateOf,includeByFilter,summary,makeReminder,stageLabel,stageRank} from '../supabase/functions/lebrime-api/operational_finance_rules.mjs';
const day='2026-10-10',imported=new Set(['prop1']);
const policy={id:'pol1',kind:'policy',data:{}},proposal={id:'prop1',kind:'proposal',data:{}},quote={id:'quote',kind:'proposal',data:{}};
const p=(due,patch={})=>({data:{status:'Em aberto',due,amount:10000,collectionStatus:'Não iniciado',...patch}});
const stage=(x,contract=policy)=>stateOf(x,contract,imported,day);
assert.equal(stage(p('2026-10-09')),'late_unconfirmed');
assert.equal(stage(p('2026-10-10')),'today');
assert.equal(stage(p('2026-10-12')),'upcoming');
assert.equal(stage(p('2026-10-09',{collectionStatus:'Não cobrar'})),'blocked');
assert.equal(stage(p('2026-10-09',{collectionStatus:'Em tratativa'})),'blocked');
assert.equal(stage(p('2026-09-09')),'review_migration');
assert.equal(stage(p('2026-10-10',{status:'Pago'})),'review_paid_evidence');
assert.equal(stage(p('2026-10-10',{status:'Pago',paymentEvidence:'Comprovante da seguradora'})),'paid');
const offByCents={...policy,data:{premium:10001,installmentPlan:[{amount:10000,due:'2026-10-11'}]}};
assert.equal(stage(p('2026-10-11'),offByCents),'upcoming');
assert.equal(includeByFilter({stage:'review_plan',due:'2026-10-11'},'review',day),true);
assert.equal(includeByFilter({stage:'review_plan',due:'2026-10-11'},'attention',day),false);

assert.equal(stage(p('2026-09-10',{status:'Pago',migrationStatus:'Paga — Migração'})),'paid_migration');
assert.equal(stage(p('2026-10-10',{status:'Cancelado'})),'cancelled');
assert.equal(stage(p('')),'review_due');
assert.equal(stage(p('2026-02-31')),'review_due');
assert.equal(stage(p('2026-10-09',{amount:0})),'review_amount');
assert.equal(stage(p('2026-10-09'),quote),'forecast');
assert.equal(stage(p('2026-10-09'),proposal),'late_unconfirmed');
assert.equal(stage(p('2026-10-09'),null),'review_link');
const arr=[
 {stage:'late_unconfirmed',due:'2026-10-09',amount:10000},
 {stage:'upcoming',due:'2026-10-11',amount:20000},
 {stage:'review_due',due:'',amount:30000},
 {stage:'blocked',due:'2026-10-09',amount:40000},
 {stage:'paid',due:'2026-10-08',amount:50000},
 {stage:'paid_migration',due:'2026-09-09',amount:60000}
];
assert.equal(summary(arr,day).late,1);
assert.equal(summary(arr,day).week,1);
assert.equal(summary(arr,day).review,2);
assert.equal(summary(arr,day).paidMigration,1);
const blockedUndated={stage:'review_due',due:'',collectionStatus:'Não cobrar'};
assert.equal(summary([...arr,blockedUndated],day).blocked,2);
assert.equal(includeByFilter(blockedUndated,'blocked',day),true);
assert.equal(arr.filter(x=>includeByFilter(x,'attention',day)).length,2);
assert.equal(arr.filter(x=>includeByFilter(x,'review',day)).length,2);
assert.equal(arr.filter(x=>includeByFilter(x,'all',day)).length,6);
assert.ok(stageRank(arr[0],day)<stageRank(arr[2],day));
assert.equal(stageLabel('review_due'),'Conferir vencimento');
assert.equal(makeReminder({...arr[0],contractNumber:'123',installment:'1/3'},day).includes('não identificamos a confirmação'),true);
assert.equal(makeReminder({...arr[2],contractNumber:'123',installment:'1/3'},day),'');
console.log('PASS: financeiro operacional — estado, bloqueios, resumo, mensagens e filtros');
