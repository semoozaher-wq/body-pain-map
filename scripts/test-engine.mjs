// scripts/test-engine.mjs — bundle the offline AI engine and run sample inputs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const outfile = path.resolve('.tmp-engine.cjs');
await build({
  entryPoints: ['services/aiAssistant/engine.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile,
  logLevel: 'error',
  loader: { '.json': 'json' },
});

const mod = await import(pathToFileURL(outfile).href);
const analyze = mod.analyzeMessage || mod.default?.analyzeMessage;

const samples = process.argv.slice(2);
const inputs = samples.length
  ? samples
  : [
      'حاسس بوجع في بطني على شمال السرة',
      'وجع في بطني على شمال السرة',
      'ألم في البطن على شمال السرة',
      'وجع في بطني على يمين السرة',
      'ألم تحت السرة',
      'ألم فوق السرة',
      'وجع في أسفل البطن يمين',
      'ألم في أسفل البطن شمال',
      'حاسس بألم في معدتي',
      'وجع في أسفل ضهري وبيمتد لرجلي',
      'صداع شديد ودوخة',
    ];

for (const text of inputs) {
  const r = analyze(text, 'ar');
  console.log('\n================ INPUT:', text);
  console.log('understood:', r.understood, '| triage:', r.triage.level);
  console.log('regions:', r.regions.map((x) => x.id).join(', ') || '-');
  console.log('organs :', r.organs.map((x) => x.id).join(', ') || '-');
  console.log('symptoms:', r.symptoms.map((x) => x.id).join(', ') || '-');
  console.log('conditions:');
  r.conditions.forEach((c) => console.log('   ', c.score, c.icd10, c.name.ar));
  console.log('selfCare:');
  r.selfCare.forEach((s) => console.log('   -', s));
}

fs.rmSync(outfile, { force: true });
