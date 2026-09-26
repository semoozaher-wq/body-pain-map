// components/DrugLookupPanel.tsx
// لوحة البحث عن الأدوية: RxNorm (توحيد الأسماء) + openFDA (الملصق والتحذيرات).
// ملاحظة: النتائج مرجعية تعليمية فقط، وليست توصية أو وصفة.
import React, { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Language } from '../services/medical/diseaseLibrary';
import { useDrugLookup } from '../hooks/useDrugLookup';

type Props = { language: Language };

const LABELS = {
  ar: {
    title: 'البحث عن دواء',
    disclaimer: 'نتائج مرجعية تعليمية من RxNorm/openFDA فقط، وليست توصية أو وصفة. استشر الصيدلي أو الطبيب قبل أي دواء.',
    search: 'اكتب اسم الدواء (تجاري أو فعّال)...',
    searchBtn: 'ابحث',
    results: 'النتائج',
    noResults: 'لا توجد نتائج، تأكد من الاسم أو اتصالك بالإنترنت.',
    label: 'ملصق الدواء (openFDA)',
    indications: 'دواعي الاستخدام',
    warnings: 'تحذيرات',
    adverse: 'أحداث جانبية',
    dosage: 'الجرعة',
    interactions: 'تفاعلات دوائية',
    contraindications: 'موانع الاستخدام',
    source: 'المصدر',
    loading: 'جارٍ التحميل...',
  },
  en: {
    title: 'Drug lookup',
    disclaimer: 'Reference-only results from RxNorm/openFDA; not a recommendation or prescription. Consult a pharmacist or clinician.',
    search: 'Type a drug name (brand or generic)...',
    searchBtn: 'Search',
    results: 'Results',
    noResults: 'No results; check the name or your connection.',
    label: 'Drug label (openFDA)',
    indications: 'Indications',
    warnings: 'Warnings',
    adverse: 'Adverse reactions',
    dosage: 'Dosage',
    interactions: 'Drug interactions',
    contraindications: 'Contraindications',
    source: 'Source',
    loading: 'Loading...',
  },
  fr: {
    title: 'Recherche de médicament',
    disclaimer: 'Résultats de référence RxNorm/openFDA uniquement ; ni recommandation ni ordonnance. Consultez un pharmacien ou un médecin.',
    search: 'Saisir un nom de médicament (marque ou générique)...',
    searchBtn: 'Rechercher',
    results: 'Résultats',
    noResults: 'Aucun résultat ; vérifiez le nom ou la connexion.',
    label: 'Notice du médicament (openFDA)',
    indications: 'Indications',
    warnings: 'Avertissements',
    adverse: 'Effets indésirables',
    dosage: 'Posologie',
    interactions: 'Interactions médicamenteuses',
    contraindications: 'Contre-indications',
    source: 'Source',
    loading: 'Chargement...',
  },
} as const;

