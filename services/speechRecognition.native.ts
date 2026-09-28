// Native speech-recognition adapter.
// Kept in a platform-specific file so Expo Web never evaluates the native module.
import { useSpeechRecognitionEvent, ExpoSpeechRecognitionModule } from 'expo-speech-recognition';

export const SpeechRecognitionModule = ExpoSpeechRecognitionModule;
export { useSpeechRecognitionEvent as useSpeechRecognitionEvents };
