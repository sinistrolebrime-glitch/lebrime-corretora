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
 const producerSelect=el('newRenewalProducer');
 if(producerSelect){
  const selectedProducer=producerSelect.value;
  producerSelect.innerHTML='<option value="">Identificar no PDF ou relatório</option>'+
   list('producer').sort((a,b)=>String(a.data.name||'').localeCompare(String(b.data.name||''),'pt-BR'))
    .map(r=>'<option value="'+esc(r.id)+'">'+esc(r.data.name||'Produtor')+'</option>').join('');
  producerSelect.value=selectedProducer;
 }
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
 for(const id of ['newRenewalNetPremium','newRenewalIof','newRenewalFinanceCharges','newRenewalCommissionPercent','newRenewalProducer'])
  if(el(id))el(id).value='';
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
 const netText=String(el('newRenewalNetPremium')?.value||'').trim();
 const iofText=String(el('newRenewalIof')?.value||'').trim();
 const netPremium=netText?toCents(netText):null,iof=iofText?toCents(iofText):null;
  const chargeText=String(el('newRenewalFinanceCharges')?.value||'').trim();
  const financeCharges=chargeText?toCents(chargeText):null;
 const producerId=String(el('newRenewalProducer')?.value||'');
 const producer=producerId?list('producer').find(r=>r.id===producerId):null;
 const rateText=String(el('newRenewalCommissionPercent')?.value||'').trim();
 const commissionPercent=rateText?Number(rateText.replace(',','.')):null;
 const insuredValueText=el('newRenewalInsuredValue').value.trim();
 const insuredValue=insuredValueText?toCents(insuredValueText):0;
 const brokerage=el('newRenewalBrokerage').value,method=el('newRenewalPayment').value.trim();
 const file=el('newRenewalPdf').files?.[0],setMessage=message=>el('newRenewalStatus').textContent=message;
 const validDate=d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(Date.parse(d+'T12:00:00Z'))&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;
 if(!client||client.kind!=='client')return setMessage('Selecione um cliente existente.');
 // A conferência do documento permanece obrigatória mesmo que o gestor troque
 // o cliente depois de aplicar a prévia.
 const seenDocument=globalThis.LebrimeProposalPreview?.documentFor?.(file);
 if(seenDocument&&String(client.data?.document||'').replace(/\D/g,'')!==seenDocument)
  return setMessage('CPF/CNPJ da proposta diverge do cliente. Confirme o cliente correto antes de importar.');

 if(prior&&(prior.data.clientId!==clientId||!['proposal','policy'].includes(prior.kind)))return setMessage('O seguro anterior não pertence a este cliente.');
 if(!insurer||!branch||!number||!brokerage)return setMessage('Informe seguradora, ramo, número e corretora.');
 if(!validDate(start)||!validDate(end)||start>end)return setMessage('As datas de início e fim precisam ser válidas.');
 if(!Number.isSafeInteger(premium)||premium<=0)return setMessage('Informe o prêmio total conforme o PDF.');
 if(netText&&(!Number.isSafeInteger(netPremium)||netPremium<0))
  return setMessage('Prêmio líquido inválido; preencha somente se confirmado no PDF.');
 if(iofText&&(!Number.isSafeInteger(iof)||iof<0))
  return setMessage('IOF inválido; preencha somente se confirmado no PDF.');
 if(producerId&&!producer)return setMessage('Selecione um produtor cadastrado válido.');
 if(rateText&&(!Number.isFinite(commissionPercent)||commissionPercent<0||commissionPercent>100))
  return setMessage('Comissão cheia inválida (0 a 100%).');
 if(Boolean(producerId)!==Boolean(rateText))
  return setMessage('Informe produtor e percentual de comissão juntos, conforme o PDF.');
 if(chargeText&&(!Number.isSafeInteger(financeCharges)||financeCharges<0))
  return setMessage('Juros/adicionais inválidos; informe somente o valor do PDF.');
 const reconcile=netPremium!==null&&iof!==null
   ?globalThis.LebrimeFinancialTolerance?.compare(premium,netPremium+iof+(financeCharges||0))
   :null;
 if(reconcile?.reviewRequired)
  return setMessage('Diferença acima de R$ 10,00 entre prêmio total e líquido + IOF + adicionais. Confira no PDF e registre os encargos documentados antes de cadastrar.');

 if(insuredValueText&&(!Number.isSafeInteger(insuredValue)||insuredValue<=0))return setMessage('Valor assegurado/LMI inválido. Deixe vazio se não estiver comprovado.');
 if(!Number.isInteger(count)||count<0||count>72)return setMessage('Quantidade de parcelas inválida.');
 if(!file||!/\.pdf$/i.test(file.name)||file.size<10||file.size>15*1024*1024)return setMessage('Selecione um PDF válido de até 15 MB.');
 if(/\bendosso\b/i.test(file.name))
  return setMessage('Arquivo identificado como endosso: vincule ao contrato existente, sem criar nova proposta.');
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
 const hashHex=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',value)))
  .map(x=>x.toString(16).padStart(2,'0')).join('');
 let fileHash='',importFingerprint='';
 try{
  fileHash=await hashHex(await file.arrayBuffer());
  const fingerprintData=[clientId,norm(insurer),norm(branch),norm(number),start,end].join('|');
  importFingerprint=await hashHex(new TextEncoder().encode('lebrime-renewal-v1|'+fingerprintData));
 }catch{return setMessage('Não foi possível conferir a integridade do PDF.');}
 if(list('document').some(r=>r.data?.fileSha256===fileHash&&String(r.data?.clientId||'')===clientId)){
  return setMessage('Este PDF já está cadastrado no cliente. Abra o documento existente em vez de importar novamente.');
 }
 const proposalId=uuid(),documentId=uuid(),stamp=now(),docType='Proposta';
 const key='clients/'+clientId+'/'+stamp.slice(0,4)+'/'+stamp.slice(5,7)+'/'+documentId+'-'+file.name.replace(/[^a-zA-Z0-9._-]/g,'-');
 locked=true;el('newRenewalSubmit').disabled=true;
 let uploaded=false,committed=false,checkpoint=false;
 try{
  // Salvar antes de qualquer chamada de rede: a falha não perde o arquivo.
  try{
   if(globalThis.LebrimeImportRecovery){
    checkpoint=Boolean(await globalThis.LebrimeImportRecovery.stage({fingerprint:importFingerprint,sha:fileHash,file,clientId,previousId:prior?.id||''}));
   }
  }catch(checkpointError){
   console.warn('Checkpoint local indisponível; mantenha o PDF original no Drive:',checkpointError);
  }
  setMessage('PDF conferido. Enviando o arquivo e criando nova vigência...');
  // Nunca confiar apenas na cópia em memória se outra pessoa acabou de importar a mesma proposta.
  await loadRecords();
  const newlyImported=portfolioRows().some(r=>r.data.clientId===clientId&&norm(r.data.insurer)===norm(insurer)&&
   norm(r.data.number)===norm(number)&&r.data.start===start&&r.data.end===end);
  if(newlyImported)throw new Error('Outra sessão já cadastrou esta proposta. Nenhum novo PDF foi gravado.');
  if(list('document').some(r=>r.data?.fileSha256===fileHash&&String(r.data?.clientId||'')===clientId))
   throw new Error('Este mesmo PDF já foi importado para o cliente por outra sessão.');
  await api('storage-put',file,{raw:true,key,headers:{'content-type':'application/pdf'}});
  uploaded=true;
  const financialVerified=Boolean(producer&&commissionPercent!==null&&netPremium!==null);
 const proposal={clientId,number,insurer,branch,start,end,premium,brokerage,brokerages:brokerage,
   ...(netPremium!==null?{netPremium}:{}),
   ...(iof!==null?{iof}:{}),
   ...(financeCharges!==null?{financeCharges}:{}),
   ...(reconcile?{financialReconciliation:{
     status:reconcile.status,differenceCents:reconcile.deltaCents,
     accepted:reconcile.accepted,toleranceCents:reconcile.toleranceCents,
     evidence:'Prêmio total comparado com líquido + IOF + adicionais documentados'
   }}:{}),
   ...(producer?{producerId,producerName:producer.data.name}:{}),
   ...(commissionPercent!==null?{commissionPercent}:{}),
   commissionSource:producer&&commissionPercent!==null?
     (globalThis.LebrimeProposalPreview?.producerEvidence?.(file)||'Informado e conferido pelo gestor no formulário'):
     'Pendente: não identificado no documento',
   importAuditFields:{
     netPremium:netPremium!==null?'Conferido no PDF':'Pendente de leitura do prêmio líquido',
     iof:iof!==null?'Conferido no PDF':'Pendente de leitura do IOF',
     producer:producer?'Conferido com produtor cadastrado':'Pendente de fonte',
     commissionPercent:commissionPercent!==null?'Comissão cheia identificada':'Pendente de fonte',
     documentSource:'PDF original preservado por SHA-256',
     reviewRequired:!financialVerified||iof===null||count===0
   },
   status:'Ativa — proposta cadastrada',source:'Importação assistida de seguro',renewalOf:prior?.id||'',
   importFingerprint,sourcePdfSha256:fileHash,
   renewalType:prior?'Renovação':'Seguro novo',producerPending:!producer,
   producerAssignmentStatus:producer?'Confirmado por fonte indicada na ficha':'Pendente — conferir documento/relatório',
   commissionPending:!financialVerified,
   insuredValue:insuredValue||0,insuredValuePending:!insuredValue,
   insuredValueSource:insuredValue?'PDF da proposta — valor confirmado pelo gestor':'Pendente',
   insuranceQualityStatus:'A conferir — verificar PDF',
   installmentCount:count,installmentExtractionStatus:'Pendente',paymentMethod:method,
   paymentDueText:'Conferir vencimentos no PDF',
   sourceFileName:file.name,
   auditStatus:!financialVerified?'Importado com pendências financeiras':'Importado — conferir todas as coberturas e riscos',
   processingRuleVersion:'LEBRIME-INGESTAO-V1-20261025'};
  const documentData={clientId,proposalId,policyId:'',contractId:proposalId,name:file.name,originalFileName:file.name,
   documentType:docType,referenceDate:start,storageKey:key,status:'Recebido',mimeType:'application/pdf',
   fileSize:file.size,fileSha256:fileHash,source:'Importação manual da proposta'};
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
  // Sem resposta confirmada do contrato E do documento, não descartar o checkpoint.
  if(checkpoint){
   const verified=await globalThis.LebrimeImportRecovery.complete(importFingerprint,proposalId,documentId);
   if(!verified)throw new Error('A gravação foi enviada, mas ainda não foi possível confirmar contrato e PDF no banco. Use Verificar no sistema antes de reenviar.');
  }
  document.dispatchEvent(new CustomEvent('lebrime-renewal-import-success',{
    detail:{clientId,proposalId,documentId,fileSha256:fileHash,importFingerprint}
  }));
  setMessage('Nova vigência criada na ficha existente. '+finance+
   (financialVerified?' Produtor e comissão cheia incluídos na importação; confira o registro financeiro.':
   ' Prêmio líquido, produtor ou comissão pendentes: requer revisão documental.'));
  const button=document.createElement('button');button.type='button';button.className='btn ghost small';
  button.textContent='Abrir ficha atualizada do cliente';
  button.onclick=()=>openClientDetail(clientId);
  el('newRenewalStatus').append(' ',button);
 }catch(err){
  if(uploaded&&!committed)try{await api('storage-delete',{}, {key})}catch(cleanupError){
   console.warn('Arquivo não vinculado exige limpeza pela gestão:',documentId,cleanupError);
  }
  if(checkpoint)try{
   await globalThis.LebrimeImportRecovery.failure(importFingerprint,err.message||err,committed||uploaded);
  }catch(checkpointError){console.warn('Falha em anotar checkpoint:',checkpointError)}
  setMessage((committed?'Gravação enviada; confirmação pendente no banco. Não reenvie sem verificar: ':
   'Importação interrompida; PDF e dados mantidos na fila de recuperação deste navegador, quando disponível: ')+String(err.message||err));
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
