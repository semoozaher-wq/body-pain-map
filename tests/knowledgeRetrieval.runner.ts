// tests/knowledgeRetrieval.runner.ts
// ============================================================================
// مشغّل اختبارات طبقة المعرفة الطبية + الاسترجاع (Medical Knowledge Layer + Retrieval).
// يُنتج JSON منظّمًا على stdout ليقرأه اختبار node --test (knowledgeRetrieval.test.cjs).
//
// لا يتصل بالشبكة إطلاقًا. يُثبت:
//   (أ) الاسترجاع يُرجع المعرفة مع المصدر.
//   (ب) المعرفة غير الموجودة → no_reliable_knowledge.
//   (ج) Gemini يستخدم الاسترجاع فعليًا: تعليمات النظام المُرسَلة إلى generateObject
//       (عبر نقطة الربط الفعلية prepareGroundedRequest في api/assistant.ts) تحتوي
//       على المعرفة المسترجَعة + مصادرها، وتحتوي القيمة الحسّاسة عند غياب المعرفة.
// ============================================================================

import {
  retrieveMedicalKnowledge,
  buildKnowledgeContext,
  buildGroundedSystemPrompt,
  getKnowledgeCoverage,
  NO_RELIABLE_KNOWLEDGE,
} from '../services/medical/knowledgeRetrieval';
import { prepareGroundedRequest } from '../api/assistant';
import { GEMINI_SYSTEM_PROMPT } from '../services/aiAssistant/gemini';

// ── (أ) استعلامات حقيقية يجب أن تُرجع معرفة موثوقة مع مصدر ──────────────────
const REAL_QUERIES = [
  'عندي وجع في الركبة',
  'صداع نصفي',
  'عرق النسا',
  'ألم في المعدة',
  'التهاب المفاصل',
  'ألم في الصدر مع ضيق نفس',
];

// ── (ب) استعلامات لا توجد لها معرفة موثوقة → القيمة الحسّاسة ────────────────
const NO_KNOWLEDGE_QUERIES = [
  'xyzzy nonsense 12345',
  'شغل التطبيق',
  'افتح تبويب الاعضاء',
  'مرحبا',
  'الزهايمر في القمر',
  'كوكب زحل',
];

const retrieval = REAL_QUERIES.map((query) => {
  const r = retrieveMedicalKnowledge(query, 'ar');
  const sources = r.items.flatMap((i) => i.sources);
  return {
    query,
    status: r.status,
    sentinel: r.sentinel,
    itemCount: r.items.length,
    categories: r.categories,
    topName: r.items[0]?.name ?? null,
    topCategory: r.items[0]?.category ?? null,
    allItemsHaveSources: r.items.every((i) => i.sources.length > 0),
    allSourcesWellFormed: sources.every(
      (s) => typeof s.title === 'string' && s.title.length > 0 && typeof s.url === 'string' && s.url.startsWith('http'),
    ),
    sourceCount: sources.length,
    sampleSource: sources[0] ?? null,
    anyRedFlags: r.items.some((i) => i.hasRedFlags),
  };
});

const sentinel = NO_KNOWLEDGE_QUERIES.map((query) => {
  const r = retrieveMedicalKnowledge(query, 'ar');
  return {
    query,
    status: r.status,
    sentinel: r.sentinel,
    itemCount: r.items.length,
  };
});

// ── (ج) نقطة الربط الفعلية بين Retrieval و Gemini (prepareGroundedRequest) ──
const groundedOk = prepareGroundedRequest({ text: 'عندي وجع في الركبة', language: 'ar' });
const groundedOkResult = retrieveMedicalKnowledge('عندي وجع في الركبة', 'ar');
const topItem = groundedOkResult.items[0];
const topSourceUrl = topItem?.sources[0]?.url ?? '';

const grounded = {
  status: groundedOk.knowledge.status,
  itemCount: groundedOk.knowledge.itemCount,
  sourceCount: groundedOk.knowledge.sources.length,
  language: groundedOk.language,
  systemStartsWithBasePrompt: groundedOk.system.startsWith(GEMINI_SYSTEM_PROMPT),
  systemHasKnowledgeLayer: groundedOk.system.includes('KNOWLEDGE LAYER'),
  systemHasTopItemName: topItem ? groundedOk.system.includes(topItem.name) : false,
  systemHasSourceUrl: topSourceUrl ? groundedOk.system.includes(topSourceUrl) : false,
  systemHasSentinelRule: groundedOk.system.includes(NO_RELIABLE_KNOWLEDGE),
  systemLongerThanBase: groundedOk.system.length > GEMINI_SYSTEM_PROMPT.length,
};

const groundedSentinel = prepareGroundedRequest({ text: 'xyzzy nonsense 12345', language: 'ar' });
const sentinelGrounded = {
  status: groundedSentinel.knowledge.status,
  itemCount: groundedSentinel.knowledge.itemCount,
  sourceCount: groundedSentinel.knowledge.sources.length,
  systemHasSentinel: groundedSentinel.system.includes(NO_RELIABLE_KNOWLEDGE),
  systemHasKnowledgeLayer: groundedSentinel.system.includes('KNOWLEDGE LAYER'),
  systemStartsWithBasePrompt: groundedSentinel.system.startsWith(GEMINI_SYSTEM_PROMPT),
};

// ── (ج٢) دليل مباشر: بناء الـPrompt المُقيَّد دالّةً على نتيجة الاسترجاع ──────
const directResult = retrieveMedicalKnowledge('صداع نصفي', 'ar');
const directPrompt = buildGroundedSystemPrompt(GEMINI_SYSTEM_PROMPT, directResult, 'ar');
const directContext = buildKnowledgeContext(directResult, 'ar');
const direct = {
  status: directResult.status,
  contextHasSourceLabel: directContext.includes('المصدر'),
  contextHasTopName: directResult.items[0] ? directContext.includes(directResult.items[0].name) : false,
  promptHasContext: directPrompt.includes(directContext),
  sentinelContext: buildKnowledgeContext(retrieveMedicalKnowledge('xyzzy', 'ar'), 'ar'),
};

const coverage = getKnowledgeCoverage();

const out = {
  retrieval,
  sentinel,
  grounded,
  sentinelGrounded,
  direct,
  coverage,
  constants: { NO_RELIABLE_KNOWLEDGE },
};

process.stdout.write(JSON.stringify(out));
