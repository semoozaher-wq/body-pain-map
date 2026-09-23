import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Language } from '../services/i18n';

export function LanguageSwitcher({ language, onChange }: { language: Language; onChange: (value: Language) => void }) {
  return <View style={styles.wrap} accessibilityLabel="اختيار اللغة">{(['ar', 'en', 'fr'] as Language[]).map((item) => <Pressable key={item} onPress={() => onChange(item)} style={[styles.item, item === language && styles.active]}><Text style={[styles.text, item === language && styles.activeText]}>{item.toUpperCase()}</Text></Pressable>)}</View>;
}
const styles = StyleSheet.create({ wrap: { flexDirection: 'row', gap: 4 }, item: { paddingHorizontal: 7, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: '#D6E0E6' }, active: { backgroundColor: '#D9F5F1', borderColor: '#0E7C86' }, text: { color: '#657781', fontSize: 10, fontWeight: '900' }, activeText: { color: '#0E6972' } });
