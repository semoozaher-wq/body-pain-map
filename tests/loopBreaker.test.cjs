'use strict';

// اختبارات كسر حلقة أسئلة الموقع (clarification loop breaker) لمحرّك المساعد الذكي.
// المحرّك مكتوب بـ TypeScript، فنحزمه بـ esbuild إلى ملف مؤقت ثم نستورده،
// بنفس الطريقة التي يعمل بها scripts/assistant-regression.test.mjs.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const { buildSync } = require('esbuild');

const outfile = path.join(os.tmpdir(), `loop-breaker-${process.pid}.cjs`);
buildSync({
  entryPoints: [path.resolve(__dirname, '../services/aiAssistant/engine.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile,
  logLevel: 'error',
  loader: { '.json': 'json' },
});

const engine = require(outfile);
const analyzeMessage = engine.analyzeMessage;
const mentionsGenericArea = engine.mentionsGenericArea;

/** نفس منطق شاشة المساعد: عدّاد للأسئلة المتتالية + forceAnswer. */
const MAX_ASKS = 2;

function runConversation(messages, language = 'ar') {
  let accumulated = '';
  let askCount = 0;
  const turns = [];
  messages.forEach((message, index) => {
    accumulated = `${accumulated} ${message}`.trim();
    const userTurnCount = index + 1;
    const forceAnswer = askCount >= MAX_ASKS;
    const reply = analyzeMessage(accumulated, language, false, {
      forceAnswer,
      askCount,
      userTurnCount,
    });
    turns.push({ message, forceAnswer, reply });
    askCount = reply.clarificationOnly ? askCount + 1 : 0;
  });
  return turns;
}

// ---------------------------------------------------------------------------
// 1) السيناريو المُبلَّغ عنه: 5 رسائل متتالية بدون إجابة نهائية
// ---------------------------------------------------------------------------
test('حلقة الأسئلة تنكسر: المحادثة المُبلَّغ عنها تنتهي بإجابة كاملة', () => {
  const turns = runConversation([
    'جمبي الشمال من فوق بيوجعني',
    'طهري من تحت بيوجعني',
    'وسط الظهر',
    'بطني من الجنب اليمين بتوجعني',
    'الوجه اللي في بطني من الجنب اليمين دي ايه',
  ]);

  // لا يجوز أن يُسأل المستخدم أكثر من سؤالين متتاليين أبدًا.
  const asked = turns.filter((turn) => turn.reply.clarificationOnly).length;
  assert.ok(asked <= MAX_ASKS, `عدد الأسئلة المتتالية يجب ألا يزيد عن ${MAX_ASKS}، لكنه ${asked}`);

  // الرسالة الثالثة يجب أن تعطي إجابة كاملة بدون سؤال إضافي.
  const third = turns[2];
  assert.equal(third.reply.clarificationOnly, false, 'الرسالة الثالثة يجب ألا تسأل مرة أخرى');
  assert.equal(third.reply.clarifyingQuestion, null, 'لا يوجد سؤال توضيحي في الرسالة الثالثة');
  assert.ok(third.reply.conditions.length > 0, 'يجب عرض حالات محتملة');
  assert.ok(third.reply.selfCare.length > 0, 'يجب عرض رعاية ذاتية');

  // وكل الرسائل بعدها إجابات كاملة كذلك.
  for (const turn of turns.slice(2)) {
    assert.equal(turn.reply.clarificationOnly, false, `"${turn.message}" يجب أن تكون إجابة كاملة`);
    assert.ok(turn.reply.conditions.length > 0, `"${turn.message}" يجب أن تعرض حالات محتملة`);
  }
});

// ---------------------------------------------------------------------------
// 2) معايير القبول حرفيًا: سؤال 1 → سؤال 2 → إجابة كاملة
// ---------------------------------------------------------------------------
test('معايير القبول: بعد سؤالين على الأكثر نصل لإجابة كاملة', () => {
  const turns = runConversation(['في وجع في جنبي', 'ضهري من تحت', 'وسط الظهر']);

  assert.equal(turns[0].reply.clarificationOnly, true, 'الرسالة الأولى تسأل عن الموقع');
  assert.equal(turns[0].reply.clarifyingQuestion !== null, true);
  assert.equal(turns[1].reply.clarificationOnly, true, 'الرسالة الثانية تسأل عن الموقع');
  assert.equal(turns[1].forceAnswer, false, 'السؤال الثاني ما زال مسموحًا');

  const third = turns[2];
  assert.equal(third.forceAnswer, true, 'حلقة الأسئلة استُنفدت فيُفرض الرد');
  assert.equal(third.reply.clarificationOnly, false, 'الرسالة الثالثة إجابة كاملة');
  assert.ok(third.reply.conditions.length > 0);
  assert.ok(third.reply.selfCare.length > 0);
});

// ---------------------------------------------------------------------------
// 3) السقف الصلب: من رسالة المستخدم الثالثة نرد دائمًا، حتى بدون forceAnswer
// ---------------------------------------------------------------------------
test('السقف الصلب: userTurnCount >= 3 يلغي السؤال حتى لو كان الموقع ناقصًا', () => {
  const reply = analyzeMessage('حاسة بألم', 'ar', false, { userTurnCount: 3 });
  assert.equal(reply.clarificationOnly, false, 'الرسالة الثالثة لا تسأل');
  assert.ok(reply.selfCare.length > 0, 'يجب تقديم رعاية ذاتية عامة');
});

// ---------------------------------------------------------------------------
// 4) forceAnswer يتجاوز السؤال تمامًا
// ---------------------------------------------------------------------------
test('forceAnswer = true يلغي askForLocation ويعطي الإجابة الكاملة', () => {
  for (const text of ['جمبي', 'الجنب', 'في وجع في جنبي']) {
    const reply = analyzeMessage(text, 'ar', false, { forceAnswer: true });
    assert.equal(reply.clarificationOnly, false, `"${text}" يجب ألا تسأل مع forceAnswer`);
    assert.equal(reply.clarifyingQuestion, null);
    assert.ok(reply.selfCare.length > 0, `"${text}" يجب أن تعطي رعاية ذاتية`);
  }
});

// ---------------------------------------------------------------------------
// 5) العدّاد لا يُصفَّر على أسئلة الموقع المتتالية (سبب تكرار السؤال)
// ---------------------------------------------------------------------------
test('كلمة مكان عامة ("من فوق") لا تُصفِّر العدّاد، فالرسالة الثالثة تُفرض', () => {
  const turns = runConversation(['في وجع في جنبي', 'من فوق', 'وسط']);

  assert.equal(turns[0].reply.clarificationOnly, true, 'الرسالة الأولى تسأل');
  assert.equal(turns[1].reply.clarificationOnly, true, 'المكان العام لا يُبطِل السؤال أثناء الحلقة');
  assert.equal(turns[1].forceAnswer, false, 'العدّاد لم يُصفَّر');
  assert.equal(turns[2].forceAnswer, true, 'العدّاد وصل للحد فيُفرض الرد');
  assert.equal(turns[2].reply.clarificationOnly, false, 'الرسالة الثالثة إجابة كاملة');
});

test('ذكر مكان حقيقي يُنهي السؤال فورًا (وسط الظهر / بطني / جنب الشمال)', () => {
  for (const text of [
    'وسط الظهر',
    'بطني بتوجعني',
    'جنب الشمال بيوجعني',
    'الوجه اللي في بطني من الجنب اليمين دي ايه',
  ]) {
    const reply = analyzeMessage(text, 'ar', false, { askCount: 1, userTurnCount: 2 });
    assert.equal(reply.clarificationOnly, false, `"${text}" ذكر مكانًا فيُعتبر إجابة كافية`);
    assert.ok(reply.conditions.length > 0, `"${text}" يجب أن تعرض حالات محتملة`);
  }
});

test('mentionsGenericArea تتعرف على الأماكن العامة بالثلاث لغات', () => {
  const places = [
    'وسط الظهر',
    'وسط',
    'في المنطقة دي',
    'ناحية كده',
    'pain in that area',
    'my middle hurts',
    'j ai mal au milieu du dos',
    'au milieu',
    'dans la zone',
  ];
  for (const text of places) {
    assert.equal(mentionsGenericArea(text), true, `"${text}" يجب أن تُعتبر مكانًا مذكورًا`);
  }

  const notPlaces = [
    'حاسة بألم',
    'الدكتور قالي ريّح',
    'tired and feverish',
    'ألم شديد من 3 أيام',
    // "جنبي" / "my side" / "le côté" already point at a region, so they are
    // intentionally NOT generic area words - they keep the message askable once.
    'جنبي',
    'my side hurts',
    'douleur sur le côté',
  ];
  for (const text of notPlaces) {
    assert.equal(mentionsGenericArea(text), false, `"${text}" لا تذكر مكانًا`);
  }
});

// ---------------------------------------------------------------------------
// 6) كاسر الحلقة لا يُسقط علامات الإنذار (الأمان أولًا)
// ---------------------------------------------------------------------------
test('forceAnswer لا يُسقط تقييم الطوارئ', () => {
  const reply = analyzeMessage(
    'ألم مفاجئ شديد في الخصية اليمين مع تورم',
    'ar',
    false,
    { forceAnswer: true, askCount: 2, userTurnCount: 3 },
  );
  assert.equal(reply.clarificationOnly, false);
  assert.equal(reply.triage.level, 'emergency', 'الأعراض الطارئة تبقى طارئة');
  assert.ok(reply.redFlags.some((flag) => flag.id === 'rf:testicular_torsion'));
});

// ---------------------------------------------------------------------------
// 7) الإصلاح لا يكسر السلوك الطبيعي: رسالة دقيقة لا تسأل من الأصل
// ---------------------------------------------------------------------------
test('الرسائل الدقيقة لا تسأل عن الموقع من الأساس', () => {
  const reply = analyzeMessage('ألم في أسفل ضهري وبيّنزل على رجلي من 3 أيام', 'ar', false, {});
  assert.equal(reply.clarificationOnly, false, 'منطقة محددة لا تحتاج سؤال موقع');
  assert.equal(reply.clarifyingQuestion, null);
  assert.ok(reply.conditions.length > 0);
  assert.ok(reply.selfCare.length > 0);
});

// ---------------------------------------------------------------------------
// 8) شكل الإجابة يبقى متوافقًا مع الواجهة
// ---------------------------------------------------------------------------
test('شكل الإجابة يبقى متوافقًا مع الواجهة', () => {
  const reply = analyzeMessage('وسط الظهر', 'ar', false, { forceAnswer: true });
  for (const key of [
    'intro', 'understanding', 'understood', 'clarificationOnly', 'clarifyingQuestion',
    'triage', 'redFlags', 'regions', 'symptoms', 'medications', 'organDetails',
    'conditions', 'selfCare', 'whenToSeeDoctor', 'disclaimer', '__lang',
  ]) {
    assert.ok(Object.prototype.hasOwnProperty.call(reply, key), `الحقل ${key} مطلوب`);
  }
  assert.equal(reply.__lang, 'ar');
});

test('منطقة الجنب تتصرف بنفس الطريقة بالثلاث لغات (سؤال واحد فقط)', () => {
  const sideMessages = [
    ['في وجع في جنبي', 'ar'],
    ['my side hurts', 'en'],
    ['douleur sur le côté', 'fr'],
  ];
  for (const [text, language] of sideMessages) {
    const reply = analyzeMessage(text, language, false, {});
    assert.ok(
      reply.regions.some((region) => region.id === 'obliques'),
      `"${text}" يجب أن تُفهم كخواصر`,
    );
    assert.equal(reply.clarificationOnly, true, `"${text}" تسأل مرة واحدة فقط`);
  }
});

// ---------------------------------------------------------------------------
// 9) الإصلاح: الصيغة المجرّدة "جنب" كانت لا تُطابق أي منطقة، فتضيع رسالة
//    المستخدم في حالة سؤال الموقع وتتكرّر بلا داعٍ. الآن تُحلّ إلى الخواصر.
// ---------------------------------------------------------------------------
test('الإصلاح: "جنب" المجرّدة تُحلّ إلى الخواصر وتمنع ضياع الرسالة', () => {
  assert.equal(
    mentionsGenericArea('جنب'),
    false,
    '"جنب" تحلّ لمنطقة محددة، لذا ليست كلمة مكان عامة',
  );
  const reply = analyzeMessage('في وجع في جنب', 'ar', false, { askCount: 0, userTurnCount: 1 });
  assert.ok(
    reply.regions.some((region) => region.id === 'obliques'),
    '"جنب" يجب أن تُفهم كخواصر',
  );
  assert.equal(reply.clarificationOnly, true, '"جنب" تسأل مرة واحدة فقط ولا تُسقَط');
});

test('الإصلاح: مكان عام بعد سؤال واحد ينهي السؤال بلا تكرار (جنب -> وسط)', () => {
  const turns = runConversation(['في وجع في جنب', 'وسط']);
  assert.equal(turns[0].reply.clarificationOnly, true, 'الرسالة الأولى تسأل');
  assert.equal(turns[0].reply.regions.some((r) => r.id === 'obliques'), true, '"جنب" فُهمت كخواصر');
  assert.equal(turns[1].reply.clarificationOnly, false, 'ذكر مكان عام بعد سؤال = إجابة كافية');
  assert.equal(turns[1].forceAnswer, false, 'العدّاد لم يصل للحد، لكن المكان العام كفى');
});

test.after(() => {
  fs.rmSync(outfile, { force: true });
});
