# Lot 4 — Wizard, création de recettes et Nutriscore

**Date :** 22 août 2026
**Statut :** validé, prêt pour le plan d'implémentation

## Objet

Porter le wizard de génération de liste sur l'application mobile, lui donner de
quoi créer des recettes, et afficher le Nutriscore des produits.

Le scan a été éprouvé sur appareil le 21/08. La condition posée le 18/08 pour
ouvrir ce lot — « une fois le scan éprouvé à l'usage » — est remplie.

## Ce qui existe déjà, et qui n'est pas perdu

Le wizard vit dans le front web : 2740 lignes réparties sur `WizardPage.jsx`,
`wizardStore.js`, huit composants d'étape et `SwipeStack.jsx`. La création de
recettes aussi : 648 lignes, dont un formulaire de 368. Rien n'a été supprimé ;
ces fichiers sont intacts et servent de modèle.

Le front web n'est cependant pas un repli utilisable : il interroge un backend
FastAPI hébergé sur une instance Render suspendue, et sa base SQLite est figée au
28 avril avec 65 produits, quand Supabase en compte 67. **Les deux ont divergé.**

## Décisions structurantes

| Question | Décision |
|---|---|
| Sortie du wizard | Écriture dans `cart_jobs`. Voir « L'angle mort assumé » |
| Étape de rapprochement ingrédient → produit | **Portée en entier**, jugée essentielle |
| Création de recettes | À la main. L'import web et l'OCR ont leur propre conception |
| État partagé | Contexte React, pas de nouvelle bibliothèque |
| Animation des cartes | `Animated` du cœur, pas de `react-native-reanimated` |

## Architecture

```
mobile/
  app/(tabs)/
    _layout.tsx              cinq onglets : Recettes · Wizard · Scan · Produits · Compte
    recettes/index.tsx       liste des recettes
    recettes/nouvelle.tsx    formulaire de création
    wizard/[etape].tsx       coquille : progression, bouton d'action, aiguillage
  contexts/WizardContext.tsx état des cinq étapes
  lib/
    consolidation.ts         buildConsolidatedItems · groupByRayon · getRecipeUsage
                             · getRecipeIngredientMatches
    unites.ts                unitConverter porté
  components/wizard/
    PileSwipe.tsx            SwipeStack porté
    EtapeRecettes · EtapeQuotidien · EtapeIngredients · EtapeRecap · EtapeGeneration
  stores/recipes.ts          lecture et écriture des recettes
```

### Pas de nouvelle dépendance native

`react-native-gesture-handler` est **déjà installé** — expo-router en dépend. Le
mode tinder s'appuie dessus, et l'animation sur l'`Animated` du cœur de React
Native.

`react-native-reanimated` donnerait des transitions plus fluides mais impose un
nouveau pod, donc un `prebuild` et un `pod install` modifiés. La chaîne de
compilation Xcode Cloud vient de se stabiliser après trois builds dont un échec ;
ce n'est pas le moment de la remuer pour du confort d'animation.

`zustand` n'est pas installé côté mobile, et le projet fonctionne avec des hooks
maison — voir `stores/products.ts`. Un contexte React suffit pour cinq écrans.

## Les fonctions pures se déplacent telles quelles

`getRecipeUsage`, `buildConsolidatedItems`, `groupByRayon`,
`getRecipeIngredientMatches` et `unitConverter` ne touchent pas au DOM. Elles
changent de fichier, pas de comportement, et emportent leurs tests.

### `product_type` n'a pas besoin d'être stocké

Le wizard web s'appuie sur `ing.product_type` pour rapprocher un ingrédient d'un
produit. Cette colonne n'existe ni dans SQLite ni dans Supabase : le backend la
**calcule à la volée**, par `normalize_product_type(self.name)` dans
`schemas/recipe.py`.

Cette fonction est déjà portée en TypeScript — `normalizeProductType` dans
`lib/typology.ts`, améliorée le 21/08 pour consulter les catégories Open Food
Facts avant le nom. Le mobile calcule donc `product_type` de la même façon, sans
colonne ni migration.

## Un seul vocabulaire de rayons

Trois vocabulaires coexistaient. Deux ont été unifiés le 21/08 ; le troisième
reste.

| `recipe_ingredients.rayon` | Lignes | Clé retenue |
|---|---|---|
| Produits laitiers | 12 | `pls` |
| Fruits et légumes | 7 | `fruits_legumes` |
| Épicerie | 4 | `epicerie` |
| Boucherie | 2 | `pls` |
| Charcuterie | 1 | `charcuterie` |

Une migration normalise ces 26 lignes vers les clés canoniques, comme
`0005_normalisation_rayons.sql` l'a fait pour les produits. Sans elle, le
récapitulatif afficherait le même rayon deux fois sous deux noms.

**« Boucherie » devient `pls`, et c'est délibéré.** Les 10 rayons viennent des
sections du ticket Carrefour, où la boucherie n'existe pas : « Filets de poulet
jaune CARREFOUR » y est rangé en P.L.S. Le rayon sert à retrouver le produit dans
le drive, pas à classer selon la logique culinaire.

