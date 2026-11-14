# DesignWizard.ai <sub>by DynamiteAgile™</sub>

**Des interfaces à la pièce, à l'assemblage, au dossier de revue.**
Une plateforme de développement de produit mécatronique qui tourne dans le navigateur : chaque pièce naît de ses
interfaces, les assemblages se montent d'eux-mêmes, et les règles DFM, DFA, DFx et d'isolation (creepage / clearance)
sont vérifiées dès la conception.

> Première itération (v0.1.0), publiée pour recueillir vos commentaires. Voir [Vos commentaires](#vos-commentaires).
> *English summary at the [end of this page](#english-summary).*

## Démarrer en deux minutes

Il faut Python 3.9 ou plus récent (bibliothèque standard seulement) et un navigateur récent (Chrome, Edge, Firefox).

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
| **Interfaces** | Vous nommez la pièce et cochez ses voisines. La plateforme rassemble leurs interfaces libres (les *interfaces anticipées*) et écrit le **prompt générique**. Vous menez l'entrevue dans Claude, vous collez la réponse : la pièce est construite. |
| **Pièces** | Part Studio : curseurs sur chaque paramètre (reconstruction en direct), arbre de construction, « Trou ici » / « Interface ici » en cliquant une face, mesure, coupe, DFM en direct avec **correctifs en un clic**. |
| **Extrusion** | Profilés aluminium ou plastique : vous listez ce qui va *dedans* et *dehors*, Claude propose la section, la plateforme l'extrude et vérifie parois, gorges, cavités et cercle circonscrit. |
| **PCB** | Cartes : composants avec leurs hauteurs, zones de cuivre HV / LV, nets. La carte se fixe par ses interfaces comme une autre pièce. |
| **Assemblage** | Ajoutez les pièces : les interfaces identiques (côté A et côté B) **se matent seules** et restent **liées** — changez un côté, l'autre pièce s'adapte. Vue éclatée, BOM avec la visserie déduite, interférences, pièce complémentaire générée d'une interface libre. |
| **Isolation** | Creepage et clearance mesurés sur **l'assemblage complet**, comparés aux distances requises par IEC 60664-1 (pollution degree, altitude, OVC, system IT). Chemins tracés en rouge. |
| **DFx** | Bilan DFM de chaque pièce, DFA de chaque assemblage, livre des règles imprimable (110 règles). |
| **Dessins** | Dessin 2D généré : vues à arêtes cachées, tableau des trous, références A / B / C et **GD&T calculé depuis les interfaces**, cartouche, notes — en PDF vectoriel. |
| **Rapport** | Le dossier de design review : images, BOM, interfaces, isolation, constats, dessins, décisions et actions. |
| **Onshape** (menu) | Connexion du compte, choix du document, puis envoi : STEP converti en Part Studios et assemblage natifs, dessin PDF et dessin natif Onshape de chaque pièce. |

Partout : **Ctrl + K** ouvre *la baguette* (« 4 trous M4 aux coins à 8 mm », « congé 3 vertical », « longueur 150 »…),
**Ctrl + Z** annule, et **Ctrl + V** hors d'un champ importe ce que vous collez (réponse d'entrevue, pièce, profil, STEP).

## Ce qui est vérifié, et comment

- **84 tests Node** (`node --test tests/node/*.test.mjs`) : noyau CAO réel, règles IEC 60664-1, moteur de chemins,
  moteur DFx avec ses correctifs, dessins PDF. **19 tests Python** (`python -m unittest discover -s tests/py -t .`) : serveur, proxy Onshape.
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

- [docs/GUIDE_COLLABORATEURS.md](docs/GUIDE_COLLABORATEURS.md) — un essai guidé de 20 minutes et comment donner son avis.
- [docs/PART_LANGUAGE.md](docs/PART_LANGUAGE.md) — le langage de pièce (DW part/1) que Claude écrit et que la plateforme construit.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — comment c'est fait, où se trouve quoi, limites et suite prévue.
- [docs/ONSHAPE.md](docs/ONSHAPE.md) — clés d'API, ce qui est envoyé, ce qui est confirmé ou non.

## Composants tiers

Le noyau géométrique est [Open CASCADE Technology](https://dev.opencascade.org/) (LGPL 2.1 avec exception), compilé en
WebAssembly par opencascade.js / replicad (`web/vendor/occ/`, voir `NOTICE.md`). La vue 3D utilise
[three.js](https://threejs.org/) (MIT, `web/vendor/three/`). Aucune ressource n'est chargée d'Internet à l'exécution.

La licence du code de DesignWizard.ai lui-même n'est pas encore fixée : tous droits réservés à son auteur pour
l'instant ; le dépôt est partagé pour évaluation et commentaires.

---

## English summary

DesignWizard.ai is a browser-based product-development platform for mechatronic systems. A part starts from its
**interfaces** with its neighbours: the platform writes a generic interview prompt for Claude, you paste the answer back,
and the part is built by an OpenCascade kernel running in the browser, with sliders on every parameter. In an assembly,
matching interfaces **mate automatically and stay linked** (change one side, the other part adapts). On top of that:
extrusion and PCB modules, creepage / clearance analysis on the full assembly (IEC 60664-1, validated against a
reference case), DFM / DFA / DFx rules with one-click fixes, generated 2D drawings with GD&T as vector PDF, a
design-review report, and a push to Onshape (tested against a mock server only so far).

Run `python designwizard.py` (Python ≥ 3.9, standard library only) and open `http://127.0.0.1:8070`. The user interface
is in French with English technical terms. Feedback is very welcome through the issue templates.
