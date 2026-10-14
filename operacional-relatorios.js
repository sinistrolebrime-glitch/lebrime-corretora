/* LEBRIME — Relatórios operacionais: renovações e pendências de parcelas.
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
let section='renewals', attempt=0;
const monthName=m=>{
 const [year,month]=m.split('-').map(Number);
 return new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'})
  .format(new Date(Date.UTC(year,month-1,1)));
};
const monthValue=()=>byId('opReportMonth')?.value||byId('renewalMonthInput')?.value||
 new Date(Date.now()-3*3600000).toISOString().slice(0,7);
const isAuthenticated=()=>document.body.classList.contains('op-authenticated');
const buttons=[
 ['renewals','Renovações'],['payments','Pendências de parcelas']
];
PANEL.innerHTML='<div class="op-reports-head"><div><h2>Relatórios operacionais</h2>'+
 '<p class="hint">Selecione uma aba. A exportação usa a logo institucional transparente e os filtros escolhidos.</p></div></div>'+
 '<nav class="op-report-tabs" aria-label="Abas de relatórios operacionais">'+
 buttons.map(([key,label])=>'<button type="button" data-op-report-tab="'+key+'">'+label+'</button>').join('')+
 '</nav><div id="opReportFilters" class="op-report-filters"></div>'+
 '<p id="opReportStatus" class="monitor-status" aria-live="polite"></p>'+
 '<div id="opReportPreview" class="op-report-preview"></div>';
const filterArea=byId('opReportFilters'),preview=byId('opReportPreview'),status=byId('opReportStatus');
// Abre a janela ANTES das consultas assíncronas, evitando bloqueio de pop-up.
const beginPdf=()=>{
 if(!isAuthenticated()){status.textContent='Entre novamente para gerar relatórios.';return null}
 const win=window.open('','_blank');
 if(!win){status.textContent='Permita pop-ups do LEBRIME para gerar PDF.';return null}
 win.document.open();
 win.document.write('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>LEBRIME — preparando relatório</title></head><body style="font:15px Arial,sans-serif;padding:35px"><strong>LEBRIME CORRETORA DE SEGUROS</strong><p>Preparando dados para a impressão. Aguarde...</p></body></html>');
 win.document.close();
 return win;
};
const failPdf=(win,error)=>{
 status.textContent=String(error);
 if(win&&!win.closed){
  win.document.open();
  win.document.write('<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>LEBRIME — relatório indisponível</title><body style="font:15px Arial,sans-serif;padding:35px"><strong>Não foi possível gerar o relatório.</strong><p>Confira a mensagem na tela do LEBRIME e tente novamente.</p></body>');
  win.document.close();
 }
};
const openPdf=(opts,win)=>{
 if(!opts.rows.length){status.textContent='Nenhum registro correspondente ao filtro selecionado.';win?.close();return}
 if(!REPORTS?.open){failPdf(win,'Modelo de PDF indisponível. Atualize a página.');return}
 REPORTS.open({...opts,targetWindow:win});
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
 const win=beginPdf();
 if(!win)return;
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
  },win);
 }catch(e){failPdf(win,'Não foi possível gerar o relatório: '+String(e.message||e))}
};
// A mesma fila autenticada da Central de Parcelas, sem expor comissões.
const finance=()=>globalThis.LebrimeOperationalPaymentsReport;
const amount=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v||0)/100);
const filterOf=(central=false)=>central?(finance()?.current()?.filter||'review'):
 (byId('opReportPaymentStatus')?.value||'review');
const searchOf=(central=false)=>central?(finance()?.current()?.search||''):
 (byId('opReportSearch')?.value||'');
const paymentPreview=async()=>{
 const api=finance();
 if(!api)throw Error('Central de parcelas indisponível.');
 const page=await api.page(filterOf(),searchOf(),0);
 if(!Array.isArray(page.rows))throw Error('Resposta inválida do financeiro.');
 return page;
};
const paymentPdf=async(fromCentral=false)=>{
 const btn=fromCentral?byId('paymentPrintPdf'):byId('opReportPdf');
 if(btn?.disabled)return;
 const win=beginPdf();
 if(!win)return;
 if(btn)btn.disabled=true;
 try{
  if(!isAuthenticated())throw Error('Faça login na área operacional.');
  const api=finance();
  if(!api)throw Error('Central de parcelas indisponível.');
  const filter=filterOf(fromCentral),search=searchOf(fromCentral);
  const first=await api.page(filter,search,0);
  const expected=Number(first.total),pages=Number(first.pages);
  if(!Number.isSafeInteger(expected)||expected<0||
     !Number.isSafeInteger(pages)||pages<1||pages>334)
    throw Error('Relatório muito grande ou total inválido. Refine o filtro.');
  if(!Array.isArray(first.rows))throw Error('Primeira página indisponível.');
  const rows=[...first.rows];
  // Todos os registros do filtro, inclusive além da paginação exibida na tela.
  for(let page=1;page<pages;page++){
    const next=await api.page(filter,search,page);
    if(next.total!==expected||next.filter!==first.filter||next.page!==page||
       !Array.isArray(next.rows))
      throw Error('A carteira mudou durante a consulta. Atualize e tente novamente.');
    rows.push(...next.rows);
  }
  if(rows.length!==expected||new Set(rows.map(r=>r.id)).size!==rows.length)
    throw Error('Não foi possível conferir todas as parcelas do filtro. Atualize e tente novamente.');
  const label=api.filters[filter]||filter;
  openPdf({
   title:'Relatório de Pendências de Parcelas',
   subtitle:'Conferências, vencimentos e acompanhamento financeiro operacional',
   period:label+(search?' · Pesquisa: '+search:''),
   columns:['Segurado','Contrato / seguradora','Parcela','Vencimento','Valor','Situação','Ação de acompanhamento'],
   rows:rows.map(row=>[
    row.clientName||'—',
    [row.contractNumber,row.insurer].filter(Boolean).join(' · ')||'—',
    row.installment||'—',
    date(row.due)==='—'?(row.dueText||'A conferir'):date(row.due),
    amount(row.amount),row.label||row.status||'Pendente',
    row.collectionStatus||'Acompanhar'
   ]),
   summary:[{label:'Parcelas no filtro',value:expected},
    {label:'Total listado',value:amount(rows.reduce((acc,row)=>acc+Number(row.amount||0),0))},
    {label:'Filtro',value:label}],
   note:'Relatório de acompanhamento. Valores sem data comprovada ou marcados como Não cobrar não representam dívida vencida confirmada. Nenhuma cobrança é enviada automaticamente.'
  },win);
  status.textContent='PDF preparado com '+expected+' parcela(s) do filtro '+label+'.';
 }catch(e){
  failPdf(win,'Não foi possível gerar o PDF de parcelas: '+String(e.message||e));
 }finally{if(btn)btn.disabled=false}
};
const previewRows=(cols,rows,limit=10)=>{
 if(!rows.length)return '<p class="hint">Não há itens no filtro.</p>';
 return '<div class="op-report-scroll"><table><thead><tr>'+cols.map(x=>'<th>'+esc(x)+'</th>').join('')+'</tr></thead><tbody>'+
  rows.slice(0,limit).map(r=>'<tr>'+r.map(v=>'<td>'+esc(v)+'</td>').join('')+'</tr>').join('')+
  '</tbody></table></div><p class="hint">Prévia dos primeiros '+Math.min(rows.length,limit)+' de '+rows.length+' registros. O PDF contém todos os itens filtrados.</p>';
};
async function renderPreview(){
 const seq=++attempt;
 status.textContent='Consultando dados autenticados...';
 try{
  if(section==='renewals'){
   const {period,rows}=await renewalData();
   if(seq!==attempt||section!=='renewals')return;
   preview.innerHTML=previewRows(['Segurado','Contrato','Vencimento'],rows.map(r=>[r.clientName,r.number,date(r.end)]));
   status.textContent=rows.length+' renovação(ões) no filtro · '+monthName(period)+'.';
  }else if(section==='payments'){
   const result=await paymentPreview();
   if(seq!==attempt||section!=='payments')return;
   preview.innerHTML=previewRows(['Segurado','Contrato','Vencimento','Valor','Situação'],
    result.rows.map(r=>[r.clientName,r.contractNumber,date(r.due),amount(r.amount),r.label]));
   status.textContent=result.total+' parcela(s) no filtro. O PDF inclui todas as páginas, não só esta prévia.';
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
 }else if(next==='payments'){
  const opts=Object.entries(finance()?.filters||{
   review:'Conferir PDFs / vencimentos',attention:'Prioridades',late:'Vencidas sem confirmação',
   week:'Próximos 7 dias',month:'Próximos 30 dias',blocked:'Não cobrar / previsão',all:'Todas as parcelas'
  }).filter(([key])=>key!=='paid');
  filterArea.innerHTML='<div class="field"><label for="opReportPaymentStatus">Pendências de parcelas</label>'+
   '<select id="opReportPaymentStatus">'+opts.map(([key,label])=>
    '<option value="'+esc(key)+'">'+esc(label)+'</option>').join('')+'</select></div>'+
   '<div class="field"><label for="opReportSearch">Cliente ou contrato</label>'+
   '<input type="search" id="opReportSearch" placeholder="Pesquisar"></div>'+
   '<button type="button" class="btn primary" id="opReportPdf">Gerar PDF de Pendências de Parcelas</button>';
  byId('opReportPdf').onclick=()=>paymentPdf();
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
 const paymentButton=byId('paymentPrintPdf');if(paymentButton)paymentButton.classList.toggle('is-hidden',mode!=='payments');
 if(mode!=='reports')return oldSelect(mode);
 currentTab='reports';
 document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab==='reports'));
 document.querySelector('.searchpanel:not(#monitorPanel)')?.classList.add('is-hidden');
 byId('monitorPanel').classList.add('is-hidden');
 byId('pageHeading').textContent='Relatórios por abas';
 byId('pageSubheading').textContent='Renovações e pendências de parcelas exportadas com a identidade visual LEBRIME.';
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
const paymentButton=document.createElement('button');
paymentButton.id='paymentPrintPdf';paymentButton.type='button';
paymentButton.className='btn primary is-hidden';
paymentButton.textContent='Gerar PDF de Pendências';
paymentButton.onclick=()=>paymentPdf(true);
byId('monitorRefresh')?.insertAdjacentElement('afterend',paymentButton);
document.addEventListener('lebrime-operacional-logout',()=>{
 attempt++;PANEL.classList.add('is-hidden');
});
})();
