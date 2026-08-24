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
  // Trait chaud pour les champs et séparateurs.
  border: '#EDE3D2',
  // Trait des pastilles d'ingrédients : gris neutre, mesuré chez Jow, qui
  // disparaît sous l'image au lieu de l'encadrer.
  traitPastille: '#E9E9E9',
  text: '#1E1E1E',
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
  // Aplats des recettes sans photo : la couleur pleine mêlée au crème à 45 %,
  // portant son initiale dans la teinte pleine correspondante.
  //
  // Deux essais avant celui-ci. En couleur pleine, ces disques écrasaient la
  // grille et criaient plus fort que les photos. Passés très pâles, ils
  // s'effaçaient au point de ne plus rien distinguer. 45 % tient les deux
  // bouts : la recette se reconnaît à sa teinte sans voler la vedette.
  aplats: ['#9FB6A3', '#B0BDB1', '#DAC4AE', '#BBB9A8', '#C9AF9E', '#ACB8C9'],
  // Assombries de 40 % : l'initiale en couleur pleine sur une teinte de la
  // même couleur manquait de contraste, surtout sur les beiges.
  aplatsEncre: ['#1B402F', '#314943', '#6A523E', '#404337', '#533629', '#2C4363'],
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
// `card: 16` est la valeur mesurée sur les cartes de Jow — 24 alourdissait.
export const radius = { sm: 8, md: 14, card: 16, lg: 24, xl: 32, pill: 999 } as const;

/**
 * Échelle typographique mesurée sur jow.fr le 24/08.
 *
 * La leçon principale n'est pas dans les tailles mais dans les graisses :
 * Jow écrit presque tout en 400, y compris ses titres de section. Notre 700
 * généralisé donnait un rendu d'application utilitaire là où le leur respire.
 */
export const texte = {
  /** Titre de section — « Ingrédients », centré. */
  section: { fontSize: 18, fontWeight: '400', lineHeight: 22 },
  /** Nom d'une recette sur sa carte. */
  carte: { fontSize: 15, fontWeight: '400', lineHeight: 20 },
  /** Quantité et nom sous une pastille : rigoureusement identiques chez Jow. */
  pastille: { fontSize: 12, fontWeight: '400', lineHeight: 16 },
} as const;

