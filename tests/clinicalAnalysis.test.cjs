const test = require('node:test');
const assert = require('node:assert/strict');
const {
  assessImageQuality,
  buildFollowUpQuestions,
  runRuleBasedTriage,
  mapSpecialty,
  mergeWithModelPossibilities,
  laplacianVariance,
} = require('../services/clinicalAnalysis.js');

// يبني صورة RGBA من دالة تُرجع شدة الرمادي لكل بكسل
function buildImage(width, height, valueAt) {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const v = Math.max(0, Math.min(255, Math.round(valueAt(x, y))));
      pixels[i] = v; pixels[i + 1] = v; pixels[i + 2] = v; pixels[i + 3] = 255;
    }
  }
  return pixels;
}

test('صورة موحّدة اللون تُصنّف كمضبابة لغياب أي تفاصيل', () => {
  const flat = buildImage(220, 220, () => 128);
  const report = assessImageQuality(flat, 220, 220);
  assert.equal(report.ok, false);
  assert.ok(report.issues.includes('blurry'));
  assert.equal(report.laplacianVariance, 0);
});

test('صورة عالية التباين (نمط شطرنجي) تُقبل كواضحة', () => {
  const sharp = buildImage(220, 220, (x, y) => ((x >> 2) + (y >> 2)) % 2 === 0 ? 20 : 235);
  const report = assessImageQuality(sharp, 220, 220);
  assert.equal(report.ok, true);
  assert.ok(report.laplacianVariance > 100);
  assert.match(report.messageAr, /مناسبة/);
});

test('الأبعاد الصغيرة والإضاءة المنخفضة تُرصد قبل التحليل', () => {
  const small = buildImage(120, 120, (x, y) => ((x >> 1) + (y >> 1)) % 2 === 0 ? 30 : 200);
  assert.ok(assessImageQuality(small, 120, 120).issues.includes('too_small'));

  const dark = buildImage(220, 220, (x, y) => (((x >> 2) + (y >> 2)) % 2 === 0 ? 5 : 15));
  assert.ok(assessImageQuality(dark, 220, 220).issues.includes('too_dark'));
});

test('الأسئلة الديناميكية تتضمّن المدة والحرارة والشدة دائمًا', () => {
  const base = buildFollowUpQuestions({ groupKey: 'abs' });
  const ids = base.map((q) => q.id);
  assert.ok(ids.includes('onset'));
  assert.ok(ids.includes('fever'));
  assert.ok(ids.includes('severity'));
});

test('الأسئلة الديناميكية تُضيف أسئلة جلدية عند سياق الجلد', () => {
  const skin = buildFollowUpQuestions({ groupKey: 'skin-rash' }).map((q) => q.id);
  assert.ok(skin.includes('itch'));
  assert.ok(skin.includes('asymmetry'));
});

test('علامة الإنذار ترفع الفرز إلى طوارئ قبل أي نتيجة للنموذج', () => {
  const triage = runRuleBasedTriage({ redFlags: ['ضيق نفس أو ألم ضاغط بالصدر'], severity: 3 });
  assert.equal(triage.urgency, 'emergency');
  assert.equal(triage.escalation, true);
  assert.equal(triage.specialtyKey, 'emergency');
});

test('حرارة مع انتشار تُرفع إلى عاجل اليوم', () => {
  const triage = runRuleBasedTriage({ fever: true, spreading: true, severity: 5, groupKey: 'abs' });
  assert.equal(triage.urgency, 'urgent');
  assert.equal(triage.escalation, true);
});

test('شدة عالية وحدها لا تُصنّف طوارئ بل تقييمًا سريعًا', () => {
  const triage = runRuleBasedTriage({ severity: 9, groupKey: 'lower-back' });
  assert.equal(triage.urgency, 'soon');
  assert.equal(triage.specialtyKey, 'orthopedics');
});

test('غياب المؤشرات يعني متابعة ذاتية وليست تشخيصًا', () => {
  const triage = runRuleBasedTriage({ severity: 2, groupKey: 'neck' });
  assert.equal(triage.urgency, 'self_care');
  assert.equal(triage.escalation, false);
});

test('توجيه التخصص يربط المنطقة بالتخصص الصحيح', () => {
  assert.equal(mapSpecialty('chest').key, 'cardiology');
  assert.equal(mapSpecialty('skin-rash').key, 'dermatology');
  assert.equal(mapSpecialty('abdomen').key, 'gastroenterology');
  assert.equal(mapSpecialty('unknown-area').key, 'general');
});

test('الدمج يُصرّح بأن النتائج احتمالات وليست تشخيصًا', () => {
  const triage = runRuleBasedTriage({ severity: 4, groupKey: 'knees' });
  const merged = mergeWithModelPossibilities(triage, ['التهاب وتر', 'شد عضلي']);
  assert.equal(merged.possibilities.length, 2);
  assert.match(merged.labelAr, /احتمالات مبدئية/);
  assert.match(merged.labelAr, /وليست تشخيصًا/);
});

test('تباين لابلاسيان يتصاعد مع حدّة الصورة', () => {
  const flat = buildImage(64, 64, () => 100);
  const edge = buildImage(64, 64, (x) => (x < 32 ? 0 : 255));
  const flatGray = Uint8Array.from(flat).filter((_, i) => i % 4 === 0);
  const edgeGray = Uint8Array.from(edge).filter((_, i) => i % 4 === 0);
  assert.ok(laplacianVariance(edgeGray, 64, 64) > laplacianVariance(flatGray, 64, 64));
});
