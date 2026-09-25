import React, { useMemo, useState } from 'react';
import { Alert, Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { Checkup } from '../types';
import anatomyMap from '../data/anatomyPainMap.json';
import type { AnatomyData } from '../types';
import type { Language } from '../services/i18n';

const anatomy = anatomyMap as unknown as AnatomyData;
type Range = 7 | 30 | 90 | 'all';
type Props = { records: Checkup[]; language?: Language };
const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] ?? character));

const words = {
  ar: { title: 'ملخص سجل الألم للطبيب', range: 'الفترة', entries: 'عدد التسجيلات', average: 'متوسط الشدة', alerts: 'علامات إنذار مسجلة', symptoms: 'الأعراض', common: 'المناطق الأكثر تكرارًا', chart: 'متوسط الشدة مع الوقت', noData: 'لا توجد تسجيلات في الفترة المختارة.', intro: 'هذا تقرير وصفي من البيانات التي أدخلها المستخدم، وليس تشخيصًا أو توصية علاجية.', date: 'التاريخ', area: 'المنطقة', intensity: 'الشدة', triage: 'حالة التنبيه', flags: 'علامات الإنذار', quality: 'نوع الألم', duration: 'المدة', medication: 'علاج/دواء مسجل', triggers: 'محفزات ملاحظة', notes: 'ملاحظات', after: 'بعد العناية', generate: 'إنشاء تقرير للطبيب · PDF / طباعة', busy: 'جاري تجهيز التقرير…', seven: '7 أيام', thirty: '30 يومًا', ninety: '90 يومًا', all: 'كل السجل', caption: 'اختر فترة التقرير؛ يضم الرسم والمناطق المتكررة والأدوية والعلامات والملاحظات.' },
  en: { title: 'Pain log summary for clinician', range: 'Period', entries: 'Entries', average: 'Average intensity', alerts: 'Recorded warning signs', symptoms: 'Symptoms', common: 'Most recorded areas', chart: 'Average intensity over time', noData: 'No entries in the selected period.', intro: 'This is a descriptive report from user-entered data, not a diagnosis or treatment recommendation.', date: 'Date', area: 'Area', intensity: 'Intensity', triage: 'Triage status', flags: 'Warning signs', quality: 'Pain quality', duration: 'Duration', medication: 'Treatment/medication', triggers: 'Observed factors', notes: 'Notes', after: 'After self-care', generate: 'Create clinician report · PDF / Print', busy: 'Preparing report…', seven: '7 days', thirty: '30 days', ninety: '90 days', all: 'All records', caption: 'Choose the report period; it includes the chart, frequent areas, treatments, warning signs and notes.' },
  fr: { title: 'Résumé du suivi pour le professionnel', range: 'Période', entries: 'Entrées', average: 'Intensité moyenne', alerts: 'Signes d’alerte notés', symptoms: 'Symptômes', common: 'Zones les plus notées', chart: 'Intensité moyenne au fil du temps', noData: 'Aucune entrée pendant cette période.', intro: 'Rapport descriptif à partir des données saisies, sans diagnostic ni recommandation de traitement.', date: 'Date', area: 'Zone', intensity: 'Intensité', triage: 'Niveau d’alerte', flags: 'Signes d’alerte', quality: 'Type de douleur', duration: 'Durée', medication: 'Traitement/médicament', triggers: 'Facteurs observés', notes: 'Notes', after: 'Après les autosoins', generate: 'Créer un rapport · PDF / Imprimer', busy: 'Préparation du rapport…', seven: '7 jours', thirty: '30 jours', ninety: '90 jours', all: 'Tout l’historique', caption: 'Choisissez la période ; le rapport comprend le graphique, les zones, traitements, alertes et notes.' },
} as const;
const rangeDays = (range: Range) => range === 'all' ? null : range * 24 * 60 * 60 * 1000;
const areaName = (record: Checkup) => record.areaLabel ?? anatomy.muscles[record.partId]?.labelAr ?? record.partId;

