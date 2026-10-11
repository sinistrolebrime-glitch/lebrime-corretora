const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');

const html=fs.readFileSync('index.html','utf8');
const js=fs.readFileSync('renovacao-cadastro.js','utf8');
for(const id of ['renewalNewForm','newRenewalClient','newRenewalPrevious','newRenewalPdf','newRenewalPremium'])
 assert.ok(html.includes('id="'+id+'"'), 'formulário ausente: '+id);
const elements=new Map();
class Node{
 constructor(id=''){this.id=id;this.value='';this.innerHTML='';this.textContent='';this.files=[];
  this.disabled=false;this.onclick=null;this.onchange=null;this.onsubmit=null;this.open=false;
  this.options=[{value:'Lebrime'},{value:'FF Apolinário'}];this.dataset={};this.children=[];
  this.parentElement={insertBefore:node=>this.children.push(node)};
 }
 append(...nodes){this.children.push(...nodes)}
 querySelector(selector){if(selector==='.client-kpis')return new Node('kpis');return null}
 scrollIntoView(){}
 close(){this.open=false}
}
const E=id=>{if(!elements.has(id))elements.set(id,new Node(id));return elements.get(id)};
function pdf(name='nova.pdf',magic='%PDF-'){
 return {name,size:400,type:'application/pdf',slice:()=>({arrayBuffer:async()=>new TextEncoder().encode(magic).buffer}),arrayBuffer:async()=>new TextEncoder().encode(magic+':'+name).buffer}
}
const clients=[{id:'c1',kind:'client',data:{name:'Cliente de Teste',document:'00011122233'}}];
const old={id:'p-old',kind:'proposal',data:{clientId:'c1',number:'OLD',insurer:'Porto',branch:'Automóvel',
 start:'2025-10-10',end:'2026-10-10',premium:120000,brokerage:'Lebrime'}};
const contracts=[old];
const writes=[],calls=[];
let docs=[],current='overview',sequence=1;
const values={
 newRenewalClient:'c1',newRenewalPrevious:'p-old',newRenewalBrokerage:'Lebrime',
 newRenewalInsurer:'Porto',newRenewalBranch:'Automóvel',newRenewalNumber:'NEW-2026',
 newRenewalStart:'2026-10-11',newRenewalEnd:'2027-10-11',newRenewalPremium:'1.350,00',
 newRenewalCount:'10',newRenewalPayment:'Boleto'
};
for(const [k,v]of Object.entries(values))E(k).value=v;
E('newRenewalPdf').files=[pdf()];
const sourceObject={
 document:{getElementById:E,createElement:()=>new Node(),dispatchEvent:()=>{}},
 CustomEvent:class CustomEvent{constructor(type,options){this.type=type;this.detail=options.detail}},
 portfolioRows:()=>contracts.slice(),list:kind=>kind==='client'?clients:kind==='document'?docs:[],
 rowById:id=>clients.concat(contracts).find(x=>x.id===id)||null,
 uuid:()=> 'uuid-'+sequence++,now:()=> '2026-10-11T15:00:00.000Z',
 esc:x=>String(x),api:async(action,body,opts)=>{
  calls.push({action,body,opts});
  if(action==='write'){
   writes.push(body.ops);
   for(const op of body.ops){
    if(op.kind==='proposal')contracts.push({id:op.id,kind:op.kind,data:op.data});
    if(op.kind==='document')docs.push({id:op.id,kind:op.kind,data:op.data});
   }
   return {ok:true};
  }
  if(action==='payments-extract')return {applied:true,status:'partial'};
  return {ok:true};
 },
 loadRecords:async()=>{},openClientDetail:()=>{},navigate:()=>{},
 date:()=>'',crypto:webcrypto,TextEncoder,Uint8Array,String,Array,Number,Date,Map,console,
};
vm.createContext(sourceObject);
vm.runInContext(js,sourceObject);
async function submit(){
 await E('renewalNewForm').onsubmit({preventDefault(){}});
 return E('newRenewalStatus').textContent;
}
(async()=>{
 let message=await submit();
 assert.equal(writes.length,1,'deve haver um único lote de escrita');
 assert.equal(writes[0].length,2,'proposta e PDF vinculados na mesma transação');
 const proposal=writes[0].find(x=>x.kind==='proposal'),document=writes[0].find(x=>x.kind==='document');
 assert.equal(proposal.data.clientId,'c1');
 assert.equal(proposal.data.renewalOf,'p-old');
 assert.equal(proposal.data.premium,135000);
 assert.equal(proposal.data.producerPending,true);
 assert.equal(proposal.data.commissionPending,true);
 assert.equal(proposal.data.insuredValuePending,true);
 assert.equal(proposal.data.installmentCount,10);
 assert.equal(document.data.proposalId,proposal.id);
 assert.equal(document.data.clientId,'c1');
 assert.equal(document.data.storageKey.split('/')[0],'clients');
 assert.match(proposal.data.importFingerprint,/^[a-f0-9]{64}$/);
 assert.equal(proposal.data.sourcePdfSha256,document.data.fileSha256);
 assert.equal(old.data.end,'2026-10-10','contrato anterior não pode ser modificado');
 assert.deepEqual(calls.filter(c=>c.action==='write').length,1);
 assert.equal(calls.filter(c=>c.action==='storage-put').length,1);
 assert.equal(calls.filter(c=>c.action==='payments-extract').length,1);
 assert.match(message,/Nova vigência criada/);
 assert.equal(E('newRenewalStatus').children.length,2,'botão de abrir ficha do cliente');
 // Não duplicar a mesma proposta quando o gestor clicar novamente.
 message=await submit();
 assert.equal(writes.length,1,'cadastro duplicado bloqueado');
 assert.equal(calls.filter(c=>c.action==='storage-put').length,1);
 assert.match(message,/Já existe/);
 // CPF/CNPJ extraído de PDF não pode ser trocado por outro cliente no salvar.
 sourceObject.LebrimeProposalPreview={documentFor:()=> '99999999999'};
 E('newRenewalNumber').value='NOVO-DIFERENTE';
 E('newRenewalPdf').files=[pdf('novo.pdf')];
 message=await submit();
 assert.match(message,/CPF\/CNPJ da proposta diverge/i);
 assert.equal(writes.length,1);
 delete sourceObject.LebrimeProposalPreview;
 // Falso PDF rejeitado antes do upload e antes da escrita.
 E('newRenewalNumber').value='NOVO-DIF';
 E('newRenewalPdf').files=[pdf('falso.pdf','HELLO')];
 message=await submit();
 assert.equal(writes.length,1);
 assert.match(message,/assinatura PDF/i);
 // Contrato anterior de cliente errado não serve para vincular renovação.
 E('newRenewalPdf').files=[pdf()];
 const other={id:'p-other',kind:'proposal',data:{clientId:'c2',number:'OTHER'}};
 contracts.push(other);
 E('newRenewalPrevious').value='p-other';
 message=await submit();
 assert.match(message,/não pertence a este cliente/);
 assert.equal(writes.length,1);
 console.log('PASS: renovação nova com PDF e parcelas, preservação histórica, prevenção duplicidade, arquivo real e vínculo correto');
})().catch(error=>{console.error(error);process.exitCode=1});
