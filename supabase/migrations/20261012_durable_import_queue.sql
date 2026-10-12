-- LEBRIME durable import queue: migration mirrored from active Supabase schema.
-- All database operations are granted to trusted server roles, never to anon users.
CREATE TABLE IF NOT EXISTS public.lebrime_import_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint text NOT NULL UNIQUE CHECK (fingerprint ~ '^[a-f0-9]{64}$'),
  request_key text NOT NULL UNIQUE CHECK (request_key ~ '^[A-Za-z0-9_-]{8,120}$'),
  operation text NOT NULL DEFAULT 'renewal' CHECK (operation='renewal'),
  payload jsonb NOT NULL,
  document_source jsonb NOT NULL,
  actor jsonb NOT NULL,
  state text NOT NULL DEFAULT 'queued' CHECK (state IN ('queued','processing','retry','review','done')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 100),
  available_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  contract_id text,
  document_id text,
  last_error text,
  last_sqlstate text,
  CHECK (jsonb_typeof(payload)='object' AND jsonb_typeof(document_source)='object')
);
CREATE INDEX IF NOT EXISTS lebrime_import_queue_scheduling ON public.lebrime_import_queue(state,available_at,created_at);
CREATE INDEX IF NOT EXISTS lebrime_import_queue_created ON public.lebrime_import_queue(created_at DESC);
ALTER TABLE public.lebrime_import_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lebrime_import_queue FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.lebrime_import_queue TO service_role;

