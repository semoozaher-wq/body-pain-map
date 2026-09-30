import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Ellipse, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import pointData from '../data/acupressurePoints.json';
import atlasData from '../data/acupunctureAtlas.json';
import type { Language } from '../services/i18n';

type Point = (typeof pointData.points)[number];
type Meridian = (typeof atlasData.meridians)[number];
type Props = {
  language: Language;
  /** نقطة مطلوب إبرازها/فتحها بأمر من المساعد المركزي (معرّف النقطة أو كودها مثل LI4). */
  highlightId?: string | null;
};
const text = (value: { ar: string; en: string; fr: string }, language: Language) => value[language] ?? value.ar;
const tr = (language: Language, ar: string, en: string, fr: string) => (language === 'ar' ? ar : language === 'fr' ? fr : en);

// ---------------------------------------------------------------------------
// أطلس النقاط الكامل (361 نقطة / 14 خط) — WHO nomenclature
// بيانات الاسم/الكود/النطق مأخوذة حرفيًا من مصدر موثّق؛ لا اختراع.
// ---------------------------------------------------------------------------
type AtlasPoint = Meridian['points'][number] & { meridian: string; meridianEnglish: string };
const ATLAS_INDEX: AtlasPoint[] = atlasData.meridians.flatMap((meridian) =>
  meridian.points.map((point) => ({ ...point, meridian: meridian.code, meridianEnglish: meridian.english })),
);
const DETAIL_BY_CODE = new Map(pointData.points.map((point) => [point.code.toUpperCase(), point]));
const normalizeCode = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '');

