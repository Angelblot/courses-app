/**
 * Identifiant d'un envoi, créé sur le téléphone avant l'insertion dans
 * `cart_jobs`. Si la réponse se perd, on relit cet identifiant exact pour
 * savoir si la liste est partie ; un nouvel essai avec le même identifiant
 * ne peut pas créer de doublon (clé primaire).
 *
 * Pas de `crypto.randomUUID()` : il n'est pas garanti sous Hermes (voir
 * photo-recette.ts). `crypto.getRandomValues` est pris s'il existe.
 */
export function nouvelIdEnvoi(): string {
  const octets = new Uint8Array(16);
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  if (c?.getRandomValues) c.getRandomValues(octets);
  else for (let i = 0; i < 16; i++) octets[i] = Math.floor(Math.random() * 256);
  octets[6] = (octets[6] & 0x0f) | 0x40; // version 4
  octets[8] = (octets[8] & 0x3f) | 0x80; // variante RFC 4122
  const h = Array.from(octets, o => o.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
