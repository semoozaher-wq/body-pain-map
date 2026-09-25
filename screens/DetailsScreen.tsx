import React from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';
import { Fonts } from '../constants/fonts';
import { Spacing, BorderRadius } from '../constants/spacing';
import { Button } from '../components/Button';
import { Accordion } from '../components/Accordion';
import { useTheme } from '../hooks/useTheme';
import { PAIN_TYPES, DURATIONS, RED_FLAGS } from '../constants/appConstants';
import { translate } from '../services/i18n';
import { getTriageStatus } from '../services/triage.js';

interface DetailsScreenProps {
  intensity: number;
  setIntensity: (v: number) => void;
  painType: string;
  setPainType: (v: string) => void;
  duration: string;
  setDuration: (v: string) => void;
  note: string;
  setNote: (v: string) => void;
  medication: string;
  setMedication: (v: string) => void;
  triggers: string;
  setTriggers: (v: string) => void;
  sleepHours: string;
  setSleepHours: (v: string) => void;
  activity: string;
  setActivity: (v: string) => void;
  redFlags: string[];
  setRedFlags: (v: string[]) => void;
  symptoms: string[];
  setSymptoms: (v: string[]) => void;
  afterIntensity: string;
  setAfterIntensity: (v: string) => void;
  onBack: () => void;
  onNext: () => void;
  language: Parameters<typeof translate>[0];
  direction: 'rtl' | 'ltr';
  contextWarning?: string | null;
}

