
const pickYear=s=>{const z=String(s||'').match(/(?:19|20)\d{2}/g);return z?Number(z[z.length-1]):0};
const tidy=s=>String(s||'').replace(/\s+/g,' ').replace(/^\d{3,7}\s*-\s*-\s*/,'').replace(/^\d{4,7}\s+-\s*/,'').trim().slice(0,120);
const valid=s=>tidy(s).length>=6&&/[a-z]/i.test(s)&&!/^(ve[ií]culo|marca|modelo|produto|dados|cobertura|ano modelo)/i.test(tidy(s));
const brands=/^(TOYOTA|FIAT|FORD|CHEVROLET|JEEP|VOLKSWAGEN|VW|RENAULT|NISSAN|HYUNDAI|HONDA|MITSUBISHI|PEUGEOT|CITROEN|BMW|MERCEDES|AUDI|KIA|BYD|GWM|SCANIA|VOLVO|CHERY|CAOA)\s+[\w]/i;
function extract(doc,rec){
 const s=String(doc||''),ls=s.split(/\r?\n/).map(x=>x.trim()).filter(Boolean),n=String(rec.notes||''),v=String(rec.vehicle||'');
 if(valid(v))return {name:tidy(v),year:pickYear(v),source:'cadastro'};
 const note=n.match(/Ve[ií]culo\s+(.{7,100}?)(?:,\s*placa|\. Anota|\. Renovação|$)/i);
 if(note&&valid(note[1]))return {name:tidy(note[1]),year:pickYear(note[1]),source:'observação'};
 let m=s.match(/Ve[ií]culo:\s*([^\r\n]{8,150}?)\s+Produto:/i);
 if(m)return {name:tidy(m[1]),year:pickYear((s.match(/Ano\s*\/\s*Modelo:\s*([^\r\n]+)/i)||[])[1]),source:'Allianz'};
 m=s.match(/Modelo\s*:\s*(?:\d{5,9}\s*-\s*)?([^\r\n]{7,110})/i);
 if(m&&valid(m[1]))return {name:tidy(m[1]),year:pickYear((s.match(/Ano Fabr\.\/Modelo\s*:\s*([^\r\n]+)/i)||[])[1]),source:'HDI'};
 let p=ls.findIndex(x=>/^Tipo do Ve[ií]culo:/i.test(x));
 if(p>=0){
   let j=ls.findIndex((x,i)=>i>p&&i<p+45&&/^Carroceria:/i.test(x));
   if(j>=0&&valid(ls[j+1]))return {name:tidy((/^[A-Z]{2,18}$/i.test(ls[j+2])?ls[j+2]+' ':'')+ls[j+1]),year:pickYear(ls[j+7]),source:'Bradesco'};
 }
 let az=ls.find(x=>/^\d{3,7}\s*-\s*-\s*[A-ZÀ-Ú].{5,}/i.test(x));
 if(az)return {name:tidy(az),year:pickYear(ls.slice(ls.indexOf(az),ls.indexOf(az)+8).join(' ')),source:'Azul/Porto'};
 let yel=ls.find(x=>/^\d{5,6}-?\d\s+.{6,90}\s+(?:19|20)\d{2}\/(?:19|20)\d{2}$/.test(x));
 if(yel){const z=yel.match(/^\d{5,6}-?\d\s+(.+?)\s+((?:19|20)\d{2}\/(?:19|20)\d{2})$/);if(z)return {name:tidy(z[1]),year:pickYear(z[2]),source:'Yelum'};}
 p=ls.findIndex(x=>/Marca\/Modelo do Ve[ií]culo/i.test(x));
 if(p>=0&&valid(ls[p+1])){const j=ls.findIndex((x,i)=>i>p&&i<p+12&&/Ano Fabr\.\/Modelo/i.test(x));return {name:tidy(ls[p+1]),year:pickYear(ls[j+1]),source:'Suhai'};}
 p=ls.findIndex(x=>/^Marca$/i.test(x));
 if(p>=0&&/^Modelo$/i.test(ls[p+1]||'')){const j=ls.findIndex((x,i)=>i>p&&i<p+12&&/Tipo Franquia Casco/i.test(x));if(j>=0&&valid(ls[j+2]))return {name:tidy(ls[j+1]+' '+ls[j+2]),year:pickYear(ls[j+3]),source:'Ezze'};}
 p=ls.findIndex(x=>/Fabricante Ve[ií]culo/i.test(x));
 if(p>=0){const arr=ls.slice(p,p+46),i=arr.findIndex(x=>brands.test(x)&&!/(SEGURO|SEGURADORA)/i.test(x));if(i>=0)return {name:tidy(arr[i]),year:pickYear(arr[i-1])||pickYear(arr.slice(Math.max(0,i-3),i+2).join(' ')),source:'Tokio'};}
 const c=ls.slice(0,150).filter(x=>brands.test(x)&&!/(SEGURO|SEGURADORA|CORRETOR|AP[ÓO]LICE|ENDERE|CNPJ|CPF)/i.test(x));
 if(c.length){c.sort((a,b)=>(/1\.|2\.|4x4|flex|diesel|turbo|aut/i.test(b)?2:0)-(/1\.|2\.|4x4|flex|diesel|turbo|aut/i.test(a)?2:0));return {name:tidy(c[0]),year:pickYear(c[0]),source:'PDF'};}
 return null;
}
const bases=[['DENZA',450000],['CLA.?45|AMG',530000],['SW4',360000],['HILUX',265000],['RANGER',260000],['S[- ]?10',215000],['FRONTIER',215000],['TRITON|L200',235000],['COROLLA CROSS',180000],['COROLLA',165000],['COMPASS',175000],['RENEGADE',130000],['STRADA',117000],['TORO',183000],['OROCH',125000],['DUSTER',132000],['HB20',101000],['MOBI',80000],['UNO',68000],['ARGO',111000],['GOL',90000],['PALIO',80000],['CELTA',68000],['VOYAGE',94000],['FOX',91000],['FIESTA',94000],['FORD KA|KA SE ',97000],['FIT',115000],['ECOSPORT',133000],['PRISMA',106000],['VERSA',123000],['SENTRA',165000],['LOGAN',94000],['SANDERO',92000],['VIRTUS',105000],['T[- ]?CROSS',145000],['CRETA',153000],['KICKS',137000],['MONTANA',138000],['TRACKER',147000],['ETIOS',90000],['YARIS',110000],['ONIX',105000],['KWID',76000],['TIGGO 8',180000],['POLO',109000],['BIZ',19500],['POP 110',14500],['CG 160',23000],['SAHARA',33500],['NMAX|PCX|FAZER',26000],['HAVAL H6',255000],['SCANIA|IVECO|VOLVO FH|ATEGO',380000],['BMW|AUDI|MERCEDES|PORSCHE',310000],['TOYOTA|CHEVROLET|FIAT|VOLKSWAGEN|JEEP|HYUNDAI|FORD|NISSAN|RENAULT|MITSUBISHI|HONDA|BYD|GWM',135000]];
function estimate(v,branch){
 if(!v||!valid(v.name))return null;
 const name=tidy(v.name),y=v.year>=1980&&v.year<=2027?v.year:2022;
 const model=bases.find(([re])=>new RegExp(re,'i').test(name));
 const moto=/moto/i.test(branch||'')||/\b(BIZ|POP 110|CG 160|PCX|SAHARA|NMAX|FAZER)\b/i.test(name);
 const base=model?model[1]:moto?26000:115000;
 const cents=Math.round(base*Math.pow(.935,Math.max(0,2026-y))/1000)*100000;
 return {name,year:y,base,cents,source:v.source,yearInPDF:!!v.year};
}
const q=s=>"'"+String(s).replaceAll("'","''")+"'";
function toSql(entries){
 let sql='BEGIN;\n';
 for(const e of entries){
  let d;
  if(e.estimate){
   const x=e.estimate;
   d={estimatedInsuredValue:x.cents,valuationStatus:'Estimado',estimatedValueBasis:'ESTIMADO por modelo e ano, referência mercadológica 2026; FIPE exata não verificada',estimatedInsuredValueReference:'Referência de mercado estimada para '+x.name+', ano '+x.year+(x.yearInPDF?'':' adotado por falta de informação')+', base de categoria R$ '+x.base+', depreciação de 6,5% ao ano; extração '+x.source+'. Não é FIPE exata nem limite contratado.',estimatedAt:'2026-10-10',valuationSourceFileId:e.fid};
  }else d={valuationReviewStatus:'PDF sem modelo de veículo legível; avaliação pendente'};
  sql+="UPDATE public.records SET data=data || "+q(JSON.stringify(d))+"::jsonb, version=version+1,updated_at=now() WHERE id="+q(e.id)+" AND kind IN ('proposal','policy') AND COALESCE(data->>'insuredValue','0')='0' AND COALESCE(data->>'estimatedInsuredValue','0')='0' AND COALESCE(data->>'valuationReviewStatus','')='' AND NOT EXISTS(SELECT 1 FROM public.records i WHERE i.kind='insuredItem' AND COALESCE(NULLIF(i.data->>'proposalId',''),NULLIF(i.data->>'policyId',''))=public.records.id);\n";
 }
 return sql+'COMMIT;';
}
return {extract,estimate,toSql};
