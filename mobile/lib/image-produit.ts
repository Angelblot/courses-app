/**
 * Image d'un produit sans photo : la clé qui la retrouve, et l'aplat montré
 * en attendant. La même normalisation vit dans la fonction `image-produit`
 * (supabase/functions) : un nom tapé autrement retrouve la même image.
 */

/** « Pommes de terre  BIO » et « pommes de terre bio » donnent la même clé. */
export function cleImage(nom: string): string {
 return nom.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/œ/g, 'oe').replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 80);
}

/** Teintes douces de l'aplat, choisies par le nom : un produit garde toujours la sienne. */
const TEINTES = ['#E4EBDC', '#F1E6D6', '#E2E8EE', '#EFE1E4', '#E6E4F0', '#F3EBCF'];

export function teinteAplat(nom: string): string {
 const cle = cleImage(nom);
 let h = 0;
 for (let i = 0; i < cle.length; i++) h = (h * 31 + cle.charCodeAt(i)) >>> 0;
 return TEINTES[h % TEINTES.length];
}
