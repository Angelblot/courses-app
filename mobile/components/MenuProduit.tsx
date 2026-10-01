import { View } from 'react-native';
import type { MenuProduitProps } from './MenuProduit.ios';

/**
 * Repli web et Android du menu contextuel d'une tuile de « Mes produits » :
 * pas de menu natif, l'appui long ouvre la fiche (géré par la tuile). La
 * version iOS est dans `MenuProduit.ios.tsx`.
 */
export function MenuProduit({ children }: MenuProduitProps) {
  return <View>{children}</View>;
}
