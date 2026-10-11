import assert from 'node:assert/strict';
import {operationalFinance,operationalPaymentAction} from '../supabase/functions/lebrime-api/operational_finance.ts';
import {localToday} from '../supabase/functions/lebrime-api/operational_finance_rules.mjs';

const day=localToday();
const records=[
  {id:'policy1',kind:'policy',version:1,data:{clientId:'client1',number:'POL123',insurer:'Seguradora TESTE',commission:900000,producer:'Produtor Privado'}},
  {id:'client1',kind:'client',version:1,data:{name:'Cliente Teste',document:'00011122233',mobile:'11999990000'}},
  {id:'doc1',kind:'document',version:1,data:{clientId:'client1',policyId:'policy1',documentType:'Apólice',sourceDriveFileId:'file-test'}}
];
for(let i=0;i<5473;i++)records.push({id:'payment-'+String(i).padStart(5,'0'),kind:'payment',version:1,data:{
  clientId:'client1',policyId:'policy1',installment:String(i+1)+'/5473',
  amount:10000,due:i===0?day:'',collectionStatus:i===0?'Não iniciado':'Não cobrar',status:'Em aberto',
  financialTracking:'Acompanhamento financeiro'
}});
class Query{
  constructor(db){this.db=db;this.pred=[];this.sort=null}
  select(){return this}
  eq(field,value){this.pred.push(r=>String(field.startsWith('data->>')?r.data?.[field.slice(7)]:r[field])===String(value));return this}
  in(field,values){this.pred.push(r=>values.includes(r[field]));return this}
  order(field){this.sort=field;return this}
  findAll(){
    let xs=this.db.records.filter(r=>this.pred.every(fn=>fn(r)));
    if(this.sort)xs=xs.slice().sort((a,b)=>String(a[this.sort]).localeCompare(String(b[this.sort])));
    return xs
  }
  async range(start,end){return {data:this.findAll().slice(start,end+1),error:null}}
  async maybeSingle(){return {data:this.findAll()[0]||null,error:null}}
}
class DB{
  constructor(records){this.records=records}
  from(table){assert.equal(table,'records');return new Query(this)}
  async rpc(name,args){
    assert.equal(name,'lebrime_apply_record_ops');
    for(const op of args.ops){
      const current=this.records.find(r=>r.id===op.id&&r.kind===op.kind);
      if(!current||current.version!==op.version)return {error:new Error('Controle de versão divergente'),data:null};
      current.data=structuredClone(op.data);current.version++;
    }
    return {error:null,data:[]};
  }
}
const db=new DB(records);
const one=await operationalFinance(db,{filter:'review',page:0});
assert.equal(one.total,5472);
assert.equal(one.rows.length,60);
assert.equal(one.pages,Math.ceil(5472/60));
assert.equal(one.counts.all,5473);
assert.equal(one.counts.blocked,5472);
assert.equal(one.counts.review,5472);
const last=await operationalFinance(db,{filter:'review',page:999});
assert.equal(last.page,last.pages-1);
assert.equal(last.rows.length,5472%60);
const today=await operationalFinance(db,{filter:'attention',page:0});
assert.equal(today.total,1);
assert.equal(today.rows[0].stage,'today');
assert.equal(today.rows[0].clientName,'Cliente Teste');
assert.equal(today.rows[0].messageAllowed,true);
assert.equal(JSON.stringify(today).includes('commission'),false);
assert.equal(JSON.stringify(today).includes('Produtor Privado'),false);
const first=records.find(r=>r.id==='payment-00000');
const missing=records.find(r=>r.id==='payment-00001');
await assert.rejects(()=>operationalPaymentAction(db,{operation:'contact',paymentId:missing.id,version:1,responsible:'Equipe',note:'Enviei mensagem de cobrança.'}),/sem condições de cobrança/);
const action=await operationalPaymentAction(db,{operation:'contact',paymentId:first.id,version:1,responsible:'Equipe',note:'Mensagem cordial enviada pelo WhatsApp.',nextActionDate:day});
assert.equal(action.ok,true);
assert.equal(first.data.collectionStatus,'Cliente avisado');
assert.equal(first.data.contactHistory.length,1);
assert.equal(first.data.status,'Em aberto');
await assert.rejects(()=>operationalPaymentAction(db,{operation:'contact',paymentId:first.id,version:1,responsible:'Equipe',note:'Outro contato de cobrança.'}),/outro usuário/);
const noted=await operationalPaymentAction(db,{operation:'review-note',paymentId:missing.id,version:1,responsible:'Equipe',note:'A fatura do cartão não tem data de vencimento.'});
assert.equal(noted.ok,true);
assert.equal(missing.data.reviewResponsible,'Equipe');
await assert.rejects(()=>operationalPaymentAction(db,{operation:'confirm-payment',paymentId:missing.id,version:2,responsible:'Equipe',note:'Cliente informou pagamento.',paidDate:day,evidence:''}),/evidência/);
await operationalPaymentAction(db,{operation:'confirm-payment',paymentId:missing.id,version:2,responsible:'Equipe',note:'Comprovante identificado pelo cliente.',paidDate:day,evidence:'Comprovante bancário, transação 123'});
assert.equal(missing.data.status,'Pago');
assert.equal(missing.data.collectionStatus,'Regularizado');
assert.equal(missing.data.contactHistory.length,2);
assert.equal(missing.data.paymentEvidence,'Comprovante bancário, transação 123');
console.log('PASS: integração do financeiro operacional com 5.473 registros, paginação, comissões ocultas, contato, baixa e evidência');
