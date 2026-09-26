import React, { useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { BODY_REGIONS, type BodyView, type Gender } from 'react-native-body-parts-anatomy';

const InteractivePath = Path as any;

type Props = {
  gender: Gender;
  view: BodyView;
  selectedSlugs: readonly string[];
  onFragmentPress: (fragmentSlug: string) => void;
  selectedFragmentColor?: string;
  unselectedFragmentColor?: string;
  outlineColor?: string;
  hitTolerance?: number;
  numberForSlug?: (slug: string) => number;
};

type Point = { x: number; y: number };

/**
 * Detailed web renderer for the 317 anatomical SVG fragments exported by the
 * anatomy package. Every fragment remains an independent, accessible target.
 *
 * IMPORTANT: the fragment <Path> must NOT receive `accessibilityRole="button"`.
 * react-native-web maps that role to a real DOM <button> tag, which cannot draw
 * SVG path data — the fragment becomes an invisible 0x0 element and the map
 * "does nothing" when tapped. Keeping it role-less lets react-native-svg emit a
 * genuine <path> that is both visible and clickable.
 */
export function WebBodySilhouette({
  gender,
  view,
  selectedSlugs,
  onFragmentPress,
  selectedFragmentColor = '#0E7C86',
  unselectedFragmentColor = '#C4DBDE',
  outlineColor = '#4E727A',
  numberForSlug,
}: Props) {
  const region = BODY_REGIONS[gender][view];
  const selected = useMemo(() => new Set(selectedSlugs), [selectedSlugs]);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [hovered, setHovered] = useState<string | null>(null);
  const panStart = useRef<Point>({ x: 0, y: 0 });

  const clampPan = (point: Point, nextZoom: number): Point => {
    const limit = Math.max(0, (nextZoom - 1) * 155);
    return { x: Math.max(-limit, Math.min(limit, point.x)), y: Math.max(-limit, Math.min(limit, point.y)) };
  };
  const setBoundedZoom = (next: number) => {
    const value = Math.max(1, Math.min(2.8, Number(next.toFixed(2))));
    setZoom(value);
    setPan((point) => clampPan(point, value));
  };
  const reset = () => { setZoom(1); setPan({ x: 0, y: 0 }); setHovered(null); };

  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => zoom > 1,
    onMoveShouldSetPanResponder: (_, gesture) => zoom > 1 && (Math.abs(gesture.dx) > 4 || Math.abs(gesture.dy) > 4),
    onPanResponderGrant: () => { panStart.current = pan; },
    onPanResponderMove: (_, gesture) => setPan(clampPan({ x: panStart.current.x + gesture.dx, y: panStart.current.y + gesture.dy }, zoom)),
    onPanResponderRelease: () => undefined,
  }), [pan, zoom]);

  const hoveredFragment = hovered ? region.fragments.find((fragment) => fragment.slug === hovered) : null;
  const transform = [{ translateX: pan.x }, { translateY: pan.y }, { scale: zoom }];

  return <View style={styles.container} accessibilityLabel="خريطة تشريحية تفاعلية تضم 317 جزءًا">
    <View style={styles.toolbar}>
      <Text style={styles.toolbarTitle}>الخريطة التشريحية الدقيقة</Text>
      <Text style={styles.toolbarMeta}>{gender === 'male' ? 'ذكر' : 'أنثى'} · {view === 'front' ? 'أمامي' : 'خلفي'} · {Math.round(zoom * 100)}%</Text>
    </View>
    <View style={styles.viewport} {...responder.panHandlers}>
      <Svg viewBox={region.viewBox} width="100%" height="100%" style={{ transform }}>
        <Path d={region.outlineD} stroke={outlineColor} strokeWidth={2} fill="#F7FBFB" vectorEffect="non-scaling-stroke" pointerEvents="none" />
        {region.fragments.map((fragment) => {
          const isSelected = selected.has(fragment.slug);
          const isHovered = hovered === fragment.slug;
          return <InteractivePath
            key={fragment.slug}
            d={fragment.pathData}
            fill={isSelected ? selectedFragmentColor : isHovered ? '#57B9B1' : unselectedFragmentColor}
            stroke={isSelected || isHovered ? '#075B64' : '#FFFFFF'}
            strokeWidth={isSelected ? 2.6 : isHovered ? 2 : 1}
            opacity={isSelected ? 1 : 0.97}
            onPress={() => onFragmentPress(fragment.slug)}
            onMouseEnter={() => setHovered(fragment.slug)}
            onMouseLeave={() => setHovered(null)}
            accessibilityLabel={`الجزء رقم ${numberForSlug?.(fragment.slug) ?? ''} — ${fragment.parentSlug}`}
          />;
        })}
      </Svg>
      {hoveredFragment && <View pointerEvents="none" style={styles.tooltip}><Text style={styles.tooltipTitle}>{hoveredFragment.parentSlug}</Text><Text style={styles.tooltipMeta}>الجزء رقم {numberForSlug?.(hoveredFragment.slug) ?? '—'} · اضغط للاختيار</Text></View>}
      {selectedSlugs.length > 0 && <View pointerEvents="none" style={styles.selectedBadge}><View style={styles.selectedDot} /><Text style={styles.selectedText}>تم تحديد {selectedSlugs.length} جزء</Text></View>}
    </View>
    <View style={styles.controlsRow}>
      <Pressable onPress={() => setBoundedZoom(zoom + 0.2)} style={styles.control} accessibilityLabel="تكبير الخريطة"><Text style={styles.controlText}>＋</Text></Pressable>
      <Pressable onPress={reset} style={styles.resetControl} accessibilityLabel="إعادة ضبط الخريطة"><Text style={styles.resetText}>إعادة الضبط</Text></Pressable>
      <Pressable onPress={() => setBoundedZoom(zoom - 0.2)} style={styles.control} accessibilityLabel="تصغير الخريطة"><Text style={styles.controlText}>−</Text></Pressable>
    </View>
    <View style={styles.legend}><View style={styles.legendItem}><View style={[styles.legendSwatch, { backgroundColor: unselectedFragmentColor }]} /><Text style={styles.legendText}>منطقة قابلة للاختيار</Text></View><View style={styles.legendItem}><View style={[styles.legendSwatch, { backgroundColor: selectedFragmentColor }]} /><Text style={styles.legendText}>المكان المحدد</Text></View><Text style={styles.gestureHint}>{zoom > 1 ? 'اسحب الخريطة لتحريكها · مرر المؤشر لمعرفة الجزء' : 'كبّر الخريطة لرؤية الأجزاء الدقيقة ثم اضغط على المكان'}</Text></View>
  </View>;
}

