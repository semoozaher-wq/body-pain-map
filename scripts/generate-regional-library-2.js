#!/usr/bin/env node
// scripts/generate-regional-library-2.js
// الدفعة الإقليمية الثانية: الرقبة (D) + الكتف (E) + الفخذ والورك (F)، مع ربط كل حالة
// ببنى تشريحية محددة من regionTaxonomy.json، وأعراض جديدة، وأسئلة فرز إضافية.
// كل كود ICD-10 هنا تم التحقق منه عبر بحث موثّق؛ وأي كود غير مُتحقَّق منه يُوسَم صراحةً.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const R = (p) => path.join(root, p);
const read = (p) => JSON.parse(fs.readFileSync(R(p), 'utf8'));
const L = (ar, en, fr) => ({ ar, en, fr });
const S = (t, u) => ({ title: t, url: u });
const ICD = S('ICD-10-CM (WHO/CDC)', 'https://www.cdc.gov/nchs/icd/icd-10-cm.htm');
const MLP = (p) => S('MedlinePlus (NLM) - ' + p, 'https://medlineplus.gov/' + p);

const tax = read('data/medical/regionTaxonomy.json');
const TAX_BASE = new Set(tax.regions.map((r) => r.id));
const TAX_SUB = new Set(tax.regions.flatMap((r) => r.subRegions.map((s) => s.id)));
const TAX_STRUCT = new Set(tax.regions.flatMap((r) => r.subRegions.flatMap((s) => s.structures.map((x) => x.id))));
const checkTax = (sub, structs, where) => {
  if (!TAX_SUB.has(sub)) throw new Error(where + ': unknown subRegion ' + sub);
  structs.forEach((s) => { if (!TAX_STRUCT.has(s)) throw new Error(where + ': unknown structure ' + s); });
};

/* ---------- 1) أعراض جديدة ---------- */
const NEW_SYMPTOMS = [
['local:arm-radiating-pain','ألم ينتشر من الرقبة إلى الذراع','Neck pain radiating into the arm','Douleur cervicale irradiant au bras','ألم يبدأ في الرقبة أو الكتف ويمتد إلى الذراع أو اليد.','Pain starting in the neck or shoulder and extending into the arm or hand.','Douleur partant de la nuque ou de l épaule et descendant dans le bras.',['head_neck','upper_limb'],false],
['local:hand-clumsiness','تراجع المهارات الدقيقة في اليد','Loss of fine hand dexterity','Perte de dextérité fine','صعوبة في الأزرار أو الكتابة أو إسقاط الأشياء من اليد.','Difficulty with buttons or writing, or dropping objects from the hand.','Difficulté avec les boutons ou l écriture, ou chute d objets.',['head_neck','upper_limb'],true],
['local:gait-unsteadiness','عدم ثبات في المشي','Unsteady gait','Démarche instable','إحساس بعدم التوازن أو تعثّر متكرر أثناء المشي.','A sense of imbalance or frequent tripping while walking.','Sensation de déséquilibre ou trébuchements fréquents.',['head_neck','lower_limb','back'],true],
['local:shoulder-weakness','ضعف في رفع الذراع','Arm elevation weakness','Faiblesse d élévation du bras','ضعف في رفع الذراع فوق مستوى الكتف.','Weakness lifting the arm above shoulder level.','Faiblesse pour lever le bras au-dessus de l épaule.',['upper_limb'],false],
['local:night-pain-shoulder','ألم كتف يوقظك ليلًا','Night pain in the shoulder','Douleur nocturne de l épaule','ألم في الكتف يزداد بالاستلقاء ويوقظك من النوم.','Shoulder pain that worsens when lying down and wakes you at night.','Douleur de l épaule aggravée en position couchée, réveillant la nuit.',['upper_limb'],false],
['local:restricted-motion','محدودية في مدى حركة المفصل','Restricted joint movement','Limitation de mobilité articulaire','انخفاض مدى الحركة الطبيعية للمفصل.','Reduced range of motion of the joint.','Réduction de l amplitude articulaire.',['upper_limb','lower_limb','head_neck'],false],
['local:lateral-thigh-numbness','خدر وحرقان في الجانب الوحشي للفخذ','Lateral thigh numbness and burning','Engourdissement de la face latérale de la cuisse','خدر أو حرقان أو لسعة في الوجه الخارجي للفخذ.','Numbness, burning, or stinging on the outer thigh.','Engourdissement ou brûlure de la face externe de la cuisse.',['lower_limb'],false],
['local:groin-hip-pain','ألم في الأربية أو الورك','Groin or hip pain','Douleur de l aine ou de la hanche','ألم في الأربية أو عمق الورك، وقد يمتد للفخذ.','Pain in the groin or deep hip, sometimes radiating to the thigh.','Douleur de l aine ou profonde de la hanche, parfois irradiée.',['lower_limb','torso_front'],false],
['local:limp','عرج أو عدم القدرة على حمل الوزن','Limp or inability to bear weight','Boiterie ou impossibilité d appui','عرج أو رفض حمل الوزن على الساق.','Limping or refusal to bear weight on the leg.','Boiterie ou refus d appui sur la jambe.',['lower_limb'],true],
['local:limb-swelling-warmth','تورّم ودفء في الطرف','Limb swelling with warmth','Gonflement du membre avec chaleur','تورّم في الطرف مع دفء أو احمرار أو ألم عند اللمس.','Swelling of the limb with warmth, redness, or tenderness.','Gonflement du membre avec chaleur, rougeur ou douleur.',['upper_limb','lower_limb'],true],
['local:thyroid-neck-lump','كتلة في الرقبة تتحرك مع البلع','Neck lump moving with swallowing','Masse cervicale mobilisée à la déglutition','كتلة في مقدمة الرقبة تتحرك مع البلع، قد تصحبها بحة أو ضغط.','A lump at the front of the neck that moves with swallowing, sometimes with hoarseness or pressure.','Masse antérieure du cou mobilisée à la déglutition, parfois avec enrouement.','',['head_neck'],false],
['local:zoster-rash','طفح حويصلي مؤلم على مسار عصبي','Painful blistering rash along a nerve','Éruption vésiculeuse douloureuse','طفح حويصلي مؤلم يظهر على شريط جانبي واحد من الجسم.','A painful blistering rash on one side of the body.','Éruption vésiculeuse douloureuse unilatérale.',['head_neck','torso_front','back','upper_limb','lower_limb'],false]
];
const symDoc = read('data/medical/symptoms.json');
for (const s of NEW_SYMPTOMS) {
  const [id, ar, en, fr, dAr, dEn, dFr, regions, redFlag] = s.slice(0, 9);
  if (symDoc.symptoms.some((x) => x.id === id)) continue;
  symDoc.symptoms.push({ id, hpo: null, ontologyStatus: 'local', name: L(ar, en, fr), description: L(dAr, dEn, dFr), regions, redFlag,
    ontologyNote: L('مصطلح محلي بانتظار الربط بكود HPO/SNOMED مُتحقَّق منه؛ لم يُختَرع كود.','Local term pending verified HPO/SNOMED mapping; no code invented.','Terme local en attente de correspondance vérifiée.') });
}
fs.writeFileSync(R('data/medical/symptoms.json'), JSON.stringify(symDoc, null, 2) + '\n');

