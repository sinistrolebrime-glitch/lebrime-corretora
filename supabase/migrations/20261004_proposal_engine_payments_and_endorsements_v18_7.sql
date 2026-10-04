-- v18.7 — proposta como origem das parcelas e endosso vinculado ao contrato.
-- Uma proposta/apólice com plano de parcelas estruturado sincroniza automaticamente a Central de Parcelas.
-- Parcelas de proposta são "Previsão da proposta" e não entram em cobrança real.
-- Endosso nunca cria novo contrato; deve ser documento/evento de uma proposta/apólice existente.

CREATE OR REPLACE FUNCTION public.sync_payments_from_insurance()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_plan jsonb;
  v_total integer := 0;
  v_idx integer := 0;
  v_item jsonb;
  v_existing_id text;
  v_existing_data jsonb;
  v_amount bigint := 0;
  v_accum bigint := 0;
  v_premium bigint := 0;
  v_standard bigint := 0;
  v_first bigint := 0;
  v_due text := '';
  v_due_text text := '';
  v_method text := '';
  v_tracking text := '';
  v_migration text := '';
  v_status text := 'Em aberto';
  v_paid_date text := '';
  v_collection text := '';
  v_note text := '';
  v_first_due text := '';
begin
  if new.kind not in ('proposal','policy') then
    return new;
  end if;

  v_plan := new.data->'installmentPlan';
  v_premium := coalesce(nullif(new.data->>'premium','')::bigint,0);
  v_standard := coalesce(nullif(new.data->>'installmentAmount','')::bigint,0);
  v_first := coalesce(nullif(new.data->>'firstInstallmentAmount','')::bigint,0);
  v_first_due := coalesce(new.data->>'firstDueDate','');
  v_method := coalesce(new.data->>'paymentMethod','');
  v_due_text := coalesce(new.data->>'paymentDueText','');

  if v_plan is not null and jsonb_typeof(v_plan)='array' and jsonb_array_length(v_plan)>0 then
    v_total := jsonb_array_length(v_plan);
  else
    v_total := coalesce(nullif(new.data->>'installmentCount','')::integer,0);
  end if;

  if v_total <= 0 then
    return new;
  end if;

  for v_idx in 1..v_total loop
    if v_plan is not null and jsonb_typeof(v_plan)='array' and jsonb_array_length(v_plan)>=v_idx then
      v_item := v_plan -> (v_idx-1);
      v_amount := coalesce(nullif(v_item->>'amount','')::bigint,0);
      v_due := coalesce(v_item->>'due','');
      v_due_text := coalesce(nullif(v_item->>'dueText',''),new.data->>'paymentDueText','');
      v_method := coalesce(nullif(v_item->>'paymentMethod',''),new.data->>'paymentMethod','');
    else
      v_item := '{}'::jsonb;
      if v_idx=1 and v_first>0 then
        v_amount := v_first;
      elsif v_idx<v_total and v_standard>0 then
        v_amount := v_standard;
      elsif v_idx=v_total and v_premium>0 then
        v_amount := greatest(0,v_premium-v_accum);
      elsif v_premium>0 then
        v_amount := round(v_premium::numeric/v_total)::bigint;
      else
        v_amount := v_standard;
      end if;

      if v_first_due<>'' then
        v_due := to_char((v_first_due::date + make_interval(months => v_idx-1))::date,'YYYY-MM-DD');
      else
        v_due := '';
      end if;
    end if;

    v_accum := v_accum + v_amount;

    select r.id,r.data into v_existing_id,v_existing_data
    from public.records r
    where r.kind='payment'
      and (
        (new.kind='proposal' and r.data->>'proposalId'=new.id)
        or
        (new.kind='policy' and r.data->>'policyId'=new.id)
      )
      and coalesce(
            nullif(r.data->>'installmentNo',''),
            split_part(coalesce(r.data->>'installment',''),'/',1)
          )=v_idx::text
    order by r.created_at
    limit 1;

    v_tracking := case when new.kind='proposal' then 'Previsão da proposta' else 'Acompanhamento financeiro' end;
    v_migration := case when new.kind='proposal' then '' else 'Acompanhar' end;
    v_status := coalesce(v_existing_data->>'status','Em aberto');
    v_paid_date := coalesce(v_existing_data->>'paidDate','');
    v_collection := coalesce(v_existing_data->>'collectionStatus','Não iniciado');
    v_note := coalesce(v_existing_data->>'notes','');

    if new.kind='proposal' then
      v_collection := 'Não cobrar';
      if v_note='' then v_note := 'Gerada automaticamente a partir da proposta.'; end if;
    else
      if v_due<>'' and left(v_due,7)<'2026-10' and v_status='Em aberto' then
        v_status := 'Pago';
        v_migration := 'Paga — Migração';
        if v_paid_date='' then v_paid_date := v_due; end if;
      end if;
      if v_note='' then v_note := 'Gerada automaticamente a partir da apólice.'; end if;
    end if;

    if v_existing_id is not null then
      update public.records
      set data = v_existing_data || jsonb_build_object(
        'clientId',coalesce(new.data->>'clientId',''),
        'policyId',case when new.kind='policy' then new.id else '' end,
        'proposalId',case when new.kind='proposal' then new.id else '' end,
        'installment',v_idx::text||'/'||v_total::text,
        'installmentNo',v_idx,
        'installmentCount',v_total,
        'amount',v_amount,
        'due',v_due,
        'dueText',v_due_text,
        'status',v_status,
        'paidDate',v_paid_date,
        'paymentMethod',v_method,
        'collectionStatus',v_collection,
        'financialTracking',v_tracking,
        'migrationStatus',v_migration,
        'autoGenerated',true,
        'sourceInsuranceKind',new.kind,
        'notes',v_note
      ),
      version=version+1,
      updated_at=now()
      where id=v_existing_id;
    else
      insert into public.records(id,kind,data,version,created_at,updated_at)
      values(
        gen_random_uuid()::text,
        'payment',
        jsonb_build_object(
          'clientId',coalesce(new.data->>'clientId',''),
          'policyId',case when new.kind='policy' then new.id else '' end,
          'proposalId',case when new.kind='proposal' then new.id else '' end,
          'installment',v_idx::text||'/'||v_total::text,
          'installmentNo',v_idx,
          'installmentCount',v_total,
          'amount',v_amount,
          'due',v_due,
          'dueText',v_due_text,
          'status',v_status,
          'paidDate',v_paid_date,
          'paymentMethod',v_method,
          'collectionStatus',v_collection,
          'financialTracking',v_tracking,
          'migrationStatus',v_migration,
          'autoGenerated',true,
          'sourceInsuranceKind',new.kind,
          'notes',v_note
        ),
        1,now(),now()
      );
    end if;

    v_existing_id := null;
    v_existing_data := null;
  end loop;

  update public.records r
  set data = jsonb_set(r.data,'{status}',to_jsonb('Cancelado'::text),true)
             || jsonb_build_object('notes','Parcela excedente cancelada após atualização do plano do contrato.'),
      version=version+1,
      updated_at=now()
  where r.kind='payment'
    and coalesce((r.data->>'autoGenerated')::boolean,false)=true
    and coalesce(r.data->>'status','')<>'Pago'
    and (
      (new.kind='proposal' and r.data->>'proposalId'=new.id)
      or
      (new.kind='policy' and r.data->>'policyId'=new.id)
    )
    and coalesce(nullif(r.data->>'installmentNo','')::integer,0)>v_total;

  return new;
end;
$function$
;

drop trigger if exists trg_sync_payments_from_insurance on public.records;
create trigger trg_sync_payments_from_insurance
after insert or update of data,kind on public.records
for each row execute function public.sync_payments_from_insurance();

CREATE OR REPLACE FUNCTION public.prevent_endorsement_as_contract()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if new.kind in ('proposal','policy')
     and lower(coalesce(new.data->>'policyType',''))='endosso' then
    raise exception 'Endosso deve ser vinculado como documento/evento a uma proposta ou apólice existente; não pode criar um novo contrato.';
  end if;
  return new;
end;
$function$
;

drop trigger if exists trg_prevent_endorsement_as_contract on public.records;
create trigger trg_prevent_endorsement_as_contract
before insert or update of data,kind on public.records
for each row execute function public.prevent_endorsement_as_contract();
