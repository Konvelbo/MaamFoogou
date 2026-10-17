# Analyse Design & Expérience Utilisateur — Maamfoogou

> **Méthodologie** : Inspection réelle exécutée avec **Playwright CLI** (`@playwright/cli`) sur le site de référence `https://www.b-z-b.com/vetement-femme/tee-shirt/` en vue **Desktop (`1440×900`)** et **Mobile (`390×844`)**.

---

## 1. Pages testées et captures d'écran réalisées

Toutes les captures ont été générées via Playwright CLI et enregistrées dans le dossier [`design-screenshots/`](./design-screenshots/) :

| Page testée | URL inspectée | Capture Desktop (`1440×900`) | Capture Mobile (`390×844`) |
| :--- | :--- | :--- | :--- |
| **Catalogue / Liste T-shirts (PLP)** | `https://www.b-z-b.com/vetement-femme/tee-shirt/` | [`plp-desktop-1440x900.png`](./design-screenshots/plp-desktop-1440x900.png) | [`plp-mobile-390x844.png`](./design-screenshots/plp-mobile-390x844.png) |
| **Fiche Produit (PDP)** | `https://www.b-z-b.com/p/200830910001.html` | [`pdp-desktop-1440x900.png`](./design-screenshots/pdp-desktop-1440x900.png) | [`pdp-mobile-390x844.png`](./design-screenshots/pdp-mobile-390x844.png) |
| **Accueil Boutique** | `https://www.b-z-b.com/` | [`home-desktop-1440x900.png`](./design-screenshots/home-desktop-1440x900.png) | [`home-mobile-390x844.png`](./design-screenshots/home-mobile-390x844.png) |
| **Connexion / Création de compte** | `https://www.b-z-b.com/client/identification/` | [`login-desktop-1440x900.png`](./design-screenshots/login-desktop-1440x900.png) | [`login-mobile-390x844.png`](./design-screenshots/login-mobile-390x844.png) |

---

## 2. Observations détaillées par composant & interaction

### A. Navigation, En-tête et Hiérarchie visuelle
- **Header ultra-épuré** : Fond blanc `#FFFFFF`, bordure inférieure fine `#E5E7EB`. Logo typographique fort en noir `#111111`. Barre de recherche centrale encadrée (`border: 1px solid #D1D5DB`), actions rapides à droite (`Compte` avec pastille de notification orange/terre cuite, `Panier` avec compteur numérique).
- **Navigation par pilules (Pills)** : Sous le titre de catégorie (`h1` sobre en `16px-20px`, `font-weight: 500`), les sous-catégories sont présentées sous forme de **pilules arrondies** (`border-radius: 9999px`, bordure `#E5E7EB`, fond blanc, survol noir).
- **Mobile First** : Sur `390×844`, les pilules défilent horizontalement sans barre de défilement visible, et la barre `Filtrer | 139 articles | Trier` reste compacte sur une seule ligne.

### B. Grille & Cartes Produit (PLP)
- **Disposition de la grille** :
  - **Mobile (`390×844`)** : Grille **2×2** (`grid-template-columns: repeat(2, minmax(0, 1fr))`), espacement horizontal réduit (`10px`) pour maximiser la surface d'image, espacement vertical `24px`.
  - **Desktop (`1440×900`)** : Grille **4 à 5 colonnes** aérée (`gap: 16px`).
- **Structure d'une carte produit** :
  - Conteneur image au ratio vertical portrait **`3:4`** sur fond gris studio neutre (`#EAEAEA`), sans bordure externe lourde.
  - **Badges en haut à gauche** :
    - Badge accentué vert forêt (`#0F5132`, texte blanc `10px` gras majuscule, `border-radius: 4px`) ou mention `NEW` / promo en rouge brique (`#DC2626`).
  - **Carrousel intégré à la carte** :
    - Sous l'image, une **barre d'indicateurs segmentée fine** (`height: 2px`) montre la position dans les vues du produit (face, dos, zoom, variantes).
  - **Pastilles de couleurs** : Cercles de `14px` avec bordure fine `#D1D5DB` et compteur `+2`.
  - **Typographie carte** : Nom du modèle sur 1 ligne (`14px`, `#212529`, `font-weight: 400`), prix juste en dessous (`14px`, `#111111`, `font-weight: 700`).

