const API='https://paiezoesntmicnwcmemt.supabase.co/functions/v1/lebrime-api';
const TOKEN_KEY='lebrime_token_v1';
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
  ['imports','Arquivos']
];

const brokerages=['Lebrime','FF Apolinário','Homeni Corretora'];
const insurers=['Porto','Allianz','Zurich','HDI','Tokio Marine','Yelum','MAPFRE','Bradesco','Suhai','Ezze','Sura','Berkley','Fator','Akad','Aliro','Avla','Potencial','Aruana','Chubb','Junto'];
const branches=['Automóvel','Frota','Residencial','Empresarial','Multirrisco','Acidentes Pessoais','Vida','Seguro Garantia','Responsabilidade Civil','RC Profissional','RC Obras','RC Empregador','Fiança Locatícia','Transporte','Riscos Nomeados e Operacionais','Riscos de Engenharia','Equipamentos','Condomínio','Cyber','D&O','E&O','Riscos Diversos','Outros'];

let records=[];
let current='overview';
let editing=null;
let uploadPrefill={clientId:'',insuranceId:''};

const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const token=()=>localStorage.getItem(TOKEN_KEY)||'';
const uuid=()=>crypto.randomUUID();
const now=()=>new Date().toISOString();
const today=()=>new Date().toISOString().slice(0,10);
const digits=v=>String(v||'').replace(/\D/g,'');
const norm=v=>String(v||'').trim().toLocaleLowerCase('pt-BR');
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
const insuranceLabel=insurance=>{
  const type=insurance.kind==='policy'?'Apólice':'Proposta';
  return `${type} ${insurance.data.number||'sem número'} · ${insurance.data.insurer||'—'} · ${insurance.data.branch||'—'}`;
};

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

async function loadRecords(){
  const j=await api('select',{orderUpdatedDesc:true});
  records=(j.rows||[]).map(r=>({...r,data:r.data||{},version:Number(r.version||1),createdAt:r.created_at,updatedAt:r.updated_at}));
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
  $('#nav').innerHTML=menu.map(([key,label])=>`<button data-view="${key}" class="${current===key?'active':''}">${label}</button>`).join('');
  $('#nav').querySelectorAll('button').forEach(b=>b.onclick=()=>navigate(b.dataset.view));
}

function navigate(view){
  current=view;editing=null;renderNav();
  $('#dashboard').classList.toggle('hidden',view!=='overview');
  $('#listView').classList.toggle('hidden',view==='overview'||view==='imports');
  $('#importView').classList.toggle('hidden',view!=='imports');
  $('#newBtn').classList.toggle('hidden',view==='overview'||view==='imports');
  $('#searchInput').value='';
  const label=menu.find(x=>x[0]===view)?.[1]||'Lebrime';
  $('#pageTitle').textContent=label;
  if(view==='overview')renderDashboard();
  else if(view==='imports')renderImportClients();
  else renderList();
}