export function AcupressurePanel({ language, highlightId }: Props) {
  const [selectedId, setSelectedId] = useState(pointData.points[0].id);
  const point = pointData.points.find((candidate) => candidate.id === selectedId) ?? pointData.points[0];
  const [atlasMeridian, setAtlasMeridian] = useState<string>('ALL');
  const [query, setQuery] = useState('');
  const [atlasCode, setAtlasCode] = useState<string | null>(null);
  // فتح/إبراز النقطة المطلوبة من المساعد المركزي (بالكود أو المعرّف) في القسمين.
  useEffect(() => {
    if (!highlightId) return;
    const match = pointData.points.find((candidate) => candidate.id === highlightId || candidate.code.toUpperCase() === highlightId.toUpperCase());
    if (match) setSelectedId(match.id);
    const atlasMatch = ATLAS_INDEX.find((candidate) => candidate.code.toUpperCase() === normalizeCode(highlightId));
    if (atlasMatch) {
      setAtlasCode(atlasMatch.code);
      setAtlasMeridian('ALL');
      setQuery('');
    }
  }, [highlightId]);

  const ar = language === 'ar';
  const trimmedQuery = query.trim();
  const needle = trimmedQuery.toLowerCase();
  const filtered = ATLAS_INDEX.filter((candidate) => {
    if (atlasMeridian !== 'ALL' && candidate.meridian !== atlasMeridian) return false;
    if (!needle) return true;
    return (
      candidate.code.toLowerCase().includes(needle) ||
      candidate.transliteration.toLowerCase().includes(needle) ||
      candidate.english.toLowerCase().includes(needle) ||
      candidate.pinyin.toLowerCase().includes(needle) ||
      candidate.chinese.includes(trimmedQuery)
    );
  });
  const atlasPoint = atlasCode ? ATLAS_INDEX.find((candidate) => candidate.code === atlasCode) ?? null : null;
  const atlasDetail = atlasPoint ? DETAIL_BY_CODE.get(atlasPoint.code.toUpperCase()) ?? null : null;

  return (
    <View style={styles.container}>
      <View style={styles.notice}><Text style={styles.noticeTitle}>{ar ? 'ضغط خارجي فقط — بدون إبر' : language === 'fr' ? 'Pression externe uniquement — sans aiguilles' : 'External pressure only — no needles'}</Text><Text style={styles.noticeText}>{text(pointData.notice, language)}</Text></View>
      <View style={styles.warning}><Text style={styles.warningTitle}>{ar ? 'احتياطات قبل التجربة' : language === 'fr' ? 'Précautions avant utilisation' : 'Safety before trying'}</Text><Text style={styles.warningText}>{text(pointData.safety, language)}</Text></View>
      <Text style={styles.sectionTitle}>{ar ? 'نقاط تعليمية موثقة' : language === 'fr' ? 'Points éducatifs documentés' : 'Documented educational points'}</Text>
      <Text style={styles.sectionHint}>{ar ? 'هذه عينة أساسية موثّقة بالتفصيل (مكان/استخدام/احتياطات) وليست كل نقاط الجسم.' : language === 'fr' ? 'Sélection de base documentée en détail (emplacement/usage/précautions), pas tous les points.' : 'A core selection documented in detail (location/use/cautions), not every body point.'}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {pointData.points.map((item) => <Pressable key={item.id} onPress={() => setSelectedId(item.id)} style={[styles.tab, item.id === point.id && styles.tabActive]}><Text style={[styles.tabText, item.id === point.id && styles.tabTextActive]}>{item.code}</Text><Text style={[styles.tabSub, item.id === point.id && styles.tabTextActive]}>{text(item.name, language)}</Text></Pressable>)}
      </ScrollView>
      <View style={styles.card}>
        <Text style={styles.title}>{text(point.name, language)} <Text style={styles.code}>· {point.code}</Text></Text>
        <PointDiagram point={point} language={language} />
        <Info label={ar ? 'المكان على الجسم' : language === 'fr' ? 'Emplacement' : 'Location'} value={text(point.location, language)} />
        <Info label={ar ? 'الاستخدام المذكور' : language === 'fr' ? 'Usage décrit' : 'Described use'} value={text(point.use, language)} />
        <Info label={ar ? 'طريقة آمنة عامة' : language === 'fr' ? 'Méthode générale sûre' : 'General safe method'} value={text(point.technique, language)} />
        <Info label={ar ? 'مستوى الدليل' : language === 'fr' ? 'Niveau de preuve' : 'Evidence level'} value={text(point.evidence, language)} />
        <View style={styles.warning}><Info label={ar ? 'موانع وتنبيهات' : language === 'fr' ? 'Précautions' : 'Cautions'} value={text(point.caution, language)} /></View>
        <Text style={styles.sourcesTitle}>{ar ? 'المراجع' : language === 'fr' ? 'Sources' : 'Sources'}</Text>
        {point.sources.map((source) => <Pressable key={source.url} onPress={() => Linking.openURL(source.url)} style={styles.sourceLink}><Text style={styles.sourceText}>↗ {source.title}</Text></Pressable>)}
      </View>

      {/* ===================== أطلس النقاط الكامل ===================== */}
      <Text style={styles.sectionTitle}>{ar ? 'أطلس النقاط الكامل' : language === 'fr' ? 'Atlas complet des points' : 'Complete point atlas'}</Text>
      <Text style={styles.sectionHint}>
        {ar
          ? `مرجع تسمية موثّق وفق منظمة الصحة العالمية: ${ATLAS_INDEX.length} نقطة كلاسيكية على ${atlasData.meridians.length} خطًا. الأسماء والأكواد منقولة حرفيًا من المصدر (بلا اختراع)؛ التفاصيل العلاجية (المكان/الطريقة/الاحتياطات) موثّقة فقط للنقاط التعليمية أعلاه.`
          : language === 'fr'
            ? `Référentiel de nomenclature documenté (OMS) : ${ATLAS_INDEX.length} points classiques sur ${atlasData.meridians.length} méridiens. Noms et codes repris tels quels de la source (aucune invention) ; les détails thérapeutiques ne sont documentés que pour les points ci-dessus.`
            : `Documented WHO nomenclature reference: ${ATLAS_INDEX.length} classical points across ${atlasData.meridians.length} meridians. Names and codes are taken verbatim from the source (nothing invented); therapeutic detail is documented only for the points above.`}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Pressable onPress={() => setAtlasMeridian('ALL')} style={[styles.chip, atlasMeridian === 'ALL' && styles.chipActive]}><Text style={[styles.chipText, atlasMeridian === 'ALL' && styles.chipTextActive]}>{ar ? 'الكل' : language === 'fr' ? 'Tous' : 'All'}</Text></Pressable>
        {atlasData.meridians.map((meridian: Meridian) => <Pressable key={meridian.code} onPress={() => setAtlasMeridian(meridian.code)} style={[styles.chip, atlasMeridian === meridian.code && styles.chipActive]}><Text style={[styles.chipText, atlasMeridian === meridian.code && styles.chipTextActive]}>{meridian.code} · {meridian.pointCount}</Text></Pressable>)}
      </ScrollView>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={ar ? 'ابحث بالكود أو الاسم (مثال: LI4 أو Hegu أو 合谷)' : language === 'fr' ? 'Rechercher par code ou nom (ex. LI4, Hegu)' : 'Search by code or name (e.g. LI4, Hegu)'}
        placeholderTextColor="#8AA0A6"
        style={[styles.search, { textAlign: ar ? 'right' : 'left' }]}
        autoCorrect={false}
        autoCapitalize="none"
      />
      <Text style={styles.resultCount}>{ar ? `${filtered.length} نقطة` : language === 'fr' ? `${filtered.length} points` : `${filtered.length} points`}</Text>
      <ScrollView style={styles.atlasList} nestedScrollEnabled contentContainerStyle={styles.atlasListContent}>
        {filtered.map((item) => (
          <Pressable key={item.code} onPress={() => setAtlasCode(item.code)} style={[styles.atlasRow, atlasCode === item.code && styles.atlasRowActive]}>
            <Text style={[styles.atlasCode, atlasCode === item.code && styles.atlasCodeActive]}>{item.code}</Text>
            <View style={styles.atlasNames}>
              <Text style={styles.atlasName}>{item.transliteration} <Text style={styles.atlasChinese}>{item.chinese}</Text></Text>
              <Text style={styles.atlasEnglish}>{item.english} · {item.meridian}</Text>
            </View>
          </Pressable>
        ))}
        {filtered.length === 0 && <Text style={styles.empty}>{ar ? 'لا توجد نقطة مطابقة.' : language === 'fr' ? 'Aucun point correspondant.' : 'No matching point.'}</Text>}
      </ScrollView>
      {atlasPoint && (
        <View style={styles.card}>
          <Text style={styles.title}>{atlasPoint.transliteration} <Text style={styles.code}>· {atlasPoint.code}</Text></Text>
          <Text style={styles.atlasMeta}>{atlasPoint.chinese} · {atlasPoint.pinyin} · {atlasPoint.english}</Text>
          <Text style={styles.atlasMeta}>{tr(language, 'الخط', 'Meridian', 'Méridien')}: {atlasPoint.meridian} — {atlasPoint.meridianEnglish}</Text>
          {atlasDetail ? (
            <>
              <Info label={ar ? 'المكان على الجسم' : language === 'fr' ? 'Emplacement' : 'Location'} value={text(atlasDetail.location, language)} />
              <Info label={ar ? 'الاستخدام المذكور' : language === 'fr' ? 'Usage décrit' : 'Described use'} value={text(atlasDetail.use, language)} />
              <Info label={ar ? 'طريقة آمنة عامة' : language === 'fr' ? 'Méthode générale sûre' : 'General safe method'} value={text(atlasDetail.technique, language)} />
              <View style={styles.warning}><Info label={ar ? 'موانع وتنبيهات' : language === 'fr' ? 'Précautions' : 'Cautions'} value={text(atlasDetail.caution, language)} /></View>
            </>
          ) : (
            <Text style={styles.atlasOnlyNote}>{ar ? 'هذه النقطة مدرجة في مرجع التسمية فقط؛ لا تتوفّر لها تفاصيل مكان/طريقة موثّقة داخل التطبيق، لذلك لا نعرض أي إرشاد ضغط غير موثّق.' : language === 'fr' ? 'Ce point figure uniquement dans le référentiel de nomenclature ; aucun détail d’emplacement/technique documenté n’est disponible, donc aucune consigne non documentée n’est affichée.' : 'This point is listed in the nomenclature reference only; no documented location/technique detail is available, so no undocumented pressure guidance is shown.'}</Text>
          )}
        </View>
      )}
      <Pressable onPress={() => Linking.openURL(atlasData.source.url)} style={styles.sourceLink}><Text style={styles.sourceText}>↗ {atlasData.source.title}</Text></Pressable>
    </View>
  );
}

