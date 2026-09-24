import React from 'react';
import { View, Text, StyleSheet, Share } from 'react-native';
import { Colors } from '../constants/colors';
import { Fonts } from '../constants/fonts';
import { Spacing, BorderRadius } from '../constants/spacing';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { useTheme } from '../hooks/useTheme';
import { Checkup, Group, Muscle } from '../types';
import { InteractiveTips } from '../components/InteractiveTips';
import { FirstAidCard } from '../components/FirstAidCard';
import { ReportExport } from '../components/ReportExport';
import { LocalAIChat } from '../components/LocalAIChat';
import { ImageAnalysisDemo } from '../components/ImageAnalysisDemo';
import { translate } from '../services/i18n';

interface ResultsScreenProps {
  selected: Muscle;
  group?: Group;
  intensity: number;
  painType: string;
  duration: string;
  note: string;
  redFlags: string[];
  history: Checkup[];
  onRestart: () => void;
  language: Parameters<typeof translate>[0];
  direction: 'rtl' | 'ltr';
}

export const ResultsScreen: React.FC<ResultsScreenProps> = ({
  selected, group, intensity, painType, duration, note, redFlags, onRestart, language
}) => {
  const { colors } = useTheme();
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const urgent = intensity >= 8 || redFlags.length > 0;
  const warning = selected.warning ?? group?.defaultWarning;
  const recommendation = selected.recommendation ?? group?.defaultRecommendation ?? 'استشر طبيبًا إذا استمر الألم أو ازداد.';

  const handleShare = async () => {
    await Share.share({
      message: `${t('appName')}\n${t('results.selectedPart')}: ${selected.labelAr}\n${t('results.intensity')}: ${intensity}/10\n${t('results.type')}: ${painType}\n${t('results.duration')}: ${duration}${note ? `\n${t('results.notes')}: ${note}` : ''}\n\n${t('results.shareDisclaimer')}`,
    });
  };

  return (
    <View style={styles.container}>
      <View style={[styles.summaryCard, { backgroundColor: colors.secondary }]}>
        <Text style={styles.summaryLabel}>{t('results.selectedPart')}</Text>
        <Text style={styles.summaryValue}>#{selected.partNumber} — {selected.labelAr}</Text>
        <Text style={styles.summaryLocation}>{selected.locationAr}</Text>
        <Text style={styles.summaryMeta}>
          {t('results.intensity')} {intensity}/10 · {t('results.type')}: {painType} · {t('results.duration')}: {duration}
        </Text>
        {note ? <Text style={styles.summaryNote}>{t('results.notes')}: {note}</Text> : null}
      </View>

      {urgent && (
        <View style={[styles.urgentCard, { backgroundColor: colors.dangerLight, borderColor: colors.danger }]}>
          <Text style={[styles.alertTitle, { color: colors.danger }]}>{t('results.urgentTitle')}</Text>
          <Text style={[styles.alertText, { color: colors.textPrimary }]}>{t('results.urgentText')}</Text>
        </View>
      )}

      {warning && (
        <Card style={styles.alertCard}>
          <Text style={[styles.alertTitle, { color: colors.danger }]}>{t('results.whenToSeekHelp')}</Text>
          <Text style={[styles.alertText, { color: colors.textSecondary }]}>{warning}</Text>
        </Card>
      )}

      <Card style={styles.infoCard}>
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{t('results.commonCauses')}</Text>
        {selected.commonCauses.map((cause) => (
          <Text key={cause} style={[styles.bullet, { color: colors.textSecondary }]}>• {cause}</Text>
        ))}
      </Card>

      <View style={[styles.recommendation, { backgroundColor: colors.successLight }]}> 
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{t('results.generalGuidance')}</Text>
        <Text style={[styles.infoText, { color: colors.textSecondary }]}>{recommendation}</Text>
      </View>

      <InteractiveTips groupKey={selected.group} groupLabel={group?.labelAr ?? selected.locationAr} intensity={intensity} urgent={urgent} />
      <FirstAidCard area={selected.locationAr} urgent={urgent} />
      <ReportExport
        title={selected.labelAr}
        location={selected.locationAr}
        intensity={intensity}
        painType={painType}
        duration={duration}
        causes={selected.commonCauses}
        warning={warning}
        recommendation={recommendation}
        note={note}
      />
      <LocalAIChat />
      <ImageAnalysisDemo />

      <Text style={[styles.disclaimer, { color: colors.textLight }]}>{selected.medicalSafety}</Text>

      <Button title={t('results.shareSummary')} onPress={handleShare} variant="secondary" />
      <Button title={t('results.newScan')} onPress={onRestart} style={styles.newScanButton} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: Spacing.lg },
  summaryCard: { borderRadius: BorderRadius.xl, padding: Spacing.xl, alignItems: 'center', marginBottom: Spacing.md },
  summaryLabel: { color: '#9ADBD5', fontFamily: Fonts.arabic.regular, fontSize: Fonts.sizes.sm },
  summaryValue: { color: '#FFFFFF', fontSize: Fonts.sizes.xxl, fontFamily: Fonts.arabic.bold, marginTop: Spacing.sm, textAlign: 'center' },
  summaryLocation: { color: '#BFE4E2', fontSize: Fonts.sizes.sm, fontFamily: Fonts.arabic.regular, marginTop: Spacing.sm, textAlign: 'center' },
  summaryMeta: { color: '#D6ECEA', marginTop: Spacing.sm, fontFamily: Fonts.arabic.medium, fontSize: Fonts.sizes.sm },
  summaryNote: { color: '#E4F5F2', marginTop: Spacing.sm, textAlign: 'center', fontFamily: Fonts.arabic.regular, fontSize: Fonts.sizes.sm },
  urgentCard: { borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.md, borderWidth: 2 },
  alertCard: { marginBottom: Spacing.md },
  alertTitle: { fontSize: Fonts.sizes.lg, fontFamily: Fonts.arabic.bold, textAlign: 'right', marginBottom: Spacing.sm },
  alertText: { textAlign: 'right', lineHeight: 23, fontFamily: Fonts.arabic.regular, fontSize: Fonts.sizes.sm },
  infoCard: { marginBottom: Spacing.md },
  cardTitle: { fontSize: Fonts.sizes.lg, fontFamily: Fonts.arabic.bold, textAlign: 'right', marginBottom: Spacing.md },
  bullet: { textAlign: 'right', lineHeight: 27, fontFamily: Fonts.arabic.regular, fontSize: Fonts.sizes.sm },
  recommendation: { borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.md },
  infoText: { textAlign: 'right', lineHeight: 23, fontFamily: Fonts.arabic.regular, fontSize: Fonts.sizes.sm },
  disclaimer: { textAlign: 'center', fontSize: Fonts.sizes.xs, fontFamily: Fonts.arabic.regular, lineHeight: 19, marginVertical: Spacing.md },
  newScanButton: { marginTop: Spacing.sm }
});
