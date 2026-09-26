// screens/AssistantScreen.tsx
// ============================================================================
// شاشة المساعد الذكي — دردشة تفهم كلام المستخدم وتردّ بإرشاد تعليمي.
// يعمل بالكامل دون إنترنت (محرّك محلي) — لا يُرسل أي بيانات لأي خادم.
// ============================================================================

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Colors } from '../constants/colors';
import { Fonts } from '../constants/fonts';
import { Palette, Gradients, Radii, Elevation, Type } from '../constants/design';
import { Gradient } from '../components/Gradient';
import { GlowOrb } from '../components/GlowOrb';
import { useTheme } from '../hooks/useTheme';
import { translate } from '../services/i18n';
import {
  analyzeMessage,
  QUICK_PROMPTS,
  type AssistantReply,
  type Lang,
  type TriageLevel,
} from '../services/aiAssistant';

type ChatMessage =
  | { id: string; role: 'user'; text: string }
  | { id: string; role: 'assistant'; reply: AssistantReply };

interface AssistantScreenProps {
  language: Parameters<typeof translate>[0];
  direction: 'rtl' | 'ltr';
  onOpenRegion: (regionId: string) => void;
}

const TRIAGE_COLORS: Record<TriageLevel, { bg: string; fg: string; accent: string }> = {
  self_care: { bg: '#ECFDF5', fg: '#047857', accent: Palette.mint },
  routine: { bg: '#E6F7F5', fg: '#0E6972', accent: Palette.teal400 },
  soon: { bg: '#FFFBEB', fg: '#B45309', accent: Palette.amber },
  urgent: { bg: '#FFF1F2', fg: '#BE123C', accent: Palette.coral },
  emergency: { bg: '#FEF2F2', fg: '#B91C1C', accent: Palette.rose },
};

let msgCounter = 0;
const nextId = () => `m${Date.now()}-${msgCounter++}`;

