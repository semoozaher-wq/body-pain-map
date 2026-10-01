// tests/voicePipeline.runner.ts
// ============================================================================
// مشغّل اختبارات قبول خط أنابيب الصوت (A–H).
// ----------------------------------------------------------------------------
// يُنتج JSON منظّمًا على stdout ليقرأه اختبار node --test (voicePipeline.test.cjs).
// يقود الوحدات الحقيقية فقط — لا نسخ مزيّفة من المنطق:
//   • services/speech/turnGate.ts    (بوّابة الجولة: جملة واحدة ⇒ جولة واحدة)
//   • services/speech/transcript.ts  (تطبيع النصّ + حساب الفرق)
//   • services/speech/webSpeech.ts   (تعرّف الويب + إسقاط الأحداث المكرّرة)
//   • services/appAssistant/intents.ts + engine.ts (الفهم والردّ)
//
// A  جملة واحدة ⇒ جولة واحدة عبر التسلسل interim→final→onend→silence (لا إرسال مزدوج)
// B  إعادة التصحيح على أندرويد: الجملة نفسها خلال نافذة إزالة التكرار لا تُرسل مرّتين
// C  نموذج الإلحاق: النصّ المتراكم الممتد يُرسل فرقه فقط (لا تكرار للبادئة)
// D  نموذج الاستبدال: المتعرّف يستبدل مخزونه ⇒ الجملة الجديدة لا تُبتلع
// E  شكوى بمنطقة مسمّاة: تُعلَّم العلامة بلا استجواب موقع ولا سؤال شدّة مبكّر
// F  «نفس المكان» ⇒ نيّة keep_marker: تبقى العلامة ولا يُعاد السؤال
// G  تطبيع النصّ: تجاهل التشكيل/المسافات/صور الألف في المساواة والفرق
// H  تعرّف الويب: الأحداث المتطابقة حرفيًا تُسقط (dedup على مستوى الحدث)
// ============================================================================

import {
  createTurnGate,
  DEFAULT_TURN_SILENCE_MS,
  DEFAULT_DEDUP_WINDOW_MS,
} from '../services/speech/turnGate';
import {
  normalizeTranscript,
  sameUtterance,
  deltaFromCommitted,
  stripArabicDiacritics,
  collapseWhitespace,
  mergeSpeechTranscript,
} from '../services/speech/transcript';
import { createWebRecognizer } from '../services/speech/webSpeech';
import {
  claimVoiceSession,
  releaseVoiceSession,
  isVoiceSessionOwner,
  currentVoiceSessionOwner,
  __resetVoiceSessionForTests,
} from '../services/speech/voiceSession';
import { interpret } from '../services/appAssistant/engine';
import { parseIntents } from '../services/appAssistant/intents';
import { getEntry } from '../services/appAssistant/catalog';
import type { AppState, Lang } from '../services/appAssistant/types';

// ---------------------------------------------------------------------------
// ساعة وهمية: تجعل مهلة الصمت ونافذة إزالة التكرار حتميّة تحت الاختبار.
// ---------------------------------------------------------------------------
interface Clock {
  setTimeoutFn: (fn: () => void, ms: number) => number;
  clearTimeoutFn: (id: number) => void;
  now: () => number;
  advance: (ms: number) => void;
}

function makeClock(): Clock {
  let t = 0;
  let seq = 0;
  const timers = new Map<number, { fn: () => void; at: number }>();
  const setTimeoutFn = (fn: () => void, ms: number) => {
    const id = ++seq;
    timers.set(id, { fn, at: t + ms });
    return id;
  };
  const clearTimeoutFn = (id: number) => {
    timers.delete(id);
  };
  const now = () => t;
  const advance = (ms: number) => {
    t += ms;
    let guard = 0;
    // اطرد المؤقتات المستحقّة بالترتيب (مع إعادة الفحص لأنّ الرد قد يجدول غيره).
    while (guard++ < 1000) {
      const due = [...timers.entries()]
        .filter(([, v]) => v.at <= t)
        .sort((a, b) => a[1].at - b[1].at);
      if (!due.length) break;
      const [id, v] = due[0];
      if (timers.has(id)) {
        timers.delete(id);
        v.fn();
      }
    }
  };
  return { setTimeoutFn, clearTimeoutFn, now, advance };
}