export function DrugLookupPanel({ language }: Props) {
  const t = LABELS[language] ?? LABELS.ar;
  const [query, setQuery] = useState('');
  const { loading, error, results, selected, label, search, select } = useDrugLookup();

  return (
    <View style={styles.container}>
      <View style={styles.disclaimer}>
        <Text style={styles.disclaimerTitle}>{t.title}</Text>
        <Text style={styles.disclaimerText}>{t.disclaimer}</Text>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t.search}
          placeholderTextColor="#8A9AA0"
          style={styles.search}
          onSubmitEditing={() => search(query)}
        />
        <Pressable onPress={() => search(query)} style={styles.searchBtn}>
          <Text style={styles.searchBtnText}>{t.searchBtn}</Text>
        </Pressable>
      </View>

      {loading && <ActivityIndicator color="#0E6972" style={{ marginTop: 12 }} />}

      {!loading && error === 'no_results' && <Text style={styles.empty}>{t.noResults}</Text>}

      {results.length > 0 && (
        <View style={styles.block}>
          <Text style={styles.label}>{t.results}</Text>
          <ScrollView style={{ maxHeight: 220 }}>
            {results.slice(0, 20).map((r) => (
              <Pressable key={r.rxcui} onPress={() => select(r)} style={[styles.resultItem, selected?.rxcui === r.rxcui && styles.resultItemActive]}>
                <Text style={styles.resultName}>{r.name}</Text>
                <Text style={styles.resultMeta}>RxCUI {r.rxcui}{r.tty ? ` · ${r.tty}` : ''}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {label && (
        <View style={styles.block}>
          <Text style={styles.label}>{t.label}</Text>
          {label.brandName || label.genericName ? (
            <Text style={styles.drugTitle}>{label.brandName ?? label.genericName}</Text>
          ) : null}
          {label.manufacturer ? <Text style={styles.resultMeta}>{label.manufacturer}</Text> : null}
          <Field title={t.indications} value={label.indications} />
          <Field title={t.warnings} value={label.warnings} danger />
          <Field title={t.contraindications} value={label.contraindications} danger />
          <Field title={t.adverse} value={label.adverseReactions} />
          <Field title={t.interactions} value={label.interactions} />
          <Field title={t.dosage} value={label.dosage} />
          <Pressable onPress={() => Linking.openURL('https://open.fda.gov/')}>
            <Text style={styles.link}>↗ {t.source}: openFDA</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function Field({ title, value, danger }: { title: string; value?: string; danger?: boolean }) {
  if (!value) return null;
  return (
    <View style={[styles.field, danger && styles.fieldDanger]}>
      <Text style={[styles.fieldTitle, danger && styles.fieldTitleDanger]}>{title}</Text>
      <Text style={styles.fieldBody}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 4 },
  disclaimer: { backgroundColor: '#EAF8F5', borderColor: '#B9DFD8', borderWidth: 1, borderRadius: 14, padding: 13, marginBottom: 12 },
  disclaimerTitle: { color: '#0E6972', fontWeight: '900', textAlign: 'right', fontSize: 16 },
  disclaimerText: { color: '#315B63', textAlign: 'right', lineHeight: 20, marginTop: 5, fontSize: 12 },
  searchRow: { flexDirection: 'row-reverse', gap: 8, alignItems: 'center' },
  search: { flex: 1, borderWidth: 1, borderColor: '#D2E2E4', borderRadius: 11, padding: 10, textAlign: 'right', color: '#173D48', backgroundColor: '#FFF' },
  searchBtn: { backgroundColor: '#0E6972', borderRadius: 11, paddingHorizontal: 16, paddingVertical: 11 },
  searchBtnText: { color: '#FFF', fontWeight: '900', fontSize: 13 },
  empty: { color: '#687A80', textAlign: 'right', marginTop: 14, fontSize: 13 },
  block: { marginTop: 14, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#D7E5E7', borderRadius: 16, padding: 14 },
  label: { color: '#0E6972', fontWeight: '900', fontSize: 13, textAlign: 'right' },
  resultItem: { borderWidth: 1, borderColor: '#E3ECEE', borderRadius: 10, padding: 10, marginTop: 8 },
  resultItemActive: { borderColor: '#0E6972', backgroundColor: '#EAF8F5' },
  resultName: { color: '#173D48', fontWeight: '800', fontSize: 13, textAlign: 'right' },
  resultMeta: { color: '#8A9AA0', fontSize: 11, textAlign: 'right', marginTop: 2 },
  drugTitle: { color: '#173D48', fontSize: 16, fontWeight: '900', textAlign: 'right', marginTop: 6 },
  field: { backgroundColor: '#F4F7F8', borderRadius: 11, padding: 9, marginTop: 10 },
  fieldDanger: { backgroundColor: '#FFF1F0', borderWidth: 1, borderColor: '#EBC3C0' },
  fieldTitle: { color: '#0E6972', fontWeight: '900', fontSize: 12, textAlign: 'right' },
  fieldTitleDanger: { color: '#B23A32' },
  fieldBody: { color: '#344F57', lineHeight: 20, fontSize: 12, marginTop: 3, textAlign: 'right' },
  link: { color: '#176F79', textAlign: 'right', lineHeight: 19, fontWeight: '800', textDecorationLine: 'underline', fontSize: 12, marginTop: 10 },
});
