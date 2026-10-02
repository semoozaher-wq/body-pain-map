import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useAppAssistant } from '../hooks/useAppAssistant';

export const GlobalAssistant: React.FC = () => {
  const assistant = useAppAssistant();

  const stage = assistant?.stage || 'idle';
  const data = assistant?.data || {};
  const isListening = assistant?.isListening || false;
  const isProcessing = assistant?.isProcessing || false;

  const handleProcess = () => {
    if (typeof assistant?.processInput === 'function') {
      assistant.processInput('اختبار المساعد');
    }
  };

  const handleReset = () => {
    if (typeof assistant?.reset === 'function') {
      assistant.reset();
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>مساعد الذكاء الاصطناعي</Text>
      <Text style={styles.status}>الحالة: {stage}</Text>
      {data?.lastText ? (
        <Text style={styles.resultText}>آخر نص: {String(data.lastText)}</Text>
      ) : null}
      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.button} onPress={handleProcess}>
          <Text style={styles.buttonText}>
            {isProcessing ? 'جاري المعالجة...' : isListening ? 'جاري الاستماع...' : 'تجربة التحدث'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.resetButton]} onPress={handleReset}>
          <Text style={styles.buttonText}>إعادة ضبط</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    margin: 16,
  },
  title: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  status: {
    color: '#38bdf8',
    fontSize: 14,
    marginBottom: 8,
  },
  resultText: {
    color: '#94a3b8',
    fontSize: 13,
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    backgroundColor: '#0ea5e9',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  resetButton: {
    backgroundColor: '#64748b',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
});

export default GlobalAssistant;
