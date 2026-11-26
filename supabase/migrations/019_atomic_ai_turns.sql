-- Apply before deploying the atomic AI turn route. Existing transcripts are unchanged.
BEGIN;
CREATE TABLE public.debate_ai_leases (
  debate_id uuid PRIMARY KEY REFERENCES public.debates(id) ON DELETE CASCADE,
  stage text NOT NULL,
  token uuid NOT NULL,
  expires_at timestamptz NOT NULL
);
ALTER TABLE public.debate_ai_leases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.debate_ai_leases FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.debate_ai_leases TO service_role;

-- Trusted server supplies the transition from the canonical state machine.
-- Locking the debate serializes claims and commits across application instances.
CREATE FUNCTION public.commit_ai_debate_turn(p_user_id uuid, p_debate_id uuid,
  p_stage text, p_next_stage text, p_role text, p_content text, p_token uuid DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SET search_path = public AS $$
DECLARE d public.debates;
BEGIN
  SELECT * INTO d FROM debates WHERE id=p_debate_id FOR UPDATE;
  IF d.id IS NULL OR d.user_id IS DISTINCT FROM p_user_id OR d.config->>'mode' = 'human' THEN
    RAISE EXCEPTION 'Debate unavailable' USING ERRCODE='42501';
  END IF;
  IF d.current_stage IS DISTINCT FROM p_stage THEN RETURN false; END IF;
  IF p_role NOT IN ('user','ai') OR p_role IS NULL OR p_next_stage IS NULL
    OR p_next_stage=p_stage OR p_content IS NULL OR length(btrim(p_content))=0
    OR length(p_content)>50000 THEN
    RAISE EXCEPTION 'Invalid turn' USING ERRCODE='22023';
  END IF;
  IF p_role='ai' AND NOT EXISTS (SELECT 1 FROM debate_ai_leases
    WHERE debate_id=p_debate_id AND stage=p_stage AND token=p_token AND expires_at>clock_timestamp()) THEN
    RETURN false;
  END IF;
  INSERT INTO debate_turns(debate_id,stage,role,content) VALUES(p_debate_id,p_stage,p_role,p_content);
  UPDATE debates SET current_stage=p_next_stage,updated_at=now() WHERE id=p_debate_id;
  DELETE FROM debate_ai_leases WHERE debate_id=p_debate_id;
  RETURN true;
END $$;

CREATE FUNCTION public.claim_ai_debate_turn(p_user_id uuid,p_debate_id uuid,p_stage text)
RETURNS uuid LANGUAGE plpgsql SET search_path = public AS $$
DECLARE d public.debates; claimed uuid;
BEGIN
  SELECT * INTO d FROM debates WHERE id=p_debate_id FOR UPDATE;
  IF d.id IS NULL OR d.user_id IS DISTINCT FROM p_user_id OR d.config->>'mode' = 'human' THEN
    RAISE EXCEPTION 'Debate unavailable' USING ERRCODE='42501';
  END IF;
  IF d.current_stage IS DISTINCT FROM p_stage THEN RETURN NULL; END IF;
  IF p_stage NOT IN ('opening_ai','rebuttal_ai_1','rebuttal_ai_2','cross_exam_ai','cross_exam_ai_response','closing_ai') THEN
    RAISE EXCEPTION 'Not an AI stage' USING ERRCODE='22023';
  END IF;
  INSERT INTO debate_ai_leases AS lease(debate_id,stage,token,expires_at)
    VALUES(p_debate_id,p_stage,gen_random_uuid(),clock_timestamp()+interval '90 seconds')
    ON CONFLICT (debate_id) DO UPDATE SET stage=excluded.stage,token=excluded.token,expires_at=excluded.expires_at
    WHERE lease.expires_at<=clock_timestamp()
    RETURNING token INTO claimed;
  RETURN claimed;
END $$;

CREATE FUNCTION public.release_ai_debate_turn(p_user_id uuid,p_debate_id uuid,p_token uuid)
RETURNS void LANGUAGE sql SET search_path = public AS $$
  DELETE FROM debate_ai_leases l USING debates d
    WHERE l.debate_id=d.id AND d.id=p_debate_id AND d.user_id=p_user_id AND l.token=p_token;
$$;
REVOKE ALL ON FUNCTION public.commit_ai_debate_turn(uuid,uuid,text,text,text,text,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.claim_ai_debate_turn(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.release_ai_debate_turn(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.commit_ai_debate_turn(uuid,uuid,text,text,text,text,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_ai_debate_turn(uuid,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_ai_debate_turn(uuid,uuid,uuid) TO service_role;
COMMIT;
