const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const template=fs.readFileSync('relatorios-pdf.js','utf8');
const app=fs.readFileSync('script.js','utf8');
const index=fs.readFileSync('index.html','utf8');
const logo=fs.readFileSync('assets/logo-lebrime-transparente.svg','utf8');
assert.match(logo,/^<svg[\s>]/);
assert.match(logo,/fill-rule="evenodd"/);
assert.match(logo,/fill="#CE9900"/);
assert.doesNotMatch(logo,/background|#fff|<image\b/i);
assert.match(index,/relatorios-pdf\.js\?v=20\.\d+/);
assert.ok(index.indexOf('relatorios-pdf.js')<index.indexOf('script.js'),'Template PDF deve carregar antes da aplicação');
for(const fn of ['printRenewalMirror','printCommissionReport','printTaskReport'])
 assert.ok(app.includes('function '+fn+'()'),fn+' ligado');
for(const id of ['renewalPrintMirror','commissionPrintPdf','taskPrintPdf'])
 assert.ok(app.includes('id="'+id+'"'),'Botão PDF ausente: '+id);
for(const bind of ['onclick=printRenewalMirror','onclick=printCommissionReport','onclick=printTaskReport'])
 assert.ok(app.includes(bind),'Handler PDF ausente: '+bind);
let opened=null;
const ctx={URL,Date,Intl,Promise,console,setTimeout,clearTimeout,document:{baseURI:'https://sinistrolebrime-glitch.github.io/lebrime-corretora/'},window:{open:()=>{
  const doc={html:'',open(){},close(){},write(s){this.html=s},fonts:{ready:Promise.resolve()},
    querySelector(q){if(q==='.identity img')return {complete:true,naturalWidth:65};return null},
    querySelectorAll(q){return q==='.report-brand-image'?[
      {complete:true,naturalWidth:65},{complete:true,naturalWidth:490}]:[]}};
  opened={document:doc,closed:false,focus(){},print(){this.printed=true}};
  return opened;
}},alert(){throw Error('Popup unexpectedly blocked')}};
vm.runInNewContext(template,ctx);
const r=ctx.LebrimeReports;
assert.equal(r.logoUrl,'https://sinistrolebrime-glitch.github.io/lebrime-corretora/assets/logo-lebrime-transparente.svg');
const options={title:'Relatório de Pendências',subtitle:'Conferência',period:'Novembro de 2026',
columns:['Cliente','Situação'],rows:[['Acme <script>alert(1)</script>','A conferir']],summary:[{label:'Total',value:'1'}],
note:'Dados sujeitos à conferência'};
const html=r.render(options);
assert.match(html,/LEBRIME CORRETORA DE SEGUROS/);
assert.match(html,/Relatório de Pendências/);
assert.match(html,/assets\/logo-lebrime-transparente\.svg/);
assert.match(html,/Salv(ar|ar como) PDF/i);
assert.match(html,/A4 landscape/);
assert.match(html,/class="report-watermark"/);
assert.match(html,/position:fixed/);
assert.match(html,/opacity:\.18/);
assert.match(html,/width:198mm;height:198mm/);
assert.match(html,/class="report-brand-image"/);
assert.equal((html.match(/class="report-brand-image"/g)||[]).length,2,
 'Logo aparece no cabeçalho e como marca d\'água com transparência');
assert.doesNotMatch(html,/<img[^>]*src="[^"]*\.png"[^>]*class="report-brand-image"/);

assert.match(html,/thead\{display:table-header-group/);
assert.match(html,/break-inside:avoid/);
assert.ok(!html.includes('<script>alert(1)</script>'),'Não inserir HTML de usuário no PDF');
assert.match(html,/&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
for(const title of ['Relatório de Renovações','Relatório de Pendências','Relatório de Comissões'])
 assert.match(r.render({...options,title}),new RegExp(title));
(async()=>{
 assert.equal(r.open(options),true);
 await new Promise(resolve=>setImmediate(resolve));
 assert.ok(opened.printed,'Após carregar logo, abrir impressão nativa do navegador');
 assert.match(opened.document.html,/LEBRIME CORRETORA DE SEGUROS/);
 console.log('PASS: logo vetorial sem fundo, relatórios renovação/pendências/comissões, A4, cabeçalho e impressão após imagem.');
})().catch(e=>{console.error(e);process.exitCode=1});
