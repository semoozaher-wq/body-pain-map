// components/Card.tsx

import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '../constants/colors';
import { Spacing, BorderRadius, Shadows } from '../constants/spacing';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: 'default' | 'elevated' | 'outlined';
}

export function Card({ children, style, variant = 'default' }: CardProps) {
  const getVariantStyle = (): ViewStyle => {
    switch (variant) {
      case 'elevated':
        return { ...Shadows.lg };
      case 'outlined':
        return { borderWidth: 1, borderColor: Colors.border, ...Shadows.none };
      default:
        return { ...Shadows.md };
    }
  };

  return (
    <View style={[styles.card, getVariantStyle(), style]}>
      {children}
    </View>
  );
}

export default Card;

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
  },
});
