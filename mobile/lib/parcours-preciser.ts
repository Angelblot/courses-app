/**
 * L'ordre de visite des points de Préciser, pour « Précédent ». Un point
 * passé puis revenu en tête prend la place du dernier visité : le chevron
 * remonte ainsi le chemin réellement parcouru.
 */
export function visiter(parcours: string[], cle: string): string[] {
 if (parcours[parcours.length - 1] === cle) return parcours;
 return [...parcours.filter(c => c !== cle), cle];
}

/** Le point visité juste avant `cle`, ou null au premier. Hors parcours : le dernier visité. */
export function precedentDe(parcours: string[], cle: string): string | null {
 const i = parcours.indexOf(cle);
 if (i < 0) return parcours[parcours.length - 1] ?? null;
 return i > 0 ? parcours[i - 1] : null;
}

/** Le rang affiché (« 3 sur 19 ») : la place dans le parcours, ou la suivante pour un point neuf. */
export function rangDans(parcours: string[], cle: string): number {
 const i = parcours.indexOf(cle);
 return i < 0 ? parcours.length + 1 : i + 1;
}
