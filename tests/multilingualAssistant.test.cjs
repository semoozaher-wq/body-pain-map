// tests/multilingualAssistant.test.cjs
// ============================================================================
// اختبارات الـAI متعدد اللغات (عربي + English + Français) + Voice — عبر node --test.
// تُشغّل tests/multilingualAssistant.runner.ts (عبر tsx) وتتحقّق من:
//   • Rule-Based يفهم الأوامر الواضحة بالثلاث لغات (شكوى ألم + تنقّل + اتجاهات + نفس المكان).
//   • Gemini (قرار موحّد مُحاكى) يُحوّل الفهم الذي يحتاج LLM إلى إجراءات موجودة فعلاً،
//     ويردّ بنفس لغة المستخدم.
//   • General Chat + Medical + App Control تعمل بالثلاث لغات.
//   • حفظ الـcontext عند تبديل اللغة (عربي → English): المكان/المدة تبقى، والمعلومة الجديدة تُضاف.
//   • Voice: جولة واحدة ⇒ نطق واحد (بلا تكرار Turn/TTS) + قفل جلسة صوت واحد.
//   • الأمان: كل إجراء موجود فعلاً، وكل targetId تشريحي موجود في الكتالوج.
//   • المخطّط المشترك (zod) مطابق لأنواع المحرّك.
// ============================================================================
const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const RUNNER = path.join('tests', 'multilingualAssistant.runner.ts');

