import { interpretIntent, processTurn } from '../services/appAssistant/engine';

interface TestCase {
  id: string;
  input: string;
  expectedIntent?: string;
}

const testCases: TestCase[] = [
  { id: '1', input: 'عندي ألم في الرأس', expectedIntent: 'headache' },
  { id: '2', input: 'مرحباً بك', expectedIntent: 'greeting' },
];

export const runAssistantTests = async (): Promise<boolean> => {
  let allPassed = true;

  for (const testCase of testCases) {
    const result = interpretIntent(testCase.input);
    if (!result) {
      allPassed = false;
    }
    await processTurn({ input: testCase.input });
  }

  return allPassed;
};

export default runAssistantTests;
