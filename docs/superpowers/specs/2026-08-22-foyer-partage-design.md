# Compte et partage du foyer

**Date :** 22 août 2026
**Statut :** validé, prêt pour le plan d'implémentation

## Objet

Permettre à plusieurs personnes d'un même foyer de partager le catalogue, les
recettes et les listes de courses — et donner à l'écran Compte autre chose
qu'un bouton de déconnexion.

C'est la fonctionnalité que la conception du 18/08 avait explicitement laissée
de côté, en prenant soin d'écrire les politiques RLS d'une seule façon pour que
ce jour-là ne coûte pas cher. Le moment est venu.

## Décisions structurantes

| Question | Décision |
|---|---|
| Entrée dans le foyer | Invitation par courriel |
| Ce qui est partagé | Tout — catalogue, recettes, listes, historique, équivalences |
| Départ d'un membre | Il perd l'accès ; les données restent au foyer |
| Clé de service | Jamais manipulée : Supabase l'injecte dans la fonction Edge |

## Le modèle

Deux tables nouvelles :

- **`households`** — `id`, `name`, `created_at`
- **`household_members`** — `household_id`, `user_id`, `role`, `invited_at`,
  `joined_at`. Unique sur (`household_id`, `user_id`).

Les huit tables de données gagnent `household_id` : `products`, `recipes`,
`recipe_ingredients`, `categories`, `category_aliases`, `purchase_lines`,
`product_equivalents`, `cart_jobs`.

**`user_id` reste sur chacune.** Savoir qui a scanné quoi garde son intérêt, et
le conserver rend la migration réversible tant qu'on ne l'a pas supprimé — ce
que ce lot ne fait pas.

## La clause RLS

Elle passe de `(select auth.uid()) = user_id` à `household_id = mon_foyer()`.

`mon_foyer()` est une fonction `SECURITY DEFINER`, marquée `STABLE`, qui rend le
foyer de l'appelant. Le marquage compte : sans lui, Postgres évaluerait
l'appartenance **une fois par ligne** — 68 fois la même question pour afficher
le catalogue. Marquée `STABLE`, elle est évaluée une fois par requête.

`SECURITY DEFINER` est nécessaire : la fonction lit `household_members`, dont
les propres politiques dépendraient sinon d'elle-même.

Les politiques de `cart_jobs` — quatre, dont l'avancement et l'annulation
écrites au lot 5 — suivent la même bascule, en conservant leurs conditions de
statut.

Le stockage garde ses politiques telles quelles : le chemin d'une photo commence
par l'identifiant de celui qui l'a déposée, et le bucket est public en lecture.
Tout membre voit donc les photos du foyer sans qu'il faille y toucher.

## L'invitation

Une fonction Edge `inviter` :

1. vérifie que l'appelant est membre du foyer qu'il prétend ;
2. appelle `auth.admin.inviteUserByEmail(email, { data: { household_id } })`.

Supabase envoie le courriel lui-même. **La clé de service n'est jamais écrite
nulle part** : Supabase l'injecte dans l'environnement de la fonction sous
`SUPABASE_SERVICE_ROLE_KEY`.

Un déclencheur `on auth.users after insert` lit `raw_user_meta_data.household_id`
et crée l'appartenance. La personne apparaît donc dans la liste **dès
l'invitation**, avec `joined_at` à `NULL` — affichée « en attente ». Elle passe
« membre » quand elle ouvre le lien et pose son mot de passe.

### Deux limites annoncées

**Le service de courriel intégré de Supabase est bridé** à quelques envois par
heure sur le palier gratuit. Sans effet pour un foyer ; bloquant pour un usage
en volume.

**Le lien d'invitation réutilise la machinerie du mot de passe oublié** — flux
PKCE et lien profond `coursesapp://`. Or **celle-ci n'a jamais été éprouvée sur
un appareil**. Si elle ne fonctionne pas, l'invitation ne fonctionnera pas non
plus. C'est le même point de fragilité, et il doit être testé en premier.

## L'écran Compte

- Le nom du foyer, modifiable.
- La liste des membres : adresse, état — « membre » ou « en attente » —, et
  celui qui a créé le foyer marqué comme tel.
- Un champ pour inviter par adresse.
- Le retrait d'un membre, avec confirmation. Il perd l'accès ; rien n'est
  supprimé.
- Le bouton de déconnexion existant.

On ne peut pas se retirer soi-même ni retirer le créateur : un foyer sans membre
serait un foyer dont les données deviendraient inaccessibles à tous.

## La migration

Dans l'ordre, en une seule migration :

1. créer `households` et `household_members` ;
2. créer un foyer pour l'utilisateur existant et l'y inscrire comme créateur ;
3. ajouter `household_id` aux huit tables, le remplir depuis `user_id`, puis le
   rendre obligatoire ;
4. créer `mon_foyer()` ;
5. remplacer les politiques des huit tables.

185 lignes au total : le volume n'est pas le sujet, l'ordre l'est. Rendre la
colonne obligatoire avant de l'avoir remplie ferait échouer la migration entière.

## Tests

- **Isolation** : un membre d'un autre foyer ne voit rien. Éprouvé en SQL, en
  se faisant passer pour un utilisateur puis pour l'autre.
- **Appartenance** : `mon_foyer()` rend le bon foyer, et `NULL` pour un
  utilisateur sans foyer.
- **Libellés d'état des membres** : fonction pure, testée sous Node — « membre »,
  « en attente », « créateur ».
- **Garde-fous du retrait** : on ne peut retirer ni soi-même ni le créateur.

## Ce qui n'est pas construit

- **La copie des données au départ d'un membre.** Il perd l'accès, rien de plus.
- **Plusieurs foyers par personne.** Une personne appartient à un foyer et un
  seul ; `mon_foyer()` en dépend.
- **Les rôles fins.** Deux rôles seulement : créateur et membre. Le créateur
  peut retirer, le membre non.
- **L'inscription libre.** L'entrée se fait par invitation, comme décidé au
  lot 4.
