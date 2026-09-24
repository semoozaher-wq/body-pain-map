import rawAnatomyData from './anatomyPainMap.json';

// دالة لتنظيف المسافات الزائدة من المفاتيح والقيم النصية
function cleanObject(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(cleanObject);
  } else if (obj !== null && typeof obj === 'object') {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const cleanKey = key.trim();
      const cleanValue = typeof value === 'string' ? value.trim() : cleanObject(value);
      cleaned[cleanKey] = cleanValue;
    }
    return cleaned;
  }
  return obj;
}

// تنظيف البيانات مرة واحدة عند التحميل
export const anatomyPainMap = cleanObject(rawAnatomyData) as any;

export default anatomyPainMap;
