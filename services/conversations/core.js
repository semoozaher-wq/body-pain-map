'use strict';

// services/conversations/core.js
// ============================================================================
// منطق نقّي (pure) لمخزن المحادثات المحلي — قابل للاختبار عبر node --test.
// ----------------------------------------------------------------------------
// هذا الملف لا يعتمد على React ولا AsyncStorage إطلاقًا؛ كل الدوال هنا نقية
// وتُعيد قيمًا جديدة دون تعديل المدخلات. الطبقة التي تلمس التخزين موجودة في
// hooks/useConversations.ts (نفس نمط hooks/usePainHistory.ts مع painHistoryCore.js).
//
// الغرض (البلوبرنت #1 و#13): حفظ المحادثات وسياق الألم محليًا، إنشاء عنوان
// تلقائي من أول رسالة للمستخدم، وإتاحة استعراض/حذف المحادثات السابقة — بدون
// أي سحابة أو تسجيل دخول.
// ============================================================================

/** الحد الأقصى لعدد المحادثات المحفوظة محليًا (الأقدم يُسقَط). */
const CONVERSATION_LIMIT = 100;

/** الحد الأقصى لطول العنوان التلقائي (بالأحرف). */
const AUTO_TITLE_MAX = 48;

/** الحد الأقصى لطول معاينة آخر رسالة (بالأحرف). */
const PREVIEW_MAX = 90;

/** يضغط المسافات المتكررة ويزيل الفراغات الطرفية. */
function collapse(value) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
}

/** يقتطع النص إلى حدّ أقصى مع إضافة علامة حذف (…) عند التجاوز. */
function truncate(value, max) {
  const text = collapse(value);
  const limit = Number.isFinite(max) && max > 0 ? Math.floor(max) : AUTO_TITLE_MAX;
  if (text.length <= limit) return text;
  return text.slice(0, Math.max(1, limit - 1)).trimEnd() + '…';
}

/** يستخرج النص القابل للعرض من رسالة (مستخدم / رد نصي فقط؛ الردود الغنية تُتجاهل). */
function messageText(message) {
  if (!message || typeof message !== 'object') return '';
  if (message.role === 'user' && typeof message.text === 'string') return message.text;
  if (message.role === 'assistant' && message.kind === 'text' && typeof message.text === 'string') {
    return message.text;
  }
  return '';
}

/** يُرشّح قائمة الرسائل الصالحة فقط (لها id و role معروف). */
function validMessages(messages) {
  return Array.isArray(messages)
    ? messages.filter(
        (m) =>
          m &&
          typeof m === 'object' &&
          typeof m.id === 'string' &&
          m.id.length > 0 &&
          (m.role === 'user' || m.role === 'assistant'),
      )
    : [];
}

/** هل الكائن محادثة صالحة قابلة للتخزين؟ */
function isConversation(value) {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    Array.isArray(value.messages)
  );
}

/** يُرشّح قائمة المحادثات الصالحة فقط. */
function validConversations(list) {
  return Array.isArray(list) ? list.filter(isConversation) : [];
}

/**
 * يُنشئ عنوانًا تلقائيًا للمحادثة من أول رسالة نصية للمستخدم.
 * إن لم توجد رسالة نصية، يُعيد العنوان الاحتياطي (fallback) إن مُرِّر.
 */
function autoTitle(messages, fallback) {
  const list = validMessages(messages);
  const firstUser = list.find((m) => m.role === 'user' && messageText(m));
  const title = firstUser ? truncate(messageText(firstUser), AUTO_TITLE_MAX) : '';
  if (title) return title;
  return collapse(fallback);
}

/** معاينة قصيرة لآخر رسالة نصية في المحادثة (للعرض في قائمة المحادثات). */
function conversationPreview(conversation) {
  const list = validMessages(conversation && conversation.messages);
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const text = messageText(list[i]);
    if (text) return truncate(text, PREVIEW_MAX);
  }
  return '';
}

/** يفرز المحادثات من الأحدث إلى الأقدم حسب updatedAtIso (ثم id للاستقرار). */
function sortByUpdated(list) {
  return validConversations(list).sort((a, b) => {
    const at = a.updatedAtIso ? Date.parse(a.updatedAtIso) : Number.NEGATIVE_INFINITY;
    const bt = b.updatedAtIso ? Date.parse(b.updatedAtIso) : Number.NEGATIVE_INFINITY;
    if (bt !== at) return bt - at;
    return String(b.id).localeCompare(String(a.id));
  });
}

/** يطبّق الحد الأقصى لعدد المحادثات (مع الحفاظ على الأحدث). */
function capConversations(list, limit) {
  const max = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : CONVERSATION_LIMIT;
  return sortByUpdated(list).slice(0, max);
}

/**
 * يُضيف محادثة أو يستبدل محادثة بنفس المعرّف (upsert) ثم يفرز ويطبّق الحد.
 * هذا ما يجعل "المحادثة الجديدة" تُؤرشَف دون تكرار عند إعادة الحفظ.
 */
function upsertConversation(list, conversation, limit) {
  if (!isConversation(conversation)) return capConversations(list, limit);
  const others = validConversations(list).filter((item) => item.id !== conversation.id);
  return capConversations([conversation, ...others], limit);
}

/** يحذف محادثة بالمعرّف. */
function removeConversation(list, id) {
  return validConversations(list).filter((item) => item.id !== id);
}

module.exports = {
  CONVERSATION_LIMIT,
  AUTO_TITLE_MAX,
  PREVIEW_MAX,
  collapse,
  truncate,
  messageText,
  validMessages,
  isConversation,
  validConversations,
  autoTitle,
  conversationPreview,
  sortByUpdated,
  capConversations,
  upsertConversation,
  removeConversation,
};
