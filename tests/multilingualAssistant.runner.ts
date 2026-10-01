// tests/multilingualAssistant.runner.ts
// ============================================================================
// مشغّل اختبارات الـAI متعدد اللغات (عربي + English + Français) + Voice.
// يُنتج JSON منظّمًا على stdout ليقرأه اختبار node --test (multilingualAssistant.test.cjs).
//
// لا يتصل بالشبكة إطلاقًا:
//   • مسار Rule-Based: نستدعي interpret() بلا aiDecision (أوامر واضحة).
//   • مسار Gemini: نمرّر قرارًا موحّدًا (aiDecision) يحاكي ردّ Gemini إلى نفس نقطة الدمج
//     الفعلية في services/appAssistant/engine.ts، ثم نتحقّق من تحويله إلى إجراءات موجودة
//     فعلاً + الردّ بنفس لغة المستخدم + حفظ السياق عند تبديل اللغة.
//   • Voice: نقود بوّابة الجولات الحقيقية (TurnGate) + قفل جلسة الصوت (voiceSession)
//     للتأكد من جولة واحدة ⇒ نطق واحد (بلا تكرار Turn أو TTS).
// ============================================================================

import { interpret } from '../services/appAssistant/engine';
import { findTarget, getEntry } from '../services/appAssistant/catalog';
import { ACTION_SAFETY } from '../services/appAssistant/actions';
import { mergePainContext } from '../services/aiAssistant/gemini';
import { ASSISTANT_ACTION_TYPES, ASSISTANT_INTENTS } from '../services/aiAssistant/schema';
import {
  createTurnGate,
  DEFAULT_TURN_SILENCE_MS,
} from '../services/speech/turnGate';
import {
  claimVoiceSession,
  releaseVoiceSession,
  isVoiceSessionOwner,
  currentVoiceSessionOwner,
  __resetVoiceSessionForTests,
} from '../services/speech/voiceSession';
import type { AppState, Lang, AssistantTurn } from '../services/appAssistant/types';
import type { GeminiDecision } from '../services/aiAssistant/gemini';

// ---------------------------------------------------------------------------
// حالة أساسية + مساعدات
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

const decision = (over: Partial<GeminiDecision>): GeminiDecision => ({
  intent: 'unknown',
  reply: '',
  confidence: 0.9,
  painContext: null,
  actions: [],
  followUpQuestion: null,
  ...over,
});

const slim = (t: AssistantTurn, lang: Lang) => ({
  understood: t.understood,
  mode: t.mode ?? null,
  actions: t.actions.map((a) => ({
    type: a.type,
    targetId: a.targetId ?? null,
    value: a.value ?? null,
  })),
  replyLang: t.reply[lang],
  replyAr: t.reply.ar,
  replyEn: t.reply.en,
  replyFr: t.reply.fr,
  painContext: t.painContext ?? null,
});

// ---------------------------------------------------------------------------
// ساعة وهمية لبوّابة الجولات (Voice)
// ---------------------------------------------------------------------------
function makeClock() {
  let t = 0;
  let seq = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  return {
    setTimeoutFn: (fn: () => void, ms: number) => {
      const id = ++seq;
      timers.set(id, { at: t + ms, fn });
      return id;
    },
    clearTimeoutFn: (id: number) => {
      timers.delete(id);
    },
    now: () => t,
    advance: (ms: number) => {
      t += ms;
      const due = [...timers.entries()]
        .filter(([, v]) => v.at <= t)
        .sort((a, b) => a[1].at - b[1].at);
      for (const [id, v] of due) {
        timers.delete(id);
        v.fn();
      }
    },
  };
}

