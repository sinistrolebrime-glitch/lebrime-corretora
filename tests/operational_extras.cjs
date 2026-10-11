const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('operacional-extras.js','utf8');
const html=fs.readFileSync('operacional.html','utf8');
assert.match(html,/id="detailDocuments"/);
assert.match(html,/id="operationalPdfFrame"/);
assert.match(html,/operacional-extras\.js\?v=/);
assert.ok(html.indexOf('operacional-auth.js')<html.indexOf('operacional-extras.js'));
class Element{
 constructor(id=''){this.id=id;this.value='';this.hidden=false;this.open=false;
  this.listeners={};this.children=[];this.style={};this.dataset={};this.textContent='';this.innerHTML='';
  this.attributes={};this.parentElement={appendChild:()=>{}};}
 addEventListener(e,fn){this.listeners[e]=fn}
 setAttribute(k,v){this.attributes[k]=v}
 removeAttribute(k){delete this.attributes[k]}
 remove(){this.hidden=true}
 removeAttributeNS(){}
 querySelectorAll(){return []}
 contains(){return false}
 showModal(){this.open=true}
 close(){this.open=false;if(this.listeners.close)this.listeners.close()}
}
const elements=new Map();
const el=id=>{if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id)};
const storage={getItem:()=> 'test-token',setItem(){}};
const calls=[];
let authenticated=true;
const fakeIndex={
 clients:[{id:'client-alpha',name:'Ana Barbosa',document:'12345678900'},
 {id:'client-beta',name:'Carlos Pereira',document:'00998877665'}],
 contracts:[{id:'ins-alpha',clientId:'client-alpha',kind:'proposal',number:'ABC123',
 insurer:'Porto',branch:'Auto',plate:'RSL2D91',start:'2026-01-01',end:'2027-01-01',status:'Ativo'}],
 items:[{contractId:'ins-alpha',plate:'RSL2D91',name:'Fiat',chassi:'ABC987'}]
};
const fakeClient={
 client:{id:'client-alpha',name:'Ana Barbosa',document:'12345678900',phone:'85990000000'},
 contracts:fakeIndex.contracts,
 documents:[{id:'document-alpha',contractId:'ins-alpha',type:'Proposta',
  name:'proposta.pdf',driveFileId:'1Ak5w7JkN0otiAlEId8c7jlVXSk8LtuCa',stored:false}]
};
const dListeners={};
const document={
 body:{classList:{contains:x=>x==='op-authenticated'&&authenticated}},
 getElementById:el,
 createElement:id=>new Element(id),
 querySelector:s=>{
  if(s==='#searchForm button[type="submit"]')return el('submit');
  if(s.startsWith('#'))return el(s.slice(1));
  return null;
 },
 addEventListener:(n,fn)=>{dListeners[n]=fn},
 activeElement:null
};
el('detail').open=false;
let root={
 document,localStorage:storage,URL:{createObjectURL:()=> 'blob:pdf',revokeObjectURL(){}},
 setTimeout,clearTimeout,console,AbortController,Promise,Map,Set,
 fetch:async(url,request)=>{
  const action=new URL(url).searchParams.get('action');calls.push(action);
  return {ok:true,status:200,json:async()=>action==='index'?fakeIndex:fakeClient};
 },
 clientMap:new Map(),
 TOKEN_KEY:'lebrime_token_v1',
 esc:s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
 normDate:s=>s||'—',cleanStatus:c=>c.status||'Ativo',
 exit:()=>{},updateRows:rows=>root.lastRows=rows,
 openDetail:()=>{},search:()=>{},
 $:selector=>el(selector.slice(1))
};
const ctx=vm.createContext(root);
vm.runInContext(source,ctx);
const spin=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
 await spin();await spin();
 assert.ok(calls.includes('index'),'indice só pode ser carregado depois do login');
 const input=el('name');
 input.value='a';
 document.activeElement=input;
 input.listeners.input();
 assert.match(el('suggest-name').innerHTML,/Ana Barbosa/,'primeira letra deve apresentar sugestões');
 assert.equal(input.attributes['aria-expanded'],'true');
 input.value='ana';
 input.listeners.input();
 assert.match(el('suggest-name').innerHTML,/Ana Barbosa/);
 input.value='xxyyzz';
 input.listeners.input();
 assert.match(el('suggest-name').innerHTML,/Nenhuma correspondência/);
 input.value='a';
 el('cpf').value='';el('cnpj').value='';el('plate').value='';
 await vm.runInContext('search()',ctx);
 assert.ok(root.lastRows.some(r=>r.clientId==='client-alpha'),'busca por uma letra deve mostrar resultados');
 await vm.runInContext("openDetail({clientId:'client-alpha'})",ctx);
 assert.match(el('detailDocuments').innerHTML,/proposta\.pdf/);
 assert.equal(el('detailPdf').hidden,false);
 assert.match(el('operationalPdfFrame').src,/drive\.google\.com\/file\/d\/1Ak5w7JkN0otiAlEId8c7jlVXSk8LtuCa\/preview/);
 assert.match(el('operationalPdfExternal').href,/\/view$/);
 assert.doesNotMatch(el('detailDocuments').innerHTML,/comissão|produtor/i);
 authenticated=false;
 dListeners['lebrime-operacional-logout']();
 assert.equal(el('detailPdf').hidden,true);
 assert.equal(el('detail').open,false);
 console.log('PASS: sugestões com uma letra, busca local, ficha com PDF embutido, acesso sem comissões e logout');
})().catch(e=>{console.error(e);process.exitCode=1});
