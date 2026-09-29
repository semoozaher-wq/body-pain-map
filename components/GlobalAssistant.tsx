// components/GlobalAssistant.tsx
// ============================================================================
// المساعد المركزي العائم (Global Assistant)
// ----------------------------------------------------------------------------
// زر عائم (FAB) متاح في كل شاشات التطبيق، يفتح لوحة حوار تدعم الكتابة والصوت.
// يعرض ردود المحرّك المركزي، وينفّذ الإجراءات المنظّمة عبر onAction، ويطلب
// تأكيدًا صريحًا قبل الإجراءات الحسّاسة (حفظ/مسح).
// ============================================================================

import { useCallback, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Gradient } from './Gradient';
import { Palette, Gradients, Radii, Elevation } from '../constants/design';
import { useAppAssistant } from '../hooks/useAppAssistant';
import type { AppState, AssistantAction, Lang } from '../services/appAssistant/types';

interface GlobalAssistantProps {
  appState: AppState;
  onAction: (action: AssistantAction) => void;
  language: Lang;
  direction: 'rtl' | 'ltr';
  /** موضع الزر العائم أسفل الشاشة (لتجنّب شريط التنقّل). */
  bottomOffset?: number;
}

const LABELS: Record<Lang, Record<string, string>> = {
  ar: {
    fab: 'المساعد',
    title: 'المساعد المركزي',
    subtitle: 'يتحكّم في كل التطبيق',
    placeholder: 'قول: روح للأعضاء… وريني القلب… اللي فوقه إيه؟',
    listening: 'أستمع… تكلّم الآن',
    send: 'إرسال',
    close: 'إغلاق',
    confirmTitle: 'هذا الإجراء يحتاج تأكيدًا',
    confirm: 'تأكيد',
    cancel: 'إلغاء',
    empty: 'اسألني عن أي حاجة في التطبيق: تنقّل، إبراز عنصر، أو مكان نسبي.',
  },
  en: {
    fab: 'Assistant',
    title: 'Central Assistant',
    subtitle: 'Controls the whole app',
    placeholder: 'Try: open the organs… show me the heart… what’s above it?',
    listening: 'Listening… speak now',
    send: 'Send',
    close: 'Close',
    confirmTitle: 'This action needs confirmation',
    confirm: 'Confirm',
    cancel: 'Cancel',
    empty: 'Ask me anything in the app: navigate, highlight, or relative location.',
  },
  fr: {
    fab: 'Assistant',
    title: 'Assistant central',
    subtitle: 'Contrôle toute l’app',
    placeholder: 'Essayez : ouvre les organes… montre le cœur… qu’y a-t-il au-dessus ?',
    listening: 'Écoute… parlez maintenant',
    send: 'Envoyer',
    close: 'Fermer',
    confirmTitle: 'Cette action nécessite une confirmation',
    confirm: 'Confirmer',
    cancel: 'Annuler',
    empty: 'Demandez-moi tout dans l’app : naviguer, mettre en évidence, position.',
  },
};

