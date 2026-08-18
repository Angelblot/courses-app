# Extension « Courses » — remplissage de panier

Remplit le panier d'un drive à partir d'une liste, **dans ton propre navigateur,
sur ta session déjà connectée**.

## Pourquoi une extension et pas un worker

Carrefour et Leclerc Drive répondent `403` à tout accès programmatique, avec un
challenge explicite (« vérifions que vous n'êtes pas un robot »). Mesures et
sources dans [`../DECISION_DRIVES.md`](../DECISION_DRIVES.md) § 5 ter.

Passer ce contrôle depuis un serveur supposerait de masquer le caractère
automatisé du navigateur. Ce n'est pas ce que fait cette extension : elle
travaille dans **ton** navigateur, où le contrôle a déjà été franchi par toi,
humain, en navigant normalement. Rien n'est falsifié. Si une vérification
apparaît en cours de route, l'extension **s'arrête et te rend la main** ; tu la
résous, tu reprends.

Concrètement : un clic pour quarante produits, au lieu de quarante allers-retours.

## Installation

1. Ouvre `chrome://extensions`
2. Active **Mode développeur** (en haut à droite)
3. **Charger l'extension non empaquetée** → sélectionne ce dossier `extension/`

## Utilisation

1. Connecte-toi normalement au site du drive et choisis ton magasin — une fois,
   à la main.
2. Clique l'icône de l'extension.
3. Choisis l'enseigne, colle ta liste, puis **Remplir le panier**. Chaque ligne
   est soit un nom de produit, soit une **URL de fiche produit** — quantité
   optionnelle en suffixe `x2` dans les deux cas.
4. Laisse l'onglet travailler. Le popup affiche la progression et ce qui n'a pas
   été trouvé.
5. Vérifie le panier et paie **toi-même** sur le site : l'extension ne valide
   jamais de commande.

## Première utilisation : calibrer les sélecteurs

**Carrefour est calibré** (18/08/2026, sur deux pages réelles). **Leclerc ne
l'est pas** : ses sélecteurs restent des hypothèses.

Les sélecteurs de `content/sites.js` ne peuvent pas être validés
automatiquement, puisque les deux sites refusent l'accès programmatique. Ils
sont donnés en listes de candidats et se calibrent en une passe :

1. Va sur une page de résultats de recherche du drive, connecté.
2. Ouvre l'extension → **Diagnostiquer cette page**.
3. Le rapport indique, pour chaque sélecteur candidat, combien d'éléments il
   trouve, et un échantillon de titres lus.
4. Reporte les sélecteurs qui renvoient un nombre cohérent (≈ le nombre de
   produits affichés) en tête des listes de `content/sites.js`.

Attention au piège rencontré : `innerText` renvoie une chaîne vide pour un
élément non rendu (carrousel hors écran). Un diagnostic lancé sur la page
d'accueil affiche donc des titres vides alors que les sélecteurs sont bons.
Lance-le sur une page qui affiche vraiment des produits.

Attends-toi à devoir refaire ce réglage après une refonte du site : beaucoup de
classes CSS y sont générées à la compilation et changent à chaque déploiement.

## Viser un produit précis

La recherche par nom reste approximative : « Lardons fumés » ne se distingue pas
de « Lardons fumés BIO » ni de « Lardons fumés allégés ». Trois garde-fous :

1. **Départage automatique** — à score égal, le produit ayant le moins de mots
   superflus l'emporte. Demander « lardons fumés bio » sélectionne bien le bio.
2. **Aveu d'ambiguïté** — deux candidats indiscernables ne sont pas départagés
   au hasard : la ligne est signalée, à toi de trancher.
3. **URL de fiche** — la seule méthode sûre. Colle l'adresse du produit dans la
   liste : l'extension y va directement, sans passer par la recherche.

La recherche par code-barres, elle, ne fonctionne pas : Carrefour n'indexe pas
les EAN (0 résultat, vérifié le 18/08/2026). En revanche il les expose dans
l'URL des fiches (`/p/…-3443660013046`), et l'extension les remonte dans ses
résultats — de quoi constituer une table de correspondances et n'avoir à
choisir qu'une seule fois par produit.

## Sécurité et limites

- **Aucun mot de passe n'est stocké ni demandé.** L'extension utilise la session
  de ton navigateur, rien d'autre.
- **Elle ne paie jamais** et ne valide aucune commande.
- Elle ne contourne aucune protection : sur un challenge, elle s'arrête.
- L'accès automatisé peut contrevenir aux CGU des enseignes. Usage familial,
  à ton appréciation.
- Rythme volontairement lent (2,5 s entre deux produits) pour rester proche
  d'une navigation humaine.

## Tests

```bash
node test-matching.mjs
```

Couvre l'analyse de la liste saisie et le score de correspondance — les deux
endroits où une erreur ferait entrer le mauvais produit dans le panier. Le seuil
d'acceptation est volontairement exigeant (0,75, pondéré par la longueur des
mots) : mieux vaut signaler un produit manquant que d'en ajouter un faux.

## Architecture

| Fichier | Rôle |
|---|---|
| `background.js` | Orchestrateur. Pilote l'onglet et enchaîne les produits — une navigation détruit les scripts injectés, le pilote doit donc rester extérieur. |
| `content/page-agent.js` | Injecté par produit : trouve la carte, score les titres, clique « Ajouter ». |
| `content/sites.js` | Sélecteurs et URL par enseigne. **C'est le seul fichier à retoucher** quand un site change. |
| `popup.*` | Lancement, progression, diagnostic. |
