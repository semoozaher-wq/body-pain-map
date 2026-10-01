// Regression cases for Android/Expo native speech transcript duplication.
// Intended to be merged into the existing voicePipeline tests.
import { mergeSpeechTranscript } from '../services/speech/transcript';

const cases = [
  ['عندي وجع', 'عندي وجع'],
  ['عندي وجع', 'في بطني'],
  ['عندي وجع في بطني', 'في بطني'],
  ['عندي وجع في بطني', 'عندي وجع في بطني'],
] as const;

let value = '';
for (const [, incoming] of cases) {
  value = mergeSpeechTranscript(value, incoming);
}

if (value !== 'عندي وجع في بطني') {
  throw new Error(`Native transcript merge regression: ${value}`);
}

console.log('Native transcript merge: PASS');
