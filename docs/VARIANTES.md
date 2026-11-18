# On / Off et copies — plusieurs cas dans un seul modèle

Demande de JP (18 novembre 2026) : « mettre à On / Off les différents paramètres d'entrée des modèles, et même les
dupliquer pour en mettre un à On, faire l'analyse, puis mettre l'autre à On (précédent Off) et refaire l'analyse pour
ce nouveau cas d'usage séparément » — comparer des conditions frontières dans la Simulation, tenir une famille de
pièces un peu différentes dans la CAO, et mettre des pièces à On / Off dans l'assemblage.

Le principe est le même partout :

- **Off** = mis de côté. La chose reste dans le modèle, avec ses valeurs, et **ne compte pour rien** : ni pour le
  calcul, ni pour la géométrie, ni pour le guide, ni pour ce qui sort. **On** la ramène telle qu'elle était.
- **Dupliquer** fait une copie qui **naît à Off**, juste après l'original : on y change une valeur, on la met à On à la
  place de l'original, on relance, on compare.
- Le même **interrupteur** partout (`onOff()` de `web/js/core/dom.js`, style `.switch`) ; ce qui est à Off est grisé et
  le dit ; chaque titre de liste compte ce qui est à On et ce qui est à Off.

## Simulation : des cas de charge à comparer

Chaque appui, effort, source de chaleur et température imposée du cas de charge a son interrupteur et son bouton
« Dupliquer » ; chaque zone de raffinement et chaque plan de coupe ou de symétrie aussi.

- Une condition à Off n'est pas envoyée au solveur, n'entre pas dans l'estimation à la main ni dans la recherche de
  symétrie, n'a pas de symbole dans la vue (son endroit s'allume encore quand elle est sélectionnée) et ne demande rien
  au guide. Elle **garde son numéro** (E2 reste E2).
- **Alt + clic** sur un interrupteur : cette condition seule à On parmi celles de son type — le geste qui passe d'un
  cas au suivant.
- Si plus rien n'est à On, le guide le dit et propose de remettre à On (« l'effort est à Off : remettez-le à On… »).
- Chaque essai **retient le cas calculé** : « Cas calculé : A1 Encastrement · E2 Pression 0,004 MPa — 1 condition à
  Off », en tête du résultat, et une colonne « Cas » dans « Les essais de cette séance » : deux cas se comparent côte à
  côte (contrainte de pointe, déplacement, facteur de sécurité).
- Une zone de raffinement à Off n'est ni maillée ni résolue ; ses cotes restent.
- Un **plan de coupe ou de symétrie à Off ne coupe rien** : le modèle redevient entier (ou coupé par les seuls autres
  plans), la symétrie quitte les appuis (S1). **Un seul plan par axe compte** : mettre à On la copie d'un plan met à
  Off celui du même axe — on compare ainsi le même modèle coupé ici ou là, avec ou sans sa symétrie. Alt + clic : ce
  plan seul à On. Un essai nomme les coupes libres avec lesquelles il a été résolu (« CY coupe Y = 75 mm »).

