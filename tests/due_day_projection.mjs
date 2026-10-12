import assert from 'node:assert/strict';
import {projectedMonthlyDates,explicitDueDay} from '../scripts/due_day_projection.mjs';
assert.equal(explicitDueDay(['Pagamento\nVencimento: 5\nParcela']),5);
assert.equal(explicitDueDay(['Pagamento\nVencimento: 29 Preço Total']),29);
assert.equal(explicitDueDay(['Vencimento: 05/10/2026']),null,'Datas completas não são dia isolado');
assert.equal(explicitDueDay(['Vencimento: 05\nVencimento: 15']),null,'Dias contraditórios');
assert.deepEqual(projectedMonthlyDates({dueDay:5,installmentCount:6,issueDate:'2026-10-01',startDate:'2026-10-10'}),
 ['2026-10-05','2026-11-05','2026-12-05','2027-01-05','2027-02-05','2027-03-05']);
assert.deepEqual(projectedMonthlyDates({dueDay:5,installmentCount:2,startDate:'2026-10-10'}),
 ['2026-11-05','2026-12-05']);
assert.deepEqual(projectedMonthlyDates({dueDay:31,installmentCount:4,startDate:'2027-01-10'}),
 ['2027-01-31','2027-02-28','2027-03-31','2027-04-30']);
assert.deepEqual(projectedMonthlyDates({dueDay:31,installmentCount:2,startDate:'2028-02-01'}),
 ['2028-02-29','2028-03-31']);
assert.deepEqual(projectedMonthlyDates({dueDay:0,installmentCount:6,startDate:'2026-10-01'}),[]);
assert.deepEqual(projectedMonthlyDates({dueDay:12,installmentCount:0,startDate:'2026-10-01'}),[]);
assert.deepEqual(projectedMonthlyDates({dueDay:12,installmentCount:2,startDate:'2026-13-01'}),[]);
console.log('PASS: dia 5/29/31, virada do ano, ano bissexto, referência de emissão e divergências');
