/* LEBRIME — Motor de leitura operacional de parcelas (sem gravações automáticas).
 * Datas ou valores ausentes nunca são inferidos para uma cobrança.
 */
const FINANCE=(()=>{
  const todayISO=()=>new Date().toISOString().slice(0,10);
  const validDate=value=>{
    if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value||'')))return false;
    const parsed=new Date(value+'T12:00:00Z');
    return !Number.isNaN(parsed.getTime())&&parsed.toISOString().slice(0,10)===value;
  };
  const linkedId=row=>String(row?.data?.policyId||row?.data?.proposalId||'');
  const importedIds=docs=>{
    const ids=new Set();
    for(const doc of docs){
      const type=String(doc?.data?.documentType||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
      const linked=linkedId(doc);
      const hasFile=Boolean(doc?.data?.storageKey||doc?.data?.externalUrl||doc?.data?.sourceDriveUrl||doc?.data?.sourceDriveFileId);
      if(linked&&hasFile&&(type.includes('proposta')||type.includes('apolice')))ids.add(linked);
    }
    return ids;
  };
  const effective=(row,contract,imported)=>Boolean(
    contract&&(contract.kind==='policy'||(contract.kind==='proposal'&&imported.has(contract.id)))
  );
  const blocked=row=>['cancelado','cancelada','pago','paga'].includes(String(row?.data?.status||'').toLowerCase())||
    /n[aã]o cobrar|em tratativa|em verifica[cç][aã]o/i.test(String(row?.data?.collectionStatus||''));
  const stage=(row,contract,imported,cutoff='2026-10',asOf=todayISO())=>{
    if(row?.virtual)return 'Conferir parcelamento';
    const d=row?.data||{};
    if(d.status==='Cancelado')return 'Cancelada';
    if(d.status==='Pago')return /migra/i.test(String(d.migrationStatus||''))?'Pago por migração':'Pagamento registrado';
    if(!contract)return 'Conferir vínculo';
    if(!effective(row,contract,imported))return 'Previsão — não cobrar';
    if(!Number(d.amount||0))return 'Conferir valor';
    if(!validDate(d.due))return 'Conferir vencimento';
    if(d.due.slice(0,7)<cutoff)return 'Migração a conferir';
    if(/n[aã]o cobrar|em tratativa|em verifica[cç][aã]o/i.test(String(d.collectionStatus||'')))return 'Cobrança suspensa';
    if(d.due<asOf)return 'Vencida — não confirmada';
    if(d.due===asOf)return 'Vence hoje';
    return 'A vencer';
  };
  const actionable=(row,contract,imported,cutoff,asOf)=>{
    const s=stage(row,contract,imported,cutoff,asOf);
    return ['Vencida — não confirmada','Vence hoje','A vencer'].includes(s);
  };
  const queueRows=(contracts,payments)=>{
    const linked=new Set(payments.map(linkedId).filter(Boolean));
    const review=contracts.filter(r=>!linked.has(String(r.id))).map(r=>({
      id:'review-'+r.id,kind:'payment_review',virtual:true,
      data:{clientId:r.data.clientId||'',policyId:r.kind==='policy'?r.id:'',
        proposalId:r.kind==='proposal'?r.id:'',installment:'—',due:'',amount:0,
        status:'A conferir',collectionStatus:'Conferir PDF',financialTracking:'Parcelamento pendente'}
    }));
    return [...payments,...review];
  };
  const daysBetween=(iso,asOf=todayISO())=>validDate(iso)?Math.round((Date.parse(iso+'T12:00:00Z')-Date.parse(asOf+'T12:00:00Z'))/86400000):null;
  const priority=(row,contract,imported,cutoff,asOf)=>{
    const s=stage(row,contract,imported,cutoff,asOf);
    if(s==='Vencida — não confirmada')return 0;
    if(s==='Vence hoje')return 1;
    if(s==='A vencer')return daysBetween(row.data.due,asOf)<=7?2:3;
    if(/^Conferir|^Migração/.test(s))return 4;
    if(s==='Cobrança suspensa')return 5;
    if(s==='Previsão — não cobrar')return 6;
    return 7;
  };
  const summary=(rows,findContract,imported,cutoff,asOf)=>{
    const result={overdue:0,today:0,soon:0,review:0,suspended:0,forecast:0,paid:0,paidMigration:0,openValue:0};
    for(const row of rows){
      const st=stage(row,findContract(row),imported,cutoff,asOf);
      if(st==='Vencida — não confirmada')result.overdue++;
      if(st==='Vence hoje')result.today++;
      if(st==='A vencer'&&daysBetween(row.data.due,asOf)<=7)result.soon++;
      if(/^Conferir|^Migração/.test(st))result.review++;
      if(st==='Cobrança suspensa')result.suspended++;
      if(st==='Previsão — não cobrar')result.forecast++;
      if(st==='Pagamento registrado')result.paid++;
      if(st==='Pago por migração')result.paidMigration++;
      if(['Vencida — não confirmada','Vence hoje','A vencer'].includes(st))result.openValue+=Number(row.data.amount||0);
    }
    return result;
  };
  const message=(row,clientName,contractNumber,asOf=todayISO())=>{
    if(!validDate(row?.data?.due))return '';
    const val=(Number(row.data.amount||0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
    const due=new Intl.DateTimeFormat('pt-BR',{timeZone:'UTC'}).format(new Date(row.data.due+'T12:00:00Z'));
    const salutation='Olá, tudo bem? Aqui é da Lebrime Corretora de Seguros.';
    const info=' Referente ao seguro '+String(contractNumber||'')+', parcela '+String(row.data.installment||'')+
      ' no valor de '+val+', com vencimento em '+due+'.';
    return salutation+(row.data.due<asOf
      ?' Estamos conferindo os pagamentos e ainda não identificamos a confirmação desta parcela.'+info+
        ' Por gentileza, poderia nos informar se o pagamento já foi realizado? Se sim, desconsidere este lembrete e, se possível, encaminhe o comprovante. Obrigado!'
      :' Passando para lembrar, com antecedência, do vencimento da sua parcela.'+info+
        ' Caso já tenha efetuado o pagamento, por gentileza desconsidere. Permanecemos à disposição!');
  };
  return {validDate,importedIds,effective,stage,actionable,queueRows,daysBetween,priority,summary,message};
})();
