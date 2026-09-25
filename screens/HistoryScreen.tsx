// screens/HistoryScreen.tsx

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';
import { Fonts } from '../constants/fonts';
import { Spacing, BorderRadius } from '../constants/spacing';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { useTheme } from '../hooks/useTheme';
import { Checkup } from '../types';
import anatomyMap from '../data/anatomyPainMap.json';
import { AnatomyData } from '../types';
import { LocalReminder } from '../components/LocalReminder';
import { PainDashboard } from '../components/PainDashboard';
import { DoctorReport } from '../components/DoctorReport';
import { LocalDataTools } from '../components/LocalDataTools';
import type { Language } from '../services/i18n';

const data = anatomyMap as unknown as AnatomyData;

interface HistoryScreenProps {
  history: Checkup[];
  onBack: () => void;
  onClear: () => void;
  onImport: (records: Checkup[]) => void;
  language: Language;
}

export const HistoryScreen: React.FC<HistoryScreenProps> = ({ history, onBack, onClear, onImport, language }) => {
  const { colors } = useTheme();
  const average = history.length
    ? (history.reduce((sum, item) => sum + item.intensity, 0) / history.length).toFixed(1)
    : '—';
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recent = history.filter((item) => !item.createdAtIso || new Date(item.createdAtIso).getTime() >= weekAgo);
  const areaCounts = recent.reduce<Record<string, number>>((counts, item) => {
    const label = item.selfCareGuide ?? item.areaLabel ?? data.muscles[item.partId]?.groupLabelAr ?? data.muscles[item.partId]?.labelAr ?? 'منطقة أخرى';
    counts[label] = (counts[label] ?? 0) + 1;
    return counts;
  }, {});
  const topArea = Object.entries(areaCounts).sort((a, b) => b[1] - a[1])[0];

  return (
    <View style={styles.container}>
      <Text style={[styles.helper, { color: colors.textSecondary }]}>
        السجل محفوظ على الجهاز. استخدم التصدير لمشاركة نسخة بنفسك؛ لا نرفع بياناتك تلقائيًا.
      </Text>
      <PainDashboard history={history} language={language} />
      <DoctorReport records={history} language={language} />
      <LocalDataTools records={history} onImport={onImport} />

      {/* Stats */}
      {history.length > 0 && (
        <View style={styles.statsRow}>
          <View style={[styles.miniStat, { backgroundColor: colors.primaryLight }]}>
            <Text style={[styles.miniValue, { color: colors.primary }]}>{history.length}</Text>
            <Text style={[styles.miniLabel, { color: colors.textSecondary }]}>فحص</Text>
          </View>
          <View style={[styles.miniStat, { backgroundColor: colors.primaryLight }]}>
            <Text style={[styles.miniValue, { color: colors.primary }]}>{average}</Text>
            <Text style={[styles.miniLabel, { color: colors.textSecondary }]}>متوسط الشدة</Text>
          </View>
          <View style={[styles.miniStat, { backgroundColor: colors.dangerLight }]}>
            <Text style={[styles.miniValue, { color: colors.danger }]}>
              {history.filter((item) => item.urgent).length}
            </Text>
            <Text style={[styles.miniLabel, { color: colors.textSecondary }]}>تنبيه</Text>
          </View>
        </View>
      )}

      {history.length > 0 && (
        <Card style={styles.analyticsCard}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>ملخص آخر 7 أيام</Text>
          <Text style={[styles.analyticsText, { color: colors.textSecondary }]}>سجلت {recent.length} متابعة، ومتوسط الشدة العام {average}/10.</Text>
          {topArea && <Text style={[styles.analyticsText, { color: colors.primary }]}>المنطقة الأكثر تكرارًا: {topArea[0]} ({topArea[1]} مرات).</Text>}
          <Text style={[styles.analyticsAdvice, { color: colors.textSecondary }]}>اقتراح: خذ فواصل حركة قصيرة كل ساعة، وراقب ما إذا كان الألم يتحسن مع الراحة والحركة اللطيفة.</Text>
        </Card>
      )}

      {/* History List */}
      {history.length === 0 ? (
        <Card>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>لا توجد فحوصات محفوظة</Text>
        </Card>
      ) : (
        history.map((item) => (
          <Card key={item.id} style={styles.historyCard}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
              {item.selfCareGuide ? `خطة تخفيف ذاتي — ${item.selfCareGuide}` : item.areaLabel ?? `#${data.muscles[item.partId]?.partNumber} — ${data.muscles[item.partId]?.labelAr ?? item.partId}`}
            </Text>
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              {item.createdAt} · شدة {item.intensity}/10 · {item.painType}
            </Text>
            {item.note ? <Text style={[styles.note, { color: colors.textSecondary }]}>{item.note}</Text> : null}
            {item.medication ? <Text style={[styles.note, { color: colors.textSecondary }]}>دواء مسجّل: {item.medication}</Text> : null}
            {item.triggers ? <Text style={[styles.note, { color: colors.textSecondary }]}>محفزات ملاحظة: {item.triggers}</Text> : null}
            {item.symptoms?.length ? <Text style={[styles.note, { color: colors.textSecondary }]}>الأعراض المسجلة: {item.symptoms.join(' • ')}</Text> : null}
            {item.redFlags?.length ? <Text accessibilityRole="alert" style={[styles.urgentText, { color: colors.danger }]}>علامات إنذار: {item.redFlags.join(' • ')}</Text> : null}
            {item.sleepHours !== undefined ? <Text style={[styles.note, { color: colors.textSecondary }]}>النوم المسجل: {item.sleepHours} ساعة</Text> : null}
            {item.activity ? <Text style={[styles.note, { color: colors.textSecondary }]}>النشاط المسجل: {item.activity}</Text> : null}
            {item.afterIntensity !== undefined && <Text style={[styles.note, { color: colors.primary }]}>قبل {item.intensity}/10 ← بعد {item.afterIntensity}/10</Text>}
            {item.triageStatus === 'high_reported_intensity' && <Text style={[styles.note, { color: colors.warning }]}>شدة مرتفعة مُبلّغ عنها؛ الرقم وحده لا يحدد سبب الألم أو خطورته.</Text>}
            {item.urgent && <Text accessibilityRole="alert" style={[styles.urgentText, { color: colors.danger }]}>علامة إنذار مُسجّلة — اتبع إرشادات الطوارئ المحلية؛ التطبيق لا يشخّص الحالة.</Text>}
          </Card>
        ))
      )}

      <LocalReminder />

      {/* Actions */}
      {history.length > 0 && (
        <Button title="حذف السجل بالكامل" onPress={onClear} variant="secondary" />
      )}
      <Button title="رجوع" onPress={onBack} variant="secondary" style={styles.backButton} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
  },
  helper: {
    fontFamily: Fonts.arabic.regular,
    fontSize: Fonts.sizes.sm,
    textAlign: 'right',
    marginBottom: Spacing.md,
  },
  statsRow: {
    flexDirection: 'row-reverse',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  miniStat: {
    flex: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
  },
  miniValue: {
    fontSize: Fonts.sizes.xl,
    fontFamily: Fonts.arabic.bold,
  },
  miniLabel: {
    fontSize: Fonts.sizes.xs,
    fontFamily: Fonts.arabic.regular,
    marginTop: Spacing.xs,
  },
  emptyText: {
    textAlign: 'center',
    fontFamily: Fonts.arabic.regular,
    fontSize: Fonts.sizes.md,
  },
  historyCard: {
    marginBottom: Spacing.sm,
  },
  analyticsCard: { marginBottom: Spacing.md, borderWidth: 1, borderColor: '#CFE4E5' },
  analyticsText: { textAlign: 'right', fontFamily: Fonts.arabic.regular, fontSize: Fonts.sizes.sm, lineHeight: 22, marginBottom: Spacing.xs },
  analyticsAdvice: { textAlign: 'right', fontFamily: Fonts.arabic.regular, fontSize: Fonts.sizes.xs, lineHeight: 20, marginTop: Spacing.xs },
  cardTitle: {
    fontSize: Fonts.sizes.md,
    fontFamily: Fonts.arabic.bold,
    textAlign: 'right',
    marginBottom: Spacing.xs,
  },
  infoText: {
    textAlign: 'right',
    fontFamily: Fonts.arabic.regular,
    fontSize: Fonts.sizes.sm,
  },
  note: {
    textAlign: 'right',
    marginTop: Spacing.xs,
    fontFamily: Fonts.arabic.regular,
    fontSize: Fonts.sizes.sm,
  },
  urgentText: {
    textAlign: 'right',
    fontFamily: Fonts.arabic.bold,
    fontSize: Fonts.sizes.sm,
    marginTop: Spacing.xs,
  },
  backButton: {
    marginTop: Spacing.sm,
  },
});
