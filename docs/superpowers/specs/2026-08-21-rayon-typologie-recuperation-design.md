# Rayon, typologie et récupération de mot de passe

**Date :** 21 août 2026
**Statut :** validé, prêt pour le plan d'implémentation

## Objet

Trois correctifs révélés par la première utilisation réelle de l'application sur
iPhone, le 21 août, après sa mise à disposition par TestFlight.

Le scan fonctionne : deux produits ont été ajoutés au catalogue, avec leur image,
leur grammage et leur volume corrects. Ce sont les champs déduits qui sont faux,
et l'accès au compte qui n'a pas de porte de secours.

## Les trois défauts

| # | Constat | Cause |
|---|---|---|
| 1 | Un produit scanné n'a aucun rayon | `stores/products.ts` n'écrit pas `category` |
| 2 | La typologie retient l'arôme, pas la nature | les 63 règles lisent le nom seul |
| 3 | Un mot de passe oublié enferme dehors | l'écran ne sait faire que `signInWithPassword` |

Le défaut 2, mesuré :

| Produit | Retenu | Attendu |
|---|---|---|
| Boursin Onctueux Ail & Fines Herbes | `ail` | `fromage` |
| Teisseire Menthe Verte | `menthe` | `sirop` |

C'est la même famille d'erreur que la Tourtel classée en `jus` pendant le portage :
la règle `' ail '` attrape « Ail & Fines Herbes », et la règle `fromage` ne se
déclenche pas puisque le mot n'apparaît pas dans le nom.

## La découverte qui règle les défauts 1 et 2

`categories_tags` d'Open Food Facts est **déjà récupéré** par
`lib/openfoodfacts.ts` — il sert à détecter les liquides, puis il est jeté.

```
Boursin        en:dairies · en:fermented-milk-products · en:cheeses
Menthe Verte   en:beverages · en:syrups · en:flavoured-syrups · en:mint-syrups
```

Le rayon et la nature y sont tous les deux lisibles. Les deux défauts ont donc une
seule cause — deviner à partir du nom quand une donnée fiable est disponible — et
un seul correctif.

## 1. Le rayon

### D'où il vient

Une table de correspondance traduit les étiquettes d'Open Food Facts vers les
10 rayons de la table `categories`.

**L'ordre de résolution est une priorité par rayon, pas la spécificité de
l'étiquette.** Une pizza surgelée porte `en:frozen-foods` et `en:pizzas` ; prendre
l'étiquette la plus précise l'enverrait en épicerie. Le rayon est un emplacement
physique dans le magasin : les surgelés l'emportent sur ce que contient le paquet.

| Ordre | Rayon | Étiquettes |
|---|---|---|
| 1 | `surgeles` | `frozen-foods` |
| 2 | `boissons` | `beverages`, `waters`, `juices`, `syrups`, `sodas`, `beers`, `wines`, `alcoholic-beverages` |
| 3 | `charcuterie` | `charcuteries`, `hams`, `sausages`, `prepared-meats`, `delicatessen` |
| 4 | `pls` | `dairies`, `cheeses`, `yogurts`, `milks`, `creams`, `butters`, `eggs` |
| 5 | `fruits_legumes` | `fresh-vegetables`, `fresh-fruits` |
| 6 | `epicerie` | des étiquettes existent, aucune ne correspond |
| 7 | `autre` | `categories_tags` absent ou vide |

Open Food Facts ne couvre que l'alimentaire. Un produit de droguerie, d'hygiène ou
de maison n'y sera pas trouvé du tout : il passe par le formulaire de saisie
manuelle, où le rayon est choisi à la main. Le sélecteur décrit plus bas couvre ce
cas sans travail supplémentaire.

### Où il est rangé

`products.category` contient aujourd'hui les **libellés de ticket de caisse
Carrefour** — `P.L.S.`, `CHARCUT.TRAITEUR`, et même
`ARTICLES INDISPONIBLES / NON FACTURÉS`, qui n'est pas un rayon. La table
`categories` propose en parallèle 10 rayons propres et ordonnés, et
`category_aliases` contient déjà la traduction exacte entre les deux.

Le champ est normalisé en clés canoniques (`pls`, `boissons`…) et les 65 lignes
existantes sont migrées via `category_aliases`.

La clé est ce qui est **stocké** ; l'interface affiche toujours le `label` de la
table `categories` (« Produits laitiers »), jamais la clé. L'ordre d'affichage des
rayons suit `display_order`.

