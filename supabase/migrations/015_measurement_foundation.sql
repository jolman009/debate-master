-- Additive foundation. Historical provenance remains unknown; no score backfill.
ALTER TABLE public.debates ADD COLUMN assessment_status text NOT NULL DEFAULT 'missing'
  CHECK (assessment_status IN ('missing', 'legacy', 'valid', 'invalid', 'fallback'));
UPDATE public.debates SET assessment_status = 'legacy' WHERE feedback IS NOT NULL OR judge_result IS NOT NULL;

CREATE TABLE public.lifecycle_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.debates(id) ON DELETE CASCADE,
  loop_id uuid, -- Reserved; no loops exist until Phase 1.
  event_name text NOT NULL CHECK (event_name IN ('debate_started','debate_completed','coaching_generated','coaching_viewed')),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, session_id, event_name)
);
ALTER TABLE public.lifecycle_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read lifecycle" ON public.lifecycle_events FOR SELECT TO authenticated USING (user_id = auth.uid());
-- No client INSERT/UPDATE policies: authoritative events are derived from writes.
REVOKE ALL ON public.lifecycle_events FROM anon, authenticated;
GRANT SELECT ON public.lifecycle_events TO authenticated;

CREATE FUNCTION public.capture_debate_lifecycle() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.user_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    INSERT INTO lifecycle_events(user_id, session_id, event_name) VALUES(NEW.user_id, NEW.id, 'debate_started') ON CONFLICT DO NOTHING;
  ELSE
    IF OLD.current_stage IS DISTINCT FROM NEW.current_stage AND NEW.current_stage IN ('feedback','judge','complete') THEN
      INSERT INTO lifecycle_events(user_id, session_id, event_name) VALUES(NEW.user_id, NEW.id, 'debate_completed') ON CONFLICT DO NOTHING;
    END IF;
    IF OLD.feedback IS NULL AND NEW.feedback IS NOT NULL THEN
      INSERT INTO lifecycle_events(user_id, session_id, event_name) VALUES(NEW.user_id, NEW.id, 'coaching_generated') ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER debate_lifecycle AFTER INSERT OR UPDATE ON public.debates FOR EACH ROW EXECUTE FUNCTION public.capture_debate_lifecycle();

CREATE FUNCTION public.record_coaching_view(p_session_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM debates WHERE id = p_session_id AND user_id = auth.uid() AND feedback IS NOT NULL) THEN
    RAISE EXCEPTION 'Session not available';
  END IF;
  INSERT INTO lifecycle_events(user_id, session_id, event_name) VALUES(auth.uid(), p_session_id, 'coaching_viewed') ON CONFLICT DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.record_coaching_view(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_coaching_view(uuid) TO authenticated;

CREATE FUNCTION public.sync_assessment_status() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.judge_result IS DISTINCT FROM OLD.judge_result AND NEW.judge_result IS NOT NULL THEN
    NEW.assessment_status := CASE WHEN NEW.judge_result->'assessment'->>'status' = 'valid' THEN 'valid' ELSE 'legacy' END;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER judge_assessment_status BEFORE UPDATE ON public.debates FOR EACH ROW EXECUTE FUNCTION public.sync_assessment_status();
