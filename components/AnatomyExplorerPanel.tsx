// components/AnatomyExplorerPanel.tsx
// مستكشف التشريح: منطقة أساسية → منطقة فرعية → بنية محددة → الأمراض المرتبطة بها (offline).
// يعرض نطاق الحجم التقديري لكل بنية، ويربط كل بنية بالأمراض التي تحمل taxonomy.structures مطابقًا.
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Language } from '../services/medical/diseaseLibrary';
import { localize } from '../services/medical/diseaseLibrary';
import {
  getSubRegions,
  getStructures,
  getConditionsByStructure,
  getTaxonomy,
  getTaxonomyNotice,
  getTaxonomyStats,
  localizePair,
  type AnatomicalStructure,
} from '../services/medical/regionTaxonomy';
import { Palette, Radii } from '../constants/design';

type Props = { language: Language; initialRegionId?: string };

const LABELS = {
  ar: {
    title: 'مستكشف التشريح',
    subtitle: 'من المنطقة إلى البنية الدقيقة ثم الأمراض المرتبطة بها',
    structure: 'البنية',
    conditions: 'الأمراض المرتبطة',
    noConditions: 'لا توجد أمراض مُربوطة بهذه البنية بعد.',
    stats: 'إحصاء التصنيف',
    mapped: 'بنية مُربوطة بأمراض',
    disclaimer: 'محتوى تعليمي عام فقط: لا تشخيص ولا علاج، ولا يغني عن الطبيب المؤهل.',
  },
  en: {
    title: 'Anatomy explorer',
    subtitle: 'From region to fine structure to its mapped conditions',
    structure: 'Structure',
    conditions: 'Mapped conditions',
    noConditions: 'No conditions mapped to this structure yet.',
    stats: 'Taxonomy stats',
    mapped: 'structures with mapped conditions',
    disclaimer: 'General education only: no diagnosis or treatment, and not a substitute for a clinician.',
  },
  fr: {
    title: 'Explorateur anatomique',
    subtitle: 'De la région à la structure fine puis aux affections associées',
    structure: 'Structure',
    conditions: 'Affections associées',
    noConditions: 'Aucune affection associée à cette structure pour le moment.',
    stats: 'Statistiques',
    mapped: 'structures avec affections associées',
    disclaimer: 'Contenu éducatif uniquement : ni diagnostic ni traitement, ne remplace pas un médecin.',
  },
} as const;

