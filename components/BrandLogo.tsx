import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <View style={[styles.wrap, compact && styles.compactWrap]} accessibilityLabel="شعار BodyMap Pain">
      <View style={[styles.mark, compact && styles.compactMark]}>
        <View style={styles.pulse} />
        <Text style={[styles.markText, compact && styles.compactMarkText]}>✦</Text>
      </View>
      <View style={styles.words}>
        <Text style={[styles.name, compact && styles.compactName]}>BodyMap Pain</Text>
        <Text style={[styles.byline, compact && styles.compactByline]}>by ElSayed</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  compactWrap: { gap: 8 },
  mark: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#19C3B1', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', transform: [{ rotate: '-8deg' }] },
  compactMark: { width: 34, height: 34, borderRadius: 11 },
  pulse: { position: 'absolute', width: 70, height: 70, borderRadius: 35, borderWidth: 1, borderColor: '#B5FFF1', opacity: 0.55 },
  markText: { color: '#07353C', fontSize: 27, fontWeight: '900', transform: [{ rotate: '8deg' }] },
  compactMarkText: { fontSize: 19 },
  words: { alignItems: 'flex-start' },
  name: { color: '#0E7C86', fontSize: 19, fontWeight: '900', letterSpacing: 0.2 },
  compactName: { fontSize: 16 },
  byline: { color: '#8797A0', fontSize: 10, fontWeight: '600', letterSpacing: 0.9, marginTop: 2 },
  compactByline: { fontSize: 8, marginTop: 1, letterSpacing: 0.7 },
});
