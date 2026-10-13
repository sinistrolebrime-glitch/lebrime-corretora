-- LEBRIME: segunda via autenticada de importação assistida, isolada da fila de renovações.
-- Cada arquivo só entra após leitura do PDF, conferência e salvamento privado no Drive.
-- A fila e o processador são reservados a postgres/service_role; não há acesso anon.
CREATE TABLE IF NOT EXISTS public.lebrime_assisted_import_queue(
 id uuid primary key default gen_random_uuid(),
 batch_key text not null default 'pendentes46-out2026' check(batch_key ~ '^[a-zA-Z0-9_-]{8,80}$'),
 request_key text not null unique check(request_key ~ '^[a-zA-Z0-9_-]{8,120}$'),
 fingerprint text not null unique check(fingerprint ~ '^[a-f0-9]{64}$'),
 payload jsonb not null, document_source jsonb not null, actor jsonb not null,
 state text not null default 'queued' check(state in ('queued','processing','retry','review','done')),
 attempts int not null default 0 check(attempts between 0 and 100),
 available_at timestamptz not null default now(),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 processed_at timestamptz,
 contract_id text,client_id text,document_id text,
 last_error text,last_sqlstate text,
 check(jsonb_typeof(payload)='object' and jsonb_typeof(document_source)='object')
);
CREATE INDEX IF NOT EXISTS assisted_queue_schedule_idx ON public.lebrime_assisted_import_queue(state,available_at,created_at);
CREATE INDEX IF NOT EXISTS assisted_queue_batch_idx ON public.lebrime_assisted_import_queue(batch_key,created_at DESC);
ALTER TABLE public.lebrime_assisted_import_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lebrime_assisted_import_queue FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.lebrime_assisted_import_queue TO service_role;

CREATE OR REPLACE FUNCTION public.lebrime_stage_assisted_import(p jsonb,source jsonb,actor jsonb,batch text DEFAULT 'pendentes46-out2026')
RETURNS jsonb LANGUAGE plpgsql SET search_path TO '' AS $fn$
DECLARE
 k text:=coalesce(p->>'requestKey','');
 doc text:=regexp_replace(coalesce(p->>'document',''),'[^0-9]','','g');
 d jsonb:=p->'data';
 number_key text:=upper(regexp_replace(coalesce(d->>'number',''),'[^a-zA-Z0-9]','','g'));
 file_id text:=coalesce(source->>'driveFileId','');
 fp text; job_id uuid; previous public.lebrime_assisted_import_queue%rowtype;
