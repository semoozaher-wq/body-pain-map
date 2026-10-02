// tests/geminiAssistant.runner.ts
// ============================================================================
// مشغّل اختبارات طبقة الذكاء الاصطناعي الحقيقية (Gemini).
// يُنتج JSON منظّمًا على stdout ليقرأه اختبار node --test (geminiAssistant.test.cjs).
//
// لا يتصل بالشبكة إطلاقًا: نُمرّر قرارًا موحّدًا (aiDecision) يحاكي ردّ Gemini
// إلى نفس نقطة الدمج الفعلية في services/appAssistant/engine.ts، ثم نتحقّق من
// تحويله إلى إجراءات موجودة فعلاً + سياسة العلامة الواحدة + دمج السياق الطبي.
// كما نتحقّق من مسار السقوط (fallback) عبر interpretAsync بلا خادم.
// ============================================================================

import { interpret, interpretAsync } from '../services/appAssistant/engine';
import { findTarget } from '../services/appAssistant/catalog';
import { ACTION_SAFETY } from '../services/appAssistant/actions';
import { normalizeDecision, mergePainContext } from '../services/aiAssistant/gemini';
import type { AppState, Lang, AssistantTurn } from '../services/appAssistant/types';
import type { GeminiDecision } from '../services/aiAssistant/gemini';

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

const slim = (t: AssistantTurn) => ({
  understood: t.understood,
  mode: t.mode ?? null,
  needsConfirmation: t.needsConfirmation,
  actions: t.actions.map((a) => ({ type: a.type, targetId: a.targetId ?? null, value: a.value ?? null })),
  replyAr: t.reply.ar,
  painContext: t.painContext ?? null,
  redFlags: t.medical?.redFlags?.map((r) => r.id) ?? [],
});

