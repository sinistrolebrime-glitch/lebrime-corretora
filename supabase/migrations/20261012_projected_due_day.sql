-- LEBRIME: Vencimento calculado por dia visível no PDF não é vencimento confirmado.
-- Registro complementar separado de due; mantém todas as proteções de cobrança.
CREATE OR REPLACE FUNCTION public.sync_projected_due_day_from_plan()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_plan jsonb;
  v_item jsonb;
  v_idx integer;
  v_date text;
BEGIN
  IF new.kind NOT IN ('proposal','policy') THEN RETURN new; END IF;
  v_plan := new.data->'installmentPlan';
  IF jsonb_typeof(v_plan) IS DISTINCT FROM 'array' THEN RETURN new; END IF;
  FOR v_idx IN 1..jsonb_array_length(v_plan) LOOP
    v_item := v_plan->(v_idx-1);
    v_date := coalesce(v_item->>'estimatedDue','');
    IF v_date !~ '^\d{4}-\d{2}-\d{2}$'
      OR coalesce(v_item->>'due','') <> ''
      OR coalesce(v_item->>'dueEvidence','') <> 'Dia de vencimento no PDF; mês/ano projetados'
    THEN CONTINUE; END IF;
    IF to_char(to_date(v_date,'YYYY-MM-DD'),'YYYY-MM-DD') IS DISTINCT FROM v_date
    THEN CONTINUE; END IF;
    UPDATE public.records AS payment
    SET data = payment.data || jsonb_build_object(
       'estimatedDue',v_date,
       'dueDay',v_item->>'dueDay',
       'dueDateSource','projected_pdf_day',
       'dueEvidence','Dia informado no PDF; mês/ano projetados a partir da referência',
       'dueDateVerified',false
    ),
    version=payment.version+1,updated_at=now()
    WHERE payment.kind='payment'
      AND ((new.kind='proposal' AND payment.data->>'proposalId'=new.id)
        OR (new.kind='policy' AND payment.data->>'policyId'=new.id))
      AND coalesce(payment.data->>'installmentNo',split_part(coalesce(payment.data->>'installment',''),'/',1))=v_idx::text
      AND coalesce(payment.data->>'due','')=''
      AND coalesce(payment.data->>'status','')='Em aberto'
      AND coalesce(payment.data->>'collectionStatus','')='Não cobrar'
      AND (coalesce(payment.data->>'estimatedDue','')<>v_date
        OR coalesce(payment.data->>'dueDateSource','')<>'projected_pdf_day');
  END LOOP;
  RETURN new;
END;
$function$;
DROP TRIGGER IF EXISTS trg_zz_sync_projected_due_day ON public.records;
CREATE TRIGGER trg_zz_sync_projected_due_day
AFTER INSERT OR UPDATE OF data, kind ON public.records
FOR EACH ROW EXECUTE FUNCTION public.sync_projected_due_day_from_plan();
