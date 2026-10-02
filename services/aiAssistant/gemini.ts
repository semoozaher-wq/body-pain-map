import { KnowledgeQueryResult } from '../medical/knowledgeRetrieval';

export interface PainContext {
  readonly organId: string | null;
  readonly severity: number;
  readonly localizedNotes: string;
}

export const generateGeminiResponse = async (
  userMessage: string,
  painContext: Readonly<PainContext>,
  retrievalResult: KnowledgeQueryResult
): Promise<string> => {
  // Guardrail Check: التوقف بسلامة في حالة عدم كفاية المعرفة أو وجود خطورة
  if (retrievalResult.status === 'NO_RELIABLE_KNOWLEDGE') {
    return retrievalResult.content;
  }

  if (retrievalResult.status === 'RED_FLAG_DETECTED') {
    return retrievalResult.content;
  }

  const systemInstruction = `
    أنت مساعد طبي استرشادي. 
    السياق الحالي للمريض: [العضو: ${painContext.organId || 'غير حدد'}, الشدة: ${painContext.severity}/10].
    
    القواعد الصارمة:
    1. يُحظر تماماً اقتراح العلاج بالإبر الصينية (Acupuncture) أو أي إجراءات اختراقية/طب تقليدي غير مثبت طبرياً.
    2. لا تقم باختراع أو تخمين معلومات طبية خارج السياق المرفق.
    3. قدم النصائح بأسلوب علمي مبسط مع التأكيد على زيارة الطبيب.
  `;

  // هنا يتم إرسال systemInstruction و userMessage للـ Gemini API
  return `تمت المعالجة بناءً على السياق الثابت لنقطة الألم (${painContext.organId})`;
};
