export interface TurnGate {
  canProceed: () => boolean;
  reset: () => void;
  onFinal: (callback: (text: string) => void) => void;
  flush: () => void;
}

export const createTurnGate = (): TurnGate => {
  let lastTime = 0;
  let finalCallback: ((text: string) => void) | null = null;

  return {
    canProceed: () => {
      const now = Date.now();
      if (now - lastTime > 1000) {
        lastTime = now;
        return true;
      }
      return false;
    },
    reset: () => {
      lastTime = 0;
      finalCallback = null;
    },
    onFinal: (callback: (text: string) => void) => {
      finalCallback = callback;
    },
    flush: () => {
      if (finalCallback) {
        finalCallback('');
      }
    },
  };
};

export const TurnGate = createTurnGate;
export default createTurnGate;
