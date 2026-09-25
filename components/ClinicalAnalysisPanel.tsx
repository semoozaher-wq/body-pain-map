import React, { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { Fonts } from '../constants/fonts';
import { Spacing, BorderRadius } from '../constants/spacing';
import {
  assessImageQuality,
  buildFollowUpQuestions,
  runRuleBasedTriage,
} from '../services/clinicalAnalysis';
import type { FollowUpQuestion, ImageQualityReport, TriageResult } from '../services/clinicalAnalysis';

// نسخة تجريبية من محرك التحليل: فحص جودة الصورة -> أسئلة توضيحية -> فرز قبل أي نموذج ذكي.
// لا تُرفع الصورة ولا تُرسل لأي خدمة في هذا العرض.

type Answers = Record<string, string>;

export function ClinicalAnalysisPanel({ groupKey }: { groupKey?: string }) {
  const { colors } = useTheme();
  const [quality, setQuality] = useState<ImageQualityReport | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [result, setResult] = useState<TriageResult | null>(null);
  const [note, setNote] = useState('');

  const questions = useMemo<FollowUpQuestion[]>(() => buildFollowUpQuestions({ groupKey }), [groupKey]);

  const readFile = (file: File) => {
    const url = URL.createObjectURL(file);
    const image = new window.Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 320 / Math.max(image.width, image.height));
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext('2d');
      if (!context) return;
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const data = context.getImageData(0, 0, canvas.width, canvas.height);
      // فحص الجودة على الصورة الكاملة الأبعاد لتفادي إنقاص الحدّة عند التصغير
      setQuality(assessImageQuality(data.data, canvas.width, canvas.height));
      URL.revokeObjectURL(url);
    };
    image.onerror = () => setNote('تعذّر قراءة الصورة المختارة.');
    image.src = url;
  };

  const submit = () => {
    const triage = runRuleBasedTriage({
      groupKey,
      severity: Number(answers.severity),
      fever: answers.fever === 'نعم',
      spreading: answers.spreading === 'نعم',
      blister: answers.blister === 'نعم',
      durationDays: answers.onset === 'منذ أكثر من شهر' ? 40 : answers.onset === 'منذ أسابيع' ? 21 : answers.onset === 'منذ أيام' ? 3 : 1,
    });
    setResult(triage);
  };

  const urgencyTone = result
    ? result.escalation
      ? { bg: colors.dangerLight, border: colors.danger, fg: colors.danger }
      : { bg: colors.successLight, border: colors.success, fg: colors.success }
    : { bg: colors.backgroundAlt, border: colors.border, fg: colors.textSecondary };

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>المسار التشخيصي التجريبي</Text>
      <Text style={[styles.hint, { color: colors.textSecondary }]}>
        ثلاث مراحل: فحص جودة الصورة ← أسئلة توضيحية ← فرز قائم على القواعد قبل أي نموذج ذكي. الصورة تُعالج على جهازك فقط.
      </Text>

      <View style={[styles.stage, { backgroundColor: colors.backgroundAlt, borderColor: colors.border }]}>
        <Text style={[styles.stageTitle, { color: colors.textPrimary }]}>1) فحص جودة الصورة</Text>
        {Platform.OS === 'web' ? (
          <input
            type="file"
            accept="image/*"
            aria-label="اختيار صورة للفحص"
            onChange={(event) => { const file = event.target.files?.[0]; if (file) readFile(file); }}
            style={{ marginTop: 8 }}
          />
        ) : (
          <Text style={[styles.hint, { color: colors.textLight }]}>فحص الجودة يعمل في نسخة الويب؛ في الهاتف يُربط expo-image-picker لاحقًا.</Text>
        )}
        {quality && (
          <Text style={[styles.resultLine, { color: quality.ok ? colors.success : colors.warning }]}>
            {quality.ok ? '✓' : '⚠'} {quality.messageAr} (تباين الحدّة: {quality.laplacianVariance.toFixed(1)})
          </Text>
        )}
      </View>

      <View style={[styles.stage, { backgroundColor: colors.backgroundAlt, borderColor: colors.border }]}>
        <Text style={[styles.stageTitle, { color: colors.textPrimary }]}>2) أسئلة توضيحية</Text>
        {questions.map((question) => (
          <View key={question.id} style={styles.question}>
            <Text style={[styles.questionText, { color: colors.textPrimary }]}>{question.questionAr}</Text>
            {question.type === 'number' ? (
              <TextInput
                value={answers[question.id] ?? ''}
                onChangeText={(value) => setAnswers((current) => ({ ...current, [question.id]: value.replace(/[^0-9]/g, '').slice(0, 2) }))}
                keyboardType="number-pad"
                placeholder="0–10"
                placeholderTextColor={colors.textLight}
                style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface }]}
                textAlign="right"
              />
            ) : (
              <View style={styles.chips}>
                {(question.options ?? []).map((option) => {
                  const active = answers[question.id] === option;
                  return (
                    <Pressable
                      key={option}
                      onPress={() => setAnswers((current) => ({ ...current, [question.id]: option }))}
                      style={[styles.chip, { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primaryLight : colors.surface }]}
                    >
                      <Text style={[styles.chipText, { color: active ? colors.primaryDark : colors.textSecondary }]}>{option}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        ))}
        <Pressable onPress={submit} style={[styles.button, { backgroundColor: colors.primary }]}>
          <Text style={styles.buttonText}>تحليل إرشادي</Text>
        </Pressable>
      </View>

      {result && (
        <View style={[styles.stage, { backgroundColor: urgencyTone.bg, borderColor: urgencyTone.border }]}>
          <Text style={[styles.stageTitle, { color: urgencyTone.fg }]}>3) نتيجة الفرز الإرشادية</Text>
          {result.reasonsAr.map((reason) => (
            <Text key={reason} style={[styles.resultLine, { color: colors.textPrimary }]}>• {reason}</Text>
          ))}
          <Text style={[styles.resultLine, { color: colors.textPrimary }]}>التخصص الموصى به: {result.specialty}</Text>
          <Text style={[styles.disclaimer, { color: colors.textLight }]}>
            هذه احتمالات إرشادية وليست تشخيصًا طبيًا؛ قد يتشابه أكثر من حالة في نفس الأعراض. راجع طبيبًا مؤهلًا.
          </Text>
        </View>
      )}
      {note ? <Text style={[styles.hint, { color: colors.warning }]}>{note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: BorderRadius.xl, borderWidth: 1, padding: Spacing.lg, marginTop: Spacing.md },
  title: { fontFamily: Fonts.arabic.bold, fontSize: Fonts.sizes.lg, textAlign: 'right' },
  hint: { fontFamily: Fonts.arabic.regular, fontSize: Fonts.sizes.sm, textAlign: 'right', lineHeight: 21, marginTop: Spacing.sm },
  stage: { borderRadius: BorderRadius.lg, borderWidth: 1, padding: Spacing.md, marginTop: Spacing.md },
  stageTitle: { fontFamily: Fonts.arabic.bold, fontSize: Fonts.sizes.md, textAlign: 'right' },
  question: { marginTop: Spacing.md },
  questionText: { fontFamily: Fonts.arabic.medium, fontSize: Fonts.sizes.sm, textAlign: 'right', marginBottom: Spacing.xs },
  chips: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: Spacing.sm },
  chip: { borderRadius: BorderRadius.md, borderWidth: 1, paddingVertical: 6, paddingHorizontal: Spacing.md },
  chipText: { fontFamily: Fonts.arabic.bold, fontSize: Fonts.sizes.xs },
  input: { borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.sm, fontFamily: Fonts.arabic.regular, minHeight: 42 },
  button: { borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: 'center', marginTop: Spacing.md },
  buttonText: { color: '#FFFFFF', fontFamily: Fonts.arabic.bold, fontSize: Fonts.sizes.md },
  resultLine: { fontFamily: Fonts.arabic.regular, fontSize: Fonts.sizes.sm, textAlign: 'right', lineHeight: 22, marginTop: Spacing.xs },
  disclaimer: { fontFamily: Fonts.arabic.regular, fontSize: Fonts.sizes.xs, textAlign: 'right', lineHeight: 18, marginTop: Spacing.sm },
});
