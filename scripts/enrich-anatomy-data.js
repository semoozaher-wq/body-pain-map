const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'data', 'anatomyPainMap.json');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

const groupLabels = {
  chest: 'عضلات الصدر', obliques: 'العضلات المائلة', abs: 'عضلات البطن', biceps: 'العضلة ذات الرأسين',
  triceps: 'العضلة ثلاثية الرؤوس', neck: 'عضلات الرقبة', trapezius: 'العضلة شبه المنحرفة',
  deltoids: 'العضلة الدالية', adductors: 'العضلات المقربة', quadriceps: 'العضلات الرباعية',
  knees: 'منطقة الركبة', tibialis: 'العضلة الظنبوبية الأمامية', calves: 'عضلات بطة الساق', ankles: 'الكاحل',
  feet: 'عضلات القدم', gluteal: 'عضلات الألوية', hamstring: 'عضلات خلف الفخذ', 'lower-back': 'عضلات أسفل الظهر',
  'upper-back': 'عضلات أعلى الظهر', forearm: 'عضلات الساعد', hands: 'عضلات اليد', head: 'منطقة الرأس', hair: 'فروة الرأس',
};
const sideLabels = { left: 'الأيسر', right: 'الأيمن', center: 'الوسط', null: '' };
const axisLabels = { upper: 'العلوي', middle: 'الأوسط', lower: 'السفلي', inner: 'الداخلي', outer: 'الخارجي', center: 'المركزي', null: '' };
const viewLabels = { front: 'الأمامي', back: 'الخلفي' };

function safeContent(group) {
  const urgent = {
    chest: 'اطلب المساعدة العاجلة عند ألم الصدر المصحوب بضيق نفس أو تعرّق شديد أو إغماء أو امتداده للذراع أو الفك.',
    head: 'اطلب المساعدة العاجلة عند صداع مفاجئ شديد جدًا أو مع ضعف أو اضطراب كلام أو إغماء.',
    neck: 'اطلب تقييمًا عاجلًا عند ألم الرقبة بعد إصابة قوية أو مع ضعف أو خدر أو صعوبة في المشي.',
    calves: 'اطلب تقييمًا عاجلًا عند تورم مفاجئ في ساق واحدة أو احمرار وسخونة شديدة أو ضيق نفس.',
  }[group] || null;
  const causes = {
    chest: ['إجهاد عضلي أو حركة متكررة', 'وضعية جلوس أو تمرين غير مناسب', 'كدمة أو شد في الأنسجة الرخوة'],
    head: ['توتر عضلي أو إجهاد', 'قلة النوم أو الجفاف', 'صداع أولي شائع يحتاج تقييمًا إذا تكرر'],
    neck: ['وضعية طويلة أمام الشاشة', 'شد عضلي أو حركة مفاجئة', 'إجهاد أو نوم بوضعية غير مريحة'],
    calves: ['إجهاد أو تشنج عضلي', 'نشاط بدني زائد أو جفاف', 'كدمة أو شد في الأنسجة الرخوة'],
  }[group] || ['إجهاد أو شد في الأنسجة الرخوة', 'حركة متكررة أو وضعية غير مناسبة', 'كدمة أو إصابة بسيطة'];
  const recommendation = urgent ? 'إذا استمر الألم أو تكرر، استشر طبيبًا لتقييم السبب. عند وجود علامة الخطر المذكورة، اطلب المساعدة العاجلة.' : 'خفف النشاط المسبب مؤقتًا وراقب الأعراض. استشر طبيبًا إذا استمر الألم أو ازداد أو صاحبه تورم أو ضعف أو خدر.';
  return { commonCauses: causes, warning: urgent, recommendation };
}

const ids = Object.keys(data.muscles);
ids.forEach((id, index) => {
  const item = data.muscles[id];
  const groupLabel = groupLabels[item.group] || item.group;
  const sideLabel = sideLabels[item.side] || '';
  const axisLabel = axisLabels[item.axis] || '';
  const viewLabel = (item.views || []).map((v) => viewLabels[v] || v).join(' / ');
  const location = [groupLabel, sideLabel, axisLabel, viewLabel].filter(Boolean).join(' — ');
  const safe = safeContent(item.group);
  item.partNumber = index + 1;
  item.groupLabelAr = groupLabel;
  item.locationAr = location;
  item.labelAr = `${groupLabel}${sideLabel ? ` ${sideLabel}` : ''}${axisLabel ? ` — ${axisLabel}` : ''} — جزء ${index + 1}`;
  item.labelEn = `${item.group} ${item.side || 'center'} ${item.axis || 'segment'} (${item.views.join('/')}) — part ${index + 1}`;
  item.commonCauses = safe.commonCauses;
  item.warning = safe.warning;
  item.recommendation = safe.recommendation;
  item.medicalSafety = 'محتوى إرشادي عام، لا يثبت سبب الألم ولا يقدم تشخيصًا أو علاجًا.';
  item.reviewStatus = 'general-template-needs-clinical-review';
});

data.generatedAt = new Date().toISOString().slice(0, 10);
data.reviewNote = 'تم توليد بنية ومحتوى إرشادي عام لكل جزء. يجب مراجعة النصوص طبيًا وقانونيًا قبل النشر التجاري أو استخدامها لاتخاذ قرار علاجي.';
fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
console.log(`Enriched ${ids.length} anatomy parts across ${Object.keys(data.groups).length} groups.`);
