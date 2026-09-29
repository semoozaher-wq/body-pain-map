// tests/phase4.runner.ts
// ============================================================================
// مشغّل اختبارات المرحلة 4 — المساعد المركزي (محادثة عامة/طبية/تحكّم/مكاني/سياق)
// يُنتج JSON منظّمًا على stdout ليقرأه tests/phase4.test.cjs عبر node --test.
// يغطّي سيناريوهات عملية + جمل جديدة غير مُضافة مسبقًا إلى أي معجم.
// ============================================================================

import { interpret } from '../services/appAssistant/engine';
import { getEntry } from '../services/appAssistant/catalog';
import type { AppState, Lang } from '../services/appAssistant/types';

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
  conversationMode: 'idle',
  ...over,
});

interface Scenario {
  name: string;
  utterance: string;
  state?: Partial<AppState>;
  /** النمط المتوقّع من الطبقة التي عالجت الجملة. */
  expectMode?: 'general' | 'medical' | 'app' | 'idle';
  /** هل يجب أن تكون مفهومة؟ */
  expectUnderstood?: boolean;
}

// --- السيناريوهات العملية (11+) ---
const scenarios: Scenario[] = [
  // 1) محادثة عامة — تحيّة
  { name: 'gen.greeting', utterance: 'مساء الخير', expectMode: 'general', expectUnderstood: true },
  // 2) محادثة عامة — سؤال عن الحال
  { name: 'gen.howareyou', utterance: 'عامل إيه؟', expectMode: 'general', expectUnderstood: true },
  // 3) محادثة عامة — مشاعر
  { name: 'gen.emotion', utterance: 'أنا زهقان', expectMode: 'general', expectUnderstood: true },
  // 4) تغيير الموضوع
  { name: 'gen.topicChange', utterance: 'غير الموضوع', expectMode: 'general', expectUnderstood: true },
  // 5) شكر
  { name: 'gen.thanks', utterance: 'شكرا يا صاحبي', expectMode: 'general', expectUnderstood: true },
  // 6) هوية
  { name: 'gen.identity', utterance: 'انت مين؟', expectMode: 'general', expectUnderstood: true },
  // 7) طبي — شكوى ألم
  { name: 'med.pain', utterance: 'ضهري بيوجعني', expectMode: 'medical', expectUnderstood: true },
  // 8) متابعة مكانية
  { name: 'med.followup.above', utterance: 'من فوق', state: { selectedPainLocation: { x: 50, y: 40, view: 'back' } }, expectUnderstood: true },
  // 9) استكمال شدّة
  { name: 'med.severity', utterance: 'شدته 7', state: { selectedPainLocation: { x: 50, y: 40, view: 'back' } }, expectUnderstood: true },
  // 10) تصحيح مكاني
  { name: 'med.correction', utterance: 'لا، قصدي تحت شوية', state: { selectedPainLocation: { x: 50, y: 40, view: 'back' } }, expectUnderstood: true },
  // 11) فهم مكاني داخل الجملة — تحت صدري بشوية
  { name: 'spatial.inSentence.below', utterance: 'عندي وجع تحت صدري بشوية', expectUnderstood: true },
  // 12) فهم مكاني داخل الجملة — جنب القلب ناحية الشمال
  { name: 'spatial.inSentence.left', utterance: 'وجع جنب القلب ناحية الشمال', expectUnderstood: true },
  // 13) تحكّم في التطبيق — إبراز
  { name: 'app.highlight', utterance: 'وريني القلب', expectMode: 'app', expectUnderstood: true },
  // 14) تحكّم — تنقّل
  { name: 'app.navigate', utterance: 'روح للأعضاء', expectMode: 'app', expectUnderstood: true },
  // 15) جملة جديدة تمامًا (غير موجودة في أي معجم) — تحيّة مختلفة
  { name: 'new.greeting', utterance: 'صباح الفل يا نجم', expectMode: 'general', expectUnderstood: true },
  // 16) جملة جديدة — مشاعر مختلفة
  { name: 'new.emotion', utterance: 'حاسس إني مخنوق النهاردة', expectMode: 'general', expectUnderstood: true },
  // 17) جملة جديدة — تغيير موضوع بأسلوب مختلف
  { name: 'new.topicChange', utterance: 'خلاص كفاية كده سيبك منه', expectMode: 'general', expectUnderstood: true },
  // 18) غامضة فعلًا — يجب أن تبقى غير مفهومة وبلا إجراءات
  { name: 'ambiguous.gibberish', utterance: 'كلام عشوائي مالوش معنى خالص', expectUnderstood: false },
];

const results = scenarios.map((sc) => {
  const turn = interpret(sc.utterance, baseState(sc.state));
  return {
    name: sc.name,
    utterance: sc.utterance,
    understood: turn.understood,
    mode: turn.mode ?? null,
    needsConfirmation: turn.needsConfirmation,
    actions: turn.actions.map((a) => ({ type: a.type, targetId: a.targetId ?? null, value: a.value ?? null })),
    resolved: turn.resolved.map((r) => r.id),
    replyAr: turn.reply.ar,
    expectMode: sc.expectMode ?? null,
    expectUnderstood: sc.expectUnderstood ?? null,
  };
});

// تحقّق أمان: كل معرّف مُحدَّد يجب أن يوجد فعليًا في الكتالوج (لا تخمين تشريحي).
const resolvedIdCheck = results.flatMap((r) =>
  r.resolved.map((id) => ({ scenario: r.name, id, exists: !!getEntry(id) })),
);

const KNOWN_PREFIXES = ['screen:', 'tab:', 'organ:', 'point:', 'region:'];
const targetIdCheck = results.flatMap((r) =>
  r.actions
    .filter((a) => a.targetId && KNOWN_PREFIXES.some((p) => String(a.targetId).startsWith(p)))
    .map((a) => ({ scenario: r.name, id: a.targetId, exists: !!getEntry(String(a.targetId)) })),
);

// تحقّق: الجمل الغامضة لا تُنتج أي إجراءات (أمان — لا تنفيذ عشوائي).
const ambiguousSafe = results
  .filter((r) => r.expectUnderstood === false)
  .map((r) => ({ scenario: r.name, understood: r.understood, actions: r.actions.length }));

console.log(JSON.stringify({ results, resolvedIdCheck, targetIdCheck, ambiguousSafe }, null, 2));
