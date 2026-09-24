import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Modal,
  Image,
  Pressable,
} from 'react-native';
import anatomyPainMap from '../data/anatomyPainMap.json';
import { translate } from '../services/i18n';

interface BodyPickerScreenProps {
  onNavigateToDetails: (muscleData: any) => void;
  onBack?: () => void;
  language: 'ar' | 'en' | 'fr';
  direction: 'rtl' | 'ltr';
}

// خريطة المناطق التفاعلية على الصورة
const interactiveZones = [
  { id: 'head', label: 'الرأس', top: 0, left: 35, width: 30, height: 12, group: 'head' },
  { id: 'neck', label: 'الرقبة', top: 12, left: 38, width: 24, height: 6, group: 'neck' },
  { id: 'chest', label: 'الصدر', top: 18, left: 20, width: 60, height: 20, group: 'chest' },
  { id: 'shoulders', label: 'الأكتاف', top: 18, left: 0, width: 100, height: 15, group: 'deltoids' },
  { id: 'arms', label: 'الذراعين', top: 33, left: 0, width: 100, height: 25, group: 'biceps' },
  { id: 'abs', label: 'البطن', top: 38, left: 25, width: 50, height: 20, group: 'abs' },
  { id: 'obliques', label: 'الجنب', top: 38, left: 0, width: 100, height: 20, group: 'obliques' },
  { id: 'thighs', label: 'الفخذين', top: 58, left: 10, width: 80, height: 25, group: 'quadriceps' },
  { id: 'calves', label: 'الساقين', top: 83, left: 15, width: 70, height: 17, group: 'calves' },
];

export const BodyPickerScreen: React.FC<BodyPickerScreenProps> = ({
  onNavigateToDetails,
  onBack,
  language,
}) => {
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [showMuscleList, setShowMuscleList] = useState(false);
  const [activeView, setActiveView] = useState<'front' | 'back'>('front');

  const musclesInZone = useMemo(() => {
    if (!selectedZone) return [];
    
    const muscles = anatomyPainMap.muscles || {};
    return Object.values(muscles).filter((muscle: any) => {
      const muscleGroup = muscle.group || '';
      const views = muscle.views || [];
      return muscleGroup === selectedZone && views.includes(activeView);
    });
  }, [selectedZone, activeView]);

  const handleZonePress = (zoneId: string) => {
    const zone = interactiveZones.find(z => z.id === zoneId);
    if (zone) {
      setSelectedZone(zone.group);
      setShowMuscleList(true);
    }
  };

  const handleMuscleSelect = (muscle: any) => {
    setShowMuscleList(false);
    onNavigateToDetails(muscle);
  };

  const getZoneLabel = (group: string) => {
    const labels: Record<string, string> = {
      'head': 'الرأس',
      'neck': 'الرقبة',
      'chest': 'الصدر',
      'deltoids': 'الأكتاف',
      'biceps': 'الذراعين',
      'abs': 'البطن',
      'obliques': 'الجنب',
      'quadriceps': 'الفخذين',
      'calves': 'الساقين',
    };
    return labels[group] || group;
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

        {/* أزرار التبديل بين الأمامي والخلفي */}
        <View style={styles.viewToggle}>
          <TouchableOpacity
            style={[styles.toggleButton, activeView === 'front' && styles.activeToggle]}
            onPress={() => setActiveView('front')}
          >
            <Text style={[styles.toggleText, activeView === 'front' && styles.activeToggleText]}>
              أمامي
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, activeView === 'back' && styles.activeToggle]}
            onPress={() => setActiveView('back')}
          >
            <Text style={[styles.toggleText, activeView === 'back' && styles.activeToggleText]}>
              خلفي
            </Text>
          </TouchableOpacity>
        </View>

        {/* الصورة التفاعلية */}
        <View style={styles.imageContainer}>
          <Image
            source={
              activeView === 'front'
                ? require('../assets/anatomy/muscle-front-realistic.png')
                : require('../assets/anatomy/muscle-back-realistic.png')
            }
            style={styles.bodyImage}
            resizeMode="contain"
          />
          
          {/* المناطق التفاعلية الشفافة */}
          {interactiveZones.map((zone) => (
            <Pressable
              key={zone.id}
              style={[
                styles.interactiveZone,
                {
                  top: `${zone.top}%`,
                  left: `${zone.left}%`,
                  width: `${zone.width}%`,
                  height: `${zone.height}%`,
                },
              ]}
              onPress={() => handleZonePress(zone.id)}
            >
              <Text style={styles.zoneLabel}>{zone.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.hint}>
          💡 اضغط على أي منطقة في الصورة لعرض العضلات الموجودة فيها
        </Text>
      </ScrollView>

      {/* Modal لعرض قائمة العضلات */}
      <Modal
        visible={showMuscleList}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowMuscleList(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                العضلات في منطقة: {getZoneLabel(selectedZone || '')}
              </Text>
              <TouchableOpacity onPress={() => setShowMuscleList(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.muscleList}>
              {musclesInZone.length > 0 ? (
                musclesInZone.map((muscle: any) => (
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
                <Text style={styles.noDataText}>
                  لا توجد عضلات مسجلة في هذه المنطقة للعرض {activeView === 'front' ? 'الأمامي' : 'الخلفي'}
                </Text>
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
  header: { 
    flexDirection: 'row-reverse', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 16, 
    paddingVertical: 12, 
    borderBottomWidth: 1, 
    borderBottomColor: '#EEEEEE' 
  },
  title: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  backButton: { padding: 8 },
  backText: { color: '#007AFF', fontSize: 16 },
  content: { padding: 16 },
  instruction: { 
    fontSize: 14, 
    color: '#4B5563', 
    marginBottom: 16, 
    textAlign: 'right', 
    lineHeight: 20 
  },
  viewToggle: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 12,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  activeToggle: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
  },
  activeToggleText: {
    color: '#FFFFFF',
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: 0.5,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
  },
  bodyImage: {
    width: '100%',
    height: '100%',
  },
  interactiveZone: {
    position: 'absolute',
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.3)',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoneLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#2563EB',
    textAlign: 'center',
  },
  hint: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
  },
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    justifyContent: 'flex-end' 
  },
  modalContent: { 
    backgroundColor: '#FFFFFF', 
    borderTopLeftRadius: 20, 
    borderTopRightRadius: 20, 
    maxHeight: '80%', 
    paddingBottom: 20 
  },
  modalHeader: { 
    flexDirection: 'row-reverse', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 16, 
    borderBottomWidth: 1, 
    borderBottomColor: '#E9ECEF' 
  },
  modalTitle: { 
    fontSize: 16, 
    fontWeight: 'bold', 
    color: '#212529' 
  },
  closeButton: { 
    fontSize: 24, 
    color: '#6C757D', 
    fontWeight: 'bold' 
  },
  muscleList: { 
    padding: 16 
  },
  muscleItem: { 
    paddingVertical: 12, 
    borderBottomWidth: 1, 
    borderBottomColor: '#F1F3F5' 
  },
  muscleName: { 
    fontSize: 15, 
    fontWeight: '600', 
    color: '#212529', 
    marginBottom: 4, 
    textAlign: 'right' 
  },
  muscleLocation: { 
    fontSize: 13, 
    color: '#6C757D', 
    textAlign: 'right' 
  },
  noDataText: { 
    fontSize: 14, 
    color: '#6C757D', 
    textAlign: 'center', 
    marginTop: 20 
  }
});