function renderDashboard(){
  const activePolicies=list('policy').filter(r=>r.data.status!=='Cancelada');
  const payments=list('payment');
  const open=payments.filter(r=>r.data.status==='Em aberto'&&r.data.financialTracking!=='Previsão da proposta');
  const overdue=open.filter(r=>r.data.due&&r.data.due<today());
  const renew60=activePolicies.filter(r=>{
    if(!r.data.end)return false;
    const d=(new Date(r.data.end+'T12:00:00Z')-new Date(today()+'T12:00:00Z'))/86400000;
    return d>=0&&d<=60;
  });
  const comm=list('commission');
  const received=comm.reduce((s,r)=>s+Number(r.data.received||0),0);
  const paid=comm.reduce((s,r)=>s+Number(r.data.transferPaid||0),0);

  $('#dashboard').innerHTML=`
    <div class="cards">
      ${metric('Clientes',list('client').length,'Cadastro único por CPF/CNPJ')}
      ${metric('Apólices ativas',activePolicies.length,'Carteira vigente')}
      ${metric('Parcelas em aberto',open.length,money(open.reduce((s,r)=>s+Number(r.data.amount||0),0)))}
      ${metric('Atrasadas',overdue.length,money(overdue.reduce((s,r)=>s+Number(r.data.amount||0),0)))}
      ${metric('Renovam em 60 dias',renew60.length,'Acompanhamento prioritário')}
      ${metric('Lucro de comissão',money(received-paid),'Recebida − repasse pago')}
    </div>
    <div class="dashboard-grid">
      <div class="panel">
        <div class="panel-head"><h2>Próximas renovações</h2><button class="link-btn" data-go="renewal">Abrir central</button></div>
        ${miniTable(renew60.sort((a,b)=>String(a.data.end).localeCompare(String(b.data.end))).slice(0,8),[
          ['Cliente',r=>nameById(r.data.clientId)],['Apólice',r=>r.data.number],['Ramo',r=>r.data.branch],['Fim',r=>date(r.data.end)]
        ])}
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Parcelas atrasadas</h2><button class="link-btn" data-go="payment">Abrir parcelas</button></div>
        ${miniTable(overdue.sort((a,b)=>String(a.data.due).localeCompare(String(b.data.due))).slice(0,8),[
          ['Cliente',r=>nameById(dataById(r.data.policyId||r.data.proposalId).clientId)],['Vencimento',r=>date(r.data.due)],['Valor',r=>money(r.data.amount)]
        ])}
      </div>
    </div>`;
  document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>navigate(b.dataset.go));
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
    title:'Produtor',columns:[['Nome',r=>r.data.name],['Telefone',r=>r.data.phone],['E-mail',r=>r.data.email]],
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
      ['Cliente',r=>nameById(r.data.clientId)],
      ['Número',r=>r.data.number],
      ['Seguradora',r=>r.data.insurer],
      ['Ramo',r=>r.data.branch],
      ['Vigência',r=>date(r.data.end)],
      ['Prêmio',r=>money(r.data.premium)],
      ['Status',r=>r.data.status]
    ],
    fields:[
      ['_kind','Tipo de registro','select',['proposal','policy']],
      ['clientId','Cliente','ref','client'],
      ['producerId','Produtor','ref','producer'],
      ['brokerages','Corretoras','brokerages'],
      ['insurer','Seguradora','select',insurers],
      ['branch','Ramo','select',branches],
      ['subBranches','Ramos / seções internas','textarea'],
      ['number','Nº proposta / apólice','text'],
      ['policyType','Operação','select',['Seguro novo','Renovação']],
      ['premium','Prêmio total','money'],
      ['start','Início vigência','date'],
      ['end','Fim vigência','date'],
      ['status','Status','select',['Em elaboração','Enviada','Em análise','Aprovada','Recusada','Convertida','Ativa','Cancelada','Renovada']],
      ['commissionPercent','% comissão','number'],
      ['notes','Observações','textarea']
    ]
  },
  payment:{
    title:'Parcela',columns:[['Cliente',r=>nameById(dataById(r.data.policyId||r.data.proposalId).clientId)],['Contrato',r=>nameById(r.data.policyId||r.data.proposalId)],['Parcela',r=>r.data.installment],['Vencimento',r=>date(r.data.due)],['Valor',r=>money(r.data.amount)],['Status',r=>r.data.status],['Cobrança',r=>r.data.collectionStatus]],
    fields:[
      ['policyId','Apólice','ref','policy'],['proposalId','Proposta','ref','proposal'],['installment','Parcela','text'],['amount','Valor','money'],['due','Vencimento','date'],
      ['status','Status','select',['Em aberto','Pago','Cancelado']],['paidDate','Data pagamento','date'],['paymentMethod','Forma','select',['','Boleto','Débito em conta','Cartão de crédito','Cartão de débito','PIX','Transferência','Outro']],
      ['collectionStatus','Cobrança','select',['Não iniciado','Acompanhar','Cliente avisado','Boleto solicitado','Boleto enviado','Comprovante recebido','Em tratativa','Regularizado','Não cobrar']],
      ['responsible','Responsável','text'],['notes','Observações','textarea']
    ]
  },
  commission:{
    title:'Comissão',columns:[['Apólice',r=>nameById(r.data.policyId)],['Produtor',r=>nameById(r.data.producerId)],['Prevista',r=>money(r.data.expected)],['Recebida',r=>money(r.data.received)],['Repasse pago',r=>money(r.data.transferPaid)],['Lucro',r=>money(Number(r.data.received||0)-Number(r.data.transferPaid||0))]],
    fields:[['policyId','Apólice','ref','policy'],['producerId','Produtor','ref','producer'],['expected','Comissão prevista','money'],['received','Comissão recebida','money'],['due','Vencimento','date'],['receivedDate','Data recebimento','date'],['transferExpected','Repasse previsto','money'],['transferPaid','Repasse pago','money'],['transferDate','Data repasse','date'],['notes','Observações','textarea']]
  },
  renewal:{
    title:'Renovação',columns:[['Cliente',r=>nameById(r.data.clientId)],['Apólice',r=>nameById(r.data.policyId)],['Produtor',r=>nameById(r.data.producerId)],['Status',r=>r.data.status],['Prioridade',r=>r.data.priority],['Próxima ação',r=>r.data.nextAction],['Data',r=>date(r.data.nextActionDate)]],
    fields:[['clientId','Cliente','ref','client'],['policyId','Apólice','ref','policy'],['producerId','Produtor','ref','producer'],['status','Status','select',['A iniciar','Em cotação','Propostas recebidas','Enviado ao cliente','Em negociação','Renovado','Perdido','Não renovar']],['priority','Prioridade','select',['Automática','Crítica','Alta','Média','Baixa']],['nextAction','Próxima ação','text'],['nextActionDate','Data próxima ação','date'],['lastContactDate','Último contato','date'],['lastContactChannel','Canal','select',['','Ligação','WhatsApp','E-mail','Reunião','Outro']],['notes','Observações','textarea']]
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
    title:'Pendência',columns:[['Título',r=>r.data.title],['Cliente',r=>nameById(r.data.clientId)],['Responsável',r=>r.data.responsible],['Prazo',r=>date(r.data.due)],['Status',r=>r.data.status]],
    fields:[['title','Título','text'],['clientId','Cliente','ref','client'],['policyId','Apólice','ref','policy'],['responsible','Responsável','text'],['due','Prazo','date'],['status','Status','select',['Aberta','Em andamento','Concluída']],['notes','Observações','textarea']]
  },
  document:{
    title:'Documento',columns:[['Cliente',r=>nameById(r.data.clientId)],['Nome',r=>r.data.name],['Tipo',r=>r.data.documentType],['Data',r=>date(r.data.referenceDate)],['Status',r=>r.data.status],['Arquivo',r=>r.data.storageKey?'Disponível':'—']],
    fields:[['clientId','Cliente','ref','client'],['policyId','Apólice','ref','policy'],['proposalId','Proposta','ref','proposal'],['name','Nome','text'],['documentType','Tipo','text'],['referenceDate','Data de referência','date'],['status','Status','select',['Recebido','Conferido','Pendente']],['notes','Observações','textarea']]
  }
};