**Le cas de charge est gardé dans le projet** (il vivait le temps d'une visite : fermer la page le perdait). Chaque
pièce et chaque assemblage a le sien — appuis, efforts, sources, températures, zones, plans, finesse du maillage,
physique, facteur de sécurité visé, avec les copies et ce qui est à Off :

- chaque changement s'écrit dans le projet **comme une étape annulable**, à son nom (« Cas de charge : DRV-BASE ») ;
  Ctrl + Z et Ctrl + Y le ramènent à l'écran, la page recharge ou non ;
- à la visite suivante — après une autre page, un rechargement, ou chez un coéquipier — le cas revient tel quel, les
  valeurs d'exemple pas encore confirmées clignotent toujours ;
- **une simple visite n'écrit rien** : le premier cas que l'outil propose reste une proposition tant que rien n'a été
  changé ; un cas dont on a retiré les appuis garde ses efforts (le guide dit qu'il n'est pas tenu) ;
- le cas voyage dans le texte `.dwiz` du projet (une ligne `case DRV-BASE structure …`) et dans la fusion d'équipe
  (un artéfact « Cas de charge DRV-BASE ») ; retirer la pièce retire son cas.

Ne sont pas gardés : les résultats (les essais de la séance — « Ajouter au rapport » garde un essai dans
`project.simulations`), ce qui est sélectionné, la vue. Ne sont pas à On / Off : la convection et la température
uniforme (une case à cocher chacune).

Dans le fichier : `cases: [{ id (la pièce ou l'assemblage), kind, cells, fsTarget, fixed, loads, power, fixedT, conv,
thermo, cuts, zones, places, placeSeq }]` sur le projet. Code : `web/js/analysis/fea/case_store.js` (`caseOf`,
`takeCase`, `withCase`, sans import), `bc_tree.js` (`isOff`, `onOf`, `withOff`, `copyOf`, `soloOn`, `liveCuts`, `cutOn`,
`caseWords`), `case_check.js` ; écran `web/js/modules/fea.js`, `fea_tree.js`, `fea_zones.js`, `fea_cuts.js`,
`fea_result.js`.

## Assemblage : des pièces à On / Off

Chaque pièce de la liste a son interrupteur (et le clic droit propose « Mettre à Off »). Une pièce à Off **reste dans
l'assemblage** avec sa place et ses accouplements, et sort de tout ce qui compte : la vue, la nomenclature, la masse,
les dimensions hors tout, les accouplements (ils sont « en attente », pas « rompus »), la recherche d'interférences, la
gamme d'assemblage, le DFA, le dessin d'ensemble, l'isolation, la Simulation de l'assemblage, le rendu, le dossier de
commande, le STEP et l'envoi vers Onshape. Remise à On, elle revient telle quelle.

« Masquer » (l'œil) reste autre chose : la pièce n'est plus à l'écran, mais elle compte toujours. Un **clic droit sur
une pièce de la liste** ouvre son menu — le même que sur la pièce dans la vue, et il suit son état : « Montrer
seulement cette pièce » (les autres sont masquées, pas à Off), « Montrer toutes les pièces » quand certaines sont
masquées, « Masquer » / « Afficher », « Mettre à Off » / « Remettre à On », « Fixer » / « Libérer », « Ouvrir la
pièce », « Retirer ». L'interrupteur et l'œil restent sur la ligne (`instanceMenu` de `core/asm_live.js`).

Si la pièce fixe passe à Off, la première pièce restante sert de référence ; les pièces qui n'étaient tenues que par
elle deviennent « non matées » jusqu'à son retour.

**Variantes d'un assemblage.** Le groupe « Variantes » du volet de gauche garde sous un nom les pièces à On et à Off
en ce moment (« Complet », « Sans couvercle ni isolant »). Un clic sur un nom ramène **toute la version d'un coup**, en
une étape que Ctrl + Z annule ; la variante en cours est marquée, chaque autre dit ce que le clic changerait
(« Couvercle à Off · Isolant à Off »). Une pièce ajoutée plus tard vaut pour toutes les variantes. La variante de
chaque pièce n'en fait pas partie : elle se choisit dans la pièce.

Dans le fichier : `off: true` sur l'instance ; `variants: [{ name, off: [identifiants d'instances] }]` sur
l'assemblage. Code : `web/js/core/asm_live.js` (`liveAsm`, `asmVariantNow`, `applyAsmVariant`, `asVariant` — sans aucun
import : tout outil qui lit un assemblage passe par là — `buildAssembly`, la gamme, le DFA, le guide, le rendu, le
dessin) ; le groupe est celui de la pièce (`variantPanel` de `web/js/modules/part_variants.js`).

## CAO : les cousines d'une pièce dans une seule pièce

- **Opérations.** Chaque opération de l'arbre de construction a son interrupteur (c'est le champ `suppressed` du
  langage de pièce, qui existait sous un œil) et son bouton « Dupliquer » : la copie naît à Off, sous son propre
  identifiant. Une opération à Off n'est pas faite par le noyau, n'est pas cotée sur le dessin, n'entre pas dans le plan
  du moule ni dans le FeatureScript.
- **Paramètres.** Un paramètre peut **garder d'autres valeurs à côté** de celle qui compte : le petit bouton
  « dupliquer » de sa ligne ajoute une valeur gardée (à Off), que l'on modifie ; son interrupteur la met à On — elle
  prend la place de la valeur du dessus, qui est gardée à son tour. La pièce se reconstruit ; les pièces liées par une
  interface suivent, comme pour tout changement de paramètre. Un paramètre calculé (`expr`) n'a pas de valeur à garder.

- **Variantes nommées.** Le groupe « Variantes » du volet de gauche garde sous un nom l'état de la pièce en ce moment :
  les opérations à On et à Off, et la valeur de chaque paramètre. Un clic sur un nom ramène **toute la cousine d'un
  coup**, en une seule étape que Ctrl + Z annule ; la variante en cours est marquée, et chaque autre dit ce que le clic
  changerait (« 1 opération bascule · Longueur 200 → 160 »). Une variante ne copie pas la pièce : une opération ou un
  paramètre ajouté plus tard vaut pour toutes les variantes. « Mettre à jour » remplace une variante par l'état en
  cours ; retirer un nom ne change pas la pièce.

## Un dessin par variante

Chaque ligne du groupe « Variantes » — d'une pièce ou d'un assemblage — a un bouton qui ouvre **le dessin de cette
variante**, et l'écran Dessins offre le choix « Variante dessinée ». La feuille est tracée d'après une copie : **le
document n'est pas changé** (la pièce reste dans la variante où elle était, l'assemblage garde ses pièces à On), le
cartouche dit laquelle il montre (« — VARIANT Longue »), le PDF porte son nom, et l'adresse se garde
(`#/drawings/DRV-BASE/Longue`, `#/drawings/asm/DRV-ASM/Sans%20couvercle`). Le numéro de pièce et la révision sont ceux
du document : une variante qui change la forme, l'ajustement ou la fonction mérite son propre numéro (règle 3F,
[REVISIONS.md](REVISIONS.md)) — l'outil ne le décide pas à votre place.

