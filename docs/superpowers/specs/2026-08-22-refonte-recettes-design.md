# Refonte des recettes

**Date :** 22 août 2026
**Statut :** validé, prêt pour le plan d'implémentation

## Objet

Rendre les recettes présentables et utilisables : une liste qui donne envie, un
écran de détail qui manquait, une création qui ne soit plus un formulaire brut,
et la possibilité de modifier ou supprimer.

La référence assumée est Jow : grandes photos, densité faible, ingrédients
rattachés à de vrais produits.

## Le constat qui a déclenché ce lot

À l'usage sur TestFlight, la liste des recettes se réduisait à des lignes de
texte, on ne pouvait pas ouvrir une recette pour voir ses ingrédients, et le
formulaire de création demandait de tout saisir à la main — au risque de créer
des produits qui existaient déjà.

**Les photos, elles, étaient déjà là.** Les cinq recettes migrées portent toutes
une `image_url` et une `description` ; c'est l'interface qui les ignorait. Le
diagnostic initial — « tes recettes n'ont pas d'image » — était faux, tiré de
l'écran plutôt que de la base.

## Décisions structurantes

| Question | Décision |
|---|---|
| Photo à la création | Appareil ou bibliothèque, déposée dans Supabase Storage |
| Livraison de la photo | **Seconde phase**, à part — voir « L'ordre et pourquoi » |
| Modification | Modifier et supprimer depuis le détail |
| Réconciliation des ingrédients | Remplacement, pas fusion |
| Recherche de produits | Catalogue d'abord, Open Food Facts sur demande explicite |

## L'ordre, et pourquoi

Les quatre écrans n'ajoutent **aucune dépendance native** : ils partent dès
qu'ils sont prêts.

La photo impose `expo-image-picker`, donc un `prebuild` qui régénère le dossier
`ios/` — celui-là même qui contient `ci_scripts/ci_post_clone.sh`. Elle demande
aussi un bucket Supabase, inexistant à ce jour, et ses politiques.

La chaîne de compilation a cédé deux fois le 22/08 sur des coupures réseau
— hermes-engine depuis Maven Central, puis Node depuis ghcr.io. Ce n'est pas le
moment de la remuer pour une fonctionnalité de confort. La photo est donc la
seconde phase du lot, livrée séparément : si elle accroche, la refonte est déjà
sur le téléphone.

## Les quatre écrans

### La liste

Cartes larges : photo en bandeau, nom, nombre de parts et d'ingrédients.

Une recette sans photo reçoit un **aplat de couleur portant son initiale**.
La couleur est choisie dans une palette de six teintes sourdes, par une somme
des codes de caractères du nom modulo six : la même recette garde donc toujours
la même couleur, sans qu'il faille la stocker. Jamais une image
générique récupérée ailleurs : une fausse photo dit quelque chose de faux.

### Le détail

Il n'existait pas. Il porte la photo en bandeau, la description, puis les
ingrédients.

**Les quantités se recalculent selon le nombre de parts**, ajustable sur l'écran.
Une recette prévue pour 4 affichée à 6 montre ses quantités pour 6 — c'est la
question qu'on se pose en cuisine, pas celle du fichier d'origine.

Cet ajustement **ne modifie pas la recette** : il ne sert qu'à la lecture, et
repart de `servings_default` à chaque ouverture. Changer la valeur enregistrée
passe par la modification, explicitement.

Chaque ingrédient rattaché à un produit du catalogue montre sa vignette. Les
autres portent la mention **« non rattaché »**. Ce n'est pas décoratif : 12 des
26 ingrédients migrés sont dans ce cas, et ce sont exactement ceux pour lesquels
l'extension devra deviner, avec le risque d'ambiguïté connu.

### La création

Le formulaire brut disparaît. Chaque ingrédient s'ajoute par une **recherche**.

1. **Ton catalogue d'abord** — 68 produits, filtrés en mémoire, sans réseau et
   sans latence. Chaque résultat montre sa vignette, sa marque et sa contenance.
2. **Open Food Facts ensuite**, derrière un bouton explicite. Choisir un résultat
   **crée le produit dans ton catalogue** — même code que le scan, donc même
   image, même code-barres, même Nutriscore, même rayon déduit — puis rattache
   l'ingrédient à ce produit tout neuf.
3. **Saisie libre en dernier recours**, pour ce qu'aucune des deux ne connaît.

C'est le troisième chemin qui produit les ingrédients non rattachés ; le rendre
possible mais peu tentant est délibéré.

### La modification et la suppression

Depuis le détail. **Modifier remplace la liste d'ingrédients** par la nouvelle,
sans tenter de fusionner : une fusion intelligente serait subtile à écrire et
impossible à vérifier d'un coup d'œil. Le remplacement est prévisible.

Supprimer une recette supprime ses ingrédients — la clé étrangère est déjà en
`ON DELETE CASCADE`, vérifié le 22/08. La suppression demande confirmation.

## La recherche Open Food Facts

**La route moderne est indisponible.** `/api/v2/search` répond `503`
— « Page temporarily unavailable », mesuré le 22/08. L'ancienne route fonctionne :

```
/cgi/search.pl?search_terms=…&search_simple=1&action=process&json=1
```

« lardons fumés » rend 896 résultats, dont le Herta portant l'EAN
`3154230802280` — déjà présent dans le catalogue. La correspondance par
code-barres permettra donc de signaler « tu l'as déjà » plutôt que de créer un
doublon : le résultat est affiché comme **déjà au catalogue**, et le choisir
rattache l'ingrédient au produit existant sans rien insérer.

**Jamais de recherche à la frappe.** Elle part sur validation explicite, après
trois caractères au moins. Open Food Facts est un service gratuit qui vient de
répondre 503 ; l'interroger à chaque lettre serait à la fois discourtois et
fragile. L'échec est traité comme un état ordinaire, pas comme une erreur : le
catalogue local reste utilisable.

## La photo — seconde phase

`expo-image-picker` pour l'appareil et la bibliothèque. Le fichier est déposé
dans un bucket Supabase `recettes`, avec une politique par utilisateur ;
`image_url` porte l'adresse rendue.

Une adresse locale `file://` ne convient pas : elle ne survivrait ni à une
réinstallation, ni au partage du foyer prévu plus tard.

Le texte d'autorisation de la photothèque est à ajouter — celui de l'appareil
photo existe déjà pour le scan.

## Ce qui ne change pas

- **Zéro emoji**, thème clair, jetons de `lib/theme.ts`.
- **Messages d'erreur en français**, jamais la réponse brute d'un service.
- **Aucune dépendance native dans la première phase.**
- Les fonctions pures du wizard ne sont pas touchées.

## Tests

- **Mise à l'échelle des quantités** : une recette pour 4 affichée à 6, une
  affichée à 1, une quantité nulle.
- **Filtrage du catalogue** : accents, casse, marque, correspondance partielle.
- **Analyse d'une réponse Open Food Facts** de recherche, y compris vide et
  malformée.
- **Détection du doublon par code-barres** entre un résultat Open Food Facts et
  le catalogue.
- **Couleur d'aplat** : stable pour un même nom, différente pour deux noms.

## Ce qui n'est pas construit

- **L'import d'une recette par lien ou par photo** — sa propre conception ; le
  cœur difficile en est l'analyse d'une ligne d'ingrédient en français.
- **Le compte et le partage du foyer.**
- **Le bandeau de suivi persistant** à la Uber Eats.
- **La fusion fine des ingrédients** à la modification.