// ---------------------------------------------------------------------------
// 1) Rule-Based: أوامر واضحة بالثلاث لغات (بلا Gemini)
// ---------------------------------------------------------------------------
interface RuleCase {
  name: string;
  lang: Lang;
  utterance: string;
  withMarker?: boolean;
}
const ruleCases: RuleCase[] = [
  // عربي
  { name: 'ar.pain.belly', lang: 'ar', utterance: 'بطني بيوجعني' },
  { name: 'ar.nav.organs', lang: 'ar', utterance: 'روح للأعضاء' },
  { name: 'ar.dir.left', lang: 'ar', utterance: 'على الشمال', withMarker: true },
  { name: 'ar.dir.up', lang: 'ar', utterance: 'فوق شوية', withMarker: true },
  { name: 'ar.dir.down', lang: 'ar', utterance: 'تحت شوية', withMarker: true },
  { name: 'ar.dir.back', lang: 'ar', utterance: 'ورا شوية', withMarker: true },
  { name: 'ar.keep', lang: 'ar', utterance: 'نفس المكان', withMarker: true },
  // English
  { name: 'en.pain.belly', lang: 'en', utterance: 'my belly hurts' },
  { name: 'en.nav.organs', lang: 'en', utterance: 'go to organs' },
  { name: 'en.dir.left', lang: 'en', utterance: 'to the left', withMarker: true },
  { name: 'en.dir.up', lang: 'en', utterance: 'above', withMarker: true },
  { name: 'en.dir.down', lang: 'en', utterance: 'below', withMarker: true },
  { name: 'en.dir.back', lang: 'en', utterance: 'behind', withMarker: true },
  { name: 'en.keep', lang: 'en', utterance: 'same place', withMarker: true },
  { name: 'en.organ.heart', lang: 'en', utterance: 'show me the heart' },
  // Français
  { name: 'fr.pain.belly', lang: 'fr', utterance: 'mon ventre me fait mal' },
  { name: 'fr.nav.organs', lang: 'fr', utterance: 'ouvre les organes' },
  { name: 'fr.dir.left', lang: 'fr', utterance: 'à gauche', withMarker: true },
  { name: 'fr.dir.up', lang: 'fr', utterance: 'un peu plus haut', withMarker: true },
  { name: 'fr.dir.down', lang: 'fr', utterance: 'en dessous', withMarker: true },
  { name: 'fr.keep', lang: 'fr', utterance: 'même endroit', withMarker: true },
  { name: 'fr.nav.body', lang: 'fr', utterance: 'ouvre la carte du corps' },
];

const ruleBased = ruleCases.map((c) => {
  const st = baseState({
    language: c.lang,
    selectedPainLocation: c.withMarker ? { x: 50, y: 50, view: 'front' } : null,
  });
  const turn = interpret(c.utterance, st);
  return { name: c.name, lang: c.lang, utterance: c.utterance, ...slim(turn, c.lang) };
});

// ---------------------------------------------------------------------------
// 2) Gemini: فهم يحتاج LLM بالثلاث لغات (قرار موحّد مُحاكى)
// ---------------------------------------------------------------------------
interface GemCase {
  name: string;
  lang: Lang;
  utterance: string;
  withMarker?: boolean;
  decision: GeminiDecision;
}
const gemCases: GemCase[] = [
  {
    name: 'gem.ar.side',
    lang: 'ar',
    utterance: 'جنبي الشمال بيوجعني',
    decision: decision({
      intent: 'locate_pain',
      reply: 'حاسس بألم في جنبك الشمال، علّمت المكان على الخريطة.',
      painContext: { painLocation: 'الجانب الشمال' },
      actions: [{ type: 'set_marker', target: 'خصر', view: 'front' }],
    }),
  },
  {
    name: 'gem.en.side',
    lang: 'en',
    utterance: 'my left side hurts',
    decision: decision({
      intent: 'locate_pain',
      reply: 'I understand — pain on your left side. I marked it on the map.',
      painContext: { painLocation: 'left side' },
      actions: [{ type: 'set_marker', target: 'flank', view: 'front' }],
    }),
  },
  {
    name: 'gem.fr.side',
    lang: 'fr',
    utterance: 'mon côté gauche me fait mal',
    decision: decision({
      intent: 'locate_pain',
      reply: 'Je comprends — douleur à gauche. Je l’ai marquée sur la carte.',
      painContext: { painLocation: 'côté gauche' },
      actions: [{ type: 'set_marker', target: 'flanc', view: 'front' }],
    }),
  },
  {
    name: 'gem.fr.behind',
    lang: 'fr',
    utterance: 'un peu en arrière',
    withMarker: true,
    decision: decision({
      intent: 'move_marker',
      reply: 'J’ai déplacé le repère un peu en arrière.',
      actions: [{ type: 'move_marker', direction: 'behind', amount: 'little' }],
    }),
  },
  {
    name: 'gem.ar.tab',
    lang: 'ar',
    utterance: 'وريني الأعضاء',
    decision: decision({
      intent: 'open_tab',
      reply: 'فتحتلك تبويب الأعضاء.',
      actions: [{ type: 'open_tab', tab: 'organs' }],
    }),
  },
];

