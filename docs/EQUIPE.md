# Travailler à plusieurs, en miroir

Un projet commun **sans copie centrale**. Chaque membre garde le projet entier chez lui — sur son poste ou dans son
propre Google Drive — : c'est son **miroir**. Il le donne à lire aux autres, et lit le leur. Aucun serveur ne tient
« la » version : il y a autant de copies complètes que de membres, et chacune est aussi une sauvegarde des autres.

L'écran est sous **Revue → Équipe** (ou menu Projet → « Équipe et messages… »).

## Démarrer

Par Google Drive (chacun connecté à **son** compte) :

| Qui | Fait quoi |
|---|---|
| Celui qui a le projet | **Équipe → « Partager ce projet »**, choisit son nom d'équipe (`jp`), puis **« Partager mon miroir dans Drive… »** avec l'adresse Google de la personne invitée |
| La personne invitée | menu Projet → **« Rejoindre un projet partagé (Drive)… »** : le sélecteur de Google lui montre le fichier qu'on lui a partagé ; elle le désigne et choisit son nom d'équipe (`ami`). Elle a maintenant **son** projet, dans **son** Drive |
| La personne invitée | **« Partager mon miroir dans Drive… »** avec l'adresse du premier membre |
| Le premier membre | **« Lire un miroir dans Drive… »** : il désigne **une fois** le fichier qu'elle lui a partagé, voit l'aperçu, fusionne. Elle est dans l'équipe |

Ensuite, des deux côtés, un seul bouton : **« Synchroniser »**. L'ordre n'a pas d'importance, et l'on peut être deux,
trois ou dix.

Sans Drive, la même chose se fait par fichier : « Télécharger mon miroir », « Rejoindre un projet partagé (fichier)… »,
« Fusionner un fichier… ».

## Fusionner un miroir

« Synchroniser » (ou « Fusionner un fichier… ») lit le miroir des autres, **montre ce qui va arriver**, et n'applique
rien avant que vous ayez dit oui. La fusion est une seule étape, annulable (`Ctrl + Z`).

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
- un message peut être **épinglé sur le 3D** : clic droit sur une face, dans le studio de pièce ou dans l'assemblage,
  puis « Épingler un message ici… ». Il reste attaché à ce point de la pièce — dans un assemblage, à ce point de cette
  pièce-là, qu'il suit quand l'assemblage bouge. Il se voit dans la vue comme un **repère numéroté** ; un clic ouvre sa
  carte : le message, ses réponses, une réponse à écrire, la case « fait » (le repère pâlit). C'est un message du fil
  de son artéfact comme les autres, marqué « épinglé sur le 3D » avec le lien vers la vue ;
- dans la **Revue**, chaque artéfact d'un projet partagé porte une pastille `@ n` : ses messages ouverts, et le lien
  vers son fil ;
- le **rapport** a une section « Équipe et messages » : les membres, la date de lecture de leur miroir, les messages
  encore ouverts, les conflits en attente.

## Par Google Drive

Chaque membre se connecte à **son** compte Google : son projet est enregistré dans **son** Drive (dossier
« DynamiteOrbit.ai »), comme toujours. Personne n'écrit dans le Drive d'un autre.

| Bouton | Ce qu'il fait |
|---|---|
| **Partager mon miroir dans Drive…** | enregistre le projet dans votre Drive et donne à une adresse le droit de **lire** ce fichier. Google lui envoie le lien. L'adresse va à Google seulement ; elle n'est gardée ni dans le projet ni dans le miroir |
| **Lire un miroir dans Drive…** | ouvre le sélecteur de fichiers de Google sur ce que l'on vous a partagé. Vous désignez le miroir d'un membre : il est lu, montré, fusionné — et **lié** : l'application sait désormais où il est |
| **Synchroniser** | enregistre votre miroir dans votre Drive, **relit tous les miroirs liés**, montre ce que chacun apporte, fusionne en une étape, puis enregistre le résultat. S'il n'y a rien de nouveau, il le dit et ne touche à rien |

