import { useMemo } from 'react';
import { useProducts } from './products';
import type { LigneCommande } from '../lib/commandes.ts';

/** L'image du catalogue d'une ligne de commande, retrouvée par produit ou par code-barres. */
export function useImagesCommande() {
  const { produits } = useProducts();
  return useMemo(() => {
    const parId = new Map(produits.map(p => [p.id, p.image_url])), parEan = new Map(produits.filter(p => p.ean13).map(p => [p.ean13!, p.image_url]));
    return (l: LigneCommande) => (l.product_id && parId.get(l.product_id)) || (l.ean13 && parEan.get(l.ean13)) || null;
  }, [produits]);
}
