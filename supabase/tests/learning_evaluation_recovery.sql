-- Disposable migration 021 verification. Run as postgres; every fixture rolls back.
BEGIN;
CREATE FUNCTION pg_temp.expect_error(command text, expected text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE command;
  EXCEPTION WHEN OTHERS THEN IF SQLSTATE=expected THEN RETURN; END IF; RAISE; END;
  RAISE EXCEPTION 'Expected SQLSTATE %',expected;
END $$;

INSERT INTO auth.users(id) VALUES ('60000000-0000-0000-0000-000000000001');
INSERT INTO public.debates(id,user_id,config,current_stage,feedback,assessment_status) VALUES
 ('61000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000001','{}','complete','{}','valid');
INSERT INTO public.debate_turns(id,debate_id,stage,role,content) VALUES
 ('62000000-0000-0000-0000-000000000001','61000000-0000-0000-0000-000000000001','opening_user','user','Synthetic recovery fixture');

SET LOCAL ROLE service_role;
DO $$
DECLARE
  owner_id uuid:='60000000-0000-0000-0000-000000000001';
  cycle uuid; session uuid; response uuid; result jsonb; token uuid; i integer;
  exercise jsonb:='{"kind":"drill","templateVersion":"counterargument-response-v2","competency":"rebuttalQuality"}';
  reassessment jsonb:='{"kind":"reassessment","templateVersion":"counterargument-response-v2","competency":"rebuttalQuality"}';
BEGIN
  cycle:=learning_open(owner_id,'61000000-0000-0000-0000-000000000001','62000000-0000-0000-0000-000000000001',gen_random_uuid(),exercise,reassessment);
  SELECT session_id INTO STRICT session FROM learning_runtime WHERE loop_id=cycle;
  FOR i IN 1..3 LOOP
    result:=learning_submit(owner_id,session,gen_random_uuid(),'initial','Saved answer',0);
    response:=(result->'response'->>'id')::uuid;
    token:=(result->'response'->>'lease_token')::uuid;
    IF NOT learning_finish(owner_id,response,token,NULL,'failed',jsonb_build_object('attempt',i)) THEN RAISE EXCEPTION 'Failure did not commit'; END IF;
  END LOOP;
  PERFORM pg_temp.expect_error(format('SELECT learning_submit(%L,%L,%L,''initial'',''Saved answer'',0)',owner_id,session,gen_random_uuid()),'54000');
  IF (SELECT count(*) FROM learning_evaluations WHERE response_id=response)<>3 THEN RAISE EXCEPTION 'Attempt history lost'; END IF;
  result:=grant_learning_evaluation_recovery(response,'phase-1-operator','provider_unavailable');
  IF NOT (result->>'granted')::boolean OR (result->>'attemptLimit')::integer<>4 THEN RAISE EXCEPTION 'Recovery not granted'; END IF;
  result:=grant_learning_evaluation_recovery(response,'phase-1-operator','provider_unavailable');
  IF (result->>'granted')::boolean THEN RAISE EXCEPTION 'Duplicate recovery granted'; END IF;
  result:=learning_submit(owner_id,session,gen_random_uuid(),'initial','Saved answer',0);
  IF NOT (result->>'claimed')::boolean OR (result->'response'->>'attempts')::integer<>4 THEN RAISE EXCEPTION 'Recovery attempt not claimed'; END IF;
  token:=(result->'response'->>'lease_token')::uuid;
  PERFORM learning_finish(owner_id,response,token,NULL,'failed','{"recovery":true}');
  PERFORM pg_temp.expect_error(format('SELECT learning_submit(%L,%L,%L,''initial'',''Saved answer'',0)',owner_id,session,gen_random_uuid()),'54000');
  IF (SELECT count(*) FROM learning_evaluations WHERE response_id=response)<>4 THEN RAISE EXCEPTION 'Recovery history incorrect'; END IF;
  IF (SELECT count(*) FROM learning_evaluation_recoveries WHERE response_id=response)<>1 THEN RAISE EXCEPTION 'Recovery audit incorrect'; END IF;
  IF (SELECT count(*) FROM learning_allowances WHERE user_id=owner_id)<>1 THEN RAISE EXCEPTION 'Recovery changed allowance'; END IF;
END $$;
RESET ROLE;

SELECT set_config('request.jwt.claim.sub','60000000-0000-0000-0000-000000000001',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_error($q$SELECT grant_learning_evaluation_recovery('63000000-0000-0000-0000-000000000001','learner','provider_unavailable')$q$,'42501');
SELECT pg_temp.expect_error('SELECT * FROM learning_evaluation_recoveries','42501');
RESET ROLE;

DELETE FROM public.debates WHERE id='61000000-0000-0000-0000-000000000001';
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM learning_evaluation_recoveries) THEN RAISE EXCEPTION 'Recovery audit cleanup failed'; END IF;
END $$;
ROLLBACK;
