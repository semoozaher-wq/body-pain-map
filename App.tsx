// App.tsx

import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import { ThemeProvider } from './hooks/useTheme';
import MainApp from './MainApp';
import AppErrorBoundary from './components/AppErrorBoundary';
import { ensureTtsVoices } from './services/speech/tts';

export default function App() {
  // تسخين أصوات النطق الطبيعية عند بدء التطبيق (أفضل صوت لكل لغة).
  useEffect(() => {
    void ensureTtsVoices();
  }, []);
  return (
    <AppErrorBoundary>
      <GestureHandlerRootView style={styles.root}>
        <ThemeProvider>
          <MainApp />
        </ThemeProvider>
      </GestureHandlerRootView>
    </AppErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
