const API='https://paiezoesntmicnwcmemt.supabase.co/functions/v1/lebrime-api';
const TOKEN_KEY='lebrime_token_v1';
const THEME_KEY='lebrime_theme_v2';
const CUTOFF='2026-10';

const menu=[
  ['overview','Visão geral'],
  ['client','Cadastro de clientes'],
  ['producer','Produtores'],
  ['insurance','Contratos e histórico'],
  ['payment','Central de parcelas'],
  ['commission','Comissões'],
  ['renewal','Renovações'],
  ['claim','Sinistros'],
  ['task','Pendências'],
  ['document','Documentos'],
  ['imports','Arquivos'],
  ['integrations','Integrações']
];

const NAV_GROUPS=[
  ['Executivo',['overview']],
  ['Carteira',['client','producer','insurance','renewal']],
  ['Financeiro',['payment','commission']],
  ['Operação',['claim','task','document','imports']],
  ['Integrações',['integrations']]
];

const PAGE_CONTEXT={
  overview:'Visão executiva da operação, carteira e financeiro.',
  client:'Cadastro por CPF/CNPJ com histórico completo de propostas, apólices e vigências.',
  producer:'Produção, carteira e resultado por produtor.',
  insurance:'Carteira unificada de contratos, propostas e apólices.',
  payment:'Controle de parcelas, inadimplência e etapas de cobrança sem misturar previsões com recebimentos efetivos.',
  commission:'Comissões, repasses e resultado realizado conforme as regras financeiras da carteira.',
  renewal:'Consulta por período, filtros comerciais e acompanhamento das renovações.',
  claim:'Acompanhamento de sinistros vinculado às apólices, sem criar contratos paralelos.',
  task:'Fila operacional da equipe, incluindo exceções de integração e próximos passos.',
  document:'Biblioteca documental vinculada à carteira.',
  imports:'Entrada e vinculação de documentos aos contratos.',
  integrations:'Conectores oficiais com seguradoras e trilha de sincronização.'
};

const NEW_LABELS={
  client:'+ Novo cliente',
  producer:'+ Novo produtor',
  insurance:'+ Novo contrato',
  payment:'+ Nova parcela',
  claim:'+ Novo sinistro',
  task:'+ Nova pendência',
  document:'+ Novo documento'
};

const SEARCH_LABELS={
  client:'Pesquisar nome, CPF/CNPJ, placa, proposta ou apólice...',
  producer:'Pesquisar produtor...',
  insurance:'Pesquisar cliente, proposta, apólice...',
  payment:'Pesquisar cliente, contrato, parcela ou cobrança...',
  commission:'Pesquisar cliente, contrato, produtor ou corretora...',
  renewal:'Pesquisar renovação...',
  claim:'Pesquisar cliente, apólice, sinistro ou status...',
  task:'Pesquisar título, cliente, origem ou destino...',
  document:'Pesquisar documento...'
};

const brokerages=['Lebrime','FF Apolinário','Homeni Corretora','Eólica Corretora'];
const insurers=['Porto','Allianz','Zurich','HDI','Tokio Marine','Yelum','MAPFRE','Bradesco','Suhai','Ezze','Sura','Berkley','Fator','Akad','Aliro','Avla','Potencial','Aruana','Chubb','Junto'];
const branches=['Automóvel','Frota','Residencial','Empresarial','Multirrisco','Acidentes Pessoais','Vida','Seguro Garantia','Responsabilidade Civil','RC Profissional','RC Obras','RC Empregador','Fiança Locatícia','Transporte','Riscos Nomeados e Operacionais','Riscos de Engenharia','Equipamentos','Condomínio','Cyber','D&O','E&O','Riscos Diversos','Outros'];

let records=[];
let current='overview';
let editing=null;
let uploadPrefill={clientId:'',insuranceId:''};
let clientPortfolioFilter='all';
let insurancePortfolioFilter='all';

const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

const currentTheme=()=> 'light';
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
  const next='light';
  document.documentElement.dataset.theme=next;
  document.documentElement.style.colorScheme=next;
  localStorage.removeItem(THEME_KEY);
  syncThemeControl();
}
function toggleTheme(){ applyTheme('light'); }

const token=()=>localStorage.getItem(TOKEN_KEY)||'';
const uuid=()=>crypto.randomUUID();
const now=()=>new Date().toISOString();
const today=()=>new Date().toISOString().slice(0,10);
const digits=v=>String(v||'').replace(/\D/g,'');
const norm=v=>String(v||'').trim().toLocaleLowerCase('pt-BR');
const fold=v=>norm(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const searchKey=v=>fold(v).replace(/[^a-z0-9]/g,'');
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
const recordExternalUrl=row=>row?.data?.externalUrl||row?.data?.sourceDriveUrl||(row?.data?.sourceDriveFileId?`https://drive.google.com/file/d/${encodeURIComponent(row.data.sourceDriveFileId)}/view`:'');
const documentLinkedInsurance=doc=>rowById(doc?.data?.policyId||doc?.data?.proposalId);
const documentExternalUrl=doc=>recordExternalUrl(doc)||recordExternalUrl(documentLinkedInsurance(doc));
const documentAvailable=doc=>Boolean(doc?.data?.storageKey||documentExternalUrl(doc));
const primaryInsuranceDocument=insurance=>{
  const docs=insuranceDocuments(insurance);
  const expected=insurance.kind==='policy'?'Apólice':'Proposta';
  return docs.find(d=>documentAvailable(d)&&String(d.data.documentType||'')===expected)
    ||docs.find(d=>documentAvailable(d))
    ||docs.find(d=>String(d.data.documentType||'')===expected)
    ||docs[0]
    ||null;
};
const insuranceDocumentAvailable=insurance=>{
  const doc=primaryInsuranceDocument(insurance);
  return documentAvailable(doc)||Boolean(documentExternalUrl(insurance));
};
async function openInsuranceDocument(insurance){
  if(!insurance)return;
  const doc=primaryInsuranceDocument(insurance);
  if(documentAvailable(doc)){
    await openDocument(doc);
    return;
  }
  const externalUrl=documentExternalUrl(insurance);
  if(externalUrl){
    window.open(externalUrl,'_blank','noopener');
    return;
  }
  alert('Nenhum PDF disponível para esta proposta/apólice.');
}

const isInsuranceActive=insurance=>{
  const status=fold(insurance?.data?.status||'');
  if(['cancelada','cancelado','recusada','recusado','convertida','convertido','perdida','perdido'].includes(status))return false;
  return !insurance?.data?.end||insurance.data.end>=today();
};

const activeInsuranceRows=()=>[...list('proposal'),...list('policy')].filter(isInsuranceActive);
// Não tratar propostas dentro da vigência como apólices contratadas.
const isContractInPeriod=row=>insurancePeriodState(row).key==='current'&&
  !['cancelada','cancelado','recusada','recusado','convertida','convertido','perdida','perdido']
    .includes(fold(row?.data?.status||''));
const isPolicyInPeriod=row=>row?.kind==='policy'&&isContractInPeriod(row);
const isProposalInPeriod=row=>row?.kind==='proposal'&&isContractInPeriod(row);

// Carteira Lebrime: proposta e apólice são contratos equivalentes.
const portfolioRows=()=>{
  const unique=new Map();
  for(const row of [...list('proposal'),...list('policy')]){
    const status=fold(row.data.status||'');
    if(['cotacao','orcamento','simulacao','recusada','recusado','cancelada','cancelado','perdida','perdido','convertida','convertido'].includes(status)||
      row.data.isDuplicate===true||row.data.duplicateOf)continue;
    const d=row.data;
    const key=d.clientId&&d.insurer&&d.number&&d.start
      ?[String(d.clientId),fold(d.insurer),searchKey(d.number),String(d.start),String(d.end||'')].join('|')
      :row.id;
    const previous=unique.get(key);
    if(!previous||(row.kind==='policy'&&previous.kind!=='policy')||(!Number(previous.data.premium||0)&&Number(d.premium||0)))unique.set(key,row);
  }
  return [...unique.values()];
};
const insuranceRowsForClient=clientId=>portfolioRows()
  .filter(r=>String(r.data.clientId||'')===String(clientId||''));
const effectiveCommissionRows=()=>{
  const ids=new Set(portfolioRows().map(r=>r.id));
  const result=new Map();
  for(const row of list('commission')){
    const id=row.data.policyId||row.data.proposalId||'';
    if(!ids.has(id)||fold(row.data.status||'').includes('duplicada'))continue;
    const prior=result.get(id);
    if(!prior||Number(row.data.received||0)>Number(prior.data.received||0)||
      (Number(row.data.received||0)===Number(prior.data.received||0)&&Number(row.data.expected||0)>Number(prior.data.expected||0)))result.set(id,row);
  }
  return [...result.values()];
};

// Histórico completo: a vigência encerrada não remove o contrato da ficha.
// A situação da vigência é diferente da situação comercial (em análise, emitida etc.).
const insurancePeriodState=row=>{
  const start=String(row?.data?.start||'');
  const end=String(row?.data?.end||'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end))
    return {key:'unknown',label:'Vigência a confirmar'};
  if(end<today())return {key:'expired',label:'Vigência encerrada'};
  if(start>today())return {key:'future',label:'Vigência futura'};
  return {key:'current',label:'Dentro do período de vigência'};
};

const insuranceHistoryPeriod=row=>{
  const start=String(row?.data?.start||'');
  const end=String(row?.data?.end||'');
  return /^\d{4}-\d{2}-\d{2}$/.test(start)&&/^\d{4}-\d{2}-\d{2}$/.test(end)
    ?start.slice(0,4)+' / '+end.slice(0,4)
    :'Vigência não confirmada';
};

const relatedEndorsementsFor=insurance=>{
  const policyNumber=String(insurance?.data?.policyNumber||(insurance?.kind==='policy'?insurance?.data?.number:'')).replace(/\D/g,'');
  const clientId=String(insurance?.data?.clientId||'');
  if(!clientId||!policyNumber)return [];
  return list('endorsement').filter(e=>
    String(e.data.clientId||'')===clientId&&
    String(e.data.parentPolicyNumber||e.data.originalPolicyNumber||e.data.policyNumber||'').replace(/\D/g,'')===policyNumber&&
    (!insurance.data.start||!e.data.start||e.data.start>=insurance.data.start)&&
    (!insurance.data.end||!e.data.start||e.data.start<=insurance.data.end)
  );
};

const clientPortfolioState=clientId=>{
  const rows=insuranceRowsForClient(clientId);
  if(rows.some(isContractInPeriod))return {key:'current',label:'Contrato no prazo'};
  if(rows.some(r=>insurancePeriodState(r).key==='future'))return {key:'future',label:'Vigência futura'};
  if(rows.some(r=>insurancePeriodState(r).key==='unknown'))return {key:'review',label:'Vigência a conferir'};
  if(rows.length)return {key:'history',label:'Somente histórico vencido'};
  return {key:'none',label:'Sem contratos'};
};
const clientLastPeriod=clientId=>{
  const ends=insuranceRowsForClient(clientId).map(r=>r.data.end).filter(Boolean);
  return ends.length?date(ends.sort().at(-1)):'—';
};

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
  return searchKey([
    JSON.stringify(client.data||{}),
    ...insurances.map(r=>JSON.stringify(r.data||{})),
    ...items.map(r=>JSON.stringify(r.data||{}))
  ].join(' '));
};

const genericSearchText=row=>searchKey(
  JSON.stringify(row.data||{})+' '+
  nameById(row.data?.clientId)+' '+
  nameById(row.data?.producerId)+' '+
  nameById(row.data?.policyId||row.data?.proposalId)+' '+
  nameById(row.data?.insuredItemId)
);

function matchingClients(query){
  const q=searchKey(query);
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
  const type=insurance.kind==='policy'?'Apólice':insurance.kind==='endorsement'?'Endosso':'Proposta';
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
    documentAvailable(d)&&fold(d.data.documentType||'').includes(fold(expected))
  )||null;
};

