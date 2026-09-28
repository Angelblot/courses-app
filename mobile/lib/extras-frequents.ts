import { normaliserNom } from './session-courses.ts';

/** Un produit ajouté hors habitudes, et combien de fois il l'a été. */
export type Frequent = { name: string; productId?: string; count: number };

/** Retient un extra noté, pour le proposer en un tap les fois suivantes. */
export function retenirFrequent(freq: Record<string, Frequent>, ajout: { name: string; productId?: string }): Record<string, Frequent> {
 const cle = normaliserNom(ajout.name);
 if (!cle) return freq;
 const avant = freq[cle];
 return { ...freq, [cle]: { name: avant?.name ?? ajout.name.trim(), productId: ajout.productId ?? avant?.productId, count: (avant?.count ?? 0) + 1 } };
}

/** Les extras les plus souvent notés, hors ceux déjà dans la liste. */
export function suggestionsFrequentes(freq: Record<string, Frequent>, dejaListes: string[], n = 4): Frequent[] {
 const exclus = new Set(dejaListes.map(normaliserNom));
 return Object.entries(freq).filter(([cle]) => !exclus.has(cle)).map(([, f]) => f)
  .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'fr')).slice(0, n);
}
