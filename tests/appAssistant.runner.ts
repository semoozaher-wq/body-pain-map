import { requestGemini, mergePainContext, normalizePainContext } from '../services/aiAssistant/gemini';
import { processTurn } from '../services/appAssistant/engine';
import { retrieveMedicalKnowledge, NO_RELIABLE_KNOWLEDGE } from '../services/medical/knowledgeRetrieval';

export const runGeminiIntegrationTests = async (): Promise<boolean> => {
  try {
    const res = await requestGemini('فحص شامل');
    const knowledge = await retrieveMedicalKnowledge('ألم الرأس');
    const merged = mergePainContext({ location: 'head' }, { intensity: 5 });
    const normalized = normalizePainContext(merged);
    await processTurn('اختبار التكامل');
    return !!(res && normalized && knowledge !== NO_RELIABLE_KNOWLEDGE);
  } catch (error: unknown) {
    console.error('Integration Test Error:', error);
    return false;
  }
};

export default runGeminiIntegrationTests;
