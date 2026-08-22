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
  // Voile sombre posé sur l'image caméra pour garder un texte de consigne
  // lisible, quelle que soit la scène filmée en dessous.
  voileCamera: 'rgba(0,0,0,0.45)',
  // Pastilles Nutriscore. Ces cinq couleurs étaient spécifiées dans
  // DESIGN.md §1.2 bis depuis la conception initiale, sans jamais servir.
  nutriA: '#2E7D32',
  nutriB: '#76B028',
  nutriC: '#F5B700',
  nutriD: '#E67E22',
  nutriE: '#C62828',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 6, md: 10, lg: 14, pill: 999 } as const;
