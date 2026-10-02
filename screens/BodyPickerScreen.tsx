import React, { useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { PainMarker } from '../components/PainMarker';
import { OrganDetailModal } from '../components/OrganDetailModal';
import { usePainContext } from '../context/PainContext';

export const BodyPickerScreen = () => {
  const { painMarker, selectedOrgan, setSelectedOrgan } = usePainContext();
  const [isOrganModalOpen, setIsOrganModalOpen] = useState(false);

  const handleOrganSelect = (organ: any) => {
    setSelectedOrgan(organ);
    setIsOrganModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsOrganModalOpen(false);
    setSelectedOrgan(null);
  };

  return (
    <View style={styles.container}>
      <View style={styles.bodyCanvas}>
        <Text style={styles.headerTitle}>حدد موضع الألم</Text>
        
        {/* رسم علامة الألم عند تحديدها */}
        {painMarker && !isOrganModalOpen && (
          <PainMarker 
            x={painMarker.x} 
            y={painMarker.y} 
            intensity={painMarker.intensity} 
          />
        )}

        {/* خريطة الأعضاء التفاعلية */}
        <View style={styles.interactiveArea}>
          <TouchableOpacity 
            style={styles.organZone} 
            onPress={() => handleOrganSelect({ name: 'الرأس', description: 'ألم أو صداع في منطقة الرأس' })}
          >
            <Text style={styles.zoneText}>الرأس</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.organZone} 
            onPress={() => handleOrganSelect({ name: 'الصدر', description: 'ألم أو ضيق في منطقة الصدر' })}
          >
            <Text style={styles.zoneText}>الصدر</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.organZone} 
            onPress={() => handleOrganSelect({ name: 'البطن', description: 'ألم أو تقلصات في منطقة البطن' })}
          >
            <Text style={styles.zoneText}>البطن</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* النافذة المنبثقة للتفاصيل */}
      {isOrganModalOpen && (
        <OrganDetailModal
          organ={selectedOrgan}
          onClose={handleCloseModal}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  bodyCanvas: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 24,
  },
  interactiveArea: {
    width: '100%',
    gap: 16,
  },
  organZone: {
    backgroundColor: '#ffffff',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  zoneText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0284c7',
  },
});

export default BodyPickerScreen;
