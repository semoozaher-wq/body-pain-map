// MainApp.tsx

import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, BackHandler, Platform, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import anatomyMap from './data/anatomyPainMap.json';
import { useLanguage } from './hooks/useLanguage';
import { useTheme } from './hooks/useTheme';
import { usePainHistory } from './hooks/usePainHistory';
import { translate } from './services/i18n';
import { Screen, AnatomyData, Checkup, Muscle } from './types';
import { Colors } from './constants/colors';
import { Palette, Gradients, Radii, Elevation } from './constants/design';
import { Gradient } from './components/Gradient';
import { getTriageStatus } from './services/triage.js';
import { createLocalId } from './services/id';

// المكونات
import { Header } from './components/Header';
import { WelcomeScreen } from './screens/WelcomeScreen';
import { BodyPickerScreen } from './screens/BodyPickerScreen';
import { DetailsScreen } from './screens/DetailsScreen';
import { ResultsScreen } from './screens/ResultsScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { AssistantScreen } from './screens/AssistantScreen';
import { HealthInfoScreen } from './screens/HealthInfoScreen';
import { BrandLogo } from './components/BrandLogo';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { ThemeToggle } from './components/ThemeToggle';
import { GlobalAssistant } from './components/GlobalAssistant';
import type {
  AppState,
  AssistantAction,
  BodyControlCommand,
  BodyScreenState,
  ConversationContext,
  Lang,
} from './services/appAssistant/types';

const data = anatomyMap as unknown as AnatomyData;

