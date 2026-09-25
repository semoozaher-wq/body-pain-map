import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '../constants/colors';
import { useTheme } from '../hooks/useTheme';

/**
 * إخلاء مسؤولية طبي ثابت يظهر في كل الشاشات.
 * يوضح أن التطبيق توعوي، وأن النتائج احتمالات وليست تشخيصًا.
 */
export function PersistentDisclaimer({ compact = false }: { compact?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.bar, { backgroundColor: colors.warningLight, borderTopColor: colors.warning }]}>
      <Text style={[styles.text, { color: colors.textPrimary }, compact && styles.compact]} numberOfLines={compact ? 2 : undefined}>
        ⚕️ تطبيق توعوي لا يقدّم تشخيصًا طبيًا. النتائج احتمالات مبدئية، وقد يتشابه أكثر من حالة في نفس الأعراض. غياب التنبيه لا يعني أن الحالة آمنة؛ وعند ضيق النفس أو الإغماء اطلب المساعدة العاجلة.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { borderTopWidth: 1, paddingHorizontal: 14, paddingVertical: 6 },
  text: { fontSize: 9.5, lineHeight: 15, textAlign: 'right' },
  compact: { fontSize: 9, lineHeight: 13 },
});

// Colors imported to keep the theme contract explicit for future styling.
export const DisclaimerPalette = Colors;