export const AssistantScreen: React.FC<AssistantScreenProps> = ({ language, direction, onOpenRegion }) => {
  const { colors } = useTheme();
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const rtl = direction === 'rtl';
  const align = rtl ? 'right' : 'left';
  const row = rtl ? 'row-reverse' : 'row';

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const quickPrompts = useMemo(
    () => QUICK_PROMPTS.map((p) => p[language as Lang] ?? p.ar),
    [language],
  );

  const send = useCallback(
    (raw: string) => {
      const text = raw.trim();
      if (!text || thinking) return;
      setMessages((prev) => [...prev, { id: nextId(), role: 'user', text }]);
      setInput('');
      setThinking(true);
      // محاكاة زمن التفكير البشري القصير لإحساس طبيعي بالدردشة.
      setTimeout(() => {
        const reply = analyzeMessage(text, language as Lang);
        setMessages((prev) => [...prev, { id: nextId(), role: 'assistant', reply }]);
        setThinking(false);
      }, 650);
    },
    [language, thinking],
  );

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, []);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* رأس المساعد */}
      <View style={[styles.agentBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.agentAvatar}>
          <Gradient colors={Gradients.brandSoft} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <Text style={styles.agentGlyph}>✦</Text>
        </View>
        <View style={[styles.agentMeta, { alignItems: rtl ? 'flex-end' : 'flex-start' }]}>
          <Text style={[styles.agentName, { color: colors.textPrimary }]}>{t('assistant.name')}</Text>
          <View style={[styles.statusRow, { flexDirection: row }]}>
            <View style={styles.statusDot} />
            <Text style={[styles.statusText, { color: colors.textSecondary }]}>{t('assistant.status')}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.flex}
        contentContainerStyle={styles.chatContent}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={scrollToEnd}
        keyboardShouldPersistTaps="handled"
      >
        {/* بطاقة ترحيب */}
        <View style={styles.welcomeCard}>
          <Gradient colors={Gradients.heroDeep} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <GlowOrb size={200} color={Palette.teal400} opacity={0.4} style={{ top: -80, right: -60 }} />
          <GlowOrb size={150} color={Palette.cyan} opacity={0.28} style={{ bottom: -70, left: -50 }} />
          <Text style={styles.welcomeTitle}>{t('assistant.welcomeTitle')}</Text>
          <Text style={styles.welcomeText}>{t('assistant.welcomeText')}</Text>
          <View style={[styles.privBadge, { flexDirection: row }]}>
            <Text style={styles.privGlyph}>🔒</Text>
            <Text style={styles.privText}>{t('assistant.privateBadge')}</Text>
          </View>
        </View>

        {messages.length === 0 && (
          <View style={styles.quickWrap}>
            <Text style={[styles.quickTitle, { color: colors.textSecondary, textAlign: align }]}>
              {t('assistant.tryThese')}
            </Text>
            {quickPrompts.map((prompt) => (
              <Pressable
                key={prompt}
                onPress={() => send(prompt)}
                accessibilityRole="button"
                accessibilityLabel={prompt}
                style={[styles.quickChip, { backgroundColor: colors.surface, borderColor: colors.border, flexDirection: row }]}
              >
                <Text style={styles.quickChipGlyph}>›</Text>
                <Text style={[styles.quickChipText, { color: colors.textPrimary, textAlign: align }]}>{prompt}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {messages.map((message) =>
          message.role === 'user' ? (
            <View key={message.id} style={[styles.userRow, { justifyContent: rtl ? 'flex-start' : 'flex-end' }]}>
              <View style={styles.userBubble}>
                <Gradient colors={Gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
                <Text style={[styles.userText, { textAlign: align }]}>{message.text}</Text>
              </View>
            </View>
          ) : (
            <AssistantBubble key={message.id} reply={message.reply} align={align} row={row} onOpenRegion={onOpenRegion} colors={colors} t={t} />
          ),
        )}

        {thinking && (
          <View style={[styles.agentRow, { flexDirection: row }]}>
            <View style={[styles.thinkingBubble, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <ActivityIndicator size="small" color={Palette.teal500} />
              <Text style={[styles.thinkingText, { color: colors.textSecondary }]}>{t('assistant.thinking')}</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* شريط الإدخال */}
      <View style={[styles.inputBar, { backgroundColor: colors.surface, borderColor: colors.border, flexDirection: row }]}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder={t('assistant.placeholder')}
          placeholderTextColor={colors.textLight}
          style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.backgroundAlt, textAlign: align }]}
          multiline
          onSubmitEditing={() => send(input)}
          blurOnSubmit={false}
        />
        <Pressable
          onPress={() => send(input)}
          disabled={!input.trim() || thinking}
          style={[styles.sendButton, (!input.trim() || thinking) && styles.sendDisabled]}
          accessibilityRole="button"
          accessibilityLabel={t('assistant.send')}
        >
          <Gradient colors={Gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <Text style={styles.sendGlyph}>{rtl ? '◀' : '▶'}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
};

// ---------------------------------------------------------------------------
// فقاعة رد المساعد
// ---------------------------------------------------------------------------
interface BubbleProps {
  reply: AssistantReply;
  align: 'right' | 'left';
  row: 'row' | 'row-reverse';
  onOpenRegion: (regionId: string) => void;
  colors: typeof Colors;
  t: (key: Parameters<typeof translate>[1]) => string;
}

const AssistantBubble: React.FC<BubbleProps> = ({ reply, align, row, onOpenRegion, colors, t }) => {
  const triage = TRIAGE_COLORS[reply.triage.level];
  const hasRedFlag = reply.redFlags.length > 0;

  return (
    <View style={[styles.agentRow, { flexDirection: row }]}>
      <View style={styles.agentMini}>
        <Gradient colors={Gradients.brandSoft} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <Text style={styles.agentMiniGlyph}>✦</Text>
      </View>

      <View style={[styles.bubble, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.intro, { color: colors.textPrimary, textAlign: align }]}>{reply.intro.ar && reply.intro[replyIntroLang(reply)]}</Text>

        {reply.clarifyingQuestion && (
          <Text style={[styles.clarify, { color: colors.textSecondary, textAlign: align }]}>
            {reply.clarifyingQuestion[replyIntroLang(reply)]}
          </Text>
        )}

        {reply.understanding.length > 0 && (
          <View style={styles.understandBox}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary, textAlign: align }]}>{t('assistant.understood')}</Text>
            {reply.understanding.map((line) => (
              <Text key={line} style={[styles.understandLine, { color: colors.textPrimary, textAlign: align }]}>• {line}</Text>
            ))}
          </View>
        )}

        {/* شارة الفرز */}
        <View style={[styles.triageBadge, { backgroundColor: triage.bg, flexDirection: row }]}>
          <View style={[styles.triageDot, { backgroundColor: triage.accent }]} />
          <Text style={[styles.triageTitle, { color: triage.fg, textAlign: align }]}>{reply.triage.title[replyIntroLang(reply)]}</Text>
        </View>
        <Text style={[styles.triageAdvice, { color: colors.textSecondary, textAlign: align }]}>{reply.triage.advice[replyIntroLang(reply)]}</Text>

        {/* علامات الإنذار */}
        {hasRedFlag && (
          <View style={[styles.redFlagBox, { borderColor: triage.accent, backgroundColor: triage.bg }]}>
            <Text style={[styles.redFlagTitle, { color: triage.fg, textAlign: align }]}>{t('assistant.redFlags')}</Text>
            {reply.redFlags.map((flag) => (
              <Text key={flag.id} style={[styles.redFlagLine, { color: triage.fg, textAlign: align }]}>⚠ {flag.label[replyIntroLang(reply)]}</Text>
            ))}
          </View>
        )}

        {/* أمراض محتملة */}
        {reply.conditions.length > 0 && (
          <View style={styles.conditionsWrap}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary, textAlign: align }]}>{t('assistant.possibleConditions')}</Text>
            {reply.conditions.map((condition) => (
              <View key={condition.id} style={[styles.conditionCard, { borderColor: colors.border, backgroundColor: colors.backgroundAlt }]}>
                <View style={[styles.conditionHead, { flexDirection: row }]}>
                  <Text style={[styles.conditionName, { color: colors.textPrimary, textAlign: align }]}>{condition.name[replyIntroLang(reply)]}</Text>
                  <View style={styles.icdChip}>
                    <Text style={styles.icdText}>{condition.icd10}</Text>
                  </View>
                </View>
                <Text style={[styles.conditionSummary, { color: colors.textSecondary, textAlign: align }]}>{condition.summary[replyIntroLang(reply)]}</Text>
              </View>
            ))}
          </View>
        )}

        {/* رعاية ذاتية */}
        {reply.selfCare.length > 0 && (
          <View style={styles.selfCareWrap}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary, textAlign: align }]}>{t('assistant.selfCare')}</Text>
            {reply.selfCare.map((tip) => (
              <Text key={tip} style={[styles.selfCareLine, { color: colors.textPrimary, textAlign: align }]}>✓ {tip}</Text>
            ))}
          </View>
        )}

        <Text style={[styles.whenToSee, { color: colors.textSecondary, textAlign: align }]}>
          {t('assistant.whenToSee')}: {reply.whenToSeeDoctor[replyIntroLang(reply)]}
        </Text>

        {reply.suggestedRegionId && (
          <Pressable
            onPress={() => onOpenRegion(reply.suggestedRegionId as string)}
            accessibilityRole="button"
            accessibilityLabel={t('assistant.openOnMap')}
            style={[styles.openMapButton, { flexDirection: row }]}
          >
            <Gradient colors={Gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <Text style={styles.openMapText}>
              {t('assistant.openOnMap')}
              {reply.suggestedRegionLabel ? ` · ${reply.suggestedRegionLabel[replyIntroLang(reply)]}` : ''}
            </Text>
          </Pressable>
        )}

        <Text style={[styles.disclaimer, { color: colors.textLight, textAlign: align }]}>{reply.disclaimer[replyIntroLang(reply)]}</Text>
      </View>
    </View>
  );
};