// بوّابة حقيقية مع تتبّع الجولات والسجلات.
function makeGate(clock: Clock) {
  const turns: string[] = [];
  const logs: string[] = [];
  const gate = createTurnGate({
    silenceMs: DEFAULT_TURN_SILENCE_MS,
    dedupWindowMs: DEFAULT_DEDUP_WINDOW_MS,
    setTimeoutFn: clock.setTimeoutFn,
    clearTimeoutFn: clock.clearTimeoutFn,
    now: clock.now,
    onTurn: (text) => turns.push(text),
    onLog: (stage) => logs.push(stage),
  });
  return { gate, turns, logs };
}

// ---------------------------------------------------------------------------
// A — جملة واحدة ⇒ جولة واحدة (تكامل webSpeech + TurnGate).
// نُثبّت مُنشئ تعرّف وهميًا على globalThis ونقود أحداثًا واقعية:
// interim → interim → final(حقيقي) → صمت(يُفرّغ) → onend(يُفرّغ ثانيةً) → صمت زائد.
// المتوقّع: جولة واحدة فقط بالنصّ الكامل (لا إرسال مزدوج عند onend/الصمت).
// ---------------------------------------------------------------------------
function fakeEvent(items: Array<{ transcript: string; confidence: number; isFinal: boolean }>) {
  const results = items.map((it) => {
    const arr: any = [{ transcript: it.transcript, confidence: it.confidence }];
    arr.isFinal = it.isFinal;
    return arr;
  });
  return { results, resultIndex: 0 };
}

function runWebIntegration() {
  const clock = makeClock();
  const { gate, turns, logs } = makeGate(clock);
  const snaps: string[] = [];

  let lastRec: any = null;
  class FakeRec {
    lang = '';
    continuous = false;
    interimResults = false;
    maxAlternatives = 1;
    onstart: any;
    onresult: any;
    onend: any;
    onerror: any;
    onaudiostart: any;
    onspeechstart: any;
    onspeechend: any;
    constructor() {
      lastRec = this;
    }
    start() {
      this.onstart && this.onstart();
    }
    stop() {
      this.onend && this.onend();
    }
    abort() {}
  }

  const g: any = globalThis as any;
  const prev = g.SpeechRecognition;
  const prevWk = g.webkitSpeechRecognition;
  g.SpeechRecognition = FakeRec;
  try {
    const rec = createWebRecognizer(
      { lang: 'ar-EG', continuous: true, interimResults: true },
      {
        log: (stage) => logs.push(stage),
        onResult: (snap) => {
          snaps.push(snap.liveText);
          gate.onSnapshot(snap);
        },
        onEnd: () => gate.flush(),
      },
    );
    rec!.start();
    // الجزئية الأولى (على أندرويد: isFinal=true لكن الثقة 0 ⇒ تُعامل كجزئية).
    lastRec.onresult(fakeEvent([{ transcript: 'ظهرى', confidence: 0, isFinal: true }]));
    // الجزئية الثانية: النصّ يتراكم.
    lastRec.onresult(fakeEvent([{ transcript: 'ظهرى بيوجعنى', confidence: 0, isFinal: true }]));
    // النتيجة النهائية الحقيقية.
    lastRec.onresult(fakeEvent([{ transcript: 'ظهرى بيوجعنى', confidence: 0.92, isFinal: true }]));
    // صمت كافٍ ⇒ إفراغ الجولة.
    clock.advance(DEFAULT_TURN_SILENCE_MS);
    // نهاية التعرّف ⇒ إفراغ ثانٍ (يجب ألّا يُرسل شيئًا).
    lastRec.onend();
    // صمت زائد ⇒ لا شيء.
    clock.advance(DEFAULT_TURN_SILENCE_MS * 2);
  } finally {
    g.SpeechRecognition = prev;
    if (prevWk === undefined) delete g.webkitSpeechRecognition;
    else g.webkitSpeechRecognition = prevWk;
  }

  return {
    turns,
    snaps,
    turnCount: turns.length,
    dedupEvents: logs.filter((l) => l === 'speech-result-dedup').length,
    emptyCommits: logs.filter((l) => l === 'turn-empty').length,
  };
}

