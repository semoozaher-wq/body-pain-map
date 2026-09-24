import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useMuscleMedicalData, Gender, Language } from '../hooks/useMuscleMedicalData';

interface Props {
  svgId: string | null;
  gender?: Gender;
  language?: Language;
  onClose?: () => void;
}

const PANEL_TEXTS = {
  ar: {
    commonCauses: 'الأسباب الشائعة',
    warning: 'علامة تحذير',
    recommendation: 'التوصية',
    doctor: 'يُنصح بمراجعة الطبيب',
    noData: 'لا توجد بيانات طبية لهذه المنطقة',
    medicalSafety: 'تنبيه طبي',
  },
  en: {
    commonCauses: 'Common Causes',
    warning: 'Warning Sign',
    recommendation: 'Recommendation',
    doctor: 'Doctor consultation recommended',
    noData: 'No medical data for this area',
    medicalSafety: 'Medical Notice',
  },
  fr: {
    commonCauses: 'Causes courantes',
    warning: "Signe d'alerte",
    recommendation: 'Recommandation',
    doctor: 'Consultation médicale recommandée',
    noData: 'Aucune donnée médicale pour cette zone',
    medicalSafety: 'Avis médical',
  },
};

export const MuscleInfoPanel: React.FC<Props> = ({
  svgId,
  gender = 'male',
  language = 'ar',
  onClose,
}) => {
  const data = useMuscleMedicalData(svgId, gender, language);
  const t = PANEL_TEXTS[language];

  // ============ حالة عدم وجود بيانات ============
  if (!data) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>{t.noData}</Text>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // ============ العرض الرئيسي ============
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      {/* رأس اللوحة */}
      <View style={styles.header}>
        <View style={styles.headerTextContainer}>
          <Text style={styles.title}>{data.name}</Text>
          <View style={styles.badgesRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{data.groupLabel}</Text>
            </View>
            <View style={[styles.badge, styles.sideBadge]}>
              <Text style={styles.badgeText}>
                {data.side === 'left'
                  ? language === 'ar'
                    ? 'يسار'
                    : 'Left'
                  : data.side === 'right'
                  ? language === 'ar'
                    ? 'يمين'
                    : 'Right'
                  : language === 'ar'
                  ? 'وسط'
                  : 'Center'}
              </Text>
            </View>
          </View>
        </View>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* تحذير الطبيب */}
      {data.requiresDoctor && (
        <View style={styles.doctorWarning}>
          <Text style={styles.doctorWarningIcon}>⚠️</Text>
          <Text style={styles.doctorWarningText}>{t.doctor}</Text>
        </View>
      )}

      {/* الأسباب الشائعة */}
      {data.commonCauses && data.commonCauses.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.commonCauses}</Text>
          {data.commonCauses.map((cause, idx) => (
            <View key={idx} style={styles.bulletRow}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.bulletText}>{cause}</Text>
            </View>
          ))}
        </View>
      )}

      {/* التحذير */}
      {data.warning && (
        <View style={[styles.section, styles.warningSection]}>
          <Text style={styles.warningTitle}>🚨 {t.warning}</Text>
          <Text style={styles.warningText}>{data.warning}</Text>
        </View>
      )}

      {/* التوصية */}
      {data.recommendation && (
        <View style={[styles.section, styles.recommendationSection]}>
          <Text style={styles.recommendationTitle}>💡 {t.recommendation}</Text>
          <Text style={styles.recommendationText}>{data.recommendation}</Text>
        </View>
      )}

      {/* التنبيه الطبي */}
      {data.medicalSafety && (
        <View style={styles.safetyNote}>
          <Text style={styles.safetyNoteText}>
            ℹ️ {t.medicalSafety}: {data.medicalSafety}
          </Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    margin: 16,
  },
  emptyText: {
    fontSize: 15,
    color: '#6C757D',
    textAlign: 'center',
  },

  // ============ Header ============
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  headerTextContainer: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#212529',
    textAlign: 'right',
    marginBottom: 8,
  },
  badgesRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    flexWrap: 'wrap',
  },
  badge: {
    backgroundColor: '#E7F1FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  sideBadge: {
    backgroundColor: '#FFF3CD',
  },
  badgeText: {
    fontSize: 12,
    color: '#495057',
    fontWeight: '600',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F3F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  closeButtonText: {
    fontSize: 16,
    color: '#495057',
    fontWeight: 'bold',
  },

  // ============ Doctor Warning ============
  doctorWarning: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#FFF5F5',
    borderLeftWidth: 4,
    borderLeftColor: '#D32F2F',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  doctorWarningIcon: {
    fontSize: 18,
  },
  doctorWarningText: {
    flex: 1,
    fontSize: 14,
    color: '#D32F2F',
    fontWeight: '600',
    textAlign: 'right',
  },

  // ============ Sections ============
  section: {
    marginBottom: 16,
    backgroundColor: '#F8F9FA',
    padding: 14,
    borderRadius: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 10,
    textAlign: 'right',
  },
  bulletRow: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    marginBottom: 6,
    gap: 8,
  },
  bullet: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: 'bold',
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    color: '#495057',
    textAlign: 'right',
    lineHeight: 20,
  },

  // ============ Warning Section ============
  warningSection: {
    backgroundColor: '#FFF5F5',
    borderLeftWidth: 4,
    borderLeftColor: '#D32F2F',
  },
  warningTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#D32F2F',
    marginBottom: 8,
    textAlign: 'right',
  },
  warningText: {
    fontSize: 14,
    color: '#C62828',
    textAlign: 'right',
    lineHeight: 20,
  },

  // ============ Recommendation ============
  recommendationSection: {
    backgroundColor: '#F0F8FF',
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  recommendationTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0056B3',
    marginBottom: 8,
    textAlign: 'right',
  },
  recommendationText: {
    fontSize: 14,
    color: '#0D47A1',
    textAlign: 'right',
    lineHeight: 20,
  },

  // ============ Safety Note ============
  safetyNote: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#F1F3F5',
    borderRadius: 8,
  },
  safetyNoteText: {
    fontSize: 12,
    color: '#6C757D',
    textAlign: 'right',
    lineHeight: 18,
    fontStyle: 'italic',
  },
});
