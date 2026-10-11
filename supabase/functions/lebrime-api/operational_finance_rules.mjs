// Regras de classificação compartilháveis com os testes da área operacional.
// Nunca converter "sem confirmação" automaticamente em inadimplência.
export const CUTOFF_MONTH='2026-10';
export const validDue=d=>{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(d||'')))return false;
  const t=new Date(d+'T12:00:00Z');
  return Number.isFinite(t.getTime())&&t.toISOString().slice(0,10)===d;
};
export const localToday=()=>new Date(Date.now()-3*3600000).toISOString().slice(0,10);
export const stateOf=(p,contract,importedIds,day=localToday())=>{
  const d=p?.data||p||{};
  if(d.status==='Pago')return /migra/i.test(String(d.migrationStatus||''))?'paid_migration':'paid';
  if(d.status==='Cancelado')return 'cancelled';
  if(!contract)return 'review_link';
  if(contract.kind!=='policy'&&!(contract.kind==='proposal'&&importedIds.has(contract.id)))return 'forecast';
  if(!Number.isSafeInteger(Number(d.amount))||Number(d.amount)<=0)return 'review_amount';
  if(!validDue(d.due))return 'review_due';
  if(d.due.slice(0,7)<CUTOFF_MONTH)return 'review_migration';
  if(/n[aã]o cobrar|em tratativa|em verifica[cç][aã]o/i.test(String(d.collectionStatus||'')))return 'blocked';
  if(String(d.status||'')!=='Em aberto')return 'review_status';
  if(d.due<day)return 'late_unconfirmed';
  if(d.due===day)return 'today';
  return 'upcoming';
};
export const actionable=s=>['late_unconfirmed','today','upcoming'].includes(s);
export const review=s=>s.startsWith('review_')||s==='blocked';
export const daysUntil=(due,day=localToday())=>validDue(due)?Math.round((Date.parse(due+'T12:00:00Z')-Date.parse(day+'T12:00:00Z'))/86400000):null;
export const includeByFilter=(row,filter,day=localToday())=>{
  const s=row.stage;
  const days=daysUntil(row.due,day);
  if(filter==='attention')return ['late_unconfirmed','today'].includes(s)||(s==='upcoming'&&days<=7);
  if(filter==='late')return s==='late_unconfirmed';
  if(filter==='week')return (s==='upcoming'&&days<=7)||s==='today';
  if(filter==='month')return (s==='upcoming'&&days<=30)||s==='today';
  if(filter==='review')return review(s);
  if(filter==='blocked')return s==='blocked'||s==='forecast';
  if(filter==='paid')return ['paid','paid_migration'].includes(s);
  return true;
};
export const stageLabel=s=>({
  late_unconfirmed:'Vencida — sem confirmação',today:'Vence hoje',
  upcoming:'A vencer',review_due:'Conferir vencimento',
  review_amount:'Conferir valor',review_link:'Conferir vínculo',
  review_migration:'Conferir migração',review_status:'Conferir situação',
  blocked:'Cobrança suspensa',forecast:'Previsão — não cobrar',
  paid:'Pagamento confirmado',paid_migration:'Pago por migração',
  cancelled:'Cancelada'
})[s]||'Conferir';
export const stageRank=(row,day=localToday())=>{
  const s=row.stage,days=daysUntil(row.due,day);
  if(s==='late_unconfirmed')return 0;
  if(s==='today')return 1;
  if(s==='upcoming'&&days<=7)return 2;
  if(s==='upcoming')return 3;
  if(review(s))return 4;
  if(s==='forecast')return 5;
  if(s==='paid'||s==='paid_migration')return 6;
  return 7;
};
export function summary(rows,day=localToday()){
  const totals={late:0,today:0,week:0,month:0,review:0,blocked:0,forecast:0,paid:0,paidMigration:0,all:rows.length};
  for(const r of rows){
    const d=daysUntil(r.due,day);
    if(r.stage==='late_unconfirmed')totals.late++;
    if(r.stage==='today')totals.today++;
    if(r.stage==='upcoming'&&d<=7||r.stage==='today')totals.week++;
    if(r.stage==='upcoming'&&d<=30||r.stage==='today')totals.month++;
    if(review(r.stage))totals.review++;
    if(r.stage==='blocked')totals.blocked++;
    if(r.stage==='forecast')totals.forecast++;
    if(r.stage==='paid')totals.paid++;
    if(r.stage==='paid_migration')totals.paidMigration++;
  }
  return totals;
}
export const makeReminder=(row,day=localToday())=>{
  if(!actionable(row.stage)||!validDue(row.due)||Number(row.amount)<=0)return '';
  const when=new Intl.DateTimeFormat('pt-BR',{timeZone:'UTC'}).format(new Date(row.due+'T12:00:00Z'));
  const premium=(Number(row.amount)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const number=String(row.contractNumber||'').trim(),no=String(row.installment||'').trim();
  const detail=' Referente ao seguro '+number+', parcela '+no+', no valor de '+premium+
      ', com vencimento em '+when+'.';
  return 'Olá! Aqui é da Lebrime Corretora de Seguros. '+(row.stage==='late_unconfirmed'
     ?'Estamos conferindo os pagamentos e ainda não identificamos a confirmação desta parcela.'+detail+
      ' Você poderia nos confirmar se o pagamento foi realizado? Caso sim, desconsidere esta mensagem e, se possível, nos encaminhe o comprovante. Obrigado!'
     :'Passando para lembrar do próximo vencimento.'+detail+
      ' Caso já tenha efetuado o pagamento, por gentileza desconsidere. Permanecemos à disposição!');
};
