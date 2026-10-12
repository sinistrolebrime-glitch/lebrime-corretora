import * as pdfjsLib from "npm:pdfjs-dist@4.10.38/legacy/build/pdf.mjs";
import { parseInstallmentSchedule } from "./parse_installments.mjs";
import { previewProposalFromPages } from "./proposal_preview.mjs";
const LIMIT=15*1024*1024;

async function readLimited(res:Response){
  if(!res.ok)throw new Error("PDF indisponível na origem ("+res.status+").");
  const declared=Number(res.headers.get("content-length")||0);
  if(declared>LIMIT)throw new Error("PDF acima de 15 MB.");
  if(!res.body)throw new Error("Arquivo PDF vazio.");
  const stream=res.body.getReader();
  const chunks:Uint8Array[]=[];let size=0;
  try{
    while(true){
      const {value,done}=await stream.read();
      if(done)break;
      if(value){size+=value.length;if(size>LIMIT)throw new Error("PDF acima de 15 MB.");chunks.push(value);}
    }
  }finally{try{await stream.cancel()}catch{}}
  const data=new Uint8Array(size);let offset=0;
  for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length;}
  if(size<4||String.fromCharCode(...data.subarray(0,4))!=="%PDF")throw new Error("A origem não retornou um PDF válido.");
  return data;
}
async function sourcePdf(db:any,record:any,bucket:string){
  const d=record.data||{};
  if(d.storageKey){
    const {data,error}=await db.storage.from(bucket).download(String(d.storageKey));
    if(error||!data)throw new Error("O PDF anexado não pôde ser recuperado: "+(error?.message||"não encontrado"));
    if(data.size>LIMIT)throw new Error("PDF acima de 15 MB.");
    const bytes=new Uint8Array(await data.arrayBuffer());
    if(String.fromCharCode(...bytes.subarray(0,4))!=="%PDF")throw new Error("O arquivo anexado não é um PDF.");
    return {bytes,source:"storage"};
  }
  const id=String(d.sourceDriveFileId||"");
  if(!/^[a-zA-Z0-9_-]{15,150}$/.test(id))throw new Error("PDF de origem não disponível. Anexe o PDF na ficha do contrato.");
  const urls=[
    "https://drive.usercontent.google.com/download?id="+encodeURIComponent(id)+"&export=download&confirm=t",
    "https://drive.google.com/uc?export=download&id="+encodeURIComponent(id)
  ];
  let lastError="Arquivo não acessível.";
  for(const url of urls){
    try{
      const res=await fetch(url,{redirect:"follow",signal:AbortSignal.timeout(18000)});
      const bytes=await readLimited(res);
      return {bytes,source:"drive"};
    }catch(e){lastError=String((e as Error).message||e);}
  }
  throw new Error("A origem do Drive não está acessível para leitura automática. "+lastError);
}
function pageLines(items:any[]):string {
  const blocks=items.filter(item=>typeof item.str==="string"&&item.str.trim()).map(item=>({
    text:item.str.replace(/\s+/g," ").trim(),
    x:Number(item.transform?.[4]||0),
    y:Number(item.transform?.[5]||0)
  })).sort((a,b)=>b.y-a.y||a.x-b.x);
  const rows:{y:number,words:{x:number,text:string}[]}[]=[];
  for(const b of blocks){
    const prior=rows.find(x=>Math.abs(x.y-b.y)<2.4);
    if(prior)prior.words.push({x:b.x,text:b.text});
    else rows.push({y:b.y,words:[{x:b.x,text:b.text}]});
  }
  return rows.sort((a,b)=>b.y-a.y).map(r=>r.words.sort((a,b)=>a.x-b.x).map(x=>x.text).join(" ")).join("\n");
}
export async function extractPaymentPlan(db:any,document:any,bucket:string,premium:number,paymentMethod:string,startDate='',issueDate='') {
  const {bytes,source}=await sourcePdf(db,document,bucket);
  const pdf=await pdfjsLib.getDocument({data:bytes,disableWorker:true,isEvalSupported:false}).promise;
  try{
    if(pdf.numPages>100)throw new Error("PDF excessivamente longo; encaminhe para conferência manual.");
    const pages:string[]=[];
    for(let n=1;n<=Math.min(pdf.numPages,20);n++){
      const pg=await pdf.getPage(n);
      const content=await pg.getTextContent();
      pages.push(pageLines(content.items as any[]));
    }
    const parsed=parseInstallmentSchedule(pages,{premium,paymentMethod,startDate,issueDate});
    return {...parsed,pdfPages:pdf.numPages,source};
  }finally{
    try{await pdf.destroy()}catch{}
  }
}

/**
 * Prévia sem gravação: devolve somente campos rotulados e origem (página/trecho).
 * Parcelamento será exibido somente como sugestão, nunca lançado pelo endpoint.
 */
export async function readProposalPreview(input:Uint8Array) {
 if(input.byteLength<5||input.byteLength>LIMIT||
    String.fromCharCode(...input.subarray(0,5))!=="%PDF-")
   throw new Error("Arquivo PDF inválido ou acima de 15 MB.");
 const pdf=await pdfjsLib.getDocument({data:input,disableWorker:true,isEvalSupported:false}).promise;
 try {
  if(pdf.numPages>100)throw new Error("PDF com mais de 100 páginas; encaminhe para conferência.");
  const pages:string[]=[];
  for(let n=1;n<=Math.min(pdf.numPages,20);n++){
   const pg=await pdf.getPage(n);
   const content=await pg.getTextContent();
   pages.push(pageLines(content.items as any[]));
  }
  const preview=previewProposalFromPages(pages);
  const premium=Number(preview.fields?.premium?.value||0);
  const schedule=premium>0?parseInstallmentSchedule(pages,{premium,paymentMethod:"",startDate:String(preview.fields?.start?.value||'')}):
    {status:"review",reason:"Prêmio não identificado; parcelamento precisa de conferência.",plan:[],matchedPremium:false};
  const installments=Array.isArray(schedule.plan)?schedule.plan.slice(0,72).map((item:any)=>({
   installment:Number(item.installmentNo||0),
   amount:Number(item.amount||0),
   due:String(item.due||""),
   estimatedDue:String(item.estimatedDue||""),
   dueDay:Number(item.dueDay||0),
   sourcePage:Number(item.sourcePage||0)
  })):[];
  return {...preview,pdfPages:pdf.numPages,
   installments:{status:String(schedule.status||"review"),
    reason:String(schedule.reason||""),matchedPremium:Boolean(schedule.matchedPremium),
    count:installments.length,plan:installments}};
 }finally{try{await pdf.destroy()}catch{}}
}
