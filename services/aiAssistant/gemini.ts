export interface GeminiContext {
  prompt?: string;
  painContext?: Record<string, unknown>;
}

export interface GeminiDecision {
  action?: string;
  reply?: string;
}

export const requestGemini = async (prompt: string, context?: unknown): Promise<GeminiDecision> => {
  return { action: 'chat', reply: `تم استلام الاستفسار: ${prompt}` };
};

export const mergePainContext = (base: unknown, additional: unknown): Record<string, unknown> => {
  return { ...(base as object), ...(additional as object) };
};

export const normalizePainContext = (context: unknown): Record<string, unknown> => {
  return typeof context === 'object' && context !== null ? (context as Record<string, unknown>) : {};
};

export default {
  requestGemini,
  mergePainContext,
  normalizePainContext,
};
