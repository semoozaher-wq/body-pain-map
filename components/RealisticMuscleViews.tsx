import React, { useState } from 'react';
import { Image, LayoutChangeEvent, Pressable, StyleSheet, Text, Vibration, View } from 'react-native';
import { Colors } from '../constants/colors';
import { BorderRadius, Spacing } from '../constants/spacing';
import { cleanData } from '../data/cleanData';

type ViewKey = 'front' | 'back' | 'side';
type Hotspot = {
  key: string;
  label: string;
  top: `${number}%`;
  left: `${number}%`;
};

type ViewDefinition = {
  label: string;
  source: number;
  hotspots: Hotspot[];
};

// نقاط صغيرة بدل مناطق شفافة كبيرة؛ كل نقطة تربط بمجموعة عضلية محددة.
const views: Record<ViewKey, ViewDefinition> = {
  front: {
    label: 'أمامي',
    source: require('../assets/anatomy/muscle-front-realistic.png'),
    hotspots: [
      { key: 'head', label: 'الرأس', top: '13%', left: '50%' },
      { key: 'neck', label: 'الرقبة', top: '21%', left: '50%' },
      { key: 'deltoids', label: 'الكتف', top: '28%', left: '29%' },
      { key: 'deltoids', label: 'الكتف', top: '28%', left: '71%' },
      { key: 'chest', label: 'الصدر', top: '31%', left: '43%' },
      { key: 'chest', label: 'الصدر', top: '31%', left: '57%' },
      { key: 'biceps', label: 'مقدمة الذراع', top: '39%', left: '23%' },
      { key: 'biceps', label: 'مقدمة الذراع', top: '39%', left: '77%' },
      { key: 'abs', label: 'البطن', top: '44%', left: '50%' },
      { key: 'obliques', label: 'جانب البطن', top: '44%', left: '39%' },
      { key: 'obliques', label: 'جانب البطن', top: '44%', left: '61%' },
      { key: 'quadriceps', label: 'مقدمة الفخذ', top: '62%', left: '43%' },
      { key: 'quadriceps', label: 'مقدمة الفخذ', top: '62%', left: '57%' },
      { key: 'knees', label: 'الركبة', top: '74%', left: '43%' },
      { key: 'knees', label: 'الركبة', top: '74%', left: '57%' },
      { key: 'calves', label: 'الساق', top: '86%', left: '44%' },
      { key: 'calves', label: 'الساق', top: '86%', left: '56%' },
    ],
  },
  back: {
    label: 'خلفي',
    source: require('../assets/anatomy/muscle-back-realistic.png'),
    hotspots: [
      { key: 'head', label: 'الرأس', top: '13%', left: '50%' },
      { key: 'neck', label: 'الرقبة', top: '21%', left: '50%' },
      { key: 'trapezius', label: 'أعلى الكتف', top: '28%', left: '40%' },
      { key: 'trapezius', label: 'أعلى الكتف', top: '28%', left: '60%' },
      { key: 'upper-back', label: 'أعلى الظهر', top: '35%', left: '50%' },
      { key: 'triceps', label: 'خلف الذراع', top: '40%', left: '23%' },
      { key: 'triceps', label: 'خلف الذراع', top: '40%', left: '77%' },
      { key: 'lower-back', label: 'أسفل الظهر', top: '47%', left: '50%' },
      { key: 'gluteal', label: 'الأرداف', top: '58%', left: '43%' },
      { key: 'gluteal', label: 'الأرداف', top: '58%', left: '57%' },
      { key: 'hamstring', label: 'خلف الفخذ', top: '68%', left: '43%' },
      { key: 'hamstring', label: 'خلف الفخذ', top: '68%', left: '57%' },
      { key: 'calves', label: 'الساق الخلفية', top: '86%', left: '44%' },
      { key: 'calves', label: 'الساق الخلفية', top: '86%', left: '56%' },
    ],
  },
  side: {
    label: 'جانبي',
    source: require('../assets/anatomy/muscle-side-realistic.png'),
    hotspots: [
      { key: 'head', label: 'الرأس', top: '13%', left: '50%' },
      { key: 'neck', label: 'جانب الرقبة', top: '21%', left: '50%' },
      { key: 'chest', label: 'الصدر الجانبي', top: '31%', left: '49%' },
      { key: 'deltoids', label: 'الكتف', top: '29%', left: '35%' },
      { key: 'biceps', label: 'الذراع', top: '40%', left: '31%' },
      { key: 'obliques', label: 'جانب البطن', top: '43%', left: '50%' },
      { key: 'upper-back', label: 'الظهر الجانبي', top: '37%', left: '68%' },
      { key: 'lower-back', label: 'أسفل الظهر', top: '47%', left: '64%' },
      { key: 'quadriceps', label: 'مقدمة الفخذ', top: '64%', left: '43%' },
      { key: 'hamstring', label: 'خلف الفخذ', top: '64%', left: '61%' },
      { key: 'calves', label: 'الساق', top: '86%', left: '49%' },
    ],
  },
};

