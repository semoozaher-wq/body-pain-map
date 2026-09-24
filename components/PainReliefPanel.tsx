import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import guides from '../data/selfCareGuides.json';

type Guide = (typeof guides)[keyof typeof guides];
type GuideKey = keyof typeof guides;
type Point = Guide['points'][number];

type Props = {
  guideKey?: string | null;
  onSaveResult?: (result: { guideKey: string; pointId?: string; before: number; after: number }) => void;
};

const guideAliases: Record<string, GuideKey> = {
  neck: 'neck', trapezius: 'neck', deltoids: 'shoulder', chest: 'shoulder',
  'upper-back': 'shoulder', 'lower-back': 'lower-back', gluteal: 'lower-back',
  forearm: 'forearm', hands: 'forearm',
};

export function PainReliefPanel({ guideKey, onSaveResult }: Props) {
  const key = guideAliases[guideKey ?? ''] ?? 'generic';
  const guide = guides[key] as Guide;
  const [selectedPoint, setSelectedPoint] = useState<Point | null>(guide.points[0] ?? null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [before, setBefore] = useState<number | null>(null);
  const [after, setAfter] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSelectedPoint(guide.points[0] ?? null);
    setSecondsLeft(0);
    setBefore(null);
    setAfter(null);
    setSaved(false);
  }, [key]);

  useEffect(() => {
    if (secondsLeft <= 0) return undefined;
    const timer = setInterval(() => setSecondsLeft((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [secondsLeft]);

  const selectedIndex = useMemo(() => guide.points.findIndex((point) => point.id === selectedPoint?.id), [guide.points, selectedPoint]);
  const startTimer = () => setSecondsLeft(selectedPoint?.durationSeconds ?? 30);
  const chooseRating = (value: number, type: 'before' | 'after') => {
    if (type === 'before') setBefore(value); else setAfter(value);
  };
  const save = () => {
    if (before === null || after === null) return;
    onSaveResult?.({ guideKey: key, pointId: selectedPoint?.id, before, after });
    setSaved(true);
  };

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}><View style={styles.badge}><Text style={styles.badgeText}>مساعدة ذاتية</Text></View><Text style={styles.title}>خطة تخفيف {guide.labelAr}</Text></View>
      <Text style={styles.subtitle}>إرشاد عام للألم الخفيف والشد العضلي، وليس تشخيصًا أو علاجًا بديلًا.</Text>

      <View style={styles.safetyBox}><Text style={styles.safetyTitle}>قبل أن تضغط</Text><Text style={styles.safetyText}>{guide.safety}</Text><Text style={styles.safetyText}>لا تستخدم الخريطة إذا كان لديك: {guide.avoidIf.join('، ')}.</Text><Text style={styles.safetyText}>عند وجود علامة خطر أو ألم شديد/مفاجئ، أوقف التجربة واطلب تقييمًا طبيًا.</Text></View>

      {guide.points.length > 0 && <>
        <Text style={styles.sectionTitle}>نقاط تخفيف لطيفة</Text>
        <Text style={styles.hint}>النقطة الخضراء تعني ضغطًا لطيفًا فقط. لا تضغط على العظام أو مقدمة الرقبة أو موضع يسبب تنميلًا.</Text>
        <View style={styles.pointTabs}>{guide.points.map((point, index) => <Pressable key={point.id} onPress={() => { setSelectedPoint(point); setSecondsLeft(0); }} style={[styles.pointTab, selectedIndex === index && styles.pointTabActive]}><Text style={[styles.pointTabText, selectedIndex === index && styles.pointTabTextActive]}>{point.nameAr}</Text><Text style={styles.pointNumber}>نقطة {index + 1}</Text></Pressable>)}</View>
        {selectedPoint && <View style={styles.pointCard}><Text style={styles.pointTitle}>{selectedPoint.nameAr}</Text><Text style={styles.label}>المكان</Text><Text style={styles.body}>{selectedPoint.location}</Text><Text style={styles.label}>قد تساعد في</Text><Text style={styles.body}>{selectedPoint.benefit}</Text><Text style={styles.label}>طريقة الاستخدام</Text><Text style={styles.body}>{selectedPoint.technique}</Text><View style={styles.timerRow}><Text style={styles.timerText}>{secondsLeft > 0 ? `الوقت المتبقي: ${secondsLeft} ثانية` : `المدة المقترحة: ${selectedPoint.durationSeconds} ثانية × ${selectedPoint.repetitions}`}</Text><Pressable onPress={startTimer} style={styles.timerButton}><Text style={styles.timerButtonText}>{secondsLeft > 0 ? 'جارٍ' : 'ابدأ المؤقت'}</Text></Pressable></View><Text style={styles.caution}>توقف: {selectedPoint.caution}</Text></View>}
      </>}

      <View style={styles.planCard}><Text style={styles.sectionTitle}>خطة 5 دقائق</Text>{guide.plan.map((step, index) => <Text key={step} style={styles.planStep}><Text style={styles.stepNumber}>{index + 1}</Text>{step}</Text>)}<Text style={styles.label}>التمدد المقترح: {guide.stretch.nameAr}</Text>{guide.stretch.steps.map((step) => <Text key={step} style={styles.body}>• {step}</Text>)}<Text style={styles.temperature}>{guide.temperature}</Text></View>

      <View style={styles.ratingCard}><Text style={styles.sectionTitle}>قيّم الألم قبل وبعد</Text><Text style={styles.ratingHint}>اختر رقمًا من 0 (بدون ألم) إلى 10 (أشد ألم).</Text><Text style={styles.ratingLabel}>قبل الخطة</Text><View style={styles.ratingRow}>{Array.from({ length: 11 }, (_, value) => <Pressable key={`before-${value}`} onPress={() => chooseRating(value, 'before')} style={[styles.rating, before === value && styles.ratingActive]}><Text style={[styles.ratingText, before === value && styles.ratingTextActive]}>{value}</Text></Pressable>)}</View><Text style={styles.ratingLabel}>بعد الخطة</Text><View style={styles.ratingRow}>{Array.from({ length: 11 }, (_, value) => <Pressable key={`after-${value}`} onPress={() => chooseRating(value, 'after')} style={[styles.rating, after === value && styles.ratingActive]}><Text style={[styles.ratingText, after === value && styles.ratingTextActive]}>{value}</Text></Pressable>)}</View><Pressable disabled={before === null || after === null} onPress={save} style={[styles.saveButton, (before === null || after === null) && styles.saveButtonDisabled]}><Text style={styles.saveButtonText}>{saved ? 'تم حفظ التقييم' : 'حفظ النتيجة في السجل'}</Text></Pressable>{before !== null && after !== null && <Text style={styles.result}>{after < before ? `تحسن بمقدار ${before - after} درجات.` : after === before ? 'لم يتغير الألم؛ لا تكرر الضغط إذا لم يكن مريحًا.' : 'زاد الألم؛ أوقف الخطة واطلب نصيحة مناسبة إذا استمر.'}</Text>}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 15, marginTop: 14, borderWidth: 1, borderColor: '#CFE4E5' },
  titleRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, title: { flex: 1, color: '#173D48', fontSize: 18, fontWeight: '900', textAlign: 'right' }, badge: { backgroundColor: '#E5F5F2', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 }, badgeText: { color: '#0E6972', fontSize: 11, fontWeight: '900' }, subtitle: { color: '#60757D', textAlign: 'right', lineHeight: 20, marginTop: 7 },
  safetyBox: { backgroundColor: '#FFF7E6', borderWidth: 1, borderColor: '#F3D59A', borderRadius: 12, padding: 11, marginTop: 12 }, safetyTitle: { color: '#7A5600', fontWeight: '900', textAlign: 'right', marginBottom: 4 }, safetyText: { color: '#7A5600', textAlign: 'right', lineHeight: 19, fontSize: 12, marginTop: 3 }, sectionTitle: { color: '#0E6972', fontSize: 16, fontWeight: '900', textAlign: 'right', marginTop: 15, marginBottom: 5 }, hint: { color: '#60757D', textAlign: 'right', lineHeight: 19, fontSize: 12 }, pointTabs: { flexDirection: 'row-reverse', gap: 8, marginTop: 10 }, pointTab: { flex: 1, borderWidth: 1, borderColor: '#D6E7E8', borderRadius: 10, padding: 9, backgroundColor: '#F8FCFC' }, pointTabActive: { backgroundColor: '#DDF5F1', borderColor: '#0E7C86' }, pointTabText: { color: '#315B63', fontWeight: '900', textAlign: 'right', fontSize: 12 }, pointTabTextActive: { color: '#0E6972' }, pointNumber: { color: '#71858D', fontSize: 10, textAlign: 'right', marginTop: 3 }, pointCard: { backgroundColor: '#F8FCFC', borderRadius: 13, padding: 12, marginTop: 10 }, pointTitle: { color: '#173D48', fontWeight: '900', fontSize: 17, textAlign: 'right' }, label: { color: '#0E6972', fontWeight: '900', fontSize: 12, textAlign: 'right', marginTop: 9 }, body: { color: '#315B63', textAlign: 'right', lineHeight: 20, fontSize: 13, marginTop: 2 }, timerRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 12 }, timerText: { flex: 1, color: '#315B63', textAlign: 'right', fontSize: 12 }, timerButton: { backgroundColor: '#0E6972', borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8 }, timerButtonText: { color: '#FFFFFF', fontWeight: '900', fontSize: 12 }, caution: { color: '#9A5B00', backgroundColor: '#FFF7E6', borderRadius: 8, padding: 8, textAlign: 'right', lineHeight: 18, fontSize: 12, marginTop: 10 },
  planCard: { backgroundColor: '#F2F8F8', borderRadius: 13, padding: 12, marginTop: 13 }, planStep: { color: '#315B63', textAlign: 'right', lineHeight: 23, fontSize: 13 }, stepNumber: { color: '#0E6972', fontWeight: '900' }, temperature: { color: '#315B63', backgroundColor: '#EAF8F5', borderRadius: 8, padding: 8, textAlign: 'right', lineHeight: 19, fontSize: 12, marginTop: 10 },
  ratingCard: { borderTopWidth: 1, borderTopColor: '#D9E7EA', marginTop: 14, paddingTop: 2 }, ratingHint: { color: '#60757D', textAlign: 'right', fontSize: 12 }, ratingLabel: { color: '#315B63', fontWeight: '900', textAlign: 'right', marginTop: 10 }, ratingRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 6 }, rating: { width: 24, height: 28, borderRadius: 7, borderWidth: 1, borderColor: '#CFE1E3', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' }, ratingActive: { backgroundColor: '#0E6972', borderColor: '#0E6972' }, ratingText: { color: '#315B63', fontSize: 11 }, ratingTextActive: { color: '#FFFFFF', fontWeight: '900' }, saveButton: { backgroundColor: '#0E6972', borderRadius: 11, padding: 12, alignItems: 'center', marginTop: 13 }, saveButtonDisabled: { opacity: 0.45 }, saveButtonText: { color: '#FFFFFF', fontWeight: '900' }, result: { color: '#0E6972', textAlign: 'right', lineHeight: 20, marginTop: 9, fontWeight: '800' },
});
