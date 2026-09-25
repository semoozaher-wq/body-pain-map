import React, { useMemo, useState } from 'react';
import { Image, ImageSourcePropType, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Language } from '../services/i18n';

export type IllustratedMarker = { id: string; x: number; y: number; label: string };
type Props = {
  source: ImageSourcePropType;
  markers: IllustratedMarker[];
  language: Language;
  title: string;
  hint: string;
  onSelect: (marker: IllustratedMarker) => void;
};

export function IllustratedBodyMap({ source, markers, language, title, hint, onSelect }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const markerMap = useMemo(() => new Map(markers.map((marker) => [marker.id, marker])), [markers]);
  return <View style={styles.card}>
    <View style={styles.heading}><View style={styles.texts}><Text style={styles.title}>{title}</Text><Text style={styles.hint}>{hint}</Text></View><View style={styles.badge}><Text style={styles.badgeText}>{language === 'ar' ? 'خريطة بصرية' : language === 'fr' ? 'Vue visuelle' : 'Visual map'}</Text></View></View>
    <View style={styles.imageFrame}>
      <Image source={source} style={styles.image} resizeMode="contain" accessibilityLabel={language === 'ar' ? 'رسم تشريحي توضيحي قابل للتفاعل' : language === 'fr' ? 'Illustration anatomique interactive' : 'Interactive anatomical illustration'} />
      {markers.map((marker) => {
        const active = selected === marker.id;
        return <Pressable key={marker.id} onPress={() => { setSelected(marker.id); onSelect(marker); }} accessibilityRole="button" accessibilityLabel={marker.label} accessibilityState={{ selected: active }} style={[styles.marker, { left: `${marker.x}%`, top: `${marker.y}%` }, active && styles.markerActive]}>
          <View style={[styles.dot, active && styles.dotActive]} />
          {active && <View style={styles.markerLabel}><Text style={styles.markerLabelText}>{marker.label}</Text></View>}
        </Pressable>;
      })}
    </View>
    {markers.length <= 8 && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.markerList}>{markers.map((marker) => <Pressable key={marker.id} onPress={() => { setSelected(marker.id); onSelect(marker); }} accessibilityRole="button" accessibilityLabel={marker.label} accessibilityState={{ selected: selected === marker.id }} style={[styles.markerChip, selected === marker.id && styles.markerChipActive]}><Text style={[styles.markerChipText, selected === marker.id && styles.markerChipTextActive]}>{marker.label}</Text></Pressable>)}</ScrollView>}
    <Text style={styles.footer}>{hint}</Text>
    {selected && markerMap.has(selected) && <Text style={styles.selectedText}>{markerMap.get(selected)?.label}</Text>}
  </View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderColor: '#D6E4E5', borderWidth: 1, borderRadius: 20, padding: 12, marginBottom: 12, overflow: 'hidden' },
  heading: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, marginBottom: 10 },
  texts: { flex: 1 }, title: { color: '#183D45', fontWeight: '900', fontSize: 16, textAlign: 'right' },
  hint: { color: '#60777C', fontSize: 11, lineHeight: 17, textAlign: 'right', marginTop: 3 },
  badge: { backgroundColor: '#E7F5F2', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 6 }, badgeText: { color: '#0B7774', fontSize: 10, fontWeight: '900' },
  imageFrame: { width: '100%', aspectRatio: 0.67, maxHeight: 620, backgroundColor: '#F9FBFB', borderRadius: 16, position: 'relative', overflow: 'hidden', borderWidth: 1, borderColor: '#E5ECEC' },
  image: { width: '100%', height: '100%' },
  marker: { position: 'absolute', width: 26, height: 26, marginLeft: -13, marginTop: -13, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.78)', borderWidth: 2, borderColor: '#D94F56', alignItems: 'center', justifyContent: 'center', zIndex: 3 },
  markerActive: { zIndex: 10, transform: [{ scale: 1.18 }], backgroundColor: '#D94F56' },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#D94F56' }, dotActive: { backgroundColor: '#FFFFFF' },
  markerLabel: { position: 'absolute', top: 28, minWidth: 88, backgroundColor: '#193D45', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 5 }, markerLabelText: { color: '#FFFFFF', textAlign: 'center', fontSize: 10, fontWeight: '800' },
  markerList: { flexDirection: 'row-reverse', gap: 6, paddingVertical: 8 }, markerChip: { borderWidth: 1, borderColor: '#D5E4E5', borderRadius: 13, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: '#F7FBFA' }, markerChipActive: { backgroundColor: '#0B7774', borderColor: '#0B7774' }, markerChipText: { color: '#315A60', fontSize: 10, fontWeight: '800' }, markerChipTextActive: { color: '#FFFFFF' },
  footer: { color: '#697D81', fontSize: 10, lineHeight: 16, textAlign: 'right', marginTop: 8 }, selectedText: { color: '#0B7774', fontWeight: '900', fontSize: 12, textAlign: 'right', marginTop: 4 }
});