En ouvrant l'écran Équipe, l'application **regarde seule** les miroirs liés, sans rien changer : la colonne « Dans
Drive » dit pour chaque membre *à jour*, *du nouveau*, *conflit à trancher*, ou *à désigner*.

### Pourquoi désigner une fois

L'application ne demande à Google que la permission `drive.file` : elle ne voit **que les fichiers qu'elle a créés pour
ce compte, et ceux que la personne lui ouvre un par un**. Le fichier qu'un autre membre vous a partagé est visible de
vous, pas encore de l'application. Le **sélecteur de fichiers de Google** est la façon prévue par Google de le lui
ouvrir : vous le désignez une fois, et l'application peut ensuite le relire seule, à chaque synchronisation. Elle ne
voit toujours rien d'autre de votre Drive.

Si un membre apparaît « à désigner », c'est que ce compte n'a pas encore ouvert son fichier à l'application : bouton
« Désigner… », le sélecteur s'ouvre sur ce fichier précis. Si la liste est vide, c'est que le membre ne vous a pas
encore partagé son miroir.

Le sélecteur est chargé depuis Google **au premier usage seulement** (`https://apis.google.com`, puis sa fenêtre servie
par `https://docs.google.com`) : c'est, avec le service de connexion, la seule ressource externe de l'application. Ce
que cela demande côté projet Google est dans [GOOGLE.md](GOOGLE.md), section 6.

## Ce qui est écrit dans le projet

```
team id=t-… owner=jp
  member handle=jp since=… hash=…          hash : empreinte du compte, salée avec l'équipe — jamais l'adresse
  member handle=ami since=… mirror=…       mirror : l'identifiant du fichier dans le Drive du membre, s'il l'a partagé
  stamps  "part:DRV-BASE" at=… by=ami sig=… was=[…]
  conflicts …                              le document de l'autre, entier, tant que personne n'a tranché
talk
  message id=… by=ami on="part:DRV-COVER" text="@jp …" mentions=[jp] done …
  message id=… by=jp on="assembly:DRV-ASM" text="…" pin={at: [32.64, 0, 41.3], inst: i1}      épinglé : un point de la pièce, et son instance
  message id=… by=ami on="part:DRV-COVER" text="…" re=…                                       une réponse à un message
```

