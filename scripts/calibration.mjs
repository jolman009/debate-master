import { readFileSync, writeFileSync } from 'node:fs';
const dimensions = ['argumentStrength', 'evidenceUsage', 'rebuttalQuality', 'rhetoricalSkill'];
if (process.argv[2] === '--template') {
  const samples = [];
  for (const difficulty of ['beginner', 'intermediate', 'advanced'])
    for (const topic of ['education', 'technology', 'environment', 'public_policy'])
      for (const stance of ['pro', 'con'])
        for (const quality of ['low', 'medium', 'high'])
          samples.push({ id: `sample-${samples.length + 1}`, difficulty, topic, stance, quality, transcript: null, consent: false, rubricVersion: 'debate-anchors-1', raterA: null, raterB: null, adjudicated: null, ai: null });
  writeFileSync(process.argv[3], JSON.stringify(samples, null, 2) + '\n');
} else {
  const samples = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  const valid = score => dimensions.every(d => Number.isInteger(score?.[d]) && score[d] >= 1 && score[d] <= 10);
  const ready = samples.filter(s => s.transcript && s.consent && s.raterA?.id && s.raterB?.id && s.raterA.id !== s.raterB.id && valid(s.raterA.scores) && valid(s.raterB.scores) && valid(s.adjudicated) && valid(s.ai) && s.rubricVersion === 'debate-anchors-1');
  function summarize(rows) {
    return { samples: rows.length, dimensions: Object.fromEntries(dimensions.map(d => [d, rows.length ? rows.filter(s => Math.abs(s.ai[d] - s.adjudicated[d]) <= 1).length / rows.length : null])) };
  }
  const result = { total: samples.length, ready: ready.length, overall: summarize(ready), subgroups: Object.fromEntries(['difficulty', 'topic', 'stance', 'quality'].map(key => [key, Object.fromEntries([...new Set(samples.map(s => s[key]))].map(value => [value, summarize(ready.filter(s => s[key] === value))]))])) };
  result.gate = ready.length >= 60 && ready.length === samples.length && new Set(samples.map(s => s.id)).size === samples.length && Object.values(result.overall.dimensions).every(n => n >= .8);
  console.log(JSON.stringify(result, null, 2));
  if (!result.gate) process.exitCode = 1;
}