function businessFields(kind){
  return [
    ['clientId','Cliente','ref','client'],['producerId','Produtor','ref','producer'],['brokerages','Corretoras','brokerages'],['insurer','Seguradora','select',insurers],
    ['branch','Ramo','select',branches],['subBranches','Ramos / seções internas','textarea'],['number',kind==='policy'?'Nº apólice':'Nº proposta','text'],
    ['policyType','Tipo','select',['Seguro novo','Renovação']],['premium','Prêmio total','money'],['start','Início vigência','date'],['end','Fim vigência','date'],
    ['status','Status','select',kind==='policy'?['Ativa','Cancelada','Renovada']:['Em elaboração','Enviada','Em análise','Aprovada','Recusada','Convertida']],
    ['commissionPercent','% comissão','number'],['notes','Observações','textarea']
  ];
}

function renderList(){
  const c=config[current];if(!c)return;
  let rows=current==='insurance'?[...list('proposal'),...list('policy')]:[...list(current)];
  const q=norm($('#searchInput').value);
  if(q)rows=rows.filter(r=>norm(JSON.stringify(r.data)+' '+nameById(r.data.clientId)).includes(q));
  if(current==='payment'){
    rows.sort((a,b)=>String(a.data.due||'').localeCompare(String(b.data.due||'')));
  }
  if(current==='insurance'){
    rows.sort((a,b)=>String(b.data.start||'').localeCompare(String(a.data.start||'')));
  }
  $('#listMeta').textContent=`${rows.length} registro(s)`;
  $('#filters').innerHTML=current==='payment'?paymentSummary(rows):'';
  $('#tableHead').innerHTML='<tr>'+c.columns.map(x=>'<th>'+esc(x[0])+'</th>').join('')+'<th></th></tr>';
  $('#tableBody').innerHTML=rows.length?rows.map(r=>{
    const cells=c.columns.map((x,i)=>{
      const value=x[1](r)??'—';
      if(current==='client'&&i===0)return `<td><button class="name-link" data-client-detail="${r.id}">${esc(value)}</button></td>`;
      return '<td>'+esc(value)+'</td>';
    }).join('');
    const openFile=current==='document'&&r.data.storageKey?`<button data-open="${r.id}" class="link-btn">Abrir</button>`:'';
    const insuranceDoc=current==='insurance'?primaryInsuranceDocument(r):null;
    const insuranceFile=current==='insurance'
      ?(insuranceDoc?.data.storageKey
        ?`<button data-open="${insuranceDoc.id}" class="link-btn file-action">Abrir PDF</button>`
        :`<button data-insurance-upload="${r.id}" data-client-id="${r.data.clientId||''}" class="link-btn file-action">${insuranceDoc?'Anexar PDF pendente':'Anexar PDF'}</button>`)
      :'';
    return '<tr>'+cells+`<td class="actions"><button data-edit="${r.id}" class="link-btn">Editar</button>${openFile}${insuranceFile}</td></tr>`;
  }).join(''):'<tr><td colspan="'+(c.columns.length+1)+'"><div class="empty">Nenhum registro encontrado.</div></td></tr>';
  document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openEditor(rowById(b.dataset.edit)));
  document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openDocument(rowById(b.dataset.open)));
  document.querySelectorAll('[data-insurance-upload]').forEach(b=>b.onclick=()=>openClientUpload(b.dataset.clientId,b.dataset.insuranceUpload));
  document.querySelectorAll('[data-client-detail]').forEach(b=>b.onclick=()=>openClientDetail(b.dataset.clientDetail));
}
function paymentSummary(rows){
  const relevant=rows.filter(r=>r.data.financialTracking!=='Previsão da proposta');
  const open=relevant.filter(r=>r.data.status==='Em aberto');
  const overdue=open.filter(r=>r.data.due&&r.data.due<today());
  return `<span class="chip">Em aberto: ${open.length} · ${money(open.reduce((s,r)=>s+Number(r.data.amount||0),0))}</span><span class="chip danger">Atrasadas: ${overdue.length} · ${money(overdue.reduce((s,r)=>s+Number(r.data.amount||0),0))}</span><span class="chip">Corte da implantação: ${CUTOFF}</span>`;
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
  }
  $('#editorError').textContent='';
  $('#editorDialog').showModal();
}

