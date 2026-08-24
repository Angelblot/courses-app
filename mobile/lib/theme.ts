/**
 * Jetons visuels. Mesurés sur jow.fr le 24/08 et adaptés, pas copiés : leurs
 * polices — Surt et Viksjow — sont propriétaires et ne sont pas reprises.
 *
 * Le fond crème est le choix qui porte tout le reste : sur un blanc froid,
 * les mêmes cartes blanches disparaissent au lieu de se détacher.
 */
export const colors = {
  bg: '#FDF4E7',
  surface: '#FFFFFF',
  // Trait chaud, pour le peu d'endroits où il en faut encore un : un gris
  // neutre tire au violet sur du crème.
  border: '#EDE3D2',
  text: '#1C1C1A',
  textMuted: '#6B6B6B',
  // Vert profond : le nôtre, plus clair, manquait d'assise sur le crème.
  accent: '#075526',
  accentSoft: '#E3EDE6',
  accentContrast: '#FFFFFF',
  danger: '#B3261E',
  // Fond d'alerte, assez pâle pour porter le texte sombre du thème.
  dangerSoft: '#FBEAE9',
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
  // Aplats des recettes sans photo. Six teintes sourdes, assez contrastées
  // pour porter du texte blanc, assez proches pour ne pas jurer entre elles.
  aplats: ['#2D6A4F', '#52796F', '#B08968', '#6B705C', '#8A5A44', '#4A6FA5'],
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 14, lg: 24, xl: 32, pill: 999 } as const;

/**
 * Ombre douce et large, à la place d'un trait de 1 px.
 *
 * Un trait fait « formulaire » ; une ombre diffuse fait « objet posé sur la
 * table ». C'est ce qui sépare une carte encadrée d'une carte qui flotte.
 */
export const ombre = {
  shadowColor: '#090E15',
  shadowOpacity: 0.1,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 5 },
  // Android n'a pas d'ombre paramétrable : `elevation` en est l'équivalent.
  elevation: 3,
} as const;
