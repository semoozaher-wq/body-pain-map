import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { CONDITIONS, smartSearch, type MedicalCondition } from '../services/medical/diseaseLibrary';
import organDetails from '../data/organDetails.json';
import type { Language } from '../services/i18n';
import { useTheme } from '../hooks/useTheme';

type Props = { language: Language; direction: 'rtl' | 'ltr'; onOpenAssistant: (context?: string) => void };
type Guide = { title: Record<Language,string>; text: Record<Language,string> };

const GUIDES: Guide[] = [
  { title: { ar: 'الأكل والشرب', en: 'Food & drinks', fr: 'Alimentation & boissons' }, text: { ar: 'الاختيارات الغذائية تختلف حسب الحالة والأدوية والحالة الصحية. استخدم المعلومات هنا كإرشاد عام ولا تعتبر أي قائمة ممنوعات تشخيصًا أو وصفة علاج.', en: 'Food choices vary with the condition, medicines, and overall health. Use this as general education, not as a diagnosis or prescription.', fr: 'Les choix alimentaires varient selon la maladie, les médicaments et l’état général. Utilisez ces informations comme éducation générale, pas comme diagnostic ou prescription.' } },
  { title: { ar: 'ما الذي أتجنبه؟', en: 'What should I avoid?', fr: 'Que faut-il éviter ?' }, text: { ar: 'تجنب ما يفاقم الأعراض التي تلاحظها، ولا توقف دواءً موصوفًا أو تبدأ علاجًا عشبيًا اعتمادًا على صفحة المعلومات وحدها.', en: 'Avoid things that clearly worsen your symptoms, but do not stop prescribed medicines or start herbal treatment based on this page alone.', fr: 'Évitez ce qui aggrave clairement vos symptômes, mais n’arrêtez pas un traitement prescrit et ne commencez pas une plante médicinale sur cette seule page.' } },
  { title: { ar: 'الممارسات الشعبية والأعشاب', en: 'Traditional practices & herbs', fr: 'Pratiques traditionnelles & plantes' }, text: { ar: 'أي وصفة شعبية يجب اعتبارها ممارسة تقليدية وليست علاجًا مثبتًا. راجع الطبيب أو الصيدلي خصوصًا مع الحمل أو الأمراض المزمنة أو الأدوية المتعددة.', en: 'Traditional remedies are presented as cultural practices, not proven treatments. Check with a clinician or pharmacist, especially with pregnancy, chronic disease, or multiple medicines.', fr: 'Les remèdes traditionnels sont présentés comme pratiques culturelles, pas comme traitements prouvés. Demandez conseil, notamment en cas de grossesse, maladie chronique ou polymédication.' } },
];

