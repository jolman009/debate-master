-- Phase 1 runtime. Apply after 017; all new mutations are server-only.
BEGIN;
CREATE TABLE public.learning_allowances (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  loop_id uuid REFERENCES public.learning_cycles(id) ON DELETE SET NULL,
  reserved_at timestamptz NOT NULL DEFAULT now()
); -- Deleting a cycle does not replenish the lifetime introductory allowance.

CREATE TABLE public.learning_runtime (
  session_id uuid PRIMARY KEY,
  loop_id uuid NOT NULL,
  user_id uuid NOT NULL,
  exercise jsonb NOT NULL CHECK (jsonb_typeof(exercise) = 'object'),
  reassessment_exercise jsonb,
  state text NOT NULL DEFAULT 'ready' CHECK (state IN ('ready','evaluating','coached','completed','failed')),
  draft text NOT NULL DEFAULT '' CHECK (length(draft) <= 4000),
  draft_revision integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (session_id, loop_id, user_id) REFERENCES public.learning_sessions(id, loop_id, user_id) ON DELETE CASCADE,
  UNIQUE (session_id, user_id)
);
CREATE TABLE public.learning_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  user_id uuid NOT NULL,
  request_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('initial','revision','reassessment')),
  content text NOT NULL CHECK (length(btrim(content)) BETWEEN 1 AND 4000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','evaluated','invalid','failed')),
  assessment jsonb,
  lease_token uuid,
  lease_until timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (session_id, user_id) REFERENCES public.learning_runtime(session_id, user_id) ON DELETE CASCADE,
  UNIQUE (session_id, kind), UNIQUE (user_id, request_id), UNIQUE (id, user_id),
  CHECK ((status = 'evaluated') = (assessment IS NOT NULL))
);
CREATE TABLE public.learning_evaluations (
  id uuid PRIMARY KEY, -- lease fencing token; one row for every provider attempt
  response_id uuid NOT NULL,
  user_id uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  outcome text NOT NULL DEFAULT 'pending' CHECK (outcome IN ('pending','valid','insufficient','invalid','failed','expired')),
  usage jsonb,
  FOREIGN KEY (response_id, user_id) REFERENCES public.learning_responses(id, user_id) ON DELETE CASCADE
);
CREATE TABLE public.learning_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_id uuid NOT NULL,
  loop_id uuid NOT NULL,
  entity_id uuid NOT NULL,
  event_name text NOT NULL CHECK (event_name IN ('drill_started','response_submitted','coaching_viewed','drill_completed','reassessment_started','reassessment_completed','cycle_completed')),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (session_id, loop_id, user_id) REFERENCES public.learning_sessions(id, loop_id, user_id) ON DELETE CASCADE,
  UNIQUE (entity_id, event_name)
);
CREATE INDEX learning_runtime_owner ON public.learning_runtime(user_id, loop_id);
CREATE INDEX learning_responses_owner ON public.learning_responses(user_id, session_id);
CREATE INDEX learning_evaluations_response ON public.learning_evaluations(response_id);
CREATE INDEX learning_events_owner ON public.learning_events(user_id, occurred_at);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['learning_allowances','learning_runtime','learning_responses','learning_evaluations','learning_events'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('CREATE POLICY "Owners read" ON public.%I FOR SELECT TO authenticated USING (user_id = auth.uid())', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
  END LOOP;
END $$;

CREATE FUNCTION public.learning_open(
  p_user_id uuid, p_origin_debate_id uuid, p_cited_turn_id uuid, p_request_id uuid,
  p_exercise jsonb, p_reassessment jsonb, p_paid_enabled boolean DEFAULT false,
  p_billing_environment text DEFAULT 'live'
) RETURNS uuid LANGUAGE plpgsql SET search_path = public AS $$
DECLARE c public.learning_cycles; s public.learning_sessions; root_id uuid; existing uuid; paid boolean;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('learning:' || p_user_id::text, 0));
  SELECT id INTO existing FROM learning_cycles WHERE user_id = p_user_id AND request_id = p_request_id;
  IF existing IS NOT NULL THEN
    c := create_learning_cycle(p_user_id,p_origin_debate_id,p_cited_turn_id,p_exercise->>'competency',p_request_id);
    IF NOT EXISTS (SELECT 1 FROM learning_runtime WHERE loop_id=c.id AND user_id=p_user_id) THEN
      RAISE EXCEPTION 'Cycle has no runtime' USING ERRCODE='22023';
    END IF;
    RETURN c.id;
  END IF;
  -- A fresh CTA after navigation resumes the existing cycle for this source.
  SELECT r.loop_id INTO existing FROM learning_runtime r JOIN learning_cycles lc ON lc.id=r.loop_id
    WHERE r.user_id=p_user_id AND lc.origin_debate_id=p_origin_debate_id ORDER BY lc.created_at LIMIT 1;
  IF existing IS NOT NULL THEN RETURN existing; END IF;
  IF p_exercise->>'kind' IS DISTINCT FROM 'drill' OR p_reassessment->>'kind' IS DISTINCT FROM 'reassessment'
    OR p_exercise->>'templateVersion' IS NULL
    OR p_exercise->>'templateVersion' IS DISTINCT FROM p_reassessment->>'templateVersion'
    OR p_exercise->>'competency' IS DISTINCT FROM p_reassessment->>'competency' THEN
    RAISE EXCEPTION 'Invalid exercise contract' USING ERRCODE='22023';
  END IF;
  -- No billing-disabled premium default, and no caller-provided tier.
  SELECT COALESCE(p_paid_enabled,false) AND EXISTS (
    SELECT 1 FROM billing_subscriptions WHERE user_id=p_user_id
      AND provider_environment=p_billing_environment AND status IN ('active','trialing')
      AND current_period_end > now() AND verified_at IS NOT NULL
  ) INTO paid;
  IF NOT paid AND EXISTS (SELECT 1 FROM learning_allowances WHERE user_id=p_user_id) THEN
    RAISE EXCEPTION 'Introductory cycle already reserved' USING ERRCODE='P0001';
  END IF;
  c := create_learning_cycle(p_user_id,p_origin_debate_id,p_cited_turn_id,p_exercise->>'competency',p_request_id);
  SELECT id INTO STRICT root_id FROM learning_sessions WHERE loop_id=c.id AND session_type='debate';
  s := create_learning_attempt(p_user_id,c.id,root_id,'drill',p_exercise->>'templateVersion',gen_random_uuid());
  INSERT INTO learning_runtime(session_id,loop_id,user_id,exercise,reassessment_exercise)
    VALUES(s.id,c.id,p_user_id,p_exercise,p_reassessment);
  IF NOT paid THEN INSERT INTO learning_allowances(user_id,loop_id) VALUES(p_user_id,c.id); END IF;
  RETURN c.id;
END $$;

CREATE FUNCTION public.learning_save_draft(p_user_id uuid,p_session_id uuid,p_content text,p_revision integer)
RETURNS integer LANGUAGE plpgsql SET search_path=public AS $$
DECLARE revision integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('learning:' || p_user_id::text,0));
  UPDATE learning_runtime SET draft=p_content,draft_revision=draft_revision+1,updated_at=now()
    WHERE session_id=p_session_id AND user_id=p_user_id AND draft_revision=p_revision AND state IN ('ready','coached')
    RETURNING draft_revision INTO revision;
  IF revision IS NULL THEN RAISE EXCEPTION 'Draft changed or session is not editable' USING ERRCODE='40001'; END IF;
  RETURN revision;