Le module est pur (`web/js/core/team.js`) : `joinTeam`, `forkMirror`, `stampLocal`, `mergeMirror`, `resolveConflict`,
`post`, `setDone`, `inbox`, `threads`, `pinsOf`, `teamRows`. La lecture des miroirs liés est dans `web/js/core/team_sync.js`
(`readMirrors`, `applyMirrors`, `linkMirror`, `parseMirror` : le lecteur est injecté, rien n'y connaît Google) ; le
sélecteur dans `web/js/google/picker.js`. L'écran est `web/js/modules/team.js` (`#/team`, et `#/team/<artéfact>` pour un fil) ;
les repères de la vue 3D sont dans `web/js/modules/view_pins.js`.

Un projet partagé **confié à une IA** part sans l'équipe ni les messages : l'aller-retour IA travaille sur la conception,
et le retour est fusionné chez celui qui l'a demandé, puis part dans son miroir.

## Un essai à deux

1. **Accès** : la personne doit pouvoir se connecter à la démo — son compte dans les utilisateurs test du projet Google
   et son empreinte dans `web/acces.json` (voir [GOOGLE.md](GOOGLE.md), sections 1 et 4) ; l'API « Google Picker » doit
   être activée dans le projet Google (section 6).
2. Vous : chargez un projet, **Équipe → Partager ce projet**, puis « Partager mon miroir dans Drive… » avec son adresse.
3. Elle : **Rejoindre un projet partagé (Drive)…**, désigne votre fichier, change une pièce, vous écrit `@vous …` sur
   cette pièce, puis « Partager mon miroir dans Drive… » avec votre adresse.
4. Vous : changez une autre pièce — et la même, pour voir un conflit —, puis **« Lire un miroir dans Drive… »** : l'aperçu
   doit dire une pièce reprise, une gardée, une en conflit, un message pour vous.
5. Tranchez, cochez « fait ». Chez elle, **« Synchroniser »** : tout arrive sans conflit, sans fichier et sans sélecteur,
   et les deux projets disent la même chose. À partir de là, « Synchroniser » suffit des deux côtés.

Si le sélecteur affiche une erreur de clé d'API, ou reste vide alors qu'un fichier vous a été partagé : notez le message,
c'est le point que seul un essai sur de vrais comptes peut confirmer (voir les limites). L'échange par fichier marche
dans tous les cas.

### Répéter l'essai sans Google

Avant un essai sur de vrais comptes, deux scénarios rejouent tout le parcours sur un poste, avec deux navigateurs et un
second membre simulé :

```bash
python3 designwizard.py --port 8130 --no-browser --data /tmp/essai
node tools/team_rehearsal.mjs http://127.0.0.1:8130 /tmp/essai_out          # par fichier
node tools/team_drive_rehearsal.mjs http://127.0.0.1:8130 /tmp/essai_out    # par Drive, Google simulé
```

Le premier échange les miroirs par fichier : partage, arrivée du second membre, deux pièces changées et un message, un
conflit, la fusion, le conflit tranché, le retour — à la fin les deux projets disent la même chose. Le second remplace
Google par un simulateur qui applique la règle `drive.file` (une application ne lit un fichier que si elle l'a créé pour
ce compte, ou si la personne l'a désigné) : six étapes, jusqu'au droit de lecture perdu puis désigné de nouveau.

Rejoués sur la version 0.37.2 : les deux passent, sans erreur. Ce qu'ils **ne montrent pas** : le vrai sélecteur de
Google, la clé d'API, l'écran de consentement — seul l'essai à deux comptes réels le confirmera.

Le **guide** de la barre du haut dit sur tous les écrans qu'un conflit attend d'être tranché ou qu'un message vous est
adressé ; un clic y mène.

## Limites, dites comme elles sont

- **Vérifié** : la fusion, par des tests à deux et à trois membres (changements croisés, retraits, conflits des deux
  côtés, premier échange, annulation d'un changement, miroir non tamponné) ; la lecture des miroirs liés et le sélecteur,
  contre des doubles ; le scénario entier rejoué dans le navigateur avec deux comptes séparés, d'abord par fichiers, puis
  par Drive contre un **Google simulé qui applique la règle `drive.file`** (rejoindre, désigner une fois, synchroniser
  ensuite sans fichier ni sélecteur, cas « à désigner »). La bibliothèque du sélecteur de Google, la vraie, se charge et
  ouvre sa fenêtre sous la politique de sécurité de la page, sans violation.
- **Pas vérifié** : tout ce qui demande un vrai compte Google — le partage, le sélecteur une fois connecté (ce qu'il
  liste, s'il exige une clé d'API), la relecture d'un fichier désigné. Aucune connexion Google n'est possible depuis
  l'atelier de développement : c'est l'objet de l'essai à deux.
- La maille est **l'artéfact** : deux membres qui changent deux cotes différentes de la même pièce ont un conflit sur la
  pièce. La carte montre ce qui diffère ; on prend l'une des deux versions, puis on refait l'autre changement.
- Pas de temps réel : on se met d'accord quand on synchronise, pas pendant qu'on dessine.
- Un message épinglé garde les **coordonnées** de son point : si la pièce change de forme à cet endroit, le repère reste
  où il était. Dans la vue éclatée, les repères ne suivent pas les pièces. Les autres vues 3D (Isolation, Simulation,
  Atelier) ne montrent pas les repères.
- Un miroir est le projet **entier** : celui à qui vous le partagez a tout. Retirer quelqu'un de l'équipe ne lui reprend
  pas ce qu'il a déjà ; lui retirer la lecture se fait dans Drive (Partager → retirer l'accès).
- Chaque membre partage son miroir avec **chaque** autre membre : à trois, deux adresses chacun.
- Les heures viennent de l'horloge de chaque poste ; elles ne servent qu'à départager deux décisions contraires sur un
  même conflit.