export default function App() {
  const [screen, setScreen] = useState<Screen>('welcome');
  const [navHistory, setNavHistory] = useState<Screen[]>([]);
  const [assistantContext, setAssistantContext] = useState<string | undefined>();

  const navigateTo = (next: Screen) => {
    if (next === screen) return;
    setNavHistory((prev) => [...prev, screen]);
    setScreen(next);
  };

  const goBack = () => {
    setNavHistory((prev) => {
      if (prev.length === 0) {
        setScreen('welcome');
        return [];
      }
      const copy = [...prev];
      const previous = copy.pop()!;
      setScreen(previous);
      return copy;
    });
  };
  const [quickRelief, setQuickRelief] = useState(false);
  const [requestedOrgan, setRequestedOrgan] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedMuscleData, setSelectedMuscleData] = useState<Muscle | null>(null);
  const [intensity, setIntensity] = useState(4);
  const [painType, setPainType] = useState('مستمر');
  const [duration, setDuration] = useState('منذ أيام');
  const [note, setNote] = useState('');
  const [redFlags, setRedFlags] = useState<string[]>([]);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [afterIntensity, setAfterIntensity] = useState('');
  const [medication, setMedication] = useState('');
  const [triggers, setTriggers] = useState('');
  const [sleepHours, setSleepHours] = useState('');
  const [activity, setActivity] = useState('');

  // ---- المساعد المركزي: حالة الشاشة + أوامر التحكّم المنظّمة ----
  const [bodyControl, setBodyControl] = useState<BodyControlCommand | null>(null);
  const [bodyState, setBodyState] = useState<BodyScreenState>({ tab: 'muscles', view: 'front', sex: 'male', organId: null, pointId: null });
  const [zoomLevel, setZoomLevel] = useState(1);
  const controlNonce = useRef(0);
  const conversationContext = useRef<ConversationContext>({
    lastReferencedId: null,
    lastReferencedKind: null,
    lastReferencedLabel: null,
    lastReferencedCoords: null,
    previousReferencedId: null,
    previousReferencedCoords: null,
  });
  // ---- حالة إضافية للمساعد المركزي (بدون تخمين) ----
  const [painMarker, setPainMarker] = useState<{ x: number; y: number; view: 'front' | 'back' } | null>(null);
  const [lastAssistantAction, setLastAssistantAction] = useState<AssistantAction['type'] | null>(null);
  const [lastUserReference, setLastUserReference] = useState<string | null>(null);
  const [conversationState, setConversationState] = useState<AppState['conversationState']>('idle');
  // إشارة تركيز لشاشة سجل الألم (فتح آخر تسجيل / إنشاء ملخص للطبيب) قادمة من المساعد المركزي.
  const [historyFocus, setHistoryFocus] = useState<{ kind: 'last' | 'summary'; nonce: number } | null>(null);

  const { history, addRecord, importRecords, clearHistory: clearHistoryRecords } = usePainHistory();
  const { language, direction, setLanguage } = useLanguage();
  const { isDark, colors, toggleTheme } = useTheme();
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);

  // اعتراض زر الرجوع في Android واستخدام نفس stack الداخلي للتطبيق.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (screen === 'welcome' && navHistory.length === 0) return false;
      goBack();
      return true;
    });
    return () => subscription.remove();
  }, [screen, navHistory.length]);
  const quickLogAreas = [
    { id: 'neck-male-back-1', label: t('quickLog.neck') },
    { id: 'deltoids-male-back-1', label: t('quickLog.shoulder') },
    { id: 'lower-back-male-back-1', label: t('quickLog.lowerBack') },
    { id: 'chest-male-front-1', label: t('quickLog.chest') },
    { id: 'abs-male-front-1', label: t('quickLog.abdomen') },
  ];

  const selected = selectedMuscleData || (selectedId ? data.muscles[selectedId] : null);
  const group = selected ? data.groups[selected.group] : undefined;

  // السجل المحلي الآن عبر hook موحّد (usePainHistory) — تخزين محلي فقط عبر AsyncStorage، بلا خادم.

  // الانتقال إلى شاشة التفاصيل مع الاحتفاظ ببيانات العضلة المختارة
  const handleNavigateToDetails = (muscleData: Muscle) => {
    setSelectedMuscleData(muscleData);
    setSelectedId(muscleData.id);
    navigateTo('details');
  };

  // يفتح المنطقة التي اقترحها المساعد الذكي على خريطة الجسم (يعيد استخدام تدفّق التفاصيل).
  const openRegionFromAssistant = (regionId: string) => {
    const muscle = Object.values(data.muscles).find((entry) => entry.group === regionId);
    if (muscle) {
      handleNavigateToDetails(muscle);
      return;
    }
    setQuickRelief(false);
    navigateTo('body');
  };

  // يفتح العضو الداخلي الذي ذكره المساعد الذكي على خريطة الأعضاء مباشرة.
  const openOrganFromAssistant = (organId: string) => {
    setRequestedOrgan(organId);
    setQuickRelief(false);
    navigateTo('body');
  };

  const saveResults = () => {
    if (!selected) return;
    const triageStatus = getTriageStatus(intensity, redFlags);
    const urgent = triageStatus === 'urgent';
    addRecord({
      id: createLocalId('checkup'),
      partId: selected.id,
      intensity,
      painType,
      duration,
      note: note.trim(),
      medication: medication.trim(),
      triggers: triggers.trim(),
      sleepHours: sleepHours.trim() ? Number(sleepHours) : undefined,
      activity: activity.trim(),
      urgent,
      triageStatus,
      redFlags: [...redFlags],
      symptoms: [...symptoms],
      afterIntensity: afterIntensity.trim() ? Number(afterIntensity) : undefined,
      createdAt: new Date().toLocaleDateString('ar-EG'),
      createdAtIso: new Date().toISOString(),
    });
    navigateTo('results');
  };

  const saveQuickLog = (record: Checkup) => addRecord(record);

  const saveSelfCareResult = (result: { guideKey: string; pointId?: string; before: number; after: number }) => {
    addRecord({
      id: createLocalId('self-care'),
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
    });
  };

  const startOver = () => {
    setSelectedId(null);
    setSelectedMuscleData(null);
    setIntensity(4);
    setPainType('مستمر');
    setDuration('منذ أيام');
    setNote('');
    setMedication('');
    setTriggers('');
    setSleepHours('');
    setActivity('');
    setRedFlags([]);
    setSymptoms([]);
    setAfterIntensity('');
    navigateTo('body');
  };

  const clearHistory = () => {
    const clear = () => clearHistoryRecords();
    if (Platform.OS === 'web') {
      if (window.confirm('حذف كل تسجيلات الألم المحفوظة على هذا الجهاز؟ لا يمكن التراجع عن الحذف.')) clear();
      return;
    }
    Alert.alert('حذف السجل؟', 'سيتم حذف كل التسجيلات من هذا الجهاز. لا يمكن التراجع عن الحذف.', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'حذف السجل', style: 'destructive', onPress: clear },
    ]);
  };

  // ---------------------------------------------------------------------------
  // المساعد المركزي: إصدار أوامر تحكّم منظّمة لشاشة الخريطة (مع دمج التعديلات في أمر واحد).
  // ---------------------------------------------------------------------------
  const issueBodyControl = (patch: Partial<BodyControlCommand>) => {
    controlNonce.current += 1;
    const nonce = controlNonce.current;
    setBodyControl((prev) => ({ ...(prev ?? {}), ...patch, nonce }));
  };

  // استخراج المعرّف الأساسي من معرّف الكتالوج (organ:heart → heart، point:li4-hegu → li4-hegu).
  const stripPrefix = (id: string) => {
    const idx = id.indexOf(':');
    return idx >= 0 ? id.slice(idx + 1) : id;
  };

  // ---------------------------------------------------------------------------
  // المساعد المركزي: تنفيذ الإجراءات المنظّمة القادمة من المحرّك (لا تحكّم بنص عشوائي).
  // ---------------------------------------------------------------------------
  const handleAssistantAction = (action: AssistantAction) => {
    const targetId = action.targetId ?? '';
    setLastAssistantAction(action.type);
    if (targetId) setLastUserReference(targetId);
    switch (action.type) {
      case 'navigate': {
        const screenId = stripPrefix(targetId) as Screen;
        if (screenId === 'body') { setRequestedOrgan(null); setQuickRelief(false); }
        navigateTo(screenId);
        break;
      }
      case 'open_tab': {
        const tab = stripPrefix(targetId) as BodyControlCommand['tab'];
        issueBodyControl({ tab });
        break;
      }
      case 'set_view':
        issueBodyControl({ view: targetId === 'back' ? 'back' : 'front' });
        break;
      case 'set_sex':
        issueBodyControl({ sex: targetId === 'female' ? 'female' : 'male' });
        break;
      case 'highlight': {
        conversationContext.current.previousReferencedId = conversationContext.current.lastReferencedId;
        conversationContext.current.previousReferencedCoords = conversationContext.current.lastReferencedCoords;
        if (targetId.startsWith('organ:')) {
          const organId = stripPrefix(targetId);
          issueBodyControl({ organId, highlightId: organId });
          conversationContext.current.lastReferencedId = targetId;
        } else if (targetId.startsWith('point:')) {
          const pointId = stripPrefix(targetId);
          issueBodyControl({ pointId, highlightId: pointId });
          conversationContext.current.lastReferencedId = targetId;
        } else if (targetId.startsWith('region:')) {
          const parts = targetId.split(':');
          issueBodyControl({ highlightId: parts[1], view: parts[2] === 'back' ? 'back' : 'front' });
          conversationContext.current.lastReferencedId = targetId;
        } else {
          issueBodyControl({ highlightId: targetId });
          conversationContext.current.lastReferencedId = targetId;
        }
        conversationContext.current.lastReferencedKind = action.type === 'highlight' ? 'organ' : null;
        break;
      }
      case 'clear_highlight':
        issueBodyControl({ highlightId: '' });
        conversationContext.current.lastReferencedId = null;
        break;
      case 'select': {
        if (targetId.startsWith('organ:')) issueBodyControl({ organId: stripPrefix(targetId) });
        else if (targetId.startsWith('point:')) issueBodyControl({ pointId: stripPrefix(targetId) });
        else if (targetId.startsWith('region:')) issueBodyControl({ highlightId: targetId.split(':')[1] });
        conversationContext.current.lastReferencedId = targetId;
        break;
      }
      case 'show_details':
        if (targetId.startsWith('organ:')) issueBodyControl({ organId: stripPrefix(targetId), openDetails: true });
        break;
      case 'filter':
        issueBodyControl({ filter: String(action.value ?? '') });
        break;
      case 'search':
        issueBodyControl({ search: String(action.value ?? '') });
        break;
      case 'set_marker': {
        const raw = String(action.value ?? '');
        const [mx, my, mv] = raw.split(',');
        if (!Number.isNaN(Number(mx)) && !Number.isNaN(Number(my))) {
          setPainMarker({ x: Number(mx), y: Number(my), view: mv === 'back' ? 'back' : 'front' });
          issueBodyControl({ painMarker: { x: Number(mx), y: Number(my), view: mv === 'back' ? 'back' : 'front' } });
          conversationContext.current.lastReferencedCoords = { x: Number(mx), y: Number(my), view: mv === 'back' ? 'back' : 'front' };
          setConversationState('awaiting_location');
        }
        break;
      }
      case 'move_marker': {
        const raw = String(action.value ?? '');
        const [mx, my, mv] = raw.split(',');
        if (!Number.isNaN(Number(mx)) && !Number.isNaN(Number(my))) {
          setPainMarker({ x: Number(mx), y: Number(my), view: mv === 'back' ? 'back' : 'front' });
          issueBodyControl({ painMarker: { x: Number(mx), y: Number(my), view: mv === 'back' ? 'back' : 'front' } });
          conversationContext.current.lastReferencedCoords = { x: Number(mx), y: Number(my), view: mv === 'back' ? 'back' : 'front' };
        }
        break;
      }
      case 'open_last_entry':
        setHistoryFocus({ kind: 'last', nonce: Date.now() });
        navigateTo('history');
        break;
      case 'doctor_summary':
        setHistoryFocus({ kind: 'summary', nonce: Date.now() });
        navigateTo('history');
        break;
      case 'zoom':
        setZoomLevel((prev) => Math.max(0.5, Math.min(3, prev + Number(action.value ?? 0))));
        break;
      case 'set_severity': {
        const value = Number(action.value);
        if (!Number.isNaN(value)) setIntensity(Math.max(0, Math.min(10, value)));
        break;
      }
      case 'back':
        goBack();
        break;
      case 'save': {
        if (targetId === 'clear_history') { clearHistory(); break; }
        if (targetId === 'pain_entry') {
          const value = Number(action.value);
          if (!Number.isNaN(value)) setIntensity(value);
          if (selected) saveResults();
          else { setRequestedOrgan(null); setQuickRelief(false); navigateTo('body'); }
          break;
        }
        // حفظ التسجيل الحالي
        saveResults();
        break;
      }
      default:
        break;
    }
  };

  // ---------------------------------------------------------------------------
  // المساعد المركزي: بناء حالة التطبيق التي يراها المحرّك عند كل جولة.
  // ---------------------------------------------------------------------------
  const appState: AppState = useMemo(() => ({
    currentScreen: screen,
    currentTab: bodyState.tab,
    currentBodyView: bodyState.view,
    currentSex: bodyState.sex,
    selectedBodyRegion: bodyState.tab === 'muscles' ? (selected?.group ?? null) : null,
    selectedAnatomyStructure: bodyState.organId,
    selectedPoint: bodyState.pointId,
    selectedPainLocation: painMarker ? { x: painMarker.x, y: painMarker.y, view: painMarker.view } : null,
    painSeverity: selected ? intensity : null,
    symptoms,
    lastAssistantAction,
    lastUserReference,
    conversationState,
    zoomLevel,
    visibleStructures: [],
    conversationContext: conversationContext.current,
    language: language as Lang,
  }), [screen, bodyState, selected, intensity, symptoms, painMarker, lastAssistantAction, lastUserReference, conversationState, zoomLevel, language]);

  const getTitle = (): string => {
    const titles: Record<Screen, string> = {
      welcome: t('appName'),
      body: t('body'),
      details: t('screenTitles.details'),
      results: t('screenTitles.results'),
      history: t('historyTitle'),
      assistant: t('assistant.name'),
      healthInfo: t('nav.healthInfo'),
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
          onBack={goBack}
          rightAction={(
            <View style={styles.headerActions}>
              <LanguageSwitcher language={language} onChange={setLanguage} />
              <ThemeToggle dark={isDark} onPress={toggleTheme} />
            </View>
          )}
        />
      )}

      {screen === 'assistant' ? (
        <AssistantScreen
          language={language}
          direction={direction}
          onOpenRegion={openRegionFromAssistant}
          onOpenOrgan={openOrganFromAssistant}
          initialContext={assistantContext}
        />
      ) : screen === 'healthInfo' ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <HealthInfoScreen
            language={language}
            direction={direction}
            onOpenAssistant={(ctx) => {
              setAssistantContext(ctx);
              navigateTo('assistant');
            }}
          />
        </ScrollView>
      ) : (
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {screen === 'welcome' && (
          <WelcomeScreen
            onStart={() => { setRequestedOrgan(null); setQuickRelief(false); navigateTo('body'); }}
            onQuickRelief={() => { setRequestedOrgan(null); setQuickRelief(true); navigateTo('body'); }}
            language={language}
            direction={direction}
            history={history}
            onOpenHistory={() => navigateTo('history')}
            onOpenAssistant={() => { setAssistantContext(undefined); navigateTo('assistant'); }}
            quickAreas={quickLogAreas}
            onQuickSave={saveQuickLog}
          />
        )}

        {screen === 'body' && (
          <BodyPickerScreen
            onNavigateToDetails={handleNavigateToDetails}
            onSaveSelfCare={saveSelfCareResult}
            language={language}
            direction={direction}
            quickRelief={quickRelief}
            initialOrgan={requestedOrgan}
            control={bodyControl}
            onStateChange={setBodyState}
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
            medication={medication}
            setMedication={setMedication}
            triggers={triggers}
            setTriggers={setTriggers}
            sleepHours={sleepHours}
            setSleepHours={setSleepHours}
            activity={activity}
            setActivity={setActivity}
            redFlags={redFlags}
            setRedFlags={setRedFlags}
            symptoms={symptoms}
            setSymptoms={setSymptoms}
            afterIntensity={afterIntensity}
            setAfterIntensity={setAfterIntensity}
            onBack={goBack}
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
            onBack={goBack}
            onClear={clearHistory}
            onImport={importRecords}
            language={language}
            direction={direction}
            focus={historyFocus}
          />
        )}
      </ScrollView>
      )}
      {screen !== 'welcome' && (
        <Pressable
          onPress={goBack}
          accessibilityRole="button"
          style={[styles.internalBack, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Text style={[styles.internalBackText, { color: colors.primary }]}>{direction === 'rtl' ? '→' : '←'} {t('back')}</Text>
        </Pressable>
      )}
      <View style={[styles.bottomNav, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <NavItem icon="⌂" title={t('nav.home')} active={screen === 'welcome'} onPress={() => navigateTo('welcome')} colors={colors} />
        <NavItem icon="◎" title={t('nav.map')} active={screen === 'body' || screen === 'details' || screen === 'results'} onPress={() => { setRequestedOrgan(null); setQuickRelief(false); navigateTo('body'); }} colors={colors} />
        <NavItem icon="✦" title={t('nav.assistant')} active={screen === 'assistant'} onPress={() => { setAssistantContext(undefined); navigateTo('assistant'); }} colors={colors} />
        <NavItem icon="♡" title={t('nav.healthInfo')} active={screen === 'healthInfo'} onPress={() => navigateTo('healthInfo')} colors={colors} />
        <NavItem icon="◷" title={t('nav.history')} active={screen === 'history'} onPress={() => navigateTo('history')} colors={colors} />
      </View>

      {/* المساعد المركزي العائم — متاح في كل الشاشات ويتحكّم في التطبيق بأوامر منظّمة. */}
      <GlobalAssistant
        appState={appState}
        onAction={handleAssistantAction}
        language={language as Lang}
        direction={direction}
        bottomOffset={92}
      />
    </SafeAreaView>
  );
}

function NavItem({ icon, title, active, onPress, colors }: { icon: string; title: string; active: boolean; onPress: () => void; colors: typeof Colors }) {
  return <Pressable onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: active }} style={styles.navItem}>
    <View style={[styles.navPill, active && styles.navPillActive]}>
      {active ? <Gradient colors={Gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} /> : null}
      <Text style={[styles.navIcon, { color: active ? Palette.white : colors.textLight }]}>{icon}</Text>
    </View>
    <Text style={[styles.navLabel, { color: active ? colors.primaryDark : colors.textSecondary }]}>{title}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  content: {
    paddingBottom: 26,
  },
  internalBack: { alignSelf: 'center', minWidth: 104, borderRadius: Radii.pill, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 7, marginBottom: 6, alignItems: 'center' },
  internalBackText: { fontSize: 12, fontWeight: '900' },
  bottomNav: { flexDirection: 'row-reverse', justifyContent: 'space-around', alignItems: 'center', marginHorizontal: 14, marginBottom: Platform.OS === 'ios' ? 10 : 12, borderRadius: Radii.xl, borderWidth: 1, paddingVertical: 8, ...Elevation.lg },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  navPill: { width: 48, height: 30, borderRadius: Radii.pill, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  navPillActive: { ...Elevation.glowTeal },
  navIcon: { fontSize: 17, fontWeight: '900', lineHeight: 20 },
  navLabel: { fontSize: 10, fontWeight: '800' },
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

});
