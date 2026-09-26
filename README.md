# BodyMap Pain — إضافة المكتبات الطبية (حزمة الملفات المعدّلة/المضافة)

هذه الحزمة تحتوي على كل الملفات التي أُضيفت أو عُدّلت لدمج **الطبقة الطبية** في تطبيق BodyMap Pain.

## كيف تركّب الملفات؟

انسخ محتوى المجلدات فوق مشروعك مباشرة (نفس المسارات):

```
data/medical/…            → data/medical/
services/medical/…        → services/medical/
hooks/…                   → hooks/
components/…              → components/
screens/BodyPickerScreen.tsx → screens/   (معدّل — استبدل الملف)
locales/{ar,en,fr}.json   → locales/      (معدّل — أضيف مفاتيح جديدة فقط)
docs/…                    → docs/
```

ثم:

```bash
npm install      # لا توجد تبعيات جديدة إلزامية
npm run typecheck
npm run build:web
```

## ما الجديد؟

### 1) مكتبة الأمراض والأعراض (offline بالكامل — بدون إنترنت)
- `data/medical/diseases.json` — **23 حالة** (ألم أسفل الظهر، الرقبة، الكتف، الركبة، الشقيقة، الفيبروميالجيا، الالتهابات...) مع أسماء وملخصات و**علامات خطر** بثلاث لغات، وأكواد **DOID** و**ICD-10**، وروابط MedlinePlus.
- `data/medical/symptoms.json` — **32 عرضًا** بأكواد **HPO**.
- `data/medical/sources.json` — سجل المصادر والتراخيص.
- `services/medical/diseaseLibrary.ts` — محرّك البحث المحلي (حسب مجموعة العضلات/المنطقة/العرض/نص حر).
- `hooks/useMedicalLibrary.ts` — خطّافات React.

### 2) مكتبة الأدوية (RxNorm + openFDA)
- `services/medical/rxNorm.ts` — توحيد أسماء الأدوية + التفاعلات.
- `services/medical/openFda.ts` — ملصقات الأدوية + الأحداث الجانبية.
- `hooks/useDrugLookup.ts`.

### 3) MedlinePlus Connect
- `services/medical/medlinePlusConnect.ts` — ربط أكواد ICD-10/SNOMED بمحتوى NLM.
- `services/medical/index.ts` — تجميع + إعدادات `MEDICAL_SETTINGS`.

### 4) الواجهات (UI)
- `components/MedicalLibraryPanel.tsx` — تصفّح الأمراض حسب منطقة الجسم + بحث.
- `components/ConditionInfoCard.tsx` — بطاقة حالة (أعراض + علامات خطر + MedlinePlus).
- `components/DrugLookupPanel.tsx` — بحث الأدوية وعرض الملصق.
- **ربط كامل** في `screens/BodyPickerScreen.tsx`: زرّان جديدان **«المكتبة الطبية»** و**«الأدوية»** بجانب الأزرار الموجودة.

### 5) التوثيق
- `docs/MEDICAL_LIBRARIES.md` — الكتالوج الكامل (أولاً → خامساً) مع التراخيص.
- `docs/Z_ANATOMY_3D_PLAN.md` — خطة الأطلس ثلاثي الأبعاد (Z-Anatomy + BodyParts3D).

## ملاحظات سلامة وترخيص
- كل المحتوى **تعليمي عام فقط**، ولا يقدّم تشخيصًا أو علاجًا.
- الأكواد (DOID/ICD-10/HPO) **للمطابقة المرجعية فقط**.
- لا نُضمّن محتوى يتطلب ترخيصًا مدفوعًا (CPT، SNOMED خارج النطاق).
- نداءات الشبكة (RxNorm/openFDA/MedlinePlus) **اختيارية وتفشل بهدوء** إذا لا يوجد اتصال، فتبقى المكتبة المحلية تعمل دائمًا.
- الخصوصية محفوظة: لا حسابات، لا سحابة، كل شيء محلي.

## التحقق
- ✅ `npm run typecheck` — نجح بدون أخطاء.
- ✅ `npm run build:web` — نجح.
- ✅ كل أكواد HPO المُشار إليها في الأمراض موجودة في `symptoms.json`.
