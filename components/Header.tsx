// components/Header.tsx
// هيدر عصري متوافق مع الثيم الفاتح/الداكن، بزر رجوع دائري ناعم.

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Fonts } from '../constants/fonts';
import { Palette, Radii, Elevation, Type } from '../constants/design';
import { useTheme } from '../hooks/useTheme';

interface HeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightAction?: React.ReactNode;
}

export function Header({ title, subtitle, onBack, rightAction }: HeaderProps) {
  const { colors, isDark } = useTheme();

  return (
    <View style={styles.container}>
      <View style={styles.left}>
        {onBack && (
          <TouchableOpacity
            onPress={onBack}
            accessibilityRole="button"
            style={[styles.backButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={[styles.backIcon, { color: colors.primary }]}>←</Text>
          </TouchableOpacity>
        )}
        <View style={styles.titleBlock}>
          <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>{title}</Text>
          {subtitle && <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>{subtitle}</Text>}
        </View>
      </View>
      {rightAction && <View>{rightAction}</View>}
    </View>
  );
}

export default Header;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
    gap: 12,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: Radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...Elevation.xs,
  },
  backIcon: {
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 22,
  },
  titleBlock: { flex: 1 },
  title: {
    fontFamily: Fonts.arabic.bold,
    fontSize: Type.h3,
    fontWeight: Type.weight.black,
    letterSpacing: Type.tracking.tight,
  },
  subtitle: {
    fontFamily: Fonts.arabic.regular,
    fontSize: Type.caption,
    marginTop: 2,
  },
});
