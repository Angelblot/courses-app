# Décision — génération automatique des paniers drive

**Statut :** en attente d'arbitrage
**Date :** 18 août 2026
**Contexte :** audit du projet, point 4

---

## 1. Pourquoi cette note

Le `PRODUCT_BRIEF.md` et le `CLAUDE.md` posent la génération automatique des
paniers comme la raison d'être du produit : *« L'app DOIT générer les paniers
automatiquement »*. Le pain point #1 identifié est *« devoir tout resaisir sur
les sites Carrefour/Leclerc »*.

Or cette fonctionnalité n'a jamais tourné. Avant d'y réinvestir du temps, il
faut trancher **comment** elle doit marcher — parce que les deux voies
possibles n'ont ni le même coût, ni le même risque, ni le même produit au bout.

Cette note ne tranche pas à ta place : elle pose les faits vérifiés, chiffre
les options et formule une recommandation argumentée.

---

## 2. État des lieux vérifié

Ce qui existe aujourd'hui dans `backend/app/services/drives/` :

| Constat | Détail |
|---|---|
| Le wizard n'appelle jamais les drives | `POST /wizard/sessions/{id}/generate` crée une `ShoppingList` locale et renvoie `total: 0.0`. Aucun appel à `DriveService`. |
| Le navigateur est lancé en mode visible | `open_browser(headless=False)` dans `add_items_to_cart`, pour Carrefour comme pour Leclerc. Impossible sur un serveur sans écran. |
| Playwright n'est pas déployé | Absent de `requirements-render.txt`, le fichier qu'utilise le `Dockerfile`. |
| Les sélecteurs sont spéculatifs | `.product-card, .ds-product-card, h2, h3` — jamais validés contre le vrai site. |
| L'attente est temporelle, pas événementielle | `time.sleep(3)` au lieu de `wait_for_selector`. Fragile et lent. |
| Aucun test | Ni unitaire, ni d'intégration, sur aucun des deux scrapers. |

**Autrement dit : il n'y a pas de scraper à réparer, il y a un scraper à
écrire.** Le code existant est une esquisse, pas une base.

### Ce que renvoient les sites aujourd'hui

Test effectué le 18 août 2026, client HTTP classique avec un User-Agent Chrome :

- `https://www.carrefour.fr/s?q=spaghetti` → **403**
- `https://www.e-leclerc.com/recherche?q=spaghetti` → **308** (redirection)
- `https://www.carrefour.fr/robots.txt` → 200

Le `robots.txt` de Carrefour n'interdit pas `/s` aux robots génériques (il ne
bloque que `/set-store`, `/get-store`, `/webview`, `/g`, `/b`). Le 403 ne vient
donc pas du `robots.txt` mais d'une **protection anti-bot active** au niveau de
la couche applicative.

C'est le fait le plus structurant de cette note : l'obstacle n'est pas
théorique, il est déjà là, avant même d'avoir écrit une ligne de scraper.

---

## 3. Option A — automatisation complète par navigateur piloté

Un Playwright headless se connecte au compte, cherche chaque produit, l'ajoute
au panier, et rend la main à l'utilisateur pour le paiement.

### Ce qu'il faut réellement construire

1. Passer les scrapers en `headless=True` et ajouter Playwright + Chromium à
   l'image Docker (~400 Mo d'image en plus).
2. Réécrire les sélecteurs contre les vrais sites, avec `wait_for_selector`.
3. Gérer la session : connexion, cookies, expiration, bannière de consentement,
   sélection du magasin de retrait.
4. Traiter la protection anti-bot — c'est le point dur, et il n'a pas de
   solution stable dans la durée.
5. Rendre la tâche asynchrone : un panier de 40 produits prend plusieurs
   minutes, ça ne tient pas dans une requête HTTP. Il faut une file de tâches
   et un suivi de progression.
6. Prévoir la reprise sur incident : captcha, produit indisponible, session
   perdue en cours de route.

### Coût d'hébergement

Chromium ne tient pas dans 512 Mo. L'instance gratuite et la Starter (7 $/mois,
512 Mo) sont donc éliminées d'office. Il faut au minimum une **Standard à
25 $/mois** (2 Go), à laquelle s'ajoute le forfait workspace.

Ordre de grandeur réaliste : **25 à 50 $/mois** pour une application familiale
utilisée une fois par mois. Rapporté à l'usage, c'est cher.

### Risques

- **Fragilité permanente.** Chaque refonte du front de Carrefour ou Leclerc
  casse le scraper. Sans test d'intégration contre le vrai site — impossible à
  faire tourner en CI de façon fiable — la casse se découvre en production, au
  pire moment : le jour des courses.
- **Course à l'armement.** Les protections anti-bot évoluent. Les contourner
  demande un effort récurrent, et ce n'est pas un effort qui produit de la
  valeur produit.
- **Conditions d'utilisation.** Les CGU des enseignes interdisent
  habituellement l'accès automatisé. Le `robots.txt` permissif sur `/s` ne vaut
  pas autorisation contractuelle. Usage strictement familial, mais le risque
  n'est pas nul.
- **Mot de passe en clair côté serveur.** Pour se connecter, il faut stocker
  les identifiants Carrefour/Leclerc. Le chiffrement Fernet existe
  (`app/core/security.py`), mais la clé vit sur le même serveur que les données
  — et `decrypt_credentials` accepte encore silencieusement un jeton non
  chiffré. C'est la responsabilité la plus lourde du projet, pour un bénéfice
  de confort.

