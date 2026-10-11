const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('operacional.html','utf8');
const code=fs.readFileSync('operacional-renovacoes.js','utf8');
const extras=fs.readFileSync('operacional-extras.js','utf8');
assert.match(html,/operacional-renovacoes\.js\?v=/);
assert.ok(html.indexOf('operacional-financeiro.js')<html.indexOf('operacional-renovacoes.js'));
assert.match(extras,/globalThis\.lebrimeOperationalIndex=loadIndex/);
assert.doesNotMatch(code,/api\('operational-monitor'/);

const nodes=new Map();
const makeNode=(id='')=>({
 id,value:'',dataset:{},classList:{add(){},remove(){},toggle(){}},
 onclick:null,onchange:null,oninput:null,textContent:'',innerHTML:'',prepend(){},
 querySelectorAll(){return []},
});
const byId=id=>{if(!nodes.has(id))nodes.set(id,makeNode(id));return nodes.get(id)};
const doc={
 getElementById:byId,
 createElement:()=>makeNode(),
 querySelector:selector=>{
  if(selector==='#monitorPanel .monitor-tools')return byId('tools');
  return byId(selector);
 },
 querySelectorAll:()=>[]
};
const context={
 document:doc,Date,Intl,Number,String,Map,Set,
 console,normalize:s=>String(s).toLowerCase(),
 esc:s=>String(s),normDate:s=>s,
 selectTab:()=>{},renderMonitor:()=>{},loadMonitor:()=>{},currentTab:'consulta',openDetail:()=>{},
};
vm.createContext(context);
vm.runInContext(code,context);
const {monthWindow,shiftMonth,rowsFor,statsFor,accepted}=context.LebrimeRenewalMonthRules;
assert.equal(monthWindow('2026-01').to,'2026-01-31');
assert.equal(monthWindow('2026-02').to,'2026-02-28');
assert.equal(monthWindow('2028-02').to,'2028-02-29');
assert.equal(monthWindow('2026-04').to,'2026-04-30');
assert.equal(monthWindow('2026-10').from,'2026-10-01');
assert.equal(monthWindow('2026-10').to,'2026-10-31');
assert.equal(shiftMonth('2026-12',1),'2027-01');
assert.equal(shiftMonth('2027-01',-1),'2026-12');
assert.equal(shiftMonth('2026-03',-1),'2026-02');
assert.throws(()=>monthWindow('2026-13'),/mês válido/i);
const data={
 clients:[{id:'a',name:'Cliente A'},{id:'b',name:'Cliente B'}],
 contracts:[
  {id:'prev',clientId:'a',end:'2026-09-30'},
  {id:'first',clientId:'a',end:'2026-10-01'},
  {id:'today',clientId:'b',end:'2026-10-11'},
  {id:'last',clientId:'a',end:'2026-10-31'},
  {id:'next',clientId:'b',end:'2026-11-01'},
  ...Array.from({length:130},(_,i)=>({id:'extra-'+i,clientId:'b',end:'2026-10-15'}))
 ]
};
const oct=rowsFor(data,'2026-10','2026-10-11');
assert.equal(oct.length,133,'todos os registros do mês devem aparecer, sem limite de 120');
assert.equal(oct[0].end,'2026-10-01');
assert.equal(oct.at(-1).end,'2026-10-31');
assert.ok(!oct.some(x=>x.id==='prev'||x.id==='next'));
const totals=statsFor(oct);
assert.equal(totals.all,133);
assert.equal(totals.expired,1);
assert.equal(totals.today,1);
assert.equal(totals.upcoming,131);
assert.equal(oct.filter(x=>accepted(x,'expired')).length,1);
assert.equal(oct.filter(x=>accepted(x,'today')).length,1);
assert.equal(oct.filter(x=>accepted(x,'upcoming')).length,131);
assert.equal(oct.filter(x=>accepted(x,'all')).length,133);
const nov=rowsFor(data,'2026-11','2026-10-11');
assert.equal(nov.length,1);
assert.equal(nov[0].id,'next');
const feb=rowsFor({clients:data.clients,contracts:[
 {id:'leap',clientId:'a',end:'2028-02-29'},
 {id:'march',clientId:'b',end:'2028-03-01'}
]},'2028-02','2028-02-12');
assert.equal(feb.length,1);
assert.equal(feb[0].id,'leap');
console.log('PASS: mês civil 01-28/29/30/31, virada de ano, filtros de situação e 133 renovações sem corte');
