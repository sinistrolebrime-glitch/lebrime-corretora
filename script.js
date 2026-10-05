const API='https://paiezoesntmicnwcmemt.supabase.co/functions/v1/lebrime-api';
const TOKEN_KEY='lebrime_token_v1';
const THEME_KEY='lebrime_theme_v1';
const CUTOFF='2026-10';

const menu=[
  ['overview','Visão geral'],
  ['client','Clientes'],
  ['producer','Produtores'],
  ['insurance','Propostas e Apólices'],
  ['payment','Central de parcelas'],
  ['commission','Comissões'],
  ['renewal','Renovações'],
  ['task','Pendências'],
  ['document','Documentos'],
  ['imports','Arquivos'],
  ['integrations','Integrações']
];

const NAV_GROUPS=[
  ['Executivo',['overview']],
  ['Carteira',['client','producer','insurance','renewal']],
  ['Financeiro',['payment','commission']],
  ['Operação',['task','document','imports']],
  ['Integrações',['integrations']]
];

const PAGE_CONTEXT={
  overview:'Visão executiva da operação, carteira e financeiro.',
  client:'Cadastro mestre e visão 360º dos segurados.',
  producer:'Produção, carteira e resultado por produtor.',
  insurance:'Gestão unificada de propostas e apólices.',
  payment:'Previsões, parcelas efetivas e acompanhamento financeiro.',
  commission:'Comissões recebidas, repasses e resultado da Lebrime.',
  renewal:'Agenda comercial e acompanhamento das próximas renovações.',
  task:'Pendências operacionais e próximos passos da equipe.',
  document:'Biblioteca documental vinculada à carteira.',
  imports:'Entrada e vinculação de documentos aos contratos.',
  integrations:'Conectores oficiais com seguradoras e trilha de sincronização.'
};

const NEW_LABELS={
  client:'+ Novo cliente',
  producer:'+ Novo produtor',
  insurance:'+ Nova proposta/apólice',
  payment:'+ Nova parcela',
  task:'+ Nova pendência',
  document:'+ Novo documento'
};

const SEARCH_LABELS={
  client:'Pesquisar nome, CPF/CNPJ, placa, proposta ou apólice...',
  producer:'Pesquisar produtor...',
  insurance:'Pesquisar cliente, proposta, apólice...',
  payment:'Pesquisar parcela ou cliente...',
  commission:'Pesquisar comissão, cliente, produtor...',
  renewal:'Pesquisar renovação...',
  task:'Pesquisar pendência...',
  document:'Pesquisar documento...'
};

const brokerages=['Lebrime','FF Apolinário','Homeni Corretora','Eólica Corretora'];
const insurers=['Porto','Allianz','Zurich','HDI','Tokio Marine','Yelum','MAPFRE','Bradesco','Suhai','Ezze','Sura','Berkley','Fator','Akad','Aliro','Avla','Potencial','Aruana','Chubb','Junto'];
const branches=['Automóvel','Frota','Residencial','Empresarial','Multirrisco','Acidentes Pessoais','Vida','Seguro Garantia','Responsabilidade Civil','RC Profissional','RC Obras','RC Empregador','Fiança Locatícia','Transporte','Riscos Nomeados e Operacionais','Riscos de Engenharia','Equipamentos','Condomínio','Cyber','D&O','E&O','Riscos Diversos','Outros'];

let records=[];
let current='overview';
let editing=null;
let uploadPrefill={clientId:'',insuranceId:''};

const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

const currentTheme=()=>document.documentElement.dataset.theme==='dark'?'dark':'light';
function syncThemeControl(){
  const btn=$('#themeToggle');
  const label=$('#themeToggleText');
  if(!btn||!label)return;
  const theme=currentTheme();
  label.textContent=theme==='dark'?'Escuro':'Claro';
  btn.setAttribute('aria-pressed',theme==='dark'?'true':'false');
  btn.setAttribute('title',theme==='dark'?'Mudar para modo claro':'Mudar para modo escuro');
}
function applyTheme(theme,{persist=true}={}){
  const next=theme==='dark'?'dark':'light';
  document.documentElement.dataset.theme=next;
  document.documentElement.style.colorScheme=next;
  if(persist)localStorage.setItem(THEME_KEY,next);
  syncThemeControl();
}
function toggleTheme(){
  applyTheme(currentTheme()==='dark'?'light':'dark');
}

const token=()=>localStorage.getItem(TOKEN_KEY)||'';
const uuid=()=>crypto.randomUUID();
const now=()=>new Date().toISOString();
const today=()=>new Date().toISOString().slice(0,10);
const digits=v=>String(v||'').replace(/\D/g,'');
const norm=v=>String(v||'').trim().toLocaleLowerCase('pt-BR');
const fold=v=>norm(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format((Number(v)||0)/100);
const parseMoney=v=>Math.max(0,Math.round(Number(String(v||'').replace(/\./g,'').replace(',','.').replace(/[^0-9.-]/g,''))*100)||0);
const date=v=>v?new Intl.DateTimeFormat('pt-BR',{timeZone:'UTC'}).format(new Date(v+'T12:00:00Z')):'—';
const rowById=id=>records.find(r=>r.id===id);
const dataById=id=>rowById(id)?.data||{};
const nameById=id=>dataById(id).name||dataById(id).number||'—';
const list=kind=>records.filter(r=>r.kind===kind);
const insuranceDocuments=insurance=>list('document').filter(d=>
  String(d.data.policyId||'')===insurance.id||String(d.data.proposalId||'')===insurance.id
);
const primaryInsuranceDocument=insurance=>{
  const docs=insuranceDocuments(insurance);
  const expected=insurance.kind==='policy'?'Apólice':'Proposta';
  return docs.find(d=>d.data.storageKey&&String(d.data.documentType||'')===expected)
    ||docs.find(d=>d.data.storageKey)
    ||docs.find(d=>String(d.data.documentType||'')===expected)
    ||docs[0]
    ||null;
};

const isInsuranceActive=insurance=>{
  const status=fold(insurance?.data?.status||'');
  if(['cancelada','cancelado','recusada','recusado','convertida','convertido','perdida','perdido'].includes(status))return false;
  return !insurance?.data?.end||insurance.data.end>=today();
};

const activeInsuranceRows=()=>[...list('proposal'),...list('policy')].filter(isInsuranceActive);

const insuranceRowsForClient=clientId=>[...list('proposal'),...list('policy')]
  .filter(r=>String(r.data.clientId||'')===String(clientId||''));

const linkedToInsurance=(row,insurance)=>{
  if(!row||!insurance)return false;
  return insurance.kind==='policy'
    ?String(row.data?.policyId||'')===String(insurance.id)
    :String(row.data?.proposalId||'')===String(insurance.id);
};

const clientSearchText=client=>{
  const insurances=insuranceRowsForClient(client.id);
  const ids=new Set(insurances.map(r=>r.id));
  const items=list('insuredItem').filter(r=>
    ids.has(String(r.data.policyId||''))||ids.has(String(r.data.proposalId||''))
  );
  return fold([
    JSON.stringify(client.data||{}),
    ...insurances.map(r=>JSON.stringify(r.data||{})),
    ...items.map(r=>JSON.stringify(r.data||{}))
  ].join(' '));
};

const genericSearchText=row=>fold(
  JSON.stringify(row.data||{})+' '+nameById(row.data?.clientId)+' '+nameById(row.data?.producerId)
);

function matchingClients(query){
  const q=fold(query);
  if(!q)return [];
  return list('client')
    .filter(r=>clientSearchText(r).includes(q))
    .sort((a,b)=>String(a.data.name||'').localeCompare(String(b.data.name||''),'pt-BR'));
}

function renderSearchSuggestions(){
  const root=$('#searchSuggestions');
  if(!root)return;
  if(current!=='client'){
    root.classList.add('hidden');root.innerHTML='';return;
  }
  const q=$('#searchInput').value.trim();
  if(!q){
    root.classList.add('hidden');root.innerHTML='';return;
  }
  const matches=matchingClients(q).slice(0,8);
  root.innerHTML=matches.length?matches.map(client=>{
    const ins=insuranceRowsForClient(client.id);
    const ids=new Set(ins.map(r=>r.id));
    const plates=list('insuredItem')
      .filter(r=>ids.has(String(r.data.policyId||''))||ids.has(String(r.data.proposalId||'')))
      .map(r=>r.data.plate).filter(Boolean).slice(0,3);
    const contracts=ins.map(r=>r.data.number).filter(Boolean).slice(0,3);
    const secondary=[client.data.document,...plates,...contracts].filter(Boolean).join(' · ');
    return `<button type="button" class="search-suggestion" data-search-client="${client.id}">
      <strong>${esc(client.data.name||'Cliente')}</strong>
      <span>${esc(secondary||'Cadastro do cliente')}</span>
    </button>`;
  }).join(''):'<div class="search-suggestion-empty">Nenhum cliente localizado.</div>';
  root.classList.remove('hidden');
  root.querySelectorAll('[data-search-client]').forEach(b=>b.onclick=()=>{
    root.classList.add('hidden');
    openClientDetail(b.dataset.searchClient);
  });
}
const producerLabelOf=insurance=>{
  if(insurance?.data?.producerId)return nameById(insurance.data.producerId);
  if(insurance?.kind==='proposal'&&insurance?.data?.producerPending)return 'Pendente — preencher';
  return '—';
};
const insuranceLabel=insurance=>{
  const type=insurance.kind==='policy'?'Apólice':'Proposta';
  return `${type} ${insurance.data.number||'sem número'} · ${insurance.data.insurer||'—'} · ${insurance.data.branch||'—'}`;
};

const BUSINESS_RULES={
  producerPercent:60,
  lebrimePercent:40,
  ffPercent:30,
  fullCommissionProducer:'Leandro',
  ffBrokerageMatchers:['ff apolinario','homeni','eolica'],
  migrationCutoff:CUTOFF
};

const isLeandro=producerId=>
  fold(nameById(producerId))===fold(BUSINESS_RULES.fullCommissionProducer);

const brokerageNamesOf=insurance=>
  String(insurance?.data?.brokerages||insurance?.data?.brokerage||'')
    .split('|').map(v=>fold(v)).filter(Boolean);

const usesFfRule=insurance=>{
  const names=brokerageNamesOf(insurance);
  return names.some(name=>BUSINESS_RULES.ffBrokerageMatchers.some(match=>name.includes(match)));
};

const netPremiumOf=insurance=>Number(insurance?.data?.netPremium||0);
const commissionPercentOf=insurance=>Number(insurance?.data?.commissionPercent||0);
const commissionValueOf=insurance=>Math.round(netPremiumOf(insurance)*commissionPercentOf(insurance)/100);

const commissionBreakdown=insurance=>{
  const gross=commissionValueOf(insurance);
  const ffPercent=usesFfRule(insurance)?BUSINESS_RULES.ffPercent:0;
  const ffFee=Math.round(gross*ffPercent/100);
  const afterFf=Math.max(0,gross-ffFee);
  const leandro=isLeandro(insurance?.data?.producerId);
  const producerPercent=leandro?(100-ffPercent):BUSINESS_RULES.producerPercent;
  const producerExpected=leandro
    ?afterFf
    :Math.round(gross*BUSINESS_RULES.producerPercent/100);
  const lebrimePercent=leandro?0:BUSINESS_RULES.lebrimePercent;
  const lebrimeFee=leandro?0:Math.round(gross*BUSINESS_RULES.lebrimePercent/100);
  const lebrimeNet=Math.max(0,lebrimeFee-ffFee);
  return {gross,ffPercent,ffFee,afterFf,producerPercent,producerExpected,lebrimePercent,lebrimeFee,lebrimeNet};
};

const producerCommissionOf=insurance=>commissionBreakdown(insurance).producerExpected;
const ffFeeOf=insurance=>commissionBreakdown(insurance).ffFee;
const lebrimeFeeOf=insurance=>commissionBreakdown(insurance).lebrimeFee;
const lebrimeNetOf=insurance=>commissionBreakdown(insurance).lebrimeNet;

const importedInsuranceDocument=insurance=>{
  if(!insurance||!['proposal','policy'].includes(insurance.kind))return null;
  const expected=insurance.kind==='policy'?'apólice':'proposta';
  return insuranceDocuments(insurance).find(d=>
    d.data.storageKey&&fold(d.data.documentType||'').includes(fold(expected))
  )||null;
};

const importedInsuranceDate=insurance=>{
  const doc=importedInsuranceDocument(insurance);
  return doc?.createdAt?.slice(0,10)||doc?.data?.migratedAt?.slice(0,10)||today();
};

const importedInsuranceSource=insurance=>
  insurance?.kind==='policy'?'Importação da apólice':'Importação da proposta';

const producerInsurances=producerId=>[...list('proposal'),...list('policy')]
  .filter(r=>String(r.data.producerId||'')===String(producerId||''));

const producerClients=producerId=>{
  const ids=[...new Set(producerInsurances(producerId).map(r=>String(r.data.clientId||'')).filter(Boolean))];
  return ids.map(rowById).filter(Boolean);
};

const commissionForInsurance=insurance=>list('commission').find(c=>
  (insurance?.kind==='policy'&&String(c.data.policyId||'')===String(insurance.id))||
  (insurance?.kind==='proposal'&&String(c.data.proposalId||'')===String(insurance.id))
)||null;

const daysUntil=v=>v?Math.ceil((new Date(v+'T12:00:00Z')-new Date(today()+'T12:00:00Z'))/86400000):null;

const renewalTrackerFor=r=>list('renewal').find(t=>
  (r.kind==='policy'&&String(t.data.policyId||'')===String(r.id))||
  (r.kind==='proposal'&&String(t.data.proposalId||'')===String(r.id))
)||null;

const automaticRenewalPriority=r=>{
  if(r.kind==='proposal')return 'Alta';
  const d=daysUntil(r.data.end);
  if(d===null)return 'Baixa';
  if(d<=30)return 'Crítica';
  if(d<=60)return 'Alta';
  if(d<=90)return 'Média';
  return 'Baixa';
};

const renewalStatus=r=>{
  const tracker=renewalTrackerFor(r);
  if(tracker?.data?.status)return tracker.data.status;
  if(r.kind==='proposal')return `Em renovação · ${r.data.status||'Em andamento'}`;
  const d=daysUntil(r.data.end);
  if(d===null)return 'Sem vigência';
  if(d<0)return 'Vencida';
  return 'A iniciar';
};

const renewalPriority=r=>renewalTrackerFor(r)?.data?.priority||automaticRenewalPriority(r);
const renewalNextAction=r=>renewalTrackerFor(r)?.data?.nextAction||'—';
const renewalNextActionDate=r=>renewalTrackerFor(r)?.data?.nextActionDate||'';

let renewalFilters={dateFrom:'',dateTo:'',producer:'all',insurer:'all',branch:'all',brokerage:'all',status:'all'};

async function api(action,body={},opts={}){
  const headers={...(opts.headers||{})};
  if(token())headers.authorization='Bearer '+token();
  if(!(opts.raw))headers['content-type']='application/json';
  const r=await fetch(API+'?action='+encodeURIComponent(action)+(opts.key?'&key='+encodeURIComponent(opts.key):''),{
    method:opts.method||'POST',headers,body:opts.raw?body:JSON.stringify(body)
  });
  if(opts.blob){
    if(!r.ok)throw new Error('Não foi possível abrir o arquivo.');
    return await r.blob();
  }
  const j=await r.json().catch(()=>({}));
  if(r.status===401&&action!=='login'){logout();throw new Error('Sua sessão expirou. Entre novamente.');}
  if(!r.ok)throw new Error(j.error||'Falha na operação.');
  return j;
}

async function login(password){
  const j=await api('login',{password});
  localStorage.setItem(TOKEN_KEY,j.token);
  await boot();
}

function logout(){
  localStorage.removeItem(TOKEN_KEY);
  $('#appView').classList.add('hidden');
  $('#loginView').classList.remove('hidden');
}

function commissionReconcileOps(){
  const stamp=now();
  const ops=[];
  for(const insurance of [...list('proposal'),...list('policy')]){
    const netPremium=netPremiumOf(insurance);
    const commissionPercent=commissionPercentOf(insurance);
    const producerId=insurance.data.producerId||'';

    // Never invent producer, percentage or commission.
    if(!netPremium||!commissionPercent||!producerId)continue;

    const calc=commissionBreakdown(insurance);
    const expected=calc.gross;
    const {ffPercent,ffFee,afterFf,producerPercent,producerExpected,lebrimePercent,lebrimeFee,lebrimeNet}=calc;
    const existing=commissionForInsurance(insurance);
    const importedDoc=importedInsuranceDocument(insurance);
    const imported=Boolean(importedDoc);

    const ffRule=ffPercent
      ?'Corretora FF Apolinário/Homeni/Eólica: Taxa FF = 30% da comissão bruta e é suportada pela Lebrime.'
      :'Corretora Lebrime: sem Taxa FF.';
    const producerRule=isLeandro(producerId)
      ?(ffPercent
        ?'LEANDRO recebe 70% da comissão bruta; Taxa Lebrime = 0%.'
        :'LEANDRO recebe 100% da comissão bruta; Taxa Lebrime = 0%.')
      :'Produtor recebe 60% da comissão bruta. Taxa Lebrime = 40% da comissão bruta; a Taxa FF, quando houver, sai da parte da Lebrime.';
    const businessRule=ffRule+' '+producerRule;

    const data={
      ...(existing?.data||{}),
      clientId:insurance.data.clientId||'',
      policyId:insurance.kind==='policy'?insurance.id:'',
      proposalId:insurance.kind==='proposal'?insurance.id:'',
      producerId,
      netPremium,
      commissionPercent,
      expected,
      ffPercent,
      ffFee,
      afterFf,
      producerPercent,
      producerExpected,
      lebrimePercent,
      lebrimeFee,
      lebrimeNet,
      received:imported?afterFf:Number(existing?.data?.received||0),
      receivedDate:imported?importedInsuranceDate(insurance):(existing?.data?.receivedDate||''),
      receivedSource:imported?importedInsuranceSource(insurance):(existing?.data?.receivedSource||''),
      transferPaid:Number(existing?.data?.transferPaid||0),
      status:imported?'Recebida':(existing?.data?.status||'Prevista'),
      calculationRule:'Comissão bruta = prêmio líquido × percentual da proposta/apólice.',
      businessRule
    };

    if(existing){
      const keys=['clientId','policyId','proposalId','producerId','netPremium','commissionPercent','expected','ffPercent','ffFee','afterFf','producerPercent','producerExpected','lebrimePercent','lebrimeFee','lebrimeNet','received','receivedDate','receivedSource','status'];
      const changed=keys.some(k=>String(existing.data[k]??'')!==String(data[k]??''));
      if(changed)ops.push({type:'update',id:existing.id,kind:'commission',data,version:existing.version,updated_at:stamp,strict:true});
    }else{
      ops.push({type:'insert',id:uuid(),kind:'commission',data,version:1,created_at:stamp,updated_at:stamp});
    }
  }
  return ops;
}

async function loadRecords(){
  const read=async()=>{
    const j=await api('select',{orderUpdatedDesc:true});
    records=(j.rows||[]).map(r=>({...r,data:r.data||{},version:Number(r.version||1),createdAt:r.created_at,updatedAt:r.updated_at}));
  };
  await read();
  const ops=commissionReconcileOps();
  if(ops.length){
    await api('write',{ops});
    await read();
  }
}

async function boot(){
  if(!token()){logout();return;}
  try{
    await loadRecords();
    $('#loginView').classList.add('hidden');
    $('#appView').classList.remove('hidden');
    renderNav();
    navigate('overview');
  }catch(e){
    logout();
  }
}

function renderNav(){
  const labelOf=key=>menu.find(x=>x[0]===key)?.[1]||key;
  $('#nav').innerHTML=NAV_GROUPS.map(([group,items])=>`
    <div class="nav-group">
      <div class="nav-group-title">${group}</div>
      ${items.map(key=>`<button data-view="${key}" class="${current===key?'active':''}">${labelOf(key)}</button>`).join('')}
    </div>`
  ).join('');
  $('#nav').querySelectorAll('button').forEach(b=>b.onclick=()=>navigate(b.dataset.view));
}

function navigate(view){
  current=view;editing=null;renderNav();
  $('#dashboard').classList.toggle('hidden',view!=='overview');
  $('#listView').classList.toggle('hidden',view==='overview'||view==='imports'||view==='integrations');
  $('#importView').classList.toggle('hidden',view!=='imports');
  $('#integrationView').classList.toggle('hidden',view!=='integrations');
  $('#newBtn').classList.toggle('hidden',['overview','imports','integrations','commission','renewal'].includes(view));
  $('#newBtn').textContent=NEW_LABELS[view]||'+ Novo';
  $('#searchInput').value='';
  $('#searchInput').placeholder=SEARCH_LABELS[view]||'Pesquisar...';
  const suggestionRoot=$('#searchSuggestions');
  if(suggestionRoot){suggestionRoot.innerHTML='';suggestionRoot.classList.add('hidden');}
  const label=menu.find(x=>x[0]===view)?.[1]||'Lebrime';
  $('#pageTitle').textContent=label;
  if($('#pageContext'))$('#pageContext').textContent=PAGE_CONTEXT[view]||'';
  if(view==='overview')renderDashboard();
  else if(view==='imports')renderImportClients();
  else if(view==='integrations')renderIntegrations();
  else renderList();
}


const integrationDateTime=value=>{
  if(!value)return '—';
  try{return new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(value));}
  catch{return String(value);}
};