// ---------------------------------------------------------------------------
// B — إعادة التصحيح على أندرويد: نفس الجملة داخل نافذة إزالة التكرار لا تُرسل مرّتين.
// المتعرّف «يتردّد» بين مرشّحين ثم يعود للجملة الأولى خلال النافذة الزمنية.
// ---------------------------------------------------------------------------
function runAndroidReFinalisation() {
  const clock = makeClock();
  const { gate, turns, logs } = makeGate(clock);
  gate.onFinal('ظهرى بيوجعنى');
  gate.flush(); // الجولة 1
  gate.onFinal('حاجه تانيه'); // استبدال المخزون (مرشّح دخيل)
  gate.onFinal('ظهرى بيوجعنى'); // إعادة تصحيح الجملة الأصلية خلال النافذة
  gate.flush(); // يجب أن تُسقط (dedup) بلا جولة ثانية
  return {
    turns,
    turnCount: turns.length,
    deduped: logs.includes('turn-dedup'),
  };
}

// ---------------------------------------------------------------------------
// C — نموذج الإلحاق: النصّ المتراكم الممتد يُرسل فرقه فقط (لا تكرار للبادئة).
// ---------------------------------------------------------------------------
function runAppendModel() {
  const clock = makeClock();
  const { gate, turns } = makeGate(clock);
  gate.onFinal('ظهرى');
  clock.advance(DEFAULT_TURN_SILENCE_MS); // الجولة 1 = "ظهرى"
  gate.onFinal('ظهرى تحت شويه'); // نصّ ممتد ⇒ الفرق = "تحت شويه"
  clock.advance(DEFAULT_TURN_SILENCE_MS); // الجولة 2 = "تحت شويه"
  return { turns, turnCount: turns.length };
}

// ---------------------------------------------------------------------------
// D — نموذج الاستبدال: المتعرّف يستبدل مخزونه ⇒ الجملة الجديدة لا تُبتلع.
// ---------------------------------------------------------------------------
function runReplaceModel() {
  const clock = makeClock();
  const { gate, turns } = makeGate(clock);
  gate.onFinal('ظهرى');
  clock.advance(DEFAULT_TURN_SILENCE_MS); // الجولة 1 = "ظهرى"
  gate.onFinal('تحت شويه'); // لا يمتدّ للنصّ السابق ⇒ استبدال
  clock.advance(DEFAULT_TURN_SILENCE_MS); // الجولة 2 = "تحت شويه"
  return { turns, turnCount: turns.length };
}

// ---------------------------------------------------------------------------
// E/F — الفهم والردّ (المحرّك الحقيقي).
// ---------------------------------------------------------------------------
const baseState = (over: Partial<AppState> = {}): AppState => ({
  currentScreen: 'welcome',
  currentTab: 'muscles',
  currentBodyView: 'front',
  currentSex: 'male',
  selectedBodyRegion: null,
  selectedAnatomyStructure: null,
  selectedPoint: null,
  selectedPainLocation: null,
  painSeverity: null,
  symptoms: [],
  lastAssistantAction: null,
  lastUserReference: null,
  conversationState: 'idle',
  zoomLevel: 1,
  visibleStructures: [],
  conversationContext: {
    lastReferencedId: null,
    lastReferencedKind: null,
    lastReferencedLabel: null,
    lastReferencedCoords: null,
    previousReferencedId: null,
    previousReferencedCoords: null,
  },
  language: 'ar' as Lang,
  ...over,
});

const ctx = (over: Partial<AppState['conversationContext']>) => ({
  ...baseState().conversationContext,
  ...over,
});