function Info({ label, value }: { label: string; value: string }) { return <View style={styles.info}><Text style={styles.label}>{label}</Text><Text style={styles.body}>{value}</Text></View>; }

function PointDiagram({ point, language }: { point: Point; language: Language }) {
  const marker = '#DE5B53';
  return <View style={styles.diagramWrap} accessibilityLabel={language === 'ar' ? `رسم توضيحي لموضع ${point.code}` : language === 'fr' ? `Illustration de l’emplacement ${point.code}` : `Illustration location ${point.code}`}>
    <Svg viewBox="0 0 240 150" width="100%" height={150}>
      <Rect x="1" y="1" width="238" height="148" rx="18" fill="#F3FAFA" />
      {point.region === 'hand' && <>
        <Path d="M96 126 C88 114 87 98 86 82 L82 43 C81 35 91 33 94 41 L101 72 L99 22 C99 12 111 12 112 22 L114 68 L118 15 C119 6 131 7 132 16 L133 69 L140 24 C142 15 153 17 153 27 L151 77 L160 47 C163 39 173 43 171 52 L164 94 C161 114 149 127 133 132 Z" fill="#F1CCB1" stroke="#9A6D5A" strokeWidth="2" />
        <Circle cx="101" cy="78" r="11" fill={marker} opacity="0.92" /><SvgText x="123" y="139" textAnchor="middle" fontSize="11" fill="#315B63">{language === 'ar' ? 'ظهر اليد · LI4' : language === 'fr' ? 'Dos de la main · LI4' : 'Back of hand · LI4'}</SvgText>
      </>}
      {point.region === 'inner_wrist' && <>
        <Path d="M80 34 C99 40 139 40 158 34 L171 121 C148 133 91 133 68 121 Z" fill="#F1CCB1" stroke="#9A6D5A" strokeWidth="2" />
        <Line x1="104" y1="43" x2="107" y2="122" stroke="#A77B66" strokeWidth="3" /><Line x1="132" y1="43" x2="129" y2="122" stroke="#A77B66" strokeWidth="3" />
        <Line x1="74" y1="65" x2="164" y2="65" stroke="#A77B66" strokeWidth="2" /><Circle cx="118" cy="79" r="10" fill={marker} /><SvgText x="120" y="141" textAnchor="middle" fontSize="11" fill="#315B63">{language === 'ar' ? 'باطن الرسغ · PC6' : language === 'fr' ? 'Poignet interne · PC6' : 'Inner wrist · PC6'}</SvgText>
      </>}
      {point.region === 'base_of_skull' && <>
        <Path d="M67 132 C72 95 82 59 102 42 C110 35 130 35 138 42 C158 59 168 95 173 132 Z" fill="#F1CCB1" stroke="#9A6D5A" strokeWidth="2" />
        <Ellipse cx="120" cy="48" rx="34" ry="24" fill="#F8E4D8" stroke="#9A6D5A" strokeWidth="2" /><Path d="M94 66 Q120 80 146 66" fill="none" stroke="#9A6D5A" strokeWidth="3" />
        <Circle cx="91" cy="69" r="9" fill={marker} /><Circle cx="149" cy="69" r="9" fill={marker} /><SvgText x="120" y="140" textAnchor="middle" fontSize="11" fill="#315B63">{language === 'ar' ? 'قاعدة الجمجمة · GB20 (لمس خفيف فقط)' : language === 'fr' ? 'Base du crâne · GB20 (contact léger)' : 'Base of skull · GB20 (light touch only)'}</SvgText>
      </>}
      {point.region === 'inner_ankle' && <>
        <Path d="M91 21 L150 21 L145 81 Q142 100 159 119 L150 136 L83 136 L77 123 Q94 103 94 84 Z" fill="#F1CCB1" stroke="#9A6D5A" strokeWidth="2" />
        <Circle cx="84" cy="112" r="8" fill="#F8E4D8" stroke="#9A6D5A" strokeWidth="2" /><Circle cx="98" cy="86" r="10" fill={marker} /><Line x1="84" y1="112" x2="98" y2="86" stroke="#DE5B53" strokeDasharray="3 3" strokeWidth="2" /><SvgText x="120" y="143" textAnchor="middle" fontSize="11" fill="#315B63">{language === 'ar' ? 'باطن الساق · SP6' : language === 'fr' ? 'Face interne de la jambe · SP6' : 'Inner lower leg · SP6'}</SvgText>
      </>}
    </Svg>
    <Text style={styles.diagramCaption}>{point.region === 'base_of_skull' ? (language === 'ar' ? 'رسم تقريبي؛ لا تضغط بعمق على الرقبة.' : language === 'fr' ? 'Schéma approximatif ; ne pas appuyer profondément sur le cou.' : 'Approximate drawing; do not press deeply on the neck.') : (language === 'ar' ? 'رسم توضيحي فقط، غير مقياس؛ اعتمد وصف المكان.' : language === 'fr' ? 'Schéma indicatif, non à l’échelle ; suivre la description.' : 'Illustrative only, not to scale; follow the written location.')}</Text>
  </View>;
}

