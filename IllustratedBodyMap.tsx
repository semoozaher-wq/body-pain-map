import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, ImageSourcePropType, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Language } from '../services/i18n';

export type IllustratedMarker = { id: string; x: number; y: number; label: string };
type Props = {
  source: ImageSourcePropType;
  markers: IllustratedMarker[];
  language: Language;
  title: string;
  hint: string;
  onSelect: (marker: IllustratedMarker) => void;
  /** عنصر يُبرَز بصريًا (حلقة نابضة) بأمر من المساعد المركزي. */
  highlight?: { id: string; x: number; y: number; label: string } | null;
  /** علامة ألم وضعها المساعد المركزي على الخريطة (دبوس أحمر). */
  painMarker?: { x: number; y: number } | null;
};

export function IllustratedBodyMap({ source, markers, language, title, hint, onSelect, highlight, painMarker }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const markerMap = useMemo(() => new Map(markers.map((marker) => [marker.id, marker])), [markers]);
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!highlight) return;
    pulse.setValue(0);
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.out(Easing.ease), useNativeDriver: false }),
      Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.in(Easing.ease), useNativeDriver: false })
    ]));
    loop.start();
    return () => loop.stop();
  }, [highlight?.id, pulse]);
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
      {highlight && <View pointerEvents="none" style={[styles.highlightWrap, { left: `${highlight.x}%`, top: `${highlight.y}%` }]}>
        <Animated.View style={[styles.highlightRing, {
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0.25] }),
          transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] }) }]
        }]} />
        <View style={styles.highlightCore} />
        <View style={styles.highlightLabel}><Text style={styles.highlightLabelText}>{highlight.label}</Text></View>
      </View>}
      {painMarker && <View pointerEvents="none" style={[styles.painMarkerWrap, { left: `${painMarker.x}%`, top: `${painMarker.y}%` }]}>
        <View style={styles.painMarkerPin} />
        <View style={styles.painMarkerLabel}><Text style={styles.painMarkerLabelText}>{language === 'ar' ? 'مكان الألم' : language === 'fr' ? 'Douleur' : 'Pain'}</Text></View>
      </View>}
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
  imageFrame: { width: '100%', maxWidth: 560, alignSelf: 'center', aspectRatio: 0.67, maxHeight: 900, backgroundColor: '#F9FBFB', borderRadius: 16, position: 'relative', overflow: 'hidden', borderWidth: 1, borderColor: '#E5ECEC' },
  image: { width: '100%', height: '100%' },
  marker: { position: 'absolute', width: 44, height: 44, marginLeft: -22, marginTop: -22, borderRadius: 22, backgroundColor: 'transparent', borderWidth: 0, alignItems: 'center', justifyContent: 'center', zIndex: 3 },
  markerActive: { zIndex: 10, transform: [{ scale: 1.08 }], backgroundColor: 'rgba(213,78,78,0.18)', borderWidth: 2, borderColor: 'rgba(213,78,78,0.48)', shadowColor: '#D54E4E', shadowOpacity: 0.55, shadowRadius: 12, shadowOffset: { width: 0, height: 0 }, elevation: 5 },
  dot: { width: 1, height: 1, borderRadius: 1, backgroundColor: 'transparent' }, dotActive: { backgroundColor: 'transparent' },
  markerLabel: { position: 'absolute', top: 28, minWidth: 88, backgroundColor: '#193D45', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 5 }, markerLabelText: { color: '#FFFFFF', textAlign: 'center', fontSize: 10, fontWeight: '800' },
  markerList: { flexDirection: 'row-reverse', gap: 6, paddingVertical: 8 }, markerChip: { borderWidth: 1, borderColor: '#D5E4E5', borderRadius: 13, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: '#F7FBFA' }, markerChipActive: { backgroundColor: '#0B7774', borderColor: '#0B7774' }, markerChipText: { color: '#315A60', fontSize: 10, fontWeight: '800' }, markerChipTextActive: { color: '#FFFFFF' },
  footer: { color: '#697D81', fontSize: 10, lineHeight: 16, textAlign: 'right', marginTop: 8 }, selectedText: { color: '#0B7774', fontWeight: '900', fontSize: 12, textAlign: 'right', marginTop: 4 },
  highlightWrap: { position: 'absolute', width: 54, height: 54, marginLeft: -27, marginTop: -27, alignItems: 'center', justifyContent: 'center', zIndex: 20 },
  highlightRing: { position: 'absolute', width: 54, height: 54, borderRadius: 27, borderWidth: 3, borderColor: '#F2A93B', backgroundColor: 'rgba(242,169,59,0.20)' },
  highlightCore: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#F2A93B', borderWidth: 2, borderColor: '#FFFFFF', shadowColor: '#F2A93B', shadowOpacity: 0.9, shadowRadius: 10, shadowOffset: { width: 0, height: 0 }, elevation: 8 },
  highlightLabel: { position: 'absolute', top: 34, minWidth: 92, backgroundColor: '#B4711A', borderRadius: 9, paddingHorizontal: 8, paddingVertical: 5, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 6 }, highlightLabelText: { color: '#FFFFFF', textAlign: 'center', fontSize: 11, fontWeight: '900' },
  painMarkerWrap: { position: 'absolute', width: 40, height: 40, marginLeft: -20, marginTop: -20, alignItems: 'center', justifyContent: 'center', zIndex: 25 },
  painMarkerPin: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#E23D3D', borderWidth: 3, borderColor: '#FFFFFF', shadowColor: '#E23D3D', shadowOpacity: 0.9, shadowRadius: 10, shadowOffset: { width: 0, height: 0 }, elevation: 9 },
  painMarkerLabel: { position: 'absolute', top: 22, minWidth: 80, backgroundColor: '#B91C1C', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 4 },
  painMarkerLabelText: { color: '#FFFFFF', textAlign: 'center', fontSize: 10, fontWeight: '900' },
});
