/* LEBRIME v20.55 — Painel seguro para o mutirão de 46 propostas pendentes.
 * A fila assistida trata PROPOSTAS NOVAS; a fila de renovações permanece independente.
 * Apenas manifestos conferidos: NÃO carrega nem guarda PDFs no navegador.
 */
(()=>{
'use strict';
const root=document.getElementById('importView');
if(!root)return;
const ENDPOINT='https://paiezoesntmicnwcmemt.supabase.co/functions/v1/lebrime-import-queue';
const BATCH='pendentes46-out2026',GOAL=46;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const styles=document.createElement('style');
styles.textContent='.mutirao-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(115px,1fr));gap:9px;margin:12px 0}'+
'.mutirao-stat{border:1px solid var(--border,#e2e6ee);border-radius:10px;padding:10px}'+
'.mutirao-stat strong{display:block;font-size:22px}'+
'.mutirao-help{max-width:850px;line-height:1.5}'+
'.mutirao-list{max-height:270px;overflow:auto}'+
'.mutirao-list table{width:100%}'+
'.mutirao-alert{color:var(--muted,#667586)}'+
'#mutiraoManifest{width:100%;min-height:125px;font-family:ui-monospace,monospace;font-size:12px}';
document.head.appendChild(styles);
const section=document.createElement('section');
section.id='lebrimeMutirao46';
section.className='panel';
section.innerHTML='<div class="section-title-row"><div><h2>Mutirão das 46 propostas pendentes</h2>'+
'<p class="mutirao-help">Fila alternativa para clientes novos ou sem apólice anterior encontrada. O contrato só é marcado como concluído após validar CPF/CNPJ, duplicidades, prêmio, comissão, parcelas e PDF privado. Falha isolada vai para revisão e não impede os outros itens.</p></div></div>'+
'<div id="mutiraoCounts" class="mutirao-grid" aria-live="polite"><div>Aguardando conferência do servidor</div></div>'+
'<div class="queue-pick"><button type="button" class="btn ghost" id="mutiraoReload">Atualizar situação</button> '+
'<button type="button" class="btn ghost" id="mutiraoProcess">Processar até 5 agora</button></div>'+
'<p class="mutirao-alert" id="mutiraoMessage" role="status">Aguardando autenticação do gestor.</p>'+
'<div class="mutirao-list"><table><thead><tr><th>Manifesto</th><th>Etapa</th><th>Tentativas</th><th>Contrato salvo</th><th>Conferência</th></tr></thead>'+
'<tbody id="mutiraoRows"><tr><td colspan="5">Nenhum item consultado.</td></tr></tbody></table></div>'+
'<details style="margin-top:1rem"><summary>Plano B — enviar até 10 manifestos previamente conferidos</summary>'+
'<p class="mutirao-help">Use esta alternativa se o cadastro direto da conversa falhar. Primeiro salve o PDF em Drive privado e confira os dados. A entrada aceita um objeto com payload/source ou uma lista JSON de 1 a 10 objetos. Não cole chaves, senhas ou arquivos em base64. Manifestos não comprovados devem ir para revisão, não para cadastro.</p>'+
'<label for="mutiraoManifest">Manifestos JSON validados</label>'+
'<textarea id="mutiraoManifest" placeholder="{&quot;payload&quot;:{&quot;requestKey&quot;:&quot;b46-item-0001&quot;,&quot;kind&quot;:&quot;proposal&quot;,&quot;document&quot;:&quot;CPF_OU_CNPJ&quot;,&quot;client&quot;:{&quot;name&quot;:&quot;SEGURADO&quot;},&quot;data&quot;:{&quot;number&quot;:&quot;...&quot;,&quot;insurer&quot;:&quot;...&quot;,&quot;branch&quot;:&quot;Automóvel&quot;,&quot;start&quot;:&quot;2026-10-01&quot;,&quot;end&quot;:&quot;2027-10-01&quot;,&quot;premium&quot;:10000,&quot;netPremium&quot;:9270,&quot;iof&quot;:730,&quot;producerId&quot;:&quot;...&quot;,&quot;commissionPercent&quot;:20,&quot;brokerage&quot;:&quot;Lebrime&quot;,&quot;installmentPlan&quot;:[{&quot;amount&quot;:10000}]}},&quot;source&quot;:{&quot;driveFileId&quot;:&quot;ID_DO_DRIVE&quot;,&quot;fileName&quot;:&quot;arquivo.pdf&quot;}}"></textarea>'+
'<label><input id="mutiraoVerified" type="checkbox"> PDF e identidade foram conferidos; autorização de cadastro confirmada</label>'+
'<p><button class="btn primary" type="button" id="mutiraoSubmit">Enviar à fila protegida</button></p></details>';
root.insertAdjacentElement('afterbegin',section);
const el=id=>document.getElementById(id);
const info=msg=>{el('mutiraoMessage').textContent=String(msg)};
const state={result:null,updating:false};
async function call(action,body={}){
 const token=localStorage.getItem('lebrime_token_v1')||'';
 if(!token)throw new Error('Entre no portal como gestor para consultar a fila.');
 const aborter=new AbortController(),timer=setTimeout(()=>aborter.abort(),25000);
 try{
  const response=await fetch(ENDPOINT+'?action='+encodeURIComponent(action),{
   method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},
   body:JSON.stringify(body),cache:'no-store',signal:aborter.signal
  });
  const parsed=await response.json().catch(()=>({}));
  // 207 Multi-Status can contain isolated failures but the result is still usable.
  if(!response.ok && response.status!==207)throw new Error(String(parsed.error||'Operação indisponível').slice(0,230));
  return parsed;
 }finally{clearTimeout(timer)}
}
const caption={queued:'Aguardando',processing:'Processando',retry:'Nova tentativa',review:'Revisão necessária',done:'Concluído no banco'};
async function refresh(){
 if(state.updating)return;state.updating=true;
 try{
  const result=await call('assisted-status');
  state.result=result;
  const counts=result.health?.counts||{},received=Object.values(counts).reduce((a,b)=>a+Number(b||0),0);
  const metrics=[
   ['Recebidas',received],['Concluídas',Number(counts.done||0)],['Aguardando',Number(counts.queued||0)+Number(counts.retry||0)],
   ['Em processamento',Number(counts.processing||0)],['Revisão',Number(counts.review||0)],['Ainda não recebidas',Math.max(0,GOAL-received)]
  ];
  el('mutiraoCounts').innerHTML=metrics.map(([title,value])=>
   '<div class="mutirao-stat"><strong>'+esc(value)+'</strong><span>'+esc(title)+'</span></div>').join('');
  const entries=Array.isArray(result.items)?result.items:[];
  el('mutiraoRows').innerHTML=entries.length?entries.map(item=>
   '<tr><td>'+esc(item.request_key||'—')+'</td><td>'+esc(caption[item.state]||item.state)+'</td>'+
   '<td>'+esc(item.attempts||0)+'</td><td>'+esc(item.contract_id||'—')+'</td>'+
   '<td>'+esc(item.last_error||'—')+'</td></tr>').join(''):
   '<tr><td colspan="5">Nenhum manifesto recebido nesta operação. Prontos para cadastrar as 46.</td></tr>';
  info('Fila de novas propostas operacional. Renovações seguem na outra fila. O PDF deve ser salvo em Drive privado antes do manifesto.');
 }catch(error){info('Falha ao consultar a fila: '+String(error.message||error)+'. PDFs e contratos confirmados não serão alterados. Use a fila antiga ou o cadastro assistido por bloco.');}
 finally{state.updating=false}
}
el('mutiraoReload').onclick=refresh;
el('mutiraoProcess').onclick=async()=>{
 const b=el('mutiraoProcess');b.disabled=true;
 try{const result=await call('assisted-process');info('Lote isolado: '+Number(result.completed||0)+' concluídas, '+
 Number(result.needsReview||0)+' em revisão, '+Number(result.retry||0)+' novamente agendadas.');await refresh();}
 catch(e){info(String(e.message||e))}
 finally{b.disabled=false}
};
el('mutiraoSubmit').onclick=async()=>{
 if(!el('mutiraoVerified').checked)return info('Confirme a conferência prévia com cada PDF.');
 const raw=el('mutiraoManifest').value.trim();if(!raw||raw.length>640000)return info('Informe de 1 a 10 manifestos em JSON, até 640 KB.');
 let parsed;try{parsed=JSON.parse(raw)}catch{return info('JSON inválido: confira os campos e as vírgulas.')}
 const list=Array.isArray(parsed)?parsed:[parsed];
 if(list.length<1||list.length>10||list.some(x=>!x?.payload||!x?.source))
  return info('Envie de 1 a 10 objetos com payload e source. Não inclua PDFs ou base64.');
 const btn=el('mutiraoSubmit');btn.disabled=true;
 try{
  const out=await call('assisted-batch',{batch:BATCH,manifests:list});
  const successes=out.items?.filter(x=>x.ok).length||0;
  const issues=out.items?.filter(x=>!x.ok).map(x=>'#'+(x.index+1)+': '+x.error)||[];
  // Only remove typed data if every item is safely staged; retain failed manifests for correction.
  if(successes===list.length){el('mutiraoManifest').value='';el('mutiraoVerified').checked=false;}
  await refresh();
  info(successes+'/'+list.length+' recebidos pela fila. '+(issues.length?'Revisões: '+issues.join(' | '):'Processamento independente iniciado.'));
 }catch(e){info('Não enviado: '+String(e.message||e)+'. O texto permanece disponível para nova tentativa.')}
 finally{btn.disabled=false}
};
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
setInterval(()=>{if(!document.hidden&&localStorage.getItem('lebrime_token_v1'))refresh()},60000);
setTimeout(refresh,1500);
globalThis.LebrimeMutirao46={refresh,getSnapshot:()=>state.result};
})();