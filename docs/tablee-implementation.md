# Tablée — implémentation du 8 septembre 2026

Palette validée : vert forêt et crème. Les photographies de recettes et les
illustrations produit existantes sont conservées.

- Accueil avec ajout rapide, reprise du brouillon et état réel de la dernière demande.
- Sélection des repas avec recherche, favoris conservés sur cet appareil,
  portions communes et ajustement par recette.
- Trois étapes : Mes repas, Ma liste, Mes paniers. Les anciennes URL
  `ingredients` et `generate` redirigent respectivement vers la liste et le récapitulatif.
- Ingrédients regroupés, produits à choisir présentés en premier, quantités
  ajustables et retrait réversible « J’en ai déjà ».
- Les choix d’ingrédients sont conservés dans le brouillon et pris en compte
  par le serveur via `ingredient_overrides`. Les références sont validées
  contre les recettes sélectionnées ; un produit choisi remplace le besoin
  générique sans le compter deux fois. Les achats supplémentaires s’ajoutent.
- Complément par rayon avec recherche, habitudes, quantité et actions explicites.
  Le mode un par un reste disponible avec annulation de la dernière décision.
- Liste et drives réunis dans le récapitulatif, colonne latérale sur ordinateur.
- Brouillons et retours conservés, recettes facultatives, erreurs réelles,
  quantités métriques normalisées, état des paniers et couverture affichés.

## Vérification

- `npm run build --prefix frontend` : succès (avertissement de taille du bundle).
- `tests/e2e/ui_ergonomics.cjs` : parcours, portions/favoris persistés, retrait
  d’ingrédient, annulation d’une décision, erreurs et reprise.
- `tests/e2e/tablee_images.cjs` : assets, photos personnalisées prioritaires,
  aperçus mobile et ordinateur, trois étapes et absence de débordement horizontal.
- `node tests/e2e/unit_quantities.cjs` : conversions kg/g et L/cl/ml.
- `pytest backend/tests/test_wizard_session.py backend/tests/test_wizard.py` : 14 succès.
- Captures dans `docs/tablee-preview`, réalisées avec les données du catalogue
  initial et une API simulée. Aucun panier marchand réel n’a été créé.

## Livraison

Modifications locales, non déployées. Le frontend et le backend doivent être
livrés ensemble pour prendre en compte les retraits d’ingrédients. Le backend
existant enregistre une demande et une liste ; il ne remplit pas encore les
paniers chez les marchands. L’interface ne présente pas cette demande comme un
panier déjà rempli. Aucun prix comparatif n’est inventé en l’absence de résultats.
