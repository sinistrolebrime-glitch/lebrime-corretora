-- JSON extraction must bind before string concatenation.
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
 (d->>'start')||'|'||upper(coalesce(d->>'plate',d->>'chassis','')),'UTF8')),'hex');
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

