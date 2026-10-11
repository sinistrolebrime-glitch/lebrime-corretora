/* LEBRIME v20.38: consulta fluida de segurados e PDFs associados ao contrato.
   Apenas dados operacionais; requer sessão validada no servidor. */
(()=>{
'use strict';
const API='https://paiezoesntmicnwcmemt.supabase.co/functions/v1/lebrime-operational-portal';
const fields=['name','cpf','cnpj','plate'];
const detail=document.getElementById('detail');
const pdfArea=document.getElementById('detailPdf');
const iframe=document.getElementById('operationalPdfFrame');
const pdfInfo=document.getElementById('operationalPdfInfo');
const pdfExternal=document.getElementById('operationalPdfExternal');
let fileUrl='',pendingFile=0;
let cache=null,loading=null,suggestions=[],focused=null,activeIndex=-1;
const matchText=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const clean=v=>esc(String(v??''));
async function operationalPortal(action,body={},blob=false){
 const t=localStorage.getItem(TOKEN_KEY);
 if(!t||!document.body.classList.contains('op-authenticated'))throw new Error('Faça login antes de consultar a carteira.');
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),20000);
 try{
  const response=await fetch(API+'?action='+encodeURIComponent(action),{
   method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+t},
   body:JSON.stringify(body),signal:controller.signal,cache:'no-store'
  });
  if(response.status===401){exit();throw new Error('Sessão expirada. Entre novamente.');}
  if(!response.ok){
   const data=await response.json().catch(()=>({}));
   throw new Error(data.error||'Não foi possível consultar o arquivo.');
  }
  return blob?response.blob():response.json();
 }finally{clearTimeout(timer);}
}
function loadIndex(){
 if(cache)return Promise.resolve(cache);
 if(!loading)loading=operationalPortal('index').then(data=>{
  const clients=Array.isArray(data.clients)?data.clients:[];
  const contracts=Array.isArray(data.contracts)?data.contracts:[];
  const items=Array.isArray(data.items)?data.items:[];
  const byClient=new Map(clients.map(c=>[c.id,c]));
  const byContract=new Map(contracts.map(c=>[c.id,c]));
  const plateByContract=new Map();
  for(const x of items){
   if(!plateByContract.has(x.contractId))plateByContract.set(x.contractId,[]);
   plateByContract.get(x.contractId).push([x.plate,x.name,x.chassi].join(' '));
  }
  cache={clients,contracts,byClient,byContract,plateByContract};
  return cache;
 }).finally(()=>{loading=null;});
 return loading;
}
function resultsFor(input){
 if(!cache)return [];
 const needle=matchText(input);
 if(!needle)return [];
 const result=[];
 for(const c of cache.clients){
  const name=matchText(c.name),document=matchText(c.document);
  if(name.includes(needle)||document.includes(needle)){
   const rank=name.startsWith(needle)?0:document.startsWith(needle)?1:2;
   result.push({rank,type:'client',clientId:c.id,label:c.name||'Cliente',hint:c.document||'Cadastro',value:c.name||''});
  }
 }
 for(const c of cache.contracts){
  const holder=cache.byClient.get(c.clientId);
  const terms=[c.number,c.insurer,c.plate,cache.plateByContract.get(c.id)?.join(' ')||''];
  if(terms.some(x=>matchText(x).includes(needle))){
   const exact=matchText(c.number).startsWith(needle)||matchText(c.plate).startsWith(needle);
   result.push({rank:exact?1:3,type:'contract',clientId:c.clientId,contract:c,
    label:holder?.name||'Segurado',hint:[c.number,c.plate,c.insurer].filter(Boolean).join(' · '),value:c.number||c.plate||''});
  }
 }
 return result.sort((a,b)=>a.rank-b.rank||a.label.localeCompare(b.label,'pt-BR')).slice(0,9);
}
function closeSuggestions(){
 for(const id of fields){
  const input=document.getElementById(id);
  const popup=document.getElementById('suggest-'+id);
  if(popup)popup.hidden=true;
  if(input)input.setAttribute('aria-expanded','false');
 }
 focused=null;activeIndex=-1;suggestions=[];
}
function renderSuggestions(input){
 const popup=document.getElementById('suggest-'+input.id);
 if(!popup)return;
 focused=input;
 const raw=input.value.trim();
 if(!raw){closeSuggestions();return;}
 if(!cache){
  popup.hidden=false;popup.innerHTML='<div class="suggest-note">Localizando clientes...</div>';
  return;
 }
 suggestions=resultsFor(raw);activeIndex=-1;
 popup.hidden=false;input.setAttribute('aria-expanded','true');
 popup.innerHTML=suggestions.length?suggestions.map((item,i)=>
  '<button type="button" role="option" class="suggest-option" id="sug-'+input.id+'-'+i+'" data-choice="'+i+'" aria-selected="false">'+
    '<strong>'+clean(item.label)+'</strong><small>'+clean(item.type==='client'?'Cliente · '+item.hint:'Contrato · '+item.hint)+'</small></button>'
 ).join(''):'<div class="suggest-note">Nenhuma correspondência encontrada</div>';
 popup.querySelectorAll('[data-choice]').forEach(b=>b.addEventListener('mousedown',e=>e.preventDefault()));
 popup.querySelectorAll('[data-choice]').forEach(b=>b.addEventListener('click',()=>choose(Number(b.dataset.choice))));
}
function choose(index){
 const item=suggestions[index];if(!item)return;
 const input=focused;if(input)input.value=item.value||item.label;
 closeSuggestions();
 const client=cache?.byClient.get(item.clientId);
 if(client)clientMap.set(item.clientId,client);
 const contract=item.contract||cache?.contracts.find(c=>c.clientId===item.clientId);
 openDetail(contract||{clientId:item.clientId,number:'',branch:'Cadastro de cliente'});
}
function resetPdf(){
 pendingFile++;
 if(fileUrl){URL.revokeObjectURL(fileUrl);fileUrl='';}
 if(iframe){iframe.removeAttribute('src');iframe.title='PDF da proposta ou apólice';}
 if(pdfArea)pdfArea.hidden=true;
 if(pdfExternal){pdfExternal.hidden=true;pdfExternal.removeAttribute('href');}
 if(pdfInfo)pdfInfo.textContent='';
}
async function displayPdf(doc){
 resetPdf();
 if(!doc||!pdfArea||!iframe)return;
 pdfArea.hidden=false;
 const sequence=pendingFile;
 pdfInfo.textContent='Carregando '+(doc.name||'PDF')+'...';
 if(doc.driveFileId&&/^[a-zA-Z0-9_-]{15,150}$/.test(doc.driveFileId)){
  const id=encodeURIComponent(doc.driveFileId);
  iframe.src='https://drive.google.com/file/d/'+id+'/preview';
  iframe.title='Proposta ou apólice: '+String(doc.name||'PDF');
  pdfInfo.textContent='Visualização do '+(doc.type||'seguro')+' · '+(doc.name||'arquivo')+'. Se o Drive solicitar acesso, abra o arquivo em outra aba.';
  pdfExternal.href='https://drive.google.com/file/d/'+id+'/view';
  pdfExternal.hidden=false;
  return;
 }
 if(doc.stored){
  try{
   const response=await operationalPortal('file',{documentId:doc.id},true);
   if(sequence!==pendingFile)return;
   fileUrl=URL.createObjectURL(response);
   iframe.src=fileUrl;
   iframe.title='Proposta ou apólice: '+String(doc.name||'PDF');
   pdfExternal.href=fileUrl;
   pdfExternal.hidden=false;
   pdfInfo.textContent='PDF armazenado na Lebrime · '+(doc.name||'arquivo');
  }catch(e){
   if(sequence===pendingFile)pdfInfo.textContent='Não foi possível carregar o PDF: '+String(e.message||e);
  }
  return;
 }
 pdfInfo.textContent='O registro do documento existe, mas o PDF físico ainda está pendente de vinculação.';
}
function buildDocumentList(docs){
 return docs.map((doc,i)=>
  '<button type="button" class="doc-choice'+(i===0?' selected':'')+'" data-document-index="'+i+'">'+
   '<span class="pdf-symbol">PDF</span><span><strong>'+clean(doc.type||'Proposta / Apólice')+'</strong>'+
   '<small>'+clean(doc.name||'Arquivo do contrato')+'</small></span><span class="doc-action">Visualizar</span></button>'
 ).join('');
}
// Mantém a ficha existente e acrescenta documentos, sem abrir comissões.
openDetail=async function(row){
 if(!document.body.classList.contains('op-authenticated'))return;
 resetPdf();closeSuggestions();
 const id=String(row?.clientId||"");
 $('#detailName').textContent=clientMap.get(id)?.name||'Ficha do segurado';
 $('#detailInfo').innerHTML='';
 $('#detailContracts').innerHTML='<p class="hint">Buscando propostas, apólices e arquivos...</p>';
 $('#detailDocuments').innerHTML='';
 if(!detail.open)detail.showModal();
 if(!id){$('#detailContracts').textContent='Contrato sem vínculo com cliente.';return;}
 try{
  const info=await operationalPortal('client',{clientId:id});
  if(!detail.open)return;
  const c=info.client||{},contracts=info.contracts||[],docs=info.documents||[];
  clientMap.set(id,c);
  $('#detailName').textContent=c.name||'Segurado';
  $('#detailInfo').innerHTML=[
    ['CPF / CNPJ',c.document||'—'],['Telefone',c.phone||c.mobile||'—'],
    ['Contratos',contracts.length],['Propostas / Apólices em PDF',docs.length]
  ].map(([label,value])=>'<div><span>'+clean(label)+'</span><b>'+clean(value)+'</b></div>').join('');
  const sorted=contracts.slice().sort((a,b)=>String(b.end||'').localeCompare(String(a.end||'')));
  const perContract=new Map();
  for(const doc of docs){
   if(!perContract.has(doc.contractId))perContract.set(doc.contractId,[]);
   perContract.get(doc.contractId).push(doc);
  }
  $('#detailContracts').innerHTML='<h3>Propostas e apólices · histórico de vigências</h3>'+
   (sorted.length?sorted.map(contract=>{
    const list=perContract.get(contract.id)||[];
    return '<div class="contract-line"><div><b>'+clean(contract.insurer||'Seguradora')+' · '+
      clean(contract.number||'Sem número')+'</b><small>'+clean(contract.branch||'Seguro')+' · '+
      clean(normDate(contract.start))+' a '+clean(normDate(contract.end))+'</small>'+
      '<small>'+clean(list.length?list.length+' PDF(s) vinculado(s)':'PDF pendente de vinculação')+'</small></div>'+
      '<span class="status-line">'+clean(cleanStatus(contract))+'</span></div>';
   }).join(''):'<p class="hint">Nenhum contrato vinculado a esta ficha.</p>');
  $('#detailDocuments').innerHTML='<h3>Arquivos de propostas e apólices</h3>'+
   (docs.length?'<div class="doc-list">'+buildDocumentList(docs)+'</div>':
    '<p class="hint">Nenhuma proposta/apólice em PDF vinculada. Verifique os arquivos na gestão.</p>');
  $('#detailDocuments').querySelectorAll('[data-document-index]').forEach(b=>b.onclick=()=>{
   $('#detailDocuments').querySelectorAll('.doc-choice').forEach(x=>x.classList.remove('selected'));
   b.classList.add('selected');displayPdf(docs[Number(b.dataset.documentIndex)]);
  });
  if(docs.length)await displayPdf(docs[0]);
 }catch(e){
  $('#detailContracts').textContent='Não foi possível carregar a ficha: '+String(e.message||e);
 }
};
for(const id of fields){
 const input=document.getElementById(id);
 if(!input)return;
 const popup=document.createElement('div');
 popup.id='suggest-'+id;popup.className='operational-suggestions';popup.role='listbox';popup.hidden=true;
 input.parentElement.appendChild(popup);
 input.setAttribute('role','combobox');input.setAttribute('aria-expanded','false');
 input.setAttribute('aria-controls',popup.id);input.setAttribute('aria-autocomplete','list');
 input.addEventListener('input',()=>{
  closeSuggestions();
  if(!input.value.trim())return;
  renderSuggestions(input);
  if(!cache)loadIndex().then(()=>{if(focused===input||document.activeElement===input)renderSuggestions(input);}).catch(e=>{
   if(document.activeElement===input){popup.hidden=false;popup.textContent='Falha ao consultar sugestões. Tente novamente.';}
  });
 });
 input.addEventListener('focus',()=>{if(input.value.trim())renderSuggestions(input);});
 input.addEventListener('keydown',e=>{
  if(e.key==='Escape'){closeSuggestions();return;}
  if(!suggestions.length||popup.hidden)return;
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){
   e.preventDefault();activeIndex=e.key==='ArrowDown'?(activeIndex+1)%suggestions.length:
    (activeIndex+suggestions.length-1)%suggestions.length;
   popup.querySelectorAll('[data-choice]').forEach((b,i)=>{
    b.classList.toggle('active',i===activeIndex);b.setAttribute('aria-selected',String(i===activeIndex));
   });
  }else if(e.key==='Enter'&&activeIndex>=0){e.preventDefault();choose(activeIndex);}
 });
 input.addEventListener('blur',()=>setTimeout(()=>{if(!popup.contains(document.activeElement))closeSuggestions();},160));
}
document.addEventListener('click',e=>{
 if(!e.target.closest?.('.operational-suggestions')&&!fields.some(id=>e.target.id===id))closeSuggestions();
});
detail.addEventListener('close',resetPdf);
const oldClear=document.getElementById('clear').onclick;
document.getElementById('clear').onclick=function(){closeSuggestions();if(oldClear)oldClear.call(this);};
document.addEventListener('lebrime-operacional-authenticated',()=>{
 cache=null;loading=null;
 loadIndex().catch(()=>{ /* busca pode tentar novamente na primeira tecla */ });
});
if(document.body.classList.contains('op-authenticated'))loadIndex().catch(()=>{});
})();