## Ce qui sort suit une variante

Une pièce ou un assemblage qui garde des cousines ne sort jamais « tout court » : un fichier, une gamme, une commande ou
un envoi est celui d'**une** variante. Deux règles, tenues à un seul endroit (`web/js/core/variant_out.js`) :

1. **Ce qui sort dit de quelle variante il vient** — que la variante ait été demandée ou qu'elle soit simplement celle
   où le document se trouve. Dans le **nom du fichier** (`DRV-BASE_Longue.step`, `DRV-ASM_Sans-couvercle_BOM.csv`,
   `DRV-BASE_Longue_commande.zip`) et dans **l'en-tête** : « Variante : Longue » en première ligne d'une gamme (écran,
   texte, Word, PDF), dans la demande de prix (« Variante : Longue — les fichiers joints sont ceux de cette variante »),
   « — VARIANT Longue » au cartouche d'un dessin, le nom du produit dans un STEP d'assemblage. Un document sans
   variante sort comme avant, sans rien de plus. Un document dans un **état sans nom** sort sans nom de variante, et le
   guide le signale.
2. **Ce qui sort se fait pour une variante choisie, sans changer le document.** Le menu « **Variante qui sort** » —
   le même partout — propose d'abord le document tel qu'il est (avec le nom de sa variante), puis chaque cousine. Une
   autre variante que celle de l'écran est produite **d'après une copie**, construite à côté de la pièce : la pièce ou
   l'assemblage, la vue et l'historique ne bougent pas. Le menu devient ambre, et le guide le dit (« à vérifier » : ce
   qui sort n'est pas la cousine à l'écran).

