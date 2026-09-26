#!/usr/bin/env node
'use strict';

/**
 * فحص كل أشجار الفرز في data/triage قبل الدمج.
 * يفشل بخرج 1 عند أي خطأ بنيوي، ويحذّر (بلا فشل) عند غياب مراجعة الطبيب.
 * الاستخدام: node scripts/validate-triage-tree.js
 */

const fs = require('node:fs');
const path = require('node:path');
const { validateTree } = require('../services/triageEngine.js');

const dir = path.join(__dirname, '..', 'data', 'triage');
if (!fs.existsSync(dir)) {
  console.log('لا يوجد مجلد data/triage — لا شيء لفحصه.');
  process.exit(0);
}

const files = fs.readdirSync(dir).filter((f) => f.endsWith('.tree.json'));
let failed = 0;
let warned = 0;

files.forEach((file) => {
  const full = path.join(dir, file);
  let tree;
  try {
    tree = JSON.parse(fs.readFileSync(full, 'utf8'));
  } catch (error) {
    console.error('✗ ' + file + ' — JSON غير صالح: ' + error.message);
    failed++;
    return;
  }
  const report = validateTree(tree);
  if (!report.ok) {
    console.error('✗ ' + file);
    report.errors.forEach((e) => console.error('    error: ' + e));
    failed++;
  } else {
    console.log('✓ ' + file + ' (' + Object.keys(tree.nodes || {}).length + ' عقدة، ' + ((tree.redFlagRules || []).length) + ' قاعدة إنذار)');
  }
  report.warnings.forEach((w) => {
    console.warn('    ! ' + w);
    warned++;
  });
});

console.log('\nالمصفوفة: ' + files.length + ' شجرة، ' + failed + ' فاشلة، ' + warned + ' تحذير.');
if (failed > 0) process.exit(1);
