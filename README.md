# DesignWizard.ai <sub>by DynamiteAgile™</sub>

**De l'intention à la pièce, de la pièce au système — la conception mécatronique réinventée, ouverte.**

L'objectif : **commander en quelques jours des pièces faisables, prototyper la physique d'un produit, l'essayer au
laboratoire** — et fermer la boucle de conception avant de lancer la production. Une pièce ne naît pas d'une esquisse
extrudée : elle naît de son **intention** — ses interfaces, sa matière, sa matière première — comme dans l'atelier
d'un artisan, aidé par l'IA. Les règles DFM, DFA, DFx et d'isolation s'appliquent dès la première minute.

Libre sous **licence MIT**. Tout tourne dans le navigateur ; vos fichiers restent chez vous.

> Deuxième itération (v0.2.0), publiée pour recueillir vos commentaires. Voir [Vos commentaires](#vos-commentaires),
> la [vision](docs/VISION.md) et le [format de fichier `.dwiz`](docs/FORMAT.md).
> *English summary at the [end of this page](#english-summary).*

## Aperçu

| | |
|---|---|
| ![Atelier : la pièce naît de son intention](docs/img/atelier.png) | ![Commander le prototype : verdict, délai, dossier](docs/img/commande.png) |
| **Atelier** (*Shop*) — intention, interfaces par leur forme, matière première : la pièce se construit, avec sa gamme | **Commander** — prête à commander ? en combien de jours ? Le dossier pour l'atelier en un clic |
| ![Physique : modèles analytiques](docs/img/physique.png) | ![Assemblage éclaté avec ses mates d'interface](docs/img/assemblage.png) |
| **Physique** — 21 modèles simples et reconnus : 80 % de la réponse en une seconde | **Assemblage** — les pièces s'accouplent par leurs interfaces et restent liées |
| ![Isolation : chemins clearance et creepage](docs/img/isolation-demo-hvb.png) | ![Thème Spatial](docs/img/brand/theme-spatial.png) |
| **Isolation** — distances requises et chemins mesurés sur l'assemblage | **Thèmes** — Le.Carnet, Mécanique, Aéronautique, Spatial |

![Dessin généré avec références, GD&T et cartouche](docs/img/dessin.png)

Une pièce, dans le format de la plateforme (`.dwiz`) — une instruction par ligne, lisible par l'ingénieur, l'atelier
et l'IA :

```text
dwiz part/1 PN-0042 "Plaque d'adaptation"
function "Porte le capteur sur le bâti."
interface IF1 bolt_pattern side=A face=-Z at=[L/2, W/2] key=frame_mount partner=Bâti
  params screw=M5 pattern={type: rect, nx: 2, ny: 2, dx: 80, dy: 50}
material AL6061-T6
stock plate L=L W=W t=t
param L 105 min=105 max=400 unit=mm label=Longueur
param W = 75
param t = 5
do outline profile={rect: [0, 0, L, W], r: 4}
do interfaces
do deburr
```

## Démarrer en deux minutes

Il faut Python 3.9 ou plus récent (bibliothèque standard seulement) et un navigateur récent (essayé sous Chrome et
Edge ; Firefox et Safari restent à essayer).

```bash
git clone https://github.com/jpdesbiens11/DesignWizard.ai.git
```

```bash
cd DesignWizard.ai
```

```bash
python designwizard.py
```

Le navigateur s'ouvre sur `http://127.0.0.1:8070`. Cliquez **« Charger la démonstration Variateur 400 V »**.
Rien n'est installé, rien n'est téléchargé : le noyau CAO (OpenCascade en WebAssembly) et la vue 3D sont dans le dépôt.

Sans Python, le dossier `web/` fonctionne aussi tel quel derrière n'importe quel serveur de fichiers statiques
(les projets restent alors dans le navigateur, et l'envoi vers Onshape n'est pas disponible).

## Le parcours

| Onglet | Ce que vous y faites |
|---|---|
| **Atelier** (*Shop*) | Vous dites l'**intention** : à quoi sert la pièce, ses interfaces (par leur forme : « je me visse sur… », « je reçois un arbre »…), sa matière, ce que l'on prend **sur l'étagère** (plaque, tôle, rond, cornière…). La pièce se construit sous vos yeux : plus petite enveloppe, épaisseur du commerce, **gamme de fabrication**, verdict DFx et délai de prototype. Sous-onglets : **entrevue avec Claude** (prompt générique, réponse collée) et registre des interfaces. |
| **Pièces** | Studio de pièce : curseurs sur chaque paramètre (reconstruction en direct), arbre de construction avec **verbes d'atelier** (percer, tarauder, lamer, épauler, charioter…), « Trou ici » / « Interface ici » en cliquant une face, DFM en direct avec **correctifs en un clic**. Onglets **Gamme** (brut, opérations, outils), **Artéfacts** (STEP, STL, DXF, PDF, FeatureScript, **dossier de commande**) et **Fichier** (`.dwiz`). |
| **Extrusion** | Profilés aluminium ou plastique : vous listez ce qui va *dedans* et *dehors*, Claude propose la section, la plateforme l'extrude et vérifie parois, gorges, cavités et cercle circonscrit. |
| **PCB** | Cartes : composants avec leurs hauteurs, zones de cuivre HV / LV, nets. La carte se fixe par ses interfaces comme une autre pièce. |
| **Assemblage** | Ajoutez les pièces : les interfaces identiques (côté A et côté B) **se matent seules** et restent **liées** — changez un côté, l'autre pièce s'adapte. Vue éclatée, BOM avec la visserie déduite, interférences, pièce complémentaire générée d'une interface libre. |
| **Physique** | 21 modèles analytiques — poutres, flambage, torsion, plaque, assemblage boulonné, emmanchement, écoulement en conduite, conduction, dissipateur, busbar, piste de PCB… Les cotes sont reprises de la pièce ; le calcul est montré pas à pas, avec ses hypothèses, son domaine de validité et sa source. |
| **Isolation** | Creepage et clearance mesurés sur **l'assemblage complet**, comparés aux distances requises par IEC 60664-1 (pollution degree, altitude, OVC, system IT). Chemins tracés en rouge. |
| **DFx** | Bilan DFM de chaque pièce, DFA de chaque assemblage, livre des règles imprimable (110 règles). |
| **Dessins** | Dessin 2D généré : vues à arêtes cachées, tableau des trous, références A / B / C et **GD&T calculé depuis les interfaces**, cartouche, notes — en PDF vectoriel. |
| **Rapport** | Le dossier de revue de conception : images, BOM, interfaces, physique, isolation, constats, matière première, verdict de commande, dessins, décisions et actions. |
| **Compte** (menu) | Connexion Google facultative : le projet devient une **arborescence dans votre Google Drive** (pièces, assemblages, analyses, rapports). Thèmes. Pour l'administrateur : comptes approuvés de la démo en ligne. Voir [docs/GOOGLE.md](docs/GOOGLE.md). |
| **Onshape** (menu) | Connexion du compte, choix du document, puis envoi : STEP converti en Part Studios et assemblage natifs, dessin PDF et dessin natif Onshape de chaque pièce. |

Partout : **Ctrl + K** ouvre *la baguette* (« 4 trous M4 aux coins à 8 mm », « congé 3 vertical », « longueur 150 »…),
**Ctrl + Z** annule, et **Ctrl + V** hors d'un champ importe ce que vous collez (fichier `.dwiz`, réponse d'entrevue, pièce, profil, STEP).

## Ce qui est vérifié, et comment

- **149 tests Node** (`node --test tests/node/*.test.mjs`) : noyau CAO réel, matière première et verbes d'atelier,
  synthèse de pièce depuis l'intention, format `.dwiz` (aller-retour sans perte sur toutes les pièces), 21 modèles de
  physique contre des valeurs de manuel, exports STL / DXF / FeatureScript, commande et délais, règles IEC 60664-1,
  moteur de chemins, moteur DFx, dessins PDF, connexion Google et Drive (contre des doubles, sans réseau).
  **19 tests Python** (`python -m unittest discover -s tests/py -t .`) : serveur, proxy Onshape.
- **Physique** : modèles analytiques à solution exacte ; propriétés de matériaux **typiques**, à confirmer avec la
  fiche de la nuance. Ils disent si la physique fonctionne ; l'essai en laboratoire le confirme.
- **Délais de commande** : ordres de grandeur d'ateliers de prototypage rapide ; le devis de l'atelier fait foi.
- **FeatureScript** : généré et vérifié par une émulation des opérations sur le noyau, **jamais exécuté dans Onshape**.
- **Google** : connexion, Drive et porte d'accès vérifiés contre un Google simulé ; **pas encore sur un vrai compte**
  (il faut d'abord créer l'identifiant client, voir [docs/GOOGLE.md](docs/GOOGLE.md)).
- **Isolation** : le moteur de chemins reproduit le produit d'exemple DEMO-HVB de la formation Creepage & Clearance,
  dont les distances sont connues par construction (clearance 16,56 mm et creepage 26 mm entre HV+ et HV−, etc.).
  Chargez « DEMO-HVB » depuis l'accueil pour le voir.
- **Onshape** : l'envoi est testé contre un serveur Onshape simulé. **Il n'a pas encore été exécuté sur un vrai compte** :
  faites le premier essai sur un document de test. Voir [docs/ONSHAPE.md](docs/ONSHAPE.md).
- **Tables IEC 60664-1** : saisies d'après les tables publiées ; à vérifier contre votre copie de la norme avant toute
  décision de certification.

## Vos commentaires

Cette version existe pour être critiquée. Ce qui nous aide le plus :

1. Ce que vous vouliez faire, ce que vous avez fait, ce qui s'est passé.
2. Le projet exporté (menu **Projet → Exporter**) et une image de la vue (bouton appareil photo).
3. Ce qui vous a surpris — en bien ou en mal — dans le parcours « interfaces d'abord ».

Ouvrez un ticket : [Retour d'essai, bogue ou idée](https://github.com/jpdesbiens11/DesignWizard.ai/issues/new/choose).
Le guide complet est dans [docs/GUIDE_COLLABORATEURS.md](docs/GUIDE_COLLABORATEURS.md).

## Documentation

- [docs/VISION.md](docs/VISION.md) — l'objectif, le principe « intention d'abord », les briques technologiques, le « modèle Linux ».
- [docs/FORMAT.md](docs/FORMAT.md) — le format `.dwiz` : notation, genres de document, noms réservés aux modules à venir.
- [docs/GUIDE_COLLABORATEURS.md](docs/GUIDE_COLLABORATEURS.md) — un essai guidé de 20 minutes et comment donner son avis.
- [docs/PART_LANGUAGE.md](docs/PART_LANGUAGE.md) — le vocabulaire d'une pièce : ce que Claude écrit et que la plateforme construit.
- [docs/GOOGLE.md](docs/GOOGLE.md) — connexion Google, projet dans Google Drive, comptes approuvés de la démo en ligne.
- [docs/BRAND.md](docs/BRAND.md) — logo, thèmes, icônes, voix.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — comment c'est fait, où se trouve quoi, limites et suite prévue.
- [docs/ONSHAPE.md](docs/ONSHAPE.md) — clés d'API, ce qui est envoyé, ce qui est confirmé ou non.

## Composants tiers

Le noyau géométrique est [Open CASCADE Technology](https://dev.opencascade.org/) (LGPL 2.1 avec exception), compilé en
WebAssembly par opencascade.js / replicad (`web/vendor/occ/`, voir `NOTICE.md`). La vue 3D utilise
[three.js](https://threejs.org/) (MIT, `web/vendor/three/`). Aucune ressource n'est chargée d'Internet à l'exécution,
sauf le service de connexion de Google si vous choisissez de vous connecter.

## Licence

Le code de DesignWizard.ai est publié sous **licence MIT** (voir [LICENSE](LICENSE)) : vous pouvez l'utiliser, le
modifier et le redistribuer, y compris dans un produit commercial, en gardant la mention de droit d'auteur. Les
composants tiers gardent leur propre licence (ci-dessus) ; le noyau Open CASCADE est en LGPL 2.1, livré tel quel et
remplaçable. La politique d'ouverture du projet (réimplémentation « salle blanche », formats ouverts d'abord) est
décrite dans [docs/VISION.md](docs/VISION.md).

---

## English summary

DesignWizard.ai is an open-source (MIT), browser-based platform that rethinks mechatronic product design. Its goal:
**order manufacturable parts within days, prototype the physics of a product, test it in the lab — and close the
design loop before production starts.**

- **The Shop** (« Atelier »): a part is not a sketch you extrude. You state its **design intent** — what it is for,
  its interfaces with its neighbours, its material and the raw stock taken from the rack — and the platform writes
  the part: smallest envelope, commercial thickness, routing sheet, DFx verdict and prototype lead time. An interview
  with Claude (generic prompt, pasted answer) goes further.
- **One file format, `.dwiz`**: one instruction per line, read the same way by an engineer, a shop and an AI;
  lossless twin of the JSON model; its vocabulary grows module by module (`part`, `assembly`, `project` today;
  `order`, `test`, `board`, `harness`, `firmware`… reserved). See [docs/FORMAT.md](docs/FORMAT.md).
- **Order**: ready-to-order verdict, typical lead time and what slows it down, and a one-click package for the shop
  (request for quotation, STEP, PDF drawing, DXF, STL, routing sheet).
- **Physics**: 21 recognised analytical models (beams, buckling, bolted joint, pipe flow, heat sink, busbar…) that
  give 80 % of the answer in a second, with every step, assumption and reference shown.
- **Assembly**: matching interfaces mate automatically and stay linked. **Isolation**: creepage / clearance on the
  full assembly (IEC 60664-1). **DFx**: 110 rules with one-click fixes. **Drawings**: PDF with GD&T derived from the
  interfaces. **Exchange**: STEP, DXF, STL, PDF, experimental Onshape FeatureScript, your own Google Drive.

Run it locally with `python designwizard.py` (Python standard library only; the OpenCascade kernel and three.js are
vendored). The UI is in French with English technical terms. Not yet verified: Onshape and Google against real
accounts, the IEC tables against the standard, Firefox and Safari.
