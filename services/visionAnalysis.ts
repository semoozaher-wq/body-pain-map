// services/visionAnalysis.ts
//
// جسر اختياري لتحليل الصور عبر نماذج الرؤية/اللغة الطبية متعددة الوسائط.
// معطّل افتراضيًا ولا يعمل إلا عند توفير مفتاح وعنوان نقطة نهاية عبر متغيّرات البيئة.
// لا يوجد أي مفتاح مكتوب داخل الشيفرة، ولا تُرفع الصور تلقائيًا.

import { mergeWithModelPossibilities, runRuleBasedTriage } from './clinicalAnalysis';
import type { MergedPossibility, TriageInput } from './clinicalAnalysis';

const endpoint = String(process.env.EXPO_PUBLIC_MEDICAL_VISION_ENDPOINT ?? '');
const apiKey = String(process.env.EXPO_PUBLIC_MEDICAL_VISION_KEY ?? '');

export const isVisionConfigured = Boolean(endpoint && apiKey);

export const MEDICAL_SYSTEM_PROMPT = [
  'أنت مساعد توعية صحية تعليمي، ولست طبيبًا ولا تقدّم تشخيصًا.',
  'صِف الأنماط البصرية الظاهرة فقط، واذكر الاحتمالات المبدئية بصيغة "قد يكون / احتمال" وليس تأكيدًا.',
  'لا تذكر جرعات أدوية ولا خطط علاج. أضف دائمًا أنه يجب مراجعة طبيب مؤهل.',
  'إذا ظهرت علامة خطر، اذكر الحاجة للتقييم العاجل أولًا.',
].join(' ');

export type VisionRequest = {
  imageDataUrl: string;
  symptomText?: string;
  triage: TriageInput;
};

export type VisionResponse = MergedPossibility & { configured: boolean; noteAr: string };

/**
 * يبني الطلب ثم يستدعي نقطة النهاية إن كانت مُهيّأة.
 * عند غياب التهيئة يعيد نتيجة الفرز القائمة على القواعد فقط، دون تلفيق أي احتمالات.
 */
export async function analyseImageWithPossibilities(request: VisionRequest): Promise<VisionResponse> {
  const triage = runRuleBasedTriage(request.triage);

  // الفرز القائم على القواعد يُنفّذ أولًا ودائمًا، قبل أي استدعاء للنموذج.
  if (triage.escalation) {
    return {
      ...mergeWithModelPossibilities(triage, []),
      configured: isVisionConfigured,
      noteAr: 'تم إيقاف التحليل الآلي ورفع درجة الخطورة بناءً على علامات الإنذار المُدخلة.',
    };
  }

  if (!isVisionConfigured) {
    return {
      ...mergeWithModelPossibilities(triage, []),
      configured: false,
      noteAr: 'تحليل الصورة الآلي غير مُهيّأ في هذه النسخة. تُعرض احتمالات إرشادية عامة فقط. لتفعيله، اضبط متغيّرات البيئة: EXPO_PUBLIC_MEDICAL_VISION_ENDPOINT و EXPO_PUBLIC_MEDICAL_VISION_KEY. لا تضع أي مفتاح داخل الشيفرة.',
    };
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        system: MEDICAL_SYSTEM_PROMPT,
        image: request.imageDataUrl,
        text: request.symptomText ?? '',
        locale: 'ar',
      }),
    });
    if (!response.ok) throw new Error(`vision endpoint returned ${response.status}`);
    const payload: unknown = await response.json();
    const list: string[] = Array.isArray((payload as { possibilities?: unknown }).possibilities)
      ? ((payload as { possibilities: unknown[] }).possibilities.filter((item): item is string => typeof item === 'string'))
      : [];
    return {
      ...mergeWithModelPossibilities(triage, list),
      configured: true,
      noteAr: 'احتمالات مبدئية من نموذج آلي؛ تحتاج تأكيدًا من طبيب مؤهل.',
    };
  } catch {
    return {
      ...mergeWithModelPossibilities(triage, []),
      configured: true,
      noteAr: 'تعذّر الاتصال بخدمة التحليل؛ تُعرض النتائج الإرشادية القائمة على القواعد فقط.',
    };
  }
}
