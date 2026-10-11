/* LEBRIME v20.45: prévia antes da gravação de PDF de proposta.
 * Backend somente lê e retorna campos com fonte; esta UI nunca salva automaticamente.
 */
(()=>{
'use strict';
const el=id=>document.getElementById(id);
const previewButton=el('newRenewalPreviewButton');
const status=el('newRenewalPreviewStatus');
const view=el('newRenewalPreviewResults');
const pdf=el('newRenewalPdf');
if(!previewButton||!status||!view||!pdf)return;
const clean=v=>esc(String(v??''));
const digits=v=>String(v||'').replace(/\D/g,'');
const money=cents=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'})
 .format(Number(cents||0)/100);
const formatCents=cents=>(Number(cents||0)/100).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const labels={
 insuredDocument:'CPF/CNPJ',insuredName:'Segurado',insurer:'Seguradora',branch:'Ramo',
 number:'Proposta / apólice',start:'Início da vigência',end:'Fim da vigência',
 premium:'Prêmio total',insuredValue:'Valor assegurado/LMI'
};
let analyzed=null,activeFile=null,generation=0;
function warning(msg){status.textContent=msg;}
function forget(){
 generation++;analyzed=null;activeFile=null;view.hidden=true;view.innerHTML='';
 warning('Selecione o PDF e clique em "Ler PDF e mostrar prévia". Nenhum dado é salvo nesta etapa.');
}
pdf.addEventListener('change',forget);
function linkedClient(fields){
 const documentId=digits(fields?.insuredDocument?.value);
 if(![11,14].includes(documentId.length))return null;
 const found=list('client').filter(c=>digits(c.data?.document)===documentId);
 return found.length===1?found[0]:null;
}
function render(result){
 const values=result.fields||{};
 const client=linkedClient(values);
 const selected=el('newRenewalClient').value;
 const documentId=digits(values.insuredDocument?.value);
 const selectedClient=list('client').find(c=>c.id===selected);
 const documentConflict=selectedClient&&documentId&&digits(selectedClient.data?.document)!==documentId;
 const fields=Object.entries(labels).map(([key,label])=>{
  const r=values[key],value=r?
    (['premium','insuredValue'].includes(key)?money(r.value):String(r.value)):'Não identificado';
  return '<div class="pdf-preview-field"><strong>'+clean(label)+'</strong><span>'+clean(value)+'</span>'+
   (r?'<small>Página '+Number(r.page)+' · '+clean(r.evidence)+'</small>':'<small>Preenchimento manual necessário</small>')+'</div>';
 }).join('');
 const plan=result.installments||{};
 const installments=Array.isArray(plan.plan)?plan.plan:[];
 const verified=plan.status==='verified';
 const summary='<div class="pdf-preview-summary"><strong>Conferência de parcelamento</strong><p>'+
  clean(plan.reason||'O parcelamento precisa de conferência.')+'</p>'+
  '<p>'+installments.length+' parcela(s) identificada(s)'+
  (verified?' · soma e datas conciliadas':' · não aplicar automaticamente')+'</p></div>';
 const cautions=[...result.warnings||[]];
 if(client)cautions.unshift('Cliente identificado pelo CPF/CNPJ: '+String(client.data.name||'')+'. Confira antes de aplicar.');
 if(documentConflict)cautions.unshift('ATENÇÃO: CPF/CNPJ do PDF diverge do cliente selecionado. Corrija o cadastro antes de aplicar.');
 if(!client)cautions.unshift('Selecione e confira manualmente o cliente correto na carteira.');
 view.innerHTML='<h3>Prévia — '+Number(result.recognized||0)+' campo(s) localizados</h3>'+
  '<p class="muted">Somente campos com rótulo explícito são sugeridos. Confira diretamente no PDF antes de aplicar.</p>'+
  '<div class="pdf-preview-fields">'+fields+'</div>'+summary+
  '<ul class="pdf-preview-notes">'+cautions.map(x=>'<li>'+clean(x)+'</li>').join('')+'</ul>'+
  '<button type="button" class="btn primary" id="newRenewalApplyPreview"'+
  (documentConflict?' disabled title="Cliente divergente"':'')+'>Aplicar campos conferidos ao formulário</button>';
 view.hidden=false;
 el('newRenewalApplyPreview').onclick=()=>{
  if(!analyzed||pdf.files?.[0]!==activeFile)return warning('O PDF foi trocado; gere outra prévia.');
  const current=analyzed.fields||{};
  const chosen=el('newRenewalClient').value;
  const expected=digits(current.insuredDocument?.value);
  const customer=list('client').find(c=>c.id===chosen);
  if(customer&&expected&&digits(customer.data?.document)!==expected)
   return warning('Cliente selecionado não corresponde ao CPF/CNPJ encontrado no PDF.');
  const suggestion=linkedClient(current);
  if(suggestion&&!chosen){
   el('newRenewalClient').value=suggestion.id;
   el('newRenewalClient').dispatchEvent(new Event('change',{bubbles:true}));
  }
  const map={insurer:'newRenewalInsurer',branch:'newRenewalBranch',
   number:'newRenewalNumber',start:'newRenewalStart',end:'newRenewalEnd'};
  for(const [field,id] of Object.entries(map)){
   if(current[field]?.value)el(id).value=String(current[field].value);
  }
  if(Number(current.premium?.value)>0)el('newRenewalPremium').value=formatCents(current.premium.value);
  if(Number(current.insuredValue?.value)>0)el('newRenewalInsuredValue').value=formatCents(current.insuredValue.value);
  // Só sugerir quantidade de parcelas quando todas as datas e soma foram conciliadas.
  if(verified&&installments.length>0)el('newRenewalCount').value=String(installments.length);
  warning('Campos sugeridos aplicados. Confira PDF, cliente, vigência, prêmio, LMI e parcelas antes de cadastrar.');
 };
}
previewButton.onclick=async()=>{
 const file=pdf.files?.[0];
 if(!file)return warning('Selecione primeiro o PDF da proposta.');
 if(file.size>15*1024*1024||file.size<5||!/\.pdf$/i.test(file.name))
  return warning('Selecione PDF válido de até 15 MB.');
 const seq=++generation;analyzed=null;activeFile=file;view.hidden=true;
 previewButton.disabled=true;warning('Lendo PDF com segurança, sem gravar no cadastro...');
 try{
  const data=await api('proposal-preview',file,{raw:true,headers:{'content-type':'application/pdf'}});
  if(seq!==generation||pdf.files?.[0]!==file)return;
  if(!data?.preview||data.requiresConfirmation!==true||data.stored!==false)
   throw new Error('Resposta de prévia inválida.');
  analyzed=data.preview;render(analyzed);
  warning('Prévia carregada. Revise todos os campos e aplique somente os valores confirmados.');
 }catch(e){
  if(seq===generation)warning('Falha na prévia: '+String(e.message||e));
 }finally{previewButton.disabled=false;}
};
const style=document.createElement('style');
style.textContent='#newRenewalPreviewPanel{border:1px solid #e3e9ef;border-radius:12px;padding:14px}'+
 '#newRenewalPreviewResults{padding-top:12px}#newRenewalPreviewResults[hidden]{display:none!important}'+
 '.pdf-preview-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:9px;margin:14px 0}'+
 '.pdf-preview-field{border:1px solid #e4e9ef;border-radius:9px;padding:10px;min-width:0;display:flex;flex-direction:column;gap:4px}'+
 '.pdf-preview-field strong{font-size:11px;color:var(--muted,#647083)}.pdf-preview-field span{font-weight:750;font-size:12px;overflow-wrap:anywhere}'+
 '.pdf-preview-field small{font-size:10px;opacity:.75;overflow-wrap:anywhere}'+
 '.pdf-preview-summary{padding:10px;border:1px solid #e6e9f0;border-radius:8px}'+
 '.pdf-preview-notes{padding-left:20px;font-size:12px;line-height:1.7}';
document.head.appendChild(style);
globalThis.LebrimeProposalPreview={linkedClient};
})();