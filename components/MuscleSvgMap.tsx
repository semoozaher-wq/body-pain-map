import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import {
  useMusclesByView,
  useMedicalDataStats,
  Gender,
  Language,
} from '../hooks/useMuscleMedicalData';

interface MuscleSvgMapProps {
  onSelectMuscle?: (muscleData: any) => void;
  selectedMuscleId?: string | null;
  gender?: Gender;
  language?: Language;
}

const UI_TEXTS = {
  ar: {
    frontView: 'المنظر الأمامي',
    backView: 'المنظر الخلفي',
    sectionTitle: 'اختر العضلة لعرض البيانات الطبية:',
    noData: 'لا توجد عضلات في هذا المنظر',
    musclesCount: 'عضلة',
  },
  en: {
    frontView: 'Front View',
    backView: 'Back View',
    sectionTitle: 'Select a muscle to view medical data:',
    noData: 'No muscles in this view',
    musclesCount: 'muscles',
  },
  fr: {
    frontView: 'Vue de face',
    backView: 'Vue de dos',
    sectionTitle: 'Sélectionnez un muscle pour voir les données médicales:',
    noData: 'Aucun muscle dans cette vue',
    musclesCount: 'muscles',
  },
};

export const MuscleSvgMap: React.FC<MuscleSvgMapProps> = ({
  onSelectMuscle,
  selectedMuscleId,
  gender = 'male',
  language = 'ar',
}) => {
  const [activeView, setActiveView] = useState<'front' | 'back'>('front');
  const [hoveredMuscleName, setHoveredMuscleName] = useState<string | null>(null);

  const t = UI_TEXTS[language];
  const muscles = useMusclesByView(activeView, gender, language);
  const stats = useMedicalDataStats();

  const handleMusclePress = (muscleData: any) => {
    if (onSelectMuscle) {
      onSelectMuscle(muscleData);
    }
  };

  return (
    <View style={styles.container}>
      {/* زر تبديل المنظر */}
      <View style={styles.viewToggleContainer}>
        <TouchableOpacity
          style={[
            styles.toggleButton,
            activeView === 'front' && styles.activeToggle,
          ]}
          onPress={() => setActiveView('front')}
        >
          <Text
            style={[
              styles.toggleText,
              activeView === 'front' && styles.activeToggleText,
            ]}
          >
            {t.frontView}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.toggleButton,
            activeView === 'back' && styles.activeToggle,
          ]}
          onPress={() => setActiveView('back')}
        >
          <Text
            style={[
              styles.toggleText,
              activeView === 'back' && styles.activeToggleText,
            ]}
          >
            {t.backView}
          </Text>
        </TouchableOpacity>
      </View>

      {/* عداد العضلات */}
      <View style={styles.statsBadge}>
        <Text style={styles.statsText}>
          {muscles.length} {t.musclesCount}
        </Text>
      </View>

      {/* اسم العضلة عند الضغط */}
      {hoveredMuscleName && (
        <View style={styles.infoBadge}>
          <Text style={styles.infoBadgeText}>{hoveredMuscleName}</Text>
        </View>
      )}

      {/* القائمة */}
      <ScrollView contentContainerStyle={styles.listContainer}>
        <Text style={styles.sectionTitle}>{t.sectionTitle}</Text>

        {muscles.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>{t.noData}</Text>
          </View>
        ) : (
          <View style={styles.musclesGrid}>
            {muscles.map((muscle) => {
              const isSelected = selectedMuscleId === muscle.id;
              const hasWarning = !!muscle.warning;

              return (
                <TouchableOpacity
                  key={muscle.id}
                  style={[
                    styles.muscleCard,
                    isSelected && styles.selectedCard,
                    hasWarning && !isSelected && styles.warningCard,
                  ]}
                  onPress={() => handleMusclePress(muscle)}
                  onPressIn={() => setHoveredMuscleName(muscle.name)}
                  onPressOut={() => setHoveredMuscleName(null)}
                >
                  <Text
                    style={[
                      styles.muscleLabel,
                      isSelected && styles.selectedText,
                    ]}
                  >
                    {muscle.name}
                  </Text>
                  {hasWarning && (
                    <Text style={styles.warningIcon}>⚠️</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#FFFFFF',
  },

  // ============ View Toggle ============
  viewToggleContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 12,
    backgroundColor: '#F1F3F5',
    borderRadius: 10,
    padding: 4,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeToggle: {
    backgroundColor: '#007AFF',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
  },
  activeToggleText: {
    color: '#FFFFFF',
  },

  // ============ Stats Badge ============
  statsBadge: {
    alignSelf: 'flex-end',
    backgroundColor: '#E7F1FF',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  statsText: {
    fontSize: 12,
    color: '#0056B3',
    fontWeight: '600',
  },

  // ============ Info Badge ============
  infoBadge: {
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  infoBadgeText: {
    color: '#007AFF',
    fontWeight: 'bold',
    fontSize: 15,
  },

  // ============ List ============
  listContainer: {
    paddingBottom: 32,
  },
  sectionTitle: {
    fontSize: 14,
    color: '#6C757D',
    marginBottom: 12,
    textAlign: 'right',
    fontWeight: '500',
  },

  // ============ Muscles Grid ============
  musclesGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  muscleCard: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  selectedCard: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  warningCard: {
    borderColor: '#FFC107',
    backgroundColor: '#FFFBF0',
  },
  muscleLabel: {
    fontSize: 13,
    color: '#495057',
    fontWeight: '500',
  },
  selectedText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  warningIcon: {
    fontSize: 12,
  },

  // ============ Empty State ============
  emptyState: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#6C757D',
    textAlign: 'center',
  },
});
