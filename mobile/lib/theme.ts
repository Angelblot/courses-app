/** Reprend les variables du front web, pour que les deux se ressemblent. */
export const colors = {
  bg: '#FAFAF8',
  surface: '#FFFFFF',
  border: '#E6E4DF',
  text: '#1C1C1A',
  textMuted: '#6B6B6B',
  accent: '#2D6A4F',
  accentSoft: '#E6EFE9',
  accentContrast: '#FFFFFF',
  danger: '#B3261E',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 6, md: 10, lg: 14, pill: 999 } as const;
