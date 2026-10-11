import assert from "node:assert/strict";
import {previewProposalFromPages,previewHelpers} from "../supabase/functions/lebrime-api/proposal_preview.mjs";
const fixture=[
"PROPOSTA DE SEGURO\nSegurado: ANA MARIA PEREIRA\nCPF/CNPJ: 123.456.789-01\n"+
"Seguradora: Porto Seguro\nRamo: Automóvel\nNúmero da Proposta: 12345678\n"+
"Vigência: 11/10/2026 a 11/10/2027\nPrêmio Total: R$ 2.340,54\n"+
"Valor Segurado: R$ 87.000,00\nPlano de Pagamento\n"+
"1/2 20/10/2026 R$ 1.170,27\n2/2 20/11/2026 R$ 1.170,27"
];
const result=previewProposalFromPages(fixture);
const f=result.fields;
assert.equal(f.insuredDocument.value,"12345678901");
assert.equal(f.insuredName.value,"ANA MARIA PEREIRA");
assert.equal(f.insurer.value,"Porto Seguro");
assert.equal(f.branch.value,"Automóvel");
assert.equal(f.number.value,"12345678");
assert.equal(f.start.value,"2026-10-11");
assert.equal(f.end.value,"2027-10-11");
assert.equal(f.premium.value,234054);
assert.equal(f.insuredValue.value,8700000);
assert.equal(f.premium.page,1);
assert.match(f.premium.evidence,/Prêmio Total/);
assert.equal(previewHelpers.isoDate("29/02/2028"),"2028-02-29");
assert.equal(previewHelpers.isoDate("29/02/2027"),"");
assert.equal(previewHelpers.asCents("2.340,54"),234054);
const confusing=previewProposalFromPages([
"Prêmio Total: R$ 10.000,00\nPrêmio Total: R$ 9.500,00\n"+
"Valor Segurado: 100% FIPE\nLMI: R$ 100.000,00\nLMI: R$ 50.000,00"
]);
assert.equal(confusing.fields.premium,null);
assert.equal(confusing.fields.insuredValue,null);
assert.ok(confusing.warnings.some(x=>x.includes("Prêmio total")));
const scanned=previewProposalFromPages(["",""]);
assert.equal(scanned.recognized,0);
assert.ok(scanned.warnings.some(x=>x.includes("digitalizado")));
const invalidPeriod=previewProposalFromPages(["Vigência: 31/12/2027 a 01/01/2026"]);
assert.equal(invalidPeriod.fields.start,null);
assert.equal(invalidPeriod.fields.end,null);
console.log("PASS: prévia com evidência, datas válidas, prêmio em centavos, ambiguidades e PDFs sem texto");