/* ---------- 2) حالات الدفعة الثانية ---------- */
const C2 = (id, icd, batch, nAr, nEn, nFr, sAr, sEn, sFr, groups, regions, subRegion, structures, symptoms, redAr, redEn, redFr, mlp, extra) => {
  checkTax(subRegion, structures, id);
  if (!TAX_BASE.has(regions[0])) throw new Error(id + ': unknown base region');
  return Object.assign({
    id, doid: null, doidStatus: 'not-mapped', icd10: icd, batch,
    name: L(nAr, nEn, nFr), summary: L(sAr, sEn, sFr),
    muscleGroups: groups, regions, taxonomy: { subRegion, structures },
    symptoms, redFlags: L(redAr, redEn, redFr),
    medlinePlusUrl: 'https://medlineplus.gov/' + mlp,
    sources: [MLP(mlp), ICD]
  }, extra || {});
};

const D = [
C2('local:cervical-radiculopathy','M54.12','D','اعتلال الجذور العنقية (عرق النسا في الذراع)','Cervical radiculopathy','Radiculopathie cervicale',
 'ألم ينتشر من الرقبة إلى الذراع واليد مع تنميل أو ضعف في مسار جذر عصبي واحد، ويزيد بمد الرقبة.',
 'Pain radiating from the neck into the arm and hand with numbness or weakness in one nerve-root pattern, worse with neck extension.',
 'Douleur de la nuque irradiant au bras avec engourdissement ou faiblesse dans un territoire radiculaire, aggravée à l extension.',
 ['neck','trapezius','deltoids','upper-back'],['head_neck','upper_limb'],'cervical_spine',['cervical-roots','cervical-discs','c3-c7'],
 ['hpo:0003401','local:arm-radiating-pain','hpo:0001324','hpo:0012531'],
 'ضعف متزايد في الذراع أو اليد، صعوبة في المشي أو فك الأزرار، أو فقدان سيطرة على البول أو البراز - راجع عاجلًا.',
 'Progressive arm or hand weakness, difficulty walking or buttoning, or loss of bladder or bowel control - seek urgent care.',
 'Faiblesse croissante du bras ou de la main, difficulté à marcher ou à boutonner, ou perte du contrôle vésical ou anal - avis urgent.',
 'neckpain.html'),
C2('local:cervical-myelopathy','M47.12','D','اعتلال النخاع العنقي (ضغط على الحبل الشوكي)','Cervical myelopathy','Myélopathie cervicale',
 'ضغط تدريجي على الحبل الشوكي من تآكل الفقرات: تراجع مهارات اليد، تعثّر في المشي، وتيبّس.',
 'Gradual spinal-cord compression from spondylosis: deteriorating hand dexterity, tripping, and stiffness.',
 'Compression médullaire progressive : perte de dextérité, trébuchements et raideur.',
 ['neck','trapezius','upper-back'],['head_neck','upper_limb','lower_limb'],'cervical_spine',['cervical-cord','cervical-discs','c3-c7'],
 ['local:hand-clumsiness','local:gait-unsteadiness','hpo:0001324','hpo:0003401'],
 'تراجع سريع في المشي أو اليدين، أو فقدان سيطرة على البول أو البراز - تقييم عاجل وقد يحتاج جراحة؛ لا تؤجّل.',
 'Rapid decline in walking or hand function, or loss of bladder or bowel control - urgent assessment, possibly surgery; do not delay.',
 'Dégradation rapide de la marche ou des mains, ou perte de contrôle sphinctérien - évaluation urgente.',
 'cervicalmyelopathy.html'),
C2('local:cervical-stenosis','M48.02','D','ضيق القناة الشوكية العنقية','Cervical spinal stenosis','Sténose canalaire cervicale',
 'ضيق في القناة الشوكية العنقية يضغط على الحبل أو الجذور مع ألم وتنميل في الرقبة والذراعين، يزداد مع المشي.',
 'Narrowing of the cervical canal compressing the cord or roots, with neck and arm pain and numbness, worse with walking.',
 'Rétrécissement du canal cervical comprimant le cordon ou les racines, avec douleur et paresthésies, aggravées à la marche.',
 ['neck','trapezius','upper-back'],['head_neck','upper_limb'],'cervical_spine',['spinal-canal','cervical-cord','cervical-roots'],
 ['hpo:0003401','local:arm-radiating-pain','local:restricted-motion','hpo:0001324'],
 'صعوبة في المشي أو التوازن، أو ضعف متزايد في اليدين - تقييم عاجل.',
 'Difficulty walking or balancing, or progressive hand weakness - urgent assessment.',
 'Difficulté à marcher ou à équilibrer, ou faiblesse croissante des mains - avis urgent.',
 'spinalstenosis.html'),
C2('local:cervical-disc-herniation','M50.10','D','انزلاق الغضروف العنقي','Cervical disc disorder with radiculopathy','Hernie discale cervicale',
 'انزلاق نواة الغضروف العنقي يضغط على الجذر العصبي فيسبب ألمًا حارقًا في الذراع مع تنميل في أصابع محددة.',
 'Herniation of a cervical disc compressing a nerve root, causing burning arm pain with numbness in specific fingers.',
 'Hernie discale cervicale comprimant une racine nerveuse : douleur du bras avec paresthésies digitales.',
 ['neck','trapezius','deltoids'],['head_neck','upper_limb'],'cervical_spine',['cervical-discs','cervical-roots','cervical-cord'],
 ['local:arm-radiating-pain','hpo:0003401','hpo:0001324'],
 'ضعف مفاجئ في الذراع أو الساقين، أو صعوبة في المشي أو التبول - طوارئ.',
 'Sudden arm or leg weakness, or difficulty walking or urinating - emergency.',
 'Faiblesse brutale brachiale ou des jambes, ou difficulté à marcher ou uriner - urgence.',
 'herniateddisk.html'),
C2('local:torticollis','M43.6','D','التواء الرقبة (الصعر)','Torticollis (wry neck)','Torticolis',
 'تشنج مؤلم في عضلات الرقبة يجعل الرأس مائلًا ومدارًا إلى جهة واحدة مع محدودية الحركة.',
 'A painful spasm of the neck muscles holding the head tilted and rotated to one side with restricted movement.',
 'Spasme douloureux des muscles du cou : tête inclinée et tournée, mobilité limitée.',
 ['neck','trapezius'],['head_neck'],'neck_soft_tissue',['scm-muscle','upper-trapezius','cervical-fascia'],
 ['hpo:0001276','local:restricted-motion','hpo:0012531'],
 'التواء الرقبة مع حرارة أو تيبّس شديد أو صداع مفاجئ - قد يشير إلى التهاب سحائي؛ راجع عاجلًا.',
 'Torticollis with fever, severe stiffness, or sudden headache - may indicate meningitis; seek urgent care.',
 'Torticolis avec fièvre, raideur marquée ou céphalée brutale - méningite possible ; avis urgent.',
 'torticollis.html'),
C2('local:cervicobrachial-syndrome','M53.1','D','متلازمة الرقبة والذراع','Cervicobrachial syndrome','Syndrome cervico-brachial',
 'ألم وتنميل يشمل الرقبة والكتف والذراع دون انزلاق غضروفي مُثبت، غالبًا مع تشنج عضلي ووضعية سيئة.',
 'Pain and numbness involving the neck, shoulder, and arm without a proven disc herniation, often with muscle spasm and poor posture.',
 'Douleur et paresthésies cervico-brachiales sans hernie prouvée, souvent avec spasme et mauvaise posture.',
 ['neck','trapezius','deltoids','upper-back'],['head_neck','upper_limb'],'neck_soft_tissue',['scalenes','upper-trapezius','deep-cervical-flexors'],
 ['local:arm-radiating-pain','hpo:0003326','local:restricted-motion','hpo:0003401'],
 'ضعف أو هزال في اليد، أو تنميل مستمر لا يتحسّن - راجع الطبيب.',
 'Hand weakness or wasting, or persistent numbness without improvement - seek medical review.',
 'Faiblesse ou fonte musculaire de la main, ou engourdissement persistant - consultez.',
 'neckpain.html'),
C2('local:cervical-whiplash','S13.4','D','إصابة الرقبة بالجلد (الويربلاش)','Whiplash injury of the cervical spine','Coup du lapin',
 'شد في أربطة الرقبة ومفاصلها بعد تسارع أو تباطؤ مفاجئ، مع ألم وتيبّس يزيد بالحركة.',
 'Sprain of the cervical ligaments and joints after sudden acceleration or deceleration, with pain and stiffness worse with movement.',
 'Entorse des ligaments cervicaux après accélération ou décélération brutale, douleur et raideur au mouvement.',
 ['neck','trapezius','upper-back'],['head_neck','back'],'cervical_spine',['cervical-facet-joints','cervical-discs','cervical-roots'],
 ['hpo:0001276','hpo:0002315','local:restricted-motion','hpo:0003401'],
 'تنميل أو ضعف في الذراعين، صعوبة في المشي، أو ألم يزداد بشدة بعد الحادث - راجع عاجلًا.',
 'Arm numbness or weakness, difficulty walking, or sharply worsening pain after the accident - urgent review.',
 'Engourdissement ou faiblesse des bras, difficulté à marcher, ou douleur croissante - avis urgent.',
 'whiplash.html'),
C2('local:tension-headache','G44.2','D','الصداع التوتري','Tension-type headache','Céphalée de tension',
 'صداع ضاغط على شكل شريط حول الرأس مع شد في عضلات الرقبة والكتف، غالبًا في نهاية اليوم.',
 'A band-like pressing headache with neck and shoulder muscle tightness, usually at the end of the day.',
 'Céphalée compressive en casque avec tension cervicale, souvent en fin de journée.',
 ['neck','trapezius','head'],['head_neck'],'neck_soft_tissue',['upper-trapezius','scm-muscle','deep-cervical-flexors'],
 ['hpo:0002315','hpo:0001276','hpo:0002360'],
 'صداع مفاجئ شديد كالرعد، أو مع تيبّس رقبة أو حرارة أو ضعف مفاجئ - طوارئ فورية.',
 'Sudden thunderclap headache, or headache with neck stiffness, fever, or sudden weakness - emergency.',
 'Céphalée brutale en coup de tonnerre, ou avec raideur de nuque, fièvre ou faiblesse - urgence.',
 'tensionheadache.html'),
C2('local:cervical-zoster','B02.9','D','الهربس النطاقي العنقي (الحزام الناري)','Cervical herpes zoster','Zona cervical',
 'طفح حويصلي مؤلم على شريط جانبي في الرقبة أو الكتف ناتج عن إعادة تنشيط فيروس جدري الماء.',
 'A painful blistering rash in a band on one side of the neck or shoulder from reactivation of the chickenpox virus.',
 'Éruption vésiculeuse douloureuse en bande unilatérale du cou ou de l épaule.',
 ['neck','trapezius'],['head_neck','upper_limb'],'neck_soft_tissue',['cervical-fascia','cervical-lymph-nodes','brachial-plexus'],
 ['local:zoster-rash','hpo:0000988','hpo:0003401','hpo:0012531'],
 'إصابة حول العين أو الأنف، أو ضعف في الذراع، أو ألم يستمر بعد زوال الطفح - راجع عاجلًا.',
 'Involvement around the eye or nose, arm weakness, or pain persisting after the rash clears - urgent review.',
 'Atteinte péri-oculaire ou nasale, faiblesse du bras, ou douleur persistant après l éruption - avis urgent.',
 'shingles.html'),
C2('local:thyroid-goiter','E04.9','D','تضخّم الغدة الدرقية (السلعة)','Nontoxic goiter','Goitre non toxique',
 'تضخّم في الغدة الدرقية أمام الرقبة، غالبًا غير مؤلم، وقد يسبب إحساسًا بالضغط أو صعوبة في البلع.',
 'Enlargement of the thyroid gland at the front of the neck, usually painless, sometimes causing pressure or difficulty swallowing.',
 'Augmentation de la thyroïde en avant du cou, souvent indolore, parfois compressive.',
 ['neck','head'],['head_neck'],'neck_soft_tissue',['thyroid-gland','parathyroid-glands','cervical-lymph-nodes','cervical-esophagus'],
 ['local:thyroid-neck-lump','local:swallowing-difficulty','local:hoarseness'],
 'نمو سريع في الكتلة، بحة مستمرة، صعوبة في التنفس أو البلع، أو نقص وزن - راجع عاجلًا.',
 'Rapid growth of the lump, persistent hoarseness, difficulty breathing or swallowing, or weight loss - urgent review.',
 'Croissance rapide, enrouement persistant, dyspnée ou dysphagie, ou perte de poids - avis urgent.',
 'goiter.html')
];