const importedInsuranceDate=insurance=>{
  const doc=importedInsuranceDocument(insurance);
  return doc?.createdAt?.slice(0,10)||doc?.data?.migratedAt?.slice(0,10)||today();
};

const importedInsuranceSource=insurance=>
  insurance?.kind==='policy'?'Importação da apólice':'Importação da proposta';

const producerInsurances=producerId=>portfolioRows()
  .filter(r=>String(r.data.producerId||'')===String(producerId||''));

const producerClients=producerId=>{
  const ids=[...new Set(producerInsurances(producerId).map(r=>String(r.data.clientId||'')).filter(Boolean))];
  return ids.map(rowById).filter(Boolean);
};

// Em vínculos antigos com mais de uma comissão, utilizar o lançamento canônico.
const commissionForInsurance=insurance=>list('commission').filter(c=>
  (insurance?.kind==='policy'&&String(c.data.policyId||'')===String(insurance.id))||
  (insurance?.kind==='proposal'&&String(c.data.proposalId||'')===String(insurance.id))
).sort((a,b)=>{
  const score=c=>(fold(c.data.status||'').includes('duplicada')?-1000000000:0)+
    Number(c.data.received||0)*2+Number(c.data.expected||0);
  return score(b)-score(a);
})[0]||null;

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

let paymentFilters={dateFrom:'',dateTo:'',status:'all',collection:'all',kind:'all',brokerage:'all',insurer:'all'};
let commissionFilters={receivedFrom:'',receivedTo:'',producer:'all',brokerage:'all',insurer:'all',status:'all'};
let taskFilters={dueFrom:'',dueTo:'',status:'all',source:'all',destination:'all',responsible:'all'};
let documentFilters={type:'all',status:'all',file:'all',brokerage:'all'};
let claimFilters={incidentFrom:'',incidentTo:'',insurer:'all',branch:'all',status:'all',responsible:'all'};

const contractForRow=row=>rowById(row?.data?.policyId||row?.data?.proposalId)||null;
const policyForClaim=row=>rowById(row?.data?.policyId)||null;
const brokerageLabelOf=insurance=>String(insurance?.data?.brokerages||insurance?.data?.brokerage||'—').replace(/\|/g,' · ');
const brokerageMatches=(insurance,value)=>value==='all'||String(insurance?.data?.brokerages||insurance?.data?.brokerage||'').split('|').includes(value);
const uniqueSorted=values=>[...new Set(values.filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'pt-BR'));

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
  $('#loadingView')?.classList.add('hidden');
  $('#appView').classList.add('hidden');
  $('#loginView').classList.remove('hidden');
}

