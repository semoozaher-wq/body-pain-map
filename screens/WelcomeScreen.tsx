// screens/WelcomeScreen.tsx

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';
import { Fonts } from '../constants/fonts';
import { Spacing, BorderRadius, Shadows } from '../constants/spacing';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { useTheme } from '../hooks/useTheme';
import { translate } from '../services/i18n';

interface WelcomeScreenProps {
  onStart: () => void;
  language: Parameters<typeof translate>[0];
  direction: 'rtl' | 'ltr';
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onStart, language, direction }) => {
  const { colors } = useTheme();
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);

  return (
    <View style={styles.container}>
      {/* Hero Section */}
      <View style={[styles.hero, { backgroundColor: colors.secondary }]}>
        <View style={[styles.heroOrb, { backgroundColor: colors.primary }]}>
          <Text style={styles.heroIcon}>✦</Text>
        </View>
        <Text style={styles.heroTitle}>{t('welcomeTitle')}</Text>
        <Text style={styles.heroText}>{t('welcomeText')}</Text>
        
        <View style={styles.statsRow}>
          <View style={[styles.stat, { backgroundColor: colors.primaryDark }]}>
            <Text style={styles.statValue}>317</Text>
            <Text style={styles.statLabel}>جزءًا</Text>
          </View>
          <View style={[styles.stat, { backgroundColor: colors.primaryDark }]}>
            <Text style={styles.statValue}>23</Text>
            <Text style={styles.statLabel}>مجموعة</Text>
          </View>
          <View style={[styles.stat, { backgroundColor: colors.primaryDark }]}>
            <Text style={styles.statValue}>100%</Text>
            <Text style={styles.statLabel}>محلي</Text>
          </View>
        </View>
      </View>

      {/* Medical Warning */}
      <View style={[styles.warningCard, { backgroundColor: colors.warningLight, borderColor: colors.warning }]}>
        <Text style={[styles.warningTitle, { color: colors.warning }]}>تنبيه طبي مهم</Text>
        <Text style={[styles.warningText, { color: colors.textSecondary }]}>
          التطبيق تعليمي ولا يقدم تشخيصًا. عند ألم شديد أو مفاجئ، أو ضيق نفس أو إغماء، اطلب المساعدة العاجلة.
        </Text>
      </View>

      {/* CTA Button */}
      <Button
        title="أوافق وأبدأ"
        onPress={onStart}
        variant="primary"
        size="lg"
        style={styles.ctaButton}
      />

      <Text style={[styles.disclaimer, { color: colors.textLight }]}>
        المعلومات عامة ولا تغني عن استشارة طبيب مؤهل.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
  },
  hero: {
    borderRadius: BorderRadius.xxl,
    padding: Spacing.xl,
    alignItems: 'center',
    ...Shadows.lg,
  },
  heroOrb: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  heroIcon: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '900',
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: Fonts.sizes.xxl,
    fontFamily: Fonts.arabic.bold,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  heroText: {
    color: '#C4E4E3',
    fontSize: Fonts.sizes.md,
    fontFamily: Fonts.arabic.regular,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: Spacing.xl,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    width: '100%',
  },
  stat: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  statValue: {
    color: '#67E0D2',
    fontSize: Fonts.sizes.xl,
    fontFamily: Fonts.arabic.bold,
  },
  statLabel: {
    color: '#B7D7D6',
    fontSize: Fonts.sizes.xs,
    fontFamily: Fonts.arabic.regular,
    marginTop: 2,
  },
  warningCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginTop: Spacing.lg,
    borderWidth: 1,
  },
  warningTitle: {
    fontSize: Fonts.sizes.lg,
    fontFamily: Fonts.arabic.bold,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  warningText: {
    fontSize: Fonts.sizes.sm,
    fontFamily: Fonts.arabic.regular,
    lineHeight: 22,
    textAlign: 'center',
  },
  ctaButton: {
    marginTop: Spacing.lg,
  },
  disclaimer: {
    fontSize: Fonts.sizes.xs,
    fontFamily: Fonts.arabic.regular,
    textAlign: 'center',
    marginTop: Spacing.md,
  },
});
