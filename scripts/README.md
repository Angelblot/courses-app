# Scripts

## generer_migration_donnees.mjs

Génère le SQL de reprise des données depuis `backend/app.db` (SQLite).
N'écrit rien en base : produit un fichier appliqué ensuite par
`apply_migration`.

```bash
node scripts/generer_migration_donnees.mjs <user_id> \
  > supabase/seed/donnees_initiales.sql
```

Le `user_id` est l'UUID du compte propriétaire, lisible dans le tableau de
bord Supabase, section Authentication > Users.

Les UUID des produits et recettes sont fixés à la génération : le fichier est
donc rejouable à l'identique, et les liens entre tables restent lisibles dans
le SQL. Le regénérer produirait de nouveaux identifiants — ce qui créerait des
doublons si la première migration a déjà été appliquée.

### `supabase/seed/donnees_initiales.sql` — pourquoi ce n'est pas une migration

Ce fichier code en dur l'UUID du compte propriétaire (`user_id`), avec une
clé étrangère vers `auth.users`. C'est une reprise de données propre à
**cette** instance Supabase, pas une évolution de schéma : sur tout autre
projet, l'UUID ne correspond à aucun utilisateur et l'insertion échoue par
violation de clé étrangère. Pour cette raison il vit hors de
`supabase/migrations/`, qui doit rester rejouable telle quelle sur une base
vierge.

Il est déjà appliqué sur le projet en ligne (`qmymwicsgilhoihtfdjm`). **Ne
pas le modifier ni le régénérer** : voir la note ci-dessus sur les UUID
fixés — le regénérer créerait des doublons. Pour une nouvelle instance,
regénérer un fichier équivalent avec le `user_id` de cette instance-là.

## Ce qui reste dans `backend/app.db`

Le dossier `backend/` n'est plus versionné depuis le 22 août 2026, mais
`app.db` demeure sur le disque : git ne supprime pas les fichiers qu'il ne
suivait pas, et cette base n'a jamais été versionnée.

Vérification faite ce jour-là, les tables reprises concordent — 5 recettes,
26 ingrédients, 65 lignes d'achat, 10 catégories. Les produits sont à 68 en
ligne contre 65 en local : les trois de plus viennent du scan de codes-barres.

Quatre tables n'ont **pas** été reprises, après examen de leur contenu :

| Table | Lignes | Pourquoi |
|---|---|---|
| `product_drives` | 65 | Rattache chacun des 65 produits au même et unique drive. Ne dit rien de plus que « tout est chez Carrefour ». |
| `foods` | 21 | Vocabulaire d'ingrédients — « Ail », « Beurre » — sans synonymes ni images. `lib/typology.ts` couvre le même besoin, avec 63 règles. |
| `user_product_preferences` | 2 | Deux choix appris : lardons fumés, crème liquide. Voisin de `product_equivalents`, mais pas de même nature : celui-ci retient un produit **par drive**, avec son EAN. |
| `drive_configs` | 1 | Carrefour, `credentials_encrypted` **vide** — aucun identifiant n'a jamais été stocké, conformément à la règle du projet. |

Rien de tout cela n'est perdu : la base est là. Mais rien n'en dépend non plus.
