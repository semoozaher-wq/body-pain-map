// components/Gradient.tsx
// تدرّج لوني خطّي مبني على react-native-svg — يعمل على الويب و iOS و Android بدون حزم إضافية.

import React, { useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Rect } from 'react-native-svg';

let gradientCounter = 0;

export type GradientPoint = { x: number; y: number };

interface GradientProps {
  colors: string[];
  style?: StyleProp<ViewStyle>;
  /** نقطة البداية بنسبة من 0 إلى 1 (افتراضي: أعلى) */
  start?: GradientPoint;
  /** نقطة النهاية بنسبة من 0 إلى 1 (افتراضي: أسفل) */
  end?: GradientPoint;
  children?: React.ReactNode;
  /** توزيع نقاط التوقف: متساوٍ افتراضيًا */
  locations?: number[];
}

/**
 * حاوية بتدرّج لوني خطّي. تُستخدم كخلفية للبطاقات والهيرو والأزرار.
 */
export function Gradient({
  colors,
  style,
  start = { x: 0.1, y: 0 },
  end = { x: 0.9, y: 1 },
  children,
  locations,
}: GradientProps) {
  const id = useMemo(() => `bmg-${++gradientCounter}`, []);
  const stops = locations ?? colors.map((_, index) => (colors.length === 1 ? 0 : index / (colors.length - 1)));

  return (
    <View style={[styles.wrap, style]}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <SvgLinearGradient
            id={id}
            x1={`${start.x * 100}%`}
            y1={`${start.y * 100}%`}
            x2={`${end.x * 100}%`}
            y2={`${end.y * 100}%`}
          >
            {colors.map((color, index) => (
              <Stop key={`${color}-${index}`} offset={`${stops[index] * 100}%`} stopColor={color} stopOpacity={1} />
            ))}
          </SvgLinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative', overflow: 'hidden' },
});

export default Gradient;