Le récapitulatif groupe ensuite par clé, affiche le libellé, et suit l'ordre de
`display_order` — et non l'ordre alphabétique du web, qui plaçait « Épicerie »
avant « Fruits & légumes ».

## Les cinq étapes

1. **Recettes** — pile de cartes à faire glisser, nombre de parts ajustable.
2. **Quotidien** — pile de cartes, « tu as déjà ça ? » en un tap.
3. **Ingrédients** — pour chaque ingrédient, le produit du catalogue retenu et
   les autres candidats de même `product_type`.
4. **Récap** — liste consolidée, groupée par rayon.
5. **Génération** — choix des drives, puis écriture dans `cart_jobs`.

L'étape 3 pèse près d'un tiers du wizard web (892 lignes avec sa feuille de
substitution). Elle est portée en entier : sans elle, « Lardons fumés » part vers
l'extension sous un nom générique, et l'ambiguïté qu'on a passé une semaine à
maîtriser dans l'extension reviendrait par la porte de derrière.

## Création de recettes

Deux écrans : la liste des recettes, et un formulaire — nom, nombre de parts par
défaut, puis les ingrédients avec quantité par part, unité et rayon.

Les unités reprennent celles du formulaire web : `unité`, `g`, `kg`, `ml`, `L`,
`pincée`, `cuillère à café`, `cuillère à soupe`.

Le rayon est proposé automatiquement : `normalizeProductType` sur le nom de
l'ingrédient, puis le rayon du premier produit du catalogue portant ce type. Sans
correspondance, `autre` est proposé — jamais un champ vide. Le sélecteur construit
le 21/08 permet de corriger.

**L'édition et la suppression sont hors périmètre.** Créer et lire suffisent à
rendre le wizard utilisable ; modifier une recette existante demande de gérer la
réconciliation des ingrédients, ce qui mérite son propre écran.

## Le Nutriscore

Une colonne `nutriscore` sur `products`, contrainte aux valeurs `a` à `e` ou
`NULL`, alimentée par le champ `nutriscore_grade` d'Open Food Facts. Il suffit de
l'ajouter à la requête déjà faite au moment du scan.

L'affichage reprend les pastilles **déjà spécifiées dans `DESIGN.md` §1.2 bis** —
les cinq couleurs `--color-nutri-a` à `--color-nutri-e` y sont définies depuis le
début et n'avaient jamais été employées. Elles apparaissent sur la fiche de scan
et dans le catalogue.

Un rattrapage complète les 65 produits déjà en base : ils ont tous un EAN13, donc
un passage unique sur l'API leur donne leur Nutriscore rétroactivement. Le
traitement est espacé pour rester courtois envers un service gratuit, et un
produit qu'Open Food Facts ne note pas garde simplement `NULL` — beaucoup de
produits n'ont pas de Nutriscore, ce n'est pas une erreur.

## L'angle mort assumé

Le wizard écrit sa liste dans `cart_jobs`, la table posée au commit `fd57ba1` :
`status` à `pending`, `drives` avec les enseignes retenues, et `items` portant la
liste consolidée — un objet par ligne avec `name`, `quantity`, `unit`, `ean13`
lorsqu'il est connu, et `category` en clé canonique. C'est la forme dont
l'extension aura besoin au lot 5, `ean13` compris : c'est lui qui rend l'ajout
certain chez Carrefour.

**Rien ne lit cette table aujourd'hui.** L'extension ne saura la relever qu'au
lot 5. Entre la livraison de ce lot et celle du suivant, terminer le wizard
n'aura donc aucun effet visible sur le Mac : la liste dormira en base.

C'est un choix délibéré, cohérent si le lot 5 suit de près. L'alternative —
produire la liste au format texte de l'extension et la partager depuis le
téléphone — a été écartée le 22/08.

## Tests

- **Fonctions pures**, au `node --test` : consolidation, conversion d'unités,
  rapprochement ingrédient → produit. Les tests existants du web sont portés.
- **Normalisation des rayons** : les cinq libellés rencontrés, dont « Boucherie ».
- **Nutriscore** : une note valide, une absente, une valeur inattendue.
- **Migration** : après application, aucun `rayon` hors des clés canoniques.

Rappel : ces tests exigent **Node ≥ 22**. La version par défaut de la machine est
la 20, qui ne charge pas les `.ts`.

## Ce qui n'est pas construit

- **L'import de recettes depuis un site web** et la lecture du presse-papiers.
  Le format `schema.org/Recipe` rend la chose fiable, mais chaque ingrédient
  reste une phrase libre à découper en quantité, unité et nom. Cet analyseur est
  le vrai cœur difficile, commun à l'import et à l'OCR : il mérite sa conception
  et ses tests.
- **Le scan d'une fiche recette.** Aucun module OCR de première partie chez
  Expo ; il faudrait un module natif et un nouveau prebuild. Et l'analyseur
  d'ingrédients doit faire ses preuves sur du texte propre avant d'affronter une
  photo.
- **L'extension de partage iOS**, qui exige une cible native supplémentaire.
- **L'édition et la suppression de recettes.**
- **Le lot 5** — pont entre l'extension et `cart_jobs` — et le **lot 6**, retrait
  de FastAPI et du front web.
