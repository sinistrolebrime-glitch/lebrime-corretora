import {createClient} from "npm:@supabase/supabase-js@2";
import {operationalFinance,operationalPaymentAction} from "./operational_finance.ts";
// Mesmo token HMAC do portal: verificação independente, sem usar service role no cliente.
const te=new TextEncoder();
const fromUrl=(x:string)=>Uint8Array.from(atob(x.replace(/-/g,"+").replace(/_/g,"/")+"=".repeat((4-x.length%4)%4)),c=>c.charCodeAt(0));
async function authKey(){
  const secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!secret)throw new Error("Chave do servidor não configurada.");
  return crypto.subtle.importKey("raw",te.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["verify"]);
}
async function getRole(req:Request):Promise<string|null>{
  const t=(req.headers.get("authorization")||"").replace(/^Bearer /,"");
  const x=t.split(".");
  if(x.length!==2||t.length>3000)return null;
  try{
    const ok=await crypto.subtle.verify("HMAC",await authKey(),fromUrl(x[1]),te.encode(x[0]));
    if(!ok)return null;
    const p=JSON.parse(new TextDecoder().decode(fromUrl(x[0])));
    return p.sub==="lebrime-portal-v2"&&
      p.exp>Date.now()/1000&&p.exp<Date.now()/1000+43300&&
      ["gestor","operacional"].includes(p.role)?p.role:null;
  }catch{return null;}
}
const headers={"content-type":"application/json; charset=utf-8",
  "access-control-allow-origin":"*",
  "access-control-allow-headers":"authorization, content-type",
  "access-control-allow-methods":"POST,OPTIONS"};
const json=(v:any,status=200)=>new Response(JSON.stringify(v),{status,headers});
Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
  if(req.method!=="POST")return json({error:"Método não permitido."},405);
  const role=await getRole(req);
  if(!role)return json({error:"Sessão inválida; faça login novamente."},401);
  const action=new URL(req.url).searchParams.get("action")||"";
  if(!["queue","action"].includes(action))return json({error:"Ação não disponível."},404);
  const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    {auth:{persistSession:false,autoRefreshToken:false}});
  try{
    const body=await req.json().catch(()=>({}));
    if(action==="queue")return json(await operationalFinance(db,body));
    return json(await operationalPaymentAction(db,body));
  }catch(e){
    // Erros genéricos não devem revelar dados pessoais, SQL ou tokens.
    const msg=String((e as Error)?.message||"").slice(0,250);
    const safe=/parcela|registro|documento|contrato|operação|responsável|observação|evidência|atualiz|inform|permite|contato|não permitid|vínculo|confirm/i.test(msg)&&
      !/SQL|PGRST|Postg|syntax|JWT|Bearer|apikey|secret|deno|TypeError|stack/i.test(msg);
    console.error("Erro operacional financeiro:",{action,error:msg.slice(0,120)});
    return json({error:safe?msg:"Falha temporária no financeiro. Atualize e tente novamente."},safe?400:500);
  }
});
