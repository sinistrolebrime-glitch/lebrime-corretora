/* LEBRIME: abas gerenciais sem remover o histórico. */
(()=>{
'use strict';
const style=document.createElement('style');
style.textContent='.manager-client-tabs{display:flex;gap:7px;overflow-x:auto;margin:14px 0 15px;padding:0 0 11px;border-bottom:1px solid #e4eaf1}'+
'.manager-client-tabs button{border:1px solid #dbe2eb;border-radius:9px;padding:9px 13px;background:transparent;color:inherit;white-space:nowrap;font-weight:700;font-size:12px}'+
'.manager-client-tabs button.active{background:#fff6e8;border-color:#b78b51;color:#8b642f}'+
'.manager-client-pane-hidden{display:none!important}';
document.head.appendChild(style);
let tab='history';
const tabs=[
 ['history','Histórico de vigências'],
 ['data','Dados do cliente'],
 ['payments','Parcelas'],
 ['documents','Documentos / PDFs'],
 ['operations','Pendências e sinistros']
];
function classifySection(section){
 const title=String(section.querySelector('h3')?.textContent||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 if(title.includes('contrato'))return 'history';
 if(title.includes('parcela'))return 'payments';
 if(title.includes('documento'))return 'documents';
 return 'operations';
}
function setup(){
 const root=document.getElementById('clientDetailBody');
 if(!root||!root.querySelector('.client-kpis'))return;
 const nav=document.createElement('nav');
 nav.className='manager-client-tabs';
 nav.setAttribute('aria-label','Seções da ficha do cliente');
 nav.innerHTML=tabs.map(([id,label])=>'<button type="button" data-manager-tab="'+id+'">'+label+'</button>').join('');
 root.insertBefore(nav,root.firstChild);
 const details=root.querySelector('.detail-grid');
 const sections=[...root.querySelectorAll('.detail-section')];
 function display(view){
  tab=tabs.some(([id])=>id===view)?view:'history';
  nav.querySelectorAll('[data-manager-tab]').forEach(button=>{
   const yes=button.dataset.managerTab===tab;
   button.classList.toggle('active',yes);
   button.setAttribute('aria-selected',String(yes));
  });
  if(details)details.classList.toggle('manager-client-pane-hidden',tab!=='data');
  for(const section of sections){
   section.classList.toggle('manager-client-pane-hidden',classifySection(section)!==tab);
  }
 }
 nav.querySelectorAll('[data-manager-tab]').forEach(button=>{
  button.onclick=()=>display(button.dataset.managerTab);
 });
 display(tab);
}
const originalRender=renderClientDetail;
renderClientDetail=function(clientId,brokerageFilter='all'){
 const result=originalRender(clientId,brokerageFilter);
 setup();
 return result;
};
const originalOpen=openClientDetail;
openClientDetail=function(clientId){
 tab='history';
 return originalOpen(clientId);
};
globalThis.LebrimeManagerClientTabs={tabs:tabs.map(t=>t[0]),classifySection};
})();
