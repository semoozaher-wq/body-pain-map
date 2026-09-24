import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';
import { Fonts } from '../constants/fonts';
import { Spacing, BorderRadius, Shadows } from '../constants/spacing';
import { Button } from '../components/Button';
import { useTheme } from '../hooks/useTheme';
import { translate } from '../services/i18n';

interface WelcomeScreenProps {
  onStart: () => void;
  onQuickRelief: () => void;
  language: Parameters<typeof translate>[0];
  direction: 'rtl' | 'ltr';
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onStart, onQuickRelief, language }) => {
  const { colors } = useTheme();
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);

  return (
    <View style={styles.container}>
      <View style={[styles.hero, { backgroundColor: colors.secondary }]}>
        <View style={[styles.heroOrb, { backgroundColor: colors.primary }]}>
          <Text style={styles.heroIcon}>✦</Text>
        </View>
        <Text style={styles.heroTitle}>{t('welcomeTitle')}</Text>
        <Text style={styles.heroText}>{t('welcomeText')}</Text>
        
        <View style={styles.statsRow}>
          <View style={[styles.stat, { backgroundColor: colors.primaryDark }]}>
            <Text style={styles.statValue}>317</Text>
            <Text style={styles.statLabel}>{t('welcome.statParts')}</Text>
          </View>
          <View style={[styles.stat, { backgroundColor: colors.primaryDark }]}>
            <Text style={styles.statValue}>23</Text>
            <Text style={styles.statLabel}>{t('welcome.statGroups')}</Text>
          </View>
          <View style={[styles.stat, { backgroundColor: colors.primaryDark }]}>
            <Text style={styles.statValue}>100%</Text>
            <Text style={styles.statLabel}>{t('welcome.statLocal')}</Text>
          </View>
        </View>
      </View>

      <View style={styles.quickGuide}>
        <Text style={[styles.quickGuideTitle, { color: colors.textPrimary }]}>ابدأ في 3 خطوات بسيطة</Text>
        <View style={styles.quickSteps}>
          <View style={[styles.quickStep, { backgroundColor: colors.surface }]}>
            <Text style={[styles.quickNumber, { color: colors.primary }]}>1</Text>
            <Text style={[styles.quickText, { color: colors.textSecondary }]}>اختر سطحي أو عميق</Text>
          </View>
          <View style={[styles.quickStep, { backgroundColor: colors.surface }]}>
            <Text style={[styles.quickNumber, { color: colors.primary }]}>2</Text>
            <Text style={[styles.quickText, { color: colors.textSecondary }]}>اضغط نقطة أو عضو</Text>
          </View>
          <View style={[styles.quickStep, { backgroundColor: colors.surface }]}>
            <Text style={[styles.quickNumber, { color: colors.primary }]}>3</Text>
            <Text style={[styles.quickText, { color: colors.textSecondary }]}>اقرأ الإرشاد</Text>
          </View>
        </View>
      </View>

      <View style={[styles.warningCard, { backgroundColor: colors.warningLight, borderColor: colors.warning }]}> 
        <Text style={[styles.warningTitle, { color: colors.warning }]}>{t('medicalWarning')}</Text>
        <Text style={[styles.warningText, { color: colors.textSecondary }]}>
          {t('welcome.warningText')}
        </Text>
      </View>

      <Button
        title={t('start')}
        onPress={onStart}
        variant="primary"
        size="lg"
        style={styles.ctaButton}
      />

      <Button
        title="عناية سريعة: الرقبة والظهر والساعد"
        onPress={onQuickRelief}
        variant="secondary"
        size="md"
        style={styles.quickButton}
      />

      <Text style={[styles.disclaimer, { color: colors.textLight }]}>
        {t('welcome.disclaimer')}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: Spacing.lg, flex: 1, justifyContent: 'center' },
  hero: { borderRadius: BorderRadius.xxl, padding: Spacing.xl, alignItems: 'center', ...Shadows.lg },
  heroOrb: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.lg },
  heroIcon: { color: '#FFFFFF', fontSize: 32, fontWeight: '900' },
  heroTitle: { color: '#FFFFFF', fontSize: Fonts.sizes.xxl, fontFamily: Fonts.arabic.bold, textAlign: 'center', marginBottom: Spacing.sm },
  heroText: { color: '#C4E4E3', fontSize: Fonts.sizes.md, fontFamily: Fonts.arabic.regular, textAlign: 'center', lineHeight: 24, marginBottom: Spacing.xl },
  statsRow: { flexDirection: 'row', gap: Spacing.sm, width: '100%' },
  stat: { flex: 1, borderRadius: BorderRadius.lg, paddingVertical: Spacing.md, alignItems: 'center' },
  statValue: { color: '#67E0D2', fontSize: Fonts.sizes.xl, fontFamily: Fonts.arabic.bold },
  statLabel: { color: '#B7D7D6', fontSize: Fonts.sizes.xs, fontFamily: Fonts.arabic.regular, marginTop: 2 },
  quickGuide: { marginTop: Spacing.lg },
  quickGuideTitle: { fontSize: Fonts.sizes.md, fontFamily: Fonts.arabic.bold, textAlign: 'right', marginBottom: Spacing.sm },
  quickSteps: { flexDirection: 'row-reverse', gap: Spacing.sm },
  quickStep: { flex: 1, borderRadius: BorderRadius.lg, padding: Spacing.sm, minHeight: 82, alignItems: 'center', justifyContent: 'center' },
  quickNumber: { fontSize: Fonts.sizes.lg, fontFamily: Fonts.arabic.bold },
  quickText: { fontSize: Fonts.sizes.xs, fontFamily: Fonts.arabic.regular, textAlign: 'center', lineHeight: 18, marginTop: 3 },
  warningCard: { borderRadius: BorderRadius.lg, padding: Spacing.lg, marginTop: Spacing.lg, borderWidth: 1 },
  warningTitle: { fontSize: Fonts.sizes.lg, fontFamily: Fonts.arabic.bold, marginBottom: Spacing.sm, textAlign: 'center' },
  warningText: { fontSize: Fonts.sizes.sm, fontFamily: Fonts.arabic.regular, lineHeight: 22, textAlign: 'center' },
  ctaButton: { marginTop: Spacing.lg },
  quickButton: { marginTop: Spacing.sm },
  disclaimer: { fontSize: Fonts.sizes.xs, fontFamily: Fonts.arabic.regular, textAlign: 'center', marginTop: Spacing.md }
});
