import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { PainMarker } from '../components/PainMarker';
import { OrganDetailModal } from '../components/OrganDetailModal';
import { usePainContext } from '../context/PainContext';

export const BodyPickerScreen: React.FC = () => {
  const { painMarker, setPainMarker, selectedOrgan, setSelectedOrgan } = usePainContext();
  const [isOrganModalOpen, setIsOrganModalOpen] = useState(false);

  const handleCloseModal = () => {
    setIsOrganModalOpen(false);
    setSelectedOrgan(null);
  };

  return (
    <View style={styles.container}>
      {/* Canvas الرئيسي */}
      <View style={styles.bodyCanvas}>
        {/* إخفاء علامة الألم بصرياً فقط أثناء فتح تفاصيل العضو لمنع التداخل */}
        {painMarker && !isOrganModalOpen && (
          <PainMarker 
            x={painMarker.x} 
            y={painMarker.y} 
            intensity={painMarker.intensity} 
          />
        )}
      </View>

      {/* نافذة تفاصيل العضو */}
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
  container: { flex: 1 },
  bodyCanvas: { flex: 1, position: 'relative' }
});
