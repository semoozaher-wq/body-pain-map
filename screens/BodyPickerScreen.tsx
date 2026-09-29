import React, { useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { BodySilhouette, type BodyView as MuscleMapView, type Gender, type GroupLabelOverrides } from 'react-native-body-parts-anatomy';
import rawAnatomyData from '../data/anatomyPainMap.json';
import hotspotsData from '../data/anatomyHotspots.json';
import organDetails from '../data/organDetails.json';
import { translate } from '../services/i18n';
import { AcupressurePanel } from '../components/AcupressurePanel';
import { IllustratedBodyMap } from '../components/IllustratedBodyMap';
import WebBodySilhouette from '../components/WebBodySilhouette';
import { NaturalReliefPanel } from '../components/NaturalReliefPanel';
import { MedicalLibraryTabsPanel } from '../components/MedicalLibraryTabsPanel';
import { DrugLookupPanel } from '../components/DrugLookupPanel';
import type { BodyView, Muscle } from '../types';
import { PainReliefPanel } from '../components/PainReliefPanel';
import cleanData from '../data/cleanData';
import { useMuscleSelection } from '../hooks/useMuscleSelection';
import type { BodyControlCommand, BodyScreenState, BodyTab } from '../services/appAssistant/types';
import {
  BODY_REGION_LABELS,
  getMuscleById,
  localizeRelatedCondition,
  type MuscleEntry,
} from '../services/medical/muscleMapping';

type PickerMuscle = Muscle & { labelEn?: string };
type Organ = (typeof organDetails)[keyof typeof organDetails];
type Hotspot = {
  id: string;
  label: string;
  x: number;
  y: number;
  view: 'front' | 'back';
  type: 'muscle' | 'organ';
  muscleId?: string;
  organId?: string;
  gender?: 'male' | 'female';
};
const anatomyData = cleanData as { muscles: Record<string, PickerMuscle> };
// Maps an anatomical fragment slug to its part number, for the web renderer's labels.
const partNumberForSlug = (slug: string) => anatomyData.muscles[slug]?.partNumber;
const hotspots = hotspotsData as unknown as Hotspot[];
const organs = organDetails as unknown as Record<string, Organ>;
// Female-illustration coordinates calibrated against the generated atlas; male coordinates remain in anatomyHotspots.json.
const femaleFrontAdjustments: Record<string, { x: number; y: number }> = {
  'hotspot-head-front': { x: 50, y: 10 }, 'hotspot-neck-front': { x: 50, y: 18 },
  'hotspot-chest-left-front': { x: 40, y: 27 }, 'hotspot-chest-right-front': { x: 60, y: 27 }, 'hotspot-abs-center-front': { x: 50, y: 36 },
  'hotspot-biceps-left-front': { x: 33, y: 31 }, 'hotspot-biceps-right-front': { x: 67, y: 31 },
  'hotspot-forearm-left-front': { x: 28, y: 41 }, 'hotspot-forearm-right-front': { x: 72, y: 41 },
  'hotspot-hand-left-front': { x: 24, y: 52 }, 'hotspot-hand-right-front': { x: 76, y: 52 },
  'hotspot-quad-left-front': { x: 41, y: 56 }, 'hotspot-quad-right-front': { x: 59, y: 56 },
  'hotspot-knee-left-front': { x: 42, y: 69 }, 'hotspot-knee-right-front': { x: 58, y: 69 },
  'hotspot-calf-left-front': { x: 41, y: 79 }, 'hotspot-calf-right-front': { x: 59, y: 79 },
  'hotspot-shoulder-left-front': { x: 38, y: 22 }, 'hotspot-shoulder-right-front': { x: 62, y: 22 },
  'hotspot-oblique-left-front': { x: 32, y: 40 }, 'hotspot-oblique-right-front': { x: 68, y: 40 },
};
const femaleOrganAdjustments: Record<string, { x: number; y: number }> = {
  'organ-thyroid': { x: 50, y: 19 }, 'organ-lungs': { x: 50, y: 28 }, 'organ-heart': { x: 51, y: 28 },
  'organ-liver': { x: 45, y: 35 }, 'organ-stomach': { x: 53, y: 36 }, 'organ-uterus': { x: 50, y: 48 },
  'organ-ovaries': { x: 44, y: 48 },
};
const groupLabels = Object.fromEntries(Object.entries((rawAnatomyData as { groups: Record<string, { labelAr: string }> }).groups).map(([key, group]) => [key, group.labelAr])) as GroupLabelOverrides;
type Selection =
  | { kind: 'muscle'; label: string; muscle: Muscle }
  | { kind: 'organ'; label: string; organ: Organ }
  | { kind: 'mapped'; label: string; entry: MuscleEntry };
type SelfCareResult = { guideKey: string; pointId?: string; before: number; after: number };

type BodyPickerScreenProps = {
  onNavigateToDetails: (muscle: Muscle) => void;
  onSaveSelfCare: (result: SelfCareResult) => void;
  language: 'ar' | 'en' | 'fr';
  direction: 'rtl' | 'ltr';
  quickRelief: boolean;
  /** عضو داخلي مطلوب فتحه تلقائيًا (قادم من المساعد الذكي). */
  initialOrgan?: string | null;
  /** أمر تحكّم منظّم قادم من المساعد المركزي (فتح تبويب/عرض/عضو/نقطة/إبراز...). */
  control?: BodyControlCommand | null;
  /** يُبلّغ المساعد بحالة الشاشة الحالية (للتفكير البصري والمكاني). */
  onStateChange?: (state: BodyScreenState) => void;
};

const quickGuides = ['neck', 'upper-back', 'lower-back', 'forearm'] as const;
const SELECTED_GENDER_KEY = '@bodymap_selected_anatomy_gender';
const translatedGroups: Record<'en' | 'fr', Record<string, string>> = {
  en: { abs: 'Abdomen', adductors: 'Inner thigh', ankles: 'Ankles', biceps: 'Biceps', calves: 'Calves', chest: 'Chest', deltoids: 'Shoulders', feet: 'Feet', forearm: 'Forearm', gluteal: 'Glutes', hair: 'Scalp', hamstring: 'Hamstrings', hands: 'Hands', head: 'Head', knees: 'Knees', 'lower-back': 'Lower back', neck: 'Neck', obliques: 'Side abdomen', quadriceps: 'Front thigh', tibialis: 'Shin', trapezius: 'Upper shoulder', triceps: 'Triceps', 'upper-back': 'Upper back' },
  fr: { abs: 'Abdomen', adductors: 'Adducteurs', ankles: 'Chevilles', biceps: 'Biceps', calves: 'Mollets', chest: 'Poitrine', deltoids: 'Épaules', feet: 'Pieds', forearm: 'Avant-bras', gluteal: 'Fessiers', hair: 'Cuir chevelu', hamstring: 'Ischio-jambiers', hands: 'Mains', head: 'Tête', knees: 'Genoux', 'lower-back': 'Bas du dos', neck: 'Cou', obliques: 'Côtés de l’abdomen', quadriceps: 'Avant de la cuisse', tibialis: 'Tibia', trapezius: 'Trapèze', triceps: 'Triceps', 'upper-back': 'Haut du dos' },
};
const localizedOrganNames: Record<'en' | 'fr', Record<string, string>> = {
  en: { heart: 'Heart', lungs: 'Lungs', stomach: 'Stomach', liver: 'Liver', kidneys: 'Kidneys', thyroid: 'Thyroid', uterus: 'Uterus', ovaries: 'Ovaries' },
  fr: { heart: 'Cœur', lungs: 'Poumons', stomach: 'Estomac', liver: 'Foie', kidneys: 'Reins', thyroid: 'Thyroïde', uterus: 'Utérus', ovaries: 'Ovaires' },
};

export const BodyPickerScreen: React.FC<BodyPickerScreenProps> = ({
  onNavigateToDetails,
  onSaveSelfCare,
  language,
  direction,
  quickRelief,
  initialOrgan,
  control,
  onStateChange,
}) => {
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const [activeView, setActiveView] = useState<Exclude<BodyView, 'organs'>>('front');
  const [gender, setGender] = useState<Gender>('male');
  const [genderLoaded, setGenderLoaded] = useState(false);
  // Multi-fragment selection for the detailed SVG map. The hook keeps the raw
  // path ids and resolves them into medical records + related conditions.
  const muscleSelection = useMuscleSelection({ onlyMapped: false });
  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState<Selection | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showOrganMode, setShowOrganMode] = useState(false);
  const [showAcupressureMode, setShowAcupressureMode] = useState(false);
  const [showNaturalReliefMode, setShowNaturalReliefMode] = useState(false);
  const [showMedicalLibraryMode, setShowMedicalLibraryMode] = useState(false);
  const [showDrugLookupMode, setShowDrugLookupMode] = useState(false);
  // On the web build the precise 317-part SVG map is the clearest, fully
  // interactive view, so it becomes the default there. Native keeps the
  // illustrated atlas first.
  const [bodyViewMode, setBodyViewMode] = useState<'illustration' | 'detailed'>(Platform.OS === 'web' ? 'detailed' : 'illustration');
  const [quickGuide, setQuickGuide] = useState<(typeof quickGuides)[number]>('neck');
  // عنصر مُبرَز بصريًا بأمر من المساعد المركزي (حلقة نابضة تبقى حتى يُطلب إزالتها).
  const [highlightId, setHighlightId] = useState<string | null>(null);
  // علامة الألم التي يضعها/يحرّكها المساعد المركزي على الخريطة.
  const [painMarker, setPainMarker] = useState<{ x: number; y: number; view: 'front' | 'back' } | null>(null);
  // معرّف العضو الداخلي المحدَّد حاليًا (للإبلاغ عن الحالة البصرية للمساعد).
  const [selectedOrganId, setSelectedOrganId] = useState<string | null>(null);
  const lastControlNonce = useRef<number>(-1);

  // التبويب الحالي مشتقًّا من أعلام الأوضاع (مصدر حقيقة واحد للحالة المُبلَّغة).
  const currentTab: BodyTab = showMedicalLibraryMode ? 'medicalLibrary' : showDrugLookupMode ? 'drugLookup' : showAcupressureMode ? 'acupressure' : showNaturalReliefMode ? 'naturalRelief' : showOrganMode ? 'organs' : 'muscles';

  const applyTab = (tab: BodyTab) => {
    setShowOrganMode(tab === 'organs');
    setShowAcupressureMode(tab === 'acupressure');
    setShowNaturalReliefMode(tab === 'naturalRelief');
    setShowMedicalLibraryMode(tab === 'medicalLibrary');
    setShowDrugLookupMode(tab === 'drugLookup');
  };

  // تنفيذ أمر تحكّم منظّم قادم من المساعد المركزي.
  useEffect(() => {
    if (!control || control.nonce === lastControlNonce.current) return;
    lastControlNonce.current = control.nonce;
    if (control.tab) applyTab(control.tab);
    if (control.view) setActiveView(control.view);
    if (control.sex) setGender(control.sex);
    if (control.highlightId !== undefined) setHighlightId(control.highlightId || null);
    if (control.pointId) setHighlightId(control.pointId);
    if (control.search !== undefined) setSearch(control.search);
    if (control.filter !== undefined) setSearch(control.filter);
    if (control.painMarker !== undefined) setPainMarker(control.painMarker);
    if (control.organId) {
      const spot = hotspots.find((item) => item.type === 'organ' && item.organId === control.organId);
      if (spot) {
        setShowOrganMode(true);
        setShowAcupressureMode(false);
        setShowNaturalReliefMode(false);
        setShowMedicalLibraryMode(false);
        setShowDrugLookupMode(false);
        setActiveView(spot.view);
        if (spot.gender) setGender(spot.gender);
        setHighlightId(control.highlightId ?? spot.id);
        setSelectedOrganId(control.organId);
        if (control.openDetails) {
          const organ = organs[control.organId];
          if (organ) { setSelectedItem({ kind: 'organ', label: spot.label, organ }); setShowDetails(true); }
        }
      }
    }
  }, [control]);

  // إبلاغ المساعد بحالة الشاشة (للتفكير البصري والمكاني: "هنا/ده/فوقها").
  useEffect(() => {
    onStateChange?.({ tab: currentTab, view: activeView as 'front' | 'back', sex: gender as 'male' | 'female', organId: selectedOrganId, pointId: null });
  }, [currentTab, activeView, gender, selectedOrganId, onStateChange]);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(SELECTED_GENDER_KEY).then((saved) => {
      if (active && (saved === 'male' || saved === 'female')) setGender(saved);
    }).catch(() => undefined).finally(() => { if (active) setGenderLoaded(true); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (genderLoaded) AsyncStorage.setItem(SELECTED_GENDER_KEY, gender).catch(() => undefined);
  }, [gender, genderLoaded]);

  // عند وصول المستخدم من المساعد الذكي بعضو داخلي محدّد: نفتح وضع الأعضاء ونختار العضو مباشرة.
  useEffect(() => {
    if (!initialOrgan) return;
    const spot = hotspots.find((item) => item.type === 'organ' && item.organId === initialOrgan);
    if (!spot) return;
    setShowOrganMode(true);
    setShowAcupressureMode(false);
    setShowNaturalReliefMode(false);
    setShowMedicalLibraryMode(false);
    setShowDrugLookupMode(false);
    setActiveView(spot.view);
    if (spot.gender) setGender(spot.gender);
    const organ = organs[initialOrgan];
    if (organ) {
      setSelectedOrganId(initialOrgan);
      setSelectedItem({ kind: 'organ', label: spot.label, organ });
      setShowDetails(true);
    }
  }, [initialOrgan]);

  const visibleHotspots = useMemo(
    () => hotspots.filter((hotspot) => hotspot.view === activeView && hotspot.type === 'organ' && (!hotspot.gender || hotspot.gender === gender)),
    [activeView, gender],
  );
  const visibleMuscleHotspots = useMemo(() => hotspots.filter((spot) => spot.view === activeView && spot.type === 'muscle').flatMap((spot) => {
    const groupKey = spot.muscleId?.split('-')[0];
    if (!groupKey) return [];
    const exactId = spot.muscleId?.replace(/-(male|female)-/, `-${gender}-`);
    const muscle = (exactId && anatomyData.muscles[exactId]) || Object.values(anatomyData.muscles).find((part) => part.group === groupKey && part.id.includes(`-${gender}-${activeView}-`));
    if (!muscle) return [];
    return [{ ...spot, muscleId: muscle.id, label: language === 'ar' ? muscle.groupLabelAr : translatedGroups[language][groupKey] ?? muscle.groupLabelAr }];
  }), [activeView, gender, language]);
  const matchingMuscles = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return Object.values(anatomyData.muscles).filter((muscle) => {
      if (!muscle.id.includes(`-${gender}-${activeView}-`)) return false;
      if (!query) return false;
      return `${muscle.partNumber} ${muscle.id} ${muscle.labelAr} ${muscle.labelEn ?? ''}`
        .toLocaleLowerCase()
        .includes(query);
    }).slice(0, 12);
  }, [activeView, gender, search]);

  // إبراز بصري للعضو المطلوب من المساعد المركزي (حلقة نابضة على الخريطة).
  const organHighlight = useMemo(() => {
    if (!highlightId) return null;
    const spot = visibleHotspots.find((item) => item.id === highlightId || item.organId === highlightId);
    if (!spot) return null;
    const point = gender === 'female' ? femaleOrganAdjustments[spot.id] : undefined;
    const label = language === 'ar' ? spot.label : localizedOrganNames[language][spot.organId ?? ''] ?? spot.label;
    return { id: spot.id, x: point?.x ?? spot.x, y: point?.y ?? spot.y, label };
  }, [highlightId, visibleHotspots, gender, language]);

  // إبراز بصري للمنطقة العضلية المطلوبة من المساعد المركزي.
  const muscleHighlight = useMemo(() => {
    if (!highlightId) return null;
    const spot = visibleMuscleHotspots.find((item) => item.id === highlightId || (item.muscleId ? item.muscleId.split('-')[0] === highlightId : false));
    if (!spot) return null;
    const point = gender === 'female' && activeView === 'front' ? femaleFrontAdjustments[spot.id] : undefined;
    return { id: spot.id, x: point?.x ?? spot.x, y: point?.y ?? spot.y, label: spot.label };
  }, [highlightId, visibleMuscleHotspots, gender, activeView]);

  const showMuscle = (muscle: Muscle) => {
    muscleSelection.selectMuscle(muscle.id);
    setSelectedItem({ kind: 'muscle', label: muscle.labelAr, muscle });
    setShowDetails(true);
  };

  // Pressing a fragment on the detailed SVG map. The web renderer emits the raw
  // SVG path id (e.g. "path2223"). We resolve it against the anatomy library
  // first, then fall back to the dedicated muscle mapping so every mapped
  // fragment still surfaces its clinical record and related conditions.
  const handleFragmentPress = (fragmentSlug: string) => {
    const muscle = anatomyData.muscles[fragmentSlug];
    if (muscle) {
      showMuscle(muscle);
      return;
    }
    const entry = getMuscleById(fragmentSlug);
    const wasSelected = muscleSelection.isSelected(fragmentSlug);
    muscleSelection.toggleMuscle(fragmentSlug);
    if (entry && !wasSelected) {
      setSelectedItem({ kind: 'mapped', label: entry.name, entry });
      setShowDetails(true);
    }
  };

  const handleHotspotPress = (hotspot: Hotspot) => {
    if (hotspot.type === 'organ' && hotspot.organId) {
      const organ = organs[hotspot.organId];
      if (organ) {
        setSelectedOrganId(hotspot.organId);
        setSelectedItem({ kind: 'organ', label: hotspot.label, organ });
        setShowDetails(true);
      }
    } else if (hotspot.muscleId) {
      const muscle = anatomyData.muscles[hotspot.muscleId];
      if (muscle) showMuscle(muscle);
    }
  };

  const dismissDetails = () => setShowDetails(false);

  return (
    <View style={styles.container}>
      {quickRelief ? (
        <View>
          <Text style={styles.heading}>{t('bodyPicker.quickCareTitle')}</Text>
          <Text style={styles.helper}>{t('bodyPicker.quickCareHint')}</Text>
          <View style={styles.chipRow}>
            {quickGuides.map((key) => (
              <Pressable
                key={key}
                onPress={() => setQuickGuide(key)}
                accessibilityRole="button"
                accessibilityState={{ selected: quickGuide === key }}
                style={[styles.chip, quickGuide === key && styles.activeChip]}
              >
                <Text style={[styles.chipText, quickGuide === key && styles.activeChipText]}>
                  {t(`bodyPicker.guide.${key}`)}
                </Text>
              </Pressable>
            ))}
          </View>
          <PainReliefPanel guideKey={quickGuide} onSaveResult={onSaveSelfCare} />
        </View>
      ) : (
        <>
          <View style={styles.modeToggle}>
            <ModeButton title={t('bodyPicker.muscles')} selected={!showOrganMode && !showAcupressureMode && !showNaturalReliefMode && !showMedicalLibraryMode && !showDrugLookupMode} onPress={() => { setShowOrganMode(false); setShowAcupressureMode(false); setShowNaturalReliefMode(false); setShowMedicalLibraryMode(false); setShowDrugLookupMode(false); }} />
            <ModeButton title={t('bodyPicker.organs')} selected={showOrganMode} onPress={() => { setShowOrganMode(true); setShowAcupressureMode(false); setShowNaturalReliefMode(false); setShowMedicalLibraryMode(false); setShowDrugLookupMode(false); }} />
            <ModeButton title={t('bodyPicker.acupressure')} selected={showAcupressureMode} onPress={() => { setShowOrganMode(false); setShowAcupressureMode(true); setShowNaturalReliefMode(false); setShowMedicalLibraryMode(false); setShowDrugLookupMode(false); }} />
            <ModeButton title={t('bodyPicker.naturalRelief')} selected={showNaturalReliefMode} onPress={() => { setShowOrganMode(false); setShowAcupressureMode(false); setShowNaturalReliefMode(true); setShowMedicalLibraryMode(false); setShowDrugLookupMode(false); }} />
            <ModeButton title={t('bodyPicker.medicalLibrary')} selected={showMedicalLibraryMode} onPress={() => { setShowOrganMode(false); setShowAcupressureMode(false); setShowNaturalReliefMode(false); setShowMedicalLibraryMode(true); setShowDrugLookupMode(false); }} />
            <ModeButton title={t('bodyPicker.drugLookup')} selected={showDrugLookupMode} onPress={() => { setShowOrganMode(false); setShowAcupressureMode(false); setShowNaturalReliefMode(false); setShowMedicalLibraryMode(false); setShowDrugLookupMode(true); }} />
          </View>

          {!showAcupressureMode && !showNaturalReliefMode && !showOrganMode && !showMedicalLibraryMode && !showDrugLookupMode && <View style={styles.toggleRow}>
            <Pressable style={[styles.toggleButton, bodyViewMode === 'illustration' && styles.activeToggle]} onPress={() => setBodyViewMode('illustration')} accessibilityRole="button" accessibilityState={{ selected: bodyViewMode === 'illustration' }}><Text style={[styles.toggleText, bodyViewMode === 'illustration' && styles.activeToggleText]}>{t('bodyPicker.visualImage')}</Text></Pressable>
            <Pressable style={[styles.toggleButton, bodyViewMode === 'detailed' && styles.activeToggle]} onPress={() => setBodyViewMode('detailed')} accessibilityRole="button" accessibilityState={{ selected: bodyViewMode === 'detailed' }}><Text style={[styles.toggleText, bodyViewMode === 'detailed' && styles.activeToggleText]}>{t('bodyPicker.detailMap')}</Text></Pressable>
          </View>}

          {!showAcupressureMode && !showNaturalReliefMode && !showMedicalLibraryMode && !showDrugLookupMode && <View style={styles.toggleRow}>
            <Pressable
              style={[styles.toggleButton, gender === 'male' && styles.activeToggle]}
              onPress={() => setGender('male')}
              accessibilityRole="button"
              accessibilityState={{ selected: gender === 'male' }}
            ><Text style={[styles.toggleText, gender === 'male' && styles.activeToggleText]}>{t('bodyPicker.male')}</Text></Pressable>
            <Pressable
              style={[styles.toggleButton, gender === 'female' && styles.activeToggle]}
              onPress={() => setGender('female')}
              accessibilityRole="button"
              accessibilityState={{ selected: gender === 'female' }}
            ><Text style={[styles.toggleText, gender === 'female' && styles.activeToggleText]}>{t('bodyPicker.female')}</Text></Pressable>
          </View>}

          {!showAcupressureMode && !showNaturalReliefMode && !showMedicalLibraryMode && !showDrugLookupMode && <View style={styles.toggleRow}>
            <Pressable
              style={[styles.toggleButton, activeView === 'front' && styles.activeToggle]}
              onPress={() => setActiveView('front')}
              accessibilityRole="button"
              accessibilityState={{ selected: activeView === 'front' }}
            ><Text style={[styles.toggleText, activeView === 'front' && styles.activeToggleText]}>{t('bodyPicker.front')}</Text></Pressable>
            <Pressable
              style={[styles.toggleButton, activeView === 'back' && styles.activeToggle]}
              onPress={() => setActiveView('back')}
              accessibilityRole="button"
              accessibilityState={{ selected: activeView === 'back' }}
            ><Text style={[styles.toggleText, activeView === 'back' && styles.activeToggleText]}>{t('bodyPicker.backView')}</Text></Pressable>
          </View>}

          {showMedicalLibraryMode ? <MedicalLibraryTabsPanel language={language} /> : showDrugLookupMode ? <DrugLookupPanel language={language} /> : showAcupressureMode ? <AcupressurePanel language={language} highlightId={highlightId} /> : showNaturalReliefMode ? <NaturalReliefPanel language={language} /> : showOrganMode ? (
            <>
              <Text style={styles.helper}>{t('bodyPicker.organHint')}</Text>
              <Text style={styles.organNotice}>{t('bodyPicker.organPainNotice')}</Text>
              <IllustratedBodyMap
                source={activeView === 'front' ? (gender === 'female' ? require('../assets/anatomy/internal-organs-atlas-female.png') : require('../assets/anatomy/internal-organs-atlas.png')) : (gender === 'female' ? require('../assets/anatomy/muscle-back-atlas-female.png') : require('../assets/anatomy/muscle-back-atlas.png'))}
                markers={visibleHotspots.flatMap((spot) => {
                  const point = gender === 'female' ? femaleOrganAdjustments[spot.id] : undefined;
                  const label = language === 'ar' ? spot.label : localizedOrganNames[language][spot.organId ?? ''] ?? spot.label;
                  const base = { id: spot.id, x: point?.x ?? spot.x, y: point?.y ?? spot.y, label };
                  return gender === 'female' && spot.id === 'organ-ovaries' ? [base, { ...base, id: 'organ-ovaries-right', x: 56, y: 48 }] : [base];
                })}
                language={language}
                title={t('bodyPicker.organs')}
                hint={t('bodyPicker.organImageHint')}
                onSelect={(marker) => { const markerId = marker.id === 'organ-ovaries-right' ? 'organ-ovaries' : marker.id; const spot = visibleHotspots.find((item) => item.id === markerId); if (spot) handleHotspotPress(spot); }}
                highlight={organHighlight}
                painMarker={painMarker && painMarker.view === activeView ? painMarker : null}
              />
            </>
          ) : (
            <>
              <Text style={styles.helper}>{t('bodyPicker.anatomyMapHint')}</Text>
              {bodyViewMode === 'illustration' ? <IllustratedBodyMap
                source={activeView === 'front'
                  ? (gender === 'female'
                    ? require('../assets/anatomy/muscle-front-atlas-female.png')
                    : require('../assets/anatomy/muscle-front-realistic.png'))
                  : (gender === 'female'
                    ? require('../assets/anatomy/muscle-back-atlas-female.png')
                    : require('../assets/anatomy/muscle-back-realistic.png'))}
                markers={visibleMuscleHotspots.map((spot) => { const point = gender === 'female' && activeView === 'front' ? femaleFrontAdjustments[spot.id] : undefined; return { id: spot.id, x: point?.x ?? spot.x, y: point?.y ?? spot.y, label: spot.label }; })}
                language={language}
                title={t('bodyPicker.title')}
                hint={t('bodyPicker.visualHintText')}
                onSelect={(marker) => { const spot = visibleMuscleHotspots.find((item) => item.id === marker.id); if (spot) handleHotspotPress(spot); }}
                highlight={muscleHighlight}
                painMarker={painMarker && painMarker.view === activeView ? painMarker : null}
              /> : Platform.OS === 'web' ? <WebBodySilhouette
                view={activeView}
                selectedSlugs={muscleSelection.selectedIds}
                onFragmentPress={handleFragmentPress}
                numberForSlug={partNumberForSlug}
              /> : <BodySilhouette
                gender={gender}
                view={activeView as MuscleMapView}
                selectedSlugs={muscleSelection.selectedIds}
                onFragmentPress={handleFragmentPress}
                accessibilityLabel={t('bodyPicker.mapAccessibilityLabel')}
                labels={groupLabels}
                hitTolerance={12}
                zoomable
              />}
              {muscleSelection.hasSelection ? (
                <View style={styles.selectionBar}>
                  <Text style={styles.selectionText}>
                    {t('bodyPicker.selectedArea')}: {muscleSelection.count}
                  </Text>
                  <Pressable style={styles.selectionClear} onPress={muscleSelection.clearSelection} accessibilityRole="button">
                    <Text style={styles.selectionClearText}>{t('bodyPicker.noData')}</Text>
                  </Pressable>
                </View>
              ) : null}
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder={t('bodyPicker.searchPlaceholder')}
                placeholderTextColor="#73838B"
                style={[styles.search, { textAlign: direction === 'rtl' ? 'right' : 'left' }]}
                accessibilityLabel={t('bodyPicker.searchLabel')}
                returnKeyType="search"
              />
              {search.trim() ? (
                <View style={styles.searchResults}>
                  {matchingMuscles.length ? matchingMuscles.map((muscle) => (
                    <Pressable
                      key={muscle.id}
                      onPress={() => showMuscle(muscle)}
                      style={styles.searchResult}
                      accessibilityRole="button"
                    >
                      <Text style={styles.resultTitle}>{muscle.labelAr}</Text>
                      <Text style={styles.resultMeta}>#{muscle.partNumber} · {muscle.locationAr}</Text>
                    </Pressable>
                  )) : <Text style={styles.emptyText}>{t('bodyPicker.noSearchResults')}</Text>}
                </View>
              ) : null}
            </>
          )}
        </>
      )}

      <Modal visible={showDetails} animationType="slide" transparent onRequestClose={dismissDetails}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedItem?.label ?? ''}</Text>
              <Pressable onPress={dismissDetails} accessibilityRole="button" accessibilityLabel={t('back')}>
                <Text style={styles.closeButton}>✕</Text>
              </Pressable>
            </View>
            <ScrollView style={styles.modalBody}>
              {selectedItem?.kind === 'organ' ? (
                <>
                  <Info title={t('bodyPicker.location')} text={selectedItem.organ.location} />
                  <Info title={t('bodyPicker.visualHint')} text={selectedItem.organ.visualHint} />
                  <Info title={t('bodyPicker.symptoms')} text={selectedItem.organ.symptoms.join(' • ')} />
                  <Info title={t('bodyPicker.causes')} text={selectedItem.organ.causes.join(' • ')} />
                  {selectedItem.organ.warning ? <Info title={t('bodyPicker.warning')} text={selectedItem.organ.warning} warning /> : null}
                  <Info title={t('bodyPicker.recommendation')} text={selectedItem.organ.recommendation} />
                </>
              ) : selectedItem?.kind === 'muscle' ? (
                <>
                  <Text style={styles.partBadge}>#{selectedItem.muscle.partNumber} · {selectedItem.muscle.locationAr}</Text>
                  <Info title={t('bodyPicker.causes')} text={selectedItem.muscle.commonCauses.join(' • ')} />
                  {selectedItem.muscle.warning ? <Info title={t('bodyPicker.warning')} text={selectedItem.muscle.warning} warning /> : null}
                  <Info title={t('bodyPicker.recommendation')} text={selectedItem.muscle.recommendation ?? t('bodyPicker.defaultRecommendation')} />
                  <Text style={styles.medicalNotice}>{selectedItem.muscle.medicalSafety}</Text>
                  <Pressable style={[styles.actionButton, styles.detailMapButton]} onPress={() => { setShowOrganMode(false); setBodyViewMode('detailed'); muscleSelection.selectMuscle(selectedItem.muscle.id); dismissDetails(); }} accessibilityRole="button"><Text style={styles.actionButtonText}>{t('bodyPicker.openExactParts')}</Text></Pressable>
                  <Pressable
                    style={styles.actionButton}
                    onPress={() => { dismissDetails(); onNavigateToDetails(selectedItem.muscle); }}
                    accessibilityRole="button"
                  ><Text style={styles.actionButtonText}>{t('bodyPicker.describePain')}</Text></Pressable>
                </>
              ) : selectedItem?.kind === 'mapped' ? (
                <>
                  <Text style={styles.partBadge}>{BODY_REGION_LABELS[selectedItem.entry.region][language === 'ar' ? 'ar' : 'en']} · {selectedItem.entry.muscleGroup}</Text>
                  <Info title={t('bodyPicker.medicalName')} text={selectedItem.entry.name} />
                  <Info title={t('bodyPicker.symptoms')} text={selectedItem.entry.relatedConditions.map((condition) => localizeRelatedCondition(condition, language)).join(' • ')} />
                  <Info title={t('bodyPicker.recommendation')} text={t('bodyPicker.defaultRecommendation')} />
                </>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

function ModeButton({ title, selected, onPress }: { title: string; selected: boolean; onPress: () => void }) {
  return <Pressable style={[styles.modeButton, selected && styles.modeActive]} onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }}><Text style={[styles.modeText, selected && styles.modeTextActive]}>{title}</Text></Pressable>;
}

