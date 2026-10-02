/** Petits formats partagés par les écrans de commandes. */
export const euros = (v: number) => `${v.toFixed(2).replace('.', ',')} €`;
export const pourcent = (v: number) => `${v < 0 ? '−' : '+'}${Math.round(Math.abs(v) * 100)} %`;
export const jourLong = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
export const moisCourt = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
export const BAISSE = '#2F6B2F', HAUSSE = '#9A3A22';
/** Couleur d'un écart : vert en baisse, brique en hausse, neutre sous 1 %. */
export const teinteEcart = (v: number | null, neutre: string) => v == null || Math.abs(v) < 0.01 ? neutre : v < 0 ? BAISSE : HAUSSE;
/** Teinte de chaque enseigne, foncée (étiquettes) et claire (sur fond sombre). */
export const TEINTES_DRIVES: Record<string, { fonce: string; clair: string }> = {
  carrefour: { fonce: '#48613A', clair: '#A9C29A' },
  leclerc: { fonce: '#2E5683', clair: '#8FB3DC' },
};
export const teinteDrive = (d: string) => TEINTES_DRIVES[d] ?? { fonce: '#6B5B2E', clair: '#D8C9A3' };
