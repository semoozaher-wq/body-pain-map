// screens/DetailsScreen.tsx

import React from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';
import { Fonts } from '../constants/fonts';
import { Spacing, BorderRadius } from '../constants/spacing';
import { Button } from '../components/Button';
import { Accordion } from '../components/Accordion';
import { useTheme } from '../hooks/useTheme';
import { PAIN_TYPES, DURATIONS, RED_FLAGS } from '../constants/appConstants';

interface DetailsScreenProps {
  intensity: number;
  setIntensity: (v: number) => void;
  painType: string;
  setPainType: (v: string) => void;
  duration: string;
  setDuration: (v: string) => void;
  note: string;
  setNote: (v: string) => void;
  redFlags: string[];
  setRedFlags: (v: string[]) => void;
  onBack: () => void;
  onNext: () => void;
}

export const DetailsScreen: React.FC<DetailsScreenProps> = ({
  intensity,
  setIntensity,
  painType,
  setPainType,
  duration,
  setDuration,
  note,
  setNote,
  redFlags,
  setRedFlags,
  onBack,
  onNext,
}) => {
  const { colors } = useTheme();

  const toggleFlag = (flag: string) => {
    setRedFlags(redFlags.includes(flag) ? redFlags.filter((f) => f !== flag) : [...redFlags, flag]);
  };

  return (
    <View style={styles.container}>
      <Accordion title="شدة الألم" icon="📊" defaultOpen>
        <Text style={[styles.question, { color: colors.textPrimary }]}>اختر رقمًا من 0 إلى 10</Text>
        <View style={styles.scale}>
          {Array.from({ length: 11 }, (_, n) => (
            <Pressable
              key={n}
              onPress={() => setIntensity(n)}
              style={[
                styles.scaleDot,
                { backgroundColor: n <= intensity ? colors.primary : colors.borderLight },
              ]}
            >
              <Text style={[styles.scaleText, { color: n <= intensity ? '#FFF' : colors.textSecondary }]}>
                {n}
              </Text>
            </Pressable>
          ))}
        </View>
      </Accordion>

      <Accordion title="نوع الألم" icon="⚡">
        <View style={styles.chips}>
          {PAIN_TYPES.map((type) => (
            <Chip key={type} label={type} active={type === painType} onPress={() => setPainType(type)} colors={colors} />
          ))}
        </View>
      </Accordion>

      <Accordion title="منذ متى بدأ؟" icon="⏱️">
        <View style={styles.chips}>
          {DURATIONS.map((d) => (
            <Chip key={d} label={d} active={d === duration} onPress={() => setDuration(d)} colors={colors} />
          ))}
        </View>
      </Accordion>

      <Accordion title="علامات تستدعي المساعدة العاجلة" icon="⚠️" isWarning>
        <Text style={[styles.hint, { color: colors.danger }]}>
          إذا ظهرت أي علامة، لا تؤخر طلب الرعاية الطبية.
        </Text>
        <View style={styles.flagList}>
          {RED_FLAGS.map((flag) => (
            <Pressable
              key={flag}
              onPress={() => toggleFlag(flag)}
              style={[
                styles.flagRow,
                {
                  backgroundColor: redFlags.includes(flag) ? colors.dangerLight : colors.backgroundAlt,
                  borderColor: redFlags.includes(flag) ? colors.danger : colors.border,
                },
              ]}
            >
              <Text style={[styles.flagCheck, { color: colors.danger }]}>
                {redFlags.includes(flag) ? '✓' : '○'}
              </Text>
              <Text style={[styles.flagText, { color: colors.textPrimary }]}>{flag}</Text>
            </Pressable>
          ))}
        </View>
      </Accordion>

      <Accordion title="ملاحظات إضافية" icon="📝">
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="مثال: يزداد مع الحركة..."
          placeholderTextColor={colors.textLight}
          multiline
          maxLength={500}
          style={[
            styles.noteInput,
            { color: colors.textPrimary, backgroundColor: colors.backgroundAlt, borderColor: colors.border },
          ]}
          textAlign="right"
        />
        <Text style={[styles.charHint, { color: colors.textLight }]}>{note.length}/500</Text>
      </Accordion>

      <View style={styles.actions}>
        <Button title="رجوع" onPress={onBack} variant="secondary" style={styles.actionButton} />
        <Button title="عرض الإرشاد" onPress={onNext} style={styles.actionButton} />
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
    <Text style={[styles.chipText, { color: active ? colors.primaryDark : colors.textSecondary }]}>{label}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
  },
  question: {
    fontFamily: Fonts.arabic.bold,
    fontSize: Fonts.sizes.md,
    marginBottom: Spacing.md,
  },
  scale: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  scaleDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scaleText: {
    fontSize: Fonts.sizes.xs,
    fontFamily: Fonts.arabic.bold,
  },
  chips: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: Spacing.sm,
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
  hint: {
    fontFamily: Fonts.arabic.regular,
    fontSize: Fonts.sizes.sm,
    marginBottom: Spacing.md,
    textAlign: 'right',
  },
  flagList: {
    gap: Spacing.sm,
  },
  flagRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  flagCheck: {
    fontSize: 20,
    fontWeight: '900',
  },
  flagText: {
    flex: 1,
    textAlign: 'right',
    fontFamily: Fonts.arabic.medium,
    fontSize: Fonts.sizes.sm,
  },
  noteInput: {
    minHeight: 90,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    fontFamily: Fonts.arabic.regular,
    fontSize: Fonts.sizes.md,
    textAlignVertical: 'top',
  },
  charHint: {
    fontSize: Fonts.sizes.xs,
    textAlign: 'right',
    marginTop: Spacing.xs,
  },
  actions: {
    flexDirection: 'row-reverse',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  actionButton: {
    flex: 1,
  },
});
