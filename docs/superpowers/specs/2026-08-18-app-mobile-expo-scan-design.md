# Application mobile Expo avec scan de codes-barres

**Date :** 18 août 2026
**Statut :** validé, prêt pour le plan d'implémentation

## Objet

Porter courses-app en application iPhone native (Expo / React Native), distribuée
par TestFlight, et lui ajouter le scan de codes-barres pour alimenter le catalogue
de produits favoris depuis le domicile.

Ce virage règle au passage un point resté ouvert de l'audit du 18/08 : le backend
FastAPI est hébergé sur une instance Render suspendue, et un téléphone ne peut pas
interroger un serveur mort. La migration vers Supabase devient donc obligatoire, et
supprime le problème plutôt que de le déplacer.

## Décisions structurantes

| Question | Décision |
|---|---|
| Périmètre de la v1 | Scan, favoris **et** wizard |
| Backend | **Supprimé.** L'app parle directement à Supabase, la sécurité repose sur RLS |
| Distribution | Expo Go d'abord, puis EAS Build → TestFlight (compte Apple Developer disponible) |
| Liaison téléphone → Mac | L'extension Chrome s'authentifie auprès de Supabase et relève les listes en attente |
| Front web React/Vite | **Retiré.** Conservé dans l'historique Git, plus maintenu |
| Identifiants drive | **Jamais stockés** — voir « Ce qui ne sera pas construit » |

## Architecture

```
iPhone (Expo)  ──┐
                 ├──►  Supabase (Postgres + Auth + Realtime)  ◄──  Extension Chrome (Mac)
Open Food Facts ─┘
```

Trois composants au lieu de quatre. Supabase est l'unique source de vérité :
données, authentification, et file `cart_jobs` déjà en place depuis le commit
`fd57ba1`. Open Food Facts est appelé directement depuis le téléphone au moment du
scan.

Disparaissent : le backend FastAPI, l'hébergement Render, le front web.

## Modèle de données

### Tables migrées

| Table | Lignes | Remarque |
|---|---|---|
| `products` | 65 | le cœur du catalogue ; tous ont un EAN13 |
| `recipes` + `recipe_ingredients` | 5 + 26 | |
| `categories` + `category_aliases` | 10 + 10 | |
| `purchase_lines` | 65 | historique de prix — **préservation de données, pas une fonctionnalité de la v1** ; aucun écran mobile ne le lit encore |
| `product_equivalents` | 0 | vide, mais son schéma est repris et enrichi (voir ci-dessous) |

Chaque table reçoit une colonne `user_id` et une politique RLS calquée sur celle de
`cart_jobs`.

**La v1 est mono-utilisateur.** Chaque compte a son propre catalogue : si un second
membre du foyer installe l'application, il démarre sur une base vide. Le partage
familial figure au brief produit (priorité 5) mais reste **hors périmètre** ici.

Pour ne pas fermer cette porte, les politiques RLS sont écrites en une seule clause
par table, réutilisant systématiquement `auth.uid() = user_id`. Introduire plus tard
un foyer consistera à ajouter une table `households`, une colonne `household_id`, et
à remplacer cette clause unique — sans toucher aux écrans ni aux requêtes.

### Tables abandonnées

- `foods`, `food_products` — couche ALIMENT déjà supprimée du code au commit `678df88`
- `shopping_lists`, `list_items`, `wizard_sessions` — vides, et le wizard consolide
  côté client
- `drive_configs` — l'extension utilise la session du navigateur ; plus aucun
  identifiant à stocker

Ce dernier point supprime définitivement la responsabilité la plus lourde relevée
par l'audit : le stockage des mots de passe Carrefour et Leclerc.

### `product_equivalents`, la pièce qui rend le système déterministe

L'accès direct par EAN fonctionne **chez Carrefour uniquement** : ses URL de fiche
contiennent le code-barres (`/p/x-3443660013046`, vérifié le 18/08). Chez Leclerc,
les liens produit n'ont pas de `href` — la navigation est pilotée en JavaScript —
donc aucun EAN n'est lisible et la recherche par nom reste la seule voie.

D'où le besoin, soulevé pendant la conception : un produit scanné à la maison peut
exister chez une enseigne et pas chez l'autre. La table enregistre l'équivalence
choisie une fois pour toutes.

| Colonne | Rôle |
|---|---|
| `user_id`, `product_id`, `drive` | identité de l'équivalence (unique) |
| `search_query` | la requête qui fonctionne chez ce drive |
| `matched_label` | libellé exact retenu — **indispensable chez Leclerc**, faute d'URL |
| `product_url`, `ean13` | accès direct quand le drive l'expose |
| `unavailable` | ce drive ne propose pas ce produit |
| `last_confirmed_at` | fraîcheur de la confirmation |

`matched_label` et `unavailable` sont nouvelles par rapport au schéma d'origine.
`unavailable` enregistre l'absence comme une information au lieu de la redécouvrir
à chaque commande ; elle alimentera le comparatif « produits manquants » prévu au
brief produit.

## L'application Expo

Le cerveau du wizard est déjà constitué de fonctions pures en JavaScript qui ne
touchent pas au DOM : `buildConsolidatedItems`, `groupByRayon`, `getRecipeUsage`,
`unitConverter`. Ces fichiers se déplacent tels quels ; seule l'interface est
réécrite.

```
mobile/
  app/                    expo-router, navigation par fichiers
    (auth)/login.tsx
    (tabs)/index · scan · products · recipes · wizard/[step]
  lib/
    supabase.ts
    openfoodfacts.ts      nouveau : EAN → produit
    consolidate.ts        repris du web, inchangé
    units.ts              repris du web, inchangé
    typology.ts           porté de product_typology.py (table de correspondance)
  components/  stores/
```

