// Shared Arabic speech helpers.
// Keeps recogniser output readable and helps Web Speech choose a useful
// alternative when Android/Chrome returns several candidates.

const ARABIC_DIACRITICS = /[\u064B-\u0652\u0670\u0640]/g;
const INVISIBLE = /[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;

const SPEECH_HINTS = [
  'وجع', 'الم', 'ألم', 'بيوجع', 'يوجع', 'تعب', 'شد', 'حرقان', 'نغز', 'تنميل',
  'ضهر', 'ظهر', 'رجلي', 'رجل', 'ساق', 'ركبه', 'ركبة', 'فخذ', 'سمانه', 'سمانة',
  'قدم', 'كاحل', 'بطن', 'صدر', 'رقبه', 'رقبة', 'راس', 'رأس', 'عين', 'ودن', 'أذن',
  'فك', 'حلق', 'كتف', 'ذراع', 'يد', 'ايد', 'ايدى', 'ظهر', 'جنبي', 'جنب',
  'يمين', 'شمال', 'فوق', 'تحت', 'وسط', 'قدام', 'ورا', 'وراء', 'نفس المكان',
  'مساء الخير', 'صباح الخير', 'ازيك', 'عامل ايه', 'عايز', 'ممكن', 'افتح', 'وريني',
  'اقفل', 'شيله', 'امسحه', 'القلب', 'المخ', 'الكبد', 'المعدة', 'الرئة',
];

function foldArabic(text: string): string {
  return (text || '')
    .toLowerCase()
    .replace(INVISIBLE, '')
    .replace(ARABIC_DIACRITICS, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ـ/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Safe display/input cleanup: spelling variants only, never a location guess. */
export function normalizeSpeechText(text: string): string {
  let value = (text || '').replace(INVISIBLE, '').replace(/\s+/g, ' ').trim();
  if (!value) return '';
  // Common Egyptian/Arabic STT spellings that should hit the existing lexicon.
  const replacements: Array<[RegExp, string]> = [
    [/(^|[^\u0600-\u06FF])ضهري(?=$|[^\u0600-\u06FF])/gi, '$1ظهري'],
    [/(^|[^\u0600-\u06FF])ضهرك(?=$|[^\u0600-\u06FF])/gi, '$1ظهرك'],
    [/(^|[^\u0600-\u06FF])ضهر(?=$|[^\u0600-\u06FF])/gi, '$1ظهر'],
    [/(^|[^\u0600-\u06FF])راس(?=$|[^\u0600-\u06FF])/gi, '$1رأس'],
    [/(^|[^\u0600-\u06FF])ركبه(?=$|[^\u0600-\u06FF])/gi, '$1ركبة'],
    [/(^|[^\u0600-\u06FF])رقبه(?=$|[^\u0600-\u06FF])/gi, '$1رقبة'],
    [/(^|[^\u0600-\u06FF])سمانه(?=$|[^\u0600-\u06FF])/gi, '$1سمانة'],
    [/\bودني\b/gi, 'ودني'],
  ];
  for (const [pattern, replacement] of replacements) value = value.replace(pattern, replacement);
  return value;
}

/** Score only semantic usefulness; never decides the medical meaning itself. */
export function scoreSpeechAlternative(text: string, language = 'ar'): number {
  const raw = (text || '').trim();
  if (!raw) return -1000;
  const folded = foldArabic(raw);
  const tokens = folded.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  let score = 0;
  const hasArabic = /[\u0600-\u06FF]/.test(raw);
  const hasLatin = /[A-Za-z]/.test(raw);
  if (language === 'ar' && hasArabic) score += 3;
  if (language !== 'ar' && hasLatin) score += 3;
  if (tokens.length >= 2) score += 1;
  for (const hint of SPEECH_HINTS) {
    if (folded.includes(foldArabic(hint))) score += 4;
  }
  // Penalise obvious empty/noise candidates, but don't reject short valid speech.
  if (/^[^\p{L}\p{N}]+$/u.test(raw)) score -= 8;
  if (raw.length > 180) score -= 1;
  return score;
}

/** Pick the best candidate returned by Web Speech while preserving the browser's order on ties. */
export function pickBestSpeechAlternative(alternatives: string[], language = 'ar'): string {
  let best = '';
  let bestScore = -Infinity;
  for (const candidate of alternatives) {
    const text = normalizeSpeechText(candidate);
    const score = scoreSpeechAlternative(text, language);
    if (score > bestScore) {
      bestScore = score;
      best = text;
    }
  }
  return best;
}