const E = [
C2('local:rotator-cuff-syndrome','M75.1','E','إصابة الكفة المدورة','Rotator cuff syndrome','Syndrome de la coiffe des rotateurs',
 'ألم في الكتف يزيد برفع الذراع وبالاستلقاء على الجانب المصاب، مع ضعف في الحركة.',
 'Shoulder pain worse with raising the arm and lying on the affected side, with weakness in movement.',
 'Douleur de l épaule aggravée à l élévation et en décubitus latéral, avec faiblesse.',
 ['deltoids','trapezius','chest','upper-back'],['upper_limb'],'shoulder',['rotator-cuff','subacromial-bursa','glenohumeral-joint'],
 ['local:shoulder-weakness','local:night-pain-shoulder','local:restricted-motion','hpo:0012531'],
 'عدم القدرة على رفع الذراع بعد إصابة حادة، أو تنميل مستمر، أو ألم يمنع النوم - راجع الطبيب.',
 'Inability to lift the arm after acute injury, persistent numbness, or pain preventing sleep - seek medical review.',
 'Incapacité à lever le bras après un traumatisme, engourdissement persistant, ou douleur empêchant le sommeil - consultez.',
 'rotatorcuffinjuries.html'),
C2('local:shoulder-impingement','M75.4','E','انحشار الكتف (متلازمة الانحشار)','Shoulder impingement syndrome','Conflit sous-acromial',
 'ألم في مقدمة الكتف والجانب يظهر عند رفع الذراع بين 60 و120 درجة، أو عند الوصول للخلف.',
 'Pain at the front and side of the shoulder appearing when raising the arm between 60 and 120 degrees, or reaching behind.',
 'Douleur antéro-latérale de l épaule à l élévation entre 60 et 120 degrés, ou en rotation interne.',
 ['deltoids','trapezius','chest'],['upper_limb'],'shoulder',['subacromial-bursa','rotator-cuff','ac-joint'],
 ['local:shoulder-weakness','local:restricted-motion','local:night-pain-shoulder'],
 'ضعف مفاجئ أو عدم قدرة على رفع الذراع، أو تورّم بعد إصابة - راجع عاجلًا.',
 'Sudden weakness or inability to raise the arm, or swelling after injury - urgent review.',
 'Faiblesse brutale ou impossibilité d élévation, ou gonflement post-traumatique - avis urgent.',
 'shoulderimpingement.html'),
C2('local:bicipital-tendinitis','M75.2','E','التهاب وتر العضلة ذات الرأسين','Bicipital tendinitis','Tendinite du biceps',
 'ألم في مقدمة الكتف وعلى طول الوتر الطويل للعضلة ذات الرأسين، يزيد بحمل الأثقال أو رفع الذراع للأمام.',
 'Pain at the front of the shoulder and along the long head of the biceps tendon, worse with lifting or forward arm elevation.',
 'Douleur antérieure de l épaule le long du tendon du biceps, aggravée à l effort.',
 ['deltoids','biceps','chest'],['upper_limb'],'shoulder',['biceps-long-head','glenohumeral-joint','rotator-cuff'],
 ['hpo:0012531','local:shoulder-weakness','hpo:0003326'],
 'تمزّق مفاجئ مع صوت طقطقة وانتفاخ عضلي غير طبيعي (تشوّه العضلة) - راجع عاجلًا.',
 'Sudden tear with a pop and an abnormal muscle bulge (deformity) - urgent review.',
 'Rupture brutale avec claquement et déformation musculaire - avis urgent.',
 'bicipitaltendinitis.html'),
C2('local:subacromial-bursitis','M75.5','E','التهاب الجراب تحت الأخرم','Subacromial bursitis','Bursite sous-acromiale',
 'ألم حاد في الكتف يزيد بحركات القوس المتوسط وبالضغط المباشر، مع محدودية في الرفع.',
 'Sharp shoulder pain worse with mid-arc movements and direct pressure, with limited elevation.',
 'Douleur aiguë de l épaule au mouvement d arc moyen et à la pression, élévation limitée.',
 ['deltoids','trapezius'],['upper_limb'],'shoulder',['subacromial-bursa','rotator-cuff','ac-joint'],
 ['local:night-pain-shoulder','hpo:0001386','local:restricted-motion','hpo:0012531'],
 'احمرار وحرارة شديدة مع حرارة عامة - التهاب جرابي جرثومي يستدعي مراجعة عاجلة.',
 'Marked redness and heat with fever - septic bursitis requiring urgent review.',
 'Rougeur et chaleur marquées avec fièvre - bursite septique, avis urgent.',
 'bursitis.html'),
C2('local:adhesive-capsulitis','M75.0','E','الكتف المتجمّد (التصاق المحفظة)','Adhesive capsulitis (frozen shoulder)','Capsulite rétractile',
 'تصلّب تدريجي في الكتف مع فقدان الحركة في كل الاتجاهات، ويظهر أكثر لدى مرضى السكري.',
 'Gradual shoulder stiffening with loss of movement in all directions, more common in people with diabetes.',
 'Enraidissement progressif de l épaule dans tous les secteurs, plus fréquent chez les diabétiques.',
 ['deltoids','trapezius','chest'],['upper_limb'],'shoulder',['glenohumeral-joint','glenoid-labrum','rotator-cuff'],
 ['local:restricted-motion','local:night-pain-shoulder','hpo:0012531'],
 'فقدان حركة كامل بشكل مفاجئ بعد إصابة، أو حرارة وتورّم - راجع الطبيب.',
 'Sudden complete loss of movement after injury, or fever and swelling - seek medical review.',
 'Perte complète et brutale de mobilité après traumatisme, ou fièvre et gonflement - consultez.',
 'frozenshoulder.html'),
C2('local:shoulder-osteoarthritis','M19.01','E','الفصال العظمي في الكتف','Primary osteoarthritis of the shoulder','Arthrose gléno-humérale',
 'ألم وتصلّب تدريجي في الكتف يزداد بالحركة مع طقطقة وتراجع مدى الحركة على مدى سنوات.',
 'Gradual shoulder pain and stiffness increasing with use, with crepitus and progressive loss of range over years.',
 'Douleur et raideur gléno-humérales progressives avec craquements et perte d amplitude.',
 ['deltoids','triceps','trapezius'],['upper_limb'],'shoulder',['glenohumeral-joint','humerus-head','glenoid-labrum'],
 ['hpo:0002829','local:restricted-motion','hpo:0012532'],
 'ألم ليلي شديد مستمر أو فقدان مفاجئ للحركة - راجع الطبيب.',
 'Severe persistent night pain or sudden loss of movement - seek medical review.',
 'Douleur nocturne sévère ou perte brutale de mobilité - consultez.',
 'shoulderosteoarthritis.html'),
C2('local:clavicle-fracture','S42.0','E','كسر الترقوة','Fracture of the clavicle','Fracture de la clavicule',
 'ألم وتورّم وتشوّه في منتصف الترقوة بعد السقوط على الكتف أو على اليد الممدودة.',
 'Pain, swelling, and deformity over the middle of the clavicle after a fall onto the shoulder or outstretched hand.',
 'Douleur, œdème et déformation de la clavicule après chute sur l épaule ou sur la main.',
 ['deltoids','chest','trapezius'],['upper_limb'],'shoulder',['clavicle','sc-joint','ac-joint'],
 ['hpo:0002653','hpo:0001386','hpo:0012531','local:restricted-motion'],
 'خدر أو ضعف أو شحوب في الذراع (قد يكون إصابة وعائية أو عصبية)، أو بروز جلد تحت الكسر - طوارئ.',
 'Numbness, weakness, or pallor of the arm (possible vascular or nerve injury), or skin tenting - emergency.',
 'Engourdissement, faiblesse ou pâleur du bras (atteinte vasculo-nerveuse), ou peau tendue - urgence.',
 'claviclefracture.html'),
C2('local:ac-joint-dislocation','S43.1','E','انخلاع المفصل الأخرمي الترقوي','Subluxation and dislocation of the acromioclavicular joint','Luxation acromio-claviculaire',
 'ألم مباشر أعلى الكتف مع بروز عظمي واضح بعد السقوط على الكتف، ويزيد بتحريك الذراع عبر الجسم.',
 'Direct pain on top of the shoulder with a visible bony step after a fall onto the shoulder, worse moving the arm across the body.',
 'Douleur au sommet de l épaule avec saillie osseuse après une chute, aggravée par l adduction.',
 ['deltoids','trapezius','chest'],['upper_limb'],'shoulder',['ac-joint','clavicle','scapula'],
 ['hpo:0001386','hpo:0012531','local:restricted-motion'],
 'بروز عظمي واضح مع ألم شديد أو خدر في الذراع - راجع عاجلًا.',
 'Marked bony deformity with severe pain or arm numbness - urgent review.',
 'Déformation osseuse marquée avec douleur sévère ou engourdissement - avis urgent.',
 'shoulderdislocation.html'),
C2('local:brachial-plexus-injury','G54.0','E','إصابة الضفيرة العضدية','Brachial plexus disorders','Atteinte du plexus brachial',
 'ضعف وتنميل في الذراع واليد بعد شدّ عنيف للكتف أو إصابة، بحسب جذور الضفيرة المصابة.',
 'Weakness and numbness of the arm and hand after forceful traction on the shoulder or trauma, depending on the affected roots.',
 'Faiblesse et paresthésies du bras après traction violente de l épaule ou traumatisme.',
 ['deltoids','triceps','biceps','forearm'],['upper_limb'],'shoulder',['brachial-plexus','axillary-nerve','axillary-artery'],
 ['hpo:0001324','hpo:0003401','local:hand-clumsiness'],
 'ضعف مفاجئ أو شلل بعد إصابة، أو ضعف في التنفس مع إصابة الرقبة - طوارئ.',
 'Sudden weakness or paralysis after injury, or breathing difficulty with a neck injury - emergency.',
 'Faiblesse brutale ou paralysie après traumatisme, ou dyspnée - urgence.',
 'brachialplexusinjuries.html'),
C2('local:polymyalgia-rheumatica','M35.3','E','الروماتيزم العضلي الالتهابي','Polymyalgia rheumatica','Pseudo-polyarthrite rhizomélique',
 'ألم وتيبّس صباحي في الكتفين والوركين لدى من تجاوز الخمسين، مع تعب عام وارتفاع مؤشرات الالتهاب.',
 'Morning pain and stiffness of the shoulders and hips in people over 50, with fatigue and raised inflammatory markers.',
 'Douleur et raideur matinales des épaules et des hanches après 50 ans, avec fatigue et inflammation biologique.',
 ['deltoids','gluteal','trapezius','quadriceps'],['upper_limb','lower_limb','back'],'shoulder',['glenohumeral-joint','rotator-cuff','hip-joint'],
 ['hpo:0003326','hpo:0002829','local:restricted-motion','hpo:0012532'],
 'صداع جديد مع ألم في الفك أو تشوّش رؤية أو ألم عند مضغ الطعام - احتمال التهاب الشريان الصدغي، طوارئ (خطر فقدان البصر).',
 'New headache with jaw pain, visual disturbance, or pain when chewing - possible giant cell arteritis, an emergency (risk of vision loss).',
 'Céphalée nouvelle avec douleur mandibulaire, trouble visuel ou claudication masticatoire - artérite à cellules géantes, urgence.',
 'polymyalgiarheumatica.html', { diffuse: true })
];