async function renderIntegrations(){
  const root=$('#integrationView');
  if(!root)return;
  root.innerHTML=`
    <div class="integration-heading">
      <div>
        <span class="section-kicker">Conectores oficiais</span>
        <h2>Integrações com seguradoras</h2>
        <p>Área técnica de conexão e auditoria. A operação entra automaticamente nos módulos da carteira; exceções vão para Pendências.</p>
      </div>
    </div>
    <div class="integration-grid">
      <article class="panel integration-card">
        <div class="integration-card-head">
          <div>
            <span class="integration-provider">PORTO</span>
            <h3>Arquivo de Retorno</h3>
            <p>Webservice SOAP 1.1 · propostas, emissões, comissões, cobrança e sinistros.</p>
          </div>
          <span class="status-pill corporate-status neutral">Consultando...</span>
        </div>
      </article>
      <article class="panel integration-card">
        <div class="integration-card-head">
          <div>
            <span class="integration-provider">ALLIANZ</span>
            <h3>DataTransfer</h3>
            <p>Envios diários configurados por e-mail. O conector será ativado após a chegada dos primeiros arquivos.</p>
          </div>
          <span class="status-pill corporate-status warning">Aguardando arquivos</span>
        </div>
      </article>
    </div>`;
  try{
    const status=await api('integration-status',{provider:'porto'});
    const porto=root.querySelector('.integration-card');
    const ready=Boolean(status.configured);
    const recent=Array.isArray(status.recentFiles)?status.recentFiles:[];
    const last=status.lastSync||null;
    porto.innerHTML=`
      <div class="integration-card-head">
        <div>
          <span class="integration-provider">PORTO</span>
          <h3>Arquivo de Retorno</h3>
          <p>Webservice SOAP 1.1 oficial da Porto, executado somente no backend.</p>
        </div>
        <span class="status-pill corporate-status ${ready?'success':'warning'}">${ready?'Pronto para sincronizar':'Credenciais pendentes'}</span>
      </div>
      <div class="integration-kpis">
        <div><span>Última sincronização</span><strong>${integrationDateTime(last?.finishedAt||last?.startedAt)}</strong></div>
        <div><span>Arquivos recebidos</span><strong>${Number(status.totalFiles||0)}</strong></div>
        <div><span>Exceções para tratar</span><strong>${Number(status.exceptionCount||0)}</strong></div>
        <div><span>Últimos 7 dias</span><strong>${Number(status.recentCount||0)}</strong></div>
        <div><span>Erros no último ciclo</span><strong>${Number(last?.errors||0)}</strong></div>
      </div>
      <div class="integration-actions">
        <button id="portoSyncBtn" class="btn primary" type="button" ${ready?'':'disabled'}>Sincronizar agora</button>
        <span class="muted">${ready
          ?'A sincronização aplica automaticamente os retornos com vínculo seguro. O que não puder ser identificado vai para Pendências.'
          :'Código implantado. Cadastre PORTO_SUSEP, PORTO_LOGIN e PORTO_PASSWORD nos segredos do Supabase para ativar.'}</span>
      </div>
      <div id="portoSyncStatus" class="status"></div>
      <div class="integration-files">
        <div class="integration-section-title">
          <strong>Arquivos recentes</strong>
          <span class="muted">Originais preservados para auditoria</span>
        </div>
        ${recent.length?recent.map(f=>`
          <div class="integration-file-row">
            <div><strong>${esc(f.name||'Arquivo Porto')}</strong><span>${esc(f.product||'—')} · ${esc(f.fileType||'—')}</span></div>
            <div><span>${integrationDateTime(f.generatedAt)}</span><span class="status-pill corporate-status ${f.status==='Erro'?'danger':'success'}">${f.status==='Erro'?'Erro':'Recebido'}</span></div>
          </div>`).join(''):'<div class="empty-state compact">Nenhum arquivo sincronizado ainda.</div>'}
      </div>`;
    const btn=$('#portoSyncBtn');
    if(btn)btn.onclick=syncPortoNow;
  }catch(e){
    const porto=root.querySelector('.integration-card');
    if(porto)porto.innerHTML=`
      <div class="integration-card-head">
        <div><span class="integration-provider">PORTO</span><h3>Arquivo de Retorno</h3><p>Não foi possível consultar o status do conector.</p></div>
        <span class="status-pill corporate-status danger">Erro</span>
      </div>
      <div class="error-text">${esc(e.message||e)}</div>`;
  }
}

async function syncPortoNow(){
  const btn=$('#portoSyncBtn');
  const status=$('#portoSyncStatus');
  if(btn){btn.disabled=true;btn.textContent='Sincronizando...';}
  if(status)status.textContent='Consultando a Porto e baixando somente arquivos ainda não processados...';
  try{
    const result=await api('porto-sync',{days:7});
    const p=result.processor||{};
    if(status)status.textContent=`Sincronização concluída: ${result.downloaded||0} novo(s), ${p.linked||0} aplicado(s) automaticamente e ${p.staged||0} exceção(ões) encaminhada(s) para Pendências.`;
    await loadRecords();
    await renderIntegrations();
  }catch(e){
    if(status)status.textContent=e.message||String(e);
    if(btn){btn.disabled=false;btn.textContent='Sincronizar agora';}
  }
}


