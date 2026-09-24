import React, { useMemo, useState } from 'react';
import { Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { RealisticMuscleViews } from '../components/RealisticMuscleViews';
import { InternalOrganCard } from '../components/InternalOrganCard';
import { PainReliefPanel } from '../components/PainReliefPanel';
import { cleanData } from '../data/cleanData';
import internalOrgans from '../data/internalOrgans.json';
import { translate } from '../services/i18n';

type Mode = 'surface' | 'deep';
type Organ = (typeof internalOrgans)[keyof typeof internalOrgans]['organs'][number];

interface BodyPickerScreenProps {
  onNavigateToDetails: (muscleData: any) => void;
  onSaveSelfCare?: (result: { guideKey: string; pointId?: string; before: number; after: number }) => void;
  quickRelief?: boolean;
  onBack?: () => void;
  language: 'ar' | 'en' | 'fr';
  direction?: 'rtl' | 'ltr';
}

const areaToGroups: Record<string, string[]> = {
  head: ['neck'], neck: ['neck', 'trapezius'], chest: ['chest'], abs: ['abs', 'obliques'],
  'upper-limb': ['deltoids', 'biceps', 'triceps', 'forearm', 'hands'],
  'lower-limb': ['quadriceps', 'hamstring', 'adductors', 'knees', 'tibialis', 'calves', 'gluteal'],
  'upper-back': ['trapezius', 'upper-back'], 'lower-back': ['lower-back'],
};

const simpleGroupNames: Record<string, string> = {
  abs: 'عضلات البطن', adductors: 'عضلات داخل الفخذ', biceps: 'عضلة مقدمة الذراع', calves: 'عضلات الساق الخلفية',
  chest: 'عضلات الصدر', deltoids: 'عضلات الكتف', forearm: 'عضلات الساعد', gluteal: 'عضلات الأرداف',
  hamstring: 'عضلات خلف الفخذ', hands: 'عضلات اليد', knees: 'منطقة الركبة', neck: 'عضلات الرقبة',
  obliques: 'عضلات جانب البطن', quadriceps: 'عضلات مقدمة الفخذ', tibialis: 'عضلات مقدمة الساق',
  trapezius: 'عضلات أعلى الظهر', 'upper-back': 'عضلات أعلى الظهر', 'lower-back': 'عضلات أسفل الظهر',
};

const simpleDescriptions: Record<string, string> = {
  abs: 'عضلات تساعد على ثني الجذع وتثبيت البطن.', biceps: 'عضلة تظهر عند ثني الذراع ورفع الساعد.',
  chest: 'عضلات تساعد على دفع الذراعين إلى الأمام.', deltoids: 'عضلات تغطي مفصل الكتف وتساعد على رفع الذراع.',
  forearm: 'عضلات تساعد على تحريك الرسغ والأصابع.', hamstring: 'عضلات خلف الفخذ وتساعد على ثني الركبة.',
  quadriceps: 'عضلات أمام الفخذ وتساعد على مد الركبة.', calves: 'عضلات خلف الساق وتساعد على الوقوف والمشي.',
  gluteal: 'عضلات الأرداف التي تساعد على الحركة ومد الورك.', neck: 'عضلات تحرك الرأس وتثبت الرقبة.',
  trapezius: 'عضلات أعلى الظهر التي تساعد على تحريك الكتفين.', 'upper-back': 'عضلات تثبت لوح الكتف.',
  'lower-back': 'عضلات تثبت الجذع في أسفل الظهر.',
};

function simpleName(muscle: any) { return simpleGroupNames[muscle.group] ?? muscle.groupLabelAr ?? muscle.labelAr; }
function simpleDescription(muscle: any) { return simpleDescriptions[muscle.group] ?? 'عضلات تساعد على الحركة والثبات في هذه المنطقة.'; }

export const BodyPickerScreen: React.FC<BodyPickerScreenProps> = ({ onNavigateToDetails, onSaveSelfCare, onBack, language, quickRelief = false }) => {
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const [mode, setMode] = useState<Mode>('surface');
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [selectedAreaLabel, setSelectedAreaLabel] = useState<string | null>(null);
  const [showMuscleList, setShowMuscleList] = useState(false);
  const [selectedOrgan, setSelectedOrgan] = useState<Organ | null>(null);
  const [mapIntensity, setMapIntensity] = useState(4);

  const musclesInArea = useMemo(() => {
    if (!selectedArea) return [];
    const groups = areaToGroups[selectedArea] ?? [];
    return Object.values(cleanData.muscles || {}).filter((muscle: any) => groups.includes(muscle.group));
  }, [selectedArea]);

  const selectedMuscle = musclesInArea[0] as any;
  const internalRegions = Object.entries(internalOrgans);
  const quickAreas = [
    { key: 'neck', label: 'الرقبة', group: 'neck' },
    { key: 'lower-back', label: 'أسفل الظهر', group: 'lower-back' },
    { key: 'forearm', label: 'الساعد واليد', group: 'forearm' },
  ];

  const handleAreaSelect = (groupKey: string, areaLabel: string) => {
    setMode('surface');
    setSelectedArea(groupKey);
    setSelectedAreaLabel(areaLabel);
    setShowMuscleList(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        {onBack && <TouchableOpacity onPress={onBack} style={styles.backButton}><Text style={styles.backText}>{t('back')}</Text></TouchableOpacity>}
        <Text style={styles.title}>{t('bodyPicker.title')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.introCard}>
          <Text style={styles.introTitle}>حدد مصدر الألم بسهولة</Text>
          <Text style={styles.introText}>اختر ألمًا سطحيًا في العضلات أو ألمًا عميقًا من الأعضاء الداخلية، ثم اضغط على المنطقة المناسبة.</Text>
        </View>

        <View style={styles.modeSwitch}>
          <Pressable style={[styles.modeButton, mode === 'surface' && styles.modeButtonActive]} onPress={() => setMode('surface')}>
            <Text style={[styles.modeTitle, mode === 'surface' && styles.modeTitleActive]}>ألم سطحي</Text>
            <Text style={styles.modeHint}>عضلات ومفاصل</Text>
          </Pressable>
          <Pressable style={[styles.modeButton, mode === 'deep' && styles.modeButtonActive]} onPress={() => setMode('deep')}>
            <Text style={[styles.modeTitle, mode === 'deep' && styles.modeTitleActive]}>ألم عميق</Text>
            <Text style={styles.modeHint}>أعضاء داخلية</Text>
          </Pressable>
        </View>

        {mode === 'surface' ? (
          <>
            {quickRelief && (
              <View style={styles.quickReliefCard}>
                <Text style={styles.quickReliefTitle}>عناية سريعة</Text>
                <Text style={styles.quickReliefText}>اختر منطقة شائعة لفتح خطة التخفيف مباشرة.</Text>
                <View style={styles.quickReliefRow}>{quickAreas.map((area) => <Pressable key={area.key} style={styles.quickReliefButton} onPress={() => handleAreaSelect(area.group, area.label)}><Text style={styles.quickReliefButtonText}>{area.label}</Text></Pressable>)}</View>
              </View>
            )}
            <Text style={styles.sectionTitle}>خريطة العضلات</Text>
            <Text style={styles.sectionHint}>النقاط الصغيرة هي مناطق تفاعلية. اضغط على أي نقطة لعرض المعلومات فورًا.</Text>
            <View style={styles.intensityBar}><Text style={styles.intensityLabel}>شدة الألم للخريطة الحرارية: {mapIntensity}/10</Text><View style={styles.intensityRow}>{Array.from({ length: 11 }, (_, value) => <Pressable key={value} onPress={() => setMapIntensity(value)} style={[styles.intensityDot, { backgroundColor: value <= mapIntensity ? (mapIntensity >= 8 ? '#D64545' : mapIntensity >= 5 ? '#D98B25' : '#3182CE') : '#D8E5E7' }]}><Text style={styles.intensityDotText}>{value}</Text></Pressable>)}</View></View>
            <RealisticMuscleViews
              onRegionSelect={handleAreaSelect}
              hotspotIntensity={mapIntensity}
              onViewChange={() => { setSelectedArea(null); setSelectedAreaLabel(null); setShowMuscleList(false); }}
            />
            <View style={styles.improvementSummary}>
              <Text style={styles.improvementTitle}>ماذا ستجد عند اختيار نقطة؟</Text>
              <Text style={styles.improvementItem}>اسم مبسط ووصف مفهوم للعضلة</Text>
              <Text style={styles.improvementItem}>رقم الجزء والموقع التفصيلي</Text>
              <Text style={styles.improvementItem}>أسباب محتملة وإرشاد عام آمن</Text>
            </View>
            {selectedArea && selectedMuscle && (
              <View style={styles.detailsCard}>
                <Text style={styles.selectedTitle}>المنطقة المحددة: {selectedAreaLabel}</Text>
                <View style={styles.instantInfoCard}>
                  <View style={styles.instantTitleRow}><Text style={styles.instantPartNumber}>#{selectedMuscle.partNumber}</Text><Text style={styles.instantTitle}>{simpleName(selectedMuscle)}</Text></View>
                  <Text style={styles.instantExactName}>{selectedMuscle.labelAr}</Text>
                  <Text style={styles.instantLabel}>ما هذه العضلة؟</Text><Text style={styles.instantText}>{simpleDescription(selectedMuscle)}</Text>
                  <Text style={styles.instantLabel}>أسباب محتملة</Text><Text style={styles.instantText}>{(selectedMuscle.commonCauses ?? []).slice(0, 3).join(' • ')}</Text>
                  <Text style={styles.instantLabel}>الإرشاد العام</Text><Text style={styles.instantText}>{selectedMuscle.recommendation ?? 'خفف النشاط المسبب واستشر طبيبًا إذا استمر الألم أو ازداد.'}</Text>
                  <Text style={styles.instantLocation}>الموقع: {selectedMuscle.locationAr}</Text>
                </View>
                <TouchableOpacity style={styles.primaryButton} onPress={() => setShowMuscleList(true)}><Text style={styles.primaryButtonText}>عرض باقي الأجزاء ({musclesInArea.length})</Text></TouchableOpacity>
                <PainReliefPanel guideKey={selectedMuscle.group} onSaveResult={onSaveSelfCare} />
              </View>
            )}
          </>
        ) : (
          <>
            <Text style={styles.sectionTitle}>خريطة الأعضاء الداخلية</Text>
            <Text style={styles.sectionHint}>كل اسم عضو يمثل نقطة تشريحية يمكن اختيارها. اضغط على العضو لعرض موقعه ووظيفته والأعراض والعلامات التحذيرية.</Text>
            {internalRegions.map(([key, region]) => (
              <View key={key} style={styles.regionCard}>
                <View style={styles.regionHeader}><Text style={styles.regionCount}>{region.organs.length} أعضاء</Text><Text style={styles.regionTitle}>{region.labelAr}</Text></View>
                <View style={styles.organGrid}>{region.organs.map((organ, organIndex) => <Pressable key={organ.id} style={styles.organChip} onPress={() => setSelectedOrgan(organ)}><Text style={styles.organNumber}>#{organIndex + 1}</Text><Text style={styles.organChipText}>{organ.nameAr}</Text><Text style={styles.organLocation}>{organ.location}</Text></Pressable>)}</View>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      <Modal visible={showMuscleList} animationType="slide" transparent onRequestClose={() => setShowMuscleList(false)}>
        <View style={styles.modalOverlay}><View style={styles.modalContent}>
          <View style={styles.modalHeader}><Text style={styles.modalTitle}>الأجزاء في: {selectedAreaLabel}</Text><TouchableOpacity onPress={() => setShowMuscleList(false)}><Text style={styles.closeButton}>×</Text></TouchableOpacity></View>
          <ScrollView style={styles.muscleList}>{musclesInArea.map((muscle: any) => <TouchableOpacity key={muscle.id} style={styles.muscleItem} onPress={() => { setShowMuscleList(false); onNavigateToDetails(muscle); }}><View style={styles.muscleTitleRow}><Text style={styles.partNumber}>#{muscle.partNumber}</Text><Text style={styles.muscleName}>{simpleName(muscle)}</Text></View><Text style={styles.muscleDescription}>{simpleDescription(muscle)}</Text><Text style={styles.muscleLocation}>الموقع: {muscle.locationAr}</Text></TouchableOpacity>)}</ScrollView>
        </View></View>
      </Modal>

      <Modal visible={Boolean(selectedOrgan)} animationType="slide" transparent onRequestClose={() => setSelectedOrgan(null)}>
        <View style={styles.modalOverlay}><View style={styles.modalContent}><View style={styles.modalHeader}><Text style={styles.modalTitle}>تفاصيل إرشادية</Text><TouchableOpacity onPress={() => setSelectedOrgan(null)}><Text style={styles.closeButton}>×</Text></TouchableOpacity></View>{selectedOrgan && <ScrollView style={styles.organDetail}><InternalOrganCard organ={selectedOrgan} /></ScrollView>}</View></View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F7FBFB' },
  header: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 14, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5EFF0' },
  title: { fontSize: 19, fontWeight: '900', color: '#173D48' }, backButton: { padding: 8 }, backText: { color: '#0E6972', fontSize: 15, fontWeight: '800' },
  content: { padding: 16, paddingBottom: 42 }, introCard: { backgroundColor: '#0E6972', borderRadius: 20, padding: 18, marginBottom: 14 }, introTitle: { color: '#FFFFFF', fontSize: 21, fontWeight: '900', textAlign: 'right' }, introText: { color: '#D7F0ED', lineHeight: 23, textAlign: 'right', marginTop: 7 },
  modeSwitch: { flexDirection: 'row-reverse', gap: 10, marginBottom: 20 }, modeButton: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 15, borderWidth: 1, borderColor: '#D7E6E8', padding: 13, alignItems: 'center' }, modeButtonActive: { backgroundColor: '#DDF5F1', borderColor: '#0E7C86' }, modeTitle: { color: '#315B63', fontSize: 16, fontWeight: '900' }, modeTitleActive: { color: '#0E6972' }, modeHint: { color: '#71858D', fontSize: 11, marginTop: 3 },
  sectionTitle: { color: '#173D48', fontSize: 20, fontWeight: '900', textAlign: 'right' }, sectionHint: { color: '#60757D', textAlign: 'right', lineHeight: 21, marginTop: 4, marginBottom: 12 }, visualContainer: { marginBottom: 12 }, improvementSummary: { backgroundColor: '#EAF8F5', borderRadius: 16, padding: 15, marginBottom: 15, borderWidth: 1, borderColor: '#B9E4DE' }, improvementTitle: { color: '#0E6972', fontSize: 16, fontWeight: '900', textAlign: 'right', marginBottom: 6 }, improvementItem: { color: '#315B63', textAlign: 'right', lineHeight: 23 },
  quickReliefCard: { backgroundColor: '#173D48', borderRadius: 17, padding: 15, marginBottom: 16 }, quickReliefTitle: { color: '#FFFFFF', fontSize: 19, fontWeight: '900', textAlign: 'right' }, quickReliefText: { color: '#D7F0ED', textAlign: 'right', lineHeight: 20, marginTop: 4 }, quickReliefRow: { flexDirection: 'row-reverse', gap: 8, marginTop: 11 }, quickReliefButton: { flex: 1, backgroundColor: '#0E7C86', borderRadius: 10, paddingVertical: 10, alignItems: 'center' }, quickReliefButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900', textAlign: 'center' }, intensityBar: { backgroundColor: '#FFFFFF', borderRadius: 13, borderWidth: 1, borderColor: '#D9E7EA', padding: 11, marginBottom: 12 }, intensityLabel: { color: '#315B63', fontSize: 12, fontWeight: '900', textAlign: 'right' }, intensityRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 8 }, intensityDot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, intensityDotText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  detailsCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 15, borderWidth: 1, borderColor: '#D9E7EA', marginBottom: 14 }, selectedTitle: { color: '#173D48', fontSize: 16, fontWeight: '900', textAlign: 'right', marginBottom: 10 }, instantInfoCard: { backgroundColor: '#F8FCFC', borderRadius: 14, padding: 13 }, instantTitleRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' }, instantTitle: { flex: 1, color: '#173D48', fontSize: 18, fontWeight: '900', textAlign: 'right' }, instantPartNumber: { color: '#FFFFFF', backgroundColor: '#0E6972', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, fontWeight: '900' }, instantExactName: { color: '#60757D', textAlign: 'right', marginTop: 4 }, instantLabel: { color: '#0E6972', fontWeight: '900', textAlign: 'right', marginTop: 9 }, instantText: { color: '#315B63', textAlign: 'right', lineHeight: 21, marginTop: 2 }, instantLocation: { color: '#60757D', textAlign: 'right', marginTop: 9 }, primaryButton: { backgroundColor: '#0E6972', borderRadius: 12, padding: 13, alignItems: 'center', marginTop: 12 }, primaryButtonText: { color: '#FFFFFF', fontWeight: '900' },
  regionCard: { backgroundColor: '#FFFFFF', borderRadius: 17, padding: 15, borderWidth: 1, borderColor: '#D9E7EA', marginBottom: 12 }, regionHeader: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }, regionTitle: { color: '#173D48', fontSize: 18, fontWeight: '900', textAlign: 'right' }, regionCount: { color: '#0E6972', backgroundColor: '#EAF8F5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, fontSize: 12, fontWeight: '800' }, organGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 }, organChip: { minWidth: '46%', borderRadius: 10, backgroundColor: '#F2F8F8', borderWidth: 1, borderColor: '#CFE1E3', paddingHorizontal: 10, paddingVertical: 9 }, organNumber: { color: '#0E6972', fontSize: 11, fontWeight: '900', textAlign: 'right' }, organChipText: { color: '#315B63', fontWeight: '800', textAlign: 'right' }, organLocation: { color: '#71858D', fontSize: 10, lineHeight: 15, textAlign: 'right', marginTop: 3 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(10,35,42,0.48)', justifyContent: 'flex-end' }, modalContent: { backgroundColor: '#F7FBFB', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '88%', paddingBottom: 22 }, modalHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 17, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2EFF0' }, modalTitle: { color: '#173D48', fontSize: 18, fontWeight: '900', textAlign: 'right' }, closeButton: { color: '#0E6972', fontSize: 30, lineHeight: 30 }, muscleList: { padding: 15 }, organDetail: { padding: 15 }, muscleItem: { backgroundColor: '#FFFFFF', borderRadius: 13, padding: 13, marginBottom: 9, borderWidth: 1, borderColor: '#D9E7EA' }, muscleTitleRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }, partNumber: { color: '#FFFFFF', backgroundColor: '#0E6972', borderRadius: 7, paddingHorizontal: 7, paddingVertical: 3, fontWeight: '900' }, muscleName: { color: '#173D48', fontSize: 16, fontWeight: '900', textAlign: 'right' }, muscleDescription: { color: '#315B63', textAlign: 'right', lineHeight: 20, marginTop: 7 }, muscleLocation: { color: '#60757D', textAlign: 'right', marginTop: 6, fontSize: 12 },
});
