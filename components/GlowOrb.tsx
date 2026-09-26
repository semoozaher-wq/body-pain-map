// components/GlowOrb.tsx
// هالة ضوئية ناعمة (radial glow) تُستخدم لعمق الخلفية والهيرو.

import React, { useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';

let orbCounter = 0;

interface GlowOrbProps {
  size: number;
  color: string;
  opacity?: number;
  style?: StyleProp<ViewStyle>;
}

export function GlowOrb({ size, color, opacity = 0.5, style }: GlowOrbProps) {
  const id = useMemo(() => `bmo-${++orbCounter}`, []);
  const center = size / 2;

  return (
    <View pointerEvents="none" style={[styles.wrap, { width: size, height: size }, style]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={color} stopOpacity={opacity} />
            <Stop offset="55%" stopColor={color} stopOpacity={opacity * 0.35} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={center} cy={center} r={center} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute' },
});

export default GlowOrb;