function renderDashboard(){
  const activeInsurances=activeInsuranceRows();
  const payments=list('payment');
  const forecasts=payments.filter(r=>r.data.financialTracking==='Previsão da proposta'&&r.data.status!=='Cancelado');
  const open=payments.filter(r=>r.data.status==='Em aberto'&&r.data.financialTracking!=='Previsão da proposta');
  const overdue=open.filter(r=>r.data.due&&r.data.due<today());
  const renew60=activeInsurances.filter(r=>{
    if(!r.data.end)return false;
    const d=(new Date(r.data.end+'T12:00:00Z')-new Date(today()+'T12:00:00Z'))/86400000;
    return d>=0&&d<=60;
  });
  const comm=list('commission');
  const received=comm.reduce((s,r)=>s+Number(r.data.received||0),0);
  const paid=comm.reduce((s,r)=>s+Number(r.data.transferPaid||0),0);
  const gross=comm.reduce((s,r)=>s+Number(r.data.expected||0),0);
  const ff=comm.reduce((s,r)=>s+Number(r.data.ffFee||0),0);
  const producerExpected=comm.reduce((s,r)=>s+Number(r.data.producerExpected||0),0);
  const lebrimeNet=comm.reduce((s,r)=>s+Number(r.data.lebrimeNet||0),0);
  const activePremium=activeInsurances.reduce((s,r)=>s+Number(r.data.premium||0),0);
  const forecastTotal=forecasts.reduce((s,r)=>s+Number(r.data.amount||0),0);
  const activeProposals=activeInsurances.filter(r=>r.kind==='proposal').length;
  const activePolicies=activeInsurances.filter(r=>r.kind==='policy').length;
  const brokerRows=brokerages.map(name=>{
    const items=activeInsurances.filter(r=>String(r.data.brokerages||r.data.brokerage||'').split('|').includes(name));
    return {name,count:items.length,premium:items.reduce((sum,r)=>sum+Number(r.data.premium||0),0)};
  }).filter(r=>r.count>0);

  $('#dashboard').innerHTML=`
    <div class="executive-heading">
      <div>
        <span class="section-kicker">Resumo executivo</span>
        <h2>Carteira em números</h2>
        <p>Consolidado operacional e financeiro da Lebrime.</p>
      </div>
      <div class="as-of">Posição em ${date(today())}</div>
    </div>

    <div class="cards executive-cards">
      ${metric('Clientes',list('client').length,'Cadastro mestre')}
      ${metric('Carteira ativa',activeInsurances.length,`${activeProposals} propostas · ${activePolicies} apólices`)}
      ${metric('Prêmio em carteira',money(activePremium),'Total vigente')}
      ${metric('Previsão de parcelas',money(forecastTotal),`${forecasts.length} parcelas de propostas`)}
      ${metric('Comissões recebidas',money(received),'Reconhecidas no sistema')}
      ${metric('Resultado realizado',money(received-paid),'Recebida − paga ao produtor')}
    </div>

    <div class="operational-strip">
      <div class="operational-item">
        <span>Parcelas efetivas em aberto</span>
        <strong>${open.length}</strong>
        <small>${money(open.reduce((s,r)=>s+Number(r.data.amount||0),0))}</small>
      </div>
      <div class="operational-item ${overdue.length?'attention':''}">
        <span>Parcelas atrasadas</span>
        <strong>${overdue.length}</strong>
        <small>${money(overdue.reduce((s,r)=>s+Number(r.data.amount||0),0))}</small>
      </div>
      <div class="operational-item">
        <span>Renovações em 60 dias</span>
        <strong>${renew60.length}</strong>
        <small>Acompanhamento prioritário</small>
      </div>
    </div>

    <div class="dashboard-grid corporate-grid">
      <div class="panel">
        <div class="panel-head corporate-panel-head">
          <div><span class="section-kicker">Carteira</span><h2>Distribuição por corretora</h2></div>
          <button class="link-btn" data-go="insurance">Abrir carteira</button>
        </div>
        <div class="brokerage-summary">
          ${brokerRows.length?brokerRows.map(r=>`
            <div class="brokerage-summary-row">
              <div><strong>${esc(r.name)}</strong><span>${r.count} contrato(s) ativo(s)</span></div>
              <strong>${money(r.premium)}</strong>
            </div>`).join(''):'<div class="empty compact">Nenhuma carteira ativa.</div>'}
        </div>
      </div>

      <div class="panel">
        <div class="panel-head corporate-panel-head">
          <div><span class="section-kicker">Financeiro</span><h2>Comissões e repasses</h2></div>
          <button class="link-btn" data-go="commission">Abrir comissões</button>
        </div>
        <div class="finance-summary-grid">
          <div><span>Comissão bruta</span><strong>${money(gross)}</strong></div>
          <div><span>Recebida</span><strong>${money(received)}</strong></div>
          <div><span>Taxa FF</span><strong>${money(ff)}</strong></div>
          <div><span>Produtores</span><strong>${money(producerExpected)}</strong></div>
          <div><span>Líquido Lebrime</span><strong>${money(lebrimeNet)}</strong></div>
          <div><span>Pago a produtores</span><strong>${money(paid)}</strong></div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-head corporate-panel-head">
          <div><span class="section-kicker">Comercial</span><h2>Próximas renovações</h2></div>
          <button class="link-btn" data-go="renewal">Abrir central</button>
        </div>
        ${miniTable(renew60.sort((a,b)=>String(a.data.end).localeCompare(String(b.data.end))).slice(0,8),[
          ['Cliente',r=>nameById(r.data.clientId)],['Contrato',r=>r.data.number],['Ramo',r=>r.data.branch],['Fim',r=>date(r.data.end)]
        ])}
      </div>

      <div class="panel">
        <div class="panel-head corporate-panel-head">
          <div><span class="section-kicker">Financeiro</span><h2>Parcelas atrasadas</h2></div>
          <button class="link-btn" data-go="payment">Abrir parcelas</button>
        </div>
        ${miniTable(overdue.sort((a,b)=>String(a.data.due).localeCompare(String(b.data.due))).slice(0,8),[
          ['Cliente',r=>nameById(dataById(r.data.policyId||r.data.proposalId).clientId)],['Vencimento',r=>date(r.data.due)],['Valor',r=>money(r.data.amount)]
        ])}
      </div>
    </div>`;
  document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>navigate(b.dataset.go));
}
function statusTone(value){
  const v=fold(value);
  if(['recebida','pago','regularizado','ativa','aprovada','seguro novo'].some(x=>v.includes(x)))return 'success';
  if(['atrasad','cancel','recus','perdid'].some(x=>v.includes(x)))return 'danger';
  if(['em aberto','em analise','acompanhar','previsao','renovacao','pendente'].some(x=>v.includes(x)))return 'warning';
  if(['proposta','apolice','importacao'].some(x=>v.includes(x)))return 'info';
  return 'neutral';
}

function metric(title,value,sub){return `<div class="metric"><span>${title}</span><strong>${value}</strong><small>${sub}</small></div>`}
function miniTable(rows,cols){
  if(!rows.length)return '<div class="empty">Nenhum registro no período.</div>';
  return `<div class="mini-table">${rows.map(r=>`<div class="mini-row">${cols.map(c=>`<div><span>${c[0]}</span><strong>${esc(c[1](r)||'—')}</strong></div>`).join('')}</div>`).join('')}</div>`;
}

