import raw from './anatomyPainMap.json';

function trimAll(obj: any): any {
  if (typeof obj === 'string') return obj.trim();
  if (Array.isArray(obj)) return obj.map(trimAll);
  if (obj && typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key.trim()] = trimAll(value);
    }
    return result;
  }
  return obj;
}

export const cleanData = trimAll(raw);
export default cleanData;
