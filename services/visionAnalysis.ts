// services/visionAnalysis.ts
//
// جسر اختياري لتحليل الصور عبر نقطة نهاية موثوقة/خادم وسيط.
// معطّل افتراضيًا. لا تُضع أسرار API داخل تطبيق Expo؛ أي اعتماد سري يجب أن
// يبقى في الخادم الوسيط الذي يحدده EXPO_PUBLIC_MEDICAL_VISION_ENDPOINT.

import { mergeWithModelPossibilities, runRuleBasedTriage } from './clinicalAnalysis';
import type { MergedPossibility, TriageInput } from './clinicalAnalysis';

const endpoint = String(process.env.EXPO_PUBLIC_MEDICAL_VISION_ENDPOINT ?? '').trim();
const VISION_TIMEOUT_MS = 20_000;
const MAX_IMAGE_DATA_URL_LENGTH = 12_000_000;

// لا نقرأ EXPO_PUBLIC_* كمفتاح سري. متغيرات Expo العامة قد تدخل حزمة العميل.
export const isVisionConfigured = Boolean(endpoint);
export const visionEndpointTimeoutMs = VISION_TIMEOUT_MS;

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
 * نقطة النهاية يجب أن تكون خادمًا وسيطًا موثوقًا إذا كان مزود الرؤية يحتاج
 * مفتاحًا سريًا؛ لا تُرسل أسرار المزود من تطبيق العميل.
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
      noteAr: 'تحليل الصورة الآلي غير مُهيّأ في هذه النسخة. تُعرض احتمالات إرشادية عامة فقط. لتفعيله، اضبط EXPO_PUBLIC_MEDICAL_VISION_ENDPOINT على خادم وسيط موثوق. لا تضع مفتاح مزود الخدمة داخل تطبيق العميل.',
    };
  }

  if (!request.imageDataUrl || request.imageDataUrl.length > MAX_IMAGE_DATA_URL_LENGTH) {
    return {
      ...mergeWithModelPossibilities(triage, []),
      configured: true,
      noteAr: 'تعذّر إرسال الصورة: الملف فارغ أو أكبر من الحد الآمن. استخدم صورة أصغر ثم حاول مجددًا.',
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VISION_TIMEOUT_MS);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        system: MEDICAL_SYSTEM_PROMPT,
        image: request.imageDataUrl,
        text: request.symptomText ?? '',
        locale: 'ar',
      }),
    });
    if (!response.ok) throw new Error(`vision endpoint returned ${response.status}`);
    const payload: unknown = await response.json();
    const rawList = Array.isArray((payload as { possibilities?: unknown }).possibilities)
      ? (payload as { possibilities: unknown[] }).possibilities
      : [];
    const list = rawList.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map((item) => item.trim().slice(0, 240)).slice(0, 8);
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
  } finally {
    clearTimeout(timeout);
  }
}
