# Itérations MVP et revues de passage

Un produit ne converge pas en deux revues. Il converge par **itérations** : chaque MVP montre quelque chose de plus,
vise un niveau de maturité, et passe **sa** revue avant que le suivant ne s'ouvre. L'écran « Itérations MVP » (onglet
Revue → Itérations MVP, ou menu Projet) tient ce fil dans le projet lui-même.

## Le cycle d'une itération

| État | Ce qui s'y passe |
|---|---|
| **Ouverte** | on conçoit. L'itération dit ce qu'elle doit montrer, le **niveau visé** (TRL 1 à 9) et sa **revue de passage** : revue d'itération, de concept, préliminaire (PDR), détaillée (CDR), d'aptitude aux essais, de qualification |
| **Gelée** | un instantané est pris : la signature de chaque artéfact, les cotes de chaque pièce, les fonctions, les interfaces et leurs appariements. La revue porte sur cet état ; l'itération suivante s'y comparera |
| **Revue consignée** | au moins une revue, avec sa décision et ses actions |
| **Close** | une décision : *accepté*, *accepté avec réserves*, *à refaire* |

**Le MVP suivant ne s'ouvre que lorsque le précédent est clos.** Tant qu'il est ouvert, gelé sans revue, ou revu sans
décision, le bouton reste fermé et dit pourquoi. Une itération « à refaire » n'atteint aucun niveau : la suivante vise le
même. Tant qu'aucune revue n'est consignée, une itération gelée peut être dégelée.

Il n'y a **pas de nombre fixe d'itérations** : la revue préliminaire et la revue détaillée sont deux passages parmi
d'autres. On itère autant qu'il le faut pour atteindre le niveau que le projet vise (sa cible, TRL 6 par défaut).

## Deux façons de passer en revue

**Un dossier détaillé confié à une IA.** « Copier le dossier de revue » produit un texte complet, plus fouillé qu'une
présentation : le design entier en `.dwiz`, les **faits calculés par la plateforme** (nombre de pièces, de joints,
interfaces appariées ou seules, état de la revue des artéfacts, ce qui a bougé depuis l'itération précédente), les
**questions du niveau visé**, sept axes à couvrir dans l'ordre (fonctions, formes et dimensions, interfaces, fabrication,
assemblage, isolement et thermique, ce qui reste à prouver par l'essai) et la forme de la réponse :

```revue
constat | DRV-HEATSINK | majeur | ailettes de 1,2 mm pour 28 mm de haut | épaissir à 1,6 mm
constat | projet | remarque | pas de plan d'essai thermique |
decision | accepté avec réserves | une pièce à reprendre
```

« Coller la réponse de l'IA » en montre l'aperçu — constats, gravités, décision proposée. En la consignant, **une seule
étape annulable** fait trois choses : la revue est inscrite sur l'itération, chaque constat bloquant ou majeur devient une
action, et les artéfacts qu'ils nomment passent « À réviser » avec leur note, prêts pour la révision pièce par pièce
([IA.md](IA.md)). L'IA ne réécrit rien et ne fournit aucun résultat d'analyse : elle constate, l'ingénieur valide.

**Une revue devant les collègues.** « Ordre du jour » copie un texte court à lire à voix haute : ce que l'itération
contient, ce que la revue doit trancher, les notes déjà écrites. « Consigner une revue » garde qui était là (des rôles,
pas de noms), la décision, le compte rendu et les actions, une par ligne.

Les deux se cumulent sur une même itération. Les actions se cochent à mesure qu'elles se ferment.

## La convergence, mesurée

Entre deux itérations gelées, quatre axes :

| Axe | Ce qui est compté |
|---|---|
| **Formes** | artéfacts ajoutés, retirés, modifiés (pièces, assemblages, cartes, analyses), par leur signature |
| **Dimensions** | cotes des pièces présentes dans les deux itérations : combien ont changé, et de combien en moyenne |
| **Fonctions** | fonctions des pièces et des cartes ajoutées, retirées, reformulées |
| **Interfaces** | clés d'interface ajoutées, retirées, ou dont le type ou les paramètres partagés ont changé |

La **part qui a bougé** de chaque axe va de 0 % (rien) à 100 %. Leur moyenne donne la tendance : *stable* sous 5 %,
*converge* quand elle baisse d'une itération à l'autre, *diverge* quand elle monte, *plateau* sinon.

## Avant de clore

Deux conditions sont obligatoires — l'itération est gelée, une revue au moins est consignée. Les autres sont affichées
et versées au dossier : tous les artéfacts revus, aucune demande de révision ouverte, aucun brouillon d'IA non relu,
chaque interface interne a sa jumelle, les actions de revue sont closes, le design ne diverge pas.

## Dans le fichier du projet

```
mvp target=6
  iteration 1 "MVP 1" goal="Le module se monte" trl=3 gate=iteration opened=… frozen=… closed=… decision=conditional
    reviews=[{id: R1, kind: ai, decision: conditional, actions: [{text: …, done: false}]}]
    snapshot={arts: {…}, params: {…}, functions: {…}, interfaces: {…}, metrics: {…}}
```

Le registre voyage avec le projet (`.dwiz`, Drive). Il ne part pas dans un aller-retour IA de conception, et une
itération complète rapportée par une IA ne le touche pas. Le rapport de revue liste les itérations, leurs revues, leur
convergence et leur décision.

## Limites

- Les niveaux de maturité suivent l'échelle usuelle (ISO 16290) ; les questions par niveau sont un point de départ, à
  adapter au référentiel de l'entreprise.
- Le dossier IA porte les faits que la plateforme calcule sans noyau géométrique ; la santé des accouplements, le DFx et
  l'isolement se lisent dans leurs écrans et dans le rapport, qui peut être joint.
- Une revue IA n'a encore jamais été menée avec un vrai assistant sur un vrai projet : seul le format est éprouvé.
- Pas de signature électronique ni de droits par personne : la décision engage celui qui la consigne.
