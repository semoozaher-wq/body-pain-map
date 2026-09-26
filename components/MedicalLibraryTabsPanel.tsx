// components/MedicalLibraryTabsPanel.tsx
// تبويبان في نفس اللوحة: قائمة الأمراض (المكتبة) و مستكشف التشريح الهرمي (منطقة → منطقة فرعية → بنية → أمراض).
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Language } from '../services/medical/diseaseLibrary';
import { MedicalLibraryPanel } from './MedicalLibraryPanel';
import { AnatomyExplorerPanel } from './AnatomyExplorerPanel';
import { Palette, Radii } from '../constants/design';

const LABELS = {
  ar: { library: 'المكتبة الطبية', anatomy: 'التشريح (سم/مم)' },
  en: { library: 'Medical library', anatomy: 'Anatomy (cm/mm)' },
  fr: { library: 'Bibliothèque', anatomy: 'Anatomie (cm/mm)' },
} as const;

export function MedicalLibraryTabsPanel({ language }: { language: Language }) {
  const t = LABELS[language] ?? LABELS.ar;
  const [tab, setTab] = useState<'library' | 'anatomy'>(  'library'  );
  return (
    <View style={styles.wrap}>
      <View style={styles.switchRow}>
        <Pressable onPress={() => setTab(  'library'  )} style={[styles.switchBtn, tab === 'library' && styles.switchActive]}>
          <Text style={[styles.switchText, tab === 'library' && styles.switchTextActive]}>{t.library}</Text>
        </Pressable>
        <Pressable onPress={() => setTab(  'anatomy'  )} style={[styles.switchBtn, tab === 'anatomy' && styles.switchActive]}>
          <Text style={[styles.switchText, tab === 'anatomy' && styles.switchTextActive]}>{t.anatomy}</Text>
        </Pressable>
      </View>
      {tab ===  'anatomy'  ? <AnatomyExplorerPanel language={language} /> : <MedicalLibraryPanel language={language} />}
    </View>
  );
}

export default MedicalLibraryTabsPanel;

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  switchRow: { flexDirection:  'row'  , gap: 8 },
  switchBtn: { flex: 1, alignItems:  'center'  , paddingVertical: 9, borderRadius: Radii.md, backgroundColor: Palette.slate100 },
  switchActive: { backgroundColor: Palette.teal600 },
  switchText: { fontSize: 13, color: Palette.slate600 },
  switchTextActive: { color: Palette.white, fontWeight:  '700'  },
});