### C. Fiche Produit (PDP), Sélecteurs & Boutons Like / Partage
- **Barre d'action supérieure** : Bouton `← Retour` à gauche ; icônes **Cœur (Like/Wishlist)** et **Partage** alignées en haut à droite au-dessus du visuel (très accessible au pouce sur mobile).
- **Galerie produit** : Grande vue principale + vignettes verticales (desktop) ou horizontales sous l'image (mobile).
- **Sélecteur de tailles** : Grille de pilules ovales (`border-radius: 9999px`, `border: 1px solid #E5E7EB`, hauteur `40px`). Les tailles épuisées sont grisées et désactivées.

### D. Authentification (Login / Création de compte)
- Carte blanche centrée (`max-width: 480px`, `border-radius: 16px`, ombre douce `0 8px 30px rgba(0,0,0,0.05)`) sur fond `#F9FAFB`.
- Bouton principal plein (`width: 100%`, fond `#000000`, texte `#FFFFFF`, `border-radius: 8px`, `height: 48px`).

---

## 3. Synthèse & Design Tokens retenus pour **Maamfoogou**

Pour **Maamfoogou** (boutique de t-shirts personnalisables 3D au Burkina Faso et dans la sous-région), nous retenons la clarté éditoriale, la grille 2×2 mobile et les micro-interactions observées, tout en infusant une **identité chaleureuse burkinabè contemporaine** (touches Terre de Sienne / Faso Ocre, Vert Karité, prix en **FCFA**, badges Créateur & XP) :