BEGIN
 IF current_user NOT IN ('postgres','service_role') THEN RAISE EXCEPTION 'ASSISTED_ROLE_DENIED' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p) IS DISTINCT FROM 'object' OR jsonb_typeof(d) IS DISTINCT FROM 'object'
 OR jsonb_typeof(source) IS DISTINCT FROM 'object' OR jsonb_typeof(actor) IS DISTINCT FROM 'object'
 OR octet_length(p::text)>64000 OR octet_length(source::text)>4096 THEN
  RAISE EXCEPTION 'ASSISTED_INVALID_MANIFEST'; END IF;
 IF k !~ '^[a-zA-Z0-9_-]{8,120}$' OR batch !~ '^[a-zA-Z0-9_-]{8,80}$'
 OR length(doc) NOT IN (11,14) OR number_key !~ '^[A-Z0-9]{4,60}$'
 OR coalesce(p->>'kind','') NOT IN ('proposal','policy')
 OR length(coalesce(p->'client'->>'name',''))<5
 OR coalesce(d->>'start','') !~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$'
 OR coalesce(d->>'end','') !~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$'
 THEN RAISE EXCEPTION 'ASSISTED_IDENTITY_REQUIRED'; END IF;
 IF file_id !~ '^[a-zA-Z0-9_-]{12,120}$'
 OR coalesce(source->>'fileName','') !~ '^[^/\\]{1,180}[.][Pp][Dd][Ff]$'
 THEN RAISE EXCEPTION 'ASSISTED_PRIVATE_PDF_REQUIRED'; END IF;
 IF coalesce(actor->>'source','') NOT IN ('lebrime-api','authorized-work') OR
 length(coalesce(actor->>'subject',''))<5 THEN RAISE EXCEPTION 'ASSISTED_AUDIT_REQUIRED';END IF;
 fp:=encode(sha256(convert_to(doc||'|'||lower(coalesce(d->>'insurer',''))||'|'||number_key||'|'||
 d->>'start'||'|'||upper(coalesce(d->>'plate',d->>'chassis','')),'UTF8')),'hex');
 INSERT INTO public.lebrime_assisted_import_queue(batch_key,request_key,fingerprint,payload,document_source,actor)
 VALUES(batch,k,fp,p,source,actor) ON CONFLICT DO NOTHING RETURNING id INTO job_id;
 IF job_id IS NULL THEN
  SELECT * INTO previous FROM public.lebrime_assisted_import_queue
   WHERE fingerprint=fp OR request_key=k ORDER BY (fingerprint=fp) DESC LIMIT 1;
  IF NOT FOUND OR previous.fingerprint<>fp THEN RAISE EXCEPTION 'ASSISTED_IDEMPOTENCY_CONFLICT';END IF;
  RETURN jsonb_build_object('ok',true,'duplicate',true,'id',previous.id,'state',previous.state,'contractId',previous.contract_id);
 END IF;
 RETURN jsonb_build_object('ok',true,'duplicate',false,'id',job_id,'state','queued');
END $fn$;

CREATE OR REPLACE FUNCTION public.lebrime_apply_assisted_import(p jsonb,source jsonb,actor jsonb)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO '' AS $fn$
DECLARE
 d jsonb:=p->'data'; c jsonb:=p->'client';
 document_digits text:=regexp_replace(coalesce(p->>'document',''),'[^0-9]','','g');
 client_id text; contract_id text; document_id text;
 n int; payment_count int; commission_count int;blocked_count int;
 amount_sum bigint:=0; item jsonb; extra jsonb;
 premium_cents bigint;net_cents bigint;iof_cents bigint;
 plate text:=upper(regexp_replace(coalesce(d->>'plate',''),'[^A-Za-z0-9]','','g'));
 chassis text:=upper(regexp_replace(coalesce(d->>'chassis',''),'[^A-Za-z0-9]','','g'));
 risk text; ckind text:=p->>'kind'; base_name text;
