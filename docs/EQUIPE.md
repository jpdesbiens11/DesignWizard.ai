# Travailler à plusieurs, en miroir

Un projet commun **sans copie centrale**. Chaque membre garde le projet entier chez lui — sur son poste ou dans son
propre Google Drive — : c'est son **miroir**. Il le donne à lire aux autres, et lit le leur. Aucun serveur ne tient
« la » version : il y a autant de copies complètes que de membres, et chacune est aussi une sauvegarde des autres.

L'écran est sous **Revue → Équipe** (ou menu Projet → « Équipe et messages… »).

## Démarrer

| Qui | Fait quoi |
|---|---|
| Celui qui a le projet | **Équipe → « Partager ce projet »**, choisit son nom d'équipe (`jp`), puis **« Télécharger mon miroir »** et donne le fichier `…​.miroir-jp.dwiz` à la personne invitée — ou **« Partager mon miroir dans Drive… »** (voir plus bas) |
| La personne invitée | menu Projet → **« Rejoindre un projet partagé… »**, choisit le fichier reçu et son nom d'équipe (`ami`). Elle a maintenant **son** projet, copie du miroir reçu |
| La personne invitée | **« Télécharger mon miroir »** et le renvoie : en le fusionnant, le premier membre la voit entrer dans l'équipe |

Ensuite, à chaque fois que l'on veut se remettre d'accord : chacun donne son miroir, chacun **fusionne** celui de
l'autre. L'ordre n'a pas d'importance, et l'on peut être deux, trois ou dix.

## Fusionner un miroir

« Fusionner le miroir d'un membre… » lit le fichier, **montre ce qui va arriver**, et n'applique rien avant que vous
ayez dit oui. La fusion est une seule étape, annulable (`Ctrl + Z`).

La fusion se fait **artéfact par artéfact** : chaque pièce, assemblage, carte, analyse, plus la fiche du projet et ses
itérations MVP.

| Ce qui s'est passé depuis la dernière fois | Ce que fait la fusion |
|---|---|
| L'autre a changé l'artéfact, pas vous | le sien est **repris** |
| Vous l'avez changé, pas l'autre | le vôtre est **gardé** ; il partira avec votre miroir |
| L'autre en a créé un | il est **ajouté** |
| L'autre l'a retiré, vous n'y avez pas touché | il est **retiré** |
| Vous l'avez changé **tous les deux** (ou l'un l'a retiré pendant que l'autre le changeait) | **conflit** : le vôtre reste en place, le sien est gardé à côté, entier |

### La règle : la lignée

Chaque artéfact porte un **tampon** : qui lui a donné sa forme actuelle, quand, sa signature, et la **lignée** des
signatures qu'il a remplacées (les seize dernières). Une version qui compte la vôtre dans sa lignée est plus récente
que la vôtre : elle est reprise sans un mot. La vôtre qui compte la sienne est gardée. Aucune des deux : vous avez
travaillé chacun de votre côté, c'est un conflit.

Cette règle ne dépend pas de qui a lu qui : le changement de `@zoe` peut arriver chez `@jp` par le miroir de `@ami`,
et deux membres qui ne se sont jamais échangé de miroir fusionnent sans faux conflit. Un changement puis son annulation
est lu comme une version plus récente, pas comme un retour en arrière à ignorer.

### Trancher un conflit

La carte « À trancher » montre ce qui diffère et deux boutons : **« Garder le mien »** ou **« Prendre celui de
@membre »**. Rien n'est perdu avant ce choix. Le choix est écrit dans la lignée : **il vaut pour toute l'équipe** et
arrive chez les autres comme un changement ordinaire. Si deux membres tranchent le même conflit en sens contraire, la
décision la plus tardive tient, des deux côtés.

Ce qui n'est jamais en conflit, parce que cela ne fait que s'ajouter : les **messages**, les **membres**, et le
**registre de revue** (pour chaque artéfact, le dernier mot tient).

## Messages

Un message s'écrit **sur le projet ou sur un artéfact** ; il suit la conception de cet artéfact et **voyage dans le
miroir**, comme le reste.

- `@nom` appelle un membre : le message apparaît chez lui sous « Pour moi », avec un compteur ;
- la case **« fait »** dit que la demande est traitée — pour tout le monde, dès la fusion suivante ;
- dans la **Revue**, chaque artéfact d'un projet partagé porte une pastille `@ n` : ses messages ouverts, et le lien
  vers son fil ;
- le **rapport** a une section « Équipe et messages » : les membres, la date de lecture de leur miroir, les messages
  encore ouverts, les conflits en attente.

## Par Google Drive

Chaque membre se connecte à **son** compte Google : son projet est enregistré dans **son** Drive (dossier
« DesignWizard.ai »), comme toujours. Personne n'écrit dans le Drive d'un autre.

