// screens/SettingsScreen.tsx
// ============================================================================
// شاشة الإعدادات (البلوبرنت #14):
//   اللغة · الثيم · الصوت (تشغيل/إيقاف + السرعة + النطق التلقائي) ·
//   التنبيهات الطبية · سجل المحادثات · الخصوصية · معلومات التطبيق.
// ----------------------------------------------------------------------------
// كل الإعدادات تُحفظ محليًا فقط عبر AsyncStorage — لا سحابة ولا تسجيل دخول.
// تصميم متوافق مع RTL، وأهداف لمس كبيرة، ويلتفّ على الشاشات الصغيرة (#15).
// ============================================================================

import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Palette, Gradients, Radii, Elevation, Type } from '../constants/design';
import { Gradient } from '../components/Gradient';
import { useTheme } from '../hooks/useTheme';
import { useSettings } from '../hooks/useSettings';
import { useConversations } from '../hooks/useConversations';
import { translate, languageOrder, type Language } from '../services/i18n';

const APP_VERSION = '1.0.0';

interface SettingsScreenProps {
  language: Language;
  direction: 'rtl' | 'ltr';
  setLanguage: (language: Language) => void;
  onOpenAssistant: () => void;
}

type ThemeMode = 'light' | 'dark' | 'system';

const LANGUAGE_LABELS: Record<Language, string> = {
  ar: 'العربية',
  en: 'English',
  fr: 'Français',
};

