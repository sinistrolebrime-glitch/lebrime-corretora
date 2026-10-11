/* Allianz Auto, Empresarial e Frota: padrões identificados em PDFs reais da carteira.
 * Apenas valores totais explícitos; FIPE percentual e sub-limites não são somados.
 */
const money=v=>{
 const t=String(v||"").replace(/^R\$\s*/i,"");
 if(!/^(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}$/.test(t))return 0;
 return Math.round(Number(t.replace(/\./g,"").replace(",","."))*100);
};
const date=v=>{
 const m=/^([0-3]?\d)\/([01]?\d)\/(20\d\d)$/.exec(String(v||""));
 if(!m)return "";
 const iso=m[3]+"-"+m[2].padStart(2,"0")+"-"+m[1].padStart(2,"0");
 const n=new Date(iso+"T12:00:00Z");
 return Number.isFinite(n.getTime())&&n.toISOString().slice(0,10)===iso?iso:"";
};
function rowsOf(pages){
 const rows=[];
 for(let p=0;p<Math.min(pages.length,20);p++)
  for(const l of String(pages[p]||"").split("\n")){
   const line=l.replace(/\s+/g," ").trim();
   if(line)rows.push({page:p+1,line});
  }
 return rows;
}
function single(rows,label,warnings){
 const map=new Map();
 for(const r of rows)if(!map.has(String(r.value)))map.set(String(r.value),r);
 if(map.size>1){warnings.push(label+" divergente: conferir no PDF.");return null;}
 if(!map.size)return null;
 const r=map.values().next().value;
 return {value:r.value,page:r.page,evidence:r.line.slice(0,180)};
}
function hit(rows,re,toValue){
 const result=[];
 for(const row of rows){
  const m=re.exec(row.line);
  if(!m)continue;
  const value=toValue(m[1],m,row);
  if(value!==null&&value!==""&&value!==0)result.push({...row,value});
 }
 return result;
}
const ISO=String.raw;
function amount(rows,re){
 return hit(rows,re,v=>money(v));
}
export function parseAllianzPreview(pages){
 const page1=String(pages?.[0]||"");
 if(!/\ballianz\b/i.test(page1.slice(0,3500)))return null;
 const rows=rowsOf(pages||[]);
 const first=rows.filter(r=>r.page===1);
 const warnings=[];
 const values={};
 const cnpj=hit(first,/\b(?:CPF\/CNPJ|CNPJ|CPF)\s*:\s*(\d[\d.\/-]{9,19}\d)\b/i,v=>{
  const d=v.replace(/\D/g,"");return [11,14].includes(d.length)?d:null;
 });
 // Nome: na seção do segurado (não condutor, corretora nem representante).
 let names=hit(first,/^Nome\s*:\s*(.{5,140})$/i,v=>{
  const name=v.replace(/\s+(?:CPF\/CNPJ|CNPJ|CPF|Tel|E-mail)\s*:.*/i,"").trim();
  return name.length>=5?name:null;
 });
 if(!names.length){
  const idx=first.findIndex(r=>/^SUAS INFORMA[ÇC][ÕO]ES\s*$/i.test(r.line));
  const line=idx>=0?first[idx+1]:null;
  if(line&&!/^(?:CPF\/CNPJ|CNPJ|CPF|ENDERE[ÇC]O|TEL)\s*:/i.test(line.line)&&
   /^[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][A-ZÁÀÂÃÉÊÍÓÔÕÚÇ0-9 .,&-]{8,130}$/.test(line.line))
   names=[{...line,value:line.line}];
 }
 // Se um Nome: de condutor também for extraído, preferir somente o primeiro após "SUAS INFORMAÇÕES".
 if(names.length>1){
  const firstName=names[0]?.value;
  if(firstName&&names.every(n=>n.value===firstName))names=[names[0]];
  else names=[names[0]];
 }
 const isBusiness=/ALLIANZ EMPRESARIAL/i.test(page1);
 const isFleet=/\bFROTA\b/i.test(first.slice(0,40).map(x=>x.line).join(" "));
 const kind=isBusiness?"Empresarial":isFleet?"Frota":"Automóvel";
 const branchRow=first.find(x=>/\bRAMO\b|ALLIANZ EMPRESARIAL|FROTA/i.test(x.line))||first[0];
 const proposal=hit(first,/\b(?:N[ºo°.]?\s*(?:da\s*)?Proposta|Proposta\s*N[ºo°.]?|Proposta\s*N[úu]mero)\s*:\s*(\d{5,30})/i,v=>v);
 const policy=hit(first,/\b(?:N[ºo°.]?\s*(?:da\s*)?Ap[oó]lice|Ap[oó]lice\s*N[ºo°.]?|N[úu]mero\s+da\s+Ap[oó]lice)\s*:\s*(\d{5,30})/i,v=>v);
 const number=isBusiness&&policy.length?policy:proposal.length?proposal:policy;
 const datePattern=/\bVig[eê]ncia\s*:\s*(?:das?\s*\d{1,2}\s*[Hh]\s*de\s*|de\s*)?([0-3]?\d\/[01]?\d\/20\d\d)\s*(?:[àa]s?\s*\d{1,2}\s*[Hh]\s*de\s*|a\s*|at[eé]\s*)([0-3]?\d\/[01]?\d\/20\d\d)/i;
 const start=[],end=[];
 for(const r of first){
  const m=datePattern.exec(r.line);
  if(m){const a=date(m[1]),b=date(m[2]);if(a)start.push({...r,value:a});if(b)end.push({...r,value:b});}
 }
 const moneyPattern="((?:R\\$\\s*)?(?:\\d{1,3}(?:\\.\\d{3})+|\\d+),\\d{2})";
 const premium=[];
 const regexes=[
  new RegExp("(?:Pr[eê]mio\\s+Total\\s*(?:\\(R\\$\\))?|Pre[çc]o\\s+Total(?:\\s*\\([^)]*\\))?|TOTAL\\s+A\\s+PAGAR(?:\\s*\\([^)]*\\))?)\\s*:\\s*"+moneyPattern,"i"),
  new RegExp("(?:Pr[eê]mio\\s+Total\\s*(?:\\(R\\$\\))?|Pre[çc]o\\s+Total(?:\\s*\\([^)]*\\))?|TOTAL\\s+A\\s+PAGAR(?:\\s*\\([^)]*\\))?)\\s+"+moneyPattern,"i")
 ];
 for(const r of rows){
  for(const re of regexes){
   const m=re.exec(r.line);
   if(m){const cents=money(m[1]);if(cents)premium.push({...r,value:cents});break;}
  }
 }
 // Allianz pode quebrar o valor do Preço Total entre linhas.
 for(let i=0;i<rows.length-1;i++){
  const cur=rows[i],next=rows[i+1];
  if(cur.page!==next.page)continue;
  if(/^(?:Pr[eê]mio\s+Total|Pre[çc]o\s+Total)(?:\s*\([^)]*\))?\s*:?\s*$/i.test(cur.line)){
   const exact=new RegExp("^"+moneyPattern+"$","i").exec(next.line);
   if(exact){const cents=money(exact[1]);if(cents)premium.push({...cur,line:cur.line+" | "+next.line,value:cents});}
  }
 }
 const insured=hit(rows,new RegExp("(?:Limite\\s+M[aá]ximo\\s+de\\s+Garantia\\s+da\\s+Ap[oó]lice\\*?|Valor\\s+Total\\s+Segurado|LMI\\s+Total)\\s*:\\s*"+moneyPattern,"i"),v=>money(v));
 const itemCount=hit(first,/Quantidade\s+de\s+Itens\s*:\s*0*(\d{1,3})\b/i,v=>Number(v)||0);
 const fields={
  insuredDocument:single(cnpj,"CPF/CNPJ",warnings),
  insuredName:single(names,"Segurado",warnings),
  insurer:{value:"Allianz",page:first[0]?.page||1,evidence:(first.find(x=>/Allianz/i.test(x.line))||first[0])?.line.slice(0,180)||"Allianz"},
  branch:branchRow?{value:kind,page:branchRow.page,evidence:branchRow.line.slice(0,180)}:null,
  number:single(number,"Número de proposta/apólice",warnings),
  start:single(start,"Início de vigência",warnings),
  end:single(end,"Fim de vigência",warnings),
  premium:single(premium,"Prêmio total",warnings),
  insuredValue:single(insured,"LMG/LMI total",warnings)
 };
 if(!fields.insuredValue&&/100\s*%\s*FIPE/i.test(rows.map(r=>r.line).join(" ")))
  warnings.push("Veículo(s) com 100% FIPE: valor de mercado em reais não está especificado; não inferir.");
 if(itemCount.length)warnings.push("Frota com "+itemCount[0].value+" veículos: conferir cada item e seu valor segurado.");
 if(!fields.number)warnings.push("Número não identificado com segurança.");
 if(!fields.premium)warnings.push("Prêmio total não identificado com segurança.");
 if(!fields.start||!fields.end)warnings.push("Vigência não identificada com segurança.");
 if(!fields.insuredValue)warnings.push("Valor total assegurado não expresso em reais; permanece pendente.");
 warnings.push("Não inferir produtor/comissão de página genérica da corretora; conferir relatório.");
 return {fields,warnings,recognized:Object.values(fields).filter(Boolean).length,
  pagesRead:Math.min(pages?.length||0,20),
  itemCount:single(itemCount,"Quantidade de itens",warnings)};
}
