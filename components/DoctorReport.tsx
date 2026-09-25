import React, { useState } from 'react';
import { Alert, Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { Checkup } from '../types';
import anatomyMap from '../data/anatomyPainMap.json';
import type { AnatomyData } from '../types';

const anatomy = anatomyMap as unknown as AnatomyData;
type Props = { records: Checkup[] };
const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] ?? character));

function reportHtml(records: Checkup[]) {
  const rows = records.map((item) => {
    const muscle = anatomy.muscles[item.partId];
    const title = muscle ? `${muscle.partNumber} — ${muscle.labelAr}` : item.selfCareGuide ? `عناية ذاتية — ${item.selfCareGuide}` : item.partId;
    const when = item.createdAtIso ? new Date(item.createdAtIso).toLocaleString('ar-EG') : item.createdAt;
    return `<tr><td>${esc(when)}</td><td>${esc(title)}</td><td>${item.intensity}/10${item.afterIntensity !== undefined ? ` (بعدها ${item.afterIntensity}/10)` : ''}</td><td>${esc(item.painType)}</td><td>${esc(item.duration)}</td><td>${esc(item.medication || '—')}</td><td>${esc(item.triggers || '—')}</td><td>${esc(item.note || '—')}</td></tr>`;
  }).join('');
  const period = records.length ? `${esc(records[records.length - 1].createdAt)} – ${esc(records[0].createdAt)}` : 'لا توجد تسجيلات';
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>ملخص سجل الألم — BodyMap Pain</title><style>
    *{box-sizing:border-box}body{font-family:Arial,"Noto Naskh Arabic",sans-serif;color:#18383e;margin:28px;line-height:1.65}header{border-bottom:3px solid #11998e;padding-bottom:12px;margin-bottom:18px}h1{font-size:25px;margin:0;color:#087f78}p{margin:6px 0;color:#52686d}.notice{background:#eff8f6;border-right:4px solid #13877e;padding:11px 14px;margin:15px 0;font-size:12px}table{width:100%;border-collapse:collapse;font-size:10px}th,td{border:1px solid #d9e4e4;padding:7px;text-align:right;vertical-align:top}th{background:#eaf5f2;color:#165b59}footer{margin-top:18px;color:#75868a;font-size:10px}@media print{body{margin:10mm}thead{display:table-header-group}tr{break-inside:avoid}}
    </style></head><body><header><h1>BodyMap Pain — ملخص سجل الألم</h1><p>الفترة: ${period} · عدد التسجيلات: ${records.length}</p><p>أُعدّ للمساعدة في مناقشة السجل مع مختص صحي.</p></header><div class="notice">هذا ملخص وصفي لمدخلات المستخدم، وليس تشخيصًا أو توصية علاجية. راجع مختصًا صحيًا لتفسير الأعراض.</div><table><thead><tr><th>التاريخ</th><th>المنطقة</th><th>الشدة</th><th>النوع</th><th>المدة</th><th>دواء مسجّل</th><th>محفزات ملاحظة</th><th>ملاحظات</th></tr></thead><tbody>${rows || '<tr><td colspan="8">لا توجد تسجيلات خلال الفترة المختارة.</td></tr>'}</tbody></table><footer>تم إنشاء هذا التقرير من بيانات محفوظة محليًا على الجهاز. لا تتم مزامنة السجل إلى خادم بواسطة ميزة التقرير.</footer><script>window.onload=()=>setTimeout(()=>window.print(),250)</script></body></html>`;
}

export function DoctorReport({ records }: Props) {
  const [busy, setBusy] = useState(false);
  const exportReport = async () => {
    if (!records.length) { Alert.alert('لا توجد بيانات', 'سجّل متابعة واحدة على الأقل لإنشاء التقرير.'); return; }
    setBusy(true);
    try {
      const html = reportHtml(records);
      if (Platform.OS === 'web') {
        const popup = window.open('', '_blank');
        if (!popup) { Alert.alert('تعذر فتح التقرير', 'اسمح للنوافذ المنبثقة لهذا الموقع ثم جرّب مرة أخرى.'); return; }
        popup.document.open(); popup.document.write(html); popup.document.close();
      } else {
        const file = await Print.printToFileAsync({ html, base64: false });
        if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'مشاركة ملخص سجل الألم' });
        else await Share.share({ message: 'تم إنشاء تقرير PDF لسجل الألم.' });
      }
    } catch {
      Alert.alert('تعذر إنشاء التقرير', 'حاول مرة أخرى. يمكنك أيضًا تصدير نسخة JSON من بياناتك.');
    } finally { setBusy(false); }
  };
  return <View style={styles.wrap}><Pressable onPress={exportReport} disabled={busy} accessibilityRole="button" style={[styles.button, busy && styles.disabled]}><Text style={styles.buttonText}>{busy ? 'جاري تجهيز التقرير…' : 'إنشاء تقرير للطبيب · PDF / طباعة'}</Text></Pressable><Text style={styles.caption}>يشمل التسجيلات الظاهرة في السجل، بما فيها الشدة والأدوية والمحفزات والملاحظات.</Text></View>;
}

const styles = StyleSheet.create({ wrap: { marginBottom: 12 }, button: { borderRadius: 12, padding: 14, backgroundColor: '#0B7774', alignItems: 'center' }, disabled: { opacity: 0.6 }, buttonText: { color: '#FFF', fontWeight: '900' }, caption: { color: '#75868A', fontSize: 10, lineHeight: 16, textAlign: 'right', marginTop: 6 } });