async function main() {
  const results: Array<Record<string, unknown>> = [];
  const push = (name: string, turn: AssistantTurn) => results.push({ name, ...slim(turn) });

  // ── 1) "عندي وجع في بطني" → فهم الشكوى + تحديد المنطقة بلا إجبار على النقر ──
  push(
    'gemini.belly',
    interpret('عندي وجع في بطني', baseState(), {
      aiDecision: decision({
        intent: 'locate_pain',
        reply: 'حاسس بألم في البطن، علّمت المكان على الخريطة.',
        confidence: 0.92,
        painContext: { painLocation: 'البطن' },
        actions: [{ type: 'set_marker', target: 'بطن', view: 'front' }],
      }),
    }),
  );

  // ── 2) "على الشمال" → تحريك نفس العلامة (لا علامة جديدة) ──
  push(
    'gemini.left',
    interpret('على الشمال', baseState({ selectedPainLocation: { x: 50, y: 50, view: 'front' } }), {
      aiDecision: decision({
        intent: 'move_marker',
        reply: 'حرّكت العلامة على الشمال شوية.',
        actions: [{ type: 'move_marker', direction: 'left', amount: 'little' }],
      }),
    }),
  );

  // ── 3) "فوق شوية" → تحريك نفس العلامة نسبيًا ──
  push(
    'gemini.up',
    interpret('فوق شوية', baseState({ selectedPainLocation: { x: 50, y: 50, view: 'front' } }), {
      aiDecision: decision({
        intent: 'move_marker',
        reply: 'طلّعت العلامة لفوق شوية.',
        actions: [{ type: 'move_marker', direction: 'above', amount: 'little' }],
      }),
    }),
  );

  // ── 4) "ورا شوية" → استخدام سياق الظهر ──
  push(
    'gemini.back',
    interpret('ورا شوية', baseState({ selectedPainLocation: { x: 50, y: 40, view: 'front' } }), {
      aiDecision: decision({
        intent: 'move_marker',
        reply: 'ودّيتك للجهة الخلفية (الظهر).',
        actions: [{ type: 'move_marker', direction: 'behind', amount: 'little' }],
      }),
    }),
  );

  // ── 5) "نفس المكان" → لا set_marker ولا move_marker (حتى لو أرسل النموذج حركة) ──
  push(
    'gemini.same',
    interpret('نفس المكان', baseState({ selectedPainLocation: { x: 50, y: 50, view: 'front' } }), {
      aiDecision: decision({
        intent: 'keep_marker',
        reply: 'تمام، سايب المكان زي ما هو.',
        // قرار «مُشوّش» عمدًا: set_marker + move_marker + direction=same — يجب أن تُسقَط كلها.
        actions: [
          { type: 'set_marker', target: 'بطن', view: 'front' },
          { type: 'move_marker', direction: 'same' },
        ],
      }),
    }),
  );

  // ── 6) "عندي وجع في بطني من يومين" → رسالة واحدة + سياق صحيح (المدة) ──
  push(
    'gemini.belly.duration',
    interpret('عندي وجع في بطني من يومين', baseState(), {
      aiDecision: decision({
        intent: 'locate_pain',
        reply: 'فهمت، ألم في البطن بقاله يومين.',
        painContext: { painLocation: 'البطن', painDuration: 'من يومين' },
        actions: [{ type: 'set_marker', target: 'بطن', view: 'front' }],
      }),
    }),
  );

  // ── 7) صورة + "هنا بيوجعني" → إجراء منظّم من الصورة + الكلام + السياق ──
  push(
    'gemini.image',
    interpret('هنا بيوجعني', baseState(), {
      hasImage: true,
      image: 'data:image/png;base64,AAAA',
      aiDecision: decision({
        intent: 'locate_pain',
        reply: 'من الصورة والكلام، المكان يبان في البطن.',
        confidence: 0.7,
        painContext: { painLocation: 'البطن' },
        actions: [{ type: 'set_marker', target: 'بطن', view: 'front' }],
      }),
    }),
  );

  // ── 8) إجراءات تطبيق أخرى من Gemini (تنقّل + تبويب) → إجراءات موجودة فعلاً ──
  push(
    'gemini.navigate',
    interpret('وريني الأعضاء', baseState(), {
      aiDecision: decision({
        intent: 'open_tab',
        reply: 'فتحتلك تبويب الأعضاء.',
        actions: [{ type: 'open_tab', tab: 'organs' }],
      }),
    }),
  );

  // ── 9) الأمان: علامة خطر محلية + ردّ Gemini → يجب أن يبقى تحذير الأمان ──
  const geminiSafetyReply = 'GEMINI_SAFETY_MARKER';
  const safetyTurn = interpret('عندي ألم في صدري وضيق نفس', baseState(), {
    aiDecision: decision({
      intent: 'medical_question',
      reply: geminiSafetyReply,
      actions: [],
    }),
  });
  push('gemini.safety', safetyTurn);

  // ── 10) السقوط (fallback): interpretAsync بلا خادم → محرّك القواعد ──
  const fbUtterance = 'روح للأعضاء';
  const asyncTurn = await interpretAsync(fbUtterance, baseState());
  const syncTurn = interpret(fbUtterance, baseState());
  const fallback = {
    understood: asyncTurn.understood,
    actions: asyncTurn.actions.map((a) => ({ type: a.type, targetId: a.targetId ?? null })),
    replyAr: asyncTurn.reply.ar,
    matchesSync:
      asyncTurn.understood === syncTurn.understood &&
      JSON.stringify(asyncTurn.actions.map((a) => [a.type, a.targetId ?? null])) ===
        JSON.stringify(syncTurn.actions.map((a) => [a.type, a.targetId ?? null])),
  };

  // ── 11) التحقق من التطبيع: إسقاط الإجراءات غير الموجودة (لا اختراع إجراءات) ──
  const normKept = normalizeDecision({
    intent: 'locate_pain',
    reply: 'x',
    actions: [
      { type: 'set_marker', target: 'بطن' },
      { type: 'teleport_user', target: 'moon' }, // غير موجود → يُسقَط
      { type: 'not_a_real_action' }, // غير موجود → يُسقَط
    ],
  });
  const normEmpty = normalizeDecision({});
  const normOnlyReply = normalizeDecision({ reply: 'مرحبا' });
  const normalize = {
    keptTypes: (normKept?.actions ?? []).map((a) => a.type),
    emptyIsNull: normEmpty === null,
    onlyReplyActions: (normOnlyReply?.actions ?? []).length,
    onlyReplyNotNull: normOnlyReply !== null,
  };

  // ── 12) دمج السياق الطبي: الجديد يغلب + المصفوفات تتّحد ──
  const merged = mergePainContext(
    {
      painLocation: 'الظهر',
      painLocationLabel: null,
      painOnset: null,
      painDuration: null,
      painSeverity: null,
      painQuality: ['حارق'],
      radiation: false,
      aggravatingFactors: [],
      relievingFactors: [],
      associatedSymptoms: [],
      injury: false,
      medications: [],
      redFlags: [],
      userCorrections: [],
    },
    { painLocation: 'البطن', painDuration: 'من يومين', painQuality: ['نابض'] },
  );
  const merge = {
    painLocation: merged.painLocation,
    painDuration: merged.painDuration,
    painQuality: merged.painQuality,
  };

  // ── 13) لا إجراءات مُختلقة: كل نوع إجراء في كل النتائج موجود فعلاً ──
  const validTypes = new Set(Object.keys(ACTION_SAFETY));
  const actionTypeCheck: Array<{ name: string; type: string; exists: boolean }> = [];
  for (const r of results) {
    for (const a of (r.actions as Array<{ type: string }>) ?? []) {
      actionTypeCheck.push({ name: String(r.name), type: a.type, exists: validTypes.has(a.type) });
    }
  }

  // ── 14) كل targetId تشريحي مُحلّ موجود فعلاً في الكتالوج ──
  const targetIdCheck: Array<{ name: string; targetId: string; exists: boolean }> = [];
  for (const r of results) {
    for (const a of (r.actions as Array<{ type: string; targetId: string | null }>) ?? []) {
      if (a.targetId && /^(region|organ|point):/.test(a.targetId)) {
        targetIdCheck.push({ name: String(r.name), targetId: a.targetId, exists: !!findTarget(a.targetId) });
      }
    }
  }

  const safety = {
    redFlags: safetyTurn.medical?.redFlags?.map((r) => r.id) ?? [],
    replyHasGemini: safetyTurn.reply.ar.includes(geminiSafetyReply),
    replyLongerThanGemini: safetyTurn.reply.ar.length > geminiSafetyReply.length,
  };

  process.stdout.write(
    JSON.stringify(
      { results, fallback, normalize, merge, actionTypeCheck, targetIdCheck, safety },
      null,
      0,
    ),
  );
}

main().catch((err) => {
  process.stderr.write(String(err && err.stack ? err.stack : err));
  process.exit(1);
});
