import React, { useMemo, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { BodySilhouette, type BodyView, type Gender, type GroupLabelOverrides } from 'react-native-body-parts-anatomy';
import rawAnatomyData from '../data/anatomyPainMap.json';
import hotspotsData from '../data/anatomyHotspots.json';
import organDetails from '../data/organDetails.json';
import { translate } from '../services/i18n';
import type { Muscle } from '../types';
import { PainReliefPanel } from '../components/PainReliefPanel';
import cleanData from '../data/cleanData';

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
};
const anatomyData = cleanData as { muscles: Record<string, PickerMuscle> };
const hotspots = hotspotsData as unknown as Hotspot[];
const organs = organDetails as unknown as Record<string, Organ>;
const groupLabels = Object.fromEntries(Object.entries((rawAnatomyData as { groups: Record<string, { labelAr: string }> }).groups).map(([key, group]) => [key, group.labelAr])) as GroupLabelOverrides;
type Selection =
  | { kind: 'muscle'; label: string; muscle: Muscle }
  | { kind: 'organ'; label: string; organ: Organ };
type SelfCareResult = { guideKey: string; pointId?: string; before: number; after: number };

type BodyPickerScreenProps = {
  onNavigateToDetails: (muscle: Muscle) => void;
  onSaveSelfCare: (result: SelfCareResult) => void;
  language: 'ar' | 'en' | 'fr';
  direction: 'rtl' | 'ltr';
  quickRelief: boolean;
};

const quickGuides = ['neck', 'upper-back', 'lower-back', 'forearm'] as const;

export const BodyPickerScreen: React.FC<BodyPickerScreenProps> = ({
  onNavigateToDetails,
  onSaveSelfCare,
  language,
  direction,
  quickRelief,
}) => {
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const [activeView, setActiveView] = useState<BodyView>('front');
  const [gender, setGender] = useState<Gender>('male');
  const [selectedMuscleId, setSelectedMuscleId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState<Selection | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showOrganMode, setShowOrganMode] = useState(false);
  const [quickGuide, setQuickGuide] = useState<(typeof quickGuides)[number]>('neck');

  const visibleHotspots = useMemo(
    () => hotspots.filter((hotspot) => hotspot.view === activeView && hotspot.type === 'organ'),
    [activeView],
  );
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

  const showMuscle = (muscle: Muscle) => {
    setSelectedMuscleId(muscle.id);
    setSelectedItem({ kind: 'muscle', label: muscle.labelAr, muscle });
    setShowDetails(true);
  };

  const handleFragmentPress = (fragmentSlug: string) => {
    const muscle = anatomyData.muscles[fragmentSlug];
    if (muscle) showMuscle(muscle);
  };

  const handleHotspotPress = (hotspot: Hotspot) => {
    if (hotspot.type === 'organ' && hotspot.organId) {
      const organ = organs[hotspot.organId];
      if (organ) {
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
            <Pressable
              style={[styles.modeButton, !showOrganMode && styles.modeActive]}
              onPress={() => setShowOrganMode(false)}
              accessibilityRole="button"
              accessibilityState={{ selected: !showOrganMode }}
            >
              <Text style={[styles.modeText, !showOrganMode && styles.modeTextActive]}>{t('bodyPicker.muscles')}</Text>
            </Pressable>
            <Pressable
              style={[styles.modeButton, showOrganMode && styles.modeActive]}
              onPress={() => setShowOrganMode(true)}
              accessibilityRole="button"
              accessibilityState={{ selected: showOrganMode }}
            >
              <Text style={[styles.modeText, showOrganMode && styles.modeTextActive]}>{t('bodyPicker.organs')}</Text>
            </Pressable>
          </View>

          <View style={styles.toggleRow}>
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
          </View>

          <View style={styles.toggleRow}>
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
          </View>

          {showOrganMode ? (
            <>
              <Text style={styles.helper}>{t('bodyPicker.organHint')}</Text>
              <View style={styles.imageContainer}>
                <Image
                  source={activeView === 'front'
                    ? require('../assets/anatomy/muscle-front-realistic.png')
                    : require('../assets/anatomy/muscle-back-realistic.png')}
                  style={styles.bodyImage}
                  resizeMode="contain"
                  accessibilityLabel={t('bodyPicker.bodyImageLabel')}
                />
                {visibleHotspots.map((spot) => (
                  <Pressable
                    key={spot.id}
                    style={[styles.organHotspot, { left: `${spot.x}%`, top: `${spot.y}%` }]}
                    onPress={() => handleHotspotPress(spot)}
                    accessibilityRole="button"
                    accessibilityLabel={spot.label}
                  >
                    <View style={styles.organDot} />
                    <Text style={styles.hotspotLabel}>{spot.label}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : (
            <>
              <Text style={styles.helper}>{t('bodyPicker.anatomyMapHint')}</Text>
              <BodySilhouette
                gender={gender}
                view={activeView}
                selectedSlugs={selectedMuscleId ? [selectedMuscleId] : []}
                onFragmentPress={handleFragmentPress}
                accessibilityLabel={t('bodyPicker.mapAccessibilityLabel')}
                labels={groupLabels}
                hitTolerance={12}
                zoomable
              />
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
                  <Pressable
                    style={styles.actionButton}
                    onPress={() => { dismissDetails(); onNavigateToDetails(selectedItem.muscle); }}
                    accessibilityRole="button"
                  ><Text style={styles.actionButtonText}>{t('bodyPicker.describePain')}</Text></Pressable>
                </>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

function Info({ title, text, warning = false }: { title: string; text: string; warning?: boolean }) {
  return <View style={[styles.infoCard, warning && styles.warningCard]}><Text style={[styles.infoLabel, warning && styles.warningLabel]}>{title}</Text><Text style={[styles.infoText, warning && styles.warningText]}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  heading: { color: '#123B42', fontSize: 20, fontWeight: '900', textAlign: 'right', marginBottom: 6 },
  modeToggle: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  modeButton: { flex: 1, borderRadius: 10, borderWidth: 1, borderColor: '#CCD9DC', backgroundColor: '#FFF', padding: 11, alignItems: 'center' },
  modeActive: { backgroundColor: '#0E6972', borderColor: '#0E6972' },
  modeText: { color: '#40545B', fontWeight: '700' },
  modeTextActive: { color: '#FFF' },
  toggleRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  toggleButton: { flex: 1, borderRadius: 10, borderWidth: 1, borderColor: '#CCD9DC', backgroundColor: '#FFF', padding: 10, alignItems: 'center' },
  activeToggle: { backgroundColor: '#176F79', borderColor: '#176F79' },
  toggleText: { color: '#40545B', fontWeight: '700' },
  activeToggleText: { color: '#FFF' },
  helper: { color: '#586E75', textAlign: 'right', lineHeight: 21, marginVertical: 8, fontSize: 12 },
  imageContainer: { width: '100%', aspectRatio: 0.55, backgroundColor: '#FFF', borderRadius: 16, overflow: 'hidden', position: 'relative', marginBottom: 14 },
  bodyImage: { width: '100%', height: '100%' },
  organHotspot: { position: 'absolute', width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginLeft: -24, marginTop: -24 },
  organDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#C23434', borderWidth: 2, borderColor: '#FFF' },
  hotspotLabel: { position: 'absolute', top: -18, fontSize: 9, fontWeight: 'bold', color: '#1F2937', backgroundColor: '#FFFFFFE8', paddingHorizontal: 4, borderRadius: 4 },
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
  actionButtonText: { color: '#FFF', fontWeight: '900' },
});
