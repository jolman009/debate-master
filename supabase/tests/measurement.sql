-- Run in a disposable migrated database as postgres. Rolls back all fixtures.
BEGIN;
INSERT INTO auth.users(id) VALUES ('00000000-0000-0000-0000-000000000015');
INSERT INTO public.debates(id,user_id,config) VALUES ('00000000-0000-0000-0000-000000000016','00000000-0000-0000-0000-000000000015','{}');
UPDATE public.debates SET current_stage='feedback' WHERE id='00000000-0000-0000-0000-000000000016';
UPDATE public.debates SET current_stage='complete',feedback='{}' WHERE id='00000000-0000-0000-0000-000000000016';
UPDATE public.debates SET current_stage='complete',feedback='{}' WHERE id='00000000-0000-0000-0000-000000000016';
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000015',true);
SELECT public.record_coaching_view('00000000-0000-0000-0000-000000000016');
SELECT public.record_coaching_view('00000000-0000-0000-0000-000000000016');
DO $$ BEGIN
  IF (SELECT count(*) FROM public.lifecycle_events WHERE session_id='00000000-0000-0000-0000-000000000016') <> 4 THEN RAISE EXCEPTION 'Expected exactly four lifecycle events'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000017',true);
DO $$ BEGIN
  BEGIN
    PERFORM public.record_coaching_view('00000000-0000-0000-0000-000000000016');
    RAISE EXCEPTION 'Ownership check failed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Session not available' THEN RAISE; END IF;
  END;
END $$;
ROLLBACK;
