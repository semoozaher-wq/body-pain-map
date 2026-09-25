import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Line, Path, Rect } from 'react-native-svg';
import type { Language } from '../services/i18n';

type OrganId = 'heart' | 'lungs' | 'stomach' | 'liver' | 'kidneys' | 'thyroid';
type Spot = { id: string; label: string; organId?: string; x: number; y: number; view: 'front' | 'back'; type: 'muscle' | 'organ' };
type Props = { view: 'organs'; surface: 'front' | 'back'; spots: Spot[]; language: Language; onSelect: (spot: Spot) => void };
const names: Record<Language, Record<OrganId, string>> = {
  ar: { heart: 'القلب', lungs: 'الرئتان', stomach: 'المعدة', liver: 'الكبد', kidneys: 'الكليتان', thyroid: 'الدرقية' },
  en: { heart: 'Heart', lungs: 'Lungs', stomach: 'Stomach', liver: 'Liver', kidneys: 'Kidneys', thyroid: 'Thyroid' },
  fr: { heart: 'Cœur', lungs: 'Poumons', stomach: 'Estomac', liver: 'Foie', kidneys: 'Reins', thyroid: 'Thyroïde' },
};
const colors: Record<OrganId, string> = { heart: '#D96568', lungs: '#7ABFC2', stomach: '#E9B35C', liver: '#B67B59', kidneys: '#AA7BB8', thyroid: '#D889A4' };

export function InternalOrgansMap({ surface, spots, language, onSelect }: Props) {
  const valid = spots.filter((spot) => spot.organId && spot.type === 'organ');
  const current = (id: string) => valid.find((spot) => spot.organId === id);
  const region = (id: OrganId, children: React.ReactNode) => {
    const spot = current(id);
    if (!spot) return null;
    return <G key={id} onPress={() => onSelect(spot)} accessibilityLabel={names[language][id]}>
      {children}
      <Circle cx={spot.x * 2.2} cy={spot.y * 3.4} r="17" fill="#FFFFFF" fillOpacity="0.01" stroke="#0E6972" strokeWidth="1.4" strokeDasharray="3 3" />
      <Circle cx={spot.x * 2.2} cy={spot.y * 3.4} r="4" fill="#D54E4E" stroke="#FFFFFF" strokeWidth="2" />
    </G>;
  };
  return <View style={styles.wrap}>
    <Svg viewBox="0 0 220 340" width="100%" height={370}>
      <Rect x="0" y="0" width="220" height="340" rx="22" fill="#F1F8F8" />
      <Circle cx="110" cy="31" r="21" fill="#D9E8E7" stroke="#73999A" strokeWidth="2" />
      <Path d="M99 53 L96 68 C81 72 67 80 61 96 L50 147 L64 151 L79 115 L83 170 L72 229 L94 231 L110 177 L126 231 L148 229 L137 170 L141 115 L156 151 L170 147 L159 96 C153 80 139 72 124 68 L121 53 Z" fill="#D9E8E7" stroke="#73999A" strokeWidth="2" />
      <Path d="M94 231 L88 318 M126 231 L132 318 M61 96 L30 177 M159 96 L190 177" fill="none" stroke="#73999A" strokeWidth="12" strokeLinecap="round" />
      <Line x1="110" y1="70" x2="110" y2="171" stroke="#AFC9C8" strokeWidth="1.5" strokeDasharray="4 4" />
      {surface === 'front' ? <>
        {region('thyroid', <Path d="M102 73 C95 67 91 77 99 82 C103 86 107 81 110 79 C113 81 117 86 121 82 C129 77 125 67 118 73 L110 78 Z" fill={colors.thyroid} stroke="#875765" strokeWidth="1.5" />)}
        {region('lungs', <><Path d="M102 91 C91 87 82 98 82 119 C82 137 91 144 103 132 Z" fill={colors.lungs} stroke="#397F85" strokeWidth="1.6"/><Path d="M118 91 C129 87 138 98 138 119 C138 137 129 144 117 132 Z" fill={colors.lungs} stroke="#397F85" strokeWidth="1.6"/><Line x1="110" y1="85" x2="110" y2="132" stroke="#397F85" strokeWidth="3"/></>)}
        {region('heart', <Path d="M110 112 C104 103 93 108 96 118 C98 126 110 134 110 134 C110 134 122 126 124 118 C127 108 116 103 110 112 Z" fill={colors.heart} stroke="#9B4248" strokeWidth="1.6"/>)}
        {region('liver', <Path d="M82 143 C94 136 111 139 123 144 C119 158 98 164 81 158 C76 155 77 148 82 143 Z" fill={colors.liver} stroke="#77513D" strokeWidth="1.5"/>)}
        {region('stomach', <Path d="M123 145 C129 139 137 144 134 151 C130 158 138 164 130 171 C123 177 113 170 115 160 C116 154 120 151 123 145 Z" fill={colors.stomach} stroke="#9E7539" strokeWidth="1.5"/>)}
      </> : <>
        {region('kidneys', <><Path d="M87 143 C72 138 69 151 74 162 C79 173 92 171 96 159 C98 152 94 146 87 143 Z" fill={colors.kidneys} stroke="#6C4D79" strokeWidth="1.5"/><Path d="M133 143 C148 138 151 151 146 162 C141 173 128 171 124 159 C122 152 126 146 133 143 Z" fill={colors.kidneys} stroke="#6C4D79" strokeWidth="1.5"/></>)}
      </>}
    </Svg>
    <View style={styles.legend}><Text style={styles.legendTitle}>{language === 'ar' ? 'اضغط على نقطة العضو' : language === 'fr' ? 'Touchez un point d’organe' : 'Tap an organ marker'}</Text><Text style={styles.legendText}>{language === 'ar' ? 'رسم مبسط تعليمي، لا يوضح العمق أو اختلافات الأجسام.' : language === 'fr' ? 'Schéma éducatif simplifié, sans profondeur ni variations anatomiques.' : 'Simplified educational diagram; depth and anatomical variation are not shown.'}</Text></View>
    <View style={styles.chips}>{valid.map((spot) => <Text key={spot.id} onPress={() => onSelect(spot)} style={styles.chip}>● {names[language][spot.organId as OrganId] ?? spot.label}</Text>)}</View>
  </View>;
}

const styles = StyleSheet.create({ wrap: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 8, borderWidth: 1, borderColor: '#D7E5E7' }, legend: { backgroundColor: '#EAF8F5', borderRadius: 10, padding: 9, marginHorizontal: 7 }, legendTitle: { color: '#0E6972', textAlign: 'center', fontWeight: '900' }, legendText: { color: '#49636A', textAlign: 'center', fontSize: 11, lineHeight: 17, marginTop: 4 }, chips: { flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'center', gap: 6, margin: 8 }, chip: { color: '#315B63', backgroundColor: '#F2F8F8', borderRadius: 10, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 6, fontSize: 11, fontWeight: '700' } });