export function AnatomyExplorerPanel({ language, initialRegionId }: Props) {
  const t = LABELS[language] ?? LABELS.ar;
  const regions = useMemo(() => getTaxonomy(), []);
  const stats = useMemo(() => getTaxonomyStats(), []);
  const notice = useMemo(() => getTaxonomyNotice(language), [language]);

  const [regionId, setRegionId] = useState<string>(initialRegionId ?? regions[0]?.id ?? 'head_neck');
  const subRegions = useMemo(() => getSubRegions(regionId), [regionId]);
  const [subRegionId, setSubRegionId] = useState<string | null>(null);
  const activeSub = subRegions.find((s) => s.id === subRegionId) ?? subRegions[0] ?? null;
  const structures = useMemo(() => (activeSub ? getStructures(activeSub.id) : []), [activeSub]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t.title}</Text>
        <Text style={styles.subtitle}>{t.subtitle}</Text>
        <View style={styles.statsRow}>
          <Text style={styles.statChip}>{`${stats.regions} ↦ ${stats.subRegions} ↦ ${stats.structures}`}</Text>
          <Text style={styles.statChip}>{`${stats.mappedStructures} ${t.mapped}`}</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {regions.map((r) => {
          const active = r.id === regionId;
          return (
            <Pressable
              key={r.id}
              onPress={() => { setRegionId(r.id); setSubRegionId(null); }}
              style={[styles.tab, active && styles.tabActive]}
              accessibilityRole="button"
              accessibilityLabel={localizePair(r.label, language)}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {localizePair(r.label, language)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subTabs}>
        {subRegions.map((s) => {
          const active = s.id === activeSub?.id;
          return (
            <Pressable
              key={s.id}
              onPress={() => setSubRegionId(s.id)}
              style={[styles.subTab, active && styles.subTabActive]}
              accessibilityRole="button"
              accessibilityLabel={localizePair(s.label, language)}
            >
              <Text style={[styles.subTabText, active && styles.subTabTextActive]}>
                {localizePair(s.label, language)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {activeSub ? (
        <View style={styles.body}>
          <Text style={styles.icdHint}>{`ICD-10: ${activeSub.icdChapterHint}`}</Text>
          {structures.map((st: AnatomicalStructure) => {
            const conditions = getConditionsByStructure(st.id);
            return (
              <View key={st.id} style={styles.structureRow}>
                <View style={styles.structureHead}>
                  <Text style={styles.structureName}>{localizePair(st.label, language)}</Text>
                  <Text style={styles.typeChip}>{st.type}</Text>
                  <Text style={styles.bandChip}>
                    {language === 'ar' ? st.sizeBandLabel.ar : st.sizeBandLabel.en}
                  </Text>
                  <Text style={styles.countChip}>{conditions.length}</Text>
                </View>
                {conditions.length === 0 ? (
                  <Text style={styles.empty}>{t.noConditions}</Text>
                ) : (
                  conditions.map((c) => (
                    <Text key={c.id} style={styles.conditionLine}>
                      {`• ${localize(c.name, language)} — ICD-10: ${c.icd10}`}
                    </Text>
                  ))
                )}
              </View>
            );
          })}
        </View>
      ) : null}

      <Text style={styles.notice}>{notice}</Text>
      <Text style={styles.disclaimer}>{t.disclaimer}</Text>
    </View>
  );
}

export default AnatomyExplorerPanel;

const styles = StyleSheet.create({
  container: { gap: 10 },
  header: { gap: 4 },
  title: { fontSize: 20, fontWeight: '700', color: Palette.ink800 },
  subtitle: { fontSize: 13, color: Palette.slate500 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  statChip: {
    fontSize: 11, color: Palette.teal800, backgroundColor: Palette.teal100,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radii.sm, overflow: 'hidden',
  },
  tabs: { gap: 8, paddingVertical: 4 },
  tab: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radii.md,
    borderWidth: 1, borderColor: Palette.slate200, backgroundColor: Palette.white,
  },
  tabActive: { backgroundColor: Palette.teal600, borderColor: Palette.teal600 },
  tabText: { fontSize: 13, color: Palette.slate700 },
  tabTextActive: { color: Palette.white, fontWeight: '700' },
  subTabs: { gap: 6, paddingVertical: 2 },
  subTab: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radii.sm,
    backgroundColor: Palette.slate100,
  },
  subTabActive: { backgroundColor: Palette.teal200 },
  subTabText: { fontSize: 12, color: Palette.slate600 },
  subTabTextActive: { color: Palette.teal900, fontWeight: '700' },
  body: { gap: 8 },
  icdHint: { fontSize: 11, color: Palette.slate500 },
  structureRow: {
    borderWidth: 1, borderColor: Palette.teal100, borderRadius: Radii.md,
    padding: 10, backgroundColor: Palette.white, gap: 4,
  },
  structureHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  structureName: { fontSize: 14, fontWeight: '600', color: Palette.ink800 },
  typeChip: {
    fontSize: 10, color: Palette.violet, backgroundColor: Palette.slate100,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radii.sm, overflow: 'hidden',
  },
  bandChip: {
    fontSize: 10, color: Palette.slate600, backgroundColor: Palette.teal50,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radii.sm, overflow: 'hidden',
  },
  countChip: {
    fontSize: 10, color: Palette.white, backgroundColor: Palette.teal500,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radii.sm, overflow: 'hidden',
  },
  conditionLine: { fontSize: 12, color: Palette.slate700 },
  empty: { fontSize: 11, color: Palette.slate400, fontStyle: 'italic' },
  notice: { fontSize: 11, color: Palette.slate500 },
  disclaimer: { fontSize: 11, color: Palette.amber, fontWeight: '600' },
});
