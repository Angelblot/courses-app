import type { ReactElement } from 'react';
import { Button, ContextMenu, Divider, Host, RNHostView } from '@expo/ui/swift-ui';

export type MenuProduitProps = {
  largeur: number;
  /** Hauteur fixe de la tuile : le conteneur SwiftUI ne la mesure pas lui-même. */
  hauteur: number;
  onAjouter: () => void;
  onModifier: () => void;
  /** Absent quand le produit n'a pas de code-barres à relire. */
  onActualiser?: () => void;
  onSupprimer: () => void;
  children: ReactElement;
};

/**
 * Le menu contextuel natif d'iOS d'une tuile de « Mes produits », ouvert par
 * un appui long : liste, modifier, actualiser, supprimer. Le repli web et
 * Android, sans menu, est dans `MenuProduit.tsx`.
 *
 * La taille est imposée, pas mesurée : avec `matchContents`, le conteneur
 * gardait parfois une hauteur périmée au défilement et rognait la tuile.
 * `ignoreSafeArea` : sans lui, la tuile passée sous la barre d'accueil était
 * coupée par la marge de sécurité.
 */
export function MenuProduit({ largeur, hauteur, onAjouter, onModifier, onActualiser, onSupprimer, children }: MenuProduitProps) {
  return (
    <Host ignoreSafeArea="all" style={{ width: largeur, height: hauteur }}>
      <ContextMenu>
        <ContextMenu.Items>
          <Button label="Ajouter à ma liste" systemImage="cart.badge.plus" onPress={onAjouter} />
          <Divider />
          <Button label="Modifier" systemImage="pencil" onPress={onModifier} />
          {onActualiser && <Button label="Actualiser les infos" systemImage="arrow.clockwise" onPress={onActualiser} />}
          <Divider />
          <Button label="Supprimer" systemImage="trash" role="destructive" onPress={onSupprimer} />
        </ContextMenu.Items>
        <ContextMenu.Trigger>
          <RNHostView>{children}</RNHostView>
        </ContextMenu.Trigger>
      </ContextMenu>
    </Host>
  );
}