const gemini = gemCases.map((c) => {
  const st = baseState({
    language: c.lang,
    selectedPainLocation: c.withMarker ? { x: 50, y: 50, view: 'front' } : null,
  });
  const turn = interpret(c.utterance, st, { aiDecision: c.decision });
  return { name: c.name, lang: c.lang, utterance: c.utterance, ...slim(turn, c.lang) };
});

// ---------------------------------------------------------------------------
// 2b) الثقة (confidence): ثقة عالية ⇒ تنفيذ مباشر، ثقة منخفضة + تخمين مكان/اتجاه ⇒ سؤال توضيحي قصير
// ---------------------------------------------------------------------------
interface ConfCase {
  name: string;
  lang: Lang;
  utterance: string;
  withMarker?: boolean;
  decision: GeminiDecision;
}
const confCases: ConfCase[] = [
  {
    // ثقة منخفضة + تخمين مكان ⇒ لا علامة، سؤال توضيحي بالعربية.
    name: 'conf.ar.vague',
    lang: 'ar',
    utterance: 'وجع هنا كده',
    decision: decision({
      intent: 'locate_pain',
      confidence: 0.35,
      reply: 'حاسس بألم في المنطقة دي.',
      actions: [{ type: 'set_marker', target: 'بطن', view: 'front' }],
    }),
  },
  {
    // ثقة منخفضة + تخمين مكان ⇒ لا علامة، سؤال توضيحي بالإنجليزية.
    name: 'conf.en.vague',
    lang: 'en',
    utterance: 'it hurts here',
    decision: decision({
      intent: 'locate_pain',
      confidence: 0.4,
      reply: 'I can see the pain is around here.',
      actions: [{ type: 'set_marker', target: 'belly', view: 'front' }],
    }),
  },
  {
    // ثقة منخفضة + تخمين اتجاه على علامة موجودة ⇒ لا تحريك، سؤال توضيحي بالفرنسية.
    name: 'conf.fr.vague',
    lang: 'fr',
    utterance: 'ça fait mal ici',
    withMarker: true,
    decision: decision({
      intent: 'move_marker',
      confidence: 0.4,
      reply: 'Je déplace le repère.',
      actions: [{ type: 'move_marker', direction: 'left', amount: 'little' }],
    }),
  },
  {
    // ثقة منخفضة + سؤال متابعة من النموذج ⇒ نستخدم سؤال النموذج نفسه.
    name: 'conf.ar.vagueFollow',
    lang: 'ar',
    utterance: 'وجع هنا كده',
    decision: decision({
      intent: 'locate_pain',
      confidence: 0.3,
      reply: '',
      followUpQuestion: 'فين بالظبط؟',
      actions: [{ type: 'set_marker', target: 'بطن', view: 'front' }],
    }),
  },
  {
    // ثقة عالية ⇒ تنفيذ مباشر (علامة حقيقية على الخريطة).
    name: 'conf.ar.high',
    lang: 'ar',
    utterance: 'وجع في بطني',
    decision: decision({
      intent: 'locate_pain',
      confidence: 0.95,
      reply: 'فهمت — ألم في البطن، علّمت المكان على الخريطة.',
      painContext: { painLocation: 'البطن' },
      actions: [{ type: 'set_marker', target: 'بطن', view: 'front' }],
    }),
  },
  {
    // ثقة منخفضة لكن القواعد فهمت الأمر الواضح ⇒ القواعد تفوز (علامة + ردّ القواعد، بلا سؤال توضيحي).
    name: 'conf.ar.clearRule',
    lang: 'ar',
    utterance: 'وجع في بطني',
    decision: decision({
      intent: 'locate_pain',
      confidence: 0.3,
      reply: 'حاسس بألم في البطن.',
      actions: [{ type: 'set_marker', target: 'بطن', view: 'front' }],
    }),
  },
];

