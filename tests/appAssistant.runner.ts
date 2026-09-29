// tests/appAssistant.runner.ts
// ============================================================================
// مشغّل سيناريوهات اختبار المساعد المركزي (المرحلة 3).
// يُنتج JSON منظّمًا على stdout ليقرأه اختبار node --test (appAssistant.test.cjs).
// يغطّي: التنقّل، الفهم المكاني، التحكّم بخريطة الألم، الحوار، والأمان.
// ============================================================================

import { interpret } from '../services/appAssistant/engine';
import { getEntry } from '../services/appAssistant/catalog';
import { VOICE_STATES, canTransition, afterSpeechEnd, afterUserSpeech, onListenStart } from '../services/appAssistant/voiceMachine';
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
  ...over,
});

const ctx = (over: Partial<AppState['conversationContext']>) => ({
  ...baseState().conversationContext,
  ...over,
});

interface Scenario {
  name: string;
  utterance: string;
  state?: Partial<AppState>;
}

const scenarios: Scenario[] = [
  // --- التنقّل ---
  { name: 'nav.organs.1', utterance: 'روحني للأعضاء' },
  { name: 'nav.organs.2', utterance: 'عايز أشوف الأعضاء' },
  { name: 'nav.history', utterance: 'فين سجل الألم؟' },
  { name: 'nav.anatomy', utterance: 'افتحلي الصفحة بتاعة التشريح' },
  { name: 'nav.muscles', utterance: 'وديني للعضلات' },
  { name: 'nav.library', utterance: 'افتح المكتبة الطبية' },
  { name: 'nav.home', utterance: 'روح للرئيسية' },
  { name: 'nav.health', utterance: 'عايز المعلومات الصحية' },
  // --- التحكّم بخريطة الألم ---
  { name: 'body.complaint', utterance: 'ضهري بيوجعني' },
  { name: 'body.marker', utterance: 'علم على مكان الألم' },
  { name: 'body.move.down', utterance: 'تحت شوية', state: { selectedPainLocation: { x: 50, y: 40, view: 'back' } } },
  { name: 'body.move.right', utterance: 'ناحية اليمين', state: { selectedPainLocation: { x: 50, y: 40, view: 'back' } } },
  { name: 'body.move.noBase', utterance: 'تحت شوية' },
  // --- الفهم المكاني ---
  { name: 'spatial.above', utterance: 'اللي فوقه', state: { conversationContext: ctx({ lastReferencedId: 'organ:heart', lastReferencedKind: 'organ', lastReferencedCoords: { x: 52, y: 40, view: 'front' } }) } },
  { name: 'spatial.below', utterance: 'اللي تحته', state: { conversationContext: ctx({ lastReferencedId: 'organ:heart', lastReferencedKind: 'organ', lastReferencedCoords: { x: 52, y: 40, view: 'front' } }) } },
  { name: 'spatial.between', utterance: 'بين الاتنين', state: { conversationContext: ctx({ lastReferencedId: 'organ:heart', lastReferencedKind: 'organ', lastReferencedCoords: { x: 52, y: 40, view: 'front' }, previousReferencedId: 'organ:lungs', previousReferencedCoords: { x: 45, y: 35, view: 'front' } }) } },
  { name: 'spatial.near', utterance: 'وريني اللي جنبه', state: { conversationContext: ctx({ lastReferencedId: 'organ:heart', lastReferencedKind: 'organ', lastReferencedCoords: { x: 52, y: 40, view: 'front' } }) } },
  // --- الحوار / سياق متعدد الرسائل ---
  { name: 'conv.lastEntry', utterance: 'وريني آخر تسجيل' },
  { name: 'conv.doctorSummary', utterance: 'اعملي ملخص للدكتور' },
  { name: 'conv.medications', utterance: 'عايز أعرف عن الأدوية' },
  { name: 'conv.acupressure', utterance: 'وريني نقاط الضغط' },
  { name: 'conv.describe', utterance: 'انا فين؟' },
  // --- الأمان ---
  { name: 'safe.clearHistory', utterance: 'امسح السجل' },
  { name: 'safe.savePain', utterance: 'احفظ الألم ده' },
  { name: 'safe.saveSeverity', utterance: 'سجل ألم شدته 7 من 10' },
  { name: 'safe.unknown', utterance: 'كلام عشوائي مالوش معنى خالص' },
];

const results = scenarios.map((sc) => {
  const turn = interpret(sc.utterance, baseState(sc.state));
  return {
    name: sc.name,
    utterance: sc.utterance,
    understood: turn.understood,
    needsConfirmation: turn.needsConfirmation,
    actions: turn.actions.map((a) => ({ type: a.type, targetId: a.targetId ?? null, value: a.value ?? null })),
    pending: turn.pendingConfirmation.map((a) => ({ type: a.type, targetId: a.targetId ?? null })),
    resolved: turn.resolved.map((r) => r.id),
    replyAr: turn.reply.ar,
  };
});

// تحقّق أمان: كل معرّف مُحدَّد يجب أن يوجد فعليًا في الكتالوج (لا تخمين تشريحي).
const resolvedIdCheck = results.flatMap((r) =>
  r.resolved.map((id) => ({ scenario: r.name, id, exists: !!getEntry(id) })),
);

// تحقّق أمان: لا إجراءات مجهولة، ولا معرّفات تشريحية مُختلقة في targetId.
const KNOWN_PREFIXES = ['screen:', 'tab:', 'organ:', 'point:', 'region:'];
const targetIdCheck = results.flatMap((r) =>
  r.actions
    .filter((a) => a.targetId && KNOWN_PREFIXES.some((p) => String(a.targetId).startsWith(p)))
    .map((a) => ({ scenario: r.name, id: a.targetId, exists: !!getEntry(String(a.targetId)) })),
);

// آلة الحالة الصوتية: نتحقّق من الدورة Listening → Thinking → Speaking → Listening
const voice = {
  states: VOICE_STATES,
  // دورة المكالمة المستمرة
  idle_to_listening: canTransition('idle', 'listening'),
  listening_to_thinking: canTransition('listening', 'thinking'),
  thinking_to_speaking: canTransition('thinking', 'speaking'),
  speaking_to_listening: canTransition('speaking', 'listening'),
  // بعد التقاط الكلام → تفكير
  afterUserSpeech: afterUserSpeech(),
  // بعد انتهاء النطق داخل مكالمة → استماع، وخارجها → خمول
  afterSpeechEndInCall: afterSpeechEnd(true),
  afterSpeechEndIdle: afterSpeechEnd(false),
  // بدء الاستماع
  onListenStart: onListenStart(),
  // انتقال غير مسموح (خمول → خمول مسموح، لكن لا نسمح بانتقال عشوائي غير معرّف)
  allStatesCovered: VOICE_STATES.length === 4,
};

const output = { results, resolvedIdCheck, targetIdCheck, voice };
process.stdout.write(JSON.stringify(output));