// E — شكوى بمنطقة مسمّاة ⇒ علامة بلا استجواب موقع ولا سؤال شدّة مبكّر.
function runNamedRegionComplaints() {
  const cases = [
    { name: 'back-ar', utterance: 'ظهرى بيوجعنى' },
    { name: 'belly-ar', utterance: 'عندى وجع فى بطنى' },
    { name: 'belly-ar2', utterance: 'بطنى بتوجعنى' },
    { name: 'back-fr', utterance: "j'ai mal au dos" },
  ];
  return cases.map((c) => {
    const turn = interpret(c.utterance, baseState());
    const reply = turn.reply.ar;
    const actions = turn.actions.map((a) => ({ type: a.type, targetId: a.targetId ?? null }));
    return {
      name: c.name,
      utterance: c.utterance,
      understood: turn.understood,
      hasSetMarker: actions.some((a) => a.type === 'set_marker'),
      setMarkerTarget: (actions.find((a) => a.type === 'set_marker') || {}).targetId ?? null,
      reply,
      // مؤشّرات الاستجواب المبكّر التي يجب ألّا تظهر عند وجود منطقة مسمّاة:
      hasWhereExactly: reply.includes('فين بالظبط'),
      hasSeverityWord: /شد(ة|ته)/.test(reply),
      hasSeverityScale: /لـ\s*10|من\s*[01]\s*لـ/.test(reply),
      hasQuestionMark: reply.includes('؟'),
    };
  });
}

// F — «نفس المكان» ⇒ نيّة keep_marker: تبقى العلامة ولا يُعاد السؤال.
function runKeepMarker() {
  const marker = { x: 38, y: 32, view: 'back' as const };
  const withRef = baseState({
    selectedPainLocation: marker,
    conversationContext: ctx({
      lastReferencedId: 'region:upper:back',
      lastReferencedKind: 'region',
      lastReferencedLabel: { ar: 'أعلى الظهر', en: 'Upper back', fr: 'Haut du dos' },
      lastReferencedCoords: marker,
    }),
  });
  const withMarkerNoRef = baseState({ selectedPainLocation: marker });

  const utterances = ['نفس المكان', 'سيبه هنا', 'زي ما هو'];
  return utterances.map((u) => {
    const intents = parseIntents(u, withRef.language).map((i) => i.kind);
    const turn = interpret(u, withRef);
    const reply = turn.reply.ar;
    return {
      utterance: u,
      intents,
      hasKeepMarker: intents.includes('keep_marker'),
      hasLocatePain: intents.includes('locate_pain'),
      understood: turn.understood,
      actions: turn.actions.map((a) => ({ type: a.type, targetId: a.targetId ?? null })),
      reply,
      mentionsSamePlace: reply.includes('نفس المكان'),
      reAsksLocation: reply.includes('فين بالظبط') || reply.includes('الألم فين'),
    };
  }).concat([
    (() => {
      const turn = interpret('نفس المكان', withMarkerNoRef);
      return {
        utterance: 'نفس المكان (بلا مرجع)',
        intents: parseIntents('نفس المكان', withMarkerNoRef.language).map((i) => i.kind),
        hasKeepMarker: true,
        hasLocatePain: false,
        understood: turn.understood,
        actions: turn.actions.map((a) => ({ type: a.type, targetId: a.targetId ?? null })),
        reply: turn.reply.ar,
        mentionsSamePlace: turn.reply.ar.includes('نفس المكان'),
        reAsksLocation: false,
      };
    })(),
  ]);
}

