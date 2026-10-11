const assert=require('node:assert/strict');
const base='https://sinistrolebrime-glitch.github.io/lebrime-corretora';
const api='https://paiezoesntmicnwcmemt.supabase.co/functions/v1/lebrime-finance-operational';
const operationalApi='https://paiezoesntmicnwcmemt.supabase.co/functions/v1/lebrime-operational-portal';
async function request(url,options={}){
 const response=await fetch(url,{...options,signal:AbortSignal.timeout(20000)});
 const text=await response.text();
 return {status:response.status,headers:response.headers,text};
}
(async()=>{
 for(const [url,markers] of [
  [base+'/?smoke=preview',['financeiro.js','renovacao-previa.js','newRenewalPreviewButton','newRenewalInsuredValue']],
  [base+'/operacional.html?smoke=finance',['operacional-financeiro.js','lebrime_token_v1']],
  [base+'/operacional-financeiro.js?smoke=finance',['attach-evidence','financeApi']],
  [base+'/operacional-extras.js?smoke=pdf',['operationalPdfFrame','suggestions','openDetail']],
  [base+'/operacional.html?smoke=pdf',['detailDocuments','operacional-extras.js','operationalPdfFrame']],
  [base+'/operacional-renovacoes.js?smoke=renewals',['monthWindow','shiftMonth','renewalMonthInput']],
  [base+'/operacional.html?smoke=renewals',['operacional-renovacoes.js','operacional-financeiro.js']],
  [base+'/importacao-lote.js?smoke=renewals',['bulkPdfInput','digest','lebrime-renewal-import-success']],
  [base+'/central-conferencia.js?smoke=review',['expired','producer','due','plan','lebrimeReviewCenter']],
  [base+'/renovacao-previa.js?smoke=preview',['proposal-preview','newRenewalApplyPreview','linkedClient']]
 ]){
  const response=await request(url);
  assert.equal(response.status,200,'Página inacessível: '+url+' ('+response.status+')');
  for(const marker of markers)assert.ok(response.text.includes(marker),url+' sem '+marker);
  console.log('PASS página pública:',url.split('?')[0]);
 }
 for(const [mode,headers] of [
  ['sem token',{'content-type':'application/json'}],
  ['token inválido',{'content-type':'application/json',authorization:'Bearer invalid.token'}]
 ]){
  const r=await request(api+'?action=queue',{method:'POST',headers,body:JSON.stringify({filter:'all',page:0})});
  assert.equal(r.status,401,'API deve negar '+mode+' (recebeu '+r.status+')');
  assert.ok(!r.text.includes('clientName')&&!r.text.includes('phone'),'Resposta sem credencial retornou carteira privada');
  console.log('PASS API financeira negou:',mode);
 }
 for(const endpoint of ['index','client','file']){
  const untrusted=await request(operationalApi+'?action='+endpoint,{
   method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({clientId:'client-alpha',documentId:'document-alpha'})});
  assert.equal(untrusted.status,401,'Arquivo ou lista operacional sem sessão: '+endpoint);
  assert.ok(!untrusted.text.includes('client-alpha')&&!untrusted.text.includes('document-alpha'));
  console.log('PASS API operacional protegida:',endpoint);
 }
 const operationalPreflight=await request(operationalApi+'?action=index',{method:'OPTIONS',headers:{origin:base,'access-control-request-method':'POST'}});
 assert.equal(operationalPreflight.status,204);
 const previewApi='https://paiezoesntmicnwcmemt.supabase.co/functions/v1/lebrime-api';
 for(const headers of [{'content-type':'application/pdf'},
  {'content-type':'application/pdf',authorization:'Bearer invalid.token'}]){
  const denied=await request(previewApi+'?action=proposal-preview',{
   method:'POST',headers,body:'%PDF-fake'
  });
  assert.equal(denied.status,401,'Prévia PDF sem sessão não pode acessar o leitor');
  assert.ok(!denied.text.includes('fields')&&!denied.text.includes('insuredDocument'));
 }
 const preflight=await request(api+'?action=queue',{method:'OPTIONS',headers:{origin:base,'access-control-request-method':'POST'}});
 assert.equal(preflight.status,204,'Preflight do financeiro falhou');
 console.log('PASS CORS e verificação pública do portal');
})().catch(e=>{console.error(e);process.exitCode=1});
