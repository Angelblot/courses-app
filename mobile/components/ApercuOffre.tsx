import { View } from 'react-native';
import type { ApercuOffreProps } from './ApercuOffre.ios';

/**
 * Repli web et Android de l'aperçu d'un résultat : pas de menu natif, l'appui
 * long ouvre directement la fiche complète (géré par la ligne). La version
 * iOS est dans `ApercuOffre.ios.tsx`.
 */
export function ApercuOffre({ children }: ApercuOffreProps) {
  return <View>{children}</View>;
}
