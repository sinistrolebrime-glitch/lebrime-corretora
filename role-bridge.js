// Redirecionamento por perfil sem expor senhas no codigo publico.
(()=>{
 const api='https://paiezoesntmicnwcmemt.supabase.co/functions/v1/lebrime-api';
 const key='lebrime_token_v1';
 const form=document.getElementById('loginForm');
 const token=localStorage.getItem(key)||'';
 const roleFromToken=t=>{
   try { const part=t.split('.')[0].replace(/-/g,'+').replace(/_/g,'/');const payload=JSON.parse(atob(part));return payload.sub==='lebrime-portal-v2'&&payload.exp>Date.now()/1000?payload.role:null; }
   catch{return null;}
 };
 if(roleFromToken(token)==='operacional'){location.replace('operacional.html');return;}
 const pass=document.getElementById('loginPassword');
 if(!form||!pass)return;
 const user=document.createElement('input');user.id='loginUsername';user.name='username';user.value='lebrime';user.autocomplete='username';user.required=true;
 const label=document.createElement('label');label.htmlFor='loginUsername';label.textContent='Usuario';
 form.insertBefore(user,pass.previousElementSibling||pass);
 form.insertBefore(label,user);
 const passLabel=pass.previousElementSibling; if(passLabel&&passLabel!==label&&passLabel.tagName==='LABEL')passLabel.textContent='Senha';
 form.addEventListener('submit',async event=>{
   event.preventDefault();event.stopImmediatePropagation();
   const button=form.querySelector('button[type="submit"]');const error=document.getElementById('loginError');
   if(button)button.disabled=true;if(error)error.textContent='';
   try {
     const response=await fetch(api+'?action=login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:user.value.trim(),password:pass.value})});
     const data=await response.json();
     if(!response.ok||!data.token)throw new Error(data.error||'Nao foi possivel entrar.');
     localStorage.setItem(key,data.token);
     pass.value='';
     if(data.role==='operacional'){location.replace('operacional.html');return;}
     if(data.role!=='gestor')throw new Error('Perfil de acesso nao reconhecido.');
     await boot();
   }catch(e){if(error)error.textContent=e.message||'Falha ao autenticar.';}
   finally{if(button)button.disabled=false;}
 },true);
})();
