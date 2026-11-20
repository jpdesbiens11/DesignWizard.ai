# Révisions libérées, numéros et règle 3F

Un produit se conçoit en bougeant ; il se fabrique, se commande et se qualifie sur quelque chose qui **ne bouge plus**.
L'écran **Revue → Révisions** (ou menu Projet → « Révisions et numéros… ») fait ce passage : il **libère**.


## Geler, puis libérer

Demande de JP (20 novembre 2026, sur une capture de l'écran) : « "Libérer" doit être "Geler la révision" — "Freeze the
revision" en anglais… le gel a besoin d'un approbateur et d'un cycle de revue de conception (lean) pour justifier et
tracer le passage à "libérée", l'état final d'un composant ou d'un assemblage gelé, par convention de l'industrie. On
doit voir facilement l'état et le nom de la révision ».

| État | En anglais | Ce que cela veut dire |
|---|---|---|
| En travail | In work | Le projet bouge encore : rien n'est figé. |
| **Gelée** | Frozen | Le contenu est figé sous un numéro et une révision. Elle attend sa revue. |
| **Libérée** | Released | Revue et approuvée par quelqu'un d'autre que son auteur : l'état final. |
| Refusée | Rejected | La revue ne l'a pas libérée ; elle reste au dossier, avec la raison. |

**Geler** (« Geler la révision… ») donne à l'élément son numéro, fige son contenu et **demande le nom de son auteur**.
Tout ce que ce document décrit plus bas — numéro, règle forme · ajustement · fonction, pièces épinglées d'un
assemblage — est ce que fait le gel.

**La revue de conception** (« Revue de conception… », sur une révision gelée) est courte, et se fait en deux temps
(`web/js/core/plm_review.js`) :

- **ce que l'outil vérifie lui-même**, sur le contenu GELÉ : il est intact ; pour un assemblage, chaque pièce et
  sous-assemblage épinglé est lui-même **libéré**, et l'assemblage se construit ; pour une pièce, son bilan DFx ; pour
  une carte, ses règles électriques et de fabrication, et si elle a des relevés de laboratoire ;
- **ce que l'approbateur confirme** : trois points par nature d'élément, et les points ouverts de la revue précédente
  quand il y en a.

L'approbateur écrit son nom, la justification et les points ouverts, puis **libère** ou **refuse**. Choix de JP, par
menu : l'approbateur est **quelqu'un d'autre que l'auteur** — l'outil compare les deux noms et refuse s'ils sont les
mêmes ; la liste est **tirée de l'outil** ; **une fois gelée, une révision ne change plus** : tout changement ouvre la
révision suivante. Un point « non conforme » de l'outil retient la libération ; un point « à vérifier » ne la retient
pas. Une révision refusée reste au dossier ; la suite se fait dans la révision suivante.

La décision est une étape annulable ; elle s'écrit sur la révision (`state`, `review` : qui, quand, la décision, la
justification, les points ouverts, la liste telle qu'elle a été vue) et dans le registre de revue du projet. La
**fiche de revue** sort en PDF, au gabarit des documents, avec les deux signatures.

**À l'écran**, chaque ligne porte une pastille : le nom de la révision et son état, dans sa couleur ; « + en travail »
quand le projet a changé depuis. Une révision gelée avant que la revue existe attend sa revue comme les autres.

**Ce qui est vérifié, ce qui ne l'est pas.** Les états, la liste, ce qui retient une décision, la décision et la
fiche sont tenus par des tests (`tests/node/plm_review.test.mjs`). L'outil **ne vérifie pas l'identité** de
l'approbateur : il compare deux noms tapés. Les états « in work », « frozen », « released » sont l'usage courant des
outils de gestion de données techniques ; aucune norme de gestion de configuration n'a été lue pour les fonder
(registre des sources : `plm-review`, « choix maison »).

## Geler

Geler une pièce, un assemblage ou une carte :

1. lui donne **son numéro**, la première fois ;
2. **fige sa révision** : le contenu de cette révision est gardé entier et ne changera plus jamais ;
3. la marque « revue » dans le registre de la revue de conception.

Le travail continue dans le projet, qui ouvre toujours l'état **le plus récent**. Chaque révision gelée reste à
portée : on l'ouvre, on voit ce qui a changé depuis, on télécharge son fichier, on peut la **reprendre** comme copie de
travail (une étape annulable — les révisions gelées, elles, ne bougent pas).

## Le numéro

Les numéros suivent le **Reference Generator** des outils de DynamiteAgile, la même règle que pour les documents :

```
TYPE-DDDDD-TTTTT        PRT pièce · ASM assemblage · PCB carte
PRT-46341-77549         DDDDD : jours depuis le 30 décembre 1899 (le numéro de série d'un tableur), en temps universel
                        TTTTT : l'heure, en cent-millièmes de jour (un pas de 0,864 s)
PRT-46341-77549_B Base du boîtier      le nom du dossier et du fichier d'une révision : numéro_révision nom
```

Le numéro est le moment où il a été attribué ; si le créneau est pris, c'est le suivant. **Un numéro n'est jamais
réutilisé, une révision gelée n'est jamais effacée.** Le repère de travail de la pièce (`DRV-BASE`) ne change pas : c'est
lui que les assemblages et les dessins emploient ; le numéro est son identité une fois gelée.

## Forme, ajustement, fonction : révision suivante ou nouveau numéro

À le gel suivante, une seule question : **l'article d'aujourd'hui peut-il prendre la place de celui qui a été
gelé, et celui-là sa place, partout ?** C'est la règle 3F (form, fit, function).

| | Ce qui est comparé | Exemples qui la rompent |
|---|---|---|
| **Forme** | l'enveloppe et la masse, mesurées par le noyau | une cote hors tout qui bouge de plus de 0,05 mm ; la masse de plus de 2 % |
| **Ajustement** | chaque interface, **en nombres** : type, position, face, paramètres | un entraxe de vis déplacé par un paramètre ; une interface ajoutée ou retirée |
| **Fonction** | la fonction écrite, le matériau, le rôle électrique, les valeurs nominales d'un composant | un changement de matériau ; une barre qui change de potentiel |

- Les trois tiennent → **même numéro, révision suivante** (A → B).
- Une seule est rompue → **nouveau numéro, révision A**. L'article garde la trace de celui dont il dérive
  (`derivedFrom` : numéro, révision, raison) : c'est la traçabilité qualité. L'ancien numéro garde ses révisions.

Ce qui ne rompt rien : un nom, une note, le procédé, la finition, une classe de cote, un détail intérieur qui ne touche
ni l'enveloppe ni une interface. Une interface **ajoutée** rompt l'ajustement : la nouvelle pièce remplacerait
l'ancienne, pas l'inverse — l'interchangeabilité se juge dans les deux sens.

L'écran dit le verdict **avant** de geler, avec ses raisons ; le dialogue le répète, et rien n'est fait sans votre oui.

## Un assemblage est gelé avec ses pièces

Un assemblage ne se libère que si **chacune de ses pièces est gelée** ; sa révision note, pour chaque pièce, **le
numéro et la révision** avec lesquels il l'a été. Ces pièces sont gelées dans cette révision de l'assemblage.

Une pièce qui évolue ensuite **n'est pas jugée compatible par défaut** avec l'assemblage gelé, même si la règle 3F dit
qu'elle est interchangeable : elle n'a pas été validée dedans. L'écran le montre, pièce par pièce :

| État | Ce que cela veut dire |
|---|---|
| celle de l'assemblage gelé | rien n'a bougé |
| modifiée, pas encore gelée | à geler avant de pouvoir geler l'assemblage |
| révision plus récente | interchangeable par la règle 3F, mais pas validée dans cette révision de l'assemblage |
| nouveau numéro | 3F rompu : à requalifier, dans une nouvelle gel de l'assemblage |

Le gel suivante de l'assemblage prend les révisions du jour. L'assemblage lui-même est jugé par la même règle :
son **ajustement** est fait des interfaces de ses pièces qu'aucun accouplement n'emploie — ce qu'il offre à ce qui
l'entoure. Une pièce qui change de numéro **à l'intérieur** ne change donc pas le numéro de l'assemblage ; une interface
extérieure qui bouge, si.

On ne cherche pas à ce que tout reste compatible avec tout : on **sait** ce qui l'est, et le reste porte un autre numéro.

### Et avec ses sous-assemblages (v0.93)

La même règle, un niveau plus haut. Un assemblage qui porte des sous-assemblages ne se libère que si **chacun d'eux est
gelé** — à la lettre, avec tout ce qu'il contient : ses pièces, ses propres sous-assemblages. L'ordre est donc : les
pièces, puis le sous-assemblage, puis le parent ; l'écran nomme ce qui manque (« À geler d'abord : … »). Le gel
du parent note **le numéro et la révision de chaque sous-assemblage** (`subs`), à côté de ceux des pièces — toutes les
pièces, à travers les niveaux. « Libérée avec » les montre, le sous-assemblage d'abord.