export function SettingsScreen({ language, direction, setLanguage, onOpenAssistant }: SettingsScreenProps) {
  const { colors, mode, setThemeMode } = useTheme();
  const { settings, updateSettings, resetSettings } = useSettings();
  const { conversations, clearAll } = useConversations();
  const [confirmClear, setConfirmClear] = useState(false);

  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const rtl = direction === 'rtl';
  const align = rtl ? 'right' : 'left';
  const row = rtl ? 'row-reverse' : 'row';

  const themeOptions: Array<{ value: ThemeMode; label: string; glyph: string }> = [
    { value: 'light', label: t('settings.themeLight'), glyph: '☀️' },
    { value: 'dark', label: t('settings.themeDark'), glyph: '🌙' },
    { value: 'system', label: t('settings.themeSystem'), glyph: '📱' },
  ];

  const ratePercent = Math.round(settings.voiceRate * 100);
  const adjustRate = (delta: number) => updateSettings({ voiceRate: settings.voiceRate + delta });

  const renderCard = (title: string, glyph: string, children: React.ReactNode) => (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.cardHeader, { flexDirection: row }]}>
        <Text style={styles.cardGlyph}>{glyph}</Text>
        <Text style={[styles.cardTitle, { color: colors.textPrimary, textAlign: align }]}>{title}</Text>
      </View>
      {children}
    </View>
  );

  const renderToggleRow = (label: string, hint: string, value: boolean, onChange: (next: boolean) => void) => (
    <View style={[styles.toggleRow, { flexDirection: row, borderTopColor: colors.borderLight }]}>
      <View style={styles.toggleTexts}>
        <Text style={[styles.toggleLabel, { color: colors.textPrimary, textAlign: align }]}>{label}</Text>
        {!!hint && <Text style={[styles.toggleHint, { color: colors.textSecondary, textAlign: align }]}>{hint}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: Palette.teal400 }}
        thumbColor={value ? Palette.teal600 : '#FFFFFF'}
        accessibilityLabel={label}
      />
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* رأس الصفحة */}
      <View style={styles.hero}>
        <Gradient colors={Gradients.heroDeep} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <Text style={styles.heroGlyph}>⚙️</Text>
        <Text style={styles.heroTitle}>{t('settings.title')}</Text>
        <Text style={styles.heroText}>{t('settings.subtitle')}</Text>
      </View>

      {/* اللغة */}
      {renderCard(t('settings.language'), '🌐', (
        <View style={[styles.optionsRow, { flexDirection: row }]}>
          {languageOrder.map((code) => {
            const active = language === code;
            return (
              <Pressable
                key={code}
                onPress={() => setLanguage(code)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[
                  styles.optionChip,
                  { borderColor: colors.border, backgroundColor: colors.backgroundAlt },
                  active && styles.optionChipActive,
                ]}
              >
                <Text style={[styles.optionText, { color: colors.textPrimary }, active && styles.optionTextActive]}>
                  {LANGUAGE_LABELS[code]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}

      {/* الثيم */}
      {renderCard(t('settings.theme'), '🎨', (
        <View style={[styles.optionsRow, { flexDirection: row }]}>
          {themeOptions.map((option) => {
            const active = mode === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => setThemeMode(option.value)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[
                  styles.optionChip,
                  { borderColor: colors.border, backgroundColor: colors.backgroundAlt },
                  active && styles.optionChipActive,
                ]}
              >
                <Text style={styles.optionGlyph}>{option.glyph}</Text>
                <Text style={[styles.optionText, { color: colors.textPrimary }, active && styles.optionTextActive]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}

      {/* الصوت */}
      {renderCard(t('settings.voice'), '🔊', (
        <>
          {renderToggleRow(t('settings.voiceEnabled'), t('settings.voiceEnabledHint'), settings.voiceEnabled, (next) =>
            updateSettings({ voiceEnabled: next }),
          )}
          {renderToggleRow(t('settings.autoSpeak'), t('settings.autoSpeakHint'), settings.autoSpeakReplies, (next) =>
            updateSettings({ autoSpeakReplies: next }),
          )}
          <View style={[styles.rateRow, { flexDirection: row, borderTopColor: colors.borderLight }]}>
            <View style={styles.toggleTexts}>
              <Text style={[styles.toggleLabel, { color: colors.textPrimary, textAlign: align }]}>{t('settings.voiceSpeed')}</Text>
              <Text style={[styles.toggleHint, { color: colors.textSecondary, textAlign: align }]}>
                {t('settings.voiceSpeedHint')}
              </Text>
            </View>
            <View style={[styles.stepper, { flexDirection: row }]}>
              <Pressable
                onPress={() => adjustRate(-0.1)}
                disabled={settings.voiceRate <= 0.6}
                accessibilityRole="button"
                accessibilityLabel={t('settings.slower')}
                style={[styles.stepperButton, { borderColor: colors.border, backgroundColor: colors.backgroundAlt }, settings.voiceRate <= 0.6 && styles.stepperDisabled]}
              >
                <Text style={[styles.stepperGlyph, { color: colors.textPrimary }]}>−</Text>
              </Pressable>
              <Text style={[styles.rateValue, { color: colors.textPrimary }]}>{ratePercent}%</Text>
              <Pressable
                onPress={() => adjustRate(0.1)}
                disabled={settings.voiceRate >= 1.4}
                accessibilityRole="button"
                accessibilityLabel={t('settings.faster')}
                style={[styles.stepperButton, { borderColor: colors.border, backgroundColor: colors.backgroundAlt }, settings.voiceRate >= 1.4 && styles.stepperDisabled]}
              >
                <Text style={[styles.stepperGlyph, { color: colors.textPrimary }]}>+</Text>
              </Pressable>
            </View>
          </View>
        </>
      ))}

      {/* التنبيهات الطبية */}
      {renderCard(t('settings.medicalAlerts'), '🚨', (
        renderToggleRow(t('settings.medicalAlertsEnabled'), t('settings.medicalAlertsHint'), settings.medicalAlerts, (next) =>
          updateSettings({ medicalAlerts: next }),
        )
      ))}

      {/* سجل المحادثات */}
      {renderCard(t('settings.chatHistory'), '🗂️', (
        <View style={styles.historyBlock}>
          <Text style={[styles.historyCount, { color: colors.textPrimary, textAlign: align }]}>
            {t('settings.savedConversationsCount').replace('{count}', String(conversations.length))}
          </Text>
          <Text style={[styles.toggleHint, { color: colors.textSecondary, textAlign: align }]}>
            {t('settings.chatHistoryHint')}
          </Text>
          <View style={[styles.historyActions, { flexDirection: row }]}>
            <Pressable
              onPress={onOpenAssistant}
              accessibilityRole="button"
              style={[styles.actionButton, { borderColor: colors.border, backgroundColor: colors.backgroundAlt }]}
            >
              <Text style={[styles.actionText, { color: colors.primary }]}>{t('settings.openConversations')}</Text>
            </Pressable>
            {confirmClear ? (
              <>
                <Pressable
                  onPress={() => { clearAll(); setConfirmClear(false); }}
                  accessibilityRole="button"
                  style={[styles.actionButton, styles.dangerButton]}
                >
                  <Text style={styles.dangerText}>{t('settings.confirmClear')}</Text>
                </Pressable>
                <Pressable
                  onPress={() => setConfirmClear(false)}
                  accessibilityRole="button"
                  style={[styles.actionButton, { borderColor: colors.border, backgroundColor: colors.backgroundAlt }]}
                >
                  <Text style={[styles.actionText, { color: colors.textSecondary }]}>{t('settings.cancel')}</Text>
                </Pressable>
              </>
            ) : (
              <Pressable
                onPress={() => setConfirmClear(true)}
                disabled={conversations.length === 0}
                accessibilityRole="button"
                style={[styles.actionButton, { borderColor: Palette.coral, backgroundColor: colors.backgroundAlt }, conversations.length === 0 && styles.stepperDisabled]}
              >
                <Text style={[styles.actionText, { color: Palette.rose }]}>{t('settings.clearHistory')}</Text>
              </Pressable>
            )}
          </View>
        </View>
      ))}

      {/* الخصوصية */}
      {renderCard(t('settings.privacy'), '🔒', (
        <View style={styles.privacyBlock}>
          <Text style={[styles.privacyBadge, { color: Palette.teal700 }]}>{t('settings.privacyBadge')}</Text>
          <Text style={[styles.toggleHint, { color: colors.textSecondary, textAlign: align }]}>
            {t('settings.privacyText')}
          </Text>
        </View>
      ))}

      {/* معلومات التطبيق */}
      {renderCard(t('settings.about'), 'ℹ️', (
        <View style={styles.aboutBlock}>
          <View style={[styles.aboutRow, { flexDirection: row }]}>
            <Text style={[styles.aboutLabel, { color: colors.textSecondary, textAlign: align }]}>{t('settings.appName')}</Text>
            <Text style={[styles.aboutValue, { color: colors.textPrimary, textAlign: align }]}>{t('appName')}</Text>
          </View>
          <View style={[styles.aboutRow, { flexDirection: row }]}>
            <Text style={[styles.aboutLabel, { color: colors.textSecondary, textAlign: align }]}>{t('settings.version')}</Text>
            <Text style={[styles.aboutValue, { color: colors.textPrimary, textAlign: align }]}>{APP_VERSION}</Text>
          </View>
          <Text style={[styles.disclaimer, { color: colors.textSecondary, textAlign: align }]}>{t('medicalWarning')}</Text>
          <Pressable
            onPress={resetSettings}
            accessibilityRole="button"
            style={[styles.actionButton, styles.resetButton, { borderColor: colors.border }]}
          >
            <Text style={[styles.actionText, { color: colors.textSecondary }]}>{t('settings.reset')}</Text>
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  hero: { borderRadius: Radii.xl, padding: 20, overflow: 'hidden', gap: 6, ...Elevation.lg },
  heroGlyph: { fontSize: 26 },
  heroTitle: { color: '#FFFFFF', fontSize: Type.h2, fontWeight: '900' },
  heroText: { color: 'rgba(255,255,255,0.86)', fontSize: Type.bodySm, lineHeight: 20 },
  card: { borderWidth: 1, borderRadius: Radii.lg, padding: 16, gap: 10, ...Elevation.xs },
  cardHeader: { alignItems: 'center', gap: 8 },
  cardGlyph: { fontSize: 18 },
  cardTitle: { flex: 1, fontSize: Type.title, fontWeight: '900' },
  optionsRow: { flexWrap: 'wrap', gap: 8 },
  optionChip: { minHeight: 46, minWidth: 96, flexGrow: 1, borderWidth: 1, borderRadius: Radii.md, paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', gap: 3 },
  optionChipActive: { backgroundColor: Palette.teal600, borderColor: Palette.teal600 },
  optionGlyph: { fontSize: 16 },
  optionText: { fontSize: Type.bodySm, fontWeight: '800' },
  optionTextActive: { color: '#FFFFFF' },
  toggleRow: { alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 12, borderTopWidth: 1 },
  rateRow: { alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 12, borderTopWidth: 1 },
  toggleTexts: { flex: 1, gap: 2 },
  toggleLabel: { fontSize: Type.body, fontWeight: '800' },
  toggleHint: { fontSize: Type.caption, lineHeight: 17 },
  stepper: { alignItems: 'center', gap: 6 },
  stepperButton: { width: 44, height: 44, borderRadius: Radii.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stepperDisabled: { opacity: 0.4 },
  stepperGlyph: { fontSize: 22, fontWeight: '900' },
  rateValue: { minWidth: 52, textAlign: 'center', fontSize: Type.bodySm, fontWeight: '900' },
  historyBlock: { gap: 6 },
  historyCount: { fontSize: Type.body, fontWeight: '900' },
  historyActions: { flexWrap: 'wrap', gap: 8, marginTop: 6 },
  actionButton: { minHeight: 44, borderWidth: 1, borderRadius: Radii.pill, paddingHorizontal: 16, paddingVertical: 11, alignItems: 'center', justifyContent: 'center' },
  actionText: { fontSize: Type.bodySm, fontWeight: '800' },
  dangerButton: { backgroundColor: Palette.rose, borderColor: Palette.rose },
  dangerText: { color: '#FFFFFF', fontSize: Type.bodySm, fontWeight: '900' },
  privacyBlock: { gap: 6 },
  privacyBadge: { fontSize: Type.bodySm, fontWeight: '900' },
  aboutBlock: { gap: 8 },
  aboutRow: { alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  aboutLabel: { fontSize: Type.bodySm, fontWeight: '700' },
  aboutValue: { fontSize: Type.bodySm, fontWeight: '900' },
  disclaimer: { fontSize: Type.caption, lineHeight: 17, marginTop: 4 },
  resetButton: { alignSelf: 'flex-start', marginTop: 6 },
});

export default SettingsScreen;
