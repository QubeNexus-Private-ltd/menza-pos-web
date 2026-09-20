export const Typography = {
  fontFamily: {
    heading: 'System', // Fallback for Poppins / Plus Jakarta Sans / Outfit
    body: 'System',    // Fallback for DM Sans / Inter / Roboto
    regular: 'System',
    medium: 'System',
    semiBold: 'System',
    bold: 'System',
  },
  fontSize: {
    xs: 11,
    sm: 13,
    body2: 13,
    md: 15,
    body1: 15,
    button: 14,
    h3: 17,
    lg: 18,
    h2: 20,
    xl: 24,
    h1: 28,
    stat: 28,
    hero: 28,
    display: 32,
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
  fontWeight: {
    regular: '400' as const,
    medium: '500' as const,
    semiBold: '600' as const,
    bold: '700' as const,
  },
  letterSpacing: {
    badge: 0.9,
    button: 0.2,
    normal: 0,
    heading: -0.3,
  },
  styles: {
    h1: {
      fontSize: 28,
      fontWeight: '700' as const,
      letterSpacing: -0.3,
    },
    h2: {
      fontSize: 20,
      fontWeight: '600' as const,
    },
    h3: {
      fontSize: 17,
      fontWeight: '600' as const,
    },
    stat: {
      fontSize: 28,
      fontWeight: '700' as const,
    },
    body1: {
      fontSize: 15,
      fontWeight: '400' as const,
    },
    body2: {
      fontSize: 13,
      fontWeight: '400' as const,
    },
    badgeLabel: {
      fontSize: 11,
      fontWeight: '500' as const,
      letterSpacing: 0.9,
      textTransform: 'uppercase' as const,
    },
    button: {
      fontSize: 14,
      fontWeight: '600' as const,
      letterSpacing: 0.2,
    },
  },
};
