import {createClient} from "npm:@supabase/supabase-js@2";

// API exclusiva do perfil operacional. A chave do serviço nunca chega ao navegador.
const te=new TextEncoder();
const fromUrl=(x:string)=>Uint8Array.from(atob(x.replace(/-/g,"+").replace(/_/g,"/")+"=".repeat((4-x.length%4)%4)),c=>c.charCodeAt(0));
async function roleOf(req:Request):Promise<string|null>{
 const token=(req.headers.get("authorization")||"").replace(/^Bearer /,"");
 const parts=token.split(".");
 if(parts.length!==2||token.length>3000)return null;
 try{
  const secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const key=await crypto.subtle.importKey("raw",te.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["verify"]);
  if(!await crypto.subtle.verify("HMAC",key,fromUrl(parts[1]),te.encode(parts[0])))return null;
  const payload=JSON.parse(new TextDecoder().decode(fromUrl(parts[0])));
  return payload.sub==="lebrime-portal-v2"&&payload.role==="operacional"&&
    payload.exp>Date.now()/1000&&payload.exp<Date.now()/1000+43300?"operacional":null;
 }catch{return null}
}
const headers={"content-type":"application/json; charset=utf-8",
 "access-control-allow-origin":"*","access-control-allow-headers":"authorization, content-type",
 "access-control-allow-methods":"POST,OPTIONS","cache-control":"private, no-store"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
const docId=/^[a-zA-Z0-9_-]{5,150}$/;
const driveId=/^[a-zA-Z0-9_-]{15,150}$/;
const kindOf=(v:unknown)=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
async function queryAll(db:any,kinds:string[]){
 const result:any[]=[];
 for(let offset=0;offset<6000;offset+=700){
  const {data,error}=await db.from("records").select("id,kind,data")
   .in("kind",kinds).order("id").range(offset,offset+699);
  if(error)throw error;
  result.push(...(data||[]));
  if((data||[]).length<700)break;
 }
 return result;
}
function contractPreview(c:any,producerNames:Map<string,string>){
 const d=c.data||{},producerId=String(d.producerId||"");
 // Somente o NOME do produtor: nunca enviar percentual, prêmio,
 // taxas FF, repasse ou comissão ao perfil operacional.
 const producer=producerNames.get(producerId)||
   String(d.producerName||"").trim();
 return {id:c.id,clientId:String(d.clientId||""),kind:c.kind,
  number:String(d.number||""),insurer:String(d.insurer||""),
  branch:String(d.branch||""),plate:String(d.plate||d.vehiclePlate||""),
  producerName:producer.slice(0,100),
  start:String(d.start||""),end:String(d.end||""),status:String(d.status||"")};
}
function safeDocument(doc:any,allow:Set<string>){
 const d=doc.data||{},cid=String(d.policyId||d.proposalId||"");
 const category=kindOf(d.documentType);
 if(!allow.has(cid)||(!category.includes("proposta")&&!category.includes("apolice")&&!category.includes("endosso")))return null;
 const fid=String(d.sourceDriveFileId||"");
 return {id:doc.id,contractId:cid,type:String(d.documentType||""),
  name:String(d.originalFileName||d.name||"Proposta / Apólice").slice(0,180),
  driveFileId:driveId.test(fid)?fid:"",
  stored:Boolean(d.storageKey&&String(d.storageKey).startsWith("clients/"))};
}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
 if(req.method!=="POST")return json({error:"Método não permitido."},405);
 if(await roleOf(req)!=="operacional")return json({error:"Sessão operacional inválida."},401);
 const action=new URL(req.url).searchParams.get("action")||"";
 if(!["index","client","file"].includes(action))return json({error:"Ação indisponível."},404);
 const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  {auth:{persistSession:false,autoRefreshToken:false}});
 try{
  const input=await req.json().catch(()=>({}));
  if(action==="index"){
   const all=await queryAll(db,["client","proposal","policy","insuredItem","producer"]);
   const producerNames=new Map<string,string>(
     all.filter((r:any)=>r.kind==="producer").map((r:any)=>[
       r.id,String(r.data?.name||"").trim().slice(0,100)
     ]));
   return json({
    clients:all.filter(r=>r.kind==="client").map(r=>({id:r.id,
      name:String(r.data?.name||""),document:String(r.data?.document||"")})),
    contracts:all.filter(r=>r.kind==="policy"||r.kind==="proposal")
      .map((row:any)=>contractPreview(row,producerNames)),
    items:all.filter(r=>r.kind==="insuredItem").map(r=>({
      contractId:String(r.data?.policyId||r.data?.proposalId||""),
      plate:String(r.data?.plate||""),name:String(r.data?.name||""),
      chassi:String(r.data?.chassi||"")
    }))
   });
  }
  if(action==="client"){
   const id=String(input.clientId||"");
   if(!docId.test(id))return json({error:"Cliente inválido."},400);
   const {data:client,error:ce}=await db.from("records").select("id,data").eq("kind","client").eq("id",id).maybeSingle();
   if(ce)throw ce;
   if(!client)return json({error:"Cliente não encontrado."},404);
   const [{data:contracts,error:pe},{data:docs,error:de},{data:payments,error:payError},{data:endRows,error:endError}]=await Promise.all([
    db.from("records").select("id,kind,data").in("kind",["proposal","policy"]).eq("data->>clientId",id).limit(500),
    db.from("records").select("id,data").eq("kind","document").eq("data->>clientId",id).limit(500),
    db.from("records").select("id,data").eq("kind","payment").eq("data->>clientId",id).limit(1500),
    db.from("records").select("id,data").eq("kind","endorsement").eq("data->>clientId",id).limit(300)
   ]);
   if(pe||de||payError||endError)throw pe||de||payError||endError;
   const allowed=new Set<string>((contracts||[]).map((r:any)=>r.id));
   const documents=(docs||[]).map((r:any)=>safeDocument(r,allowed)).filter(Boolean);
   return json({client:{id,name:String(client.data?.name||""),document:String(client.data?.document||""),
     phone:String(client.data?.phone||""),mobile:String(client.data?.mobile||"")},
     contracts:(contracts||[]).map((row:any)=>contractPreview(row,new Map())),documents,
     endorsements:(endRows||[])
      .filter(e=>allowed.has(String(e.data?.parentInsuranceId||e.data?.proposalId||"")))
      .map(e=>({id:e.id,contractId:String(e.data?.parentInsuranceId||e.data?.proposalId||""),
        number:String(e.data?.number||""),parentPolicyNumber:String(e.data?.parentPolicyNumber||""),
        effectiveDate:String(e.data?.start||""),end:String(e.data?.end||""),
        type:String(e.data?.endorsementType||"Endosso"),
        priorVehicle:String(e.data?.priorVehicle||""),
        newVehicle:String(e.data?.newVehicle||""),
        premium:Number(e.data?.premium||0)})),
    payments:(payments||[]).filter(p=>allowed.has(String(p.data?.policyId||p.data?.proposalId||"")))
      .map(p=>({id:p.id,contractId:String(p.data?.policyId||p.data?.proposalId||""),
        installment:String(p.data?.installment||""),due:String(p.data?.due||""),
        estimatedDue:String(p.data?.estimatedDue||""),
        dueDateSource:String(p.data?.dueDateSource||""),
        dueText:String(p.data?.dueText||""),amount:Number(p.data?.amount||0),
        status:String(p.data?.status||""),collectionStatus:String(p.data?.collectionStatus||""),
        migrationStatus:String(p.data?.migrationStatus||"")}))});
  }
  const id=String(input.documentId||"");
  if(!docId.test(id))return json({error:"Documento inválido."},400);
  const {data:doc,error:de}=await db.from("records").select("id,data").eq("id",id).eq("kind","document").maybeSingle();
  if(de)throw de;
  if(!doc)return json({error:"Documento não encontrado."},404);
  const d=doc.data||{},cid=String(d.policyId||d.proposalId||""),clientId=String(d.clientId||"");
  if(!docId.test(cid)||!docId.test(clientId)||
     (!kindOf(d.documentType).includes("proposta")&&!kindOf(d.documentType).includes("apolice")&&!kindOf(d.documentType).includes("endosso")))
   return json({error:"Documento sem vínculo válido."},403);
  const {data:contract,error:pe}=await db.from("records").select("id,kind,data").eq("id",cid)
    .in("kind",["proposal","policy"]).maybeSingle();
  if(pe)throw pe;
  if(!contract||String(contract.data?.clientId||"")!==clientId||
      (contract.kind==="policy"&&d.policyId!==cid)||(contract.kind==="proposal"&&d.proposalId!==cid))
   return json({error:"Documento sem vínculo válido."},403);
  const key=String(d.storageKey||"");
  if(!key||!key.startsWith("clients/"+clientId+"/")||key.length>650||key.includes(".."))
   return json({error:"PDF interno não disponível."},404);
  const {data:blob,error}=await db.storage.from("lebrime-docs").download(key);
  if(error||!blob)return json({error:"Arquivo não disponível."},404);
  const bytes=await blob.arrayBuffer();
  if(bytes.byteLength>25*1024*1024)return json({error:"Arquivo excede o limite de visualização."},413);
  const magic=new Uint8Array(bytes.slice(0,5));
  if(![37,80,68,70,45].every((byte,i)=>magic[i]===byte))return json({error:"Arquivo não é um PDF."},415);
  return new Response(bytes,{status:200,headers:{...headers,"content-type":"application/pdf",
    "content-disposition":"inline; filename=proposta-apolice.pdf","x-content-type-options":"nosniff"}});
 }catch(e){
  console.error("Falha na consulta operacional:",{action,message:String((e as Error)?.message||"").slice(0,100)});
  return json({error:"Não foi possível concluir a consulta. Tente novamente."},500);
 }
});
