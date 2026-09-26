// components/Button.tsx
// زر عصري: رئيسي بتدرّج وتوهّج، ثانوي زجاجي، شفاف، وزجاجي للخلفيات الداكنة.

import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View, type ViewStyle } from 'react-native';
import { Fonts } from '../constants/fonts';
import { Palette, Gradients, Radii, Elevation, Type } from '../constants/design';
import { Gradient } from './Gradient';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'glass';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  icon?: React.ReactNode;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  style,
  icon,
}: ButtonProps) {
  const isPrimary = variant === 'primary';
  const isGlass = variant === 'glass';

  const textColor = isPrimary
    ? Palette.white
    : isGlass
      ? Palette.white
      : variant === 'secondary'
        ? Palette.teal700
        : Palette.teal600;

  const sizeStyle: ViewStyle =
    size === 'sm'
      ? { paddingVertical: 9, paddingHorizontal: 16 }
      : size === 'lg'
        ? { paddingVertical: 17, paddingHorizontal: 28 }
        : { paddingVertical: 13, paddingHorizontal: 22 };

  const fontSize = size === 'sm' ? Type.bodySm : size === 'lg' ? Type.title : Type.body;

  const shellStyle: ViewStyle = isPrimary
    ? { backgroundColor: Palette.teal600, ...Elevation.glowTeal }
    : isGlass
      ? { backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.32)' }
      : variant === 'secondary'
        ? { backgroundColor: Palette.white, borderWidth: 1.5, borderColor: Palette.teal200, ...Elevation.sm }
        : { backgroundColor: 'transparent' };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.88}
      style={[styles.button, shellStyle, sizeStyle, (disabled || loading) && styles.disabled, style]}
    >
      {isPrimary ? <Gradient colors={Gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} /> : null}
      {isGlass ? <Gradient colors={Gradients.glass} style={StyleSheet.absoluteFill} /> : null}
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <View style={styles.row}>
          {icon}
          <Text
            style={[
              styles.text,
              { color: textColor, fontSize },
              icon ? { marginLeft: 8 } : null,
            ]}
          >
            {title}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default Button;

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radii.md,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontFamily: Fonts.arabic.bold,
    fontWeight: Type.weight.black,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  disabled: {
    opacity: 0.45,
  },
});
