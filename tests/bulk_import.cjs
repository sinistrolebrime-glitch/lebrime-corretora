const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const code=fs.readFileSync('importacao-lote.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const clients=[
 {id:'c1',data:{name:'Ana Maria Pereira',document:'12345678901'}},
 {id:'c2',data:{name:'José Carlos Almeida',document:'12345678000190'}}
];
const docs=[{id:'old',data:{fileSha256:'placeholder',clientId:'c1'}}];
const events={};const nodes=new Map();
class Node{
 constructor(id=''){this.id=id;this.innerHTML='';this.value='';this.files=[];
  this.children=[];this.textContent='';this.dataset={};this.disabled=false;this.onclick=null;
  this.handlers={};this.parentElement=this;this.size=0;this.name='';
 }
 addEventListener(type,handler){this.handlers[type]=handler}
 dispatchEvent(event){this.handlers[event.type]?.(event)}
 querySelectorAll(){return []}
 insertAdjacentElement(){return this}
 scrollIntoView(){}
 appendChild(child){this.children.push(child)}
 click(){}
}
function get(id){if(!nodes.has(id))nodes.set(id,new Node(id));return nodes.get(id)}
const dom={getElementById:get,createElement:()=>new Node(),addEventListener:(type,handler)=>events[type]=handler};
class DataTransfer{
 constructor(){this.files=[];this.items={add:file=>this.files.push(file)}}
}
class Event{constructor(type){this.type=type}}
function file(name,content='%PDF-abc'){
 const bytes=new TextEncoder().encode(content);
 return {name,size:bytes.byteLength,arrayBuffer:async()=>bytes.buffer,
  slice:(start,end)=>({arrayBuffer:async()=>bytes.slice(start,end).buffer})};
}
const ctx={document:dom,crypto:webcrypto,DataTransfer,Event,TextEncoder,
 list:kind=>kind==='client'?clients:docs,
 esc:v=>String(v),URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},
 Blob,confirm:()=>true,setTimeout,Intl,Promise,Date,Array,Uint8Array,String,Number,Map,Set,console,globalThis:{}};
vm.createContext(ctx);
vm.runInContext(code,ctx);
const bulk=ctx.globalThis.LebrimeBulkQueue;
assert.equal(bulk.matchClient('12345678901-portoseguro.pdf',clients).id,'c1');
assert.equal(bulk.matchClient('RENOVACAO_ANA MARIA PEREIRA.PDF',clients).id,'c1');
assert.equal(bulk.matchClient('Sem-identificacao.pdf',clients),null);
(async()=>{
 await bulk.addFiles([file('12345678901-1.pdf','%PDF-unique-data'),file('12345678901-copy.pdf','%PDF-unique-data'),file('falso.pdf','NOTPDF'),file('semidentificacao.pdf','%PDF-other')]);
 assert.equal(bulk.getCount(),4);
 assert.match(get('bulkMetrics').textContent,/Ignorados: 2/);
 assert.match(get('bulkQueueRows').innerHTML,/Repetido nesta seleção/);
 bulk.selectItem(0);
 assert.equal(get('newRenewalClient').value,'c1');
 assert.equal(get('newRenewalPdf').files[0].name,'12345678901-1.pdf');
 assert.match(get('bulkMetrics').textContent,/Em revisão: 1/);
 const sha=await webcrypto.subtle.digest('SHA-256',new TextEncoder().encode('%PDF-unique-data'));
 const hex=Buffer.from(sha).toString('hex');
 events['lebrime-renewal-import-success']({detail:{fileSha256:hex}});
 assert.match(get('bulkMetrics').textContent,/Importados: 1/);
 assert.match(get('bulkQueueRows').innerHTML,/Concluído/);
 assert.doesNotMatch(get('bulkQueueRows').innerHTML,/comissão|premio\s+liquido/i);
 console.log('PASS: lote de 4 PDFs, hash real, duplicidade, cliente sugerido, revisão e sucesso explícito');
})().catch(e=>{console.error(e);process.exitCode=1});
