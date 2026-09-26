# إصلاح تفاعل خريطة الجسم على الويب — BodyMap Pain

## المشكلة
في وضع العرض "التفصيلي" (detailed) داخل شاشة اختيار العضو، كان المكوّن
`BodySilhouette` القادم من مكتبة `react-native-body-parts-anatomy` يُستخدم
على كل المنصّات. لكن على الويب يعتمد `react-native-svg` على `onPressIn`
الذي لا يعمل على المتصفح، فتصبح خريطة الجسم **غير قابلة للنقر** على الويب
(عرض للقراءة فقط) رغم أن التطبيق منشور على الويب (Vercel).

## الحل
المستودع يحتوي بالفعل على مكوّن جاهز للويب اسمه `WebBodySilhouette`
(`components/WebBodySilhouette.tsx`) يرسم نفس الأجزاء الـ317 عبر `react-native-svg`
مع دعم النقر والتحويم والتكبير/التحريك — لكنه كان **غير مستخدم (orphaned)**.

قمنا بتوصيله داخل `screens/BodyPickerScreen.tsx` عبر شرط المنصّة:

```tsx
{bodyViewMode === 'illustration' ? <IllustratedBodyMap ... />
 : Platform.OS === 'web' ? <WebBodySilhouette
     gender={gender}
     view={activeView as MuscleMapView}
     selectedSlugs={selectedMuscleId ? [selectedMuscleId] : []}
     onFragmentPress={handleFragmentPress}
     numberForSlug={partNumberForSlug}
   />
 : <BodySilhouette ... />}
```

مع إضافة:
- استيراد `Platform` من `react-native`.
- استيراد `WebBodySilhouette`.
- دالة `partNumberForSlug` لربط رقم كل جزء بملصقات المكوّن.

## الملفات في هذا الأرشيف
| الملف | الحالة | الوصف |
|------|--------|-------|
| `screens/BodyPickerScreen.tsx` | **معدّل** | توصيل `WebBodySilhouette` عند `Platform.OS === 'web'` |
| `components/WebBodySilhouette.tsx` | مساند (موجود مسبقًا في المستودع) | عارض الويب التفاعلي للأجزاء الـ317 |
| `web-body-interaction.patch` | مرجعي | الفرق (git diff) الجاهز للتطبيق |

## التحقق
- `npm run typecheck` → نجح بدون أخطاء.
- `npm run build:web` → نجح (941 وحدة، تصدير `dist`).

## طريقة التطبيق
انسخ المجلدين `screens/` و`components/` فوق مشروعك، أو طبّق الملف
`web-body-interaction.patch` بالأمر:

```bash
git apply web-body-interaction.patch
```
