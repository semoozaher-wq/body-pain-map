import React, { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../constants/colors';
import { Fonts } from '../constants/fonts';
import { Spacing, BorderRadius, Shadows } from '../constants/spacing';
import { Button } from '../components/Button';
import { QuickLogCard } from '../components/QuickLogCard';
import { ClinicalAnalysisPanel } from '../components/ClinicalAnalysisPanel';
import { useTheme } from '../hooks/useTheme';
import { translate } from '../services/i18n';
import type { Checkup } from '../types';

type Language = Parameters<typeof translate>[0];
interface WelcomeScreenProps {
  onStart: () => void;
  onQuickRelief: () => void;
  onOpenHistory: () => void;
  language: Language;
  direction: 'rtl' | 'ltr';
  quickAreas: { id: string; label: string }[];
  onQuickSave: (record: Checkup) => void;
  history: Checkup[];
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onStart, onQuickRelief, onOpenHistory, language, quickAreas, onQuickSave, history }) => {
  const { colors } = useTheme();
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const copy = language === 'en'
    ? { eyebrow: 'PAIN TRACKER · PRIVATE BY DESIGN', subtitle: 'Choose a spot, log what you feel, take a clearer summary to your clinician.', visual: 'Interactive anatomy', privacy: 'Your entries stay on this device. Export only when you choose.', history: 'Open your history', week: 'Last 7 days', entries: 'entries', average: 'average intensity', last: 'Last entry', empty: 'Your personal timeline starts with your first check-in.', noDiagnosis: 'Educational tracking only — not a diagnosis or emergency service.' }
    : language === 'fr'
      ? { eyebrow: 'SUIVI DE LA DOULEUR · CONFIDENTIEL', subtitle: 'Choisissez une zone, notez vos symptômes et préparez un résumé pour votre professionnel de santé.', visual: 'Carte anatomique interactive', privacy: 'Vos données restent sur cet appareil. Export uniquement à votre demande.', history: 'Voir mon historique', week: '7 derniers jours', entries: 'entrées', average: 'intensité moyenne', last: 'Dernière entrée', empty: 'Votre historique personnel commencera lors de votre première saisie.', noDiagnosis: 'Suivi éducatif uniquement — ni diagnostic ni service d’urgence.' }
      : { eyebrow: 'متابعة الألم · خصوصيتك أولًا', subtitle: 'حدد المنطقة، سجّل اللي حاسس بيه، وخُد ملخصًا أوضح لمناقشته مع الطبيب.', visual: 'خريطة تشريحية تفاعلية', privacy: 'تسجيلاتك على جهازك. التصدير بيتم باختيارك فقط.', history: 'افتح سجلك', week: 'آخر 7 أيام', entries: 'تسجيلات', average: 'متوسط الشدة', last: 'آخر تسجيل', empty: 'ابدأ أول تسجيل، والتطبيق هيساعدك تتابع التغيّر بمرور الوقت.', noDiagnosis: 'متابعة تعليمية فقط — مش تشخيص ولا خدمة طوارئ.' };
  const lastWeek = useMemo(() => history.filter((item) => !item.selfCareGuide && item.createdAtIso && Date.now() - new Date(item.createdAtIso).getTime() <= 7 * 24 * 60 * 60 * 1000), [history]);
  const average = lastWeek.length ? (lastWeek.reduce((sum, item) => sum + item.intensity, 0) / lastWeek.length).toFixed(1) : '—';
  const last = history.find((item) => !item.selfCareGuide);
  const lastLabel = last ? `${last.areaLabel ?? last.partId} · ${last.createdAt}` : copy.empty;

  return <View style={styles.container}>
    <View style={[styles.hero, { backgroundColor: colors.secondary }]}>
      <View style={styles.heroCopy}>
        <Text style={styles.eyebrow}>{copy.eyebrow}</Text>
        <Text style={styles.heroTitle}>{language === 'ar' ? 'افهم نمط ألمك. شارك ملخصًا أوضح.' : language === 'fr' ? 'Comprenez votre douleur. Partagez un résumé clair.' : 'See your pain pattern. Share a clearer summary.'}</Text>
        <Text style={styles.heroText}>{copy.subtitle}</Text>
        <View style={styles.heroBadges}><Text style={styles.badge}>317 {language === 'ar' ? 'منطقة' : language === 'fr' ? 'zones' : 'areas'}</Text><Text style={styles.badge}>23 {language === 'ar' ? 'مجموعة' : language === 'fr' ? 'groupes' : 'groups'}</Text><Text style={styles.badge}>{language === 'ar' ? 'محلي' : language === 'fr' ? 'local' : 'on-device'}</Text></View>
      </View>
      <View style={styles.heroImageFrame}><Image source={require('../assets/anatomy/muscle-front-atlas.png')} style={styles.heroImage} resizeMode="contain" accessibilityLabel={copy.visual} /><View style={styles.imageBadge}><Text style={styles.imageBadgeText}>✦ 3D</Text></View></View>
    </View>

    <View style={[styles.snapshot, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.snapshotHead}><View><Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{language === 'ar' ? 'ملخصك السريع' : language === 'fr' ? 'Votre aperçu' : 'Your quick snapshot'}</Text><Text style={[styles.sectionHint, { color: colors.textSecondary }]}>{copy.week}</Text></View><Pressable onPress={onOpenHistory} accessibilityRole="button"><Text style={styles.historyLink}>{copy.history} ←</Text></Pressable></View>
      <View style={styles.snapshotStats}>
        <View style={[styles.metric, { backgroundColor: colors.primaryLight }]}><Text style={[styles.metricValue, { color: colors.primaryDark }]}>{lastWeek.length}</Text><Text style={[styles.metricLabel, { color: colors.textSecondary }]}>{copy.entries}</Text></View>
        <View style={[styles.metric, { backgroundColor: colors.primaryLight }]}><Text style={[styles.metricValue, { color: colors.primaryDark }]}>{average}</Text><Text style={[styles.metricLabel, { color: colors.textSecondary }]}>{copy.average}</Text></View>
      </View>
      <Text style={[styles.lastEntry, { color: colors.textSecondary }]}>{copy.last}: {lastLabel}</Text>
      <Text style={[styles.snapshotNote, { color: colors.textLight }]}>{language === 'ar' ? 'ملخص وصفي فقط؛ لا يثبت سببًا ولا يشخّص حالة.' : language === 'fr' ? 'Résumé descriptif, sans établir de cause ni de diagnostic.' : 'Descriptive only; it does not establish a cause or diagnosis.'}</Text>
    </View>

    <View style={styles.actions}>
      <Button title={language === 'ar' ? 'افتح خريطة الجسم' : language === 'fr' ? 'Ouvrir la carte' : 'Open body map'} onPress={onStart} variant="primary" size="lg" style={styles.mainAction} />
      <Button title={language === 'ar' ? 'عناية ذاتية بسيطة' : language === 'fr' ? 'Autosoins simples' : 'Simple self-care'} onPress={onQuickRelief} variant="secondary" size="md" style={styles.secondaryAction} />
    </View>

    <QuickLogCard areas={quickAreas} onSave={onQuickSave} language={language} />

    <ClinicalAnalysisPanel />

    <View style={[styles.safetyCard, { backgroundColor: colors.warningLight, borderColor: colors.warning }]}>
      <Text style={[styles.safetyTitle, { color: colors.warning }]}>{t('medicalWarning')}</Text>
      <Text style={[styles.safetyText, { color: colors.textPrimary }]}>{t('welcome.warningText')}</Text>
    </View>
    <Text style={[styles.privacyNote, { color: colors.textSecondary }]}>🔒 {copy.privacy}</Text>
    <Text style={[styles.disclaimer, { color: colors.textLight }]}>{copy.noDiagnosis}</Text>
  </View>;
};

const styles = StyleSheet.create({
  container: { padding: Spacing.md, flex: 1, maxWidth: 760, width: '100%', alignSelf: 'center' },
  hero: { minHeight: 202, borderRadius: BorderRadius.xxl, padding: Spacing.lg, flexDirection: 'row-reverse', alignItems: 'center', overflow: 'hidden', ...Shadows.lg },
  heroCopy: { flex: 1, zIndex: 1 },
  eyebrow: { color: '#83D6C8', fontSize: 9, fontWeight: '900', textAlign: 'right', letterSpacing: 0.5 },
  heroTitle: { color: '#FFFFFF', fontSize: 22, lineHeight: 30, fontFamily: Fonts.arabic.bold, textAlign: 'right', marginTop: 8 },
  heroText: { color: '#D0E9E7', fontSize: 12, lineHeight: 19, fontFamily: Fonts.arabic.regular, textAlign: 'right', marginTop: 6 },
  heroBadges: { flexDirection: 'row-reverse', gap: 5, flexWrap: 'wrap', marginTop: 10 }, badge: { overflow: 'hidden', color: '#D8F2EC', backgroundColor: '#24545A', borderRadius: 9, paddingHorizontal: 7, paddingVertical: 5, fontSize: 9, fontWeight: '800' },
  heroImageFrame: { width: 92, height: 172, borderRadius: 16, backgroundColor: '#FFFFFF', overflow: 'hidden', marginLeft: 10, position: 'relative', borderWidth: 1, borderColor: 'rgba(255,255,255,0.32)' }, heroImage: { width: '100%', height: '100%' }, imageBadge: { position: 'absolute', top: 7, left: 6, backgroundColor: '#0B7774', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 4 }, imageBadgeText: { color: '#FFF', fontSize: 9, fontWeight: '900' },
  snapshot: { borderWidth: 1, borderRadius: BorderRadius.xl, padding: Spacing.md, marginTop: 12 }, snapshotHead: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' }, sectionTitle: { fontWeight: '900', textAlign: 'right', fontSize: 15 }, sectionHint: { textAlign: 'right', fontSize: 10, marginTop: 2 }, historyLink: { color: '#0B7774', fontSize: 11, fontWeight: '900' }, snapshotStats: { flexDirection: 'row-reverse', gap: 8, marginTop: 9 }, metric: { flex: 1, minHeight: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, metricValue: { fontSize: 17, fontWeight: '900' }, metricLabel: { fontSize: 10, marginTop: 1 }, lastEntry: { textAlign: 'right', fontSize: 10, lineHeight: 17, marginTop: 8 }, snapshotNote: { textAlign: 'right', fontSize: 9, lineHeight: 14, marginTop: 2 },
  actions: { gap: 8, marginTop: 11 }, mainAction: { marginTop: 2, borderRadius: 14 }, secondaryAction: { borderRadius: 14 },
  safetyCard: { borderRadius: 14, padding: 12, marginTop: 12, borderWidth: 1 }, safetyTitle: { fontFamily: Fonts.arabic.bold, fontSize: 13, textAlign: 'right', marginBottom: 3 }, safetyText: { fontFamily: Fonts.arabic.regular, fontSize: 11, lineHeight: 18, textAlign: 'right' },
  privacyNote: { fontSize: 10, lineHeight: 17, textAlign: 'center', marginTop: 10 }, disclaimer: { fontSize: 9, fontFamily: Fonts.arabic.regular, textAlign: 'center', marginTop: 4 }
});
