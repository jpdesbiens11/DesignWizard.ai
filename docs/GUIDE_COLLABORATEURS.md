# Guide des collaborateurs

Merci de prendre le temps d'essayer DynamiteOrbit. Votre avis d'ingénieur compte plus que tout ce qui est écrit ici.

**L'essai se fait en une heure, en suivant [ESSAI_PILOTE.md](ESSAI_PILOTE.md)** : onze stations sur la démonstration, de
l'accueil au dossier de revue, avec une fiche de retour. Cette page dit seulement comment installer l'outil, ce que sont
les autres exemples, et comment envoyer son avis.

## Installer

```bash
git clone https://github.com/jpdesbiens11/DynamiteOrbit.ai.git
```

```bash
cd DynamiteOrbit
```

```bash
python designwizard.py
```

Python 3.9 ou plus récent, rien d'autre. Le serveur n'écoute que sur votre poste (`127.0.0.1`). Vos projets sont
enregistrés dans le dossier `data/`, qui n'est jamais envoyé sur GitHub. `Ctrl + C` arrête le serveur.

L'outil s'ouvre aussi en ligne, sans rien installer : <https://jpdesbiens11.github.io/DynamiteOrbit.ai/> — connexion Google,
puis accès sur approbation (l'écran montre une empreinte d'accès et un bouton « Demander l'accès » ; voir
[GOOGLE.md](GOOGLE.md)).

## L'essai pilote d'une heure

Le parcours, station par station, est dans [ESSAI_PILOTE.md](ESSAI_PILOTE.md). Le même parcours et sa fiche de retour
s'écrivent en Word et en PDF par `node tools/pilot_kit.mjs <dossier>` ; le robot `tools/pilot_walk.mjs` vérifie sur
l'outil que chaque mot cité par une étape est bien à l'écran.

## Les autres exemples

L'essai pilote se fait sur le **Variateur compact 400 V**. L'accueil en propose trois autres.

**DEMO-HVB**, est le produit de référence de la formation Creepage & Clearance : ses distances sont
connues par construction, vous pouvez donc juger le moteur d'isolation (clearance 16,56 mm et creepage 26 mm entre
HV+ et HV−).

Le **Rover**, est le produit de la visite guidée de DynamiteAgile, en 3D (`web/js/demo/demo_rover.js`) :
un robot autonome sur un châssis tout-terrain 1:16. Vingt-quatre pièces aux références `RVR-…` de sa nomenclature,
trente instances (quatre roues, trois capteurs à ultrasons, deux microrupteurs) et vingt-neuf accouplements : seul le
châssis est fixe, tout le reste tient par ses interfaces — plaque porte-modules découpée au laser sur ses colonnettes,
boîtier imprimé et son cordon de joint, modules vissés dessus et dessous la plaque, pare-chocs sur ses deux tiges. Les
pièces achetées sont des **enveloppes indicatives**, pas des modèles de fournisseur ; ce que la bibliothèque de
matières n'a pas (PETG, EPDM, néodyme) est dit dans les notes de chaque pièce. À essayer dessus : la **gamme
d'assemblage**, la **nomenclature** avec sa visserie, les **interférences**, la **couleur** de chaque pièce.

La **fusée à moteur hybride** (`web/js/demo/demo_rocket.js`), est un **exercice de CAO** : 8 po de
diamètre, 3,66 m de long (environ 12 pi), quatre ailerons fixes. De la tuyère à l'ogive : la **tuyère refroidie** et
son **serpentin en hélice** (l'opération `coil` du langage de pièce, une vraie hélice conique sur le divergent), sa
jupe, la chambre de combustion et son **bloc de polyuréthane**, la plaque d'injection, la **vanne principale** du
protoxyde d'azote et son actionneur hydraulique (la variante pyrotechnique est dite dans ses notes), le **réservoir**,
la ligne qui amène au serpentin la part de comburant qui refroidit la tuyère, la baie avionique (cloison, platine,
**carte de commande**, batterie, **faisceau**), le parachute et l'ogive ; autour, trois tronçons de coque emboîtés et
deux boutons de rail. Vingt-deux pièces, vingt-six instances, vingt-cinq accouplements ; les ailerons sont calés à 45°
des boutons de rail par l'angle de leur accouplement. **Rien n'y est dimensionné ni validé** — ni le récipient sous
pression, ni le moteur, ni le vol : chaque pièce le dit dans ses notes. La jupe est translucide pour laisser voir le
serpentin ; une **coupe** (bouton de la vue) montre l'intérieur.

## Donner son avis

Ouvrez un ticket : <https://github.com/jpdesbiens11/DynamiteOrbit.ai/issues/new/choose> — trois gabarits : *Retour
d'essai*, *Bogue*, *Idée*. Joignez si possible :

- le projet exporté (menu **Projet → Exporter le projet (.json)**) ;
- une image de la vue 3D (bouton appareil photo de la barre d'outils de la vue) ;
- pour une entrevue : le prompt copié et la réponse de l'assistant.

N'envoyez rien de confidentiel : retirez ou renommez ce qui doit l'être avant d'exporter.

## Limites connues

Elles sont listées dans l'onglet Aide de l'application et dans [ARCHITECTURE.md](ARCHITECTURE.md). Les principales :
les dessins cotent l'enveloppe et renvoient au tableau des trous ; l'envoi vers Onshape n'a été testé que contre un
serveur simulé ; les tables IEC 60664-1 intégrées sont à vérifier contre la norme.
