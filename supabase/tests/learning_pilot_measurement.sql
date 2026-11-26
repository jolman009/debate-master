-- Content-free synthetic cohort; rolls back all fixtures.
BEGIN;
DO $$
DECLARE u uuid:=gen_random_uuid(); v uuid:=gen_random_uuid(); d uuid:=gen_random_uuid(); e uuid:=gen_random_uuid(); t uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); s uuid:=gen_random_uuid(); r jsonb;
BEGIN
 INSERT INTO auth.users(id) VALUES(u),(v);
 INSERT INTO public.debates(id,user_id,config,current_stage) VALUES(d,u,'{"mode":"ai"}','opening_user'),(e,v,'{"mode":"ai"}','opening_user');
 INSERT INTO public.lifecycle_events(user_id,session_id,event_name,occurred_at) VALUES(u,d,'debate_completed','2026-01-01'),(v,e,'debate_completed','2026-01-07');
 INSERT INTO public.debate_turns(id,debate_id,stage,role,content) VALUES(t,d,'opening_user','user','Synthetic fixture');
 INSERT INTO public.learning_cycles(id,user_id,origin_debate_id,cited_turn_id,target_competency,request_id) VALUES(c,u,d,t,'rebuttalQuality',gen_random_uuid());
 INSERT INTO public.learning_sessions(id,user_id,loop_id,session_type,request_id) VALUES(s,u,c,'debate',gen_random_uuid());
 INSERT INTO public.learning_events(user_id,session_id,loop_id,entity_id,event_name,occurred_at) VALUES(u,s,c,s,'cycle_completed','2026-01-05');
 INSERT INTO public.learning_recommendation_outcomes(user_id,debate_id,reason,first_seen_at) VALUES(u,d,'no_approved_template','2026-01-01');
 r:=public.learning_pilot_report(ARRAY[u,u,v],'2026-01-01','2026-01-08','2026-01-09');
 IF (r->>'cohortSize')::int<>2 OR (r->>'maturedDenominator')::int<>1 OR (r->>'completedNumerator')::int<>1 OR (r->>'pendingFollowup')::int<>1 OR (r->>'unavailableLearners')::int<>1 THEN RAISE EXCEPTION 'Cohort accounting failed: %',r; END IF;
 r:=public.learning_pilot_report(ARRAY[u,v],'2026-01-01','2026-01-08','2026-01-15');
 IF (r->>'maturedDenominator')::int<>2 OR (r->>'completionRate')::numeric<>0.5 THEN RAISE EXCEPTION 'Matured denominator failed'; END IF;
 INSERT INTO public.coaching_usefulness(user_id,debate_id,rating) VALUES(u,d,'reported');
 UPDATE public.coaching_usefulness SET review_disposition='prompt_review',reviewed_at=now() WHERE user_id=u;
 IF EXISTS(SELECT 1 FROM pg_class WHERE oid IN ('public.coaching_usefulness'::regclass,'public.learning_recommendation_outcomes'::regclass) AND NOT relrowsecurity) THEN RAISE EXCEPTION 'RLS missing'; END IF;
 IF has_table_privilege('authenticated','public.coaching_usefulness','SELECT') OR has_table_privilege('anon','public.learning_recommendation_outcomes','INSERT') OR has_function_privilege('authenticated','public.learning_pilot_report(uuid[],timestamptz,timestamptz,timestamptz)','EXECUTE') THEN RAISE EXCEPTION 'Client privileges leaked'; END IF;
END $$;
SELECT true AS passed;
ROLLBACK;
