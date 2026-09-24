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
import rawAnatomyData from '../data/anatomyPainMap.json';
import hotspotsData from '../data/anatomyHotspots.json';
import organDetails from '../data/organDetails.json';
import { translate } from '../services/i18n';

// دالة تنظيف المسافات الزائدة
function cleanData(obj: any): any {
  if (typeof obj === 'string') return obj.trim();
  if (Array.isArray(obj)) return obj.map(cleanData);
  if (obj !== null && typeof obj === 'object') {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      cleaned[key.trim()] = cleanData(value);
    }
    return cleaned;
  }
  return obj;
}

const anatomyData = cleanData(rawAnatomyData);

interface BodyPickerScreenProps {
  onNavigateToDetails: (muscleData: any) => void;
  onBack?: () => void;
  language: 'ar' | 'en' | 'fr';
  direction: 'rtl' | 'ltr';
}

export const BodyPickerScreen: React.FC<BodyPickerScreenProps> = ({
  onNavigateToDetails,
  onBack,
  language,
}) => {
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const [activeView, setActiveView] = useState<'front' | 'back'>('front');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showOrganMode, setShowOrganMode] = useState(false);

  // تصفية النقاط حسب العرض الحالي
  const visibleHotspots = useMemo(() => {
    return hotspotsData.filter((h: any) => h.view === activeView);
  }, [activeView]);

  // عند الضغط على أي نقطة
  const handlePress = (hotspot: any) => {
    if (hotspot.type === 'organ') {
      // عرض معلومات العضو الداخلي
      const organ = organDetails[hotspot.organId];
      if (organ) {
        setSelectedItem({ ...hotspot, organData: organ });
        setShowDetails(true);
      }
    } else {
      // عرض معلومات العضلة
      const muscle = anatomyData.muscles?.[hotspot.muscleId];
      if (muscle) {
        setSelectedItem({ ...hotspot, muscleData: muscle });
        setShowDetails(true);
      } else {
        // إذا لم نجد العضلة، نعرض رسالة
        setSelectedItem({ ...hotspot, error: 'لم يتم العثور على بيانات هذا الجزء' });
        setShowDetails(true);
      }
    }
  };

  const handleGoToDetails = () => {
    if (selectedItem?.muscleData) {
      setShowDetails(false);
      onNavigateToDetails(selectedItem.muscleData);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backText}>← {t('back')}</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.title}>{t('bodyPicker.title')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* زر تبديل الوضع: عضلات / أعضاء داخلية */}
        <View style={styles.modeToggle}>
          <TouchableOpacity
            style={[styles.modeButton, !showOrganMode && styles.activeMode]}
            onPress={() => setShowOrganMode(false)}
          >
            <Text style={[styles.modeText, !showOrganMode && styles.activeModeText]}>
               العضلات
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeButton, showOrganMode && styles.activeMode]}
            onPress={() => setShowOrganMode(true)}
          >
            <Text style={[styles.modeText, showOrganMode && styles.activeModeText]}>
              🫀 أعضاء داخلية
            </Text>
          </TouchableOpacity>
        </View>

        {/* أزرار التبديل أمامي/خلفي */}
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

        {/* الصورة مع النقاط التفاعلية */}
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

          {visibleHotspots
            .filter((h: any) => showOrganMode ? h.type === 'organ' : h.type === 'muscle')
            .map((spot: any) => (
              <Pressable
                key={spot.id}
                style={[
                  styles.hotspot,
                  { left: `${spot.x}%`, top: `${spot.y}%` },
                ]}
                onPress={() => handlePress(spot)}
              >
                <View style={[
                  styles.hotspotDot,
                  spot.type === 'organ' && styles.organDot
                ]} />
                <Text style={styles.hotspotLabel}>{spot.label}</Text>
              </Pressable>
            ))}
        </View>

        <Text style={styles.hint}>
          💡 اضغط على أي نقطة لعرض المعلومات فوراً
        </Text>
      </ScrollView>

      {/* Modal عرض المعلومات */}
      <Modal
        visible={showDetails}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDetails(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedItem?.type === 'organ' ? '🫀' : '💪'} {selectedItem?.label}
              </Text>
              <TouchableOpacity onPress={() => setShowDetails(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {selectedItem?.error ? (
                <Text style={styles.errorText}>{selectedItem.error}</Text>
              ) : selectedItem?.type === 'organ' ? (
                // عرض معلومات العضو
                <>
                  <View style={styles.infoCard}>
                    <Text style={styles.infoLabel}>📍 الموقع:</Text>
                    <Text style={styles.infoText}>{selectedItem.organData.location}</Text>
                  </View>
                  <View style={styles.infoCard}>
                    <Text style={styles.infoLabel}>️ تلميح بصري:</Text>
                    <Text style={styles.infoText}>{selectedItem.organData.visualHint}</Text>
                  </View>
                  <View style={styles.infoCard}>
                    <Text style={styles.infoLabel}>⚠️ الأعراض الشائعة:</Text>
                    {selectedItem.organData.symptoms.map((s: string, i: number) => (
                      <Text key={i} style={styles.listItem}>• {s}</Text>
                    ))}
                  </View>
                  <View style={styles.infoCard}>
                    <Text style={styles.infoLabel}>🔍 الأسباب المحتملة:</Text>
                    {selectedItem.organData.causes.map((c: string, i: number) => (
                      <Text key={i} style={styles.listItem}>• {c}</Text>
                    ))}
                  </View>
                  {selectedItem.organData.warning && (
                    <View style={[styles.infoCard, styles.warningCard]}>
                      <Text style={styles.warningText}>{selectedItem.organData.warning}</Text>
                    </View>
                  )}
                  <View style={styles.infoCard}>
                    <Text style={styles.infoLabel}>💊 التوصية:</Text>
                    <Text style={styles.infoText}>{selectedItem.organData.recommendation}</Text>
                  </View>
                </>
              ) : (
                // عرض معلومات العضلة
                <>
                  <View style={styles.partBadge}>
                    <Text style={styles.partBadgeText}>
                      جزء #{selectedItem.muscleData.partNumber}
                    </Text>
                  </View>
                  <View style={styles.infoCard}>
                    <Text style={styles.infoLabel}>📍 الموقع:</Text>
                    <Text style={styles.infoText}>{selectedItem.muscleData.locationAr}</Text>
                  </View>
                  {selectedItem.muscleData.commonCauses?.length > 0 && (
                    <View style={styles.infoCard}>
                      <Text style={styles.infoLabel}>💡 الأسباب الشائعة:</Text>
                      {selectedItem.muscleData.commonCauses.map((c: string, i: number) => (
                        <Text key={i} style={styles.listItem}>• {c}</Text>
                      ))}
                    </View>
                  )}
                  {selectedItem.muscleData.warning && (
                    <View style={[styles.infoCard, styles.warningCard]}>
                      <Text style={styles.warningLabel}>⚠️ تحذير:</Text>
                      <Text style={styles.warningText}>{selectedItem.muscleData.warning}</Text>
                    </View>
                  )}
                  {selectedItem.muscleData.recommendation && (
                    <View style={styles.infoCard}>
                      <Text style={styles.infoLabel}>💊 التوصية:</Text>
                      <Text style={styles.infoText}>{selectedItem.muscleData.recommendation}</Text>
                    </View>
                  )}
                  <TouchableOpacity style={styles.actionButton} onPress={handleGoToDetails}>
                    <Text style={styles.actionButtonText}>
                      📋 انتقل لوصف الألم والتفاصيل
                    </Text>
                  </TouchableOpacity>
                </>
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
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  backButton: { padding: 8 },
  backText: { color: '#2563EB', fontSize: 16, fontWeight: '600' },
  content: { padding: 16 },
  modeToggle: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 12,
    gap: 12,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  activeMode: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  modeText: { fontSize: 14, fontWeight: '600', color: '#4B5563' },
  activeModeText: { color: '#FFFFFF' },
  viewToggle: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 12,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  activeToggle: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  toggleText: { fontSize: 14, fontWeight: '600', color: '#4B5563' },
  activeToggleText: { color: '#FFFFFF' },
  imageContainer: {
    width: '100%',
    aspectRatio: 0.55,
    backgroundColor: '#FFF',
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    elevation: 4,
    marginBottom: 16,
  },
  bodyImage: { width: '100%', height: '100%' },
  hotspot: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -25,
    marginTop: -25,
  },
  hotspotDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#2563EB',
    borderWidth: 2,
    borderColor: '#FFF',
    elevation: 3,
  },
  organDot: {
    backgroundColor: '#DC2626',
  },
  hotspotLabel: {
    position: 'absolute',
    top: -18,
    fontSize: 9,
    fontWeight: 'bold',
    color: '#1F2937',
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 4,
    borderRadius: 4,
    whiteSpace: 'nowrap',
  },
  hint: { fontSize: 12, color: '#6B7280', textAlign: 'center', marginTop: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827', flex: 1, textAlign: 'right' },
  closeButton: { fontSize: 24, color: '#6B7280', fontWeight: 'bold', marginLeft: 12 },
  modalBody: { padding: 20 },
  partBadge: {
    backgroundColor: '#2563EB',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignSelf: 'flex-end',
    marginBottom: 16,
  },
  partBadgeText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  infoCard: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  infoLabel: { fontSize: 14, fontWeight: 'bold', color: '#374151', marginBottom: 8, textAlign: 'right' },
  infoText: { fontSize: 14, color: '#4B5563', textAlign: 'right', lineHeight: 22 },
  listItem: { fontSize: 13, color: '#4B5563', textAlign: 'right', marginBottom: 4, lineHeight: 20 },
  warningCard: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  warningLabel: { fontSize: 14, fontWeight: 'bold', color: '#991B1B', marginBottom: 8, textAlign: 'right' },
  warningText: { fontSize: 13, color: '#991B1B', textAlign: 'right', lineHeight: 20 },
  errorText: { fontSize: 14, color: '#DC2626', textAlign: 'center', padding: 20 },
  actionButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  actionButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
});
