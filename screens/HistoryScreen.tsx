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

const data = anatomyMap as unknown as AnatomyData;

interface HistoryScreenProps {
  history: Checkup[];
  onBack: () => void;
  onClear: () => void;
}

export const HistoryScreen: React.FC<HistoryScreenProps> = ({ history, onBack, onClear }) => {
  const { colors } = useTheme();
  const average = history.length
    ? (history.reduce((sum, item) => sum + item.intensity, 0) / history.length).toFixed(1)
    : '—';

  return (
    <View style={styles.container}>
      <Text style={[styles.helper, { color: colors.textSecondary }]}>
        الفحوصات محفوظة على هذا الجهاز فقط. لا تُرفع إلى خادم.
      </Text>

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

      {/* History List */}
      {history.length === 0 ? (
        <Card>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>لا توجد فحوصات محفوظة</Text>
        </Card>
      ) : (
        history.map((item) => (
          <Card key={item.id} style={styles.historyCard}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
              #{data.muscles[item.partId]?.partNumber} — {data.muscles[item.partId]?.labelAr ?? item.partId}
            </Text>
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              {item.createdAt} · شدة {item.intensity}/10 · {item.painType}
            </Text>
            {item.note ? <Text style={[styles.note, { color: colors.textSecondary }]}>{item.note}</Text> : null}
            {item.urgent && <Text style={[styles.urgentText, { color: colors.danger }]}>يتطلب انتباهًا طبيًا</Text>}
          </Card>
        ))
      )}

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
