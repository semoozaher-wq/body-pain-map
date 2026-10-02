import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { usePainContext } from '../context/PainContext';

const { width } = Dimensions.get('window');

interface BodyPart {
  id: string;
  nameAr: string;
  nameEn: string;
  view: 'front' | 'back';
  coords: { x: number; y: number };
}

const BODY_PARTS: BodyPart[] = [
  // Front View
  { id: 'head', nameAr: 'الرأس', nameEn: 'Head', view: 'front', coords: { x: 50, y: 12 } },
  { id: 'neck', nameAr: 'الرقبة', nameEn: 'Neck', view: 'front', coords: { x: 50, y: 20 } },
  { id: 'chest', nameAr: 'الصدر', nameEn: 'Chest', view: 'front', coords: { x: 50, y: 32 } },
  { id: 'abdomen', nameAr: 'البطن', nameEn: 'Abdomen', view: 'front', coords: { x: 50, y: 46 } },
  { id: 'right_arm', nameAr: 'الذراع الأيمن', nameEn: 'Right Arm', view: 'front', coords: { x: 28, y: 35 } },
  { id: 'left_arm', nameAr: 'الذراع الأيسر', nameEn: 'Left Arm', view: 'front', coords: { x: 72, y: 35 } },
  { id: 'right_leg', nameAr: 'الساق اليمنى', nameEn: 'Right Leg', view: 'front', coords: { x: 40, y: 70 } },
  { id: 'left_leg', nameAr: 'الساق اليسرى', nameEn: 'Left Leg', view: 'front', coords: { x: 60, y: 70 } },

  // Back View
  { id: 'upper_back', nameAr: 'أعلى الظهر', nameEn: 'Upper Back', view: 'back', coords: { x: 50, y: 30 } },
  { id: 'lower_back', nameAr: 'أسفل الظهر', nameEn: 'Lower Back', view: 'back', coords: { x: 50, y: 48 } },
  { id: 'shoulders', nameAr: 'الكتفان', nameEn: 'Shoulders', view: 'back', coords: { x: 50, y: 22 } },
  { id: 'glutes', nameAr: 'الأرداف', nameEn: 'Glutes', view: 'back', coords: { x: 50, y: 58 } },
];

export const BodyPickerScreen = () => {
  const [currentView, setCurrentView] = useState<'front' | 'back'>('front');
  const [selectedParts, setSelectedParts] = useState<string[]>([]);
  const { setSelectedOrgan } = usePainContext();

  const filteredParts = BODY_PARTS.filter((part) => part.view === currentView);

  const togglePartSelection = (part: BodyPart) => {
    let updated: string[];
    if (selectedParts.includes(part.id)) {
      updated = selectedParts.filter((id) => id !== part.id);
    } else {
      updated = [...selectedParts, part.id];
    }
    setSelectedParts(updated);
    setSelectedOrgan(part);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>خريطة تحديد آلام الجسم</Text>
      <Text style={styles.subtitle}>
        اختر الجهة وحدد الموضع الذي تشعر بالألم فيه (يمكنك تحديد أكثر من موضع)
      </Text>

      {/* View Switcher Controls */}
      <View style={styles.switchContainer}>
        <TouchableOpacity
          style={[styles.switchButton, currentView === 'front' && styles.activeSwitch]}
          onPress={() => setCurrentView('front')}
        >
          <Text style={[styles.switchText, currentView === 'front' && styles.activeSwitchText]}>
            المنظر الأمامي (Anterior)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.switchButton, currentView === 'back' && styles.activeSwitch]}
          onPress={() => setCurrentView('back')}
        >
          <Text style={[styles.switchText, currentView === 'back' && styles.activeSwitchText]}>
            المنظر الخلفي (Posterior)
          </Text>
        </TouchableOpacity>
      </View>

      {/* Interactive Body Canvas */}
      <View style={styles.canvas}>
        <View style={styles.bodySilhouette}>
          <Text style={styles.silhouetteText}>
            {currentView === 'front' ? '🧍 صورة الجسم الأمامية' : '🧍‍♂️ صورة الجسم الخلفية'}
          </Text>
        </View>

        {filteredParts.map((part) => {
          const isSelected = selectedParts.includes(part.id);
          return (
            <TouchableOpacity
              key={part.id}
              style={[
                styles.marker,
                { left: `${part.coords.x}%`, top: `${part.coords.y}%` },
                isSelected && styles.selectedMarker,
              ]}
              onPress={() => togglePartSelection(part)}
            >
              <View style={[styles.markerDot, isSelected && styles.selectedMarkerDot]} />
              <Text style={styles.markerLabel}>{part.nameAr}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Selected Parts List */}
      <View style={styles.summaryContainer}>
        <Text style={styles.summaryTitle}>الأجزاء المحددة حالياً ({selectedParts.length}):</Text>
        <View style={styles.chipsContainer}>
          {selectedParts.length === 0 ? (
            <Text style={styles.noSelectionText}>لم يتم تحديد أي جزء بعد</Text>
          ) : (
            selectedParts.map((id) => {
              const part = BODY_PARTS.find((p) => p.id === id);
              return (
                <View key={id} style={styles.chip}>
                  <Text style={styles.chipText}>{part?.nameAr}</Text>
                </View>
              );
            })
          )}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#0f172a',
    minHeight: '100%',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 20,
  },
  switchContainer: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  switchButton: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  activeSwitch: {
    backgroundColor: '#0ea5e9',
  },
  switchText: {
    color: '#94a3b8',
    fontWeight: '600',
    fontSize: 13,
  },
  activeSwitchText: {
    color: '#ffffff',
  },
  canvas: {
    width: Math.min(width - 40, 360),
    height: 480,
    backgroundColor: '#1e293b',
    borderRadius: 20,
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  bodySilhouette: {
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.25,
  },
  silhouetteText: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: 'bold',
  },
  marker: {
    position: 'absolute',
    transform: [{ translateX: -20 }, { translateY: -20 }],
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  markerDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#38bdf8',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  selectedMarkerDot: {
    backgroundColor: '#ef4444',
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  selectedMarker: {
    zIndex: 10,
  },
  markerLabel: {
    color: '#f8fafc',
    fontSize: 11,
    marginTop: 2,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  summaryContainer: {
    width: '100%',
    marginTop: 24,
    backgroundColor: '#1e293b',
    padding: 16,
    borderRadius: 12,
  },
  summaryTitle: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 10,
  },
  chipsContainer: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: '#0ea5e9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  chipText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '500',
  },
  noSelectionText: {
    color: '#64748b',
    fontSize: 13,
  },
});

export default BodyPickerScreen;
