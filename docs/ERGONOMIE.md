# Audit d'ergonomie

Un robot ouvre **chaque écran** de l'application, sur le projet de démonstration, à **trois tailles de fenêtre** —
portable 1366 × 768, bureau 1600 × 1000, grand écran 1920 × 1080 — et relève ce qui gêne la lecture et le clic. Il sert à
trouver d'un coup ce que l'on découvre sinon écran par écran.

```bash
python3 designwizard.py --port 8130 --no-browser --data /tmp/audit
node tools/ergo_audit.mjs http://127.0.0.1:8130 /tmp/audit_out
```

L'outil demande Playwright ; il ne fait pas partie de l'application et les tests ne le lancent pas. Il écrit
`report.json` et une capture par écran et par taille, et affiche un résumé.

## Ce qu'il relève

| Relevé | Ce que c'est |
|---|---|
| Page qui déborde | Une barre de défilement horizontale sur la page entière |
| Texte tronqué | Un texte coupé par des points de suspension ou par son cadre |
| Bouton sans nom | Un bouton ou un lien sans texte, sans étiquette, sans info-bulle |
| Cible trop petite | Un bouton de moins de 22 px de côté (hors liens dans une phrase) |
| Commande coupée | Un bouton, un champ ou un titre qui dépasse du bord de la fenêtre |
| Champ sans étiquette | Un champ que rien ne nomme |
| Listes déroulantes | Leur nombre par écran — un indice, pas une faute |

## Résultat — 24 écrans × 3 tailles, version 0.37.1

| Relevé | Avant | Après |
|---|---|---|
| Page qui déborde | 0 | 0 |
| Texte tronqué | 175 | 6 |
| Bouton sans nom | 0 | 0 |
| Cible trop petite | 74 | 2 |
| Commande coupée | 0 | 0 |
| Champ sans étiquette | 6 | 0 |
| Erreur dans la console | 0 | 0 |

Ce qui a été corrigé :

- **Les noms longs ne sont plus coupés** dans les volets : une pièce, un assemblage ou un titre prend une seconde ligne
  (« Variateur compact — assemblage général », « Étrier de montage (titane imprimé) »). Les libellés des paramètres et
  des cotes d'un dessin passent à la ligne au lieu de se terminer par « … ».
- **Ce que la vue dit se lit en entier** : les pastilles en bas de la vue 3D (« 6 pièces · 6 mates · 464,5 g… »,
  « 25 corps : 6 conducteurs avec net… ») étaient limitées à 170 px sur tout écran de moins de 1760 px.
- **Les petits boutons** des arbres (désactiver, supprimer, monter, masquer) font au moins 26 px ; une étiquette
  cliquable de la vue 3D, 24 px.
- **L'état de la barre du haut** ne garde plus le message de l'écran d'avant (« … construit en 300 ms »).
- Les deux zones de texte sans étiquette en ont une.

Ce qui reste, et pourquoi :

- **6 textes tronqués** : la pastille d'état de la barre du haut, à 170 px sur portable — la barre est pleine ; son
  texte entier est dans son info-bulle.
- **2 cibles** de 20 px dans l'écran DFx.
- **Listes déroulantes** : 38 dans l'Isolation (une par corps, pour son rôle et son potentiel) et 40 dans les Dessins
  (une par cote). C'est là que des arbres par type, comme dans la Simulation, serviraient le mieux.

## Le repère, la grille et la taille de l'affichage

- **Repère X Y Z** : en haut à droite de chaque vue 3D, avec son point central. L'axe qui vient vers l'œil est dessiné
  par-dessus, celui qui s'éloigne est estompé. Un clic sur une lettre regarde le long de son axe.
- **Grille derrière la pièce** : bouton « Grille » de la barre de la vue, ou touche **G**. Elle se pose sur les trois
  faces de la boîte de la pièce qui sont à l'opposé de l'œil — le sol et les deux murs du fond — donc toujours
  *derrière*, quelle que soit la vue. Son pas est un nombre rond de millimètres (0,5 · 1 · 2 · 5 · 10 · 20 · 50…),
  écrit sous le repère, avec un trait plus fort tous les cinq pas. Le choix vaut pour toutes les vues et le navigateur
  le garde (`web/js/core/view_grid.js`, pur et testé).
- **Taille de l'affichage** : menu du compte (l'icône de personne) → « Taille de l'affichage », cinq pas de 90 à
  150 %. Tout suit — textes, boutons, étiquettes des vues 3D, barre du haut — parce que tout est en `rem` ; les volets
  s'élargissent avec leur texte. Le choix est gardé par le navigateur et appliqué avant le premier affichage.

## Poser à la souris, aidé