function runRunner() {
  const res = spawnSync('npx', ['tsx', RUNNER], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  assert.strictEqual(res.status, 0, `runner exited with ${res.status}: ${res.stderr}`);
  const out = (res.stdout || '').trim();
  assert.ok(out.length > 0, 'runner produced no output');
  return JSON.parse(out);
}

const data = runRunner();
const byName = (arr, n) => arr.find((r) => r.name === n);
const rule = (n) => byName(data.ruleBased, n);
const gem = (n) => byName(data.gemini, n);
const chat = (n) => byName(data.general, n);

const actionTypes = (r) => (r?.actions || []).map((a) => a.type);
const findAction = (r, type) => (r?.actions || []).find((a) => a.type === type);
const markerActions = (r) =>
  (r?.actions || []).filter((a) => a.type === 'set_marker' || a.type === 'move_marker');

const hasArabic = (s) => /[\u0600-\u06FF]/.test(String(s || ''));
const hasLatin = (s) => /[A-Za-z]/.test(String(s || ''));

// ---------------------------------------------------------------------------
// 1) Rule-Based: شكوى ألم بالثلاث لغات ⇒ منطقة حقيقية على الخريطة + ردّ باللغة
// ---------------------------------------------------------------------------
const painCases = [
  { name: 'ar.pain.belly', lang: 'ar', region: 'region:abs:front' },
  { name: 'en.pain.belly', lang: 'en', region: 'region:abs:front' },
  { name: 'fr.pain.belly', lang: 'fr', region: 'region:abs:front' },
];
for (const c of painCases) {
  test(`Rule-Based [${c.lang}]: pain complaint is understood and marks a real region`, () => {
    const r = rule(c.name);
    assert.ok(r, `case ${c.name} exists`);
    assert.strictEqual(r.understood, true, 'understood');
    assert.strictEqual(r.mode, 'medical', 'classified as medical');
    const set = findAction(r, 'set_marker');
    assert.ok(set, 'a marker is set from words alone (no forced map tap)');
    assert.strictEqual(set.targetId, c.region, 'marker resolves to a real region');
    assert.match(String(set.value), /^\d+(\.\d+)?,\d+(\.\d+)?,(front|back)$/, 'marker value = x,y,view');
    assert.strictEqual(markerActions(r).length, 1, 'exactly one marker action');
    // الردّ بنفس لغة المستخدم: موجود + مُعرَّب/مُترجم (مختلف عن باقي اللغات)
    assert.ok(r.replyLang && r.replyLang.length > 0, 'reply in user language is non-empty');
    const distinct = new Set([r.replyAr, r.replyEn, r.replyFr]);
    assert.strictEqual(distinct.size, 3, 'reply is localized per language');
    if (c.lang === 'ar') assert.ok(hasArabic(r.replyAr), 'Arabic reply is in Arabic script');
    else assert.ok(hasLatin(r.replyLang), 'en/fr reply uses Latin script');
  });
}

// ---------------------------------------------------------------------------
// 2) Rule-Based: التنقّل بالثلاث لغات ⇒ تبويب الأعضاء
// ---------------------------------------------------------------------------
for (const name of ['ar.nav.organs', 'en.nav.organs', 'fr.nav.organs']) {
  test(`Rule-Based [${name}]: navigation to organs opens the organs tab`, () => {
    const r = rule(name);
    assert.strictEqual(r.understood, true);
    assert.strictEqual(r.mode, 'app', 'app-control mode');
    const tab = findAction(r, 'open_tab');
    assert.ok(tab, 'opens a tab');
    assert.strictEqual(tab.targetId, 'tab:organs', 'opens the organs tab');
  });
}

// ---------------------------------------------------------------------------
// 3) Rule-Based: الاتجاهات بالثلاث لغات ⇒ تحريك نفس العلامة (لا علامة جديدة)
// ---------------------------------------------------------------------------
const dirCases = [
  { suffix: 'left', axis: 'x', cmp: (v) => v < 50, label: 'left' },
  { suffix: 'up', axis: 'y', cmp: (v) => v < 50, label: 'up' },
  { suffix: 'down', axis: 'y', cmp: (v) => v > 50, label: 'down' },
];
for (const lang of ['ar', 'en', 'fr']) {
  for (const dc of dirCases) {
    const name = `${lang}.dir.${dc.suffix}`;
    test(`Rule-Based [${name}]: direction moves the SAME marker ${dc.label}, never creates one`, () => {
      const r = rule(name);
      assert.strictEqual(r.understood, true);
      assert.strictEqual(actionTypes(r).includes('set_marker'), false, 'no new marker');
      const mv = findAction(r, 'move_marker');
      assert.ok(mv, 'moves the existing marker');
      assert.strictEqual(mv.targetId, 'pain_marker', 'moves the current pain marker');
      const [x, y, view] = String(mv.value).split(',');
      assert.strictEqual(view, 'front', 'same view');
      if (dc.axis === 'x') {
        assert.ok(dc.cmp(Number(x)), `x moved (got ${x})`);
        assert.strictEqual(Number(y), 50, 'y unchanged');
      } else {
        assert.ok(dc.cmp(Number(y)), `y moved (got ${y})`);
        assert.strictEqual(Number(x), 50, 'x unchanged');
      }
    });
  }
}

// ---------------------------------------------------------------------------
// 4) Rule-Based: "نفس المكان / same place / même endroit" ⇒ لا set_marker ولا move_marker
// ---------------------------------------------------------------------------
for (const name of ['ar.keep', 'en.keep', 'fr.keep']) {
  test(`Rule-Based [${name}]: "same place" keeps the marker (no set/move)`, () => {
    const r = rule(name);
    assert.strictEqual(r.understood, true);
    assert.strictEqual(actionTypes(r).includes('set_marker'), false, 'no set_marker');
    assert.strictEqual(actionTypes(r).includes('move_marker'), false, 'no move_marker');
  });
}

// ---------------------------------------------------------------------------
// 5) Rule-Based: تسمية عضو باللغة (show me the heart) ⇒ إبراز عضو حقيقي
// ---------------------------------------------------------------------------
test('Rule-Based [en.organ.heart]: naming an organ highlights a real organ', () => {
  const r = rule('en.organ.heart');
  assert.strictEqual(r.understood, true);
  const hl = findAction(r, 'highlight');
  assert.ok(hl, 'highlights an organ');
  assert.strictEqual(hl.targetId, 'organ:heart', 'highlights the heart');
});

// ---------------------------------------------------------------------------
// 6) Gemini: فهم يحتاج LLM بالثلاث لغات ⇒ إجراءات حقيقية + ردّ بنفس اللغة + سياق طبي
// ---------------------------------------------------------------------------
const gemSide = [
  { name: 'gem.ar.side', lang: 'ar' },
  { name: 'gem.en.side', lang: 'en' },
  { name: 'gem.fr.side', lang: 'fr' },
];
for (const c of gemSide) {
  test(`Gemini [${c.lang}]: LLM decision becomes real actions and replies in the user's language`, () => {
    const r = gem(c.name);
    assert.ok(r, `case ${c.name} exists`);
    assert.strictEqual(r.understood, true);
    assert.strictEqual(r.mode, 'medical');
    const set = findAction(r, 'set_marker');
    assert.ok(set, 'sets a marker from the LLM decision');
    assert.strictEqual(set.targetId, 'region:obliques:front', 'resolves to a real region');
    assert.ok(r.painContext && r.painContext.painLocation, 'medical context extracted');
    // الردّ بنفس لغة المستخدم: نصّ الردّ يطابق ما أعاده النموذج باللغة المطلوبة
    assert.ok(r.replyLang && r.replyLang.length > 0, 'reply non-empty');
    assert.ok(
      r.replyLang === r.replyAr || r.replyLang === r.replyEn || r.replyLang === r.replyFr,
      'reply is the model reply in the user language slot',
    );
    if (c.lang === 'ar') assert.ok(hasArabic(r.replyLang), 'Arabic reply in Arabic script');
    else assert.ok(hasLatin(r.replyLang), 'en/fr reply in Latin script');
  });
}

test('Gemini [fr]: a nuanced direction ("un peu en arrière") moves the same marker back', () => {
  const r = gem('gem.fr.behind');
  assert.strictEqual(r.understood, true);
  assert.strictEqual(actionTypes(r).includes('set_marker'), false, 'no new marker');
  const mv = findAction(r, 'move_marker');
  assert.ok(mv, 'moves the marker');
  assert.strictEqual(mv.targetId, 'pain_marker');
  assert.strictEqual(String(mv.value).split(',')[2], 'back', 'moved to the back view');
});

test('Gemini [ar]: an app-control decision opens the organs tab', () => {
  const r = gem('gem.ar.tab');
  assert.strictEqual(r.understood, true);
  assert.strictEqual(r.mode, 'app');
  const tab = findAction(r, 'open_tab');
  assert.ok(tab, 'opens a tab');
  assert.strictEqual(tab.targetId, 'tab:organs');
});

// ---------------------------------------------------------------------------
// 7) General Chat + Medical + App Control: الأنماط الثلاثة تعمل بالثلاث لغات
// ---------------------------------------------------------------------------
for (const name of ['chat.ar', 'chat.en', 'chat.fr', 'chat.ar.thanks', 'chat.en.thanks', 'chat.fr.thanks']) {
  test(`General Chat [${name}]: classified as general and replies in the user's language`, () => {
    const r = chat(name);
    assert.strictEqual(r.mode, 'general', 'general chat mode');
    assert.ok(r.replyLang && r.replyLang.length > 0, 'reply non-empty');
    const distinct = new Set([r.replyAr, r.replyEn, r.replyFr]);
    assert.strictEqual(distinct.size, 3, 'reply is localized per language');
    if (r.lang === 'ar') assert.ok(hasArabic(r.replyAr), 'Arabic reply in Arabic script');
    else assert.ok(hasLatin(r.replyLang), 'en/fr reply in Latin script');
  });
}

test('Modes: Medical + App Control are both reachable (rule-based)', () => {
  assert.strictEqual(rule('ar.pain.belly').mode, 'medical', 'pain complaint ⇒ medical');
  assert.strictEqual(rule('ar.nav.organs').mode, 'app', 'navigation ⇒ app control');
});

// ---------------------------------------------------------------------------
// 8) حفظ الـcontext عند تبديل اللغة (عربي → English)
// ---------------------------------------------------------------------------
test('Context: switching language keeps the medical context (location + duration) and adds the new info', () => {
  const cs = data.contextSwitch;
  assert.strictEqual(cs.t1Lang, 'ar');
  assert.strictEqual(cs.t2Lang, 'en');
  assert.strictEqual(cs.t1MarkerTargetId, 'region:abs:front', 'turn 1 marked a real region');
  assert.ok(cs.t1PainLocation, 'turn 1 captured the pain location');
  assert.ok(cs.t1PainDuration, 'turn 1 captured the pain duration');
  // بعد تبديل اللغة: المكان والمدة السابقان يبقيان
  assert.strictEqual(cs.mergedKeepsLocation, true, 'location survives the language switch');
  assert.strictEqual(cs.mergedKeepsDuration, true, 'duration survives the language switch');
  // والمعلومة الجديدة (English) تُضاف
  assert.strictEqual(cs.mergedAddsQuality, true, 'new English detail is added');
  // والردّ في الجولة الثانية بالإنجليزية
  assert.strictEqual(cs.t2Mode, 'medical');
  assert.ok(hasLatin(cs.t2ReplyLang) && !hasArabic(cs.t2ReplyLang), 'turn 2 reply is in English');
  // دالة الدمج الصافية تحفظ السياق عبر اللغات
  assert.strictEqual(cs.pureMerge.painLocation, cs.t1PainLocation);
  assert.strictEqual(cs.pureMerge.painDuration, cs.t1PainDuration);
  assert.ok(cs.pureMerge.painQuality.includes('sharp'));
});

// ---------------------------------------------------------------------------
// 9) Voice: جولة واحدة ⇒ نطق واحد (بلا تكرار Turn/TTS) + قفل جلسة واحد
// ---------------------------------------------------------------------------
test('Voice: a realistic event stream (duplicate final + onend + restart) yields exactly one turn and one speak', () => {
  assert.strictEqual(data.voice.turnCount, 1, 'exactly one turn emitted');
  assert.strictEqual(data.voice.speakCount, 1, 'exactly one TTS speak (no duplication)');
  assert.strictEqual(data.voice.turns.length, 1, 'one utterance text');
});

test('Voice: only one pipeline owns the voice session (single active listener)', () => {
  const lock = data.voice.lock;
  assert.strictEqual(lock.firstClaim, true, 'first pipeline claims the session');
  assert.strictEqual(lock.secondClaim, false, 'second pipeline cannot claim it');
  assert.strictEqual(lock.owner, 'assistant', 'the first owner holds the lock');
  assert.strictEqual(lock.globalIsOwner, false, 'the other pipeline is not the owner');
  assert.strictEqual(lock.afterRelease, null, 'releasing frees the session');
});

// ---------------------------------------------------------------------------
// 10) الأمان: كل إجراء موجود فعلاً + كل targetId تشريحي موجود في الكتالوج
// ---------------------------------------------------------------------------
test('Safety: every produced action type exists in ACTION_SAFETY', () => {
  assert.ok(data.actionTypeCheck.length > 0, 'there are actions to check');
  const bad = data.actionTypeCheck.filter((a) => !a.exists);
  assert.deepStrictEqual(bad, [], `unknown action types: ${JSON.stringify(bad)}`);
});

test('Safety: every anatomical targetId resolves to a real catalog entry', () => {
  assert.ok(data.targetIdCheck.length > 0, 'there are anatomical targets to check');
  const bad = data.targetIdCheck.filter((t) => !t.exists);
  assert.deepStrictEqual(bad, [], `invented target ids: ${JSON.stringify(bad)}`);
});

// ---------------------------------------------------------------------------
// 11) المخطّط المشترك (zod Structured Output) مطابق لأنواع المحرّك
// ---------------------------------------------------------------------------
test('Schema: shared zod action types match ACTION_SAFETY and intents are complete', () => {
  assert.strictEqual(data.schemaCheck.actionTypesMatchSafety, true, 'all schema action types are real');
  assert.ok(data.schemaCheck.actionTypesCount >= 17, 'schema declares the action types');
  assert.ok(data.schemaCheck.intentsCount >= 20, 'schema declares the intents');
});

// ---------------------------------------------------------------------------
// 12) Sanity: المناطق/العناصر المرجعية في الاختبار موجودة فعلاً في الكتالوج
// ---------------------------------------------------------------------------
test('Sanity: referenced regions/tabs/organs exist in the catalog', () => {
  assert.strictEqual(data.catalogSanity.abs, true);
  assert.strictEqual(data.catalogSanity.obliques, true);
  assert.strictEqual(data.catalogSanity.organsTab, true);
  assert.strictEqual(data.catalogSanity.heart, true);
});
