# Sympt'mes

Application web (PWA, installable sur iPhone) centrée sur un axolotl à nourrir chaque jour,
qui grandit, fait des compliments et a sa boutique, et sur une salle de jeux (le jeu des tubes et ses boss,
d'autres jeux à venir). Interface en français, synchronisée entre les téléphones via Supabase.

- **Axolotl** (onglet principal) : un repas par jour (+10 💧, il grandit jusqu'à « Légendaire » en 14 jours de repas),
  humeur selon les jours oubliés, compliments, boutique de tenues.
- **Jeux** : liste des jeux ; chaque jeu rapporte des gouttes (étoiles, boss).
- **Réglages** : prénom, mascotte de victoire, synchronisation, copie de secours, compte.

> Ce dépôt ne contient **que du code**. Aucune donnée personnelle n'y est stockée.

## Organisation du code

| Fichier | Rôle |
|---|---|
| `index.html`, `css/app.css` | page unique et styles |
| `js/config.js` | URL Supabase + clé **publique** |
| `js/app.js` | connexion, onglets, mises à jour |
| `js/pet.js`, `js/pet-art.js` | l'axolotl (page, dessin, boutique) |
| `js/care.js` | repas quotidiens (clés `care:AAAA-MM-JJ`) |
| `js/wallet.js` | cagnotte de gouttes commune |
| `js/games.js` | onglet Jeux : liste des jeux (**ajouter un jeu ici**) |
| `js/game.js`, `js/boss.js`, `js/levels.js`, `js/game-shop.js` | le jeu des tubes, ses boss et sa boutique |
| `js/run.js`, `js/run-3d.js` | Axolo Run, course 3D (three.js chargé seulement au lancement du jeu) |
| `vendor/three.module.js`, `models/` | three.js r169 (MIT, avec les modules GLTF et bloom) et modèles 3D CC0 (voir `models/CREDITS.md`) |
| `js/mascot.js` | image de la mascotte de victoire |
| `js/settings.js`, `js/backup.js` | réglages et copie de secours |
| `js/store.js`, `js/sync.js` | stockage local (IndexedDB) et synchronisation Supabase (API REST, sans librairie) |
| `sw.js`, `manifest.webmanifest`, `icons/` | installation et hors ligne |
| `supabase/schema.sql` | table + sécurité, à exécuter dans Supabase |
| `supabase/suppression-sante.sql` | suppression unique des anciennes tables du suivi santé |
| `backup/weekly-backup.yml` | modèle de sauvegarde hebdomadaire (dépôt privé) |

### Ajouter un jeu
1. Créer un module (ex. `js/memory.js`) qui exporte `render(container)`, `bind(container)`, `cover()` (la carte
   affichée dans la liste) et, si besoin, `busy()` / `leave()`. Le bouton retour vers la liste utilise `data-d="hub"`.
2. L'ajouter dans `GAMES` (`js/games.js`) et dans `FILES` (`sw.js`).
3. Pour qu'il rapporte des gouttes, l'ajouter au calcul de `wallet()` (`js/wallet.js`).

## Mise en route

### 1. Supabase
1. Créer un projet sur <https://supabase.com> (plan Free, région **West EU (Paris)** ou **Central EU (Frankfurt)**).
2. **Authentication → Users → Add user → Create new user** : email + mot de passe partagés, cocher *Auto Confirm User*.
3. **Authentication → Sign In / Providers → Email** : *Allow new users to sign up* active ou non le bouton
   « Créer un compte » de l'appli (chaque compte n'a accès qu'à ses propres données).
   *Confirm email* oblige à cliquer sur un lien reçu par email avant la première connexion.
   **Authentication → URL Configuration** : *Site URL* = l'adresse GitHub Pages de l'appli
   (ex. `https://<utilisateur>.github.io/sympt-mes/`), à ajouter aussi dans *Redirect URLs* :
   c'est là que renvoient les liens « confirmer mon compte » et « mot de passe oublié ».
4. **SQL Editor → New query** : coller le contenu de `supabase/schema.sql`, puis **Run**.
   Projet existant qui avait le suivi santé : lancer aussi une fois `supabase/suppression-sante.sql`.
5. **Project Settings → API Keys** : noter la *Project URL* et la clé **publique** (*publishable* `sb_publishable_…` ou *anon*).
   Ne jamais utiliser la clé *secret* / *service_role*.

### 2. Brancher l'appli
Remplacer les deux valeurs de `js/config.js` par l'URL et la clé publique, puis pousser.

### 3. GitHub Pages
**Settings → Pages** : *Source* = *Deploy from a branch*, branche `main`, dossier `/ (root)`.
L'appli sera servie sur `https://<utilisateur>.github.io/sympt-mes/`.

### 4. Installer sur l'iPhone
Ouvrir l'adresse dans **Safari** → bouton Partager → **Sur l'écran d'accueil**. Se connecter une fois.

### 5. Sauvegarde automatique hebdomadaire (chiffrée)
1. Créer un dépôt **privé** séparé, par ex. `sympt-mes-backup`.
2. Y copier `backup/weekly-backup.yml` dans `.github/workflows/weekly-backup.yml`.
3. Dans ce dépôt privé : **Settings → Secrets and variables → Actions → New repository secret**, créer
   `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_EMAIL`, `SUPABASE_PASSWORD`, `BACKUP_PASSPHRASE`.
4. **Actions → Sauvegarde hebdomadaire → Run workflow** pour tester.

Chaque lundi, un fichier `backups/sympt-mes-AAAA-MM-JJ.json.gpg` (AES-256) est ajouté.
Pour le relire : `gpg --decrypt fichier.json.gpg > sauvegarde.json`, puis dans l'appli
**Réglages → Restaurer un fichier de sauvegarde**. Le passage hebdomadaire évite aussi
la mise en pause automatique du projet Supabase gratuit.

## Mettre à jour l'appli
Après une modification du code, incrémenter `VERSION` dans `sw.js` pour que les
téléphones récupèrent la nouvelle version (fermer puis rouvrir l'appli).

## Sécurité
- Seule la clé publique Supabase est dans le code ; l'accès aux données exige la connexion
  (Row Level Security : chaque ligne n'est lisible que par son propriétaire).
- Inscriptions : si elles sont ouvertes dans Supabase, n'importe qui connaissant l'adresse peut créer un compte,
  mais ne voit que ses propres données (Row Level Security). Les fermer réserve l'appli aux comptes créés à la main.
- Les sauvegardes automatiques sont chiffrées et stockées dans un dépôt privé.
