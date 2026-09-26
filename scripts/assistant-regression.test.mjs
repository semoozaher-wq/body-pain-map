import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';

const outfile = '.tmp-assistant-regression.cjs';
await build({
  entryPoints: ['services/aiAssistant/engine.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile,
  logLevel: 'error',
  loader: { '.json': 'json' },
});
const mod = await import(pathToFileURL(`${process.cwd()}/${outfile}`).href);
const analyze = mod.analyzeMessage;

test('recognizes commonly missed head and body areas', () => {
  const cases = [
    ['عندي ألم في عيني', 'eyes'],
    ['عندي ألم في ودني', 'ears'],
    ['عندي ألم في فكي', 'jaw'],
    ['سني بيوجعني', 'teeth'],
    ['حلقي بيوجعني', 'throat'],
    ['ألم في الثدي', 'breast'],
    ['ألم في المغبن', 'groin'],
  ];
  for (const [text, region] of cases) {
    const reply = analyze(text, 'ar');
    assert.ok(reply.regions.some((item) => item.id === region), `${text} should map to ${region}`);
    assert.ok(reply.selfCare.length > 0, `${text} should have guidance`);
  }
});

test('does not leak unrelated lower-limb diseases into testicular pain', () => {
  const reply = analyze('لدي الم في الخصيه اليمين', 'ar');
  assert.ok(reply.organs.some((item) => item.id === 'testicles'));
  assert.equal(reply.triage.level, 'urgent');
  assert.equal(reply.conditions.length, 0);
  assert.ok(reply.selfCare.some((tip) => tip.includes('ألم الخصية')));
});

test('recognizes sudden swollen testicular pain as an emergency', () => {
  const reply = analyze('ألم مفاجئ شديد في الخصية اليمين مع تورم', 'ar');
  assert.equal(reply.triage.level, 'emergency');
  assert.ok(reply.redFlags.some((flag) => flag.id === 'rf:testicular_torsion'));
});

test('recognizes foot wording and gives foot-specific guidance', () => {
  const reply = analyze('لدي الم في بقدم الشمال', 'ar');
  assert.ok(reply.regions.some((item) => item.id === 'feet'));
  assert.ok(reply.selfCare.some((tip) => tip.includes('القدم')));
});

fs.rmSync(outfile, { force: true });
