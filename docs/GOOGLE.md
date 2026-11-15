# Connexion Google, Google Drive et accès à la démo

Trois choses distinctes, toutes facultatives pour un usage sur votre poste :

| Quoi | À quoi ça sert | Où c'est réglé |
|---|---|---|
| **Connexion Google** | savoir qui se connecte ; ouvrir la porte de la démo en ligne | `web/js/config.js` → `clientId` |
| **Google Drive** | le stockage de l'application en ligne : un dossier par produit, rangé et nommé pour être lu | automatique une fois connecté |
| **Accès à la démo** | réserver la démo en ligne aux comptes approuvés ; rôle d'administrateur | `web/acces.json` |

Sur votre poste (`python designwizard.py`, adresse `localhost`), rien de tout cela n'est demandé : l'application
s'ouvre directement et enregistre les projets sur le disque.

## 1. L'identifiant client OAuth

**Ce qui est en place.** `web/js/config.js` contient l'identifiant client du projet Google Cloud du propriétaire,
le même que celui de SuperChef.ai. Les deux applications sont servies depuis la même origine,
`https://jpdesbiens11.github.io`, déjà déclarée pour cet identifiant : la connexion fonctionne donc sans rien
changer dans la console Google. Conséquences à connaître :

- l'écran de consentement de Google affiche le **nom de ce projet-là** ;
- tant que l'écran de consentement est en mode **« Test »**, seuls les **utilisateurs test** de ce projet peuvent se
  connecter : ajoutez-y l'adresse Gmail de chaque collaborateur (Google Cloud → API et services → Écran de
  consentement OAuth → Utilisateurs test). C'est la vraie barrière d'accès ;
- la portée `drive.file` est attachée à l'identifiant : techniquement, les deux applications peuvent voir les
  fichiers l'une de l'autre. En pratique chacune ne cherche que les siens (étiquette `dw` pour DesignWizard.ai).

Cet identifiant est **public par nature** : il ne fonctionne que depuis les origines déclarées. Il n'y a aucun
secret client dans cette application.

**Pour servir l'application ailleurs** (autre domaine, ou Drive depuis votre poste) : console Google Cloud → API et
services → Identifiants → l'ID client OAuth « Application Web » → **Origines JavaScript autorisées** → ajouter
l'adresse sans chemin, par exemple `https://designwizard.exemple.com`, `http://localhost:8070`,
`http://127.0.0.1:8070`. Aucune « URI de redirection » n'est nécessaire.

**Pour un identifiant propre à DesignWizard.ai** (son nom sur l'écran de consentement, ses fichiers séparés) :
créez un ID client OAuth « Application Web » dans un projet Google Cloud où « Google Drive API » est activée, avec
les portées `openid`, `email` et `.../auth/drive.file`, déclarez les origines, et remplacez `clientId` dans
`web/js/config.js`.

## 2. Ce que l'application demande, et ce qu'elle ne voit pas

- **Portées** : `openid email` (qui êtes-vous) et `drive.file` — uniquement **les fichiers créés par cette
  application**. Le reste de votre Drive lui est invisible.
- **Jeton** : gardé en mémoire seulement, jamais dans le stockage du navigateur ; valable une heure, renouvelé sans
  invite. Fermer l'onglet le fait disparaître.
- **Aucun serveur** : le navigateur parle directement à Google. Rien ne passe par un service de DesignWizard.ai.
- **Partage** : « Équipe → Partager mon miroir dans Drive… » donne à une adresse le droit de lire le fichier du projet
  dans votre Drive. C'est le seul partage que fait l'application, et seulement à votre demande ; l'adresse va à Google,
  pas dans le projet.
- **Fichiers des autres** : l'application ne lit le miroir qu'un membre vous a partagé qu'après que vous l'avez désigné,
  une fois, dans le sélecteur de fichiers de Google (section 6). La permission reste `drive.file`.
- Le script de connexion Google n'est chargé qu'au premier clic sur « Se connecter avec Google » : tant que vous ne
  vous connectez pas, l'application ne contacte aucun site. Le sélecteur de fichiers n'est chargé qu'à son premier
  usage, dans l'écran Équipe.

## 3. Google Drive, le stockage de l'application en ligne

Sur la page hébergée, une fois connecté, **votre Google Drive est le stockage de l'application** : la liste des
projets vient de Drive, chaque modification y est enregistrée (quelques secondes après la dernière frappe), et un
projet se rouvre de n'importe quel poste. Rien n'est gardé sur un serveur de DesignWizard.ai. Sur votre poste
(`python designwizard.py`), les projets restent sur le disque et Drive est une option (menu Compte).

```text
DesignWizard.ai/
  LISEZ-MOI.txt
  <Nom du projet>/
    <Nom du projet>.project.dwiz        le projet entier — ce que l'application ouvre
    LISEZ-MOI.txt                       ce qui est où, avec la liste des pièces
    01_Pieces/<numéro> — <nom>/         .part.dwiz · .step · .stl · .dxf · _decoupe.dxf · .pdf · .fs · _gamme.txt
    02_Assemblages/<numéro> — <nom>/    .assembly.dwiz · .step · _nomenclature.csv
    03_Analyses/                        physique.dwiz
    04_Rapports/
    05_Commandes/<date> <numéro> ×<quantité>/    dossier de commande .zip · demande_de_prix.txt
    06_Revisions/<numéro>_<révision> <nom>/      le fichier .dwiz figé de chaque révision libérée (voir REVISIONS.md)
    99_Archives/                        dossiers des pièces retirées du projet
```

Les règles de cette arborescence :

- **Dossiers numérotés** : ils se rangent dans l'ordre du travail, de la pièce à la commande.
- **« numéro — nom »** : un dossier par pièce, que l'on retrouve par son numéro ou par son nom ; il est **renommé
  avec sa pièce**.
- **La date d'abord** (AAAA-MM-JJ) là où le temps compte : les commandes se rangent dans l'ordre chronologique.
- **Rien n'est supprimé** : le dossier d'une pièce retirée du projet va dans `99_Archives` ; un projet supprimé va
  dans la corbeille de Drive (récupérable 30 jours).
- **Un LISEZ-MOI** explique le dossier à qui l'ouvre sans l'application — un collègue, un atelier.
- Dossiers et fichiers sont retrouvés par une étiquette invisible, pas par leur nom : vous pouvez les renommer, les
  déplacer et les **partager** dans Drive comme n'importe quel dossier.

**Enregistrer** se fait tout seul ; **Publier les artéfacts** (menu Compte) construit et dépose tous les fichiers
d'échange ; **Ranger la commande dans Drive** (onglet Artéfacts d'une pièce) crée le dossier daté à partager avec
l'atelier.

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
Google (section 1). Aucune donnée d'un utilisateur n'est exposée par la porte : chacun ne voit que son propre Drive.

