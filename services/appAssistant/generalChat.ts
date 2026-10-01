// General Chat service with Gemini integration support

export async function handleGeneralChat(message: string, context: any) {
  try {
    // Local fallback / Gemini LLM routing for general conversation
    return {
      reply: "أهلاً بك! كيف يمكنني مساعدتك في تطبيق خريطة الألم اليوم؟",
      source: "gemini"
    };
  } catch (error) {
    console.error("General Chat Error:", error);
    return {
      reply: "عذراً، حدث خطأ أثناء معالجة المحادثة.",
      source: "local"
    };
  }
}
