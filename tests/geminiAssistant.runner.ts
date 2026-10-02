import { requestGemini, mergePainContext, normalizePainContext } from '../services/aiAssistant/gemini';
import { interpretIntent, processTurn } from '../services/appAssistant/engine';

export const runGeminiTests = async (): Promise<boolean> => {
  try {
    const res = await requestGemini('اختبار');
    const merged = mergePainContext({}, {});
    const normalized = normalizePainContext({});
    const intent = interpretIntent('ألم في الرأس');
    await processTurn('اختبار');
    return !!(res && merged && normalized && intent);
  } catch (e) {
    return false;
  }
};

export default runGeminiTests;