**Cette normalisation est sans risque et ne le restera pas.** Vérifié le 21/08 :
côté Supabase, `products.category` n'a aucun lecteur. Le mobile le sélectionne
sans jamais l'afficher, l'extension l'ignore, et le front web interroge encore
l'ancien FastAPI. C'est le dernier moment où l'opération est gratuite ; dès que le
wizard sera porté, elle deviendra une migration à risque.

`ARTICLES INDISPONIBLES / NON FACTURÉS` devient `autre`, ce qui est correct.

## 2. La typologie

`normalizeProductType` reçoit une première passe sur `categories_tags`. Les
63 règles par nom deviennent le recours, employé quand aucune étiquette ne
tranche — produit absent d'Open Food Facts, ou saisi à la main.

Les 63 règles ne sont pas retouchées. Leur défaut n'est pas d'être fausses mais
d'être interrogées trop tôt : `' ail '` reste un indice utile pour une gousse
d'ail, et cesse de nuire dès qu'une catégorie fiable la précède.

## 3. La fiche de scan

Le rayon déduit s'affiche sous la contenance. Un tap dessus ouvre un sélecteur des
10 rayons en bottom-sheet, conformément aux conventions du projet — pas de modal
centré, pas d'emoji, thème clair.

Le parcours nominal ne s'allonge pas : viser, la fiche remonte, **Ajouter**. Le
sélecteur ne s'ouvre que si le rayon proposé est faux.

États à couvrir : rayon déduit, rayon absent (`autre` proposé), rayon corrigé à la
main.

## 4. Mot de passe oublié

Un lien discret sous le bouton de connexion.

`resetPasswordForEmail` avec le **flux PKCE** plutôt que le fragment `#` : sur
mobile, le lien profond porte alors un paramètre `code` que l'application échange
contre une session par `exchangeCodeForSession`. Le fragment survit mal au passage
par le système ; le paramètre de requête, lui, arrive intact.

L'écran de saisie appelle ensuite `updateUser({ password })`.

**Manipulation requise côté Supabase :** ajouter `coursesapp://reinitialisation`
aux Redirect URLs du projet. Le schéma `coursesapp` est déjà déclaré dans
`app.json`.

**C'est le point le plus risqué des trois.** Le lien profond ne peut être vérifié
qu'une fois la version installée sur un vrai téléphone : ni le simulateur ni Expo
Go ne reproduisent fidèlement le trajet d'un lien reçu par courriel.

### Pas d'inscription ouverte

Décidé le 21/08, après que le partage du foyer a été demandé : l'entrée normale
d'un second membre sera **l'acceptation d'une invitation**, pas une inscription
autonome. Ouvrir l'inscription maintenant fabriquerait des comptes orphelins, au
catalogue vide, qu'il faudrait ensuite rattacher à la main.

## Tests

- **Correspondance Open Food Facts → rayon** : les deux cas mesurés, la priorité
  des surgelés sur le contenu du paquet, l'absence d'étiquette, un produit non
  alimentaire.
- **Typologie** : Boursin → `fromage`, Menthe Verte → `sirop`, et non-régression
  des 63 règles existantes lorsqu'aucune étiquette n'est disponible.

**Ces tests ne s'exécuteront pas sur la machine d'Angelo.** Node y est en v20, qui
ne sait pas charger un fichier `.ts` ; `npm test` échoue aujourd'hui sur les
4 fichiers avec `ERR_UNKNOWN_FILE_EXTENSION`. Le dépouillement de types demande
Node 22.6 ou plus. Ce n'est pas une raison de ne pas les écrire, mais il faut le
savoir : un `npm test` rouge ne dira rien sur le code tant que Node n'aura pas été
mis à jour.

## Ce qui n'est pas construit

- **Le partage du foyer et l'invitation** — demandés le 21/08, ils feront l'objet
  de leur propre conception. Le coût n'est pas dans la base : les 7 tables portent
  une clause RLS identique, `(select auth.uid()) = user_id`, à remplacer sept fois
  mécaniquement. Il est dans le reste — table d'invitations avec jetons et
  expiration, création du foyer et rattachement des 65 produits, définition de
  « même vue » (temps réel ou rafraîchissement), et sort des données quand
  quelqu'un quitte le foyer.
- **La reprise manuelle des rayons des 65 produits** au-delà de la traduction
  mécanique par `category_aliases`.
- **Le wizard** (lot 4) et le pont vers l'extension (lot 5).

Aucun des trois correctifs ne gêne le foyer : le rayon et la typologie sont des
propriétés du produit, pas de l'utilisateur, et la récupération de mot de passe
est indépendante de qui possède quoi.
