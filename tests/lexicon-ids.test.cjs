'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf-8');
const extractAllIds = (content) => {
  const ids = new Set();
  const re = /['"](local:[a-zA-Z0-9-]+|doid:[a-zA-Z0-9-]+)['"]/g;
  let m;
  while ((m = re.exec(content)) !== null) ids.add(m[1]);
  return ids;
};

test('كل IDs في lexicon موجودة في diseaseLibrary', () => {
  const lexicon = read('services/aiAssistant/lexicon.ts');
  const library = read('services/medical/diseaseLibrary.ts');
  const lexiconIds = extractAllIds(lexicon);
  const libraryIds = extractAllIds(library);
  const missing = [...lexiconIds].filter((id) => !libraryIds.has(id));
  assert.equal(
    missing.length, 0,
    'IDs مستخدمة في lexicon لكن مش موجودة في diseaseLibrary:\n' + missing.join('\n')
  );
});
