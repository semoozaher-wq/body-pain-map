// استخدام fetch المباشر لضمان التوافق التام مع Vercel بدون مكتبات خارجية
export const generateGeminiResponse = async (prompt: string): Promise<string> => {
  const apiKey = process.env.GEMINI_API_KEY || '';

  if (!apiKey) {
    return 'لم يتم العثور على مفتاح API الخاص بـ Gemini. يرجى ضبط GEMINI_API_KEY في إعدادات البيئة.';
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
        }),
      }
    );

    const data = await response.json();

    if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
      return data.candidates[0].content.parts[0].text;
    }

    return 'عذراً، لم يتم إرجاع استجابة صالحة من الذكاء الاصطناعي.';
  } catch (error) {
    console.error('Error in Gemini API request:', error);
    return 'حدث خطأ أثناء الاتصال بالذكاء الاصطناعي. يرجى المحاولة لاحقاً.';
  }
};

export default generateGeminiResponse;
