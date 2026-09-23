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
import anatomyPainMap from '../data/anatomyPainMap.json';

interface BodyPickerScreenProps {
  onNavigateToDetails: (muscleData: any) => void;
  onBack?: () => void;
}

// ربط المناطق العامة في الصورة الواقعية بمجموعات العضلات الموثقة في البيانات الطبية
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
}) => {
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [showMuscleList, setShowMuscleList] = useState(false);

  // استخراج قائمة العضلات الدقيقة الخاصة بالمنطقة المحددة ديناميكياً
  const musclesInArea = useMemo(() => {
    if (!selectedArea) return [];
    const groupName = areaToGroupMap[selectedArea];
    if (!groupName) return [];
    
    // تصفية العضلات التي تنتمي لهذه المجموعة من أصل 317 جزءاً
    return Object.values(anatomyPainMap.muscles).filter(
      (muscle: any) => muscle.group === groupName
    );
  }, [selectedArea]);

  const handleAreaSelect = (areaName: string) => {
    setSelectedArea(areaName);
    setShowMuscleList(true); // فتح القائمة فوراً لاختيار الجزء الدقيق
  };

  const handleMuscleSelect = (muscle: any) => {
    setShowMuscleList(false);
    onNavigateToDetails(muscle); // الانتقال للبيانات الطبية الموثقة 100%
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backText}>رجوع</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.title}>خريطة العضلات التفاعلية</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.instruction}>
          اضغط على المنطقة المصابة في الصورة الواقعية، ثم اختر الجزء الدقيق من القائمة لضمان دقة طبية 100%:
        </Text>

        <View style={styles.visualContainer}>
          <RealisticMuscleViews
            onSelectArea={handleAreaSelect}
            selectedArea={selectedArea}
          />
        </View>

        {selectedArea && (
          <View style={styles.detailsCard}>
            <Text style={styles.selectedTitle}>المنطقة المحددة: {selectedArea}</Text>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setShowMuscleList(true)}
            >
              <Text style={styles.actionButtonText}>
                عرض الأجزاء الدقيقة ({musclesInArea.length} جزء)
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* نافذة اختيار الجزء الدقيق (Two-Step Flow) لضمان السلامة الطبية */}
      <Modal
        visible={showMuscleList}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowMuscleList(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>اختر الجزء الدقيق: {selectedArea}</Text>
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
                <Text style={styles.noDataText}>لا توجد بيانات طبية مفصلة لهذه المنطقة حالياً.</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E9ECEF' },
  backButton: { marginRight: 16 },
  backText: { fontSize: 16, color: '#007AFF', fontWeight: '600' },
  title: { fontSize: 18, fontWeight: 'bold', color: '#212529' },
  content: { padding: 16 },
  instruction: { fontSize: 14, color: '#495057', marginBottom: 16, textAlign: 'center', lineHeight: 20 },
  visualContainer: { borderRadius: 12, overflow: 'hidden', marginBottom: 16, backgroundColor: '#FFFFFF' },
  detailsCard: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#E9ECEF' },
  selectedTitle: { fontSize: 16, fontWeight: 'bold', color: '#212529', marginBottom: 12 },
  actionButton: { backgroundColor: '#007AFF', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  actionButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%', paddingBottom: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E9ECEF' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#212529' },
  closeButton: { fontSize: 24, color: '#6C757D', fontWeight: 'bold' },
  muscleList: { padding: 16 },
  muscleItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F3F5' },
  muscleName: { fontSize: 16, fontWeight: '600', color: '#212529', marginBottom: 4 },
  muscleLocation: { fontSize: 14, color: '#6C757D' },
  noDataText: { fontSize: 16, color: '#6C757D', textAlign: 'center', marginTop: 20 }
});