const config={
  client:{
    title:'Cliente',columns:[['Nome',r=>r.data.name],['CPF/CNPJ',r=>r.data.document],['Telefone',r=>r.data.phone],['Cidade',r=>[r.data.city,r.data.state].filter(Boolean).join('/')]],
    fields:[
      ['personType','Tipo','select',['Pessoa Jurídica','Pessoa Física']],['name','Nome / Razão social','text'],['fantasyName','Nome fantasia','text'],['document','CPF/CNPJ','text'],
      ['email','E-mail','email'],['phone','Telefone','text'],['responsible','Responsável','text'],['address','Endereço','text'],['city','Cidade','text'],['state','UF','text'],['notes','Observações','textarea']
    ]
  },
  producer:{
    title:'Produtor',
    columns:[
      ['Nome',r=>r.data.name],
      ['Clientes',r=>producerClients(r.id).length],
      ['Seguros',r=>producerInsurances(r.id).length],
      ['Comissão bruta',r=>money(producerInsurances(r.id).reduce((sum,i)=>sum+commissionValueOf(i),0))],
      ['Taxa FF',r=>money(producerInsurances(r.id).reduce((sum,i)=>sum+ffFeeOf(i),0))],
      ['Taxa Lebrime',r=>money(producerInsurances(r.id).reduce((sum,i)=>sum+lebrimeFeeOf(i),0))],
      ['Líquido Lebrime',r=>money(producerInsurances(r.id).reduce((sum,i)=>sum+lebrimeNetOf(i),0))],
      ['Comissão do produtor',r=>money(producerInsurances(r.id).reduce((sum,i)=>sum+producerCommissionOf(i),0))]
    ],
    fields:[['name','Nome','text'],['document','CPF/CNPJ','text'],['email','E-mail','email'],['phone','Telefone','text'],['notes','Observações','textarea']]
  },
  proposal:{
    title:'Proposta',columns:[['Cliente',r=>nameById(r.data.clientId)],['Número',r=>r.data.number],['Seguradora',r=>r.data.insurer],['Ramo',r=>r.data.branch],['Prêmio',r=>money(r.data.premium)],['Status',r=>r.data.status]],
    fields:businessFields('proposal')
  },
  policy:{
    title:'Apólice',columns:[['Cliente',r=>nameById(r.data.clientId)],['Número',r=>r.data.number],['Seguradora',r=>r.data.insurer],['Ramo',r=>r.data.branch],['Vigência',r=>date(r.data.end)],['Prêmio',r=>money(r.data.premium)],['Status',r=>r.data.status]],
    fields:businessFields('policy')
  },
  insurance:{
    title:'Seguro',
    columns:[
      ['Tipo',r=>r.kind==='policy'?'Apólice':'Proposta'],
      ['Operação',r=>r.data.policyType||'—'],
      ['Cliente',r=>nameById(r.data.clientId)],
      ['Número',r=>r.data.number],
      ['Seguradora',r=>r.data.insurer],
      ['Ramo',r=>r.data.branch],
      ['Produtor',r=>producerLabelOf(r)],
      ['Vigência',r=>date(r.data.end)],
      ['Prêmio',r=>money(r.data.premium)],
      ['Status',r=>r.data.status]
    ],
    fields:[
      ['_kind','Tipo de registro','select',['proposal','policy']],
      ['clientId','Cliente','ref','client'],
      ['producerId','Produtor','ref','producer'],
      ['brokerages','Corretoras','brokerages'],
      ['insurer','Seguradora','combo',insurers],
      ['branch','Ramo','combo',branches],
      ['subBranches','Ramos / seções internas','textarea'],
      ['number','Nº proposta / apólice','text'],
      ['policyType','Operação','select',['Seguro novo','Renovação','Cancelamento']],
      ['netPremium','Prêmio líquido','money'],
      ['premium','Prêmio total','money'],
      ['start','Início vigência','date'],
      ['end','Fim vigência','date'],
      ['status','Status','select',['Em elaboração','Enviada','Em análise','Aprovada','Recusada','Convertida','Ativa','Cancelada','Renovada']],
      ['commissionPercent','% comissão','number'],
      ['installmentCount','Qtd. parcelas','number'],
      ['paymentMethod','Forma de pagamento','select',['','Boleto','Débito em conta','Cartão de crédito','Cartão de débito','PIX','Transferência','Outro']],
      ['firstInstallmentAmount','Valor da 1ª parcela','money'],
      ['installmentAmount','Valor padrão das demais','money'],
      ['firstDueDate','1º vencimento (se conhecido)','date'],
      ['paymentDueText','Referência do vencimento','text'],
      ['notes','Observações','textarea']
    ]
  },
  payment:{
    title:'Parcela',columns:[['Cliente',r=>nameById(r.data.clientId||dataById(r.data.policyId||r.data.proposalId).clientId)],['Contrato',r=>nameById(r.data.policyId||r.data.proposalId)],['Origem',r=>r.data.financialTracking||'—'],['Parcela',r=>r.data.installment],['Vencimento',r=>r.data.due?date(r.data.due):(r.data.dueText||'—')],['Valor',r=>money(r.data.amount)],['Status',r=>r.data.status],['Cobrança',r=>r.data.collectionStatus]],
    fields:[
      ['policyId','Apólice','ref','policy'],['proposalId','Proposta','ref','proposal'],['installment','Parcela','text'],['amount','Valor','money'],['due','Vencimento','date'],
      ['status','Status','select',['Em aberto','Pago','Cancelado']],['paidDate','Data pagamento','date'],['paymentMethod','Forma','select',['','Boleto','Débito em conta','Cartão de crédito','Cartão de débito','PIX','Transferência','Outro']],
      ['collectionStatus','Cobrança','select',['Não iniciado','Acompanhar','Cliente avisado','Boleto solicitado','Boleto enviado','Comprovante recebido','Em tratativa','Regularizado','Não cobrar']],
      ['responsible','Responsável','text'],['notes','Observações','textarea']
    ]
  },
  commission:{
    title:'Comissão',
    columns:[
      ['Cliente',r=>nameById(r.data.clientId||dataById(r.data.policyId||r.data.proposalId).clientId)],
      ['Contrato',r=>nameById(r.data.policyId||r.data.proposalId)],
      ['Corretora',r=>String(dataById(r.data.policyId||r.data.proposalId).brokerages||dataById(r.data.policyId||r.data.proposalId).brokerage||'—').replace(/\|/g,' · ')],
      ['Produtor',r=>nameById(r.data.producerId)],
      ['Prêmio líquido',r=>money(r.data.netPremium)],
      ['%',r=>String(r.data.commissionPercent||0)+'%'],
      ['Comissão bruta',r=>money(r.data.expected)],
      ['Taxa FF',r=>money(r.data.ffFee)],
      ['Taxa Lebrime',r=>money(r.data.lebrimeFee)],
      ['Líquido Lebrime',r=>money(r.data.lebrimeNet)],
      ['Produtor %',r=>String(r.data.producerPercent||0)+'%'],
      ['Comissão produtor',r=>money(r.data.producerExpected)],
      ['Recebida pela Lebrime',r=>money(r.data.received)],
      ['Data recebimento',r=>date(r.data.receivedDate)],
      ['Status',r=>r.data.status||'Prevista'],
      ['Paga ao produtor',r=>money(r.data.transferPaid)],
      ['Lucro realizado',r=>money(Number(r.data.received||0)-Number(r.data.transferPaid||0))]
    ],
    fields:[
      ['policyId','Apólice','ref','policy'],['proposalId','Proposta','ref','proposal'],['producerId','Produtor','ref','producer'],
      ['received','Comissão recebida','money'],['due','Vencimento','date'],['receivedDate','Data recebimento','date'],
      ['transferPaid','Comissão paga ao produtor','money'],['transferDate','Data do pagamento ao produtor','date'],['notes','Observações','textarea']
    ]
  },
  renewal:{
    title:'Renovação',
    columns:[
      ['Origem',r=>r.kind==='proposal'?'Proposta de renovação':'Apólice'],
      ['Cliente',r=>nameById(r.data.clientId)],
      ['Número',r=>r.data.number],
      ['Seguradora',r=>r.data.insurer],
      ['Ramo',r=>r.data.branch],
      ['Produtor',r=>producerLabelOf(r)],
      ['Corretora',r=>String(r.data.brokerages||r.data.brokerage||'—').replace(/\|/g,' · ')],
      ['Vencimento',r=>date(r.data.end)],
      ['Prioridade',r=>renewalPriority(r)],
      ['Situação',r=>renewalStatus(r)],
      ['Dias',r=>r.kind==='policy'?(daysUntil(r.data.end)===null?'—':String(daysUntil(r.data.end))):'—'],
      ['Próxima ação',r=>renewalNextAction(r)],
      ['Data',r=>renewalNextActionDate(r)?date(renewalNextActionDate(r)):'—']
    ],
    fields:[
      ['clientId','Cliente','ref','client'],['policyId','Apólice','ref','policy'],['proposalId','Proposta','ref','proposal'],['producerId','Produtor','ref','producer'],
      ['status','Status','select',['A iniciar','Em cotação','Propostas recebidas','Enviado ao cliente','Em negociação','Renovado','Perdido','Não renovar']],
      ['priority','Prioridade','select',['Crítica','Alta','Média','Baixa']],
      ['nextAction','Próxima ação','text'],['nextActionDate','Data próxima ação','date'],['lastContactDate','Último contato','date'],
      ['lastContactChannel','Canal','select',['','Ligação','WhatsApp','E-mail','Reunião','Outro']],['notes','Observações','textarea']
    ]
  },
  claim:{
    title:'Sinistro',columns:[['Cliente',r=>nameById(r.data.clientId)],['Apólice',r=>nameById(r.data.policyId)],['Número',r=>r.data.number],['Ocorrência',r=>date(r.data.incidentDate)],['Tipo',r=>r.data.claimType],['Status',r=>r.data.status]],
    fields:[['clientId','Cliente','ref','client'],['policyId','Apólice','ref','policy'],['number','Número do sinistro','text'],['claimType','Tipo','text'],['incidentDate','Data ocorrência','date'],['status','Status','select',['Aviso','Em análise','Documentação pendente','Regulação','Indenização autorizada','Pago','Encerrado','Negado']],['description','Descrição','textarea'],['notes','Observações','textarea']]
  },
  insuredItem:{
    title:'Item / risco',columns:[['Contrato',r=>nameById(r.data.policyId||r.data.proposalId)],['Tipo',r=>r.data.itemType],['Descrição',r=>r.data.description],['Identificador',r=>r.data.plate||r.data.identifier],['Valor segurado',r=>money(r.data.insuredValue)]],
    fields:[['policyId','Apólice','ref','policy'],['proposalId','Proposta','ref','proposal'],['itemType','Tipo','select',['Veículo','Imóvel','Local de risco / filial','Equipamento','Contrato / objeto da garantia','Pessoa','Outro']],['description','Descrição','text'],['identifier','Identificador','text'],['plate','Placa','text'],['chassis','Chassi','text'],['makeModel','Marca / modelo','text'],['year','Ano','text'],['insuredValue','Valor segurado','money'],['address','Endereço','text'],['city','Cidade','text'],['state','UF','text'],['notes','Observações','textarea']]
  },
  coverage:{
    title:'Cobertura',columns:[['Contrato',r=>nameById(r.data.policyId||r.data.proposalId)],['Cobertura',r=>r.data.name],['Limite',r=>money(r.data.limit)],['Franquia',r=>r.data.deductible],['Status',r=>r.data.status]],
    fields:[['policyId','Apólice','ref','policy'],['proposalId','Proposta','ref','proposal'],['insuredItemId','Item segurado','ref','insuredItem'],['name','Cobertura','text'],['limit','Limite','money'],['deductible','Franquia','text'],['status','Status','select',['Ativa','Excluída']],['notes','Observações','textarea']]
  },
  task:{
    title:'Pendência',
    columns:[
      ['Título',r=>r.data.title],
      ['Cliente',r=>nameById(r.data.clientId)],
      ['Origem',r=>r.data.source||'Manual'],
      ['Destino',r=>r.data.destination||'—'],
      ['Responsável',r=>r.data.responsible],
      ['Prazo',r=>date(r.data.due)],
      ['Status',r=>r.data.status]
    ],
    fields:[
      ['title','Título','text'],['clientId','Cliente','ref','client'],['policyId','Apólice','ref','policy'],
      ['responsible','Responsável','text'],['due','Prazo','date'],
      ['status','Status','select',['Pendente','Aberta','Em andamento','Concluída']],
      ['notes','Observações','textarea']
    ]
  },
  document:{
    title:'Documento',columns:[['Cliente',r=>nameById(r.data.clientId)],['Nome',r=>r.data.name],['Tipo',r=>r.data.documentType],['Data',r=>date(r.data.referenceDate)],['Status',r=>r.data.status],['Arquivo',r=>r.data.storageKey?'Disponível':'—']],
    fields:[['clientId','Cliente','ref','client'],['policyId','Apólice','ref','policy'],['proposalId','Proposta','ref','proposal'],['name','Nome','text'],['documentType','Tipo','text'],['referenceDate','Data de referência','date'],['status','Status','select',['Recebido','Conferido','Pendente']],['notes','Observações','textarea']]
  }
};

function businessFields(kind){
  return [
    ['clientId','Cliente','ref','client'],['producerId','Produtor','ref','producer'],['brokerages','Corretoras','brokerages'],['insurer','Seguradora','combo',insurers],
    ['branch','Ramo','combo',branches],['subBranches','Ramos / seções internas','textarea'],['number',kind==='policy'?'Nº apólice':'Nº proposta','text'],
    ['policyType','Tipo','select',['Seguro novo','Renovação','Cancelamento']],['netPremium','Prêmio líquido','money'],['premium','Prêmio total','money'],['start','Início vigência','date'],['end','Fim vigência','date'],
    ['installmentCount','Qtd. parcelas','number'],['paymentMethod','Forma de pagamento','select',['','Boleto','Débito em conta','Cartão de crédito','Cartão de débito','PIX','Transferência','Outro']],['firstInstallmentAmount','Valor da 1ª parcela','money'],['installmentAmount','Valor padrão das demais','money'],['firstDueDate','1º vencimento (se conhecido)','date'],['paymentDueText','Referência do vencimento','text'],
    ['status','Status','select',kind==='policy'?['Ativa','Cancelada','Renovada']:['Em elaboração','Enviada','Em análise','Aprovada','Recusada','Convertida']],
    ['commissionPercent','% comissão','number'],['notes','Observações','textarea']
  ];
}

function renewalSourceRows(){
  return [
    ...list('proposal').filter(r=>norm(r.data.policyType)==='renovação'&&!['recusada','convertida'].includes(norm(r.data.status))),
    ...list('policy').filter(r=>!['cancelada','renovada'].includes(norm(r.data.status)))
  ];
}

