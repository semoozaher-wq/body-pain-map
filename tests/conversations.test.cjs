'use strict';

// اختبارات منطق مخزن المحادثات النقي (services/conversations/core.js) الذي
// يُشغّله hook المخزن hooks/useConversations.ts.
// البلوبرنت #1 و#13: عنوان تلقائي + حفظ/استعراض/حذف المحادثات محليًا.

const test = require('node:test');
const assert = require('node:assert/strict');

const c = require('../services/conversations/core.js');

const userMsg = (id, text) => ({ id, role: 'user', text });
const botMsg = (id, text) => ({ id, role: 'assistant', kind: 'text', text });
const richMsg = (id) => ({ id, role: 'assistant', kind: 'rich', reply: { intro: { ar: 'رد غني' } } });
const conv = (id, iso, messages, extra) =>
  Object.assign({ id, updatedAtIso: iso, messages: messages || [] }, extra || {});

test('autoTitle يُنشئ عنوانًا من أول رسالة نصية للمستخدم', () => {
  const messages = [userMsg('1', 'عندي وجع في نص ضهري ناحية الشمال'), botMsg('2', 'حاضر')];
  assert.equal(c.autoTitle(messages), 'عندي وجع في نص ضهري ناحية الشمال');
});

test('autoTitle يتجاهل رسائل المساعد ويأخذ أول رسالة للمستخدم فقط', () => {
  const messages = [botMsg('1', 'أهلًا'), userMsg('2', 'صداع من امبارح'), userMsg('3', 'كمان دوخة')];
  assert.equal(c.autoTitle(messages), 'صداع من امبارح');
});

test('autoTitle يقتطع العناوين الطويلة ويضيف علامة حذف', () => {
  const long = 'أ'.repeat(120);
  const title = c.autoTitle([userMsg('1', long)]);
  assert.ok(title.length <= c.AUTO_TITLE_MAX, `title length ${title.length} يجب أن يكون <= ${c.AUTO_TITLE_MAX}`);
  assert.ok(title.endsWith('…'));
});

test('autoTitle يضغط المسافات المتكررة ويزيل الفراغات الطرفية', () => {
  assert.equal(c.autoTitle([userMsg('1', '   وجع    في   الرقبة   ')]), 'وجع في الرقبة');
});

test('autoTitle يُعيد العنوان الاحتياطي عند غياب رسائل المستخدم النصية', () => {
  assert.equal(c.autoTitle([richMsg('1')], 'محادثة جديدة'), 'محادثة جديدة');
  assert.equal(c.autoTitle([], 'محادثة جديدة'), 'محادثة جديدة');
  assert.equal(c.autoTitle(null), '');
});

test('conversationPreview يُعيد آخر رسالة نصية قابلة للعرض', () => {
  const messages = [userMsg('1', 'وجع كتف'), botMsg('2', 'طيب'), richMsg('3')];
  assert.equal(c.conversationPreview({ messages }), 'طيب');
});

test('conversationPreview يتجاهل الردود الغنية ويقتطع الطويل', () => {
  const long = 'ب'.repeat(200);
  const preview = c.conversationPreview({ messages: [userMsg('1', 'س'), botMsg('2', long)] });
  assert.ok(preview.length <= c.PREVIEW_MAX);
  assert.ok(preview.endsWith('…'));
});

test('messageText يستخرج النص من المستخدم والرد النصي فقط', () => {
  assert.equal(c.messageText(userMsg('1', 'مرحبا')), 'مرحبا');
  assert.equal(c.messageText(botMsg('2', 'أهلًا')), 'أهلًا');
  assert.equal(c.messageText(richMsg('3')), '');
  assert.equal(c.messageText(null), '');
});

test('isConversation يرفض الكائنات غير الصالحة', () => {
  assert.equal(c.isConversation({ id: 'a', messages: [] }), true);
  assert.equal(c.isConversation({ id: '', messages: [] }), false);
  assert.equal(c.isConversation({ id: 'a' }), false);
  assert.equal(c.isConversation(null), false);
  assert.equal(c.isConversation('x'), false);
});

test('validConversations يُرشّح العناصر غير الصالحة فقط', () => {
  const out = c.validConversations([conv('a', '2026-01-01T00:00:00Z'), null, { id: 'x' }, conv('b', '2026-02-01T00:00:00Z')]);
  assert.deepEqual(out.map((x) => x.id), ['a', 'b']);
});

test('sortByUpdated يفرز من الأحدث إلى الأقدم', () => {
  const out = c.sortByUpdated([
    conv('a', '2026-01-01T00:00:00Z'),
    conv('c', '2026-03-01T00:00:00Z'),
    conv('b', '2026-02-01T00:00:00Z'),
  ]);
  assert.deepEqual(out.map((x) => x.id), ['c', 'b', 'a']);
});

test('capConversations يطبّق الحد الأقصى محافظًا على الأحدث', () => {
  const many = Array.from({ length: 150 }, (_, i) => conv(String(i), new Date(2026, 0, 1, 0, i).toISOString()));
  assert.equal(c.capConversations(many).length, c.CONVERSATION_LIMIT);
  assert.equal(c.capConversations(many, 10).length, 10);
});

test('upsertConversation يضيف محادثة جديدة في المقدمة', () => {
  const out = c.upsertConversation([conv('a', '2026-01-01T00:00:00Z')], conv('b', '2026-02-01T00:00:00Z'));
  assert.deepEqual(out.map((x) => x.id), ['b', 'a']);
});

test('upsertConversation يستبدل بنفس المعرّف دون تكرار (أرشفة المحادثة الجديدة)', () => {
  const current = [conv('a', '2026-01-01T00:00:00Z', [userMsg('1', 'قديم')])];
  const updated = conv('a', '2026-03-01T00:00:00Z', [userMsg('1', 'محدّث')]);
  const out = c.upsertConversation(current, updated);
  assert.equal(out.length, 1);
  assert.equal(out[0].messages[0].text, 'محدّث');
});

test('upsertConversation يتجاهل الكائنات غير الصالحة ويحافظ على القائمة', () => {
  const out = c.upsertConversation([conv('a', '2026-01-01T00:00:00Z')], { id: 'bad' });
  assert.deepEqual(out.map((x) => x.id), ['a']);
});

test('removeConversation يحذف بالمعرّف فقط', () => {
  const out = c.removeConversation([conv('a', '2026-01-01T00:00:00Z'), conv('b', '2026-02-01T00:00:00Z')], 'a');
  assert.deepEqual(out.map((x) => x.id), ['b']);
});

test('truncate لا يعدّل النصوص القصيرة', () => {
  assert.equal(c.truncate('نص قصير', 20), 'نص قصير');
});