export const DetailsScreen: React.FC<DetailsScreenProps> = ({
  intensity, setIntensity, painType, setPainType, duration, setDuration,
  note, setNote, medication, setMedication, triggers, setTriggers, sleepHours, setSleepHours, activity, setActivity,
  redFlags, setRedFlags, symptoms, setSymptoms, afterIntensity, setAfterIntensity, onBack, onNext, language, contextWarning
}) => {
  const { colors } = useTheme();
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const triageStatus = getTriageStatus(intensity, redFlags);
  const urgent = triageStatus === 'urgent';
  const highReportedIntensity = triageStatus === 'high_reported_intensity';
  const redFlagLabels = language === 'en'
    ? ['Shortness of breath or crushing chest pain', 'Fainting or severe confusion', 'Sudden weakness or difficulty speaking', 'Serious injury or bleeding']
    : language === 'fr'
      ? ['Essoufflement ou douleur thoracique oppressive', 'Évanouissement ou confusion sévère', 'Faiblesse soudaine ou difficulté à parler', 'Blessure grave ou saignement']
      : RED_FLAGS;

  const toggleFlag = (flag: string) => {
    setRedFlags(redFlags.includes(flag) ? redFlags.filter((f) => f !== flag) : [...redFlags, flag]);
  };
  const symptomLabels = language === 'en' ? ['Nausea', 'Fatigue', 'Stiffness', 'Swelling', 'Numbness', 'Weakness', 'Fever'] : language === 'fr' ? ['Nausée', 'Fatigue', 'Raideur', 'Gonflement', 'Engourdissement', 'Faiblesse', 'Fièvre'] : ['غثيان', 'إرهاق', 'تيبّس', 'تورّم', 'تنميل', 'ضعف', 'حمّى'];
  const toggleSymptom = (symptom: string) => setSymptoms(symptoms.includes(symptom) ? symptoms.filter((item) => item !== symptom) : [...symptoms, symptom]);

  return (
    <View style={styles.container}>
      {urgent && (
        <View style={[styles.triageAlert, { backgroundColor: colors.dangerLight, borderColor: colors.danger }]}>
          <Text style={[styles.triageTitle, { color: colors.danger }]}>{t('details.urgentFlagTitle')}</Text>
          <Text style={[styles.triageText, { color: colors.textPrimary }]}>{contextWarning ? `${contextWarning} ` : ''}{t('details.urgentFlagText')}</Text>
        </View>
      )}
      {highReportedIntensity && (
        <View style={[styles.triageAlert, { backgroundColor: colors.warningLight, borderColor: colors.warning }]}>
          <Text style={[styles.triageTitle, { color: colors.warning }]}>{t('details.highIntensityTitle')}</Text>
          <Text style={[styles.triageText, { color: colors.textPrimary }]}>{t('details.highIntensityText')}</Text>
        </View>
      )}
      <Accordion title={t('details.redFlagsTitle')} icon="⚠️" isWarning defaultOpen>
        <Text style={[styles.hint, { color: colors.danger }]}>{t('details.redFlagsHint')}</Text>
        <View style={styles.flagList}>
          {RED_FLAGS.map((flag, index) => (
            <Pressable key={flag} onPress={() => toggleFlag(flag)} style={[styles.flagRow, { backgroundColor: redFlags.includes(flag) ? colors.dangerLight : colors.backgroundAlt, borderColor: redFlags.includes(flag) ? colors.danger : colors.border }]} accessibilityRole="checkbox" accessibilityState={{ checked: redFlags.includes(flag) }}>
              <Text style={[styles.flagCheck, { color: colors.danger }]}>{redFlags.includes(flag) ? '✓' : '○'}</Text>
              <Text style={[styles.flagText, { color: colors.textPrimary }]}>{redFlagLabels[index]}</Text>
            </Pressable>
          ))}
        </View>
      </Accordion>
      <Accordion title={language === 'ar' ? 'الأعراض المصاحبة' : language === 'fr' ? 'Symptômes associés' : 'Associated symptoms'} icon="＋">
        <View style={styles.chips}>
          {symptomLabels.map((symptom) => <Pressable key={symptom} onPress={() => toggleSymptom(symptom)} accessibilityRole="checkbox" accessibilityState={{ checked: symptoms.includes(symptom) }} style={[styles.chip, { backgroundColor: symptoms.includes(symptom) ? colors.primaryLight : colors.surface, borderColor: symptoms.includes(symptom) ? colors.primary : colors.border }]}><Text style={[styles.chipText, { color: symptoms.includes(symptom) ? colors.primaryDark : colors.textSecondary }]}>{symptom}</Text></Pressable>)}
        </View>
      </Accordion>

      <Accordion title={t('details.intensityTitle')} icon="📊" defaultOpen>
        <Text style={[styles.question, { color: colors.textPrimary }]}>{t('details.intensityQuestion')}</Text>
        <View style={styles.scale}>
          {Array.from({ length: 11 }, (_, n) => (
            <Pressable
              key={n}
              onPress={() => setIntensity(n)}
              style={[styles.scaleDot, { backgroundColor: n <= intensity ? colors.primary : colors.borderLight }]}
            >
              <Text style={[styles.scaleText, { color: n <= intensity ? '#FFF' : colors.textSecondary }]}>{n}</Text>
            </Pressable>
          ))}
        </View>
      </Accordion>

      <Accordion title={t('details.painTypeTitle')} icon="⚡">
        <View style={styles.chips}>
          {PAIN_TYPES.map((type) => (
            <Chip key={type} label={type} active={type === painType} onPress={() => setPainType(type)} colors={colors} />
          ))}
        </View>
      </Accordion>

      <Accordion title={t('details.durationTitle')} icon="⏱️">
        <View style={styles.chips}>
          {DURATIONS.map((d) => (
            <Chip key={d} label={d} active={d === duration} onPress={() => setDuration(d)} colors={colors} />
          ))}
        </View>
      </Accordion>

      <Accordion title={t('details.notesTitle')} icon="📝">
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder={t('details.notesPlaceholder')}
          placeholderTextColor={colors.textLight}
          multiline
          maxLength={500}
          style={[styles.noteInput, { color: colors.textPrimary, backgroundColor: colors.backgroundAlt, borderColor: colors.border }]}
          textAlign="right"
        />
        <Text style={[styles.charHint, { color: colors.textLight }]}>{note.length}/500</Text>
      </Accordion>

      <Accordion title={language === 'ar' ? 'التحسّن بعد رعاية أو دواء' : language === 'fr' ? 'Après soin ou traitement' : 'Change after care or medication'} icon="↗">
        <Text style={[styles.hint, { color: colors.textSecondary }]}>{language === 'ar' ? 'اختياري: سجّل شدة الألم بعد الرعاية/الدواء للمقارنة لاحقًا (0–10).' : language === 'fr' ? 'Facultatif : notez l’intensité après un soin/traitement (0–10).' : 'Optional: record pain intensity after care/medication for later comparison (0–10).'}</Text>
        <TextInput value={afterIntensity} onChangeText={(v) => { const n = Number(v.replace(/[^0-9]/g, '').slice(0, 2)); setAfterIntensity(v === '' ? '' : String(Math.min(10, n))); }} placeholder={language === 'ar' ? 'الشدة بعد الرعاية، 0–10' : language === 'fr' ? 'Intensité après soin, 0–10' : 'Intensity after care, 0–10'} keyboardType="number-pad" maxLength={2} style={[styles.contextInput, { color: colors.textPrimary, backgroundColor: colors.backgroundAlt, borderColor: colors.border }]} textAlign="right" />
        <Text style={[styles.hint, { color: colors.textSecondary, marginTop: Spacing.md }]}>{t('details.contextHint')}</Text>
        <TextInput value={medication} onChangeText={setMedication} placeholder={t('details.medicationPlaceholder')} maxLength={180} style={[styles.contextInput, { color: colors.textPrimary, backgroundColor: colors.backgroundAlt, borderColor: colors.border }]} textAlign="right" />
        <TextInput value={triggers} onChangeText={setTriggers} placeholder={t('details.triggersPlaceholder')} maxLength={180} style={[styles.contextInput, { color: colors.textPrimary, backgroundColor: colors.backgroundAlt, borderColor: colors.border }]} textAlign="right" />
        <TextInput value={sleepHours} onChangeText={(v) => setSleepHours(v.replace(/[^0-9.]/g, '').slice(0, 4))} placeholder={t('details.sleepPlaceholder')} keyboardType="decimal-pad" maxLength={4} style={[styles.contextInput, { color: colors.textPrimary, backgroundColor: colors.backgroundAlt, borderColor: colors.border }]} textAlign="right" />
        <TextInput value={activity} onChangeText={setActivity} placeholder={t('details.activityPlaceholder')} maxLength={160} style={[styles.contextInput, { color: colors.textPrimary, backgroundColor: colors.backgroundAlt, borderColor: colors.border }]} textAlign="right" />
      </Accordion>

      <View style={styles.actions}>
        <Button title={t('back')} onPress={onBack} variant="secondary" style={styles.actionButton} />
        <Button title={t('details.showGuidance')} onPress={onNext} style={styles.actionButton} />
      </View>
    </View>
  );
};

