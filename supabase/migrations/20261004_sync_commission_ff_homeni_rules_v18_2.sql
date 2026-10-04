-- v18.2 — regras de comissão FF Apolinário / Homeni
-- Comissão bruta = prêmio líquido × % da proposta/apólice.
-- FF Apolinário/Homeni: Taxa FF = 30% da comissão bruta.
-- Leandro: recebe 100% do valor após Taxa FF; Taxa Lebrime = 0%.
-- Demais produtores: recebem 60% do valor após Taxa FF; Taxa Lebrime = 40% do restante.

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
  v_existing_id text;
  v_existing_data jsonb;
  v_rule text;
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
    v_producer_percent := 100;
    v_lebrime_percent := 0;
  else
    v_producer_percent := 60;
    v_lebrime_percent := 40;
  end if;

  v_producer_expected := round(v_after_ff::numeric * v_producer_percent / 100)::bigint;
  v_lebrime_fee := greatest(0,v_after_ff-v_producer_expected);

  v_rule := case
    when v_ff_percent=30 and lower(coalesce(v_producer_name,''))='leandro'
      then 'FF Apolinário/Homeni: Taxa FF = 30% da comissão bruta. LEANDRO recebe 100% dos 70% restantes; Taxa Lebrime = 0%.'
    when v_ff_percent=30
      then 'FF Apolinário/Homeni: Taxa FF = 30% da comissão bruta. Dos 70% restantes, produtor recebe 60% e Taxa Lebrime fica com 40%.'
    when lower(coalesce(v_producer_name,''))='leandro'
      then 'Sem Taxa FF. LEANDRO recebe 100% da comissão bruta; Taxa Lebrime = 0%.'
    else
      'Sem Taxa FF. Produtor recebe 60% da comissão bruta; Taxa Lebrime fica com 40%.'
  end;

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
        'calculationRule','Comissão bruta = prêmio líquido × percentual da proposta/apólice.',
        'businessRule',v_rule,
        'status',coalesce(v_existing_data->>'status','Prevista')
      )
    ) - 'transferExpected' - 'transferPercent' - 'producerRule',
    version=version+1,
    updated_at=now()
    where id=v_existing_id;
  else
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
        'received',0,
        'transferPaid',0,
        'status','Prevista',
        'calculationRule','Comissão bruta = prêmio líquido × percentual da proposta/apólice.',
        'businessRule',v_rule
      ),
      1,now(),now()
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_commission_from_insurance on public.records;
create trigger trg_sync_commission_from_insurance
after insert or update of data,kind on public.records
for each row execute function public.sync_commission_from_insurance();
