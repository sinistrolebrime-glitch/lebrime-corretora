/* Módulo Financeiro v20.31 — central de trabalho da gestão.
 * Não envia mensagens automaticamente. Não interpreta ausência de comprovante
 * como inadimplência. Registro operacional exige confirmação humana.
 */
(()=>{
  const priorRenderList=renderList;
  const pageSize=80;
  let page=0;
  const state={view:'review',brokerage:'all',status:'all',dueFrom:'',dueTo:''};
  const todayLocal=()=>new Date(Date.now()-3*3600000).toISOString().slice(0,10);
  const contractOf=row=>rowById(row?.data?.policyId||row?.data?.proposalId)||null;
  const clientOf=row=>rowById(row?.data?.clientId||contractOf(row)?.data?.clientId)||null;
  const cOf=row=>contractOf(row);
  const printableDate=value=>FINANCE.validDate(value)?date(value):'A conferir';
  function currentSnapshot(){
    const imported=FINANCE.importedIds(list('document'));
    const rows=FINANCE.queueRows(portfolioRows(),list('payment'));
    return {imported,rows};
  }
  function financialState(row,imported){
    return FINANCE.stage(row,cOf(row),imported,CUTOFF,todayLocal());
  }
  function filterRows(rows,imported){
    const term=searchKey($('#searchInput').value||'');
    return rows.filter(row=>{
      const c=cOf(row),st=financialState(row,imported),due=row.data.due||'',days=FINANCE.daysBetween(due,todayLocal());
      if(state.view==='attention'&&!(['Vencida — não confirmada','Vence hoje'].includes(st)||st==='A vencer'&&days!==null&&days<=7))return false;
      if(state.view==='overdue'&&st!=='Vencida — não confirmada')return false;
      if(state.view==='next7'&&!(st==='Vence hoje'||st==='A vencer'&&days!==null&&days<=7))return false;
      if(state.view==='review'&&!(/^Conferir|^Migração/.test(st)||st==='Cobrança suspensa'))return false;
      if(state.view==='forecast'&&st!=='Previsão — não cobrar')return false;
      if(state.view==='paid'&&!['Pagamento registrado','Pago por migração'].includes(st))return false;
      if(state.brokerage!=='all'&&!String(c?.data?.brokerages||c?.data?.brokerage||'').split('|').includes(state.brokerage))return false;
      if(state.status!=='all'&&String(row.data.collectionStatus||'')!==state.status)return false;
      if(state.dueFrom&&(!due||due<state.dueFrom))return false;
      if(state.dueTo&&(!due||due>state.dueTo))return false;
      if(term&&!searchKey([clientOf(row)?.data?.name,clientOf(row)?.data?.document,c?.data?.number,c?.data?.insurer,row.data.installment].join(' ')).includes(term))return false;
      return true;
    }).sort((a,b)=>FINANCE.priority(a,cOf(a),imported,CUTOFF,todayLocal())-
        FINANCE.priority(b,cOf(b),imported,CUTOFF,todayLocal())||
        String(a.data.due||'9999').localeCompare(String(b.data.due||'9999')));
  }
  function choice(key,label){return '<option value="'+esc(key)+'" '+(state.view===key?'selected':'')+'>'+esc(label)+'</option>';}
  function summaryMarkup(rows,imported){
    const t=FINANCE.summary(rows,cOf,imported,CUTOFF,todayLocal());
    return `<div class="summary-strip" aria-label="Indicadores financeiros">
      <span class="chip danger">Vencidas sem confirmação: ${t.overdue}</span>
      <span class="chip">Vencem hoje: ${t.today}</span>
      <span class="chip">Próximos 7 dias: ${t.soon}</span>
      <span class="chip ${t.review?'danger':''}">Conferência de PDFs: ${t.review}</span>
      <span class="chip">Suspensas: ${t.suspended}</span>
      <span class="chip">Pagas confirmadas: ${t.paid}</span>
      <span class="chip">Pagas na migração: ${t.paidMigration}</span>
      <span class="chip">Previsões: ${t.forecast}</span>
    </div>`;
  }
  function renderFinance(){
    if(current!=='payment')return priorRenderList();
    const {rows,imported}=currentSnapshot();
    const displayed=filterRows(rows,imported);
    const documentIndex=new Map();
    for(const doc of list('document')){
      const id=String(doc.data.policyId||doc.data.proposalId||'');
      const type=fold(doc.data.documentType||'');
      if(!id||!['apolice','proposta'].some(k=>type.includes(k)))continue;
      if(!documentAvailable(doc))continue;
      const old=documentIndex.get(id);
      if(!old||Boolean(doc.data.storageKey)&&!Boolean(old.data.storageKey))documentIndex.set(id,doc);
    }
    const candidates=[...documentIndex.values()].filter(doc=>{
      const status=String(doc.data.financeExtractionStatus||'');
      const contract=rowById(doc.data.policyId||doc.data.proposalId);
      const hasPlan=Array.isArray(contract?.data?.installmentPlan)&&contract.data.installmentPlan.length>0;
      return !status&&contract&&Number(contract.data.premium||0)>0&&!hasPlan;
    });

    const pageCount=Math.max(1,Math.ceil(displayed.length/pageSize));
    page=Math.min(page,pageCount-1);
    const paged=displayed.slice(page*pageSize,(page+1)*pageSize);
    const brokerages=[...new Set(portfolioRows().flatMap(c=>String(c.data.brokerages||c.data.brokerage||'').split('|')).filter(Boolean))].sort();
    const collections=[...new Set(rows.map(r=>r.data.collectionStatus).filter(Boolean))].sort();
    $('#listMeta').textContent=`${displayed.length} de ${rows.length} registros · página ${page+1}/${pageCount}`;
    $('#filters').innerHTML=`
      <div class="portfolio-list-guide">
        <div><strong>Financeiro · fila para agir com segurança</strong>
          <p>As propostas importadas entram no acompanhamento. Sem vencimento confirmado, a parcela vai para conferência, não para cobrança. Nenhuma mensagem é enviada automaticamente.</p></div>
        <div class="finance-filter-actions">
          <button type="button" class="btn ghost small" id="billingAnalyzeBatch">Analisar 3 PDFs da carteira</button>
          <button type="button" class="btn ghost small" id="billingRefresh">Atualizar dados</button>
        </div>
      </div>
      <div id="billingExtractionInfo" class="muted" aria-live="polite">Documentos candidatos à leitura: ${candidates.length}. Processamento por blocos pequenos; somente dados conferidos são lançados.</div>
      ${summaryMarkup(rows,imported)}
      <div class="finance-filter-shell">
        <div class="finance-filter-grid">
          <label>Fila de trabalho<select id="billingView">
            ${choice('attention','Prioridade · vencidas + próximos 7 dias')}
            ${choice('review','Conferir PDF / bloqueadas')}
            ${choice('next7','A vencer nos próximos 7 dias')}
            ${choice('overdue','Vencidas sem confirmação')}
            ${choice('all','Todas as parcelas')}
            ${choice('paid','Pagamentos registrados')}
            ${choice('forecast','Previsões sem contrato confirmado')}
          </select></label>
          <label>Corretora<select id="billingBrokerage"><option value="all">Todas</option>
            ${brokerages.map(b=>`<option value="${esc(b)}" ${state.brokerage===b?'selected':''}>${esc(b)}</option>`).join('')}
          </select></label>
          <label>Etapa de cobrança<select id="billingStatus"><option value="all">Todas</option>
            ${collections.map(x=>`<option value="${esc(x)}" ${state.status===x?'selected':''}>${esc(x)}</option>`).join('')}
          </select></label>
          <label>De<input id="billingFrom" type="date" value="${esc(state.dueFrom)}"></label>
          <label>Até<input id="billingTo" type="date" value="${esc(state.dueTo)}"></label>
        </div>
        <div class="finance-filter-actions">
          <button type="button" class="btn ghost small" id="billingClear">Limpar filtros</button>
          <button type="button" class="btn ghost small" id="billingPrev" ${page===0?'disabled':''}>Anterior</button>
          <span class="chip">Página ${page+1} de ${pageCount}</span>
          <button type="button" class="btn ghost small" id="billingNext" ${page===pageCount-1?'disabled':''}>Próxima</button>
        </div>
      </div>`;
    $('#tableHead').innerHTML='<tr><th>Cliente / contato</th><th>Seguro</th><th>Parcela</th><th>Vencimento</th><th>Valor</th><th>Situação</th><th>Ações</th></tr>';
    $('#tableBody').innerHTML=paged.length?paged.map(row=>{
      const c=cOf(row),client=clientOf(row),st=financialState(row,imported);
      const able=FINANCE.actionable(row,c,imported,CUTOFF,todayLocal());
      const contact=client?.data?.mobile||client?.data?.phone||'';
      const doc=documentIndex.get(c?.id);
      const docAction=doc?`<button class="link-btn" data-billing-extract="${esc(doc.id)}">Ler parcelamento do PDF</button>`:
        c?`<button class="link-btn" data-billing-upload="${esc(c.id)}">Anexar PDF</button>`:'';
      const enable=st==='Cobrança suspensa'&&c?.data?.installmentExtractionStatus==='Verificado'&&row.data.collectionStatus==='Não cobrar'
        ?`<button class="link-btn" data-billing-enable="${esc(row.id)}">Liberar acompanhamento</button>`:'';
      const action=row.virtual?
        `<button class="link-btn" data-billing-contract="${esc(c?.id||'')}">Conferir contrato</button>${docAction}`
        :`<button class="link-btn" data-billing-contract="${esc(c?.id||'')}">Abrir contrato</button>
          <button class="link-btn" data-billing-edit="${esc(row.id)}">Editar parcela</button>
          ${docAction}${enable}
          ${able?`<button class="link-btn" data-billing-copy="${esc(row.id)}">Copiar mensagem</button>
          <button class="link-btn" data-billing-contact="${esc(row.id)}">Registrar contato</button>`
          :'<small class="muted">Conferir antes de cobrar</small>'}`;
      return `<tr><td><strong>${esc(client?.data?.name||'Cliente não identificado')}</strong><small>${esc(contact||'Telefone não informado')}</small></td>
       <td>${esc(c?.data?.number||'—')}<small>${esc(c?.data?.insurer||'')}</small></td>
       <td>${esc(row.data.installment||'—')}</td><td>${esc(FINANCE.validDate(row.data.due)?date(row.data.due):(row.data.dueText||'A conferir'))}</td>
       <td>${row.virtual?'—':money(row.data.amount)}</td>
       <td><span class="status-pill corporate-status ${st.includes('Vencida')?'danger':st.includes('Conferir')?'warning':'neutral'}">${esc(st)}</span></td>
       <td class="actions">${action}</td></tr>`;
    }).join(''):'<tr><td colspan="7"><div class="empty">Nenhuma parcela encontrada para este filtro. Use “Conferir PDF / dados” para investigar cronogramas incompletos.</div></td></tr>';
    const setValue=(id,key)=>{$(id).onchange=e=>{state[key]=e.target.value;page=0;renderFinance();};};
    setValue('#billingView','view');
    setValue('#billingBrokerage','brokerage');
    setValue('#billingStatus','status');
    setValue('#billingFrom','dueFrom');
    setValue('#billingTo','dueTo');
    $('#billingPrev').onclick=()=>{page=Math.max(0,page-1);renderFinance();};
    $('#billingNext').onclick=()=>{page=Math.min(pageCount-1,page+1);renderFinance();};
    $('#billingClear').onclick=()=>{Object.assign(state,{view:'attention',brokerage:'all',status:'all',dueFrom:'',dueTo:''});page=0;$('#searchInput').value='';renderFinance();};
    $('#billingRefresh').onclick=async()=>{
      $('#billingRefresh').disabled=true;
      try{await loadRecords();renderFinance();}catch(e){alert('Falha ao atualizar a carteira: '+e.message);}
      finally{const b=$('#billingRefresh');if(b)b.disabled=false;}
    };
    $('#billingAnalyzeBatch').onclick=async()=>{
      const btn=$('#billingAnalyzeBatch');
      const queue=candidates.slice(0,3);
      if(!queue.length){$('#billingExtractionInfo').textContent='Nenhum PDF novo elegível neste momento. Use Ler parcelamento do PDF na linha para reanalisar individualmente.';return;}
      btn.disabled=true;
      let ok=0,review=0,unavailable=0;
      for(let i=0;i<queue.length;i++){
        const message=$('#billingExtractionInfo');
        if(message)message.textContent=`Analisando documento ${i+1} de ${queue.length}...`;
        try{
          const result=await api('payments-extract',{documentId:queue[i].id,apply:true});
          if(result.applied)ok++;
          else if(result.status==='unavailable')unavailable++;
          else review++;
        }catch{review++;}
      }
      try{await loadRecords();renderFinance();}catch(e){alert('Falha ao atualizar o financeiro: '+e.message);}
      const summary=$('#billingExtractionInfo');
      if(summary)summary.textContent=`Bloco salvo: ${ok} plano(s) conciliado(s), ${review} para conferência e ${unavailable} arquivo(s) inacessível(is). Nenhuma cobrança foi enviada.`;
    };
    document.querySelectorAll('[data-billing-contract]').forEach(b=>b.onclick=()=>{const c=rowById(b.dataset.billingContract);if(c)openInsuranceDetail(c.id);});
    document.querySelectorAll('[data-billing-edit]').forEach(b=>b.onclick=()=>openEditor(rowById(b.dataset.billingEdit)));
    document.querySelectorAll('[data-billing-extract]').forEach(b=>b.onclick=()=>readSinglePdf(b.dataset.billingExtract));
    document.querySelectorAll('[data-billing-upload]').forEach(b=>b.onclick=()=>{
      const c=rowById(b.dataset.billingUpload);
      if(c)openClientUpload(c.data.clientId,c.id);
    });
    document.querySelectorAll('[data-billing-enable]').forEach(b=>b.onclick=()=>releaseCollection(rowById(b.dataset.billingEnable)));
    document.querySelectorAll('[data-billing-copy]').forEach(b=>b.onclick=()=>copyMessage(rowById(b.dataset.billingCopy),imported));
    document.querySelectorAll('[data-billing-contact]').forEach(b=>b.onclick=()=>recordContact(rowById(b.dataset.billingContact),imported));
  }
  async function readSinglePdf(id){
    if(!id)return;
    try{
      const result=await api('payments-extract',{documentId:id,apply:true});
      await loadRecords();
      renderFinance();
      const el=$('#billingExtractionInfo');
      if(el)el.textContent=result.applied
        ?`PDF conciliado com o prêmio: ${result.count} parcela(s) sincronizada(s). Confira a situação de cobrança antes de enviar lembretes.`
        :`PDF requer revisão: ${String(result.reason||'dados insuficientes')}.`;
    }catch(e){alert('Leitura do PDF não concluída: '+e.message);}
  }
  async function releaseCollection(row){
    if(!row||row.virtual||row.data.collectionStatus!=='Não cobrar')return;
    const contract=cOf(row);
    if(contract?.data?.installmentExtractionStatus!=='Verificado')return;
    if(!window.confirm('Liberação manual: você conferiu o documento, os valores, o vencimento e a situação de pagamento?'))return;
    const reason=window.prompt('Justificativa da liberação (obrigatória):','Parcelamento conferido no PDF; pagamento ainda não confirmado.');
    if(!reason?.trim())return;
    const stamp=now();
    const data={...row.data,collectionStatus:'Não iniciado',
      financialReleaseAt:stamp,financialReleaseReason:reason.trim()};
    try{
      await api('write',{ops:[{type:'update',id:row.id,kind:'payment',data,version:row.version,updated_at:stamp,strict:true}]});
      await loadRecords();renderFinance();
    }catch(e){alert('Não foi possível liberar esta parcela: '+e.message);}
  }
  async function copyMessage(row,imported){
    if(!FINANCE.actionable(row,cOf(row),imported,CUTOFF,todayLocal()))return;
    const message=FINANCE.message(row,clientOf(row)?.data?.name,cOf(row)?.data?.number,todayLocal());
    if(!message)return;
    try{
      if(navigator.clipboard?.writeText){
        await navigator.clipboard.writeText(message);
        alert('Mensagem copiada. Confira o destinatário e o pagamento antes de enviar. Nenhum contato foi registrado automaticamente.');
      }else window.prompt('Copie e confira a mensagem antes do envio:',message);
    }catch{window.prompt('Copie e confira a mensagem antes do envio:',message);}
  }
  async function recordContact(row,imported){
    if(!FINANCE.actionable(row,cOf(row),imported,CUTOFF,todayLocal()))return;
    const responsible=window.prompt('Responsável pelo contato:',String(row.data.responsible||''));
    if(!responsible?.trim())return;
    const note=window.prompt('Registre o contato realizado e o retorno do cliente:','Lembrete enviado; aguardando retorno.');
    if(!note?.trim())return;
    const stamp=now();
    const history=Array.isArray(row.data.contactHistory)?row.data.contactHistory:[];
    const data={...row.data,responsible:responsible.trim(),lastContactAt:stamp,lastContactNote:note.trim(),
      collectionStatus:'Cliente avisado',
      contactHistory:[...history.slice(-49),{at:stamp,by:responsible.trim(),note:note.trim()}]};
    try{
      await api('write',{ops:[{type:'update',id:row.id,kind:'payment',data,version:row.version,updated_at:stamp,strict:true}]});
      await loadRecords();renderFinance();
    }catch(e){alert('Não foi possível registrar o contato: '+e.message);}
  }
  renderList=function(){return current==='payment'?renderFinance():priorRenderList();};
})();
