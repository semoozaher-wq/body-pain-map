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
  direction: 'rtl' | 'ltr';
}

const areaToGroupMap: Record<string, string> = {
  'الكتف': 'deltoids',
  'الصدر': 'chest',
  'العضد / البايسبس': 'biceps',
  'الساعد': 'forearm',
  'اليد': 'hands',
  'البطن': 'abs',
  'العضلات المائلة': 'obliques',
  'الفخذ الأمامي': 'quadriceps',
  'الركبة': 'knees',
  'السمانة': 'calves',
  'الرقبة والأكتاف': 'trapezius',
  'أعلى الظهر': 'upper-back',
  'أسفل الظهر': 'lower-back',
  'الأرداف': 'gluteal',
  'الفخذ الخلفي': 'hamstring',
  'العضلات المقربة': 'adductors',
};

export const BodyPickerScreen: React.FC<BodyPickerScreenProps> = ({
  onNavigateToDetails,
  onBack,
  language,
}) => {
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [showMuscleList, setShowMuscleList] = useState(false);

  const musclesInArea = useMemo(() => {
    if (!selectedArea) return [];
    const groupName = areaToGroupMap[selectedArea];
    if (!groupName) return [];
    
    const muscles = cleanData.muscles || {};
    return Object.values(muscles).filter(
      (muscle: any) => muscle && muscle.group === groupName
    );
  }, [selectedArea]);

  const handleAreaSelect = (areaName: string) => {
    setSelectedArea(areaName);
    setShowMuscleList(true);
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
            onSelectArea={handleAreaSelect}
            selectedArea={selectedArea}
          />
        </View>

        {selectedArea && (
          <View style={styles.detailsCard}>
            <Text style={styles.selectedTitle}>{t('bodyPicker.selectedArea')}{selectedArea}</Text>
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
              <Text style={styles.modalTitle}>{t('bodyPicker.selectPartTitle')}: {selectedArea}</Text>
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
                  >
                    <Text style={styles.muscleName}>{muscle.labelAr}</Text>
                    <Text style={styles.muscleLocation}>{muscle.locationAr}</Text>
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
  detailsCard: { backgroundColor: '#F3F4F6', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  selectedTitle: { fontSize: 16, fontWeight: 'bold', color: '#1F2937', marginBottom: 12, textAlign: 'right' },
  actionButton: { backgroundColor: '#2563EB', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  actionButtonText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%', paddingBottom: 20 },
  modalHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E9ECEF' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#212529' },
  closeButton: { fontSize: 24, color: '#6C757D', fontWeight: 'bold' },
  muscleList: { padding: 16 },
  muscleItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F3F5' },
  muscleName: { fontSize: 16, fontWeight: '600', color: '#212529', marginBottom: 4, textAlign: 'right' },
  muscleLocation: { fontSize: 14, color: '#6C757D', textAlign: 'right' },
  noDataText: { fontSize: 16, color: '#6C757D', textAlign: 'center', marginTop: 20 }
});