const F = [
C2('local:greater-trochanteric-pain','M70.6','F','ألم المدور الكبير (التهاب الجراب المدوري)','Trochanteric bursitis','Bursite trochantérienne',
 'ألم على الجانب الخارجي للورك يزيد بالاستلقاء على الجانب وبصعود الدرج والمشي الطويل.',
 'Pain on the outer side of the hip, worse lying on that side, climbing stairs, and walking long distances.',
 'Douleur latérale de la hanche, aggravée en décubitus latéral et dans les escaliers.',
 ['gluteal','quadriceps','lower-back'],['lower_limb'],'hip',['greater-trochanter','hip-bursae','gluteus-medius'],
 ['hpo:0012531','hpo:0002829','hpo:0001288'],
 'ألم مع حرارة واحمرار، أو عجز عن حمل الوزن، أو ألم ليلي مستمر - راجع الطبيب.',
 'Pain with fever and redness, inability to bear weight, or persistent night pain - seek medical review.',
 'Douleur avec fièvre et rougeur, impossibilité d appui, ou douleur nocturne - consultez.',
 'bursitis.html'),
C2('local:gluteal-tendinopathy','M76.0','F','اعتلال أوتار الألوية','Gluteal tendinopathy','Tendinopathie fessière',
 'ألم على الجانب الخارجي للورك مع ضعف في تثبيت الحوض عند الوقوف على قدم واحدة.',
 'Pain on the outer hip with weak pelvic stabilisation when standing on one leg.',
 'Douleur latérale de hanche avec faiblesse de stabilisation pelvienne en appui unipodal.',
 ['gluteal','quadriceps','adductors'],['lower_limb'],'hip',['gluteus-medius','greater-trochanter','hip-bursae'],
 ['hpo:0012531','hpo:0001324','hpo:0002829'],
 'ألم مع حرارة واحمرار، أو عجز كامل عن حمل الوزن - راجع الطبيب.',
 'Pain with fever and redness, or complete inability to bear weight - seek medical review.',
 'Douleur avec fièvre et rougeur, ou impossibilité totale d appui - consultez.',
 'hipinjuriesanddisorders.html'),
C2('local:hip-osteoarthritis','M16.9','F','الفصال العظمي في الورك','Osteoarthritis of the hip','Coxarthrose',
 'ألم في الأربية وطرف الفخذ يزيد بالمشي ويصحبه تصلّب صباحي قصير ومحدودية في الدوران الداخلي.',
 'Groin and thigh pain worse with walking, with brief morning stiffness and limited internal rotation.',
 'Douleur de l aine et de la cuisse à la marche, avec raideur matinale brève et rotation interne limitée.',
 ['gluteal','quadriceps','hamstring','adductors'],['lower_limb'],'hip',['hip-joint','acetabulum','femoral-head','hip-labrum'],
 ['local:groin-hip-pain','hpo:0002829','local:restricted-motion','hpo:0001288'],
 'ألم ليلي شديد أو عجز كامل عن حمل الوزن أو فقدان مفاجئ للحركة - راجع الطبيب.',
 'Severe night pain, complete inability to bear weight, or sudden loss of movement - seek medical review.',
 'Douleur nocturne sévère, impossibilité d appui, ou perte brutale de mobilité - consultez.',
 'hiposteoarthritis.html'),
C2('local:sciatica','M54.3','F','عرق النسا (ألم العصب الوركي)','Sciatica','Sciatique',
 'ألم ينتشر من أسفل الظهر عبر الألية والفخذ إلى الساق والقدم بحسب الجذر المصاب، غالبًا مع تنميل.',
 'Pain radiating from the low back through the buttock and thigh into the leg and foot along an affected root, often with numbness.',
 'Douleur lombo-fessière irradiant à la jambe selon le territoire radiculaire, avec paresthésies.',
 ['gluteal','hamstring','lower-back','calves'],['lower_limb','back'],'hip',['sciatic-nerve','sciatic-nerve-thigh','lumbar-roots'],
 ['local:arm-radiating-pain','hpo:0003401','hpo:0003418','hpo:0001324'],
 'فقدان سيطرة على البول أو البراز، خدر منطقة السرج، أو ضعف متزايد في الساق - طوارئ فورية.',
 'Loss of bladder or bowel control, saddle numbness, or progressive leg weakness - emergency.',
 'Perte du contrôle sphinctérien, anesthésie en selle, ou faiblesse croissante - urgence.',
 'sciatica.html'),
C2('local:avascular-necrosis-hip','M87.0','F','تَنخّر رأس الفخذ (الموت العظمي الإسفنجي)','Avascular necrosis of the femoral head','Nécrose aseptique de la tête fémorale',
 'ألم تدريجي في الأربية وعمق الورك يزداد بحمل الوزن، ويظهر بلا إصابة واضحة أو بعد علاج بالكورتيزون.',
 'Gradual groin and deep hip pain worsening with weight-bearing, appearing without clear injury or after steroid therapy.',
 'Douleur progressive de l aine et de la hanche à l appui, sans traumatisme évident ou après corticoïdes.',
 ['gluteal','quadriceps','adductors'],['lower_limb'],'hip',['femoral-head','femoral-neck','hip-joint'],
 ['local:groin-hip-pain','hpo:0002653','hpo:0012531','local:limp'],
 'ألم متزايد مع عجز عن حمل الوزن أو تدهور سريع في المشي - تقييم عاجل بالتصوير؛ التأخير يزيد خطر الانهيار.',
 'Increasing pain with inability to bear weight or rapid decline in walking - urgent imaging; delay increases collapse risk.',
 'Douleur croissante avec impossibilité d appui ou dégradation rapide - imagerie urgente.',
 'avascularnecrosis.html'),
C2('local:femoral-neck-fracture','S72.0','F','كسر عنق الفخذ','Fracture of the neck of the femur','Fracture du col fémoral',
 'ألم في الأربية بعد السقوط، مع قِصر الساق ودورانها للخارج وعدم القدرة على حمل الوزن.',
 'Groin pain after a fall with a shortened, externally rotated leg and inability to bear weight.',
 'Douleur de l aine après chute, jambe raccourcie et en rotation externe, impossibilité d appui.',
 ['gluteal','quadriceps','hamstring','adductors'],['lower_limb'],'hip',['femoral-neck','femoral-head','acetabulum','hip-joint'],
 ['local:limp','local:groin-hip-pain','hpo:0002653','local:restricted-motion'],
 'عدم القدرة على حمل الوزن بعد السقوط مع قِصر الساق أو دورانها للخارج - طوارئ؛ لا تحاول تحريك المصاب فورًا.',
 'Inability to bear weight after a fall with a shortened or externally rotated leg - emergency; do not force movement.',
 'Impossibilité d appui après chute avec jambe raccourcie ou en rotation externe - urgence.',
 'hipfracture.html'),
C2('local:it-band-syndrome','M76.3','F','متلازمة الشريط الظنبوبي','Iliotibial band syndrome','Syndrome de la bandelette ilio-tibiale',
 'ألم حارق على الجانب الخارجي للفخذ وينزل إلى ما فوق الركبة، يزيد بالجري أو ركوب الدراجة.',
 'Burning pain on the outer thigh extending to just above the knee, worse with running or cycling.',
 'Douleur brûlante latérale de la cuisse jusqu en sus-condylien, aggravée à la course ou au vélo.',
 ['quadriceps','gluteal','hamstring'],['lower_limb'],'thigh',['it-band','tfl','distal-femur'],
 ['hpo:0012531','hpo:0002829','hpo:0001288'],
 'تورّم مع احمرار وحرارة أو عجز عن حمل الوزن - راجع الطبيب.',
 'Swelling with redness and heat, or inability to bear weight - seek medical review.',
 'Gonflement avec rougeur et chaleur, ou impossibilité d appui - consultez.',
 'iliotibialbandsyndrome.html'),
C2('local:thigh-contusion','S70.1','F','رضّ (كدمة) الفخذ','Contusion of the thigh','Contusion de la cuisse',
 'ألم موضعي وتورّم وتغيّر لون الجلد في الفخذ بعد ارتطام مباشر، يزيد بالحركة والضغط.',
 'Localized thigh pain, swelling, and bruising after a direct blow, worse with movement and pressure.',
 'Douleur localisée, œdème et ecchymose de la cuisse après un choc direct.',
 ['quadriceps','hamstring'],['lower_limb'],'thigh',['quadriceps','femur-shaft','it-band'],
 ['hpo:0012531','hpo:0001386','hpo:0000988'],
 'تورّم متزايد مع ألم شديد متصلّب في الفخذ (قد يعني متلازمة الحيز) أو عجز عن تحريك القدم - طوارئ.',
 'Rapidly increasing swelling with severe taut thigh pain (possible compartment syndrome) or inability to move the foot - emergency.',
 'Œdème croissant avec douleur tendue (syndrome de loge possible) ou impossibilité de bouger le pied - urgence.',
 'thighinjuries.html'),
C2('local:hip-labral-tear','M24.15','F','تمزّق شفة الحق (تمزّق غضروف الورك)','Acetabular labral tear of the hip','Déchirure du labrum acétabulaire',
 'ألم معمّق في الأربية مع طقطقة أو احتكاك أو إحساس بعدم ثبات الورك عند اللف.',
 'Deep groin pain with clicking, catching, or a feeling of instability of the hip when twisting.',
 'Douleur profonde de l aine avec ressaut ou instabilité à la rotation.',
 ['gluteal','quadriceps','adductors'],['lower_limb'],'hip',['hip-labrum','acetabulum','femoral-head','hip-joint'],
 ['local:groin-hip-pain','hpo:0012531','local:restricted-motion'],
 'قفل أو عدم ثبات شديد، أو ألم يمنع حمل الوزن - راجع الطبيب.',
 'Locking or marked instability, or pain preventing weight-bearing - seek medical review.',
 'Blocage ou instabilité marquée, ou douleur empêchant l appui - consultez.',
 'hiplabraltear.html'),
C2('local:recurrent-hip-dislocation','M24.45','F','الانخلاع المتكرر لمفصل الورك','Recurrent dislocation of the hip joint','Luxation récidivante de la hanche',
 'خروج متكرر لرأس الفخذ من الحق مع ألم حاد وفقدان مؤقت للحركة، غالبًا بعد خلع سابق أو إصابة.',
 'Repeated displacement of the femoral head from the socket with acute pain and temporary loss of movement, usually after a prior dislocation or injury.',
 'Luxation répétée de la tête fémorale avec douleur aiguë et perte temporaire de mobilité.',
 ['gluteal','quadriceps','hamstring'],['lower_limb'],'hip',['hip-joint','femoral-head','acetabulum','hip-labrum'],
 ['local:restricted-motion','hpo:0012531','local:limp'],
 'خلع مؤكد مع تشوّه واضح أو عدم قدرة على تحريك الورك، أو خدر في القدم - طوارئ (قد يتضرر العصب الوركي).',
 'Confirmed dislocation with visible deformity or inability to move the hip, or foot numbness - emergency (risk of sciatic nerve injury).',
 'Luxation confirmée avec déformation ou impossibilité de mobiliser, ou engourdissement du pied - urgence.',
 'hipdislocation.html', { icd10Note: 'M24.45 هو التصنيف الأبوي للانخلاع المتكرر في الورك؛ الكود الفرعي المُتحقَّق منه هو M24.451 (الورك الأيمن).' }),
C2('local:meralgia-paresthetica','G57.1','F','التنميل الجلدي الفخذي (ألم ميرالجيا)','Meralgia paresthetica','Méralgie paresthésique',
 'خدر وحرقان ولسعة في الجانب الخارجي للفخذ بسبب انضغاط العصب الجلدي الوحشي عند الرباط الأربي.',
 'Numbness, burning, and stinging on the outer thigh from compression of the lateral cutaneous nerve at the inguinal ligament.',
 'Engourdissement et brûlure de la face externe de la cuisse par compression du nerf cutané latéral.',
 ['quadriceps','gluteal','adductors'],['lower_limb'],'thigh',['lateral-cutaneous-thigh-nerve','tfl','femoral-triangle'],
 ['local:lateral-thigh-numbness','hpo:0003401','hpo:0012531'],
 'ضعف في الساق، أو ضعف في الجهة الأخرى، أو ألم لا يتحسّن - راجع الطبيب.',
 'Leg weakness, involvement of the other side, or pain that does not improve - seek medical review.',
 'Faiblesse de la jambe, atteinte controlatérale, ou douleur persistante - consultez.',
 'meralgiaparesthetica.html'),
C2('local:deep-vein-thrombosis','I80.2','F','الجلطة الوريدية العميقة في الفخذ','Deep vein thrombosis of the lower extremity','Thrombose veineuse profonde',
 'تورّم في ساق واحدة أو الفخذ مع ألم ودفء واحمرار، يزيد بالوقوف ويخفّ بالرفع.',
 'One-sided leg or thigh swelling with pain, warmth, and redness, worse on standing and better when elevated.',
 'Gonflement unilatéral de la jambe ou de la cuisse avec douleur, chaleur et rougeur.',
 ['quadriceps','hamstring','calves'],['lower_limb'],'thigh',['femoral-triangle','adductor-canal','profunda-femoris-artery'],
 ['local:limb-swelling-warmth','hpo:0012531','hpo:0001386'],
 'ضيق نفس أو ألم صدر أو سعال دموي مع تورّم الساق - جلطة انتقلت للرئة، طوارئ فورية.',
 'Breathlessness, chest pain, or blood-streaked cough with leg swelling - clot in the lung, emergency.',
 'Dyspnée, douleur thoracique ou hémoptysie avec œdème - embolie pulmonaire, urgence.',
 'deepveinthrombosis.html'),
C2('local:thigh-cellulitis','L03.90','F','التهاب النسيج الخلوي في الفخذ','Cellulitis of the thigh','Cellulite infectieuse de la cuisse',
 'منطقة حمراء ساخنة ومتورّمة ومؤلمة في الفخذ تتوسّع تدريجيًا مع حرارة وإرهاق.',
 'A red, hot, swollen, painful area on the thigh that spreads gradually with fever and malaise.',
 'Zone rouge, chaude, œdémateuse et douloureuse de la cuisse s étendant avec fièvre.',
 ['quadriceps','hamstring','gluteal'],['lower_limb'],'thigh',['quadriceps','femur-shaft'],
 ['hpo:0000988','local:limb-swelling-warmth','hpo:0001945','hpo:0012531'],
 'خطوط حمراء تمتد في الطرف، حرارة عالية، أو ألم شديد مع اسمرار الجلد - مراجعة عاجلة (عدوى نسيجية منتشرة).',
 'Red streaks spreading along the limb, high fever, or severe pain with duskiness - urgent review (spreading soft-tissue infection).',
 'Traînées rouges, fièvre élevée, ou douleur sévère avec aspect livide - avis urgent.',
 'cellulitis.html')
];

