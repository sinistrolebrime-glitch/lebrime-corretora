const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const code=fs.readFileSync('continuidade-importacao.js','utf8');
const storage=new Map(),elements=new Map();
class Node {
 constructor(id=''){this.id=id;this.value='';this.innerHTML='';this.textContent='';
  this.children=[];this.handlers={};this.dataset={};this.disabled=false;}
 insertAdjacentElement(){}
 querySelectorAll(){return []}
 scrollIntoView(){}
 dispatchEvent(e){this.handlers[e.type]?.(e)}
 addEventListener(name,handler){this.handlers[name]=handler}
 click(){}
}
const el=id=>{if(!elements.has(id))elements.set(id,new Node(id));return elements.get(id)};
class File {
 constructor(parts,name,opt){this.name=name;this.size=parts.reduce((n,b)=>n+(b.size||b.length||0),0);this.type=opt?.type}
}
class DataTransfer {
 constructor(){this.files=[];this.items={add:f=>this.files.push(f)}}
}
const db={
 objectStoreNames:{contains:()=>true},
 createObjectStore(){},
 transaction(){const tx={oncomplete:null,onerror:null,onabort:null,
  objectStore:()=>({
   get:key=>trigger(tx,storage.get(key)),
   getAll:()=>trigger(tx,[...storage.values()]),
   put:item=>{storage.set(item.id,item);return trigger(tx,item.id)},
   delete:key=>{storage.delete(key);return trigger(tx,undefined)}
  })
 };return tx}
};
function trigger(tx,value){
 const request={result:value,onsuccess:null,onerror:null};
 queueMicrotask(()=>{request.onsuccess?.();tx.oncomplete?.()});
 return request;
}
const indexedDB={open(){
 const request={result:db,onsuccess:null,onerror:null,onblocked:null,onupgradeneeded:null};
 queueMicrotask(()=>{request.onupgradeneeded?.();request.onsuccess?.()});
 return request;
}};
const contracts=[],docs=[];
const ctx={
 document:{getElementById:el,createElement:()=>new Node()},
 indexedDB,DataTransfer,File,Event:class Event{constructor(type){this.type=type}},
 esc:String,Blob,URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},
 Date,Promise,Array,Map,Number,String,JSON,console,setTimeout,confirm:()=>true,
 rowById:id=>contracts.find(x=>x.id===id)||null,
 list:kind=>kind==='document'?docs:[],
 portfolioRows:()=>contracts.slice(),
 loadRecords:async()=>{},
 globalThis:{}
};
vm.createContext(ctx);
vm.runInContext(code,ctx);
const recovery=ctx.globalThis.LebrimeImportRecovery;
assert.ok(recovery);
(async()=>{
 const sha='a'.repeat(64),fingerprint='b'.repeat(64);
 const file={name:'segurado.pdf',size:80,type:'application/pdf'};
 assert.equal(await recovery.stageFile(file,sha,'c1'),false,'armazenamento local desligado por padrão');
 assert.equal((await recovery.all()).length,0,'nenhum PDF guardado sem consentimento');
 el('recoveryLocalConsent').checked=true;
 await recovery.stageFile(file,sha,'c1');
 assert.equal((await recovery.all()).length,1,'PDF guardado antes de consultar banco');
 el('newRenewalClient').value='c1';el('newRenewalPrevious').value='old';
 el('newRenewalInsurer').value='Azul';el('newRenewalNumber').value='2026-001';
 el('newRenewalStart').value='2026-10-01';el('newRenewalEnd').value='2027-10-01';
 await recovery.stage({fingerprint,sha,file,clientId:'c1',previousId:'old'});
 let items=await recovery.all();
 assert.equal(items.length,1,'rascunho convertido em tentativa sem duplicar arquivo');
 assert.equal(items[0].fields.newRenewalNumber,'2026-001');
 await recovery.failure(fingerprint,'Supabase indisponível',false);
 items=await recovery.all();
 assert.equal(items[0].state,'Aguardando gravação');
 assert.equal(await recovery.complete(fingerprint,'new','doc'),false,'sem confirmação não descartar');
 contracts.push({id:'new',kind:'proposal',data:{clientId:'c1',insurer:'Azul',
  number:'2026-001',start:'2026-10-01',end:'2027-10-01'}});
 assert.equal(await recovery.verify(items[0]),false,'contrato sem PDF não é conclusão');
 assert.equal((await recovery.all()).length,1);
 docs.push({id:'doc',data:{clientId:'c1',proposalId:'new',fileSha256:sha}});
 assert.equal(await recovery.verify(items[0]),true,'contrato e documento confirmados');
 assert.equal((await recovery.all()).length,0);
 await recovery.stage({fingerprint,sha,file,clientId:'c1',previousId:'old'});
 assert.equal(await recovery.complete(fingerprint,'new','doc'),true);
 assert.equal((await recovery.all()).length,0);
 console.log('PASS: continuação offline, PDF persistido, sem duplicar, confirmação dupla no backend');
})().catch(err=>{console.error(err);process.exitCode=1});
