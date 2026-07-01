# PPG Courir à Sausset

Application dédiée à la gestion des séances de **préparation physique générale** (jeudi 19h), indépendante du Challenge CAS.

## Fonctionnalités

- Inscription / désinscription par les adhérents (cookie + e-mail, sans mot de passe)
- Lien personnel `/m/[token]` à conserver en signet
- Génération de saison : tous les jeudis du 1er jeudi de septembre au dernier jeudi de juin
- Ajout à l'agenda Google ou fichier `.ics` (fuseau `Europe/Paris`, rappel 2 h avant)
- Recherche publique des inscriptions par participant
- Top 10 assiduité public
- Admin Manon : contenu séance, annulation, feuille de présence, stats bureau

## Installation

```bash
cd ppg-sausset
npm install
cp .env.local.example .env.local
```

Renseigner un **projet Supabase dédié** (séparé de Challenge CAS), puis exécuter `supabase/schema.sql` dans le SQL Editor.

```bash
npm run dev
```

Ouvrir http://localhost:3000

## Variables d'environnement

Copier `.env.local.example` → `.env.local`, puis renseigner les clés depuis  
[Supabase → PPG → Settings → API](https://supabase.com/dashboard/project/evzhlkcrjmcgoxqgnzfr/settings/api).

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://evzhlkcrjmcgoxqgnzfr.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clé `anon` / publishable |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé `service_role` (secrète, serveur uniquement) |
| `PPG_ADMIN_PIN` | PIN admin Manon (coach) |
| `PPG_SUPER_ADMIN_PIN` | PIN Suzanne (coach + facturation) |
| `BREVO_API_KEY` | Clé API Brevo pour l'envoi aux trésoriers |
| `BREVO_SENDER_EMAIL` | E-mail expéditeur vérifié dans Brevo |
| `BREVO_SENDER_NAME` | Nom affiché (ex. `PPG Courir à Sausset`) |
| `CRON_SECRET` | Secret pour le rappel automatique (cron Vercel) |
| `NEXT_PUBLIC_APP_URL` | URL publique (liens personnels) |

## Facturation (Suzanne)

- `/admin/facturation` — réservé au PIN super admin (`PPG_SUPER_ADMIN_PIN`)
- Manon (`PPG_ADMIN_PIN`) garde l'admin coach sans accès facturation
- **Inscriptions** : les adhérents s'inscrivent seuls en ligne ; Suzanne marque seulement les **présences**
- **Validation mensuelle** : statut pré-rempli par séance, modifiable par Suzanne avant envoi
- **Destinataires** configurables dans l'appli : trésoriers (principal), Manon (copie), Suzanne (copie + rappel)
- **Rappel automatique** : e-mail à Suzanne après le dernier jeudi du mois (cron Vercel)

Migration SQL : `supabase/migration_billing.sql` puis `supabase/migration_billing_v2.sql`

## Configuration Brevo

1. Créer un compte sur [brevo.com](https://www.brevo.com) (offre gratuite : 300 e-mails/jour)
2. **Expéditeurs** → ajouter et vérifier l'adresse d'envoi (ex. `ppg@courir-a-sausset.fr` ou une adresse perso)
3. **SMTP & API** → **Clés API** → créer une clé avec permission d'envoi transactionnel
4. Sur **Vercel** (projet `ppg-sausset`) → Settings → Environment Variables :
   - `BREVO_API_KEY` = la clé API
   - `BREVO_SENDER_EMAIL` = l'adresse vérifiée
   - `BREVO_SENDER_NAME` = `PPG Courir à Sausset`
   - `PPG_SUPER_ADMIN_PIN` = PIN choisi pour Suzanne
5. Redéployer l'application
6. Ajouter `CRON_SECRET` (chaîne aléatoire longue) sur Vercel pour le rappel automatique
7. Suzanne se connecte sur `/admin` avec son PIN → **Facturation trésoriers**
8. Configurer les e-mails : trésoriers, Manon (copie), Suzanne (copie + rappel)

## Premier lancement

1. **SQL Editor** Supabase → exécuter `supabase/schema.sql` (projet vide)  
   ou `supabase/migration_paid_members.sql` si la base existait déjà
2. Renseigner `.env.local`
3. `npm run dev` → http://localhost:3000
4. `/admin` → PIN → **Créer la saison**
5. **Importer la liste des adhérents à jour** (section admin)
6. Les adhérents créent leur profil sur `/inscription`

## Liste adhérents (adhésion payée)

Dans l'admin, coller une liste (une personne par ligne) :

```text
Suzanne Huss
Philippe Lacues
Marina;Dupont
```

- **Remplacer** : nouvelle liste complète
- **Ajouter** : complète sans effacer

Si le prénom/nom n'est pas trouvé à l'inscription → lien vers  
https://www.courirasausset.com/devenir-membre

Tant que la liste est vide, l'inscription reste ouverte (utile au tout premier paramétrage).

## Connexion adhérent (sans mot de passe)

- **Nouveau** : prénom + nom + e-mail → cookie posé + lien personnel affiché
- **Retour** : e-mail sur `/connexion` → cookie reposé + lien rappelé
- **Lien direct** : `/m/[token]` → cookie + redirection vers `/moi`

La solution cookie est **gratuite** (aucun service tiers) : le navigateur mémorise l'identité 1 an.
