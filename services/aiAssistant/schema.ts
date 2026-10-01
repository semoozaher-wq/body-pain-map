// services/aiAssistant/schema.ts
// ============================================================================
// مخطط القرار المشترك (Structured Output schema — zod)
// ----------------------------------------------------------------------------
// هذا الملف *نقي* (pure): لا يستورد أي شيء من React Native ولا من الشبكة،
// حتى يمكن استيراده من كلٍّ من:
//   • نقطة النهاية الخادمية api/assistant.ts (لتوليد قرار منظّم عبر generateObject).
//   • الاختبارات (للتحقّق من صحة العقد).
//
// العقد مطابق تمامًا للشكل الذي يفهمه المحرّك في services/appAssistant/engine.ts
// وللأنواع GeminiDecision/GeminiAction في services/aiAssistant/gemini.ts،
// حتى يبقى مسار العميل (normalizeDecision) كما هو دون أي تعديل.
// ============================================================================

import { z } from 'zod';

// ---------------------------------------------------------------------------
// القيم المسموحة (مطابقة لقائمة التعليمات في GEMINI_SYSTEM_PROMPT)
// ---------------------------------------------------------------------------

/** أنواع الإجراءات المسموحة فعليًا (مطابقة لمفاتيح ACTION_SAFETY). */
export const ASSISTANT_ACTION_TYPES = [
  'set_marker',
  'move_marker',
  'set_view',
  'set_sex',
  'navigate',
  'open_tab',
  'highlight',
  'clear_highlight',
  'search',
  'filter',
  'zoom',
  'set_severity',
  'back',
  'save',
  'open_last_entry',
  'doctor_summary',
  'reset_context',
] as const;

/** النوايا الموحّدة التي يعالجها المحرّك. */
export const ASSISTANT_INTENTS = [
  'locate_pain',
  'move_marker',
  'keep_marker',
  'set_severity',
  'navigate',
  'open_tab',
  'set_view',
  'set_sex',
  'highlight',
  'clear_highlight',
  'search',
  'filter',
  'zoom',
  'save',
  'back',
  'open_last_entry',
  'doctor_summary',
  'general',
  'medical_question',
  'unknown',
] as const;

// ---------------------------------------------------------------------------
// المخططات
// ---------------------------------------------------------------------------

/** إجراء مقترح من النموذج — يحمل إشارة دلالية فقط (بلا إحداثيات x/y). */
export const assistantActionSchema = z.object({
  type: z.enum(ASSISTANT_ACTION_TYPES),
  target: z.string().nullable().optional(),
  direction: z.string().nullable().optional(),
  amount: z.string().nullable().optional(),
  view: z.string().nullable().optional(),
  screen: z.string().nullable().optional(),
  tab: z.string().nullable().optional(),
  value: z.union([z.string(), z.number()]).nullable().optional(),
  label: z.string().nullable().optional(),
});

/** السياق الطبي المستخرج من كلام المستخدم (فقط الحقول التي عليها دليل). */
export const assistantPainContextSchema = z.object({
  painLocation: z.string().nullable().optional(),
  painOnset: z.string().nullable().optional(),
  painDuration: z.string().nullable().optional(),
  painSeverity: z.number().nullable().optional(),
  painQuality: z.array(z.string()).optional(),
  radiation: z.boolean().optional(),
  aggravatingFactors: z.array(z.string()).optional(),
  relievingFactors: z.array(z.string()).optional(),
  associatedSymptoms: z.array(z.string()).optional(),
  injury: z.boolean().optional(),
  medications: z.array(z.string()).optional(),
  redFlags: z.array(z.string()).optional(),
  userCorrections: z.array(z.string()).optional(),
});

/** القرار الموحّد الذي يُعيده النموذج (Structured Output). */
export const assistantDecisionSchema = z.object({
  intent: z.enum(ASSISTANT_INTENTS),
  reply: z.string(),
  // ثقة النموذج في فهمه للمكان/الاتجاه/الطلب: من 0 (غير متأكد) إلى 1 (متأكد تمامًا).
  // المحرّك يستخدمها للتفريق بين التنفيذ المباشر (ثقة عالية) والسؤال التوضيحي (ثقة منخفضة).
  confidence: z.number().min(0).max(1),
  painContext: assistantPainContextSchema.nullable(),
  actions: z.array(assistantActionSchema),
  followUpQuestion: z.string().nullable(),
});

/** نوع القرار المستنبط من المخطط. */
export type AssistantDecision = z.infer<typeof assistantDecisionSchema>;
