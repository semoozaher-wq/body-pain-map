import { Request, Response } from 'express';
import { generateGeminiResponse } from '../services/aiAssistant/gemini';
import { getMedicalContext } from '../services/medical/knowledgeRetrieval';

export async function handleAssistantRequest(req: Request, res: Response) {
  try {
    const { prompt, painContext, history } = req.body;

    const medicalKnowledge = await getMedicalContext(prompt, painContext);
    const aiResponse = await generateGeminiResponse({
      prompt,
      painContext,
      medicalKnowledge,
      history
    });

    return res.status(200).json(aiResponse);
  } catch (error) {
    console.error('Assistant API Error:', error);
    
    // Safe Fallback Payload لمنع كسر واجهة المستخدم عند انقطاع الاتصال
    return res.status(200).json({
      reply: "عذراً، حدث خطأ مؤقت في الاتصال بالخادم الطبي. يرجى محاولة الإرسال مرة أخرى.",
      action: "NONE",
      updatedPainContext: req.body?.painContext || null,
      redFlagsDetected: false,
      isFallback: true
    });
  }
}
