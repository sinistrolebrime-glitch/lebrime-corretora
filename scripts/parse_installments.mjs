/**
 * Extrator conservador do quadro de parcelamento em PDF.
 * Recebe o texto separado por linhas e páginas, nunca dados financeiros inventados.
 * Unidades monetárias: centavos. Uma extração "alta" exige sequência, datas e
 * conciliação exata com o prêmio contratual. Linhas ambíguas vão para revisão.
 */
export function parseInstallmentSchedule(pages, {premium=0,paymentMethod=''}={}) {
  const heading=/parcelamento|plano\s+de\s+pagamento|demonstrativo\s+de\s+parcelas|parcelas?\s+vencimento|vencimento\s+valor|condi[cç][oõ]es?\s+de\s+pagamento|quadro\s+de\s+parcelas|presta[cç][oõ]es?\s+vencimento/i;
  const explicit=/\b(?:parcela|prestação|prestacao)\s*(?:n[ºo°.]?\s*)?0?(\d{1,2})(?:\s*(?:\/|de)\s*0?(\d{1,2}))?/i;
  const numbered=/^\s*0?(\d{1,2})\s*(?:\/\s*0?(\d{1,2}))?(?=\s|[-|;:])/;
  const dates=/\b([0-3]?\d)\/([01]?\d)\/(20\d{2})\b/g;
  const currency=/(?:R\$\s*)?(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}\b/g;
  const parseMoney=raw=>{
    const v=String(raw||'').replace(/R\$\s*/i,'').replace(/\./g,'').replace(',','.');
    return /^\d+\.\d{2}$/.test(v)?Math.round(Number(v)*100):0;
  };
  const validISO=(dd,mm,yyyy)=>{
    const iso=yyyy+'-'+mm.padStart(2,'0')+'-'+dd.padStart(2,'0');
    const d=new Date(iso+'T12:00:00Z');
    return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===iso?iso:'';
  };
  const source=Array.isArray(pages)?pages:[String(pages||'')];
  const candidates=[];let headings=0;
  for(let pageIndex=0;pageIndex<Math.min(source.length,20);pageIndex++){
    const lines=String(source[pageIndex]||'').split(/\r?\n/).map(line=>line.replace(/\s+/g,' ').trim()).filter(Boolean);
    let context=0;
    for(let i=0;i<lines.length;i++){
      const line=lines[i];
      if(heading.test(line)){context=25;headings++;}
      else context=Math.max(0,context-1);
      const explicitMatch=explicit.exec(line);
      const numberedMatch=context>0?numbered.exec(line):null;
      const n=explicitMatch?Number(explicitMatch[1]):numberedMatch?Number(numberedMatch[1]):0;
      const hintedTotal=Number(explicitMatch?.[2]||numberedMatch?.[2]||0);
      if(n<1||n>72)continue;
      // A palavra "parcela" isolada com vencimento e valor na linha seguinte
      // ainda é ambígua; não atribuímos valores de outro item silenciosamente.
      const foundDates=Array.from(line.matchAll(dates));
      const foundMoney=Array.from(line.matchAll(currency));
      if(foundDates.length!==1||foundMoney.length!==1)continue;
      const d=foundDates[0],iso=validISO(d[1],d[2],d[3]);
      const amount=parseMoney(foundMoney[0][0]);
      if(!iso||amount<=0||amount>100_000_000_000)continue;
      candidates.push({number:n,totalHint:hintedTotal,amount,due:iso,
        paymentMethod:String(paymentMethod||''),sourcePage:pageIndex+1,sourceLine:i+1,
        explicit:!!explicitMatch,context:context>0});
    }
  }
  const grouped=new Map();
  for(const c of candidates){
    const key=String(c.number);
    const prior=grouped.get(key);
    if(!prior){grouped.set(key,c);continue;}
    // Repetição do mesmo quadro em páginas diferentes é idempotente.
    if(prior.due!==c.due||prior.amount!==c.amount){
      return {status:'review',reason:'Mais de um vencimento ou valor para a mesma parcela',plan:[],pages:source.length,found:candidates.length};
    }
  }
  const plan=[...grouped.values()].sort((a,b)=>a.number-b.number);
  const expectedCount=Math.max(...plan.map(r=>r.totalHint||0),0);
  const expectedPremium=Number(premium)||0;
  const total=plan.reduce((n,r)=>n+r.amount,0);
  const sequential=plan.length>0&&plan.every((r,i)=>r.number===i+1);
  const consistentCount=expectedCount===0||expectedCount===plan.length;
  const strongContext=headings>0||plan.every(r=>r.explicit);
  const sourceValid=source.length>0&&plan.length>0;
  const premiumMatch=Number.isSafeInteger(expectedPremium)&&expectedPremium>0&&total===expectedPremium;
  const high=sourceValid&&sequential&&consistentCount&&strongContext&&premiumMatch;
  let reason='Conciliação pendente';
  if(!plan.length)reason='Quadro de parcelas com valores e vencimentos não identificado';
  else if(!sequential)reason='Numeração das parcelas incompleta ou fora de sequência';
  else if(!consistentCount)reason='Quantidade de parcelas divergente';
  else if(!strongContext)reason='Quadro de parcelamento não identificado com segurança';
  else if(!premiumMatch)reason='Soma das parcelas diferente do prêmio total cadastrado';
  else reason='Valores, vencimentos e prêmio conciliados';
  return {status:high?'verified':'review',reason,plan:plan.map(({number,totalHint,explicit,context,...rest})=>({installmentNo:number,...rest})),
    pages:source.length,found:candidates.length,amountTotal:total,premium:expectedPremium,
    variance:expectedPremium?total-expectedPremium:null,matchedPremium:premiumMatch};
}
