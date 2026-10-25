/* Regra permanente LEBRIME: diferença financeira até R$ 10,00 INCLUSIVE.
 * Valores expressos exclusivamente em centavos inteiros. Não alterar dados documentais.
 */
(function(global){
  'use strict';
  const MAX_DIFFERENCE_CENTS=1000;
  const valid=n=>Number.isSafeInteger(n)&&n>=0;
  function compare(expectedCents,actualCents){
    const expected=Number(expectedCents),actual=Number(actualCents);
    if(!valid(expected)||!valid(actual)){
      return {status:'dados insuficientes',accepted:null,deltaCents:null,absDifferenceCents:null,
        toleranceCents:MAX_DIFFERENCE_CENTS,reviewRequired:true};
    }
    const delta=actual-expected;
    if(!Number.isSafeInteger(delta))return {status:'dados insuficientes',accepted:null,
      deltaCents:null,absDifferenceCents:null,toleranceCents:MAX_DIFFERENCE_CENTS,reviewRequired:true};
    const abs=Math.abs(delta),accepted=abs<=MAX_DIFFERENCE_CENTS;
    return {status:abs===0?'conciliado':accepted?'diferença tolerada':'revisão necessária',
      accepted,deltaCents:delta,absDifferenceCents:abs,
      toleranceCents:MAX_DIFFERENCE_CENTS,reviewRequired:!accepted};
  }
  const parts=(expectedCents,values)=>{
    if(!Array.isArray(values)||!values.length||values.some(x=>!valid(Number(x))))
      return compare(expectedCents,NaN);
    const sum=values.reduce((acc,x)=>acc+Number(x),0);
    return compare(expectedCents,sum);
  };
  global.LebrimeFinancialTolerance=Object.freeze({MAX_DIFFERENCE_CENTS,compare,parts});
})(globalThis);
