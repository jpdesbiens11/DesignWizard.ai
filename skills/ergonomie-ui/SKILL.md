---
name: ergonomie-ui
description: Méthode pour construire ou faire évoluer l'interface d'une application avec un agent IA sans redécouvrir l'ergonomie une demande à la fois — contrat de travail humain–agent, interface honnête (valeur inventée = exemple à confirmer, guide en direct, sources avec leur niveau de vérification), mécanismes uniques dont chaque écran hérite (repli, volet qui reste en place, zoom, pivot visible, On / Off, progression annulable), aller-retour IA avec aperçu et validation. À utiliser dès qu'il s'agit de créer, modifier, relire ou critiquer un écran, un volet, un formulaire, une liste, une vue 2D ou 3D, une opération longue, un import ou un export, ou de démarrer une application outillée (ingénierie, données, configuration) — même si le mot « ergonomie » n'est pas prononcé, et aussi quand ce fichier est simplement joint à une conversation. Also use for UI ergonomics, UX and usability reviews, and when building app screens with an AI agent.
license: MIT
---

# Ergonomie d'interface, construite avec un agent

Ces règles viennent d'une application réelle — DynamiteOrbit.ai, une plateforme de conception mécatronique écrite à
la main avec un agent, sous licence MIT. Elles ont été trouvées une demande à la fois, puis écrites pour que le
prochain écran naisse avec. Ce n'est ni une bibliothèque de composants ni un système de design : c'est **une façon
de travailler** et **un catalogue de règles**, chacune avec sa raison.

Deux idées tiennent le reste :

1. **L'attention de la personne est la ressource rare.** Tout ce que l'agent peut faire seul, il le fait ; ce qu'il
   demande, il le demande en un clic ; ce qu'il annonce est vrai.
2. **Une règle d'ergonomie vit à un seul endroit.** Un mécanisme installé une fois, dont chaque écran hérite sans
   rien déclarer — sinon l'écran suivant l'oublie.

## D'abord : où es-tu ?

Regarde la situation avant d'appliquer quoi que ce soit, parce que la bonne réponse n'est pas la même.

