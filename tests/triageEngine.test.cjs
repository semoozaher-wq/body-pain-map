'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const engine = require('../services/triageEngine.js');
const tree = require('../data/triage/chest-pain.tree.json');

test('الشجرة العيّنة سليمة بنيويًا', () => {
  const report = engine.validateTree(tree);
  assert.strictEqual(report.ok, true, 'errors: ' + report.errors.join(', '));
  assert.ok(report.warnings.some((w) => w.indexOf('clinician_review_pending') === 0));
});

test('القاعدة rf_acs_cluster ترفع الحالة لطوارئ قبل إكمال الأسئلة', () => {
  const result = engine.evaluateTriage(tree, {
    red_flag_screen: ['pressure_15min', 'radiating_arm_jaw'],
  });
  assert.strictEqual(result.urgency, 'emergency');
  assert.strictEqual(result.ruleId, 'rf_acs_cluster');
  assert.strictEqual(result.complete, true);
  assert.strictEqual(result.validated, false);
});

test('الإغماء وحده كافٍ للتصنيف طوارئ', () => {
  const result = engine.evaluateTriage(tree, { red_flag_screen: ['fainting'] });
  assert.strictEqual(result.urgency, 'emergency');
  assert.strictEqual(result.ruleId, 'rf_fainting');
});

test('عدم اختيار أي علامة ينتقل للسؤال التالي بدل نتيجة مباشرة', () => {
  const step = engine.nextStep(tree, { red_flag_screen: ['none'] });
  assert.strictEqual(step.kind, 'question');
  assert.strictEqual(step.node.id, 'character');
});

test('مساري: ألم مجهود + عامل خطر + مدة 20 دقيقة = طوارئ', () => {
  const result = engine.evaluateTriage(tree, {
    red_flag_screen: ['none'],
    character: 'crushing_exertional',
    cardiac_risk: ['known_heart_disease'],
    duration_cardiac: 0.01,
  });
  assert.strictEqual(result.urgency, 'emergency');
  assert.strictEqual(result.via, 'tree');
});

test('نفس المسار بمدة نص يوم = تقييم خلال 24 ساعة، وبمدة 5 أيام = موعد قريب', () => {
  const base = {
    red_flag_screen: ['none'],
    character: 'crushing_exertional',
    cardiac_risk: ['diabetes'],
  };
  const urgent = engine.evaluateTriage(tree, Object.assign({}, base, { duration_cardiac: 0.5 }));
  const soon = engine.evaluateTriage(tree, Object.assign({}, base, { duration_cardiac: 5 }));
  assert.strictEqual(urgent.urgency, 'urgent');
  assert.strictEqual(soon.urgency, 'soon');
});

test('حرقان بعد الأكل = رعاية منزلية مع شرط مراجعة طبيب', () => {
  const result = engine.evaluateTriage(tree, {
    red_flag_screen: ['none'],
    character: 'burning_postprandial',
  });
  assert.strictEqual(result.urgency, 'self_care');
  assert.ok(result.actionsAr.join(' ').includes('أسبوعين'));
});

test('ألم حاد مع الشهيق + تورّم ساق = تقييم عاجل خلال 24 ساعة', () => {
  const result = engine.evaluateTriage(tree, {
    red_flag_screen: ['none'],
    character: 'pleuritic_inspiration',
    infection_screen: ['leg_swelling', 'recent_immobility'],
  });
  assert.strictEqual(result.urgency, 'urgent');
  assert.strictEqual(result.nodeId, 'O_PE_24H');
});

test('طبقة الذكاء الاصطناعي لا تستطيع تغيير درجة الخطورات', () => {
  const before = engine.evaluateTriage(tree, { red_flag_screen: ['none'], character: 'burning_postprandial' });
  const after = engine.mergeAiNarrative(before, 'الكلام اللي النموذج كتبه');
  assert.strictEqual(after.urgency, before.urgency);
  assert.strictEqual(after.aiNarrativeMutatesUrgency, false);
  const prompt = engine.buildAiExplanationPrompt(before, tree);
  assert.ok(prompt.includes('لا تغيّر درجة الخطورات'));
});

test('شجرة مكسورة تُرفض بالفحص ولا تُسقط المحرك', () => {
  const broken = {
    id: 'broken',
    start: 'a',
    disclaimerAr: 'x',
    clinicianReview: { required: true, reviewedBy: null },
    nodes: { a: { id: 'a', type: 'choice', questionAr: 'q', transitions: { yes: 'missing_node' } } },
  };
  const report = engine.validateTree(broken);
  assert.strictEqual(report.ok, false);
  assert.ok(report.errors.join(',').includes('dangling_target'));
  const result = engine.evaluateTriage(broken, { a: 'yes' });
  assert.strictEqual(result.complete, false);
  assert.strictEqual(result.error, 'missing_node');
});

test('ملفات الشجرة تُحمَّل من مسار data/triage', () => {
  const resolved = path.join(__dirname, '..', 'data', 'triage', 'chest-pain.tree.json');
  assert.strictEqual(tree.id, 'chest_pain');
  assert.ok(resolved.endsWith('chest-pain.tree.json'));
});
