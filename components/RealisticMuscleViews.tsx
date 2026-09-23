import React, { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../constants/colors';
import { BorderRadius, Spacing } from '../constants/spacing';

type ViewKey = 'front' | 'back' | 'side';
type Region = { key: string; label: string; top: `${number}%`; left: `${number}%`; width: `${number}%`; height: `${number}%` };

const views: Record<ViewKey, { label: string; source: number; regions: Region[] }> = {
  front: {
    label: 'أمامي',
    source: require('../assets/anatomy/muscle-front-realistic.png'),
    regions: [
      { key: 'head', label: 'الرأس', top: '8%', left: '39%', width: '22%', height: '10%' },
      { key: 'neck', label: 'الرقبة', top: '17%', left: '40%', width: '20%', height: '8%' },
      { key: 'chest', label: 'الصدر', top: '24%', left: '32%', width: '36%', height: '12%' },
      { key: 'abs', label: 'البطن', top: '36%', left: '37%', width: '26%', height: '15%' },
      { key: 'upper-limb', label: 'الذراع', top: '26%', left: '15%', width: '20%', height: '29%' },
      { key: 'upper-limb', label: 'الذراع', top: '26%', left: '65%', width: '20%', height: '29%' },
      { key: 'lower-limb', label: 'الفخذ', top: '49%', left: '31%', width: '18%', height: '23%' },
      { key: 'lower-limb', label: 'الفخذ', top: '49%', left: '51%', width: '18%', height: '23%' },
      { key: 'lower-limb', label: 'الساق', top: '71%', left: '32%', width: '16%', height: '23%' },
      { key: 'lower-limb', label: 'الساق', top: '71%', left: '52%', width: '16%', height: '23%' },
    ],
  },
  back: {
    label: 'خلفي',
    source: require('../assets/anatomy/muscle-back-realistic.png'),
    regions: [
      { key: 'head', label: 'الرأس', top: '8%', left: '39%', width: '22%', height: '10%' },
      { key: 'neck', label: 'الرقبة', top: '17%', left: '40%', width: '20%', height: '8%' },
      { key: 'upper-back', label: 'أعلى الظهر', top: '24%', left: '30%', width: '40%', height: '16%' },
      { key: 'lower-back', label: 'أسفل الظهر', top: '40%', left: '34%', width: '32%', height: '15%' },
      { key: 'upper-limb', label: 'الذراع', top: '26%', left: '15%', width: '20%', height: '29%' },
      { key: 'upper-limb', label: 'الذراع', top: '26%', left: '65%', width: '20%', height: '29%' },
      { key: 'lower-limb', label: 'الفخذ', top: '51%', left: '31%', width: '18%', height: '23%' },
      { key: 'lower-limb', label: 'الفخذ', top: '51%', left: '51%', width: '18%', height: '23%' },
      { key: 'lower-limb', label: 'الساق', top: '73%', left: '32%', width: '16%', height: '22%' },
      { key: 'lower-limb', label: 'الساق', top: '73%', left: '52%', width: '16%', height: '22%' },
    ],
  },
  side: {
    label: 'جانبي',
    source: require('../assets/anatomy/muscle-side-realistic.png'),
    regions: [
      { key: 'head', label: 'الرأس', top: '8%', left: '39%', width: '22%', height: '10%' },
      { key: 'neck', label: 'جانب الرقبة', top: '17%', left: '39%', width: '22%', height: '9%' },
      { key: 'chest', label: 'الصدر الجانبي', top: '25%', left: '31%', width: '37%', height: '13%' },
      { key: 'upper-back', label: 'الظهر الجانبي', top: '30%', left: '54%', width: '24%', height: '20%' },
      { key: 'upper-limb', label: 'الذراع', top: '27%', left: '20%', width: '22%', height: '30%' },
      { key: 'lower-back', label: 'أسفل الظهر', top: '39%', left: '45%', width: '25%', height: '15%' },
      { key: 'lower-limb', label: 'الفخذ', top: '50%', left: '31%', width: '28%', height: '24%' },
      { key: 'lower-limb', label: 'الساق', top: '72%', left: '33%', width: '23%', height: '24%' },
    ],
  },
};

export function RealisticMuscleViews({ onRegionSelect }: { onRegionSelect?: (groupKey: string, label: string) => void }) {
  const [activeView, setActiveView] = useState<ViewKey>('front');
  const [selected, setSelected] = useState<string | null>(null);
  const current = views[activeView];
  const visibleRegions = useMemo(() => current.regions, [current]);

  const selectRegion = (region: Region) => {
    setSelected(region.label);
    onRegionSelect?.(region.key, region.label);
  };

  return (
    <View style={styles.card}>
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <Text style={styles.title}>الخريطة العضلية الواقعية</Text>
          <Text style={styles.subtitle}>اختر الزاوية ثم اضغط على المنطقة التقريبية</Text>
        </View>
        <Text style={styles.badge}>3D</Text>
      </View>
      <View style={styles.tabs}>
        {(Object.keys(views) as ViewKey[]).map((key) => (
          <Pressable key={key} onPress={() => { setActiveView(key); setSelected(null); }} style={[styles.tab, key === activeView && styles.activeTab]}>
            <Text style={[styles.tabText, key === activeView && styles.activeTabText]}>{views[key].label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.imageFrame}>
        <Image source={current.source} style={styles.image} resizeMode="contain" accessibilityLabel={`رسم عضلي ${current.label}`} />
        {visibleRegions.map((region, index) => (
          <Pressable
            key={`${region.key}-${region.label}-${index}`}
            onPress={() => selectRegion(region)}
            accessibilityRole="button"
            accessibilityLabel={`اختيار ${region.label}`}
            style={[styles.hotspot, { top: region.top, left: region.left, width: region.width, height: region.height }, selected === region.label && styles.selectedHotspot]}
          >
            <Text style={styles.hotspotText}>{selected === region.label ? region.label : ''}</Text>
          </Pressable>
        ))}
      </View>
      {selected ? <Text style={styles.selection}>المنطقة المختارة بصريًا: {selected}</Text> : <Text style={styles.helper}>هذه طبقة بصرية لتسهيل التحديد. اعتمد على الخريطة الدقيقة أسفلها لربط البيانات الطبية.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderRadius: BorderRadius.xl, padding: Spacing.lg, marginBottom: Spacing.lg, borderWidth: 1, borderColor: '#D5E4E6' },
  headingRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  headingCopy: { flex: 1 },
  title: { color: '#173D48', textAlign: 'right', fontSize: 18, fontWeight: '900' },
  subtitle: { color: '#6A8088', textAlign: 'right', fontSize: 12, marginTop: 4 },
  badge: { width: 38, height: 30, borderRadius: 10, backgroundColor: Colors.primary, color: '#FFFFFF', textAlign: 'center', lineHeight: 30, fontWeight: '900' },
  tabs: { flexDirection: 'row-reverse', gap: 8, marginTop: 14 },
  tab: { flex: 1, borderRadius: 10, borderWidth: 1, borderColor: '#D5E4E6', paddingVertical: 9, alignItems: 'center' },
  activeTab: { backgroundColor: '#DDF5F1', borderColor: Colors.primary },
  tabText: { color: '#60757D', fontWeight: '800' },
  activeTabText: { color: Colors.primaryDark },
  imageFrame: { aspectRatio: 0.86, marginTop: 14, borderRadius: 16, overflow: 'hidden', backgroundColor: '#FBFDFD', position: 'relative' },
  image: { width: '100%', height: '100%' },
  hotspot: { position: 'absolute', borderRadius: 999, borderWidth: 1, borderColor: 'rgba(14,124,134,0.18)', backgroundColor: 'rgba(255,255,255,0.03)', alignItems: 'center', justifyContent: 'center' },
  selectedHotspot: { borderColor: Colors.primary, borderWidth: 3, backgroundColor: 'rgba(25,195,177,0.18)' },
  hotspotText: { color: Colors.primaryDark, backgroundColor: '#FFFFFFDD', borderRadius: 7, paddingHorizontal: 5, fontSize: 10, fontWeight: '900' },
  selection: { color: Colors.primaryDark, textAlign: 'right', marginTop: 11, fontWeight: '900' },
  helper: { color: '#71858D', textAlign: 'right', marginTop: 11, lineHeight: 20, fontSize: 12 },
});