function commissionReconcileOps(){
  const stamp=now();
  const ops=[];
  for(const insurance of portfolioRows()){
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
  // Apenas leitura na abertura. As comissões são sincronizadas pelo banco,
  // evitando gravar milhares de operações durante o carregamento da página.
  const j=await api('select',{orderUpdatedDesc:true});
  if(!Array.isArray(j.rows))throw new Error('A consulta não retornou a carteira.');
  records=j.rows.map(r=>({...r,data:r.data||{},version:Number(r.version||1),createdAt:r.created_at,updatedAt:r.updated_at}));
}

async function boot(){
  if(!token()){logout();return;}
  const loading=$('#loadingView');
  const loadError=$('#loadingError');
  if(loading)loading.classList.remove('hidden');
  if(loadError)loadError.textContent='';
  $('#loginView').classList.add('hidden');
  $('#appView').classList.add('hidden');
  try{
    await loadRecords();
    $('#loginView').classList.add('hidden');
    if(loading)loading.classList.add('hidden');
    $('#appView').classList.remove('hidden');
    renderNav();
    navigate('overview');
  }catch(e){
    if(!token()){logout();return;}
    // Conservar a sessão quando o banco ou a conexão falhar temporariamente.
    if(loading)loading.classList.remove('hidden');
    if(loadError)loadError.textContent='Não foi possível carregar os dados do sistema. '+String(e?.message||e);
    console.error('Erro ao carregar a carteira Lebrime:',e);
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
  const contracts=portfolioRows();
  const inPeriodContracts=contracts.filter(isContractInPeriod);
  const expiredContracts=contracts.filter(r=>insurancePeriodState(r).key==='expired');
  const futureContracts=contracts.filter(r=>insurancePeriodState(r).key==='future');
  const undatedContracts=contracts.filter(r=>insurancePeriodState(r).key==='unknown');
  const payments=list('payment');
  const forecasts=payments.filter(r=>r.data.financialTracking==='Previsão da proposta'&&r.data.status!=='Cancelado');
  const open=payments.filter(r=>r.data.status==='Em aberto'&&r.data.financialTracking!=='Previsão da proposta');
  const overdue=open.filter(r=>r.data.due&&r.data.due<today());
  const renew60=inPeriodContracts.filter(r=>{
    if(!r.data.end)return false;
    const d=(new Date(r.data.end+'T12:00:00Z')-new Date(today()+'T12:00:00Z'))/86400000;
    return d>=0&&d<=60;
  });
  const claims=list('claim');
  const activeClaims=claims.filter(r=>!['Pago','Encerrado','Negado'].includes(String(r.data.status||'')));
  const claimActionsDue=activeClaims.filter(r=>r.data.nextActionDate&&r.data.nextActionDate<today());
  const comm=effectiveCommissionRows();
  const received=comm.reduce((s,r)=>s+Number(r.data.received||0),0);
  const paid=comm.reduce((s,r)=>s+Number(r.data.transferPaid||0),0);
  const gross=comm.reduce((s,r)=>s+Number(r.data.expected||0),0);
  const ff=comm.reduce((s,r)=>s+Number(r.data.ffFee||0),0);
  const producerExpected=comm.reduce((s,r)=>s+Number(r.data.producerExpected||0),0);
  const lebrimeNet=comm.reduce((s,r)=>s+Number(r.data.lebrimeNet||0),0);
  const activePremium=inPeriodContracts.reduce((s,r)=>s+Number(r.data.premium||0),0);
  const totalPortfolioPremium=contracts.reduce((s,r)=>s+Number(r.data.premium||0),0);
  const missingPortfolioPremium=contracts.filter(r=>!Number(r.data.premium||0)).length;
  const forecastTotal=forecasts.reduce((s,r)=>s+Number(r.data.amount||0),0);
  const brokerRows=brokerages.map(name=>{
    const items=inPeriodContracts.filter(r=>String(r.data.brokerages||r.data.brokerage||'').split('|').includes(name));
    return {name,count:items.length,premium:items.reduce((sum,r)=>sum+Number(r.data.premium||0),0)};
  }).filter(r=>r.count>0);

  const reliability=list('system_metric').find(r=>r.id==='segflex-reliability-current'||r.data.metricType==='segflex_reliability')?.data||{};
  const reliabilityPct=Number(reliability.overallReliability||0);
  const importProgress=Number(reliability.importProgress||0);
  const cleanImportProgress=Number(reliability.cleanImportProgress||0);
  const sourceTotal=Number(reliability.sourceTotal||0);
  const sourceImported=Number(reliability.sourceImported||0);
  const sourcePendingReview=Number(reliability.sourcePendingReview||0);
  const sourceUnprocessed=Number(reliability.sourceUnprocessed||0);
  const reliabilityLabel=reliabilityPct>=97?'Alta confiabilidade':reliabilityPct>=90?'Boa confiabilidade':reliabilityPct>=80?'Atenção':'Revisão necessária';
  const reliabilityTone=reliabilityPct>=97?'high':reliabilityPct>=90?'good':reliabilityPct>=80?'attention':'critical';

  $('#dashboard').innerHTML=`
    <div class="executive-heading">
      <div>
        <span class="section-kicker">Resumo executivo</span>
        <h2>Visão executiva da carteira</h2>
        <p>Propostas e apólices formam uma única carteira; todo contrato válido contribui para o prêmio.</p>
      </div>
      <div class="as-of">Posição em ${date(today())}</div>
    </div>

    <section class="dashboard-topic" aria-labelledby="heading-carteira">
      <div class="dashboard-topic-heading">
        <div><span class="section-kicker">01 / Carteira de seguros</span>
          <h3 id="heading-carteira">Clientes e contratos</h3>
          <p>Um cliente pode ter vários contratos. Propostas e apólices são tratados como contratos na carteira.</p>
        </div>
        <div class="dashboard-topic-actions">
          <button type="button" class="btn ghost small" data-go="client">Ver clientes</button>
          <button type="button" class="btn primary small" data-go="insurance">Ver contratos</button>
        </div>
      </div>
      <div class="dashboard-main-kpis">
        <div class="dashboard-kpi">
          <span>Clientes únicos</span>
          <strong>${list('client').length}</strong>
          <small>Uma ficha por pessoa ou empresa (CPF/CNPJ)</small>
        </div>
        <div class="dashboard-kpi">
          <span>Total de contratos na carteira</span>
          <strong>${contracts.length}</strong>
          <small>Histórico completo, incluindo contratos antigos e renovações</small>
        </div>
        <div class="dashboard-kpi dashboard-kpi-current">
          <span>Contratos em vigência hoje</span>
          <strong>${inPeriodContracts.length} <em>de ${contracts.length}</em></strong>
          <small>Estão incluídos no total de contratos, não são adicionais</small>
        </div>
      </div>
      <div class="dashboard-relationship">
        <div class="dashboard-relationship-head">
          <strong>Situação dos ${contracts.length} contratos cadastrados</strong>
          <span>${contracts.length?((inPeriodContracts.length/contracts.length)*100).toFixed(1).replace('.',',')+'% em vigência':'Sem contratos'}</span>
        </div>
        <div class="dashboard-ratio" role="progressbar" aria-label="Proporção de contratos em vigência" aria-valuenow="${inPeriodContracts.length}" aria-valuemin="0" aria-valuemax="${contracts.length}">
          <i style="width:${contracts.length?Math.min(100,100*inPeriodContracts.length/contracts.length):0}%"></i>
        </div>
        <p><b>${inPeriodContracts.length}</b> em vigência hoje <span aria-hidden="true">·</span> <b>${contracts.length-inPeriodContracts.length}</b> em outras situações
          <small>(${expiredContracts.length} encerrados, ${futureContracts.length} futuros e ${undatedContracts.length} com vigência a conferir)</small></p>
      </div>
      <div class="dashboard-premium-pair">
        <div><span>Prêmio total do histórico</span><strong>${money(totalPortfolioPremium)}</strong>
          <small>Soma dos contratos cadastrados, sem duplicar o mesmo contrato</small></div>
        <div><span>Prêmio dos contratos em vigência</span><strong>${money(activePremium)}</strong>
          <small>Parte do prêmio histórico referente aos contratos vigentes</small></div>
      </div>
      ${missingPortfolioPremium?'<p class="dashboard-caution">'+missingPortfolioPremium+' contrato(s) sem prêmio total confirmado ainda não contribuem para esses valores.</p>':''}
    </section>

    <section class="dashboard-topic" aria-labelledby="heading-importacao">
      <div class="dashboard-topic-heading">
        <div><span class="section-kicker">02 / Importação de documentos</span>
          <h3 id="heading-importacao">SegFlex — andamento dos PDFs</h3>
          <p>Este grupo conta arquivos analisados, não pessoas nem contratos novos.</p>
        </div>
        <button type="button" class="btn ghost small" data-go="imports">Ver documentos</button>
      </div>
      <div class="dashboard-import-grid">
        <div class="dashboard-import-total"><span>Arquivos processados</span>
          <strong>${sourceTotal?sourceTotal-sourceUnprocessed:0} <em>de ${sourceTotal||0}</em></strong>
          <small>${sourceTotal?importProgress.toFixed(2).replace('.',',')+'%':'Aguardando relatório'}</small></div>
        <div><span>Importados</span><strong>${sourceImported}</strong><small>PDFs incluídos no fluxo</small></div>
        <div><span>Em revisão</span><strong>${sourcePendingReview}</strong><small>Já analisados; exigem conferência</small></div>
        <div><span>Não processados</span><strong>${sourceUnprocessed}</strong><small>Arquivos ainda não analisados</small></div>
      </div>
      <div class="dashboard-relationship">
        <div class="dashboard-relationship-head"><strong>Conclusão do processamento</strong><span>${sourceTotal?importProgress.toFixed(2).replace('.',',')+'%':'—'}</span></div>
        <div class="dashboard-ratio" role="progressbar" aria-label="Progresso da análise de PDFs" aria-valuenow="${sourceTotal?sourceTotal-sourceUnprocessed:0}" aria-valuemin="0" aria-valuemax="${sourceTotal||0}">
          <i style="width:${Math.max(0,Math.min(100,importProgress))}%"></i>
        </div>
        <p>Os ${sourcePendingReview} arquivos em revisão já foram processados, mas ainda precisam de validação.</p>
      </div>
    </section>

    <section class="dashboard-topic" aria-labelledby="heading-financeiro">
      <div class="dashboard-topic-heading">
        <div><span class="section-kicker">03 / Financeiro</span>
          <h3 id="heading-financeiro">Comissões e resultado</h3>
          <p>Valores das comissões cadastradas, separados do prêmio da carteira.</p>
        </div>
        <button type="button" class="btn ghost small" data-go="commission">Ver comissões</button>
      </div>
      <div class="dashboard-finance-kpis">
        <div><span>Comissão bruta</span><strong>${money(gross)}</strong></div>
        <div><span>Comissão recebida</span><strong>${money(received)}</strong></div>
        <div><span>Repasses pagos aos produtores</span><strong>${money(paid)}</strong></div>
        <div><span>Resultado realizado</span><strong>${money(received-paid)}</strong><small>Comissão recebida − repasses pagos</small></div>
      </div>
    </section>

    <div class="dashboard-topic-heading dashboard-operations-heading">
      <div><span class="section-kicker">04 / Acompanhamento</span><h3>Pendências operacionais</h3>
        <p>Parcelas, renovações e sinistros que merecem atenção.</p></div>
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
        <span>Contratos vencendo em 60 dias</span>
        <strong>${renew60.length}</strong>
        <small>Acompanhamento prioritário</small>
      </div>
      <div class="operational-item ${claimActionsDue.length?'attention':''}">
        <span>Sinistros em acompanhamento</span>
        <strong>${activeClaims.length}</strong>
        <small>${claimActionsDue.length?claimActionsDue.length+' ação(ões) vencida(s)':'Operação regular'}</small>
      </div>
    </div>

    <div class="dashboard-grid corporate-grid">
      <div class="panel reliability-panel">
        <div class="panel-head corporate-panel-head">
          <div><span class="section-kicker">Qualidade dos dados</span><h2>Confiabilidade das informações</h2></div>
          <span class="reliability-badge ${reliabilityTone}">${reliabilityPct?reliabilityPct.toFixed(2)+'%':'—'}</span>
        </div>
        <div class="reliability-layout">
          <div class="reliability-overview">
            <div class="reliability-score ${reliabilityTone}">
              <strong>${reliabilityPct?reliabilityPct.toFixed(2)+'%':'—'}</strong>
              <span>${reliabilityLabel}</span>
            </div>
            <div class="reliability-progress-block">
              <div class="reliability-progress-head"><span>Progresso da importação</span><strong>${sourceTotal?importProgress.toFixed(2)+'%':'—'}</strong></div>
              <div class="reliability-progress"><i style="width:${Math.max(0,Math.min(100,importProgress))}%"></i></div>
              <small>${sourceImported} de ${sourceTotal||0} PDFs importados · ${sourcePendingReview} em revisão · ${sourceUnprocessed} ainda não processados</small>
            </div>
          </div>
          <div class="reliability-dimensions">
            ${[
              ['Identidade',reliability.identityReliability],
              ['Documentos',reliability.documentReliability],
              ['Contratos',reliability.contractReliability],
              ['Financeiro',reliability.financialReliability],
              ['Vínculos',reliability.linkageReliability]
            ].map(([label,value])=>{
              const v=Number(value||0);
              return `<div class="reliability-dimension"><span>${esc(label)}</span><strong>${v?v.toFixed(2)+'%':'—'}</strong><div><i style="width:${Math.max(0,Math.min(100,v))}%"></i></div></div>`;
            }).join('')}
          </div>
        </div>
        <div class="reliability-foot">
          <span>Importação limpa: <strong>${sourceTotal?cleanImportProgress.toFixed(2)+'%':'—'}</strong></span>
          <span>Duplicidades: <strong>${Number(reliability.duplicateClients||0)+Number(reliability.duplicateDocuments||0)+Number(reliability.duplicateInsuranceSources||0)+Number(reliability.duplicatePaymentGroups||0)}</strong></span>
          <span>Registros avaliados: <strong>${Number(reliability.insuranceRecords||0)}</strong></span>
        </div>
      </div>

      <div class="panel">
        <div class="panel-head corporate-panel-head">
          <div><span class="section-kicker">Contratos no prazo</span><h2>Distribuição por corretora</h2></div>
          <button class="link-btn" data-go="insurance">Abrir carteira</button>
        </div>
        <div class="brokerage-summary">
          ${brokerRows.length?brokerRows.map(r=>`
            <div class="brokerage-summary-row">
              <div><strong>${esc(r.name)}</strong><span>${r.count} contrato(s) dentro da vigência</span></div>
              <strong>${money(r.premium)}</strong>
            </div>`).join(''):'<div class="empty compact">Nenhum contrato no período.</div>'}
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
          <div><span class="section-kicker">Operação</span><h2>Sinistros em acompanhamento</h2></div>
          <button class="link-btn" data-go="claim">Abrir sinistros</button>
        </div>
        ${miniTable(activeClaims.sort((a,b)=>String(b.data.incidentDate||'').localeCompare(String(a.data.incidentDate||''))).slice(0,8),[
          ['Cliente',r=>nameById(r.data.clientId)],['Sinistro',r=>r.data.number],['Status',r=>r.data.status],['Próxima ação',r=>r.data.nextActionDate?date(r.data.nextActionDate):'—']
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
  if(['recebida','pago','regularizado','ativa','aprovada','seguro novo','encerrado'].some(x=>v.includes(x)))return 'success';
  if(['atrasad','cancel','recus','perdid','negad'].some(x=>v.includes(x)))return 'danger';
  if(['em aberto','em analise','acompanhar','previsao','renovacao','pendente','aguardando','documentacao','regulacao','aviso'].some(x=>v.includes(x)))return 'warning';
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
    title:'Cliente',
    columns:[
      ['Cliente',r=>r.data.name],
      ['CPF/CNPJ',r=>r.data.document],
      ['Situação da ficha',r=>clientPortfolioState(r.id).label],
      ['Contratos no prazo',r=>insuranceRowsForClient(r.id).filter(isContractInPeriod).length],
      ['Prêmio no prazo',r=>money(insuranceRowsForClient(r.id).filter(isContractInPeriod).reduce((s,i)=>s+Number(i.data.premium||0),0))],
      ['Histórico total',r=>insuranceRowsForClient(r.id).length],
      ['Último vencimento',r=>clientLastPeriod(r.id)]
    ],
    fields:[
      ['personType','Tipo','select',['Pessoa Jurídica','Pessoa Física']],
      ['name','Nome / Razão social','text'],
      ['fantasyName','Nome fantasia','text'],
      ['document','CPF/CNPJ','text'],
      ['rg','RG / Inscrição estadual','text'],
      ['birthDate','Nascimento / Fundação','date'],
      ['responsible','Responsável','text'],
      ['email','E-mail','email'],
      ['phone','Telefone','text'],
      ['mobile','Celular / WhatsApp','text'],
      ['zipCode','CEP','text'],
      ['address','Endereço','text'],
      ['addressNumber','Número','text'],
      ['complement','Complemento','text'],
      ['neighborhood','Bairro','text'],
      ['city','Cidade','text'],
      ['state','UF','text'],
      ['notes','Observações','textarea']
    ]
  },
  producer:{
    title:'Produtor',
    columns:[
      ['Nome',r=>r.data.name],
      ['Clientes',r=>producerClients(r.id).length],
      ['Seguros',r=>producerInsurances(r.id).length],
      ['Ativos',r=>producerInsurances(r.id).filter(isInsuranceActive).length],
      ['Comissão bruta',r=>money(producerInsurances(r.id).reduce((sum,i)=>sum+commissionValueOf(i),0))],
      ['Taxa FF',r=>money(producerInsurances(r.id).reduce((sum,i)=>sum+ffFeeOf(i),0))],
      ['Líquido Lebrime',r=>money(producerInsurances(r.id).reduce((sum,i)=>sum+lebrimeNetOf(i),0))],
      ['Comissão do produtor',r=>money(producerInsurances(r.id).reduce((sum,i)=>sum+producerCommissionOf(i),0))]
    ],
    fields:[
      ['name','Nome','text'],['document','CPF/CNPJ','text'],['email','E-mail','email'],
      ['phone','Telefone','text'],['mobile','Celular / WhatsApp','text'],
      ['status','Status','select',['Ativo','Inativo']],['notes','Observações','textarea']
    ]
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
      ['Operação',r=>r.data.policyType||'—'],
      ['Cliente',r=>nameById(r.data.clientId)],
      ['Número',r=>r.data.number],
      ['Seguradora',r=>r.data.insurer],
      ['Ramo',r=>r.data.branch],
      ['Produtor',r=>producerLabelOf(r)],
      ['Vigência',r=>date(r.data.start)+' a '+date(r.data.end)],
      ['Situação da vigência',r=>insurancePeriodState(r).label],
      ['Prêmio',r=>money(r.data.premium)],
      ['Status comercial',r=>r.data.status||'Não informado']
    ],
    fields:[
      ['clientId','Cliente','ref','client'],
      ['producerId','Produtor','ref','producer'],
      ['brokerages','Corretoras','brokerages'],
      ['insurer','Seguradora','combo',insurers],
      ['branch','Ramo','combo',branches],
      ['subBranches','Ramos / seções internas','textarea'],
      ['number','Nº do contrato','text'],
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
    title:'Sinistro',
    columns:[
      ['Cliente',r=>nameById(r.data.clientId)],
      ['Apólice',r=>nameById(r.data.policyId)],
      ['Seguradora',r=>policyForClaim(r)?.data?.insurer||'—'],
      ['Ramo',r=>policyForClaim(r)?.data?.branch||'—'],
      ['Número',r=>r.data.number],
      ['Ocorrência',r=>date(r.data.incidentDate)],
      ['Tipo',r=>r.data.claimType],
      ['Responsável',r=>r.data.responsible],
      ['Próxima ação',r=>r.data.nextActionDate?date(r.data.nextActionDate):'—'],
      ['Status',r=>r.data.status]
    ],
    fields:[
      ['clientId','Cliente','ref','client'],
      ['policyId','Apólice','ref','policy'],
      ['insuredItemId','Item / risco','ref','insuredItem'],
      ['number','Número do sinistro','text'],
      ['claimType','Tipo de sinistro','text'],
      ['incidentDate','Data da ocorrência','date'],
      ['noticeDate','Data do aviso','date'],
      ['status','Status','select',['Aviso','Em análise','Documentação pendente','Regulação','Aguardando oficina','Aguardando seguradora','Indenização autorizada','Pago','Encerrado','Negado']],
      ['responsible','Responsável interno','text'],
      ['workshop','Oficina / prestador','text'],
      ['claimantType','Atendimento','select',['','Segurado','Terceiro','Segurado e terceiro']],
      ['nextAction','Próxima ação','text'],
      ['nextActionDate','Data da próxima ação','date'],
      ['description','Descrição da ocorrência','textarea'],
      ['notes','Observações','textarea']
    ]
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
      ['Contrato',r=>nameById(r.data.policyId||r.data.proposalId)],
      ['Origem',r=>r.data.source||'Manual'],
      ['Destino',r=>r.data.destination||'—'],
      ['Responsável',r=>r.data.responsible],
      ['Prazo',r=>date(r.data.due)],
      ['Status',r=>r.data.status]
    ],
    fields:[
      ['title','Título','text'],['clientId','Cliente','ref','client'],['policyId','Apólice','ref','policy'],['proposalId','Proposta','ref','proposal'],
      ['responsible','Responsável','text'],['due','Prazo','date'],
      ['status','Status','select',['Pendente','Aberta','Em andamento','Concluída']],
      ['notes','Observações','textarea']
    ]
  },
  document:{
    title:'Documento',
    columns:[
      ['Cliente',r=>nameById(r.data.clientId)],
      ['Contrato',r=>nameById(r.data.policyId||r.data.proposalId)],
      ['Corretora',r=>brokerageLabelOf(contractForRow(r))],
      ['Nome',r=>r.data.name],
      ['Tipo',r=>r.data.documentType],
      ['Data',r=>date(r.data.referenceDate)],
      ['Status',r=>r.data.status],
      ['Arquivo',r=>documentAvailable(r)?'Disponível':'Pendente']
    ],
    fields:[
      ['clientId','Cliente','ref','client'],['policyId','Apólice','ref','policy'],['proposalId','Proposta','ref','proposal'],
      ['name','Nome','text'],['documentType','Tipo','text'],['referenceDate','Data de referência','date'],
      ['status','Status','select',['Recebido','Conferido','Pendente']],['notes','Observações','textarea']
    ]
  }
};

function businessFields(kind){
  return [
    ['clientId','Cliente','ref','client'],['producerId','Produtor','ref','producer'],['brokerages','Corretoras','brokerages'],['insurer','Seguradora','combo',insurers],
    ['branch','Ramo','combo',branches],['subBranches','Ramos / seções internas','textarea'],['number','Nº do contrato','text'],
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
  const q=searchKey($('#searchInput')?.value||'');
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

function renderList(){
  const c=config[current];if(!c)return;
  let rows;
  const allRenewals=current==='renewal'?renewalSourceRows():[];

  if(current==='insurance')rows=portfolioRows();
  else if(current==='renewal')rows=applyRenewalFilters(allRenewals);
  else if(current==='payment')rows=applyPaymentFilters([...list('payment')]);
  else if(current==='commission')rows=applyCommissionFilters(effectiveCommissionRows());
  else if(current==='task')rows=applyTaskFilters([...list('task')]);
  else if(current==='document')rows=applyDocumentFilters([...list('document')]);
  else if(current==='claim')rows=applyClaimFilters([...list('claim')]);
  else rows=[...list(current)];

  const q=searchKey($('#searchInput').value);
  if(q)rows=rows.filter(r=>current==='client'?clientSearchText(r).includes(q):genericSearchText(r).includes(q));
  if(current==='client'&&clientPortfolioFilter!=='all')
    rows=rows.filter(r=>clientPortfolioState(r.id).key===clientPortfolioFilter);
  if(current==='insurance'&&insurancePortfolioFilter!=='all')
    rows=rows.filter(r=>{
      const stage=insurancePeriodState(r).key;
      if(insurancePortfolioFilter==='current')return isContractInPeriod(r);
      if(insurancePortfolioFilter==='expired')return stage==='expired';
      if(insurancePortfolioFilter==='future')return stage==='future';
      if(insurancePortfolioFilter==='review')return stage==='unknown';
      return true;
    });

  if(current==='payment')rows.sort((a,b)=>String(a.data.due||'').localeCompare(String(b.data.due||'')));
  if(current==='insurance')rows.sort((a,b)=>String(b.data.start||'').localeCompare(String(a.data.start||'')));
  if(current==='commission')rows.sort((a,b)=>String(nameById(a.data.producerId)).localeCompare(String(nameById(b.data.producerId)),'pt-BR'));
  if(current==='renewal')rows.sort((a,b)=>{
    if(a.kind!==b.kind)return a.kind==='proposal'?-1:1;
    return String(a.data.end||a.data.start||'').localeCompare(String(b.data.end||b.data.start||''));
  });

  $('#listMeta').textContent=`${rows.length} registro(s)`;
  if(current==='client'){
    const categories=[
      ['all','Todos os clientes'],['current','Contratos no prazo'],['history','Somente histórico vencido'],
      ['future','Vigência futura'],['review','Vigência a conferir'],['none','Sem contratos']
    ];
    $('#filters').innerHTML=`
      <div class="portfolio-list-guide">
        <div><strong>Cadastro de clientes</strong><p>Cada pessoa ou empresa aparece uma vez. A ficha reúne todos os anos e documentos, mesmo vencidos.
          Propostas e apólices são contratos equivalentes para a carteira da Lebrime.</p></div>
        <label>Mostrar
          <select id="clientPortfolioFilter">
            ${categories.map(([key,label])=>`<option value="${key}" ${clientPortfolioFilter===key?'selected':''}>${label}</option>`).join('')}
          </select>
        </label>
      </div>`;
  }
  else if(current==='payment')$('#filters').innerHTML=paymentFilterHtml(list('payment'))+paymentSummary(rows);
  else if(current==='commission')$('#filters').innerHTML=commissionFilterHtml(effectiveCommissionRows())+commissionSummary(rows);
  else if(current==='renewal')$('#filters').innerHTML=renewalFilterHtml(allRenewals);
  else if(current==='task')$('#filters').innerHTML=taskFilterHtml(list('task'))+taskSummary(rows);
  else if(current==='document')$('#filters').innerHTML=documentFilterHtml(list('document'))+documentSummary(rows);
  else if(current==='claim')$('#filters').innerHTML=claimFilterHtml(list('claim'))+claimSummary(rows);
  else if(current==='insurance'){
    const pendingProducer=rows.filter(r=>r.kind==='proposal'&&r.data.producerPending&&!r.data.producerId).length;
    const categories=[
      ['all','Todo o histórico'],['current','Contratos no prazo'],['expired','Vigências encerradas'],
      ['future','Vigências futuras'],['review','Vigência sem data']
    ];
    $('#filters').innerHTML=`
      <div class="portfolio-list-guide">
        <div><strong>Carteira única de contratos</strong>
          <p>Propostas importadas e apólices têm o mesmo peso na carteira e no prêmio. O status comercial permanece apenas para consulta operacional.</p>
          ${pendingProducer?`<span class="chip danger">Produtores pendentes: ${pendingProducer}</span>`:''}
        </div>
        <label>Mostrar
          <select id="insurancePortfolioFilter">
            ${categories.map(([key,label])=>`<option value="${key}" ${insurancePortfolioFilter===key?'selected':''}>${label}</option>`).join('')}
          </select>
        </label>
      </div>`;
  }else $('#filters').innerHTML='';

  $('#tableHead').innerHTML='<tr>'+c.columns.map(x=>'<th>'+esc(x[0])+'</th>').join('')+'<th></th></tr>';
  $('#tableBody').innerHTML=rows.length?rows.map(r=>{
    const cells=c.columns.map((x,i)=>{
      const value=x[1](r)??'—';
      if(current==='client'&&i===0)return `<td><button class="name-link" data-client-detail="${r.id}">${esc(value)}</button></td>`;
      if(current==='producer'&&i===0)return `<td><button class="name-link" data-producer-detail="${r.id}">${esc(value)}</button></td>`;
      const label=x[0];
      if(current==='insurance'&&label==='Número')return `<td><button class="name-link" data-insurance-detail="${r.id}">${esc(value)}</button></td>`;
      if(['payment','commission'].includes(current)&&label==='Contrato'){
        const insurance=contractForRow(r);
        return insurance?`<td><button class="name-link" data-linked-insurance="${insurance.id}">${esc(value)}</button></td>`:`<td>${esc(value)}</td>`;
      }
      if(['task','document'].includes(current)&&label==='Cliente'&&r.data.clientId){
        return `<td><button class="name-link" data-linked-client="${r.data.clientId}">${esc(value)}</button></td>`;
      }
      if(current==='document'&&label==='Contrato'){
        const insurance=contractForRow(r);
        return insurance?`<td><button class="name-link" data-linked-insurance="${insurance.id}">${esc(value)}</button></td>`:`<td>${esc(value)}</td>`;
      }
      if(current==='claim'&&label==='Cliente'&&r.data.clientId){
        return `<td><button class="name-link" data-linked-client="${r.data.clientId}">${esc(value)}</button></td>`;
      }
      if(current==='claim'&&label==='Apólice'){
        const policy=policyForClaim(r);
        return policy?`<td><button class="name-link" data-linked-insurance="${policy.id}">${esc(value)}</button></td>`:`<td>${esc(value)}</td>`;
      }
      if(current==='insurance'&&label==='Produtor'&&r.kind==='proposal'&&r.data.producerPending&&!r.data.producerId){
        return '<td><span class="status-pill corporate-status warning">Pendente — preencher</span></td>';
      }
      if(current==='client'&&label==='Situação da ficha'){
        const stage=clientPortfolioState(r.id).key;
        return `<td><span class="portfolio-stage portfolio-stage-${stage}">${esc(value)}</span></td>`;
      }
      if(current==='insurance'&&label==='Situação da vigência'){
        return `<td><span class="portfolio-stage portfolio-stage-${insurancePeriodState(r).key}">${esc(value)}</span></td>`;
      }
      if(['Status','Status comercial','Cobrança','Operação','Origem'].includes(label)){
        const tone=statusTone(value);
        return `<td><span class="status-pill corporate-status ${tone}">${esc(value)}</span></td>`;
      }
      return '<td>'+esc(value)+'</td>';
    }).join('');

    const openFile=current==='document'&&documentAvailable(r)?`<button data-open="${r.id}" class="link-btn">Abrir</button>`:'';
    const insuranceDoc=current==='insurance'?primaryInsuranceDocument(r):null;
    const insuranceFile=current==='insurance'
      ?(insuranceDocumentAvailable(r)
        ?`<button data-open-insurance-pdf="${r.id}" class="link-btn file-action">Abrir PDF</button>`
        :`<button data-insurance-upload="${r.id}" data-client-id="${r.data.clientId||''}" class="link-btn file-action">${insuranceDoc?'Regularizar PDF':'Anexar PDF'}</button>`)
      :'';

    const linkedInsurance=['payment','commission','task','document'].includes(current)?contractForRow(r):(current==='claim'?policyForClaim(r):null);
    const relatedAction=linkedInsurance?`<button data-linked-insurance="${linkedInsurance.id}" class="link-btn">Abrir seguro</button>`:'';
    const editAction=current==='renewal'
      ?`<button data-renewal-track="${r.id}" class="link-btn">${renewalTrackerFor(r)?'Atualizar acompanhamento':'Acompanhar'}</button><button data-renewal-edit="${r.id}" class="link-btn">Abrir seguro</button>`
      :current==='insurance'
        ?`<button data-insurance-detail="${r.id}" class="link-btn">Abrir ficha</button><button data-edit="${r.id}" class="link-btn">Editar</button>`
        :`${relatedAction}<button data-edit="${r.id}" class="link-btn">Editar</button>`;

    return '<tr>'+cells+`<td class="actions">${editAction}${openFile}${insuranceFile}</td></tr>`;
  }).join(''):'<tr><td colspan="'+(c.columns.length+1)+'"><div class="empty">Nenhum registro encontrado.</div></td></tr>';

  const clientFilterControl=$('#clientPortfolioFilter');
  if(clientFilterControl)clientFilterControl.onchange=()=>{clientPortfolioFilter=clientFilterControl.value;renderList();};
  const insuranceFilterControl=$('#insurancePortfolioFilter');
  if(insuranceFilterControl)insuranceFilterControl.onchange=()=>{insurancePortfolioFilter=insuranceFilterControl.value;renderList();};
  document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openEditor(rowById(b.dataset.edit)));
  document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openDocument(rowById(b.dataset.open)));
  document.querySelectorAll('[data-open-insurance-pdf]').forEach(b=>b.onclick=()=>openInsuranceDocument(rowById(b.dataset.openInsurancePdf)));
  document.querySelectorAll('[data-insurance-upload]').forEach(b=>b.onclick=()=>openClientUpload(b.dataset.clientId,b.dataset.insuranceUpload));
  document.querySelectorAll('[data-client-detail]').forEach(b=>b.onclick=()=>openClientDetail(b.dataset.clientDetail));
  document.querySelectorAll('[data-producer-detail]').forEach(b=>b.onclick=()=>openProducerDetail(b.dataset.producerDetail));
  document.querySelectorAll('[data-insurance-detail]').forEach(b=>b.onclick=()=>openInsuranceDetail(b.dataset.insuranceDetail));
  document.querySelectorAll('[data-linked-insurance]').forEach(b=>b.onclick=()=>openInsuranceDetail(b.dataset.linkedInsurance));
  document.querySelectorAll('[data-linked-client]').forEach(b=>b.onclick=()=>openClientDetail(b.dataset.linkedClient));
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

  document.querySelectorAll('[data-payment-filter]').forEach(el=>el.onchange=()=>{
    paymentFilters[el.dataset.paymentFilter]=el.value;renderList();
  });
  const clearPayment=$('#paymentClearFilters');
  if(clearPayment)clearPayment.onclick=()=>{paymentFilters={dateFrom:'',dateTo:'',status:'all',collection:'all',kind:'all',brokerage:'all',insurer:'all'};renderList();};

  document.querySelectorAll('[data-commission-filter]').forEach(el=>el.onchange=()=>{
    commissionFilters[el.dataset.commissionFilter]=el.value;renderList();
  });
  const clearCommission=$('#commissionClearFilters');
  if(clearCommission)clearCommission.onclick=()=>{commissionFilters={receivedFrom:'',receivedTo:'',producer:'all',brokerage:'all',insurer:'all',status:'all'};renderList();};

  document.querySelectorAll('[data-task-filter]').forEach(el=>el.onchange=()=>{
    taskFilters[el.dataset.taskFilter]=el.value;renderList();
  });
  const clearTask=$('#taskClearFilters');
  if(clearTask)clearTask.onclick=()=>{taskFilters={dueFrom:'',dueTo:'',status:'all',source:'all',destination:'all',responsible:'all'};renderList();};

  document.querySelectorAll('[data-document-filter]').forEach(el=>el.onchange=()=>{
    documentFilters[el.dataset.documentFilter]=el.value;renderList();
  });
  const clearDocument=$('#documentClearFilters');
  if(clearDocument)clearDocument.onclick=()=>{documentFilters={type:'all',status:'all',file:'all',brokerage:'all'};renderList();};

  document.querySelectorAll('[data-claim-filter]').forEach(el=>el.onchange=()=>{
    claimFilters[el.dataset.claimFilter]=el.value;renderList();
  });
  const clearClaim=$('#claimClearFilters');
  if(clearClaim)clearClaim.onclick=()=>{claimFilters={incidentFrom:'',incidentTo:'',insurer:'all',branch:'all',status:'all',responsible:'all'};renderList();};
}
function paymentFilterHtml(rows){
  const contracts=rows.map(contractForRow).filter(Boolean);
  const brokerageValues=uniqueSorted(contracts.flatMap(r=>String(r.data.brokerages||r.data.brokerage||'').split('|')));
  const insurerValues=uniqueSorted(contracts.map(r=>r.data.insurer));
  const collectionValues=uniqueSorted(rows.map(r=>r.data.collectionStatus));
  return `
    <div class="finance-filter-shell">
      <div class="finance-filter-grid">
        <label>Vencimento inicial<input type="date" data-payment-filter="dateFrom" value="${esc(paymentFilters.dateFrom)}"></label>
        <label>Vencimento final<input type="date" data-payment-filter="dateTo" value="${esc(paymentFilters.dateTo)}"></label>
        <label>Tipo
          <select data-payment-filter="kind">
            <option value="all">Todos</option>
            <option value="effective" ${paymentFilters.kind==='effective'?'selected':''}>Parcelas efetivas</option>
            <option value="forecast" ${paymentFilters.kind==='forecast'?'selected':''}>Previsões de proposta</option>
            <option value="overdue" ${paymentFilters.kind==='overdue'?'selected':''}>Somente atrasadas</option>
          </select>
        </label>
        <label>Status
          <select data-payment-filter="status">
            <option value="all">Todos</option>
            ${['Em aberto','Pago','Cancelado'].map(v=>`<option value="${v}" ${paymentFilters.status===v?'selected':''}>${v}</option>`).join('')}
          </select>
        </label>
        <label>Cobrança
          <select data-payment-filter="collection"><option value="all">Todas</option>${collectionValues.map(v=>`<option value="${esc(v)}" ${paymentFilters.collection===v?'selected':''}>${esc(v)}</option>`).join('')}</select>
        </label>
        <label>Corretora
          <select data-payment-filter="brokerage"><option value="all">Todas</option>${brokerageValues.map(v=>`<option value="${esc(v)}" ${paymentFilters.brokerage===v?'selected':''}>${esc(v)}</option>`).join('')}</select>
        </label>
        <label>Seguradora
          <select data-payment-filter="insurer"><option value="all">Todas</option>${insurerValues.map(v=>`<option value="${esc(v)}" ${paymentFilters.insurer===v?'selected':''}>${esc(v)}</option>`).join('')}</select>
        </label>
      </div>
      <div class="finance-filter-actions">
        <button type="button" class="btn ghost small" id="paymentClearFilters">Limpar filtros</button>
      </div>
    </div>`;
}

function applyPaymentFilters(rows){
  return rows.filter(r=>{
    const insurance=contractForRow(r);
    const forecast=r.data.financialTracking==='Previsão da proposta';
    const overdue=!forecast&&r.data.status==='Em aberto'&&r.data.due&&r.data.due<today();
    if(paymentFilters.kind==='forecast'&&!forecast)return false;
    if(paymentFilters.kind==='effective'&&forecast)return false;
    if(paymentFilters.kind==='overdue'&&!overdue)return false;
    if(paymentFilters.status!=='all'&&String(r.data.status||'')!==paymentFilters.status)return false;
    if(paymentFilters.collection!=='all'&&String(r.data.collectionStatus||'')!==paymentFilters.collection)return false;
    if(paymentFilters.brokerage!=='all'&&!brokerageMatches(insurance,paymentFilters.brokerage))return false;
    if(paymentFilters.insurer!=='all'&&String(insurance?.data?.insurer||'')!==paymentFilters.insurer)return false;
    if(paymentFilters.dateFrom&&(!r.data.due||String(r.data.due)<paymentFilters.dateFrom))return false;
    if(paymentFilters.dateTo&&(!r.data.due||String(r.data.due)>paymentFilters.dateTo))return false;
    return true;
  });
}

function paymentSummary(rows){
  const forecast=rows.filter(r=>r.data.financialTracking==='Previsão da proposta'&&r.data.status!=='Cancelado');
  const relevant=rows.filter(r=>r.data.financialTracking!=='Previsão da proposta');
  const open=relevant.filter(r=>r.data.status==='Em aberto');
  const paid=relevant.filter(r=>r.data.status==='Pago');
  const overdue=open.filter(r=>r.data.due&&r.data.due<today());
  return `
    <div class="summary-strip">
      <span class="chip">Previsões: ${forecast.length} · ${money(forecast.reduce((s,r)=>s+Number(r.data.amount||0),0))}</span>
      <span class="chip">Em aberto: ${open.length} · ${money(open.reduce((s,r)=>s+Number(r.data.amount||0),0))}</span>
      <span class="chip danger">Atrasadas: ${overdue.length} · ${money(overdue.reduce((s,r)=>s+Number(r.data.amount||0),0))}</span>
      <span class="chip">Pagas: ${paid.length} · ${money(paid.reduce((s,r)=>s+Number(r.data.amount||0),0))}</span>
      <span class="chip">Corte da implantação: ${CUTOFF}</span>
    </div>`;
}

function commissionFilterHtml(rows){
  const contracts=rows.map(contractForRow).filter(Boolean);
  const producerIds=uniqueSorted(rows.map(r=>r.data.producerId));
  const brokerageValues=uniqueSorted(contracts.flatMap(r=>String(r.data.brokerages||r.data.brokerage||'').split('|')));
  const insurerValues=uniqueSorted(contracts.map(r=>r.data.insurer));
  const statusValues=uniqueSorted(rows.map(r=>r.data.status||'Prevista'));
  return `
    <div class="finance-filter-shell">
      <div class="finance-filter-grid">
        <label>Recebimento inicial<input type="date" data-commission-filter="receivedFrom" value="${esc(commissionFilters.receivedFrom)}"></label>
        <label>Recebimento final<input type="date" data-commission-filter="receivedTo" value="${esc(commissionFilters.receivedTo)}"></label>
        <label>Produtor
          <select data-commission-filter="producer"><option value="all">Todos</option>${producerIds.map(id=>`<option value="${id}" ${commissionFilters.producer===id?'selected':''}>${esc(nameById(id))}</option>`).join('')}</select>
        </label>
        <label>Corretora
          <select data-commission-filter="brokerage"><option value="all">Todas</option>${brokerageValues.map(v=>`<option value="${esc(v)}" ${commissionFilters.brokerage===v?'selected':''}>${esc(v)}</option>`).join('')}</select>
        </label>
        <label>Seguradora
          <select data-commission-filter="insurer"><option value="all">Todas</option>${insurerValues.map(v=>`<option value="${esc(v)}" ${commissionFilters.insurer===v?'selected':''}>${esc(v)}</option>`).join('')}</select>
        </label>
        <label>Status
          <select data-commission-filter="status"><option value="all">Todos</option>${statusValues.map(v=>`<option value="${esc(v)}" ${commissionFilters.status===v?'selected':''}>${esc(v)}</option>`).join('')}</select>
        </label>
      </div>
      <div class="finance-filter-actions">
        <button type="button" class="btn ghost small" id="commissionClearFilters">Limpar filtros</button>
      </div>
    </div>`;
}

function applyCommissionFilters(rows){
  return rows.filter(r=>{
    const insurance=contractForRow(r);
    if(commissionFilters.producer!=='all'&&String(r.data.producerId||'')!==commissionFilters.producer)return false;
    if(commissionFilters.brokerage!=='all'&&!brokerageMatches(insurance,commissionFilters.brokerage))return false;
    if(commissionFilters.insurer!=='all'&&String(insurance?.data?.insurer||'')!==commissionFilters.insurer)return false;
    if(commissionFilters.status!=='all'&&String(r.data.status||'Prevista')!==commissionFilters.status)return false;
    if(commissionFilters.receivedFrom&&(!r.data.receivedDate||String(r.data.receivedDate)<commissionFilters.receivedFrom))return false;
    if(commissionFilters.receivedTo&&(!r.data.receivedDate||String(r.data.receivedDate)>commissionFilters.receivedTo))return false;
    return true;
  });
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
    <div class="summary-strip">
      <span class="chip">Comissão bruta: ${money(gross)}</span>
      <span class="chip">Taxa FF: ${money(ff)}</span>
      <span class="chip">Produtores: ${money(producer)}</span>
      <span class="chip">Taxa Lebrime: ${money(lebrime)}</span>
      <span class="chip">Líquido Lebrime: ${money(lebrimeNet)}</span>
      <span class="chip">Recebida: ${money(received)}</span>
      <span class="chip">Paga a produtores: ${money(paid)}</span>
      <span class="chip">Lucro realizado: ${money(received-paid)}</span>
    </div>`;
}

function taskFilterHtml(rows){
  const statusValues=uniqueSorted(rows.map(r=>r.data.status));
  const sourceValues=uniqueSorted(rows.map(r=>r.data.source||'Manual'));
  const destinationValues=uniqueSorted(rows.map(r=>r.data.destination));
  const responsibleValues=uniqueSorted(rows.map(r=>r.data.responsible));
  return `
    <div class="finance-filter-shell">
      <div class="finance-filter-grid">
        <label>Prazo inicial<input type="date" data-task-filter="dueFrom" value="${esc(taskFilters.dueFrom)}"></label>
        <label>Prazo final<input type="date" data-task-filter="dueTo" value="${esc(taskFilters.dueTo)}"></label>
        <label>Status
          <select data-task-filter="status"><option value="all">Todos</option>${statusValues.map(v=>`<option value="${esc(v)}" ${taskFilters.status===v?'selected':''}>${esc(v)}</option>`).join('')}</select>
        </label>
        <label>Origem
          <select data-task-filter="source"><option value="all">Todas</option>${sourceValues.map(v=>`<option value="${esc(v)}" ${taskFilters.source===v?'selected':''}>${esc(v)}</option>`).join('')}</select>
        </label>
        <label>Destino
          <select data-task-filter="destination"><option value="all">Todos</option>${destinationValues.map(v=>`<option value="${esc(v)}" ${taskFilters.destination===v?'selected':''}>${esc(v)}</option>`).join('')}</select>
        </label>
        <label>Responsável
          <select data-task-filter="responsible"><option value="all">Todos</option>${responsibleValues.map(v=>`<option value="${esc(v)}" ${taskFilters.responsible===v?'selected':''}>${esc(v)}</option>`).join('')}</select>
        </label>
      </div>
      <div class="finance-filter-actions">
        <button type="button" class="btn ghost small" id="taskClearFilters">Limpar filtros</button>
      </div>
    </div>`;
}

function applyTaskFilters(rows){
  return rows.filter(r=>{
    if(taskFilters.status!=='all'&&String(r.data.status||'')!==taskFilters.status)return false;
    if(taskFilters.source!=='all'&&String(r.data.source||'Manual')!==taskFilters.source)return false;
    if(taskFilters.destination!=='all'&&String(r.data.destination||'')!==taskFilters.destination)return false;
    if(taskFilters.responsible!=='all'&&String(r.data.responsible||'')!==taskFilters.responsible)return false;
    if(taskFilters.dueFrom&&(!r.data.due||String(r.data.due)<taskFilters.dueFrom))return false;
    if(taskFilters.dueTo&&(!r.data.due||String(r.data.due)>taskFilters.dueTo))return false;
    return true;
  });
}

function taskSummary(rows){
  const open=rows.filter(r=>!['Concluído','Concluída','Regularizado'].includes(String(r.data.status||'')));
  const integration=open.filter(r=>String(r.data.source||'').includes('Integração')||String(r.data.integrationProvider||''));
  const overdue=open.filter(r=>r.data.due&&r.data.due<today());
  return `
    <div class="summary-strip">
      <span class="chip">Pendências abertas: ${open.length}</span>
      <span class="chip danger">Vencidas: ${overdue.length}</span>
      <span class="chip">Exceções de integração: ${integration.length}</span>
    </div>`;
}


function documentFilterHtml(rows){
  const types=uniqueSorted(rows.map(r=>r.data.documentType));
  const statuses=uniqueSorted(rows.map(r=>r.data.status));
  const contracts=rows.map(contractForRow).filter(Boolean);
  const brokerages=uniqueSorted(contracts.flatMap(r=>String(r.data.brokerages||r.data.brokerage||'').split('|')));
  return `
    <div class="finance-filter-shell">
      <div class="finance-filter-grid">
        <label>Tipo
          <select data-document-filter="type"><option value="all">Todos</option>${types.map(v=>`<option value="${esc(v)}" ${documentFilters.type===v?'selected':''}>${esc(v)}</option>`).join('')}</select>
        </label>
        <label>Status
          <select data-document-filter="status"><option value="all">Todos</option>${statuses.map(v=>`<option value="${esc(v)}" ${documentFilters.status===v?'selected':''}>${esc(v)}</option>`).join('')}</select>
        </label>
        <label>Arquivo
          <select data-document-filter="file">
            <option value="all">Todos</option>
            <option value="available" ${documentFilters.file==='available'?'selected':''}>Disponível</option>
            <option value="missing" ${documentFilters.file==='missing'?'selected':''}>Pendente</option>
          </select>
        </label>
        <label>Corretora
          <select data-document-filter="brokerage"><option value="all">Todas</option>${brokerages.map(v=>`<option value="${esc(v)}" ${documentFilters.brokerage===v?'selected':''}>${esc(v)}</option>`).join('')}</select>
        </label>
      </div>
      <div class="finance-filter-actions">
        <button type="button" class="btn ghost small" id="documentClearFilters">Limpar filtros</button>
      </div>
    </div>`;
}

function applyDocumentFilters(rows){
  return rows.filter(r=>{
    const insurance=contractForRow(r);
    if(documentFilters.type!=='all'&&String(r.data.documentType||'')!==documentFilters.type)return false;
    if(documentFilters.status!=='all'&&String(r.data.status||'')!==documentFilters.status)return false;
    if(documentFilters.file==='available'&&!documentAvailable(r))return false;
    if(documentFilters.file==='missing'&&documentAvailable(r))return false;
    if(documentFilters.brokerage!=='all'&&!brokerageMatches(insurance,documentFilters.brokerage))return false;
    return true;
  });
}

function documentSummary(rows){
  const available=rows.filter(documentAvailable).length;
  const missing=rows.length-available;
  const endorsements=rows.filter(r=>fold(r.data.documentType||'')==='endosso').length;
  return `<div class="summary-strip">
    <span class="chip">Documentos: ${rows.length}</span>
    <span class="chip">Arquivos disponíveis: ${available}</span>
    <span class="chip ${missing?'danger':''}">Arquivos pendentes: ${missing}</span>
    <span class="chip">Endossos: ${endorsements}</span>
  </div>`;
}


function claimFilterHtml(rows){
  const policies=rows.map(policyForClaim).filter(Boolean);
  const insurers=uniqueSorted(policies.map(r=>r.data.insurer));
  const branches=uniqueSorted(policies.map(r=>r.data.branch));
  const statuses=uniqueSorted(rows.map(r=>r.data.status));
  const responsibles=uniqueSorted(rows.map(r=>r.data.responsible));
  return `
    <div class="finance-filter-shell">
      <div class="finance-filter-grid">
        <label>Ocorrência inicial<input type="date" data-claim-filter="incidentFrom" value="${esc(claimFilters.incidentFrom)}"></label>
        <label>Ocorrência final<input type="date" data-claim-filter="incidentTo" value="${esc(claimFilters.incidentTo)}"></label>
        <label>Seguradora
          <select data-claim-filter="insurer"><option value="all">Todas</option>${insurers.map(v=>`<option value="${esc(v)}" ${claimFilters.insurer===v?'selected':''}>${esc(v)}</option>`).join('')}</select>
        </label>
        <label>Ramo
          <select data-claim-filter="branch"><option value="all">Todos</option>${branches.map(v=>`<option value="${esc(v)}" ${claimFilters.branch===v?'selected':''}>${esc(v)}</option>`).join('')}</select>
        </label>
        <label>Status
          <select data-claim-filter="status"><option value="all">Todos</option>${statuses.map(v=>`<option value="${esc(v)}" ${claimFilters.status===v?'selected':''}>${esc(v)}</option>`).join('')}</select>
        </label>
        <label>Responsável
          <select data-claim-filter="responsible"><option value="all">Todos</option>${responsibles.map(v=>`<option value="${esc(v)}" ${claimFilters.responsible===v?'selected':''}>${esc(v)}</option>`).join('')}</select>
        </label>
      </div>
      <div class="finance-filter-actions">
        <button type="button" class="btn ghost small" id="claimClearFilters">Limpar filtros</button>
      </div>
    </div>`;
}

function applyClaimFilters(rows){
  return rows.filter(r=>{
    const policy=policyForClaim(r);
    if(claimFilters.insurer!=='all'&&String(policy?.data?.insurer||'')!==claimFilters.insurer)return false;
    if(claimFilters.branch!=='all'&&String(policy?.data?.branch||'')!==claimFilters.branch)return false;
    if(claimFilters.status!=='all'&&String(r.data.status||'')!==claimFilters.status)return false;
    if(claimFilters.responsible!=='all'&&String(r.data.responsible||'')!==claimFilters.responsible)return false;
    if(claimFilters.incidentFrom&&(!r.data.incidentDate||String(r.data.incidentDate)<claimFilters.incidentFrom))return false;
    if(claimFilters.incidentTo&&(!r.data.incidentDate||String(r.data.incidentDate)>claimFilters.incidentTo))return false;
    return true;
  });
}

function claimSummary(rows){
  const open=rows.filter(r=>!['Pago','Encerrado','Negado'].includes(String(r.data.status||'')));
  const docPending=open.filter(r=>String(r.data.status||'')==='Documentação pendente');
  const overdueAction=open.filter(r=>r.data.nextActionDate&&r.data.nextActionDate<today());
  return `<div class="summary-strip">
    <span class="chip">Sinistros: ${rows.length}</span>
    <span class="chip">Em acompanhamento: ${open.length}</span>
    <span class="chip ${docPending.length?'danger':''}">Documentação pendente: ${docPending.length}</span>
    <span class="chip ${overdueAction.length?'danger':''}">Ações vencidas: ${overdueAction.length}</span>
  </div>`;
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
    const dup=[...list('proposal'),...list('policy')].find(r=>r.id!==editing?.id&&String(r.data.clientId)===String(data.clientId)&&norm(r.data.insurer)===norm(data.insurer)&&norm(r.data.number)===norm(data.number)&&norm(r.data.branch)===norm(data.branch)&&String(r.data.start||'')===String(data.start||'')&&String(r.data.end||'')===String(data.end||''));
    if(dup)return 'Já existe um registro com este cliente, seguradora, ramo, número e vigência.';
  }
  if(current==='claim'){
    if(!data.clientId||!data.policyId)return 'Vincule o sinistro ao cliente e à apólice correspondente.';
    const policy=rowById(data.policyId);
    if(!policy||policy.kind!=='policy')return 'O sinistro deve ser vinculado a uma apólice válida.';
    if(String(policy.data.clientId||'')!==String(data.clientId))return 'A apólice selecionada não pertence ao cliente informado.';
    if(data.insuredItemId){
      const item=rowById(data.insuredItemId);
      if(!item||String(item.data.policyId||'')!==String(data.policyId))return 'O item segurado selecionado não pertence à apólice informada.';
    }
    const duplicate=list('claim').find(r=>r.id!==editing?.id&&norm(r.data.number)===norm(data.number)&&String(r.data.policyId||'')===String(data.policyId));
    if(duplicate)return 'Já existe um sinistro com este número vinculado à mesma apólice.';
  }
  if(current==='task'){
    if(data.policyId&&data.proposalId)return 'Vincule a pendência a apenas uma apólice ou proposta.';
  }
  if(current==='document'){
    if(data.policyId&&data.proposalId)return 'Vincule o documento a apenas uma apólice ou proposta.';
    const insurance=rowById(data.policyId||data.proposalId);
    if(insurance&&data.clientId&&String(insurance.data.clientId||'')!==String(data.clientId))return 'O contrato selecionado não pertence ao cliente informado.';
    if(fold(data.documentType||'')==='endosso'&&!insurance)return 'Endosso deve ser vinculado à proposta ou apólice correspondente.';
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
  const producerCommissions=effectiveCommissionRows().filter(r=>String(r.data.producerId||'')===String(producerId));
  const received=producerCommissions.reduce((sum,r)=>sum+Number(r.data.received||0),0);
  const transferPaid=producerCommissions.reduce((sum,r)=>sum+Number(r.data.transferPaid||0),0);
  const activeCount=insurances.filter(isInsuranceActive).length;
  const special=isLeandro(producerId);
  const rule=special
    ?'LEANDRO: em operações da corretora Lebrime, Leandro recebe 100% da comissão bruta. Em FF Apolinário/Homeni/Eólica, Leandro recebe 70% e a Taxa FF fica com 30%. Taxa Lebrime = 0%.'
    :'Produtor recebe 60% da comissão bruta. Taxa Lebrime = 40%. Em FF Apolinário/Homeni/Eólica, a Taxa FF de 30% é descontada da parte da Lebrime, restando 10% líquido para a Lebrime.';

  const rows=insurances.length?insurances.map(r=>`
    <div class="producer-insurance-row">
      <div><span>Cliente</span><button class="name-link" data-producer-client="${r.data.clientId}">${esc(nameById(r.data.clientId))}</button></div>
      <div><span>Contrato</span><button class="name-link" data-producer-insurance="${r.id}">${esc(r.data.number||'—')}</button></div>
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
      <div><span>Seguros ativos</span><strong>${activeCount}</strong></div>
      <div><span>Comissão bruta prevista</span><strong>${money(totalGross)}</strong></div>
      <div><span>Comissão do produtor prevista</span><strong>${money(totalProducer)}</strong></div>
      <div><span>Recebida pela Lebrime</span><strong>${money(received)}</strong></div>
      <div><span>Paga ao produtor</span><strong>${money(transferPaid)}</strong></div>
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
  document.querySelectorAll('[data-producer-insurance]').forEach(b=>b.onclick=()=>{
    $('#producerDialog').close();
    openInsuranceDetail(b.dataset.producerInsurance);
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
  const contracts=[...list('proposal'),...list('policy'),...list('endorsement')]
    .filter(r=>String(r.data.clientId||'')===String(clientId));
  const insuranceIds=new Set(contracts.map(r=>r.id));
  return list('document')
    .filter(r=>String(r.data.clientId||'')===String(clientId)||
      insuranceIds.has(String(r.data.policyId||''))||
      insuranceIds.has(String(r.data.proposalId||''))||
      insuranceIds.has(String(r.data.endorsementId||'')))
    .sort((a,b)=>String(b.data.referenceDate||b.createdAt||'').localeCompare(String(a.data.referenceDate||a.createdAt||'')));
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
  const storedDocs=docs.filter(documentAvailable);
  const currentPeriodInsurances=insurances.filter(isContractInPeriod);
  const expiredInsurances=insurances.filter(r=>insurancePeriodState(r).key==='expired');
  const futureInsurances=insurances.filter(r=>insurancePeriodState(r).key==='future');
  const undatedInsurances=insurances.filter(r=>insurancePeriodState(r).key==='unknown');
  const totalPremium=currentPeriodInsurances.reduce((sum,r)=>sum+Number(r.data.premium||0),0);
  const payments=list('payment').filter(r=>
    visibleInsuranceIds.has(String(r.data.policyId||''))||
    visibleInsuranceIds.has(String(r.data.proposalId||''))||
    (brokerageFilter==='all'&&String(r.data.clientId||'')===String(clientId))
  );
  const openPayments=payments.filter(r=>r.data.status==='Em aberto'&&r.data.financialTracking!=='Previsão da proposta');
  const commissions=effectiveCommissionRows().filter(r=>
    visibleInsuranceIds.has(String(r.data.policyId||''))||visibleInsuranceIds.has(String(r.data.proposalId||''))
  );
  const tasks=list('task').filter(r=>
    visibleInsuranceIds.has(String(r.data.policyId||''))||
    visibleInsuranceIds.has(String(r.data.proposalId||''))||
    (brokerageFilter==='all'&&String(r.data.clientId||'')===String(clientId))
  ).filter(r=>!['Concluído','Concluída','Regularizado'].includes(String(r.data.status||'')));
  const renewals=renewalSourceRows().filter(r=>visibleInsuranceIds.has(r.id));
  const claims=list('claim').filter(r=>
    visibleInsuranceIds.has(String(r.data.policyId||''))||
    (brokerageFilter==='all'&&String(r.data.clientId||'')===String(clientId))
  );
  const openClaims=claims.filter(r=>!['Pago','Encerrado','Negado'].includes(String(r.data.status||'')));
  const brokeragesForClient=clientBrokerageOptions(allInsurances);

  const insuranceHtml=insurances.length?insurances.map((r,index)=>{
    const doc=primaryInsuranceDocument(r);
    const hasPdf=insuranceDocumentAvailable(r);
    const endorsementCount=relatedEndorsementsFor(r).length+
      insuranceDocuments(r).filter(x=>fold(x.data.documentType||'')==='endosso').length;
    const periodState=insurancePeriodState(r);
    const periodTitle=insuranceHistoryPeriod(r);
    const previousPeriod=index>0?insuranceHistoryPeriod(insurances[index-1]):'';
    const periodHeading=index===0||periodTitle!==previousPeriod
      ?`<div class="client-history-period-title"><strong>Vigência ${esc(periodTitle)}</strong><span>Histórico do cliente · todas as propostas e apólices</span></div>`
      :'';
    const broker=String(r.data.brokerages||r.data.brokerage||'—').replace(/\|/g,' · ');
    const fileState=hasPdf?'Arquivo disponível':doc?'PDF pendente':'Sem arquivo';
    return `${periodHeading}
      <article class="insurance-card">
        <div class="insurance-card-head">
          <div><span class="record-type">CONTRATO</span><h4>${esc(r.data.number||'Sem número')}</h4></div>
          <span class="status-pill corporate-status ${statusTone(r.data.status)}">${esc(r.data.status||'Cadastrado')}</span>
        </div>
        <div class="insurance-card-grid">
          <div><span>Seguradora</span><strong>${esc(r.data.insurer||'—')}</strong></div>
          <div><span>Ramo</span><strong>${esc(r.data.branch||'—')}</strong></div>
          <div><span>Produtor</span><strong>${esc(producerLabelOf(r))}</strong></div>
          <div><span>Corretora</span><strong>${esc(broker)}</strong></div>
          <div><span>Vigência</span><strong>${date(r.data.start)} a ${date(r.data.end)}</strong></div>
          <div><span>Situação da vigência</span><strong class="insurance-period-${periodState.key}">${esc(periodState.label)}</strong></div>
          <div><span>Prêmio</span><strong>${money(r.data.premium)}</strong></div>
        </div>
        <div class="insurance-card-foot">
          <span class="contract-file-state ${hasPdf?'ready':doc?'pending':'neutral'}">${esc(fileState)}</span>
          ${endorsementCount?`<span class="contract-file-state ready">${endorsementCount} endosso(s)</span>`:''}
          ${hasPdf?`<button class="btn ghost small" data-client-open-insurance-pdf="${r.id}">Abrir PDF</button>`:''}
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

  const claimHtml=claims.length?claims.slice(0,10).map(r=>`
    <div class="detail-row">
      <div><strong>${esc(r.data.number||'Sinistro')}</strong><span>${r.data.incidentDate?date(r.data.incidentDate):'Data não informada'} · ${esc(r.data.claimType||'Sinistro')}</span></div>
      <div class="row-end"><span class="status-pill corporate-status ${statusTone(r.data.status)}">${esc(r.data.status||'—')}</span><button class="link-btn" data-client-claim-policy="${r.data.policyId||''}">Abrir apólice</button></div>
    </div>
  `).join(''):'<div class="empty compact">Nenhum sinistro vinculado aos contratos exibidos.</div>';

  const docHtml=docs.length?docs.map(doc=>{
    const linked=rowById(doc.data.policyId||doc.data.proposalId||doc.data.endorsementId);
    const action=documentAvailable(doc)
      ?`<button class="btn ghost small" data-client-open-doc="${doc.id}">Abrir</button>`
      :linked?`<button class="btn ghost small" data-client-upload-doc="${linked.id}" data-client-id="${clientId}">Anexar PDF</button>`:'';
    return `<div class="detail-row"><div><strong>${esc(doc.data.name||doc.data.documentType||'Documento')}</strong><span>${esc(doc.data.documentType||'Documento')} · ${linked?esc(insuranceLabel(linked)):'Documento geral'}</span></div>${action}</div>`;
  }).join(''):'<div class="empty compact">Nenhum documento vinculado.</div>';

  $('#clientDetailTitle').textContent=d.name||'Cliente';
  $('#clientDetailBody').innerHTML=`
    <div class="client-kpis">
      <div><span>Contratos no histórico</span><strong>${insurances.length}</strong></div>
      <div><span>Vigências no prazo</span><strong>${currentPeriodInsurances.length}</strong></div>
      <div><span>Vigências encerradas</span><strong>${expiredInsurances.length}</strong></div>
      <div><span>Vigências futuras</span><strong>${futureInsurances.length}</strong></div>
      <div><span>Vigências a confirmar</span><strong>${undatedInsurances.length}</strong></div>
      <div><span>Prêmio dos registros no prazo</span><strong>${money(totalPremium)}</strong></div>
      <div><span>Parcelas em aberto</span><strong>${openPayments.length}</strong></div>
      <div><span>Pendências</span><strong>${tasks.length}</strong></div>
      <div><span>Comissões</span><strong>${commissions.length}</strong></div>
      <div><span>Sinistros abertos</span><strong>${openClaims.length}</strong></div>
      <div><span>Documentos</span><strong>${storedDocs.length}</strong></div>
    </div>
    <div class="detail-grid">
      <div><span>CPF/CNPJ</span><strong>${esc(d.document||'—')}</strong></div>
      <div><span>RG / Inscrição estadual</span><strong>${esc(d.rg||'—')}</strong></div>
      <div><span>Nascimento / Fundação</span><strong>${d.birthDate?date(d.birthDate):'—'}</strong></div>
      <div><span>Telefone</span><strong>${esc(d.phone||'—')}</strong></div>
      <div><span>Celular / WhatsApp</span><strong>${esc(d.mobile||'—')}</strong></div>
      <div><span>E-mail</span><strong>${esc(d.email||'—')}</strong></div>
      <div><span>Responsável</span><strong>${esc(d.responsible||'—')}</strong></div>
      <div><span>CEP</span><strong>${esc(d.zipCode||'—')}</strong></div>
      <div><span>Cidade/UF</span><strong>${esc([d.city,d.state].filter(Boolean).join('/')||'—')}</strong></div>
      <div><span>Nome fantasia</span><strong>${esc(d.fantasyName||'—')}</strong></div>
      <div><span>Bairro</span><strong>${esc(d.neighborhood||'—')}</strong></div>
      <div class="wide"><span>Endereço</span><strong>${esc([d.address,d.addressNumber,d.complement].filter(Boolean).join(', ')||'—')}</strong></div>
    </div>

    <section class="detail-section">
      <div class="section-title-row client-contract-heading">
        <div><h3>Contratos — histórico completo</h3><p>Todas as vigências, inclusive encerradas, futuras e em análise. O status da proposta não é confirmação de emissão. Histórico vinculado ao CPF/CNPJ e à corretora de cada contrato.</p></div>
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
      <section class="detail-section"><div class="section-title-row"><div><h3>Sinistros</h3><p>Sinistros vinculados às apólices exibidas.</p></div></div>${claimHtml}</section>
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
  document.querySelectorAll('[data-client-claim-policy]').forEach(b=>b.onclick=()=>{
    const policy=rowById(b.dataset.clientClaimPolicy);
    if(policy){$('#clientDialog').close();openInsuranceDetail(policy.id);}
  });
  document.querySelectorAll('[data-client-open-doc]').forEach(b=>b.onclick=()=>openDocument(rowById(b.dataset.clientOpenDoc)));
  document.querySelectorAll('[data-client-open-insurance-pdf]').forEach(b=>b.onclick=()=>openInsuranceDocument(rowById(b.dataset.clientOpenInsurancePdf)));
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
  const commissions=effectiveCommissionRows().filter(c=>String(c.data.policyId||c.data.proposalId||'')===insurance.id);
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

  const directInsurancePdf=documentExternalUrl(insurance);
  const docHtml=docs.length?docs.map(r=>`
    <div class="detail-row"><div><strong>${esc(r.data.name||r.data.documentType||'Documento')}</strong><span>${esc(r.data.documentType||'Documento')} · ${date(r.data.referenceDate)}</span></div>
      ${documentAvailable(r)?`<button class="btn ghost small" data-insurance-open-doc="${r.id}">Abrir</button>`:(directInsurancePdf?`<button class="btn ghost small" data-insurance-open-source="${insurance.id}">Abrir PDF</button>`:`<span class="file-missing">PDF pendente</span>`)}</div>
  `).join(''):(directInsurancePdf?`
    <div class="detail-row"><div><strong>${esc(insurance.data.sourceFileName||'PDF original')}</strong><span>Documento · arquivo de origem</span></div>
      <button class="btn ghost small" data-insurance-open-source="${insurance.id}">Abrir PDF</button></div>
  `:'<div class="empty compact">Nenhum documento vinculado.</div>');

  const pendingTasks=tasks.filter(r=>!['Concluído','Concluída','Regularizado'].includes(String(r.data.status||'')));
  const taskHtml=pendingTasks.length?pendingTasks.map(r=>`
    <div class="detail-row"><div><strong>${esc(r.data.title||'Pendência')}</strong><span>${esc(r.data.source||'Operação')} · ${r.data.due?date(r.data.due):'Sem prazo'}</span></div><span class="status-pill corporate-status ${statusTone(r.data.status)}">${esc(r.data.status||'Pendente')}</span></div>
  `).join(''):'<div class="empty compact">Nenhuma pendência aberta.</div>';

  const claimHtml=claims.length?claims.map(r=>`
    <div class="detail-row"><div><strong>${esc(r.data.number||'Sinistro')}</strong><span>${r.data.incidentDate?date(r.data.incidentDate):'Data não informada'} · ${esc(r.data.claimType||'Sinistro')}</span></div><span class="status-pill corporate-status ${statusTone(r.data.status)}">${esc(r.data.status||'—')}</span></div>
  `).join(''):'<div class="empty compact">Nenhum sinistro vinculado.</div>';

  $('#insuranceDetailTitle').textContent=`Contrato ${insurance.data.number||'sem número'}`;
  $('#insuranceDetailBody').innerHTML=`
    <div class="contract-hero">
      <div><span class="record-type">CONTRATO</span><h3>${esc(client.name||'Cliente')}</h3><p>${esc(insurance.data.insurer||'—')} · ${esc(insurance.data.branch||'—')}</p></div>
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
  document.querySelectorAll('[data-insurance-open-source]').forEach(b=>b.onclick=()=>openInsuranceDocument(rowById(b.dataset.insuranceOpenSource)));
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
      return sameClient&&sameContract&&sameType&&!documentAvailable(doc);
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
  if(!entry)return;
  if(entry.data?.storageKey){
    try{
      const blob=await api('storage-get',null,{blob:true,key:entry.data.storageKey});
      const url=URL.createObjectURL(blob);window.open(url,'_blank','noopener');
      setTimeout(()=>URL.revokeObjectURL(url),60000);
    }catch(e){alert(e.message)}
    return;
  }
  const externalUrl=documentExternalUrl(entry);
  if(externalUrl){
    window.open(externalUrl,'_blank','noopener');
    return;
  }
  alert('O registro deste documento foi localizado, mas o arquivo físico ainda não está disponível. Use “Regularizar arquivo” para anexar o PDF sem criar duplicidade.');
}

$('#reloadPortfolioBtn').onclick=()=>boot();
$('#loadingLogoutBtn').onclick=logout;
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