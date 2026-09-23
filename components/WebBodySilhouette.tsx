import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { BODY_REGIONS, type BodyView, type Gender } from 'react-native-body-parts-anatomy';

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

/**
 * Web-only renderer for the anatomy package.
 *
 * The package's zoom/pan gesture layer intentionally does not commit taps in
 * browser previews. This renderer uses the same exported SVG data directly so
 * every fragment remains a real browser-clickable target on Vercel/Netlify.
 */
export function WebBodySilhouette({
  gender,
  view,
  selectedSlugs,
  onFragmentPress,
  selectedFragmentColor = '#0E7C86',
  unselectedFragmentColor = '#D7E6E8',
  outlineColor = '#52737A',
  numberForSlug,
}: Props) {
  const region = BODY_REGIONS[gender][view];
  const selected = new Set(selectedSlugs);
  const [zoom, setZoom] = useState(1);
  const changeZoom = (delta: number) => setZoom((value) => Math.min(1.45, Math.max(0.85, Number((value + delta).toFixed(2)))));

  return (
    <View style={styles.container} accessibilityLabel="خريطة الجسم التفاعلية">
      <View style={styles.viewport}>
      <Svg viewBox={region.viewBox} width="100%" height="100%" style={{ transform: [{ scale: zoom }] }} accessibilityRole="image">
        <Path
          d={region.outlineD}
          stroke={outlineColor}
          strokeWidth={2}
          fill="none"
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />
        {region.fragments.map((fragment) => (
          <Path
            key={fragment.slug}
            d={fragment.pathData}
            fill={selected.has(fragment.slug) ? selectedFragmentColor : unselectedFragmentColor}
            stroke="#FFFFFF"
            strokeWidth={1}
            onPress={() => onFragmentPress(fragment.slug)}
            accessibilityLabel={`الجزء رقم ${numberForSlug?.(fragment.slug) ?? ''} — ${fragment.parentSlug}`}
          />
        ))}
      </Svg>
      </View>
      <View style={styles.zoomControls} accessibilityLabel="أدوات تكبير الخريطة">
        <Pressable onPress={() => changeZoom(0.15)} style={styles.zoomButton} accessibilityLabel="تكبير"><Text style={styles.zoomText}>+</Text></Pressable>
        <Pressable onPress={() => setZoom(1)} style={styles.zoomButton} accessibilityLabel="إعادة ضبط التكبير"><Text style={styles.resetText}>١×</Text></Pressable>
        <Pressable onPress={() => changeZoom(-0.15)} style={styles.zoomButton} accessibilityLabel="تصغير"><Text style={styles.zoomText}>−</Text></Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: 724 / 1448,
    minHeight: 420,
    alignSelf: 'center',
    position: 'relative',
  },
  viewport: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomControls: {
    position: 'absolute',
    top: 12,
    left: 12,
    gap: 6,
  },
  zoomButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D4E3E6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#123B42',
    shadowOpacity: 0.12,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  zoomText: {
    color: '#0E7C86',
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 24,
  },
  resetText: {
    color: '#54727D',
    fontSize: 11,
    fontWeight: '900',
  },
});
