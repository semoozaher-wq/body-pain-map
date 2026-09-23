import React from 'react';
import { StyleSheet, View } from 'react-native';
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

  return (
    <View style={styles.container} accessibilityLabel="خريطة الجسم التفاعلية">
      <Svg viewBox={region.viewBox} width="100%" height="100%" accessibilityRole="image">
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
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: 724 / 1448,
    minHeight: 420,
    alignSelf: 'center',
  },
});
