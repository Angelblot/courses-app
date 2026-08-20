/**
 * Génère la migration SQL de reprise des données depuis SQLite.
 *
 * N'écrit rien en base : produit un fichier SQL, appliqué ensuite par
 * apply_migration. Les UUID sont fixés ici, à la génération, de sorte que le
 * fichier soit rejouable à l'identique et que les liens entre produits,
 * recettes et ingrédients soient lisibles dans le SQL lui-même.
 *
 * Usage : node scripts/generer_migration_donnees.mjs <user_id> > fichier.sql
 */
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';

const USER_ID = process.argv[2];
if (!/^[0-9a-f-]{36}$/i.test(USER_ID ?? '')) {
  throw new Error('Usage : node scripts/generer_migration_donnees.mjs <user_id>');
}

const db = new DatabaseSync('backend/app.db', { readOnly: true });
const lire = (sql) => db.prepare(sql).all();

/** Échappe une valeur pour l'insérer littéralement dans du SQL. */
function q(v) {
  if (v === null || v === undefined || v === '') return 'null';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return `'${String(v).replace(/'/g, "''")}'`;
}

const lignes = [];
const ecrire = (s) => lignes.push(s);

ecrire('-- Reprise des données depuis SQLite (backend/app.db).');
ecrire('-- Généré par scripts/generer_migration_donnees.mjs — ne pas éditer à la main.');
ecrire(`-- Propriétaire : ${USER_ID}`);
ecrire('');

// --- Catégories ---
const categories = lire('select * from categories');
for (const c of categories) {
  ecrire(
    `insert into public.categories (user_id, key, label, icon, display_order) values ` +
    `(${q(USER_ID)}, ${q(c.key)}, ${q(c.label)}, ${q(c.icon ?? '')}, ${c.display_order ?? 0});`,
  );
}

// --- Alias de catégories ---
for (const a of lire('select * from category_aliases')) {
  ecrire(
    `insert into public.category_aliases (user_id, label_raw, key_canonical) values ` +
    `(${q(USER_ID)}, ${q(a.label_raw)}, ${q(a.key_canonical)});`,
  );
}

// --- Produits : l'id entier devient un UUID fixé ici ---
const idProduit = new Map();
for (const p of lire('select * from products')) {
  const id = randomUUID();
  idProduit.set(p.id, id);
  ecrire(
    `insert into public.products (id, user_id, ean13, name, brand, category, ` +
    `default_quantity, unit, favorite, notes, price_ttc, image_url, brand_type, ` +
    `store_brand_affinity, grammage_g, volume_ml, product_type) values (` +
    [
      q(id), q(USER_ID), q(p.ean13), q(p.name), q(p.brand), q(p.category),
      p.default_quantity ?? 1, q(p.unit || 'piece'), q(Boolean(p.favorite)),
      q(p.notes), q(p.price_ttc), q(p.image_url), q(p.brand_type || 'common'),
      q(p.store_brand_affinity), q(p.grammage_g), q(p.volume_ml), q(p.product_type),
    ].join(', ') + ');',
  );
}

// --- Recettes ---
const idRecette = new Map();
for (const r of lire('select * from recipes')) {
  const id = randomUUID();
  idRecette.set(r.id, id);
  ecrire(
    `insert into public.recipes (id, user_id, name, description, servings_default, ` +
    `category, image_url) values (` +
    [
      q(id), q(USER_ID), q(r.name), q(r.description),
      r.servings_default ?? 4, q(r.category), q(r.image_url),
    ].join(', ') + ');',
  );
}

// --- Ingrédients : rattachés par les UUID générés ci-dessus ---
let ingredientsIgnores = 0;
for (const i of lire('select * from recipe_ingredients')) {
  const recipeId = idRecette.get(i.recipe_id);
  if (!recipeId) { ingredientsIgnores += 1; continue; }
  ecrire(
    `insert into public.recipe_ingredients (user_id, recipe_id, product_id, name, ` +
    `quantity_per_serving, unit, rayon, category, category_hint) values (` +
    [
      q(USER_ID), q(recipeId),
      q(i.product_id ? idProduit.get(i.product_id) ?? null : null),
      q(i.name), i.quantity_per_serving ?? 0, q(i.unit || 'unité'),
      q(i.rayon), q(i.category), q(i.category_hint),
    ].join(', ') + ');',
  );
}

// --- Lignes d'achat : drive_config_id devient le nom de l'enseigne ---
const drives = new Map(lire('select id, name from drive_configs').map((d) => [d.id, d.name]));
let achatsIgnores = 0;
for (const l of lire('select * from purchase_lines')) {
  const productId = idProduit.get(l.product_id);
  if (!productId) { achatsIgnores += 1; continue; }
  ecrire(
    `insert into public.purchase_lines (user_id, product_id, drive, quantity_ordered, ` +
    `quantity_delivered, unit_price_ttc, total_ttc, purchase_date) values (` +
    [
      q(USER_ID), q(productId), q(drives.get(l.drive_config_id) ?? 'carrefour'),
      l.quantity_ordered ?? 0, l.quantity_delivered ?? 0,
      q(l.unit_price_ttc), q(l.total_ttc), q(l.purchase_date),
    ].join(', ') + ');',
  );
}

db.close();

// Les lignes orphelines partent sur stderr : elles ne doivent pas polluer le
// SQL, mais elles ne doivent pas non plus disparaître en silence.
if (ingredientsIgnores || achatsIgnores) {
  console.error(
    `Ignorés — ingrédients sans recette : ${ingredientsIgnores}, ` +
    `lignes d'achat sans produit : ${achatsIgnores}`,
  );
}
console.log(lignes.join('\n'));
