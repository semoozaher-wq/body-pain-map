// components/MedicalContactsCard.tsx
// بطاقة إدارة جهات الاتصال الطبية: إضافة / تعديل / حذف، مع تحديد جهة أساسية
// تظهر في لوحة الطوارئ. كل البيانات تُحفظ محليًّا على الجهاز (AsyncStorage) — بلا خادم.

import React, { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Fonts } from '../constants/fonts';
import { Spacing, BorderRadius } from '../constants/spacing';
import { useTheme } from '../hooks/useTheme';
import { useMedicalContacts } from '../hooks/useMedicalContacts';
import { translate } from '../services/i18n';
import type { MedicalContact } from '../types';

type Language = Parameters<typeof translate>[0];

interface MedicalContactsCardProps {
  language: Language;
  direction: 'rtl' | 'ltr';
}

export function MedicalContactsCard({ language, direction }: MedicalContactsCardProps) {
  const { colors } = useTheme();
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const rtl = direction === 'rtl';
  const align = rtl ? 'right' : 'left';

  const { contacts, saveContact, removeContact } = useMedicalContacts();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relation, setRelation] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [error, setError] = useState('');

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setPhone('');
    setRelation('');
    setIsPrimary(false);
    setError('');
  };

  const startEdit = (contact: MedicalContact) => {
    setEditingId(contact.id);
    setName(contact.name);
    setPhone(contact.phone);
    setRelation(contact.relation);
    setIsPrimary(contact.isPrimary);
    setError('');
  };

  const submit = () => {
    if (!name.trim()) { setError(t('contacts.invalidName')); return; }
    const result = saveContact({ id: editingId ?? undefined, name, phone, relation, isPrimary });
    if (result === 'name_required') { setError(t('contacts.invalidName')); return; }
    if (result) { setError(t('contacts.invalidPhone')); return; }
    resetForm();
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.textPrimary, textAlign: align }]}>{t('contacts.title')}</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary, textAlign: align }]}>{t('contacts.subtitle')}</Text>

      {/* النموذج */}
      <TextInput value={name} onChangeText={setName} placeholder={t('contacts.namePlaceholder')} placeholderTextColor={colors.textLight} maxLength={60} style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.backgroundAlt, borderColor: colors.border, textAlign: align }]} />
      <TextInput value={phone} onChangeText={setPhone} placeholder={t('contacts.phonePlaceholder')} placeholderTextColor={colors.textLight} keyboardType="phone-pad" maxLength={20} style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.backgroundAlt, borderColor: colors.border, textAlign: align }]} />
      <TextInput value={relation} onChangeText={setRelation} placeholder={t('contacts.relationPlaceholder')} placeholderTextColor={colors.textLight} maxLength={40} style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.backgroundAlt, borderColor: colors.border, textAlign: align }]} />

      <View style={[styles.switchRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
        <Switch value={isPrimary} onValueChange={setIsPrimary} />
        <Text style={[styles.switchLabel, { color: colors.textSecondary, textAlign: align }]}>{t('contacts.primaryLabel')}</Text>
      </View>

      {error ? <Text accessibilityRole="alert" style={[styles.error, { color: colors.danger, textAlign: align }]}>{error}</Text> : null}

      <View style={[styles.actions, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
        <Pressable onPress={submit} accessibilityRole="button" style={[styles.primary, { backgroundColor: colors.primary }]}>
          <Text style={styles.primaryText}>{editingId ? t('contacts.update') : t('contacts.add')}</Text>
        </Pressable>
        {editingId ? (
          <Pressable onPress={resetForm} accessibilityRole="button" style={[styles.secondary, { borderColor: colors.border, backgroundColor: colors.backgroundAlt }]}>
            <Text style={[styles.secondaryText, { color: colors.textSecondary }]}>{t('emergency.cancel')}</Text>
          </Pressable>
        ) : null}
      </View>

      {/* القائمة */}
      {contacts.length === 0 ? (
        <Text style={[styles.empty, { color: colors.textSecondary, textAlign: align }]}>{t('contacts.empty')}</Text>
      ) : (
        <View style={styles.list}>
          {contacts.map((contact) => (
            <View key={contact.id} style={[styles.row, { flexDirection: rtl ? 'row-reverse' : 'row', borderColor: colors.border, backgroundColor: colors.backgroundAlt }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowName, { color: colors.textPrimary, textAlign: align }]}>
                  {contact.isPrimary ? '★ ' : ''}{contact.name}{contact.relation ? ` · ${contact.relation}` : ''}
                </Text>
                <Text style={[styles.rowPhone, { color: colors.textSecondary, textAlign: align }]}>{contact.phone}</Text>
              </View>
              <Pressable onPress={() => startEdit(contact)} accessibilityRole="button" style={styles.rowAction}><Text style={[styles.rowActionText, { color: colors.primary }]}>{t('contacts.update')}</Text></Pressable>
              <Pressable onPress={() => removeContact(contact.id)} accessibilityRole="button" style={styles.rowAction}><Text style={[styles.rowActionText, { color: colors.danger }]}>{t('contacts.delete')}</Text></Pressable>
            </View>
          ))}
        </View>
      )}

      <Text style={[styles.notice, { color: colors.textLight, textAlign: align }]}>🔒 {t('contacts.localNotice')}</Text>
    </View>
  );
}

export default MedicalContactsCard;

const styles = StyleSheet.create({
  card: { borderRadius: BorderRadius.lg, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.md },
  title: { fontFamily: Fonts.arabic.bold, fontSize: Fonts.sizes.lg, fontWeight: '900' },
  subtitle: { fontFamily: Fonts.arabic.regular, fontSize: Fonts.sizes.sm, marginTop: Spacing.xs, marginBottom: Spacing.md },
  input: { borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.md, marginTop: Spacing.sm, fontFamily: Fonts.arabic.regular, fontSize: Fonts.sizes.sm, minHeight: 46 },
  switchRow: { alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.md },
  switchLabel: { fontFamily: Fonts.arabic.regular, fontSize: Fonts.sizes.sm, flex: 1 },
  error: { fontFamily: Fonts.arabic.bold, fontSize: Fonts.sizes.sm, marginTop: Spacing.sm, fontWeight: '800' },
  actions: { gap: Spacing.sm, marginTop: Spacing.md },
  primary: { flex: 1, borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: 'center' },
  primaryText: { color: '#FFFFFF', fontFamily: Fonts.arabic.bold, fontWeight: '900', fontSize: Fonts.sizes.sm },
  secondary: { paddingHorizontal: Spacing.md, justifyContent: 'center', borderRadius: BorderRadius.md, borderWidth: 1 },
  secondaryText: { fontFamily: Fonts.arabic.bold, fontWeight: '800', fontSize: Fonts.sizes.sm },
  empty: { fontFamily: Fonts.arabic.regular, fontSize: Fonts.sizes.sm, marginTop: Spacing.md },
  list: { gap: Spacing.sm, marginTop: Spacing.md },
  row: { borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: 'center', gap: Spacing.sm },
  rowName: { fontFamily: Fonts.arabic.bold, fontSize: Fonts.sizes.sm, fontWeight: '800' },
  rowPhone: { fontFamily: Fonts.arabic.regular, fontSize: Fonts.sizes.xs, marginTop: 2 },
  rowAction: { paddingHorizontal: Spacing.sm, paddingVertical: 4 },
  rowActionText: { fontFamily: Fonts.arabic.bold, fontWeight: '900', fontSize: Fonts.sizes.xs },
  notice: { fontFamily: Fonts.arabic.regular, fontSize: Fonts.sizes.xs, lineHeight: 17, marginTop: Spacing.md },
});
