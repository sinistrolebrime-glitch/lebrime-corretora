/* LEBRIME — fila local de PDFs para importação assistida v20.43.
 * Nenhum arquivo é gravado automaticamente. A confirmação ocorre no formulário
 * validado de nova proposta, um contrato por vez.
 */
(()=>{
'use strict';
const $q=id=>document.getElementById(id);
const textFold=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const prettyBytes=n=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1}).format(n/1048576)+' MB';
const digest=async file=>{
 const raw=await file.arrayBuffer();
 return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',raw)))
  .map(v=>v.toString(16).padStart(2,'0')).join('');
};
function matchClient(fileName,clients){
 const normalized=textFold(fileName.replace(/\.pdf$/i,''));
 const possible=clients.filter(c=>{
  const doc=String(c.data?.document||'').replace(/\D/g,'');
  return [11,14].includes(doc.length)&&normalized.includes(doc);
 });
 if(possible.length===1)return {id:possible[0].id,label:possible[0].data.name,method:'CPF/CNPJ no nome'};
 const nameMatches=clients.filter(c=>{
  const name=textFold(c.data?.name||'');
  return name.length>=12&&normalized.includes(name);
 });
 if(nameMatches.length===1)return {id:nameMatches[0].id,label:nameMatches[0].data.name,method:'Nome completo no arquivo'};
 return null;
}
const holder=$q('renewalNewFlow');
if(!holder)return;
const panel=document.createElement('section');
panel.id='renewalBulkQueue';
panel.className='renewal-queue-area';
panel.innerHTML='<div class="queue-header"><div><h3>Fila de PDFs para renovação</h3>'+
 '<p class="muted">Selecione vários PDFs. O sistema valida os arquivos, identifica possíveis duplicatas e sugere o cliente quando o arquivo permite. Nada é cadastrado sem sua revisão.</p></div>'+
 '<div class="queue-metrics" id="bulkMetrics">Aguardando arquivos</div></div>'+
 '<div class="queue-pick"><label class="btn ghost" for="bulkPdfInput">Selecionar PDFs</label>'+
 '<input id="bulkPdfInput" type="file" accept=".pdf,application/pdf" multiple hidden>'+
 '<button type="button" class="btn ghost" id="bulkQueueClear">Limpar fila</button>'+
 '<button type="button" class="btn ghost" id="bulkQueueExport">Exportar acompanhamento</button></div>'+
 '<p id="bulkQueueStatus" class="muted" role="status" aria-live="polite">Selecione até 50 PDFs. A lista de recuperação conserva cópias neste dispositivo; os arquivos ainda não foram enviados ao Supabase.</p>'+
 '<div class="queue-list-wrap"><table><thead><tr><th>Arquivo</th><th>Possível cliente</th><th>Situação</th><th>Próxima ação</th></tr></thead>'+
 '<tbody id="bulkQueueRows"></tbody></table></div>';
