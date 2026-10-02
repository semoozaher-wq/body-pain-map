import { useState, useCallback } from 'react';
import { createTurnGate, TurnGate } from '../services/speech/turnGate';

export interface AssistantData {
  lastText?: string;
  [key: string]: unknown;
}

export const useAppAssistant = () => {
  const [stage, setStage] = useState<string>('idle');
  const [data, setData] = useState<AssistantData>({});
  const [turnGate] = useState<TurnGate>(() => createTurnGate());

  const processInput = useCallback((text: string) => {
    if (!turnGate.canProceed()) return;
    setStage('processing');
    
    setTimeout(() => {
      setData({ lastText: text });
      setStage('complete');
      turnGate.flush();
    }, 500);
  }, [turnGate]);

  return { stage, data, processInput, turnGate };
};

export default useAppAssistant;