### Effort estimé

Deux à quatre jours pour une première version qui marche, puis **une
maintenance récurrente et non planifiable**. C'est ce dernier point qui coûte,
pas le développement initial.

---

## 4. Option B — deep links de recherche (semi-automatique)

L'app ne touche pas au panier. Elle produit, pour chaque drive, une liste
ordonnée par rayon où chaque ligne est un lien de recherche pré-rempli vers le
site du drive. L'utilisateur ouvre, tape « ajouter », revient. Un produit =
un tap.

### Ce qu'il faut construire

1. Construire les URL de recherche par enseigne (le patron Carrefour `/s?q=`
   est déjà connu du code actuel).
2. Un écran de liste mobile : case à cocher par ligne, progression visible,
   état conservé si l'app passe en arrière-plan.
3. Le tri par rayon, qui existe déjà via `product_typology` et les catégories.

Rien de plus. Pas de navigateur serveur, pas de compte, pas de mot de passe.

### Coût d'hébergement

Aucun surcoût. L'app reste une API légère : l'instance gratuite ou la Starter à
7 $/mois suffisent.

### Risques

- Quasi nuls sur le plan technique : un patron d'URL de recherche est une
  surface d'API bien plus stable qu'un arbre DOM, et sa rupture est triviale à
  corriger.
- Aucun stockage d'identifiant, donc aucune responsabilité sur les comptes.
- Aucun problème de CGU : l'utilisateur navigue lui-même.

### Le vrai coût : l'expérience

C'est moins magique. Pour 40 produits, l'utilisateur fait 40 allers-retours au
lieu de zéro. Il faut être honnête là-dessus : **ça ne supprime pas le pain
point #1, ça le réduit.** La saisie disparaît, la navigation reste.

Sur mobile, avec une liste bien faite et le tri par rayon, on passe
vraisemblablement de 30-40 minutes de saisie à 5-10 minutes de validation.
C'est un gain réel, mais ce n'est pas la promesse initiale.

### Effort estimé

Un à deux jours, puis **quasiment aucune maintenance**.

---

## 5. Option C — hybride

Option B livrée maintenant, avec l'architecture asynchrone (file de tâches,
suivi de progression) posée dès le départ pour que l'option A puisse s'y
brancher plus tard sans réécriture.

Concrètement : on construit le contrat `generate → job → résultats par drive`
tout de suite, mais le premier moteur derrière ce contrat produit des deep
links. Si l'automatisation devient un jour indispensable, elle remplace le
moteur sans toucher au reste.

C'est plus de travail que B seul, mais ça évite de peindre le produit dans un
coin.

---

## 6. Comparatif

| Critère | A — automatisation | B — deep links | C — hybride |
|---|---|---|---|
| Hébergement | 25-50 $/mois | 0-7 $/mois | 0-7 $/mois |
| Effort initial | 2-4 jours | 1-2 jours | 2-3 jours |
| Maintenance | Récurrente, non planifiable | Quasi nulle | Quasi nulle |
| Fiabilité le jour J | Faible, casse silencieuse | Élevée | Élevée |
| Mot de passe drive stocké | Oui | Non | Non |
| Exposition CGU | Réelle | Nulle | Nulle |
| Tient la promesse produit | Oui, quand ça marche | Partiellement | Partiellement, évolutif |

---

## 7. Recommandation

**Option C.**

Le raisonnement tient en trois points :

1. **Le 403 n'est pas un détail.** La protection anti-bot est active avant même
   qu'on ait commencé. Construire l'option A, c'est s'engager dans une course
   qu'on ne gagne pas durablement, pour une app familiale utilisée une fois par
   mois.

2. **La fiabilité prime sur la magie.** Une app qui fait gagner 25 minutes de
   façon certaine bat une app qui promet 35 minutes mais casse un mois sur
   trois — d'autant que la panne survient précisément au moment où on en a
   besoin.

3. **Stocker les mots de passe Carrefour et Leclerc est une responsabilité
   disproportionnée** au regard du confort gagné. L'option B la supprime
   entièrement.

L'option A reste défendable si le gain de temps est *le seul* critère qui
compte pour toi et que tu acceptes la maintenance. Mais elle ne devrait pas
être choisie par défaut, simplement parce que c'était l'intention initiale.

**Quelle que soit l'option retenue, une chose doit être faite immédiatement :**
retirer de `LaunchGeneration.jsx` le texte qui promet *« On se connecte à chaque
drive… on ajoute les produits au panier »*. Il décrit une fonctionnalité qui
n'existe pas.

---

## 8. Ce qu'il reste à décider

- [ ] Option retenue : A, B ou C
- [ ] Si A : acceptes-tu le passage à une instance Render à 25 $/mois et le
      stockage des identifiants drive côté serveur ?
- [ ] Si B ou C : valide-t-on que le parcours cible est « une liste par rayon,
      un tap par produit » plutôt que « zéro intervention » ?
- [ ] Dans tous les cas : réécrire le texte de `LaunchGeneration.jsx`

---

## Annexe — sources

- Prix des instances Render : [Render Instance Types](https://render.com/docs/compute-plans)
- Tests HTTP effectués le 18 août 2026 depuis un client classique, User-Agent Chrome 120
- Code audité : `backend/app/services/drives/`, `backend/app/routes/wizard.py`,
  `frontend/src/components/wizard/LaunchGeneration.jsx`
