// Área operacional: acesso restrito a parcelas, clientes e dados de seguro.
// Não retorna comissões, prêmio do contrato, ou produtor.
import {stateOf,stageLabel,stageRank,summary,includeByFilter,localToday,actionable,review,makeReminder,validDue} from "./operational_finance_rules.mjs";
const PAGE=60;
const getId=(p:any)=>String(p?.data?.policyId||p?.data?.proposalId||"");
const digits=(s:string)=>String(s||"").replace(/\D/g,"");
const allowedFilters=new Set(["attention","review","late","week","month","blocked","paid","all"]);
async function allOf(db:any,kind:string){
  const out:any[]=[];
  for(let start=0;start<20000;start+=850){
    const {data,error}=await db.from("records").select("id,kind,data,version").eq("kind",kind)
      .order("id",{ascending:true}).range(start,start+849);
    if(error)throw error;
    out.push(...data||[]);
    if((data||[]).length<850)break;
  }
  return out;
}
async function setupRows(db:any){
  const [payments,proposals,policies,docs]=await Promise.all([
    allOf(db,"payment"),allOf(db,"proposal"),allOf(db,"policy"),allOf(db,"document")
  ]);
  const contracts=new Map([...proposals,...policies].map((r:any)=>[r.id,r]));
  const imported=new Set<string>();
  for(const doc of docs){
    const d=doc.data||{},contractId=getId(doc);
    const type=String(d.documentType||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
    if(contractId&&contracts.has(contractId)&&
       (type.includes("proposta")||type.includes("apolice"))&&
       (d.storageKey||d.externalUrl||d.sourceDriveUrl||d.sourceDriveFileId))imported.add(contractId);
  }
  const day=localToday();
  const mapped=payments.map((p:any)=>{
    const d=p.data||{},contractId=getId(p),contract=contracts.get(contractId);
    const state=stateOf(p,contract,imported,day);
    return {
      id:String(p.id),version:Number(p.version||1),clientId:String(d.clientId||contract?.data?.clientId||""),
      contractId,contractNumber:String(contract?.data?.number||""),
      insurer:String(contract?.data?.insurer||""),branch:String(contract?.data?.branch||""),
      brokerage:String(contract?.data?.brokerages||contract?.data?.brokerage||""),
      installment:String(d.installment||d.installmentNo||""),
      due:String(d.due||""),dueText:String(d.dueText||""),
      amount:Number(d.amount||0),stage:state,label:stageLabel(state),
      status:String(d.status||""),collectionStatus:String(d.collectionStatus||""),
      responsible:String(d.responsible||""),lastContactAt:String(d.lastContactAt||""),
      lastContactNote:String(d.lastContactNote||""),
      nextActionDate:String(d.nextActionDate||""),
      paidDate:String(d.paidDate||""),lastPaymentEvidence:Boolean(d.paymentEvidence),
      kind:String(contract?.kind||"")
    };
  });
  return {rows:mapped,byContract:contracts,imported,day};
}
export async function operationalFinance(db:any,input:any){
  const view=allowedFilters.has(String(input?.filter||""))?String(input.filter):"review";
  const page=Math.min(Math.max(0,Math.trunc(Number(input?.page)||0)),9999);
  const search=String(input?.search||"").trim().slice(0,80).toLowerCase();
  const {rows,day}=await setupRows(db);
  const totals=summary(rows,day);
  let matched=rows.filter((r:any)=>includeByFilter(r,view,day));
  const safeBroker=String(input?.brokerage||"").trim().slice(0,100);
  if(safeBroker)matched=matched.filter((r:any)=>r.brokerage.split("|").includes(safeBroker));
  if(search){
    const {data:clients,error:searchError}=await db.from("records").select("id,data").eq("kind","client").range(0,999);
    if(searchError)throw searchError;
    const searchableClients=new Map<string,string>((clients||[]).map((c:any)=>[c.id,
      String(c.data?.name||"")+" "+String(c.data?.document||"")+" "+String(c.data?.mobile||c.data?.phone||"")]));
    const normalized=(v:string)=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
    const query=normalized(search);
    matched=matched.filter((r:any)=>normalized(
      [r.contractNumber,r.insurer,r.branch,r.installment,r.clientId,searchableClients.get(r.clientId)].join(" ")
    ).includes(query));
  }
  matched.sort((a:any,b:any)=>stageRank(a,day)-stageRank(b,day)||
    String(a.due||"9999").localeCompare(String(b.due||"9999"))||a.id.localeCompare(b.id));
  const total=matched.length;
  const effectivePage=Math.min(page,Math.max(0,Math.ceil(total/PAGE)-1));
  const current=matched.slice(effectivePage*PAGE,(effectivePage+1)*PAGE);
  const ids=[...new Set(current.map((r:any)=>r.clientId).filter(Boolean))];
  const clients=new Map<string,any>();
  for(let i=0;i<ids.length;i+=100){
    const {data,error}=await db.from("records").select("id,data").eq("kind","client").in("id",ids.slice(i,i+100));
    if(error)throw error;
    for(const c of data||[])clients.set(c.id,c.data||{});
  }
  return {category:"payments",day,filter:view,total,page:effectivePage,pageSize:PAGE,pages:Math.max(1,Math.ceil(total/PAGE)),counts:totals,
    rows:current.map((r:any)=>({
      ...r,clientName:String(clients.get(r.clientId)?.name||"Segurado sem vínculo"),
      phone:String(clients.get(r.clientId)?.mobile||clients.get(r.clientId)?.phone||""),
      messageAllowed:actionable(r.stage),canRecordContact:actionable(r.stage),
      canAnnotate:review(r.stage)||r.stage==="forecast",
      message:makeReminder(r,day)
    }))
  };
}
// Somente ações permitidas: registrar contato, anotação de conferência,
// baixa por pagamento comprovado. Sem editar prêmio, comissão, cliente ou data.
export async function operationalPaymentAction(db:any,input:any){
  const id=String(input?.paymentId||"");
  const action=String(input?.operation||"");
  if(!/^[a-zA-Z0-9_-]{5,150}$/.test(id))throw new Error("Identificação da parcela inválida.");
  if(!["contact","review-note","confirm-payment"].includes(action))throw new Error("Operação não permitida.");
  const responsible=String(input?.responsible||"").trim().slice(0,100);
  const note=String(input?.note||"").trim().slice(0,700);
  if(responsible.length<3||note.length<10)throw new Error("Informe responsável e observação com pelo menos 10 caracteres.");
  const {data:p,error:e}=await db.from("records").select("*").eq("kind","payment").eq("id",id).maybeSingle();
  if(e)throw e;
  if(!p)throw new Error("Parcela não encontrada.");
  if(Number(input?.version)!==Number(p.version))throw new Error("O registro foi atualizado por outro usuário. Atualize a tela antes de salvar.");
  const cid=getId(p);
  const {data:contract,error:ce}=await db.from("records").select("id,kind,data").eq("id",cid)
    .in("kind",["policy","proposal"]).maybeSingle();
  if(ce)throw ce;
  if(!contract)throw new Error("O vínculo do contrato precisa ser corrigido pelo gestor.");
  const {data:docs,error:de}=await db.from("records").select("id,data").eq("kind","document")
    .eq("data->>"+(contract.kind==="policy"?"policyId":"proposalId"),cid).limit(100);
  if(de)throw de;
  const imported=new Set<string>();
  for(const doc of docs||[]){
    const d=doc.data||{},type=String(d.documentType||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
    if((type.includes("apolice")||type.includes("proposta"))&&
      (d.storageKey||d.externalUrl||d.sourceDriveUrl||d.sourceDriveFileId))imported.add(cid);
  }
  const stage=stateOf(p,contract,imported);
  if(action==="contact"&&!actionable(stage))throw new Error("Parcela sem condições de cobrança. Registre uma nota de conferência.");
  if(action==="review-note"&&!(review(stage)||stage==="forecast"))
    throw new Error("Essa parcela não está na fila de conferência.");
  if(action==="confirm-payment"&&(p.data?.status==="Pago"||p.data?.status==="Cancelado"))
    throw new Error("Parcela já baixada ou cancelada; solicite conferência do gestor.");
  const evidence=String(input?.evidence||"").trim().slice(0,350);
  if(action==="confirm-payment"&&evidence.length<8)throw new Error("É obrigatório informar a evidência do pagamento.");
  const stamp=new Date().toISOString(),raw=p.data||{};
  const history=Array.isArray(raw.contactHistory)?raw.contactHistory.slice(-49):[];
  const event={at:stamp,by:responsible,action,note,...(evidence?{evidence}:{} )};
  const next:any={...raw,contactHistory:[...history,event]};
  if(action==="contact"){
    next.collectionStatus="Cliente avisado";
    next.responsible=responsible;
    next.lastContactAt=stamp;
    next.lastContactNote=note;
    if(input?.nextActionDate){
      if(!validDue(String(input.nextActionDate)))throw new Error("Data do próximo contato inválida.");
      next.nextActionDate=String(input.nextActionDate);
    }
  }else if(action==="review-note"){
    next.reviewNote=note;next.reviewUpdatedAt=stamp;next.reviewResponsible=responsible;
  }else{
    const paidDate=String(input?.paidDate||"")||localToday();
    if(!validDue(paidDate))throw new Error("Data de pagamento inválida.");
    next.status="Pago";next.paidDate=paidDate;
    next.paymentEvidence=evidence;
    next.paidConfirmedAt=stamp;
    next.paidConfirmedBy=responsible;
    next.collectionStatus="Regularizado";
    next.migrationStatus="";
  }
  const {data:res,error:writeError}=await db.rpc("lebrime_apply_record_ops",{ops:[{
    type:"update",id:p.id,kind:"payment",data:next,version:p.version,updated_at:stamp,strict:true
  }]});
  if(writeError)throw writeError;
  return {ok:true,id:p.id,operation:action,updatedAt:stamp,stage:action==="confirm-payment"?"paid":stage};
}
