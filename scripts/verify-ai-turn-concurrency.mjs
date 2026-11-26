// Migration 019; explicit staging target only. No provider calls.
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
const ref = process.argv[2], url = process.env.STAGING_SUPABASE_URL, key = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY;
if (process.argv.includes('--help')) { console.log('STAGING_SUPABASE_URL and STAGING_SUPABASE_SERVICE_ROLE_KEY required. node scripts/verify-ai-turn-concurrency.mjs <staging-ref> [report.json]'); process.exit(0); }
if (ref !== 'twtsdothnlfvbczzpdaj' || url !== `https://${ref}.supabase.co` || !key) throw new Error('Explicit known staging target and key required; .env.local is never loaded.');
const db = createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const report = { target: ref, checks: [], cleanup: [], passed: false };
const must = r => { if(r.error) throw new Error(`Database failure: ${r.error.code ?? 'unknown'}`); return r.data; };
const check = (name, pass) => { report.checks.push({name,passed:!!pass}); if(!pass) throw new Error(name); };
let user; const debate = randomUUID();
const args = {p_debate_id:debate,p_stage:'opening_ai'};
const parallel = (name,p) => Promise.all(Array.from({length:8},()=>db.rpc(name,p))).then(rs=>rs.map(must));
try {
 user = must(await db.auth.admin.createUser({email:`atomic-turn-${randomUUID()}@example.invalid`,password:randomUUID()+randomUUID(),email_confirm:true})).user.id;
 must(await db.from('debates').insert({id:debate,user_id:user,config:{mode:'ai'},current_stage:'opening_ai'}));
 args.p_user_id=user;
 const leases=await parallel('claim_ai_debate_turn',args);
 check('one claim among eight clients',leases.filter(Boolean).length===1);
 const token=leases.find(Boolean);
 const commit={...args,p_next_stage:'rebuttal_user_1',p_role:'ai',p_content:'Synthetic complete answer',p_token:token};
 const commits=await parallel('commit_ai_debate_turn',commit);
 check('one atomic commit among eight retries',commits.filter(Boolean).length===1);
 check('one persisted AI turn',must(await db.from('debate_turns').select('id').eq('debate_id',debate)).length===1);
 check('stage advanced',must(await db.from('debates').select('current_stage').eq('id',debate).single()).current_stage==='rebuttal_user_1');
 check('old stage cannot claim',must(await db.rpc('claim_ai_debate_turn',args))===null);
 // New user turn and AI stage for lease replacement/fencing.
 must(await db.rpc('commit_ai_debate_turn',{...args,p_stage:'rebuttal_user_1',p_next_stage:'rebuttal_ai_1',p_role:'user',p_content:'Synthetic user reply'}));
 args.p_stage='rebuttal_ai_1';
 const old=must(await db.rpc('claim_ai_debate_turn',args));
 must(await db.from('debate_ai_leases').update({expires_at:new Date(0).toISOString()}).eq('debate_id',debate));
 const fresh=must(await db.rpc('claim_ai_debate_turn',args));
 check('expired lease replaced',!!fresh && fresh!==old);
 check('stale worker rejected',must(await db.rpc('commit_ai_debate_turn',{...commit,...args,p_token:old,p_next_stage:'closing_user'}))===false);
 must(await db.rpc('release_ai_debate_turn',{p_user_id:user,p_debate_id:debate,p_token:old}));
 check('old release cannot remove new lease',must(await db.from('debate_ai_leases').select('token').eq('debate_id',debate).single()).token===fresh);
 must(await db.rpc('release_ai_debate_turn',{p_user_id:user,p_debate_id:debate,p_token:fresh}));
 check('explicit retry can acquire released lease',!!must(await db.rpc('claim_ai_debate_turn',args)));
 const denied=await db.rpc('claim_ai_debate_turn',{...args,p_user_id:randomUUID()});
 check('foreign owner rejected',denied.error?.code==='42501');
 report.passed=true;
} catch(e) { report.failure=e.message; process.exitCode=1; }
finally {
 if(user) {
  for(const [name,task] of [['delete fixture debate',()=>db.from('debates').delete().eq('id',debate).eq('user_id',user)],['delete fixture identity',()=>db.auth.admin.deleteUser(user)]]) {
   try { must(await task()); report.cleanup.push({name,passed:true}); } catch {report.cleanup.push({name,passed:false});report.passed=false;process.exitCode=1;}
  }
 }
 console.log(JSON.stringify(report,null,2)); if(process.argv[3]) writeFileSync(process.argv[3],JSON.stringify(report,null,2)+'\n');
}