export function RealisticMuscleViews({ onRegionSelect, onViewChange, hotspotIntensity = 4 }: { onRegionSelect?: (groupKey: string, label: string) => void; onViewChange?: (view: ViewKey) => void; hotspotIntensity?: number }) {
  const [activeView, setActiveView] = useState<ViewKey>('front');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<{ x: number; y: number } | null>(null);
  const [frameSize, setFrameSize] = useState({ width: 1, height: 1 });
  const current = views[activeView];

  const selectHotspot = (hotspot: Hotspot, index: number) => {
    setSelectedKey(`${hotspot.key}-${index}`);
    setSelectedPoint({ x: Number.parseFloat(hotspot.left), y: Number.parseFloat(hotspot.top) });
    Vibration.vibrate(12);
    onRegionSelect?.(hotspot.key, hotspot.label);
  };

  const selectImagePoint = (event: any) => {
    const { locationX, locationY } = event.nativeEvent;
    const width = frameSize.width;
    const height = frameSize.height;
    setSelectedKey(null);
    setSelectedPoint({ x: Math.max(0, Math.min(100, (locationX / width) * 100)), y: Math.max(0, Math.min(100, (locationY / height) * 100)) });
    Vibration.vibrate(12);
  };

  const heatColor = hotspotIntensity >= 8 ? '#D64545' : hotspotIntensity >= 5 ? '#D98B25' : '#3182CE';

  return (
    <View style={styles.card}>
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <Text style={styles.title}>خريطة العضلات التفاعلية</Text>
          <Text style={styles.subtitle}>اضغط على نقطة صغيرة لمعرفة العضلة فورًا</Text>
        </View>
        <Text style={styles.badge}>HOT</Text>
      </View>
      <View style={styles.tabs}>
        {(Object.keys(views) as ViewKey[]).map((key) => (
          <Pressable key={key} onPress={() => { setActiveView(key); setSelectedKey(null); setSelectedPoint(null); onViewChange?.(key); }} style={[styles.tab, key === activeView && styles.activeTab]}>
            <Text style={[styles.tabText, key === activeView && styles.activeTabText]}>{views[key].label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.imageFrame} onLayout={(event: LayoutChangeEvent) => setFrameSize({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })}>
        <Image source={current.source} style={styles.image} resizeMode="contain" accessibilityLabel={`صورة عضلات ${current.label}`} />
        <Pressable style={styles.imageTouchLayer} onPress={selectImagePoint} accessibilityRole="button" accessibilityLabel="حدد مكان الألم على الصورة" />
        {selectedPoint && <View pointerEvents="none" style={[styles.painMarker, { left: `${selectedPoint.x}%`, top: `${selectedPoint.y}%` }]}><View style={styles.painMarkerCore} /><Text style={styles.painMarkerLabel}>مكان الألم</Text></View>}
        {current.hotspots.map((hotspot, index) => {
          const id = `${hotspot.key}-${index}`;
          const selected = selectedKey === id;
          const anatomyPart = Object.values(cleanData.muscles || {}).find((muscle: any) => muscle.group === hotspot.key) as any;
          const partNumber = anatomyPart?.partNumber ?? index + 1;
          return (
            <Pressable
              key={id}
              onPress={() => selectHotspot(hotspot, index)}
              accessibilityRole="button"
              accessibilityLabel={`نقطة ${hotspot.label}`}
              style={[styles.hotspot, { top: hotspot.top, left: hotspot.left, borderColor: heatColor }, selected && [styles.selectedHotspot, { backgroundColor: '#D64545', borderColor: '#A91F1F' }] ]}
            >
              <View style={[styles.dot, { backgroundColor: selected ? '#FFFFFF' : heatColor }]} />
              <Text style={styles.hotspotNumber}>#{partNumber}</Text>
              {selected && <Text style={styles.hotspotLabel}>{hotspot.label}</Text>}
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.helper}>كل نقطة تمثل عضلة أو منطقة محددة. اضغط عليها لعرض التفاصيل.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderRadius: BorderRadius.xl, padding: Spacing.lg, marginBottom: Spacing.lg, borderWidth: 1, borderColor: '#D5E4E6' },
  headingRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  headingCopy: { flex: 1 },
  title: { color: '#173D48', textAlign: 'right', fontSize: 18, fontWeight: '900' },
  subtitle: { color: '#6A8088', textAlign: 'right', fontSize: 12, marginTop: 4 },
  badge: { width: 42, height: 30, borderRadius: 10, backgroundColor: Colors.primary, color: '#FFFFFF', textAlign: 'center', lineHeight: 30, fontWeight: '900', fontSize: 10 },
  tabs: { flexDirection: 'row-reverse', gap: 8, marginTop: 14 },
  tab: { flex: 1, borderRadius: 10, borderWidth: 1, borderColor: '#D5E4E6', paddingVertical: 9, alignItems: 'center' },
  activeTab: { backgroundColor: '#DDF5F1', borderColor: Colors.primary },
  tabText: { color: '#60757D', fontWeight: '800' },
  activeTabText: { color: Colors.primaryDark },
  imageFrame: { aspectRatio: 0.86, marginTop: 14, borderRadius: 16, overflow: 'hidden', backgroundColor: '#FBFDFD', position: 'relative' },
  image: { width: '100%', height: '100%' },
  imageTouchLayer: { ...StyleSheet.absoluteFill, zIndex: 1 },
  hotspot: { position: 'absolute', width: 28, height: 28, marginLeft: -14, marginTop: -14, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.82)', borderWidth: 2, borderColor: Colors.primary, zIndex: 2 },
  selectedHotspot: { width: 34, height: 34, marginLeft: -17, marginTop: -17, backgroundColor: '#D64545', borderColor: '#A91F1F', zIndex: 3 },
  dot: { width: 10, height: 10, borderRadius: 999, backgroundColor: Colors.primaryDark },
  hotspotNumber: { position: 'absolute', top: -17, minWidth: 30, paddingHorizontal: 3, paddingVertical: 2, borderRadius: 6, backgroundColor: '#173D48', color: '#FFFFFF', textAlign: 'center', fontSize: 9, fontWeight: '900' },
  hotspotLabel: { position: 'absolute', top: 27, right: -34, minWidth: 68, paddingHorizontal: 5, paddingVertical: 3, borderRadius: 6, backgroundColor: '#173D48', color: '#FFFFFF', textAlign: 'center', fontSize: 10, fontWeight: '900' },
  painMarker: { position: 'absolute', width: 48, height: 48, marginLeft: -24, marginTop: -24, borderRadius: 24, borderWidth: 4, borderColor: '#D64545', backgroundColor: 'rgba(214,69,69,0.25)', alignItems: 'center', justifyContent: 'center', zIndex: 4 },
  painMarkerCore: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#D64545', borderWidth: 2, borderColor: '#FFFFFF' },
  painMarkerLabel: { position: 'absolute', top: 48, minWidth: 72, paddingHorizontal: 5, paddingVertical: 3, borderRadius: 6, backgroundColor: '#A91F1F', color: '#FFFFFF', textAlign: 'center', fontSize: 10, fontWeight: '900' },
  helper: { color: '#71858D', textAlign: 'right', marginTop: 11, lineHeight: 20, fontSize: 12 },
});