CREATE OR REPLACE FUNCTION public.lebrime_enqueue_renewal(p jsonb, source jsonb, actor jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
 v_fp text; v_id uuid; v_state text; v_contract text;
 v_key text:=coalesce(p->>'requestKey','');
 v_data jsonb:=p->'data';
 v_doc text:=regexp_replace(coalesce(p->>'document',''),'[^0-9]','','g');
 v_num text:=upper(regexp_replace(coalesce(v_data->>'number',''),'[^A-Za-z0-9]','','g'));
 v_plate text:=upper(regexp_replace(coalesce(v_data->>'plate',''),'[^A-Za-z0-9]','','g'));
 v_file text:=coalesce(source->>'driveFileId','');
begin
 if current_user not in ('postgres','service_role') then raise exception 'IMPORT_QUEUE_ROLE_DENIED' using errcode='42501'; end if;
 if jsonb_typeof(p) is distinct from 'object' or jsonb_typeof(v_data) is distinct from 'object'
 or jsonb_typeof(source) is distinct from 'object' or jsonb_typeof(actor) is distinct from 'object'
 or octet_length(p::text)>65536 or octet_length(source::text)>4096 then
 raise exception 'IMPORT_QUEUE_INVALID_PAYLOAD';end if;
 if v_key !~ '^[A-Za-z0-9_-]{8,120}$' or
 coalesce(p->>'kind','') not in ('proposal','policy') or
 length(v_doc) not in (11,14) or
 v_num !~ '^[A-Z0-9]{4,60}$' or
 v_plate !~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$' or
 coalesce(v_data->>'start','') !~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$' or
 coalesce(p->>'previousId','')='' or
 coalesce(p->'evidence'->>'currentSource','')='' then raise exception 'IMPORT_QUEUE_MISSING_IDENTITY';end if;
 if v_file !~ '^[A-Za-z0-9_-]{12,120}$'
 or coalesce(source->>'fileName','') !~ '^[^/\\]{1,180}[.][Pp][Dd][Ff]$'
 then raise exception 'IMPORT_QUEUE_REQUIRES_PDF_SOURCE';end if;
 if coalesce(actor->>'source','') not in ('lebrime-api','authorized-work') or
 length(coalesce(actor->>'subject',''))<5 then raise exception 'IMPORT_QUEUE_INVALID_AUDIT';end if;
 v_fp:=encode(sha256(convert_to(v_doc||'|'||lower(coalesce(v_data->>'insurer',''))||'|'||
 v_num||'|'||coalesce(v_data->>'start','')||'|'||v_plate,'UTF8')),'hex');
 insert into public.lebrime_import_queue(fingerprint,request_key,payload,document_source,actor)
 values(v_fp,v_key,p,source,actor)
 on conflict do nothing returning id into v_id;
 if v_id is null then
  select id,state,contract_id into v_id,v_state,v_contract from public.lebrime_import_queue
  where fingerprint=v_fp or request_key=v_key order by (fingerprint=v_fp) desc limit 1;
  if not found then raise exception 'IMPORT_QUEUE_ENQUEUE_CONFLICT';end if;
  if exists(select 1 from public.lebrime_import_queue where id=v_id and fingerprint<>v_fp)
  then raise exception 'IMPORT_QUEUE_REQUEST_KEY_CONFLICT';end if;
  return jsonb_build_object('ok',true,'duplicate',true,'id',v_id,'state',v_state,'contractId',v_contract);
 end if;
 return jsonb_build_object('ok',true,'duplicate',false,'id',v_id,'state','queued');
end $function$;

CREATE OR REPLACE FUNCTION public.lebrime_process_import_queue(max_jobs integer DEFAULT 10)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
 j public.lebrime_import_queue%rowtype;
 result jsonb; c_id text; d_id text; client_id text;
 ok_count integer:=0; review_count integer:=0; retry_count integer:=0;
 reason text; code text; count_docs integer;
begin
 if current_user not in ('postgres','service_role') then raise exception 'IMPORT_QUEUE_ROLE_DENIED' using errcode='42501';end if;
 if max_jobs<1 or max_jobs>30 then raise exception 'IMPORT_QUEUE_INVALID_BATCH';end if;
 for j in
  select * from public.lebrime_import_queue
  where state in ('queued','retry') and available_at<=now()
  order by created_at,id limit max_jobs for update skip locked
 loop
  update public.lebrime_import_queue set state='processing',attempts=attempts+1,updated_at=now(),last_error=null
  where id=j.id;
  begin
   result:=public.lebrime_import_renewal(j.payload,j.actor);
   c_id:=result->>'id';client_id:=result->>'clientId';
   if coalesce(c_id,'')='' or coalesce(client_id,'')='' then raise exception 'IMPORT_QUEUE_NO_CONTRACT_ID';end if;
   -- A renewal and its PDF document are committed in one database transaction.
   d_id:='queue-doc-'||j.id::text;
   select count(*) into count_docs from public.records where kind='document'
     and data->>'sourceDriveFileId'=j.document_source->>'driveFileId'
     and coalesce(data->>'proposalId',data->>'policyId')<>c_id;
   if count_docs>0 then raise exception 'IMPORT_QUEUE_PDF_LINK_CONFLICT';end if;
   insert into public.records (id,kind,data,version,created_at,updated_at)
   values(d_id,'document',jsonb_build_object(
     'name',j.document_source->>'fileName',
     'originalFileName',j.document_source->>'fileName',
     'documentType',case when j.payload->>'kind'='policy' then 'Apólice' else 'Proposta' end,
     'status','Recebido','clientId',client_id,
     'policyId',case when j.payload->>'kind'='policy' then c_id else '' end,
     'proposalId',case when j.payload->>'kind'='proposal' then c_id else '' end,
     'mimeType','application/pdf',
     'externalUrl','https://drive.google.com/file/d/'||(j.document_source->>'driveFileId')||'/view',
     'sourceDriveUrl','https://drive.google.com/file/d/'||(j.document_source->>'driveFileId')||'/view',
     'sourceDriveFileId',j.document_source->>'driveFileId',
     'source','Fila LEBRIME autenticada',
     'notes','Documento de origem vinculado após importação validada.'
   ),1,now(),now()) on conflict(id) do nothing;
   if not exists(select 1 from public.records where id=d_id and kind='document'
      and data->>'clientId'=client_id and
      (data->>'proposalId'=c_id or data->>'policyId'=c_id))
     then raise exception 'IMPORT_QUEUE_DOCUMENT_VERIFY_FAILED';end if;
   if not exists(select 1 from public.records where id=c_id and kind in ('proposal','policy')
     and data->>'clientId'=client_id) then raise exception 'IMPORT_QUEUE_CONTRACT_VERIFY_FAILED';end if;
   update public.lebrime_import_queue set state='done',contract_id=c_id,document_id=d_id,
     processed_at=now(),updated_at=now(),last_error=null,last_sqlstate=null where id=j.id;
   ok_count:=ok_count+1;
  exception when others then
    get stacked diagnostics reason=message_text,code=returned_sqlstate;
    -- Nontransient document/risk/dedup conflicts need human review.
    if code in ('40001','40P01','57014','08006','08003') and j.attempts<4 then
      update public.lebrime_import_queue set state='retry',
       available_at=now()+make_interval(mins=2*(j.attempts+1)),
       last_error=left(reason,300),last_sqlstate=code,updated_at=now() where id=j.id;
      retry_count:=retry_count+1;
    else
      update public.lebrime_import_queue set state='review',
       last_error=left(reason,300),last_sqlstate=code,updated_at=now() where id=j.id;
      review_count:=review_count+1;
    end if;
  end;
 end loop;
 return jsonb_build_object('ok',true,'completed',ok_count,'needsReview',review_count,'retry',retry_count);
end $function$;

CREATE OR REPLACE FUNCTION public.lebrime_import_queue_health()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare x jsonb;
begin
 if current_user not in ('postgres','service_role') then raise exception 'IMPORT_QUEUE_ROLE_DENIED' using errcode='42501';end if;
 select coalesce(jsonb_object_agg(state,n), '{}'::jsonb) into x
 from (select state,count(*) n from public.lebrime_import_queue group by state) s;
 return jsonb_build_object('counts',x,'serverTime',now(),
   'oldestPending', (select min(created_at) from public.lebrime_import_queue where state in ('queued','retry')),
   'recentCompleted', (select count(*) from public.lebrime_import_queue where state='done' and processed_at>=now()-interval '24 hours'));
end $function$;

REVOKE ALL ON FUNCTION public.lebrime_enqueue_renewal(jsonb,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.lebrime_process_import_queue(integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.lebrime_import_queue_health() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lebrime_enqueue_renewal(jsonb,jsonb,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.lebrime_process_import_queue(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.lebrime_import_queue_health() TO service_role;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
SELECT cron.schedule('lebrime-import-queue-every-minute','* * * * *',
  $$SELECT public.lebrime_process_import_queue(10);$$);