BEGIN
 IF current_user NOT IN ('postgres','service_role') THEN RAISE EXCEPTION 'ASSISTED_ROLE_DENIED' USING ERRCODE='42501';END IF;
 IF jsonb_typeof(p) IS DISTINCT FROM 'object' OR jsonb_typeof(c) IS DISTINCT FROM 'object' OR
 jsonb_typeof(d) IS DISTINCT FROM 'object' OR jsonb_typeof(source) IS DISTINCT FROM 'object'
 OR octet_length(p::text)>64000 THEN RAISE EXCEPTION 'ASSISTED_INVALID_MANIFEST';END IF;
 IF length(document_digits) NOT IN(11,14) OR coalesce(p->>'requestKey','') !~ '^[a-zA-Z0-9_-]{8,120}$'
 OR ckind NOT IN ('proposal','policy')
 OR length(trim(coalesce(c->>'name','')))<5 OR length(coalesce(d->>'number','')) NOT BETWEEN 4 AND 60
 OR length(coalesce(d->>'insurer','')) NOT BETWEEN 2 AND 100
 OR length(coalesce(d->>'branch','')) NOT BETWEEN 2 AND 100
 OR length(coalesce(d->>'brokerages',d->>'brokerage',''))<2 OR
 coalesce(d->>'producerId','')='' OR
 coalesce(actor->>'source','') NOT IN ('lebrime-api','authorized-work')
 THEN RAISE EXCEPTION 'ASSISTED_MISSING_IDENTITY';END IF;
 IF coalesce(source->>'driveFileId','') !~ '^[A-Za-z0-9_-]{12,120}$'
 OR coalesce(source->>'fileName','') !~ '^[^/\\]{1,180}[.][Pp][Dd][Ff]$'
 THEN RAISE EXCEPTION 'ASSISTED_PDF_SOURCE_INVALID'; END IF;
 IF coalesce(d->>'start','') !~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$'
 OR coalesce(d->>'end','') !~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$' THEN
  RAISE EXCEPTION 'ASSISTED_INVALID_DATES';END IF;
 IF (d->>'end')::date <= (d->>'start')::date THEN RAISE EXCEPTION 'ASSISTED_INVALID_PERIOD';END IF;
 IF coalesce(d->>'premium','') !~ '^[1-9][0-9]{0,10}$'
 OR coalesce(d->>'netPremium','') !~ '^[1-9][0-9]{0,10}$'
 OR coalesce(d->>'iof','') !~ '^[0-9]{1,11}$'
 OR coalesce(d->>'commissionPercent','') !~ '^[0-9]+([.][0-9]+)?$'
 THEN RAISE EXCEPTION 'ASSISTED_INVALID_FINANCIAL_DATA';END IF;
 premium_cents:=(d->>'premium')::bigint;net_cents:=(d->>'netPremium')::bigint;iof_cents:=(d->>'iof')::bigint;
 IF (d->>'commissionPercent')::numeric NOT BETWEEN 0 AND 100
 OR net_cents>premium_cents OR abs(net_cents+iof_cents-premium_cents)>100
 THEN RAISE EXCEPTION 'ASSISTED_PREMIUM_MISMATCH';END IF;
 IF jsonb_typeof(d->'installmentPlan') IS DISTINCT FROM 'array'
 THEN RAISE EXCEPTION 'ASSISTED_INSTALLMENTS_REQUIRED';END IF;
 IF jsonb_array_length(d->'installmentPlan') NOT BETWEEN 1 AND 72
 THEN RAISE EXCEPTION 'ASSISTED_INSTALLMENT_COUNT_INVALID';END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(d->'installmentPlan') LOOP
   IF jsonb_typeof(item) IS DISTINCT FROM 'object'
   OR coalesce(item->>'amount','') !~ '^[1-9][0-9]{0,10}$'
   OR EXISTS(SELECT 1 FROM jsonb_object_keys(item) AS f(key)
     WHERE key NOT IN ('number','amount','due','dueText','paymentMethod'))
   THEN RAISE EXCEPTION 'ASSISTED_INVALID_INSTALLMENT';END IF;
   IF coalesce(item->>'due','')<>'' THEN
     IF item->>'due' !~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$' THEN RAISE EXCEPTION 'ASSISTED_INVALID_DUE';END IF;
     PERFORM (item->>'due')::date;
   END IF;
   amount_sum:=amount_sum+(item->>'amount')::bigint;
 END LOOP;
 IF abs(amount_sum-premium_cents)>100 THEN RAISE EXCEPTION 'ASSISTED_INSTALLMENT_SUM_MISMATCH';END IF;
 IF plate<>'' AND plate !~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$'
 THEN RAISE EXCEPTION 'ASSISTED_INVALID_PLATE';END IF;
 IF chassis<>'' AND chassis !~ '^[A-Z0-9]{17}$'
 THEN RAISE EXCEPTION 'ASSISTED_INVALID_CHASSIS';END IF;
 IF lower(coalesce(d->>'branch','')) IN ('auto','automovel','automóvel') AND plate='' AND chassis=''
 THEN RAISE EXCEPTION 'ASSISTED_VEHICLE_ID_REQUIRED';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(d) f(key)
   WHERE key NOT IN('number','proposalNumber','policyNumber','previousPolicyNumber','previousInsurer',
     'insurer','branch','subBranches','brokerage','brokerages','producerId','producerName','commissionPercent',
     'start','end','status','commercialStatus','policyType','plate','chassis','vehicle','fipeCode',
     'insuredValue','insuredValueBasis','insuredValueOrigin','insuredValuePending','riskAddress',
     'insuredProperty','activity','coverages','eventCoverages','notes','premium','netPremium','iof',
     'paymentMethod','paymentDueText','installmentPlan','bonusClass','bonusOriginPolicyNumber',
     'financialToleranceStatus','referenceQuoteNumber','quoteNumber','eventLocation','eventStart','eventEnd'))
 THEN RAISE EXCEPTION 'ASSISTED_UNSUPPORTED_FIELD';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.records WHERE id=d->>'producerId' AND kind='producer')
 THEN RAISE EXCEPTION 'ASSISTED_PRODUCER_NOT_FOUND';END IF;
 -- The record lock serializes both import paths and legacy writers.
 LOCK TABLE public.records IN SHARE ROW EXCLUSIVE MODE;
 SELECT count(*),min(id) INTO n,client_id FROM public.records WHERE kind='client'
 AND regexp_replace(coalesce(data->>'document',''),'[^0-9]','','g')=document_digits;
 IF n>1 THEN RAISE EXCEPTION 'ASSISTED_DUPLICATE_CLIENT_DOCUMENT';END IF;
 IF n=0 THEN
   client_id:='assisted-client-'||document_digits;
   INSERT INTO public.records(id,kind,data,version,created_at,updated_at)
   VALUES(client_id,'client',jsonb_build_object(
     'name',trim(c->>'name'),'document',document_digits,
     'personType',CASE WHEN length(document_digits)=11 THEN 'Física' ELSE 'Jurídica' END,
     'address',coalesce(c->>'address',''),'city',coalesce(c->>'city',''),
     'state',coalesce(c->>'state',''),
     'notes','Criado a partir de manifesto conferido com PDF no mutirão LEBRIME; histórico anterior a verificar.'
   ),1,now(),now());
 END IF;
 IF EXISTS(SELECT 1 FROM public.records r WHERE r.kind IN ('proposal','policy') AND
   ((upper(regexp_replace(coalesce(r.data->>'number',''),'[^A-Za-z0-9]','','g'))=
      upper(regexp_replace(d->>'number','[^A-Za-z0-9]','','g')) AND
     lower(r.data->>'insurer')=lower(d->>'insurer'))
   OR (r.data->>'clientId'=client_id AND r.data->>'start'=d->>'start' AND
     ((plate<>'' AND upper(coalesce(r.data->>'plate',''))=plate) OR
      (chassis<>'' AND upper(coalesce(r.data->>'chassis',''))=chassis)))))
 THEN RAISE EXCEPTION 'ASSISTED_DUPLICATE_PROPOSAL';END IF;
 IF EXISTS(SELECT 1 FROM public.records WHERE kind='document' AND data->>'sourceDriveFileId'=source->>'driveFileId')
 THEN RAISE EXCEPTION 'ASSISTED_SOURCE_ALREADY_LINKED';END IF;
 risk:=CASE WHEN chassis<>'' THEN chassis WHEN plate<>'' THEN plate ELSE
   regexp_replace(lower(coalesce(d->>'riskAddress',d->>'eventLocation',d->>'branch','')),'[^a-z0-9]','','g') END;
 contract_id:='assisted-'||gen_random_uuid()::text;
 d:=d||jsonb_build_object('clientId',client_id,'plate',plate,'chassis',chassis,
   'riskKey',client_id||':'||risk,'sourceSystem','Fila assistida de importação - LEBRIME',
   'importRequestKey',p->>'requestKey','collectionStatus','Não cobrar',
   'installmentCount',jsonb_array_length(d->'installmentPlan'),
   'producerPending',false,'commissionPending',false,
   'sourceDriveFileId',source->>'driveFileId',
   'sourceDriveUrl','https://drive.google.com/file/d/'||(source->>'driveFileId')||'/view',
   'sourceFileName',source->>'fileName');
 IF abs(amount_sum-premium_cents)>0 OR abs(net_cents+iof_cents-premium_cents)>0 THEN
  d:=d||jsonb_build_object('financialToleranceStatus','Aceita - diferença até R$ 1,00',
      'financialToleranceCents',greatest(abs(amount_sum-premium_cents),abs(net_cents+iof_cents-premium_cents)));
 END IF;
 INSERT INTO public.records(id,kind,data,version,created_at,updated_at)
 VALUES(contract_id,ckind,d,1,now(),now());
 UPDATE public.records SET data=data||jsonb_build_object('collectionStatus','Não cobrar'),
 version=version+1,updated_at=now()
 WHERE kind='payment' AND (data->>'proposalId'=contract_id OR data->>'policyId'=contract_id);
 SELECT count(*),coalesce(sum((data->>'amount')::bigint),0),
 count(*) FILTER(WHERE data->>'collectionStatus'='Não cobrar')
 INTO payment_count,amount_sum,blocked_count
 FROM public.records WHERE kind='payment' AND
 (data->>'proposalId'=contract_id OR data->>'policyId'=contract_id);
 IF payment_count<>jsonb_array_length(d->'installmentPlan') OR
  blocked_count<>payment_count OR abs(amount_sum-premium_cents)>100
 THEN RAISE EXCEPTION 'ASSISTED_PAYMENTS_VERIFY_FAILED';END IF;
 SELECT count(*) INTO commission_count FROM public.records WHERE kind='commission' AND
  (data->>'proposalId'=contract_id OR data->>'policyId'=contract_id);
 IF commission_count<>1 THEN RAISE EXCEPTION 'ASSISTED_COMMISSION_VERIFY_FAILED';END IF;
 document_id:='assisted-doc-'||gen_random_uuid()::text;
 INSERT INTO public.records(id,kind,data,version,created_at,updated_at)
 VALUES(document_id,'document',jsonb_build_object(
  'name',source->>'fileName','originalFileName',source->>'fileName',
  'documentType',CASE WHEN ckind='policy' THEN 'Apólice' ELSE 'Proposta' END,
  'status','Recebido','clientId',client_id,
  'policyId',CASE WHEN ckind='policy' THEN contract_id ELSE '' END,
  'proposalId',CASE WHEN ckind='proposal' THEN contract_id ELSE '' END,
  'mimeType','application/pdf',
  'externalUrl','https://drive.google.com/file/d/'||(source->>'driveFileId')||'/view',
  'sourceDriveUrl','https://drive.google.com/file/d/'||(source->>'driveFileId')||'/view',
  'sourceDriveFileId',source->>'driveFileId',
  'source','Fila assistida LEBRIME autenticada',
  'notes','Manifesto conferido e arquivo de origem vinculado.'
 ),1,now(),now());
 IF NOT EXISTS(SELECT 1 FROM public.records WHERE id=document_id AND kind='document'
  AND data->>'clientId'=client_id) THEN RAISE EXCEPTION 'ASSISTED_DOCUMENT_VERIFY_FAILED';END IF;
 RETURN jsonb_build_object('ok',true,'id',contract_id,'clientId',client_id,
 'documentId',document_id,'payments',payment_count,'commissions',commission_count);