END $$;

CREATE FUNCTION public.learning_submit(p_user_id uuid,p_session_id uuid,p_request_id uuid,p_kind text,p_content text,p_revision integer)
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
    IF response.attempts>=3 THEN RAISE EXCEPTION 'Evaluation retry limit reached' USING ERRCODE='54000'; END IF;
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

CREATE FUNCTION public.learning_finish(p_user_id uuid,p_response_id uuid,p_token uuid,p_assessment jsonb,p_outcome text,p_usage jsonb)
RETURNS boolean LANGUAGE plpgsql SET search_path=public AS $$
DECLARE response learning_responses; r learning_runtime; event text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('learning:' || p_user_id::text,0));
  SELECT * INTO response FROM learning_responses WHERE id=p_response_id AND user_id=p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Response unavailable' USING ERRCODE='42501'; END IF;
  -- Preserve late attempt usage even when its result is fenced out.
  UPDATE learning_evaluations SET finished_at=now(),usage=p_usage,
    outcome=CASE WHEN outcome='expired' THEN 'expired' ELSE p_outcome END
    WHERE id=p_token AND response_id=p_response_id AND user_id=p_user_id;
  IF response.lease_token IS DISTINCT FROM p_token OR response.lease_until <= now() OR response.status<>'pending' THEN RETURN false; END IF;
  IF p_outcome IN ('valid','insufficient') THEN
    IF p_assessment IS NULL OR p_assessment->>'status' IS DISTINCT FROM p_outcome THEN
      RAISE EXCEPTION 'Invalid assessment' USING ERRCODE='22023';
    END IF;
    IF p_outcome='valid' AND (jsonb_typeof(p_assessment->'score') IS DISTINCT FROM 'number'
      OR (p_assessment->>'score')::numeric NOT BETWEEN 1 AND 10
      OR mod((p_assessment->>'score')::numeric,1)<>0) THEN
      RAISE EXCEPTION 'Invalid score' USING ERRCODE='22023';
    END IF;
    IF p_outcome='insufficient' AND p_assessment->'score' IS DISTINCT FROM 'null'::jsonb THEN
      RAISE EXCEPTION 'Expected null score' USING ERRCODE='22023';
    END IF;
    UPDATE learning_responses SET status='evaluated',assessment=p_assessment,lease_until=NULL WHERE id=p_response_id;
    UPDATE learning_runtime SET state=CASE WHEN response.kind='initial' THEN 'coached' ELSE 'completed' END,
      draft='',draft_revision=draft_revision+1,updated_at=now() WHERE session_id=response.session_id RETURNING * INTO r;
    IF response.kind<>'initial' THEN
      event:=CASE WHEN response.kind='revision' THEN 'drill_completed' ELSE 'reassessment_completed' END;
      INSERT INTO learning_events(user_id,session_id,loop_id,entity_id,event_name)
        VALUES(p_user_id,r.session_id,r.loop_id,r.session_id,event) ON CONFLICT DO NOTHING;
      IF response.kind='reassessment' THEN
        INSERT INTO learning_events(user_id,session_id,loop_id,entity_id,event_name)
          VALUES(p_user_id,r.session_id,r.loop_id,r.loop_id,'cycle_completed') ON CONFLICT DO NOTHING;
      END IF;
    END IF;
  ELSIF p_outcome IN ('invalid','failed') THEN
    UPDATE learning_responses SET status=p_outcome,lease_until=NULL WHERE id=p_response_id;
    UPDATE learning_runtime SET state='failed',updated_at=now() WHERE session_id=response.session_id;
  ELSE RAISE EXCEPTION 'Invalid outcome' USING ERRCODE='22023'; END IF;
  RETURN true;
