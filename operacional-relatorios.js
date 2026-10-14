/* LEBRIME — Relatórios operacionais com abas; comissão restrita ao perfil gestor.
 * Exportação por impressão nativa / Salvar como PDF com logo transparente.
 * Nenhuma alteração de dados. Não revelar comissões pela API operacional.
 */
(()=>{
'use strict';
const byId=id=>document.getElementById(id);
const escText=s=>String(s??'');
const fold=s=>escText(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const date=s=>/^\d{4}-\d{2}-\d{2}$/.test(escText(s))?s.slice(8)+'/'+s.slice(5,7)+'/'+s.slice(0,4):'—';
const RULES=globalThis.LebrimeRenewalMonthRules;
const REPORTS=globalThis.LebrimeReports;
const PANEL=byId('operationalReports');
if(!PANEL||!RULES||!REPORTS)return;
let section='renewals', tasksCache=null, loadingTask=null, attempt=0;
const monthName=m=>{
 const [year,month]=m.split('-').map(Number);
 return new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'})
  .format(new Date(Date.UTC(year,month-1,1)));
};
const monthValue=()=>byId('opReportMonth')?.value||byId('renewalMonthInput')?.value||
 new Date(Date.now()-3*3600000).toISOString().slice(0,7);
const isAuthenticated=()=>document.body.classList.contains('op-authenticated');
const buttons=[
 ['renewals','Renovações'],['tasks','Pendências'],['commission','Comissões']
];
PANEL.innerHTML='<div class="op-reports-head"><div><h2>Relatórios operacionais</h2>'+
 '<p class="hint">Selecione uma aba. A exportação usa a logo institucional transparente e os filtros escolhidos.</p></div></div>'+
 '<nav class="op-report-tabs" aria-label="Abas de relatórios operacionais">'+
 buttons.map(([key,label])=>'<button type="button" data-op-report-tab="'+key+'">'+label+'</button>').join('')+
 '</nav><div id="opReportFilters" class="op-report-filters"></div>'+
 '<p id="opReportStatus" class="monitor-status" aria-live="polite"></p>'+
 '<div id="opReportPreview" class="op-report-preview"></div>';
const filterArea=byId('opReportFilters'),preview=byId('opReportPreview'),status=byId('opReportStatus');
const openPdf=opts=>{
 if(!isAuthenticated())return status.textContent='Entre novamente para gerar relatórios.';
 if(!opts.rows.length)return status.textContent='Nenhum registro correspondente ao filtro selecionado.';
 if(!REPORTS?.open)return status.textContent='Modelo de PDF indisponível. Atualize a página.';
 REPORTS.open(opts);
};
const matching=(row,needle)=>!needle||fold([
 row.clientName,row.number,row.insurer,row.branch,row.plate,row.status,row.end,
 row.title,row.responsible,row.source,row.destination
].join(' ')).includes(fold(needle));
async function renewalData(fromAgenda=false){
 if(!isAuthenticated())throw Error('É necessário autenticar a sessão.');
 const period=fromAgenda?(byId('renewalMonthInput')?.value||monthValue()):monthValue();
 const window=RULES.monthWindow(period);
 const index=await globalThis.lebrimeOperationalIndex();
 const rows=RULES.rowsFor(index,period);
 const key=fromAgenda?byId('monitorFilter')?.value||'all':byId('opReportRenewalStatus')?.value||'all';
 const needle=fromAgenda?byId('monitorText')?.value||'':byId('opReportSearch')?.value||'';
 return {period,window,rows:rows.filter(r=>RULES.accepted(r,key)&&matching(r,needle))};
}
const renewalPdf=async(fromAgenda=false)=>{
 try{
  const {period,window,rows}=await renewalData(fromAgenda);
  const dateRef=monthName(period);
  openPdf({
   title:'Relatório de Renovações',
   subtitle:'Agenda mensal de vencimentos — área operacional',
   period:dateRef+' · '+date(window.from)+' a '+date(window.to),
   columns:['Segurado','Contrato','Seguradora','Ramo','Placa','Vencimento','Situação'],
   rows:rows.map(r=>[r.clientName,r.number||'—',r.insurer||'—',r.branch||'—',r.plate||'—',date(r.end),r.status||'—']),
   summary:[{label:'Contratos no filtro',value:rows.length},
    {label:'Vencimentos no mês',value:date(window.from)+' a '+date(window.to)}],
   note:'A situação reflete as vigências registradas na carteira. Contrato vencido não comprova ausência de renovação.'
  });
 }catch(e){status.textContent='Não foi possível gerar o relatório: '+String(e.message||e)}
};
async function loadTasks(force=false){
 if(!isAuthenticated())throw Error('Entre para consultar pendências.');
 if(force)tasksCache=null;
 if(tasksCache)return tasksCache;
 if(!loadingTask)loadingTask=(async()=>{
  const token=localStorage.getItem('lebrime_token_v1')||'';
  if(!token)throw Error('Sessão não encontrada.');
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),20000);
  try{
   const res=await fetch(
    'https://paiezoesntmicnwcmemt.supabase.co/functions/v1/lebrime-operational-portal?action=tasks',
    {method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+token},
     body:'{}',cache:'no-store',signal:ctrl.signal});
   if(!res.ok)throw Error(res.status===401?'Sessão operacional inválida.':'Pendências indisponíveis.');
   const data=await res.json();
   if(!Array.isArray(data.rows))throw Error('Resposta de pendências inválida.');
   tasksCache=data.rows;
   return tasksCache;
  }finally{clearTimeout(timer);loadingTask=null}
 })();
 return loadingTask;
}
function taskRows(rows){
 const f=byId('opReportTaskStatus')?.value||'open';
 const term=byId('opReportSearch')?.value||'';
 const closed=r=>/^(conclu[ií]d[ao]|regularizado)$/i.test(escText(r.status).trim());
 return rows.filter(r=>(f==='all'||(f==='open'?!closed(r):closed(r)))&&matching(r,term));
}
const taskPdf=async()=>{
 try{
  const rows=taskRows(await loadTasks());
  const open=rows.filter(r=>!/^(conclu[ií]d[ao]|regularizado)$/i.test(escText(r.status).trim()));
  openPdf({
   title:'Relatório de Pendências',subtitle:'Acompanhamento operacional da carteira',
   period:byId('opReportTaskStatus')?.value==='all'?'Todas as situações':'Situação filtrada',
   columns:['Pendência','Segurado','Contrato','Responsável','Prazo','Origem','Destino','Situação'],
   rows:rows.map(r=>[r.title,r.clientName,r.contractNumber||'—',r.responsible||'—',
     date(r.due),r.source,r.destination||'—',r.status]),
   summary:[{label:'Pendências no filtro',value:rows.length},{label:'Em aberto',value:open.length}],
   note:'Relatório operacional sem informações de comissão. Itens pendentes exigem conferência documental.'
  });
 }catch(e){status.textContent='Não foi possível gerar PDF de pendências: '+String(e.message||e)}
};
const previewRows=(cols,rows,limit=10)=>{
 if(!rows.length)return '<p class="hint">Não há itens no filtro.</p>';
 return '<div class="op-report-scroll"><table><thead><tr>'+cols.map(x=>'<th>'+esc(x)+'</th>').join('')+'</tr></thead><tbody>'+
  rows.slice(0,limit).map(r=>'<tr>'+r.map(v=>'<td>'+esc(v)+'</td>').join('')+'</tr>').join('')+
  '</tbody></table></div><p class="hint">Prévia dos primeiros '+Math.min(rows.length,limit)+' de '+rows.length+' registros. O PDF contém todos os itens filtrados.</p>';
};
async function renderPreview(){
 const seq=++attempt;if(section==='commission')return;
 status.textContent='Consultando dados autenticados...';
 try{
  if(section==='renewals'){
   const {period,rows}=await renewalData();
   if(seq!==attempt||section!=='renewals')return;
   preview.innerHTML=previewRows(['Segurado','Contrato','Vencimento'],rows.map(r=>[r.clientName,r.number,date(r.end)]));
   status.textContent=rows.length+' renovação(ões) no filtro · '+monthName(period)+'.';
  }else{
   const rows=taskRows(await loadTasks());
   if(seq!==attempt||section!=='tasks')return;
   preview.innerHTML=previewRows(['Pendência','Segurado','Prazo'],rows.map(r=>[r.title,r.clientName,date(r.due)]));
   status.textContent=rows.length+' pendência(s) no filtro. Somente dados operacionais.';
  }
 }catch(e){if(seq===attempt)status.textContent='Falha na consulta: '+String(e.message||e)}
}
function showSection(next){
 section=next;attempt++;
 PANEL.querySelectorAll('[data-op-report-tab]').forEach(b=>{
  const on=b.dataset.opReportTab===next;b.classList.toggle('active',on);
  b.setAttribute('aria-selected',String(on));
 });
 preview.innerHTML='';
 if(next==='renewals'){
  filterArea.innerHTML='<div class="field"><label for="opReportMonth">Mês de referência</label>'+
   '<input type="month" id="opReportMonth" value="'+esc(monthValue())+'"></div>'+
   '<div class="field"><label for="opReportRenewalStatus">Situação</label><select id="opReportRenewalStatus">'+
   '<option value="all">Todas no mês</option><option value="upcoming">A vencer</option>'+
   '<option value="today">Vencendo hoje</option><option value="expired">Vencidas</option></select></div>'+
   '<div class="field"><label for="opReportSearch">Cliente ou contrato</label><input type="search" id="opReportSearch" placeholder="Pesquisar"></div>'+
   '<button type="button" class="btn primary" id="opReportPdf">Gerar PDF de Renovações</button>';
  byId('opReportPdf').onclick=()=>renewalPdf();
 }else if(next==='tasks'){
  filterArea.innerHTML='<div class="field"><label for="opReportTaskStatus">Situação</label>'+
   '<select id="opReportTaskStatus"><option value="open">Em aberto</option><option value="all">Todas</option><option value="closed">Concluídas</option></select></div>'+
   '<div class="field"><label for="opReportSearch">Pendência ou segurado</label><input type="search" id="opReportSearch" placeholder="Pesquisar"></div>'+
   '<button type="button" class="btn primary" id="opReportPdf">Gerar PDF de Pendências</button>'+
   '<button type="button" class="btn" id="opReportRefresh">Atualizar</button>';
  byId('opReportPdf').onclick=()=>taskPdf();
  byId('opReportRefresh').onclick=()=>{tasksCache=null;renderPreview()};
 }else{
  filterArea.innerHTML='<div class="op-report-restricted"><strong>Comissões — acesso administrativo</strong>'+
   '<p>A área operacional não recebe valores de comissões ou repasses. O relatório completo está disponível para gestores autenticados no portal Administrativo.</p>'+
   '<a class="btn primary" href="index.html?v=20.59" target="_blank" rel="noopener noreferrer">Abrir Administrativo</a></div>';
  status.textContent='Restrito: nenhuma comissão é transmitida à sessão operacional.';
  return;
 }
 filterArea.querySelectorAll('select,input').forEach(el=>el.addEventListener('change',renderPreview));
 byId('opReportSearch')?.addEventListener('input',renderPreview);
 renderPreview();
}
PANEL.querySelectorAll('[data-op-report-tab]').forEach(b=>b.onclick=()=>showSection(b.dataset.opReportTab));
const oldSelect=selectTab;
selectTab=function(mode){
 PANEL.classList.toggle('is-hidden',mode!=='reports');
 const button=byId('renewalPrintPdf');if(button)button.classList.toggle('is-hidden',mode!=='renewals');
 if(mode!=='reports')return oldSelect(mode);
 currentTab='reports';
 document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab==='reports'));
 document.querySelector('.searchpanel:not(#monitorPanel)')?.classList.add('is-hidden');
 byId('monitorPanel').classList.add('is-hidden');
 byId('pageHeading').textContent='Relatórios por abas';
 byId('pageSubheading').textContent='Renovações e pendências exportadas com a identidade visual LEBRIME. Comissões exigem acesso administrativo.';
 byId('results').innerHTML='<div class="empty"><b>Relatórios operacionais</b>Use as abas acima para consultar ou gerar PDF.</div>';
 byId('count').textContent='Relatórios';
 showSection(section);
};
const action=byId('monitorRefresh');
if(action){
 const print=document.createElement('button');
 print.id='renewalPrintPdf';print.type='button';print.className='btn primary is-hidden';
 print.textContent='Gerar PDF';
 print.onclick=()=>renewalPdf(true);
 action.insertAdjacentElement('afterend',print);
}
document.addEventListener('lebrime-operacional-logout',()=>{tasksCache=null;attempt++;PANEL.classList.add('is-hidden')});
})();
