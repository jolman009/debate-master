-- Content-free pilot measurement and usefulness review. Service writes only.
BEGIN;
CREATE TABLE public.learning_recommendation_outcomes (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  debate_id uuid NOT NULL REFERENCES public.debates(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK(reason IN ('ineligible_source','no_approved_template','insufficient_source_evidence')),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,debate_id,reason)
);
CREATE TABLE public.coaching_usefulness (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  debate_id uuid NOT NULL REFERENCES public.debates(id) ON DELETE CASCADE,
  rating text NOT NULL CHECK(rating IN ('helpful','not_helpful','reported')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  review_disposition text CHECK(review_disposition IN ('no_action','prompt_review','curriculum_review','technical_followup')),
  PRIMARY KEY(user_id,debate_id),
  CHECK ((reviewed_at IS NULL) = (review_disposition IS NULL))
);
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['learning_recommendation_outcomes','coaching_usefulness'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
  END LOOP;
END $$;

-- Require a frozen, explicit cohort and fixed dates; users are deduplicated.
-- First completed AI debate is selected over all retained history, then filtered
-- to enrollment. Numerators count only cycles linked to that first debate.
CREATE FUNCTION public.learning_pilot_report(p_users uuid[],p_start timestamptz,p_end timestamptz,p_as_of timestamptz)
RETURNS jsonb LANGUAGE plpgsql SET search_path = public AS $$
DECLARE result jsonb;
BEGIN
  IF p_users IS NULL OR cardinality(p_users)=0 OR p_start IS NULL OR p_end IS NULL OR p_as_of IS NULL
    OR p_end<=p_start OR p_as_of<p_end THEN
    RAISE EXCEPTION 'Explicit cohort and valid observation window required' USING ERRCODE='22023';
  END IF;
  WITH cohort AS (SELECT DISTINCT unnest(p_users) user_id),
  firsts AS (
    SELECT c.user_id,min(e.occurred_at) at FROM cohort c
    JOIN lifecycle_events e ON e.user_id=c.user_id AND e.event_name='debate_completed'
    JOIN debates d ON d.id=e.session_id AND coalesce(d.config->>'mode','ai')<>'human'
    GROUP BY c.user_id
  ), origins AS (
    SELECT f.user_id,f.at,(SELECT e.session_id FROM lifecycle_events e JOIN debates d ON d.id=e.session_id
      WHERE e.user_id=f.user_id AND e.event_name='debate_completed' AND e.occurred_at=f.at
      AND coalesce(d.config->>'mode','ai')<>'human' ORDER BY e.session_id LIMIT 1) debate_id
    FROM firsts f WHERE f.at>=p_start AND f.at<p_end
  ), outcomes AS (
    SELECT o.*,o.at+interval '7 days'<=p_as_of matured,
      EXISTS(SELECT 1 FROM learning_cycles c JOIN learning_events e ON e.loop_id=c.id
        WHERE c.user_id=o.user_id AND c.origin_debate_id=o.debate_id AND e.event_name='cycle_completed'
        AND e.occurred_at>=o.at AND e.occurred_at<=least(o.at+interval '7 days',p_as_of)) completed,
      EXISTS(SELECT 1 FROM learning_cycles c JOIN learning_events e ON e.loop_id=c.id
        WHERE c.user_id=o.user_id AND c.origin_debate_id=o.debate_id AND e.event_name='drill_started'
        AND e.occurred_at>=o.at AND e.occurred_at<=least(o.at+interval '7 days',p_as_of)) started,
      EXISTS(SELECT 1 FROM learning_recommendation_outcomes r WHERE r.user_id=o.user_id AND r.debate_id=o.debate_id
        AND r.first_seen_at<=least(o.at+interval '7 days',p_as_of)) unavailable
    FROM origins o
  ) SELECT jsonb_build_object(
    'cohortSize',(SELECT count(*) FROM cohort),'firstDebateCompleters',count(*),
    'maturedDenominator',count(*) FILTER(WHERE matured),
    'completedNumerator',count(*) FILTER(WHERE matured AND completed),
    'pendingFollowup',count(*) FILTER(WHERE NOT matured),
    'unavailableLearners',count(*) FILTER(WHERE matured AND unavailable),
    'startedWithoutCompletion',count(*) FILTER(WHERE matured AND started AND NOT completed),
    'completionRate',count(*) FILTER(WHERE matured AND completed)::numeric/nullif(count(*) FILTER(WHERE matured),0),
    'start',p_start,'end',p_end,'asOf',p_as_of
  ) INTO result FROM outcomes;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.learning_pilot_report(uuid[],timestamptz,timestamptz,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.learning_pilot_report(uuid[],timestamptz,timestamptz,timestamptz) TO service_role;
COMMIT;
