import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { analyzeMessage, type AssistantReply } from '../services/aiAssistant';
import type { Language } from '../services/i18n';

type Props = { language?: Language };

const copy = {
  ar: {
    title: 'مساعد إرشادي محلي', hint: 'يعمل على الجهاز دون إرسال بيانات أو مفتاح API.', placeholder: 'مثال: عندي ألم في صدري مع ضيق نفس', ask: 'حلّل الأعراض', empty: 'اكتب وصفًا للألم أو الأعراض أولًا.', emergency: 'علامات خطر: اطلب رعاية طارئة الآن.', urgent: 'يُنصح بتقييم طبي قريب ولا تعتمد على الدردشة وحدها.', education: 'إرشاد تعليمي وليس تشخيصًا أو وصفة علاج.', understanding: 'ما فهمته', triage: 'درجة الاستعجال', selfCare: 'إرشادات عامة',
  },
  en: {
    title: 'Local guidance assistant', hint: 'Runs on this device; no data or API key is sent.', placeholder: 'Example: chest pain with shortness of breath', ask: 'Analyse symptoms', empty: 'Describe the pain or symptoms first.', emergency: 'Red flags: seek emergency care now.', urgent: 'Prompt medical assessment is recommended; do not rely on chat alone.', education: 'Educational guidance only—not a diagnosis or prescription.', understanding: 'What I understood', triage: 'Urgency', selfCare: 'General guidance',
  },
  fr: {
    title: 'Assistant local d’orientation', hint: 'Fonctionne sur l’appareil; aucune donnée ni clé API n’est envoyée.', placeholder: 'Exemple : douleur thoracique avec essoufflement', ask: 'Analyser les symptômes', empty: 'Décrivez d’abord la douleur ou les symptômes.', emergency: 'Signes d’alerte : consultez les urgences maintenant.', urgent: 'Une évaluation médicale rapide est recommandée; ne comptez pas seulement sur le chat.', education: 'Information éducative uniquement, sans diagnostic ni prescription.', understanding: 'Ce que j’ai compris', triage: 'Urgence', selfCare: 'Conseils généraux',
  },
} as const;

type Copy = { title: string; hint: string; placeholder: string; ask: string; empty: string; emergency: string; urgent: string; education: string; understanding: string; triage: string; selfCare: string };

const triageLabel = (level: AssistantReply['triage']['level'], language: Language) => ({
  ar: { self_care: 'عناية ذاتية مع المراقبة', routine: 'موعد طبي روتيني', soon: 'تقييم قريب', urgent: 'تقييم عاجل', emergency: 'طوارئ' },
  en: { self_care: 'Self-care with monitoring', routine: 'Routine appointment', soon: 'Prompt assessment', urgent: 'Urgent assessment', emergency: 'Emergency' },
  fr: { self_care: 'Auto-soins et surveillance', routine: 'Rendez-vous habituel', soon: 'Évaluation rapide', urgent: 'Évaluation urgente', emergency: 'Urgences' },
}[language][level]);

export function LocalAIChat({ language = 'ar' }: Props) {
  const [question, setQuestion] = useState('');
  const [reply, setReply] = useState<AssistantReply | null>(null);
  const [error, setError] = useState('');
  const c = copy[language];
  const rtl = language === 'ar';

  const ask = () => {
    const text = question.trim();
    if (!text) { setError(c.empty); return; }
    setError('');
    // Force a complete, bounded answer after this single inline prompt while
    // preserving the medical engine's red-flag priority and disclaimer.
    setReply(analyzeMessage(text, language, false, { forceAnswer: true, userTurnCount: 3 }));
  };

  return (
    <View style={styles.card}>
      <Text style={[styles.title, { textAlign: rtl ? 'right' : 'left' }]}>{c.title}</Text>
      <Text style={[styles.hint, { textAlign: rtl ? 'right' : 'left' }]}>{c.hint}</Text>
      <TextInput value={question} onChangeText={(value) => { setQuestion(value); if (error) setError(''); }} placeholder={c.placeholder} placeholderTextColor="#8A9AA5" style={[styles.input, { textAlign: rtl ? 'right' : 'left' }]} multiline accessibilityLabel={c.placeholder} />
      <Pressable onPress={ask} style={styles.button} accessibilityRole="button"><Text style={styles.buttonText}>{c.ask}</Text></Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {reply ? <ReplyCard reply={reply} language={language} copy={c} rtl={rtl} /> : null}
      <Text style={styles.disclaimer}>{c.education}</Text>
    </View>
  );
}

function ReplyCard({ reply, language, copy: c, rtl }: { reply: AssistantReply; language: Language; copy: Copy; rtl: boolean }) {
  const level = reply.triage.level;
  const alert = level === 'emergency' || level === 'urgent';
  return <View style={styles.reply}>
    <View style={styles.triageRow}><Text style={styles.triageLabel}>{c.triage}</Text><Text style={[styles.triageValue, alert && styles.alertText]}>{triageLabel(level, language)}</Text></View>
    {alert ? <Text style={[styles.alertBox, { textAlign: rtl ? 'right' : 'left' }]}>{level === 'emergency' ? c.emergency : c.urgent}</Text> : null}
    {reply.understanding.length ? <><Text style={[styles.section, { textAlign: rtl ? 'right' : 'left' }]}>{c.understanding}</Text>{reply.understanding.slice(0, 4).map((item, index) => <Text key={`${index}-${item}`} style={[styles.line, { textAlign: rtl ? 'right' : 'left' }]}>• {item}</Text>)}</> : null}
    {reply.selfCare.length ? <><Text style={[styles.section, { textAlign: rtl ? 'right' : 'left' }]}>{c.selfCare}</Text>{reply.selfCare.slice(0, 3).map((item, index) => <Text key={`${index}-${item}`} style={[styles.line, { textAlign: rtl ? 'right' : 'left' }]}>• {item}</Text>)}</> : null}
  </View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFF9ED', borderRadius: 18, padding: 16, marginTop: 14, borderWidth: 1, borderColor: '#F0D19A' },
  title: { color: '#8D5A00', fontWeight: '900', fontSize: 17 },
  hint: { color: '#78633A', fontSize: 12, marginTop: 5 },
  input: { backgroundColor: '#FFF', borderRadius: 12, padding: 12, marginTop: 11, borderWidth: 1, borderColor: '#EAD9B3', color: '#203745', minHeight: 48 },
  button: { backgroundColor: '#8D5A00', borderRadius: 12, padding: 12, alignItems: 'center', marginTop: 9 },
  buttonText: { color: '#FFF', fontWeight: '900' },
  error: { color: '#B42318', textAlign: 'right', marginTop: 8, fontSize: 12 },
  reply: { backgroundColor: '#FFF', borderRadius: 12, padding: 12, marginTop: 12, borderWidth: 1, borderColor: '#EAD9B3' },
  triageRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', gap: 8 },
  triageLabel: { color: '#78633A', fontWeight: '700' },
  triageValue: { color: '#8D5A00', fontWeight: '900', flexShrink: 1 },
  alertText: { color: '#B42318' },
  alertBox: { color: '#9F1239', backgroundColor: '#FFF1F2', borderRadius: 9, padding: 9, marginTop: 10, lineHeight: 19, fontWeight: '800' },
  section: { color: '#5B4B2A', fontWeight: '900', marginTop: 12 },
  line: { color: '#5B4B2A', lineHeight: 21, marginTop: 4 },
  disclaimer: { color: '#8A7B5B', fontSize: 11, textAlign: 'center', marginTop: 10 },
});