const Chip = ({ label, active, onPress, colors }: any) => (
  <Pressable
    onPress={onPress}
    style={[styles.chip, { backgroundColor: active ? colors.primaryLight : colors.surface, borderColor: active ? colors.primary : colors.border }]}
  >
    <Text style={[styles.chipText, { color: active ? colors.primaryDark : colors.textSecondary }]}>{label}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  container: { padding: Spacing.lg },
  triageAlert: { borderRadius: BorderRadius.lg, borderWidth: 2, padding: Spacing.lg, marginBottom: Spacing.md },
  triageTitle: { fontFamily: Fonts.arabic.bold, fontSize: Fonts.sizes.lg, textAlign: 'right', marginBottom: Spacing.sm },
  triageText: { fontFamily: Fonts.arabic.regular, fontSize: Fonts.sizes.sm, lineHeight: 23, textAlign: 'right' },
  question: { fontFamily: Fonts.arabic.bold, fontSize: Fonts.sizes.md, marginBottom: Spacing.md },
  scale: { flexDirection: 'row-reverse', justifyContent: 'space-between', flexWrap: 'wrap', gap: Spacing.xs },
  scaleDot: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  scaleText: { fontSize: Fonts.sizes.xs, fontFamily: Fonts.arabic.bold },
  chips: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: Spacing.sm },
  chip: { borderRadius: BorderRadius.md, borderWidth: 1, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md },
  chipText: { fontFamily: Fonts.arabic.bold, fontSize: Fonts.sizes.sm },
  hint: { fontFamily: Fonts.arabic.regular, fontSize: Fonts.sizes.sm, marginBottom: Spacing.md, textAlign: 'right' },
  flagList: { gap: Spacing.sm },
  flagRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1 },
  flagCheck: { fontSize: 20, fontWeight: '900' },
  flagText: { flex: 1, textAlign: 'right', fontFamily: Fonts.arabic.medium, fontSize: Fonts.sizes.sm },
  noteInput: { minHeight: 90, borderRadius: BorderRadius.md, padding: Spacing.md, borderWidth: 1, fontFamily: Fonts.arabic.regular, fontSize: Fonts.sizes.md, textAlignVertical: 'top' },
  contextInput: { borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.md, marginTop: Spacing.sm, fontFamily: Fonts.arabic.regular, fontSize: Fonts.sizes.sm, minHeight: 46 },
  charHint: { fontSize: Fonts.sizes.xs, textAlign: 'right', marginTop: Spacing.xs },
  actions: { flexDirection: 'row-reverse', gap: Spacing.sm, marginTop: Spacing.lg },
  actionButton: { flex: 1 }
});
