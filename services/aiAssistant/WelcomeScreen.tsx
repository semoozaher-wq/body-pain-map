import React, { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Fonts } from '../constants/fonts';
import { Palette, Gradients, Radii, Elevation } from '../constants/design';
import { Button } from '../components/Button';
import { Gradient } from '../components/Gradient';
import { GlowOrb } from '../components/GlowOrb';
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
  onOpenAssistant: () => void;
  language: Language;
  direction: 'rtl' | 'ltr';
  quickAreas: { id: string; label: string }[];
  onQuickSave: (record: Checkup) => void;
  history: Checkup[];
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onStart, onQuickRelief, onOpenHistory, onOpenAssistant, language, direction, quickAreas, onQuickSave, history }) => {
  const { colors } = useTheme();
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const rtl = direction === 'rtl';
  const align = rtl ? 'right' : 'left';
  const row = rtl ? 'row-reverse' : 'row';

  const copy = language === 'en'
    ? { eyebrow: 'PAIN TRACKER · PRIVATE BY DESIGN', subtitle: 'Choose a spot, log what you feel, take a clearer summary to your clinician.', visual: 'Interactive anatomy', privacy: 'Your entries stay on this device. Export only when you choose.', history: 'Open your history', week: 'Last 7 days', entries: 'entries', average: 'average intensity', last: 'Last entry', empty: 'Your personal timeline starts with your first check-in.', noDiagnosis: 'Educational tracking only — not a diagnosis or emergency service.', f1: '317 mapped areas', f2: 'Trilingual AR · EN · FR', f3: 'No account needed' }
    : language === 'fr'
      ? { eyebrow: 'SUIVI DE LA DOULEUR · CONFIDENTIEL', subtitle: 'Choisissez une zone, notez vos symptômes et préparez un résumé pour votre professionnel de santé.', visual: 'Carte anatomique interactive', privacy: 'Vos données restent sur cet appareil. Export uniquement à votre demande.', history: 'Voir mon historique', week: '7 derniers jours', entries: 'entrées', average: 'intensité moyenne', last: 'Dernière entrée', empty: 'Votre historique personnel commencera lors de votre première saisie.', noDiagnosis: 'Suivi éducatif uniquement — ni diagnostic ni service d’urgence.', f1: '317 zones cartographiées', f2: 'Trilingue AR · EN · FR', f3: 'Sans compte' }
      : { eyebrow: 'متابعة الألم · خصوصيتك أولًا', subtitle: 'حدد المنطقة، سجّل اللي حاسس بيه، وخُد ملخصًا أوضح لمناقشته مع الطبيب.', visual: 'خريطة تشريحية تفاعلية', privacy: 'تسجيلاتك على جهازك. التصدير بيتم باختيارك فقط.', history: 'افتح سجلك', week: 'آخر 7 أيام', entries: 'تسجيلات', average: 'متوسط الشدة', last: 'آخر تسجيل', empty: 'ابدأ أول تسجيل، والتطبيق هيساعدك تتابع التغيّر بمرور الوقت.', noDiagnosis: 'متابعة تعليمية فقط — مش تشخيص ولا خدمة طوارئ.', f1: '317 منطقة مُحدّدة', f2: 'ثلاثي اللغة AR · EN · FR', f3: 'بدون حساب' };

  const lastWeek = useMemo(() => history.filter((item) => !item.selfCareGuide && item.createdAtIso && Date.now() - new Date(item.createdAtIso).getTime() <= 7 * 24 * 60 * 60 * 1000), [history]);
  const average = lastWeek.length ? (lastWeek.reduce((sum, item) => sum + item.intensity, 0) / lastWeek.length).toFixed(1) : '—';
  const last = history.find((item) => !item.selfCareGuide);
  const lastLabel = last ? `${last.areaLabel ?? last.partId} · ${last.createdAt}` : copy.empty;

  return <View style={styles.container}>
    {/* ── الهيرو ── */}
    <View style={styles.heroShell}>
      <Gradient colors={Gradients.heroDeep} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <GlowOrb size={280} color={Palette.teal400} opacity={0.55} style={{ top: -110, right: -70 }} />
      <GlowOrb size={220} color={Palette.cyan} opacity={0.35} style={{ bottom: -90, left: -60 }} />
      <GlowOrb size={160} color={Palette.mint} opacity={0.22} style={{ top: 40, left: 90 }} />

      <View style={[styles.heroRow, { flexDirection: row }]}>
        <View style={styles.heroCopy}>
          <View style={[styles.eyebrowRow, { flexDirection: row }]}>
            <View style={styles.liveDot} />
            <Text style={[styles.eyebrow, { textAlign: align }]}>{copy.eyebrow}</Text>
          </View>
          <Text style={[styles.heroTitle, { textAlign: align }]}>
            {language === 'ar' ? 'افهم نمط ألمك.\nشارك ملخصًا أوضح.' : language === 'fr' ? 'Comprenez votre douleur.\nPartagez un résumé clair.' : 'See your pain pattern.\nShare a clearer summary.'}
          </Text>
          <Text style={[styles.heroText, { textAlign: align }]}>{copy.subtitle}</Text>
          <View style={[styles.heroBadges, { flexDirection: row }]}>
            <Text style={styles.badge}>317 {language === 'ar' ? 'منطقة' : language === 'fr' ? 'zones' : 'areas'}</Text>
            <Text style={styles.badge}>23 {language === 'ar' ? 'مجموعة' : language === 'fr' ? 'groupes' : 'groups'}</Text>
            <Text style={styles.badge}>{language === 'ar' ? 'محلي' : language === 'fr' ? 'local' : 'on-device'}</Text>
          </View>
        </View>

        <View style={styles.heroImageFrame}>
          <Gradient colors={Gradients.glass} style={StyleSheet.absoluteFill} />
          <Image source={require('../assets/anatomy/muscle-front-atlas.png')} style={styles.heroImage} resizeMode="contain" accessibilityLabel={copy.visual} />
          <View style={styles.imageBadge}><Text style={styles.imageBadgeText}>✦ 3D</Text></View>
        </View>
      </View>

      <View style={[styles.featureRow, { flexDirection: row }]}>
        <Feature icon="◈" label={copy.f1} />
        <Feature icon="⌘" label={copy.f2} />
        <Feature icon="◉" label={copy.f3} />
      </View>
    </View>

    {/* ── الملخص السريع ── */}
    <View style={[styles.snapshot, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.snapshotHead, { flexDirection: row }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary, textAlign: align }]}>{language === 'ar' ? 'ملخصك السريع' : language === 'fr' ? 'Votre aperçu' : 'Your quick snapshot'}</Text>
          <Text style={[styles.sectionHint, { color: colors.textSecondary, textAlign: align }]}>{copy.week}</Text>
        </View>
        <Pressable onPress={onOpenHistory} accessibilityRole="button" style={styles.historyPill}>
          <Text style={styles.historyLink}>{copy.history} {rtl ? '←' : '→'}</Text>
        </Pressable>
      </View>
      <View style={[styles.snapshotStats, { flexDirection: row }]}>
        <StatCard value={String(lastWeek.length)} label={copy.entries} tint={Gradients.brand} icon="◷" />
        <StatCard value={average} label={copy.average} tint={Gradients.mint} icon="◔" />
      </View>
      <Text style={[styles.lastEntry, { color: colors.textSecondary, textAlign: align }]}>{copy.last}: {lastLabel}</Text>
      <Text style={[styles.snapshotNote, { color: colors.textLight, textAlign: align }]}>{language === 'ar' ? 'ملخص وصفي فقط؛ لا يثبت سببًا ولا يشخّص حالة.' : language === 'fr' ? 'Résumé descriptif, sans établir de cause ni de diagnostic.' : 'Descriptive only; it does not establish a cause or diagnosis.'}</Text>
    </View>

    {/* ── الإجراءات ── */}
    <View style={styles.actions}>
      <Button title={language === 'ar' ? 'افتح خريطة الجسم' : language === 'fr' ? 'Ouvrir la carte' : 'Open body map'} onPress={onStart} variant="primary" size="lg" style={styles.mainAction} />
      <Button title={language === 'ar' ? '✦ اسأل المساعد الذكي' : language === 'fr' ? '✦ Demander à l’assistant IA' : '✦ Ask the AI assistant'} onPress={onOpenAssistant} variant="secondary" size="md" style={styles.secondaryAction} />
      <Button title={language === 'ar' ? 'عناية ذاتية بسيطة' : language === 'fr' ? 'Autosoins simples' : 'Simple self-care'} onPress={onQuickRelief} variant="secondary" size="md" style={styles.secondaryAction} />
    </View>

    <QuickLogCard areas={quickAreas} onSave={onQuickSave} language={language} />

    <ClinicalAnalysisPanel />

    {/* ── تنبيه السلامة ── */}
    <View style={[styles.safetyCard, { backgroundColor: colors.warningLight, borderColor: colors.warning }]}>
      <View style={[styles.safetyHead, { flexDirection: row }]}>
        <View style={styles.safetyIcon}><Text style={styles.safetyIconText}>!</Text></View>
        <Text style={[styles.safetyTitle, { color: colors.warning, textAlign: align, flex: 1 }]}>{t('medicalWarning')}</Text>
      </View>
      <Text style={[styles.safetyText, { color: colors.textPrimary, textAlign: align }]}>{t('welcome.warningText')}</Text>
    </View>
    <Text style={[styles.privacyNote, { color: colors.textSecondary }]}>🔒 {copy.privacy}</Text>
    <Text style={[styles.disclaimer, { color: colors.textLight }]}>{copy.noDiagnosis}</Text>
  </View>;
};

