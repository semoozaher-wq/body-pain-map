import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Checkup } from '../types';
import { getTriageStatus } from '../services/triage.js';

type Area = { id: string; label: string };
type Props = { areas: Area[]; onSave: (record: Checkup) => void; language?: 'ar' | 'en' | 'fr' };

export function QuickLogCard({ areas, onSave, language = 'ar' }: Props) {
  const copy = language === 'en' ? {
    title: 'Log pain in under a minute', subtitle: 'A quick personal record, without the full check-in', expand: 'Start a quick log', collapse: 'Close quick log', area: 'Pain location', intensity: 'Intensity from 0 to 10', type: 'Pain quality', medicine: 'Medication or treatment (optional)', triggers: 'Possible trigger (optional)', save: 'Save quick entry', saved: '✓ Entry saved', disclaimer: 'Personal tracking only; this is not a diagnosis.', severe: 'For severe or sudden pain, trouble breathing, or fainting, seek urgent help. A number alone cannot identify the cause or seriousness.', kinds: ['Ongoing', 'Intermittent', 'Pressure', 'Burning', 'Tingling'], areas: areas,
  } : language === 'fr' ? {
    title: 'Notez votre douleur en moins d’une minute', subtitle: 'Une note personnelle rapide, sans questionnaire complet', expand: 'Commencer une note rapide', collapse: 'Fermer la saisie rapide', area: 'Zone douloureuse', intensity: 'Intensité de 0 à 10', type: 'Type de douleur', medicine: 'Médicament ou traitement (facultatif)', triggers: 'Déclencheur possible (facultatif)', save: 'Enregistrer', saved: '✓ Entrée enregistrée', disclaimer: 'Suivi personnel uniquement ; ceci n’est pas un diagnostic.', severe: 'En cas de douleur sévère ou soudaine, de difficulté à respirer ou de malaise, demandez une aide urgente. Un chiffre seul ne détermine ni la cause ni la gravité.', kinds: ['Continue', 'Intermittente', 'Pression', 'Brûlure', 'Picotement'], areas: areas,
  } : {
    title: 'سجّل الألم في أقل من دقيقة', subtitle: 'تسجيل شخصي سريع من غير فحص طويل', expand: 'ابدأ تسجيل سريع', collapse: 'اقفل التسجيل السريع', area: 'مكان الألم', intensity: 'الشدة من 0 إلى 10', type: 'نوع الإحساس', medicine: 'دواء/علاج استخدمته (اختياري)', triggers: 'محفّز محتمل (اختياري)', save: 'حفظ التسجيل السريع', saved: '✓ تم تسجيل المتابعة', disclaimer: 'المعلومات دي سجل شخصي للملاحظة وليست تشخيصًا طبيًا.', severe: 'لو الألم شديد أو مفاجئ أو معاه ضيق نفس أو إغماء، اطلب مساعدة طبية عاجلة. الرقم وحده لا يحدد السبب أو درجة الخطورة.', kinds: ['مستمر', 'متقطع', 'ضغط', 'حرقان', 'وخز'], areas: areas,
  };
  const PAIN_TYPES = copy.kinds;

  const [areaId, setAreaId] = useState(areas[0]?.id ?? '');
  const [intensity, setIntensity] = useState(4);
  const [painType, setPainType] = useState(copy.kinds[0]);
  const [medication, setMedication] = useState('');
  const [triggers, setTriggers] = useState('');
  const [saved, setSaved] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const save = () => {
    if (!areaId) return;
    const now = new Date();
    const triageStatus = getTriageStatus(intensity, []);
    onSave({
      id: `quick-${now.getTime()}-${Math.random().toString(36).slice(2, 7)}`,
      partId: areaId,
      areaLabel: areas.find((area) => area.id === areaId)?.label ?? 'منطقة جسم',
      intensity,
      painType,
      duration: language === 'en' ? 'Not specified' : language === 'fr' ? 'Non précisée' : 'لم يُحدّد',
      medication: medication.trim(),
      triggers: triggers.trim(),
      createdAt: now.toLocaleDateString(language === 'en' ? 'en' : language === 'fr' ? 'fr-FR' : 'ar-EG'),
      createdAtIso: now.toISOString(),
      urgent: false,
      triageStatus,
      note: language === 'en' ? 'Quick log' : language === 'fr' ? 'Note rapide' : 'تسجيل سريع',
    });
    setSaved(true);
    setMedication(''); setTriggers('');
  };

  return <View style={styles.card}>
    <Pressable onPress={() => setExpanded((value) => !value)} accessibilityRole="button" accessibilityState={{ expanded }} style={styles.heading}><View style={styles.icon}><Text style={styles.iconText}>{expanded ? '−' : '＋'}</Text></View><View style={styles.headingCopy}><Text style={styles.title}>{copy.title}</Text><Text style={styles.subtitle}>{copy.subtitle}</Text></View><Text style={styles.expandText}>{expanded ? copy.collapse : copy.expand}</Text></Pressable>
    {expanded ? <>
    <Text style={styles.label}>{copy.area}</Text>
    <View style={styles.row}>{areas.map((area) => <Pressable key={area.id} onPress={() => { setAreaId(area.id); setSaved(false); }} accessibilityRole="button" accessibilityState={{ selected: areaId === area.id }} style={[styles.chip, areaId === area.id && styles.activeChip]}><Text style={[styles.chipText, areaId === area.id && styles.activeChipText]}>{area.label}</Text></Pressable>)}</View>
    <Text style={styles.label}>{copy.intensity}</Text>
    <View style={styles.scale}>{Array.from({ length: 11 }, (_, score) => <Pressable key={score} onPress={() => { setIntensity(score); setSaved(false); }} accessibilityRole="button" accessibilityLabel={`${copy.intensity} ${score}/10`} accessibilityState={{ selected: intensity === score }} style={[styles.score, intensity === score && styles.scoreActive]}><Text style={[styles.scoreText, intensity === score && styles.scoreTextActive]}>{score}</Text></Pressable>)}</View>
    <Text style={styles.label}>{copy.type}</Text>
    <View style={styles.row}>{PAIN_TYPES.map((kind) => <Pressable key={kind} onPress={() => { setPainType(kind); setSaved(false); }} accessibilityRole="button" accessibilityState={{ selected: painType === kind }} style={[styles.chip, painType === kind && styles.activeChip]}><Text style={[styles.chipText, painType === kind && styles.activeChipText]}>{kind}</Text></Pressable>)}</View>
    <View style={styles.optionalRow}><TextInput value={medication} onChangeText={(v) => { setMedication(v); setSaved(false); }} placeholder={copy.medicine} placeholderTextColor="#87989C" style={styles.optionalInput} textAlign="right" maxLength={100} /><TextInput value={triggers} onChangeText={(v) => { setTriggers(v); setSaved(false); }} placeholder={copy.triggers} placeholderTextColor="#87989C" style={styles.optionalInput} textAlign="right" maxLength={100} /></View>
    <Pressable onPress={save} accessibilityRole="button" style={styles.save}><Text style={styles.saveText}>{saved ? copy.saved : copy.save}</Text></Pressable>
    {intensity >= 8 ? <Text style={styles.alert}>{copy.severe}</Text> : <Text style={styles.disclaimer}>{copy.disclaimer}</Text>}
    </> : <Text style={styles.collapsedHint}>{copy.disclaimer}</Text>}
  </View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderColor: '#DCE9E8', borderWidth: 1, borderRadius: 22, padding: 16, marginTop: 14, shadowColor: '#17464A', shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  heading: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, marginBottom: 2 },
  expandText: { color: '#0B7774', fontSize: 10, fontWeight: '900', maxWidth: 82, textAlign: 'center' },
  collapsedHint: { color: '#718488', fontSize: 10, lineHeight: 16, textAlign: 'right', marginTop: 8 },
  icon: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#DFF5EF', alignItems: 'center', justifyContent: 'center' },
  iconText: { color: '#087E75', fontSize: 24, fontWeight: '900' },
  headingCopy: { flex: 1 },
  title: { color: '#143A40', fontWeight: '900', fontSize: 16, textAlign: 'right' },
  subtitle: { color: '#718488', fontSize: 10, textAlign: 'right', marginTop: 3 },
  label: { color: '#3E585D', textAlign: 'right', fontSize: 12, fontWeight: '800', marginTop: 9, marginBottom: 6 },
  row: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6 },
  chip: { backgroundColor: '#F6FAF9', borderColor: '#D7E4E3', borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 18 },
  activeChip: { backgroundColor: '#0B7774', borderColor: '#0B7774' },
  chipText: { color: '#486167', fontSize: 11, fontWeight: '700' },
  activeChipText: { color: '#FFF' },
  scale: { flexDirection: 'row-reverse', justifyContent: 'space-between', gap: 3 },
  score: { width: 27, height: 30, borderRadius: 9, borderWidth: 1, borderColor: '#D7E3E4', backgroundColor: '#F8FBFB', alignItems: 'center', justifyContent: 'center' },
  scoreActive: { backgroundColor: '#0B7774', borderColor: '#0B7774' },
  scoreText: { color: '#52676A', fontWeight: '800', fontSize: 11 },
  scoreTextActive: { color: '#FFF' },
  optionalRow: { gap: 7, marginTop: 10 },
  optionalInput: { minHeight: 42, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#DCE7E6', backgroundColor: '#FBFDFD', color: '#183B41', fontSize: 11 },
  save: { minHeight: 46, borderRadius: 13, backgroundColor: '#0B7774', alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  saveText: { color: '#FFF', fontWeight: '900', fontSize: 13 },
  alert: { marginTop: 9, color: '#8A3737', backgroundColor: '#FFF3F1', borderRadius: 9, padding: 9, textAlign: 'right', lineHeight: 18, fontSize: 10 },
  disclaimer: { color: '#87979A', textAlign: 'center', fontSize: 10, lineHeight: 15, marginTop: 8 },
});
