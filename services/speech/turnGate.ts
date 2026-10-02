export interface TurnGate {
  canProceed: () => boolean;
  reset: () => void;
}

export const createTurnGate = (): TurnGate => {
  let lastTime = 0;
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
    },
  };
};

export default createTurnGate;
