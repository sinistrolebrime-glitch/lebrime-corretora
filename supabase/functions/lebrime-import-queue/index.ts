import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const enc=new TextEncoder();
const headers={"content-type":"application/json","access-control-allow-origin":"*",
  "access-control-allow-headers":"authorization,content-type",
  "access-control-allow-methods":"OPTIONS,POST",
  "cache-control":"no-store"};
function json(value:unknown,status=200){return new Response(JSON.stringify(value),{status,headers});}
const fromUrl=(str:string)=>Uint8Array.from(atob(str.replace(/-/g,"+").replace(/_/g,"/")+"=".repeat((4-str.length%4)%4)),c=>c.charCodeAt(0));
async function verifySession(req:Request){
 const token=(req.headers.get("authorization")||"").replace(/^Bearer /,"");
 if(!token || token.length>3000)return null;
 const segments=token.split(".");if(segments.length!==2)return null;
 const secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");if(!secret)return null;
 try{
  const key=await crypto.subtle.importKey("raw",enc.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["verify"]);
  const ok=await crypto.subtle.verify("HMAC",key,fromUrl(segments[1]),enc.encode(segments[0]));
  if(!ok)return null;
  const p=JSON.parse(new TextDecoder().decode(fromUrl(segments[0])));
  const now=Date.now()/1000;
  return p.sub==="lebrime-portal-v2" && p.exp>now && p.exp<now+43300 &&
   ["gestor","operacional"].includes(p.role)?p.role:null;
 }catch{return null;}
}
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
 if(req.method!=="POST")return json({error:"Método não permitido"},405);
 const role=await verifySession(req);
 if(!role)return json({error:"Sessão LEBRIME inválida ou expirada"},401);
 if(role!=="gestor")return json({error:"Esta fila exige perfil gestor"},403);
 const supabaseUrl=Deno.env.get("SUPABASE_URL"),serviceRole=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!supabaseUrl||!serviceRole)return json({error:"Serviço indisponível"},503);
 const db=createClient(supabaseUrl,serviceRole,{auth:{persistSession:false,autoRefreshToken:false}});
 const action=new URL(req.url).searchParams.get("action")||"status";
 const body=await req.json().catch(()=>({}));
 try{
  // Segunda via: propostas novas/sem apólice antiga, em fila isolada.
  // Esta rota não aceita PDF bruto nem faz leitura automática não autenticada.
  if(action==="assisted-enqueue"){
   if(!body?.payload||!body?.source)return json({error:"Manifesto validado e arquivo privado obrigatórios"},400);
   const batch=String(body.batch||"pendentes46-out2026");
   const {data,error}=await db.rpc("lebrime_stage_assisted_import",{
    p:body.payload,source:body.source,actor:{source:"lebrime-api",subject:"gestor-mutirao-importacao"},batch
   });
   if(error)return json({error:String(error.message||"Manifesto recusado").slice(0,220)},422);
   return json(data,202);
  }
  if(action==="assisted-batch"){
   const manifests=body?.manifests;
   if(!Array.isArray(manifests)||manifests.length<1||manifests.length>10)
    return json({error:"Envie de 1 a 10 manifestos conferidos por lote"},400);
   const batch=String(body.batch||"pendentes46-out2026");
   const entries=[];
   // Falha individual isolada; nenhuma exceção abandona os próximos PDFs.
   for(let i=0;i<manifests.length;i++){
    const manifest=manifests[i];
    if(!manifest||!manifest.payload||!manifest.source){
     entries.push({index:i,ok:false,error:"Manifesto exige payload e source"});continue;
    }
    const {data,error}=await db.rpc("lebrime_stage_assisted_import",{
      p:manifest.payload,source:manifest.source,
      actor:{source:"lebrime-api",subject:"gestor-mutirao-importacao"},batch
    });
    entries.push(error?{index:i,ok:false,error:String(error.message||"Revisão exigida").slice(0,180)}:
      {index:i,...data});
   }
   return json({ok:entries.every(x=>x.ok),processed:entries.length,items:entries},207);
  }
  if(action==="assisted-status"){
   const {data:health,error:he}=await db.rpc("lebrime_assisted_import_health");
   if(he)throw he;
   const {data:items,error:le}=await db.from("lebrime_assisted_import_queue").select(
     "id,batch_key,request_key,state,attempts,created_at,updated_at,processed_at,available_at,contract_id,client_id,document_id,last_error"
   ).eq("batch_key","pendentes46-out2026").order("created_at",{ascending:false}).limit(75);
   if(le)throw le;
   // Inventário consolidado é a fonte de verdade dos cadastros fora da fila
   // (via SQL autenticado). Não retornar dados pessoais nem links dos PDFs.
   const {data:checkpoint,error:ce}=await db.from("records").select("data")
     .eq("id","lebrime-mutirao-46-inventario-propostas")
     .eq("kind","system_checkpoint").maybeSingle();
   if(ce)throw ce;
   const docs=Array.isArray(checkpoint?.data?.files)?checkpoint.data.files:[];
   const statuses=docs.map((f:any)=>String(f?.status||""));
   const completed=statuses.filter((s:string)=>s==="cadastrado_validado_no_supabase").length;
   const deferred=statuses.filter((s:string)=>s==="adiado_sem_percentual_por_orientacao").length;
   const review=statuses.filter((s:string)=>
     s==="revisao_pdf_sem_texto"||s==="revisao_parcelas_nao_discriminadas"||
     s==="endosso_cancelamento_documentado_pendente_vinculo").length;
   const inventory={
     received:docs.length,completed,deferred,review,
     pending:Math.max(0,docs.length-completed-deferred-review),
     originalGoal:46
   };
   return json({ok:true,health,items:items||[],inventory});
  }
  if(action==="assisted-process"){
   const {data,error}=await db.rpc("lebrime_process_assisted_import_queue",{max_jobs:5});
   if(error)throw error;
   return json(data);
  }
  if(action==="assisted-retry"){
   const id=String(body?.id||"");
   if(!/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(id))return json({error:"Identificador inválido"},400);
   const {data,error}=await db.from("lebrime_assisted_import_queue").update({
     state:"queued",available_at:new Date().toISOString(),
     last_error:null,last_sqlstate:null,updated_at:new Date().toISOString()
   }).eq("id",id).eq("state","review").eq("batch_key","pendentes46-out2026").select("id,state").maybeSingle();
   if(error)throw error;
   if(!data)return json({error:"O item não está em revisão"},409);
   return json({ok:true,item:data});
  }
  if(action==="enqueue"){
   const payload=body?.payload,source=body?.source;
   if(!payload||!source)return json({error:"Proposta e origem do PDF são obrigatórias"},400);
   const {data,error}=await db.rpc("lebrime_enqueue_renewal",{
    p:payload,source,actor:{source:"lebrime-api",subject:"gestor-queue-import"}
   });
   if(error)return json({error:String(error.message||"Dados não validados").slice(0,240)},422);
   return json(data,202);
  }
  if(action==="status"){
   const {data:health,error:he}=await db.rpc("lebrime_import_queue_health");
   if(he)throw he;
   const {data:items,error:le}=await db.from("lebrime_import_queue").select(
    "id,request_key,state,attempts,created_at,updated_at,processed_at,available_at,contract_id,document_id,last_error"
   ).order("created_at",{ascending:false}).limit(75);
   if(le)throw le;
   return json({ok:true,health,items:items||[]});
  }
  if(action==="process"){
   const {data,error}=await db.rpc("lebrime_process_import_queue",{max_jobs:10});
   if(error)throw error;
   return json(data);
  }
  if(action==="retry"){
   const id=String(body?.id||"");
   if(!/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(id))return json({error:"Identificador inválido"},400);
   const {data,error}=await db.from("lebrime_import_queue").update({
    state:"queued",available_at:new Date().toISOString(),last_error:null,last_sqlstate:null,
    updated_at:new Date().toISOString()
   }).eq("id",id).eq("state","review").select("id,state").maybeSingle();
   if(error)throw error;
   if(!data)return json({error:"Item não está em revisão ou não foi localizado"},409);
   return json({ok:true,item:data});
  }
  return json({error:"Ação desconhecida"},404);
 }catch(e){
  // Generic error avoids disclosing private database details to a browser.
  console.error("lebrime import queue",action,String((e as Error).message||e));
  return json({error:"Não foi possível concluir esta operação; tente novamente ou contate a gestão."},503);
 }
});