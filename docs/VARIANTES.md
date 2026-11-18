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

Le cas de charge de la Simulation vit le temps de la séance (il n'est pas dans le fichier du projet) : les copies et
ce qui est à Off aussi. Ne sont pas à On / Off : la convection et la température uniforme (une case à cocher chacune).

Code : `web/js/analysis/fea/bc_tree.js` (`isOff`, `onOf`, `withOff`, `copyOf`, `soloOn`, `liveCuts`, `cutOn`,
`caseWords`), `case_check.js` ; écran `web/js/modules/fea.js`, `fea_tree.js`, `fea_zones.js`, `fea_cuts.js`,
`fea_result.js`.

## Assemblage : des pièces à On / Off

Chaque pièce de la liste a son interrupteur (et le clic droit propose « Mettre à Off »). Une pièce à Off **reste dans
l'assemblage** avec sa place et ses accouplements, et sort de tout ce qui compte : la vue, la nomenclature, la masse,
les dimensions hors tout, les accouplements (ils sont « en attente », pas « rompus »), la recherche d'interférences, la
gamme d'assemblage, le DFA, le dessin d'ensemble, l'isolation, la Simulation de l'assemblage, le rendu, le dossier de
commande, le STEP et l'envoi vers Onshape. Remise à On, elle revient telle quelle.

« Masquer » (l'œil) reste autre chose : la pièce n'est plus à l'écran, mais elle compte toujours.

Si la pièce fixe passe à Off, la première pièce restante sert de référence ; les pièces qui n'étaient tenues que par
elle deviennent « non matées » jusqu'à son retour.

Dans le fichier : `off: true` sur l'instance. Code : `web/js/core/asm_live.js` (`liveAsm`, sans aucun import : tout
outil qui lit un assemblage passe par là — `buildAssembly`, la gamme, le DFA, le guide, le rendu, le dessin).

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

Dans le fichier : `suppressed: true` sur une opération ; `alts: [valeur, …]` dans la définition d'un paramètre (le
langage de pièce ne lit que `value`) ; `variants: [{ name, off: [identifiants d'opérations], params: { nom: valeur } }]`
sur la pièce. Les règles DFM partent de ce que le noyau a construit : une opération à Off n'y entre pas. Code :
`web/js/core/variants.js` ; écran `web/js/modules/part_studio.js`, `part_panels.js`, `part_variants.js`.

## Ce qui est vérifié, ce qui ne l'est pas

Vérifié dans Chromium, sur la démonstration : deux cas de charge calculés l'un après l'autre (pression doublée,
contrainte de pointe doublée, les deux lignes dans les essais) ; une zone à Off puis sa copie à On ; une pièce de
l'assemblage à Off puis à On (compte, masse, vue, dessin d'ensemble, revue DFx sans erreur), la pièce fixe à Off ; une
opération à Off, sa copie, une valeur gardée mise à On puis retirée (le paramètre revient exactement à ce qu'il
était) ; un plan de symétrie à Off puis à On, sa copie déplacée mise à On à sa place, un essai qui nomme sa coupe ;
deux variantes d'une pièce gardées, la bascule de l'une à l'autre en un clic, Ctrl + Z, le rechargement de la page.
Tests : `tests/node/fea_onoff.test.mjs`, `tests/node/onoff.test.mjs`.

Pas encore fait : des cas de charge gardés dans le projet (ils vivent le temps de la séance) ; une variante ne retient
pas les pièces à On / Off d'un assemblage ; le dessin et la gamme d'une pièce suivent la variante en cours, il n'y a
pas un dessin par variante.
