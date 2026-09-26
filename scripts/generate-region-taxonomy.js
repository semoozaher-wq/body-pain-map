#!/usr/bin/env node
// scripts/generate-region-taxonomy.js
// يبني تصنيفًا تشريحيًا هرميًا: المنطقة الأساسية → المنطقة الفرعية → البنية المحددة،
// مع نطاق الحجم (band) لكل بنية ونطاق ICD-10 الفصلي المرجعي لكل منطقة فرعية.
// الحد الأدنى للبنية = نطاق ملّيمتري (<1 سم) لأن التعداد الحرفي لكل ملّيمتر غير ممكن علميًا ولا مفيد.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const OUT = path.join(root, 'data/medical/regionTaxonomy.json');
if (fs.existsSync(OUT)) { console.error('regionTaxonomy.json already exists - refusing to regenerate.'); process.exit(1); }

// [id, type, ar, en, sizeBand]
const T = [
['head_neck','الرأس والرقبة','Head and neck',[
  ['cranium_facial','الجمجمة والوجه','Cranium and face','K00-K14 (الفم والفكين) · H60-H95 (الأذن) · J32 (الجيوب)',[
    ['skull-cranium','bone','الجمجمة','Skull cranium','cm-15-plus'],
    ['facial-bones','bone','عظام الوجه','Facial bones','cm-5-15'],
    ['mandible','bone','الفك السفلي','Mandible','cm-5-15'],
    ['tmj','joint','مفصل الفك الصدغي','Temporomandibular joint','mm'],
    ['teeth','organ','الأسنان','Teeth','mm'],
    ['parotid-gland','gland','الغدة النكفية','Parotid gland','cm-1-5'],
    ['maxillary-sinus','space','الجيب الفكي','Maxillary sinus','cm-1-5'],
    ['frontal-sinus','space','الجيب الجبهي','Frontal sinus','cm-1-5'],
    ['ethmoid-sinus','space','الجيب الغربالي','Ethmoid sinus','mm'],
    ['sphenoid-sinus','space','الجيب الوتدي','Sphenoid sinus','mm'],
    ['orbit','space','الحجاج','Orbit','cm-1-5'],
    ['ocular-globe','organ','مقلة العين','Ocular globe','mm'],
    ['external-ear','organ','الأذن الخارجية','External ear','cm-1-5'],
    ['middle-ear','organ','الأذن الوسطى','Middle ear','mm'],
    ['inner-ear','organ','الأذن الداخلية','Inner ear','mm'],
    ['temporal-bone','bone','العظم الصدغي','Temporal bone','cm-5-15']]],
  ['cervical_spine','العمود الفقري العنقي','Cervical spine','M40-M54 (الظهر) · G54 (الجذور والضفائر)',[
    ['c1-atlas','bone','الفقرة الأولى (الأطلس)','Atlas C1','cm-1-5'],
    ['c2-axis','bone','الفقرة الثانية (المحور)','Axis C2','cm-1-5'],
    ['c3-c7','bone','الفقرات العنقية 3-7','Cervical vertebrae C3-C7','cm-5-15'],
    ['atlanto-occipital-joint','joint','المفصل الفهقي القذالي','Atlanto-occipital joint','mm'],
    ['atlanto-axial-joint','joint','المفصل الفهقي المحوري','Atlanto-axial joint','mm'],
    ['cervical-facet-joints','joint','المفاصل الوجيهية العنقية','Cervical facet joints','mm'],
    ['cervical-discs','cartilage','الأقراص العنقية','Cervical discs','mm'],
    ['cervical-cord','nerve','الحبل الشوكي العنقي','Cervical spinal cord','cm-1-5'],
    ['cervical-roots','nerve','الجذور العصبية العنقية C1-C8','Cervical nerve roots C1-C8','mm'],
    ['vertebral-artery','vessel','الشريان الفقري','Vertebral artery','mm']]],
  ['neck_soft_tissue','الأنسجة الرخوة في الرقبة','Neck soft tissue','M40-M54 · E00-E07 (الدرقية) · J38 (الحنجرة)',[
    ['scm-muscle','muscle','العضلة القصية الترقوية الحلمية','Sternocleidomastoid','cm-5-15'],
    ['upper-trapezius','muscle','العضلة شبه المنحرفة العلوية','Upper trapezius','cm-5-15'],
    ['scalenes','muscle','العضلات الأخمعية','Scalene muscles','cm-1-5'],
    ['deep-cervical-flexors','muscle','عضلات الرقبة العميقة القابضة','Deep cervical flexors','cm-1-5'],
    ['cervical-fascia','fascia','اللفافة العنقية','Cervical fascia','cm-1-5'],
    ['carotid-artery','vessel','الشريان السباتي','Carotid artery','mm'],
    ['jugular-vein','vessel','الوريد الوداجي','Jugular vein','mm'],
    ['cervical-lymph-nodes','lymph','العقد اللمفية العنقية','Cervical lymph nodes','mm'],
    ['thyroid-gland','gland','الغدة الدرقية','Thyroid gland','cm-1-5'],
    ['parathyroid-glands','gland','الغدد جارات الدرقية','Parathyroid glands','mm'],
    ['larynx','organ','الحنجرة','Larynx','cm-1-5'],
    ['pharynx','organ','البلعوم','Pharynx','cm-1-5'],
    ['cervical-esophagus','organ','المريء العنقي','Cervical esophagus','cm-1-5']]]]],
['torso_front','الجذع الأمامي','Torso front',[
  ['chest_wall','جدار الصدر','Chest wall','M00-M99 · S20-S29 (إصابات الصدر)',[
    ['sternum','bone','القص','Sternum','cm-5-15'],
    ['ribs','bone','الأضلاع 1-12','Ribs 1-12','cm-15-plus'],
    ['costal-cartilage','cartilage','الغضاريف الضلعية','Costal cartilages','cm-5-15'],
    ['intercostal-muscles','muscle','العضلات بين الضلوع','Intercostal muscles','cm-5-15'],
    ['pectoralis-major','muscle','العضلة الصدرية الكبرى','Pectoralis major','cm-5-15'],
    ['pectoralis-minor','muscle','العضلة الصدرية الصغرى','Pectoralis minor','cm-1-5'],
    ['serratus-anterior','muscle','العضلة المنشارية الأمامية','Serratus anterior','cm-5-15']]],
  ['thoracic_cavity','التجويف الصدري','Thoracic cavity','I00-I99 (الدوران) · J00-J99 (التنفس)',[
    ['heart','organ','القلب','Heart','cm-5-15'],
    ['pericardium','membrane','التامور','Pericardium','cm-5-15'],
    ['aorta','vessel','الأبهر','Aorta','cm-15-plus'],
    ['pulmonary-artery','vessel','الشريان الرئوي','Pulmonary artery','cm-1-5'],
    ['lungs','organ','الرئتان','Lungs','cm-15-plus'],
    ['pleura','membrane','غشاء الجنبة','Pleura','cm-15-plus'],
    ['mediastinum','space','المنصف','Mediastinum','cm-5-15'],
    ['thoracic-esophagus','organ','المريء الصدري','Thoracic esophagus','cm-5-15']]],
  ['abdomen_wall','جدار البطن','Abdominal wall','K00-K93 · S30-S39 (إصابات البطن)',[
    ['rectus-abdominis','muscle','العضلة المستقيمة البطنية','Rectus abdominis','cm-15-plus'],
    ['obliques','muscle','العضلات المائلة','Oblique muscles','cm-15-plus'],
    ['transversus-abdominis','muscle','العضلة المستعرضة البطنية','Transversus abdominis','cm-15-plus'],
    ['linea-alba','fascia','الخط الأبيض','Linea alba','cm-5-15'],
    ['inguinal-canal','space','القناة الأربية','Inguinal canal','cm-1-5'],
    ['umbilicus','soft_tissue','السرة','Umbilicus','mm']]],
  ['abdominal_cavity','التجويف البطني','Abdominal cavity','K00-K93 (الهضمي) · N00-N39 (البولية)',[
    ['stomach','organ','المعدة','Stomach','cm-15-plus'],
    ['duodenum','organ','الاثنا عشر','Duodenum','cm-5-15'],
    ['small-intestine','organ','الأمعاء الدقيقة','Small intestine','cm-15-plus'],
    ['colon','organ','القولون','Colon','cm-15-plus'],
    ['appendix','organ','الزائدة الدودية','Appendix','cm-1-5'],
    ['liver','organ','الكبد','Liver','cm-15-plus'],
    ['gallbladder','organ','المرارة','Gallbladder','cm-1-5'],
    ['biliary-ducts','space','القنوات المرارية','Biliary ducts','mm'],
    ['pancreas','organ','البنكرياس','Pancreas','cm-5-15'],
    ['spleen','organ','الطحال','Spleen','cm-5-15'],
    ['kidneys','organ','الكليتان','Kidneys','cm-5-15'],
    ['ureters','space','الحالبان','Ureters','mm'],
    ['adrenal-glands','gland','الغدتان الكظريتان','Adrenal glands','mm'],
    ['peritoneum','membrane','الصفاق','Peritoneum','cm-15-plus'],
    ['mesentery','membrane','المساريق','Mesentery','cm-15-plus'],
    ['abdominal-aorta','vessel','الأبهر البطني','Abdominal aorta','cm-15-plus']]],
  ['pelvis','الحوض','Pelvis','N00-N99 · O00-O99 (الحمل) · C50-C62',[
    ['bladder','organ','المثانة','Bladder','cm-1-5'],
    ['urethra','space','الإحليل','Urethra','mm'],
    ['prostate','gland','البروستاتا','Prostate','cm-1-5'],
    ['uterus','organ','الرحم','Uterus','cm-1-5'],
    ['ovaries','organ','المبيضان','Ovaries','cm-1-5'],
    ['fallopian-tubes','space','البوقان الرحميان','Fallopian tubes','mm'],
    ['testis','organ','الخصية','Testis','cm-1-5'],
    ['epididymis','organ','البربخ','Epididymis','mm'],
    ['scrotum','soft_tissue','كيس الصفن','Scrotum','cm-1-5'],
    ['spermatic-cord','space','الحبل المنوي','Spermatic cord','mm'],
    ['rectum','organ','المستقيم','Rectum','cm-5-15'],
    ['sigmoid-colon','organ','القولون السيني','Sigmoid colon','cm-5-15'],
    ['sacrum','bone','العجز','Sacrum','cm-5-15'],
    ['coccyx','bone','العصعص','Coccyx','cm-1-5'],
    ['si-joints','joint','المفاصل العجزية الحرقفية','Sacroiliac joints','mm'],
    ['pelvic-floor','muscle','عضلات قاع الحوض','Pelvic floor muscles','cm-5-15'],
    ['iliac-vessels','vessel','الأوعية الحرقفية','Iliac vessels','mm']]]]],
['back','الظهر','Back',[
  ['thoracic_spine','العمود الفقري الصدري','Thoracic spine','M40-M54 · G54-G58',[
    ['t1-t12','bone','الفقرات الصدرية 1-12','Thoracic vertebrae T1-T12','cm-15-plus'],
    ['thoracic-discs','cartilage','الأقراص الصدرية','Thoracic discs','mm'],
    ['thoracic-facet-joints','joint','المفاصل الوجيهية الصدرية','Thoracic facet joints','mm'],
    ['thoracic-cord','nerve','الحبل الشوكي الصدري','Thoracic spinal cord','cm-5-15'],
    ['thoracic-roots','nerve','الجذور العصبية الصدرية','Thoracic nerve roots','mm']]],
  ['lumbar_spine','العمود الفقري القطني','Lumbar spine','M40-M54 · G54-G58',[
    ['l1-l5','bone','الفقرات القطنية 1-5','Lumbar vertebrae L1-L5','cm-5-15'],
    ['lumbar-discs','cartilage','الأقراص القطنية','Lumbar discs','mm'],
    ['lumbar-facet-joints','joint','المفاصل الوجيهية القطنية','Lumbar facet joints','mm'],
    ['spinal-canal','space','القناة الشوكية','Spinal canal','cm-1-5'],
    ['cauda-equina','nerve','ذيل الفرس','Cauda equina','cm-1-5'],
    ['lumbar-roots','nerve','الجذور العصبية القطنية','Lumbar nerve roots','mm']]],
  ['paraspinal_soft_tissue','الأنسجة الرخوة المجاورة للعمود','Paraspinal soft tissue','M40-M54 · S39',[
    ['erector-spinae','muscle','العضلة الناصبة للفقرات','Erector spinae','cm-15-plus'],
    ['multifidus','muscle','العضلة متعددة الفلق','Multifidus','cm-5-15'],
    ['latissimus-dorsi','muscle','العضلة الظهرية العريضة','Latissimus dorsi','cm-15-plus'],
    ['rhomboids','muscle','العضلتان المعينيتان','Rhomboids','cm-5-15'],
    ['quadratus-lumborum','muscle','العضلة المربعة القطنية','Quadratus lumborum','cm-5-15'],
    ['thoracolumbar-fascia','fascia','اللفافة الصدرية القطنية','Thoracolumbar fascia','cm-15-plus']]],
  ['sacral_region','المنطقة العجزية','Sacral region','M40-M54 · G54-G58',[
    ['sacral-plexus','nerve','الضفيرة العجزية','Sacral plexus','cm-1-5'],
    ['coccygeal-joint','joint','المفصل العصعصي','Coccygeal joint','mm']]]]],
['upper_limb','الطرف العلوي','Upper limb',[
  ['shoulder','الكتف','Shoulder','M75 (أمراض الكتف) · S40-S49',[
    ['clavicle','bone','الترقوة','Clavicle','cm-5-15'],
    ['scapula','bone','لوح الكتف','Scapula','cm-5-15'],
    ['humerus-head','bone','رأس العضد','Humeral head','cm-1-5'],
    ['glenohumeral-joint','joint','مفصل الكتف','Glenohumeral joint','cm-1-5'],
    ['ac-joint','joint','المفصل الأخرمي الترقوي','Acromioclavicular joint','mm'],
    ['sc-joint','joint','المفصل القصي الترقوي','Sternoclavicular joint','mm'],
    ['glenoid-labrum','cartilage','شفة الحق التجويفي','Glenoid labrum','mm'],
    ['rotator-cuff','tendon','الكفة المدورة','Rotator cuff','cm-1-5'],
    ['subacromial-bursa','bursa','الجراب تحت الأخرم','Subacromial bursa','mm'],
    ['biceps-long-head','tendon','الوتر الطويل للعضلة ذات الرأسين','Long head of biceps tendon','cm-1-5'],
    ['deltoid','muscle','العضلة الدالية','Deltoid','cm-5-15'],
    ['levator-scapulae','muscle','العضلة الرافعة للكتف','Levator scapulae','cm-5-15'],
    ['axillary-nerve','nerve','العصب الإبطي','Axillary nerve','mm'],
    ['brachial-plexus','nerve','الضفيرة العضدية','Brachial plexus','cm-1-5'],
    ['axillary-artery','vessel','الشريان الإبطي','Axillary artery','mm']]],
  ['upper_arm','العضد','Upper arm','S40-S69 · G56',[
    ['humerus-shaft','bone','جسم العضد','Humeral shaft','cm-15-plus'],
    ['biceps','muscle','العضلة ذات الرأسين','Biceps brachii','cm-15-plus'],
    ['triceps','muscle','العضلة ثلاثية الرؤوس','Triceps brachii','cm-15-plus'],
    ['brachialis','muscle','العضلة العضدية','Brachialis','cm-5-15'],
    ['radial-nerve','nerve','العصب الكعبري','Radial nerve','mm'],
    ['ulnar-nerve','nerve','العصب الزندي','Ulnar nerve','mm'],
    ['median-nerve','nerve','العصب المتوسط','Median nerve','mm'],
    ['brachial-artery','vessel','شريان العضد','Brachial artery','mm']]],
  ['elbow','المرفق','Elbow','M70-M79 · S50-S59',[
    ['olecranon','bone','الزُّج','Olecranon','cm-1-5'],
    ['radial-head','bone','رأس الكعبرة','Radial head','cm-1-5'],
    ['elbow-joint','joint','مفصل المرفق','Elbow joint','cm-1-5'],
    ['ulnar-collateral-ligament','ligament','الرباط الجانبي الزندي','Ulnar collateral ligament','mm'],
    ['radial-collateral-ligament','ligament','الرباط الجانبي الكعبري','Radial collateral ligament','mm'],
    ['cubital-tunnel','space','النفق المرفقي','Cubital tunnel','mm']]],
  ['forearm','الساعد','Forearm','S50-S69 · G56',[
    ['radius','bone','الكعبرة','Radius','cm-15-plus'],
    ['ulna','bone','الزند','Ulna','cm-15-plus'],
    ['interosseous-membrane','membrane','الغشاء بين العظمين','Interosseous membrane','cm-15-plus'],
    ['forearm-flexors','muscle','قابضات الساعد','Forearm flexors','cm-15-plus'],
    ['forearm-extensors','muscle','باسطات الساعد','Forearm extensors','cm-15-plus'],
    ['pronator-teres','muscle','العضلة الكابة المدورة','Pronator teres','cm-5-15'],
    ['radial-artery','vessel','الشريان الكعبري','Radial artery','mm'],
    ['ulnar-artery','vessel','الشريان الزندي','Ulnar artery','mm']]],
  ['wrist_hand','الرسغ واليد','Wrist and hand','M65-M67 · S60-S69 · G56',[
    ['carpal-bones','bone','عظام الرسغ (8)','Carpal bones (8)','cm-1-5'],
    ['metacarpals','bone','عظام المشط (5)','Metacarpals (5)','cm-5-15'],
    ['phalanges-hand','bone','سلاميات اليد (14)','Hand phalanges (14)','mm'],
    ['radiocarpal-joint','joint','مفصل الرسغ','Radiocarpal joint','mm'],
    ['tfc','cartilage','الغضروف المثلثي الليفي','Triangular fibrocartilage','mm'],
    ['carpal-tunnel','space','نفق الرسغ','Carpal tunnel','mm'],
    ['flexor-tendons','tendon','أوتار القابضات','Flexor tendons','mm'],
    ['thenar-muscles','muscle','عضلات الإبهام (الأصلة)','Thenar muscles','cm-1-5'],
    ['hypothenar-muscles','muscle','عضلات الضريرة','Hypothenar muscles','cm-1-5'],
    ['digital-nerves','nerve','الأعصاب الإصبعية','Digital nerves','mm']]]]],
['lower_limb','الطرف السفلي','Lower limb',[
  ['hip','الورك','Hip','M16 (الفصال) · M70-M76 · S72 · G57',[
    ['femoral-head','bone','رأس الفخذ','Femoral head','cm-1-5'],
    ['femoral-neck','bone','عنق الفخذ','Femoral neck','cm-1-5'],
    ['acetabulum','bone','الحق','Acetabulum','cm-1-5'],
    ['hip-joint','joint','مفصل الورك','Hip joint','cm-1-5'],
    ['hip-labrum','cartilage','شفة الحق','Acetabular labrum','mm'],
    ['greater-trochanter','bone','المدور الكبير','Greater trochanter','cm-1-5'],
    ['gluteus-maximus','muscle','العضلة الألوية الكبرى','Gluteus maximus','cm-15-plus'],
    ['gluteus-medius','muscle','العضلة الألوية المتوسطة','Gluteus medius','cm-5-15'],
    ['iliopsoas','muscle','العضلة الحرقفية القطنية','Iliopsoas','cm-15-plus'],
    ['hip-bursae','bursa','جرابات الورك','Hip bursae','mm'],
    ['sciatic-nerve','nerve','العصب الوركي','Sciatic nerve','mm'],
    ['femoral-nerve','nerve','العصب الفخذي','Femoral nerve','mm'],
    ['lateral-cutaneous-thigh-nerve','nerve','العصب الجلدي الوحشي للفخذ','Lateral cutaneous nerve of thigh','mm'],
    ['femoral-artery','vessel','الشريان الفخذي','Femoral artery','mm']]],
  ['thigh','الفخذ','Thigh','S70-S79 · M60-M79 · I80',[
    ['femur-shaft','bone','جسم عظم الفخذ','Femoral shaft','cm-15-plus'],
    ['quadriceps','muscle','العضلة رباعية الرؤوس','Quadriceps','cm-15-plus'],
    ['hamstrings','muscle','العضلات المأبضية','Hamstrings','cm-15-plus'],
    ['adductors','muscle','العضلات المقربة','Adductor muscles','cm-15-plus'],
    ['sartorius','muscle','العضلة الخياطية','Sartorius','cm-15-plus'],
    ['tfl','muscle','العضلة الموترة للفافة العريضة','Tensor fasciae latae','cm-5-15'],
    ['it-band','fascia','الشريط الظنبوبي','Iliotibial band','cm-15-plus'],
    ['femoral-triangle','space','المثلث الفخذي','Femoral triangle','cm-1-5'],
    ['adductor-canal','space','القناة المقربة','Adductor canal','cm-1-5'],
    ['profunda-femoris-artery','vessel','الشريان الفخذي العميق','Profunda femoris artery','mm'],
    ['sciatic-nerve-thigh','nerve','العصب الوركي في الفخذ','Sciatic nerve (thigh)','mm']]],
  ['knee','الركبة','Knee','M17 · M22 · M23 · S80-S89',[
    ['distal-femur','bone','نهاية عظم الفخذ','Distal femur','cm-5-15'],
    ['proximal-tibia','bone','نهاية الظنبوب','Proximal tibia','cm-5-15'],
    ['patella','bone','الرضفة','Patella','cm-1-5'],
    ['tibiofemoral-joint','joint','المفصل الظنبوبي الفخذي','Tibiofemoral joint','cm-1-5'],
    ['patellofemoral-joint','joint','المفصل الرضفي الفخذي','Patellofemoral joint','mm'],
    ['menisci','cartilage','الغضاريف الهلالية','Menisci','mm'],
    ['acl','ligament','الرباط الصليبي الأمامي','Anterior cruciate ligament','mm'],
    ['pcl','ligament','الرباط الصليبي الخلفي','Posterior cruciate ligament','mm'],
    ['mcl','ligament','الرباط الجانبي الإنسي','Medial collateral ligament','mm'],
    ['lcl','ligament','الرباط الجانبي الوحشي','Lateral collateral ligament','mm'],
    ['patellar-tendon','tendon','الوتر الرضفي','Patellar tendon','mm'],
    ['popliteal-fossa','space','الحفرة المأبضية','Popliteal fossa','cm-1-5'],
    ['popliteal-artery','vessel','الشريان المأبضي','Popliteal artery','mm']]],
  ['lower_leg','الساق','Lower leg','M76 · S80-S89',[
    ['tibia','bone','الظنبوب','Tibia','cm-15-plus'],
    ['fibula','bone','الشظية','Fibula','cm-15-plus'],
    ['gastrocnemius','muscle','العضلة التوأمية','Gastrocnemius','cm-15-plus'],
    ['soleus','muscle','العضلة النعلية','Soleus','cm-15-plus'],
    ['tibialis-anterior','muscle','العضلة الظنبوبية الأمامية','Tibialis anterior','cm-15-plus'],
    ['tibialis-posterior','muscle','العضلة الظنبوبية الخلفية','Tibialis posterior','cm-5-15'],
    ['peroneal-muscles','muscle','العضلات الشظوية','Peroneal muscles','cm-5-15'],
    ['achilles-tendon','tendon','وتر أخيل','Achilles tendon','cm-5-15'],
    ['anterior-compartment','space','الحيز الأمامي للساق','Anterior compartment','cm-5-15'],
    ['posterior-tibial-artery','vessel','الشريان الظنبوبي الخلفي','Posterior tibial artery','mm'],
    ['sural-nerve','nerve','العصب الربلي','Sural nerve','mm']]],
  ['ankle_foot','الكاحل والقدم','Ankle and foot','M20-M25 · M77 · S90-S99',[
    ['talus','bone','العظم الكاحلي','Talus','cm-1-5'],
    ['calcaneus','bone','العظم العقبي','Calcaneus','cm-1-5'],
    ['navicular','bone','العظم الزورقي','Navicular','cm-1-5'],
    ['cuboid','bone','العظم النردي','Cuboid','cm-1-5'],
    ['cuneiforms','bone','العظام الإسفينية (3)','Cuneiforms (3)','cm-1-5'],
    ['metatarsals-foot','bone','عظام مشط القدم (5)','Metatarsals (5)','cm-5-15'],
    ['phalanges-foot','bone','سلاميات القدم (14)','Foot phalanges (14)','mm'],
    ['ankle-joint','joint','مفصل الكاحل','Ankle joint','cm-1-5'],
    ['subtalar-joint','joint','المفصل تحت الكاحلي','Subtalar joint','mm'],
    ['plantar-fascia','fascia','اللفافة الأخمصية','Plantar fascia','cm-5-15'],
    ['deltoid-ligament','ligament','الرباط الدالي','Deltoid ligament','mm'],
    ['lateral-ankle-ligaments','ligament','الأربطة الجانبية للكاحل','Lateral ankle ligaments','mm'],
    ['tarsal-tunnel','space','نفق الرصغ','Tarsal tunnel','mm'],
    ['plantar-nerves','nerve','الأعصاب الأخمصية','Plantar nerves','mm'],
    ['dorsalis-pedis-artery','vessel','شريان ظهر القدم','Dorsalis pedis artery','mm']]]]]
];

