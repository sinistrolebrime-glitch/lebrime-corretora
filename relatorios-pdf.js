/* LEBRIME — identidade institucional nos relatórios exportados em PDF.
 * Imprimir / Salvar como PDF utiliza o diálogo nativo do navegador.
 * A logomarca vetorial transparente vive no próprio repositório.
 */
(()=>{
 'use strict';
 const esc=value=>String(value??'').replace(/[&<>"']/g,
   character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
 const REPORT_LOGO=new URL('assets/logo-lebrime-transparente.svg',document.baseURI).href;
 const issueDate=()=>new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date());
 const render=({title,subtitle='',period='',columns=[],rows=[],summary=[],note=''})=>{
   const head=columns.map(h=>'<th scope="col">'+esc(h)+'</th>').join('');
   const body=rows.length?rows.map((cells,i)=>'<tr>'+columns.map((_,j)=>
     '<td class="'+(j===0?'primary':'')+'">'+esc((cells||[])[j]??'—')+'</td>').join('')+'</tr>').join(''):
     '<tr><td colspan="'+columns.length+'" class="empty">Nenhum registro para os filtros selecionados.</td></tr>';
   const metrics=summary.length?'<section class="totals" aria-label="Resumo do relatório">'+summary.map(item=>
     '<div class="metric"><span>'+esc(item.label)+'</span><strong>'+esc(item.value)+'</strong></div>').join('')+'</section>':'';
   const noteText=note?'<div class="report-note">'+esc(note)+'</div>':'';
   const issued=issueDate();
   return `<!doctype html><html lang="pt-BR"><head>
   <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
   <title>LEBRIME — ${esc(title)}</title>
   <style>
    :root{color-scheme:light}
    *{box-sizing:border-box}
    html,body{margin:0;padding:0;background:#fff;color:#172438}
    body{font:10pt "Segoe UI",Arial,sans-serif;padding:13mm 12mm 12mm;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    /* Watermark is a real transparent SVG element, not a print-background image.
       Fixed positioning repeats the emblem on every page in Chromium print/PDF. */
    .report-watermark{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
      width:198mm;height:198mm;opacity:.18;pointer-events:none;z-index:0}
    .report-watermark img{display:block;width:100%;height:100%;object-fit:contain;background:transparent}
    .report-header,main,footer{position:relative;z-index:1}
    .report-header{display:flex;align-items:center;justify-content:space-between;gap:16px;border-bottom:2px solid #CE9900;padding-bottom:12px}
    .identity{display:flex;align-items:center;gap:13px;min-width:0}
    .identity img{display:block;width:65px;height:60px;object-fit:contain;flex:none;background:transparent}
    .company{font-size:12pt;letter-spacing:.105em;font-weight:800;color:#1f2a38}
    .company-caption{font-size:8pt;color:#6e7480;margin-top:4px;letter-spacing:.09em;text-transform:uppercase}
    .issued{min-width:160px;text-align:right;font-size:8pt;color:#5d6977;line-height:1.7}
    .issued strong{display:block;color:#2d3949;font-size:9pt}
    h1{font-size:19pt;font-weight:750;margin:16px 0 5px;color:#1d2b3b;letter-spacing:-.02em}
    .subhead{color:#586879;font-size:9pt;margin:0 0 5px}
    .period{margin:6px 0 17px;font-size:9pt;color:#42536b}
    .period strong{color:#232c3c}
    .totals{display:flex;flex-wrap:wrap;gap:8px;margin:13px 0 14px}
    .metric{background:#f7f5f0;border:1px solid #e9dfc9;border-radius:5px;padding:9px 13px;min-width:135px}
    .metric span{display:block;color:#626b76;font-size:7.5pt}
    .metric strong{display:block;margin-top:3px;color:#253343;font-size:11pt}
    table{border-collapse:collapse;width:100%;table-layout:auto;margin-top:14px;font-size:8pt}
    thead{display:table-header-group}tfoot{display:table-footer-group}
    th{background:#253142;color:#fff;font-weight:700;font-size:7.5pt;text-align:left;padding:8px 7px;border:1px solid #253142;white-space:normal}
    td{border-bottom:1px solid #e2e6ea;padding:7px;vertical-align:top;word-break:break-word;overflow-wrap:anywhere}
    tr:nth-child(even) td{background:#f7f8fa}
    tr{break-inside:avoid;page-break-inside:avoid}
    td.primary{font-weight:700;color:#223147}
    .report-note{margin-top:13px;padding:10px 12px;color:#646e78;background:#fbfaf7;border-left:3px solid #CE9900;font-size:8pt}
    footer{margin-top:22px;border-top:1px solid #e1e4e8;padding-top:9px;display:flex;justify-content:space-between;gap:12px;color:#687381;font-size:7.5pt}
    .empty{text-align:center;color:#626b76;padding:22px}
    .screen-hint{position:fixed;right:10px;bottom:10px;font:12px Arial;background:#fff;border:1px solid #d7dce3;padding:9px 12px;border-radius:6px;color:#2c3a4c;box-shadow:0 3px 12px #0002}
    @page{size:A4 landscape;margin:11mm}
    @media print{body{padding:0}.report-header{padding-top:0}.screen-hint{display:none}.metric{break-inside:avoid}}
   </style></head><body>
   <div class="report-watermark" aria-hidden="true">
     <img class="report-brand-image" src="${esc(REPORT_LOGO)}" alt="" width="490" height="490">
   </div>
   <header class="report-header">
    <div class="identity"><img class="report-brand-image" src="${esc(REPORT_LOGO)}" alt="Logo Lebrime" width="65" height="60">
     <div><div class="company">LEBRIME CORRETORA DE SEGUROS</div>
       <div class="company-caption">Gestão de carteira e relatórios</div></div>
    </div>
    <div class="issued"><span>Emitido em</span><strong>${esc(issued)}</strong><span>Relatório institucional</span></div>
   </header>
   <main><h1>${esc(title)}</h1>
    ${subtitle?'<p class="subhead">'+esc(subtitle)+'</p>':''}
    <div class="period"><strong>Referência:</strong> ${esc(period||'Todos os registros filtrados')} &nbsp;·&nbsp; <strong>${rows.length}</strong> registro(s)</div>
    ${metrics}
    <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
    ${noteText}
   </main>
   <footer><span>LEBRIME CORRETORA DE SEGUROS · Documento gerado pelo portal</span>
    <span>${esc(title)} · ${esc(issued)}</span></footer>
   <div class="screen-hint">Selecione <strong>Salvar como PDF</strong> na janela de impressão.</div>
   </body></html>`;
 };
 const waitImage=img=>new Promise(resolve=>{
   if(img.complete){resolve(img.naturalWidth>0);return}
   const timeout=setTimeout(()=>resolve(false),8000);
   img.addEventListener('load',()=>{clearTimeout(timeout);resolve(true)},{once:true});
   img.addEventListener('error',()=>{clearTimeout(timeout);resolve(false)},{once:true});
 });
 const open=options=>{
   if(!Array.isArray(options?.columns)||!options.columns.length)throw new Error('Informe colunas do relatório.');
   const win=options?.targetWindow && !options.targetWindow.closed ? options.targetWindow : window.open('','_blank');
   if(!win){alert('Permita janelas pop-up para gerar o PDF do relatório.');return false}
   const html=render(options);
   win.document.open();win.document.write(html);win.document.close();
   (async()=>{
     const imgs=Array.from(win.document.querySelectorAll('.report-brand-image'));
     const loaded=imgs.length===2 && (await Promise.all(imgs.map(waitImage))).every(Boolean);
     if(!loaded){
       // Não imprimir silenciosamente sem a identidade institucional.
       const hint=win.document.querySelector('.screen-hint');
       if(hint)hint.textContent='A logo não foi carregada. Recarregue o relatório antes de salvar o PDF.';
       return;
     }
     try{await win.document.fonts.ready}catch(_){}
     if(!win.closed){win.focus();win.print()}
   })();
   return true;
 };
 globalThis.LebrimeReports=Object.freeze({render,open,logoUrl:REPORT_LOGO});
})();
