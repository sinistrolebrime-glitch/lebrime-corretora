/* LEBRIME — acesso operacional v20.37.
 * O painel permanece oculto até uma autenticação validada pelo backend.
 * Uma entrada direta ou atualização desta página requer senha novamente;
 * somente a navegação IMEDIATA após login no portal usa o token já emitido.
 */
(()=>{
'use strict';
const API='https://paiezoesntmicnwcmemt.supabase.co/functions/v1/lebrime-api';
const KEY='lebrime_token_v1';
const HANDOFF='lebrime_operacional_handoff';
const form=document.getElementById('operationalLoginForm');
const wall=document.getElementById('operationalLogin');
const password=document.getElementById('operationalPassword');
const username=document.getElementById('operationalUsername');
const error=document.getElementById('operationalLoginError');
const button=document.getElementById('operationalLoginButton');
if(!form||!wall||!password||!username||!error||!button)return;

let authenticated=false;
const showLogin=(msg='')=>{
  authenticated=false;
  document.body.classList.remove('op-authenticated');
  document.dispatchEvent(new Event('lebrime-operacional-logout'));

  wall.hidden=false;
  wall.removeAttribute('aria-hidden');
  error.textContent=msg;
  password.value='';
  button.disabled=false;
};
const showPortal=()=>{
  authenticated=true;
  error.textContent='';
  wall.hidden=true;
  wall.setAttribute('aria-hidden','true');
  document.body.classList.add('op-authenticated');
  document.dispatchEvent(new Event('lebrime-operacional-authenticated'));

};
const request=async(action,body,token='')=>{
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),15000);
  try{
    const response=await fetch(API+'?action='+encodeURIComponent(action),{
      method:'POST',
      headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},
      body:JSON.stringify(body||{}),signal:controller.signal,
      cache:'no-store'
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(response.status===401?'Usuário, senha ou sessão inválidos.':String(data.error||'Não foi possível autenticar.'));
    return data;
  }finally{clearTimeout(timeout);}
};
const validate=async(token)=>{
  if(!token)return false;
  try{
    const session=await request('session',{},token);
    return session.role==='operacional';
  }catch{return false;}
};
form.addEventListener('submit',async(event)=>{
  event.preventDefault();
  if(authenticated)return;
  button.disabled=true;
  error.textContent='Validando acesso...';
  try{
    const response=await request('login',{
      username:username.value.trim(),password:password.value
    });
    if(response.role!=='operacional'||!response.token)
      throw new Error('Este acesso é exclusivo do perfil operacional. Utilize o portal principal para a gestão.');
    if(!await validate(response.token))throw new Error('Não foi possível validar a sessão operacional.');
    localStorage.setItem(KEY,response.token);
    showPortal();
  }catch(e){
    showLogin(String(e?.message||'Não foi possível entrar.'));
    password.focus();
  }finally{button.disabled=false;}
});
document.getElementById('logout')?.addEventListener('click',()=>{
  localStorage.removeItem(KEY);
  sessionStorage.removeItem(HANDOFF);
  showLogin('Sessão encerrada. Entre novamente.');
},true);

showLogin();
let handoff='';
try{handoff=sessionStorage.getItem(HANDOFF)||'';sessionStorage.removeItem(HANDOFF);}catch{}
if(handoff){
  const stamp=Number(handoff),fresh=Number.isFinite(stamp)&&stamp<=Date.now()&&Date.now()-stamp<30000;
  if(fresh){
    validate(localStorage.getItem(KEY)||'').then(valid=>{
      if(valid)showPortal();
      else showLogin('Confirme seu usuário e senha para acessar a área operacional.');
    });
  }
}
})();