function fieldHtml(f,value){
  const [key,label,type,options]=f;
  const val=value??'';
  if(type==='textarea')return `<label class="span-2">${label}<textarea name="${key}" rows="3">${esc(val)}</textarea></label>`;
  if(type==='select')return `<label>${label}<select name="${key}">${(options||[]).map(o=>`<option value="${esc(o)}" ${String(val)===String(o)?'selected':''}>${esc(o||'Selecione')}</option>`).join('')}</select></label>`;
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
  const data=formData();
  const err=validateBeforeSave(data);if(err){$('#editorError').textContent=err;return;}
  const id=editing?.id||uuid();const stamp=now();
  const recordKind=current==='insurance'?(editing?.kind||data._kind||'proposal'):current;
  delete data._kind;
  const op=editing?{type:'update',id,kind:recordKind,data,version:editing.version,updated_at:stamp,strict:true}:{type:'insert',id,kind:recordKind,data,version:1,created_at:stamp,updated_at:stamp};
  try{
    await api('write',{ops:[op]});
    $('#editorDialog').close();
    await loadRecords();renderList();if(current==='overview')renderDashboard();
  }catch(e){$('#editorError').textContent=e.message}
}

function clientRelatedDocuments(clientId){
  const insurances=[...list('proposal'),...list('policy')].filter(r=>r.data.clientId===clientId);
  const insuranceIds=new Set(insurances.map(r=>r.id));
  return list('document').filter(r=>r.data.clientId===clientId||insuranceIds.has(r.data.policyId)||insuranceIds.has(r.data.proposalId));
}