const BANDS = {
  'mm': { ar: 'أقل من 1 سم (نطاق ملّيمتري)', en: 'under 1 cm (millimetre range)' },
  'cm-1-5': { ar: 'من 1 إلى 5 سم', en: '1 to 5 cm' },
  'cm-5-15': { ar: 'من 5 إلى 15 سم', en: '5 to 15 cm' },
  'cm-15-plus': { ar: 'أكثر من 15 سم', en: 'over 15 cm' }
};

const regions = T.map(([id, ar, en, subs]) => ({
  id, label: { ar, en },
  subRegions: subs.map(([sid, sar, sen, icdChapterHint, structures]) => ({
    id: sid, regionId: id, label: { ar: sar, en: sen }, icdChapterHint,
    structures: structures.map(([stid, type, xar, xen, band]) => ({
      id: stid, subRegionId: sid, type, label: { ar: xar, en: xen },
      sizeBand: band, sizeBandLabel: BANDS[band]
    }))
  }))
}));

const doc = {
  schemaVersion: '1.0.0', generatedAt: '2026-09-26', granularity: 'system-region-subregion-structure',
  notice: {
    ar: 'تصنيف تشريحي هرمي للتعليم فقط: 5 مناطق أساسية → مناطق فرعية → بنية محددة. نطاق الحجم تقديري للتوجيه (ملّيمتري إلى أكثر من 15 سم) وليس قياسًا فعليًا، والتعداد لا يدّعي تغطية كل ملّيمتر من الجسم.',
    en: 'Hierarchical anatomical taxonomy for education only: 5 base regions to sub-regions to specific structures. Size bands are orientation estimates (millimetre range to over 15 cm), not measured values; the enumeration does not claim to cover every millimetre of the body.'
  },
  sizeBands: BANDS,
  structureTypes: ['bone','joint','ligament','muscle','tendon','nerve','vessel','organ','gland','lymph','membrane','cartilage','bursa','fascia','space','soft_tissue'],
  regions
};

fs.writeFileSync(OUT, JSON.stringify(doc, null, 2) + '\n');
const subN = regions.reduce((n, r) => n + r.subRegions.length, 0);
const stN = regions.reduce((n, r) => n + r.subRegions.reduce((m, s) => m + s.structures.length, 0), 0);
const bandN = regions.reduce((a, r) => { r.subRegions.forEach(s => s.structures.forEach(st => a[st.sizeBand] = (a[st.sizeBand] || 0) + 1)); return a; }, {});
console.log('wrote ' + path.relative(root, OUT));
console.log('base regions: ' + regions.length + ' | sub-regions: ' + subN + ' | structures: ' + stN);
console.log('size bands: ' + JSON.stringify(bandN));
