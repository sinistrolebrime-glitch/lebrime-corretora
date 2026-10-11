/* LEBRIME v20.39 — agenda de renovações por mês civil.
 * Não utiliza janelas móveis de 7/30/90 dias: sempre 01 até último dia do mês.
 * Reutiliza o índice operacional autenticado, sem comissões.
 */
(()=>{
'use strict';
const $r=id=>document.getElementById(id);
const todayLocal=()=>new Date(Date.now()-3*3600000).toISOString().slice(0,10);
const todayMonth=()=>todayLocal().slice(0,7);
const monthWindow=month=>{
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(month||'')))throw new Error('Selecione um mês válido.');
 const [year,num]=month.split('-').map(Number);
 const last=new Date(Date.UTC(year,num,0)).getUTCDate();
 return {from:month+'-01',to:month+'-'+String(last).padStart(2,'0')};
};
const shiftMonth=(month,delta)=>{
 const [year,num]=month.split('-').map(Number);
 if(!Number.isInteger(year)||!Number.isInteger(num)||num<1||num>12)throw new Error('Mês inválido.');
 return new Date(Date.UTC(year,num-1+delta,1)).toISOString().slice(0,7);
};
const monthLabel=month=>{
 const [year,num]=month.split('-').map(Number);
 return new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'})
   .format(new Date(Date.UTC(year,num-1,1)));
};
const daysBetween=(end,day)=>Math.round((Date.parse(end+'T12:00:00Z')-Date.parse(day+'T12:00:00Z'))/86400000);
const rowsFor=(index,month,day=todayLocal())=>{
 const interval=monthWindow(month);
 const clients=index.byClient||new Map((index.clients||[]).map(c=>[c.id,c]));
 return (index.contracts||[]).filter(c=>c.end>=interval.from&&c.end<=interval.to)
   .map(c=>{
     const client=clients.get(c.clientId)||{};
     return {...c,clientName:client.name||'Segurado sem vínculo',
       days:daysBetween(c.end,day)};
   }).sort((a,b)=>a.end.localeCompare(b.end)||a.clientName.localeCompare(b.clientName,'pt-BR'));
};
const statsFor=rows=>({
 all:rows.length,
 upcoming:rows.filter(r=>r.days>0).length,
 today:rows.filter(r=>r.days===0).length,
 expired:rows.filter(r=>r.days<0).length
});
const accepted=(row,status)=>{
 if(status==='expired')return row.days<0;
 if(status==='upcoming')return row.days>0;
 if(status==='today')return row.days===0;
 return true;
};
const statusList=[
 ['all','Todas as renovações do mês'],
 ['upcoming','A vencer neste mês'],
 ['today','Vencendo hoje'],
 ['expired','Já vencidas neste mês']
];
const wrapper=document.createElement('div');
wrapper.id='renewalsMonthPicker';
wrapper.className='is-hidden renewal-month-picker';
wrapper.innerHTML=
 '<label for="renewalMonthInput">Mês de referência da renovação</label>'+
 '<div class="renewals-month-controls">'+
 '<button class="btn" type="button" id="renewalMonthPrev" aria-label="Mês anterior">←</button>'+
 '<input type="month" id="renewalMonthInput" aria-label="Selecione o mês e ano das renovações" required>'+
 '<button class="btn" type="button" id="renewalMonthNext" aria-label="Mês seguinte">→</button>'+
 '<button class="btn" type="button" id="renewalMonthToday">Mês atual</button></div>';
