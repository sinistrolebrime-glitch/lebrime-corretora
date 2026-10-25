/* LEBRIME | Historicos sem produtor e recebimento de PDFs de renovacao | v20.72 */
(() => {
  'use strict';
  const VIEW = 'historicReview';
  const ROOT = '#historicReviewView';
  const MAX_BYTES = 15 * 1024 * 1024;
  const drafts = new Map();
  const inFlight = new Set();
  let search = '', page = 0, filter = 'todos';
  const perPage = 10;
  const $root = () => document.querySelector(ROOT);
  const html = value => String(value ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const draftOf = id => {
    if (!drafts.has(id)) drafts.set(id,{producerId:'',commission:'',file:null});
    return drafts.get(id);
  };
  const nameOf = c => String(c?.data?.name || '(cliente sem nome)');
  const producerRows = () => (records || []).filter(r=>r.kind==='producer').sort((a,b)=>nameOf(a).localeCompare(nameOf(b),'pt-BR'));
  const getClients = () => new Map((records||[]).filter(r=>r.kind==='client').map(r=>[r.id,r]));
  const savedSubmissions = () => (records||[]).filter(r=>r.kind==='historical_review_submission');
  const getRows = () => {
    const clients = getClients();
    return (records||[]).filter(r=>
      (r.kind==='proposal'||r.kind==='policy') &&
      r.data?.sourceSystem==='SegFlex' &&
      r.data?.producerPending===true || false
    ).filter(r=>!r.data?.producerId && clients.has(r.data?.clientId))
    .map(r=>({...r,client:clients.get(r.data.clientId)}))
    .sort((a,b)=>nameOf(a.client).localeCompare(nameOf(b.client),'pt-BR')||a.id.localeCompare(b.id));
  };
  const isPending = r => ['true',true].includes(r.data?.producerPending);
  // Algumas importacoes usam booleano, outras string no JSON.
  const pendingRows = () => getRows().filter(isPending);
  const existing = r => savedSubmissions().filter(s=>String(s.data?.historicalRecordId||'')===String(r.id));
  const escAttr = html;
  const producerOptions = selected => '<option value="">A identificar</option>' + producerRows().map(p=>
    '<option value="'+escAttr(p.id)+'" '+(selected===p.id?'selected':'')+'>'+html(nameOf(p))+'</option>'
  ).join('');
  function draw(){
    const root=$root();
    if(!root || root.classList.contains('hidden')) return;
    const all = pendingRows();
    const filtered = all.filter(r=>{
      const t=search.trim().toLocaleLowerCase('pt-BR');
      const found=!t||nameOf(r.client).toLocaleLowerCase('pt-BR').includes(t)||
        String(r.data?.number||'').toLocaleLowerCase('pt-BR').includes(t);
      const d=draftOf(r.id),filled=!!d.file || (!!d.producerId&&!!d.commission);
      const submitted=existing(r).length>0;
      return found && (filter==='todos' || (filter==='preenchidos'&&filled)||
        (filter==='enviados'&&submitted)||(filter==='pendentes'&&!submitted));
    });
    const totalPages=Math.max(1,Math.ceil(filtered.length/perPage));
    page=Math.min(page,totalPages-1);
    const view=filtered.slice(page*perPage,(page+1)*perPage);
    const existingCount=all.filter(r=>existing(r).length>0).length;
    root.innerHTML=`
    <div class="panel historical-review-panel">
      <h2>Conferência de históricos vencidos</h2>
      <p class="muted">Preencha o produtor e a comissão cheia e/ou anexe o PDF da renovação diretamente neste formulário. O contrato anterior não será sobrescrito.</p>
      <div class="historical-toolbar">
        <label>Buscar cliente ou proposta
          <input id="historicalSearch" placeholder="Nome ou número da proposta" autocomplete="off" value="${escAttr(search)}">
        </label>
        <label>Mostrar
          <select id="historicalFilter">
            <option value="todos" ${filter==='todos'?'selected':''}>Todos</option>
            <option value="pendentes" ${filter==='pendentes'?'selected':''}>Sem envio registrado</option>
            <option value="preenchidos" ${filter==='preenchidos'?'selected':''}>Preenchidos nesta sessão</option>
            <option value="enviados" ${filter==='enviados'?'selected':''}>Enviados para revisão</option>
          </select>
        </label>
      </div>
      <p class="muted" role="status">${all.length} contratos históricos ainda sem produtor confirmado · ${existingCount} com envio(s) para conferência · página ${page+1} de ${totalPages}</p>
      <div id="historicalList">
        ${view.map(r=>{
          const d=draftOf(r.id),uploads=existing(r);
          const status=uploads.length ? '<span class="status-pill corporate-status neutral">Arquivo/dados recebidos para revisão</span>' : '';
          return `<article class="historical-row" data-record-id="${escAttr(r.id)}">
            <div class="historical-row-head">
              <div><strong>${html(nameOf(r.client))}</strong><div class="muted">Proposta ${html(r.data?.number||'—')} · Vencimento ${html(r.data?.end||'—')}</div></div>${status}
            </div>
            <div class="historical-fields">
              <label>Produtor<select data-field="producerId">${producerOptions(d.producerId)}</select></label>
              <label>Comissão cheia (%)<input data-field="commission" inputmode="decimal" placeholder="Ex.: 22,84" value="${escAttr(d.commission)}"></label>
              <label class="historical-file-label">PDF da renovação (selecionar arquivo)
                <input type="file" data-field="file" accept=".pdf,application/pdf" aria-label="PDF de renovação de ${escAttr(nameOf(r.client))}">
                <small data-file-name>${d.file ? html(d.file.name) : 'Nenhum PDF selecionado · máximo 15 MB'}</small>
              </label>
            </div>
            <div class="historical-actions">
              <span class="muted">O PDF será recebido para validação; uma nova vigência só será cadastrada após a conferência.</span>
              <button type="button" class="btn primary" data-action="save" ${inFlight.has(r.id)?'disabled':''}>${inFlight.has(r.id)?'Enviando…':'Enviar para conferência'}</button>
            </div>
            <div class="historical-result" role="status" aria-live="polite" data-status></div>
          </article>`;
        }).join('')}
      </div>
      ${!view.length?'<p class="muted">Nenhum contrato encontrado com este filtro.</p>':''}
      <div class="historical-pagination">
        <button class="btn ghost" type="button" data-action="prev" ${page===0?'disabled':''}>Anterior</button>
        <span>Página ${page+1} de ${totalPages}</span>
        <button class="btn ghost" type="button" data-action="next" ${page>=totalPages-1?'disabled':''}>Próxima</button>
      </div>
      <p class="muted">Os PDFs ficam em armazenamento privado do Portal LEBRIME, vinculados à ficha do cliente e sinalizados para análise. O histórico e o financeiro permanecem preservados.</p>
    </div>`;
    root.querySelector('#historicalSearch').addEventListener('input',e=>{
      search=e.target.value;page=0;
      const caret=e.target.selectionStart;draw();
      const input=$root()?.querySelector('#historicalSearch');
      if(input){input.focus();input.setSelectionRange(caret,caret);}
    });
    root.querySelector('#historicalFilter').addEventListener('change',e=>{filter=e.target.value;page=0;draw();});
  }
  function status(card,msg,isError=false){
    const el=card?.querySelector('[data-status]');if(el){el.textContent=msg;el.style.color=isError?'#b42318':'';}
  }
  const sha256 = async file => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))).map(n=>n.toString(16).padStart(2,'0')).join('');
  async function saveRow(id,card){
    if(inFlight.has(id)) return;
    const row=pendingRows().find(r=>r.id===id);
    if(!row) {status(card,'Contrato não encontrado ou produtor já regularizado. Atualize o portal.',true);return;}
    const d=draftOf(id);
    const rate=String(d.commission||'').trim().replace(',','.');
    const hasProducer=Boolean(d.producerId);
    const hasRate=rate!=='';
    if(hasProducer!==hasRate){
      status(card,'Para informar o produtor histórico, selecione produtor e percentual juntos.',true);return;
    }
    const percentage=Number(rate);
    if(hasRate && (!Number.isFinite(percentage)||percentage<0||percentage>100)){
      status(card,'Percentual inválido. Use de 0 a 100.',true);return;
    }
    if(!hasProducer && !d.file){
      status(card,'Selecione um produtor com comissão e/ou anexe o PDF de renovação.',true);return;
    }
    if(d.file){
      if(d.file.size<10 || d.file.size>MAX_BYTES || !/\.pdf$/i.test(d.file.name)){
        status(card,'Selecione um PDF válido de até 15 MB.',true);return;
      }
      const magic=String.fromCharCode(...new Uint8Array(await d.file.slice(0,5).arrayBuffer()));
      if(magic!=='%PDF-'){status(card,'O arquivo não possui assinatura de PDF válida.',true);return;}
    }
    const currentRow=(records||[]).find(r=>r.id===row.id);
    const client=(records||[]).find(r=>r.id===row.data.clientId && r.kind==='client');
    if(!client || currentRow?.data?.clientId!==client.id){
      status(card,'Ficha do cliente não encontrada. Nada foi enviado.',true);return;
    }
    inFlight.add(id);
    const btn=card.querySelector('[data-action=save]');
    if(btn)btn.disabled=true;
    let uploaded=false,key='',fileHash='',documentId='',submissionId='';
    status(card,'Conferindo o preenchimento…');
    try{
      if(d.file){
        fileHash=await sha256(d.file);
        const existingDoc=(records||[]).find(r=>r.kind==='document' &&
          r.data?.clientId===client.id && r.data?.fileSha256===fileHash);
        if(existingDoc)throw Error('Este PDF já está vinculado à ficha do cliente. Não foi duplicado.');
        // A prévia é somente validação; não altera seguro ou parcelas.
        status(card,'Lendo e verificando o PDF…');
        try {
          const preview=await api('proposal-preview',d.file,{raw:true,headers:{'content-type':'application/pdf'}});
          const found=String(preview?.preview?.fields?.insuredDocument?.value||'').replace(/\D/g,'');
          const expected=String(client.data?.document||'').replace(/\D/g,'');
          if(found && expected && [11,14].includes(found.length) && found!==expected)
            throw new Error('CPF/CNPJ da renovação diferente da ficha selecionada. Selecione o cliente correto.');
        } catch(error) {
          if(/CPF\/CNPJ da renova/.test(String(error?.message||'')))throw error;
          // Erros de leitura não autorizam cadastro de nova vigência. Anexo segue para revisão.
        }
        documentId=crypto.randomUUID();
        const stamp=new Date().toISOString();
        key='clients/'+client.id+'/'+stamp.slice(0,4)+'/'+stamp.slice(5,7)+'/'+documentId+'-'+d.file.name.replace(/[^A-Za-z0-9._-]/g,'-');
        status(card,'Enviando PDF ao armazenamento privado…');
        await api('storage-put',d.file,{raw:true,key,headers:{'content-type':'application/pdf'}});
        uploaded=true;
      }
      const stamp=new Date().toISOString();
      submissionId=crypto.randomUUID();
      const data={
        historicalRecordId:row.id,clientId:client.id,clientName:nameOf(client),
        previousNumber:String(row.data?.number||''),status:'Aguardando conferência',
        source:'Formulario de produtores historicos - 2026-10-25',
        ...(hasProducer?{requestedProducerId:d.producerId,requestedCommissionPercent:percentage}:{}),
        renewalPdfReceived:Boolean(d.file),
        ...(d.file?{storageKey:key,documentId,filename:d.file.name,fileSha256:fileHash}:{}),
        submittedAt:stamp,
        reviewRequired:true,financialChangesApplied:false,
        historicContractModified:false,newRenewalContractCreated:false
      };
      const operations=[];
      if(d.file){
        operations.push({type:'insert',id:documentId,kind:'document',data:{
          clientId:client.id,contractId:'',proposalId:'',policyId:'',
          renewalOf:row.id,sourceContractId:row.id,
          name:d.file.name,originalFileName:d.file.name,
          documentType:'Renovação — conferência pendente',
          storageKey:key,mimeType:'application/pdf',fileSize:d.file.size,
          fileSha256:fileHash,status:'Recebido para conferência',source:'Formulário de históricos sem produtor',
          referenceDate:stamp.slice(0,10),
          extractionReviewRequired:true,notes:'PDF da renovação apresentado para o contrato histórico '+String(row.data?.number||'')
        },version:1,created_at:stamp,updated_at:stamp});
      }
      operations.push({type:'insert',id:submissionId,kind:'historical_review_submission',data,
        version:1,created_at:stamp,updated_at:stamp});
      status(card,'Registrando protocolo de conferência…');
      await api('write',{ops:operations});
      uploaded=false;
      status(card,'Recebido e registrado para conferência. Nenhuma vigência anterior ou comissão foi alterada.');
      // Atualização apenas da lista em memória para evitar duplicidade na mesma sessão.
      records.push({id:submissionId,kind:'historical_review_submission',data,version:1});
      if(d.file){
        records.push({id:documentId,kind:'document',data:{clientId:client.id,fileSha256:fileHash,storageKey:key},version:1});
      }
      d.file=null;
      if(card.querySelector('[data-field=file]'))card.querySelector('[data-field=file]').value='';
      if(card.querySelector('[data-file-name]'))card.querySelector('[data-file-name]').textContent='PDF recebido — selecione outro somente se necessário';
      const done=card.querySelector('[data-action=save]');
      if(done)done.textContent='Enviar outro registro';
    }catch(error){
      status(card,'Não concluído: '+String(error?.message||error)+(uploaded?' O PDF foi recebido, mas faltou vincular o registro; informe o suporte antes de reenviar.':''),true);
    }finally{
      inFlight.delete(id);if(btn)btn.disabled=false;
    }
  }
  document.addEventListener('change',e=>{
    const target=e.target;
    const row=target?.closest?.('[data-record-id]');
    if(!row)return;
    const d=draftOf(row.dataset.recordId),field=target.dataset.field;
    if(field==='producerId'||field==='commission')d[field]=target.value;
    if(field==='file'){
      d.file=target.files?.[0]||null;
      row.querySelector('[data-file-name]').textContent=d.file ? d.file.name+' ('+(d.file.size/1048576).toFixed(1)+' MB)' : 'Nenhum PDF selecionado';
    }
  });
  document.addEventListener('click',e=>{
    const btn=e.target.closest?.(ROOT+' [data-action]');
    if(!btn)return;
    const action=btn.dataset.action;
    if(action==='prev'){page=Math.max(0,page-1);draw();}
    if(action==='next'){page+=1;draw();}
    if(action==='save'){const card=btn.closest('[data-record-id]');if(card)saveRow(card.dataset.recordId,card);}
  });
  menu.push([VIEW,'Históricos sem produtor']);
  NAV_GROUPS.find(group=>group[0]==='Operação')?.[1].push(VIEW);
  PAGE_CONTEXT[VIEW]='Conferência de produtores e anexos PDF de renovações diretamente nos clientes existentes.';
  const previousNavigate=navigate;
  navigate=function(view){
    if(view===VIEW){
      previousNavigate('imports');
      current=VIEW;
      renderNav();
      document.querySelector('#importView')?.classList.add('hidden');
      $root()?.classList.remove('hidden');
      document.querySelector('#newBtn')?.classList.add('hidden');
      document.querySelector('#pageTitle').textContent='Históricos sem produtor';
      document.querySelector('#pageContext').textContent=PAGE_CONTEXT[VIEW];
      draw();
    }else{
      $root()?.classList.add('hidden');
      previousNavigate(view);
    }
  };
})();
