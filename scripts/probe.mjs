import { buildSync } from 'esbuild';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);
function bundle(entry, name) {
  const outfile = path.join(os.tmpdir(), `${name}-${process.pid}.cjs`);
  buildSync({ entryPoints: [path.resolve(root, entry)], bundle: true, platform: 'node', format: 'cjs', outfile, logLevel: 'error', loader: { '.json': 'json' } });
  return require(outfile);
}
const ai = bundle('services/aiAssistant/engine.ts', 'ai-engine');
const phrases = [
  'عندي وجع في رجلي من تحت',
  'في الساق',
  'ناحية الخلف',
  'شدته 7 من 10',
  'بطني بتوجعني',
  'وسط الظهر',
  'جنب الشمال بيوجعني',
  'في وجع في جنبي',
  'ألم في أسفل ظهري وبينزل على رجلي من 3 أيام',
  'عندي وجع في ظهري',
  'ضهري بيوجعني',
  'عندي وجع تحت صدري بشوية',
  'رجلي بتوجعني',
  'كعب رجلي بيوجعني',
  'قدمي بتوجعني',
];
for (const p of phrases) {
  const r = ai.analyzeMessage(p, 'ar', false, { askCount: 0, userTurnCount: 1 });
  const rl = ai.detectRegionLocations(p).map(x=>x.id);
  console.log(`\n>> ${p}`);
  console.log(`   regions=[${r.regions.map(x=>x.id).join(',')}] regionLocations=[${rl.join(',')}] abdLoc=[${r.locations.map(x=>x.id).join(',')}]`);
  console.log(`   clarificationOnly=${r.clarificationOnly} clarifyingQ=${r.clarifyingQuestion?.ar ?? '-'}`);
  console.log(`   followUp=${r.followUpQuestion?.ar ?? '-'}`);
}
