const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {performance}=require('node:perf_hooks');

function app(file){
  const nodes=new Map();
  const storage=new Map([['lebrime_token_v1','test-session']]);
  const context=vm.createContext({console,Intl,Date,AbortController,setTimeout,clearTimeout,
    crypto:require('node:crypto').webcrypto,
    localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
    document:{querySelectorAll:()=>[],querySelector:selector=>{
      if(!nodes.has(selector))nodes.set(selector,{classList:{add(){},remove(){},toggle(){}},textContent:'',value:'',querySelectorAll:()=>[]});
      return nodes.get(selector);
    }}
  });
  vm.runInContext(fs.readFileSync(file,'utf8').split("$('#reloadPortfolioBtn').onclick")[0],context);
  return {context,run:code=>vm.runInContext(code,context),nodes,storage};
}
const fixture=[];
for(let n=0;n<656;n++)fixture.push({id:'c'+n,kind:'client',data:{name:'Cliente '+n}});
fixture.push({id:'leandro',kind:'producer',data:{name:'Leandro'}},{id:'other',kind:'producer',data:{name:'Outro'}});
for(let n=0;n<746;n++)fixture.push({id:'p'+n,kind:'proposal',data:{clientId:'c'+(n%656),number:String(n),insurer:'Seguradora',start:'2026-01-01',end:'2027-01-01',brokerage:n%2?'Lebrime':'FF Apolinário',producerId:n%3?'other':'leandro',netPremium:100000,commissionPercent:20,premium:110000}});
for(let n=0;n<7000;n++)fixture.push({id:'x'+n,kind:'payment',data:{}});

