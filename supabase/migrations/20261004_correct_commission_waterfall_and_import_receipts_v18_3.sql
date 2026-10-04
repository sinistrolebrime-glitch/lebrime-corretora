-- v18.3 — regra final de comissões e proposta importada.
-- Comissão bruta = prêmio líquido × % da proposta/apólice.
-- Lebrime: produtor comum 60%, Taxa Lebrime 40%, sem Taxa FF.
-- FF Apolinário/Homeni: produtor comum continua com 60% da comissão bruta;
-- Taxa Lebrime = 40%, Taxa FF = 30% (custo da Lebrime), líquido Lebrime = 10%.
-- Leandro: Lebrime direta = 100%; FF/Homeni = 70% e Taxa FF = 30%.
-- Proposta importada = comissão recebida; não marca pagamento ao produtor.

create or replace function public.sync_commission_from_insurance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_net_premium bigint;
  v_commission_percent numeric;
  v_producer_id text;
  v_producer_name text;
  v_brokerages text;
  v_gross bigint;
  v_ff_percent integer;
  v_ff_fee bigint;
  v_after_ff bigint;
  v_producer_percent integer;
  v_producer_expected bigint;
  v_lebrime_percent integer;
  v_lebrime_fee bigint;
  v_lebrime_net bigint;
  v_existing_id text;
  v_existing_data jsonb;
  v_rule text;
  v_is_imported boolean := false;
  v_import_date text := '';
  v_received bigint := 0;
  v_received_date text := '';
  v_received_source text := '';
  v_status text := 'Prevista';
