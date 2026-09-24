import rawJson from './anatomyPainMap.json';

function deepClean(obj: any): any {
  if (typeof obj === 'string') return obj.trim();
  if (Array.isArray(obj)) return obj.map(deepClean);
  if (obj !== null && typeof obj === 'object') {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      cleaned[key.trim()] = deepClean(value);
    }
    return cleaned;
  }
  return obj;
}

export const anatomyPainMap = deepClean(rawJson);
export default anatomyPainMap;
