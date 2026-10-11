/* Leitor conservador de campos de proposta.
 * Extrai apenas rótulos explícitos do texto PDF; nenhum valor é inventado.
 */
const isoDate=raw=>{
 const text=String(raw||'').trim();
 const br=/^([0-3]?\d)[\/.-]([01]?\d)[\/.-](20\d{2})$/.exec(text);
 const us=/^(20\d{2})-([01]?\d)-([0-3]?\d)$/.exec(text);
 if(!br&&!us)return '';
 const [y,m,d]=br?[br[3],br[2],br[1]]:[us[1],us[2],us[3]];
 const iso=y+'-'+m.padStart(2,'0')+'-'+d.padStart(2,'0');
 const parsed=new Date(iso+'T12:00:00Z');
 return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===iso?iso:'';
};
const asCents=value=>{
 const s=String(value||'').trim().replace(/^R\$\s*/i,'');
 if(!/^(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}$/.test(s))return 0;
 const n=Number(s.replace(/\./g,'').replace(',','.'));
 return Number.isFinite(n)&&n>0&&n<1e11?Math.round(n*100):0;
};
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
function records(pages){
 const entries=[];
 for(let i=0;i<Math.min(20,pages.length);i++){
  for(const raw of String(pages[i]||'').split('\n')){
   const line=raw.replace(/\s+/g,' ').trim();
   if(line&&line.length<=600)entries.push({line,page:i+1});
  }
 }
 return entries;
}
const datePattern='([0-3]?\\d[\\/.-][01]?\\d[\\/.-]20\\d{2}|20\\d{2}-[01]?\\d-[0-3]?\\d)';
const moneyPattern='((?:R\\$\\s*)?(?:\\d{1,3}(?:\\.\\d{3})+|\\d+),\\d{2})';
function found(rows,patterns,transform){
 const hits=[];
 for(const row of rows){
  const line=row.line;
  for(const pattern of patterns){
   const match=pattern.exec(line);
   if(!match)continue;
   const value=transform(match[1]||'');
   if(value!==null&&value!==''&&value!==0)hits.push({value,line,page:row.page});
   break;
  }
 }
 return hits;
}
function unique(hits,label,warnings){
 const values=new Map();
 for(const h of hits){if(!values.has(h.value))values.set(h.value,h);}
 if(values.size>1){
  warnings.push(label+' aparece com valores diferentes. Exige conferência manual.');
  return null;
 }
 if(!values.size)return null;
 const hit=values.values().next().value;
 return {value:hit.value,page:hit.page,evidence:hit.line.slice(0,180)};
}
const pattern=(label,value)=>new RegExp('^\\s*'+label+'\\s*[:\\-]?\\s*'+value+'(?:\\s|$)','i');
const amount=labels=>labels.map(l=>pattern(l,moneyPattern));
const date=labels=>labels.map(l=>pattern(l,datePattern));
const cut=v=>String(v||'').replace(/\s+(?:CPF|CNPJ|ENDERE[ÇC]O|CEP|VIG[EÊ]NCIA)\\b.*$/i,'').trim();
export function previewProposalFromPages(pages){
 const rows=records(Array.isArray(pages)?pages:[]);
 const warnings=[];
 const cpf=found(rows,[
  /^\s*(?:CPF\s*\/\s*CNPJ|CNPJ\s*\/\s*CPF|CPF|CNPJ)(?:\s+(?:do|da)\s+segurad[oa])?\s*[:\-]?\s*(\d[\d.\/\-\s]{9,20}\d)\b/i,
  /^\s*documento\s+(?:do|da)\s+segurad[oa]\s*[:\-]?\s*(\d[\d.\/\-\s]{9,20}\d)\b/i
 ],v=>{const d=String(v).replace(/\D/g,'');return [11,14].includes(d.length)?d:null;});
 const names=found(rows,[
  /^\s*(?:nome\s+(?:do|da)\s+)?segurad[oa]\s*[:\-]\s*(.{5,130})$/i,
  /^\s*proponente\s*[:\-]\s*(.{5,130})$/i
 ],v=>{const result=cut(v);return result.length>4&&result.length<=120?result:null;});
 const insurer=found(rows,[
  /^\s*seguradora\s*[:\-]\s*(.{3,110})$/i,
  /^\s*companhia\s+seguradora\s*[:\-]\s*(.{3,110})$/i
 ],v=>cut(v).slice(0,100));
 const branch=found(rows,[
  /^\s*(?:ramo|modalidade\s+de\s+seguro|tipo\s+de\s+seguro)\s*[:\-]\s*(.{3,100})$/i
 ],v=>cut(v).slice(0,90));
 const number=found(rows,[
  /^\s*(?:n[úu]mero\s+(?:da|de)\s+proposta|proposta\s*n[º°o.]?|proposta\s*[:\-])\s*[:\-]?\s*([a-z0-9.\/-]{4,60})/i,
  /^\s*(?:n[úu]mero\s+da\s+ap[oó]lice|ap[oó]lice\s*n[º°o.]?)\s*[:\-]?\s*([a-z0-9.\/-]{4,60})/i
 ],v=>v);
 const start=found(rows,date([
  '(?:in[ií]cio\\s+(?:da\\s+)?vig[eê]ncia|vig[eê]ncia\\s*(?:in[ií]cio|de))'
 ]),isoDate);
 const end=found(rows,date([
  '(?:fim\\s+(?:da\\s+)?vig[eê]ncia|t[eé]rmino\\s+(?:da\\s+)?vig[eê]ncia|vig[eê]ncia\\s*(?:fim|at[eé]))'
 ]),isoDate);
 const rangeStart=[],rangeEnd=[];
 const range=new RegExp('^\\s*vig[eê]ncia\\s*[:\\-]?\\s*(?:de\\s*)?'+datePattern+'\\s*(?:a|at[eé]|-)\\s*'+datePattern,'i');
 for(const row of rows){
  const match=range.exec(row.line);
  if(!match)continue;
  const begin=isoDate(match[1]),finish=isoDate(match[2]);
  if(begin)rangeStart.push({...row,value:begin});
  if(finish)rangeEnd.push({...row,value:finish});
 }
 const premium=found(rows,amount([
  'pr[eê]mio\\s+total(?:\\s+do\\s+seguro)?',
  'valor\\s+total\\s+do\\s+pr[eê]mio'
 ]),asCents);
 const insured=found(rows,amount([
  'valor\\s+(?:total\\s+)?segurado',
  'limite\\s+m[aá]ximo\\s+de\\s+indeniza[cç][aã]o\\s*\\(?LMI\\)?',
  'LMI\\s+total'
 ]),asCents);
 const fields={
  insuredDocument:unique(cpf,'CPF/CNPJ',warnings),
  insuredName:unique(names,'Nome do segurado',warnings),
  insurer:unique(insurer,'Seguradora',warnings),
  branch:unique(branch,'Ramo',warnings),
  number:unique(number,'Proposta/apólice',warnings),
  start:unique(start.concat(rangeStart),'Início de vigência',warnings),
  end:unique(end.concat(rangeEnd),'Fim de vigência',warnings),
  premium:unique(premium,'Prêmio total',warnings),
  insuredValue:unique(insured,'Valor segurado/LMI',warnings)
 };
 if(fields.start&&fields.end&&fields.start.value>fields.end.value){
  fields.start=null;fields.end=null;
  warnings.push('Vigência inconsistente: fim anterior ao início.');
 }
 if(!rows.length)warnings.push('Sem texto selecionável; PDF digitalizado requer leitura manual.');
 if(!fields.insuredDocument)warnings.push('CPF/CNPJ não identificado com segurança.');
 if(!fields.premium)warnings.push('Prêmio total não identificado com segurança.');
 if(!fields.insuredValue)warnings.push('Valor segurado/LMI não identificado com segurança. Não foi estimado.');
 warnings.push('Produtor e comissão não são inferidos; conferir anotação ou relatório.');
 return {fields,recognized:Object.values(fields).filter(Boolean).length,
  warnings,pagesRead:Math.min(20,Array.isArray(pages)?pages.length:0)};
}
export const previewHelpers={isoDate,asCents,normalize};
