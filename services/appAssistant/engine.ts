export interface GeminiContext {
  prompt?: string;
  painContext?: Record<string, unknown>;
}

export interface GeminiDecision {
  action?: string;
  reply?: string;
  intent?: string;
  confidence?: number;
}

export interface AssistantAction {
  type: string;
  payload?: unknown;
}

export const requestGemini = async (prompt: string, context?: unknown): Promise<GeminiDecision> => {
  return { action: 'chat', reply: `تم استلام الاستفسار: ${prompt}`, intent: 'general' };
};

export const mergePainContext = (base: unknown, additional: unknown): Record<string, unknown> => {
  return { ...(base as object), ...(additional as object) };
};

export const generalChatReply = async (message: string): Promise<string> => {
  return `شكراً لتواصلك: ${message}`;
};

export const interpretIntent = (text: string): { intent: string; confidence: number } => {
  return { intent: 'general_chat', confidence: 1.0 };
};

export const interpretAsync = async (text: string): Promise<{ intent: string; confidence: number }> => {
  return interpretIntent(text);
};

export const processTurn = async (turn: { input?: string; text?: string } | string) => {
  const query = typeof turn === 'string' ? turn : turn?.input || turn?.text || '';
  return {
    reply: `تم معالجة الطلب: ${query}`,
    action: { type: 'NONE' },
  };
};

export class AppAssistantEngine {
  async processUserMessage(message: string, context?: GeminiContext) {
    try {
      const response = await generalChatReply(message);
      return { success: true, response };
    } catch (error) {
      return { success: false, error: 'حدث خطأ في المعالجة' };
    }
  }
}

export default AppAssistantEngine;