const confidence = confCases.map((c) => {
  const st = baseState({
    language: c.lang,
    selectedPainLocation: c.withMarker ? { x: 50, y: 50, view: 'front' } : null,
  });
  const turn = interpret(c.utterance, st, { aiDecision: c.decision });
  const markers = turn.actions.filter((a) => a.type === 'set_marker' || a.type === 'move_marker');
  return {
    name: c.name,
    lang: c.lang,
    utterance: c.utterance,
    markerCount: markers.length,
    markerTarget: markers[0]?.targetId ?? null,
    ...slim(turn, c.lang),
  };
});

// ---------------------------------------------------------------------------
// 3) General Chat: ردّ بنفس اللغة + تصنيف صحيح
// ---------------------------------------------------------------------------
const generalCases: Array<{ name: string; lang: Lang; utterance: string }> = [
  { name: 'chat.ar', lang: 'ar', utterance: 'مرحبا' },
  { name: 'chat.en', lang: 'en', utterance: 'hello' },
  { name: 'chat.fr', lang: 'fr', utterance: 'bonjour' },
  { name: 'chat.ar.thanks', lang: 'ar', utterance: 'شكرا' },
  { name: 'chat.en.thanks', lang: 'en', utterance: 'thank you' },
  { name: 'chat.fr.thanks', lang: 'fr', utterance: 'merci' },
];
const general = generalCases.map((c) => {
  const turn = interpret(c.utterance, baseState({ language: c.lang }));
  return { name: c.name, lang: c.lang, utterance: c.utterance, ...slim(turn, c.lang) };
});

// ---------------------------------------------------------------------------
// 4) حفظ السياق عند تبديل اللغة (عربي → English)
// ---------------------------------------------------------------------------
// الجولة 1 (عربي): شكوى ألم + مدّة ⇒ علامة + سياق طبي.
const t1 = interpret('بطني بيوجعني من يومين', baseState({ language: 'ar' }), {
  aiDecision: decision({
    intent: 'locate_pain',
    reply: 'فهمت، ألم في البطن بقى له يومين.',
    painContext: { painLocation: 'البطن', painDuration: 'من يومين' },
    actions: [{ type: 'set_marker', target: 'بطن', view: 'front' }],
  }),
});
const markerAfterT1 = t1.actions.find((a) => a.type === 'set_marker');

// الجولة 2 (English بعد تبديل اللغة): معلومة جديدة فقط ⇒ يجب أن يبقى السياق السابق.
const t2 = interpret('and it is a sharp pain', baseState({
  language: 'en',
  selectedPainLocation: { x: 50, y: 40, view: 'front' },
  painContext: t1.painContext ?? null,
}), {
  aiDecision: decision({
    intent: 'medical_question',
    reply: 'Got it — a sharp pain. I still have the abdomen and the two-day duration.',
    painContext: { painQuality: ['sharp'] },
    actions: [],
  }),
});

const contextSwitch = {
  t1Lang: 'ar',
  t2Lang: 'en',
  t1MarkerTargetId: markerAfterT1?.targetId ?? null,
  t1PainLocation: t1.painContext?.painLocation ?? null,
  t1PainDuration: t1.painContext?.painDuration ?? null,
  t2PainLocation: t2.painContext?.painLocation ?? null,
  t2PainDuration: t2.painContext?.painDuration ?? null,
  t2PainQuality: t2.painContext?.painQuality ?? [],
  t2ReplyLang: t2.reply.en,
  t2Mode: t2.mode ?? null,
  // تحقّق مباشر من دالة الدمج الحقيقية عبر تبديل اللغة
  mergedKeepsLocation:
    (t2.painContext?.painLocation ?? null) === (t1.painContext?.painLocation ?? null),
  mergedKeepsDuration:
    (t2.painContext?.painDuration ?? null) === (t1.painContext?.painDuration ?? null),
  mergedAddsQuality: (t2.painContext?.painQuality ?? []).includes('sharp'),
  // دالة الدمج الصافية: اللغة لا تُفقد السياق
  pureMerge: (() => {
    const m = mergePainContext(t1.painContext ?? null, { painQuality: ['sharp'] });
    return { painLocation: m.painLocation, painDuration: m.painDuration, painQuality: m.painQuality };
  })(),
};

