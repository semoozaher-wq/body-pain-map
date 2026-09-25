// MainApp.tsx

import React, { useEffect, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import anatomyMap from './data/anatomyPainMap.json';
import { useLanguage } from './hooks/useLanguage';
import { useTheme } from './hooks/useTheme';
import { translate } from './services/i18n';
import { Screen, AnatomyData, Checkup, Muscle } from './types';
import { DATA } from './constants/appConstants';

// المكونات
import { Header } from './components/Header';
import { WelcomeScreen } from './screens/WelcomeScreen';
import { BodyPickerScreen } from './screens/BodyPickerScreen';
import { DetailsScreen } from './screens/DetailsScreen';
import { ResultsScreen } from './screens/ResultsScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { BrandLogo } from './components/BrandLogo';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { ThemeToggle } from './components/ThemeToggle';

const data = anatomyMap as unknown as AnatomyData;

export default function App() {
  const [screen, setScreen] = useState<Screen>('welcome');
  const [quickRelief, setQuickRelief] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedMuscleData, setSelectedMuscleData] = useState<Muscle | null>(null);
  const [intensity, setIntensity] = useState(4);
  const [painType, setPainType] = useState('مستمر');
  const [duration, setDuration] = useState('منذ أيام');
  const [note, setNote] = useState('');
  const [redFlags, setRedFlags] = useState<string[]>([]);
  const [history, setHistory] = useState<Checkup[]>([]);

  const { language, direction, setLanguage } = useLanguage();
  const { isDark, colors, toggleTheme } = useTheme();
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);

  const selected = selectedMuscleData || (selectedId ? data.muscles[selectedId] : null);
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

  // الانتقال إلى شاشة التفاصيل مع الاحتفاظ ببيانات العضلة المختارة
  const handleNavigateToDetails = (muscleData: Muscle) => {
    setSelectedMuscleData(muscleData);
    setSelectedId(muscleData.id);
    setScreen('details');
  };

  const saveResults = () => {
    if (!selected) return;
    const urgent = intensity >= 8 || redFlags.length > 0;
    setHistory((items) => [
      {
        id: `${Date.now()}`,
        partId: selected.id,
        intensity,
        painType,
        duration,
        note: note.trim(),
        urgent,
        createdAt: new Date().toLocaleDateString('ar-EG'),
        createdAtIso: new Date().toISOString(),
      },
      ...items,
    ].slice(0, 50));
    setScreen('results');
  };

  const saveSelfCareResult = (result: { guideKey: string; pointId?: string; before: number; after: number }) => {
    setHistory((items) => [{
      id: `self-care-${Date.now()}`,
      partId: `self-care:${result.guideKey}`,
      intensity: result.before,
      afterIntensity: result.after,
      painType: 'خطة تخفيف ذاتي',
      duration: '5 دقائق',
      selfCareGuide: result.guideKey,
      selfCarePointId: result.pointId,
      note: 'تقييم قبل وبعد خطة التخفيف الذاتي',
      urgent: false,
      createdAt: new Date().toLocaleDateString('ar-EG'),
      createdAtIso: new Date().toISOString(),
    }, ...items].slice(0, 50));
  };

  const startOver = () => {
    setSelectedId(null);
    setSelectedMuscleData(null);
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
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {screen === 'welcome' && (
        <View style={styles.welcomeTopBar}>
          <BrandLogo compact />
          <View style={styles.topControls}>
            <LanguageSwitcher language={language} onChange={setLanguage} />
            <ThemeToggle dark={isDark} onPress={toggleTheme} />
          </View>
        </View>
      )}
      
      {screen !== 'welcome' && (
        <Header
          title={getTitle()}
          onBack={() => setScreen(screen === 'history' ? 'welcome' : 'body')}
          rightAction={(
            <View style={styles.headerActions}>
              <LanguageSwitcher language={language} onChange={setLanguage} />
              <ThemeToggle dark={isDark} onPress={toggleTheme} />
              <Pressable onPress={() => setScreen('history')} style={styles.historyButton} accessibilityLabel={t('history')}>
                <Text style={[styles.historyButtonText, { color: colors.primaryDark }]}>{t('history')}</Text>
              </Pressable>
            </View>
          )}
        />
      )}

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {screen === 'welcome' && (
          <WelcomeScreen
            onStart={() => { setQuickRelief(false); setScreen('body'); }}
            onQuickRelief={() => { setQuickRelief(true); setScreen('body'); }}
            language={language}
            direction={direction}
          />
        )}

        {screen === 'body' && (
          <BodyPickerScreen
            onNavigateToDetails={handleNavigateToDetails}
            onSaveSelfCare={saveSelfCareResult}
            language={language}
            direction={direction}
            quickRelief={quickRelief}
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
            language={language}
            direction={direction}
            contextWarning={selected?.warning ?? group?.defaultWarning}
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
            language={language}
            direction={direction}
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
  welcomeTopBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  topControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  historyButton: {
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#D6E0E6',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  historyButtonText: {
    color: '#0E6972',
    fontSize: 10,
    fontWeight: '900',
  },
});
