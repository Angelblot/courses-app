/**
 * Ce que dit l'accueil : la saison et sa phrase, la salutation, et le budget
 * tiré des commandes passées. Rien ici ne parle à Supabase.
 */

export type Saison = 'hiver' | 'printemps' | 'ete' | 'automne';

/** Saisons de marché : décembre à février l'hiver, et ainsi de suite. */
export function saison(d: Date): Saison {
  const m = d.getMonth();
  return m === 11 || m <= 1 ? 'hiver' : m <= 4 ? 'printemps' : m <= 7 ? 'ete' : 'automne';
}

/** Ce qui arrive sur les étals ce mois-ci, en une phrase. */
const PHRASES = [
  'Agrumes, poireaux, choux : le cœur de l’hiver.',
  'Oranges sanguines et endives : l’hiver tient bon.',
  'Premiers radis, derniers agrumes : le printemps approche.',
  'Asperges et petits pois : le printemps est là.',
  'Fraises, radis, petits pois : le plein printemps.',
  'Cerises et courgettes : l’été commence.',
  'Tomates, abricots, basilic : le plein été.',
  'Melons, pêches, tomates : la fin de l’été.',
  'Figues, raisin, prunes : la rentrée gourmande.',
  'Figues, raisin, champignons : c’est le début de l’automne.',
  'Courges, châtaignes, champignons : l’automne s’installe.',
  'Clémentines et choux : l’hiver arrive.',
];
export const phraseSaison = (d: Date) => PHRASES[d.getMonth()];

/** « Dimanche 4 octobre ». */
export function dateLongue(d: Date): string {
  const t = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** « Bonjour Angelo. », « Bonsoir. » à partir de 18 h ; sans prénom, le mot seul. */
export function salutation(d: Date, prenom?: string | null): string {
  const mot = d.getHours() >= 18 ? 'Bonsoir' : 'Bonjour', p = prenom?.trim();
  return p ? `${mot} ${p}.` : `${mot}.`;
}

export type Budget = {
  /** Montant moyen des dernières commandes (jusqu'à 6), arrondi à l'euro. */
  moyenne: number;
  /** Nombre de commandes dans cette moyenne. */
  sur: number;
  /** Écart avec les 6 d'avant, en part (−0,08 pour −8 %) ; absent sans assez d'historique. */
  evolution: number | null;
  /** Les 8 derniers montants, du plus ancien au plus récent. */
  points: number[];
};

/** Le budget d'après les commandes chiffrées ; rien sous deux commandes. */
export function resumeBudget(commandes: { jour: string; total: number | null }[]): Budget | null {
  const chiffrees = commandes.filter((c): c is { jour: string; total: number } => c.total != null && c.total > 0)
    .sort((a, b) => b.jour.localeCompare(a.jour));
  if (chiffrees.length < 2) return null;
  const moy = (l: { total: number }[]) => l.reduce((t, c) => t + c.total, 0) / l.length;
  const recentes = chiffrees.slice(0, 6), avant = chiffrees.slice(6, 12);
  const moyenne = moy(recentes);
  return {
    moyenne: Math.round(moyenne), sur: recentes.length,
    evolution: avant.length >= 3 ? Math.round((moyenne / moy(avant) - 1) * 100) / 100 : null,
    points: chiffrees.slice(0, 8).reverse().map(c => c.total),
  };
}
