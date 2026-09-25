import React, { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import reliefData from '../data/naturalRelief.json';
import type { Language } from '../services/i18n';

type Remedy = (typeof reliefData.remedies)[number];
type Props = { language: Language };
const text = (value: { ar: string; en: string; fr: string }, language: Language) => value[language] ?? value.ar;

export function NaturalReliefPanel({ language }: Props) {
  const [selectedId, setSelectedId] = useState(reliefData.remedies[0].id);
  const remedy: Remedy = reliefData.remedies.find((item) => item.id === selectedId) ?? reliefData.remedies[0];
  const ar = language === 'ar';
  return <View style={styles.container}>
    <View style={styles.disclaimer}><Text style={styles.disclaimerTitle}>{ar ? 'مهم: إرشاد عام، مش تشخيص' : language === 'fr' ? 'Important : conseils généraux, pas un diagnostic' : 'Important: general guidance, not a diagnosis'}</Text><Text style={styles.disclaimerText}>{text(reliefData.globalNotice, language)}</Text></View>
    <Text style={styles.sectionTitle}>{ar ? 'اختار نوع العرض' : language === 'fr' ? 'Choisir le type de symptôme' : 'Choose a symptom type'}</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
      {reliefData.remedies.map((item) => <Pressable key={item.id} onPress={() => setSelectedId(item.id)} style={[styles.tab, item.id === remedy.id && styles.tabActive]}><Text style={[styles.tabText, item.id === remedy.id && styles.tabTextActive]}>{text(item.name, language)}</Text></Pressable>)}
    </ScrollView>
    <View style={styles.card}>
      <Text style={styles.title}>{text(remedy.name, language)}</Text>
      <Info label={ar ? 'إيه اللي ممكن تجربه؟' : language === 'fr' ? 'Que peut-on essayer ?' : 'What can you try?'} value={text(remedy.instructions, language)} />
      <Info label={ar ? 'مستوى الدليل' : language === 'fr' ? 'Niveau de preuve' : 'Evidence level'} value={text(remedy.evidence, language)} />
      <View style={styles.caution}><Info label={ar ? 'موانع واحتياطات' : language === 'fr' ? 'Contre-indications et précautions' : 'Contraindications and precautions'} value={text(remedy.contraindications, language)} /><Info label={ar ? 'الحمل ومميعات الدم' : language === 'fr' ? 'Grossesse et anticoagulants' : 'Pregnancy and blood thinners'} value={text(remedy.specialPopulations, language)} />{remedy.safetySources.map((source) => <Pressable key={source.url} onPress={() => Linking.openURL(source.url)}><Text style={styles.link}>↗ {source.title}</Text></Pressable>)}</View>
      <View style={styles.redFlag}><Info label={ar ? 'متى تطلب مساعدة طبية؟' : language === 'fr' ? 'Quand demander de l’aide médicale ?' : 'When to seek medical help'} value={text(remedy.redFlags, language)} /><Pressable onPress={() => Linking.openURL(remedy.redFlagSource.url)}><Text style={styles.link}>↗ {remedy.redFlagSource.title}</Text></Pressable></View>
      <Pressable onPress={() => Linking.openURL(remedy.source.url)} style={styles.source}><Text style={styles.link}>{ar ? 'المصدر الطبي: ' : language === 'fr' ? 'Source médicale : ' : 'Medical source: '}{remedy.source.title} ↗</Text></Pressable>
    </View>
    <Text style={styles.avoid}>{ar ? 'مش بننصح بأعشاب أو مكملات كعلاج تلقائي: التداخلات مع الأدوية والحمل والحالات الصحية محتاجة مراجعة طبيب/صيدلي.' : language === 'fr' ? 'Aucune plante ni aucun complément n’est recommandé automatiquement : interactions, grossesse et maladies nécessitent l’avis d’un professionnel.' : 'No herb or supplement is recommended automatically: interactions, pregnancy, and health conditions require clinician/pharmacist review.'}</Text>
  </View>;
}
function Info({ label, value }: { label: string; value: string }) { return <View style={styles.info}><Text style={styles.label}>{label}</Text><Text style={styles.body}>{value}</Text></View>; }
const styles = StyleSheet.create({
  container: { paddingTop: 4 },
  disclaimer: { backgroundColor: '#EAF8F5', borderColor: '#B9DFD8', borderWidth: 1, borderRadius: 14, padding: 13, marginBottom: 12 },
  disclaimerTitle: { color: '#0E6972', fontWeight: '900', textAlign: 'right', fontSize: 16 }, disclaimerText: { color: '#315B63', textAlign: 'right', lineHeight: 21, marginTop: 5 },
  sectionTitle: { color: '#173D48', fontSize: 18, fontWeight: '900', textAlign: 'right' },
  tabs: { flexDirection: 'row-reverse', gap: 8, paddingVertical: 10 }, tab: { maxWidth: 200, borderWidth: 1, borderColor: '#D2E2E4', borderRadius: 11, padding: 9, backgroundColor: '#FFF' }, tabActive: { backgroundColor: '#0E6972', borderColor: '#0E6972' }, tabText: { color: '#315B63', textAlign: 'right', fontWeight: '800', fontSize: 12 }, tabTextActive: { color: '#FFF' },
  card: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#D7E5E7', borderRadius: 16, padding: 14 }, title: { color: '#173D48', textAlign: 'right', fontSize: 18, fontWeight: '900' }, info: { marginTop: 11 }, label: { color: '#0E6972', textAlign: 'right', fontWeight: '900', fontSize: 12 }, body: { color: '#344F57', textAlign: 'right', lineHeight: 21, fontSize: 13, marginTop: 3 },
  caution: { backgroundColor: '#FFF7E8', borderWidth: 1, borderColor: '#F0D8A6', borderRadius: 11, padding: 9, marginTop: 12 }, redFlag: { backgroundColor: '#FFF1F0', borderWidth: 1, borderColor: '#EBC3C0', borderRadius: 11, padding: 9, marginTop: 10 }, link: { color: '#176F79', textAlign: 'right', lineHeight: 19, fontWeight: '800', textDecorationLine: 'underline', fontSize: 12, marginTop: 7 }, source: { borderTopWidth: 1, borderTopColor: '#E3ECEE', marginTop: 12, paddingTop: 8 },
  avoid: { color: '#687A80', backgroundColor: '#F4F7F8', borderRadius: 12, padding: 11, textAlign: 'right', lineHeight: 20, fontSize: 12, marginTop: 10 }
});
