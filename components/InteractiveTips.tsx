import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = { groupKey: string; groupLabel: string; intensity: number; urgent: boolean };
type Tip = { title: string; text: string };

const tipsByGroup: Record<string, Tip[]> = {
  neck: [
    { title: 'خفف وضعية الرقبة', text: 'خذ فواصل قصيرة من الهاتف أو العمل المكتبي، وحافظ على الرأس في وضع مريح دون شد أو حركات مفاجئة.' },
    { title: 'حركة لطيفة فقط', text: 'حرّك الرقبة ضمن مدى مريح وتوقف إذا زاد الألم أو ظهر تنميل أو ضعف.' },
  ],
  chest: [
    { title: 'لا تتجاهل ألم الصدر', text: 'إذا كان الألم ضاغطًا أو مصحوبًا بضيق نفس أو عرق بارد أو دوخة، اطلب المساعدة العاجلة فورًا.' },
    { title: 'أوقف المجهود', text: 'اجلس وارتَح وتجنب المجهود إلى أن تتضح الحالة أو تحصل على تقييم طبي.' },
  ],
  abs: [
    { title: 'راقب تطور الأعراض', text: 'دوّن وقت بداية الألم وما إذا كان يتغير مع الطعام أو الحركة، واطلب تقييمًا إذا استمر أو ازداد.' },
    { title: 'سوائل وراحة', text: 'حافظ على السوائل إذا لم يمنعك طبيب من ذلك، وتجنب الوجبات الثقيلة مؤقتًا إذا كانت تزيد الانزعاج.' },
  ],
  obliques: [
    { title: 'قارن الألم بالحركة', text: 'لاحظ هل يتغير مع الالتفاف أو السعال، وتجنب التمدد القوي أو حمل الأوزان حتى يهدأ.' },
    { title: 'لا تضغط على المنطقة', text: 'الفحص الذاتي بالضغط المتكرر قد يزيد الانزعاج ولا يحدد السبب.' },
  ],
  'upper-back': [
    { title: 'عدّل وضعية الجلوس', text: 'اسند الظهر والكتفين، وغيّر وضعيتك بانتظام بدل البقاء ثابتًا فترة طويلة.' },
    { title: 'كمادة مريحة', text: 'يمكن تجربة كمادة دافئة أو باردة لفترة قصيرة إذا كانت مريحة لك، وتوقف إذا زاد الألم.' },
  ],
  'lower-back': [
    { title: 'استمر بحركة خفيفة', text: 'تجنب الراحة الطويلة في السرير، وحافظ على مشي خفيف ضمن حدود الراحة ما لم يوجهك طبيب بغير ذلك.' },
    { title: 'احمِ الظهر', text: 'تجنب رفع الأحمال أو الالتواء المفاجئ، واطلب تقييمًا عند وجود ضعف أو فقدان تحكم أو ألم ممتد للساق.' },
  ],
  head: [
    { title: 'خفف المحفزات', text: 'اجلس في مكان هادئ وخفف الضوء والشاشات إذا كانت تزيد الألم، وسجّل وقت البداية والأعراض المصاحبة.' },
    { title: 'اطلب تقييمًا سريعًا عند التغير المفاجئ', text: 'الصداع المفاجئ جدًا أو المصحوب بضعف أو ارتباك أو إغماء يستدعي المساعدة العاجلة.' },
  ],
};

const defaultTips: Tip[] = [
  { title: 'راقب الأعراض', text: 'سجّل ما يزيد الألم وما يخففه، وراجع طبيبًا إذا استمر أو عاد بشكل متكرر.' },
  { title: 'حركة ضمن الراحة', text: 'تجنب المجهود الذي يزيد الألم، ولا تستخدم تمارين قوية أو علاجًا جديدًا دون توجيه مختص.' },
];

export function InteractiveTips({ groupKey, groupLabel, intensity, urgent }: Props) {
  const [expanded, setExpanded] = useState(false);
  const tips = useMemo(() => tipsByGroup[groupKey] ?? defaultTips, [groupKey]);
  const visibleTips = expanded ? tips : tips.slice(0, 1);
  return (
    <View style={styles.card}>
      <View style={styles.headingRow}>
        <Text style={styles.icon}>✦</Text>
        <View style={styles.headingCopy}>
          <Text style={styles.title}>نصائح مناسبة لـ {groupLabel}</Text>
          <Text style={styles.subtitle}>إرشادات عامة تتغير حسب المكان وشدة الألم</Text>
        </View>
      </View>
      {urgent ? <View style={styles.urgent}><Text style={styles.urgentText}>بسبب شدة الألم أو علامات الإنذار، الأولوية لطلب تقييم طبي وليس تجربة نصائح منزلية.</Text></View> : null}
      {visibleTips.map((tip) => <View key={tip.title} style={styles.tip}><Text style={styles.tipTitle}>{tip.title}</Text><Text style={styles.tipText}>{tip.text}</Text></View>)}
      {intensity <= 3 && !urgent ? <Text style={styles.mild}>الشدة المسجلة منخفضة، لكن استمرار الألم أو تكراره يستحق استشارة مختص.</Text> : null}
      <Pressable onPress={() => setExpanded((value) => !value)} accessibilityRole="button" style={styles.moreButton}><Text style={styles.moreText}>{expanded ? 'عرض نصيحة واحدة' : 'عرض كل النصائح'}</Text></Pressable>
      <Text style={styles.disclaimer}>هذه إرشادات عامة وليست تشخيصًا أو وصفة علاجية.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#F0FBF8', borderRadius: 20, padding: 18, marginTop: 14, borderWidth: 1, borderColor: '#B8E9E0' },
  headingRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  headingCopy: { flex: 1 },
  icon: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#0E7C86', color: '#BFF8EF', fontSize: 20, textAlign: 'center', lineHeight: 34 },
  title: { color: '#0E5962', fontSize: 17, fontWeight: '900', textAlign: 'right' },
  subtitle: { color: '#5C7F82', fontSize: 11, textAlign: 'right', marginTop: 3 },
  tip: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 13, marginTop: 11, borderWidth: 1, borderColor: '#D9EFEB' },
  tipTitle: { color: '#184D55', fontWeight: '900', textAlign: 'right', marginBottom: 5 },
  tipText: { color: '#526A75', lineHeight: 21, textAlign: 'right' },
  urgent: { backgroundColor: '#FFF0EE', borderRadius: 12, padding: 11, marginTop: 12, borderWidth: 1, borderColor: '#F2B9B1' },
  urgentText: { color: '#8B4038', lineHeight: 20, textAlign: 'right', fontWeight: '700' },
  mild: { color: '#507477', fontSize: 12, lineHeight: 19, textAlign: 'right', marginTop: 10 },
  moreButton: { alignSelf: 'flex-end', paddingVertical: 10 },
  moreText: { color: '#0E7C86', fontWeight: '900', textAlign: 'right' },
  disclaimer: { color: '#71808C', fontSize: 11, lineHeight: 18, textAlign: 'center', marginTop: 4 },
});
