/**
 * Un nom de canal temps réel propre à chaque abonnement.
 *
 * supabase-js rend le canal existant quand on en redemande un du même nom :
 * deux écrans abonnés à « travail-actif » partageaient ainsi un canal déjà
 * souscrit, et le second `.on()` levait « cannot add postgres_changes
 * callbacks after subscribe() », ce qui faisait tomber l'écran.
 */
let compteur = 0;
export function nomCanal(base: string): string {
  compteur += 1;
  return `${base}-${compteur}-${Date.now().toString(36)}`;
}