Demande de JP : poser un trou ou une interface sans mesurer ni taper de valeur. Un outil armé — « Trou de passage »,
« Borne vissée », « Contact à pression » dans l'écran des busbars ; « Trou ici », « Interface ici » dans le studio des
pièces — montre, sur la face survolée :

- une **grille de 5 mm** : c'est là que l'élément tombera si on clique ;
- la **ligne de centre**, en pointillé rouge, dès que l'**axe de symétrie** de la face accroche l'élément ; en violet,
  la ligne d'un **voisin** quand l'élément vient s'aligner sur lui ;
- deux **cotes** vers les bords les plus proches, qui suivent le pointeur ;
- une **fenêtre de coordonnées**, en haut à droite de la vue : la face, les deux coordonnées, et ce qui accroche.

Un **clic pose** l'élément ; **Échap** le lâche ; **Alt** le libère de tout accrochage. L'ordre des accrochages, pour
chacune des deux directions de la face prise à part : l'axe de symétrie, puis l'alignement sur un voisin, puis la grille.
Une fois posé, l'élément se règle au clavier (flèches : 1 mm, Maj : 5 mm, Alt : 0,1 mm) ou en tapant sa **position dans
le volet de gauche**. **Maintenir deux secondes** le pointeur sur un élément le reprend à la souris jusqu'au prochain
clic ; le bouton « Reprendre » de sa carte fait de même.

**Parallèle et perpendiculaire.** Dans toutes les vues, la mesure entre deux points (M) accroche le second point quand
la ligne suit un axe à moins de 6° : la ligne passe au rouge, « ∥ X — relâchez pour accrocher », et la mesure est prise
sur l'axe. Le **clic droit** de chaque vue règle les quatre accrochages (axes de symétrie, alignement sur les voisins,
grille de 5 mm, parallèle / perpendiculaire) ; le choix est gardé d'une session à l'autre.

Code : `web/js/core/snap.js` (les règles, pures et testées), `web/js/core/view_place.js` (la grille, les lignes, les
cotes, la fenêtre, la reprise), `web/js/modules/busbar_place.js`. **Limites** : la grille part du coin de la face et son
pas est fixe (5 mm) ; dans le studio des pièces, les axes sont ceux de l'encombrement de la pièce, pas ceux de chaque
face ; la reprise par maintien n'existe que dans l'écran des busbars ; l'Atelier place ses interfaces par face, sans
position à régler. Rien de cela n'a été essayé sur un écran tactile.

## La couleur de chaque pièce

Demande de JP : pouvoir donner soi-même une couleur et une teinte à chaque pièce, pour s'y retrouver d'un coup d'œil.

- **Une pastille** suit chaque pièce dans la liste du studio des pièces et dans celle de l'assemblage. En pointillé, la
  pièce a la couleur de sa matière ; en trait plein, la sienne.
- **Un clic sur la pastille** ouvre le sélecteur, sans quitter la pièce que l'on regarde : une rangée par couleur (gris,
  bleu, cyan, sarcelle, vert, jaune, orange, rouge, rose, violet, brun), une colonne par teinte (très clair, clair, franc,
  foncé, très foncé) ; « Plus clair » et « Plus foncé » règlent la teinte cran par cran ; « Autre… » ouvre la palette
  du système ; « Opaque / Voilé / Transparent » laisse voir ce que la pièce cache ; un bouton ramène la couleur de la
  matière. Le sélecteur reste ouvert pour essayer ; Échap ou un clic ailleurs le ferme. Chaque choix est une étape
  annulable.
- **Deux raccourcis** en tête de liste : « Une couleur par pièce » (chaque pièce qui n'en a pas reçoit la sienne,
  différente de ses voisines ; celles que l'on a choisies restent) et « Couleurs des matières ».
- La fiche de la pièce rappelle sa couleur (« Couleur à l'écran »).

C'est une **aide visuelle, pas une finition** : la couleur est gardée dans la pièce (`look`, voir `docs/FORMAT.md`),
elle voyage dans le `.dwiz` et suit la pièce dans l'assemblage, l'isolation et le STEP exporté ; elle ne va sur aucun
dessin, et elle ne touche ni à la revue ni à une révision libérée (la signature de la pièce l'ignore). Elle peint le
corps principal de la pièce ; un corps qui a sa propre couleur (l'isolant d'un busbar, le cuivre d'une carte) la garde.
Code : `web/js/core/part_look.js` (pur, testé), `web/js/modules/part_look.js` (la pastille et le sélecteur).

## Ce que l'audit ne voit pas

Il mesure des boîtes, pas le sens : un libellé obscur, un ordre d'actions illogique, une couleur mal choisie, une
fonction introuvable lui échappent. Il ne remplace pas un utilisateur devant l'écran — il lui évite les cailloux.
Rien n'a été mesuré en dessous de 1366 px de large, ni sur un écran tactile.
