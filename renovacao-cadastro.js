/* LEBRIME — importacao de nova vigencia vinculada, sem sobrescrever o historico. */
(()=>{
'use strict';
const el=id=>document.getElementById(id);
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const contractsFor=id=>portfolioRows().filter(r=>String(r.data.clientId||'')===id)
 .sort((a,b)=>String(b.data.end||'').localeCompare(String(a.data.end||'')));
let locked=false;
function clientOptions(){
 const chosen=el('newRenewalClient').value;
 el('newRenewalClient').innerHTML='<option value="">Selecione</option>'+
  list('client').sort((a,b)=>String(a.data.name||'').localeCompare(String(b.data.name||''),'pt-BR'))
   .map(r=>'<option value="'+esc(r.id)+'">'+esc(r.data.name||'Cliente')+'</option>').join('');
 el('newRenewalClient').value=chosen;
}
function priorOptions(preferred=''){
 const rows=contractsFor(el('newRenewalClient').value);
 el('newRenewalPrevious').innerHTML='<option value="">Seguro novo — sem vigência anterior</option>'+
  rows.map(r=>'<option value="'+esc(r.id)+'">'+esc(r.data.number||'Sem número')+
  ' · '+esc(r.data.branch||'Seguro')+' · '+esc(r.data.end||'')+'</option>').join('');
 if(preferred&&rows.some(r=>r.id===preferred))el('newRenewalPrevious').value=preferred;
 priorChanged();
}
function priorChanged(){
 const prior=rowById(el('newRenewalPrevious').value);
 if(!prior)return;
 el('newRenewalInsurer').value=prior.data.insurer||'';
 el('newRenewalBranch').value=prior.data.branch||'';
 const brokerage=String(prior.data.brokerage||prior.data.brokerages||'').split('|')[0];
 el('newRenewalBrokerage').value=[...el('newRenewalBrokerage').options].some(o=>o.value===brokerage)?brokerage:'';
 el('newRenewalNumber').value='';
 el('newRenewalPremium').value='';
 el('newRenewalCount').value='0';
 el('newRenewalPdf').value='';
 if(/^\d{4}-\d{2}-\d{2}$/.test(prior.data.end||'')){
  const next=new Date(prior.data.end+'T12:00:00Z');next.setUTCDate(next.getUTCDate()+1);
  el('newRenewalStart').value=next.toISOString().slice(0,10);
  next.setUTCFullYear(next.getUTCFullYear()+1);next.setUTCDate(next.getUTCDate()-1);
  el('newRenewalEnd').value=next.toISOString().slice(0,10);
 }
 el('newRenewalStatus').textContent='As datas são sugestões. Confirme todas as informações no PDF antes de cadastrar.';
}
function toCents(value){
 const raw=String(value||'').trim().replace(/\s/g,'');
 const n=raw.includes(',')?Number(raw.replace(/\./g,'').replace(',','.')):Number(raw);
 return Number.isFinite(n)?Math.round(n*100):0;
}
function go(clientId,previousId=''){
 if(!rowById(clientId)||rowById(clientId).kind!=='client')return;
 navigate('imports');
 el('newRenewalClient').value=clientId;priorOptions(previousId);
 el('renewalNewFlow').scrollIntoView({behavior:'smooth',block:'start'});
}
el('newRenewalClient').onchange=()=>priorOptions();
el('newRenewalPrevious').onchange=priorChanged;
el('renewalNewForm').onsubmit=async e=>{
 e.preventDefault();if(locked)return;
 const clientId=el('newRenewalClient').value,client=rowById(clientId);
 const prior=rowById(el('newRenewalPrevious').value);
 const insurer=el('newRenewalInsurer').value.trim(),branch=el('newRenewalBranch').value.trim();
 const number=el('newRenewalNumber').value.trim(),start=el('newRenewalStart').value,end=el('newRenewalEnd').value;
 const premium=toCents(el('newRenewalPremium').value),count=Number(el('newRenewalCount').value||0);
 const brokerage=el('newRenewalBrokerage').value,method=el('newRenewalPayment').value.trim();
 const file=el('newRenewalPdf').files?.[0],setMessage=message=>el('newRenewalStatus').textContent=message;
 const validDate=d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(Date.parse(d+'T12:00:00Z'))&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;
 if(!client||client.kind!=='client')return setMessage('Selecione um cliente existente.');
 if(prior&&(prior.data.clientId!==clientId||!['proposal','policy'].includes(prior.kind)))return setMessage('O seguro anterior não pertence a este cliente.');
 if(!insurer||!branch||!number||!brokerage)return setMessage('Informe seguradora, ramo, número e corretora.');
 if(!validDate(start)||!validDate(end)||start>end)return setMessage('As datas de início e fim precisam ser válidas.');
 if(!Number.isSafeInteger(premium)||premium<=0)return setMessage('Informe o prêmio total conforme o PDF.');
 if(!Number.isInteger(count)||count<0||count>72)return setMessage('Quantidade de parcelas inválida.');
 if(!file||!/\.pdf$/i.test(file.name)||file.size<10||file.size>15*1024*1024)return setMessage('Selecione um PDF válido de até 15 MB.');
 // Conferir assinatura PDF, não apenas extensão ou MIME, antes de armazenar.
 let pdfSignature='';
 try{
  const bytes=new Uint8Array(await file.slice(0,5).arrayBuffer());
  pdfSignature=String.fromCharCode(...bytes);
 }catch{return setMessage('Não foi possível ler o início do arquivo PDF.');}
 if(pdfSignature!=='%PDF-')return setMessage('O arquivo selecionado não possui assinatura PDF válida.');

 // Snapshot recente: verificar novamente antes da operação, inclusive imports de outra sessão.
 const duplicate=portfolioRows().some(r=>r.data.clientId===clientId&&norm(r.data.insurer)===norm(insurer)&&
  norm(r.data.number)===norm(number)&&r.data.start===start&&r.data.end===end);
 if(duplicate)return setMessage('Já existe proposta/apólice com o mesmo número e vigência nesse cliente. Não foi duplicada.');
 const proposalId=uuid(),documentId=uuid(),stamp=now(),docType='Proposta';
 const key='clients/'+clientId+'/'+stamp.slice(0,4)+'/'+stamp.slice(5,7)+'/'+documentId+'-'+file.name.replace(/[^a-zA-Z0-9._-]/g,'-');
 locked=true;el('newRenewalSubmit').disabled=true;
 let uploaded=false,committed=false;
 try{
  setMessage('Enviando PDF e criando uma nova vigência para este cliente...');
  // Nunca confiar apenas na cópia em memória se outra pessoa acabou de importar a mesma proposta.
  await loadRecords();
  const newlyImported=portfolioRows().some(r=>r.data.clientId===clientId&&norm(r.data.insurer)===norm(insurer)&&
   norm(r.data.number)===norm(number)&&r.data.start===start&&r.data.end===end);
  if(newlyImported)throw new Error('Outra sessão já cadastrou esta proposta. Nenhum novo PDF foi gravado.');
  await api('storage-put',file,{raw:true,key,headers:{'content-type':'application/pdf'}});
  uploaded=true;
  const proposal={clientId,number,insurer,branch,start,end,premium,brokerage,brokerages:brokerage,
   status:'Importada — verificar emissão',source:'Importação manual de renovação',renewalOf:prior?.id||'',
   renewalType:prior?'Renovação':'Seguro novo',producerPending:true,
   producerAssignmentStatus:'Pendente — conferir relatório',commissionPending:true,
   insuredValuePending:true,insuranceQualityStatus:'A conferir — verificar PDF',
   installmentCount:count,installmentExtractionStatus:'Pendente',paymentMethod:method,
   paymentDueText:'Conferir vencimentos no PDF'};
  const documentData={clientId,proposalId,policyId:'',contractId:proposalId,name:file.name,originalFileName:file.name,
   documentType:docType,referenceDate:start,storageKey:key,status:'Recebido',mimeType:'application/pdf',
   fileSize:file.size,source:'Importação manual da proposta'};
  await api('write',{ops:[
   {type:'insert',id:proposalId,kind:'proposal',data:proposal,version:1,created_at:stamp,updated_at:stamp},
   {type:'insert',id:documentId,kind:'document',data:documentData,version:1,created_at:stamp,updated_at:stamp}
  ]});
  committed=true;
  setMessage('PDF e proposta vinculados. Conferindo as parcelas...');
  let finance='Parcelamento pendente de conferência, sem cobrança automática.';
  try{
   const output=await api('payments-extract',{documentId,apply:true});
   if(output.applied)finance=output.status==='partial'?'Valores conciliados; vencimentos em revisão.':'Parcelamento conciliado e sincronizado.';
   else finance='Parcelamento em revisão: '+String(output.reason||'cronograma incompleto');
  }catch(err){finance='Parcelamento em revisão: '+String(err.message||err);}
  await loadRecords();clientOptions();
  setMessage('Nova vigência criada no cliente existente. '+finance+' Produtor e comissão pendentes de fonte confirmada.');
  const button=document.createElement('button');button.type='button';button.className='btn ghost small';
  button.textContent='Abrir ficha atualizada do cliente';
  button.onclick=()=>openClientDetail(clientId);
  el('newRenewalStatus').append(' ',button);
 }catch(err){
  if(uploaded&&!committed)try{await api('storage-delete',{}, {key})}catch(cleanupError){
   console.warn('Arquivo não vinculado exige limpeza pela gestão:',documentId,cleanupError);
  }
  setMessage((committed?'Contrato cadastrado, mas a conferência falhou: ':'Falha na importação (nenhum contrato antigo alterado): ')+String(err.message||err));
 }finally{locked=false;el('newRenewalSubmit').disabled=false;}
};
const originalNavigate=navigate;
navigate=function(view){originalNavigate(view);if(view==='imports')clientOptions();};
const previousClientDetail=openClientDetail;
openClientDetail=function(clientId){
 previousClientDetail(clientId);
 const area=el('clientDetailBody'),anchor=area?.querySelector('.client-kpis');
 if(!anchor||!rowById(clientId))return;
 const button=document.createElement('button');button.type='button';button.className='btn primary small';
 button.textContent='Importar renovação neste cliente';
 button.onclick=()=>{
  const previous=contractsFor(clientId)[0];
  if(el('clientDialog').open)el('clientDialog').close();
  go(clientId,previous?.id||'');
 };
 anchor.parentElement.insertBefore(button,anchor);
};
globalThis.LebrimeRenewalImport={go};
})();