function Feature({ icon, label }: { icon: string; label: string }) {
  return <View style={styles.feature}>
    <Text style={styles.featureIcon}>{icon}</Text>
    <Text style={styles.featureLabel} numberOfLines={1}>{label}</Text>
  </View>;
}

function StatCard({ value, label, tint, icon }: { value: string; label: string; tint: string[]; icon: string }) {
  return <View style={styles.statCard}>
    <Gradient colors={tint} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
    <View style={styles.statTop}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
    <Text style={styles.statLabel}>{label}</Text>
  </View>;
}

const styles = StyleSheet.create({
  container: { padding: 16, flex: 1, maxWidth: 760, width: '100%', alignSelf: 'center' },

  heroShell: { borderRadius: Radii.xxl, padding: 22, overflow: 'hidden', ...Elevation.xl },
  heroRow: { alignItems: 'center', gap: 14 },
  heroCopy: { flex: 1, zIndex: 2 },
  eyebrowRow: { alignItems: 'center', gap: 7 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Palette.mint },
  eyebrow: { color: Palette.teal200, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  heroTitle: { color: Palette.white, fontSize: 25, lineHeight: 33, fontFamily: Fonts.arabic.bold, fontWeight: '900', marginTop: 10, letterSpacing: -0.3 },
  heroText: { color: 'rgba(214,244,242,0.92)', fontSize: 13, lineHeight: 21, fontFamily: Fonts.arabic.regular, marginTop: 8 },
  heroBadges: { gap: 6, flexWrap: 'wrap', marginTop: 14 },
  badge: { overflow: 'hidden', color: Palette.white, backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', borderRadius: Radii.pill, paddingHorizontal: 10, paddingVertical: 6, fontSize: 10, fontWeight: '800' },

  heroImageFrame: { width: 104, height: 186, borderRadius: Radii.lg, overflow: 'hidden', position: 'relative', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', backgroundColor: 'rgba(255,255,255,0.9)', ...Elevation.lg },
  heroImage: { width: '100%', height: '100%' },
  imageBadge: { position: 'absolute', top: 8, left: 7, backgroundColor: Palette.teal700, borderRadius: Radii.pill, paddingHorizontal: 8, paddingVertical: 4 },
  imageBadgeText: { color: Palette.white, fontSize: 9, fontWeight: '900' },

  featureRow: { gap: 8, marginTop: 18, zIndex: 2 },
  feature: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', borderRadius: Radii.md, paddingHorizontal: 9, paddingVertical: 9 },
  featureIcon: { color: Palette.mint, fontSize: 13, fontWeight: '900' },
  featureLabel: { color: 'rgba(230,247,245,0.95)', fontSize: 9.5, fontWeight: '700', flex: 1 },

  snapshot: { borderWidth: 1, borderRadius: Radii.xl, padding: 16, marginTop: 14, ...Elevation.sm },
  snapshotHead: { alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  sectionTitle: { fontWeight: '900', fontSize: 16, letterSpacing: -0.2 },
  sectionHint: { fontSize: 10.5, marginTop: 2 },
  historyPill: { backgroundColor: Palette.teal50, borderWidth: 1, borderColor: Palette.teal100, borderRadius: Radii.pill, paddingHorizontal: 12, paddingVertical: 7 },
  historyLink: { color: Palette.teal700, fontSize: 11, fontWeight: '900' },
  snapshotStats: { gap: 10, marginTop: 12 },
  statCard: { flex: 1, minHeight: 78, borderRadius: Radii.lg, padding: 13, overflow: 'hidden', justifyContent: 'space-between', ...Elevation.sm },
  statTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statIcon: { color: 'rgba(255,255,255,0.85)', fontSize: 15, fontWeight: '900' },
  statValue: { color: Palette.white, fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  statLabel: { color: 'rgba(255,255,255,0.92)', fontSize: 10.5, fontWeight: '700', marginTop: 6 },
  lastEntry: { fontSize: 10.5, lineHeight: 17, marginTop: 11 },
  snapshotNote: { fontSize: 9.5, lineHeight: 14, marginTop: 3 },

  actions: { gap: 10, marginTop: 14 },
  mainAction: { borderRadius: Radii.lg },
  secondaryAction: { borderRadius: Radii.lg },

  safetyCard: { borderRadius: Radii.lg, padding: 14, marginTop: 14, borderWidth: 1 },
  safetyHead: { alignItems: 'center', gap: 8, marginBottom: 5 },
  safetyIcon: { width: 22, height: 22, borderRadius: 11, backgroundColor: Palette.amber, alignItems: 'center', justifyContent: 'center' },
  safetyIconText: { color: Palette.white, fontWeight: '900', fontSize: 13, lineHeight: 15 },
  safetyTitle: { fontFamily: Fonts.arabic.bold, fontSize: 13, fontWeight: '900' },
  safetyText: { fontFamily: Fonts.arabic.regular, fontSize: 11.5, lineHeight: 19 },
  privacyNote: { fontSize: 10.5, lineHeight: 17, textAlign: 'center', marginTop: 12 },
  disclaimer: { fontSize: 9.5, fontFamily: Fonts.arabic.regular, textAlign: 'center', marginTop: 4 },
});
