/* LEBRIME — Central de conferência, v20.44.
 * Exibe exceções reais do cadastro, sem alterar cobrança, pagamentos ou comissão.
 */
(()=>{
'use strict';
const today=()=>new Date(Date.now()-3*3600000).toISOString().slice(0,10);
const normalize=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const hasPdf=row=>Boolean(row.data?.storageKey||row.data?.sourceDriveFileId||row.data?.externalUrl||row.data?.sourceDriveUrl);
const validDate=v=>{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(String(v||'')))return false;
 const parsed=new Date(v+'T12:00:00Z');
 return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===v;
};
const byId=(items)=>new Map(items.map(i=>[i.id,i]));
function analyze(clients,contracts,documents,payments,asOf=today()){
 const clientById=byId(clients);
 const contractById=byId(contracts);
 const pdfContracts=new Set(documents.filter(hasPdf).map(d=>String(d.data?.policyId||d.data?.proposalId||'')).filter(Boolean));
 const group=new Map();
 for(const c of contracts){
  const cid=c.data?.clientId;
  if(!cid||!clientById.has(cid))continue;
  if(!group.has(cid))group.set(cid,[]);
  group.get(cid).push(c);
 }
 const issues={expired:[],pdf:[],producer:[],due:[],plan:[]};
 for(const [cid,items] of group){
  const older=items.filter(x=>x.data?.end&&x.data.end<asOf).sort((a,b)=>
   String(b.data.end).localeCompare(String(a.data.end)));
  const current=items.some(x=>x.data?.end>=asOf);
  if(older.length){
   const row=older[0];
   issues.expired.push({clientId:cid,contractId:row.id,deadline:row.data.end,
    category:current?'Vencido; há outro contrato no prazo':'Somente vigências vencidas',
    message:'Confirmar renovação por ramo e risco',severity:current?1:0});
  }
 }
 for(const c of contracts){
  const cid=String(c.data?.clientId||'');
  if(!clientById.has(cid))continue;
  if(!pdfContracts.has(c.id))issues.pdf.push({clientId:cid,contractId:c.id,
   deadline:c.data?.end||'',category:'PDF pendente',message:'Vincular proposta ou apólice ao contrato',severity:1});
  if(c.data?.producerPending===true||(!c.data?.producerId&&!c.data?.producer))
   issues.producer.push({clientId:cid,contractId:c.id,deadline:c.data?.end||'',
    category:'Produtor a conferir',message:'Conferir anotações e relatório de produção',severity:1});
  const plan=c.data?.installmentPlan;
  if(Array.isArray(plan)&&plan.length&&Number.isSafeInteger(Number(c.data.premium))){
   const nums=plan.map(p=>Number(p.amount));
   if(nums.every(n=>Number.isSafeInteger(n)&&n>=0)){
    const gap=nums.reduce((a,b)=>a+b,0)-Number(c.data.premium);
    if(gap)issues.plan.push({clientId:cid,contractId:c.id,deadline:c.data?.end||'',
     category:'Diferença de parcelas',message:'Diferença de '+(gap/100).toFixed(2).replace('.',',')+' R$; não cobrar sem conciliar',severity:0});
   }
  }
 }
 for(const p of payments){
  const d=p.data||{},cid=String(d.clientId||''),contractId=String(d.policyId||d.proposalId||'');
  if(d.status==='Cancelado'||d.status==='Pago'||validDate(d.due)||!clientById.has(cid)||!contractById.has(contractId))continue;
  issues.due.push({clientId:cid,contractId,deadline:'',
   category:validDate(d.estimatedDue)?'Vencimento projetado — confirmar':'Vencimento não documentado',
   message:validDate(d.estimatedDue)?
     'Previsão '+d.estimatedDue.split('-').reverse().join('/')+' pelo dia informado no PDF; mês/ano a confirmar, não cobrar':
     'Conferir no PDF, boleto ou fatura antes de cobrar',severity:2});
 }
 issues.expired.sort((a,b)=>a.severity-b.severity||String(b.deadline).localeCompare(String(a.deadline)));
 for(const type of ['pdf','producer','plan'])issues[type].sort((a,b)=>
  String(b.deadline).localeCompare(String(a.deadline)));
 return {issues,clientById,contractById,counts:{
  expiredClients:issues.expired.length,
  expiredOnly:issues.expired.filter(i=>!i.severity).length,
  expiredWithOther:issues.expired.filter(i=>i.severity).length,
  missingPdfs:issues.pdf.length,
  producerReview:issues.producer.length,
  undatedUnpaidPayments:issues.due.length,
  mismatchedPlans:issues.plan.length
 }};
}
const root=document.getElementById('dashboard');
if(!root)return;
const style=document.createElement('style');
style.textContent='#lebrimeReviewCenter{margin-top:20px}#lebrimeReviewCenter .review-switches{display:flex;gap:7px;flex-wrap:wrap;margin:15px 0}'+
 '#lebrimeReviewCenter .review-switches button{border:1px solid #d9e0e9;border-radius:10px;padding:10px 12px;background:transparent;text-align:left;color:inherit}'+
 '#lebrimeReviewCenter .review-switches button.active{border-color:#ad8041;background:rgba(183,139,81,.1)}'+
 '#lebrimeReviewCenter .review-switches b{display:block;font-size:20px}#lebrimeReviewCenter .review-switches span{font-size:11px;color:var(--muted,#647083)}'+
 '#lebrimeReviewCenter .review-row{display:flex;justify-content:space-between;align-items:center;gap:12px;border-top:1px solid #e6ebf1;padding:11px 0}'+
 '#lebrimeReviewCenter .review-row span{font-size:12px;color:var(--muted,#647083)}'+
 '#lebrimeReviewCenter .review-row strong{display:block}#lebrimeReviewCenter .review-controls{display:flex;gap:12px;justify-content:space-between;flex-wrap:wrap;margin:12px 0}'+
 '#lebrimeReviewCenter input{max-width:340px;min-width:180px;width:100%}#lebrimeReviewCenter .review-pagination{display:flex;gap:14px;align-items:center;margin:10px 0}';
document.head.appendChild(style);
let state={filter:'expired',page:0,text:''},cached=null;
const choices=[['expired','Clientes com histórico vencido'],['pdf','Contratos sem PDF'],['producer','Produtor a conferir'],
 ['due','Parcelas sem vencimento'],['plan','Planos divergentes']];
const PAGE=35;
function render(){
 const box=document.getElementById('lebrimeReviewCenter');if(!box||!cached)return;
 const options=box.querySelector('#reviewFilters');
 options.innerHTML=choices.map(([id,label])=>{
  const count=cached.issues[id].length;
  return '<button type="button" class="'+(state.filter===id?'active':'')+'" data-review-type="'+id+'">'+
   '<b>'+count+'</b><span>'+label+'</span></button>';
 }).join('');
 options.querySelectorAll('[data-review-type]').forEach(b=>b.onclick=()=>{
  state.filter=b.dataset.reviewType;state.page=0;render();
 });
 const phrase=normalize(state.text);
 const rows=cached.issues[state.filter].filter(r=>{
  const client=cached.clientById.get(r.clientId)?.data||{};
  const c=cached.contractById.get(r.contractId)?.data||{};
  return !phrase||normalize([client.name,client.document,c.number,c.branch,c.insurer,r.category].join(' ')).includes(phrase);
 });
 const pages=Math.max(1,Math.ceil(rows.length/PAGE));
 state.page=Math.max(0,Math.min(state.page,pages-1));
 const shown=rows.slice(state.page*PAGE,(state.page+1)*PAGE);
 box.querySelector('#reviewList').innerHTML=shown.length?shown.map(r=>{
  const client=cached.clientById.get(r.clientId)?.data||{},c=cached.contractById.get(r.contractId)?.data||{};
  return '<div class="review-row"><div><strong>'+esc(client.name||'Cliente')+'</strong>'+
   '<span>'+esc([c.branch,c.number,c.insurer].filter(Boolean).join(' · '))+
   ' · '+esc(r.category)+'</span><div><small>'+esc(r.message)+'</small></div></div>'+
   '<button type="button" class="btn ghost small" data-review-client="'+esc(r.clientId)+'">Ver ficha</button></div>';
 }).join(''):'<p class="muted">Nenhuma pendência localizada neste filtro.</p>';
 box.querySelectorAll('[data-review-client]').forEach(btn=>btn.onclick=()=>openClientDetail(btn.dataset.reviewClient));
 box.querySelector('#reviewPages').innerHTML=
  '<button type="button" class="btn ghost small" id="reviewPrev" '+(state.page===0?'disabled':'')+'>Anterior</button>'+
  '<span>'+rows.length+' registros · página '+(state.page+1)+' de '+pages+'</span>'+
  '<button type="button" class="btn ghost small" id="reviewNext" '+(state.page===pages-1?'disabled':'')+'>Próxima</button>';
 box.querySelector('#reviewPrev').onclick=()=>{state.page--;render();};
 box.querySelector('#reviewNext').onclick=()=>{state.page++;render();};
}
function draw(){
 const contracts=portfolioRows();
 cached=analyze(list('client'),contracts,list('document'),list('payment'));
 document.getElementById('lebrimeReviewCenter')?.remove();
 root.insertAdjacentHTML('beforeend',
  '<section class="panel" id="lebrimeReviewCenter">'+
   '<p class="eyebrow">CONFERÊNCIA DA CARTEIRA</p><h2>Central de pendências</h2>'+
   '<p class="muted">Esta tela identifica dados a revisar. Contrato vencido não significa automaticamente ausência de renovação; e parcela sem data não significa cobrança em atraso.</p>'+
   '<div class="review-switches" id="reviewFilters"></div>'+
   '<div class="review-controls"><input type="search" id="reviewSearch" placeholder="Filtrar cliente, ramo ou contrato">'+
   '<button type="button" class="btn ghost small" id="reviewImport">Importar nova proposta</button></div>'+
   '<div id="reviewList"></div><div id="reviewPages" class="review-pagination"></div></section>');
 document.getElementById('reviewSearch').oninput=e=>{state.text=e.target.value;state.page=0;render();};
 document.getElementById('reviewImport').onclick=()=>navigate('imports');
 render();
}
const original=renderDashboard;
renderDashboard=function(){original();draw();};
globalThis.LebrimeReviewCenter={analyze};
})();
