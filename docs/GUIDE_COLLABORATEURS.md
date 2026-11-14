# Guide des collaborateurs

Merci de prendre le temps d'essayer DesignWizard.ai. Cette première itération sert à vérifier une idée : **concevoir
à partir des interfaces** fait-il gagner du temps et évite-t-il des erreurs ? Votre avis d'ingénieur compte plus que
tout ce qui est écrit ici.

## Installer

```bash
git clone https://github.com/jpdesbiens11/DesignWizard.ai.git
```

```bash
cd DesignWizard.ai
```

```bash
python designwizard.py
```

Python 3.9 ou plus récent, rien d'autre. Le serveur n'écoute que sur votre poste (`127.0.0.1`). Vos projets sont
enregistrés dans le dossier `data/`, qui n'est jamais envoyé sur GitHub. `Ctrl + C` arrête le serveur.

## Un essai guidé de 20 minutes

1. **Accueil → « Charger la démonstration Variateur 400 V ».** L'assemblage s'ouvre : cinq pièces, cinq mates créés
   à partir des interfaces. Glissez le curseur de vue éclatée ; essayez `X` (rayons X), `S` (coupe), `M` (mesure).
2. **Onglet Mates.** Chaque mate est *lié* : ouvrez la base du boîtier (**Pièces → Base du boîtier → Interfaces**),
   modifiez l'entraxe de « Fixation carte de puissance » (`dx`), puis revenez à l'assemblage : la carte a suivi.
   `Ctrl + Z` annule le tout en une étape.
3. **Pièces → Base du boîtier → Paramètres.** Glissez « Longueur » : la pièce se reconstruit en direct, et le
   couvercle lié s'adapte quand vous relâchez.
4. **La baguette (`Ctrl + K`)**, dans une pièce : tapez `4 trous M4 aux coins à 8 mm`, puis `congé 3 vertical`.
5. **DFx.** Dans le Part Studio du dissipateur, onglet DFx : cliquez un constat pour le situer en 3D ; quand un bouton
   « correctif » est proposé, essayez-le.
6. **Isolation → Analyser.** L'écart entre les zones HV+ et HV− de la carte de puissance est volontairement trop
   court : la paire sort « NON », le chemin est tracé en rouge. Corrigez dans **PCB → Carte de puissance →
   Paramètres → Écart entre zones HV+ et HV−** (4 mm), relancez l'analyse.
7. **Dessins.** Choisissez une pièce, regardez le GD&T tiré de ses interfaces, téléchargez le PDF.
8. **Interfaces.** Cochez « Base du boîtier » comme voisine, nommez une pièce (par exemple « Embase du connecteur
   E/S »), copiez le prompt dans Claude, menez l'entrevue, collez la réponse, créez la pièce : elle arrive dans
   l'assemblage et se mate sur l'interface libre.
9. **Rapport.** Le dossier de design review se construit ; ajoutez une action, imprimez-le en PDF.

Le second exemple, **DEMO-HVB**, est le produit de référence de la formation Creepage & Clearance : ses distances sont
connues par construction, vous pouvez donc juger le moteur d'isolation (clearance 16,56 mm et creepage 26 mm entre
HV+ et HV−).

## Ce que nous aimerions savoir

- Le parcours « interfaces d'abord » vous semble-t-il naturel ? Où avez-vous hésité ?
- L'entrevue avec Claude produit-elle une pièce utilisable du premier coup ? Qu'avez-vous dû corriger ?
- Quelles fonctions d'un logiciel de CAO classique vous ont manqué en premier ?
- Les constats DFM / DFA sont-ils justes ? Lesquels sont faux, lesquels manquent pour vos procédés ?
- L'analyse d'isolation correspond-elle à ce que vous mesureriez à la main ?
- Le dessin généré est-il un bon point de départ ? Qu'y changeriez-vous d'abord ?

## Donner son avis

Ouvrez un ticket : <https://github.com/jpdesbiens11/DesignWizard.ai/issues/new/choose> — trois gabarits : *Retour
d'essai*, *Bogue*, *Idée*. Joignez si possible :

- le projet exporté (menu **Projet → Exporter le projet (.json)**) ;
- une image de la vue 3D (bouton appareil photo de la barre d'outils de la vue) ;
- pour une entrevue : le prompt copié et la réponse de l'assistant.

N'envoyez rien de confidentiel : retirez ou renommez ce qui doit l'être avant d'exporter.

## Limites connues

Elles sont listées dans l'onglet Aide de l'application et dans [ARCHITECTURE.md](ARCHITECTURE.md). Les principales :
les dessins cotent l'enveloppe et renvoient au tableau des trous ; l'envoi vers Onshape n'a été testé que contre un
serveur simulé ; les tables IEC 60664-1 intégrées sont à vérifier contre la norme.