- **Dans un projet qui a ses propres consignes** (fichier d'instructions, conventions, système de design) : elles
  priment. Sers-toi de ce document comme d'une liste de contrôle, et **propose** ce qui manque au lieu de l'imposer.
- **Au démarrage d'un projet** : propose d'adopter les quatre parties ci-dessous, demande lesquelles (par un choix à
  cliquer si l'outil existe), puis **écris les règles retenues dans le fichier d'instructions du projet** : c'est là
  qu'elles tiendront d'une séance à l'autre.
- **Ce fichier est joint à une conversation, sans code** : ne le récite pas. Dis en quelques lignes ce qu'il apporte,
  demande ce que la personne veut en faire — relire un écran, démarrer une application, adopter la façon de
  travailler —, puis fais-le.

Dans les trois cas : réponds dans la langue de la personne, et ne déroule que la partie utile à sa demande.

## La mesure

Ces règles sont un répertoire, pas un cahier des charges. Un écran « simple » livré avec douze mécanismes n'est pas
simple : il est long à relire, et personne ne l'a demandé.

- **Prends ce que la demande appelle.** Pour un petit écran, c'est presque toujours : la valeur d'exemple à
  confirmer, le guide qui dit ce qui manque, Entrée / Tab / Échap, et l'annulation.
- **Propose le reste en une ligne** au lieu de le construire (« je n'ai pas fait le repli des groupes ni le On / Off
  des lignes : à ajouter si l'écran grandit »).
- **Un mécanisme commun se construit quand un deuxième écran en a besoin**, pas avant.
- La taille de ce que tu livres doit ressembler à la taille de ce qui a été demandé. Si tu dois la dépasser, dis-le
  avant, pas après.

## Les quatre parties

### A. Le contrat de travail avec l'agent

Ce qui change le plus la collaboration, et ce qui se transpose à n'importe quel projet.

- Fais les routines toi-même, sans demander : tester, enregistrer, publier, vérifier que c'est en ligne. Ne donne
  une étape manuelle que si aucun outil ne peut la faire — et dis laquelle, en une ligne.
- Toute question passe par un menu à cliquer (deux à quatre choix, le conseillé en premier), jamais noyée dans le
  texte. Pas de question pour ce qui a une réponse évidente : choisis, dis-le, continue.
- Dis ce qui est vérifié et ce qui ne l'est pas. N'annonce jamais comme fait ce qui n'a pas tourné.
- Essaie dans un vrai navigateur avant de livrer un écran, et dis sur quoi tu as essayé.
- Avant d'écrire une interaction, nomme l'usage établi qu'elle suit. N'invente que là où il n'y en a pas, et dis-le.

Le détail, avec les raisons et le gabarit du compte rendu : [references/contrat.md](references/contrat.md).

### B. Une interface honnête

L'écran distingue ce que la machine a supposé de ce que la personne a décidé, et ne se donne pas plus de certitude
qu'il n'en a.

- **Une valeur que l'outil invente est un exemple** : son champ clignote jusqu'à ce qu'elle soit tapée ou confirmée,
  et l'action attend.
- **Un guide en direct** sur chaque écran : ce qui manque ou cloche, sur quatre niveaux, un clic mène à l'endroit.
- **Un registre des sources** : chaque méthode, convention ou norme, avec son niveau de vérification vrai (lu,
  testé, extrait, à vérifier, usage, choix maison, non lu).
- **Une estimation avant le calcul**, puis un recoupement avec son verdict ; chaque résultat se souvient du cas qui
  l'a produit.

Le détail : [references/honnetete.md](references/honnetete.md).

### C. Des mécanismes dont tout écran hérite

Replier un groupe, garder un volet où il était, zoomer, voir le pivot d'une rotation, mettre une entrée à Off,
annuler une opération longue : chacun est écrit une fois, et un nouvel écran en hérite par sa seule structure.

Le catalogue — pour chaque règle : ce que voit l'utilisateur, si c'est un usage établi ou un choix maison, le
mécanisme, et ce qu'un nouvel écran doit faire — : [references/mecanismes.md](references/mecanismes.md).

### D. L'aller-retour IA

Chaque artéfact s'exporte sous une forme qu'une IA comprend, avec une consigne courte, et se réimporte avec un
aperçu des changements, la validation de la personne, et une seule étape annulable.

**Ne suppose pas que le projet l'a.** S'il ne l'a pas, recommande-le — fortement, avec sa raison et sa plus petite
version —, et laisse la personne décider. Le détail : [references/aller-retour-ia.md](references/aller-retour-ia.md).

## Avant de livrer un écran

Une passe courte, dans cet ordre. Elle attrape presque tout ce qui revient plus tard en demande. Chaque point se
règle de deux façons : c'est fait, ou c'est dit (« pas fait, parce que… ») — à la mesure de l'écran.

1. **L'usage** : quel usage établi suit chaque geste ? Lequel est un choix maison, et est-ce dit ?
2. **Les valeurs** : y a-t-il une valeur que l'outil a inventée et que rien ne signale ?
3. **Le guide** : l'écran dit-il ce qui manque, et l'action attend-elle ce qui bloque ?
4. **Les listes** : groupées par nature, une couleur par groupe, un pictogramme et un titre court par élément ?
5. **Les volets** : chaque groupe a un titre, donc se replie ; le volet reste en place quand une valeur change ; ce
   que l'on fait est en haut, à portée.
6. **Ce qui dure** : montre-t-il où il en est, depuis combien de temps, et s'annule-t-il vraiment ?
7. **Les entrées** : chacune peut-elle être mise de côté sans être perdue, et copiée pour comparer ?
8. **Le retour en arrière** : chaque changement est-il une étape annulable, avec son nom ?
9. **Le clavier** : Entrée, Tab, Échap font-ils ce qu'on attend ? Le curseur reste-t-il où il était ?
10. **L'essai** : passé dans un vrai navigateur ? Sur quoi ? Qu'est-ce qui n'a pas été essayé ?

## Écrire une règle qui dure

Une règle trouvée en cours de route se perd si elle reste dans la conversation. Écris-la dans le fichier
d'instructions du projet, sous cette forme — c'est ce qui fait qu'un agent la tient à la séance suivante :

```
- **Nom de la règle** (demande de <qui>) : ce que l'utilisateur voit, en une phrase. Le mécanisme unique qui la
  porte (`chemin/du/module`). Ce qu'un nouvel écran doit faire pour en hériter — idéalement rien. Voir `doc`.
```

Les trois éléments qui comptent : **la demande d'origine** (on sait pourquoi la règle existe), **le mécanisme
unique** (on sait où la changer), **l'héritage** (« toute nouvelle brique naît avec »).

## Ce qui est de l'usage, ce qui est un choix

Par honnêteté envers qui reprend ces règles : la plupart des gestes du catalogue sont des **usages établis**
(replier, zoomer, pivot visible, On / Off et variantes, progression annulable). Ils ne sont pas nouveaux ; ils sont
réunis, et tenus par un mécanisme. Ce qui est moins courant : la valeur d'exemple à confirmer, le registre des
sources avec son niveau de vérification, l'aller-retour IA par artéfact, l'estimation avant le calcul, et la façon
d'écrire les règles pour qu'un agent les tienne. Chaque fiche du catalogue dit de quel côté elle est.

Ces règles ont été éprouvées sur une application de bureau, à la souris et au clavier, dans Chromium. Elles n'ont
pas été essayées au toucher, ni sur Firefox et Safari : adapte, et dis ce que tu as essayé.