function clientRelatedDocuments(clientId){
  const insurances=[...list('proposal'),...list('policy')].filter(r=>String(r.data.clientId||'')===String(clientId));
  const insuranceIds=new Set(insurances.map(r=>r.id));
  return list('document').filter(r=>String(r.data.clientId||'')===String(clientId)||insuranceIds.has(String(r.data.policyId||''))||insuranceIds.has(String(r.data.proposalId||'')));
}

function openClientDetail(clientId){
  const client=rowById(clientId);if(!client)return;
  const d=client.data;
  const insurances=[...list('proposal'),...list('policy')].filter(r=>String(r.data.clientId||'')===String(clientId))
    .sort((a,b)=>String(b.data.start||'').localeCompare(String(a.data.start||'')));
  const docs=clientRelatedDocuments(clientId);
  const storedDocs=docs.filter(doc=>doc.data.storageKey);
  const pendingDocs=docs.filter(doc=>!doc.data.storageKey);
  const activePolicies=insurances.filter(r=>r.kind==='policy'&&r.data.status!=='Cancelada'&&(!r.data.end||r.data.end>=today()));
  const totalPremium=activePolicies.reduce((sum,r)=>sum+Number(r.data.premium||0),0);

  const insuranceHtml=insurances.length?insurances.map(r=>{
    const doc=primaryInsuranceDocument(r);
    const broker=String(r.data.brokerages||r.data.brokerage||'—').replace(/\|/g,' · ');
    const fileAction=doc?.data.storageKey
      ?`<button class="btn ghost small" data-client-open-doc="${doc.id}">Abrir PDF</button>`
      :`<button class="btn primary small" data-client-upload-doc="${r.id}" data-client-id="${clientId}">${doc?'Anexar PDF pendente':'Anexar PDF'}</button>`;
    const fileState=doc?.data.storageKey
      ?'<span class="contract-file-state ready">Arquivo disponível</span>'
      :doc
        ?'<span class="contract-file-state pending">Arquivo pendente</span>'
        :'<span class="contract-file-state neutral">Sem arquivo</span>';
    return `
      <article class="insurance-card">
        <div class="insurance-card-head">
          <div>
            <span class="record-type">${r.kind==='policy'?'APÓLICE':'PROPOSTA'}</span>
            <h4>${esc(r.data.number||'Sem número')}</h4>
          </div>
          <span class="status-pill">${esc(r.data.status||'Cadastrado')}</span>
        </div>
        <div class="insurance-card-grid">
          <div><span>Seguradora</span><strong>${esc(r.data.insurer||'—')}</strong></div>
          <div><span>Ramo</span><strong>${esc(r.data.branch||'—')}</strong></div>
          <div><span>Corretora</span><strong>${esc(broker)}</strong></div>
          <div><span>Vigência</span><strong>${date(r.data.start)} a ${date(r.data.end)}</strong></div>
          <div><span>Prêmio</span><strong>${money(r.data.premium)}</strong></div>
        </div>
        <div class="insurance-card-foot">${fileState}${fileAction}</div>
      </article>`;
  }).join(''):'<div class="empty compact">Nenhuma proposta ou apólice cadastrada.</div>';

  const docsHtml=docs.length?docs.map(doc=>{
    const linked=rowById(doc.data.policyId||doc.data.proposalId);
    const linkedLabel=linked?insuranceLabel(linked):'Documento geral do cliente';
    const action=doc.data.storageKey
      ?`<button class="btn ghost small" data-client-open-doc="${doc.id}">Abrir arquivo</button>`
      :linked
        ?`<button class="btn primary small" data-client-upload-doc="${linked.id}" data-client-id="${clientId}">Anexar arquivo</button>`
        :'<span class="file-missing">Arquivo pendente</span>';
    return `
      <div class="document-row">
        <div>
          <strong>${esc(doc.data.name||doc.data.documentType||'Documento')}</strong>
          <span>${esc(doc.data.documentType||'Documento')} · ${date(doc.data.referenceDate)} · ${esc(linkedLabel)}</span>
        </div>
        ${action}
      </div>`;
  }).join(''):'<div class="empty compact">Nenhum arquivo vinculado a este cliente.</div>';

  $('#clientDetailTitle').textContent=d.name||'Cliente';
  $('#clientDetailBody').innerHTML=`
    <div class="client-kpis">
      <div><span>Apólices ativas</span><strong>${activePolicies.length}</strong></div>
      <div><span>Propostas e apólices</span><strong>${insurances.length}</strong></div>
      <div><span>Arquivos disponíveis</span><strong>${storedDocs.length}</strong></div>
      <div><span>Arquivos pendentes</span><strong>${pendingDocs.length}</strong></div>
    </div>
    <div class="detail-grid">
      <div><span>CPF/CNPJ</span><strong>${esc(d.document||'—')}</strong></div>
      <div><span>Telefone</span><strong>${esc(d.phone||'—')}</strong></div>
      <div><span>E-mail</span><strong>${esc(d.email||'—')}</strong></div>
      <div><span>Cidade/UF</span><strong>${esc([d.city,d.state].filter(Boolean).join('/')||'—')}</strong></div>
      <div class="wide"><span>Endereço</span><strong>${esc(d.address||'—')}</strong></div>
      <div class="wide"><span>Prêmio vigente</span><strong>${money(totalPremium)}</strong></div>
    </div>
    <section class="detail-section"><div class="section-title-row"><div><h3>Propostas e apólices</h3><p>O PDF fica associado diretamente ao respectivo contrato.</p></div></div><div class="insurance-grid">${insuranceHtml}</div></section>
    <section class="detail-section"><div class="section-title-row"><div><h3>Documentos</h3><p>Arquivos gerais e documentos vinculados aos seguros.</p></div></div>${docsHtml}</section>`;
  $('#clientDialog').dataset.clientId=clientId;
  $('#clientDialog').showModal();
  document.querySelectorAll('[data-client-open-doc]').forEach(b=>b.onclick=()=>openDocument(rowById(b.dataset.clientOpenDoc)));
  document.querySelectorAll('[data-client-upload-doc]').forEach(b=>b.onclick=()=>openClientUpload(b.dataset.clientId,b.dataset.clientUploadDoc));
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

function syncUploadType(){
  const insurance=rowById($('#uploadInsurance').value);
  const hint=$('#uploadLinkHint');
  if(!insurance){
    if(hint)hint.textContent='Documento geral do cliente: o arquivo ficará na ficha do cliente, sem vínculo com uma proposta ou apólice específica.';
    return;
  }
  $('#uploadType').value=insurance.kind==='policy'?'Apólice':'Proposta';
  if(hint)hint.innerHTML=`Vínculo selecionado: <strong>${esc(insuranceLabel(insurance))}</strong>. O arquivo será exibido diretamente nesse seguro.`;
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
  const documentType=$('#uploadType').value;
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
  if(!entry?.data?.storageKey){alert('Este registro ainda não possui arquivo armazenado. Use “Anexar arquivo” para regularizar o documento.');return;}
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
$('#newBtn').onclick=()=>openEditor();
$('#closeClientDetail').onclick=()=>$('#clientDialog').close();
$('#clientUploadBtn').onclick=openClientUpload;
$('#clientEditBtn').onclick=editClientFromDetail;
$('#closeEditor').onclick=()=>$('#editorDialog').close();
$('#cancelEditor').onclick=()=>$('#editorDialog').close();
$('#editorForm').onsubmit=saveCurrent;
$('#searchInput').oninput=()=>{if(current!=='overview'&&current!=='imports')renderList()};
$('#uploadClient').onchange=()=>{uploadPrefill.insuranceId='';renderUploadInsurances('')};
$('#uploadInsurance').onchange=syncUploadType;
$('#uploadForm').onsubmit=uploadDocument;

boot();