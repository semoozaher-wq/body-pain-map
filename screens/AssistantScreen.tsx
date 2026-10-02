import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import createTurnGate from '../services/speech/turnGate';

export const AssistantScreen: React.FC = () => {
  const turnGate = createTurnGate();

  const handleInput = (text: string): void => {
    if (turnGate.canProceed()) {
      console.log('Input processed:', text);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>المساعد الذكي</Text>
      <TouchableOpacity style={styles.button} onPress={() => handleInput('مرحباً')}>
        <Text style={styles.buttonText}>بدء التحدث</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#0ea5e9',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
});

export default AssistantScreen;
