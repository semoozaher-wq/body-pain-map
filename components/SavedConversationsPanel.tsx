// components/SavedConversationsPanel.tsx
// ============================================================================
// لوحة "المحادثات المحفوظة" — تستعرض المحادثات السابقة محليًا وتتيح استكمالها
// أو حذفها (البلوبرنت #13). لا سحابة ولا تسجيل دخول؛ كل شيء من التخزين المحلي.
// ============================================================================

import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../constants/colors';
import { Palette, Radii } from '../constants/design';
import { translate, type Language } from '../services/i18n';
import { conversationPreview } from '../services/conversations/core.js';
import type { StoredConversation } from '../services/conversations/types';

interface SavedConversationsPanelProps {
  visible: boolean;
  conversations: StoredConversation[];
  language: Language;
  direction: 'rtl' | 'ltr';
  colors: typeof Colors;
  t: (key: Parameters<typeof translate>[1]) => string;
  onClose: () => void;
  onRestore: (conversation: StoredConversation) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
}

/** تنسيق تاريخ مختصر حسب اللغة (يوم/شهر + ساعة/دقيقة). */
function formatWhen(iso: string, language: Language): string {
  const timestamp = Date.parse(iso);
  if (!Number.isFinite(timestamp)) return '';
  try {
    return new Date(timestamp).toLocaleString(language === 'ar' ? 'ar-EG' : language === 'fr' ? 'fr-FR' : 'en-US', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return new Date(timestamp).toISOString().slice(0, 16).replace('T', ' ');
  }
}

export function SavedConversationsPanel({
  visible,
  conversations,
  language,
  direction,
  colors,
  t,
  onClose,
  onRestore,
  onDelete,
  onClearAll,
}: SavedConversationsPanelProps) {
  const rtl = direction === 'rtl';
  const align = rtl ? 'right' : 'left';
  const row = rtl ? 'row-reverse' : 'row';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={[styles.header, { flexDirection: row, borderBottomColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.textPrimary, textAlign: align }]}>
              {t('assistant.savedConversations')}
            </Text>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t('assistant.close')} hitSlop={10}>
              <Text style={[styles.close, { color: colors.textSecondary }]}>✕</Text>
            </Pressable>
          </View>

          {conversations.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyGlyph}>🗂️</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary, textAlign: 'center' }]}>
                {t('assistant.noSavedConversations')}
              </Text>
            </View>
          ) : (
            <>
              <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
                {conversations.map((conversation) => {
                  const preview = conversationPreview(conversation);
                  return (
                    <View
                      key={conversation.id}
                      style={[styles.item, { borderColor: colors.border, backgroundColor: colors.backgroundAlt }]}
                    >
                      <Pressable
                        style={styles.itemMain}
                        onPress={() => onRestore(conversation)}
                        accessibilityRole="button"
                        accessibilityLabel={conversation.title}
                      >
                        <Text style={[styles.itemTitle, { color: colors.textPrimary, textAlign: align }]} numberOfLines={1}>
                          {conversation.title || t('assistant.untitledConversation')}
                        </Text>
                        {!!preview && (
                          <Text style={[styles.itemPreview, { color: colors.textSecondary, textAlign: align }]} numberOfLines={1}>
                            {preview}
                          </Text>
                        )}
                        <View style={[styles.itemMeta, { flexDirection: row }]}>
                          <Text style={[styles.itemMetaText, { color: colors.textLight }]}>
                            {formatWhen(conversation.updatedAtIso, language)}
                          </Text>
                          <Text style={[styles.itemMetaDot, { color: colors.textLight }]}>•</Text>
                          <Text style={[styles.itemMetaText, { color: colors.textLight }]}>
                            {conversation.messages.length} {t('assistant.messagesCount')}
                          </Text>
                        </View>
                      </Pressable>
                      <Pressable
                        onPress={() => onDelete(conversation.id)}
                        accessibilityRole="button"
                        accessibilityLabel={t('assistant.deleteConversation')}
                        style={styles.deleteButton}
                        hitSlop={8}
                      >
                        <Text style={styles.deleteGlyph}>🗑️</Text>
                      </Pressable>
                    </View>
                  );
                })}
              </ScrollView>

              <Pressable
                onPress={onClearAll}
                accessibilityRole="button"
                accessibilityLabel={t('assistant.clearAllConversations')}
                style={[styles.clearAll, { borderColor: Palette.coral }]}
              >
                <Text style={[styles.clearAllText, { color: Palette.rose }]}>{t('assistant.clearAllConversations')}</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(6,22,31,0.55)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: Radii.xl, borderTopRightRadius: Radii.xl, maxHeight: '82%', paddingBottom: 22 },
  header: { alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 16, borderBottomWidth: 1 },
  title: { flex: 1, fontSize: 18, fontWeight: '900' },
  close: { fontSize: 22, paddingHorizontal: 6 },
  list: { padding: 14, gap: 10 },
  item: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: Radii.md, paddingStart: 14, paddingEnd: 8, paddingVertical: 12, gap: 8 },
  itemMain: { flex: 1, gap: 3 },
  itemTitle: { fontSize: 14.5, fontWeight: '800' },
  itemPreview: { fontSize: 12, lineHeight: 18 },
  itemMeta: { alignItems: 'center', gap: 6, marginTop: 2 },
  itemMetaText: { fontSize: 10.5, fontWeight: '700' },
  itemMetaDot: { fontSize: 10.5 },
  deleteButton: { paddingHorizontal: 8, paddingVertical: 6 },
  deleteGlyph: { fontSize: 16 },
  emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 54, paddingHorizontal: 24, gap: 10 },
  emptyGlyph: { fontSize: 34 },
  emptyText: { fontSize: 14, lineHeight: 21 },
  clearAll: { marginHorizontal: 16, marginTop: 12, borderWidth: 1, borderRadius: Radii.pill, paddingVertical: 12, alignItems: 'center' },
  clearAllText: { fontSize: 13, fontWeight: '900' },
});

export default SavedConversationsPanel;
