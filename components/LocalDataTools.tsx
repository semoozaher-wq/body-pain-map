import React, { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import type { Checkup } from '../types';

type Props = { records: Checkup[]; onImport: (records: Checkup[]) => void };
type BackupFile = { app: 'BodyMap Pain'; version: 1; exportedAt: string; records: Checkup[] };

function isRecord(value: unknown): value is Checkup {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<Checkup>;
  return typeof item.id === 'string'
    && typeof item.partId === 'string'
    && typeof item.intensity === 'number'
    && item.intensity >= 0 && item.intensity <= 10
    && typeof item.painType === 'string'
    && typeof item.duration === 'string'
    && typeof item.createdAt === 'string';
}

export function LocalDataTools({ records, onImport }: Props) {
  const [message, setMessage] = useState('');
  const exportBackup = async () => {
    try {
      const backup: BackupFile = { app: 'BodyMap Pain', version: 1, exportedAt: new Date().toISOString(), records };
      const json = JSON.stringify(backup, null, 2);
      const fileName = `bodymap-backup-${new Date().toISOString().slice(0, 10)}.json`;
      if (Platform.OS === 'web') {
        const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = fileName;
        anchor.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else {
        const uri = `${FileSystem.documentDirectory}${fileName}`;
        await FileSystem.writeAsStringAsync(uri, json, { encoding: FileSystem.EncodingType.UTF8 });
        if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: 'نسخة احتياطية لسجل BodyMap Pain' });
        else Alert.alert('تم إنشاء النسخة الاحتياطية', uri);
      }
      setMessage(`تم تجهيز نسخة من ${records.length} سجل. الملف محفوظ عندك فقط.`);
    } catch {
      setMessage('حصلت مشكلة أثناء إنشاء النسخة. جرّب مرة ثانية.');
    }
  };

  const importBackup = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['application/json', '.json'], copyToCacheDirectory: true });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const contents = Platform.OS === 'web' && asset.file
        ? await asset.file.text()
        : await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.UTF8 });
      const parsed: unknown = JSON.parse(contents);
      const rawRecords = Array.isArray(parsed) ? parsed : (parsed as Partial<BackupFile>)?.records;
      if (!Array.isArray(rawRecords) || !rawRecords.every(isRecord)) {
        setMessage('الملف مش نسخة صالحة من سجل BodyMap Pain؛ مافيش أي بيانات اتغيرت.');
        return;
      }
      onImport(rawRecords);
      setMessage(`تم استيراد ${rawRecords.length} سجل ودمجهم من غير تكرار بالمعرّف.`);
    } catch {
      setMessage('تعذر قراءة الملف؛ اختار نسخة JSON سليمة.');
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>بياناتك تحت إيدك</Text>
      <Text style={styles.copy}>السجل بيتحفظ على الجهاز. صدّر نسخة JSON للنسخ الاحتياطي أو انقلها لجهاز تاني. مافيش حساب أو رفع للسحابة في النسخة دي.</Text>
      <View style={styles.actions}>
        <Pressable onPress={exportBackup} style={styles.primary} accessibilityRole="button"><Text style={styles.primaryText}>تصدير نسخة احتياطية</Text></Pressable>
        <Pressable onPress={importBackup} style={styles.secondary} accessibilityRole="button"><Text style={styles.secondaryText}>استيراد ودمج نسخة</Text></Pressable>
      </View>
      <Text style={styles.notice}>ملف النسخة يحتوي معلومات صحية شخصية؛ احفظه بمكان آمن. الاستيراد يضيف السجلات ولا يحذف الموجود.</Text>
      {message ? <Text accessibilityRole="text" style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, marginTop: 14, borderWidth: 1, borderColor: '#DCE8E8' },
  title: { color: '#143B43', fontSize: 16, fontWeight: '900', textAlign: 'right' },
  copy: { color: '#5B7074', textAlign: 'right', lineHeight: 21, fontSize: 12, marginTop: 6 },
  actions: { flexDirection: 'row-reverse', gap: 8, marginTop: 12 },
  primary: { flex: 1, padding: 12, borderRadius: 11, backgroundColor: '#0B7774', alignItems: 'center' },
  primaryText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
  secondary: { flex: 1, padding: 12, borderRadius: 11, backgroundColor: '#EAF5F3', alignItems: 'center', borderWidth: 1, borderColor: '#C9E2DE' },
  secondaryText: { color: '#0B6965', fontWeight: '800', fontSize: 12 },
  notice: { color: '#9A6A25', textAlign: 'right', lineHeight: 18, fontSize: 10, marginTop: 10 },
  message: { color: '#08756F', textAlign: 'right', fontSize: 11, marginTop: 9 },
});
