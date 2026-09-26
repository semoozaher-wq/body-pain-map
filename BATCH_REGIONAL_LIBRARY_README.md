# دفعة التوسّع الطبي — قائمة الملفات المضافة/المعدّلة

## ملفات جديدة
| الملف | الوصف |
|---|---|
| `data/medical/regionalConditions.json` | 46 حالة إقليمية (A/B/C) بثلاث لغات + ICD-10 + أعراض + علامات خطر + مصادر |
| `data/medical/triageQuestions.json` | 5 مناطق × 6 أسئلة فرز، منها 16 سؤالًا إنذاريًا بنص تنبيه ثلاثي اللغة |
| `scripts/validate-medical-library.js` | تحقّق صارم: يمنع خلط مرض بمنطقة، ويمنع الأكواد المُختَرعة، ويتحقق من الترجمات والمصادر |
| `scripts/generate-regional-library.js` | سكربت توليد الدفعة (يتوقف تلقائيًا إن كانت البيانات موجودة لمنع التكرار) |
| `docs/REGIONAL_LIBRARY_AR.md` | وثيقة الدفعة وقواعد السلامة |
| `BATCH_REGIONAL_LIBRARY_README.md` | هذا الملف |

## ملفات معدّلة
| الملف | التغيير |
|---|---|
| `data/medical/symptoms.json` | 32 عرضًا محليًا جديدًا (المجموع 64) + `ontologyStatus` + إضافة `head_neck` للحرارة |
| `data/medical/sources.json` | إضافة CDC وWHO (ICD-10) وتحديث الملاحظة |
| `services/medical/diseaseLibrary.ts` | دمج الحالات الإقليمية + `getRegionalConditions` + `getConditionsByBatch` + `doid: string \| null` + إحصاءات موسّعة |
| `hooks/useMedicalLibrary.ts` | خطّافات `useRegionalConditions` و`useConditionsByBatch` |
| `components/ConditionInfoCard.tsx` | لا تعرض كود DOID إن لم يكن مُتحقَّقًا (تفادي نص فارغ/`null`) |
| `package.json` | سكربت `validate:medical-library` |

## التحقّق المطلوب بعد التركيب
```bash
npm install
npm run validate:medical-library
npm run typecheck
npm run build:web
```
