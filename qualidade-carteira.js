/* Lebrime — qualidade mensurável da carteira; não inventar percentual global. */
(()=>{
'use strict';
const isoDate=d=>{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(String(d||'')))return false;
 const date=new Date(d+'T12:00:00Z');
 return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===d;
};
const hasFile=d=>Boolean(d?.data?.storageKey||d?.data?.sourceDriveFileId||
 d?.data?.externalUrl||d?.data?.sourceDriveUrl);
const percentage=(done,total)=>total?Math.round(1000*done/total)/10:0;
function coverage(clients,contracts,documents,payments){
 const clientIds=new Set(clients.map(c=>c.id));
 const clientDocuments=clients.filter(c=>[11,14].includes(String(c.data.document||'').replace(/\D/g,'').length));
 const endDate=contracts.filter(c=>isoDate(c.data.start)&&isoDate(c.data.end)&&c.data.start<=c.data.end);
 const pdfContracts=new Set(documents.filter(hasFile).flatMap(d=>[
  d.data?.policyId,d.data?.proposalId
 ]).filter(Boolean));
 const linkedDocuments=contracts.filter(c=>pdfContracts.has(c.id));
 const producer=contracts.filter(c=>c.data?.producerPending!==true&&
  Boolean(c.data?.producerId||c.data?.producer));
 const paymentDates=payments.filter(p=>isoDate(p.data?.due));
 const mismatched=contracts.filter(c=>c.data?.clientId&&!clientIds.has(String(c.data.clientId)));
 return {
  stats:[
   {id:'client',label:'Clientes com CPF/CNPJ informado',value:clientDocuments.length,total:clients.length},
   {id:'period',label:'Contratos com vigências válidas',value:endDate.length,total:contracts.length},
   {id:'document',label:'Contratos com PDF vinculado',value:linkedDocuments.length,total:contracts.length},
   {id:'producer',label:'Contratos com produtor informado',value:producer.length,total:contracts.length},
   {id:'payment',label:'Parcelas com vencimento documentado',value:paymentDates.length,total:payments.length}
  ],
  missingClient:mismatched.length
 };
}
function renderQuality(){
 const root=document.getElementById('dashboard');
 if(!root||!root.isConnected||typeof list!=='function')return;
 const values=coverage(list('client'),portfolioRows(),list('document'),list('payment'));
 const html='<section class="panel" id="portfolioQuality">'+
  '<div class="quality-head"><div><p class="eyebrow">QUALIDADE E CONFIABILIDADE</p>'+
  '<h2>Conferência de dados da carteira</h2></div>'+
  '<span class="status-pill corporate-status">Indicadores auditáveis</span></div>'+
  '<p class="muted">As porcentagens mostram campos efetivamente preenchidos e vinculados, não uma aprovação geral da carteira. Vencimento ausente ou PDF não localizado permanece pendente.</p>'+
  '<div class="quality-lines">'+values.stats.map(item=>{
    const pct=percentage(item.value,item.total);
    return '<div class="quality-line"><div class="quality-line-text"><strong>'+esc(item.label)+
     '</strong><span>'+item.value+' de '+item.total+' · '+String(pct).replace('.',',')+'%</span></div>'+
     '<div class="quality-track"><div class="quality-fill" style="width:'+pct+'%"></div></div></div>';
   }).join('')+'</div>'+
   (values.missingClient?'<p class="muted">Atenção: '+values.missingClient+' contrato(s) apontam para cliente não localizado.</p>':'')+
   '</section>';
 root.insertAdjacentHTML('beforeend',html);
}
const style=document.createElement('style');
style.textContent='#portfolioQuality{margin-top:18px}#portfolioQuality .quality-head{display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px;align-items:center}'+
'#portfolioQuality .quality-lines{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:17px;padding-top:14px}'+
'#portfolioQuality .quality-line-text{display:flex;justify-content:space-between;gap:12px;font-size:12px}'+
'#portfolioQuality .quality-line-text span{white-space:nowrap;color:var(--muted,#647083)}'+
'#portfolioQuality .quality-track{height:8px;background:#dfe4e9;border-radius:12px;overflow:hidden;margin-top:7px}'+
'#portfolioQuality .quality-fill{height:100%;background:#b78b51;border-radius:12px}';
document.head.appendChild(style);
const previousRender=renderDashboard;
renderDashboard=function(){previousRender();renderQuality();};
globalThis.LebrimePortfolioQuality={coverage,isoDate,percentage};
})();