Un sous-assemblage qui avance ensuite (une note, une pièce dedans, un accouplement) n'est plus un état gelé : le
parent le dit (« sous-assemblage modifié, pas encore gelé »), puis, une fois le sous-assemblage gelé de nouveau,
« révision plus récente du sous-assemblage : pas validée dans cette révision de l'assemblage » — et le parent, qui n'a
pourtant pas changé lui-même, se voit proposer sa révision suivante. Un assemblage gelé **avant la v0.93** avec un
sous-assemblage n'a pas ce relevé : il se voit proposer sa révision suivante, qui le prendra.

## Dans Google Drive

« Ranger les révisions dans Drive » (et « Publier les artéfacts » de l'écran Compte) dépose **un dossier par révision
gelée** dans `06_Revisions/`, nommé `numéro_révision nom`, avec le fichier `.dwiz` figé. Le fichier du projet garde
aussi toutes les révisions : c'est lui que l'application ouvre.

## En équipe

Les révisions gelées voyagent dans le miroir ([EQUIPE.md](EQUIPE.md)) : un gel ne fait que s'ajouter. La pièce
dont le contenu est celui qu'un gel a figé prend son numéro et sa révision chez l'autre membre.

## Ce qui est écrit dans le projet

```
part DRV-BASE … pn=PRT-46341-77677 revision=A derivedFrom={pn: PRT-46341-77648, rev: B, why: "Forme : …"}
plm
  releases
    - id=PRT-46341-77648_A key="part:DRV-BASE" pn=… rev=A at=… sig=… form={size: [160, 110, 42], mass: 111.1} doc={…}
    - id=ASM-46341-77656_A key="assembly:DRV-ASM" … uses={DRV-BASE: {pn: …, rev: A}, …} subs={ASM-002: {pn: …, rev: A}} ext=[…]
```

`subs` n'est écrit que pour un assemblage qui porte des sous-assemblages.

Le module est pur : `web/js/core/plm.js` (`planRelease`, `release`, `formFitFunction`, `compatibility`, `usesOf`, `subsOf`, `restore`,
`releaseFiles`, `newReference`, `plmRows`) ; l'écran est `web/js/modules/plm.js` (`#/plm`).

## Limites

- **Vérifié** : la règle et ses cas, par des tests (numérotation, 3F, pièces gelées, sous-assemblages gelés, retour à
  une révision, voyage dans le miroir) ; l'écran rejoué dans le navigateur sur la démonstration — y compris, en v0.93,
  le variateur gelé avec un sous-assemblage. **Pas vérifié** : le dépôt des dossiers sur un
  vrai Drive (testé contre un Drive simulé seulement).
- La forme se juge sur l'enveloppe et la masse : deux pièces de même enveloppe et de même masse mais de forme différente
  passent pour la même forme. La fonction se juge sur ce qui est écrit dans la pièce ; une performance qui change sans
  que rien de cela ne change n'est pas vue. **Le verdict est une aide : la personne qui libère en répond.**
- Une carte (PCBA) reçoit un numéro et des révisions ; son ajustement n'est jugé que sur les interfaces qu'elle déclare.
- Le numéro vient de l'horloge du poste. Deux membres qui libèrent la même révision chacun de leur côté, avant de
  synchroniser, auront deux gels ; la fusion garde celle de celui qui fusionne.
- Pas d'effectivité (à partir de quel numéro de série), pas d'ordre de modification (ECR / ECN) : le gel en est
  le socle, pas le remplacement.
