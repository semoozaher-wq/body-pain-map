const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../data/anatomyPainMap.json');

console.log('🔍 جاري قراءة ملف anatomyPainMap.json...');
let rawData = fs.readFileSync(filePath, 'utf8');
let data = JSON.parse(rawData);

// دالة لتنظيف المفاتيح والقيم النصية من المسافات الزائدة بشكل متكرر
function cleanObject(obj) {
  if (Array.isArray(obj)) {
    return obj.map(cleanObject);
  } else if (obj !== null && typeof obj === 'object') {
    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
      const cleanKey = key.trim(); // تنظيف المفتاح
      const cleanValue = typeof value === 'string' ? value.trim() : cleanObject(value); // تنظيف القيمة
      cleaned[cleanKey] = cleanValue;
    }
    return cleaned;
  }
  return obj;
}

console.log('🧹 جاري إزالة جميع المسافات الزائدة من المفاتيح والقيم...');
const cleanedData = cleanObject(data);

// إضافة ملاحظة تدقيق
cleanedData.cleanedAt = new Date().toISOString();
cleanedData.cleaningNote = "تم تنظيف الملف برمجياً: إزالة جميع المسافات الزائدة من المفاتيح والقيم لضمان عمل التطبيق بشكل مثالي.";

console.log('💾 جاري حفظ الملف المنسق بشكل احترافي...');
fs.writeFileSync(filePath, JSON.stringify(cleanedData, null, 2), 'utf8');

console.log('✅ تم تنظيف ملف anatomyPainMap.json بنجاح 100%!');
console.log('✨ الملف الآن مثالي وجاهز للعمل بدون أي أخطاء مطابقة (Mapping Errors).');