const styles = StyleSheet.create({
  container: { width: '100%', maxWidth: 430, alignSelf: 'center', backgroundColor: '#F7FBFB', borderRadius: 20, padding: 10 },
  toolbar: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 7, paddingBottom: 8 },
  toolbarTitle: { color: '#123B42', fontSize: 15, fontWeight: '900', textAlign: 'right' },
  toolbarMeta: { color: '#657781', fontSize: 11, textAlign: 'left' },
  viewport: { width: '100%', aspectRatio: 724 / 1448, minHeight: 460, maxHeight: 720, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#D7E6E8' },
  tooltip: { position: 'absolute', top: 12, right: 12, backgroundColor: '#123B42', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, maxWidth: 210, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  tooltipTitle: { color: '#FFFFFF', fontWeight: '900', fontSize: 13, textAlign: 'right' },
  tooltipMeta: { color: '#B9E5DF', fontSize: 10, marginTop: 3, textAlign: 'right' },
  selectedBadge: { position: 'absolute', bottom: 10, left: 10, flexDirection: 'row-reverse', alignItems: 'center', gap: 6, backgroundColor: '#EAF8F5', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 6 },
  selectedDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#0E7C86' },
  selectedText: { color: '#0E6972', fontSize: 11, fontWeight: '900' },
  controlsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingTop: 9 },
  control: { width: 38, height: 36, borderRadius: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#C9DDE0', justifyContent: 'center', alignItems: 'center' },
  controlText: { color: '#0E7C86', fontSize: 23, fontWeight: '900' },
  resetControl: { minWidth: 88, height: 36, borderRadius: 10, backgroundColor: '#EAF8F5', borderWidth: 1, borderColor: '#B9E5DF', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 10 },
  resetText: { color: '#0E6972', fontSize: 11, fontWeight: '900' },
  legend: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', gap: 10, paddingTop: 10, paddingHorizontal: 4 },
  legendItem: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5 },
  legendSwatch: { width: 12, height: 12, borderRadius: 4, borderWidth: 1, borderColor: '#B8CFD2' },
  legendText: { color: '#657781', fontSize: 10 },
  gestureHint: { flexBasis: '100%', color: '#8797A0', fontSize: 10, textAlign: 'right', lineHeight: 16 },
});
