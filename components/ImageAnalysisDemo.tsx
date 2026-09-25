// components/ImageAnalysisDemo.tsx
//
// نسخة محدّثة: تستدعي طبقة التحليل السريري (فحص الجودة + الفرز القائم على القواعد)
// قبل أي استدعاء لنموذج ذكي، وتستخدم الأسئلة الديناميكية.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ClinicalAnalysisPanel } from './ClinicalAnalysisPanel';

export function ImageAnalysisDemo({ groupKey }: { groupKey?: string }) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.lead}>تحليل مبدئي تجريبي — نتائج احتمالية إرشادية وليست تشخيصًا طبيًا.</Text>
      <ClinicalAnalysisPanel groupKey={groupKey} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginTop: 14 },
  lead: { color: '#7882A5', fontSize: 11, textAlign: 'right', lineHeight: 18 },
});
