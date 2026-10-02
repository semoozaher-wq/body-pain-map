import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { usePainContext } from '../context/PainContext';

export const BodyPickerScreen = () => {
  const { selectedOrgan } = usePainContext();

  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        شاشة تحديد Pain Map جاهزة: {selectedOrgan ? JSON.stringify(selectedOrgan) : 'لم يتم اختيار عضو'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  text: {
    fontSize: 16,
    color: '#333333',
  },
});

export default BodyPickerScreen;
