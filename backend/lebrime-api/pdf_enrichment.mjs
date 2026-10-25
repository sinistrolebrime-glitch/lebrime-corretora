/* LEBRIME: enriquecimento conservador de propostas/apólices/endossos.
 * Somente texto selecionável e rótulos explícitos. Não faz OCR nem inventa dados.
 * Unidades monetárias em centavos; todo campo contém página e trecho-fonte.
 */
const strip=s=>String(s||"").replace(/\s+/g," ").trim();
const normal=s=>strip(s).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const monetary=/((?:R\$\s*)?(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2})/;
const cents=s=>{
 const v=strip(s).replace(/^R\$\s*/i,"");
 if(!/^(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}$/.test(v))return null;
 const n=Number(v.replace(/\./g,"").replace(",","."));
 return Number.isFinite(n)&&n>=0&&n<100000000000?Math.round(n*100):null;
};
const allRows=pages=>(pages||[]).flatMap((p,i)=>String(p||"").split(/\r?\n/).map((raw,j)=>({
  page:i+1,line:j+1,text:strip(raw)
})).filter(x=>x.text&&x.text.length<650));
const evidence=(r,v)=>({value:v,page:r.page,line:r.line,evidence:r.text.slice(0,220)});
function scalar(rows,label,re,transform,warnings){
 const results=new Map();
 for(const row of rows){
  const m=re.exec(row.text);
  if(!m)continue;
  const val=transform(m[1],m,row);
  if(val===null||val===undefined||val===""||Number.isNaN(val))continue;
  if(!results.has(String(val)))results.set(String(val),evidence(row,val));
 }
 if(results.size>1){warnings.push(label+": documento contém valores diferentes; conferir a página correta.");return null;}
 return results.size?results.values().next().value:null;
}
function readMoney(rows,label,pattern,warnings){
 const pat=new RegExp("^\\s*(?:"+pattern+")\\s*(?:\\(R\\$\\))?\\s*[:\\-]?\\s*"+monetary.source+"(?:\\s|$)","i");
 return scalar(rows,label,pat,cents,warnings);
}
function chooseDocumentKind(rows){
 const sample=rows.slice(0,75).map(x=>normal(x.text)).join(" ");
 if(/\b(?:endosso|alteracao de apolice)\b/.test(sample))return "Endosso";
 if(/\bapolice\b/.test(sample))return "Apólice";
 if(/\bproposta\b/.test(sample))return "Proposta";
 return "Documento de seguro — classificar";
}
export function enrichPreviewFromPages(pages,existing={}){
 const rows=allRows(pages),warnings=[...(existing.warnings||[])],fields={...(existing.fields||{})};
 const net=readMoney(rows,"Prêmio líquido","pr[eê]mio\\s+l[ií]quido(?:\\s+(?:total|do\\s+seguro))?",warnings);
 const iof=readMoney(rows,"IOF","(?:valor\\s+do\\s+)?IOF|imposto\\s+sobre\\s+opera[cç][oõ]es\\s+financeiras",warnings);
 const fees=readMoney(rows,"Juros/encargos","(?:juros\\s+(?:de\\s+)?(?:parcelamento|fracionamento)|adicional\\s+de\\s+fracionamento|encargos\\s+financeiros)",warnings);
 const total=readMoney(rows,"Prêmio total","pr[eê]mio\\s+total(?:\\s+do\\s+seguro)?|valor\\s+total\\s+do\\s+pr[eê]mio|pre[cç]o\\s+total",warnings);
 if(!fields.premium&&total)fields.premium=total;
 if(net)fields.netPremium=net;
 if(iof)fields.iof=iof;
 if(fees)fields.financeCharges=fees;
 const rate=scalar(rows,"Comissão cheia",
  /^\s*(?:comiss[aã]o\s+(?:total|cheia|do\s+corretor|de\s+corretagem)|percentual\s+de\s+comiss[aã]o)\s*[:\-]?\s*(\d{1,2}(?:[,.]\d{1,2})?)\s*%/i,
  v=>{const n=Number(v.replace(",","."));return n>0&&n<=100?n:null;},warnings);
 if(rate)fields.commissionPercent=rate;
 const producer=scalar(rows,"Produtor",
  /^\s*(?:produtor(?:\s+respons[aá]vel)?|corretor\s+produtor)\s*[:\-]\s*([A-ZÁÀÂÃÉÊÍÓÔÕÚÇa-zÀ-ÿ .'-]{3,75})(?:\s|$)/i,
  v=>{const x=strip(v);return x.length>=3?x:null;},warnings);
 if(producer)fields.producerName=producer;
 const method=scalar(rows,"Forma de pagamento",
  /^\s*(?:forma|meio|modalidade)\s+de\s+pagamento\s*[:\-]\s*(.{4,85})$/i,
  v=>strip(v).slice(0,80),warnings);
 if(method)fields.paymentMethod=method;
 const brokerage=scalar(rows,"Corretora",
  /^\s*(?:corretora\s+(?:respons[aá]vel)?|nome\s+da\s+corretora)\s*[:\-]\s*(.{4,95})$/i,
  v=>strip(v).slice(0,90),warnings);
 if(brokerage)fields.brokerage=brokerage;
 const isEndorsement=chooseDocumentKind(rows)==="Endosso";
 // Valores por risco ou cobertura não são somados (limites podem se sobrepor).
 const coverages=[],seenCov=new Set();
 const coverLine=/\b(cobertura|danos\s+(?:materiais|corporais|morais)|colis[aã]o|roubo|furto|inc[eê]ndio|franquia|LMI|LMGA|limite\s+m[aá]ximo|responsabilidade\s+civil|assist[eê]ncia|danos\s+el[eé]tricos)\b/i;
 for(const r of rows){
   if(coverages.length>=90)break;
   if(!coverLine.test(r.text))continue;
   const val=monetary.exec(r.text);if(!val)continue;
   const amount=cents(val[1]);if(amount===null)continue;
   const key=r.page+"|"+normal(r.text);
   if(seenCov.has(key))continue;seenCov.add(key);
   coverages.push({description:r.text.slice(0,180),amount,page:r.page,line:r.line,evidence:r.text.slice(0,220),source:"PDF — cobertura/limite/franquia não conciliados"});
 }
 const risks=[],seenRisk=new Set();
 for(const r of rows){
   if(risks.length>=120)break;
   const plate=/\bplaca(?:\s+do\s+ve[ií]culo)?\s*[:\-]?\s*([A-Z]{3}[-\s]?[0-9][A-Z0-9][0-9]{2})\b/i.exec(r.text);
   const vin=/\bchassi\s*[:\-]?\s*([A-HJ-NPR-Z0-9]{15,17})\b/i.exec(r.text);
   const fipe=/\b(?:FIPE|tabela\s+FIPE)\s*[:\-]?\s*(\d{6,7}-?\d)\b/i.exec(r.text);
   if(!plate&&!vin&&!fipe)continue;
   const key=(plate?.[1]||"")+"|"+(vin?.[1]||"")+"|"+(fipe?.[1]||"")+"|"+r.page;
   if(seenRisk.has(key))continue;seenRisk.add(key);
   risks.push({...(plate?{plate:plate[1].replace(/[\s-]/g,"").toUpperCase()}:{}),
    ...(vin?{chassi:vin[1]}:{}),...(fipe?{fipeCode:fipe[1]}:{}),
    page:r.page,line:r.line,evidence:r.text.slice(0,210)});
 }
 const fipePercentage=scalar(rows,"Percentual FIPE",
  /\b(?:tabela\s+FIPE|FIPE)\s*[:\-]?\s*(\d{1,3}(?:[,.]\d{1,2})?)\s*%/i,
  v=>{const n=Number(v.replace(",","."));return n>0&&n<=200?n:null;},warnings);
 if(fipePercentage)fields.fipePercent=fipePercentage;
 if(fields.premium&&fields.netPremium&&fields.iof){
   const delta=Number(fields.premium.value)-Number(fields.netPremium.value)-Number(fields.iof.value);
   if(delta!==0&&!fields.financeCharges)warnings.push("Prêmio total difere de líquido + IOF em R$ "+(Math.abs(delta)/100).toFixed(2)+"; conferir adicionais/juros no PDF.");
   if(delta<0)warnings.push("Prêmio total inferior a líquido + IOF; conferir valores.");
 }
 if(isEndorsement)warnings.push("Documento de endosso: associar ao seguro principal sem duplicar o contrato; prêmio adicional só com evidência.");
 if(!rows.length)warnings.push("PDF sem texto selecionável; requer conferência manual/OCR autorizado.");
 if(coverages.length===90)warnings.push("Lista de coberturas abreviada aos 90 primeiros registros para evitar sobrecarga; consultar PDF completo.");
 if(risks.length===120)warnings.push("Lista de itens abreviada aos 120 primeiros registros; consultar PDF completo.");
 const metadata={type:chooseDocumentKind(rows),pagesScanned:pages.length,textLineCount:rows.length,
  extractionMode:"texto PDF selecionável sem OCR",requiresHumanReview:true};
 return {...existing,fields,warnings:[...new Set(warnings)].slice(0,65),
   recognized:Object.values(fields).filter(Boolean).length,
   coverages,risks,metadata};
}
