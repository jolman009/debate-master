-- Disposable migrated database only, as postgres; enable stop-on-error.
BEGIN;
CREATE FUNCTION pg_temp.expect_error(command text, expected_state text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE command;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = expected_state THEN RETURN; END IF;
    RAISE;
  END;
  RAISE EXCEPTION 'Expected SQLSTATE %: %', expected_state, command;
END $$;

INSERT INTO auth.users(id) VALUES
 ('10000000-0000-0000-0000-000000000001'), ('10000000-0000-0000-0000-000000000002');
INSERT INTO public.debates(id, user_id, config, current_stage, feedback, assessment_status) VALUES
 ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '{}', 'complete', '{}', 'valid'),
 ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', '{}', 'complete', '{}', 'valid');
INSERT INTO public.debate_turns(id, debate_id, stage, role, content) VALUES
 ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'opening_user', 'user', 'Synthetic fixture'),
 ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'opening_user', 'user', 'Synthetic fixture');

SET LOCAL ROLE service_role;
DO $$
DECLARE c public.learning_cycles; retry public.learning_cycles;
  root_id uuid; drill public.learning_sessions; reassessment public.learning_sessions;
BEGIN
  c := public.create_learning_cycle('10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001',
    'argumentStrength', '40000000-0000-0000-0000-000000000001');
  retry := public.create_learning_cycle(c.user_id, c.origin_debate_id, c.cited_turn_id, c.target_competency, c.request_id);
  IF c.id <> retry.id THEN RAISE EXCEPTION 'Cycle retry duplicated'; END IF;
  SELECT id INTO STRICT root_id FROM public.learning_sessions WHERE loop_id = c.id AND session_type = 'debate';
  drill := public.create_learning_attempt(c.user_id, c.id, root_id, 'drill', 'warrant-1', '40000000-0000-0000-0000-000000000002');
  IF (public.create_learning_attempt(c.user_id, c.id, root_id, 'drill', 'warrant-1', drill.request_id)).id <> drill.id
    THEN RAISE EXCEPTION 'Attempt retry duplicated'; END IF;
  reassessment := public.create_learning_attempt(c.user_id, c.id, drill.id, 'reassessment', 'warrant-retest-1', '40000000-0000-0000-0000-000000000003');
  IF reassessment.parent_session_id <> drill.id OR (SELECT count(*) FROM public.learning_sessions WHERE loop_id = c.id) <> 3
    THEN RAISE EXCEPTION 'Broken attempt links'; END IF;

  PERFORM pg_temp.expect_error(format('SELECT public.create_learning_cycle(%L,%L,%L,%L,%L)',
    c.user_id, c.origin_debate_id, c.cited_turn_id, 'evidenceUsage', c.request_id), '22023');
  PERFORM pg_temp.expect_error(format('SELECT public.create_learning_attempt(%L,%L,%L,%L,%L,%L)',
    c.user_id, c.id, root_id, 'drill', 'changed-version', drill.request_id), '22023');
  PERFORM pg_temp.expect_error(format('SELECT public.create_learning_attempt(%L,%L,%L,%L,%L,%L)',
    c.user_id, c.id, root_id, 'reassessment', 'v1', gen_random_uuid()), '23514');
  PERFORM pg_temp.expect_error(format('SELECT public.create_learning_attempt(%L,%L,%L,%L,%L,%L)',
    c.user_id, c.id, root_id, 'drill', ' ', gen_random_uuid()), '23514');
  PERFORM pg_temp.expect_error(format('SELECT public.create_learning_cycle(%L,%L,%L,%L,%L)',
    c.user_id, '20000000-0000-0000-0000-000000000002', c.cited_turn_id, c.target_competency, gen_random_uuid()), '22023');
  PERFORM pg_temp.expect_error(format('SELECT public.create_learning_cycle(%L,%L,%L,%L,%L)',
    c.user_id, c.origin_debate_id, '30000000-0000-0000-0000-000000000002', c.target_competency, gen_random_uuid()), '23503');
  PERFORM pg_temp.expect_error(format('SELECT public.create_learning_attempt(%L,%L,%L,%L,%L,%L)',
    '10000000-0000-0000-0000-000000000002', c.id, root_id, 'drill', 'v1', gen_random_uuid()), '23514');
  retry := public.create_learning_cycle(c.user_id, c.origin_debate_id, c.cited_turn_id, c.target_competency, gen_random_uuid());
  PERFORM pg_temp.expect_error(format('SELECT public.create_learning_attempt(%L,%L,%L,%L,%L,%L)',
    c.user_id, retry.id, root_id, 'drill', 'v1', gen_random_uuid()), '23514');
END $$;
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.learning_cycles) <> 2 THEN RAISE EXCEPTION 'Owner cannot read cycles'; END IF;
  IF (SELECT count(*) FROM public.learning_sessions) <> 4 THEN RAISE EXCEPTION 'Owner cannot read sessions'; END IF;
  PERFORM pg_temp.expect_error('DELETE FROM public.learning_sessions', '42501');
  PERFORM pg_temp.expect_error('UPDATE public.learning_cycles SET target_competency = ''evidenceUsage''', '42501');
  PERFORM pg_temp.expect_error('INSERT INTO public.learning_cycles DEFAULT VALUES', '42501');
  PERFORM pg_temp.expect_error('SELECT public.create_learning_cycle(NULL,NULL,NULL,NULL,NULL)', '42501');
  PERFORM pg_temp.expect_error('SELECT public.create_learning_attempt(NULL,NULL,NULL,NULL,NULL,NULL)', '42501');
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.learning_cycles) OR EXISTS (SELECT 1 FROM public.learning_sessions)
    THEN RAISE EXCEPTION 'Cross-user visibility'; END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE anon;
SELECT pg_temp.expect_error('SELECT * FROM public.learning_cycles', '42501');
SELECT pg_temp.expect_error('SELECT * FROM public.learning_sessions', '42501');
RESET ROLE;

DELETE FROM public.debates WHERE id = '20000000-0000-0000-0000-000000000001';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.learning_cycles WHERE user_id = '10000000-0000-0000-0000-000000000001')
    OR EXISTS (SELECT 1 FROM public.learning_sessions WHERE user_id = '10000000-0000-0000-0000-000000000001')
    THEN RAISE EXCEPTION 'Deletion left orphan records'; END IF;
END $$;
ROLLBACK;
