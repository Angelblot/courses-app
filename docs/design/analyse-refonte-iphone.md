# Refonte de l’application iPhone — analyse et proposition

Date : 8 septembre 2026. Statut : proposition, non implémentée.

## Périmètre et méthode

Analyse des routes Expo, composants, état du brouillon, consolidation de la
liste et liaison Supabase/Chrome de `mobile/`. La référence graphique est
la maquette verte fournie par l’utilisateur. Le site Vite sur le port 5173
n’est pas l’application auditée.

Les constats fonctionnels ci-dessous sont issus du code, sans session sur
l’iPhone installé. La lisibilité réelle, le clavier, VoiceOver, les gestes et
les temps de réponse restent à vérifier sur appareil. Aucun score de qualité
visuelle ou résultat de test utilisateur n’est prétendu ici.

Le skill Design Taste indique lui-même ne pas cibler les produits à étapes :
ses recettes de landing page ne sont donc pas transposées à cette app native.
On retient la fidélité à la référence et la cohérence des images. L’analyse
porte surtout sur les tâches et la continuité du parcours.

## Ce qui doit être préservé

- Scan natif, identification Open Food Facts, photo et confirmation du favori.
- Traitement des produits inconnus, doublons, refus caméra et scans hors ligne.
- Favoris, catalogue personnel, recettes et import par lien.
- Portions, produits de remplacement, quantités et classement par rayon.
- Authentification, foyer partagé et données Supabase existantes.
- Transmission à l’extension Chrome et suivi du remplissage ; paiement sur le drive.
- Priorité absolue aux photos enregistrées ; compléter seulement les absences.

## Constats prioritaires

| Priorité | Constat dans le code iPhone | Conséquence | Proposition |
|---|---|---|---|
| P1 | `wizard/[etape].tsx` appelle `reinitialiser()` sur la croix. `WizardContext.tsx` conserve le brouillon uniquement en mémoire. | Quitter détruit les choix ; un redémarrage ne restaure pas la préparation. | Sauvegarde locale par compte, restauration à l’ouverture, « Fermer » conserve ; effacement séparé et explicite. |
| P1 | À l’étape Quotidien, Continuer exige un produit `needed` ou un extra, sans tenir compte des recettes. | Une préparation uniquement composée de recettes peut être bloquée. | Liste directement accessible, recettes facultatives, aucune étape de favoris obligatoire. |
| P1 | `EtapeIngredients.tsx` enregistre `choixProduits`, mais `EtapeRecap.tsx`, `EtapeGeneration.tsx` et `buildConsolidatedItems` ne l’utilisent pas. | Le choix affiché n’est pas celui garanti dans l’envoi au drive. | Une même liste consolidée alimente affichage et envoi, avec produit, EAN et quantité réellement sélectionnés. |
| P1 | `buildConsolidatedItems` n’exclut pas les ingrédients des recettes à partir du statut `have`. Un type `needed` supprime par ailleurs le besoin recette sans vérifier la quantité couverte. | Risque de racheter un ingrédient déjà possédé ou de sous-estimer la quantité nécessaire. | Distinguer besoin recette, conditionnement acheté et décision « Déjà chez moi » ; montrer le calcul si nécessaire. |
| P2 | Recettes et favoris se choisissent via deux piles de cartes ; cinq écrans successifs avant l’envoi. | Il faut avancer produit par produit et changer de vue pour vérifier les choix. | Liste de favoris avec ajout immédiat ; grille de recettes consultable librement. Swipe facultatif. |
| P2 | Le récapitulatif présente du texte et des quantités, sans photos ni modification directe. | Vérifier ou corriger nécessite des retours en arrière. | Transformer ce récapitulatif en liste centrale, illustrée et éditable. |
| P2 | L’onglet Recettes privilégie « Importer » et « Nouvelle recette », sans recherche dans la grille. | La gestion du catalogue prend le pas sur le choix des repas. | Rechercher, filtrer et ajouter un repas depuis les cartes ; création en action secondaire. |
| P2 | Les photos de recettes sont recadrées en cercle ; les absences donnent des initiales ou zones vides selon les composants. | Cadrages amputés et traitement inégal des images. | Photos de recettes rectangulaires, produits entièrement visibles, résolution commune des photos de secours. |

## Organisation recommandée

Conserver les trois destinations de la référence : **Courses · Recettes · Réglages**.
Dans Courses, accès explicites à **Ma liste**, **Mes favoris** et **Scanner**.
Le scan reste un bouton libellé visible dès l’accueil et dans les favoris ; il
n’est ni enfoui dans les réglages, ni limité à une icône sans texte.

Courses est le point d’entrée. Recettes complète une liste existante. Réglages
regroupe compte, foyer, drives et aide à l’extension. Le catalogue complet
reste accessible depuis Mes favoris avec un filtre « Tous les produits ».

## Écrans à dessiner

### 1. Courses : reprendre et compléter

En-tête sobre, puis carte de la liste en cours avec nombre réel d’articles,
date de dernière modification et « Reprendre ma liste ». Sans brouillon,
« Commencer une liste ». Bandeau photographique conforme à la référence,
assez compact pour laisser apparaître les favoris dans le premier écran.

