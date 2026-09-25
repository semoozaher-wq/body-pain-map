'use strict';

/**
 * محرك التحليل السريري المساعد (rule-based).
 * كل النواتج احتمالات مبدئية وليست تشخيصًا.
 * هذا الملف خالٍ من أي اعتماد خارجي ليعمل في الويب وفي اختبارات Node.
 */

const BLUR_VARIANCE_THRESHOLD = 100;
const MIN_DIMENSION = 200;
const DARK_MEAN_THRESHOLD = 40;
const BRIGHT_MEAN_THRESHOLD = 225;

/** تحويل RGBA إلى تدرّج رمادي (0–255). */
function toGrayscale(pixels, width, height) {
  const total = width * height;
  const out = new Float64Array(total);
  for (let i = 0, p = 0; i < total; i++, p += 4) {
    const r = Number(pixels[p]) || 0;
    const g = Number(pixels[p + 1]) || 0;
    const b = Number(pixels[p + 2]) || 0;
    out[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }
  return out;
}

/** تباين لابلاسيان: مقياس حِدّة الصورة. القيم المنخفضة تعني ضبابية. */
function laplacianVariance(gray, width, height) {
  if (width < 3 || height < 3 || gray.length < width * height) return 0;
  let sum = 0;
  let sumSq = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const lap = gray[i - width] + gray[i + width] + gray[i - 1] + gray[i + 1] - 4 * gray[i];
      sum += lap;
      sumSq += lap * lap;
      count++;
    }
  }
  if (count === 0) return 0;
  const mean = sum / count;
  return sumSq / count - mean * mean;
}

function meanBrightness(gray) {
  if (!gray.length) return 0;
  let total = 0;
  for (let i = 0; i < gray.length; i++) total += gray[i];
  return total / gray.length;
}

/** فحص جودة الصورة قبل أي تحليل: الأبعاد + الضبابية + الإضاءة. */
function assessImageQuality(pixels, width, height) {
  const gray = pixels instanceof Float64Array ? pixels : toGrayscale(pixels, width, height);
  const issues = [];
  const variance = laplacianVariance(gray, width, height);
  const brightness = meanBrightness(gray);

  if (width < MIN_DIMENSION || height < MIN_DIMENSION) issues.push('too_small');
  if (variance < BLUR_VARIANCE_THRESHOLD) issues.push('blurry');
  if (brightness < DARK_MEAN_THRESHOLD) issues.push('too_dark');
  if (brightness > BRIGHT_MEAN_THRESHOLD) issues.push('too_bright');

  const ok = issues.length === 0;
  const guidance = {
    too_small: 'الأبعاد صغيرة جدًا؛ صوّر من مسافة أقرب بدقة أعلى.',
    blurry: 'الصورة غير واضحة (ضبابية)؛ ثبّت الكاميرا وأعد التصوير.',
    too_dark: 'الإضاءة منخفضة جدًا؛ استخدم إضاءة جيدة دون وهج مباشر.',
    too_bright: 'الصورة شديدة السطوع؛ تجنّب الفلاش المباشر.',
  };
  const messageAr = ok
    ? 'جودة الصورة مناسبة للتحليل المبدئي.'
    : issues.map((issue) => guidance[issue]).join(' ');

  return { ok, issues, laplacianVariance: variance, brightness, messageAr };
}