// ---------------------------------------------------------------------------
// G — تطبيع النصّ.
// ---------------------------------------------------------------------------
function runTranscript() {
  return {
    sameUtterance: [
      { a: 'ظهرى بيوجعنى', b: 'ظهري بيوجعني', expected: true },
      { a: 'ألم', b: 'الم', expected: true },
      { a: 'ظهرى', b: 'بطنى', expected: false },
      { a: '  أَلَمْ ', b: 'الم', expected: true },
    ].map((c) => ({ ...c, actual: sameUtterance(c.a, c.b) })),
    normalize: [
      { input: '  أَلَمْ ', expected: 'الم' },
      { input: 'ظَهْرِى', expected: 'ظهري' },
    ].map((c) => ({ ...c, actual: normalizeTranscript(c.input) })),
    strip: [
      { input: 'أَحْمَد', expected: 'احمد' },
      { input: 'كتابـــة', expected: 'كتابه' },
    ].map((c) => ({ ...c, actual: stripArabicDiacritics(c.input) })),
    collapse: [
      { input: '  a   b  ', expected: 'a b' },
    ].map((c) => ({ ...c, actual: collapseWhitespace(c.input) })),
    delta: [
      { committed: '', live: 'أ', text: 'أ', replaced: false },
      { committed: 'ظهرى', live: 'ظهرى بيوجعنى', text: 'بيوجعنى', replaced: false },
      { committed: 'ظهرى بيوجعنى', live: 'ظهرى', text: 'ظهرى', replaced: true },
      { committed: 'ظهرى', live: 'تحت شويه', text: 'تحت شويه', replaced: true },
      { committed: 'ظهرى', live: 'ظهرى', text: '', replaced: false },
    ].map((c) => {
      const r = deltaFromCommitted(c.committed, c.live);
      return { ...c, actualText: r.text, actualReplaced: r.replaced };
    }),
  };
}

// ---------------------------------------------------------------------------
// H — إسقاط الأحداث المكرّرة حرفيًا في تعرّف الويب.
// ---------------------------------------------------------------------------
function runWebSpeechDedup() {
  let lastRec: any = null;
  class FakeRec {
    lang = '';
    continuous = false;
    interimResults = false;
    maxAlternatives = 1;
    onstart: any;
    onresult: any;
    onend: any;
    onerror: any;
    onaudiostart: any;
    onspeechstart: any;
    onspeechend: any;
    constructor() {
      lastRec = this;
    }
    start() {
      this.onstart && this.onstart();
    }
    stop() {}
    abort() {}
  }
  const g: any = globalThis as any;
  const prev = g.SpeechRecognition;
  const prevWk = g.webkitSpeechRecognition;
  g.SpeechRecognition = FakeRec;
  const snaps: string[] = [];
  const logs: string[] = [];
  try {
    const rec = createWebRecognizer(
      { lang: 'ar-EG', continuous: true, interimResults: true },
      {
        log: (stage) => logs.push(stage),
        onResult: (snap) => snaps.push(snap.liveText),
      },
    );
    rec!.start();
    const e = fakeEvent([{ transcript: 'ظهرى', confidence: 0, isFinal: true }]);
    lastRec.onresult(e);
    lastRec.onresult(e); // تكرار حرفي ⇒ يُسقط
    lastRec.onresult(fakeEvent([{ transcript: 'ظهرى بيوجعنى', confidence: 0, isFinal: true }]));
  } finally {
    g.SpeechRecognition = prev;
    if (prevWk === undefined) delete g.webkitSpeechRecognition;
    else g.webkitSpeechRecognition = prevWk;
  }
  return {
    snaps,
    resultCount: snaps.length,
    dedupEvents: logs.filter((l) => l === 'speech-result-dedup').length,
  };
}

// ---------------------------------------------------------------------------
// I — دمج نص التعرف الأصلي (native) ضد التكرار: نفس حالات ملف الانحدار
//     tests/nativeSpeechTranscriptMerge.regression.ts (مدمجة هنا لتُنفَّذ فعليًا في CI).
// ---------------------------------------------------------------------------
function runNativeMerge() {
  // أزواج [prev, incoming] كما في ملف الانحدار؛ يُستخدم العنصر الثاني (incoming) فقط.
  const cases = [
    ['عندي وجع', 'عندي وجع'],
    ['عندي وجع', 'في بطني'],
    ['عندي وجع في بطني', 'في بطني'],
    ['عندي وجع في بطني', 'عندي وجع في بطني'],
  ] as const;
  let value = '';
  for (const [, incoming] of cases) value = mergeSpeechTranscript(value, incoming);
  const expected = 'عندي وجع في بطني';
  return { value, expected, pass: value === expected };
}

