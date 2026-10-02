import { useState, useCallback } from 'react';
import { createTurnGate } from '../services/speech/turnGate';

export const useAppAssistant = () => {
  const [stage, setStage] = useState<string>('idle');
  const [data, setData] = useState<Record<string, any>>({});
  const turnGate = createTurnGate();

  const processInput = useCallback((text: string) => {
    if (!turnGate.canProceed()) return;
    setStage('processing');
    // معالجة النص
    setTimeout(() => {
      setData({ lastText: text });
      setStage('complete');
    }, 500);
  }, []);

  return { stage, data, processInput };
};

export default useAppAssistant;