Ensuite : quelques favoris avec photo, conditionnement et bouton + ; accès
« Tous mes favoris ». Champ « Ajouter un produit » et bouton « Scanner »
identifiables au même endroit. Un travail Chrome en cours remplace un simple
badge par une phrase utile : « En attente de ton ordinateur » et « Voir le suivi ».

### 2. Ma liste : l’écran principal de travail

Deux onglets « À acheter » et « Déjà chez moi ». Sections par rayon, lignes
blanches avec photo, nom, conditionnement et compteur. Déplacer un article
vers « Déjà chez moi » doit le retirer effectivement de l’envoi. Pour éviter
l’ambiguïté d’une case à cocher, libeller cette action dans la fiche et pour
VoiceOver ; réserver un éventuel mode « acheté en magasin » à un autre statut.

Une ligne issue d’une recette donne accès à sa provenance et au calcul :
« Besoin : 350 g · paquet : 200 g · à acheter : 2 ». Changer de produit ouvre
une fiche courte ; les options avancées ne sont pas affichées sur chaque ligne.

Ajout manuel, favoris et repas restent accessibles depuis cette liste.
Le bouton inférieur « Choisir mon drive » devient disponible dès qu’un
article est présent. Supprimer propose « Annuler » sans déplacer la liste.

### 3. Favoris et scan : deux intentions distinctes

Un favori signifie « je rachète souvent ce produit », pas « il est dans ma
liste actuelle ». Les boutons emploient explicitement ces deux formulations.

Scan → fiche avec photo, nom et conditionnement → « Enregistrer en favori ».
Proposer ensuite « Ajouter aussi à ma liste ». Pour un favori existant,
afficher son état et permettre l’ajout à la liste sans créer un doublon.

Conserver la correction du rayon, le produit inconnu et la file hors ligne.
Afficher les scans en attente avec une action de reprise ; ne pas annoncer
une synchronisation en arrière-plan si elle ne se déclenche qu’au retour à l’écran.

### 4. Recettes : choisir avant de gérer

Recherche, filtres utiles fondés sur les données disponibles, puis cartes avec
photo rectangulaire, titre, durée connue et portions. Bouton « Ajouter aux
repas », compteur de portions modifiable et accès immédiat à la liste mise à
jour. Importer et créer restent disponibles dans une action « Ajouter une recette ».

Ne pas inventer de durée, note nutritionnelle ou photo de marque. Les images
générées déjà disponibles pour le web doivent être intégrées au mécanisme
d’images natif : copier les fichiers seuls ne modifie pas l’app iPhone.

### 5. Drive et suivi : rendre le passage à Chrome compréhensible

Choix du drive puis récapitulatif final : articles, quantités, éventuels produits
à préciser. Action « Envoyer à mon ordinateur ». Expliquer avant l’envoi que
Chrome doit être ouvert et l’extension connectée au même compte.

Après envoi : « Liste envoyée », puis instruction « Ouvre Courses dans Chrome
et clique sur Remplir le panier ». Distinguer attente, remplissage, intervention,
résultat complet et résultat partiel. Afficher les produits non ajoutés et une
voie de correction. Ne déclarer l’extension « connectée » ou « prête » qu’avec
une information de présence réelle ; c’est une fonction supplémentaire à prévoir.

## Direction visuelle

Vert olive `#48613a`, fond clair verdâtre `#f5f7f2`, cartes blanches, texte
sombre : reprendre la référence fournie, sans nouveau changement d’identité.
Typographie native lisible, titres courts, informations secondaires discrètes.
Photos de produits en entier ; recettes cadrées sans masque circulaire.
Un bouton principal par écran, actions proches du pouce, gestes accompagnés
d’une alternative visible. Prévoir grandes tailles de texte, VoiceOver,
zones tactiles confortables et réduction des animations.

## Ordre de réalisation et critères de validation

1. **Fiabilité du parcours** : brouillon persistant, choix et quantités cohérents,
   aucun blocage sans favoris. Test : sélectionner une recette sans favoris,
   fermer l’app, reprendre et envoyer exactement les articles affichés.
2. **Accueil et liste** : implémenter dans Expo les deux écrans de la référence.
   Test : ajouter trois favoris, modifier une quantité, indiquer un produit
   déjà possédé, sans traverser les cinq étapes actuelles.
3. **Favoris, scan et recettes** : unifier les actions et intégrer les photos
   manquantes au rendu natif. Test : scan nouveau, doublon, inconnu et hors ligne ;
   aucune photo existante remplacée ; mise à jour des portions dans la liste.
4. **Drive et suivi** : valider le passage iPhone → Supabase → Chrome avec une
   liste de contrôle, incluant un article indisponible. Aucun paiement automatique.
5. **Validation sur iPhone** : petit écran, grande police, VoiceOver, clavier,
   retour d’arrière-plan et connexion instable. Captures de la vraie app pour
   comparer avec la maquette avant de distribuer une version signée.

Chaque lot doit être vérifié dans `mobile/`. Une capture du site web ou un test
unitaire réussi ne vaut pas validation du parcours dans l’application installée.