export const HealthInfoScreen: React.FC<Props> = ({ language, direction, onOpenAssistant }) => {
  const { colors } = useTheme();
  const rtl = direction === 'rtl';
  const [query, setQuery] = useState('');
  const results = useMemo(() => query.trim().length >= 2 ? smartSearch(query, CONDITIONS, 8) : [], [query]);
  const organMatches = useMemo(() => {
    if (query.trim().length < 2) return [] as Array<{ id: string; name: string; detail: any }>;
    const q = query.trim().toLowerCase();
    return Object.entries(organDetails).filter(([id, d]: any) => [id, d.name, d.location].join(' ').toLowerCase().includes(q)).slice(0, 6).map(([id, detail]: any) => ({ id, name: detail.name, detail }));
  }, [query]);
  const t = (ar: string, en: string, fr: string) => language === 'ar' ? ar : language === 'fr' ? fr : en;

  return <View style={styles.container}>
    <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.textPrimary, textAlign: rtl ? 'right' : 'left' }]}>{t('المعلومات الصحية', 'Health information', 'Informations de santé')}</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary, textAlign: rtl ? 'right' : 'left' }]}>{t('ابحث عن مرض أو عرض أو عضو أو غدة، وشوف المعلومات المرتبطة به.', 'Search for a condition, symptom, organ, or gland and review linked information.', 'Recherchez une maladie, un symptôme, un organe ou une glande et consultez les informations associées.')}</Text>
      <TextInput value={query} onChangeText={setQuery} placeholder={t('اكتب مثلاً: القولون، الغدة الدرقية، حرقان المعدة، تنميل...', 'Try: IBS, thyroid, stomach burning, numbness...', 'Ex. : côlon irritable, thyroïde, brûlures d’estomac, engourdissement...')} placeholderTextColor={colors.textLight} style={[styles.search, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.background, textAlign: rtl ? 'right' : 'left' }]} />
    </View>

    {results.map(({ condition }: { condition: MedicalCondition }) => <ConditionCard key={condition.id} condition={condition} language={language} colors={colors} rtl={rtl} />)}
    {organMatches.map(({ id, detail }) => <OrganCard key={id} id={id} detail={detail} language={language} colors={colors} rtl={rtl} />)}

    {query.trim().length >= 2 && results.length === 0 && organMatches.length === 0 && <Text style={[styles.empty, { color: colors.textSecondary }]}>{t('ملقتش نتيجة مطابقة في المكتبة المحلية. جرّب كلمة أبسط أو اسأل المساعد الذكي.', 'No matching item was found in the local library. Try a simpler term or ask the AI assistant.', 'Aucun résultat correspondant dans la bibliothèque locale. Essayez un terme plus simple ou demandez à l’assistant IA.')}</Text>}

    <View style={[styles.guides, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {GUIDES.map((g) => <View key={g.title.en} style={styles.guide}><Text style={[styles.guideTitle, { color: colors.primaryDark, textAlign: rtl ? 'right' : 'left' }]}>{g.title[language]}</Text><Text style={[styles.guideText, { color: colors.textSecondary, textAlign: rtl ? 'right' : 'left' }]}>{g.text[language]}</Text></View>)}
    </View>

    <Pressable onPress={() => onOpenAssistant(query.trim() || undefined)} style={[styles.aiButton, { backgroundColor: colors.primary }]} accessibilityRole="button"><Text style={styles.aiText}>{t('✦ اسأل المساعد الذكي عن حالتك', '✦ Ask the AI assistant about your case', '✦ Demander à l’assistant IA')}</Text></Pressable>
    <Text style={[styles.disclaimer, { color: colors.textLight }]}>{t('المحتوى تعليمي عام، ولا يشخّص الحالة ولا يغيّر علاجًا موصوفًا. عند علامات الخطر اطلب رعاية عاجلة.', 'Educational information only. It does not diagnose or replace prescribed care. Seek urgent care for red flags.', 'Informations éducatives uniquement. Elles ne posent pas de diagnostic et ne remplacent pas un traitement prescrit. En cas de signe d’alerte, consultez en urgence.')}</Text>
  </View>;
};

function ConditionCard({ condition, language, colors, rtl }: any) {
  const red = condition.redFlags?.[language] || condition.redFlags?.ar;
  return <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
    <Text style={[styles.cardTitle, { color: colors.textPrimary, textAlign: rtl ? 'right' : 'left' }]}>{condition.name[language] ?? condition.name.ar}</Text>
    <Text style={[styles.cardText, { color: colors.textSecondary, textAlign: rtl ? 'right' : 'left' }]}>{condition.summary[language] ?? condition.summary.ar}</Text>
    {!!red && <View style={styles.alert}><Text style={styles.alertText}>{red}</Text></View>}
    {!!condition.sources?.length && <Text style={[styles.sourceText, { color: colors.textLight, textAlign: rtl ? 'right' : 'left' }]}>{condition.sources.slice(0, 2).map((s: any) => s.title).join(' · ')}</Text>}
  </View>;
}

function OrganCard({ detail, language, colors, rtl }: any) {
  const name = detail.name;
  return <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
    <Text style={[styles.cardTitle, { color: colors.textPrimary, textAlign: rtl ? 'right' : 'left' }]}>{name}</Text>
    <Text style={[styles.cardText, { color: colors.textSecondary, textAlign: rtl ? 'right' : 'left' }]}>{detail.location}</Text>
    {!!detail.warning && <View style={styles.alert}><Text style={styles.alertText}>{detail.warning}</Text></View>}
    {!!detail.recommendation && <Text style={[styles.cardText, { color: colors.textSecondary, textAlign: rtl ? 'right' : 'left' }]}>{detail.recommendation}</Text>}
  </View>;
}

const styles = StyleSheet.create({
  container: { paddingTop: 4, gap: 10 }, hero: { borderWidth: 1, borderRadius: 18, padding: 14 }, title: { fontSize: 22, fontWeight: '900' }, subtitle: { fontSize: 13, lineHeight: 20, marginTop: 5 }, search: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, marginTop: 12, fontSize: 14 }, card: { borderWidth: 1, borderRadius: 16, padding: 13 }, cardTitle: { fontSize: 16, fontWeight: '900' }, cardText: { fontSize: 13, lineHeight: 20, marginTop: 6 }, alert: { backgroundColor: '#FFF1F2', borderRadius: 10, padding: 9, marginTop: 9 }, alertText: { color: '#9F1239', fontSize: 12, lineHeight: 18, textAlign: 'right', fontWeight: '700' }, sourceText: { fontSize: 10, marginTop: 8 }, empty: { textAlign: 'center', lineHeight: 20, padding: 12 }, guides: { borderWidth: 1, borderRadius: 16, padding: 12 }, guide: { paddingVertical: 7 }, guideTitle: { fontSize: 14, fontWeight: '900' }, guideText: { fontSize: 12, lineHeight: 19, marginTop: 4 }, aiButton: { borderRadius: 14, paddingVertical: 13, alignItems: 'center' }, aiText: { color: '#FFF', fontWeight: '900', fontSize: 13 }, disclaimer: { fontSize: 10, lineHeight: 16, textAlign: 'center', paddingHorizontal: 8, paddingBottom: 10 },
});
