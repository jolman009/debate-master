import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'node:fs';
if (process.argv.includes('--help')) { console.log('node scripts/learning-pilot-report.mjs cohort.json report.json\nCohort: {userIds:[],start,end,asOf}; explicit STAGING_SUPABASE_URL and STAGING_SUPABASE_SERVICE_ROLE_KEY required.'); process.exit(0); }
const url=process.env.STAGING_SUPABASE_URL,key=process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY;
if(url!=='https://twtsdothnlfvbczzpdaj.supabase.co'||!key)throw new Error('Known staging URL and service key required');
const c=JSON.parse(readFileSync(process.argv[2],'utf8'));
if(!Array.isArray(c.userIds)||!c.userIds.length)throw new Error('Freeze explicit cohort userIds before reporting');
const db=createClient(url,key,{auth:{persistSession:false}});
const {data,error}=await db.rpc('learning_pilot_report',{p_users:c.userIds,p_start:c.start,p_end:c.end,p_as_of:c.asOf});
if(error)throw new Error(`Report failed: ${error.code}`);
const result={...data,limitation:'Retained lifecycle history only; deleted accounts or missing historical events can change the cohort. Not proof of transferable learning.'};
writeFileSync(process.argv[3],JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