// ---------------------------------------------------------------------------
// J — سباق onend→restart: نفس الجملة النهائية لا تُرسَل مرّتين عبر إعادة تشغيل
//     المتعرّف، بينما الجملة الجديدة فعلًا لا تُبتلع.
// ---------------------------------------------------------------------------
function runRestartDedup() {
  const clock = makeClock();
  const { gate, turns, logs } = makeGate(clock);
  // جلسة A: الجملة النهائية ثم onend (flush) ⇒ الجولة 1.
  gate.onFinal('عندي وجع في بطني');
  gate.flush();
  // إعادة تشغيل المتعرّف (onend→start): reset() يحافظ على حارس النصّ النهائي.
  gate.reset();
  // جلسة B: أندرويد يعيد تثبيت نفس الجملة ⇒ يجب أن تُسقَط (لا جولة ثانية).
  gate.onFinal('عندي وجع في بطني');
  gate.flush();
  clock.advance(DEFAULT_TURN_SILENCE_MS * 2);
  const sameUtteranceTurns = turns.length;
  const finalDeduped = logs.includes('turn-final-dedup');
  // جملة جديدة فعلًا بعد إعادة التشغيل ⇒ يجب ألّا تُبتلع.
  gate.onFinal('عندي صداع');
  gate.flush();
  const newUtteranceTurns = turns.length - sameUtteranceTurns;
  return { sameUtteranceTurns, finalDeduped, newUtteranceTurns, turns };
}

// ---------------------------------------------------------------------------
// K — مسار واحد فقط يملك الميكروفون: بثّ نفس الحدث إلى مسارين ⇒ جولة واحدة فقط.
// ---------------------------------------------------------------------------
function runSingleActiveListener() {
  __resetVoiceSessionForTests();
  const clock = makeClock();
  const a = makeGate(clock);
  const b = makeGate(clock);
  // المسار A (AssistantScreen) يبدأ الاستماع ⇒ يملك القفل.
  const aClaimed = claimVoiceSession('assistant');
  // المسار B (المساعد العائم) يحاول البدء ⇒ يفشل (مسار واحد فقط).
  const bClaimed = claimVoiceSession('global');
  // محاكاة بثّ نفس حدث النتيجة إلى الاثنين (كما يفعل expo useEventListener).
  const deliver = (text: string) => {
    if (isVoiceSessionOwner('assistant')) a.gate.onFinal(text);
    if (isVoiceSessionOwner('global')) b.gate.onFinal(text);
  };
  deliver('عندي وجع في بطني');
  clock.advance(DEFAULT_TURN_SILENCE_MS);
  const ownerWhileListening = currentVoiceSessionOwner();
  const aTurns = a.turns.length;
  const bTurnsWhileAOwns = b.turns.length;
  // المسار A يتوقف ⇒ يحرّر القفل ⇒ B يستطيع البدء بعدها.
  releaseVoiceSession('assistant');
  const bClaimedAfterRelease = claimVoiceSession('global');
  deliver('عندي صداع');
  clock.advance(DEFAULT_TURN_SILENCE_MS);
  const bTurnsAfterOwnership = b.turns.length;
  __resetVoiceSessionForTests();
  return {
    aClaimed,
    bClaimed,
    ownerWhileListening,
    aTurns,
    bTurnsWhileAOwns,
    bClaimedAfterRelease,
    bTurnsAfterOwnership,
  };
}

// ---------------------------------------------------------------------------
// L — دمج التداخل الجزئي: وصول جزء من الكلام داخل نصّ جديد لا يُكرّره.
// ---------------------------------------------------------------------------
function runMergeOverlap() {
  const cases = [
    { prev: 'عندي وجع', next: 'وجع في بطني', expected: 'عندي وجع في بطني' },
    { prev: 'عندي وجع في بطني', next: 'في بطني', expected: 'عندي وجع في بطني' },
    { prev: 'عندي وجع في بطني', next: 'عندي وجع في بطني', expected: 'عندي وجع في بطني' },
    { prev: 'عندي وجع', next: 'في بطني', expected: 'عندي وجع في بطني' },
    { prev: 'عندي وجع', next: 'عندي وجع', expected: 'عندي وجع' },
    { prev: '', next: 'عندي وجع', expected: 'عندي وجع' },
  ];
  return cases.map((c) => {
    const actual = mergeSpeechTranscript(c.prev, c.next);
    return { ...c, actual, pass: actual === c.expected };
  });
}

