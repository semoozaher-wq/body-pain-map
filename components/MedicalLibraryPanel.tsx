// components/MedicalLibraryPanel.tsx
// لوحة المكتبة الطبية: تصفّح الأمراض حسب منطقة الجسم + بحث نصي (offline بالكامل).
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Language } from '../services/medical/diseaseLibrary';
import {
  getConditionsByRegion,
  searchMedicalLibrary,
  type MedicalCondition,
} from '../services/medical/diseaseLibrary';
import { ConditionInfoCard } from './ConditionInfoCard';

type Props = { language: Language; initialRegion?: string | null };

const REGIONS: { id: string; label: { ar: string; en: string; fr: string } }[] = [
  { id: 'head_neck', label: { ar: 'الرأس والرقبة', en: 'Head & neck', fr: 'Tête et cou' } },
  { id: 'back', label: { ar: 'الظهر', en: 'Back', fr: 'Dos' } },
  { id: 'torso_front', label: { ar: 'الجذع الأمامي', en: 'Front torso', fr: 'Torse avant' } },
  { id: 'upper_limb', label: { ar: 'الطرف العلوي', en: 'Upper limb', fr: 'Membre supérieur' } },
  { id: 'lower_limb', label: { ar: 'الطرف السفلي', en: 'Lower limb', fr: 'Membre inférieur' } },
];

const LABELS = {
  ar: { title: 'المكتبة الطبية', subtitle: 'أمراض وأعراض مرتبطة بمناطق الجسم (بدون إنترنت)', search: 'ابحث عن مرض أو عرض أو كود...', all: 'الكل', empty: 'لا توجد نتائج مطابقة.', disclaimer: 'محتوى تعليمي عام فقط، لا يقدّم تشخيصًا ولا علاجًا ولا يغني عن الطبيب المؤهل.' },
  en: { title: 'Medical library', subtitle: 'Conditions and symptoms by body region (offline)', search: 'Search a condition, symptom, or code...', all: 'All', empty: 'No matching results.', disclaimer: 'General educational content only; not a diagnosis or treatment, and not a substitute for a clinician.' },
  fr: { title: 'Bibliothèque médicale', subtitle: 'Affections et symptômes par région du corps (hors ligne)', search: 'Rechercher une affection, un symptôme ou un code...', all: 'Tout', empty: 'Aucun résultat.', disclaimer: 'Contenu éducatif général uniquement ; ni diagnostic ni traitement, ne remplace pas un médecin.' },
} as const;

export function MedicalLibraryPanel({ language, initialRegion }: Props) {
  const t = LABELS[language] ?? LABELS.ar;
  const [region, setRegion] = useState<string | null>(initialRegion ?? null);
  const [query, setQuery] = useState('');

  const conditions: MedicalCondition[] = useMemo(() => {
    if (query.trim()) return searchMedicalLibrary(query).conditions;
    if (region) return getConditionsByRegion(region);
    return getConditionsByRegion('back'); // افتراضي
  }, [region, query]);

  return (
    <View style={styles.container}>
      <View style={styles.disclaimer}>
        <Text style={styles.disclaimerTitle}>{t.title}</Text>
        <Text style={styles.disclaimerText}>{t.disclaimer}</Text>
      </View>

      <Text style={styles.subtitle}>{t.subtitle}</Text>

      <TextInput
        value={query}
        onChangeText={(v) => { setQuery(v); if (v) setRegion(null); }}
        placeholder={t.search}
        placeholderTextColor="#8A9AA0"
        style={styles.search}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        <Pressable onPress={() => { setRegion(null); setQuery(''); }} style={[styles.tab, region === null && !query && styles.tabActive]}>
          <Text style={[styles.tabText, region === null && !query && styles.tabTextActive]}>{t.all}</Text>
        </Pressable>
        {REGIONS.map((r) => (
          <Pressable key={r.id} onPress={() => { setRegion(r.id); setQuery(''); }} style={[styles.tab, region === r.id && styles.tabActive]}>
            <Text style={[styles.tabText, region === r.id && styles.tabTextActive]}>{r.label[language] ?? r.label.ar}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {conditions.length === 0 ? (
        <Text style={styles.empty}>{t.empty}</Text>
      ) : (
        conditions.map((c) => <ConditionInfoCard key={c.id} condition={c} language={language} />)
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 4 },
  disclaimer: { backgroundColor: '#EAF8F5', borderColor: '#B9DFD8', borderWidth: 1, borderRadius: 14, padding: 13, marginBottom: 12 },
  disclaimerTitle: { color: '#0E6972', fontWeight: '900', textAlign: 'right', fontSize: 16 },
  disclaimerText: { color: '#315B63', textAlign: 'right', lineHeight: 20, marginTop: 5, fontSize: 12 },
  subtitle: { color: '#173D48', fontSize: 15, fontWeight: '900', textAlign: 'right' },
  search: { borderWidth: 1, borderColor: '#D2E2E4', borderRadius: 11, padding: 10, marginTop: 10, textAlign: 'right', color: '#173D48', backgroundColor: '#FFF' },
  tabs: { flexDirection: 'row-reverse', gap: 8, paddingVertical: 10 },
  tab: { borderWidth: 1, borderColor: '#D2E2E4', borderRadius: 11, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#FFF' },
  tabActive: { backgroundColor: '#0E6972', borderColor: '#0E6972' },
  tabText: { color: '#315B63', fontWeight: '800', fontSize: 12 },
  tabTextActive: { color: '#FFF' },
  empty: { color: '#687A80', textAlign: 'right', marginTop: 14, fontSize: 13 },
});
