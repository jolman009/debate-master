// Held-out inputs and ratings belong in restricted local storage, never Git.
import { readFileSync, writeFileSync } from 'node:fs';
const families=['counterargument','warrant','repair'], difficulties=['beginner','intermediate','advanced'], qualities=['low','medium','high'];
if(process.argv[2]==='--template') {
 const samples=[];
 for(const family of families)for(const difficulty of difficulties)for(const quality of qualities)for(let i=0;i<2;i++)samples.push({id:`${family}-${difficulty}-${quality}-${i+1}`,family,difficulty,quality,heldOut:true,response:null,exercise:null,raterA:null,raterB:null,adjudicated:null,ai:null,provenance:null});
 writeFileSync(process.argv[3],JSON.stringify(samples,null,2)+'\n');
} else {
 const rows=JSON.parse(readFileSync(process.argv[2],'utf8'));
 const rating=r=>r && (r.status==='insufficient' ? r.score===null : r.status==='valid' && Number.isInteger(r.score) && r.score>=1 && r.score<=10);
 const ready=rows.filter(r=>r.heldOut===true && typeof r.response==='string' && r.response.trim() && r.exercise && r.raterA?.id && r.raterB?.id && r.raterA.id!==r.raterB.id && rating(r.raterA) && rating(r.raterB) && rating(r.adjudicated) && rating(r.ai) && r.provenance?.model && r.provenance?.rubricVersion && r.provenance?.promptVersion && r.provenance?.templateVersion && r.provenance?.evaluatedAt);
 const metrics=rs=>{const valid=rs.filter(r=>r.adjudicated.status==='valid');const insufficient=rs.filter(r=>r.adjudicated.status==='insufficient');return {examples:rs.length,validExamples:valid.length,withinOne:valid.length?valid.filter(r=>r.ai.status==='valid' && Math.abs(r.ai.score-r.adjudicated.score)<=1).length/valid.length:null,insufficientExamples:insufficient.length,insufficientAgreement:insufficient.length?insufficient.filter(r=>r.ai.status==='insufficient').length/insufficient.length:null,classificationAgreement:rs.length?rs.filter(r=>r.ai.status===r.adjudicated.status).length/rs.length:null};};
 const result={total:rows.length,ready:ready.length,families:Object.fromEntries(families.map(f=>[f,metrics(ready.filter(r=>r.family===f))])),subgroups:Object.fromEntries(['difficulty','quality'].map(k=>[k,Object.fromEntries([...new Set(rows.map(r=>r[k]))].map(v=>[v,metrics(ready.filter(r=>r[k]===v))]))]))};
 const coverage=families.every(f=>difficulties.every(d=>qualities.every(q=>ready.filter(r=>r.family===f&&r.difficulty===d&&r.quality===q).length>=2)));
 result.proposedScoreThresholdMet=coverage && ready.length===rows.length && new Set(rows.map(r=>r.id)).size===rows.length && Object.values(result.families).every(m=>m.validExamples>0&&m.withinOne>=.8&&m.insufficientExamples>0);
 result.coachApprovalRequired=true;result.limitations='Score threshold is proposed, not approval. Review classification and disagreements independently; no educational-effectiveness claim.';
 console.log(JSON.stringify(result,null,2));if(!result.proposedScoreThresholdMet)process.exitCode=1;
}
