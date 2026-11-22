# Deux pièces moulées, pour apprendre

Demande de JP (point 14 du plan, 20 novembre 2026 : « c'est vraiment important ») : une pièce plastique moulée par injection
— ribs, parting line, points d'injection (gates), dépouilles — et une pièce die cast haute pression ; « on doit voir le flux
complet de la pièce : conception, gamme animée, puis le dessin 2D et les artéfacts destinés au fournisseur ».

Accueil → « Deux pièces moulées » (`web/js/demo/demo_molded.js`, `moldedProject()`).

## Les deux pièces, et ce qu'elles montrent

| | Coque injectée (`EDU-IM-SHELL`) | Équerre injectée sous pression (`EDU-HPDC-BRACKET`) |
|---|---|---|
| Procédé, matière | Injection plastique, PC-ABS | HPDC (die casting), aluminium A380 |
| Paroi | 2 mm partout (`tub`) | 4 mm |
| Dépouilles | 1° sur les parois, 0,5° sur les nervures et les bossages | 1° sur les nervures et les bossages |
| Nervures | 1,2 mm — 60 % de la paroi | Deux nervures de renfort entre semelle et flasque |
| Bossages | Quatre bossages de vis, trou noyé Ø 2,2 sur 6 mm (au plus 3 × Ø), écartés des parois | Deux bossages, trous venus de fonderie |
| Gate | Edge gate au plan de joint, côté −Y | Ingate au plan de joint côté +X, overflows en face |
| Plan de joint | Bord supérieur | Plan du dessous |
| Tiroirs (slides) | Aucun : le moule s'ouvre en deux | Un : les trous du flasque sont perpendiculaires au démoulage — l'onglet Mold le dit, et ce qu'il coûte |
| Reprise | — | Deux posages au centre d'usinage : le plan d'appui surfacé de 0,5 mm (il emporte la ligne du plan de joint et sa bavure), puis, sur lui, les bossages percés Ø 6,8 et taraudés M8 sur 12 mm |

Chacune **passe ses règles DFx sans avertissement** : c'est la leçon. Les trois avertissements que la première version
recevait — un rayon intérieur trop petit, un core pin trop long pour son diamètre, un filetage trop court dans l'aluminium —
ont été corrigés, et la note du dessin dit pourquoi.

## Le flux, écran par écran

1. **Pièces** — le modèle 3D, l'arbre de construction ; l'onglet **Mold** : le gate (en tuiles), le plan de joint tracé en
   rouge, les tiroirs, les traces que le moule laisse ; l'onglet **DFx** : rien à corriger.
2. **Atelier de fab** — la gamme jouée étape par étape. Le **moule est celui de la pièce**, lu de son plan de moule
   (`mouldIn` de `core/fab_scene.js`) : les deux demi-moules se séparent à SON plan de joint — au bord de la coque, sous
   l'équerre —, la carotte traverse le demi-moule fixe à côté de la pièce et le canal court dans le plan de joint jusqu'à
   SON point d'injection — en bord pour la coque, l'ingate en lame pour l'équerre, ses trois overflows en face. Pour
   l'équerre, la pièce reste **brute de fonderie** jusqu'à ses reprises, qui sont deux **posages d'usinage** (le dessous
   d'abord : il sert d'appui au second) ; leur parcours d'outil est un **exemple écrit par Claude**, lu et vérifié par
   l'outil comme toute réponse d'IA (« Usiner » l'anime). Le diaporama **`.pptx`** du fournisseur, le film, la gamme en
   Word / PDF.
3. **Dessins** — la feuille en anglais, le bloc de tolérances, les notes du moule ; une vue de détail se trace sur une zone.
4. **Ce qui part au fournisseur** — le STEP, le PDF du dessin, la gamme, le diaporama avec un cadre « Réponse du fournisseur »
   par phase (bouton « Partager » en tête de chaque studio).

## D'où viennent les règles

Des lignes du registre des sources, avec leur niveau de vérification vrai : **`dfx-mold`** (moulage et fonderie : guides de
fournisseurs et d'associations — niveau « usage »), **`mold-plan`** (le mold d'une pièce : convention de l'outil), pour
les procédés à risers **`riser-modulus`** (extrait), et une source lue pour ces exemples, **`im-guide-read`** :

- **Lu le 22 novembre 2026** — Protolabs, *Plastic Injection Molding — Design Guidelines*
  (https://www.protolabs.com/services/injection-molding/plastic-injection-molding/design-guidelines/). Seuls des nombres en
  sont repris : dépouille de 0,5° pour une face verticale, 2° dans la plupart des cas, 3° au moins sur une face légèrement
  texturée ; paroi recommandée de 1,14 à 3,56 mm pour l'ABS, de 1,02 à 3,81 mm pour le polycarbonate (la page attribue ce
  tableau à une autre source). La coque en tient compte : paroi de 2 mm, dans les deux plages ; dépouille de 1° sur des
  parois lisses — au-dessus du minimum de 0,5°, au-dessous des 2° conseillés « dans la plupart des cas » : un mouliste peut
  demander plus ; la face grainée est le fond, perpendiculaire au démoulage, qui n'a pas besoin de dépouille. La page ne
  donne ni la règle des nervures, ni celle des bossages, ni les points d'injection : ceux de la coque restent ceux de
  l'usage (`dfx-mold`).
- **Ouvert, sans nombre repris** — Xometry, *Design Guide: Die Casting* : la page ne donne que la table des matières ; le
  guide se télécharge. Les règles de l'équerre (paroi de 4 mm, dépouille de 1°, tiroir pour un trou travers, surépaisseur
  d'usinage) restent celles de l'usage (`dfx-mold`) ; la norme NADCA n'a pas été lue.
- Deux autres pages publiques demandées ce jour-là n'existaient plus (erreur 404).

Les exemples ne reproduisent aucun modèle, aucun dessin, aucune marque. Le mouliste et la fonderie ont le dernier mot.
