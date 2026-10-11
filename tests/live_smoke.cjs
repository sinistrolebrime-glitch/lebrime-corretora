const assert=require('node:assert/strict');
const base='https://sinistrolebrime-glitch.github.io/lebrime-corretora';
const api='https://paiezoesntmicnwcmemt.supabase.co/functions/v1/lebrime-finance-operational';
async function request(url,options={}){
 const response=await fetch(url,{...options,signal:AbortSignal.timeout(20000)});
 const text=await response.text();
 return {status:response.status,headers:response.headers,text};
}
(async()=>{
 for(const [url,markers] of [
  [base+'/?smoke=finance',['financeiro.js','financeiro-ui.js','operacional.html']],
  [base+'/operacional.html?smoke=finance',['operacional-financeiro.js','lebrime_token_v1']],
  [base+'/operacional-financeiro.js?smoke=finance',['attach-evidence','financeApi']]
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
 const preflight=await request(api+'?action=queue',{method:'OPTIONS',headers:{origin:base,'access-control-request-method':'POST'}});
 assert.equal(preflight.status,204,'Preflight do financeiro falhou');
 console.log('PASS CORS e verificação pública do portal');
})().catch(e=>{console.error(e);process.exitCode=1});