async function main(){
  const revised=app('script.js');
  revised.context.fixture=fixture;
  revised.run('records=fixture');
  const calculation=`JSON.stringify(list('client').map(r=>config.client.columns.map(c=>c[1](r))))`;
  const start=performance.now();
  const output=revised.run(calculation);
  const elapsed=performance.now()-start;
  console.log('Client calculations, 656 clients / 746 contracts:',Math.round(elapsed)+'ms');
  if(fs.existsSync('../lebrime-script-before.js')){
    const previous=app('../lebrime-script-before.js');previous.context.fixture=fixture;previous.run('records=fixture');
    const before=performance.now();
    assert.equal(output,previous.run(calculation));
    console.log('Previous version:',Math.round(performance.now()-before)+'ms; identical output');
  }
  // Returned lists may be sorted/changed without corrupting indexes.
  revised.run("portfolioRows().reverse();list('client').pop();insuranceRowsForClient('c0').pop()");
  assert.equal(output,revised.run(calculation));
  // Reload must invalidate every index, including renamed producers and client links.
  revised.run("records=records.map(r=>r.id==='p0'?{...r,data:{...r.data,clientId:'new'}}:r)");
  assert.equal(revised.run("insuranceRowsForClient('new').length"),1);
  assert.equal(revised.run("rowById('p0').data.clientId"),'new');
  // Financial rules, rounded cents and source data remain unchanged.
  for(const brokerage of ['Lebrime','FF Apolinário','Homeni','Eólica Corretora']){
    for(const producerId of ['leandro','other']){
      revised.context.sample={data:{brokerage,producerId,netPremium:100000,commissionPercent:20}};
      const c=revised.run('commissionBreakdown(sample)');
      const ff=brokerage==='Lebrime'?0:6000;
      assert.equal(c.ffFee,ff);
      assert.equal(c.producerExpected,producerId==='leandro'?20000-ff:12000);
      assert.equal(c.ffFee+c.producerExpected+c.lebrimeFee,20000);
    }
  }
  // Cadastro de proposta/apólice com comissão apurada implica repasse pago,
  // sem exigir transferência preenchida manualmente. Não duplicar por comissão repetida.
  revised.run(`records=records.concat([
    {id:'cm0',kind:'commission',data:{proposalId:'p0',producerId:'leandro',expected:20000,ffFee:6000,producerExpected:14000,received:14000,transferPaid:0}},
    {id:'cm1',kind:'commission',data:{proposalId:'p1',producerId:'other',expected:20000,ffFee:0,producerExpected:12000,received:20000,transferPaid:0}},
    {id:'cm2',kind:'commission',data:{proposalId:'p2',producerId:'other',expected:20000,ffFee:6000,producerExpected:12000,received:14000,transferPaid:0}},
    {id:'cm_dup',kind:'commission',data:{proposalId:'p0',producerExpected:14000,received:0,transferPaid:0,status:'Duplicada'}}
  ])`);
  assert.equal(revised.run('effectiveCommissionRows().length'),3);
  assert.equal(revised.run('effectiveCommissionRows().reduce((sum,r)=>sum+paidToProducerOf(r),0)'),38000);
  assert.equal(revised.run("config.commission.columns.find(c=>c[0]==='Paga ao produtor')[1](rowById('cm0'))"),'R$ 140,00');
  revised.run('renderDashboard()');
  const dashboard=revised.nodes.get('#dashboard').innerHTML;
  assert.equal((dashboard.match(/Comissões e repasses/g)||[]).length,1,'only one financial panel');
  assert.equal(dashboard.includes('Comissões e resultado'),false,'duplicate summary removed');
  assert.equal(dashboard.includes('dashboard-finance-kpis'),false);
  assert.match(dashboard,/Pago a produtores<\/span><strong>R\$\s*380,00/);
  assert.match(dashboard,/Líquido Lebrime/);
  const summary=revised.run('commissionSummary(effectiveCommissionRows())');
  assert.match(summary,/Paga a produtores/);
  assert.match(summary,/Lucro realizado/);
  const a=app('script.js');
  a.context.fetch=async()=>({ok:true,status:200,json:async()=>({rows:fixture})});
  await a.run('loadRecords()');
  assert.equal(a.run('records.length'),fixture.length);
  a.context.fetch=async()=>({ok:true,status:200,json:async()=>({})});
  await assert.rejects(a.run('loadRecords()'),/não retornou/);
  assert.equal(a.run('records.length'),fixture.length);
  a.context.fetch=async()=>({ok:false,status:503,json:async()=>({error:'Indisponível'})});
  await assert.rejects(a.run("api('select')"),/Indisponível/);
  assert.equal(a.storage.get('lebrime_token_v1'),'test-session');
  a.context.setTimeout=callback=>setTimeout(callback,5);
  a.context.fetch=(_url,opts)=>new Promise((_resolve,reject)=>opts.signal.addEventListener('abort',()=>reject(new Error('aborted'))));
  await assert.rejects(a.run("api('select')"),/30 segundos/);
  assert.equal(a.storage.get('lebrime_token_v1'),'test-session');
  a.context.fetch=async()=>({ok:false,status:401,json:async()=>({error:'Sessão inválida'})});
  await assert.rejects(a.run("api('select')"),/sessão expirou/);
  assert.equal(a.storage.has('lebrime_token_v1'),false);
  a.storage.set('lebrime_token_v1','test-session');
  let resolveFetch;
  a.context.setTimeout=setTimeout;
  a.context.fetch=()=>new Promise(resolve=>{resolveFetch=resolve;});
  const boot=a.run('boot()');
  assert.equal(a.nodes.get('#reloadPortfolioBtn').disabled,true);
  a.run('logout()');
  resolveFetch({ok:true,status:200,json:async()=>({rows:[]})});
  await boot;
  assert.equal(a.run('records.length'),fixture.length,'late response after logout must not replace data');
  a.context.fetch=async(url)=>({ok:true,status:200,json:async()=>url.includes('action=login')?{token:'new-session'}:{rows:fixture}});
  a.run('renderNav=()=>{};navigate=()=>{}');
  await a.run("login('test-password')");
  assert.equal(a.storage.get('lebrime_token_v1'),'new-session');
  assert.equal(a.nodes.get('#reloadPortfolioBtn').disabled,false);
  assert.equal(a.run('records.length'),fixture.length);
  console.log('PASS: indexes, snapshot invalidation, all commission rules, API errors, timeout, session and logout race');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
