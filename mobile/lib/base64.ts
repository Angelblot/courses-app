/**
 * Décodage base64 vers octets.
 *
 * Écrit à la main plutôt que de s'en remettre à `atob`, absent de Hermes, ou à
 * `fetch` sur une adresse `file://`, dont le comportement varie d'une version
 * de React Native à l'autre. Une fonction pure se teste ; un pari sur
 * l'environnement, non.
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

const INDEX: Record<string, number> = {};
for (let i = 0; i < ALPHABET.length; i += 1) INDEX[ALPHABET[i]] = i;

/** Convertit une chaîne base64 en octets. Tolère les sauts de ligne. */
export function base64VersOctets(base64: string): Uint8Array {
  const propre = (base64 ?? '').replace(/[^A-Za-z0-9+/]/g, '');
  if (propre.length === 0) return new Uint8Array(0);

  const nbOctets = Math.floor((propre.length * 3) / 4);
  const octets = new Uint8Array(nbOctets);

  let tampon = 0;
  let bits = 0;
  let sortie = 0;

  for (const c of propre) {
    const v = INDEX[c];
    if (v === undefined) continue;
    tampon = (tampon << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      octets[sortie] = (tampon >> bits) & 0xff;
      sortie += 1;
    }
  }

  return sortie === nbOctets ? octets : octets.subarray(0, sortie);
}
