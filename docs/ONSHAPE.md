# DynamiteOrbit.ai × Onshape

DynamiteOrbit.ai peut envoyer un assemblage dans un document Onshape : le 3D (STEP converti en
Part Studios + Assembly natifs), les plans PDF produits par l'application, un dessin natif Onshape par
pièce (associatif au 3D) et les propriétés des pièces (part number, description…).

Onshape **interdit les appels directs depuis un navigateur** (pas de CORS). L'intégration passe donc par
le serveur local : `python designwizard.py`, puis http://127.0.0.1:8070/. Servie en statique (GitHub
Pages, `file://`), l'application fonctionne mais le panneau Onshape indique qu'il faut lancer ce serveur.

> **Statut** — tout est codé d'après la documentation officielle et la spec OpenAPI Onshape (API v17,
> lues le 2026-11-14) et testé contre un faux serveur Onshape (`tests/py/mock_onshape.py`).
> **Aucun essai n'a encore été fait sur un vrai compte Onshape** : voir le tableau « Confirmé / UNCONFIRMED ».

## 1. Créer ses clés API Onshape

1. Connectez-vous à Onshape, puis ouvrez le **Developer Portal** : https://cad.onshape.com/appstore/dev-portal
   (compte Enterprise : sur `https://<votre-entreprise>.onshape.com`). Les libellés exacts des menus
   peuvent changer ; la référence est https://onshape-public.github.io/docs/auth/apikeys/.
2. Rubrique **API keys** → **Create new API key**.
3. Permissions à cocher : lecture du profil, **lecture** et **écriture** des documents. La suppression
   n'est pas nécessaire.
4. Copiez l'**access key** et la **secret key** : la secret key n'est affichée qu'une fois.
5. Dans DynamiteOrbit.ai, panneau **Onshape** → collez les deux clés → **Connecter**.

À savoir : un compte individuel a droit à 2 clés ; une clé agit en votre nom et ne fonctionne que sur le
serveur Onshape qui l'a émise (cad.onshape.com ou votre domaine Enterprise).

### Où vont les clés

- Elles sont vérifiées (`GET /users/sessioninfo`) puis écrites dans `data/onshape_credentials.json`
  (droits `600`, dossier `data/` ignoré par git). **La secret key n'est jamais renvoyée au navigateur,
  jamais journalisée, jamais copiée ailleurs.**
- « Déconnecter » supprime ce fichier. Pour révoquer la clé elle-même, supprimez-la dans le Developer Portal.
- Le serveur n'écoute que sur `127.0.0.1` et n'appelle que `https://*.onshape.com`.

## 2. Ce que la plateforme envoie, et où

Avant tout envoi, l'interface affiche le plan produit par `planPush(job)` (document cible, nombre
d'onglets créés, nombre approximatif d'appels API). Rien ne part sans confirmation.

