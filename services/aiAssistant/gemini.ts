export interface GeminiContext {
  prompt?: string;
  painContext?: Record<string, unknown>;
}

export interface GeminiDecision {
  action?: string;
  reply?: string;
  intent?: string;
  confidence?: number;
  [key: string]: unknown;
}

export const requestGemini = async (prompt: string, context?: unknown): Promise<GeminiDecision> => {
  return { action: 'chat', reply: `تم استلام الاستفسار: ${prompt}`, intent: 'general', confidence: 1.0 };
};

export const mergePainContext = (base: unknown, additional: unknown): Record<string, unknown> => {
  return { ...(base as object), ...(additional as object) };
};

export const normalizePainContext = (context: unknown): Record<string, unknown> => {
  return typeof context === 'object' && context !== null ? (context as Record<string, unknown>) : {};
};

export const normalizeDecision = (decision: unknown): GeminiDecision => {
  if (typeof decision === 'object' && decision !== null) {
    return decision as GeminiDecision;
  }
  return { action: 'chat', reply: String(decision || ''), intent: 'general' };
};

export default {
  requestGemini,
  mergePainContext,
  normalizePainContext,
  normalizeDecision,
};