**« Partager mon miroir dans Drive… »** enregistre le projet dans votre Drive et donne à une adresse le droit de **lire**
ce fichier. Google lui envoie le lien. L'adresse est envoyée à Google seulement ; elle n'est gardée ni dans le projet ni
dans le miroir. Comme le fichier du Drive est celui que l'application tient à jour, **le même lien donne toujours votre
dernier état**.

Ce qui reste manuel aujourd'hui : la personne **télécharge** le fichier depuis son Drive, puis le choisit dans
« Rejoindre… » ou « Fusionner… ». La raison est un choix de vie privée : l'application ne demande à Google que la
permission `drive.file`, qui ne lui laisse voir **que les fichiers qu'elle a créés pour ce compte**, ou que la personne
lui ouvre un par un. Elle ne peut donc pas lire d'elle-même le fichier qu'un autre membre a partagé.

Pour que la lecture devienne automatique, il y a trois voies ; aucune n'est en place :

| Voie | Ce qu'elle demande |
|---|---|
| Le **sélecteur de fichiers de Google** | une clé d'API du projet Google, et que la page charge le sélecteur depuis Google (la règle « aucune ressource externe » s'élargit d'autant). La permission reste `drive.file` : la personne désigne une fois le miroir de chaque membre, ensuite l'application le relit seule |
| « Ouvrir avec » depuis Drive | déclarer l'application dans l'intégration à l'interface de Drive du projet Google, et une permission de plus (`drive.install`) |
| Une permission plus large (`drive.readonly`) | l'application verrait tout le Drive : contraire au principe du projet, et soumis à une vérification de Google |

## Ce qui est écrit dans le projet

```
team id=t-… owner=jp
  member handle=jp since=… hash=…          hash : empreinte du compte, salée avec l'équipe — jamais l'adresse
  member handle=ami since=… mirror=…       mirror : l'identifiant du fichier dans le Drive du membre, s'il l'a partagé
  stamps  "part:DRV-BASE" at=… by=ami sig=… was=[…]
  conflicts …                              le document de l'autre, entier, tant que personne n'a tranché
talk
  message id=… by=ami on="part:DRV-COVER" text="@jp …" mentions=[jp] done …
```

Le module est pur (`web/js/core/team.js`) : `joinTeam`, `forkMirror`, `stampLocal`, `mergeMirror`, `resolveConflict`,
`post`, `setDone`, `inbox`, `threads`, `teamRows`. L'écran est `web/js/modules/team.js` (`#/team`, et
`#/team/<artéfact>` pour un fil).

Un projet partagé **confié à une IA** part sans l'équipe ni les messages : l'aller-retour IA travaille sur la conception,
et le retour est fusionné chez celui qui l'a demandé, puis part dans son miroir.

## Un essai à deux

1. **Accès** : la personne doit pouvoir se connecter à la démo — son compte dans les utilisateurs test du projet Google
   et son empreinte dans `web/acces.json` (voir [GOOGLE.md](GOOGLE.md), sections 1 et 4). Sans compte Google, l'essai se
   fait aussi bien avec le serveur local (`python designwizard.py`) : le miroir est un fichier.
2. Vous : chargez un projet, **Équipe → Partager ce projet**, puis « Partager mon miroir dans Drive… » avec son adresse
   (ou envoyez-lui le fichier téléchargé).
3. Elle : télécharge le fichier, **Rejoindre un projet partagé…**, change une pièce, vous écrit `@vous …` sur cette
   pièce, puis partage son miroir avec vous.
4. Vous : changez une autre pièce — et la même, pour voir un conflit —, puis **Fusionner** son miroir : l'aperçu doit
   dire une pièce reprise, une gardée, une en conflit, un message pour vous.
5. Tranchez, cochez « fait », renvoyez votre miroir : chez elle, tout arrive sans conflit et les deux projets disent la
   même chose.

## Limites, dites comme elles sont

- **Vérifié** : la fusion, par des tests à deux et à trois membres (changements croisés, retraits, conflits des deux
  côtés, premier échange, annulation d'un changement, miroir non tamponné) ; le scénario entier rejoué dans le navigateur
  avec deux postes séparés qui s'échangent des fichiers. L'appel de partage Drive est vérifié contre un Google simulé.
- **Pas vérifié** : le partage Drive sur un vrai compte (aucune connexion Google n'est possible depuis l'atelier de
  développement) — c'est l'objet de l'essai à deux.
- La maille est **l'artéfact** : deux membres qui changent deux cotes différentes de la même pièce ont un conflit sur la
  pièce. La carte montre ce qui diffère ; on prend l'une des deux versions, puis on refait l'autre changement.
- Pas de temps réel : on se met d'accord quand on échange les miroirs, pas pendant qu'on dessine.
- Un miroir est le projet **entier** : celui à qui vous le donnez a tout. Retirer quelqu'un de l'équipe ne lui reprend
  pas ce qu'il a déjà.
- Les heures viennent de l'horloge de chaque poste ; elles ne servent qu'à départager deux décisions contraires sur un
  même conflit.
