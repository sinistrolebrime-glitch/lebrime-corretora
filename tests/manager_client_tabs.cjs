const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const code=fs.readFileSync('gerencial-ficha-abas.js','utf8');
const manager=fs.readFileSync('script.js','utf8');
const renewal=fs.readFileSync('renovacao-cadastro.js','utf8');
assert.match(manager,/const paymentHtml=payments.length/);
assert.doesNotMatch(manager,/paymentHtml=openPayments.length/);
assert.match(renewal,/renewalOf:prior\?\.id/);
class Node{
 constructor(name=''){this.name=name;this.textContent=name;this.innerHTML='';this.dataset={};
 this.handlers={};this.children=[];this.className='';this.style={};
 this.classList={items:new Set(),toggle:(c,on)=>on?this.classList.items.add(c):this.classList.items.delete(c),
  add:c=>this.classList.items.add(c),remove:c=>this.classList.items.delete(c),
  contains:c=>this.classList.items.has(c)};}
 setAttribute(){}
 appendChild(node){this.children.push(node)}
 insertBefore(node){this.children.unshift(node);this.nav=node}
 querySelector(selector){
  if(selector==='h3')return {textContent:this.name};
  if(selector==='.client-kpis')return this.kpis||null;
  if(selector==='.detail-grid')return this.details||null;
  return null;
 }
 querySelectorAll(selector){
  if(selector==='[data-manager-tab]')return this.buttons||[];
  if(selector==='.detail-section')return this.sections||[];
  return [];
 }
}
const sections=['Contratos — histórico completo','Parcelas — histórico completo','Documentos',
 'Pendências','Renovações','Sinistros'].map(name=>new Node(name));
const root=new Node('root');root.kpis=new Node('kpis');root.details=new Node('details');root.sections=sections;
const styleHead=new Node('head');
let baseRenderCalls=0;
const ctx={document:{
 createElement(tag){const node=new Node(tag);if(tag==='nav')node.buttons=['history','data','payments','documents','operations'].map(tab=>{
  const button=new Node(tab);button.dataset.managerTab=tab;return button;
 });return node;},
 head:styleHead,getElementById:id=>id==='clientDetailBody'?root:null
},renderClientDetail:()=>{baseRenderCalls++},openClientDetail:()=>{},globalThis:{},console};
vm.createContext(ctx);vm.runInContext(code,ctx);
ctx.renderClientDetail('client-alpha');
assert.equal(baseRenderCalls,1);
assert.equal(root.nav.buttons.length,5);
assert.equal(sections[0].classList.contains('manager-client-pane-hidden'),false);
assert.equal(sections[1].classList.contains('manager-client-pane-hidden'),true);
root.nav.buttons[2].onclick();
assert.equal(sections[0].classList.contains('manager-client-pane-hidden'),true);
assert.equal(sections[1].classList.contains('manager-client-pane-hidden'),false);
root.nav.buttons[3].onclick();
assert.equal(sections[2].classList.contains('manager-client-pane-hidden'),false);
assert.equal(sections[1].classList.contains('manager-client-pane-hidden'),true);
root.nav.buttons[4].onclick();
assert.equal(sections[3].classList.contains('manager-client-pane-hidden'),false);
assert.equal(sections[4].classList.contains('manager-client-pane-hidden'),false);
assert.equal(sections[5].classList.contains('manager-client-pane-hidden'),false);
root.nav.buttons[1].onclick();
assert.equal(root.details.classList.contains('manager-client-pane-hidden'),false);
console.log('PASS: histórico completo de parcelas, abas gerenciais e seção operacional sem perda de registros');