### Palette de couleurs (Design Tokens)
- `--bg-page` : `#FAF9F6` (Blanc Coton Naturel, lumineux et lisible en plein soleil sur mobile)
- `--bg-surface` : `#FFFFFF` (Cartes, modales, tiroirs, barre de navigation)
- `--bg-studio-card` : `#EFECE6` (Fond studio neutre chaud pour les aperçus de t-shirts)
- `--text-primary` : `#141413` (Noir Carbone profond)
- `--text-secondary` : `#57534E` (Gris Pierre chaude)
- `--text-muted` : `#8A847C`
- `--accent-primary` : `#C2410C` (Terracotta / Terre du Faso — badges, cœur actif, indicateurs)
- `--accent-gold` : `#D97706` (Or Solaire — barres d'XP, niveaux, mise en avant)
- `--accent-green` : `#115E59` (Vert Karité / Faso — badges « Créateur », stock disponible, Mobile Money)
- `--border-subtle` : `#E7E5E4`

### Typographies & Tailles
- **Titres & Prix (`--font-display`)** : `'Inter', system-ui, -apple-system, sans-serif` (poids `600` à `800`, tracking serré `-0.02em`)
- **Corps & UI (`--font-sans`)** : `'Inter', system-ui, sans-serif` (`14px` base mobile, `16px` desktop)
- **Code & Références (`--font-mono`)** : `'JetBrains Mono', monospace` (codes de parrainage `?ref=`, niveaux XP, SKU stock)

### Espacements, Rayons & Ombres
- **Grille Mobile (`< 640px`)** : `grid-cols-2 gap-3` (affiche 4 cartes en 2×2 dans la section « Modèles à découvrir »)
- **Grille Desktop (`>= 1024px`)** : `grid-cols-5 gap-5` (affiche jusqu'à `FEATURED_DESIGNS_LIMIT = 5` cartes)
- **Rayons (`border-radius`)** :
  - Cartes produit : `12px` (`rounded-xl`)
  - Boutons & Sélecteurs de taille : `9999px` (`rounded-full`, style pilule BZB)
  - Modales & Sections : `16px` (`rounded-2xl`)
- **Ombres** :
  - Carte au repos : `0 1px 3px rgba(20, 20, 19, 0.04)`
  - Carte au survol / Modale : `0 12px 32px -4px rgba(20, 20, 19, 0.08)`

---

## 4. Structure des pages de Maamfoogou

1. **Accueil (`/`)** :
   - Barre supérieure avec navigation directe, indicateur de niveau/XP si connecté, lien « Mes Collections » avec compteur de likes, et bouton « Personnaliser en 3D ».
   - Bannière d'accueil compacte orientée action (sans landing page bloquante).
   - Section **« Modèles à découvrir »** (`FEATURED_DESIGNS_LIMIT = 5`, grille 2×2 sur mobile, 5 colonnes sur desktop) :
     - Carrousel automatique par carte (Face → Dos → Variantes de couleur, intervalle `3.5s` décalé entre les cartes, transition en fondu `opacity`, pause au survol/toucher, respect de `prefers-reduced-motion`, actif uniquement si visible via `IntersectionObserver`, préchargement de l'image suivante).
     - Bouton Cœur (Like + sauvegarde automatique dans « À acheter plus tard » avec mise à jour optimiste et redirection post-login si visiteur).
     - Compteurs de likes et de commentaires en temps réel.
   - Catalogue complet filtrable (Modèles Officiels Équipe vs Modèles Créateurs).
2. **Fiche Produit / Modèle (`/p/$designId`)** :
   - Détection automatique du paramètre `?ref=CODE` (enregistrement du clic unique + conservation en cookie/localStorage pendant 30 jours).
   - Aperçus Face / Dos, créateur, prix en FCFA, bouton Like, bouton « Personnaliser ce modèle », bouton « Partager mon lien de tracking (?ref=) ».
   - Sélecteurs de couleur et de taille alimentés en temps réel par `getAvailableVariants` et `checkStock` (`available`, `low`, `partial`, `out_of_stock`, `unavailable` + date de réapprovisionnement).
   - Achat direct via Mobile Money burkinabé (Orange Money / Moov Money).
   - **Section Commentaires en temps réel** (paginée, réponses du créateur, édition/suppression par l'auteur, signalement, anti-spam 5/min, nettoyage XSS, gain d'XP quotidien plafonné).
3. **Personnalisation (`/personnaliser`)** :
   - Intègre le système 3D existant via un contrat d'intégration propre (`Design3DIntegrationBridge` + mode aperçu 3D existant sans le modifier), reçoit un design existant et renvoie l'objet `design` normalisé (`0..1`) avec upload vers Convex File Storage.
4. **Mes Collections (`/collections`)** :
   - Section 1 : Modèles créés par l'utilisateur (brouillons et publiés).
   - Section 2 : Produits sauvegardés « À acheter plus tard » (alimentée automatiquement par les likes, avec affichage en temps réel du statut de stock).
5. **Profil & Settings (`/settings`)** :
   - Modification du téléphone et des coordonnées géographiques (ville/quartier/repère à Ouagadougou, Bobo-Dioulasso, sous-région).
   - Tableau de bord Niveau (1 à 100), barre d'XP globale et par domaine (`achats`, `partage`, `creation`, `communaute`), lien de parrainage `/signup?ref=CODE`, récompenses débloquées.
   - Section « À propos de nous » (histoire et mission de Maamfoogou).
6. **Administration (`/admin/stock` et modération)** :
   - Gestion des stocks par variante (`updateStock`, `addStock`, alertes `getLowStock`, bouton « Marquer en rupture », date de réapprovisionnement).
   - Modération des commentaires signalés (`reported` → `hidden` ou `visible`).
   - Simulateur de Webhook Mobile Money signé pour tester le cycle complet `pending` → `paid` (ou `failed` / expiration cron 15 min).