/** أسئلة توضيحية ديناميكية بعد رفع الصورة. */
function buildFollowUpQuestions(context) {
  const ctx = context || {};
  const key = String(ctx.groupKey || ctx.areaId || '').toLowerCase();
  const base = [
    { id: 'onset', questionAr: 'منذ متى بدأت المشكلة؟', type: 'choice', options: ['منذ ساعات', 'منذ أيام', 'منذ أسابيع', 'أكثر من شهر'], required: true },
    { id: 'fever', questionAr: 'هل توجد حرارة أو قشعريرة؟', type: 'choice', options: ['نعم', 'لا'], required: true },
    { id: 'severity', questionAr: 'شدة الألم/الإزعاج من 0 إلى 10', type: 'number', required: true },
    { id: 'spreading', questionAr: 'هل تتوسّع المساحة المصابة؟', type: 'choice', options: ['نعم', 'لا', 'لا أعرف'], required: true },
  ];

  const skin = /skin|جلد|rash|طفح|lesion/.test(key);
  const joint = /joint|مفصل|knee|ankle|wrist|shoulder|كتف/.test(key);
  const throat = /throat|حلق|neck|رقبة|lymph|غدد/.test(key);

  const extra = [];
  if (skin) {
    extra.push({ id: 'itch', questionAr: 'هل يوجد حكّة؟', type: 'choice', options: ['نعم', 'لا'], required: false });
    extra.push({ id: 'blister', questionAr: 'هل يوجد تقرّح أو نزيف؟', type: 'choice', options: ['نعم', 'لا'], required: false });
    extra.push({ id: 'asymmetry', questionAr: 'هل الشامة/الكتلة غير متماثلة أو تغيّرت؟', type: 'choice', options: ['نعم', 'لا', 'لا أعرف'], required: false });
  }
  if (joint) {
    extra.push({ id: 'swelling', questionAr: 'هل يوجد تورّم؟', type: 'choice', options: ['نعم', 'لا'], required: false });
    extra.push({ id: 'injury', questionAr: 'هل سبقها إصابة أو رضح؟', type: 'choice', options: ['نعم', 'لا'], required: false });
  }
  if (throat) {
    extra.push({ id: 'swallow', questionAr: 'هل يوجد صعوبة في البلع أو التنفّس؟', type: 'choice', options: ['نعم', 'لا'], required: true });
  }
  return base.concat(extra);
}

const EMERGENCY_FLAGS = [
  'ضيق نفس', 'صدر', 'إغماء', 'ارتباك', 'ضعف مفاجئ', 'كلام', 'نزيف', 'إصابة قوية',
  'shortness of breath', 'chest', 'fainting', 'confusion', 'speech', 'bleeding',
];

/**
 * محرك الفرز القائم على القواعد — يُنفّذ قبل أي نموذج ذكاء اصطناعي.
 * لا يولّد احتمالات؛ دوره فقط رفع درجة الخطورة أو استبعاد الحالات الخطرة مبكرًا.
 */
function runRuleBasedTriage(input) {
  const ctx = input || {};
  const flags = Array.isArray(ctx.redFlags) ? ctx.redFlags : [];
  const reasonsAr = [];
  let urgency = 'routine';

  const flagText = flags.join(' ').toLowerCase();
  const emergency = flags.some((flag) => EMERGENCY_FLAGS.some((word) => String(flag).toLowerCase().includes(word.toLowerCase())));
  if (emergency || EMERGENCY_FLAGS.some((word) => flagText.includes(word.toLowerCase())) || ctx.breathingDifficulty) {
    urgency = 'emergency';
    reasonsAr.push('توجد علامة إنذار محتملة (مثل ضيق النفس أو ألم صدر ضاغط أو إغماء). هذه علامات تستوجب طوارئ فورية.');
    return { urgency, escalation: true, reasonsAr, specialty: 'طوارئ / طب عاجل', specialtyKey: 'emergency' };
  }

  const intensity = Number(ctx.severity);
  if (ctx.fever && ctx.spreading) {
    urgency = 'urgent';
    reasonsAr.push('حرارة مع انتشار سريع للمساحة المصابة احتمال يستوجب تقييمًا عاجلًا اليوم.');
  } else if (ctx.spreading || ctx.blister) {
    urgency = 'soon';
    reasonsAr.push('انتشار أو تقرّح احتمال يحتاج تقييمًا طبيًا قريبًا.');
  } else if (Number.isFinite(intensity) && intensity >= 8) {
    urgency = 'soon';
    reasonsAr.push('شدة الألم/الإزعاج المسجّلة عالية؛ هذا لا يشخّص سببًا لكنه يستوجب تقييمًا سريعًا.');
  } else if (ctx.durationDays && Number(ctx.durationDays) > 14) {
    urgency = 'routine';
    reasonsAr.push('استمرار المشكلة أكثر من أسبوعين احتمال يستوجب مراجعة طبية روتينية.');
  } else {
    urgency = 'self_care';
    reasonsAr.push('لا توجد علامات إنذار مُدخلة؛ يمكن متابعة العناية الذاتية ومراقبة التغيّر.');
  }

  const specialty = mapSpecialty(ctx.groupKey || ctx.areaId, { skinContext: ctx.skinContext });
  return { urgency, escalation: urgency === 'emergency' || urgency === 'urgent', reasonsAr, specialty: specialty.labelAr, specialtyKey: specialty.key };
}

