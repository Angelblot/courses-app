# Édition des recettes — Tablée Maison

L’éditeur conserve la palette olive et sauge. Le nom, la photo et le nombre de personnes précèdent une liste compacte d’ingrédients. Chaque ligne montre la photo disponible, le nom et la quantité par personne. Une seule ligne se déplie à la fois ; les autres restent lisibles. Les données enregistrées restent des quantités par portion, sans conversion implicite lors d’un changement du nombre de personnes.

L’ouverture du détail utilise une transition d’opacité et un léger déplacement de 180 ms, désactivés avec Réduire les animations. Le sélecteur d’unité présente toutes les unités sans défilement horizontal tronqué. Le clavier se ferme au défilement, aux changements d’unité et à la validation ; un bouton explicite permet également de le masquer.

Le bouton Enregistrer reste visible en bas, au-dessus du clavier sur iOS. La navigation principale est masquée dans l’éditeur. Quitter avec des modifications demande confirmation. Le dernier ingrédient retiré peut être restauré. Les décimales restent sous forme de texte pendant la saisie, puis sont validées avant enregistrement. Un échec conserve les modifications ; un succès affiche une confirmation, avec un avertissement si la nouvelle photo n’a pas pu être envoyée.

Vérifications : TypeScript, suite unitaire et scénario E2E avec services simulés (décimales, unité, restauration, sortie et contenu enregistré). Captures React Native Web téléphone/tablette dans `.impeccable/review/recipe-editor`. Elles ne remplacent pas une vérification du clavier et des gestes sur un appareil iOS. Aucune publication TestFlight dans cette modification.
