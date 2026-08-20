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
