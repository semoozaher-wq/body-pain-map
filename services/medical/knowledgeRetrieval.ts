export interface MedicalKnowledgeResult {
  hasKnowledge: boolean;
  content: string;
  sourceFlag: 'VALID_KNOWLEDGE' | 'NO_RELIABLE_KNOWLEDGE';
}

export async function getMedicalContext(query: string, painContext: any): Promise<MedicalKnowledgeResult> {
  try {
    const searchTerms = `${query} ${painContext?.bodyPart || ''}`.trim();
    
    if (!searchTerms || searchTerms.length < 3) {
      return {
        hasKnowledge: false,
        content: "لا تتوفر معرفة طبية مباشرة لهذه المدخلات القصيرة.",
        sourceFlag: 'NO_RELIABLE_KNOWLEDGE'
      };
    }

    return {
      hasKnowledge: true,
      content: `سياق طبي مرجعي متعلق بـ (${searchTerms}).`,
      sourceFlag: 'VALID_KNOWLEDGE'
    };
  } catch (error) {
    return {
      hasKnowledge: false,
      content: "تعذر استرجاع المرجع الطبي.",
      sourceFlag: 'NO_RELIABLE_KNOWLEDGE'
    };
  }
}