function reportHtml(records: Checkup[], range: Range, language: Language) {
  const t = words[language];
  const now = Date.now();
  const span = rangeDays(range);
  const included = records.filter((r) => range === 'all' ? true : !!r.createdAtIso && now - new Date(r.createdAtIso).getTime() <= (span ?? Infinity));
  const sorted = [...included].sort((a, b) => (a.createdAtIso ?? '').localeCompare(b.createdAtIso ?? ''));
  const mean = included.length ? included.reduce((sum, r) => sum + r.intensity, 0) / included.length : 0;
  const flagsCount = included.filter((r) => r.urgent || r.redFlags?.length).length;
  const areaCounts = new Map<string, number>();
  included.forEach((r) => areaCounts.set(areaName(r), (areaCounts.get(areaName(r)) ?? 0) + 1));
  const frequent = [...areaCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const start = range === 'all' ? (sorted[0]?.createdAtIso ? new Date(sorted[0].createdAtIso).getTime() : now - 7 * 86400000) : now - (span ?? 7 * 86400000);
  const buckets = range === 7 ? 7 : range === 30 ? 6 : 10;
  const points = Array.from({ length: buckets }, (_, i) => {
    const left = start + (i * (now - start)) / buckets;
    const right = start + ((i + 1) * (now - start)) / buckets;
    const sample = sorted.filter((r) => { const ts = r.createdAtIso ? new Date(r.createdAtIso).getTime() : 0; return ts >= left && (i === buckets - 1 ? ts <= right : ts < right); });
    const avg = sample.length ? sample.reduce((sum, r) => sum + r.intensity, 0) / sample.length : 0;
    const date = new Date(left);
    const label = language === 'ar' ? date.toLocaleDateString('ar-EG', { month: 'numeric', day: 'numeric' }) : date.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en', { month: 'numeric', day: 'numeric' });
    return { avg, label, count: sample.length };
  });
  const chart = `<div class="chart">${points.map((p) => `<div class="barItem"><div class="barValue">${p.count ? p.avg.toFixed(1) : ''}</div><div class="track"><div class="bar" style="height:${Math.max(p.count ? 5 : 0, p.avg * 8)}px"></div></div><div class="barLabel">${esc(p.label)}</div></div>`).join('')}</div>`;
  const areaLine = frequent.length ? frequent.map(([name, count]) => `${esc(name)} (${count})`).join(' · ') : '—';
  const rows = included.map((item) => `<tr><td>${esc(item.createdAtIso ? new Date(item.createdAtIso).toLocaleString(language === 'ar' ? 'ar-EG' : language === 'fr' ? 'fr-FR' : 'en') : item.createdAt)}</td><td>${esc(areaName(item))}</td><td>${item.intensity}/10${item.afterIntensity !== undefined ? `<br>${esc(t.after)}: ${item.afterIntensity}/10` : ''}</td><td>${esc(item.triageStatus ?? (item.urgent ? 'urgent' : 'routine'))}</td><td>${esc(item.redFlags?.join(' • ') || '—')}</td><td>${esc(item.symptoms?.join(' • ') || '—')}</td><td>${esc(item.painType)}</td><td>${esc(item.duration)}</td><td>${esc(item.medication || '—')}</td><td>${esc(item.triggers || '—')}</td><td>${esc(item.note || '—')}</td></tr>`).join('');
  const rangeName = range === 'all' ? t.all : range === 7 ? t.seven : range === 30 ? t.thirty : t.ninety;
  return `<!doctype html><html lang="${language}" dir="${language === 'ar' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(t.title)}</title><style>*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#163b42;margin:24px;line-height:1.6}header{border-bottom:3px solid #0b8d82;padding-bottom:12px;margin-bottom:16px}h1{color:#0b7774;font-size:24px;margin:0}.notice{background:#edf8f5;padding:10px 13px;border-inline-start:4px solid #0b7774;margin:12px 0}.summary{display:flex;gap:10px;flex-wrap:wrap}.stat{padding:10px;background:#f1f8f7;border-radius:10px;min-width:135px}.stat b{display:block;font-size:20px;color:#0b7774}.chart{height:128px;display:flex;gap:6px;align-items:flex-end;border-bottom:1px solid #d5e4e4;margin:12px 0}.barItem{flex:1;text-align:center;height:100%;display:flex;flex-direction:column;justify-content:flex-end}.track{height:80px;display:flex;align-items:flex-end;justify-content:center}.bar{width:65%;background:#17a99b;border-radius:5px 5px 0 0}.barValue,.barLabel{font-size:9px;color:#60777c}.barLabel{white-space:nowrap}table{border-collapse:collapse;width:100%;font-size:9px;margin-top:12px}th,td{border:1px solid #d8e5e5;padding:6px;text-align:start;vertical-align:top}th{background:#e9f5f2}footer{margin-top:16px;font-size:10px;color:#6c7f82}@media print{body{margin:10mm}thead{display:table-header-group}tr{break-inside:avoid}}</style></head><body><header><h1>${esc(t.title)}</h1><p>${esc(t.range)}: ${esc(rangeName)} · ${esc(t.entries)}: ${included.length}</p></header><div class="notice">${esc(t.intro)}</div><div class="summary"><div class="stat"><b>${included.length}</b>${esc(t.entries)}</div><div class="stat"><b>${included.length ? mean.toFixed(1) + '/10' : '—'}</b>${esc(t.average)}</div><div class="stat"><b>${flagsCount}</b>${esc(t.alerts)}</div></div><h3>${esc(t.common)}</h3><p>${areaLine}</p><h3>${esc(t.chart)}</h3>${chart}<table><thead><tr>${[t.date,t.area,t.intensity,t.triage,t.flags,t.symptoms,t.quality,t.duration,t.medication,t.triggers,t.notes].map(x=>`<th>${esc(x)}</th>`).join('')}</tr></thead><tbody>${rows || `<tr><td colspan="11">${esc(t.noData)}</td></tr>`}</tbody></table><footer>${esc(t.intro)}</footer><script>window.onload=()=>setTimeout(()=>window.print(),300)</script></body></html>`;
}

export function DoctorReport({ records, language = 'ar' }: Props) {
  const [busy, setBusy] = useState(false);
  const [range, setRange] = useState<Range>(30);
  const t = words[language];
  const filteredRecords = useMemo(() => {
    const span = rangeDays(range);
    return records.filter((record) => range === 'all' || (!!record.createdAtIso && Date.now() - new Date(record.createdAtIso).getTime() <= (span ?? Infinity)));
  }, [records, range]);
  const exportReport = async () => {
    if (!filteredRecords.length) { Alert.alert(t.noData, t.noData); return; }
    setBusy(true);
    try {
      const html = reportHtml(records, range, language);
      if (Platform.OS === 'web') {
        const popup = window.open('', '_blank');
        if (!popup) { Alert.alert('Report blocked', 'Allow pop-ups for this app and try again.'); return; }
        popup.document.open(); popup.document.write(html); popup.document.close();
      } else {
        const file = await Print.printToFileAsync({ html, base64: false });
        if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: t.title });
        else await Share.share({ message: t.title });
      }
    } catch { Alert.alert('Report error', 'Please retry or export your local JSON backup.'); }
    finally { setBusy(false); }
  };
  const ranges: { key: Range; title: string }[] = [{ key: 7, title: t.seven }, { key: 30, title: t.thirty }, { key: 90, title: t.ninety }, { key: 'all', title: t.all }];
  return <View style={styles.wrap}>
    <Text style={styles.heading}>{language === 'ar' ? 'تقرير قابل للتخصيص' : language === 'fr' ? 'Rapport personnalisable' : 'Customizable report'}</Text>
    <View style={styles.ranges}>{ranges.map((item) => <Pressable key={String(item.key)} onPress={() => setRange(item.key)} accessibilityRole="button" accessibilityState={{ selected: range === item.key }} style={[styles.range, range === item.key && styles.rangeActive]}><Text style={[styles.rangeText, range === item.key && styles.rangeTextActive]}>{item.title}</Text></Pressable>)}</View>
    <Text style={styles.caption}>{t.caption}</Text>
    <Pressable onPress={exportReport} disabled={busy || filteredRecords.length === 0} accessibilityRole="button" style={[styles.button, (busy || filteredRecords.length === 0) && styles.disabled]}><Text style={styles.buttonText}>{busy ? t.busy : `${t.generate} · ${filteredRecords.length}`}</Text></Pressable>
  </View>;
}
const styles = StyleSheet.create({ wrap: { marginBottom: 12, padding: 12, borderRadius: 14, backgroundColor: '#F7FBFA', borderWidth: 1, borderColor: '#DCE9E8' }, heading: { color: '#143B43', fontWeight: '900', textAlign: 'right' }, ranges: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6, marginTop: 9 }, range: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 16, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#D8E5E5' }, rangeActive: { backgroundColor: '#0B7774', borderColor: '#0B7774' }, rangeText: { color: '#476267', fontSize: 10, fontWeight: '800' }, rangeTextActive: { color: '#FFF' }, caption: { color: '#75868A', fontSize: 10, lineHeight: 16, textAlign: 'right', marginTop: 8 }, button: { borderRadius: 12, padding: 13, backgroundColor: '#0B7774', alignItems: 'center', marginTop: 10 }, disabled: { opacity: 0.45 }, buttonText: { color: '#FFF', fontWeight: '900', fontSize: 12 } });
