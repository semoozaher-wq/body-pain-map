// Fallback platform adapter. Expo/Metro normally resolves speechRecognition.web.ts
// or speechRecognition.native.ts first. Keeping this base file web-safe prevents a
// non-platform-aware bundler from importing the native speech-recognition module.
import { useEffect } from 'react';

export const SpeechRecognitionModule: any = null;

export function useSpeechRecognitionEvents(
  _event: string,
  _listener: (...args: any[]) => void,
): void {
  useEffect(() => {}, []);
}