END $fn$;

CREATE OR REPLACE FUNCTION public.lebrime_process_assisted_import_queue(max_jobs integer DEFAULT 5)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO '' AS $fn$
DECLARE j public.lebrime_assisted_import_queue%rowtype; answer jsonb;
 ok_count int:=0; review_count int:=0; retry_count int:=0; reason text; code text;
BEGIN
 IF current_user NOT IN ('postgres','service_role') THEN RAISE EXCEPTION 'ASSISTED_ROLE_DENIED' USING ERRCODE='42501';END IF;
 IF max_jobs NOT BETWEEN 1 AND 10 THEN RAISE EXCEPTION 'ASSISTED_INVALID_BATCH';END IF;
 FOR j IN SELECT * FROM public.lebrime_assisted_import_queue
  WHERE state IN ('queued','retry') AND available_at<=now()
  ORDER BY created_at,id LIMIT max_jobs FOR UPDATE SKIP LOCKED LOOP
   UPDATE public.lebrime_assisted_import_queue SET state='processing',
     attempts=attempts+1,updated_at=now(),last_error=NULL WHERE id=j.id;
   BEGIN
    answer:=public.lebrime_apply_assisted_import(j.payload,j.document_source,j.actor);
    IF coalesce(answer->>'id','')='' OR coalesce(answer->>'documentId','')='' THEN
     RAISE EXCEPTION 'ASSISTED_RESULT_VERIFY_FAILED';END IF;
    UPDATE public.lebrime_assisted_import_queue SET state='done',
     contract_id=answer->>'id',client_id=answer->>'clientId',document_id=answer->>'documentId',
     last_error=NULL,last_sqlstate=NULL,processed_at=now(),updated_at=now() WHERE id=j.id;
    ok_count:=ok_count+1;
   EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS reason=message_text,code=returned_sqlstate;
    IF code IN ('40001','40P01','57014','08006','08003') AND j.attempts<4 THEN
     UPDATE public.lebrime_assisted_import_queue SET state='retry',
       available_at=now()+make_interval(mins=2*(j.attempts+1)),
       last_error=left(reason,300),last_sqlstate=code,updated_at=now() WHERE id=j.id;
     retry_count:=retry_count+1;
    ELSE
     UPDATE public.lebrime_assisted_import_queue SET state='review',
       last_error=left(reason,300),last_sqlstate=code,updated_at=now() WHERE id=j.id;
     review_count:=review_count+1;
    END IF;
   END;
 END LOOP;
 RETURN jsonb_build_object('ok',true,'completed',ok_count,'needsReview',review_count,'retry',retry_count);
