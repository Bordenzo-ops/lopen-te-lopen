// ─────────────────────────────────────────────
// Design Tokens — HalfMarathon Trainer
// ─────────────────────────────────────────────

export const palette = {
  // Brand: energiek oranje-rood
  primary: {
    50:  '#FFF4ED',
    100: '#FFE4CC',
    200: '#FFC494',
    300: '#FF9B5A',
    400: '#FF7430',
    500: '#F25011',  // main
    600: '#D93A08',
    700: '#B42B09',
    800: '#8F230F',
    900: '#742012',
  },
  // Accent: frisse groene zone-kleur
  green: {
    50:  '#F0FDF4',
    100: '#DCFCE7',
    200: '#BBF7D0',
    400: '#4ADE80',
    500: '#22C55E',
    600: '#16A34A',
    700: '#15803D',
  },
  // Hartslagzone-kleuren
  zone: {
    z1: '#60A5FA', // blauw  — herstel
    z2: '#34D399', // groen  — aeroob basis
    z3: '#FBBF24', // geel   — tempo
    z4: '#F97316', // oranje — drempel
    z5: '#EF4444', // rood   — max
  },
  // Neutrals
  neutral: {
    0:   '#FFFFFF',
    50:  '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
    950: '#0A0F1A',
  },
  // Semantisch
  success: '#22C55E',
  warning: '#FBBF24',
  error:   '#EF4444',
  info:    '#60A5FA',
};

export const colors = {
  // Backgrounds
  bgBase:       palette.neutral[950],
  bgSurface:    palette.neutral[900],
  bgCard:       palette.neutral[800],
  bgCardHover:  palette.neutral[700],
  bgOverlay:    'rgba(0,0,0,0.7)',

  // Text
  textPrimary:   palette.neutral[50],
  textSecondary: palette.neutral[400],
  textTertiary:  palette.neutral[500],
  textInverse:   palette.neutral[950],

  // Brand
  brandPrimary:  palette.primary[500],
  brandLight:    palette.primary[300],
  brandDark:     palette.primary[700],

  // Borders
  borderSubtle:  palette.neutral[800],
  borderDefault: palette.neutral[700],
  borderStrong:  palette.neutral[600],

  // Zones
  zone1: palette.zone.z1,
  zone2: palette.zone.z2,
  zone3: palette.zone.z3,
  zone4: palette.zone.z4,
  zone5: palette.zone.z5,

  // Semantic
  success: palette.success,
  warning: palette.warning,
  error:   palette.error,
  info:    palette.info,
};

// ── Typografie ────────────────────────────────
export const typography = {
  fontFamily: {
    sans:        'Inter_400Regular',
    sansMedium:  'Inter_500Medium',
    sansSemi:    'Inter_600SemiBold',
    sansBold:    'Inter_700Bold',
    display:     'Inter_800ExtraBold',
  },
  fontSize: {
    xs:    11,
    sm:    13,
    base:  15,
    md:    17,
    lg:    20,
    xl:    24,
    '2xl': 28,
    '3xl': 34,
    '4xl': 42,
    '5xl': 56,
  },
  lineHeight: {
    tight:   1.2,
    snug:    1.35,
    normal:  1.5,
    relaxed: 1.65,
  },
  letterSpacing: {
    tight:  -0.5,
    normal:  0,
    wide:    0.5,
    wider:   1,
    widest:  2,
  },
};

// ── Spacing (8pt grid) ────────────────────────
export const spacing = {
  0:    0,
  0.5:  4,
  1:    8,
  1.5: 12,
  2:   16,
  2.5: 20,
  3:   24,
  4:   32,
  5:   40,
  6:   48,
  8:   64,
  10:  80,
  12:  96,
};

// ── Border radius ─────────────────────────────
export const radius = {
  none:  0,
  sm:    6,
  md:    10,
  lg:    16,
  xl:    20,
  '2xl': 28,
  full:  9999,
};

// ── Shadows ───────────────────────────────────
export const shadows = {
  none: {},
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 10,
  },
};

// ── Animaties ─────────────────────────────────
export const animation = {
  duration: {
    instant:  100,
    fast:     200,
    normal:   300,
    slow:     500,
  },
  easing: {
    easeOut:    'ease-out',
    easeIn:     'ease-in',
    easeInOut:  'ease-in-out',
  },
};

export default { palette, colors, spacing, typography, radius, shadows, animation };
