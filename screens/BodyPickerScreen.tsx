import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Modal,
} from 'react-native';
import { RealisticMuscleViews } from '../components/RealisticMuscleViews';
import { cleanData } from '../data/cleanData';
import { translate } from '../services/i18n';

interface BodyPickerScreenProps {
  onNavigateToDetails: (muscleData: any) => void;
  onBack?: () => void;
  language: 'ar' | 'en' | 'fr';
  direction?: 'rtl' | 'ltr';
}

const areaToGroups: Record<string, string[]> = {
  head: ['neck'],
  neck: ['neck', 'trapezius'],
  chest: ['chest'],
  abs: ['abs', 'obliques'],
  'upper-limb': ['deltoids', 'biceps', 'triceps', 'forearm', 'hands'],
  'lower-limb': ['quadriceps', 'hamstring', 'adductors', 'knees', 'tibialis', 'calves', 'gluteal'],
  'upper-back': ['trapezius', 'upper-back'],
  'lower-back': ['lower-back'],
};

const simpleGroupNames: Record<string, string> = {
  abs: 'عضلات البطن',
  adductors: 'عضلات داخل الفخذ',
  biceps: 'عضلة مقدمة الذراع',
  calves: 'عضلات الساق الخلفية',
  chest: 'عضلات الصدر',
  deltoids: 'عضلات الكتف',
  forearm: 'عضلات الساعد',
  gluteal: 'عضلات الأرداف',
  hamstring: 'عضلات خلف الفخذ',
  hands: 'عضلات اليد',
  knees: 'منطقة الركبة',
  neck: 'عضلات الرقبة',
  obliques: 'عضلات جانب البطن',
  quadriceps: 'عضلات مقدمة الفخذ',
  tibialis: 'عضلات مقدمة الساق',
  trapezius: 'عضلات أعلى الظهر',
  'upper-back': 'عضلات أعلى الظهر',
  'lower-back': 'عضلات أسفل الظهر',
};

const simpleDescriptions: Record<string, string> = {
  abs: 'العضلات التي تساعد على ثني الجذع وتثبيت البطن.',
  biceps: 'العضلة التي تظهر عند ثني الذراع ورفع الساعد.',
  chest: 'العضلات التي تساعد على دفع الذراعين إلى الأمام.',
  deltoids: 'العضلات المستديرة التي تغطي مفصل الكتف.',
  forearm: 'عضلات تساعد على تحريك الرسغ والأصابع.',
  hamstring: 'العضلات الموجودة خلف الفخذ وتساعد على ثني الركبة.',
  quadriceps: 'العضلات الموجودة أمام الفخذ وتساعد على مد الركبة.',
  calves: 'العضلات التي تظهر خلف الساق وتساعد على الوقوف والمشي.',
  gluteal: 'عضلات الأرداف التي تساعد على مد الورك والحركة.',
  neck: 'عضلات تساعد على تحريك الرأس وتثبيت الرقبة.',
  trapezius: 'عضلات أعلى الظهر التي تساعد على تحريك الكتفين.',
  'upper-back': 'عضلات أعلى الظهر التي تساعد على تثبيت لوح الكتف.',
  'lower-back': 'عضلات أسفل الظهر التي تساعد على تثبيت الجذع.',
};

function simpleName(muscle: any): string {
  return simpleGroupNames[muscle.group] ?? muscle.groupLabelAr ?? muscle.labelAr;
}

function simpleDescription(muscle: any): string {
  return simpleDescriptions[muscle.group] ?? 'عضلات تساعد على الحركة والثبات في هذه المنطقة.';
}

