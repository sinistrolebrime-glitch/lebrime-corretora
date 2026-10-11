/* LEBRIME — financeiro operacional v20.34.
 * Interface enxuta, sem comissões. Comunicação sempre por ação humana.
 */
(()=>{
 const ROOT='https://paiezoesntmicnwcmemt.supabase.co/functions/v1/lebrime-finance-operational';
 const STATUS={
   review:'Conferir PDFs / vencimentos',attention:'Prioridades (vencidas + próximos 7 dias)',
   late:'Vencidas sem confirmação',week:'Próximos 7 dias',month:'Próximos 30 dias',
   blocked:'Cobranças suspensas / previsões',paid:'Pagas e migração',all:'Todas as parcelas'
 };
 let state={filter:'review',page:0,search:'',data:null,loading:false};
 let savedOperator='';
 const $=s=>document.querySelector(s);
 const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v||0)/100);
 const niceDate=d=>/^\d{4}-\d{2}-\d{2}$/.test(String(d||''))?d.slice(8)+'/'+d.slice(5,7)+'/'+d.slice(0,4):'';
 async function financeApi(action,body){
   const token=localStorage.getItem('lebrime_token_v1');
   if(!token)throw new Error('Sessão expirada. Entre novamente.');
   const ctrl=new AbortController();
   const timeout=setTimeout(()=>ctrl.abort(),30000);
   try{
     const res=await fetch(ROOT+'?action='+encodeURIComponent(action),{method:'POST',signal:ctrl.signal,
       headers:{'content-type':'application/json',authorization:'Bearer '+token},
       body:JSON.stringify(body)});
     const data=await res.json().catch(()=>({}));
     if(res.status===401){location.replace('index.html');throw new Error('Sessão inválida. Faça login novamente.');}
     if(!res.ok)throw new Error(data.error||'Não foi possível consultar o financeiro.');
     return data;
   }finally{clearTimeout(timeout);}
 }
 function metrics(data){
   const c=data.counts||{};
   return [
     ['review','Conferência',c.review||0],
     ['late','Vencidas sem confirmação',c.late||0],
     ['week','Próximos 7 dias',c.week||0],
     ['attention','Prioridades',(c.late||0)+(c.week||0)],
     ['blocked','Não cobrar / previsão',(c.blocked||0)+(c.forecast||0)],
     ['paid','Pagas (inclui migração)',(c.paid||0)+(c.paidMigration||0)]
   ];
 }
 function renderQueue(){
   const data=state.data;if(!data)return;
   $('#monitorMetrics').innerHTML=metrics(data).map(([key,label,value])=>
     '<button type="button" class="metric '+(state.filter===key?'active':'')+'" data-fm="'+key+'"><strong>'+value+'</strong><span>'+escapeHtml(label)+'</span></button>').join('');
   $('#monitorMetrics').querySelectorAll('[data-fm]').forEach(b=>b.onclick=()=>{state.filter=b.dataset.fm;state.page=0;reload();});
   $('#monitorFilter').innerHTML=Object.entries(STATUS).map(([key,label])=>
     '<option value="'+escapeHtml(key)+'" '+(key===state.filter?'selected':'')+'>'+escapeHtml(label)+'</option>').join('');
   $('#monitorText').value=state.search;
   const rows=data.rows||[];
   const actions=row=>{
     const id=escapeHtml(row.id),version=Number(row.version||0);
     let html='<button type="button" class="link-btn" data-fopen="'+id+'">Ver ficha</button>';
     if(row.messageAllowed){
       html+='<button type="button" class="link-btn" data-fcopy="'+id+'">Copiar mensagem</button>';
       html+='<button type="button" class="link-btn" data-faction="contact" data-fid="'+id+'">Registrar contato</button>';
     }
     if(row.canAnnotate)html+='<button type="button" class="link-btn" data-faction="review-note" data-fid="'+id+'">Registrar conferência</button>';
     if(row.status!=='Pago'&&row.status!=='Cancelado')
       html+='<button type="button" class="link-btn" data-faction="confirm-payment" data-fid="'+id+'">Confirmar pagamento</button>';
     return html;
   };
   const table=rows.length?'<table><thead><tr><th>Cliente / telefone</th><th>Seguro / parcela</th><th>Vencimento</th><th>Valor</th><th>Situação / último contato</th><th>Ações</th></tr></thead><tbody>'+
     rows.map(r=>{
       const due=niceDate(r.due)||(r.dueText?escapeHtml(r.dueText):'A conferir');
       const last=r.lastContactAt?'Contato: '+niceDate(r.lastContactAt.slice(0,10)):'Sem contato registrado';
       return '<tr><td><strong>'+escapeHtml(r.clientName)+'</strong><small>'+escapeHtml(r.phone||'Telefone não informado')+'</small></td>'+
         '<td><strong>'+escapeHtml(r.contractNumber||'—')+'</strong><small>'+escapeHtml(r.insurer+' · '+r.installment)+'</small></td>'+
         '<td>'+due+'</td><td>'+escapeHtml(money(r.amount))+'</td>'+
         '<td><strong>'+escapeHtml(r.label)+'</strong><small>'+escapeHtml(r.collectionStatus||'')+' · '+escapeHtml(last)+'</small></td>'+
         '<td class="actions">'+actions(r)+'</td></tr>';
     }).join('')+'</tbody></table>':
     '<div class="empty"><b>Nenhum registro neste filtro</b>Escolha outra fila ou limpe a pesquisa.</div>';
   const nav='<div style="display:flex;align-items:center;gap:12px;justify-content:space-between;padding:18px;flex-wrap:wrap">'+
      '<button type="button" id="financePrev" class="btn" '+(data.page===0?'disabled':'')+'>← Anterior</button>'+
      '<span class="hint">Página '+(data.page+1)+' de '+data.pages+' · '+data.total+' registro(s)</span>'+
      '<button type="button" id="financeNext" class="btn" '+(data.page>=data.pages-1?'disabled':'')+'>Próxima →</button></div>';
   $('#results').innerHTML=table+nav;
   $('#count').textContent=data.total+' registro(s) na fila';
   $('#monitorStatus').textContent='Atualizado em '+new Date().toLocaleString('pt-BR')+
      ' · '+data.counts.all+' parcela(s) monitoradas no total. Ausência de confirmação não comprova inadimplência. Mensagens não são enviadas automaticamente.';
   $('#financePrev').onclick=()=>{state.page=Math.max(0,state.page-1);reload();};
   $('#financeNext').onclick=()=>{state.page=Math.min(data.pages-1,state.page+1);reload();};
   $('#results').querySelectorAll('[data-fopen]').forEach(b=>b.onclick=()=>{
     const row=rows.find(x=>x.id===b.dataset.fopen);
     if(row)openDetail({...row,number:row.contractNumber});
   });
   $('#results').querySelectorAll('[data-fcopy]').forEach(b=>b.onclick=()=>{
     const row=rows.find(x=>x.id===b.dataset.fcopy);
     if(row)copyMessage(row);
   });
   $('#results').querySelectorAll('[data-faction]').forEach(b=>b.onclick=()=>{
     const row=rows.find(x=>x.id===b.dataset.fid);
     if(row)openAction(row,b.dataset.faction);
   });
 }
 async function reload(){
   if(state.loading)return;
   state.loading=true;
   $('#monitorStatus').textContent='Atualizando parcelas e conferindo situações...';
   try{
     const result=await financeApi('queue',{filter:state.filter,page:state.page,search:state.search});
     if(currentTab!=='payments')return;
     state.data=result;state.page=result.page;
     renderQueue();
   }catch(e){
     $('#monitorStatus').textContent=String(e.message||e);
     $('#results').innerHTML='<div class="empty"><b>Não foi possível atualizar</b>Use Atualizar para tentar novamente.</div>';
   }finally{state.loading=false;}
 }
 async function copyMessage(row){
   if(!row.messageAllowed||!row.message)return;
   if(row.lastContactAt&&Date.now()-Date.parse(row.lastContactAt)<86400000)
     if(!confirm('Já existe contato registrado nas últimas 24 horas. Você verificou que outro lembrete é necessário?'))return;
   try{
     if(navigator.clipboard?.writeText){
       await navigator.clipboard.writeText(row.message);
       alert('Mensagem copiada. Confira o destinatário antes de enviar. Copiar não registra contato nem envia WhatsApp.');
     }else prompt('Copie a mensagem e confira o número antes de enviar:',row.message);
   }catch{prompt('Copie e confira antes de enviar:',row.message);}
 }
 function dialog(){
   let d=$('#financeActionDialog');if(d)return d;
   d=document.createElement('dialog');d.id='financeActionDialog';
   d.innerHTML='<form id="financeActionForm" class="modal-inner">'+
     '<div class="modal-top"><div><span class="eyebrow">Financeiro operacional</span><h2 id="financeActionTitle">Registrar</h2></div>'+
     '<button type="button" id="financeActionClose" class="close">×</button></div>'+
     '<p id="financeActionContext" class="hint"></p>'+
     '<div class="field"><label for="financeResponsible">Responsável pelo registro</label><input required id="financeResponsible" maxlength="100"></div>'+
     '<div class="field"><label for="financeNote">Relato / retorno do cliente</label><textarea id="financeNote" required minlength="10" maxlength="700" rows="3" style="width:100%;padding:10px;border:1px solid #dbe1e9;border-radius:9px"></textarea></div>'+
     '<div class="field is-hidden" id="financeEvidenceBox"><label for="financeEvidence">Comprovante ou evidência do pagamento</label><input id="financeEvidence" maxlength="350"></div>'+
     '<div class="field is-hidden" id="financeNextBox"><label for="financeNextDate">Próximo acompanhamento (opcional)</label><input type="date" id="financeNextDate"></div>'+
     '<div class="field is-hidden" id="financePaidBox"><label for="financePaidDate">Data do pagamento</label><input type="date" id="financePaidDate"></div>'+
     '<div class="actions"><button type="button" class="btn" id="financeActionCancel">Cancelar</button>'+
     '<button type="submit" id="financeActionSave" class="btn primary">Salvar registro</button></div>'+
     '<p id="financeActionError" class="warning-text" aria-live="polite"></p></form>';
   document.body.appendChild(d);
   d.querySelector('#financeActionClose').onclick=()=>d.close();
   d.querySelector('#financeActionCancel').onclick=()=>d.close();
   d.querySelector('#financeActionForm').onsubmit=submitAction;
   return d;
 }
 let pending=null;
 function openAction(row,operation){
   pending={row,operation};
   const d=dialog();
   d.querySelector('#financeActionTitle').textContent=operation==='contact'?'Registrar contato':
     operation==='review-note'?'Registrar conferência':'Confirmar pagamento';
   d.querySelector('#financeActionContext').textContent=row.clientName+' · '+row.contractNumber+' · parcela '+row.installment+' · '+row.label;
   d.querySelector('#financeResponsible').value=savedOperator||row.responsible||'';
   d.querySelector('#financeNote').value='';
   d.querySelector('#financeEvidence').value='';
   d.querySelector('#financeEvidenceBox').classList.toggle('is-hidden',operation!=='confirm-payment');
   d.querySelector('#financeNextBox').classList.toggle('is-hidden',operation!=='contact');
   d.querySelector('#financePaidBox').classList.toggle('is-hidden',operation!=='confirm-payment');
   d.querySelector('#financePaidDate').value=new Date(Date.now()-3*3600000).toISOString().slice(0,10);
   d.querySelector('#financeActionError').textContent='';
   d.showModal();
 }
 async function submitAction(e){
   e.preventDefault();
   if(!pending)return;
   const d=dialog(),save=d.querySelector('#financeActionSave');
   const responsible=d.querySelector('#financeResponsible').value.trim(),note=d.querySelector('#financeNote').value.trim();
   if(responsible.length<3||note.length<10){d.querySelector('#financeActionError').textContent='Informe responsável e relato com pelo menos 10 caracteres.';return;}
   save.disabled=true;
   try{
     await financeApi('action',{
       paymentId:pending.row.id,version:pending.row.version,
       operation:pending.operation,responsible,note,
       evidence:d.querySelector('#financeEvidence').value.trim(),
       nextActionDate:d.querySelector('#financeNextDate').value,
       paidDate:d.querySelector('#financePaidDate').value
     });
     savedOperator=responsible;
     d.close();pending=null;await reload();
   }catch(err){d.querySelector('#financeActionError').textContent=String(err.message||err);}
   finally{save.disabled=false;}
 }
 const oldSelect=selectTab;
 const oldRefresh=$('#monitorRefresh').onclick;
 const oldFilter=$('#monitorFilter').onchange;
 const oldText=$('#monitorText').oninput;
 const oldClear=$('#monitorClear').onclick;
 selectTab=function(mode){
   if(mode!=='payments'){
     $('#monitorText').onkeydown=null;
     $('#monitorText').onblur=null;
     $('#monitorRefresh').onclick=oldRefresh;
     $('#monitorFilter').onchange=oldFilter;
     $('#monitorText').oninput=oldText;
     $('#monitorClear').onclick=oldClear;
     return oldSelect(mode);
   }
   currentTab=mode;
   document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x.dataset.tab===mode));
   $('.searchpanel:not(#monitorPanel)').classList.add('is-hidden');
   $('#monitorPanel').classList.remove('is-hidden');
   $('#pageHeading').textContent='Cobranças e acompanhamento financeiro';
   $('#pageSubheading').textContent='Vencimentos, conferência de PDFs e contatos. Não presuma inadimplência sem confirmação.';
   $('#monitorTitle').textContent='Central de parcelas · Operacional';
   $('#monitorPeriod').textContent='Mesmos registros da gestão, sem comissões. Alterações ficam salvas.';
   $('#monitorFilter').onchange=e=>{state.filter=e.target.value;state.page=0;reload();};
   $('#monitorText').oninput=e=>{
      state.search=e.target.value.trim();state.page=0;
      // Pesquisa instantânea dentro da fila apenas após pressionar Enter ou sair do campo.
   };
   $('#monitorText').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();reload();}};
   $('#monitorText').onblur=()=>{if(state.search)reload();};
   $('#monitorRefresh').onclick=()=>reload();
   $('#monitorClear').onclick=()=>{state={filter:'review',page:0,search:'',data:null,loading:false};reload();};
   reload();
 };
})();
