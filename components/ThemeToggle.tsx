import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
export function ThemeToggle({ dark, onPress }: { dark: boolean; onPress: () => void }) { return <Pressable onPress={onPress} style={[styles.button, dark && styles.dark]} accessibilityLabel="تبديل الوضع الليلي"><Text style={[styles.text, dark && styles.darkText]}>{dark ? '☀︎' : '☾'}</Text></Pressable>; }
const styles = StyleSheet.create({ button: { width: 34, height: 34, borderRadius: 10, borderWidth: 1, borderColor: '#D6E0E6', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF' }, dark: { backgroundColor: '#17232B', borderColor: '#34505A' }, text: { color: '#0E7C86', fontSize: 19, fontWeight: '900' }, darkText: { color: '#FFD166' } });
