import { requestGemini, mergePainContext, normalizePainContext, normalizeDecision } from '../services/aiAssistant/gemini';
import { interpretIntent, processTurn } from '../services/appAssistant/engine';

export const interpretAsync = async (text: string) => {
  return interpretIntent(text);
};

export const runGeminiTests = async (): Promise<boolean> => {
  try {
    const res = await requestGemini('اختبار');
    const merged = mergePainContext({}, {});
    const normalized = normalizePainContext({});
    const decision = normalizeDecision(res);
    const intent = await interpretAsync('ألم في الرأس');
    await processTurn('اختبار');
    return !!(res && merged && normalized && decision && intent);
  } catch (e) {
    return false;
  }
};

export default runGeminiTests;
