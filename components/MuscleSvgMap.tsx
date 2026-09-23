import React, { useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, ScrollView } from 'react-native';
import svgMappingData from '../data/svgMuscleMapping.json';
import anatomyPainMap from '../data/anatomyPainMap.json';

interface MuscleSvgMapProps {
  onSelectMuscle?: (muscleData: any) => void;
  selectedMuscleId?: string | null;
}

export const MuscleSvgMap: React.FC<MuscleSvgMapProps> = ({
  onSelectMuscle,
  selectedMuscleId,
}) => {
  const [activeView, setActiveView] = useState<'front' | 'back'>('front');
  const [hoveredMuscleName, setHoveredMuscleName] = useState<string | null>(null);

  const mappedMuscles = svgMappingData.elements || [];

  const handleMusclePress = (svgId: string) => {
    const mapping = mappedMuscles.find((item: any) => item.svgId === svgId);
    
    if (mapping && mapping.muscleId) {
      const medicalDetails = anatomyPainMap.muscles.find(
        (m: any) => m.id === mapping.muscleId
      );

      if (onSelectMuscle && medicalDetails) {
        onSelectMuscle({
          ...medicalDetails,
          svgId: mapping.svgId,
          svgPath: mapping.svgPath,
        });
      }
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.viewToggleContainer}>
        <TouchableOpacity
          style={[styles.toggleButton, activeView === 'front' && styles.activeToggle]}
          onPress={() => setActiveView('front')}
        >
          <Text style={[styles.toggleText, activeView === 'front' && styles.activeToggleText]}>
            المنظر الأمامي
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toggleButton, activeView === 'back' && styles.activeToggle]}
          onPress={() => setActiveView('back')}
        >
          <Text style={[styles.toggleText, activeView === 'back' && styles.activeToggleText]}>
            المنظر الخلفي
          </Text>
        </TouchableOpacity>
      </View>

      {hoveredMuscleName && (
        <View style={styles.infoBadge}>
          <Text style={styles.infoBadgeText}>{hoveredMuscleName}</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.listContainer}>
        <Text style={styles.sectionTitle}>
          اختر العضلة مباشرة لجلب البيانات الطبية:
        </Text>
        
        <View style={styles.musclesGrid}>
          {mappedMuscles
            .filter((m: any) => m.view === activeView || !m.view)
            .map((item: any) => {
              const medicalInfo = anatomyPainMap.muscles.find(
                (m: any) => m.id === item.muscleId
              );
              const isSelected = selectedMuscleId === item.muscleId;

              return (
                <TouchableOpacity
                  key={item.svgId}
                  style={[
                    styles.muscleCard,
                    isSelected && styles.selectedCard
                  ]}
                  onPress={() => handleMusclePress(item.svgId)}
                  onPressIn={() => setHoveredMuscleName(medicalInfo?.nameAr || item.label)}
                  onPressOut={() => setHoveredMuscleName(null)}
                >
                  <Text style={[styles.muscleLabel, isSelected && styles.selectedText]}>
                    {medicalInfo ? medicalInfo.nameAr : item.label || item.svgId}
                  </Text>
                </TouchableOpacity>
              );
            })}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  viewToggleContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 4,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeToggle: {
    backgroundColor: '#007AFF',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  activeToggleText: {
    color: '#FFF',
  },
  infoBadge: {
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  infoBadgeText: {
    color: '#007AFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  listContainer: {
    paddingBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    textAlign: 'right',
  },
  musclesGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  muscleCard: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  selectedCard: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  muscleLabel: {
    fontSize: 13,
    color: '#495057',
  },
  selectedText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});