END $fn$;

CREATE OR REPLACE FUNCTION public.lebrime_assisted_import_health()
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path TO '' AS $fn$
DECLARE stats jsonb;
BEGIN
 IF current_user NOT IN ('postgres','service_role') THEN RAISE EXCEPTION 'ASSISTED_ROLE_DENIED' USING ERRCODE='42501';END IF;
 SELECT coalesce(jsonb_object_agg(state,n),'{}'::jsonb) INTO stats FROM
  (SELECT state,count(*) n FROM public.lebrime_assisted_import_queue
   WHERE batch_key='pendentes46-out2026' GROUP BY state) x;
 RETURN jsonb_build_object('batch','pendentes46-out2026','goal',46,'counts',stats,
  'serverTime',now(),'oldestPending',(SELECT min(created_at) FROM public.lebrime_assisted_import_queue
  WHERE state IN ('queued','retry') AND batch_key='pendentes46-out2026'));
END $fn$;
REVOKE ALL ON FUNCTION public.lebrime_stage_assisted_import(jsonb,jsonb,jsonb,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.lebrime_apply_assisted_import(jsonb,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.lebrime_process_assisted_import_queue(integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.lebrime_assisted_import_health() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lebrime_stage_assisted_import(jsonb,jsonb,jsonb,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.lebrime_apply_assisted_import(jsonb,jsonb,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.lebrime_process_assisted_import_queue(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.lebrime_assisted_import_health() TO service_role;
SELECT cron.schedule('lebrime-assisted-import-every-minute','* * * * *',
 $$SELECT public.lebrime_process_assisted_import_queue(5);$$);
