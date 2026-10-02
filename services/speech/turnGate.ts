export interface TurnGate {
  canProceed: () => boolean;
  reset: () => void;
  onFinal: (callback: (text: string) => void) => void;
  onSnapshot?: (callback: (text: string) => void) => void;
  flush: () => void;
}

export const createTurnGate = (): TurnGate => {
  let lastTime = 0;
  let finalCb: ((text: string) => void) | null = null;
  let snapCb: ((text: string) => void) | null = null;

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
      finalCb = null;
      snapCb = null;
    },
    onFinal: (cb: (text: string) => void) => { finalCb = cb; },
    onSnapshot: (cb: (text: string) => void) => { snapCb = cb; },
    flush: () => { if (finalCb) finalCb(''); },
  };
};

export const TurnGate = createTurnGate;
export default createTurnGate;
