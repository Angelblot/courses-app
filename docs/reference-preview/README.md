# Écrans reconstruits depuis la référence jointe

Référence utilisateur : exec-b7362c91-bf01-438e-a0dd-ae3bed12d0e5.png.

L’accueil est centré sur la liste de courses en cours et les produits habituels.
La liste propose les onglets À acheter / Déjà chez moi, les photos, la case de
stock et les quantités sur chaque ligne. Les recettes restent dans leur onglet.

Les captures accueil.png et ma-liste.png utilisent des produits réels du
catalogue du dépôt, sélectionnés dans un scénario de test. Leur nombre reflète
ce scénario, pas un historique d’achat réel. La version locale sur le port 5173
utilise une base temporaire initialisée depuis le catalogue du dépôt.

## Photos

Aucune URL de photo enregistrée n’a été réécrite. La règle remplaçant les photos
initiales des recettes par des images générées a été supprimée. Les compléments
générés servent uniquement quand une photo manque ou échoue au chargement.
Le lait et le café des captures utilisent leurs photos Open Food Facts existantes.
Les œufs utilisent le complément généré, leur image_url initial étant vide.

Le bandeau photographique de l’accueil est une nouvelle image décorative créée
avec l’outil intégré Imagegen et enregistrée dans
frontend/public/media/tablee/grocery-banner.webp. Prompt : composition
photographique de courses (laitue, tomates, carottes, courgettes, lait et pâtes),
produits regroupés à droite, fond sauge clair libre à gauche, lin et lumière
naturelle, aucun texte, logo ou interface. Ce visuel ne remplace aucune photo
produit. Les autres prompts restent dans docs/tablee-image-prompts.json.

## Vérifications

- Build Vite réussi ; avertissement existant sur la taille du bundle.
- Tests navigateur reserve_reference, ui_ergonomics et tablee_images passés.
- Vérification réelle avec backend local et service worker après rechargement.
- Ancien cache de modules Vite supprimé à l’activation du nouveau service worker.
- Aucun déploiement ni panier marchand réel créé.