const reg = read('data/medical/regionalConditions.json');
const have = new Set(reg.conditions.map((c) => c.id));
const add = [...D, ...E, ...F].filter((c) => !have.has(c.id));
add.forEach((c) => { if (have.has(c.id)) throw new Error('duplicate ' + c.id); have.add(c.id); });
reg.conditions = reg.conditions.concat(add);
reg.generatedAt = '2026-09-26';
reg.batch = 'regional-expansion-1+2';
reg.notice = Object.fromEntries(Object.entries(reg.notice).map(([k, v]) => [k, v + (k === 'ar' ? ' الدفعة الثانية: الرقبة (D) والكتف (E) والفخذ والورك (F)، وكل حالة مربوطة ببنى تشريحية محددة من regionTaxonomy.json.' : k === 'en' ? ' Batch 2: neck, shoulder, and thigh or hip; every record is linked to specific anatomical structures from regionTaxonomy.json.' : ' Lot 2 : cou, épaule et cuisse ou hanche ; chaque fiche est liée à des structures anatomiques précises.')]));
fs.writeFileSync(R('data/medical/regionalConditions.json'), JSON.stringify(reg, null, 2) + '\n');

/* ---------- 3) أسئلة فرز إضافية ---------- */
const tri = read('data/medical/triageQuestions.json');
const Q = (id, ar, en, fr, redFlag, aAr, aEn, aFr) => ({ id, text: L(ar, en, fr), redFlag, ...(redFlag ? { alert: L(aAr, aEn, aFr) } : {}) });
const has = (id) => Object.values(tri.regions).flat().some((q) => q.id === id);
const ADDQ = {
  head_neck: [
    Q('hn-7','هل يصحب الألم تنميل أو ضعف ينتشر إلى الذراع أو اليد؟','Is the pain accompanied by numbness or weakness spreading into the arm or hand?','La douleur s accompagne-t-elle d engourdissement ou de faiblesse du bras ?',false,null,null,null),
    Q('hn-8','هل تجد صعوبة مفاجئة في فك الأزرار أو الكتابة أو المشي المتوازن؟','Do you find sudden difficulty buttoning, writing, or walking steadily?','Difficulté brutale à boutonner, écrire ou marcher de façon stable ?',true,'تراجع المهارات الدقيقة مع عدم ثبات المشي قد يعني ضغطًا على الحبل الشوكي العنقي؛ تقييم عاجل.','Declining hand dexterity with unsteady walking may indicate cervical cord compression; urgent assessment.','Perte de dextérité avec démarche instable : compression médullaire possible ; évaluation urgente.'),
    Q('hn-9','هل يوجد تورّم في الرقبة يتحرك مع البلع أو بحة مستمرة أكثر من ثلاثة أسابيع؟','Is there a neck lump moving with swallowing, or hoarseness lasting over three weeks?','Masse cervicale mobile à la déglutition, ou enrouement de plus de trois semaines ?',false,null,null,null)
  ],
  upper_limb: [
    Q('ul-7','هل تعجز عن رفع الذراع بعد إصابة حادة؟','Are you unable to raise the arm after an acute injury?','Impossibilité de lever le bras après un traumatisme récent ?',true,'العجز عن رفع الذراع بعد إصابة قد يعني تمزّقًا كاملًا في الكفة المدورة أو خلعًا؛ تقييم عاجل بالتصوير.','Inability to raise the arm after injury may mean a full rotator cuff tear or dislocation; urgent imaging.','Impossibilité d élévation après traumatisme : rupture de coiffe ou luxation ; imagerie urgente.'),
    Q('ul-8','هل يوقظك ألم الكتف ليلًا ويزداد بالاستلقاء على الجانب؟','Does shoulder pain wake you at night and worsen lying on that side?','La douleur réveille-t-elle la nuit et s aggrave-t-elle en décubitus latéral ?',false,null,null,null),
    Q('ul-9','هل يحدث انحشار أو قفل ملحوظ عند رفع الذراع بين 60 و120 درجة؟','Is there a noticeable catch or locking when raising the arm between 60 and 120 degrees?','Ressaut ou blocage à l élévation entre 60 et 120 degrés ?',false,null,null,null)
  ],
  lower_limb: [
    Q('ll-7','هل حدث السقوط مع قِصر الساق أو دورانها للخارج وعدم القدرة على حمل الوزن؟','Was there a fall with a shortened or externally rotated leg and inability to bear weight?','Chute avec jambe raccourcie ou en rotation externe et impossibilité d appui ?',true,'قد يكون كسرًا في عنق الفخذ؛ لا تحاول تحريك المصاب واطلب الطوارئ فورًا.','Possible femoral neck fracture; do not move the person and call emergency services now.','Fracture du col fémoral possible ; ne mobilisez pas et appelez les secours.'),
    Q('ll-8','هل ينزل الألم من أسفل الظهر والألية إلى الفخذ والساق؟','Does the pain travel from the low back and buttock down the thigh and leg?','La douleur descend-elle de la région lombaire et fessière à la cuisse et à la jambe ?',false,null,null,null),
    Q('ll-9','هل يوجد خدر في الوجه الخارجي للفخذ فقط دون ضعف في الساق؟','Is there numbness limited to the outer thigh without leg weakness?','Engourdissement limité à la face externe de la cuisse sans faiblesse ?',false,null,null,null)
  ]
};
for (const [region, qs] of Object.entries(ADDQ)) for (const q of qs) if (!has(q.id)) tri.regions[region].push(q);
tri.generatedAt = '2026-09-26';
fs.writeFileSync(R('data/medical/triageQuestions.json'), JSON.stringify(tri, null, 2) + '\n');

const cnt = (b) => reg.conditions.filter((c) => c.batch === b).length;
console.log('conditions total: ' + reg.conditions.length + ' | A=' + cnt('A') + ' B=' + cnt('B') + ' C=' + cnt('C') + ' D=' + cnt('D') + ' E=' + cnt('E') + ' F=' + cnt('F'));
console.log('symptoms total: ' + symDoc.symptoms.length + ' (local ' + symDoc.symptoms.filter(s => s.ontologyStatus === 'local').length + ')');
console.log('triage questions: ' + Object.values(tri.regions).flat().length + ' | redFlag ' + Object.values(tri.regions).flat().filter(q => q.redFlag).length);