| Étape | Données envoyées à Onshape | Résultat dans le document |
|---|---|---|
| 1. STEP | le STEP AP214 de l'assemblage (composants nommés) | un onglet « blob » avec le fichier, puis des onglets Part Studio / Assembly créés par la conversion |
| 2. Conversion | — (interrogation de l'état, espacée de 1,5 s à 8 s) | — |
| 3. Repérage | — (liste des onglets et des pièces) | chaque pièce de l'application est associée par son nom à une pièce Onshape |
| 4. PDF | le plan PDF de chaque pièce | un onglet `<part number> – drawing.pdf` (mis à jour s'il existe déjà) |
| 5. Dessins natifs | nom du dessin, pièce source, format ; puis les notes (texte) | un dessin Onshape par pièce : 4 vues standard, cadre et cartouche, bloc de notes |
| 6. Propriétés | part number, description, révision, matériau | propriétés de la pièce, quand Onshape les déclare modifiables |

Chaque étape tolère l'échec : le problème est ajouté aux avertissements (`warnings`) et l'envoi continue.
Le plan PDF joint reste la **référence** pour les cotes et le GD&T ; le dessin natif sert de base associative.

## 3. Limites à connaître

- **Plan Free : les documents sont PUBLICS.** Tout ce qui est envoyé devient visible de tous ;
  l'interface doit l'afficher avant l'envoi. La création d'un document privé peut être refusée : le
  serveur ne bascule jamais en public de lui-même, il renvoie une erreur expliquant de cocher « public ».
- **Quota annuel d'appels API** : 2 500 par utilisateur (Free, Standard, EDU), 5 000 (Professional),
  10 000 (Enterprise). Quota épuisé → erreur 402. Un envoi de 5 pièces (PDF, dessins et propriétés) consomme environ 50 appels.
- **Rate limit** : sur un 429, le serveur attend `Retry-After` (20 s max) et réessaie une fois.
- **Taille** : 60 Mo par fichier. **Délais** : 30 s par appel, 120 s pour un envoi de fichier.
- **Chaque envoi crée de nouveaux onglets** 3D et dessins (seuls les PDF de même nom sont mis à jour).
  Pour une nouvelle révision : nouveau document, ou version Onshape créée avant l'envoi.
- Dessins natifs : seules les **notes** sont écrites (une annotation par ligne). Les tolérances
  géométriques y figurent en texte ; les cotes et cadres GD&T positionnés sont dans le PDF.
- Authentification par clés API en « Basic » : méthode officielle, classée par Onshape pour un usage
  local/test — c'est le cas ici (serveur local, HTTPS vers Onshape). OAuth2 est prévu pour une version hébergée.

## 4. Confirmé / UNCONFIRMED face à l'API réelle

« Confirmé » = lu dans la spec OpenAPI ou la doc officielle. « UNCONFIRMED » = absent des sources
officielles ; le code se protège et un essai sur un vrai compte reste à faire.

| Sujet | Statut | Comportement du code |
|---|---|---|
| Auth `Authorization: Basic accessKey:secretKey` | Confirmé | utilisé tel quel |
| `sessioninfo` répond 204 (vide) si les clés sont fausses | Confirmé (essai sans compte) | seul « 200 + `id` » vaut connexion |
| Redirections 307 à suivre en renvoyant l'auth | Confirmé (liste des endpoints concernés inconnue) | suivies à la main sur tous les appels, vers `*.onshape.com` uniquement |
| Import : `POST /blobelements` multipart (`file`, `encodedFilename`, `translate`…) | Confirmé | — |
| Valeur par défaut des options d'import omises | UNCONFIRMED | chaque booléen est envoyé explicitement |
| `translationId` présent dans la réponse de `blobelements` | Confirmé par la spec | sinon recherche dans `GET /translations/d/{did}` |
| Contenu de `resultElementIds` pour un assemblage ; un Part Studio par pièce ou un seul | UNCONFIRMED | différence de la liste des onglets avant/après, puis association par nom dans chaque nouveau Part Studio |
| Nom d'un onglet blob (avec ou sans extension) | UNCONFIRMED | la mise à jour d'un PDF compare `name` et `filename`, avec et sans `.pdf` |
| Création de dessin : `drawingName`, `elementId`, `partId`, `views`, `units`, `border`, `titleblock` | Confirmé | — |
| Valeurs acceptées pour `size` (« A3 ») et `standard` | UNCONFIRMED | envoyées d'abord ; sur un 400, nouvel essai sans elles + avertissement |
| Annotation `Onshape::Note` (position, contents, textHeight) | Confirmé | seule annotation envoyée par défaut |
| Origine et unité des coordonnées de feuille (bas-gauche, mm supposés) | UNCONFIRMED | réglable : `options.notes = {x, y, textHeight, lineStep}`, `options.sheetUnits` |
| Saut de ligne dans une note | UNCONFIRMED | une note par ligne |
| Dessin modifiable juste après sa création | UNCONFIRMED | tous les dessins sont créés, puis annotés ; un refus devient un avertissement |
| Cadre GD&T natif : emplacement des références dans la chaîne `frames` | UNCONFIRMED | désactivé par défaut (`options.nativeGdt`), GD&T écrit en texte dans les notes |
| État de modification : `GET /drawings/modify/status/{id}`, `output` = chaîne JSON, un résultat par annotation | Confirmé | chaque résultat est vérifié |
| Métadonnées : lire les propriétés, écrire par `propertyId` | Confirmé | identifiants toujours lus par nom, jamais codés en dur |
| Matériau par les métadonnées | UNCONFIRMED | écrit seulement si la propriété est textuelle et modifiable, sinon avertissement |
| Révision modifiable hors « release » | UNCONFIRMED | ignorée si Onshape la déclare non modifiable |
| Document privé refusé sur un plan Free ; valeur de `planGroup` | UNCONFIRMED | erreur explicite, jamais de bascule automatique ; `plan` renvoyé tel quel |
| Navigation dans les dossiers / projets Onshape | UNCONFIRMED (hors spec) | non implémentée : recherche de documents par nom |

## 5. Section mainteneur

### Fichiers

| Fichier | Rôle |
|---|---|
| `designwizard.py` | serveur HTTP local : fichiers statiques, sécurité (CSP, Host, Origin, `X-DW-Request`), routes `/api/*` |
| `server/onshape.py` | client Onshape (auth, redirections, retry, erreurs en français) et opérations du proxy |
| `server/store.py` | projets, fichiers, historique (5 versions), corbeille, écritures atomiques |
| `web/js/onshape/api.js` | client navigateur des routes `/api/*` |
| `web/js/onshape/push.js` | `planPush(job)` et `pushToOnshape(job, onProgress)` |
| `tests/py/mock_onshape.py`, `tests/py/test_server.py` | faux Onshape et tests |

Tests : `python -m unittest discover -s tests/py -t .` (le test de `push.js` demande `node`).
Développement sans compte : `python tests/py/mock_onshape.py --port 8071`, puis
`DW_ONSHAPE_BASE_URL=http://127.0.0.1:8071 python designwizard.py`. Cette variable n'accepte qu'une
adresse locale ; toute autre URL doit être en `https` et se terminer par `onshape.com`.

### Endpoints Onshape utilisés (préfixe `https://cad.onshape.com/api/v17`)

| API locale | Appel Onshape | Doc |
|---|---|---|
| `POST /api/onshape/connect`, `GET …/status?verify=1` | `GET /users/sessioninfo` | [apikeys](https://onshape-public.github.io/docs/auth/apikeys/) |
| `GET /api/onshape/documents` | `GET /documents?q&filter&offset&limit` (20 max par page) | [documents](https://onshape-public.github.io/docs/api-adv/documents/) |
| `POST /api/onshape/documents` | `POST /documents` `{name, description, isPublic}` | idem |
| `GET …/documents/<did>/workspaces` | `GET /documents/d/{did}/workspaces` | idem |
| `GET …/documents/<did>/w/<wid>/elements` | `GET /documents/d/{did}/w/{wid}/elements?elementType=` | idem |
| `POST /api/onshape/import` | `POST /blobelements/d/{did}/w/{wid}[/e/{eid}]` (multipart) | [translation](https://onshape-public.github.io/docs/api-adv/translation/) |
| `GET /api/onshape/translations/<tid>` | `GET /translations/{tid}` (secours : `GET /translations/d/{did}`) | idem |
| `GET …/e/<eid>/parts` | `GET /parts/d/{did}/w/{wid}/e/{eid}` | [metadata](https://onshape-public.github.io/docs/api-adv/metadata/) |
| `POST /api/onshape/drawings` | `POST /drawings/d/{did}/w/{wid}/create` | [drawings](https://onshape-public.github.io/docs/api-adv/drawings/) |
| `POST …/drawings/<did>/<wid>/<eid>/modify` | `POST /drawings/d/{did}/w/{wid}/e/{eid}/modify` | idem + [schémas JSON](https://github.com/onshape-public/onshapedrawingjson) |
| `GET …/modify/<requestId>` | `GET /drawings/modify/status/{id}` | idem |
| `POST /api/onshape/metadata` | `GET` puis `POST /metadata/d/{did}/w/{wid}/e/{eid}[/p/{pid}]` | [metadata](https://onshape-public.github.io/docs/api-adv/metadata/) |
| `POST /api/onshape/raw` | `GET`/`POST` sous `/documents`, `/blobelements`, `/translations`, `/drawings`, `/assemblies`, `/partstudios`, `/parts`, `/metadata`, `/elements`, et `/users/sessioninfo` ; `DELETE` sous `/elements` seulement | [spec](https://cad.onshape.com/api/openapi) |

Autres références : [limites et quotas](https://onshape-public.github.io/docs/auth/limits/),
[codes d'erreur](https://onshape-public.github.io/docs/api-adv/errors/),
[import de fichiers (aide)](https://cad.onshape.com/help/Content/Document/importing_files.htm),
[explorateur d'API](https://cad.onshape.com/glassworks/explorer/).

### Rappels d'implémentation

- Seuls GET / POST / DELETE existent côté Onshape ; les écritures visent toujours un workspace (`w`).
- En-têtes : `Accept` et `Content-Type: application/json;charset=UTF-8; qs=0.09`.
- Erreurs : 401 clés refusées, 402 quota, 403 permission manquante, 404, 409, 429 ; 5xx et réseau → 502, délai → 504.
  Un `POST` n'est pas rejoué sur un 500 simple (risque de doublon) ; il l'est sur 429 / 502 / 503 / 504.
- `description` d'une modification de dessin : 32 caractères max (tronquée par le serveur).
- Les dessins apparaissent dans la liste des onglets en `APPLICATION` / `onshape-app/drawing` ;
  `?type=DRAWING` les filtre côté serveur local.
- Premier essai sur un vrai compte : créer un document de test, lancer un envoi d'une pièce, puis mettre
  à jour le tableau de la section 4 (et activer `options.nativeGdt` pour valider les cadres GD&T).