holder.insertAdjacentElement('beforebegin',panel);
const maxFiles=50,maxBytes=15*1024*1024;
let queue=[],busy=false,selectedHash='';
const clients=()=>list('client');
const documents=()=>list('document');
const status=message=>$q('bulkQueueStatus').textContent=message;
const summary=()=>{
 const waiting=queue.filter(x=>x.state==='pending').length,
 done=queue.filter(x=>x.state==='imported').length,
 reviewed=queue.filter(x=>x.state==='review').length,
 invalid=queue.filter(x=>x.state==='invalid').length;
 $q('bulkMetrics').textContent='Na fila: '+queue.length+' · Pendentes: '+waiting+
 ' · Em revisão: '+reviewed+' · Importados: '+done+' · Ignorados: '+invalid;
};
const safeName=x=>esc(String(x??''));
function render(){
 summary();
 $q('bulkQueueRows').innerHTML=queue.length?queue.map((item,index)=>{
  const label={pending:'Pronto para revisar',review:'Em revisão',imported:'Importado',invalid:'Ignorado'}[item.state];
  const client=item.match?item.match.label+' · sugestão ('+item.match.method+')':'Não identificado · selecionar manualmente';
  return '<tr><td><strong>'+safeName(item.name)+'</strong><small>'+prettyBytes(item.size)+'</small></td>'+
    '<td>'+safeName(client)+'</td><td><span class="queue-stage queue-'+item.state+'">'+label+'</span></td>'+
    '<td>'+(item.state==='imported'?'Concluído':item.state==='invalid'?safeName(item.reason||'Arquivo inválido'):
    '<button type="button" class="btn ghost small" data-review-file="'+index+'">Revisar</button>')+'</td></tr>';
 }).join(''):'<tr><td colspan="4">Nenhum PDF selecionado.</td></tr>';
 $q('bulkQueueRows').querySelectorAll('[data-review-file]').forEach(b=>b.onclick=()=>selectItem(Number(b.dataset.reviewFile)));
}
async function addFiles(files){
 if(busy){status('Aguarde a validação dos arquivos anteriores.');return;}
 const incoming=[...files].slice(0,maxFiles);
 if(!incoming.length)return;
 busy=true;
 status('Validando '+incoming.length+' arquivo(s), sem enviar nenhum PDF...');
 try{
  for(const file of incoming){
   if(queue.length>=maxFiles)break;
   if(!/\.pdf$/i.test(file.name)||file.size<=5||file.size>maxBytes){
    queue.push({file,name:file.name,size:file.size,state:'invalid',reason:'PDF ausente ou tamanho inválido'});
    continue;
   }
   let sha='';
   try{
    const magic=String.fromCharCode(...new Uint8Array(await file.slice(0,5).arrayBuffer()));
    if(magic!=='%PDF-')throw new Error('Assinatura PDF inválida');
    sha=await digest(file);
   }catch(e){
    queue.push({file,name:file.name,size:file.size,state:'invalid',reason:String(e.message||'Arquivo ilegível')});
    continue;
   }
   const same=queue.find(x=>x.sha===sha);
   const existing=documents().find(d=>d.data?.fileSha256===sha);
   if(same||existing){
    queue.push({file,name:file.name,size:file.size,sha,state:'invalid',
      reason:same?'Repetido nesta seleção':'Este PDF já foi importado'});
    continue;
   }
   const match=matchClient(file.name,clients());
   queue.push({file,name:file.name,size:file.size,sha,match,state:'pending'});
   // A fila visível é temporária; os PDFs ficam duráveis no IndexedDB até a conferência.
   try{
    await globalThis.LebrimeImportRecovery?.stageFile(file,sha,match?.id||'');
   }catch(checkpointError){
    status('ATENÇÃO: cópia local não salva ('+String(checkpointError.message||checkpointError)+'). Mantenha o PDF original em lugar seguro.');
   }
   if(queue.length%5===0){render();await Promise.resolve();}
  }
  status('Arquivos conferidos. Revise cada item para confirmar cliente, vigência, seguradora, prêmio e parcelas antes de importar.');
 }finally{busy=false;render();}
}
function selectItem(index){
 const entry=queue[index];if(!entry||entry.state==='invalid'||entry.state==='imported')return;
 const form=$q('renewalNewForm'),fileInput=$q('newRenewalPdf');
 if(!form||!fileInput)return;
 const transfer=new DataTransfer();
 transfer.items.add(entry.file);
 fileInput.files=transfer.files;
 fileInput.dispatchEvent(new Event('change',{bubbles:true}));
 // Descarta a prévia anterior ao trocar o PDF na fila.
 // Sugerir cliente apenas quando nome/documento está inequívoco. Usuário confirma.
 if(entry.match){
  $q('newRenewalClient').value=entry.match.id;
  $q('newRenewalClient').dispatchEvent(new Event('change',{bubbles:true}));
 }
 entry.state='review';selectedHash=entry.sha;
 render();status('Arquivo selecionado. Confira manualmente todos os dados e clique em "Cadastrar nova vigência + PDF".');
 $q('renewalNewFlow').scrollIntoView({behavior:'smooth',block:'start'});
}
$q('bulkPdfInput').addEventListener('change',event=>{
 addFiles(event.target.files).catch(e=>status('Erro de leitura: '+String(e.message||e)));
 event.target.value='';
});
$q('bulkQueueClear').onclick=()=>{
 if(busy)return;
 if(queue.some(x=>x.state==='review')&&!confirm('Limpar a fila? A proposta que está em revisão ainda não foi importada.'))return;
 queue=[];selectedHash='';render();status('Fila limpa. Documentos já importados permanecem no sistema.');
};
$q('bulkQueueExport').onclick=()=>{
 if(!queue.length)return;
 const rows=[['Arquivo','SHA256','Cliente sugerido','Status','Comentário']]
  .concat(queue.map(x=>[x.name,x.sha||'',x.match?.label||'',x.state,x.reason||'']));
 const csv='\ufeff'+rows.map(fields=>fields.map(v=>'"'+String(v??'').replace(/^[=+@\-]/,'').replace(/"/g,'""')+'"').join(';')).join('\r\n');
 const object=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
 const link=document.createElement('a');link.href=object;link.download='lebrime-acompanhamento-importacao.csv';link.click();
 setTimeout(()=>URL.revokeObjectURL(object),5000);
};
document.addEventListener('lebrime-renewal-import-success',e=>{
 const sha=e.detail?.fileSha256;
 if(!sha)return;
 const current=queue.find(x=>x.sha===sha&&x.state==='review');
 if(current){current.state='imported';selectedHash='';render();}
});
render();
globalThis.LebrimeBulkQueue={matchClient,getCount:()=>queue.length,addFiles,selectItem};
})();