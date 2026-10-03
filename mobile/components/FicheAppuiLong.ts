import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import type { OuvertureFiche } from './DetailProduit';

/** Ce qui désigne un produit du catalogue : son identifiant, à défaut son code-barres. */
export type CibleFiche = { id?: string | null; ean13?: string | null } | null | undefined;

const cle = (c: CibleFiche) => c?.id ?? (c?.ean13 ? `ean:${c.ean13}` : null);

/** Ouvre la fiche d'un produit en feuille, par-dessus l'écran courant. */
export function ouvrirFiche(cible: CibleFiche, ouverture: OuvertureFiche = 'consulter') {
  const id = cle(cible);
  if (!id) return;
  router.push({ pathname: '/produit/[id]', params: ouverture === 'consulter' ? { id } : { id, ouverture } });
}

/**
 * Les props d'une ligne de produit pour qu'un appui long ouvre sa fiche, avec
 * le petit choc d'un appui long iOS. Rien quand la ligne ne désigne aucun
 * produit du catalogue (un extra noté à la main, par exemple).
 */
export function appuiLongFiche(cible: CibleFiche) {
  if (!cle(cible)) return {};
  return {
    onLongPress: () => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      ouvrirFiche(cible);
    },
    delayLongPress: 350,
    accessibilityHint: 'Appui long pour ouvrir la fiche du produit',
  };
}
