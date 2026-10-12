/**
 * Regra LEBRIME de vencimento mensal por DIA informado no PDF.
 * A data inicial é a primeira ocorrência do dia no mês da emissão da
 * proposta, quando expressamente conhecida, ou a partir do início de vigência.
 * Não confirma mês/ano do vencimento bancário: devolve apenas PROJEÇÕES.
 * Ajusta dias 29,30,31 para o último dia de meses mais curtos.
 */
export function projectedMonthlyDates({dueDay,installmentCount,issueDate='',startDate=''}={}){
 const day=Number(dueDay),count=Number(installmentCount);
 const anchor=String(issueDate||startDate||'');
 if(!Number.isInteger(day)||day<1||day>31||!Number.isInteger(count)||count<1||count>72)return [];
 if(!/^\d{4}-\d{2}-\d{2}$/.test(anchor))return [];
 const origin=new Date(anchor+'T12:00:00Z');
 if(!Number.isFinite(origin.getTime())||origin.toISOString().slice(0,10)!==anchor)return [];
 let y=origin.getUTCFullYear(),m=origin.getUTCMonth();
 const dateFor=(year,month)=>{
  const last=new Date(Date.UTC(year,month+1,0)).getUTCDate();
  return new Date(Date.UTC(year,month,Math.min(day,last),12));
 };
 if(dateFor(y,m)<origin){m++;if(m>11){y++;m=0;}}
 const result=[];
 for(let i=0;i<count;i++){
  const mo=m+i,yr=y+Math.floor(mo/12),month=mo%12;
  result.push(dateFor(yr,month).toISOString().slice(0,10));
 }
 return result;
}
export function explicitDueDay(pages){
 const text=(Array.isArray(pages)?pages:[String(pages||'')]).join('\n');
 const matches=[...text.matchAll(/\b(?:vencimento\s*(?::|-)?\s*(?:dia\s*)?|dia\s+(?:de\s+)?vencimento\s*(?::|-)?\s*)(0?[1-9]|[12]\d|3[01])(?=\s|$|[;|,])/gim)]
  .map(m=>Number(m[1]));
 const distinct=[...new Set(matches)];
 return distinct.length===1?distinct[0]:null;
}
