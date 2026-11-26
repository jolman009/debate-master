-- Phase 1 foundation. No historical cycles or completion events are backfilled.
-- Separate attempts keep micro-drills out of the debate state machine/quota.
ALTER TABLE public.debates ADD CONSTRAINT debates_id_owner_unique UNIQUE (id, user_id);
ALTER TABLE public.debate_turns ADD CONSTRAINT debate_turns_id_debate_unique UNIQUE (id, debate_id);

CREATE TABLE public.learning_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  origin_debate_id uuid NOT NULL,
  cited_turn_id uuid NOT NULL,
  target_competency text NOT NULL CHECK (target_competency IN
    ('argumentStrength', 'evidenceUsage', 'rebuttalQuality', 'rhetoricalSkill')),
  request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, request_id),
  UNIQUE (id, user_id),
  FOREIGN KEY (origin_debate_id, user_id) REFERENCES public.debates(id, user_id) ON DELETE CASCADE,
  FOREIGN KEY (cited_turn_id, origin_debate_id) REFERENCES public.debate_turns(id, debate_id) ON DELETE CASCADE
);

CREATE TABLE public.learning_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  loop_id uuid NOT NULL,
  session_type text NOT NULL CHECK (session_type IN ('debate', 'drill', 'reassessment')),
  parent_session_id uuid,
  exercise_template_version text,
  request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, request_id),
  UNIQUE (id, loop_id, user_id),
  FOREIGN KEY (loop_id, user_id) REFERENCES public.learning_cycles(id, user_id) ON DELETE CASCADE,
  FOREIGN KEY (parent_session_id, loop_id, user_id)
    REFERENCES public.learning_sessions(id, loop_id, user_id) ON DELETE CASCADE,
  CHECK (
    (session_type = 'debate' AND parent_session_id IS NULL AND exercise_template_version IS NULL)
    OR (session_type IN ('drill', 'reassessment') AND parent_session_id IS NOT NULL
      AND exercise_template_version IS NOT NULL AND length(btrim(exercise_template_version)) BETWEEN 1 AND 100)
  )
);
CREATE UNIQUE INDEX learning_sessions_one_origin ON public.learning_sessions(loop_id) WHERE session_type = 'debate';
CREATE INDEX learning_cycles_origin ON public.learning_cycles(origin_debate_id);
CREATE INDEX learning_cycles_cited_turn ON public.learning_cycles(cited_turn_id);
CREATE INDEX learning_cycles_owner ON public.learning_cycles(user_id, created_at);
CREATE INDEX learning_sessions_loop ON public.learning_sessions(loop_id, created_at);
CREATE INDEX learning_sessions_parent ON public.learning_sessions(parent_session_id);

ALTER TABLE public.learning_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read learning cycles" ON public.learning_cycles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Owners read learning sessions" ON public.learning_sessions FOR SELECT TO authenticated USING (user_id = auth.uid());
REVOKE ALL ON public.learning_cycles, public.learning_sessions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.learning_cycles, public.learning_sessions TO authenticated;
GRANT ALL ON public.learning_cycles, public.learning_sessions TO service_role;

-- Enforce parent semantics even for trusted direct inserts. Links are immutable.
CREATE FUNCTION public.validate_learning_session() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE parent_type text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'Learning session links are immutable'; END IF;
    RETURN NEW;
  END IF;
  IF NEW.session_type <> 'debate' THEN
    SELECT session_type INTO parent_type FROM public.learning_sessions
      WHERE id = NEW.parent_session_id AND loop_id = NEW.loop_id AND user_id = NEW.user_id;
    IF parent_type IS DISTINCT FROM (CASE WHEN NEW.session_type = 'drill' THEN 'debate' ELSE 'drill' END) THEN
      RAISE EXCEPTION 'Invalid learning session parent' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER learning_session_links BEFORE INSERT OR UPDATE ON public.learning_sessions
  FOR EACH ROW EXECUTE FUNCTION public.validate_learning_session();

-- Only trusted server code can call these functions. The caller must supply the
-- authenticated owner and enforce entitlements before creating new activity.
CREATE FUNCTION public.create_learning_cycle(
  p_user_id uuid, p_origin_debate_id uuid, p_cited_turn_id uuid,
  p_target_competency text, p_request_id uuid
) RETURNS public.learning_cycles
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE result public.learning_cycles;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('learning:' || p_user_id::text, 0));
  SELECT * INTO result FROM public.learning_cycles WHERE user_id = p_user_id AND request_id = p_request_id;
  IF FOUND THEN
    IF result.origin_debate_id IS DISTINCT FROM p_origin_debate_id
      OR result.cited_turn_id IS DISTINCT FROM p_cited_turn_id
      OR result.target_competency IS DISTINCT FROM p_target_competency THEN
      RAISE EXCEPTION 'Learning request ID already used with different parameters' USING ERRCODE = '22023';
    END IF;
    RETURN result;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.debates WHERE id = p_origin_debate_id AND user_id = p_user_id
    AND assessment_status = 'valid' AND feedback IS NOT NULL AND current_stage IN ('feedback', 'complete')
    AND COALESCE(config->>'mode', 'ai') = 'ai') THEN
    RAISE EXCEPTION 'Valid owned AI coaching is required' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.learning_cycles(user_id, origin_debate_id, cited_turn_id, target_competency, request_id)
    VALUES (p_user_id, p_origin_debate_id, p_cited_turn_id, p_target_competency, p_request_id) RETURNING * INTO result;
  INSERT INTO public.learning_sessions(user_id, loop_id, session_type, request_id)
    VALUES (p_user_id, result.id, 'debate', p_request_id);
  RETURN result;
END $$;

CREATE FUNCTION public.create_learning_attempt(
  p_user_id uuid, p_loop_id uuid, p_parent_session_id uuid, p_session_type text,
  p_exercise_template_version text, p_request_id uuid
) RETURNS public.learning_sessions
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE result public.learning_sessions;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('learning:' || p_user_id::text, 0));
  SELECT * INTO result FROM public.learning_sessions WHERE user_id = p_user_id AND request_id = p_request_id;
  IF FOUND THEN
    IF result.loop_id IS DISTINCT FROM p_loop_id OR result.parent_session_id IS DISTINCT FROM p_parent_session_id
      OR result.session_type IS DISTINCT FROM p_session_type
      OR result.exercise_template_version IS DISTINCT FROM p_exercise_template_version THEN
      RAISE EXCEPTION 'Learning request ID already used with different parameters' USING ERRCODE = '22023';
    END IF;
    RETURN result;
  END IF;
  IF p_session_type IS NULL OR p_session_type NOT IN ('drill', 'reassessment') THEN
    RAISE EXCEPTION 'Expected drill or reassessment' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.learning_sessions(user_id, loop_id, parent_session_id, session_type, exercise_template_version, request_id)
    VALUES (p_user_id, p_loop_id, p_parent_session_id, p_session_type, p_exercise_template_version, p_request_id)
    RETURNING * INTO result;
  RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.validate_learning_session() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_learning_cycle(uuid, uuid, uuid, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_learning_attempt(uuid, uuid, uuid, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_learning_cycle(uuid, uuid, uuid, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_learning_attempt(uuid, uuid, uuid, text, text, uuid) TO service_role;