const styles = StyleSheet.create({
  container: { paddingTop: 4 },
  notice: { backgroundColor: '#EAF8F5', borderWidth: 1, borderColor: '#B9DFD8', borderRadius: 14, padding: 13, marginBottom: 10 },
  noticeTitle: { color: '#0E6972', textAlign: 'right', fontWeight: '900', fontSize: 16 },
  noticeText: { color: '#315B63', textAlign: 'right', lineHeight: 20, marginTop: 5 },
  warning: { backgroundColor: '#FFF4E5', borderWidth: 1, borderColor: '#F0D4A1', borderRadius: 12, padding: 11, marginBottom: 10 },
  warningTitle: { color: '#805400', fontWeight: '900', textAlign: 'right', marginBottom: 4 },
  warningText: { color: '#6E5319', textAlign: 'right', lineHeight: 20, fontSize: 12 },
  sectionTitle: { color: '#173D48', fontWeight: '900', fontSize: 19, textAlign: 'right', marginTop: 8 },
  sectionHint: { color: '#61747B', textAlign: 'right', fontSize: 12, lineHeight: 19, marginTop: 4 },
  tabs: { flexDirection: 'row-reverse', gap: 8, paddingVertical: 10 },
  tab: { minWidth: 91, borderWidth: 1, borderColor: '#CBDDDF', borderRadius: 11, padding: 9, backgroundColor: '#FFF' },
  tabActive: { backgroundColor: '#0E6972', borderColor: '#0E6972' },
  tabText: { color: '#0E6972', fontWeight: '900', textAlign: 'center' },
  tabTextActive: { color: '#FFF' },
  tabSub: { color: '#45646C', textAlign: 'center', fontSize: 10, marginTop: 3 },
  card: { backgroundColor: '#FFF', borderColor: '#D7E5E7', borderWidth: 1, borderRadius: 16, padding: 13, marginBottom: 12 },
  title: { color: '#173D48', fontSize: 19, textAlign: 'right', fontWeight: '900' },
  code: { color: '#0E6972', fontSize: 15 },
  diagramWrap: { marginTop: 10, marginBottom: 5 },
  diagramCaption: { color: '#75878D', textAlign: 'center', fontSize: 10 },
  info: { marginTop: 10 }, label: { color: '#0E6972', textAlign: 'right', fontWeight: '900', fontSize: 12 }, body: { color: '#344F57', textAlign: 'right', lineHeight: 21, fontSize: 13, marginTop: 3 },
  sourcesTitle: { color: '#173D48', fontWeight: '900', textAlign: 'right', marginTop: 13 },
  sourceLink: { borderTopWidth: 1, borderTopColor: '#E3ECEE', paddingVertical: 8 }, sourceText: { color: '#176F79', textAlign: 'right', fontSize: 12, textDecorationLine: 'underline' },
  chips: { flexDirection: 'row-reverse', gap: 7, paddingVertical: 10 },
  chip: { borderWidth: 1, borderColor: '#CBDDDF', borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#FFF' },
  chipActive: { backgroundColor: '#0E6972', borderColor: '#0E6972' },
  chipText: { color: '#0E6972', fontWeight: '800', fontSize: 12 },
  chipTextActive: { color: '#FFF' },
  search: { borderWidth: 1, borderColor: '#CBDDDF', borderRadius: 11, paddingVertical: 9, paddingHorizontal: 12, backgroundColor: '#FFF', color: '#173D48', marginTop: 2 },
  resultCount: { color: '#61747B', textAlign: 'right', fontSize: 12, marginTop: 8, marginBottom: 4 },
  atlasList: { maxHeight: 300, borderWidth: 1, borderColor: '#D7E5E7', borderRadius: 14, backgroundColor: '#FFF' },
  atlasListContent: { paddingVertical: 4 },
  atlasRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#EEF4F5' },
  atlasRowActive: { backgroundColor: '#EAF8F5' },
  atlasCode: { color: '#0E6972', fontWeight: '900', fontSize: 13, minWidth: 46, textAlign: 'center' },
  atlasCodeActive: { color: '#0A4E55' },
  atlasNames: { flex: 1 },
  atlasName: { color: '#173D48', fontWeight: '800', textAlign: 'right', fontSize: 13 },
  atlasChinese: { color: '#8AA0A6', fontWeight: '600' },
  atlasEnglish: { color: '#61747B', textAlign: 'right', fontSize: 11, marginTop: 2 },
  empty: { color: '#8AA0A6', textAlign: 'center', paddingVertical: 16 },
  atlasMeta: { color: '#45646C', textAlign: 'right', fontSize: 12, marginTop: 5 },
  atlasOnlyNote: { color: '#6E5319', textAlign: 'right', lineHeight: 20, fontSize: 12, marginTop: 10, backgroundColor: '#FFF4E5', borderWidth: 1, borderColor: '#F0D4A1', borderRadius: 12, padding: 11 },
});
