import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, Line, Path } from 'react-native-svg';

function Hotspot({ top, left, delay = 0 }: { top: number; left: number; delay?: number }) {
  const pulse = useRef(new Animated.Value(0.75)).current;
  useEffect(() => {
    const animation = Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(pulse, { toValue: 1.18, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.35, duration: 900, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(pulse, { toValue: 0.75, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]),
    ]));
    animation.start();
    return () => animation.stop();
  }, [delay, pulse]);
  return <Animated.View style={[styles.hotspot, { top, left, transform: [{ scale: pulse }] }]} />;
}

export function AnimatedPainBody() {
  return (
    <View style={styles.scene} accessibilityLabel="رسم متحرك لجسم الإنسان مع مناطق ألم توضيحية">
      <View style={styles.glow} />
      <Svg viewBox="0 0 220 330" width="100%" height="100%">
        <Circle cx="110" cy="35" r="22" fill="#D9F5F1" stroke="#6CA8A5" strokeWidth="2" />
        <Path d="M94 57 C91 70 82 74 72 84 L60 121 L75 128 L87 100 L87 164 L70 238 L92 238 L110 169 L128 238 L150 238 L133 164 L133 100 L145 128 L160 121 L148 84 C138 74 129 70 126 57 Z" fill="#B8E3DF" stroke="#4F8C8A" strokeWidth="2" />
        <Path d="M87 101 L69 174 L75 181 L96 120 M133 101 L151 174 L145 181 L124 120" fill="none" stroke="#4F8C8A" strokeWidth="7" strokeLinecap="round" />
        <Line x1="96" y1="239" x2="85" y2="315" stroke="#4F8C8A" strokeWidth="9" strokeLinecap="round" />
        <Line x1="124" y1="239" x2="135" y2="315" stroke="#4F8C8A" strokeWidth="9" strokeLinecap="round" />
        <Ellipse cx="110" cy="130" rx="24" ry="42" fill="none" stroke="#7DBDB8" strokeWidth="2" strokeDasharray="4 5" />
      </Svg>
      <Hotspot top={58} left={81} delay={0} />
      <Hotspot top={137} left={48} delay={280} />
      <Hotspot top={184} left={137} delay={560} />
      <View style={[styles.label, styles.neckLabel]}><View style={styles.dot} /><Animated.Text style={styles.labelText}>جانب الرقبة</Animated.Text></View>
      <View style={[styles.label, styles.sideLabel]}><View style={styles.dot} /><Animated.Text style={styles.labelText}>الجانب</Animated.Text></View>
      <View style={[styles.label, styles.waistLabel]}><View style={styles.dot} /><Animated.Text style={styles.labelText}>أسفل الظهر</Animated.Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  scene: { width: '100%', height: 280, maxWidth: 340, alignSelf: 'center', position: 'relative', overflow: 'hidden', borderRadius: 25, backgroundColor: '#103F49', marginBottom: 18 },
  glow: { position: 'absolute', width: 230, height: 230, borderRadius: 115, backgroundColor: '#1C5D65', opacity: 0.45, top: 22, left: '50%', marginLeft: -115 },
  hotspot: { position: 'absolute', width: 18, height: 18, borderRadius: 9, backgroundColor: '#FF7667', borderWidth: 3, borderColor: '#FFE1D9', shadowColor: '#FF7667', shadowOpacity: 0.8, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } },
  label: { position: 'absolute', flexDirection: 'row-reverse', alignItems: 'center', gap: 5, backgroundColor: '#174C57', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5 },
  neckLabel: { top: 49, right: 12 },
  sideLabel: { top: 132, left: 9 },
  waistLabel: { bottom: 57, right: 9 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FF7667' },
  labelText: { color: '#D9F5F1', fontSize: 10, fontWeight: '800' },
});
