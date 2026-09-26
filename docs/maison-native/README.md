# Tablée Maison — application Expo

Implémentation du 8 septembre 2026 dans `mobile/`, sur la base du parcours Maison validé. Le prototype HTML de `frontend/public/propositions/` reste une étude séparée.

## Livré dans le code

- Accueil Courses : liste courante, mois réel, bandeau photo, trois favoris, ajout et scan visibles.
- Navigation Courses / Recettes / Réglages ; catalogue et scan accessibles depuis Courses.
- Liste centrale : rayons, photos, quantités, À acheter / Déjà chez moi, ajouts manuels, produits de remplacement et accès direct au drive.
- Recettes : recherche, photos rectangulaires, ajout aux repas et portions modifiables ; import et édition conservés.
- Brouillon partagé entre écrans, stocké localement par utilisateur Supabase ; fermer ne l’efface plus. Vider demande une confirmation.
- Calcul unique `listeMaison` utilisé pour l’affichage et l’envoi : produit choisi, EAN, conditionnement, quantités et exclusions. Une conversion inconnue bloque l’envoi jusqu’à confirmation du nombre d’articles.
- Photos locales de secours dans l’application, y compris dans les fiches ; les URL enregistrées restent prioritaires. Aucun champ image de la base n’a été réécrit.
- Envoi réel par `cart_jobs`, puis suivi et extension Chrome existants. Aucun paiement automatique.
- Caméra démontée lorsque le scan perd le focus, pour éviter de la garder active sur les autres écrans.

## Validation

- 202 tests unitaires réussis (application et logique de l’extension).
- 71 vérifications de correspondance de l’extension réussies.
- TypeScript sans erreur et export iOS/Hermes réussi.
- Test `tests/e2e/maison_native.cjs` sur le rendu Expo web à 390 × 844 : accueil, modifications, exclusion d’un article, rechargement du brouillon et contenu de la requête Chrome. Tous les appels Supabase sont interceptés et simulés.
- Captures `accueil.png` et `liste.png` : code Expo, données fictives ; ce ne sont pas des captures d’un iPhone physique.
- Détecteur de design sur les nouveaux écrans : aucun signalement.

L’aperçu Expo local utilise le port 8082 et demande la connexion habituelle hors des tests. Le port 5173 reste le projet web antérieur.

## Limites de livraison

Le brouillon est local à l’appareil et isolé par compte ; il n’est pas synchronisé entre appareils. Les favoris et recettes utilisent toujours Supabase.

L’export JavaScript iOS n’est pas une application signée installable. Aucune publication ni distribution TestFlight n’a été faite. La caméra, VoiceOver, Dynamic Type et les retours d’arrière-plan doivent être vérifiés sur iPhone ; le remplissage doit encore être vérifié avec une vraie session Chrome.

## Parcours des manques, repas et habitudes (8 septembre 2026)

L’accueil ouvre `/ajout` pour noter un nom et un nombre d’articles. Le brouillon appartient au compte connecté et reste sur cet appareil. `/recettes` sépare la découverte et « Mes repas », avec portions ajustables ; `/habitudes` propose les favoris rayon par rayon, geste horizontal ou boutons, quantité explicite et possibilité de revoir un rayon. Une décision remplace la quantité précédente. `/ajout` propose aussi la recherche Open Food Facts : l’EAN est conservé en base, un produit exceptionnel n’est pas automatiquement favori. Le scan conserve sa destination favoris ou liste, et la quantité demandée.

### iOS : widget et Siri

Les sources natives sont intégrées au projet Xcode versionné (ne pas lancer `expo prebuild --clean`, qui supprimerait ces ajouts). `TableeWidget` est une extension WidgetKit iOS 17+, écran d’accueil et raccourci circulaire de verrouillage. Le toucher ouvre `coursesapp://ajout`. Le compteur concerne les ajouts Siri en attente, pas la liste entière. L’app conserve sa cible iOS 16.4 ; le widget nécessite iOS 17.

L’action App Intents « Noter un produit manquant » demande produit et quantité, exige l’authentification système et une confirmation avant écriture. Phrase : « Siri, ajoute un produit dans Courses ». Les entrées sont enregistrées dans l’App Group `group.com.coursesapp.mobile`. Aucun jeton Supabase n’est partagé. Les files sont isolées par compte ; une déconnexion masque les entrées dans le widget sans les supprimer. Le pont React Native importe les ajouts au retour de l’app. Ils ne sont acquittés qu’après l’écriture AsyncStorage ; leurs identifiants empêchent un double import, même après suppression ou remise à zéro de la liste.

Avant distribution : enregistrer l’App Group pour les identifiants `com.coursesapp.mobile` et `com.coursesapp.mobile.TableeWidget`, générer les profils compatibles et tester sur iPhone signé. Ni le navigateur ni Expo Go ne peuvent exécuter ce module natif. Les essais Siri à faire sur appareil : confirmation/refus, annulation, quantité invalide, app fermée, relance, changement de compte et ajout hors réseau. Les manques nommés ne sont pas automatiquement associés à un EAN : la recherche et le scan permettent de choisir le produit exact.

### Vérifications

- TypeScript et suite Node mobile.
- `tests/e2e/tablee_parcours.cjs` : ajout quotidien, sélection recette/portions, quantité habituelle, recherche OFF simulée, EAN/favori, persistance après rechargement.
- `tests/e2e/maison_native.cjs` : liste consolidée et charge utile envoyée à l’extension Chrome.
- Compilation Xcode réussie de l’application complète et du widget pour simulateur, sans signature ; métadonnées App Intents extraites. Les phrases Siri sont en français (région de développement fr).
- Captures ci-jointes : données de démonstration, pas le contenu du compte utilisateur.

## Fiche et création de recette

Les routes `/recettes/[id]` et `/recettes/nouvelle` reprennent maintenant Tablée Maison : fiche photographique, ingrédients en lignes avec choix du produit, portions et action persistante pour choisir le repas ; formulaire avec photo facultative, portions, durées et quantités pour la recette entière. La conversion vers `quantity_per_serving` se fait uniquement à l’enregistrement, et la saisie décimale accepte la virgule. Le retour via le bouton Recettes demande confirmation si le formulaire a été modifié. Les photos existantes ne sont pas écrasées.

Vérification : TypeScript, 195 tests Node et `tests/e2e/tablee_recipe_screens.cjs` (données simulées : choix du repas, portions, validation, unités et enregistrement de 1,5 kg pour quatre personnes en 0,375 kg par personne). Inspection sur 390 px et 1100 px. Les captures `fiche-recette.png`, `nouvelle-recette.png` et `saisie-ingredients.png` utilisent des données de démonstration.