/**
 * اختيار لغة نص الرد — نستخدم لغة الواجهة الحالية.
 * (الرد يحمل النصوص بثلاث لغات؛ نعرض اللغة المطلوبة.)
 */
function replyIntroLang(reply: AssistantReply): Lang {
  // نستنتج اللغة من النص المعروض في الواجهة عبر أول عنصر متاح.
  // الرد يُبنى أصلًا بلغة الواجهة، لذا نعرض العربية افتراضيًا ثم نطابق.
  return reply.__lang ?? 'ar';
}

export default AssistantScreen;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  agentBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  agentAvatar: {
    width: 44,
    height: 44,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...Elevation.glowTeal,
  },
  agentGlyph: { color: Palette.white, fontSize: 20, fontWeight: '900' },
  agentMeta: { flex: 1, gap: 2 },
  agentName: { fontFamily: Fonts.arabic.bold, fontSize: Type.title, fontWeight: Type.weight.black },
  statusRow: { alignItems: 'center', gap: 6 },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Palette.mint },
  statusText: { fontFamily: Fonts.arabic.regular, fontSize: Type.micro },
  chatContent: { padding: 16, paddingBottom: 22, gap: 14 },
  welcomeCard: {
    borderRadius: Radii.xl,
    padding: 18,
    overflow: 'hidden',
    ...Elevation.lg,
  },
  welcomeTitle: { color: Palette.white, fontFamily: Fonts.arabic.bold, fontSize: Type.h3, fontWeight: Type.weight.black, textAlign: 'right' },
  welcomeText: { color: '#D6ECEA', fontFamily: Fonts.arabic.regular, fontSize: Type.bodySm, lineHeight: 22, marginTop: 8, textAlign: 'right' },
  privBadge: { alignItems: 'center', gap: 6, marginTop: 12, alignSelf: 'flex-end', backgroundColor: 'rgba(255,255,255,0.14)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radii.pill },
  privGlyph: { fontSize: 12 },
  privText: { color: '#E4F5F2', fontFamily: Fonts.arabic.medium, fontSize: Type.micro },
  quickWrap: { gap: 9, marginTop: 2 },
  quickTitle: { fontFamily: Fonts.arabic.medium, fontSize: Type.caption, marginBottom: 2 },
  quickChip: { alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: Radii.md, paddingHorizontal: 13, paddingVertical: 11, ...Elevation.xs },
  quickChipGlyph: { color: Palette.teal500, fontSize: 18, fontWeight: '900' },
  quickChipText: { flex: 1, fontFamily: Fonts.arabic.medium, fontSize: Type.bodySm, lineHeight: 20 },
  userRow: { flexDirection: 'row' },
  userBubble: { maxWidth: '86%', borderRadius: Radii.lg, borderTopRightRadius: 6, paddingHorizontal: 14, paddingVertical: 11, overflow: 'hidden', ...Elevation.glowTeal },
  userText: { color: Palette.white, fontFamily: Fonts.arabic.medium, fontSize: Type.body, lineHeight: 22 },
  agentRow: { alignItems: 'flex-start', gap: 9 },
  agentMini: { width: 30, height: 30, borderRadius: Radii.pill, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginTop: 2 },
  agentMiniGlyph: { color: Palette.white, fontSize: 14, fontWeight: '900' },
  bubble: { flex: 1, borderRadius: Radii.lg, borderTopLeftRadius: 6, borderWidth: 1, padding: 14, gap: 10, ...Elevation.sm },
  intro: { fontFamily: Fonts.arabic.bold, fontSize: Type.body, lineHeight: 23, fontWeight: Type.weight.bold },
  clarify: { fontFamily: Fonts.arabic.regular, fontSize: Type.bodySm, lineHeight: 21 },
  understandBox: { gap: 4 },
  sectionLabel: { fontFamily: Fonts.arabic.bold, fontSize: Type.micro, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 3 },
  understandLine: { fontFamily: Fonts.arabic.regular, fontSize: Type.bodySm, lineHeight: 21 },
  triageBadge: { alignItems: 'center', gap: 8, borderRadius: Radii.md, paddingHorizontal: 12, paddingVertical: 9 },
  triageDot: { width: 9, height: 9, borderRadius: 5 },
  triageTitle: { flex: 1, fontFamily: Fonts.arabic.bold, fontSize: Type.bodySm, fontWeight: Type.weight.black },
  triageAdvice: { fontFamily: Fonts.arabic.regular, fontSize: Type.bodySm, lineHeight: 21 },
  redFlagBox: { borderWidth: 1.5, borderRadius: Radii.md, padding: 11, gap: 4 },
  redFlagTitle: { fontFamily: Fonts.arabic.bold, fontSize: Type.bodySm, fontWeight: Type.weight.black, marginBottom: 2 },
  redFlagLine: { fontFamily: Fonts.arabic.medium, fontSize: Type.bodySm, lineHeight: 21 },
  conditionsWrap: { gap: 8 },
  conditionCard: { borderWidth: 1, borderRadius: Radii.md, padding: 11, gap: 5 },
  conditionHead: { alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  conditionName: { flex: 1, fontFamily: Fonts.arabic.bold, fontSize: Type.bodySm, fontWeight: Type.weight.bold },
  icdChip: { backgroundColor: Palette.teal100, borderRadius: Radii.xs, paddingHorizontal: 7, paddingVertical: 2 },
  icdText: { color: Palette.teal700, fontFamily: Fonts.arabic.bold, fontSize: Type.micro },
  conditionSummary: { fontFamily: Fonts.arabic.regular, fontSize: Type.caption, lineHeight: 19 },
  selfCareWrap: { gap: 5 },
  selfCareLine: { fontFamily: Fonts.arabic.regular, fontSize: Type.bodySm, lineHeight: 21 },
  whenToSee: { fontFamily: Fonts.arabic.medium, fontSize: Type.caption, lineHeight: 19 },
  openMapButton: { alignItems: 'center', justifyContent: 'center', borderRadius: Radii.md, paddingVertical: 12, paddingHorizontal: 16, overflow: 'hidden', ...Elevation.glowTeal },
  openMapText: { color: Palette.white, fontFamily: Fonts.arabic.bold, fontSize: Type.bodySm, fontWeight: Type.weight.black },
  disclaimer: { fontFamily: Fonts.arabic.regular, fontSize: Type.micro, lineHeight: 16, marginTop: 2 },
  agentRow2: {},
  thinkingBubble: { flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderRadius: Radii.lg, paddingHorizontal: 14, paddingVertical: 11 },
  thinkingText: { fontFamily: Fonts.arabic.medium, fontSize: Type.bodySm },
  inputBar: { alignItems: 'flex-end', gap: 9, paddingHorizontal: 12, paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 22 : 12, borderTopWidth: 1 },
  input: { flex: 1, minHeight: 44, maxHeight: 120, borderRadius: Radii.md, paddingHorizontal: 14, paddingVertical: 11, fontFamily: Fonts.arabic.regular, fontSize: Type.body },
  sendButton: { width: 46, height: 46, borderRadius: Radii.pill, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', ...Elevation.glowTeal },
  sendDisabled: { opacity: 0.4 },
  sendGlyph: { color: Palette.white, fontSize: 16, fontWeight: '900' },
});
