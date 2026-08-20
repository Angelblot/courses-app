# Scripts

## generer_migration_donnees.mjs

Génère la migration SQL de reprise des données depuis `backend/app.db`
(SQLite). N'écrit rien en base : produit un fichier appliqué ensuite par
`apply_migration`.

```bash
node scripts/generer_migration_donnees.mjs <user_id> \
  > supabase/migrations/0004_donnees_initiales.sql
```

Le `user_id` est l'UUID du compte propriétaire, lisible dans le tableau de
bord Supabase, section Authentication > Users.

Les UUID des produits et recettes sont fixés à la génération : le fichier est
donc rejouable à l'identique, et les liens entre tables restent lisibles dans
le SQL. Le regénérer produirait de nouveaux identifiants — ce qui créerait des
doublons si la première migration a déjà été appliquée.
