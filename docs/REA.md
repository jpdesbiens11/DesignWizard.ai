# Étudier un comportement — la méthode REA appliquée au projet

Le projet suit les lignes directrices de **REA — Reverse Engineer Anything**, telles que les présente le guide
[reverseengineeringanything.com](https://reverseengineeringanything.com/) (site d'apprentissage indépendant ;
l'outil officiel est [github.com/morluto/rea](https://github.com/morluto/rea)). REA relie un agent de code à des
outils d'inspection de logiciel ; sa méthode tient en trois gestes : **inspecter la cible, tracer un comportement,
construire avec ce que l'on a compris**.

Ce document dit comment ces lignes directrices s'appliquent ici, où l'objectif est un équivalent ouvert des
plateformes de CAO en nuage (le « modèle Linux », voir [VISION.md](VISION.md)).

## 1. Les lignes directrices, et ce qu'elles donnent chez nous

| Ligne directrice de REA | Application dans DesignOrbit.ai |
|---|---|
| Choisir un logiciel que l'on **possède ou que l'on est autorisé à étudier** | Voir la liste des cibles au § 2. Un service en nuage dont les conditions interdisent l'ingénierie inverse n'est pas une cible d'inspection : on étudie ce qu'il publie et ce que l'on y possède. |
| Partir d'**un comportement précis**, pas de « reconstruire toute l'application » | Une fiche de comportement par fonction (§ 3) : « un taraudage M4 débouchant », « deux interfaces identiques s'accouplent », « un profil détouré dans une plaque ». |
| **Garder la trace** de la version de la cible et des preuves | Chaque fiche nomme la cible, sa version ou sa date, et chaque preuve avec sa source. |
| Citer les sources ; **séparer ce qui est confirmé de ce qui est inféré** | Trois états par affirmation : *confirmé* (observé ou testé), *inféré* (déduit d'une documentation), *inconnu*. |
| **Garder les inconnues** au lieu de les combler | La rubrique « Ce que l'on ne sait pas » est obligatoire ; elle ne se vide que par une preuve. |
| Ne pas lancer la cible quand l'inspection statique suffit | Sans objet pour un service en nuage ; pour nos propres fichiers, on lit le fichier, on ne l'exécute pas. |
| Écrire une **spécification de comportement** avant le code : entrées, sorties, transformations, cas limites | C'est le cœur de la fiche ; le code vient après, dans notre dépôt, écrit par nous. |
| **Vérifier sa propre implémentation** contre des exemples parlants | Un test automatique par cas de la fiche ; pour l'interopérabilité, un essai sur un compte ou un fichier qui nous appartient. |
| **Noter où le comportement diffère encore** | Rubrique « Écarts connus », tenue à jour ; un écart n'est pas un échec caché. |
| Retirer chemins privés et contenus de la cible de tout rapport public | Les fiches ne contiennent ni identifiant de compte, ni document privé, ni extrait de code tiers. |

## 2. Ce que l'on étudie, et ce que l'on n'étudie pas

**Cibles autorisées.**

- **Nos propres logiciels et fichiers** : DesignOrbit.ai, DynamiteAgile, les pièces et assemblages que nous avons
  créés — y compris leurs exports (STEP, DXF, PDF) depuis n'importe quel outil.
- **Les logiciels libres**, dans les termes de leur licence : Open CASCADE Technology (LGPL 2.1), three.js (MIT),
  et tout projet dont la licence permet l'étude.
- **Les normes et formats publiés** : ISO 10303 (STEP), la référence DXF, STL, PDF, ISO 273 / 4762 / 286,
  IEC 60664-1.
- **Ce qu'un service publie pour être utilisé** : sa documentation, son API publique, son langage documenté
  (FeatureScript pour Onshape), et le comportement observable par un utilisateur autorisé **sur son propre compte et
  ses propres documents**.

**Hors cible.** Le code client ou serveur d'un service propriétaire : pas de décompilation, pas d'inspection de ses
scripts, pas de contournement de protection, pas d'usage contraire à ses conditions. La ligne directrice est sans
ambiguïté — « un logiciel que vous possédez ou que vous êtes autorisé à étudier » — et nous n'en sommes pas
propriétaires. L'équivalent ouvert se construit à partir du *comportement* que tout utilisateur peut constater et
de ce qui est publié, puis par une implémentation indépendante (salle blanche).

## 3. La fiche de comportement

Une fiche par comportement, dans `docs/comportements/`, d'après le modèle [MODELE.md](comportements/MODELE.md) :

1. **La question** — une phrase.
2. **La cible et sa version** — et pourquoi nous sommes autorisés à l'étudier.
3. **Les preuves** — chacune avec sa source et son état (confirmé, inféré).
4. **La spécification** — entrées, sorties, transformations, cas limites.
5. **Notre implémentation** — fichiers et tests.
6. **Les écarts connus.**
7. **Ce que l'on ne sait pas** — et comment le savoir.

Première fiche : [C-001 — Reconstruire une pièce dans Onshape par FeatureScript](comportements/C-001-featurescript.md).

## 4. L'outil REA lui-même

REA s'installe sur le poste de l'utilisateur (`npx rea-agents@latest setup`, Node.js 22.19 ou plus récent) et
inspecte des applications locales : binaires, applications Electron, bundles JavaScript. Il n'y a rien à lui faire
inspecter dans ce dépôt aujourd'hui : tout le code est le nôtre ou libre, et lisible. Il deviendra utile le jour où
le projet devra lire un format ou piloter un outil **dont nous possédons une copie sous licence** et dont la
documentation ne suffit pas ; la fiche de comportement en gardera alors la trace.