// ---------------------------------------------------------------------------
// M — حالات إزالة التكرار على البوّابة: نهائي مكرّر، interim→final، onresult مكرّر.
// ---------------------------------------------------------------------------
function runGateDedupCases() {
  // نهائي مكرّر حرفيًا.
  const c1 = makeClock();
  const g1 = makeGate(c1);
  g1.gate.onFinal('عندي وجع في بطني');
  g1.gate.flush();
  g1.gate.onFinal('عندي وجع في بطني');
  g1.gate.flush();

  // interim ثم final لنفس الكلام.
  const c2 = makeClock();
  const g2 = makeGate(c2);
  g2.gate.onSnapshot({ liveText: 'عندي وجع', hasFinal: false });
  g2.gate.onFinal('عندي وجع في بطني');
  c2.advance(DEFAULT_TURN_SILENCE_MS);

  // onresult مكرّر بنفس المعاينة.
  const c3 = makeClock();
  const g3 = makeGate(c3);
  g3.gate.onSnapshot({ liveText: 'عندي وجع في بطني', hasFinal: true });
  g3.gate.onSnapshot({ liveText: 'عندي وجع في بطني', hasFinal: true });
  c3.advance(DEFAULT_TURN_SILENCE_MS);

  return {
    duplicateFinalTurns: g1.turns.length,
    interimToFinalTurns: g2.turns.length,
    interimToFinalText: g2.turns[0] ?? null,
    repeatedOnresultTurns: g3.turns.length,
  };
}

// ---------------------------------------------------------------------------
// N — TTS مرّة واحدة: تيّار أحداث واقعي (تكرار نهائي + onend + إعادة تشغيل) ⇒
//     جولة واحدة ⇒ استدعاء نطق واحد. (send/speak نموذج مبني على البوّابة الحقيقية.)
// ---------------------------------------------------------------------------
function runTtsOnce() {
  const clock = makeClock();
  const turns: string[] = [];
  const speaks: string[] = [];
  const gate = createTurnGate({
    silenceMs: DEFAULT_TURN_SILENCE_MS,
    setTimeoutFn: clock.setTimeoutFn,
    clearTimeoutFn: clock.clearTimeoutFn,
    now: clock.now,
    onTurn: (text) => {
      turns.push(text);
      // كل جولة ⇒ ردّ واحد ⇒ نطق واحد (speak يستدعي Speech.stop() قبل الجديد).
      speaks.push(text);
    },
  });
  gate.onSnapshot({ liveText: 'عندي وجع', hasFinal: false });
  gate.onFinal('عندي وجع في بطني');
  gate.onFinal('عندي وجع في بطني'); // نهائي مكرّر
  gate.flush(); // onend
  gate.reset(); // إعادة تشغيل
  gate.onFinal('عندي وجع في بطني'); // إعادة تثبيت في الجلسة الجديدة
  gate.flush(); // onend
  clock.advance(DEFAULT_TURN_SILENCE_MS * 2);
  return { turnCount: turns.length, speakCount: speaks.length, turns };
}

// ---------------------------------------------------------------------------
// تشغيل الكل وإخراج JSON.
// ---------------------------------------------------------------------------
const output = {
  A: runWebIntegration(),
  B: runAndroidReFinalisation(),
  C: runAppendModel(),
  D: runReplaceModel(),
  E: runNamedRegionComplaints(),
  F: runKeepMarker(),
  G: runTranscript(),
  H: runWebSpeechDedup(),
  I: runNativeMerge(),
  J: runRestartDedup(),
  K: runSingleActiveListener(),
  L: runMergeOverlap(),
  M: runGateDedupCases(),
  N: runTtsOnce(),
  catalogSanity: {
    upperBackExists: !!getEntry('region:upper:back'),
    absFrontExists: !!getEntry('region:abs:front'),
  },
};

process.stdout.write(JSON.stringify(output));
