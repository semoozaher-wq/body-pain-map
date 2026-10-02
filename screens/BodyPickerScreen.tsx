import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { OrganDetailModal } from '../components/OrganDetailModal';
import { usePainContext } from '../context/PainContext';

export const BodyPickerScreen = () => {
  const { selectedOrgan, setSelectedOrgan } = usePainContext();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleOrganSelect = (organ: any) => {
    setSelectedOrgan(organ);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  return (
    <View style={styles.container}>
      {/* واجهة اختيار العضو / الخريطة */}
      <View style={styles.canvasContainer}>
        {/* يمكنك وضع مكون خريطة الجسم هنا بدون استدعاء PainMarker المفقود */}
      </View>

      {/* النافذة المنبثقة للتفاصيل */}
      {isModalOpen && (
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
    backgroundColor: '#fff',
  },
  canvasContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default BodyPickerScreen;
