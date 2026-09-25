import React, { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Notifications from 'expo-notifications';

type SavedReminder = { message: string; dateIso: string; notificationId?: string };
const KEY = 'bodymap-reminder-v2';
const defaultDate = () => { const d = new Date(Date.now() + 24 * 60 * 60 * 1000); d.setSeconds(0, 0); return d; };

export function LocalReminder() {
  const [value, setValue] = useState('');
  const [date, setDate] = useState(defaultDate());
  const [saved, setSaved] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time' | null>(null);
  useEffect(() => { AsyncStorage.getItem(KEY).then((raw) => { if (!raw) return; const item = JSON.parse(raw) as SavedReminder; setValue(item.message ?? ''); if (item.dateIso) setDate(new Date(item.dateIso)); }).catch(() => undefined); }, []);

  const save = async () => {
    const message = value.trim();
    if (!message) { Alert.alert('اكتب التذكير', 'اكتب ملاحظة قصيرة قبل الحفظ.'); return; }
    if (date.getTime() <= Date.now()) { Alert.alert('اختار موعدًا لاحقًا', 'موعد التذكير لازم يكون في المستقبل.'); return; }
    try {
      const previousRaw = await AsyncStorage.getItem(KEY);
      if (previousRaw && Platform.OS !== 'web') {
        const old = JSON.parse(previousRaw) as SavedReminder;
        if (old.notificationId) await Notifications.cancelScheduledNotificationAsync(old.notificationId).catch(() => undefined);
      }
      let notificationId: string | undefined;
      if (Platform.OS !== 'web') {
        let permission = await Notifications.getPermissionsAsync();
        if (permission.status !== 'granted') permission = await Notifications.requestPermissionsAsync();
        if (permission.status !== 'granted') { Alert.alert('التذكير محفوظ', 'تم حفظ النص، لكن لازم تسمح بالإشعارات عشان يوصلك تنبيه في موعده.'); }
        else notificationId = await Notifications.scheduleNotificationAsync({ content: { title: 'تذكير BodyMap Pain', body: message, sound: true }, trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date } });
      }
      await AsyncStorage.setItem(KEY, JSON.stringify({ message, dateIso: date.toISOString(), notificationId } satisfies SavedReminder));
      setSaved(true);
    } catch {
      Alert.alert('تعذر الحفظ', 'جرّب مرة تانية بعد مراجعة صلاحية الإشعارات ومساحة الجهاز.');
    }
  };

  const clear = async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw && Platform.OS !== 'web') { const item = JSON.parse(raw) as SavedReminder; if (item.notificationId) await Notifications.cancelScheduledNotificationAsync(item.notificationId).catch(() => undefined); }
      await AsyncStorage.removeItem(KEY); setValue(''); setSaved(false); setDate(defaultDate());
    } catch { setSaved(false); }
  };

  const dateInputValue = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  const webDateInput = Platform.OS === 'web' ? React.createElement('input', {
    type: 'datetime-local', value: dateInputValue, min: dateInputValue,
    onChange: (event: { target: { value: string } }) => { const next = new Date(event.target.value); if (!Number.isNaN(next.getTime())) { setDate(next); setSaved(false); } },
    'aria-label': 'موعد التذكير', style: { width: '100%', border: '1px solid #D9E4EA', borderRadius: 10, padding: 12, marginTop: 10, fontFamily: 'Arial' },
  }) : null;

  return <View style={styles.card}>
    <Text style={styles.title}>تذكير محلي اختياري</Text>
    <Text style={styles.hint}>على iOS وAndroid، يقدر النظام يعرض إشعارًا في الموعد بعد إذنك. ما بنبعتش بيانات التذكير لخادم.</Text>
    <TextInput value={value} onChangeText={(text) => { setValue(text); setSaved(false); }} placeholder="مثال: دوّن مستوى الألم بعد الراحة" placeholderTextColor="#8A9AA5" style={styles.input} textAlign="right" maxLength={160} />
    {Platform.OS === 'web' ? webDateInput : <>
      <View style={styles.dateActions}>
        <Pressable onPress={() => setPickerMode('date')} style={styles.dateButton}><Text style={styles.dateText}>اختار اليوم: {date.toLocaleDateString('ar-EG')}</Text></Pressable>
        <Pressable onPress={() => setPickerMode('time')} style={styles.dateButton}><Text style={styles.dateText}>اختار الساعة: {date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</Text></Pressable>
      </View>
      {pickerMode && <DateTimePicker value={date} mode={pickerMode} minimumDate={pickerMode === 'date' ? new Date(Date.now() + 60_000) : undefined} onChange={(_, selected) => {
        const mode = pickerMode; setPickerMode(null);
        if (selected) {
          const next = new Date(date);
          if (mode === 'date') next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
          else next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
          setDate(next); setSaved(false);
        }
      }} />}
    </>}
    <View style={styles.actions}><Pressable onPress={save} accessibilityRole="button" style={styles.button}><Text style={styles.buttonText}>{saved ? 'تم حفظ التذكير' : 'حفظ التذكير'}</Text></Pressable><Pressable onPress={clear} accessibilityRole="button" style={styles.clear}><Text style={styles.clearText}>مسح</Text></Pressable></View>
    {saved ? <Text style={styles.saved}>التذكير محفوظ على هذا الجهاز. إدارة الإشعارات من إعدادات الجهاز.</Text> : null}
  </View>;
}

const styles = StyleSheet.create({ card: { backgroundColor: '#F5F8FB', borderRadius: 18, padding: 16, marginTop: 14, borderWidth: 1, borderColor: '#D9E4EA' }, title: { color: '#203745', textAlign: 'right', fontWeight: '900', fontSize: 17 }, hint: { color: '#657781', textAlign: 'right', fontSize: 12, lineHeight: 19, marginTop: 5 }, input: { backgroundColor: '#FFF', borderRadius: 12, padding: 12, marginTop: 11, borderWidth: 1, borderColor: '#D9E4EA', color: '#203745' }, dateActions: { gap: 7, marginTop: 9 }, dateButton: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#D9E4EA', borderRadius: 10, padding: 12, marginTop: 4 }, dateText: { color: '#304E56', textAlign: 'right', fontSize: 12 }, actions: { flexDirection: 'row-reverse', gap: 8, marginTop: 10 }, button: { flex: 1, backgroundColor: '#0E7C86', borderRadius: 12, padding: 12, alignItems: 'center' }, buttonText: { color: '#FFF', fontWeight: '900' }, clear: { paddingHorizontal: 15, justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: '#D9E4EA', backgroundColor: '#FFF' }, clearText: { color: '#9B4545', fontWeight: '800' }, saved: { color: '#0B7774', fontSize: 11, textAlign: 'right', marginTop: 9 } });
