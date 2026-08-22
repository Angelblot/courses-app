# Import de recettes par lien

**Date :** 22 août 2026
**Statut :** validé, prêt pour le plan d'implémentation

## Objet

Coller l'adresse d'une recette trouvée sur un site de cuisine et la créer
automatiquement, plutôt que de ressaisir sept ingrédients à la main.

C'est le besoin numéro deux du brief produit — « importer des recettes qui
génèrent la liste des produits nécessaires » — resté sans réponse depuis le
début.

## Décisions structurantes

| Question | Décision |
|---|---|
| Qui récupère la page | Une fonction Edge |
| Ingrédients sans quantité | Importés à zéro, signalés à vérifier |
| Pages sans `schema.org/Recipe` | Échec clair, **aucun raclage de HTML** |
| Agent utilisé | Honnête, jamais déguisé en navigateur |

## Ce qui a été vérifié avant de concevoir

Sur deux sites français — Marmiton et CuisineAZ — la page répond `200` et
contient un bloc `application/ld+json` de type `Recipe`. Mesuré le 22/08.

**Un `User-Agent` honnête suffit.** Une première mesure employait une chaîne de
navigateur ; refaite avec `courses-app/1.0`, la réponse est identique — même
code, même taille, même bloc. Le projet n'a donc aucune raison de se déguiser,
et ne le fera pas : c'est la même position que pour l'extension.

`robots.txt` de Marmiton interdit des chemins de recherche et d'impression,
**pas les pages de recette**. Lire une page dont l'utilisateur a lui-même collé
l'adresse est permis.

Les lignes réellement rendues :

```
600 g de bourguignon
1 bouteille de vin rouge assez bon
4 oignons
sel
poivre
```

Deux enseignements : des **unités absentes de notre liste** — « bouteille »,
« bouquet » — et des **lignes sans aucune quantité**. `recipeYield` vaut par
ailleurs `"4 personnes"`, une chaîne.

## Le partage des rôles

**La fonction Edge `importer-recette`** reçoit une adresse, récupère la page,
extrait le bloc `Recipe`, et rend les champs bruts : nom, parts, image, et les
lignes d'ingrédients **telles quelles**, sans les analyser.

**L'analyseur d'ingrédients vit dans l'application**, en fonction pure.

Ce partage n'est pas arbitraire. La récupération est fragile — les sites
changent — et doit pouvoir se corriger sans passer par un build : vingt-cinq
minutes par essai, et deux échecs de compilation dans la seule journée du 22/08.
L'analyse, elle, est de la logique pure : testable sous Node, et c'est elle qui
servira au scan de fiche quand ce chantier viendra.

## L'analyseur

`analyserLigne(ligne)` rend `{ quantite, unite, nom, aVerifier }`.

| Forme | Exemple | Résultat |
|---|---|---|
| `<n> <unité> de <nom>` | `600 g de bourguignon` | 600 · g · bourguignon |
| `<n> <unité inconnue> de <nom>` | `1 bouteille de vin rouge` | 1 · bouteille · vin rouge |
| `<n> <nom>` | `4 oignons` | 4 · unité · oignons |
| `<nom>` seul | `sel` | **0** · unité · sel, `aVerifier` |

Il accepte les fractions — `1/2` — et les décimales à la française — `1,5`.

**Une unité inconnue n'est retenue que si elle précède un « de ».** Sans cette
règle, « 4 oignons » ferait de « oignons » une unité et laisserait un nom vide.

`recipeYield` peut être une chaîne, un nombre ou un tableau : on en extrait le
premier entier, et 4 à défaut.

## L'aperçu avant enregistrement

**L'import n'enregistre jamais directement.** Il montre ce qu'il a compris — nom,
photo, parts, et chaque ingrédient avec sa quantité, son unité et son nom, tous
modifiables — puis attend une validation.

Les ingrédients marqués `aVerifier` portent la mention « quantité à vérifier ».

C'est la pièce qui rend le reste acceptable : on ne peut pas garantir l'analyse
d'une phrase libre. Enregistrer sans montrer produirait des recettes fausses
qu'on ne découvrirait qu'au wizard, une fois la liste partie au panier.

## Le rattachement au catalogue

Chaque ingrédient passe par `normalizeProductType`, puis on cherche un produit
du catalogue portant ce type. S'il en existe un, l'ingrédient lui est rattaché ;
sinon il reste libre, et l'aperçu le signale — comme le fait déjà l'écran de
détail d'une recette.

## Tests

- **L'analyseur**, sur les cinq lignes réelles mesurées, plus les fractions, les
  décimales à la française, une unité inconnue sans « de », et une ligne vide.
- **`recipeYield`** : chaîne, nombre, tableau, absent.
- **Extraction du bloc JSON-LD** : bloc unique, tableau, `@graph`, aucun bloc,
  JSON malformé.
- La fonction Edge n'est pas couverte par des tests : son travail est un appel
  réseau et une extraction, tous deux éprouvés sur des pages réelles.

## Ce qui n'est pas construit

- **Le raclage de HTML** quand la page n'expose pas de `Recipe`. Deviner la
  structure d'une page est un puits sans fond qui se casse à chaque refonte.
- **Le scan d'une fiche par OCR** — chantier suivant, qui réutilisera
  l'analyseur.
- **L'import depuis le presse-papiers**, qui viendra si le collage manuel
  s'avère pénible.