END $$;

CREATE FUNCTION public.learning_reassess(p_user_id uuid,p_loop_id uuid,p_request_id uuid)
RETURNS uuid LANGUAGE plpgsql SET search_path=public AS $$
DECLARE r learning_runtime; s learning_sessions; existing uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('learning:' || p_user_id::text,0));
  SELECT lr.* INTO r FROM learning_runtime lr JOIN learning_sessions ls ON ls.id=lr.session_id
    WHERE lr.user_id=p_user_id AND lr.loop_id=p_loop_id AND ls.session_type='drill';
  IF NOT FOUND OR r.state<>'completed' THEN RAISE EXCEPTION 'Complete the drill first' USING ERRCODE='22023'; END IF;
  SELECT ls.id INTO existing FROM learning_sessions ls JOIN learning_runtime lr ON lr.session_id=ls.id
    WHERE ls.loop_id=p_loop_id AND ls.user_id=p_user_id AND ls.session_type='reassessment';
  IF existing IS NOT NULL THEN RETURN existing; END IF;
  s:=create_learning_attempt(p_user_id,p_loop_id,r.session_id,'reassessment',r.exercise->>'templateVersion',p_request_id);
  INSERT INTO learning_runtime(session_id,loop_id,user_id,exercise) VALUES(s.id,p_loop_id,p_user_id,r.reassessment_exercise);
  RETURN s.id;
END $$;

CREATE FUNCTION public.learning_view(p_user_id uuid,p_session_id uuid,p_response_id uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SET search_path=public AS $$
DECLARE r learning_runtime; st text; event text;
BEGIN
  SELECT * INTO r FROM learning_runtime WHERE session_id=p_session_id AND user_id=p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Session unavailable' USING ERRCODE='42501'; END IF;
  IF p_response_id IS NOT NULL THEN
    IF NOT EXISTS(SELECT 1 FROM learning_responses WHERE id=p_response_id AND session_id=p_session_id AND user_id=p_user_id AND status='evaluated') THEN
      RAISE EXCEPTION 'Coaching unavailable' USING ERRCODE='42501';
    END IF;
    event:='coaching_viewed';
  ELSE
    SELECT session_type INTO st FROM learning_sessions WHERE id=p_session_id;
    event:=CASE WHEN st='drill' THEN 'drill_started' ELSE 'reassessment_started' END;
  END IF;
  INSERT INTO learning_events(user_id,session_id,loop_id,entity_id,event_name)
    VALUES(p_user_id,p_session_id,r.loop_id,COALESCE(p_response_id,p_session_id),event) ON CONFLICT DO NOTHING;
END $$;

DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT oid::regprocedure AS signature FROM pg_proc WHERE pronamespace='public'::regnamespace
    AND proname IN ('learning_open','learning_save_draft','learning_submit','learning_finish','learning_reassess','learning_view') LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated',f.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.signature);
  END LOOP;
END $$;
COMMIT;
