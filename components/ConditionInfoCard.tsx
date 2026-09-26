// components/ConditionInfoCard.tsx
// بطاقة معلومات حالة مرضية: الاسم، الملخص، الأعراض (HPO)، علامات الخطر، ورابط MedlinePlus.
import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Language } from '../services/medical/diseaseLibrary';
import { localize, getSymptomsForCondition, type MedicalCondition } from '../services/medical/diseaseLibrary';

type Props = { condition: MedicalCondition; language: Language };

const LABELS = {
  ar: {
    symptoms: 'الأعراض المرتبطة (HPO)',
    redFlags: 'علامات تستوجب رعاية طبية عاجلة',
    codes: 'الأكواد المرجعية',
    readMore: 'اقرأ أكثر على MedlinePlus',
    source: 'المصدر',
  },
  en: {
    symptoms: 'Related symptoms (HPO)',
    redFlags: 'Signs that need urgent care',
    codes: 'Reference codes',
    readMore: 'Read more on MedlinePlus',
    source: 'Source',
  },
  fr: {
    symptoms: 'Symptômes liés (HPO)',
    redFlags: 'Signes nécessitant des soins urgents',
    codes: 'Codes de référence',
    readMore: 'En savoir plus sur MedlinePlus',
    source: 'Source',
  },
} as const;

export function ConditionInfoCard({ condition, language }: Props) {
  const t = LABELS[language] ?? LABELS.ar;
  const symptoms = getSymptomsForCondition(condition);
  const hasRedFlags = Boolean(condition.redFlags && (condition.redFlags.ar || condition.redFlags.en || condition.redFlags.fr));

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{localize(condition.name, language)}</Text>
      <Text style={styles.summary}>{localize(condition.summary, language)}</Text>

      <View style={styles.codesRow}>
        <Text style={styles.codeChip}>ICD-10: {condition.icd10}</Text>
        {condition.doid ? <Text style={styles.codeChip}>{condition.doid}</Text> : null}
      </View>

      {symptoms.length > 0 && (
        <View style={styles.block}>
          <Text style={styles.label}>{t.symptoms}</Text>
          {symptoms.map((s) => (
            <Text key={s.id} style={styles.body}>
              • {localize(s.name, language)} <Text style={styles.hpo}>({s.hpo})</Text>
            </Text>
          ))}
        </View>
      )}

      {hasRedFlags && (
        <View style={styles.redFlag}>
          <Text style={styles.redFlagTitle}>{t.redFlags}</Text>
          <Text style={styles.redFlagText}>{localize(condition.redFlags, language)}</Text>
        </View>
      )}

      {condition.medlinePlusUrl ? (
        <Pressable onPress={() => Linking.openURL(condition.medlinePlusUrl)} style={styles.source}>
          <Text style={styles.link}>↗ {t.readMore}</Text>
        </Pressable>
      ) : null}

      {condition.sources?.length > 0 && (
        <View style={styles.sources}>
          <Text style={styles.label}>{t.source}</Text>
          {condition.sources.map((s) => (
            <Pressable key={s.url} onPress={() => Linking.openURL(s.url)}>
              <Text style={styles.link}>↗ {s.title}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#D7E5E7', borderRadius: 16, padding: 14, marginBottom: 12 },
  title: { color: '#173D48', fontSize: 17, fontWeight: '900', textAlign: 'right' },
  summary: { color: '#344F57', lineHeight: 21, fontSize: 13, marginTop: 6, textAlign: 'right' },
  codesRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  codeChip: { backgroundColor: '#EAF8F5', color: '#0E6972', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, fontSize: 11, fontWeight: '800', overflow: 'hidden' },
  block: { marginTop: 12 },
  label: { color: '#0E6972', fontWeight: '900', fontSize: 12, textAlign: 'right' },
  body: { color: '#344F57', lineHeight: 20, fontSize: 13, marginTop: 3, textAlign: 'right' },
  hpo: { color: '#8A9AA0', fontSize: 11 },
  redFlag: { backgroundColor: '#FFF1F0', borderWidth: 1, borderColor: '#EBC3C0', borderRadius: 11, padding: 9, marginTop: 12 },
  redFlagTitle: { color: '#B23A32', fontWeight: '900', fontSize: 12, textAlign: 'right' },
  redFlagText: { color: '#7A2E28', lineHeight: 20, fontSize: 12, marginTop: 3, textAlign: 'right' },
  source: { borderTopWidth: 1, borderTopColor: '#E3ECEE', marginTop: 12, paddingTop: 8 },
  sources: { marginTop: 8 },
  link: { color: '#176F79', textAlign: 'right', lineHeight: 19, fontWeight: '800', textDecorationLine: 'underline', fontSize: 12, marginTop: 6 },
});