## 5. Dépannage

| Message | Cause | Correctif |
|---|---|---|
| « La connexion Google n'est pas configurée » | `clientId` vide | section 1 |
| Fenêtre Google : `origin_mismatch` | l'adresse de la page n'est pas dans les origines autorisées | section 1, « Pour servir l'application ailleurs » |
| « Google a refusé l'accès » | compte absent des utilisateurs test, ou permissions refusées | section 1, utilisateurs test |
| « Ce compte n'est pas encore approuvé » | empreinte absente de `web/acces.json` | section 4 |
| « … demande une page servie en HTTPS » | page servie en `http://` ailleurs que sur `localhost` | servir en HTTPS |
| Le sélecteur affiche « The API developer key is invalid » | pas de clé d'API, ou clé qui n'autorise pas `https://docs.google.com/*` | section 6 |
| Le sélecteur est vide | le membre ne vous a pas partagé son miroir, ou vous êtes sur un autre compte | [EQUIPE.md](EQUIPE.md) |
| Un membre est « à désigner » dans l'écran Équipe | ce compte n'a pas encore ouvert son fichier à l'application | bouton « Désigner… » |

## 6. Le sélecteur de fichiers de Google (Équipe)

Pour lire le miroir qu'un autre membre vous a partagé, l'application passe par le **sélecteur de fichiers de Google**
(Google Picker) : c'est le moyen prévu par Google pour qu'une personne ouvre un fichier précis à une application qui n'a
que la permission `drive.file`. Voir [EQUIPE.md](EQUIPE.md).

- **Ce qui est chargé, et quand** : au premier usage dans l'écran Équipe, le script `https://apis.google.com/js/api.js`
  (et les morceaux qu'il appelle sur le même site) ; la fenêtre du sélecteur est une page de `https://docs.google.com`.
  La politique de sécurité de la page (`web/index.html`, `designwizard.py`) autorise ces deux adresses de plus, et rien
  d'autre.
- **Ce qu'il reçoit** : le jeton de la personne connectée, et le **numéro du projet Google** — les chiffres qui ouvrent
  l'identifiant client. Les deux doivent venir du même projet Google : c'est ce qui donne à l'application le droit de
  relire le fichier désigné.
- **À faire une fois dans le projet Google** : activer l'API « Google Picker »
  (https://console.cloud.google.com/apis/library/picker.googleapis.com).
- **Clé d'API : facultative au départ.** La documentation de Google cite une clé de navigateur parmi ce que reçoit le
  sélecteur, et son exemple de référence en construit un sans clé. `pickerKey` est donc vide dans `web/js/config.js`.
  Si le sélecteur affiche « The API developer key is invalid » : créer une clé (Identifiants → Créer des identifiants →
  Clé API), la restreindre aux sites `https://jpdesbiens11.github.io/*` **et** `https://docs.google.com/*` (la fenêtre
  du sélecteur y est servie) et à l'API Google Picker, puis l'écrire dans `pickerKey`. Une clé de navigateur ainsi
  restreinte est publique par nature, comme l'identifiant client : ce n'est pas un secret.
- **Vérifié** : la vraie bibliothèque se charge et ouvre sa fenêtre sous la politique de sécurité de la page, sans
  violation ; tout le parcours est rejoué contre un Google simulé. **Pas vérifié** : le sélecteur une fois connecté à un
  vrai compte.
