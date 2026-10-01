import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);

export async function generateGeminiResponse({ prompt, painContext, medicalKnowledge, history }: any) {
  if (!apiKey) {
    throw new Error('Missing Gemini API Key');
  }

  const systemInstruction = `
أنت مساعد طبي ذكي متخصص في تطبيق BodyMap Pain.
وظيفتك فهم شكوى المريض المرفقة مع إحداثيات الألم والتفاعل معها بدقة.

توجيهات معالجة التعديل المكاني (Spatial Adjustments):
1. إذا ذكر المستخدم تعديلات مكانية بالعامية مثل: "تحت شوية"، "فوق"، "ورا أكتر"، "يمين شويه"، قم بتحديث الإحداثيات الحالية (updatedPainContext) بدلاً من إنشاء علامة جديدة.
2. المرجعية الطبية المرفقة: ${JSON.stringify(medicalKnowledge)}.

يجب أن يكون الرد بصيغة JSON حصرية كالآتي:
{
  "reply": "نص الرد للمستخدم",
  "action": "UPDATE_MARKER" | "NONE",
  "updatedPainContext": { "x": number, "y": number, "bodyPart": "string" },
  "redFlagsDetected": boolean
}
  `;

  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-pro',
    systemInstruction
  });

  const response = await model.generateContent({
    contents: [
      ...(history || []),
      { role: 'user', parts: [{ text: `Pain Context: ${JSON.stringify(painContext)}\nUser Prompt: ${prompt}` }] }
    ]
  });

  return JSON.parse(response.response.text());
}
