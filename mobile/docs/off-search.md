# Recherche Open Food Facts

Le client de recherche partageait le timeout de 5 secondes du scanner et ne
retentait aucune erreur. Un essai réel du 24 septembre 2026 a reçu HTTP 503.

La recherche par nom utilise désormais un budget total de 25 secondes, 12 secondes
maximum par tentative et au plus trois tentatives, espacées d’une puis deux secondes.
Seuls les problèmes temporaires (réseau, délai dépassé, 408, 5xx, JSON invalide)
sont repris. Un résultat vide valide termine immédiatement la recherche.

Le cache en mémoire conserve au plus 30 recherches pendant cinq minutes. Une
réponse 429 suspend les requêtes pendant Retry-After (ou 60 secondes sans indication).
Il n’y a pas de recherche à chaque frappe. Modifier le texte ou fermer le sélecteur
annule la requête et ses reprises ; une réponse ancienne ne remplace pas la suivante.

Les deux écrans utilisent `useRechercheOff` : ajout d’un produit et sélection d’un
ingrédient. Le clavier se ferme au lancement, un message indique la reprise et le
verrou empêche les doubles clics. La saisie manuelle reste disponible pendant l’attente.
Le scanner de code-barres conserve son comportement précédent.

Validation : tests réseau simulés dans `lib/recherche-off.test.mjs`, parcours navigateur
`tests/e2e/off_search.cjs` (serveur Expo web sur 8084, API simulées, aucun compte réel).
