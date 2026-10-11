const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('operacional.html','utf8');
assert.match(html,/id="operationalLoginForm"/);
assert.match(html,/id="operationalPassword"[^>]*type="password"/);
assert.match(html,/body:not\(\.op-authenticated\) \.app\{display:none!important\}/);
assert.match(html,/operacional-auth\.js\?v=/);
assert.doesNotMatch(html,/\(async\(\)=>\{try\{const status=await api\('session'\)/);
const js=fs.readFileSync('operacional-auth.js','utf8');
const bridge=fs.readFileSync('role-bridge.js','utf8');
assert.match(bridge,/sessionStorage\.setItem\('lebrime_operacional_handoff'/);
function makeStorage(initial={}){
 const map=new Map(Object.entries(initial));
 return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)};
}
function elem(){
 return {hidden:false,textContent:'',value:'',disabled:false,listeners:{},
  setAttribute(){},removeAttribute(){},focus(){},
  addEventListener(event,fn){this.listeners[event]=fn}};
}
function build({cache={},handoff='',loginRole='operacional',reject=false}={}){
 const classes=new Set();
 const elements=Object.fromEntries(['operationalLoginForm','operationalLogin','operationalPassword',
  'operationalUsername','operationalLoginError','operationalLoginButton','logout'].map(id=>[id,elem()]));
 elements.operationalUsername.value='lebrime';
 const storage=makeStorage(cache),sessions=makeStorage(handoff?{'lebrime_operacional_handoff':handoff}:{});
 const calls=[];
 const context={
  document:{dispatchEvent:()=>{},body:{classList:{add:s=>classes.add(s),remove:s=>classes.delete(s),contains:s=>classes.has(s)}},
   getElementById:id=>elements[id]||null},
  localStorage:storage,sessionStorage:sessions,
  fetch:async(url,opts)=>{
   calls.push({url,body:opts.body,authorization:opts.headers?.authorization});
   const action=new URL(url).searchParams.get('action');
   const ok=action==='login'?(!reject&&JSON.parse(opts.body).password==='correct'):!reject;
   return {ok,status:ok?200:401,json:async()=>ok?action==='login'?
    {token:'valid.session',role:loginRole}:{role:loginRole}:{error:'Usuário inválido'}};
  },
  AbortController,setTimeout,clearTimeout,Date,Number,Error,String,JSON,URL,Promise,console,Event:class Event{constructor(type){this.type=type}}
 };
 vm.runInNewContext(js,context);
 return {classes,elements,storage,sessions,calls};
}
(async()=>{
 const direct=build({cache:{lebrime_token_v1:'old.valid.token'}});
 assert.equal(direct.classes.has('op-authenticated'),false,'entrada direta deve pedir login mesmo com sessão armazenada');
 assert.equal(direct.elements.operationalLogin.hidden,false);
 assert.equal(direct.calls.length,0);
 const denied=build({reject:true});
 denied.elements.operationalPassword.value='wrong';
 await denied.elements.operationalLoginForm.listeners.submit({preventDefault(){}});
 assert.equal(denied.classes.has('op-authenticated'),false);
 assert.match(denied.elements.operationalLoginError.textContent,/inválidos/i);
 const success=build();
 success.elements.operationalPassword.value='correct';
 await success.elements.operationalLoginForm.listeners.submit({preventDefault(){}});
 assert.equal(success.classes.has('op-authenticated'),true);
 assert.equal(success.elements.operationalLogin.hidden,true);
 assert.equal(success.storage.getItem('lebrime_token_v1'),'valid.session');
 assert.equal(success.calls.length,2,'login e validação backend devem ocorrer antes de liberar');
 success.elements.logout.listeners.click();
 assert.equal(success.classes.has('op-authenticated'),false);
 assert.equal(success.storage.getItem('lebrime_token_v1'),null);
 const wrongRole=build({loginRole:'gestor'});
 wrongRole.elements.operationalPassword.value='correct';
 await wrongRole.elements.operationalLoginForm.listeners.submit({preventDefault(){}});
 assert.equal(wrongRole.classes.has('op-authenticated'),false);
 assert.match(wrongRole.elements.operationalLoginError.textContent,/exclusivo/i);
 const passed=build({cache:{lebrime_token_v1:'valid.session'},handoff:String(Date.now())});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(passed.classes.has('op-authenticated'),true,'login vindo do portal deve permitir passagem imediata');
 assert.equal(passed.sessions.getItem('lebrime_operacional_handoff'),null,'handoff pode ser usado apenas uma vez');
 const expired=build({cache:{lebrime_token_v1:'valid.session'},handoff:String(Date.now()-40000)});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(expired.classes.has('op-authenticated'),false,'handoff antigo não pode dispensar senha');
 console.log('PASS: autenticação operacional obrigatória, sessão validada, perfis, logout e passagem única');
})().catch(e=>{console.error(e);process.exitCode=1});
