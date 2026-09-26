---
name: Tablée Maison — widget Les essentiels
description: Favoris photographiés et ajout direct à la liste de courses dans un widget natif.
colors:
  olive: "rgb(28.2% 38% 22.7%)"
  ink-light: "rgb(12% 18% 10%)"
  paper-light: "rgb(94.5% 95.7% 91.7%)"
  card-light: "#ffffff"
  ink-dark: "rgb(88% 93% 83%)"
  paper-dark: "rgb(10% 14% 9%)"
  card-dark: "rgb(17% 21% 14%)"
rounded:
  product: "14px"
spacing:
  grid: "8px"
  compact-content: "5px"
  regular-content: "8px"
components:
  product-light:
    backgroundColor: "{colors.card-light}"
    textColor: "{colors.ink-light}"
    rounded: "{rounded.product}"
  product-dark:
    backgroundColor: "{colors.card-dark}"
    textColor: "{colors.ink-dark}"
    rounded: "{rounded.product}"
---

# Design System: Tablée Maison — widget Les essentiels

## Overview

**Creative North Star: "Tablée Maison"**

Document local à la surface native Operate, concept choisi 01 « Les essentiels ». L’identité olive, sauge et crème accompagne les photos des produits favoris : reconnaître un produit et l’ajouter en un geste. Ce fichier décrit le widget réalisé, sans remplacer le système historique à la racine. Aucun PRODUCT.md n’est présent.

**Key Characteristics:**
- Photos produits, fond doux et contraste lisible.
- Composition fixe adaptée à chaque famille WidgetKit.
- Ajout confirmé dans la tuile, pagination explicite.

Source normative : `TableeWidget.swift`. Comportement partagé : `../TableeShared/TableeStore.swift`, `../../lib/widget-products.ts` et `../../components/WidgetSync.tsx`. Les valeurs `px` du frontmatter transcrivent les points SwiftUI pour les outils de documentation ; elles ne définissent pas une interface web.

## Colors

L’olive porte l’action d’ajout et le panier de secours. L’encre, le papier sauge et les cartes passent ensemble à leurs variantes sombres selon le système. Le blanc reste le contraste du signe plus. La confirmation utilise l’olive à 15 % d’opacité avec l’encre courante.

## Typography

Typographie système SwiftUI : `headline` pour le titre des grands formats ; `caption.bold()` pour le titre moyen et les actions ; `caption.weight(.semibold)` pour les noms ; `caption2` pour les conditionnements. Le compteur de pages emploie des chiffres à chasse fixe.

Le nom occupe jusqu’à deux lignes en grand format, une en compact ou en taille d’accessibilité. Dynamic Type est plafonné à `xxLarge` dans ce canevas fixe ; VoiceOver conserve les libellés complets. Le titre peut se réduire jusqu’à 85 %.

## Layout

| Famille | Capacité | Composition |
| --- | ---: | --- |
| Small | 1 | Une tuile verticale, sans titre |
| Medium | 3 | Une rangée, titre « Les essentiels » |
| Large | 6 | Deux rangées de trois, titre « À ajouter cette semaine » |
| ExtraLarge | 6 | Deux rangées de trois ; photo à gauche, texte à droite |
| AccessoryCircular | — | Raccourci `cart.badge.plus` vers l’ajout dans l’app |

Grille espacée de 8 points. Espacement principal de 6 points en compact, 10 sinon. Photos ajustées sans recadrage ; largeur maximale de 80 points en ExtraLarge. Pas de défilement. Les marges extérieures sont celles du conteneur WidgetKit.

## Elevation & Depth

Aucune ombre ajoutée. La profondeur vient des cartes claires ou sombres posées sur le papier sauge et de la capsule d’action olive.

## Shapes

Cartes arrondies réalisées par `RoundedRectangle(cornerRadius: 14)`. La zone interactive épouse toute la carte. Capsules d’ajout de 24 points de haut en compact, 28 sinon ; leur hauteur ne représente pas la cible tactile complète.

## Components

**Tuile produit.** Photo locale issue du conteneur partagé, panier de secours si indisponible. Nom centré ; conditionnement uniquement hors compact. Toute la tuile disponible déclenche `AddEssentialIntent`. Après ajout, elle devient une confirmation non interactive : coche, complétée par « Ajouté » hors compact. VoiceOver annonce le nom complet et l’état ; la photo est décorative.

**Pagination.** « Suivants » apparaît lorsqu’il existe plusieurs pages ; cible minimale de 44 points. Le compteur est masqué en Small. Rotation proposée toutes les 30 minutes par la timeline, sous contrôle de l’OS : aucun délai d’affichage garanti ni animation de carrousel.

**États vides.** Texte et lien adaptés au compte absent, au catalogue non synchronisé, à l’absence de favoris ou aux essentiels déjà dans la liste. Les liens proposent l’ouverture de Courses ou de la liste ; les raccourcis utilisent `coursesapp://`.

**Contrat d’ajout.** L’intent enregistre localement une unité, conserve l’identifiant catalogue et évite les doublons. L’app importe les reçus à son ouverture ; la confirmation ne promet pas une synchronisation distante immédiate. Les données et ajouts sont isolés par compte ; les intents exigent une authentification et refusent un compte devenu obsolète.

**Validation de cette version.** Reviewer : SHIP, aucune correction restante. Les captures `.impeccable/review/widget-essentials/phone.png`, `tablet.png` et `phone-dark-large.png` à la racine montrent la vraie vue SwiftUI avec produits de démonstration dans un hôte Simulator, pas dans SpringBoard. Les 198 tests JS, TypeScript, le modèle Swift et la compilation iOS ont été validés. Les intents sur appareil réel restent non vérifiés. Cette version n’est pas publiée sur TestFlight.

## Do's and Don'ts

- **Do** conserver les photos, les noms accessibles et les variantes de couleur système.
- **Do** conserver six produits au maximum en Large et ExtraLarge, avec adaptation explicite des petits formats.
- **Don't** rendre la confirmation interactive ni présenter la rotation OS comme une fréquence garantie.
- **Don't** confondre une capture Simulator avec une validation des intents sur appareil réel.
