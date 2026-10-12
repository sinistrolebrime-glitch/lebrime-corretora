/* LEBRIME v20.50: contingência de importações.
 * IndexedDB guarda temporariamente o PDF + dados conferidos NO DISPOSITIVO.
 * Nunca equivale à gravação no Supabase. Retomada exige validação explícita.
 * A aplicação NUNCA reenvia automaticamente uma operação incerta.
 */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const root=$('renewalNewFlow');
if(!root)return;
const DB='lebrime-import-recovery-v1',STORE='queue';
const LIMIT=50,MAX_BYTES=15*1024*1024;
const KEY_FIELDS=['newRenewalClient','newRenewalPrevious','newRenewalBrokerage',
  'newRenewalInsurer','newRenewalBranch','newRenewalNumber','newRenewalStart',
  'newRenewalEnd','newRenewalPremium','newRenewalInsuredValue',
  'newRenewalCount','newRenewalPayment'];
const html=s=>esc(String(s??''));
let opened=null;
function database(){
 if(typeof indexedDB==='undefined')return Promise.reject(new Error('Armazenamento local indisponível neste navegador'));
 if(!opened)opened=new Promise((resolve,reject)=>{
  const request=indexedDB.open(DB,1);
  request.onupgradeneeded=()=>{
   const db=request.result;
   if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'id'});
  };
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error||new Error('IndexedDB indisponível'));
  request.onblocked=()=>reject(new Error('Banco local bloqueado por outra aba'));
 }).catch(e=>{opened=null;throw e});
 return opened;
}
async function operation(mode,action){
 const db=await database();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,mode),store=tx.objectStore(STORE);
  let answer;
  try{
   const req=action(store);
   req.onsuccess=()=>{answer=req.result};
   req.onerror=()=>reject(req.error||new Error('Falha ao salvar checkpoint'));
  }catch(e){reject(e);return}
  tx.oncomplete=()=>resolve(answer);
  tx.onerror=()=>reject(tx.error||new Error('Falha no checkpoint'));
  tx.onabort=()=>reject(tx.error||new Error('Checkpoint cancelado'));
 });
}
const get=id=>operation('readonly',s=>s.get(id));
const all=()=>operation('readonly',s=>s.getAll());
const put=item=>operation('readwrite',s=>s.put(item));
const remove=id=>operation('readwrite',s=>s.delete(id));
const fingerprintId=hash=>'contract:'+hash;
const draftId=hash=>'pdf:'+hash;
function fields(){
 const values={};
 for(const id of KEY_FIELDS)values[id]=String($(id)?.value||'');
 return values;
}
const panel=document.createElement('section');
panel.id='importRecoveryPanel';
panel.className='renewal-queue-area';
panel.innerHTML='<div class="queue-header"><div><h3>Continuidade e recuperação de PDFs</h3>'+
 '<p class="muted">Se o sistema ficar indisponível, os arquivos selecionados e os dados revisados ficam aguardando neste navegador. Nenhum item desta fila é um contrato cadastrado.</p></div>'+
 '<div class="queue-metrics" id="recoveryMetrics">Verificando checkpoints…</div></div>'+
 '<p id="recoveryNotice" class="muted" role="status" aria-live="polite">Os PDFs locais ficam neste dispositivo, não no banco. Mantenha também cópia na pasta privada do Drive. Só retome em dispositivo autorizado.</p>'+
 '<div class="queue-pick"><button class="btn ghost" type="button" id="recoveryRefresh">Atualizar fila</button>'+
 '<button class="btn ghost" type="button" id="recoveryExport">Exportar checkpoint (sem PDF)</button></div>'+
 '<div class="queue-list-wrap"><table><thead><tr><th>PDF / proposta</th><th>Etapa</th><th>Próxima ação</th></tr></thead>'+
 '<tbody id="recoveryRows"><tr><td colspan="3">Verificando…</td></tr></tbody></table></div>';
