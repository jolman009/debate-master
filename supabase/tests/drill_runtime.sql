-- Disposable migrated database as postgres. Stop on error. All fixtures roll back.
BEGIN;
CREATE FUNCTION pg_temp.expect_error(command text, expected text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE command;
  EXCEPTION WHEN OTHERS THEN IF SQLSTATE=expected THEN RETURN; END IF; RAISE; END;
  RAISE EXCEPTION 'Expected SQLSTATE %',expected;
END $$;
INSERT INTO auth.users(id) VALUES ('50000000-0000-0000-0000-000000000001'),('50000000-0000-0000-0000-000000000002');
INSERT INTO public.debates(id,user_id,config,current_stage,feedback,assessment_status) VALUES
 ('51000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','{}','complete','{}','valid'),
 ('51000000-0000-0000-0000-000000000002','50000000-0000-0000-0000-000000000001','{}','complete','{}','valid');
INSERT INTO public.debate_turns(id,debate_id,stage,role,content) VALUES
 ('52000000-0000-0000-0000-000000000001','51000000-0000-0000-0000-000000000001','opening_user','user','Synthetic response'),
 ('52000000-0000-0000-0000-000000000002','51000000-0000-0000-0000-000000000002','opening_user','user','Another synthetic response');
SET LOCAL ROLE service_role;
DO $$
DECLARE
  owner_id uuid:='50000000-0000-0000-0000-000000000001';
  cycle uuid; session uuid; retest uuid; req uuid:=gen_random_uuid(); response uuid; token uuid; old_token uuid;
  result jsonb; duplicate jsonb; revision integer;
  exercise jsonb:='{"kind":"drill","templateVersion":"counterargument-response-v1","competency":"rebuttalQuality"}';
  reassessment jsonb:='{"kind":"reassessment","templateVersion":"counterargument-response-v1","competency":"rebuttalQuality"}';
BEGIN
  cycle:=learning_open(owner_id,'51000000-0000-0000-0000-000000000001','52000000-0000-0000-0000-000000000001',req,exercise,reassessment);
  IF learning_open(owner_id,'51000000-0000-0000-0000-000000000001','52000000-0000-0000-0000-000000000001',req,exercise,reassessment)<>cycle THEN RAISE EXCEPTION 'Open retry duplicated'; END IF;
  SELECT session_id INTO STRICT session FROM learning_runtime WHERE loop_id=cycle;
  PERFORM pg_temp.expect_error(format('SELECT learning_open(%L,%L,%L,%L,%L,%L,true)',owner_id,
    '51000000-0000-0000-0000-000000000002','52000000-0000-0000-0000-000000000002',gen_random_uuid(),exercise,reassessment),'P0001');
  PERFORM pg_temp.expect_error(format('SELECT learning_reassess(%L,%L,%L)',owner_id,cycle,gen_random_uuid()),'22023');
  PERFORM pg_temp.expect_error(format('SELECT learning_submit(%L,%L,%L,''revision'',''too soon'',0)',owner_id,session,gen_random_uuid()),'22023');
  PERFORM pg_temp.expect_error(format('SELECT learning_save_draft(%L,%L,''stolen'',0)','50000000-0000-0000-0000-000000000002',session),'40001');
  revision:=learning_save_draft(owner_id,session,'My answer',0);
  PERFORM pg_temp.expect_error(format('SELECT learning_save_draft(%L,%L,''stale'',0)',owner_id,session),'40001');
  PERFORM learning_view(owner_id,session); PERFORM learning_view(owner_id,session);
  result:=learning_submit(owner_id,session,gen_random_uuid(),'initial','My answer',revision);
  response:=(result->'response'->>'id')::uuid; token:=(result->'response'->>'lease_token')::uuid;
  duplicate:=learning_submit(owner_id,session,gen_random_uuid(),'initial','My answer',revision);
  IF NOT (result->>'claimed')::boolean OR (duplicate->>'claimed')::boolean OR duplicate->'response'->>'id'<>response::text THEN RAISE EXCEPTION 'Duplicate evaluation claim'; END IF;
  PERFORM pg_temp.expect_error(format('SELECT learning_submit(%L,%L,%L,''initial'',''different'',%L)',owner_id,session,gen_random_uuid(),revision),'22023');
  PERFORM pg_temp.expect_error(format('SELECT learning_finish(%L,%L,%L,%L,''valid'',''{}'')',owner_id,response,token,'{"status":"valid","score":5.5}'),'22023');
  -- Simulate lease expiry, then a new claim. The old worker cannot commit.
  UPDATE learning_responses SET lease_until=now()-interval '1 second' WHERE id=response;
  old_token:=token;
  result:=learning_submit(owner_id,session,gen_random_uuid(),'initial','My answer',revision);
  token:=(result->'response'->>'lease_token')::uuid;
  IF learning_finish(owner_id,response,old_token,'{"status":"valid","score":6}','valid','{"totalTokens":10}') THEN RAISE EXCEPTION 'Stale worker committed'; END IF;
  IF NOT learning_finish(owner_id,response,token,'{"status":"valid","score":6}','valid','{"totalTokens":10}') THEN RAISE EXCEPTION 'Current worker failed'; END IF;
  IF (SELECT state FROM learning_runtime WHERE session_id=session)<>'coached' THEN RAISE EXCEPTION 'No coached transition'; END IF;
  PERFORM learning_view(owner_id,session,response); PERFORM learning_view(owner_id,session,response);
  revision:=learning_save_draft(owner_id,session,'Revised answer',2);
  result:=learning_submit(owner_id,session,gen_random_uuid(),'revision','Revised answer',revision);
  PERFORM learning_finish(owner_id,(result->'response'->>'id')::uuid,(result->'response'->>'lease_token')::uuid,'{"status":"insufficient","score":null}','insufficient','{}');
  IF (SELECT state FROM learning_runtime WHERE session_id=session)<>'completed' THEN RAISE EXCEPTION 'Insufficient must allow completion'; END IF;
  retest:=learning_reassess(owner_id,cycle,gen_random_uuid());
  IF learning_reassess(owner_id,cycle,gen_random_uuid())<>retest THEN RAISE EXCEPTION 'Duplicate reassessment'; END IF;
  PERFORM learning_view(owner_id,retest);
  result:=learning_submit(owner_id,retest,gen_random_uuid(),'reassessment','Retest answer',0);
  response:=(result->'response'->>'id')::uuid; token:=(result->'response'->>'lease_token')::uuid;
  PERFORM learning_finish(owner_id,response,token,NULL,'invalid','{}');
  IF EXISTS (SELECT 1 FROM learning_events WHERE loop_id=cycle AND event_name='cycle_completed') THEN RAISE EXCEPTION 'Invalid counted as completed'; END IF;
  result:=learning_submit(owner_id,retest,gen_random_uuid(),'reassessment','Retest answer',0);
  token:=(result->'response'->>'lease_token')::uuid;
  PERFORM learning_finish(owner_id,response,token,'{"status":"valid","score":7}','valid','{}');
  IF learning_finish(owner_id,response,token,'{"status":"valid","score":7}','valid','{}') THEN RAISE EXCEPTION 'Duplicate finish accepted'; END IF;
  IF (SELECT count(*) FROM learning_events WHERE loop_id=cycle AND event_name='cycle_completed')<>1 THEN RAISE EXCEPTION 'Cycle completion count'; END IF;
  IF (SELECT count(*) FROM learning_events WHERE loop_id=cycle AND event_name='drill_started')<>1 THEN RAISE EXCEPTION 'Start duplicated'; END IF;
  IF (SELECT count(*) FROM learning_events WHERE loop_id=cycle AND event_name='coaching_viewed')<>1 THEN RAISE EXCEPTION 'View duplicated'; END IF;
  IF (SELECT count(*) FROM learning_events WHERE loop_id=cycle AND event_name='response_submitted')<>3 THEN RAISE EXCEPTION 'Response events duplicated'; END IF;
  IF (SELECT count(*) FROM learning_allowances WHERE user_id=owner_id)<>1 THEN RAISE EXCEPTION 'Allowance duplicated'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','50000000-0000-0000-0000-000000000002',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM learning_runtime) OR EXISTS(SELECT 1 FROM learning_responses) OR EXISTS(SELECT 1 FROM learning_events) THEN RAISE EXCEPTION 'Cross-user read'; END IF;
  PERFORM pg_temp.expect_error('SELECT learning_save_draft(NULL,NULL,'''',0)','42501');
  PERFORM pg_temp.expect_error('UPDATE learning_runtime SET state=''completed''','42501');
  PERFORM pg_temp.expect_error('DELETE FROM learning_allowances','42501');
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','50000000-0000-0000-0000-000000000001',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF (SELECT count(*) FROM learning_runtime)<>2 OR (SELECT count(*) FROM learning_responses)<>3 THEN RAISE EXCEPTION 'Owner read failed'; END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE anon;
SELECT pg_temp.expect_error('SELECT * FROM learning_runtime','42501');
RESET ROLE;
DELETE FROM public.debates WHERE id='51000000-0000-0000-0000-000000000001';
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM learning_runtime) OR EXISTS(SELECT 1 FROM learning_responses) OR EXISTS(SELECT 1 FROM learning_evaluations) OR EXISTS(SELECT 1 FROM learning_events) THEN RAISE EXCEPTION 'Cleanup failed'; END IF;
  IF NOT EXISTS(SELECT 1 FROM learning_allowances WHERE user_id='50000000-0000-0000-0000-000000000001' AND loop_id IS NULL) THEN RAISE EXCEPTION 'Deletion reset allowance'; END IF;
END $$;
ROLLBACK;