export function GlobalAssistant({ appState, onAction, language, direction, bottomOffset = 92 }: GlobalAssistantProps) {
  const t = LABELS[language] ?? LABELS.ar;
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const rtl = direction === 'rtl';

  const { messages, listening, interim, pending, send, toggleMic, confirmPending, cancelPending } = useAppAssistant({
    getState: () => appState,
    onAction,
    language,
  });

  const handleSend = useCallback(() => {
    if (!input.trim()) return;
    send(input);
    setInput('');
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
  }, [input, send]);

  return (
    <>
      {/* الزر العائم */}
      {!open && (
        <Pressable
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={t.fab}
          style={[styles.fab, { bottom: bottomOffset, [rtl ? 'left' : 'right']: 16 }]}
        >
          <Gradient colors={Gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <Text style={styles.fabGlyph}>✦</Text>
        </Pressable>
      )}

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
          <View style={styles.sheet}>
            {/* الرأس */}
            <View style={[styles.header, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
              <View style={styles.headerText}>
                <Text style={styles.title}>{t.title}</Text>
                <Text style={styles.subtitle}>{t.subtitle}</Text>
              </View>
              <Pressable onPress={() => setOpen(false)} accessibilityRole="button" accessibilityLabel={t.close} style={styles.closeBtn}>
                <Text style={styles.closeGlyph}>✕</Text>
              </Pressable>
            </View>

            {/* الرسائل */}
            <ScrollView ref={scrollRef} style={styles.messages} contentContainerStyle={styles.messagesContent}>
              {messages.length === 0 ? (
                <Text style={styles.empty}>{t.empty}</Text>
              ) : (
                messages.map((m) => (
                  <View
                    key={m.id}
                    style={[
                      styles.bubble,
                      m.role === 'user' ? styles.userBubble : styles.botBubble,
                      { alignSelf: m.role === 'user' ? (rtl ? 'flex-start' : 'flex-end') : (rtl ? 'flex-end' : 'flex-start') },
                    ]}
                  >
                    <Text style={m.role === 'user' ? styles.userText : styles.botText}>{m.text}</Text>
                    {m.role === 'assistant' && m.turn?.resolved?.length ? (
                      <View style={styles.chipsRow}>
                        {m.turn.resolved.map((r) => (
                          <View key={r.id} style={styles.chip}>
                            <Text style={styles.chipText}>{r.label[language] ?? r.label.ar}</Text>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                ))
              )}
            </ScrollView>

            {/* شريط التأكيد */}
            {pending.length > 0 && (
              <View style={styles.confirmBar}>
                <Text style={styles.confirmText}>{t.confirmTitle}</Text>
                <View style={styles.confirmActions}>
                  <Pressable onPress={cancelPending} style={[styles.confirmBtn, styles.cancelBtn]}>
                    <Text style={styles.cancelText}>{t.cancel}</Text>
                  </Pressable>
                  <Pressable onPress={confirmPending} style={[styles.confirmBtn, styles.okBtn]}>
                    <Text style={styles.okText}>{t.confirm}</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* الإدخال */}
            <View style={[styles.inputRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
              <TextInput
                value={listening ? interim : input}
                onChangeText={setInput}
                editable={!listening}
                placeholder={listening ? t.listening : t.placeholder}
                placeholderTextColor={Palette.slate400}
                style={[styles.input, { textAlign: rtl ? 'right' : 'left' }]}
                onSubmitEditing={handleSend}
                returnKeyType="send"
              />
              <Pressable onPress={toggleMic} style={[styles.micBtn, listening && styles.micActive]} accessibilityRole="button">
                <Text style={styles.micGlyph}>{listening ? '⏹' : '🎤'}</Text>
              </Pressable>
              <Pressable onPress={handleSend} style={styles.sendBtn} accessibilityRole="button">
                <Text style={styles.sendGlyph}>➤</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    zIndex: 50,
    ...Elevation.lg,
  },
  fabGlyph: { color: Palette.white, fontSize: 24, fontWeight: '900' },
  overlay: { flex: 1, backgroundColor: 'rgba(6,22,31,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Palette.white,
    borderTopLeftRadius: Radii.xxl,
    borderTopRightRadius: Radii.xxl,
    maxHeight: '82%',
    paddingBottom: Platform.OS === 'ios' ? 26 : 16,
    ...Elevation.lg,
  },
  header: { alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Palette.slate100 },
  headerText: { flex: 1 },
  title: { fontSize: 16, fontWeight: '900', color: Palette.ink800 },
  subtitle: { fontSize: 11, color: Palette.slate500, marginTop: 2 },
  closeBtn: { width: 34, height: 34, borderRadius: Radii.pill, backgroundColor: Palette.slate100, alignItems: 'center', justifyContent: 'center' },
  closeGlyph: { fontSize: 15, color: Palette.slate600, fontWeight: '800' },
  messages: { paddingHorizontal: 14 },
  messagesContent: { paddingVertical: 14, gap: 10 },
  empty: { color: Palette.slate500, fontSize: 13, textAlign: 'center', paddingVertical: 20, lineHeight: 20 },
  bubble: { maxWidth: '86%', borderRadius: Radii.lg, paddingHorizontal: 13, paddingVertical: 10 },
  userBubble: { backgroundColor: Palette.teal600 },
  botBubble: { backgroundColor: Palette.teal50, borderWidth: 1, borderColor: Palette.teal100 },
  userText: { color: Palette.white, fontSize: 14, lineHeight: 20 },
  botText: { color: Palette.ink800, fontSize: 14, lineHeight: 21 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  chip: { backgroundColor: Palette.white, borderRadius: Radii.pill, borderWidth: 1, borderColor: Palette.teal300, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { color: Palette.teal700, fontSize: 11, fontWeight: '700' },
  confirmBar: { marginHorizontal: 14, marginBottom: 8, backgroundColor: Palette.amberSoft, borderRadius: Radii.md, padding: 12, gap: 8 },
  confirmText: { color: '#92400E', fontSize: 12, fontWeight: '800' },
  confirmActions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  confirmBtn: { borderRadius: Radii.pill, paddingHorizontal: 16, paddingVertical: 7 },
  cancelBtn: { backgroundColor: Palette.white, borderWidth: 1, borderColor: Palette.slate300 },
  okBtn: { backgroundColor: Palette.teal600 },
  cancelText: { color: Palette.slate600, fontWeight: '800', fontSize: 12 },
  okText: { color: Palette.white, fontWeight: '800', fontSize: 12 },
  inputRow: { alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingTop: 10, borderTopWidth: 1, borderTopColor: Palette.slate100 },
  input: { flex: 1, backgroundColor: Palette.slate100, borderRadius: Radii.pill, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: Palette.ink800 },
  micBtn: { width: 42, height: 42, borderRadius: Radii.pill, backgroundColor: Palette.slate100, alignItems: 'center', justifyContent: 'center' },
  micActive: { backgroundColor: Palette.coral },
  micGlyph: { fontSize: 17 },
  sendBtn: { width: 42, height: 42, borderRadius: Radii.pill, backgroundColor: Palette.teal600, alignItems: 'center', justifyContent: 'center' },
  sendGlyph: { color: Palette.white, fontSize: 17, fontWeight: '900' },
});

export default GlobalAssistant;