begin
  if new.kind not in ('proposal','policy') then return new; end if;

  v_net_premium := coalesce(nullif(new.data->>'netPremium','')::bigint,0);
  v_commission_percent := coalesce(nullif(new.data->>'commissionPercent','')::numeric,0);
  v_producer_id := nullif(new.data->>'producerId','');

  if v_net_premium <= 0 or v_commission_percent <= 0 or v_producer_id is null then
    return new;
  end if;

  select r.data->>'name' into v_producer_name
  from public.records r
  where r.id=v_producer_id and r.kind='producer'
  limit 1;

  v_brokerages := lower(coalesce(new.data->>'brokerages',new.data->>'brokerage',''));
  v_gross := round(v_net_premium::numeric * v_commission_percent / 100)::bigint;

  v_ff_percent := case
    when v_brokerages like '%homeni%' or v_brokerages like '%ff apolin%' then 30
    else 0
  end;

  v_ff_fee := round(v_gross::numeric * v_ff_percent / 100)::bigint;
  v_after_ff := greatest(0,v_gross-v_ff_fee);

  if lower(coalesce(v_producer_name,''))='leandro' then
    v_producer_percent := 100-v_ff_percent;
    v_producer_expected := v_after_ff;
    v_lebrime_percent := 0;
    v_lebrime_fee := 0;
    v_lebrime_net := 0;
  else
    v_producer_percent := 60;
    v_producer_expected := round(v_gross::numeric * 0.60)::bigint;
    v_lebrime_percent := 40;
    v_lebrime_fee := round(v_gross::numeric * 0.40)::bigint;
    v_lebrime_net := greatest(0,v_lebrime_fee-v_ff_fee);
  end if;

  v_rule := case
    when v_ff_percent=30 and lower(coalesce(v_producer_name,''))='leandro'
      then 'FF Apolinário/Homeni: Taxa FF = 30% da comissão bruta e é suportada pela Lebrime. LEANDRO recebe 70% da comissão bruta; Taxa Lebrime = 0%.'
    when v_ff_percent=30
      then 'FF Apolinário/Homeni: produtor recebe 60% da comissão bruta. Taxa Lebrime = 40% da comissão bruta. Taxa FF = 30% da comissão bruta, descontada da parte da Lebrime; líquido Lebrime = 10%.'
    when lower(coalesce(v_producer_name,''))='leandro'
      then 'Corretora Lebrime: sem Taxa FF. LEANDRO recebe 100% da comissão bruta; Taxa Lebrime = 0%.'
    else
      'Corretora Lebrime: sem Taxa FF. Produtor recebe 60% da comissão bruta; Taxa Lebrime = 40% da comissão bruta.'
  end;

  if new.kind='proposal' then
    select true,to_char((d.created_at at time zone 'America/Fortaleza')::date,'YYYY-MM-DD')
      into v_is_imported,v_import_date
    from public.records d
    where d.kind='document'
      and d.data->>'proposalId'=new.id
      and coalesce(d.data->>'storageKey','')<>''
      and lower(coalesce(d.data->>'documentType','')) like '%proposta%'
    order by d.created_at
    limit 1;
  end if;

  select c.id,c.data into v_existing_id,v_existing_data
  from public.records c
  where c.kind='commission'
    and (
      (new.kind='policy' and c.data->>'policyId'=new.id)
      or
      (new.kind='proposal' and c.data->>'proposalId'=new.id)
    )
  order by c.created_at
  limit 1;

  if v_existing_id is not null then
    if v_is_imported then
      v_received := v_after_ff;
      v_received_date := coalesce(nullif(v_import_date,''),to_char(current_date,'YYYY-MM-DD'));
      v_received_source := 'Importação da proposta';
      v_status := 'Recebida';
    else
      v_received := coalesce(nullif(v_existing_data->>'received','')::bigint,0);
      v_received_date := coalesce(v_existing_data->>'receivedDate','');
      v_received_source := coalesce(v_existing_data->>'receivedSource','');
      v_status := coalesce(v_existing_data->>'status','Prevista');
    end if;

    update public.records
    set data = (
      v_existing_data ||
      jsonb_build_object(
        'clientId',coalesce(new.data->>'clientId',''),
        'policyId',case when new.kind='policy' then new.id else '' end,
        'proposalId',case when new.kind='proposal' then new.id else '' end,
        'producerId',v_producer_id,
        'netPremium',v_net_premium,
        'commissionPercent',v_commission_percent,
        'expected',v_gross,
        'ffPercent',v_ff_percent,
        'ffFee',v_ff_fee,
        'afterFf',v_after_ff,
        'producerPercent',v_producer_percent,
        'producerExpected',v_producer_expected,
        'lebrimePercent',v_lebrime_percent,
        'lebrimeFee',v_lebrime_fee,
        'lebrimeNet',v_lebrime_net,
        'received',v_received,
        'receivedDate',v_received_date,
        'receivedSource',v_received_source,
        'status',v_status,
        'calculationRule','Comissão bruta = prêmio líquido × percentual da proposta/apólice.',
        'businessRule',v_rule
      )
    ) - 'transferExpected' - 'transferPercent' - 'producerRule',
    version=version+1,
    updated_at=now()
    where id=v_existing_id;
  else
    if v_is_imported then
      v_received := v_after_ff;
      v_received_date := coalesce(nullif(v_import_date,''),to_char(current_date,'YYYY-MM-DD'));
      v_received_source := 'Importação da proposta';
      v_status := 'Recebida';
    end if;

    insert into public.records(id,kind,data,version,created_at,updated_at)
    values(
      gen_random_uuid()::text,
      'commission',
      jsonb_build_object(
        'clientId',coalesce(new.data->>'clientId',''),
        'policyId',case when new.kind='policy' then new.id else '' end,
        'proposalId',case when new.kind='proposal' then new.id else '' end,
        'producerId',v_producer_id,
        'netPremium',v_net_premium,
        'commissionPercent',v_commission_percent,
        'expected',v_gross,
        'ffPercent',v_ff_percent,
        'ffFee',v_ff_fee,
        'afterFf',v_after_ff,
        'producerPercent',v_producer_percent,
        'producerExpected',v_producer_expected,
        'lebrimePercent',v_lebrime_percent,
        'lebrimeFee',v_lebrime_fee,
        'lebrimeNet',v_lebrime_net,
        'received',v_received,
        'receivedDate',v_received_date,
        'receivedSource',v_received_source,
        'transferPaid',0,
        'status',v_status,
        'calculationRule','Comissão bruta = prêmio líquido × percentual da proposta/apólice.',
        'businessRule',v_rule
      ),
      1,now(),now()
    );
  end if;

  return new;
end;
$$;

create or replace function public.sync_imported_proposal_commission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proposal_id text;
begin
  if new.kind<>'document' then return new; end if;

  v_proposal_id := nullif(new.data->>'proposalId','');
  if v_proposal_id is null
     or coalesce(new.data->>'storageKey','')=''
     or lower(coalesce(new.data->>'documentType','')) not like '%proposta%'
  then return new;
  end if;

  update public.records set data=data
  where id=v_proposal_id and kind='proposal';

  return new;
end;
$$;

drop trigger if exists trg_sync_commission_from_insurance on public.records;
create trigger trg_sync_commission_from_insurance
after insert or update of data,kind on public.records
for each row execute function public.sync_commission_from_insurance();

drop trigger if exists trg_sync_imported_proposal_commission on public.records;
create trigger trg_sync_imported_proposal_commission
after insert or update of data,kind on public.records
for each row execute function public.sync_imported_proposal_commission();
