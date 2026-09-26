BodyMap Pain — الملفات المعدّلة والمضافة
==========================================

هذا الملف يحتوي على كل الملفات التي تم تعديلها أو إضافتها، مقسّمة على مجلدين رئيسيين:

1) الميزات الصوتية والصور (Voice + Image Assistant)
---------------------------------------------------
- screens/AssistantScreen.tsx        (المساعد الذكي: إدخال صوتي 🎤 + إرفاق صورة 📷 + نطق الردود 🔊)
- services/aiAssistant/engine.ts     (دعم الصورة في محرّك التحليل)
- services/aiAssistant/lexicon.ts    (المفردات)
- app.json                           (صلاحيات الميكروفون والصور)
- package.json                       (مكتبات expo-speech / expo-image-picker / expo-speech-recognition)
- locales/ar.json , locales/en.json , locales/fr.json   (مفاتيح الترجمة الجديدة)

2) الأعضاء الداخلية (Internal Organs)
-------------------------------------
- data/organDetails.json
- data/anatomyHotspots.json
- data/internalOrgans.json
- MainApp.tsx
- screens/BodyPickerScreen.tsx

3) PWA + المشاركة (Vercel / تثبيت على الهاتف / رابط + QR)
--------------------------------------------------------
- public/manifest.json
- public/service-worker.js
- public/icons/icon-192.png , icon-512.png , icon-maskable-512.png
- scripts/inject-pwa.mjs
- vercel.json
- share-card.png , qr-code.png

طريقة التركيب
-------------
1) انسخ محتوى مجلد files/ إلى جذر مشروعك (نفس المسارات).
2) npm install
3) للتشغيل: npx expo start
4) للويب: npm run build:web  (ينتج مجلد dist/ جاهز للنشر على Vercel)

ملاحظة: التحليل البصري الآلي للصور (تشخيص العلامات/الالتهابات) غير مُفعّل حالياً —
التطبيق يحفظ الصورة كمرفق مع الشكوى، والتحليل يعتمد على الوصف النصّي.
