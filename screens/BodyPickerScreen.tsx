// screens/BodyPickerScreen.tsx
// ============================================================================
// شاشة خريطة الجسم التفاعلية — تختار عضلة/عضلات من silhouette SVG،
// وتعرض الأعراض الطبية المرتبطة بها من MUSCLE_MAP.
// ----------------------------------------------------------------------------
// v1: ربط WebBodySilhouette + useMuscleSelection + muscleMapping
// ============================================================================

import React, { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Colors } from '../constants/colors';
import { Fonts } from '../constants/fonts';
import { Palette, Gradients, Radii, Elevation, Type } from '../constants/design';
import { Gradient } from '../components/Gradient';
import { useTheme } from '../hooks/useTheme';
import { translate, type Language } from '../services/i18n';
import WebBodySilhouette from '../components/WebBodySilhouette';
import { useMuscleSelection } from '../hooks/useMuscleSelection';
import {
  BODY_REGION_LABELS,
  BODY_VIEW_LABELS,
  type BodyView,
  type MuscleEntry,
} from '../services/medical/muscleMapping';

interface BodyPickerScreenProps {
  language: Language;
  direction: 'rtl' | 'ltr';
  onAskAssistant?: (muscles: MuscleEntry[]) => void;
}

export const BodyPickerScreen: React.FC<BodyPickerScreenProps> = ({
  language,
  direction,
  onAskAssistant,
}) => {
  const { colors } = useTheme();
  const t = (key: string) => translate(language, key);
  const rtl = direction === 'rtl';
  const align = rtl ? 'right' : 'left';
  const row = rtl ? 'row-reverse' : 'row';

  const [view, setView] = useState<BodyView>('front');

  const selection = useMuscleSelection({ onlyMapped: true });

  const selectedMuscles = useMemo(
    () => selection.getSelectedMuscles(),
    [selection],
  );

  const relatedConditions = useMemo(
    () => selection.getRelatedConditions(),
    [selection],
  );

  const handleFragmentPress = useCallback(
    (slug: string) => {
      selection.toggleMuscle(slug);
    },
    [selection],
  );

  const handleAskAssistant = useCallback(() => {
    if (onAskAssistant && selectedMuscles.length > 0) {
      onAskAssistant(selectedMuscles);
    }
  }, [onAskAssistant, selectedMuscles]);

  // إحصاءات العضلات المختارة لكل view
  const selectedByView = useMemo(() => {
    return {
      front: selectedMuscles.filter((m) => m.view === 'front').length,
      back: selectedMuscles.filter((m) => m.view === 'back').length,
    };
  }, [selectedMuscles]);

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      {/* رأس الشاشة */}
      <View
        style={[
          styles.header,
          { backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
        <Text
          style={[
            styles.headerTitle,
            { color: colors.textPrimary, textAlign: align },
          ]}
        >
          {t('bodyPicker.title')}
        </Text>
        <Text
          style={[
            styles.headerSubtitle,
            { color: colors.textSecondary, textAlign: align },
          ]}
        >
          {t('bodyPicker.instruction')}
        </Text>
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* مبدّل العرض (أمامي/خلفي) */}
        <View style={[styles.viewSwitcher, { flexDirection: row }]}>
          {(['front', 'back'] as BodyView[]).map((v) => {
            const active = view === v;
            const label = BODY_VIEW_LABELS[v][language];
            const count = selectedByView[v];
            return (
              <Pressable
                key={v}
                onPress={() => setView(v)}
                style={[
                  styles.viewButton,
                  {
                    backgroundColor: active ? Palette.teal500 : colors.surface,
                    borderColor: active ? Palette.teal500 : colors.border,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={label}
              >
                <Text
                  style={[
                    styles.viewButtonText,
                    { color: active ? Palette.white : colors.textPrimary },
                  ]}
                >
                  {label}
                  {count > 0 ? ` · ${count}` : ''}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* الخريطة */}
        <View style={styles.mapWrap}>
          <WebBodySilhouette
            view={view}
            selectedSlugs={selection.selectedIds}
            onFragmentPress={handleFragmentPress}
            width={340}
          />
        </View>

        {/* لوحة العضلات المختارة */}
        <View
          style={[
            styles.panel,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          {/* رأس اللوحة */}
          <View style={[styles.panelHead, { flexDirection: row }]}>
            <Text
              style={[
                styles.panelTitle,
                { color: colors.textPrimary, textAlign: align, flex: 1 },
              ]}
            >
              {t('bodyPicker.selectedMuscles')}
              {selection.count > 0 ? ` (${selection.count})` : ''}
            </Text>
            {selection.count > 0 && (
              <Pressable
                onPress={selection.clearSelection}
                style={[
                  styles.clearBtn,
                  { borderColor: colors.border, backgroundColor: colors.backgroundAlt },
                ]}
                accessibilityRole="button"
                accessibilityLabel={t('bodyPicker.clearSelection')}
              >
                <Text style={[styles.clearBtnText, { color: colors.textSecondary }]}>
                  ✕ {t('bodyPicker.clearSelection')}
                </Text>
              </Pressable>
            )}
          </View>

          {/* فاضي */}
          {selection.count === 0 && (
            <Text
              style={[
                styles.emptyText,
                { color: colors.textSecondary, textAlign: align },
              ]}
            >
              {t('bodyPicker.noSelection')}
            </Text>
          )}

          {/* العضلات المختارة */}
          {selectedMuscles.map((muscle) => (
            <View
              key={muscle.id}
              style={[
                styles.muscleCard,
                { backgroundColor: colors.backgroundAlt, borderColor: colors.border },
              ]}
            >
              <View style={[styles.muscleHead, { flexDirection: row }]}>
                <View style={styles.muscleDot} />
                <Text
                  style={[
                    styles.muscleName,
                    { color: colors.textPrimary, textAlign: align, flex: 1 },
                  ]}
                >
                  {muscle.name}
                </Text>
                <Pressable
                  onPress={() => selection.deselectMuscle(muscle.id)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`remove ${muscle.name}`}
                >
                  <Text style={[styles.muscleRemove, { color: colors.textLight }]}>✕</Text>
                </Pressable>
              </View>
              <Text
                style={[
                  styles.muscleMeta,
                  { color: colors.textSecondary, textAlign: align },
                ]}
              >
                {BODY_REGION_LABELS[muscle.region][language]} · {muscle.muscleGroup}
              </Text>
            </View>
          ))}

          {/* الأعراض المرتبطة */}
          {relatedConditions.length > 0 && (
            <View style={styles.conditionsWrap}>
              <Text
                style={[
                  styles.sectionLabel,
                  { color: colors.textSecondary, textAlign: align },
                ]}
              >
                {t('bodyPicker.relatedConditions')}
              </Text>
              <View style={[styles.chipsWrap, { flexDirection: row }]}>
                {relatedConditions.map((condition) => (
                  <View
                    key={condition}
                    style={[
                      styles.chip,
                      { backgroundColor: colors.backgroundAlt, borderColor: colors.border },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: colors.textPrimary }]}>
                      {condition}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* الأزرار */}
          {selection.count > 0 && (
            <View style={styles.actions}>
              {onAskAssistant && (
                <Pressable
                  onPress={handleAskAssistant}
                  style={[styles.primaryBtn, { flexDirection: row }]}
                  accessibilityRole="button"
                  accessibilityLabel={t('bodyPicker.askAssistant')}
                >
                  <Gradient
                    colors={Gradients.brand}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <Text style={styles.primaryBtnGlyph}>✦</Text>
                  <Text style={styles.primaryBtnText}>
                    {t('bodyPicker.askAssistant')}
                  </Text>
                </Pressable>
              )}
            </View>
          )}
        </View>

        {/* تنبيه طبي */}
        <View
          style={[
            styles.notice,
            { borderColor: Palette.amber, backgroundColor: '#FFFBEB' },
          ]}
        >
          <Text style={[styles.noticeText, { color: '#B45309', textAlign: align }]}>
            ⚠ {t('notDiagnosis')}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

export default BodyPickerScreen;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 6,
  },
  headerTitle: {
    fontFamily: Fonts.arabic.bold,
    fontSize: Type.h3,
    fontWeight: Type.weight.black,
  },
  headerSubtitle: {
    fontFamily: Fonts.arabic.regular,
    fontSize: Type.caption,
    lineHeight: 20,
  },
  scrollContent: { padding: 16, paddingBottom: 40, gap: 14 },
  viewSwitcher: { gap: 8, justifyContent: 'center' },
  viewButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: Radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewButtonText: {
    fontFamily: Fonts.arabic.bold,
    fontSize: Type.bodySm,
    fontWeight: Type.weight.bold,
  },
  mapWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  panel: {
    borderRadius: Radii.lg,
    borderWidth: 1,
    padding: 14,
    gap: 10,
    ...Elevation.sm,
  },
  panelHead: { alignItems: 'center', gap: 8 },
  panelTitle: {
    fontFamily: Fonts.arabic.bold,
    fontSize: Type.body,
    fontWeight: Type.weight.black,
  },
  clearBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radii.pill,
    borderWidth: 1,
  },
  clearBtnText: {
    fontFamily: Fonts.arabic.medium,
    fontSize: Type.micro,
  },
  emptyText: {
    fontFamily: Fonts.arabic.regular,
    fontSize: Type.bodySm,
    lineHeight: 21,
  },
  muscleCard: {
    borderRadius: Radii.md,
    borderWidth: 1,
    padding: 11,
    gap: 4,
  },
  muscleHead: { alignItems: 'center', gap: 8 },
  muscleDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: Palette.coral,
  },
  muscleName: {
    fontFamily: Fonts.arabic.bold,
    fontSize: Type.bodySm,
    fontWeight: Type.weight.bold,
  },
  muscleRemove: { fontSize: 14, fontWeight: '900' },
  muscleMeta: {
    fontFamily: Fonts.arabic.regular,
    fontSize: Type.caption,
  },
  conditionsWrap: { gap: 6, marginTop: 4 },
  sectionLabel: {
    fontFamily: Fonts.arabic.bold,
    fontSize: Type.micro,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  chipsWrap: { flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radii.pill,
    borderWidth: 1,
  },
  chipText: {
    fontFamily: Fonts.arabic.medium,
    fontSize: Type.caption,
  },
  actions: { gap: 8, marginTop: 6 },
  primaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: Radii.md,
    overflow: 'hidden',
    ...Elevation.glowTeal,
  },
  primaryBtnGlyph: { color: Palette.white, fontSize: 15, fontWeight: '900' },
  primaryBtnText: {
    color: Palette.white,
    fontFamily: Fonts.arabic.bold,
    fontSize: Type.bodySm,
    fontWeight: Type.weight.black,
  },
  notice: {
    borderWidth: 1.5,
    borderRadius: Radii.md,
    padding: 11,
    marginTop: 4,
  },
  noticeText: {
    fontFamily: Fonts.arabic.medium,
    fontSize: Type.caption,
    lineHeight: 19,
  },
});
