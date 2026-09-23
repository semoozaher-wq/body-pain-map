import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { RealisticMuscleViews } from '../components/RealisticMuscleViews';
import anatomyPainMap from '../data/anatomyPainMap.json';

interface BodyPickerScreenProps {
  onNavigateToDetails: (muscleData: any) => void;
  onBack?: () => void;
}

export const BodyPickerScreen: React.FC<BodyPickerScreenProps> = ({
  onNavigateToDetails,
  onBack,
}) => {
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [matchedMuscle, setMatchedMuscle] = useState<any | null>(null);

  // الخريطة الربطية الشفافة بين اسم المنطقة البصرية ومعرف العضلة الطبية في 317
  const areaToMedicalMap: Record<string, string> = {
    'الكتف': 'm_deltoid',
    'الصدر': 'm_pectoralis',
    'العضد / البايسبس': 'm_biceps',
    'البطن': 'm_abs',
    'الفخذ الأمامي': 'm_quads',
    'الرقبة والأكتاف': 'm_trapezius',
    'أعلى الظهر': 'm_lats',
    'أسفل الظهر': 'm_lower_back',
    'الأرداف': 'm_glutes',
    'الفخذ الخلفي': 'm_hamstrings',
    'السمانة': 'm_calves',
  };

  const handleAreaSelect = (areaName: string) => {
    setSelectedArea(areaName);
    
    // جلب معرف العضلة
    const medicalId = areaToMedicalMap[areaName];
    
    if (medicalId) {
      // البحث في خريطة الـ 317
      const medicalDetails = anatomyPainMap.muscles.find(
        (m: any) => m.id === medicalId
      );

      if (medicalDetails) {
        setMatchedMuscle(medicalDetails);
      } else {
        setMatchedMuscle(null);
      }
    } else {
      setMatchedMuscle(null);
    }
  };

  const handleConfirmAndProceed = () => {
    if (matchedMuscle) {
      onNavigateToDetails(matchedMuscle);
    }
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
          اضغط على المنطقة المصابة في الصورة الواقعية لرؤية بياناتها الطبية مباشرة:
        </Text>

        {/* عرض الصور الواقعية مع التفاعل البصري */}
        <View style={styles.visualContainer}>
          <RealisticMuscleViews
            onSelectArea={handleAreaSelect}
            selectedArea={selectedArea}
          />
        </View>

        {/* كارت عرض البيانات الطبية المباشرة فور تحديد العضلة */}
        {selectedArea && (
          <View style={styles.detailsCard}>
            <Text style={styles.selectedTitle}>المنطقة المحددة: {selectedArea}</Text>
            
            {matchedMuscle ? (
              <View style={styles.medicalInfoBox}>
                <Text style={styles.medicalName}>
                  الاسم الطبي: {matchedMuscle.nameAr} ({matchedMuscle.nameEn})
                </Text>
                <Text style={styles.description}>
                  {matchedMuscle.descriptionAr || 'انقر أدناه لمشاهدة جميع التوصيات والتحذيرات الطبية الخاصة بهذه العضلة.'}
                </Text>

                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={handleConfirmAndProceed}
                >
                  <Text style={styles.actionButtonText}>
                    عرض التحليل والبيانات الطبية الشاملة
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.warningText}>
                جاري مطابقة المنطقة المحددة مع قاعدة بيانات 317 الطبية...
              </Text>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  backButton: {
    padding: 8,
  },
  backText: {
    color: '#007AFF',
    fontSize: 16,
  },
  content: {
    padding: 16,
  },
  instruction: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 16,
    textAlign: 'right',
  },
  visualContainer: {
    marginBottom: 20,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F9FAFB',
  },
  detailsCard: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  selectedTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
    textAlign: 'right',
  },
  medicalInfoBox: {
    marginTop: 8,
  },
  medicalName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2563EB',
    textAlign: 'right',
    marginBottom: 6,
  },
  description: {
    fontSize: 13,
    color: '#4B5563',
    textAlign: 'right',
    marginBottom: 16,
    lineHeight: 18,
  },
  actionButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  warningText: {
    color: '#D97706',
    fontSize: 13,
    textAlign: 'right',
    marginTop: 4,
  },
});
