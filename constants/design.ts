// constants/design.ts
// نظام التصميم العالمي لتطبيق BodyMap Pain
// لوحة ألوان بريميوم + تدرجات + ظلال متعددة الطبقات + مقياس طباعة

export const Palette = {
  // ── الحبر العميق (أسطح داكنة / الهيرو) ──
  ink900: '#06161F',
  ink800: '#0A2230',
  ink700: '#0E2E3E',
  ink600: '#123A4C',
  ink500: '#1B4C60',

  // ── هوية التركواز (العلامة) ──
  teal900: '#06343D',
  teal800: '#0A4A55',
  teal700: '#0E6972',
  teal600: '#0E7C86',
  teal500: '#14A3A8',
  teal400: '#22C7C4',
  teal300: '#5EEAD4',
  teal200: '#A7F3E9',
  teal100: '#E6F7F5',
  teal50: '#F1FBFA',

  // ── ألوان مميزة ──
  cyan: '#22D3EE',
  mint: '#5EEAD4',
  amber: '#F59E0B',
  amberSoft: '#FEF3C7',
  coral: '#FB7185',
  rose: '#F43F5E',
  violet: '#8B5CF6',

  // ── محايدات ──
  white: '#FFFFFF',
  slate50: '#F8FAFC',
  slate100: '#F1F5F9',
  slate200: '#E2E8F0',
  slate300: '#CBD5E1',
  slate400: '#94A3B8',
  slate500: '#64748B',
  slate600: '#475569',
  slate700: '#334155',
  slate800: '#1E293B',
  slate900: '#0F172A',
};

// تدرجات لونية جاهزة (تُستخدم مع مكوّن Gradient)
export const Gradients = {
  hero: ['#06343D', '#0E6972', '#14A3A8'],
  heroDeep: ['#06161F', '#0A4A55', '#0E7C86'],
  brand: ['#0E7C86', '#14A3A8'],
  brandSoft: ['#14A3A8', '#5EEAD4'],
  mint: ['#14A3A8', '#5EEAD4'],
  cyan: ['#0E7C86', '#22D3EE'],
  warm: ['#F59E0B', '#FB7185'],
  violet: ['#0E6972', '#8B5CF6'],
  surface: ['#FFFFFF', '#F1FBFA'],
  glass: ['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.04)'],
  glassDark: ['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.02)'],
};

// أنصاف الأقطار
export const Radii = {
  xs: 8,
  sm: 10,
  md: 14,
  lg: 20,
  xl: 26,
  xxl: 34,
  pill: 999,
};

// ظلال متعددة الطبقات (ناعمة وعصرية)
export const Elevation = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  xs: {
    shadowColor: '#0A2230',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  sm: {
    shadowColor: '#0A2230',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  md: {
    shadowColor: '#0A2230',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 18,
    elevation: 4,
  },
  lg: {
    shadowColor: '#0A2230',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.14,
    shadowRadius: 30,
    elevation: 8,
  },
  xl: {
    shadowColor: '#06343D',
    shadowOffset: { width: 0, height: 22 },
    shadowOpacity: 0.22,
    shadowRadius: 44,
    elevation: 14,
  },
  // توهّج ملوّن (glow) للعناصر الرئيسية
  glowTeal: {
    shadowColor: '#14A3A8',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 22,
    elevation: 10,
  },
  glowAmber: {
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 9,
  },
};

// مقياس الطباعة
export const Type = {
  display: 40,
  h1: 30,
  h2: 24,
  h3: 20,
  title: 17,
  body: 15,
  bodySm: 13,
  caption: 12,
  micro: 10.5,
  line: { tight: 1.15, snug: 1.35, normal: 1.5, relaxed: 1.7 },
  weight: { regular: '400', medium: '600', bold: '700', black: '900' } as const,
  tracking: { tight: -0.4, normal: 0, wide: 0.6, wider: 1.4 },
};

export const Design = { Palette, Gradients, Radii, Elevation, Type };
export default Design;
