/** Petits formats partagés par les écrans de commandes. */
export const euros = (v: number) => `${v.toFixed(2).replace('.', ',')} €`;
export const pourcent = (v: number) => `${v < 0 ? '−' : '+'}${Math.round(Math.abs(v) * 100)} %`;
export const jourLong = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
export const moisCourt = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
export const BAISSE = '#2F6B2F', HAUSSE = '#9A3A22';
/** Couleur d'un écart : vert en baisse, brique en hausse, neutre sous 1 %. */
export const teinteEcart = (v: number | null, neutre: string) => v == null || Math.abs(v) < 0.01 ? neutre : v < 0 ? BAISSE : HAUSSE;
