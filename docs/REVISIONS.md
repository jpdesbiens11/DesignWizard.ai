# Révisions libérées, numéros et règle 3F

Un produit se conçoit en bougeant ; il se fabrique, se commande et se qualifie sur quelque chose qui **ne bouge plus**.
L'écran **Revue → Révisions** (ou menu Projet → « Révisions et numéros… ») fait ce passage : il **libère**.

## Libérer

Libérer une pièce, un assemblage ou une carte :

1. lui donne **son numéro**, la première fois ;
2. **fige sa révision** : le contenu de cette révision est gardé entier et ne changera plus jamais ;
3. la marque « revue » dans le registre de la revue de conception.

Le travail continue dans le projet, qui ouvre toujours l'état **le plus récent**. Chaque révision libérée reste à
portée : on l'ouvre, on voit ce qui a changé depuis, on télécharge son fichier, on peut la **reprendre** comme copie de
travail (une étape annulable — les révisions libérées, elles, ne bougent pas).

## Le numéro

Les numéros suivent le **Reference Generator** des outils de DynamiteAgile, la même règle que pour les documents :

```
TYPE-DDDDD-TTTTT        PRT pièce · ASM assemblage · PCB carte
PRT-46341-77549         DDDDD : jours depuis le 30 décembre 1899 (le numéro de série d'un tableur), en temps universel
                        TTTTT : l'heure, en cent-millièmes de jour (un pas de 0,864 s)
PRT-46341-77549_B Base du boîtier      le nom du dossier et du fichier d'une révision : numéro_révision nom
```

Le numéro est le moment où il a été attribué ; si le créneau est pris, c'est le suivant. **Un numéro n'est jamais
réutilisé, une révision libérée n'est jamais effacée.** Le repère de travail de la pièce (`DRV-BASE`) ne change pas : c'est
lui que les assemblages et les dessins emploient ; le numéro est son identité une fois libérée.

## Forme, ajustement, fonction : révision suivante ou nouveau numéro

À la libération suivante, une seule question : **l'article d'aujourd'hui peut-il prendre la place de celui qui a été
libéré, et celui-là sa place, partout ?** C'est la règle 3F (form, fit, function).

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

L'écran dit le verdict **avant** de libérer, avec ses raisons ; le dialogue le répète, et rien n'est fait sans votre oui.

## Un assemblage est libéré avec ses pièces

Un assemblage ne se libère que si **chacune de ses pièces est libérée** ; sa révision note, pour chaque pièce, **le
numéro et la révision** avec lesquels il l'a été. Ces pièces sont gelées dans cette révision de l'assemblage.

Une pièce qui évolue ensuite **n'est pas jugée compatible par défaut** avec l'assemblage libéré, même si la règle 3F dit
qu'elle est interchangeable : elle n'a pas été validée dedans. L'écran le montre, pièce par pièce :

| État | Ce que cela veut dire |
|---|---|
| celle de l'assemblage libéré | rien n'a bougé |
| modifiée, pas encore libérée | à libérer avant de pouvoir libérer l'assemblage |
| révision plus récente | interchangeable par la règle 3F, mais pas validée dans cette révision de l'assemblage |
| nouveau numéro | 3F rompu : à requalifier, dans une nouvelle libération de l'assemblage |

La libération suivante de l'assemblage prend les révisions du jour. L'assemblage lui-même est jugé par la même règle :
son **ajustement** est fait des interfaces de ses pièces qu'aucun accouplement n'emploie — ce qu'il offre à ce qui
l'entoure. Une pièce qui change de numéro **à l'intérieur** ne change donc pas le numéro de l'assemblage ; une interface
extérieure qui bouge, si.

On ne cherche pas à ce que tout reste compatible avec tout : on **sait** ce qui l'est, et le reste porte un autre numéro.

## Dans Google Drive

« Ranger les révisions dans Drive » (et « Publier les artéfacts » de l'écran Compte) dépose **un dossier par révision
libérée** dans `06_Revisions/`, nommé `numéro_révision nom`, avec le fichier `.dwiz` figé. Le fichier du projet garde
aussi toutes les révisions : c'est lui que l'application ouvre.

## En équipe

Les révisions libérées voyagent dans le miroir ([EQUIPE.md](EQUIPE.md)) : une libération ne fait que s'ajouter. La pièce
dont le contenu est celui qu'une libération a figé prend son numéro et sa révision chez l'autre membre.

## Ce qui est écrit dans le projet

```
part DRV-BASE … pn=PRT-46341-77677 revision=A derivedFrom={pn: PRT-46341-77648, rev: B, why: "Forme : …"}
plm
  releases
    - id=PRT-46341-77648_A key="part:DRV-BASE" pn=… rev=A at=… sig=… form={size: [160, 110, 42], mass: 111.1} doc={…}
    - id=ASM-46341-77656_A key="assembly:DRV-ASM" … uses={DRV-BASE: {pn: …, rev: A}, …} ext=[…]
```

Le module est pur : `web/js/core/plm.js` (`planRelease`, `release`, `formFitFunction`, `compatibility`, `restore`,
`releaseFiles`, `newReference`, `plmRows`) ; l'écran est `web/js/modules/plm.js` (`#/plm`).

## Limites

- **Vérifié** : la règle et ses cas, par des tests (numérotation, 3F, pièces gelées, retour à une révision, voyage dans
  le miroir) ; l'écran rejoué dans le navigateur sur la démonstration. **Pas vérifié** : le dépôt des dossiers sur un
  vrai Drive (testé contre un Drive simulé seulement).
- La forme se juge sur l'enveloppe et la masse : deux pièces de même enveloppe et de même masse mais de forme différente
  passent pour la même forme. La fonction se juge sur ce qui est écrit dans la pièce ; une performance qui change sans
  que rien de cela ne change n'est pas vue. **Le verdict est une aide : la personne qui libère en répond.**
- Une carte (PCBA) reçoit un numéro et des révisions ; son ajustement n'est jugé que sur les interfaces qu'elle déclare.
- Le numéro vient de l'horloge du poste. Deux membres qui libèrent la même révision chacun de leur côté, avant de
  synchroniser, auront deux libérations ; la fusion garde celle de celui qui fusionne.
- Pas d'effectivité (à partir de quel numéro de série), pas d'ordre de modification (ECR / ECN) : la libération en est
  le socle, pas le remplacement.
