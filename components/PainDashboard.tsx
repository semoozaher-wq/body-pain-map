import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Checkup } from '../types';

type Range = 7 | 30 | 90;
type Props = { history: Checkup[]; language?: 'ar' | 'en' | 'fr' };
const DAY = 24 * 60 * 60 * 1000;

export function PainDashboard({ history, language = 'ar' }: Props) {
  const [range, setRange] = useState<Range>(7);
  const labels = language === 'en'
    ? { title: 'Your pain trends', range: (n: number) => `${n} days`, logs: 'Entries', avg: 'Average intensity', meds: 'Medication entries', triggers: 'Trigger entries', trend: 'Descriptive change', up: 'higher', down: 'lower', steady: 'stable', chart: 'Daily average intensity', disclosure: 'Descriptive summaries only; this does not identify causes or provide a diagnosis.' }
    : language === 'fr'
      ? { title: 'Évolution de la douleur', range: (n: number) => `${n} jours`, logs: 'Entrées', avg: 'Intensité moyenne', meds: 'Entrées de médicaments', triggers: 'Entrées de déclencheurs', trend: 'Évolution descriptive', up: 'en hausse', down: 'en baisse', steady: 'stable', chart: 'Intensité moyenne par jour', disclosure: 'Résumé descriptif uniquement ; il n’identifie pas les causes et ne fournit pas de diagnostic.' }
      : { title: 'اتجاهات الألم', range: (n: number) => `${n} يوم`, logs: 'تسجيلات', avg: 'متوسط الشدة', meds: 'تسجيلات الأدوية', triggers: 'تسجيلات المحفزات', trend: 'التغير الوصفي', up: 'أعلى', down: 'أقل', steady: 'مستقر', chart: 'متوسط الشدة لكل فترة', disclosure: 'ملخص وصفي فقط؛ لا يحدد أسباب الألم ولا يقدم تشخيصًا.' };

  const entries = useMemo(() => {
    const cutoff = Date.now() - range * DAY;
    return history.filter((item) => !item.selfCareGuide && (!item.createdAtIso || new Date(item.createdAtIso).getTime() >= cutoff));
  }, [history, range]);

  const average = entries.length ? entries.reduce((sum, item) => sum + item.intensity, 0) / entries.length : 0;
  const medicationCount = entries.filter((item) => item.medication?.trim()).length;
  const triggerCount = entries.filter((item) => item.triggers?.trim()).length;
  const unit = range === 7 ? DAY : 7 * DAY;
  const bins = useMemo(() => {
    const count = Math.ceil((range * DAY) / unit);
    const now = Date.now();
    return Array.from({ length: count }, (_, index) => {
      const end = now - (count - index - 1) * unit;
      const start = end - unit;
      const values = entries.filter((entry) => {
        const time = entry.createdAtIso ? new Date(entry.createdAtIso).getTime() : 0;
        return time >= start && time < end;
      });
      const value = values.length ? values.reduce((sum, item) => sum + item.intensity, 0) / values.length : 0;
      const date = new Date(end);
      return { label: range === 7 ? new Intl.DateTimeFormat(language, { weekday: 'short' }).format(date) : new Intl.DateTimeFormat(language, { month: 'numeric', day: 'numeric' }).format(date), value, count: values.length };
    });
  }, [entries, language, range, unit]);

  const midpoint = Math.floor(entries.length / 2);
  const oldHalf = entries.slice(midpoint);
  const newHalf = entries.slice(0, midpoint);
  const oldAverage = oldHalf.length ? oldHalf.reduce((sum, item) => sum + item.intensity, 0) / oldHalf.length : null;
  const newAverage = newHalf.length ? newHalf.reduce((sum, item) => sum + item.intensity, 0) / newHalf.length : null;
  const changeText = oldAverage === null || newAverage === null
    ? '—'
    : newAverage - oldAverage > 0.5 ? labels.up : oldAverage - newAverage > 0.5 ? labels.down : labels.steady;

  return (
    <View style={styles.card}>
      <View style={styles.head}><View style={styles.badge}><Text style={styles.badgeText}>◔</Text></View><Text style={styles.title}>{labels.title}</Text></View>
      <View style={styles.ranges}>
        {([7, 30, 90] as Range[]).map((days) => <Pressable key={days} onPress={() => setRange(days)} accessibilityRole="button" accessibilityState={{ selected: range === days }} style={[styles.range, range === days && styles.rangeActive]}><Text style={[styles.rangeText, range === days && styles.rangeTextActive]}>{labels.range(days)}</Text></Pressable>)}
      </View>
      <View style={styles.stats}>
        <Stat label={labels.logs} value={String(entries.length)} />
        <Stat label={labels.avg} value={entries.length ? `${average.toFixed(1)}/10` : '—'} />
        <Stat label={labels.trend} value={changeText} />
      </View>
      <Text style={styles.chartTitle}>{labels.chart}</Text>
      <View style={styles.chart} accessibilityLabel={labels.chart}>
        {bins.map((bin, index) => <View key={`${bin.label}-${index}`} style={styles.barItem} accessibilityLabel={`${bin.label}: ${bin.value.toFixed(1)} / 10`}>
          <Text style={styles.barValue}>{bin.count ? bin.value.toFixed(0) : ''}</Text>
          <View style={styles.barTrack}><View style={[styles.bar, { height: bin.count ? Math.max(5, bin.value * 7) : 3, opacity: bin.count ? 1 : 0.2 }]} /></View>
          <Text style={styles.barLabel}>{bin.label}</Text>
        </View>)}
      </View>
      <View style={styles.footerStats}><Text style={styles.footerText}>{labels.meds}: {medicationCount}</Text><Text style={styles.footerText}>{labels.triggers}: {triggerCount}</Text></View>
      <Text style={styles.disclosure}>{labels.disclosure}</Text>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1, borderColor: '#DDE9E9', padding: 16, marginBottom: 14, shadowColor: '#163C42', shadowOpacity: 0.05, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  head: { flexDirection: 'row-reverse', alignItems: 'center', gap: 9 },
  badge: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#DFF5F0', alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#087F78', fontSize: 20, fontWeight: '900' },
  title: { flex: 1, color: '#143B43', fontSize: 17, fontWeight: '900', textAlign: 'right' },
  ranges: { flexDirection: 'row-reverse', gap: 7, marginTop: 14 },
  range: { paddingHorizontal: 13, paddingVertical: 7, borderRadius: 18, borderWidth: 1, borderColor: '#D7E3E4', backgroundColor: '#F8FBFB' },
  rangeActive: { backgroundColor: '#0B7774', borderColor: '#0B7774' },
  rangeText: { color: '#52676D', fontSize: 12, fontWeight: '700' },
  rangeTextActive: { color: '#FFFFFF' },
  stats: { flexDirection: 'row-reverse', gap: 8, marginTop: 12 },
  stat: { flex: 1, backgroundColor: '#F1F8F7', borderRadius: 13, padding: 10, minHeight: 66, justifyContent: 'center' },
  statValue: { color: '#0B7774', textAlign: 'center', fontSize: 18, fontWeight: '900' },
  statLabel: { color: '#657A7D', textAlign: 'center', fontSize: 10, marginTop: 3 },
  chartTitle: { color: '#3B565C', textAlign: 'right', fontWeight: '800', marginTop: 16, fontSize: 12 },
  chart: { height: 116, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', gap: 3, borderBottomWidth: 1, borderColor: '#DDE8E8', paddingTop: 10 },
  barItem: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end', minWidth: 13 },
  barValue: { fontSize: 9, color: '#527176', height: 12 },
  barTrack: { height: 78, justifyContent: 'flex-end', width: '65%', minWidth: 8, alignItems: 'center' },
  bar: { width: '100%', borderTopLeftRadius: 5, borderTopRightRadius: 5, backgroundColor: '#17A99B' },
  barLabel: { color: '#71858A', fontSize: 8, marginTop: 4, height: 14, textAlign: 'center' },
  footerStats: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 11 },
  footerText: { color: '#52676D', fontSize: 11 },
  disclosure: { color: '#839396', textAlign: 'center', fontSize: 10, lineHeight: 16, marginTop: 10 },
});
