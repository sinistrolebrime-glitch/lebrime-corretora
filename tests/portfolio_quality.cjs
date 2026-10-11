const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const code=fs.readFileSync('qualidade-carteira.js','utf8');
const clients=[
 {id:'c1',data:{name:'Cliente 1',document:'12345678900'}},
 {id:'c2',data:{name:'Cliente 2',document:''}}
];
const contracts=[
 {id:'p1',data:{clientId:'c1',start:'2025-10-10',end:'2026-10-10',producerId:'producer1'}},
 {id:'p2',data:{clientId:'c2',start:'2026-02-30',end:'2027-02-28',producerPending:true}},
 {id:'p3',data:{clientId:'c-unknown',start:'2026-10-11',end:'2027-10-10',producer:'Conferido'}}
];
const docs=[{id:'d1',data:{proposalId:'p1',sourceDriveFileId:'123456789012345'}}];
const payments=[{id:'pay1',data:{due:'2026-10-12'}},{id:'pay2',data:{due:''}}];
const dashboard={isConnected:true,innerHTML:'',insertAdjacentHTML(pos,html){this.innerHTML+=html}};
const document={head:{appendChild(){}},createElement:()=>({textContent:''}),getElementById:id=>id==='dashboard'?dashboard:null};
const context={document,renderDashboard:()=>{},list:type=>type==='client'?clients:type==='document'?docs:payments,
 portfolioRows:()=>contracts,esc:s=>s,globalThis:{},Date,String,Number,Set};
vm.createContext(context);
vm.runInContext(code,context);
const result=context.globalThis.LebrimePortfolioQuality.coverage(clients,contracts,docs,payments);
assert.equal(result.missingClient,1);
assert.deepEqual(result.stats.map(x=>[x.value,x.total]),[[1,2],[2,3],[1,3],[2,3],[1,2]]);
assert.equal(context.globalThis.LebrimePortfolioQuality.percentage(1,2),50);
assert.equal(context.globalThis.LebrimePortfolioQuality.percentage(0,0),0);
assert.equal(context.globalThis.LebrimePortfolioQuality.isoDate('2026-02-30'),false);
assert.equal(context.globalThis.LebrimePortfolioQuality.isoDate('2028-02-29'),true);
context.renderDashboard();
assert.match(dashboard.innerHTML,/Conferência de dados da carteira/);
assert.match(dashboard.innerHTML,/Parcelas com vencimento documentado/);
assert.doesNotMatch(dashboard.innerHTML,/Confiabilidade geral: 100%/);
console.log('PASS: indicadores reais de documentação e completude, datas bissextas e pendências preservadas');