// ---------------------------------------------------------------------------
// 5) Voice: جولة واحدة ⇒ نطق واحد (بلا تكرار Turn/TTS) + قفل جلسة واحد
// ---------------------------------------------------------------------------
function runVoiceOnce() {
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
      speaks.push(text); // كل جولة ⇒ نطق واحد (speak يستدعي Speech.stop() قبل الجديد)
    },
  });
  // تيّار واقعي: interim ثم نهائي مكرّر ثم onend ثم إعادة تشغيل ثم نهائي مكرّر.
  gate.onSnapshot({ liveText: 'عندي وجع', hasFinal: false });
  gate.onFinal('عندي وجع في بطني');
  gate.onFinal('عندي وجع في بطني'); // نهائي مكرّر ⇒ يُسقَط
  gate.flush(); // onend
  gate.reset(); // إعادة تشغيل
  gate.onFinal('عندي وجع في بطني'); // إعادة تثبيت في نفس الجلسة ⇒ يُسقَط
  gate.flush(); // onend
  clock.advance(DEFAULT_TURN_SILENCE_MS * 2);
  return { turnCount: turns.length, speakCount: speaks.length, turns };
}

function runVoiceLock() {
  __resetVoiceSessionForTests();
  const firstClaim = claimVoiceSession('assistant');
  const secondClaim = claimVoiceSession('global'); // يجب أن يفشل: قفل واحد فقط
  const owner = currentVoiceSessionOwner();
  const globalIsOwner = isVoiceSessionOwner('global');
  releaseVoiceSession('assistant');
  const afterRelease = currentVoiceSessionOwner();
  return { firstClaim, secondClaim, owner, globalIsOwner, afterRelease };
}

const voice = { ...runVoiceOnce(), lock: runVoiceLock() };

// ---------------------------------------------------------------------------
// 6) الأمان: كل إجراء موجود فعلاً + كل targetId تشريحي موجود في الكتالوج
// ---------------------------------------------------------------------------
const allTurns = [...ruleBased, ...gemini];
const validTypes = new Set(Object.keys(ACTION_SAFETY));
const actionTypeCheck: Array<{ name: string; type: string; exists: boolean }> = [];
const targetIdCheck: Array<{ name: string; targetId: string; exists: boolean }> = [];
for (const r of allTurns) {
  for (const a of r.actions) {
    actionTypeCheck.push({ name: r.name, type: a.type, exists: validTypes.has(a.type) });
    if (a.targetId && /^(region|organ|point):/.test(a.targetId)) {
      targetIdCheck.push({ name: r.name, targetId: a.targetId, exists: !!findTarget(a.targetId) });
    }
  }
}

// ---------------------------------------------------------------------------
// 7) المخطّط المشترك (zod) موجود ويطابق أنواع المحرّك
// ---------------------------------------------------------------------------
// نتحقّق من أن مفاتيح ACTION_SAFETY مطابقة لأنواع الإجراءات في المخطّط المشترك.
const schemaCheck = {
  actionTypesMatchSafety: [...ASSISTANT_ACTION_TYPES].every((t) => validTypes.has(t)),
  actionTypesCount: ASSISTANT_ACTION_TYPES.length,
  safetyCount: validTypes.size,
  intentsCount: ASSISTANT_INTENTS.length,
};

process.stdout.write(
  JSON.stringify(
    {
      ruleBased,
      gemini,
      confidence,
      general,
      contextSwitch,
      voice,
      actionTypeCheck,
      targetIdCheck,
      schemaCheck,
      // عيّنة من الكتالوج للتأكد من وجود المناطق المستخدمة
      catalogSanity: {
        abs: !!getEntry('region:abs:front'),
        obliques: !!getEntry('region:obliques:front'),
        organsTab: !!getEntry('tab:organs'),
        heart: !!getEntry('organ:heart'),
      },
    },
    null,
    0,
  ),
);
