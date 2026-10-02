export const NO_RELIABLE_KNOWLEDGE = 'NO_RELIABLE_KNOWLEDGE';

export const retrieveMedicalKnowledge = async (query: string): Promise<string> => {
  if (!query) return NO_RELIABLE_KNOWLEDGE;
  return `معلومات طبية عامة متعلقة بـ: ${query}`;
};

export default {
  NO_RELIABLE_KNOWLEDGE,
  retrieveMedicalKnowledge,
};