function Info({ title, text, warning = false }: { title: string; text: string; warning?: boolean }) {
  return <View style={[styles.infoCard, warning && styles.warningCard]}><Text style={[styles.infoLabel, warning && styles.warningLabel]}>{title}</Text><Text style={[styles.infoText, warning && styles.warningText]}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  heading: { color: '#123B42', fontSize: 20, fontWeight: '900', textAlign: 'right', marginBottom: 6 },
  modeToggle: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 12 },
  modeButton: { flexGrow: 1, flexBasis: '45%', borderRadius: 10, borderWidth: 1, borderColor: '#CCD9DC', backgroundColor: '#FFF', padding: 11, alignItems: 'center' },
  modeActive: { backgroundColor: '#0E6972', borderColor: '#0E6972' },
  modeText: { color: '#40545B', fontWeight: '700' },
  modeTextActive: { color: '#FFF' },
  toggleRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  toggleButton: { flex: 1, borderRadius: 10, borderWidth: 1, borderColor: '#CCD9DC', backgroundColor: '#FFF', padding: 10, alignItems: 'center' },
  activeToggle: { backgroundColor: '#176F79', borderColor: '#176F79' },
  toggleText: { color: '#40545B', fontWeight: '700' },
  activeToggleText: { color: '#FFF' },
  helper: { color: '#586E75', textAlign: 'right', lineHeight: 21, marginVertical: 8, fontSize: 12 },
  organNotice: { color: '#764A00', backgroundColor: '#FFF6E5', borderRadius: 10, padding: 10, lineHeight: 19, textAlign: 'right', fontSize: 12, marginBottom: 9 },
  imageContainer: { width: '100%', aspectRatio: 0.55, backgroundColor: '#FFF', borderRadius: 16, overflow: 'hidden', position: 'relative', marginBottom: 14 },
  bodyImage: { width: '100%', height: '100%' },
  organHotspot: { position: 'absolute', width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginLeft: -24, marginTop: -24 },
  organDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#C23434', borderWidth: 2, borderColor: '#FFF' },
  hotspotLabel: { position: 'absolute', top: -18, fontSize: 9, fontWeight: 'bold', color: '#1F2937', backgroundColor: '#FFFFFFE8', paddingHorizontal: 4, borderRadius: 4 },
  selectionBar: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#EAF4F5', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginTop: 12 },
  selectionText: { color: '#0E6972', fontWeight: '800', fontSize: 12 },
  selectionClear: { backgroundColor: '#0E6972', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  selectionClearText: { color: '#FFF', fontWeight: '800', fontSize: 11 },
  search: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#CCD9DC', borderRadius: 11, padding: 12, marginTop: 12, color: '#203745' },
  searchResults: { marginTop: 8, gap: 7 },
  searchResult: { borderWidth: 1, borderColor: '#D9E7EA', borderRadius: 10, backgroundColor: '#FFF', padding: 11 },
  resultTitle: { color: '#173D48', textAlign: 'right', fontWeight: '800' },
  resultMeta: { color: '#657781', textAlign: 'right', fontSize: 11, marginTop: 3 },
  emptyText: { color: '#657781', textAlign: 'center', padding: 12 },
  chipRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 7, marginVertical: 8 },
  chip: { borderWidth: 1, borderColor: '#BDD0D4', borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#FFF' },
  activeChip: { backgroundColor: '#0E6972', borderColor: '#0E6972' },
  chipText: { color: '#38535B', fontSize: 12, fontWeight: '700' },
  activeChipText: { color: '#FFF' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%', paddingBottom: 20 },
  modalHeader: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', padding: 18, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  modalTitle: { flex: 1, color: '#123B42', textAlign: 'right', fontSize: 18, fontWeight: '900' },
  closeButton: { color: '#64757B', fontSize: 24, paddingHorizontal: 8 },
  modalBody: { padding: 18 },
  partBadge: { color: '#0E6972', textAlign: 'right', fontWeight: '900', marginBottom: 10 },
  infoCard: { backgroundColor: '#F7FAFB', borderWidth: 1, borderColor: '#E1E9EB', borderRadius: 12, padding: 13, marginBottom: 10 },
  infoLabel: { color: '#0E6972', textAlign: 'right', fontWeight: '900', marginBottom: 5 },
  infoText: { color: '#405A62', textAlign: 'right', lineHeight: 22 },
  warningCard: { backgroundColor: '#FFF4F2', borderColor: '#F2C3BC' },
  warningLabel: { color: '#993E35' },
  warningText: { color: '#823E37' },
  medicalNotice: { color: '#657781', textAlign: 'center', fontSize: 11, lineHeight: 18, marginBottom: 8 },
  actionButton: { backgroundColor: '#176F79', borderRadius: 11, padding: 13, alignItems: 'center', marginTop: 4 },
  detailMapButton: { backgroundColor: '#28556A' },
  actionButtonText: { color: '#FFF', fontWeight: '900' },
});
