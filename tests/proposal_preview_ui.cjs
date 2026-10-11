const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('renovacao-previa.js','utf8');
const html=fs.readFileSync('index.html','utf8');
assert.match(html,/id="newRenewalPreviewButton"/);
assert.match(html,/id="newRenewalInsuredValue"/);
const nodes=new Map(),calls=[];
class Node{
 constructor(id){this.id=id;this.value='';this.textContent='';this.innerHTML='';
  this.files=[];this.hidden=false;this.disabled=false;this.onclick=null;
  this.listeners={};this.className='';}
 addEventListener(name,fn){this.listeners[name]=fn}
 dispatchEvent(e){this.listeners[e.type]?.(e);this.onchange?.(e)}
}
const get=id=>{if(!nodes.has(id))nodes.set(id,new Node(id));return nodes.get(id)};
const doc={getElementById:get,createElement:()=>new Node('style'),head:{appendChild(){}}};
const file={name:'ana.pdf',size:128,type:'application/pdf'};
get('newRenewalPdf').files=[file];
const clients=[{id:'clientA',data:{name:'Ana Maria',document:'12345678901'}},
 {id:'clientB',data:{name:'Outro Cliente',document:'11111111111'}}];
const answer={stored:false,requiresConfirmation:true,preview:{
 recognized:7,warnings:['Produtor e comissão exigem confirmação.'],
 fields:{insuredDocument:{value:'12345678901',page:1,evidence:'CPF/CNPJ: 123.456.789-01'},
 insurer:{value:'Porto Seguro',page:1,evidence:'Seguradora: Porto Seguro'},
 branch:{value:'Automóvel',page:1,evidence:'Ramo: Automóvel'},
 number:{value:'123456',page:1,evidence:'Número da Proposta: 123456'},
 start:{value:'2026-10-11',page:1,evidence:'Vigência: 11/10/2026'},
 end:{value:'2027-10-11',page:1,evidence:'Vigência: 11/10/2027'},
 premium:{value:135000,page:1,evidence:'Prêmio Total: R$ 1.350,00'},
 insuredValue:{value:9000000,page:1,evidence:'Valor segurado: R$ 90.000,00'}},
 installments:{status:'verified',reason:'Parcelas conciliadas',count:2,
 plan:[{amount:67500,due:'2026-10-20'},{amount:67500,due:'2026-11-20'}]}
}};
const ctx={document:doc,list:kind=>kind==='client'?clients:[],esc:s=>String(s).replace(/[&<>]/g,''),
 api:async(action,body)=>{calls.push(action);assert.equal(action,'proposal-preview');assert.equal(body,file);return answer;},
 Event:class Event{constructor(type){this.type=type}},Intl,Number,String,Array,Map,Set,console,globalThis:{}};
vm.createContext(ctx);vm.runInContext(source,ctx);
(async()=>{
 await get('newRenewalPreviewButton').onclick();
 assert.deepEqual(calls,['proposal-preview']);
 assert.equal(get('newRenewalInsurer').value,'','Prévia não pode gravar/alterar o formulário sem confirmação');
 assert.match(get('newRenewalPreviewResults').innerHTML,/Página 1/);
 assert.match(get('newRenewalPreviewResults').innerHTML,/Porto Seguro/);
 get('newRenewalClient').value='clientB';
 get('newRenewalApplyPreview').onclick();
 assert.equal(get('newRenewalInsurer').value,'','Divergência de CPF/CNPJ deve bloquear aplicação');
 get('newRenewalClient').value='';
 get('newRenewalApplyPreview').onclick();
 assert.equal(get('newRenewalClient').value,'clientA');
 assert.equal(get('newRenewalInsurer').value,'Porto Seguro');
 assert.equal(get('newRenewalPremium').value,'1.350,00');
 assert.equal(get('newRenewalInsuredValue').value,'90.000,00');
 assert.equal(get('newRenewalCount').value,'2');
 assert.equal(calls.length,1,'Nada salvo automaticamente');
 assert.equal(ctx.globalThis.LebrimeProposalPreview.documentFor(file),'12345678901');
 get('newRenewalPdf').files=[{name:'outro.pdf',size:128}];
 get('newRenewalPdf').listeners.change();
 assert.equal(ctx.globalThis.LebrimeProposalPreview.documentFor(file),null,'A prévia antiga deve ser descartada após trocar o PDF');
 console.log('PASS: prévia sem gravação, evidências por página, bloqueio por CPF e aplicação manual');
})().catch(e=>{console.error(e);process.exitCode=1});