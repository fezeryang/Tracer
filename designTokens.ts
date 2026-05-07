export const theme = {
  colors: {
    // Existing - keep for backward compatibility
    appBg: '#07111F',
    shellBg: '#081423',
    cardBg: '#0F1E33',
    cardAltBg: '#0B1A2D',

    // Updated accent colors (more professional blue)
    accent: '#2563EB',  // Updated from #2F6BFF
    accentSoft: '#3B82F6',  // Updated from #4C8DFF

    // Updated semantic colors
    up: '#22C55E',  // Updated from #1FD18A
    down: '#EF4444',  // Updated from #FF5C7A
    warn: '#F59E0B',  // Updated from #F3B63F

    // Updated text colors
    textPrimary: '#F8FAFC',  // Updated from #F4F7FB
    textSecondary: '#CBD5E1',  // Updated from #A8B3C7
    textMuted: '#64748B',  // Updated from #74819A

    borderSubtle: 'rgba(255,255,255,0.06)',
    borderStrong: 'rgba(148,163,184,0.14)',  // NEW
    accentBg: 'rgba(37,99,235,0.12)',  // NEW: accent background with opacity
    accentBgSoft: 'rgba(59,130,246,0.14)',  // NEW: accentSoft background with opacity
    accentFillStart: 'rgba(59,130,246,0.45)',  // NEW: for gradient fills

    shadowCard: '0 18px 40px rgba(0,0,0,0.28)',
    shadowGlow: '0 0 0 1px rgba(37,99,235,0.08), 0 10px 30px rgba(37,99,235,0.08)',  // Updated accent color

    // NEW: Structured color layers
    background: {
      deepest: '#050B14',
      primary: '#07111F',
      secondary: '#0A1628',
      elevated: '#0D1B2F',
    },
    card: {
      bg: '#0F1E33',
      bgAlt: '#111C2E',
      border: 'rgba(255,255,255,0.06)',
      borderStrong: 'rgba(148,163,184,0.14)',
    },
    semantic: {
      up: '#22C55E',
      down: '#EF4444',
      warn: '#F59E0B',
    },
  },
  radius: {
    panel: '24px',
    card: '20px',
    control: '14px',
    cardSmall: '16px',
    cardTiny: '12px',
  },
  spacing: {
    section: 'clamp(4rem, 3rem + 5vw, 10rem)',
    cardGap: '1.25rem',
    innerPadding: '1.5rem',
  },
  typography: {
    // Display
    displayLg: { fontSize: 'clamp(1.75rem, 1rem + 4vw, 2.5rem)', fontWeight: 600, lineHeight: 1.2, letterSpacing: '-0.02em' },
    displayMd: { fontSize: 'clamp(1.5rem, 0.8rem + 3vw, 2rem)', fontWeight: 600, lineHeight: 1.25 },
    displaySm: { fontSize: '1.5rem', fontWeight: 600, lineHeight: 1.3 },

    // Headings
    headingXl: { fontSize: '1.25rem', fontWeight: 600, lineHeight: 1.4 },
    headingLg: { fontSize: '1.125rem', fontWeight: 600, lineHeight: 1.4 },
    headingMd: { fontSize: '1rem', fontWeight: 500, lineHeight: 1.5 },
    headingSm: { fontSize: '0.875rem', fontWeight: 500, lineHeight: 1.5 },

    // Body
    bodyLg: { fontSize: '1rem', fontWeight: 400, lineHeight: 1.7 },
    bodyMd: { fontSize: '0.9375rem', fontWeight: 400, lineHeight: 1.6 },
    bodySm: { fontSize: '0.875rem', fontWeight: 400, lineHeight: 1.6 },

    // Caption
    caption: { fontSize: '0.75rem', fontWeight: 500, lineHeight: 1.4, letterSpacing: '0.08em' },

    // Chinese-specific
    chineseBody: { fontSize: '0.9375rem', fontWeight: 400, lineHeight: 1.8, letterSpacing: '0.02em' },
    chineseHeading: { fontSize: '1rem', fontWeight: 600, lineHeight: 1.5 },
  },
} as const;