const SPECIALTY_RULES = [
  { key: 'emergency', labelAr: 'طوارئ / طب عاجل', pattern: /emergency|طارئ/ },
  { key: 'dermatology', labelAr: 'الجلدية', pattern: /skin|جلد|rash|طفح|lesion|شامة|nevus|derma/ },
  { key: 'cardiology', labelAr: 'القلب والأوعية', pattern: /chest|صدر|heart|cardiac|قلب/ },
  { key: 'gastroenterology', labelAr: 'الجهاز الهضمي', pattern: /abdomen|بطن|stomach|intestin|liver|كبد|معدة/ },
  { key: 'neurology', labelAr: 'الأعصاب', pattern: /head|رأس|headache|صداع|migraine|nerve|عصب/ },
  { key: 'rheumatology', labelAr: 'الروماتيزم', pattern: /arthritis|روماتيزم|autoimmune|مناعة/ },
  { key: 'orthopedics', labelAr: 'العظام والمفاصل', pattern: /joint|مفصل|knee|ankle|wrist|shoulder|back|ظهر|spine|عمود|muscle|عضل|عظم/ },
];

/** توجيه للتخصص الموصى بزيارته (احتمالي، لا يحدد التشخيص). */
function mapSpecialty(groupKey, options) {
  const opts = options || {};
  const key = String(groupKey || '').toLowerCase();
  for (const rule of SPECIALTY_RULES) {
    if (rule.pattern.test(key)) {
      return { key: rule.key, labelAr: rule.labelAr, rationaleAr: 'بناءً على المنطقة المصابة كما وصفها المستخدم.' };
    }
  }
  if (opts.skinContext) {
    return { key: 'dermatology', labelAr: 'الجلدية', rationaleAr: 'مشكلة جلدية ظاهرة تحتاج تقييمًا جلديًا.' };
  }
  return { key: 'general', labelAr: 'طب عام', rationaleAr: 'البدء بطبيب عام مناسب عند غياب مؤشر على تخصص أضيق.' };
}

/** دمج نتيجة الفرز مع احتمالات النموذج الذكي دون تقديم تشخيص قاطع. */
function mergeWithModelPossibilities(triage, possibilities) {
  const items = Array.isArray(possibilities) ? possibilities : [];
  return {
    urgency: triage.urgency,
    escalation: triage.escalation,
    reasonsAr: triage.reasonsAr.slice(),
    specialty: triage.specialty,
    specialtyKey: triage.specialtyKey,
    possibilities: items,
    labelAr: 'احتمالات مبدئية مرتبة ترتيبًا تقديريًا فقط — وليست تشخيصًا طبيًا.',
  };
}

module.exports = {
  BLUR_VARIANCE_THRESHOLD,
  MIN_DIMENSION,
  toGrayscale,
  laplacianVariance,
  meanBrightness,
  assessImageQuality,
  buildFollowUpQuestions,
  runRuleBasedTriage,
  mapSpecialty,
  mergeWithModelPossibilities,
};
