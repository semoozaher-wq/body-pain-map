// components/EmergencyPanel.tsx
// لوحة الطوارئ: أرقام الطوارئ حسب البلد + جهة الاتصال الطبية الأساسية.
//
// ⚠️ كل الأرقام قيم افتراضية تحتاج تأكيدًا — راجع data/emergencyNumbers.json
// وservices/emergencyCore.js. الواجهة تُظهر إخلاء مسؤولية وتطلب تأكيدًا قبل
// فتح تطبيق الهاتف، لأن دقّة الرقم مسؤولية المستخدم/المالك.
//
// تخزين محلي فقط: اختيار البلد وجهات الاتصال تُحفظ على الجهاز عبر AsyncStorage.

import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Fonts } from '../constants/fonts';
import { Spacing, BorderRadius } from '../constants/spacing';
import { useTheme } from '../hooks/useTheme';
import { useMedicalContacts } from '../hooks/useMedicalContacts';
import { translate } from '../services/i18n';
import {
  COUNTRIES,
  COUNTRY_STORAGE_KEY,
  DEFAULT_COUNTRY_CODE,
  getEmergencyNumbers,
  needsConfirmation,
  getCountryName,
  buildTelUrl,
} from '../services/emergencyCore.js';

type Language = Parameters<typeof translate>[0];

interface EmergencyPanelProps {
  language: Language;
  direction: 'rtl' | 'ltr';
}

