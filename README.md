# Sympt'mes

Application web (PWA, installable sur iPhone) de suivi quotidien des symptômes,
pensée pour une suspicion de maladie de Crohn. Interface en français, saisie en moins d'une minute.

- **Aujourd'hui** : symptômes cochés par catégorie avec intensité 0–10, note libre, repas (aliments récents en un tap, étiquettes, heure).
- **Synthèse** : semaine / mois, courbe d'intensité, calendrier, symptômes fréquents, jours difficiles, alertes en rouge, croisement repas × symptômes.
- **Enregistrer / Exporter** : PDF pour le médecin (7 jours, 30 jours, tout) ou sauvegarde complète (JSON), via la fenêtre de partage iOS.
- Fonctionne hors ligne ; synchronisation automatique entre les deux téléphones via Supabase.

> Ce dépôt ne contient **que du code**. Aucune donnée de santé n'y est stockée.

## Organisation du code

| Fichier | Rôle |
|---|---|
| `index.html`, `css/app.css` | page unique et styles |
| `js/config.js` | URL Supabase + clé **publique** |
| `js/catalogue.js` | liste des symptômes, catégories, repas, étiquettes |
| `js/store.js` | stockage local (IndexedDB), modifications en attente |
| `js/sync.js` | connexion et synchronisation Supabase (API REST, sans librairie) |
| `js/today.js`, `js/summary.js`, `js/settings.js` | les trois écrans |
| `js/analysis.js` | calculs des synthèses |
| `js/export.js` | PDF (jsPDF) et sauvegarde, partage iOS |
| `sw.js`, `manifest.webmanifest`, `icons/` | installation et hors ligne |
| `supabase/schema.sql` | tables + sécurité, à exécuter dans Supabase |
| `backup/weekly-backup.yml` | modèle de sauvegarde hebdomadaire (dépôt privé) |
| `vendor/jspdf.umd.min.js` | jsPDF 4.2.1 (licence MIT, `vendor/jspdf.LICENSE`) |

## Mise en route

### 1. Supabase
1. Créer un projet sur <https://supabase.com> (plan Free, région **West EU (Paris)** ou **Central EU (Frankfurt)**).
2. **Authentication → Users → Add user → Create new user** : email + mot de passe partagés, cocher *Auto Confirm User*.
3. **Authentication → Sign In / Providers → Email** : désactiver *Allow new users to sign up*.
4. **SQL Editor → New query** : coller le contenu de `supabase/schema.sql`, puis **Run**.
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
- Les inscriptions sont fermées : seul le compte créé à la main existe.
- Les sauvegardes automatiques sont chiffrées et stockées dans un dépôt privé.
