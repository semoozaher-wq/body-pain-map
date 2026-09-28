// Web speech-recognition adapter.
// The native Expo speech-recognition package is intentionally not imported here:
// importing a native-only module from the web bundle can crash the whole screen.
import { useEffect } from 'react';

export const SpeechRecognitionModule: any = null;

export function useSpeechRecognitionEvents(
  _event: string,
  _listener: (...args: any[]) => void,
): void {
  useEffect(() => {}, []);
}
