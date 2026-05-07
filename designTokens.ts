export const theme = {
  colors: {
    // Legacy aliases retained for existing component references.
    appBg: 'var(--background)',
    shellBg: 'var(--sidebar)',
    cardBg: 'var(--card)',
    cardAltBg: 'var(--background-elevated)',

    accent: 'var(--primary)',
    accentSoft: 'var(--primary-hover)',

    up: 'var(--success)',
    down: 'var(--danger)',
    warn: 'var(--warning)',

    textPrimary: 'var(--foreground)',
    textSecondary: 'var(--foreground-soft)',
    textMuted: 'var(--muted-foreground)',

    borderSubtle: 'var(--card-border-soft)',
    borderStrong: 'var(--card-border)',
    accentBg: 'var(--primary-muted)',
    accentBgSoft: 'var(--primary-muted)',
    accentFillStart: 'var(--primary-glow)',

    shadowCard: '0 18px 40px var(--shadow-soft)',
    shadowGlow: '0 0 0 1px var(--blue-glow-shadow), 0 10px 30px var(--blue-glow-shadow)',

    background: {
      deepest: 'var(--background)',
      primary: 'var(--background)',
      secondary: 'var(--background-soft)',
      elevated: 'var(--background-elevated)',
      default: 'var(--background)',
      soft: 'var(--background-soft)',
      glass: 'var(--background-glass)',
    },
    card: {
      bg: 'var(--card)',
      bgAlt: 'var(--background-elevated)',
      border: 'var(--card-border)',
      borderStrong: 'var(--card-border)',
      default: 'var(--card)',
      hover: 'var(--card-hover)',
      borderSoft: 'var(--card-border-soft)',
    },
    text: {
      primary: 'var(--foreground)',
      secondary: 'var(--foreground-soft)',
      muted: 'var(--muted-foreground)',
      subtle: 'var(--subtle-foreground)',
    },
    primary: {
      default: 'var(--primary)',
      hover: 'var(--primary-hover)',
      muted: 'var(--primary-muted)',
      glow: 'var(--primary-glow)',
    },
    gold: {
      default: 'var(--gold)',
      hover: 'var(--gold-hover)',
      muted: 'var(--gold-muted)',
      glow: 'var(--gold-glow)',
    },
    success: {
      default: 'var(--success)',
      soft: 'var(--success-soft)',
      glow: 'var(--success-glow)',
    },
    danger: {
      default: 'var(--danger)',
      soft: 'var(--danger-soft)',
      glow: 'var(--danger-glow)',
    },
    warning: {
      default: 'var(--warning)',
      soft: 'var(--warning-soft)',
      glow: 'var(--warning-glow)',
    },
    ai: {
      purple: 'var(--ai-purple)',
      soft: 'var(--ai-purple-soft)',
      glow: 'var(--ai-purple-glow)',
    },
    cyan: {
      default: 'var(--cyan)',
      soft: 'var(--cyan-soft)',
      glow: 'var(--cyan-glow)',
    },
    chart: {
      blue: 'var(--chart-blue)',
      green: 'var(--chart-green)',
      red: 'var(--chart-red)',
      gold: 'var(--chart-gold)',
      purple: 'var(--chart-purple)',
      cyan: 'var(--chart-cyan)',
      orange: 'var(--chart-orange)',
      muted: 'var(--chart-muted)',
    },
    shadow: {
      soft: 'var(--shadow-soft)',
      strong: 'var(--shadow-strong)',
      blueGlow: 'var(--blue-glow-shadow)',
      goldGlow: 'var(--gold-glow-shadow)',
    },
    semantic: {
      up: 'var(--success)',
      down: 'var(--danger)',
      warn: 'var(--warning)',
    },
    sidebar: {
      bg: 'var(--sidebar)',
      border: 'var(--sidebar-border)',
      active: 'var(--sidebar-active)',
      activeBorder: 'var(--sidebar-active-border)',
      text: 'var(--sidebar-text)',
      muted: 'var(--sidebar-muted)',
    },
    input: {
      bg: 'var(--input)',
      border: 'var(--input-border)',
      focus: 'var(--input-focus)',
    },
    button: {
      secondary: 'var(--button-secondary)',
      secondaryHover: 'var(--button-secondary-hover)',
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
    displayLg: { fontSize: 'clamp(1.75rem, 1rem + 4vw, 2.5rem)', fontWeight: 600, lineHeight: 1.2, letterSpacing: '-0.02em' },
    displayMd: { fontSize: 'clamp(1.5rem, 0.8rem + 3vw, 2rem)', fontWeight: 600, lineHeight: 1.25 },
    displaySm: { fontSize: '1.5rem', fontWeight: 600, lineHeight: 1.3 },

    headingXl: { fontSize: '1.25rem', fontWeight: 600, lineHeight: 1.4 },
    headingLg: { fontSize: '1.125rem', fontWeight: 600, lineHeight: 1.4 },
    headingMd: { fontSize: '1rem', fontWeight: 500, lineHeight: 1.5 },
    headingSm: { fontSize: '0.875rem', fontWeight: 500, lineHeight: 1.5 },

    bodyLg: { fontSize: '1rem', fontWeight: 400, lineHeight: 1.7 },
    bodyMd: { fontSize: '0.9375rem', fontWeight: 400, lineHeight: 1.6 },
    bodySm: { fontSize: '0.875rem', fontWeight: 400, lineHeight: 1.6 },

    caption: { fontSize: '0.75rem', fontWeight: 500, lineHeight: 1.4, letterSpacing: '0.08em' },

    chineseBody: { fontSize: '0.9375rem', fontWeight: 400, lineHeight: 1.8, letterSpacing: '0.02em' },
    chineseHeading: { fontSize: '1rem', fontWeight: 600, lineHeight: 1.5 },
  },
} as const;