function renewalFilterHtml(rows){
  const producerIds=[...new Set(rows.map(r=>r.data.producerId).filter(Boolean))];
  const insurerValues=[...new Set(rows.map(r=>r.data.insurer).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  const branchValues=[...new Set(rows.map(r=>r.data.branch).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  const brokerageValues=[...new Set(rows.flatMap(r=>String(r.data.brokerages||r.data.brokerage||'').split('|')).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  const statusValues=[...new Set(rows.map(r=>renewalStatus(r)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  return `
    <div class="renewal-filter-shell">
      <div class="renewal-period">
        <label>Vencimento inicial
          <input type="date" data-renew-filter="dateFrom" value="${esc(renewalFilters.dateFrom)}">
        </label>
        <label>Vencimento final
          <input type="date" data-renew-filter="dateTo" value="${esc(renewalFilters.dateTo)}">
        </label>
      </div>
      <div class="renewal-filters">
        <label>Produtor
          <select data-renew-filter="producer"><option value="all">Todos</option>${producerIds.map(id=>`<option value="${id}" ${renewalFilters.producer===id?'selected':''}>${esc(nameById(id))}</option>`).join('')}</select>
        </label>
        <label>Seguradora
          <select data-renew-filter="insurer"><option value="all">Todas</option>${insurerValues.map(v=>`<option value="${esc(v)}" ${renewalFilters.insurer===v?'selected':''}>${esc(v)}</option>`).join('')}</select>
        </label>
        <label>Ramo
          <select data-renew-filter="branch"><option value="all">Todos</option>${branchValues.map(v=>`<option value="${esc(v)}" ${renewalFilters.branch===v?'selected':''}>${esc(v)}</option>`).join('')}</select>
        </label>
        <label>Corretora
          <select data-renew-filter="brokerage"><option value="all">Todas</option>${brokerageValues.map(v=>`<option value="${esc(v)}" ${renewalFilters.brokerage===v?'selected':''}>${esc(v)}</option>`).join('')}</select>
        </label>
        <label>Status
          <select data-renew-filter="status"><option value="all">Todos</option>${statusValues.map(v=>`<option value="${esc(v)}" ${renewalFilters.status===v?'selected':''}>${esc(v)}</option>`).join('')}</select>
        </label>
      </div>
      <div class="renewal-filter-actions">
        <button type="button" class="btn ghost small" id="renewalClearFilters">Limpar filtros</button>
        <button type="button" class="btn ghost small" id="renewalExportCsv">Exportar Excel (CSV)</button>
        <button type="button" class="btn primary small" id="renewalPrintMirror">Gerar espelho</button>
      </div>
    </div>`;
}

function applyRenewalFilters(rows){
  return rows.filter(r=>{
    if(renewalFilters.producer!=='all'&&String(r.data.producerId||'')!==renewalFilters.producer)return false;
    if(renewalFilters.insurer!=='all'&&String(r.data.insurer||'')!==renewalFilters.insurer)return false;
    if(renewalFilters.branch!=='all'&&String(r.data.branch||'')!==renewalFilters.branch)return false;
    if(renewalFilters.brokerage!=='all'&&!String(r.data.brokerages||r.data.brokerage||'').split('|').includes(renewalFilters.brokerage))return false;
    if(renewalFilters.status!=='all'&&renewalStatus(r)!==renewalFilters.status)return false;
    const ref=String(r.data.end||'');
    if(renewalFilters.dateFrom&&(!ref||ref<renewalFilters.dateFrom))return false;
    if(renewalFilters.dateTo&&(!ref||ref>renewalFilters.dateTo))return false;
    return true;
  });
}

function filteredRenewalRows(){
  let rows=applyRenewalFilters(renewalSourceRows());
  const q=fold($('#searchInput')?.value||'');
  if(q)rows=rows.filter(r=>genericSearchText(r).includes(q));
  return rows.sort((a,b)=>String(a.data.end||'').localeCompare(String(b.data.end||'')));
}

function csvValue(value){
  let text=String(value??'');
  if(/^[=+\-@]/.test(text))text="'"+text;
  return '"'+text.replace(/"/g,'""')+'"';
}

function exportRenewalsCsv(){
  const rows=filteredRenewalRows();
  if(!rows.length){alert('Nenhuma renovação encontrada para os filtros selecionados.');return;}
  const headers=['Cliente','CPF/CNPJ','Tipo','Número','Seguradora','Ramo','Produtor','Corretora','Fim da vigência','Status','Prêmio'];
  const lines=[headers,...rows.map(r=>{
    const client=dataById(r.data.clientId);
    return [
      client.name||'',client.document||'',r.kind==='policy'?'Apólice':'Proposta de renovação',
      r.data.number||'',r.data.insurer||'',r.data.branch||'',producerLabelOf(r),
      String(r.data.brokerages||r.data.brokerage||'').replace(/\|/g,' / '),
      r.data.end||'',renewalStatus(r),(Number(r.data.premium||0)/100).toFixed(2).replace('.',',')
    ];
  })].map(row=>row.map(csvValue).join(';')).join('\r\n');
  const blob=new Blob(['\ufeff'+lines],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download=`renovacoes-${today()}.csv`;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function printRenewalMirror(){
  const rows=filteredRenewalRows();
  if(!rows.length){alert('Nenhuma renovação encontrada para os filtros selecionados.');return;}
  const period=[renewalFilters.dateFrom?date(renewalFilters.dateFrom):'',renewalFilters.dateTo?date(renewalFilters.dateTo):''].filter(Boolean).join(' a ')||'Todos os vencimentos';
  const win=window.open('','_blank');
  if(!win){alert('O navegador bloqueou a abertura do espelho. Permita pop-ups para este sistema.');return;}
  const body=rows.map(r=>`<tr>
    <td>${esc(nameById(r.data.clientId))}</td>
    <td>${esc(r.data.number||'—')}</td>
    <td>${esc(r.data.insurer||'—')}</td>
    <td>${esc(r.data.branch||'—')}</td>
    <td>${esc(producerLabelOf(r))}</td>
    <td>${esc(String(r.data.brokerages||r.data.brokerage||'—').replace(/\|/g,' · '))}</td>
    <td>${date(r.data.end)}</td>
    <td>${esc(renewalStatus(r))}</td>
  </tr>`).join('');
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Espelho de Renovações</title>
    <style>body{font-family:Arial,sans-serif;color:#162235;padding:28px}h1{font-size:22px;margin:0}p{color:#5f6b7a}table{width:100%;border-collapse:collapse;margin-top:22px;font-size:11px}th,td{border:1px solid #d9dee7;padding:7px;text-align:left}th{background:#f4f6f8}.head{display:flex;justify-content:space-between;gap:24px}.brand{font-weight:700;letter-spacing:.08em}</style>
    </head><body><div class="head"><div><div class="brand">LEBRIME CORRETORA DE SEGUROS</div><h1>Espelho de Renovações</h1><p>Período: ${esc(period)} · ${rows.length} registro(s)</p></div><div>Gerado em ${date(today())}</div></div>
    <table><thead><tr><th>Cliente</th><th>Contrato</th><th>Seguradora</th><th>Ramo</th><th>Produtor</th><th>Corretora</th><th>Vencimento</th><th>Status</th></tr></thead><tbody>${body}</tbody></table>
    <script>window.onload=()=>window.print()<\/script></body></html>`);
  win.document.close();
}

function commissionSummary(rows){
  const gross=rows.reduce((sum,r)=>sum+Number(r.data.expected||0),0);
  const ff=rows.reduce((sum,r)=>sum+Number(r.data.ffFee||0),0);
  const producer=rows.reduce((sum,r)=>sum+Number(r.data.producerExpected||0),0);
  const lebrime=rows.reduce((sum,r)=>sum+Number(r.data.lebrimeFee||0),0);
  const lebrimeNet=rows.reduce((sum,r)=>sum+Number(r.data.lebrimeNet||0),0);
  const received=rows.reduce((sum,r)=>sum+Number(r.data.received||0),0);
  const paid=rows.reduce((sum,r)=>sum+Number(r.data.transferPaid||0),0);
  return `
    <span class="chip">Comissão bruta: ${money(gross)}</span>
    <span class="chip">Taxa FF: ${money(ff)}</span>
    <span class="chip">Produtores: ${money(producer)}</span>
    <span class="chip">Taxa Lebrime: ${money(lebrime)}</span>
    <span class="chip">Líquido Lebrime: ${money(lebrimeNet)}</span>
    <span class="chip">Lucro realizado: ${money(received-paid)}</span>`;
}

function renderList(){
  const c=config[current];if(!c)return;
  let rows;
  const allRenewals=current==='renewal'?renewalSourceRows():[];

  if(current==='insurance')rows=[...list('proposal'),...list('policy')];
  else if(current==='renewal')rows=applyRenewalFilters(allRenewals);
  else rows=[...list(current)];

  const q=fold($('#searchInput').value);
  if(q)rows=rows.filter(r=>current==='client'?clientSearchText(r).includes(q):genericSearchText(r).includes(q));

  if(current==='payment')rows.sort((a,b)=>String(a.data.due||'').localeCompare(String(b.data.due||'')));
  if(current==='insurance')rows.sort((a,b)=>String(b.data.start||'').localeCompare(String(a.data.start||'')));
  if(current==='commission')rows.sort((a,b)=>String(nameById(a.data.producerId)).localeCompare(String(nameById(b.data.producerId)),'pt-BR'));
  if(current==='renewal')rows.sort((a,b)=>{
    if(a.kind!==b.kind)return a.kind==='proposal'?-1:1;
    return String(a.data.end||a.data.start||'').localeCompare(String(b.data.end||b.data.start||''));
  });

  $('#listMeta').textContent=`${rows.length} registro(s)`;
  if(current==='payment')$('#filters').innerHTML=paymentSummary(rows);
  else if(current==='commission')$('#filters').innerHTML=commissionSummary(rows);
  else if(current==='renewal')$('#filters').innerHTML=renewalFilterHtml(allRenewals);
  else if(current==='insurance'){
    const pendingProducer=rows.filter(r=>r.kind==='proposal'&&r.data.producerPending&&!r.data.producerId).length;
    $('#filters').innerHTML=pendingProducer
      ?`<span class="chip danger">Produtor pendente: ${pendingProducer}</span><span class="chip">Propostas Porto importadas exigem definição manual do produtor</span>`
      :'';
  }else $('#filters').innerHTML='';

  $('#tableHead').innerHTML='<tr>'+c.columns.map(x=>'<th>'+esc(x[0])+'</th>').join('')+'<th></th></tr>';
  $('#tableBody').innerHTML=rows.length?rows.map(r=>{
    const cells=c.columns.map((x,i)=>{
      const value=x[1](r)??'—';
      if(current==='client'&&i===0)return `<td><button class="name-link" data-client-detail="${r.id}">${esc(value)}</button></td>`;
      if(current==='producer'&&i===0)return `<td><button class="name-link" data-producer-detail="${r.id}">${esc(value)}</button></td>`;
      const label=x[0];
      if(current==='insurance'&&label==='Número')return `<td><button class="name-link" data-insurance-detail="${r.id}">${esc(value)}</button></td>`;
      if(current==='insurance'&&label==='Produtor'&&r.kind==='proposal'&&r.data.producerPending&&!r.data.producerId){
        return '<td><span class="status-pill corporate-status warning">Pendente — preencher</span></td>';
      }
      if(['Status','Cobrança','Operação','Origem'].includes(label)){
        const tone=statusTone(value);
        return `<td><span class="status-pill corporate-status ${tone}">${esc(value)}</span></td>`;
      }
      return '<td>'+esc(value)+'</td>';
    }).join('');

    const openFile=current==='document'&&r.data.storageKey?`<button data-open="${r.id}" class="link-btn">Abrir</button>`:'';
    const insuranceDoc=current==='insurance'?primaryInsuranceDocument(r):null;
    const insuranceFile=current==='insurance'
      ?(insuranceDoc?.data.storageKey
        ?`<button data-open="${insuranceDoc.id}" class="link-btn file-action">Abrir PDF</button>`
        :`<button data-insurance-upload="${r.id}" data-client-id="${r.data.clientId||''}" class="link-btn file-action">${insuranceDoc?'Regularizar PDF':'Anexar PDF'}</button>`)
      :'';

    const editAction=current==='renewal'
      ?`<button data-renewal-track="${r.id}" class="link-btn">${renewalTrackerFor(r)?'Atualizar acompanhamento':'Acompanhar'}</button><button data-renewal-edit="${r.id}" class="link-btn">Abrir seguro</button>`
      :current==='insurance'
        ?`<button data-insurance-detail="${r.id}" class="link-btn">Abrir ficha</button><button data-edit="${r.id}" class="link-btn">Editar</button>`
        :`<button data-edit="${r.id}" class="link-btn">Editar</button>`;

    return '<tr>'+cells+`<td class="actions">${editAction}${openFile}${insuranceFile}</td></tr>`;
  }).join(''):'<tr><td colspan="'+(c.columns.length+1)+'"><div class="empty">Nenhum registro encontrado.</div></td></tr>';

  document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openEditor(rowById(b.dataset.edit)));
  document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openDocument(rowById(b.dataset.open)));
  document.querySelectorAll('[data-insurance-upload]').forEach(b=>b.onclick=()=>openClientUpload(b.dataset.clientId,b.dataset.insuranceUpload));
  document.querySelectorAll('[data-client-detail]').forEach(b=>b.onclick=()=>openClientDetail(b.dataset.clientDetail));
  document.querySelectorAll('[data-producer-detail]').forEach(b=>b.onclick=()=>openProducerDetail(b.dataset.producerDetail));
  document.querySelectorAll('[data-insurance-detail]').forEach(b=>b.onclick=()=>openInsuranceDetail(b.dataset.insuranceDetail));
  document.querySelectorAll('[data-renewal-track]').forEach(b=>b.onclick=()=>openRenewalTracker(b.dataset.renewalTrack));
  document.querySelectorAll('[data-renewal-edit]').forEach(b=>b.onclick=()=>editInsuranceFromRenewal(b.dataset.renewalEdit));
  document.querySelectorAll('[data-renew-filter]').forEach(el=>el.onchange=()=>{
    renewalFilters[el.dataset.renewFilter]=el.value;
    renderList();
  });
  const clearRenewal=$('#renewalClearFilters');
  if(clearRenewal)clearRenewal.onclick=()=>{
    renewalFilters={dateFrom:'',dateTo:'',producer:'all',insurer:'all',branch:'all',brokerage:'all',status:'all'};
    renderList();
  };
  const exportRenewal=$('#renewalExportCsv');
  if(exportRenewal)exportRenewal.onclick=exportRenewalsCsv;
  const printRenewal=$('#renewalPrintMirror');
  if(printRenewal)printRenewal.onclick=printRenewalMirror;
}
function paymentSummary(rows){
  const forecast=rows.filter(r=>r.data.financialTracking==='Previsão da proposta'&&r.data.status!=='Cancelado');
  const relevant=rows.filter(r=>r.data.financialTracking!=='Previsão da proposta');
  const open=relevant.filter(r=>r.data.status==='Em aberto');
  const overdue=open.filter(r=>r.data.due&&r.data.due<today());
  return `<span class="chip">Previsões de propostas: ${forecast.length} · ${money(forecast.reduce((s,r)=>s+Number(r.data.amount||0),0))}</span><span class="chip">Em aberto: ${open.length} · ${money(open.reduce((s,r)=>s+Number(r.data.amount||0),0))}</span><span class="chip danger">Atrasadas: ${overdue.length} · ${money(overdue.reduce((s,r)=>s+Number(r.data.amount||0),0))}</span><span class="chip">Corte da implantação: ${CUTOFF}</span>`;
}

function editorConfig(){return config[current]}
function openEditor(entry=null){
  const c=editorConfig();if(!c)return;
  editing=entry;
  $('#editorTitle').textContent=(entry?'Editar ':'Novo ')+c.title;
  const values={...(entry?.data||{})};
  if(current==='insurance')values._kind=entry?.kind||'proposal';
  $('#editorFields').innerHTML=c.fields.map(f=>fieldHtml(f,values[f[0]])).join('');
  if(current==='insurance'){
    const kindSelect=document.querySelector('[name="_kind"]');
    if(kindSelect&&entry)kindSelect.disabled=true;
    if(entry?.kind==='proposal'&&entry?.data?.producerPending&&!entry?.data?.producerId){
      $('#editorFields').insertAdjacentHTML('afterbegin',`
        <div class="rule-callout span-2 producer-pending-callout">
          <strong>Produtor pendente</strong>
          <span>Esta proposta foi importada diretamente da Porto e o arquivo não informa o produtor. Selecione o produtor manualmente abaixo e salve.</span>
        </div>`);
    }
  }
  $('#editorError').textContent='';
  $('#editorDialog').showModal();
}

function fieldHtml(f,value){
  const [key,label,type,options]=f;
  const val=value??'';
  if(type==='textarea')return `<label class="span-2">${label}<textarea name="${key}" rows="3">${esc(val)}</textarea></label>`;
  if(type==='select')return `<label>${label}<select name="${key}">${(options||[]).map(o=>`<option value="${esc(o)}" ${String(val)===String(o)?'selected':''}>${esc(o||'Selecione')}</option>`).join('')}</select></label>`;
  if(type==='combo'){
    const listId=`list-${key}`;
    return `<label>${label}<input name="${key}" list="${listId}" value="${esc(val)}"><datalist id="${listId}">${(options||[]).map(o=>`<option value="${esc(o)}"></option>`).join('')}</datalist></label>`;
  }
  if(type==='ref'){
    const opts=list(options).map(r=>`<option value="${r.id}" ${String(val)===r.id?'selected':''}>${esc(r.data.name||r.data.number||r.id)}</option>`).join('');
    return `<label>${label}<select name="${key}"><option value="">Selecione</option>${opts}</select></label>`;
  }
  if(type==='brokerages'){
    const set=new Set(String(val||'').split('|').filter(Boolean));
    return `<fieldset class="span-2"><legend>${label}</legend><div class="checks">${brokerages.map(b=>`<label><input type="checkbox" name="brokerages_multi" value="${b}" ${set.has(b)?'checked':''}>${b}</label>`).join('')}</div></fieldset>`;
  }
  const inputType=type==='money'?'text':type;
  const display=type==='money'?(Number(val)?(Number(val)/100).toFixed(2).replace('.',','):''):val;
  return `<label>${label}<input name="${key}" type="${inputType}" value="${esc(display)}" ${key==='name'||key==='number'||key==='title'?'required':''}></label>`;
}

function formData(){
  const fd=new FormData($('#editorForm'));const out={};
  for(const [k,v] of fd.entries())if(k!=='brokerages_multi')out[k]=String(v).trim();
  const c=editorConfig();
  for(const f of c.fields){
    const [key,,type]=f;
    if(type==='money')out[key]=parseMoney(out[key]);
    if(type==='number')out[key]=Number(out[key]||0);
  }
  const bs=[...document.querySelectorAll('input[name="brokerages_multi"]:checked')].map(x=>x.value);
  if(c.fields.some(f=>f[2]==='brokerages')){
    out.brokerages=bs.join('|');
    out.brokerage=bs.length>1?'Múltiplas':(bs[0]||'');
  }
  return out;
}

function validateBeforeSave(data){
  if(current==='client'){
    const d=digits(data.document);
    if(d.length!==11&&d.length!==14)return 'Informe um CPF ou CNPJ válido em quantidade de dígitos.';
    const dup=list('client').find(r=>r.id!==editing?.id&&digits(r.data.document)===d);
    if(dup)return 'Já existe um cliente cadastrado com este CPF/CNPJ.';
  }
  if(current==='insurance'){
    const recordKind=editing?.kind||data._kind||'proposal';
    if(!data.clientId||!data.insurer||!data.branch||!data.number)return 'Preencha cliente, seguradora, ramo e número.';
    if(!String(data.brokerages||'').trim())return 'Selecione a corretora responsável por esta proposta/apólice.';
    if(Number(data.commissionPercent||0)>0&&!Number(data.netPremium||0))return 'Informe o prêmio líquido para calcular a comissão.';
    if(Number(data.installmentCount||0)>0&&!Number(data.premium||0))return 'Informe o prêmio total para gerar o plano de parcelas.';
    const dup=list(recordKind).find(r=>r.id!==editing?.id&&String(r.data.clientId)===String(data.clientId)&&norm(r.data.insurer)===norm(data.insurer)&&norm(r.data.number)===norm(data.number)&&norm(r.data.branch)===norm(data.branch)&&String(r.data.start||'')===String(data.start||'')&&String(r.data.end||'')===String(data.end||''));
    if(dup)return 'Já existe um registro com este cliente, seguradora, ramo, número e vigência.';
  }
  if(current==='payment'){
    if(!data.policyId&&!data.proposalId)return 'Vincule a parcela a uma apólice ou proposta.';
    if(data.policyId&&data.proposalId)return 'Use apenas apólice ou proposta.';
    const month=String(data.due||'').slice(0,7);
    if(data.proposalId){
      data.financialTracking='Previsão da proposta';
      data.migrationStatus='';
    }else{
      data.financialTracking='Acompanhamento financeiro';
      if(month&&month<CUTOFF&&data.status==='Em aberto'){
        data.status='Pago';data.migrationStatus='Paga — Migração';
        if(!data.paidDate)data.paidDate=data.due;
      }else data.migrationStatus='Acompanhar';
    }
  }
  return '';
}

async function saveCurrent(e){
  e.preventDefault();
  const entered=formData();
  const data=editing?{...(editing.data||{}),...entered}:entered;
  const err=validateBeforeSave(data);if(err){$('#editorError').textContent=err;return;}
  const id=editing?.id||uuid();const stamp=now();
  const recordKind=current==='insurance'?(editing?.kind||data._kind||'proposal'):current;
  delete data._kind;

  const ops=[];
  if(current==='insurance'&&recordKind==='proposal'&&data.producerPending){
    if(data.producerId){
      data.producerPending=false;
      data.producerAssignmentStatus='Definido manualmente';
      data.producerAssignmentSource='Manual';
      data.producerAssignedAt=stamp;
      data.producerPendingReason='';
      const task=list('task').find(t=>
        String(t.data.proposalId||'')===String(id)&&
        String(t.data.taskType||'')==='producer_assignment'&&
        !['Concluído','Concluida','Concluída','Regularizado'].includes(String(t.data.status||''))
      );
      if(task){
        ops.push({
          type:'update',id:task.id,kind:'task',
          data:{...task.data,status:'Concluído',resolvedAt:stamp,resolution:'Produtor definido manualmente na proposta.'},
          version:task.version,updated_at:stamp,strict:true
        });
      }
    }else{
      data.producerPending=true;
      data.producerAssignmentStatus='Pendente — preencher manualmente';
    }
  }

  const op=editing?{type:'update',id,kind:recordKind,data,version:editing.version,updated_at:stamp,strict:true}:{type:'insert',id,kind:recordKind,data,version:1,created_at:stamp,updated_at:stamp};
  ops.unshift(op);
  try{
    await api('write',{ops});
    $('#editorDialog').close();
    await loadRecords();renderList();if(current==='overview')renderDashboard();
  }catch(e){$('#editorError').textContent=e.message}
}

function openProducerDetail(producerId){
  const producer=rowById(producerId);if(!producer)return;
  const insurances=producerInsurances(producerId).sort((a,b)=>String(b.data.start||'').localeCompare(String(a.data.start||'')));
  const clients=producerClients(producerId);
  const totalGross=insurances.reduce((sum,r)=>sum+commissionValueOf(r),0);
  const totalFf=insurances.reduce((sum,r)=>sum+ffFeeOf(r),0);
  const totalProducer=insurances.reduce((sum,r)=>sum+producerCommissionOf(r),0);
  const totalLebrime=insurances.reduce((sum,r)=>sum+lebrimeFeeOf(r),0);
  const totalLebrimeNet=insurances.reduce((sum,r)=>sum+lebrimeNetOf(r),0);
  const special=isLeandro(producerId);
  const rule=special
    ?'LEANDRO: nas operações Lebrime recebe 100% da comissão bruta. Em FF Apolinário/Homeni/Eólica, recebe 70% e a Taxa FF fica com 30%. Taxa Lebrime = 0%.'
    :'Produtor recebe 60% da comissão bruta. Taxa Lebrime = 40%. Em FF Apolinário/Homeni/Eólica, a Taxa FF de 30% é descontada da parte da Lebrime, restando 10% líquido para a Lebrime.';

  const rows=insurances.length?insurances.map(r=>`
    <div class="producer-insurance-row">
      <div><span>Cliente</span><button class="name-link" data-producer-client="${r.data.clientId}">${esc(nameById(r.data.clientId))}</button></div>
      <div><span>Contrato</span><strong>${esc(r.data.number||'—')}</strong></div>
      <div><span>Tipo</span><strong>${r.kind==='policy'?'Apólice':'Proposta'}</strong></div>
      <div><span>Operação</span><strong>${esc(r.data.policyType||'—')}</strong></div>
      <div><span>Prêmio líquido</span><strong>${money(netPremiumOf(r))}</strong></div>
      <div><span>Comissão bruta</span><strong>${money(commissionValueOf(r))}</strong></div>
      <div><span>Taxa FF</span><strong>${money(ffFeeOf(r))}</strong></div>
      <div><span>Produtor</span><strong>${money(producerCommissionOf(r))}</strong></div>
      <div><span>Taxa Lebrime</span><strong>${money(lebrimeFeeOf(r))}</strong></div>
      <div><span>Líquido Lebrime</span><strong>${money(lebrimeNetOf(r))}</strong></div>
    </div>`).join(''):'<div class="empty compact">Nenhum cliente ou seguro vinculado a este produtor.</div>';

  $('#producerDetailTitle').textContent=producer.data.name||'Produtor';
  $('#producerDetailBody').innerHTML=`
    <div class="client-kpis">
      <div><span>Clientes</span><strong>${clients.length}</strong></div>
      <div><span>Seguros</span><strong>${insurances.length}</strong></div>
      <div><span>Comissão bruta</span><strong>${money(totalGross)}</strong></div>
      <div><span>Taxa FF</span><strong>${money(totalFf)}</strong></div>
      <div><span>Comissão do produtor</span><strong>${money(totalProducer)}</strong></div>
    </div>
    <div class="rule-callout"><strong>Regra do produtor</strong><span>${esc(rule)}</span><small>Taxa FF prevista: ${money(totalFf)} · Taxa Lebrime prevista: ${money(totalLebrime)} · Líquido Lebrime: ${money(totalLebrimeNet)}</small></div>
    <section class="detail-section">
      <div class="section-title-row"><div><h3>Clientes e seguros do produtor</h3><p>Clique no cliente para abrir a ficha completa.</p></div></div>
      <div class="producer-portfolio-list">${rows}</div>
    </section>`;
  $('#producerDialog').dataset.producerId=producerId;
  $('#producerDialog').showModal();
  document.querySelectorAll('[data-producer-client]').forEach(b=>b.onclick=()=>{
    $('#producerDialog').close();
    openClientDetail(b.dataset.producerClient);
  });
}

function editProducerFromDetail(){
  const id=$('#producerDialog').dataset.producerId;
  const producer=rowById(id);
  $('#producerDialog').close();
  current='producer';renderNav();
  openEditor(producer);
}

function openRenewalTracker(id){
  const insurance=rowById(id);if(!insurance)return;
  const tracker=renewalTrackerFor(insurance);
  current='renewal';renderNav();
  editing=tracker;
  $('#editorTitle').textContent=tracker?'Atualizar Renovação':'Acompanhar Renovação';
  const values={
    ...(tracker?.data||{}),
    clientId:insurance.data.clientId||'',
    policyId:insurance.kind==='policy'?insurance.id:'',
    proposalId:insurance.kind==='proposal'?insurance.id:'',
    producerId:insurance.data.producerId||'',
    status:tracker?.data?.status||'A iniciar',
    priority:tracker?.data?.priority||automaticRenewalPriority(insurance)
  };
  $('#editorFields').innerHTML=config.renewal.fields.map(f=>fieldHtml(f,values[f[0]])).join('');
  $('#editorError').textContent='';
  $('#editorDialog').showModal();
}

function editInsuranceFromRenewal(id){
  openInsuranceDetail(id);
}

function clientRelatedDocuments(clientId){
  const insurances=[...list('proposal'),...list('policy')].filter(r=>String(r.data.clientId||'')===String(clientId));
  const insuranceIds=new Set(insurances.map(r=>r.id));
  return list('document').filter(r=>String(r.data.clientId||'')===String(clientId)||insuranceIds.has(String(r.data.policyId||''))||insuranceIds.has(String(r.data.proposalId||'')));
}

function clientBrokerageOptions(insurances){
  return [...new Set(insurances.flatMap(r=>String(r.data.brokerages||r.data.brokerage||'').split('|')).filter(Boolean))]
    .sort((a,b)=>a.localeCompare(b,'pt-BR'));
}

function renderClientDetail(clientId,brokerageFilter='all'){
  const client=rowById(clientId);if(!client)return;
  const d=client.data;
  const allInsurances=insuranceRowsForClient(clientId)
    .sort((a,b)=>String(b.data.start||'').localeCompare(String(a.data.start||'')));
  const insurances=brokerageFilter==='all'
    ?allInsurances
    :allInsurances.filter(r=>String(r.data.brokerages||r.data.brokerage||'').split('|').includes(brokerageFilter));
  const insuranceIds=new Set(allInsurances.map(r=>r.id));
  const visibleInsuranceIds=new Set(insurances.map(r=>r.id));
  const docs=clientRelatedDocuments(clientId);
  const storedDocs=docs.filter(doc=>doc.data.storageKey);
  const activeInsurances=insurances.filter(isInsuranceActive);
  const totalPremium=activeInsurances.reduce((sum,r)=>sum+Number(r.data.premium||0),0);
  const payments=list('payment').filter(r=>
    visibleInsuranceIds.has(String(r.data.policyId||''))||
    visibleInsuranceIds.has(String(r.data.proposalId||''))||
    (brokerageFilter==='all'&&String(r.data.clientId||'')===String(clientId))
  );
  const openPayments=payments.filter(r=>r.data.status==='Em aberto'&&r.data.financialTracking!=='Previsão da proposta');
  const commissions=list('commission').filter(r=>
    visibleInsuranceIds.has(String(r.data.policyId||''))||visibleInsuranceIds.has(String(r.data.proposalId||''))
  );
  const tasks=list('task').filter(r=>
    visibleInsuranceIds.has(String(r.data.policyId||''))||
    visibleInsuranceIds.has(String(r.data.proposalId||''))||
    (brokerageFilter==='all'&&String(r.data.clientId||'')===String(clientId))
  ).filter(r=>!['Concluído','Concluída','Regularizado'].includes(String(r.data.status||'')));
  const renewals=renewalSourceRows().filter(r=>visibleInsuranceIds.has(r.id));
  const brokeragesForClient=clientBrokerageOptions(allInsurances);

  const insuranceHtml=insurances.length?insurances.map(r=>{
    const doc=primaryInsuranceDocument(r);
    const endorsementCount=insuranceDocuments(r).filter(x=>fold(x.data.documentType||'')==='endosso').length;
    const broker=String(r.data.brokerages||r.data.brokerage||'—').replace(/\|/g,' · ');
    const fileState=doc?.data.storageKey?'Arquivo disponível':doc?'PDF pendente':'Sem arquivo';
    return `
      <article class="insurance-card">
        <div class="insurance-card-head">
          <div><span class="record-type">${r.kind==='policy'?'APÓLICE':'PROPOSTA'}</span><h4>${esc(r.data.number||'Sem número')}</h4></div>
          <span class="status-pill corporate-status ${statusTone(r.data.status)}">${esc(r.data.status||'Cadastrado')}</span>
        </div>
        <div class="insurance-card-grid">
          <div><span>Seguradora</span><strong>${esc(r.data.insurer||'—')}</strong></div>
          <div><span>Ramo</span><strong>${esc(r.data.branch||'—')}</strong></div>
          <div><span>Produtor</span><strong>${esc(producerLabelOf(r))}</strong></div>
          <div><span>Corretora</span><strong>${esc(broker)}</strong></div>
          <div><span>Vigência</span><strong>${date(r.data.start)} a ${date(r.data.end)}</strong></div>
          <div><span>Prêmio</span><strong>${money(r.data.premium)}</strong></div>
        </div>
        <div class="insurance-card-foot">
          <span class="contract-file-state ${doc?.data.storageKey?'ready':doc?'pending':'neutral'}">${esc(fileState)}</span>
          ${endorsementCount?`<span class="contract-file-state ready">${endorsementCount} endosso(s)</span>`:''}
          <button class="btn primary small" data-client-open-insurance="${r.id}">Abrir ficha</button>
        </div>
      </article>`;
  }).join(''):'<div class="empty compact">Nenhuma proposta ou apólice encontrada para o filtro selecionado.</div>';

  const paymentHtml=openPayments.length?openPayments.slice(0,10).map(r=>`
    <div class="detail-row"><div><strong>Parcela ${esc(r.data.installment||'—')}</strong><span>${date(r.data.due)} · ${esc(r.data.collectionStatus||'Acompanhar')}</span></div><strong>${money(r.data.amount)}</strong></div>
  `).join(''):'<div class="empty compact">Nenhuma parcela efetiva em aberto.</div>';

  const taskHtml=tasks.length?tasks.slice(0,10).map(r=>`
    <div class="detail-row"><div><strong>${esc(r.data.title||'Pendência')}</strong><span>${esc(r.data.source||'Operação')} · ${r.data.due?date(r.data.due):'Sem prazo'}</span></div><span class="status-pill corporate-status ${statusTone(r.data.status)}">${esc(r.data.status||'Pendente')}</span></div>
  `).join(''):'<div class="empty compact">Nenhuma pendência aberta.</div>';

  const renewalHtml=renewals.length?renewals.slice(0,10).map(r=>`
    <div class="detail-row"><div><strong>${esc(r.data.number||'Contrato')}</strong><span>${esc(r.data.insurer||'—')} · vence em ${date(r.data.end)}</span></div><span class="status-pill corporate-status ${statusTone(renewalStatus(r))}">${esc(renewalStatus(r))}</span></div>
  `).join(''):'<div class="empty compact">Nenhuma renovação identificada.</div>';

  const docHtml=docs.length?docs.slice(0,12).map(doc=>{
    const linked=rowById(doc.data.policyId||doc.data.proposalId);
    const action=doc.data.storageKey
      ?`<button class="btn ghost small" data-client-open-doc="${doc.id}">Abrir</button>`
      :linked?`<button class="btn ghost small" data-client-upload-doc="${linked.id}" data-client-id="${clientId}">Anexar PDF</button>`:'';
    return `<div class="detail-row"><div><strong>${esc(doc.data.name||doc.data.documentType||'Documento')}</strong><span>${esc(doc.data.documentType||'Documento')} · ${linked?esc(insuranceLabel(linked)):'Documento geral'}</span></div>${action}</div>`;
  }).join(''):'<div class="empty compact">Nenhum documento vinculado.</div>';

  $('#clientDetailTitle').textContent=d.name||'Cliente';
  $('#clientDetailBody').innerHTML=`
    <div class="client-kpis">
      <div><span>Seguros ativos</span><strong>${activeInsurances.length}</strong></div>
      <div><span>Prêmio vigente</span><strong>${money(totalPremium)}</strong></div>
      <div><span>Parcelas em aberto</span><strong>${openPayments.length}</strong></div>
      <div><span>Pendências</span><strong>${tasks.length}</strong></div>
      <div><span>Comissões</span><strong>${commissions.length}</strong></div>
      <div><span>Documentos</span><strong>${storedDocs.length}</strong></div>
    </div>
    <div class="detail-grid">
      <div><span>CPF/CNPJ</span><strong>${esc(d.document||'—')}</strong></div>
      <div><span>Telefone</span><strong>${esc(d.phone||'—')}</strong></div>
      <div><span>E-mail</span><strong>${esc(d.email||'—')}</strong></div>
      <div><span>Responsável</span><strong>${esc(d.responsible||'—')}</strong></div>
      <div><span>Cidade/UF</span><strong>${esc([d.city,d.state].filter(Boolean).join('/')||'—')}</strong></div>
      <div><span>Nome fantasia</span><strong>${esc(d.fantasyName||'—')}</strong></div>
      <div class="wide"><span>Endereço</span><strong>${esc(d.address||'—')}</strong></div>
    </div>

    <section class="detail-section">
      <div class="section-title-row client-contract-heading">
        <div><h3>Propostas e apólices</h3><p>Histórico consolidado do cliente, mantendo a corretora vinculada a cada contrato.</p></div>
        <label class="inline-filter">Corretora
          <select id="clientBrokerageFilter">
            <option value="all">Todas</option>
            ${brokeragesForClient.map(v=>`<option value="${esc(v)}" ${brokerageFilter===v?'selected':''}>${esc(v)}</option>`).join('')}
          </select>
        </label>
      </div>
      <div class="insurance-grid">${insuranceHtml}</div>
    </section>

    <div class="detail-columns">
      <section class="detail-section"><div class="section-title-row"><div><h3>Parcelas em aberto</h3><p>Somente parcelas efetivas vinculadas aos contratos exibidos.</p></div></div>${paymentHtml}</section>
      <section class="detail-section"><div class="section-title-row"><div><h3>Pendências</h3><p>Ações operacionais que ainda exigem acompanhamento.</p></div></div>${taskHtml}</section>
      <section class="detail-section"><div class="section-title-row"><div><h3>Renovações</h3><p>Contratos do cliente em acompanhamento de renovação.</p></div></div>${renewalHtml}</section>
      <section class="detail-section"><div class="section-title-row"><div><h3>Documentos</h3><p>Documentos gerais e vinculados a cada seguro.</p></div></div>${docHtml}</section>
    </div>`;

  $('#clientDialog').dataset.clientId=clientId;
  $('#clientDialog').dataset.brokerageFilter=brokerageFilter;
  const brokerFilter=$('#clientBrokerageFilter');
  if(brokerFilter)brokerFilter.onchange=()=>renderClientDetail(clientId,brokerFilter.value);
  document.querySelectorAll('[data-client-open-insurance]').forEach(b=>b.onclick=()=>{
    $('#clientDialog').close();
    openInsuranceDetail(b.dataset.clientOpenInsurance);
  });
  document.querySelectorAll('[data-client-open-doc]').forEach(b=>b.onclick=()=>openDocument(rowById(b.dataset.clientOpenDoc)));
  document.querySelectorAll('[data-client-upload-doc]').forEach(b=>b.onclick=()=>openClientUpload(b.dataset.clientId,b.dataset.clientUploadDoc));
}

function openClientDetail(clientId){
  renderClientDetail(clientId,'all');
  $('#clientDialog').showModal();
}

function insuranceLinkedRows(kind,insurance){
  return list(kind).filter(r=>linkedToInsurance(r,insurance));
}

function openInsuranceDetail(insuranceId){
  const insurance=rowById(insuranceId);if(!insurance||!['proposal','policy'].includes(insurance.kind))return;
  const client=dataById(insurance.data.clientId);
  const items=insuranceLinkedRows('insuredItem',insurance);
  const coverages=insuranceLinkedRows('coverage',insurance);
  const payments=insuranceLinkedRows('payment',insurance).sort((a,b)=>String(a.data.due||'').localeCompare(String(b.data.due||'')));
  const commissions=insuranceLinkedRows('commission',insurance);
  const docs=insuranceDocuments(insurance);
  const tasks=insuranceLinkedRows('task',insurance);
  const claims=list('claim').filter(r=>linkedToInsurance(r,insurance)||String(r.data.policyId||'')===String(insurance.id));
  const driverRecords=insuranceLinkedRows('driver',insurance);
  const embeddedDrivers=Array.isArray(insurance.data.drivers)?insurance.data.drivers:[];
  const broker=String(insurance.data.brokerages||insurance.data.brokerage||'—').replace(/\|/g,' · ');

  const itemsHtml=items.length?items.map(r=>`
    <div class="entity-card"><div><span>${esc(r.data.itemType||'Item segurado')}</span><strong>${esc(r.data.makeModel||r.data.description||'—')}</strong></div>
    <div class="entity-grid"><span>Placa <strong>${esc(r.data.plate||'—')}</strong></span><span>Chassi <strong>${esc(r.data.chassis||'—')}</strong></span><span>Ano <strong>${esc(r.data.year||'—')}</strong></span><span>Valor <strong>${money(r.data.insuredValue)}</strong></span></div></div>
  `).join(''):'<div class="empty compact">Nenhum item ou veículo cadastrado neste contrato.</div>';

  const drivers=[...driverRecords.map(r=>r.data),...embeddedDrivers];
  const driverHtml=drivers.length?drivers.map(d=>`
    <div class="detail-row"><div><strong>${esc(d.name||d.driverName||'Condutor')}</strong><span>${esc(d.license||d.cnh||'CNH não informada')} · ${d.birthDate?date(d.birthDate):'Nascimento não informado'}</span></div><span>${d.primary||d.isPrimary?'Principal':''}</span></div>
  `).join(''):'<div class="empty compact">Nenhum condutor cadastrado neste contrato.</div>';

  const coverageHtml=coverages.length?coverages.map(r=>`
    <div class="detail-row"><div><strong>${esc(r.data.name||'Cobertura')}</strong><span>Franquia: ${esc(r.data.deductible||'—')}</span></div><strong>${money(r.data.limit)}</strong></div>
  `).join(''):'<div class="empty compact">Nenhuma cobertura detalhada cadastrada.</div>';

  const paymentHtml=payments.length?payments.map(r=>`
    <div class="detail-row"><div><strong>Parcela ${esc(r.data.installment||'—')}</strong><span>${r.data.due?date(r.data.due):(r.data.dueText||'Sem vencimento')} · ${esc(r.data.paymentMethod||'Forma não informada')}</span></div><div class="row-end"><strong>${money(r.data.amount)}</strong><span class="status-pill corporate-status ${statusTone(r.data.status)}">${esc(r.data.status||'—')}</span></div></div>
  `).join(''):'<div class="empty compact">Nenhuma parcela vinculada.</div>';

  const commissionHtml=commissions.length?commissions.map(r=>`
    <div class="detail-row"><div><strong>Comissão ${esc(r.data.status||'Prevista')}</strong><span>Bruta: ${money(r.data.expected)} · Produtor: ${money(r.data.producerExpected)}</span></div><div class="row-end"><strong>Recebida ${money(r.data.received)}</strong><span>Líquido Lebrime ${money(r.data.lebrimeNet)}</span></div></div>
  `).join(''):'<div class="empty compact">Nenhuma comissão calculada. O sistema não cria comissão sem produtor, percentual e prêmio líquido válidos.</div>';

  const docHtml=docs.length?docs.map(r=>`
    <div class="detail-row"><div><strong>${esc(r.data.name||r.data.documentType||'Documento')}</strong><span>${esc(r.data.documentType||'Documento')} · ${date(r.data.referenceDate)}</span></div>
      ${r.data.storageKey?`<button class="btn ghost small" data-insurance-open-doc="${r.id}">Abrir</button>`:`<span class="file-missing">PDF pendente</span>`}</div>
  `).join(''):'<div class="empty compact">Nenhum documento vinculado.</div>';

  const pendingTasks=tasks.filter(r=>!['Concluído','Concluída','Regularizado'].includes(String(r.data.status||'')));
  const taskHtml=pendingTasks.length?pendingTasks.map(r=>`
    <div class="detail-row"><div><strong>${esc(r.data.title||'Pendência')}</strong><span>${esc(r.data.source||'Operação')} · ${r.data.due?date(r.data.due):'Sem prazo'}</span></div><span class="status-pill corporate-status ${statusTone(r.data.status)}">${esc(r.data.status||'Pendente')}</span></div>
  `).join(''):'<div class="empty compact">Nenhuma pendência aberta.</div>';

  const claimHtml=claims.length?claims.map(r=>`
    <div class="detail-row"><div><strong>${esc(r.data.number||'Sinistro')}</strong><span>${r.data.incidentDate?date(r.data.incidentDate):'Data não informada'} · ${esc(r.data.claimType||'Sinistro')}</span></div><span class="status-pill corporate-status ${statusTone(r.data.status)}">${esc(r.data.status||'—')}</span></div>
  `).join(''):'<div class="empty compact">Nenhum sinistro vinculado.</div>';

  $('#insuranceDetailTitle').textContent=`${insurance.kind==='policy'?'Apólice':'Proposta'} ${insurance.data.number||'sem número'}`;
  $('#insuranceDetailBody').innerHTML=`
    <div class="contract-hero">
      <div><span class="record-type">${insurance.kind==='policy'?'APÓLICE':'PROPOSTA'}</span><h3>${esc(client.name||'Cliente')}</h3><p>${esc(insurance.data.insurer||'—')} · ${esc(insurance.data.branch||'—')}</p></div>
      <span class="status-pill corporate-status ${statusTone(insurance.data.status)}">${esc(insurance.data.status||'Cadastrado')}</span>
    </div>
    ${insurance.kind==='proposal'&&insurance.data.producerPending&&!insurance.data.producerId?`<div class="rule-callout producer-pending-callout"><strong>Produtor pendente</strong><span>Proposta importada da Porto sem produtor. O produtor deve ser definido manualmente antes do cálculo da comissão.</span></div>`:''}
    <div class="contract-summary-grid">
      <div><span>Cliente</span><strong>${esc(client.name||'—')}</strong></div>
      <div><span>CPF/CNPJ</span><strong>${esc(client.document||'—')}</strong></div>
      <div><span>Produtor</span><strong>${esc(producerLabelOf(insurance))}</strong></div>
      <div><span>Corretora</span><strong>${esc(broker)}</strong></div>
      <div><span>Operação</span><strong>${esc(insurance.data.policyType||'—')}</strong></div>
      <div><span>Vigência</span><strong>${date(insurance.data.start)} a ${date(insurance.data.end)}</strong></div>
      <div><span>Prêmio líquido</span><strong>${money(insurance.data.netPremium)}</strong></div>
      <div><span>Prêmio total</span><strong>${money(insurance.data.premium)}</strong></div>
      <div><span>Comissão</span><strong>${Number(insurance.data.commissionPercent||0)}%</strong></div>
      <div><span>Pagamento</span><strong>${esc(insurance.data.paymentMethod||'—')}</strong></div>
    </div>

    <div class="contract-sections">
      <section class="detail-section"><div class="section-title-row"><div><h3>Itens segurados / veículos</h3><p>Riscos vinculados exclusivamente a este contrato.</p></div></div>${itemsHtml}</section>
      <section class="detail-section"><div class="section-title-row"><div><h3>Condutores</h3><p>Condutores associados ao seguro, quando cadastrados.</p></div></div>${driverHtml}</section>
      <section class="detail-section"><div class="section-title-row"><div><h3>Coberturas</h3><p>Limites e franquias cadastrados.</p></div></div>${coverageHtml}</section>
      <section class="detail-section"><div class="section-title-row"><div><h3>Perfil e observações</h3><p>Informações complementares do risco.</p></div></div><div class="profile-note">${esc(insurance.data.profile||insurance.data.notes||'Nenhuma informação complementar cadastrada.')}</div></section>
      <section class="detail-section"><div class="section-title-row"><div><h3>Parcelas</h3><p>Previsões e parcelas efetivas deste contrato.</p></div></div>${paymentHtml}</section>
      <section class="detail-section"><div class="section-title-row"><div><h3>Comissão</h3><p>Cálculo conforme produtor, corretora e regras financeiras vigentes.</p></div></div>${commissionHtml}</section>
      <section class="detail-section"><div class="section-title-row"><div><h3>Documentos e endossos</h3><p>Endosso permanece como documento/evento do contrato e não cria nova apólice.</p></div></div>${docHtml}</section>
      <section class="detail-section"><div class="section-title-row"><div><h3>Pendências</h3><p>Ações operacionais abertas para este contrato.</p></div></div>${taskHtml}</section>
      <section class="detail-section"><div class="section-title-row"><div><h3>Sinistros</h3><p>Avisos e acompanhamentos vinculados à apólice.</p></div></div>${claimHtml}</section>
    </div>`;

  $('#insuranceDialog').dataset.insuranceId=insurance.id;
  $('#insuranceDialog').showModal();
  document.querySelectorAll('[data-insurance-open-doc]').forEach(b=>b.onclick=()=>openDocument(rowById(b.dataset.insuranceOpenDoc)));
}

function editInsuranceFromDetail(){
  const insurance=rowById($('#insuranceDialog').dataset.insuranceId);
  if(!insurance)return;
  $('#insuranceDialog').close();
  navigate('insurance');
  openEditor(insurance);
}

function uploadInsuranceFromDetail(){
  const insurance=rowById($('#insuranceDialog').dataset.insuranceId);
  if(!insurance)return;
  $('#insuranceDialog').close();
  openClientUpload(insurance.data.clientId,insurance.id);
}

function openClientUpload(clientIdOverride='',insuranceId=''){
  const clientId=clientIdOverride||$('#clientDialog').dataset.clientId||'';
  uploadPrefill={clientId:String(clientId||''),insuranceId:String(insuranceId||'')};
  if($('#clientDialog').open)$('#clientDialog').close();
  navigate('imports');
}

function editClientFromDetail(){
  const clientId=$('#clientDialog').dataset.clientId;
  const client=rowById(clientId);
  $('#clientDialog').close();
  current='client';renderNav();
  openEditor(client);
}

async function renderImportClients(){
  $('#uploadClient').innerHTML='<option value="">Selecione</option>'+list('client')
    .sort((a,b)=>String(a.data.name||'').localeCompare(String(b.data.name||''),'pt-BR'))
    .map(r=>`<option value="${r.id}">${esc(r.data.name)}</option>`).join('');
  if(uploadPrefill.clientId)$('#uploadClient').value=uploadPrefill.clientId;
  renderUploadInsurances(uploadPrefill.insuranceId);
}

function renderUploadInsurances(preferredInsuranceId=''){
  const clientId=$('#uploadClient').value;
  const options=[...list('proposal'),...list('policy')]
    .filter(r=>String(r.data.clientId||'')===String(clientId||''))
    .sort((a,b)=>String(b.data.start||'').localeCompare(String(a.data.start||'')));
  $('#uploadInsurance').innerHTML='<option value="">Documento geral do cliente</option>'+options
    .map(r=>`<option value="${r.id}">${esc(insuranceLabel(r))}</option>`).join('');
  const preferred=preferredInsuranceId||uploadPrefill.insuranceId;
  if(preferred&&options.some(r=>r.id===preferred))$('#uploadInsurance').value=preferred;
  syncUploadType();
}

function inferUploadDocumentType(fileName=''){
  const n=fold(fileName);
  if(n.includes('endosso'))return 'Endosso';
  if(n.includes('apolice'))return 'Apólice';
  if(n.includes('proposta'))return 'Proposta';
  return '';
}

function syncUploadType(){
  const insurance=rowById($('#uploadInsurance').value);
  const file=$('#uploadFile')?.files?.[0];
  const inferred=inferUploadDocumentType(file?.name||'');
  const hint=$('#uploadLinkHint');
  if(inferred)$('#uploadType').value=inferred;
  if(!insurance){
    if(hint)hint.textContent=inferred==='Endosso'
      ?'Endosso identificado. Selecione obrigatoriamente a proposta/apólice do cliente à qual ele pertence.'
      :'Documento geral do cliente: o arquivo ficará na ficha do cliente, sem vínculo com uma proposta ou apólice específica.';
    return;
  }
  if(!inferred&&$('#uploadType').value!=='Endosso')$('#uploadType').value=insurance.kind==='policy'?'Apólice':'Proposta';
  if(hint)hint.innerHTML=$('#uploadType').value==='Endosso'
    ?`Endosso vinculado ao contrato: <strong>${esc(insuranceLabel(insurance))}</strong>. Ele ficará no histórico deste contrato e não criará um novo seguro.`
    :`Vínculo selecionado: <strong>${esc(insuranceLabel(insurance))}</strong>. O arquivo será exibido diretamente nesse seguro.`;
}

async function uploadDocument(e){
  e.preventDefault();
  const f=$('#uploadFile').files[0];if(!f)return;
  if(f.size>15*1024*1024){$('#uploadStatus').textContent='Arquivo acima de 15 MB.';return}
  const clientId=$('#uploadClient').value;if(!clientId)return;
  const insurance=rowById($('#uploadInsurance').value);
  if(insurance&&String(insurance.data.clientId||'')!==String(clientId)){
    $('#uploadStatus').textContent='O seguro selecionado não pertence a este cliente.';return;
  }
  const policyId=insurance?.kind==='policy'?insurance.id:'';
  const proposalId=insurance?.kind==='proposal'?insurance.id:'';
  const documentType=inferUploadDocumentType(f.name)||$('#uploadType').value;
  if(documentType==='Endosso'&&!insurance){
    $('#uploadStatus').textContent='Endosso identificado: selecione a proposta ou apólice correspondente antes de enviar.';
    return;
  }
  $('#uploadType').value=documentType;
  const key=`clients/${clientId}/${new Date().getUTCFullYear()}/${String(new Date().getUTCMonth()+1).padStart(2,'0')}/${uuid()}-${f.name.replace(/[^a-zA-Z0-9._-]+/g,'-')}`;
  $('#uploadStatus').textContent='Enviando e vinculando arquivo...';
  let uploaded=false;
  try{
    await api('storage-put',f,{raw:true,key,headers:{'content-type':f.type||'application/octet-stream'}});
    uploaded=true;
    const stamp=now();
    const placeholder=insurance?list('document').find(doc=>{
      const sameClient=String(doc.data.clientId||'')===String(clientId);
      const sameContract=policyId?String(doc.data.policyId||'')===policyId:String(doc.data.proposalId||'')===proposalId;
      const sameType=String(doc.data.documentType||'')===String(documentType);
      return sameClient&&sameContract&&sameType&&!doc.data.storageKey;
    }):null;
    const data={
      ...(placeholder?.data||{}),
      clientId,policyId,proposalId,insuredItemId:placeholder?.data.insuredItemId||'',
      name:f.name,documentType,referenceDate:placeholder?.data.referenceDate||today(),
      source:placeholder?'Upload interno — arquivo recuperado':'Upload interno',
      contractId:insurance?.id||'',contractNumber:insurance?.data?.number||'',
      isEndorsement:documentType==='Endosso',
      status:'Recebido',storageKey:key,originalFileName:f.name,
      mimeType:f.type||'application/octet-stream',fileSize:f.size,
      notes:$('#uploadNotes').value||placeholder?.data.notes||''
    };
    const op=placeholder
      ?{type:'update',id:placeholder.id,kind:'document',data,version:placeholder.version,updated_at:stamp,strict:true}
      :{type:'insert',id:uuid(),kind:'document',data,version:1,created_at:stamp,updated_at:stamp};
    await api('write',{ops:[op]});
    uploaded=false;
    $('#uploadForm').reset();
    $('#uploadStatus').textContent=placeholder
      ?'Arquivo recuperado e vinculado ao seguro com sucesso.'
      :insurance
        ?'Documento armazenado e vinculado ao seguro com sucesso.'
        :'Documento armazenado na ficha do cliente com sucesso.';
    await loadRecords();
    uploadPrefill={clientId:'',insuranceId:''};
    await renderImportClients();
  }catch(err){
    if(uploaded)try{await api('storage-delete',{}, {key})}catch{}
    $('#uploadStatus').textContent=err.message
  }
}

async function openDocument(entry){
  if(!entry?.data?.storageKey){alert('O registro deste documento foi localizado, mas o arquivo físico ainda não está no Supabase Storage. Use “Regularizar arquivo” para anexar o PDF sem criar duplicidade.');return;}
  try{
    const blob=await api('storage-get',null,{blob:true,key:entry.data.storageKey});
    const url=URL.createObjectURL(blob);window.open(url,'_blank','noopener');
    setTimeout(()=>URL.revokeObjectURL(url),60000);
  }catch(e){alert(e.message)}
}

$('#loginForm').onsubmit=async e=>{
  e.preventDefault();$('#loginError').textContent='';
  try{await login($('#loginPassword').value)}catch(err){$('#loginError').textContent=err.message}
};
$('#logoutBtn').onclick=logout;
$('#themeToggle').onclick=toggleTheme;
$('#newBtn').onclick=()=>openEditor();
$('#closeClientDetail').onclick=()=>$('#clientDialog').close();
$('#clientUploadBtn').onclick=openClientUpload;
$('#clientEditBtn').onclick=editClientFromDetail;
$('#closeProducerDetail').onclick=()=>$('#producerDialog').close();
$('#closeInsuranceDetail').onclick=()=>$('#insuranceDialog').close();
$('#insuranceEditBtn').onclick=editInsuranceFromDetail;
$('#insuranceUploadBtn').onclick=uploadInsuranceFromDetail;
$('#producerEditBtn').onclick=editProducerFromDetail;
$('#closeEditor').onclick=()=>$('#editorDialog').close();
$('#cancelEditor').onclick=()=>$('#editorDialog').close();
$('#editorForm').onsubmit=saveCurrent;
$('#searchInput').oninput=()=>{
  if(current!=='overview'&&current!=='imports'&&current!=='integrations')renderList();
  renderSearchSuggestions();
};
$('#searchInput').onfocus=renderSearchSuggestions;
document.addEventListener('click',event=>{
  const shell=event.target.closest?.('.search-shell');
  if(!shell){
    const root=$('#searchSuggestions');
    if(root)root.classList.add('hidden');
  }
});
$('#uploadClient').onchange=()=>{uploadPrefill.insuranceId='';renderUploadInsurances('')};
$('#uploadInsurance').onchange=syncUploadType;
$('#uploadType').onchange=syncUploadType;
$('#uploadFile').onchange=syncUploadType;
$('#uploadForm').onsubmit=uploadDocument;

syncThemeControl();
if(!localStorage.getItem(THEME_KEY)&&window.matchMedia){
  const systemTheme=window.matchMedia('(prefers-color-scheme: dark)');
  systemTheme.addEventListener?.('change',e=>applyTheme(e.matches?'dark':'light',{persist:false}));
}
boot();