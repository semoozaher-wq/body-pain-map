const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const points = JSON.parse(fs.readFileSync(path.join(root, 'data/acupressurePoints.json'), 'utf8'));
const remedies = JSON.parse(fs.readFileSync(path.join(root, 'data/naturalRelief.json'), 'utf8'));
const hotspots = JSON.parse(fs.readFileSync(path.join(root, 'data/anatomyHotspots.json'), 'utf8'));
const anatomy = JSON.parse(fs.readFileSync(path.join(root, 'data/anatomyPainMap.json'), 'utf8'));
const ids = new Set();
for (const point of points.points) {
  if (ids.has(point.id)) throw new Error(`Duplicate acupressure point id: ${point.id}`);
  ids.add(point.id);
  for (const field of ['code', 'traditionalName', 'location', 'use', 'technique', 'evidence', 'caution']) {
    if (!point[field]) throw new Error(`Point ${point.id} missing ${field}`);
  }
  if (!point.sources?.length || point.sources.some((source) => !/^https:\/\//.test(source.url))) throw new Error(`Point ${point.id} missing valid citations`);
  for (const locale of ['ar', 'en', 'fr']) {
    if (!point.name?.[locale] || !point.location?.[locale] || !point.caution?.[locale]) throw new Error(`Point ${point.id} missing ${locale} copy`);
  }
}
const remedyIds = new Set();
for (const remedy of remedies.remedies) {
  if (remedyIds.has(remedy.id)) throw new Error(`Duplicate remedy id: ${remedy.id}`);
  remedyIds.add(remedy.id);
  for (const field of ['instructions', 'evidence', 'contraindications', 'redFlags', 'source', 'redFlagSource']) {
    if (!remedy[field]) throw new Error(`Remedy ${remedy.id} missing ${field}`);
  }
  if (!/^https:\/\//.test(remedy.source.url) || !/^https:\/\//.test(remedy.redFlagSource.url)) throw new Error(`Remedy ${remedy.id} missing valid source URLs`);
  if (!remedy.safetySources?.length || remedy.safetySources.some((source) => !/^https:\/\//.test(source.url))) throw new Error(`Remedy ${remedy.id} missing safety references`);
  if (!remedy.specialPopulations?.ar || !remedy.specialPopulations?.en || !remedy.specialPopulations?.fr) throw new Error(`Remedy ${remedy.id} missing pregnancy/anticoagulant guidance`);
  for (const locale of ['ar', 'en', 'fr']) {
    for (const field of ['name', 'instructions', 'evidence', 'contraindications', 'redFlags']) {
      if (!remedy[field]?.[locale]) throw new Error(`Remedy ${remedy.id} missing ${field}.${locale}`);
    }
  }
}
const organHotspots = hotspots.filter((spot) => spot.type === 'organ');
for (const spot of organHotspots) {
  if (!spot.relatedGroupSlugs?.length || !spot.relatedPartIds?.length) throw new Error(`Organ ${spot.organId} missing anatomy mappings`);
  for (const group of spot.relatedGroupSlugs) if (!anatomy.groups[group]) throw new Error(`Unknown group ${group} for ${spot.organId}`);
  for (const part of spot.relatedPartIds) if (!anatomy.muscles[part]) throw new Error(`Unknown fragment ${part} for ${spot.organId}`);
}
if (!points.notice?.ar || !points.notice?.en || !points.notice?.fr || !remedies.globalNotice?.ar || !remedies.globalNotice?.en || !remedies.globalNotice?.fr) throw new Error('Missing medical disclaimers in one or more supported languages');
console.log(`Clinical-guide validation passed: ${points.points.length} acupressure points, ${remedies.remedies.length} self-care guides, ${organHotspots.length} mapped organ hotspots; point, remedy, safety and red-flag references plus Arabic/English/French copy verified.`);
