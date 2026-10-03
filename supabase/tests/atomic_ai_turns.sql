-- Run on staging after 019. All synthetic data rolls back.
BEGIN;
DO $$
DECLARE u uuid; d uuid:=gen_random_uuid(); a uuid; b uuid; n integer;
BEGIN
 SELECT id INTO u FROM auth.users ORDER BY created_at LIMIT 1;
 IF u IS NULL THEN RAISE EXCEPTION 'Requires a staging user'; END IF;
 INSERT INTO public.debates(id,user_id,config,current_stage) VALUES(d,u,'{"mode":"ai"}','opening_ai');
 a:=public.claim_ai_debate_turn(u,d,'opening_ai');
 IF a IS NULL OR public.claim_ai_debate_turn(u,d,'opening_ai') IS NOT NULL THEN RAISE EXCEPTION 'Exclusive claim failed'; END IF;
 IF public.commit_ai_debate_turn(u,d,'opening_ai','rebuttal_user_1','ai','test',gen_random_uuid()) THEN RAISE EXCEPTION 'Bad token accepted'; END IF;
 UPDATE public.debate_ai_leases SET expires_at=now()-interval '1 second' WHERE debate_id=d;
 b:=public.claim_ai_debate_turn(u,d,'opening_ai');
 IF b IS NULL OR b=a THEN RAISE EXCEPTION 'Expired lease not replaced'; END IF;
 IF public.commit_ai_debate_turn(u,d,'opening_ai','rebuttal_user_1','ai','test',a) THEN RAISE EXCEPTION 'Stale token accepted'; END IF;
 PERFORM public.release_ai_debate_turn(u,d,a);
 IF NOT public.commit_ai_debate_turn(u,d,'opening_ai','rebuttal_user_1','ai','test',b) THEN RAISE EXCEPTION 'Commit failed'; END IF;
 IF public.commit_ai_debate_turn(u,d,'opening_ai','rebuttal_user_1','ai','test',b) THEN RAISE EXCEPTION 'Duplicate commit'; END IF;
 SELECT count(*) INTO n FROM public.debate_turns WHERE debate_id=d;
 IF n<>1 THEN RAISE EXCEPTION 'Duplicate persisted turn'; END IF;
 BEGIN
  PERFORM public.commit_ai_debate_turn(u,d,'rebuttal_user_1','rebuttal_ai_1','user','');
  RAISE EXCEPTION 'Empty turn accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL;
 END;
 IF (SELECT current_stage FROM public.debates WHERE id=d)<>'rebuttal_user_1' THEN RAISE EXCEPTION 'Failed insert advanced stage'; END IF;
 BEGIN
  PERFORM public.claim_ai_debate_turn(gen_random_uuid(),d,'rebuttal_user_1');
  RAISE EXCEPTION 'Foreign owner accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 IF has_function_privilege('authenticated','public.claim_ai_debate_turn(uuid,uuid,text)','EXECUTE')
 OR has_function_privilege('anon','public.commit_ai_debate_turn(uuid,uuid,text,text,text,text,uuid)','EXECUTE') THEN RAISE EXCEPTION 'Client RPC privilege leak'; END IF;
END $$;
SELECT true AS passed;
ROLLBACK;