La barre d'onglets reprend celle du web — Accueil, Recettes, Wizard, Produits — et
gagne **Scan** en action centrale.

Les conventions du `CLAUDE.md` s'appliquent intégralement : zéro emoji dans
l'interface, thème clair premium, vraies images produit, feedback systématique
(chargement, erreur, confirmation).

## Le scan

`expo-camera` en mode code-barres (`ean13`, `ean8`).

Parcours nominal :

1. L'utilisateur vise, la caméra lit — vibration de confirmation
2. L'EAN est envoyé à Open Food Facts
3. Une fiche remonte du bas de l'écran : image, nom, marque, contenance
4. **Ajouter aux favoris**, ou **Ignorer** et la caméra reprend

Cas particuliers, tous traités :

- **Produit inconnu d'Open Food Facts** → formulaire de saisie, EAN pré-rempli
- **Déjà dans les favoris** → signalé, avec accès à la fiche, au lieu d'un doublon
- **Hors connexion** → la fiche est mise en attente et l'ajout se fait au retour du
  réseau

La logique de mapping d'`enrich_ean.py` est reprise en TypeScript : détection des
liquides, extraction du grammage, normalisation des unités. Open Food Facts
recommande un usage raisonnable de son API ; un scan déclenche une requête, ce qui
reste très en deçà.

## Le pont vers l'extension

L'extension gagne l'authentification Supabase (session dans `chrome.storage`) et
s'abonne à `cart_jobs`.

- Une liste validée sur iPhone fait apparaître une **pastille sur l'icône de
  l'extension**
- Un clic lance le remplissage ; la progression est écrite dans `cart_jobs` et
  suivie en temps réel sur le téléphone
- Une ambiguïté résolue par le bouton **« Choisir »** écrit désormais l'équivalence
  dans `product_equivalents`

Le copier-coller disparaît, et avec lui le format texte `[EAN] Nom x2`.

La boucle complète devient : scanner à la maison → composer la liste → l'extension
remplit (Carrefour par EAN, Leclerc par nom) → trancher une ambiguïté une seule
fois → les commandes suivantes sont déterministes des deux côtés.

## Livraison

**Expo Go d'abord.** Le scan tourne sur l'iPhone sans build ni compte, ce qui permet
de valider l'ergonomie avant d'engager quoi que ce soit.

**Puis EAS Build → TestFlight.** Identifiant de bundle, icône, écran de lancement,
`eas build --platform ios` puis `eas submit`.

## Découpage

| Lot | Contenu | État à la fin |
|---|---|---|
| 1 | Schéma Supabase + migration des données | données en Postgres, RLS vérifiée |
| 2 | App Expo : auth + catalogue produits | connexion et liste sur Expo Go |
| 3 | Scan + Open Food Facts | le besoin qui motive ce virage, opérationnel |
| 4 | Wizard porté | l'iPhone devient l'outil principal |
| 5 | Pont extension ↔ Supabase | boucle fermée, plus de copier-coller |
| 6 | Retrait de FastAPI et du front web | trois composants au lieu de quatre |

Chaque lot est livrable et vérifiable indépendamment.

**Le plan d'implémentation qui suit ne couvre que les lots 1 à 3** — jusqu'au scan
opérationnel sur Expo Go, c'est-à-dire jusqu'au besoin qui motive ce virage. Les
lots 4 à 6 feront l'objet de leurs propres plans, une fois le scan éprouvé à
l'usage. Tenter les six d'un bloc produirait un plan trop long pour être suivi, et
figerait des décisions d'interface que l'usage réel du scan éclairera mieux.

## Tests

Même approche que pour l'extension, qui a fait ses preuves — les tests y ont
attrapé un roman pris pour des pâtes, un multiplicateur à 400 exemplaires et une
expression régulière perdue à la sérialisation.

- **Fonctions pures** au `node --test` : consolidation, unités, typologie, mapping
  Open Food Facts
- **Politiques RLS** en SQL : tenter d'accéder aux données d'un autre utilisateur
  doit échouer
- **Scan** sur l'appareil, avec de vrais produits

## Ce qui ne sera pas construit

**Aucun identifiant de drive ne sera stocké**, ni maintenant ni plus tard.

La raison est technique avant d'être prudentielle : le mur n'est pas
l'authentification mais la détection de robot. Le `403` mesuré sur les deux
enseignes intervient **avant toute connexion** — il frappe la page d'accueil, le
sitemap, une fiche produit. Un mot de passe ne le franchit pas. Ce qui passe, c'est
un vrai navigateur avec une session qu'un humain a ouverte lui-même ; c'est
exactement ce qu'utilise l'extension, et elle ne stocke rien.

Rien ne sera construit non plus pour masquer le caractère automatisé d'un
navigateur : empreinte falsifiée, `navigator.webdriver` dissimulé, résolution de
captcha. Sur un challenge, l'extension s'arrête et rend la main.

## Piste ouverte, hors périmètre

Si la condition n'est pas « posséder les identifiants » mais « être un vrai
navigateur avec une session humaine », alors **l'iPhone peut la remplir aussi** :
une `WebView` où l'utilisateur se connecte normalement, puis l'injection de la même
logique que l'extension. Le Mac sortirait de la boucle.

Deux réserves qui la maintiennent hors périmètre : ce n'est **pas vérifié**, et une
app qui automatise un site tiers dans une WebView peut accrocher lors d'une revue
App Store. Sans objet pour un usage familial via TestFlight, mais à ne pas bâtir en
vue d'une publication publique.

À évaluer après le lot 5, sans retarder ce qui est acquis.
