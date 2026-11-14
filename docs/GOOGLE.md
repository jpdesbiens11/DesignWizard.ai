# Connexion Google, Google Drive et accès à la démo

Trois choses distinctes, toutes facultatives pour un usage sur votre poste :

| Quoi | À quoi ça sert | Où c'est réglé |
|---|---|---|
| **Connexion Google** | savoir qui se connecte ; ouvrir la porte de la démo en ligne | `web/js/config.js` → `clientId` |
| **Google Drive** | ranger le projet dans le Drive de l'utilisateur, en arborescence lisible | automatique une fois connecté |
| **Accès à la démo** | réserver la démo en ligne aux comptes approuvés ; rôle d'administrateur | `web/acces.json` |

Sur votre poste (`python designwizard.py`, adresse `localhost`), rien de tout cela n'est demandé : l'application
s'ouvre directement et enregistre les projets sur le disque.

## 1. Créer l'identifiant client OAuth (une fois, cinq minutes)

1. Ouvrez la [console Google Cloud](https://console.cloud.google.com/) et choisissez ou créez un projet.
2. **API et services → Bibliothèque** : activez « Google Drive API ».
3. **API et services → Écran de consentement OAuth** : type « Externe », nom « DesignWizard.ai », votre adresse de
   contact. Champs d'application (scopes) : `openid`, `email`, `.../auth/drive.file`.
   Laissez l'état de publication sur **« Test »** et ajoutez les adresses Gmail de vos collaborateurs dans
   **Utilisateurs test** : Google refusera alors la connexion à tout autre compte. C'est la vraie barrière.
4. **API et services → Identifiants → Créer des identifiants → ID client OAuth**, type « Application Web ».
   **Origines JavaScript autorisées** : l'adresse où la démo est servie, sans chemin — par exemple
   `https://jpdesbiens11.github.io` — et, pour utiliser Drive depuis votre poste, `http://localhost:8070` et
   `http://127.0.0.1:8070`. Aucune « URI de redirection » n'est nécessaire.
5. Copiez l'**ID client** (il finit par `.apps.googleusercontent.com`) dans `web/js/config.js` :

   ```js
   clientId: "1234567890-xxxxxxxx.apps.googleusercontent.com",
   ```

   Cet identifiant est **public par nature** : il ne fonctionne que depuis les origines déclarées à l'étape 4.
   Il n'y a aucun secret client dans cette application.

Vous pouvez aussi réutiliser l'identifiant d'un autre de vos projets Google si son origine est la même ; l'écran
de consentement affichera alors le nom de ce projet-là, et les deux applications verront les fichiers l'une de
l'autre (la portée `drive.file` est attachée à l'identifiant client).

## 2. Ce que l'application demande, et ce qu'elle ne voit pas

- **Portées** : `openid email` (qui êtes-vous) et `drive.file` — uniquement **les fichiers créés par cette
  application**. Le reste de votre Drive lui est invisible.
- **Jeton** : gardé en mémoire seulement, jamais dans le stockage du navigateur ; valable une heure, renouvelé sans
  invite. Fermer l'onglet le fait disparaître.
- **Aucun serveur** : le navigateur parle directement à Google. Rien ne passe par un service de DesignWizard.ai.
- Le script de connexion Google n'est chargé qu'au premier clic sur « Se connecter avec Google » : tant que vous ne
  vous connectez pas, l'application ne contacte aucun site.

## 3. Le projet dans Google Drive

```text
DesignWizard.ai/
  <Projet>/
    projet.dwiz                      le projet entier (ce que « Ouvrir depuis Drive » relit)
    01_Pieces/<numéro> <nom>/        .part.dwiz · .step · .stl · .dxf · _decoupe.dxf · .pdf · .fs · _gamme.txt
    02_Assemblages/<numéro> <nom>/   .assembly.dwiz · .step · _nomenclature.csv
    03_Analyses/                     physique.dwiz
    04_Rapports/
```

- **Enregistrer le projet** écrit `projet.dwiz` ; **Publier les artéfacts** construit et dépose tous les fichiers
  d'échange ; une case permet d'enregistrer après chaque modification.
- Les dossiers sont retrouvés par une étiquette invisible, pas par leur nom : vous pouvez les renommer, les
  déplacer et les partager dans Drive.
- Partager le dossier du projet avec un collègue ou un atelier se fait dans Drive, comme pour n'importe quel
  dossier.

## 4. Réserver la démo en ligne aux comptes approuvés

La page hébergée s'ouvre sur une porte : connexion Google, puis vérification que le compte est dans la liste
`web/acces.json`.

```json
{ "v": 1, "mode": "approved", "salt": "…", "iterations": 210000, "admins": ["…64 caractères…"], "approved": [] }
```

- La liste **ne contient aucune adresse** : chaque compte y est une empreinte (PBKDF2-SHA-256, 210 000 tours, sel
  du fichier) de son adresse en minuscules. Le fichier peut donc vivre dans un dépôt public. Limite à connaître :
  quelqu'un qui *devine* une adresse peut vérifier qu'elle est dans la liste ; il ne peut pas la retrouver.
- `mode` : `approved` (comptes de la liste) ou `open` (tout compte Google connecté).
- `admins` : comptes administrateurs ; ils voient l'outil de gestion de la liste dans **Compte → Accès**.

**Approuver quelqu'un.**

1. La personne ouvre la démo et se connecte : l'écran lui montre son **empreinte d'accès** et un bouton
   « Demander l'accès » qui ouvre une demande GitHub contenant l'empreinte seulement.
2. L'administrateur ouvre **Compte → Accès à la démo**, colle l'empreinte (ou tape l'adresse : l'empreinte est
   calculée dans son navigateur), clique « Ajouter », puis « Télécharger acces.json ».
3. Il remplace `web/acces.json` dans le dépôt et publie. La personne se reconnecte : la porte s'ouvre.

Pour voir la porte sur votre poste, ajoutez `?porte` à l'adresse : `http://127.0.0.1:8070/?porte`.

**Ce que cette porte est, et n'est pas.** C'est la politique d'accès de la page hébergée, appliquée dans le
navigateur. Le code est libre (MIT) : quiconque clone le dépôt fait tourner l'application chez lui. Ce qui empêche
réellement un compte non invité de se connecter, c'est la liste des **utilisateurs test** de l'écran de consentement
Google (étape 1.3). Aucune donnée d'un utilisateur n'est exposée par la porte : chacun ne voit que son propre Drive.

## 5. Dépannage

| Message | Cause | Correctif |
|---|---|---|
| « La connexion Google n'est pas configurée » | `clientId` vide | étape 1.5 |
| Fenêtre Google : `origin_mismatch` | l'adresse de la page n'est pas dans les origines autorisées | étape 1.4 |
| « Google a refusé l'accès » | compte absent des utilisateurs test, ou permissions refusées | étape 1.3 |
| « Ce compte n'est pas encore approuvé » | empreinte absente de `web/acces.json` | section 4 |
| « … demande une page servie en HTTPS » | page servie en `http://` ailleurs que sur `localhost` | servir en HTTPS |
