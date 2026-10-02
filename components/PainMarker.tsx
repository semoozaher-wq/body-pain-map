import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

interface PainMarkerProps {
  x: number;
  y: number;
  intensity: number; // من 1 إلى 10
  label?: string;
}

export const PainMarker: React.FC<PainMarkerProps> = ({ x, y, intensity, label }) => {
  // أنيميشن التكبير والنبض
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.35,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  // تحديد اللون حسب شدة الألم
  const getMarkerColor = (level: number) => {
    if (level <= 3) return '#22c55e'; // ألم خفيف - أخضر
    if (level <= 6) return '#eab308'; // ألم متوسط - أصفر
    if (level <= 8) return '#f97316'; // ألم شديد - برتقالي
    return '#ef4444'; // ألم حاد جداً - أحمر
  };

  const markerColor = getMarkerColor(intensity);

  return (
    <View style={[styles.container, { left: `${x}%`, top: `${y}%` }]}>
      {/* الحلقة الخارجية النابضة */}
      <Animated.View
        style={[
          styles.pulseRing,
          {
            backgroundColor: markerColor,
            transform: [{ scale: pulseAnim }],
            opacity: 0.4,
          },
        ]}
      />

      {/* النقطة المركزية */}
      <View style={[styles.dot, { backgroundColor: markerColor }]}>
        <Text style={styles.intensityText}>{intensity}</Text>
      </View>

      {/* اسم الجزء أو التفاصيل إن وجدت */}
      {label && (
        <View style={styles.labelContainer}>
          <Text style={styles.labelText}>{label}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    transform: [{ translateX: -18 }, { translateY: -18 }],
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  pulseRing: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  intensityText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  labelContainer: {
    marginTop: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  labelText: {
    color: '#f8fafc',
    fontSize: 11,
    fontWeight: '500',
  },
});

export default PainMarker;
