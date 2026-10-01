export class TurnGateService {
  private isListening: boolean = false;
  private isProcessingGateLocked: boolean = false;

  public startListening(onResult?: (transcript: string) => void) {
    if (this.isListening || this.isProcessingGateLocked) return;
    this.isListening = true;
  }

  public stopListening() {
    this.isListening = false;
  }

  public lockTurnGate() {
    this.isProcessingGateLocked = true;
    this.stopListening();
  }

  public unlockTurnGate() {
    this.isProcessingGateLocked = false;
  }

  public mergeSpeechTranscript(currentText: string, newChunk: string): string {
    if (this.isProcessingGateLocked) return currentText;
    const trimmedChunk = newChunk.trim();
    if (!currentText.includes(trimmedChunk)) {
      return `${currentText} ${trimmedChunk}`.trim();
    }
    return currentText;
  }
}

export const turnGate = new TurnGateService();
