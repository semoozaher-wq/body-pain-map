// screens/BodyPickerScreen.tsx

import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Platform } from 'react-native';
import { Colors } from '../constants/colors';
import { Fonts } from '../constants/fonts';
import { Spacing, BorderRadius } from '../constants/spacing';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { useTheme } from '../hooks/useTheme';
import { WebBodySilhouette } from '../components/WebBodySilhouette';
import { MuscleSvgMap, MUSCLE_SVG_PARTS } from '../components/MuscleSvgMap';
import { BodySilhouette } from 'react-native-body-parts-anatomy';
import anatomyMap from '../data/anatomyPainMap.json';
import { AnatomyData, AppGender, BodyView } from '../types';

const data = anatomyMap as unknown as AnatomyData;

interface BodyPickerScreenProps {
  gender: AppGender;
  view: BodyView;
  selectedId: string | null;
  setGender: (v: AppGender) => void;
  setView: (v: BodyView) => void;
  onSelect: (id: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export const BodyPickerScreen: React.FC<BodyPickerScreenProps> = ({
  gender,
  view,
  selectedId,
  setGender,
  setView,
  onSelect,
  onNext,
  onBack,
}) => {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [visualPath, setVisualPath] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return Object.keys(data.muscles)
      .filter((id) => {
        const m = data.muscles[id];
        return (
          String(m.partNumber) === q ||
          m.labelAr.toLowerCase().includes(q) ||
          m.groupLabelAr.toLowerCase().includes(q)
        );
      })
      .slice(0, 8);
  }, [query]);

  const numberForSlug = (id: string) => data.muscles[id]?.partNumber ?? 0;

  return (
    <View style={styles.container}>
      {/* Chips: Gender + View */}
      <View style={styles.chips}>
        <Chip label="ذكر" active={gender === 'male'} onPress={() => setGender('male')} colors={colors} />
        <Chip label="أنثى" active={gender === 'female'} onPress={() => setGender('female')} colors={colors} />
        <Chip label="أمامي" active={view === 'front'} onPress={() => setView('front')} colors={colors} />
        <Chip label="خلفي" active={view === 'back'} onPress={() => setView('back')} colors={colors} />
      </View>

      {/* Search */}
      <View style={[styles.searchWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="ابحث برقم الجزء أو اسمه..."
          placeholderTextColor={colors.textLight}
          style={[styles.search, { color: colors.textPrimary }]}
          textAlign="right"
        />
        {filtered.length > 0 && (
          <View style={[styles.searchResults, { borderColor: colors.border }]}>
            {filtered.map((id) => (
              <Pressable
                key={id}
                onPress={() => {
                  onSelect(id);
                  setQuery('');
                }}
                style={[styles.searchRow, { borderBottomColor: colors.borderLight }]}
              >
                <Text style={[styles.searchNumber, { color: colors.primary }]}>#{data.muscles[id].partNumber}</Text>
                <Text style={[styles.searchText, { color: colors.textPrimary }]}>{data.muscles[id].labelAr}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <Card style={styles.visualCard}>
        <Text style={[styles.visualTitle, { color: colors.textPrimary }]}>الخريطة العضلية البصرية</Text>
        <Text style={[styles.visualHint, { color: colors.textLight }]}>اضغط على أي مسار لرؤية رقمه. هذه الخريطة للتحديد البصري، بينما الخريطة الطبية أدناه مرتبطة ببيانات الـ317 جزءًا.</Text>
        <View style={styles.visualMap}>
          <MuscleSvgMap viewBox="0 0 406.99026 354.43411" selectedId={visualPath} onPartPress={(id) => setVisualPath(id)} selectedColor={colors.primary} />
        </View>
        {visualPath && <Text style={[styles.visualSelection, { color: colors.primaryDark }]}>المسار البصري المحدد: {(MUSCLE_SVG_PARTS.find((part) => part.id === visualPath)?.index ?? 0) + 1}</Text>}
      </Card>

      {/* Body Map */}
      <Card style={styles.anatomyCard}>
        {Platform.OS === 'web' ? (
          <WebBodySilhouette
            gender={gender}
            view={view}
            selectedSlugs={selectedId ? [selectedId] : []}
            onFragmentPress={onSelect}
            numberForSlug={numberForSlug}
          />
        ) : (
          <BodySilhouette
            gender={gender}
            view={view}
            zoomable
            selectedSlugs={selectedId ? [selectedId] : []}
            onFragmentPress={onSelect}
            selectedFragmentColor={colors.primary}
            unselectedFragmentColor="#D9E9EA"
            outlineColor="#52737A"
            hitTolerance={10}
          />
        )}
      </Card>

      {/* Selection Pill */}
      {selectedId && (
        <View style={[styles.selectionPill, { backgroundColor: colors.primaryLight }]}>
          <Text style={[styles.selectionText, { color: colors.primaryDark }]}>
            الجزء رقم {numberForSlug(selectedId)} — {data.muscles[selectedId]?.labelAr}
          </Text>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <Button title="رجوع" onPress={onBack} variant="secondary" style={styles.actionButton} />
        <Button title="التالي" onPress={onNext} disabled={!selectedId} style={styles.actionButton} />
      </View>
    </View>
  );
};

const Chip = ({ label, active, onPress, colors }: any) => (
  <Pressable
    onPress={onPress}
    style={[
      styles.chip,
      {
        backgroundColor: active ? colors.primaryLight : colors.surface,
        borderColor: active ? colors.primary : colors.border,
      },
    ]}
  >
    <Text
      style={[
        styles.chipText,
        { color: active ? colors.primaryDark : colors.textSecondary },
      ]}
    >
      {label}
    </Text>
  </Pressable>
);

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
  },
  chips: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  chip: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  chipText: {
    fontFamily: Fonts.arabic.bold,
    fontSize: Fonts.sizes.sm,
  },
  searchWrapper: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
    zIndex: 10,
  },
  search: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontFamily: Fonts.arabic.regular,
    fontSize: Fonts.sizes.md,
  },
  searchResults: {
    borderTopWidth: 1,
  },
  searchRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderBottomWidth: 1,
  },
  searchText: {
    fontFamily: Fonts.arabic.medium,
    fontSize: Fonts.sizes.md,
    flex: 1,
    textAlign: 'right',
  },
  searchNumber: {
    fontFamily: Fonts.arabic.bold,
    fontSize: Fonts.sizes.md,
    marginLeft: Spacing.sm,
  },
  anatomyCard: {
    padding: Spacing.sm,
    marginBottom: Spacing.md,
  },
  visualCard: {
    marginBottom: Spacing.md,
  },
  visualTitle: {
    fontFamily: Fonts.arabic.bold,
    fontSize: Fonts.sizes.lg,
    textAlign: 'right',
    marginBottom: Spacing.xs,
  },
  visualHint: {
    fontFamily: Fonts.arabic.regular,
    fontSize: Fonts.sizes.sm,
    lineHeight: 21,
    textAlign: 'right',
    marginBottom: Spacing.md,
  },
  visualMap: {
    width: '100%',
    minHeight: 440,
    backgroundColor: '#F7FBFB',
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  visualSelection: {
    fontFamily: Fonts.arabic.bold,
    fontSize: Fonts.sizes.sm,
    textAlign: 'right',
    marginTop: Spacing.sm,
  },
  selectionPill: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  selectionText: {
    fontFamily: Fonts.arabic.bold,
    fontSize: Fonts.sizes.md,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row-reverse',
    gap: Spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
});
