// components/BrandLogo.tsx
// شعار العلامة: مربّع بتدرّج + نبضة + اسم التطبيق.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Palette, Gradients, Radii, Elevation, Type } from '../constants/design';
import { Gradient } from './Gradient';

export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <View style={[styles.wrap, compact && styles.compactWrap]} accessibilityLabel="شعار BodyMap Pain">
      <View style={[styles.markShell, compact && styles.compactMarkShell]}>
        <Gradient colors={Gradients.brandSoft} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
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

export default BrandLogo;

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  compactWrap: { gap: 8 },
  markShell: {
    width: 46,
    height: 46,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    ...Elevation.glowTeal,
  },
  compactMarkShell: { width: 36, height: 36, borderRadius: 12 },
  pulse: {
    position: 'absolute',
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    opacity: 0.6,
  },
  markText: { color: '#06343D', fontSize: 26, fontWeight: '900' },
  compactMarkText: { fontSize: 19 },
  words: { alignItems: 'flex-start' },
  name: {
    color: Palette.teal700,
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  compactName: { fontSize: 16 },
  byline: {
    color: Palette.slate400,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    marginTop: 2,
  },
  compactByline: { fontSize: 8, marginTop: 1, letterSpacing: 0.7 },
});