export function EmergencyPanel({ language, direction }: EmergencyPanelProps) {
  const { colors } = useTheme();
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const rtl = direction === 'rtl';
  const align = rtl ? 'right' : 'left';

  const { primaryContact } = useMedicalContacts();
  const [countryCode, setCountryCode] = useState<string>(DEFAULT_COUNTRY_CODE);
  const [showCountries, setShowCountries] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(COUNTRY_STORAGE_KEY)
      .then((saved) => { if (saved) setCountryCode(saved); })
      .catch(() => undefined);
  }, []);

  const numbers = useMemo(() => getEmergencyNumbers(countryCode), [countryCode]);
  const countryName = useMemo(() => getCountryName(countryCode, language), [countryCode, language]);
  const needsConfirm = needsConfirmation(countryCode);

  const selectCountry = (code: string) => {
    setCountryCode(code);
    setShowCountries(false);
    AsyncStorage.setItem(COUNTRY_STORAGE_KEY, code).catch(() => undefined);
  };

  const placeCall = (telUrl: string, number: string) => {
    if (!telUrl) return;
    const message = t('emergency.callConfirm').split('{number}').join(number);
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(message)) window.location.href = telUrl;
      return;
    }
    Alert.alert(t('emergency.confirmTitle'), message, [
      { text: t('emergency.cancel'), style: 'cancel' },
      { text: t('emergency.confirm'), onPress: () => { Linking.openURL(telUrl).catch(() => undefined); } },
    ]);
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.dangerLight, borderColor: colors.danger }]}>
      <View style={[styles.head, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
        <View style={styles.icon}><Text style={styles.iconText}>✚</Text></View>
        <Text style={[styles.title, { color: colors.danger, textAlign: align, flex: 1 }]}>{t('emergency.title')}</Text>
      </View>
      <Text style={[styles.subtitle, { color: colors.textSecondary, textAlign: align }]}>{t('emergency.subtitle')}</Text>

      {/* اختيار البلد */}
      <Pressable onPress={() => setShowCountries((v) => !v)} accessibilityRole="button" style={[styles.countryRow, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <Text style={[styles.countryText, { color: colors.textPrimary, textAlign: align }]}>
          {t('emergency.countryLabel')}: {countryName}  ▾
        </Text>
      </Pressable>
      {showCountries && (
        <View style={[styles.countryGrid, { flexDirection: 'row-reverse' }]}>
          {COUNTRIES.map((country) => {
            const active = country.code === countryCode;
            const name = country.name[language] || country.name.ar;
            return (
              <Pressable key={country.code} onPress={() => selectCountry(country.code)} accessibilityRole="button" style={[styles.countryChip, { backgroundColor: active ? colors.primary : colors.surface, borderColor: active ? colors.primaryDark : colors.border }]}>
                <Text style={[styles.countryChipText, { color: active ? '#FFFFFF' : colors.textSecondary }]}>{name}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {needsConfirm && (
        <Text style={[styles.needsConfirm, { color: colors.warning, textAlign: align }]}>⚠ {t('emergency.needsConfirmation')}</Text>
      )}

      {/* أرقام الطوارئ */}
      <View style={styles.numberList}>
        {numbers.map((entry) => (
          <View key={entry.key} style={[styles.numberRow, { flexDirection: rtl ? 'row-reverse' : 'row', borderColor: colors.border, backgroundColor: colors.surface }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.numberLabel, { color: colors.textPrimary, textAlign: align }]}>{entry.label[language] || entry.label.ar}</Text>
              <Text style={[styles.numberValue, { color: colors.danger, textAlign: align }]}>{entry.number}</Text>
            </View>
            <Pressable onPress={() => placeCall(entry.telUrl, entry.number)} accessibilityRole="button" accessibilityLabel={`${t('emergency.call')} ${entry.number}`} style={[styles.callButton, { backgroundColor: colors.danger }]}>
              <Text style={styles.callButtonText}>{t('emergency.call')}</Text>
            </Pressable>
          </View>
        ))}
      </View>

      {/* جهة الاتصال الطبية الأساسية */}
      {primaryContact ? (
        <Pressable onPress={() => placeCall(buildTelUrl(primaryContact.phone), primaryContact.phone)} accessibilityRole="button" style={[styles.contactRow, { flexDirection: rtl ? 'row-reverse' : 'row', borderColor: colors.primary, backgroundColor: colors.surface }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.contactTag, { color: colors.primary, textAlign: align }]}>{t('emergency.primaryContact')}</Text>
            <Text style={[styles.contactName, { color: colors.textPrimary, textAlign: align }]}>{primaryContact.name}{primaryContact.relation ? ` · ${primaryContact.relation}` : ''}</Text>
          </View>
          <Text style={[styles.callButton, styles.contactCall, { backgroundColor: colors.primary }]}>{t('emergency.call')}</Text>
        </Pressable>
      ) : (
        <Text style={[styles.noContacts, { color: colors.textSecondary, textAlign: align }]}>{t('emergency.noContacts')}</Text>
      )}

      {/* إخلاء المسؤولية — جزء أساسي من الالتزام بالسلامة */}
      <Text style={[styles.disclaimer, { color: colors.textSecondary, textAlign: align }]}>{t('emergency.disclaimer')}</Text>
      <Text style={[styles.disclaimer, { color: colors.danger, textAlign: align }]}>{t('emergency.callEmergencyFirst')}</Text>
    </View>
  );
}

export default EmergencyPanel;

const styles = StyleSheet.create({
  card: { borderRadius: BorderRadius.lg, borderWidth: 2, padding: Spacing.lg, marginBottom: Spacing.md },
  head: { alignItems: 'center', gap: Spacing.sm },
  icon: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#DC2626', alignItems: 'center', justifyContent: 'center' },
  iconText: { color: '#FFFFFF', fontWeight: '900', fontSize: 15, lineHeight: 18 },
  title: { fontFamily: Fonts.arabic.bold, fontSize: Fonts.sizes.lg, fontWeight: '900' },
  subtitle: { fontFamily: Fonts.arabic.regular, fontSize: Fonts.sizes.sm, marginTop: Spacing.xs },
  countryRow: { borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.md, marginTop: Spacing.md },
  countryText: { fontFamily: Fonts.arabic.medium, fontSize: Fonts.sizes.sm },
  countryGrid: { flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.sm },
  countryChip: { borderWidth: 1, borderRadius: BorderRadius.sm, paddingVertical: 6, paddingHorizontal: 10 },
  countryChipText: { fontFamily: Fonts.arabic.medium, fontSize: Fonts.sizes.xs },
  needsConfirm: { fontFamily: Fonts.arabic.medium, fontSize: Fonts.sizes.xs, marginTop: Spacing.sm, fontWeight: '800' },
  numberList: { gap: Spacing.sm, marginTop: Spacing.md },
  numberRow: { borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: 'center', gap: Spacing.sm },
  numberLabel: { fontFamily: Fonts.arabic.regular, fontSize: Fonts.sizes.sm },
  numberValue: { fontFamily: Fonts.arabic.bold, fontSize: Fonts.sizes.lg, fontWeight: '900' },
  callButton: { borderRadius: BorderRadius.md, paddingVertical: 10, paddingHorizontal: 16, color: '#FFFFFF', fontFamily: Fonts.arabic.bold, fontWeight: '900', fontSize: Fonts.sizes.sm, overflow: 'hidden', textAlign: 'center' },
  callButtonText: { color: '#FFFFFF', fontFamily: Fonts.arabic.bold, fontWeight: '900', fontSize: Fonts.sizes.sm },
  contactRow: { borderWidth: 1.5, borderRadius: BorderRadius.md, padding: Spacing.md, marginTop: Spacing.md, alignItems: 'center', gap: Spacing.sm },
  contactTag: { fontFamily: Fonts.arabic.medium, fontSize: Fonts.sizes.xs, fontWeight: '800' },
  contactName: { fontFamily: Fonts.arabic.bold, fontSize: Fonts.sizes.md, fontWeight: '800', marginTop: 2 },
  contactCall: { overflow: 'hidden' },
  noContacts: { fontFamily: Fonts.arabic.regular, fontSize: Fonts.sizes.xs, marginTop: Spacing.md },
  disclaimer: { fontFamily: Fonts.arabic.regular, fontSize: Fonts.sizes.xs, lineHeight: 18, marginTop: Spacing.sm },
});
