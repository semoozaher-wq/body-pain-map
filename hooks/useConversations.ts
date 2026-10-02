// hooks/useConversations.ts
// ============================================================================
// نقطة واحدة موحّدة لمخزن المحادثات المحلي: تحميل + حفظ + إضافة + حذف + مسح.
// ----------------------------------------------------------------------------
// التخزين محلي فقط عبر AsyncStorage — لا سحابة ولا تسجيل دخول (البلوبرنت #13).
// المنطق النقي (العنوان التلقائي، الفرز، الحد الأقصى، الدمج) موجود في
// services/conversations/core.js وهو مُختبَر عبر node --test. هذا الـhook يقتصر
// على ربط ذلك المنطق بالتخزين، تمامًا كما يفعل hooks/usePainHistory.ts.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createLocalId } from '../services/id';
import {
  autoTitle,
  capConversations,
  removeConversation,
  upsertConversation,
  validConversations,
  type CoreConversation,
} from '../services/conversations/core.js';
import type { ConversationDraft, StoredConversation } from '../services/conversations/types';

/** مفتاح التخزين المحلي لمخزن المحادثات. */
export const CONVERSATIONS_STORAGE_KEY = 'bodymap-conversations-v1';

export interface UseConversations {
  /** المحادثات المحفوظة (من الأحدث إلى الأقدم). */
  conversations: StoredConversation[];
  /** هل تمّت محاولة تحميل المحادثات من التخزين المحلي؟ */
  loaded: boolean;
  /** يحفظ/يُحدّث محادثة (يُنشئ عنوانًا تلقائيًا إن لم يُمرَّر) ويُعيدها. */
  saveConversation: (draft: ConversationDraft) => StoredConversation;
  /** يُعيد محادثة كاملة بالمعرّف (لاستكمالها). */
  getConversation: (id: string) => StoredConversation | undefined;
  /** يحذف محادثة واحدة بالمعرّف. */
  deleteConversation: (id: string) => void;
  /** يمسح كل المحادثات المحفوظة. */
  clearAll: () => void;
}

export function useConversations(): UseConversations {
  const [conversations, setConversations] = useState<StoredConversation[]>([]);
  const [loaded, setLoaded] = useState(false);
  const mounted = useRef(true);

  // تحميل المحادثات من التخزين المحلي مرة واحدة عند الإقلاع.
  useEffect(() => {
    mounted.current = true;
    AsyncStorage.getItem(CONVERSATIONS_STORAGE_KEY)
      .then((saved) => {
        if (!mounted.current) return;
        if (saved) {
          try {
            const parsed: unknown = JSON.parse(saved);
            const valid = validConversations(parsed) as StoredConversation[];
            setConversations(capConversations(valid as CoreConversation[]) as StoredConversation[]);
          } catch {
            /* الإبقاء على قائمة فارغة إذا كان JSON المحفوظ تالفًا */
          }
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (mounted.current) setLoaded(true);
      });
    return () => {
      mounted.current = false;
    };
  }, []);

  // حفظ المحادثات محليًا بعد أي تغيير (بعد اكتمال التحميل الأول فقط).
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(CONVERSATIONS_STORAGE_KEY, JSON.stringify(conversations)).catch(() => undefined);
  }, [conversations, loaded]);

  const saveConversation = useCallback((draft: ConversationDraft): StoredConversation => {
    const nowIso = new Date().toISOString();
    const explicitTitle = typeof draft.title === 'string' ? draft.title.trim() : '';
    const conversation: StoredConversation = {
      id: draft.id ?? createLocalId('chat'),
      title: explicitTitle || autoTitle(draft.messages),
      createdAtIso: draft.createdAtIso ?? nowIso,
      updatedAtIso: nowIso,
      messages: draft.messages,
      ...(draft.painContext !== undefined ? { painContext: draft.painContext } : {}),
    };
    setConversations(
      (items) => upsertConversation(items as CoreConversation[], conversation as CoreConversation) as StoredConversation[],
    );
    return conversation;
  }, []);

  const getConversation = useCallback(
    (id: string) => conversations.find((conversation) => conversation.id === id),
    [conversations],
  );

  const deleteConversation = useCallback((id: string) => {
    setConversations(
      (items) => removeConversation(items as CoreConversation[], id) as StoredConversation[],
    );
  }, []);

  const clearAll = useCallback(() => setConversations([]), []);

  return { conversations, loaded, saveConversation, getConversation, deleteConversation, clearAll };
}

export default useConversations;
