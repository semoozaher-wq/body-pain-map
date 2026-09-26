// components/Card.tsx
// بطاقة عصرية بحدود ناعمة وظل متعدد الطبقات، مع شريط علوي مميز اختياري.

import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { Palette, Gradients, Radii, Elevation } from '../constants/design';
import { Gradient } from './Gradient';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: 'default' | 'elevated' | 'outlined';
  /** شريط تدرّج علوي رفيع */
  accent?: boolean;
}

export function Card({ children, style, variant = 'default', accent = false }: CardProps) {
  const variantStyle: ViewStyle =
    variant === 'elevated'
      ? { ...Elevation.lg, borderColor: 'transparent' }
      : variant === 'outlined'
        ? { borderWidth: 1, borderColor: Palette.slate200, ...Elevation.none }
        : { borderWidth: 1, borderColor: Palette.teal100, ...Elevation.md };

  return (
    <View style={[styles.card, variantStyle, style]}>
      {accent ? <Gradient colors={Gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.accent} /> : null}
      {children}
    </View>
  );
}

export default Card;

const styles = StyleSheet.create({
  card: {
    backgroundColor: Palette.white,
    borderRadius: Radii.xl,
    padding: 18,
    overflow: 'hidden',
  },
  accent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
});