| Ce qui sort | Comment il suit |
|---|---|
| Fichiers d'échange d'une pièce (`.dwiz`, STEP, STL, DXF, développé, PDF, FeatureScript, gamme texte) | menu « Variante qui sort » de l'onglet **Artéfacts** ; chaque fichier porte le nom de la variante |
| Commande du prototype (vérification, demande de prix, dossier `.zip`, rangement dans Drive) | le même menu : la pièce est **vérifiée comme cette variante** (DFx, délai), l'archive, son dossier et le dossier Drive la nomment |
| Gamme de fabrication, gamme d'assemblage | celle du document tel qu'il est, **nommée** (une pastille « Variante : … » en tête de l'onglet, une ligne sur les fiches) ; pour une autre variante : un clic sur son nom, ou la gamme texte par le menu |
| Dessins | une feuille par variante (ci-dessus) ; le cartouche nomme aussi la variante où le document se trouve |
| STEP, nomenclature (à plat et par niveaux) et registre des joints d'un assemblage | ceux de la variante où l'assemblage se trouve, nommée dans le fichier ; les pièces mises de côté n'y sont pas |
| Envoi vers Onshape | menu « Variante qui sort » sous l'assemblage choisi : le STEP envoyé est celui de la variante, le produit porte son nom |
| Rapport de revue | une section « **Variantes** » : chaque document qui en garde, la variante montrée, et ce que les autres changent ; la fiche de la pièce dit « Variante montrée » |
| Miroir Drive du projet (`projectArtifacts`) | le document tel qu'il est ; ses fichiers portent le nom de sa variante — ceux d'une autre variante restent à côté |

Le numéro et la révision restent ceux du document : nommer une variante sur un fichier ne remplace pas un numéro de
pièce (règle 3F, [REVISIONS.md](REVISIONS.md)). L'usage suivi est celui des « configurations » des modeleurs
mécaniques (un export, un dessin ou une nomenclature est celui d'une configuration, et le dit) — repris de mémoire,
voir le registre des sources.

Dans le fichier : `suppressed: true` sur une opération ; `alts: [valeur, …]` dans la définition d'un paramètre (le
langage de pièce ne lit que `value`) ; `variants: [{ name, off: [identifiants d'opérations], params: { nom: valeur } }]`
sur la pièce. Les règles DFM partent de ce que le noyau a construit : une opération à Off n'y entre pas. Code :
`web/js/core/variants.js`, `web/js/core/variant_out.js` (ce qui sort) ; écran `web/js/modules/part_studio.js`,
`part_panels.js`, `part_variants.js` (`outPicker`, le menu « Variante qui sort »), `part_gamme.js`.

## Ce qui est vérifié, ce qui ne l'est pas

Vérifié dans Chromium, sur la démonstration : deux cas de charge calculés l'un après l'autre (pression doublée,
contrainte de pointe doublée, les deux lignes dans les essais) ; une zone à Off puis sa copie à On ; une pièce de
l'assemblage à Off puis à On (compte, masse, vue, dessin d'ensemble, revue DFx sans erreur), la pièce fixe à Off ; une
opération à Off, sa copie, une valeur gardée mise à On puis retirée (le paramètre revient exactement à ce qu'il
était) ; un plan de symétrie à Off puis à On, sa copie déplacée mise à On à sa place, un essai qui nomme sa coupe ;
deux variantes d'une pièce gardées, la bascule de l'une à l'autre en un clic, Ctrl + Z, le rechargement de la page ;
un cas de charge modifié puis retrouvé après un rechargement de la page et après un autre écran, Ctrl + Z et Ctrl + Y
suivis par l'écran, une visite sans changement qui n'écrit rien ; deux variantes d'un assemblage, la bascule en une
étape, le compte et la masse qui suivent, Ctrl + Z ; le dessin d'une variante d'assemblage (deux pièces de moins dans
sa liste) et d'une variante de pièce (200 mm sur la feuille, 160 mm dans la pièce), sans changer le document ;
**ce qui sort** (v0.97) : sur la pièce de la démonstration avec deux variantes, le STEP, la gamme et le PDF téléchargés
pour chacune (noms, contenu, un autre solide), le dossier de commande d'une variante qui n'est pas celle de l'écran
(archive, dossier, demande de prix), le guide qui le signale, la pièce inchangée et aucune étape écrite ; sur
l'assemblage, le STEP et la nomenclature de sa variante sans la pièce mise de côté, la gamme nommée ; la section
« Variantes » du rapport.
Tests : `tests/node/fea_onoff.test.mjs`, `tests/node/onoff.test.mjs`, `tests/node/fea_case_store.test.mjs`,
`tests/node/asm_variants.test.mjs`, `tests/node/variant_out.test.mjs`.

Pas vérifié : le menu « Variante qui sort » de l'envoi vers Onshape (il faut un compte Onshape connecté : seul le code
est tenu par un essai de câblage) ; le rangement d'une commande dans Drive avec le nom de la variante (connexion
Google) ; Firefox, Safari.

Pas encore fait : plusieurs cas de charge **nommés** par pièce (un seul cas par pièce, avec ses copies à On / Off) ;
une variante d'assemblage ne retient pas la variante de chacune de ses pièces — un STEP ou un envoi d'assemblage
prend donc chaque pièce telle qu'elle est ; le rapport de revue montre chaque document dans sa variante en cours (il
les nomme et liste les autres, mais ne se construit pas pour une variante choisie sans y passer) ; le miroir Drive
publie le document tel qu'il est, pas toutes ses variantes d'un coup ; les classes de cotes (référence, SC) sont
celles du document, pas propres à une variante ; pas de dessin tabulé (une feuille, un tableau des variantes).