root.insertAdjacentElement('beforebegin',panel);
function notice(message){$('recoveryNotice').textContent=message}
async function stageFile(file,sha,clientId=''){
 if(!sha||!file||file.size>MAX_BYTES)throw new Error('PDF inválido para a fila local');
 const current=await all();
 if(!current.some(x=>x.id===draftId(sha))&&current.length>=LIMIT)
  throw new Error('Fila local cheia; conclua ou exporte seus checkpoints');
 const item={id:draftId(sha),sha,clientId,file,name:file.name,
  state:'Aguardando conferência',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
 await put(item);await render();
 return item.id;
}
async function stage({fingerprint,sha,file,clientId,previousId}){
 if(!/^[a-f0-9]{64}$/i.test(fingerprint)||!file||!sha)throw new Error('Dados do checkpoint incompletos');
 const id=fingerprintId(fingerprint),prior=await get(id);
 const current=await all();
 if(!prior&&!current.some(x=>x.id===draftId(sha))&&current.length>=LIMIT)
  throw new Error('Fila local cheia; conclua ou exporte seus checkpoints');
 const entry={id,fingerprint,sha,file,name:file.name,clientId,previousId,
  fields:fields(),state:'Aguardando gravação',createdAt:prior?.createdAt||new Date().toISOString(),
  updatedAt:new Date().toISOString(),reason:''};
 await put(entry);
 await remove(draftId(sha)).catch(()=>{});
 await render();
 return id;
}
async function failure(fingerprint,message,mayHaveCommitted=false){
 if(!fingerprint)return;
 const id=fingerprintId(fingerprint),entry=await get(id);
 if(!entry)return;
 entry.state=mayHaveCommitted?'Gravação incerta — verificar':'Aguardando gravação';
 entry.reason=String(message||'Acesso temporariamente indisponível').slice(0,280);
 entry.updatedAt=new Date().toISOString();
 await put(entry);await render();
}
async function complete(fingerprint,proposalId,documentId){
 const id=fingerprintId(fingerprint),entry=await get(id);
 if(!entry)return false;
 const contract=rowById(proposalId);
 const documentRow=list('document').find(d=>d.id===documentId&&
  d.data?.proposalId===proposalId&&d.data?.clientId===entry.clientId);
 if(!contract||contract.kind!=='proposal'||contract.data?.clientId!==entry.clientId||!documentRow)
  return false;
 await remove(id);await render();return true;
}
async function verify(entry){
 if(!entry.fields)return false;
 await loadRecords();
 const d=entry.fields;
 const normalize=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
 const matches=portfolioRows().filter(r=>r.data.clientId===entry.clientId&&
  r.data.start===d.newRenewalStart&&r.data.end===d.newRenewalEnd&&
  normalize(r.data.number)===normalize(d.newRenewalNumber)&&
  normalize(r.data.insurer)===normalize(d.newRenewalInsurer));
 if(matches.length!==1)return false;
 const docs=list('document').filter(x=>x.data?.proposalId===matches[0].id&&x.data?.clientId===entry.clientId);
 if(!docs.some(x=>x.data?.fileSha256===entry.sha))return false;
 await remove(entry.id);await render();return true;
}
function restore(entry){
 const fileInput=$('newRenewalPdf');
 if(!fileInput||!entry.file||typeof DataTransfer==='undefined')throw new Error('Navegador não permite restaurar este arquivo');
 const source=entry.file;
 const f=typeof File!=='undefined'&&source instanceof File?source:
  new File([source],entry.name,{type:'application/pdf'});
 const transfer=new DataTransfer();transfer.items.add(f);fileInput.files=transfer.files;
 fileInput.dispatchEvent(new Event('change',{bubbles:true}));
 if(entry.fields){
  const v=entry.fields;
  $('newRenewalClient').value=v.newRenewalClient||'';
  $('newRenewalClient').dispatchEvent(new Event('change',{bubbles:true}));
  $('newRenewalPrevious').value=v.newRenewalPrevious||'';
  $('newRenewalPrevious').dispatchEvent(new Event('change',{bubbles:true}));
  for(const id of KEY_FIELDS)if(id!=='newRenewalClient'&&id!=='newRenewalPrevious'&&$(id))
   $(id).value=v[id]??'';
 }else if(entry.clientId){
  $('newRenewalClient').value=entry.clientId;
  $('newRenewalClient').dispatchEvent(new Event('change',{bubbles:true}));
 }
 root.scrollIntoView({behavior:'smooth',block:'start'});
 $('newRenewalStatus').textContent='Checkpoint restaurado. CONFIRA contrato anterior, produtor, prêmio, vigência e PDF. Antes de gravar, verifique duplicidade no servidor.';
}
async function render(){
 try{
  const rows=(await all()).sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt)));
  $('recoveryMetrics').textContent=rows.length+' item(ns) aguardando retomada local';
  $('recoveryRows').innerHTML=rows.length?rows.map((x,i)=>'<tr>'+
   '<td><strong>'+html(x.name)+'</strong><small>'+html(x.fields?.newRenewalNumber||'PDF sem ficha revisada')+'</small></td>'+
   '<td>'+html(x.state)+(x.reason?'<small>'+html(x.reason)+'</small>':'')+'</td>'+
   '<td><button type="button" class="btn ghost small" data-recover="'+i+'">Abrir e conferir</button> '+
   (x.fields?'<button type="button" class="btn ghost small" data-verify="'+i+'">Verificar no sistema</button> ':'')+
   '<button type="button" class="btn ghost small" data-remove="'+i+'">Remover</button></td></tr>').join(''):
   '<tr><td colspan="3">Nenhum PDF aguardando gravação neste dispositivo.</td></tr>';
  for(const button of $('recoveryRows').querySelectorAll('[data-recover]')){
   button.onclick=()=>{try{restore(rows[Number(button.dataset.recover)])}catch(e){notice(String(e.message||e))}};
  }
  for(const button of $('recoveryRows').querySelectorAll('[data-verify]')){
   button.onclick=async()=>{
    const entry=rows[Number(button.dataset.verify)];button.disabled=true;
    try{const ok=await verify(entry);notice(ok?'Registro e PDF confirmados no sistema; checkpoint local removido.':'Ainda não foi possível confirmar simultaneamente a proposta e seu PDF. Nada foi duplicado.')}
    catch(e){notice('Consulta indisponível: '+String(e.message||e)+'. Checkpoint preservado.')}
    finally{button.disabled=false}
   };
  }
  for(const button of $('recoveryRows').querySelectorAll('[data-remove]')){
   button.onclick=async()=>{
    if(!confirm('Remover esta cópia local? O PDF não será apagado do Drive nem do sistema.'))return;
    await remove(rows[Number(button.dataset.remove)].id);await render();
   };
  }
 }catch(e){
  $('recoveryMetrics').textContent='Armazenamento indisponível';
  $('recoveryRows').innerHTML='<tr><td colspan="3">Checkpoint local indisponível neste navegador. Mantenha os PDFs no Drive e faça backup manual.</td></tr>';
  notice(String(e.message||e));
 }
}
$('recoveryRefresh').onclick=()=>render();
$('recoveryExport').onclick=async()=>{
 const rows=await all();
 const safe=rows.map(({file,...rest})=>rest);
 const url=URL.createObjectURL(new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),status:'CHECKPOINT_LOCAL_NAO_CADASTRADO',items:safe},null,2)],{type:'application/json'}));
 const a=document.createElement('a');a.href=url;a.download='lebrime-checkpoint-importacoes.json';a.click();
 setTimeout(()=>URL.revokeObjectURL(url),5000);
 notice('Checkpoint exportado SEM PDFs. Arquivo pode conter dados de clientes: guarde em local privado.');
};
render();
globalThis.LebrimeImportRecovery={stage,stageFile,failure,complete,verify,render,all};
})();