const tools=document.querySelector('#monitorPanel .monitor-tools');
if(!tools)return;
tools.prepend(wrapper);
const field=$r('renewalMonthInput');
field.value=todayMonth();
const oldSelect=selectTab;
const oldRender=renderMonitor;
const oldLoad=loadMonitor;
let cache=null;
let generation=0;
let requestInFlight=null;
const render=()=>{
 if(currentTab!=='renewals'||!cache)return;
 const active=$r('monitorFilter').value||'all';
 const term=normalize($r('monitorText').value||'');
 const rows=cache.rows.filter(row=>accepted(row,active)).filter(row=>
  !term||normalize([row.clientName,row.number,row.insurer,row.branch,row.plate,row.status,row.end].join(' ')).includes(term));
 const summary=statsFor(cache.rows);
 const labels={all:'Total de renovações',upcoming:'A vencer no mês',today:'Vencendo hoje',expired:'Já vencidas no mês'};
 $r('monitorMetrics').innerHTML=statusList.map(([key])=>
  '<button type="button" class="metric '+(active===key?'active':'')+'" data-renewal-filter="'+key+'">'+
  '<strong>'+esc(summary[key])+'</strong><span>'+labels[key]+'</span></button>').join('');
 $r('monitorMetrics').querySelectorAll('[data-renewal-filter]').forEach(button=>{
  button.onclick=()=>{$r('monitorFilter').value=button.dataset.renewalFilter;render();};
 });
 $r('count').textContent=rows.length+' renovação(ões) no filtro · '+cache.rows.length+' no mês';
 const head=['Segurado','Contrato / seguradora','Ramo','Fim da vigência','Prazo','Situação','Ação'];
 const content=rows.map((r,index)=>{
  const date=normDate(r.end);
  const phrase=r.days<0?'Vencida há '+Math.abs(r.days)+' dia(s)':
    r.days===0?'Vence hoje':'Vence em '+r.days+' dia(s)';
  const style=r.days<0?'priority-overdue':r.days<=7?'priority-soon':'priority-ok';
  return '<tr><td><strong>'+esc(r.clientName)+'</strong></td>'+
   '<td><strong>'+esc(r.number||'Sem número')+'</strong><small>'+esc(r.insurer||'')+'</small></td>'+
   '<td>'+esc(r.branch||'—')+'</td><td>'+esc(date)+'</td>'+
   '<td><span class="'+style+'">'+esc(phrase)+'</span></td>'+
   '<td>'+esc(r.status||'—')+'</td>'+
   '<td><button type="button" class="link-btn" data-renewal-open="'+index+'">Ver ficha</button></td></tr>';
 }).join('');
 $r('results').innerHTML=rows.length?'<table><thead><tr>'+head.map(h=>'<th>'+esc(h)+'</th>').join('')+
  '</tr></thead><tbody>'+content+'</tbody></table>':
  '<div class="empty"><b>Nenhuma renovação encontrada</b>Experimente outro mês ou situação.</div>';
 $r('results').querySelectorAll('[data-renewal-open]').forEach(button=>{
  button.onclick=()=>{
   const row=rows[Number(button.dataset.renewalOpen)];
   if(row)openDetail(row);
  };
 });
 $r('monitorTitle').textContent='Agenda mensal de renovações';
 $r('monitorPeriod').textContent='De '+normDate(cache.interval.from)+' até '+normDate(cache.interval.to)+
  ' · '+monthLabel(cache.month);
 $r('monitorStatus').textContent='Período completo: '+normDate(cache.interval.from)+' a '+
  normDate(cache.interval.to)+' · '+cache.rows.length+' contrato(s) · Atualizado às '+
  new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
};
const load=async(force=false)=>{
 if(currentTab!=='renewals')return;
 const month=field.value||todayMonth();
 let interval;
 try{interval=monthWindow(month);}catch(e){
  $r('monitorStatus').textContent=String(e.message||e);return;
 }
 if(!force&&cache?.month===month){render();return;}
 const run=++generation;
 $r('monitorStatus').textContent='Localizando renovações de '+monthLabel(month)+'…';
 $r('results').innerHTML='<div class="empty"><b>Consultando renovações</b>Verificando as vigências do mês inteiro.</div>';
 try{
  if(typeof globalThis.lebrimeOperationalIndex!=='function')throw new Error('Índice operacional indisponível.');
  const index=await globalThis.lebrimeOperationalIndex(force);
  if(run!==generation||currentTab!=='renewals'||field.value!==month)return;
  cache={month,interval,rows:rowsFor(index,month)};
  render();
 }catch(e){
  if(run!==generation||currentTab!=='renewals')return;
  $r('monitorStatus').textContent='Não foi possível consultar as renovações: '+String(e.message||e);
  $r('results').innerHTML='<div class="empty"><b>Falha ao carregar</b>Use Atualizar para tentar novamente.</div>';
 }
};
const changeMonth=(month)=>{
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))return;
 field.value=month;
 load();
};
$r('renewalMonthPrev').onclick=()=>changeMonth(shiftMonth(field.value||todayMonth(),-1));
$r('renewalMonthNext').onclick=()=>changeMonth(shiftMonth(field.value||todayMonth(),1));
$r('renewalMonthToday').onclick=()=>changeMonth(todayMonth());
field.onchange=()=>load();
renderMonitor=function(){
 if(currentTab==='renewals')return render();
 return oldRender();
};
loadMonitor=function(force=false){
 if(currentTab==='renewals')return load(force);
 return oldLoad(force);
};
selectTab=function(mode){
 if(mode!=='renewals'){
  generation++;
  wrapper.classList.add('is-hidden');
  return oldSelect(mode);
 }
 currentTab='renewals';
 document.querySelectorAll('[data-tab]').forEach(node=>node.classList.toggle('active',node.dataset.tab===mode));
 document.querySelector('.searchpanel:not(#monitorPanel)').classList.add('is-hidden');
 $r('monitorPanel').classList.remove('is-hidden');
 wrapper.classList.remove('is-hidden');
 $r('pageHeading').textContent='Renovações por mês';
 $r('pageSubheading').textContent='Escolha o mês e o ano para ver todas as renovações do dia 01 ao último dia do mês, inclusive fevereiro.';
 $r('monitorTitle').textContent='Agenda mensal de renovações';
 $r('monitorFilter').innerHTML=statusList.map(([value,label])=>
   '<option value="'+value+'">'+label+'</option>').join('');
 $r('monitorFilter').value='all';
 $r('monitorText').value='';
 $r('monitorFilter').onchange=()=>render();
 $r('monitorText').oninput=()=>render();
 $r('monitorText').onkeydown=null;
 $r('monitorText').onblur=null;
 $r('monitorRefresh').onclick=()=>load(true);
 $r('monitorClear').onclick=()=>{
  $r('monitorText').value='';
  $r('monitorFilter').value='all';
  render();
 };
 load();
};
// Testes automáticos exercitam as funções puras sem chamadas autenticadas reais.
globalThis.LebrimeRenewalMonthRules={monthWindow,shiftMonth,rowsFor,statsFor,accepted};
})();
