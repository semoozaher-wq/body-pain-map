// App.tsx

import React, { useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, StatusBar, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import anatomyMap from './data/anatomyPainMap.json';
import { useLanguage } from './hooks/useLanguage';
import { useTheme } from './hooks/useTheme';
import { translate } from './services/i18n';
import { Screen, AppGender, BodyView, AnatomyData, Checkup } from './types';
import { DATA } from './constants/appConstants';
import { Colors } from './constants/colors';

// المكونات
import { Header } from './components/Header';
import { WelcomeScreen } from './screens/WelcomeScreen';
import { BodyPickerScreen } from './screens/BodyPickerScreen';
import { DetailsScreen } from './screens/DetailsScreen';
import { ResultsScreen } from './screens/ResultsScreen';
import { HistoryScreen } from './screens/HistoryScreen';

const data = anatomyMap as unknown as AnatomyData;

export default function App() {
  const [screen, setScreen] = useState<Screen>('welcome');
  const [gender, setGender] = useState<AppGender>('male');
  const [view, setView] = useState<BodyView>('front');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [intensity, setIntensity] = useState(4);
  const [painType, setPainType] = useState('مستمر');
  const [duration, setDuration] = useState('منذ أيام');
  const [note, setNote] = useState('');
  const [redFlags, setRedFlags] = useState<string[]>([]);
  const [history, setHistory] = useState<Checkup[]>([]);

  const { language, direction } = useLanguage();
  const { dark, colors } = useTheme();
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);

  const selected = selectedId ? data.muscles[selectedId] : null;
  const group = selected ? data.groups[selected.group] : undefined;

  // تحميل وحفظ السجل
  useEffect(() => {
    AsyncStorage.getItem(DATA.HISTORY_STORAGE_KEY).then((saved) => {
      if (saved) setHistory(JSON.parse(saved) as Checkup[]);
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(DATA.HISTORY_STORAGE_KEY, JSON.stringify(history)).catch(() => undefined);
  }, [history]);

  const saveResults = () => {
    if (!selectedId) return;
    const urgent = intensity >= 8 || redFlags.length > 0;
    setHistory((items) => [
      {
        id: `${Date.now()}`,
        partId: selectedId,
        intensity,
        painType,
        duration,
        note: note.trim(),
        urgent,
        createdAt: new Date().toLocaleDateString('ar-EG'),
      },
      ...items,
    ].slice(0, 50));
    setScreen('results');
  };

  const startOver = () => {
    setSelectedId(null);
    setIntensity(4);
    setPainType('مستمر');
    setDuration('منذ أيام');
    setNote('');
    setRedFlags([]);
    setScreen('body');
  };

  const clearHistory = () => {
    setHistory([]);
  };

  const getTitle = (): string => {
    const titles: Record<Screen, string> = {
      welcome: t('appName'),
      body: t('body'),
      details: t('details'),
      results: t('results'),
      history: t('historyTitle'),
    };
    return titles[screen];
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />
      
      {screen !== 'welcome' && (
        <Header
          title={getTitle()}
          onBack={() => setScreen(screen === 'history' ? 'welcome' : 'body')}
        />
      )}

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {screen === 'welcome' && (
          <WelcomeScreen
            onStart={() => setScreen('body')}
            language={language}
            direction={direction}
          />
        )}

        {screen === 'body' && (
          <BodyPickerScreen
            gender={gender}
            view={view}
            selectedId={selectedId}
            setGender={setGender}
            setView={setView}
            onSelect={setSelectedId}
            onNext={() => setScreen('details')}
            onBack={() => setScreen('welcome')}
          />
        )}

        {screen === 'details' && (
          <DetailsScreen
            intensity={intensity}
            setIntensity={setIntensity}
            painType={painType}
            setPainType={setPainType}
            duration={duration}
            setDuration={setDuration}
            note={note}
            setNote={setNote}
            redFlags={redFlags}
            setRedFlags={setRedFlags}
            onBack={() => setScreen('body')}
            onNext={saveResults}
          />
        )}

        {screen === 'results' && selected && (
          <ResultsScreen
            selected={selected}
            group={group}
            intensity={intensity}
            painType={painType}
            duration={duration}
            note={note}
            redFlags={redFlags}
            history={history}
            onRestart={startOver}
            onShare={() => {}}
          />
        )}

        {screen === 'history' && (
          <HistoryScreen
            history={history}
            onBack={() => setScreen(selected ? 'results' : 'welcome')}
            onClear={clearHistory}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  content: {
    paddingBottom: 40,
  },
});
