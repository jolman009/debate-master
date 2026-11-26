-- One audited operator recovery for a response that exhausted its provider attempts.
BEGIN;

ALTER TABLE public.learning_responses
  ADD COLUMN attempt_limit integer NOT NULL DEFAULT 3
  CHECK (attempt_limit BETWEEN 3 AND 4),
  ADD CONSTRAINT learning_responses_attempts_within_limit CHECK (attempts <= attempt_limit);

CREATE TABLE public.learning_evaluation_recoveries (
  response_id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  operator_reference text NOT NULL CHECK (length(btrim(operator_reference)) BETWEEN 1 AND 200),
  reason_code text NOT NULL CHECK (reason_code IN ('provider_unavailable','provider_timeout','platform_incident')),
  granted_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (response_id, user_id) REFERENCES public.learning_responses(id, user_id) ON DELETE CASCADE
);

ALTER TABLE public.learning_evaluation_recoveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.learning_evaluation_recoveries FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.learning_evaluation_recoveries TO service_role;

CREATE FUNCTION public.grant_learning_evaluation_recovery(
  p_response_id uuid,
  p_operator_reference text,
  p_reason_code text
) RETURNS jsonb LANGUAGE plpgsql SET search_path=public AS $$
DECLARE response public.learning_responses; inserted_count integer;
BEGIN
  IF length(btrim(COALESCE(p_operator_reference,''))) NOT BETWEEN 1 AND 200
    OR p_reason_code NOT IN ('provider_unavailable','provider_timeout','platform_incident') THEN
    RAISE EXCEPTION 'Invalid recovery audit fields' USING ERRCODE='22023';
  END IF;
  SELECT * INTO response FROM public.learning_responses WHERE id=p_response_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Response unavailable' USING ERRCODE='42501'; END IF;
  IF response.status NOT IN ('failed','invalid') OR response.assessment IS NOT NULL
    OR response.attempts < 3 OR response.lease_until > now() THEN
    RAISE EXCEPTION 'Response is not eligible for recovery' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.learning_evaluation_recoveries(response_id,user_id,operator_reference,reason_code)
    VALUES(response.id,response.user_id,btrim(p_operator_reference),p_reason_code)
    ON CONFLICT (response_id) DO NOTHING;
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  IF inserted_count = 1 THEN
    UPDATE public.learning_responses SET attempt_limit=4 WHERE id=response.id;
  END IF;
  SELECT * INTO response FROM public.learning_responses WHERE id=p_response_id;
  RETURN jsonb_build_object('responseId',response.id,'granted',inserted_count = 1,
    'attempts',response.attempts,'attemptLimit',response.attempt_limit);
END $$;

REVOKE ALL ON FUNCTION public.grant_learning_evaluation_recovery(uuid,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_learning_evaluation_recovery(uuid,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.learning_submit(p_user_id uuid,p_session_id uuid,p_request_id uuid,p_kind text,p_content text,p_revision integer)
RETURNS jsonb LANGUAGE plpgsql SET search_path=public AS $$
DECLARE r learning_runtime; response learning_responses; st text; token uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('learning:' || p_user_id::text,0));
  SELECT * INTO r FROM learning_runtime WHERE session_id=p_session_id AND user_id=p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Session unavailable' USING ERRCODE='42501'; END IF;
  SELECT * INTO response FROM learning_responses WHERE user_id=p_user_id AND request_id=p_request_id;
  IF FOUND AND (response.session_id<>p_session_id OR response.kind<>p_kind OR response.content<>p_content) THEN
    RAISE EXCEPTION 'Conflicting request' USING ERRCODE='22023';
  END IF;
  SELECT * INTO response FROM learning_responses WHERE session_id=p_session_id AND kind=p_kind;
  IF FOUND THEN
    IF response.content<>p_content THEN RAISE EXCEPTION 'Response already submitted' USING ERRCODE='22023'; END IF;
    IF response.status='evaluated' OR response.lease_until > now() THEN
      RETURN jsonb_build_object('response',to_jsonb(response),'claimed',false);
    END IF;
    IF response.attempts>=response.attempt_limit THEN RAISE EXCEPTION 'Evaluation retry limit reached' USING ERRCODE='54000'; END IF;
  ELSE
    SELECT session_type INTO st FROM learning_sessions WHERE id=p_session_id;
    IF p_kind IS NULL OR NOT ((st='drill' AND p_kind='initial' AND r.state='ready')
      OR (st='drill' AND p_kind='revision' AND r.state='coached')
      OR (st='reassessment' AND p_kind='reassessment' AND r.state='ready')) THEN
      RAISE EXCEPTION 'Invalid response transition' USING ERRCODE='22023';
    END IF;
    IF p_revision IS DISTINCT FROM r.draft_revision THEN RAISE EXCEPTION 'Draft changed' USING ERRCODE='40001'; END IF;
    INSERT INTO learning_responses(session_id,user_id,request_id,kind,content)
      VALUES(p_session_id,p_user_id,p_request_id,p_kind,p_content) RETURNING * INTO response;
    INSERT INTO learning_events(user_id,session_id,loop_id,entity_id,event_name)
      VALUES(p_user_id,p_session_id,r.loop_id,response.id,'response_submitted') ON CONFLICT DO NOTHING;
  END IF;
  UPDATE learning_evaluations SET outcome='expired',finished_at=now()
    WHERE response_id=response.id AND outcome='pending';
  token:=gen_random_uuid();
  UPDATE learning_responses SET status='pending',lease_token=token,lease_until=now()+interval '90 seconds',attempts=attempts+1
    WHERE id=response.id RETURNING * INTO response;
  INSERT INTO learning_evaluations(id,response_id,user_id) VALUES(token,response.id,p_user_id);
  UPDATE learning_runtime SET state='evaluating',updated_at=now() WHERE session_id=p_session_id;
  RETURN jsonb_build_object('response',to_jsonb(response),'claimed',true);
END $$;

REVOKE ALL ON FUNCTION public.learning_submit(uuid,uuid,uuid,text,text,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.learning_submit(uuid,uuid,uuid,text,text,integer) TO service_role;

COMMIT;
