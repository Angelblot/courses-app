# Session de courses

L’accueil rassemble les manques notés au fil des jours depuis le widget, Siri ou l’app, et propose de commencer ou reprendre une session. Il ne présente plus les produits habituels : leur revue appartient à la préparation des courses.

## Parcours

1. **Recettes** — Choisir les repas et le nombre de portions.
2. **Manques** — Vérifier chaque produit, son format et le nombre d’articles. Un libellé libre peut être conservé ou remplacé par un produit du catalogue. Un produit disparu du catalogue doit être remplacé ou retiré. Les manques actifs doivent être confirmés avant de continuer.
3. **Habitudes** — Parcourir les favoris par rayon, régler la quantité puis choisir « J’en ai déjà » ou « Il m’en faut ». Les produits déjà présents parmi les manques actifs ne sont pas redemandés.
4. **En plus** — Ajouter les achats exceptionnels par recherche Open Food Facts, scan du code-barres ou saisie libre. Les transformer en favoris reste un choix explicite.
5. **Bilan** — Retrouver une liste réunissant toutes les sources, ajuster les quantités finales, préciser les conditionnements et résoudre les doublons possibles avant de choisir un drive.

## Pause et reprise

« Faire une pause » revient à l’accueil en conservant l’étape et les choix. Le brouillon est enregistré localement par compte et restauré à la prochaine ouverture ; les erreurs de sauvegarde ou de restauration sont affichées. Cette persistance ne constitue pas une synchronisation entre appareils.

Les anciens brouillons restent utilisables. Quand leur origine n’a pas été enregistrée, les manques portent la provenance « Ajout précédent » : aucune origine widget n’est inventée. Les anciens extras dont l’identifiant atteste un ajout Siri conservent cette origine.

## Regroupement et décisions

Les besoins des recettes s’additionnent puis sont convertis en conditionnements lorsque le format du produit le permet. Pour un même identifiant catalogue, les besoins hors recettes sont rapprochés de la quantité déjà calculée par maximum, sans addition automatique entre sources. Un extra de même nom normalisé et de même unité rejoint une ligne compatible lorsqu’une seule correspond ; sa quantité est également prise par maximum. Une quantité finale explicitement modifiée dans le bilan prévaut. Les ajouts volontaires répétés au même produit peuvent, eux, augmenter la quantité enregistrée.

Les ressemblances de nom, de type de produit ou d’EAN entre lignes restantes déclenchent une décision : retirer une ligne ou confirmer deux achats distincts. Elles ne provoquent pas une fusion automatique. Une modification de nom, unité ou quantité peut nécessiter une nouvelle décision. Retirer une ligne fusionnée ne doit pas faire réapparaître son ajout manuel ; ce cas dispose d’un test de régression.

Le choix du drive reste bloqué tant qu’il existe des manques non confirmés, des doublons non résolus ou des conditionnements à préciser. Il est également indisponible lorsque la liste est vide ou les données ne sont pas prêtes.

## Références et validation

Le comportement est défini dans `lib/session-courses.ts`, `lib/liste-maison.ts` et `contexts/WizardContext.tsx`. Les écrans principaux sont `components/Manques.tsx`, `app/(tabs)/index.tsx` et `app/(tabs)/wizard/[etape].tsx`, avec leurs composants d’étape.

Validation de cette version : 204 tests unitaires, vérification TypeScript, parcours E2E et export du bundle iOS réussis, y compris la régression de suppression d’une ligne fusionnée. Les E2E utilisent React Native Web et des services simulés ; ils ne valident pas le matériel iOS ni les interactions natives réelles. Revue finale : SHIP. Cette version n’a pas été publiée sur TestFlight.

## Propositions de produits

Les remplacements des manques, choix de produits au bilan, résultats du catalogue et résultats Open Food Facts utilisent une rangée horizontale de cartes. Chaque carte présente la photo disponible, le nom, la marque et le format. La sélection est indiquée par une bordure verte et une coche, sans changer la quantité. Dans l’ajout exceptionnel, le bouton indique explicitement la quantité ajoutée. Une sélection ferme le clavier ; la confirmation du remplacement reste distincte.
