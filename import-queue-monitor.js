/* LEBRIME — fila de importações persistida no Supabase (gestão).
 * Área de acompanhamento e entrada manual emergencial de manifestos validados.
 * A fila nunca marca "concluído" antes da verificação no banco.
 */
(()=>{
'use strict';
const imports=document.getElementById('importView');
if(!imports)return;
const ENDPOINT='https://paiezoesntmicnwcmemt.supabase.co/functions/v1/lebrime-import-queue';
const $=id=>document.getElementById(id);
const safe=s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const box=document.createElement('section');
box.id='lebrimeServerQueue';
box.className='panel';
box.innerHTML='<div class="queue-header"><div><h2>Importações contínuas — fila no servidor</h2>'+
 '<p class="muted">O processamento é agendado. Cada proposta é independente; erro de um cliente não paralisa as outras. Só é concluída após confirmar contrato, documento e parcelas.</p></div>'+
 '<div class="queue-metrics" id="serverQueueCounts">Aguardando consulta</div></div>'+
 '<div class="queue-pick"><button type="button" class="btn ghost" id="serverQueueReload">Atualizar situação</button>'+
 '<button type="button" class="btn ghost" id="serverQueueProcess">Processar até 10 agora</button></div>'+
 '<p class="muted" id="serverQueueMessage" role="status">Aguardando login de gestor para consultar a fila.</p>'+
 '<div class="queue-list-wrap"><table><thead><tr><th>Pedido</th><th>Etapa</th><th>Tentativas</th><th>Contrato</th><th>Observação</th></tr></thead>'+
 '<tbody id="serverQueueRows"><tr><td colspan="5">Entre no sistema para carregar.</td></tr></tbody></table></div>'+
 '<details class="span-2" style="margin-top:1rem"><summary>Importação assistida — enviar manifesto já conferido</summary>'+
 '<p class="muted">Alternativa apenas quando a gravação direta da conversa falhar. Primeiro salve o PDF no Drive, confira cliente, veículo, produtor, comissão, contrato anterior e cada parcela. Não cole senhas nem chaves. Esta opção exige manifesto estruturado e sessão de gestor.</p>'+
 '<label for="serverQueueManifest">Manifesto da proposta (JSON)</label>'+
 '<textarea id="serverQueueManifest" rows="6" placeholder="{&#34;payload&#34;:{...},&#34;source&#34;:{&#34;driveFileId&#34;:&#34;...&#34;,&#34;fileName&#34;:&#34;proposta.pdf&#34;}}"></textarea>'+
 '<label><input type="checkbox" id="serverQueueConfirmed"> Conferi os dados da proposta com o PDF e a apólice anterior.</label>'+
 '<p><button type="button" class="btn primary" id="serverQueueSubmit">Enviar manifesto à fila</button></p></details>';
imports.insertAdjacentElement('afterbegin',box);
let updating=false,lastStatus=null;
async function request(action,payload={}){
 const token=localStorage.getItem('lebrime_token_v1')||'';
 if(!token)throw new Error('Entre com o perfil gestor no portal.');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
 try{
  const response=await fetch(ENDPOINT+'?action='+encodeURIComponent(action),{
   method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},
   body:JSON.stringify(payload),signal:controller.signal,cache:'no-store'
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(String(data.error||'Falha na fila').slice(0,250));
  return data;
 }finally{clearTimeout(timer)}
}
const tell=text=>{if($('serverQueueMessage'))$('serverQueueMessage').textContent=text};
async function refresh(){
 if(updating)return;updating=true;
 try{
  const result=await request('status');
  lastStatus=result;
  const groups=result.health?.counts||{};
  $('serverQueueCounts').textContent=[
   'Aguardando: '+(Number(groups.queued||0)+Number(groups.retry||0)),
   'Em processamento: '+(groups.processing||0),
   'Concluídas: '+(groups.done||0),
   'Revisão: '+(groups.review||0)
  ].join(' · ');
  const items=Array.isArray(result.items)?result.items:[];
  $('serverQueueRows').innerHTML=items.length?items.map(item=>
    '<tr><td><strong>'+safe(item.request_key||String(item.id||'').slice(0,8))+'</strong>'+
    '<small>'+safe(item.created_at?new Date(item.created_at).toLocaleString('pt-BR'):'')+'</small></td>'+
    '<td>'+safe(({done:'Concluído',queued:'Aguardando',retry:'Nova tentativa agendada',processing:'Processando',review:'Precisa de revisão'})[item.state]||item.state)+'</td>'+
    '<td>'+safe(item.attempts||0)+'</td><td>'+safe(item.contract_id||'—')+'</td>'+
    '<td>'+safe(item.last_error||'—')+'</td></tr>').join(''):
    '<tr><td colspan="5">Nenhuma proposta cadastrada nesta fila ainda.</td></tr>';
  tell('Atualizado. O agendador processa até 10 itens a cada minuto. Itens em revisão exigem correção documental antes de reenviar.');
 }catch(e){
  tell('Fila indisponível: '+String(e.message||e)+'. Isso não altera os contratos existentes.');
 }finally{updating=false}
}
$('serverQueueReload').onclick=refresh;
$('serverQueueProcess').onclick=async()=>{
 const btn=$('serverQueueProcess');btn.disabled=true;
 try{const output=await request('process');tell('Processamento solicitado: '+Number(output.completed||0)+' concluídas, '+
 Number(output.needsReview||0)+' para revisão, '+Number(output.retry||0)+' aguardando nova tentativa.');await refresh();}
 catch(e){tell(String(e.message||e))}
 finally{btn.disabled=false}
};
$('serverQueueSubmit').onclick=async()=>{
 const raw=$('serverQueueManifest').value.trim();
 if(!$('serverQueueConfirmed').checked)return tell('Antes de enviar, confirme a conferência com o PDF.');
 if(raw.length>72000)return tell('Manifesto excede o limite permitido.');
 let parsed;
 try{parsed=JSON.parse(raw)}catch{return tell('JSON inválido. Revise o manifesto.')}
 if(!parsed||typeof parsed!=='object'||!parsed.payload||!parsed.source)
  return tell('O manifesto exige payload e source.');
 const btn=$('serverQueueSubmit');btn.disabled=true;
 try{
  const result=await request('enqueue',parsed);
  tell(result.duplicate?'Proposta já identificada na fila. Não duplicada.':'Proposta recebida no servidor. Aguardando validação e processamento.');
  $('serverQueueConfirmed').checked=false;
  await refresh();
 }catch(e){tell('Manifesto não enviado: '+String(e.message||e))}
 finally{btn.disabled=false}
};
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
setInterval(()=>{if(!document.hidden&&localStorage.getItem('lebrime_token_v1'))refresh()},60000);
setTimeout(refresh,800);
globalThis.LebrimeServerQueue={refresh,getSnapshot:()=>lastStatus};
})();