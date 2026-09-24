import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Organ = {
  id: string;
  nameAr: string;
  location: string;
  symptoms: string[];
  commonCauses: string[];
  warning: string;
  recommendation: string;
};

type Props = { organ: Organ; onPress?: () => void };

export function InternalOrganCard({ organ, onPress }: Props) {
  const content = (
    <>
      <View style={styles.header}>
        <Text style={styles.icon}>+</Text>
        <Text style={styles.name}>{organ.nameAr}</Text>
      </View>
      <Text style={styles.location}>{organ.location}</Text>
      <Text style={styles.label}>أعراض قد تصاحب الألم</Text>
      <Text style={styles.body}>{organ.symptoms.slice(0, 3).join(' • ')}</Text>
      <Text style={styles.label}>أسباب محتملة</Text>
      <Text style={styles.body}>{organ.commonCauses.slice(0, 3).join(' • ')}</Text>
      <View style={styles.warningBox}>
        <Text style={styles.warning}>{organ.warning}</Text>
      </View>
      <Text style={styles.recommendation}>الإرشاد الأولي: {organ.recommendation}</Text>
    </>
  );

  return onPress ? <Pressable onPress={onPress} style={styles.card}>{content}</Pressable> : <View style={styles.card}>{content}</View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#D9E7EA', padding: 16, marginBottom: 12 },
  header: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  icon: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#E5F5F2', color: '#0E6972', textAlign: 'center', lineHeight: 30, fontWeight: '900', fontSize: 20 },
  name: { flex: 1, color: '#173D48', fontSize: 18, fontWeight: '900', textAlign: 'right' },
  location: { color: '#60757D', textAlign: 'right', fontSize: 13, marginTop: 7 },
  label: { color: '#0E6972', fontSize: 13, fontWeight: '900', textAlign: 'right', marginTop: 11 },
  body: { color: '#315B63', textAlign: 'right', lineHeight: 21, marginTop: 3 },
  warningBox: { backgroundColor: '#FFF7E6', borderRadius: 10, borderWidth: 1, borderColor: '#F3D59A', padding: 9, marginTop: 11 },
  warning: { color: '#7A5600', textAlign: 'right', lineHeight: 20, fontSize: 12 },
  recommendation: { color: '#315B63', textAlign: 'right', lineHeight: 20, fontSize: 12, marginTop: 10 },
});
