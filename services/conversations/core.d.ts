// services/conversations/core.d.ts
// تعريفات TypeScript لمنطق مخزن المحادثات النقي (services/conversations/core.js).

export const CONVERSATION_LIMIT: number;
export const AUTO_TITLE_MAX: number;
export const PREVIEW_MAX: number;

/** رسالة قابلة للتخزين (مستخدم أو رد نصي). */
export type CoreMessage =
  | { id: string; role: 'user'; text?: string }
  | { id: string; role: 'assistant'; kind?: string; text?: string };

/** شكل المحادثة المخزّنة كما يتعامل معه المنطق النقي. */
export interface CoreConversation {
  id: string;
  title?: string;
  createdAtIso?: string;
  updatedAtIso?: string;
  messages: CoreMessage[];
  painContext?: unknown;
}

export function collapse(value: unknown): string;
export function truncate(value: unknown, max?: number): string;
export function messageText(message: unknown): string;
export function validMessages<T = CoreMessage>(messages: unknown): T[];
export function isConversation(value: unknown): value is CoreConversation;
export function validConversations(list: unknown): CoreConversation[];
export function autoTitle(messages: unknown, fallback?: string): string;
export function conversationPreview(conversation: unknown): string;
export function sortByUpdated<T extends CoreConversation>(list: T[]): T[];
export function capConversations<T extends CoreConversation>(list: T[], limit?: number): T[];
export function upsertConversation<T extends CoreConversation>(
  list: T[],
  conversation: T,
  limit?: number,
): T[];
export function removeConversation<T extends CoreConversation>(list: T[], id: string): T[];
