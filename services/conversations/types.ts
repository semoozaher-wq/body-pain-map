// services/conversations/types.ts
// أنواع مخزن المحادثات المحلي (البلوبرنت #1 و#13).

import type { AssistantReply } from '../aiAssistant/engine';

/** رسالة محادثة قابلة للحفظ محليًا (تطابق شكل ChatMessage في AssistantScreen). */
export type ConversationMessage =
  | { id: string; role: 'user'; text: string; imageUri?: string }
  | { id: string; role: 'assistant'; kind: 'rich'; reply: AssistantReply }
  | { id: string; role: 'assistant'; kind: 'text'; text: string };

/** محادثة كاملة محفوظة محليًا. */
export interface StoredConversation {
  id: string;
  /** عنوان تلقائي من أول رسالة للمستخدم (قابل للتعديل لاحقًا). */
  title: string;
  createdAtIso: string;
  updatedAtIso: string;
  messages: ConversationMessage[];
  /** سياق الألم المتراكم (PainContext) — يُحفظ مع المحادثة لاستكمالها لاحقًا. */
  painContext?: unknown;
}

/** مدخل حفظ محادثة (المعرّف والعنوان اختياريان — يُولَّدان تلقائيًا). */
export interface ConversationDraft {
  id?: string;
  title?: string;
  messages: ConversationMessage[];
  painContext?: unknown;
  createdAtIso?: string;
}
