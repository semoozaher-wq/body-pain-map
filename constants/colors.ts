// constants/colors.ts

export const Colors = {
  // الألوان الأساسية
  primary: '#0E7C86',
  primaryLight: '#E6F4F5',
  primaryDark: '#0A5C63',
  primaryMuted: '#A0D4D8',
  
  // الألوان الثانوية
  secondary: '#123B42',
  secondaryLight: '#1E5A63',
  
  // الخلفيات
  background: '#F8FAFC',
  backgroundAlt: '#F1F5F9',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  
  // النصوص
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  textLight: '#94A3B8',
  textInverse: '#FFFFFF',
  
  // الحالات
  success: '#059669',
  successLight: '#ECFDF5',
  warning: '#D97706',
  warningLight: '#FFFBEB',
  danger: '#DC2626',
  dangerLight: '#FEF2F2',
  info: '#2563EB',
  infoLight: '#EFF6FF',
  
  // الحدود والظلال
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  shadow: 'rgba(15, 23, 42, 0.08)',
  overlay: 'rgba(15, 23, 42, 0.5)',
  
  // الوضع الليلي
  dark: {
    background: '#0F172A',
    backgroundAlt: '#1E293B',
    surface: '#1E293B',
    surfaceElevated: '#334155',
    textPrimary: '#F1F5F9',
    textSecondary: '#94A3B8',
    textLight: '#64748B',
    border: '#334155',
    borderLight: '#1E293B',
  }
};

export type ColorScheme = typeof Colors;