export const BodyPickerScreen: React.FC<BodyPickerScreenProps> = ({
  onNavigateToDetails,
  onBack,
  language,
}) => {
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [selectedAreaLabel, setSelectedAreaLabel] = useState<string | null>(null);
  const [showMuscleList, setShowMuscleList] = useState(false);

  const musclesInArea = useMemo(() => {
    if (!selectedArea) return [];
    const groupNames = areaToGroups[selectedArea] ?? [];
    if (!groupNames.length) return [];
    
    const muscles = cleanData.muscles || {};
    return Object.values(muscles).filter(
      (muscle: any) => muscle && groupNames.includes(muscle.group)
    );
  }, [selectedArea]);

  const selectedMuscle = musclesInArea[0] as any;

  const handleAreaSelect = (groupKey: string, areaLabel: string) => {
    setSelectedArea(groupKey);
    setSelectedAreaLabel(areaLabel);
    setShowMuscleList(false);
  };

  const handleMuscleSelect = (muscle: any) => {
    setShowMuscleList(false);
    onNavigateToDetails(muscle);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backText}>{t('back')}</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.title}>{t('bodyPicker.title')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.instruction}>
          {t('bodyPicker.instruction')}
        </Text>

        <View style={styles.visualContainer}>
          <RealisticMuscleViews
            onRegionSelect={handleAreaSelect}
          />
        </View>

        <View style={styles.improvementSummary}>
          <Text style={styles.improvementTitle}>ملخص المعلومات على صورة العضلات</Text>
          <Text style={styles.improvementItem}>• اسم مبسط بدل الاسم الطبي المعقد</Text>
          <Text style={styles.improvementItem}>• وصف توضيحي لوظيفة العضلة</Text>
          <Text style={styles.improvementItem}>• رقم الجزء مثل #176 للرجوع السريع</Text>
          <Text style={styles.improvementItem}>• الموقع التفصيلي مثل: الأيسر — الأمامي</Text>
        </View>

        {selectedArea && (
          <View style={styles.detailsCard}>
            <Text style={styles.selectedTitle}>{t('bodyPicker.selectedArea')}{selectedAreaLabel}</Text>
            {selectedMuscle ? (
              <View style={styles.instantInfoCard}>
                <View style={styles.instantTitleRow}>
                  <Text style={styles.instantPartNumber}>#{selectedMuscle.partNumber}</Text>
                  <Text style={styles.instantTitle}>{simpleName(selectedMuscle)}</Text>
                </View>
                <Text style={styles.instantExactName}>{selectedMuscle.labelAr}</Text>
                <Text style={styles.instantLabel}>ما هذه العضلة؟</Text>
                <Text style={styles.instantText}>{simpleDescription(selectedMuscle)}</Text>
                <Text style={styles.instantLabel}>لماذا قد تؤلم؟</Text>
                <Text style={styles.instantText}>{selectedMuscle.warning ?? selectedMuscle.commonCauses?.[0] ?? 'إجهاد أو حركة متكررة في المنطقة.'}</Text>
                <Text style={styles.instantLabel}>الأسباب المحتملة</Text>
                {(selectedMuscle.commonCauses ?? []).slice(0, 3).map((cause: string) => (
                  <Text key={cause} style={styles.instantText}>• {cause}</Text>
                ))}
                <Text style={styles.instantLabel}>ما الحل العام؟</Text>
                <Text style={styles.instantText}>{selectedMuscle.recommendation ?? 'خفف النشاط المسبب وراقب الأعراض. استشر طبيبًا إذا استمر الألم أو ازداد.'}</Text>
                <Text style={styles.instantLocation}>الموقع: {selectedMuscle.locationAr}</Text>
              </View>
            ) : null}
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setShowMuscleList(true)}
            >
              <Text style={styles.actionButtonText}>
                {t('bodyPicker.showParts')} ({musclesInArea.length} {t('welcome.statParts')})
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <Modal
        visible={showMuscleList}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowMuscleList(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('bodyPicker.selectPartTitle')}: {selectedAreaLabel}</Text>
              <TouchableOpacity onPress={() => setShowMuscleList(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.muscleList}>
              {musclesInArea.length > 0 ? (
                musclesInArea.map((muscle: any) => (
                  <TouchableOpacity
                    key={muscle.id}
                    style={styles.muscleItem}
                    onPress={() => handleMuscleSelect(muscle)}
                    accessibilityLabel={`${simpleName(muscle)}، الجزء رقم ${muscle.partNumber}`}
                  >
                    <View style={styles.muscleTitleRow}>
                      <Text style={styles.partNumber}>#{muscle.partNumber}</Text>
                      <Text style={styles.muscleName}>{simpleName(muscle)}</Text>
                    </View>
                    <Text style={styles.muscleExactName}>{muscle.labelAr}</Text>
                    <Text style={styles.muscleDescription}>{simpleDescription(muscle)}</Text>
                    <Text style={styles.muscleLocation}>الموقع: {muscle.locationAr}</Text>
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={styles.noDataText}>{t('bodyPicker.noData')}</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#EEEEEE' },
  title: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  backButton: { padding: 8 },
  backText: { color: '#007AFF', fontSize: 16 },
  content: { padding: 16 },
  instruction: { fontSize: 14, color: '#4B5563', marginBottom: 16, textAlign: 'right', lineHeight: 20 },
  visualContainer: { marginBottom: 20, borderRadius: 12, overflow: 'hidden', backgroundColor: '#F9FAFB' },
  improvementSummary: { backgroundColor: '#EAF8F5', borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#B9E4DE' },
  improvementTitle: { color: '#0E6972', fontSize: 16, fontWeight: '900', textAlign: 'right', marginBottom: 7 },
  improvementItem: { color: '#315B63', fontSize: 13, lineHeight: 23, textAlign: 'right' },
  detailsCard: { backgroundColor: '#F3F4F6', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  selectedTitle: { fontSize: 16, fontWeight: 'bold', color: '#1F2937', marginBottom: 12, textAlign: 'right' },
  instantInfoCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 13, marginBottom: 12, borderWidth: 1, borderColor: '#B9E4DE' },
  instantTitleRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  instantTitle: { flex: 1, fontSize: 18, fontWeight: '900', color: '#173D48', textAlign: 'right' },
  instantPartNumber: { color: '#FFFFFF', backgroundColor: '#0E6972', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, fontSize: 14, fontWeight: '900' },
  instantExactName: { color: '#60757D', fontSize: 12, textAlign: 'right', marginTop: 4 },
  instantLabel: { color: '#0E6972', fontSize: 13, fontWeight: '900', textAlign: 'right', marginTop: 9 },
  instantText: { color: '#315B63', fontSize: 13, lineHeight: 20, textAlign: 'right', marginTop: 2 },
  instantLocation: { color: '#60757D', fontSize: 13, textAlign: 'right', marginTop: 10 },
  actionButton: { backgroundColor: '#2563EB', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  actionButtonText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%', paddingBottom: 20 },
  modalHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E9ECEF' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#212529' },
  closeButton: { fontSize: 24, color: '#6C757D', fontWeight: 'bold' },
  muscleList: { padding: 16 },
  muscleItem: { padding: 13, marginBottom: 10, borderRadius: 12, borderWidth: 1, borderColor: '#DDE8EA', backgroundColor: '#FBFDFD' },
  muscleTitleRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  partNumber: { color: '#0E6972', fontSize: 14, fontWeight: '900', backgroundColor: '#DDF5F1', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  muscleName: { fontSize: 16, fontWeight: '600', color: '#212529', marginBottom: 4, textAlign: 'right' },
  muscleExactName: { fontSize: 12, color: '#60757D', textAlign: 'right', marginTop: 3 },
  muscleDescription: { fontSize: 13, color: '#315B63', textAlign: 'right', lineHeight: 20, marginTop: 7 },
  muscleLocation: { fontSize: 14, color: '#6C757D', textAlign: 'right' },
  noDataText: { fontSize: 16, color: '#6C757D', textAlign: 'center', marginTop: 20 }
});
