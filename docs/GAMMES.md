# Les gammes — parler fabrication avec le fournisseur, montage avec le prototypage

Une **gamme** dit comment une chose se fait, étape par étape. DesignWizard.ai en écrit trois, tirées du modèle,
chacune pour un interlocuteur précis :

| Gamme | Où | Pour parler avec | Ce qu'elle porte |
|---|---|---|---|
| **Fabrication** d'une pièce | Pièces → onglet « Gamme » | le fournisseur | phases (débit, posages d'usinage, reprises, ébavurage, traitement sous-traité, contrôle, emballage), prise de pièce, opérations avec outils et contrôles, caractéristiques à tenir tirées des interfaces |
| **Assemblage** d'un produit | Assemblage → onglet « Gamme » | les ingénieurs de prototypage | une étape par pièce, dans l'ordre que donnent les interfaces accouplées ; vis, couples indicatifs, clés, contrôles, visserie totale |
| **Assemblage d'une carte** | PCBA → étape « Fabrication » | l'assembleur de cartes | pâte, pose, refusion, inspection, traversants, nettoyage, programmation et essai, vernis, contrôle final — avec ce que la carte demande (boîtiers à pas fin, zones à épargner) |

Ce sont des **propositions** : la gamme de l'atelier fait foi. Elles servent à ouvrir la discussion avec les bons
mots, et à garder ce qui s'y dit.

## Ce que montre l'écran

- **Les phases**, numérotées de dix en dix (10, 20, 30…), leurs opérations (20.1, 20.2…), l'outillage, le contrôle de
  chaque opération.
- **La vue, étape par étape.** Un clic sur une phase montre la pièce *telle qu'elle est après cette phase* (les
  opérations suivantes sont retirées et la pièce est reconstruite), ou le produit *tel qu'il est à cette étape du
  montage*, la pièce en cours surlignée. Un second clic revient à l'ensemble.
- **L'ordre de montage** se change avec les flèches ; un lien revient à l'ordre tiré des interfaces.
- **Une note par phase** : ce que l'atelier propose, ce qui est convenu.
- **Les points à discuter** : des questions tirées du modèle (brut en stock ? taraudage coupé ou déformé ? posages à
  regrouper ? couples à confirmer ? pochoir, mires, masquage du vernis ?) et les vôtres.
- **Les sorties** : Word et PDF (phases, images de chaque étape, tableau des questions avec une colonne « Réponse »,
  signatures), texte brut pour un courriel, copie dans le presse-papiers. La gamme de fabrication part aussi dans le
  dossier de commande de la pièce ; celle de la carte, dans son dossier de fabrication.

## Ce qui est gardé, et où

La gamme elle-même n'est **pas** enregistrée : elle se recalcule du modèle, donc elle ne peut pas le contredire. Ce
qui est gardé, c'est ce que l'humain y ajoute, sous `plan`, dans l'artéfact :

```dwiz
# dans une pièce
plan
  notes
    "setup:-Z" "Le fournisseur propose un taraudage par déformation."
  point "Demander un essai d'anodisation sur une chute."

# dans un assemblage
plan order=[i1, i5, i3, i2, i4]
  notes i5="Monter le dissipateur en premier : accès par dessous."
  point "Faut-il un gabarit de vissage ?"
```

`notes` range une note par **clé de phase** (`stock`, `setup:<face>`, `rework`, `deburr`, `surface`, `check`, `pack`
pour une pièce ; l'identifiant de la pièce posée ou `final` pour un assemblage ; `prep`, `paste_top`, `place_top`,
`reflow_top`, `inspect`, `tht`, `clean`, `test`, `coat`, `final` pour une carte). `order` fixe l'ordre de montage.

## Aller-retour IA

Le bouton « IA » de la gamme ouvre le dialogue habituel ([IA.md](IA.md)) sur l'artéfact, et joint la gamme calculée
**pour référence**, avec les clés de ses phases. On peut donc demander, comme à un technicien : « ajoute une note à
chaque phase d'usinage sur le bridage », « propose trois points à voir avec l'anodiseur », « monte le dissipateur
avant les cartes ». La réponse revient, l'écran liste les changements, l'humain valide.

## Limites, dites franchement

- Les **couples de serrage** sont des valeurs usuelles (vis de classe 8.8, abaissées pour les cartes, les inserts et
  les filets dans l'alliage léger) : à confirmer par un essai de serrage.
- Les **postes** et les **prises de pièce** sont génériques ; la gamme ne connaît pas le parc de machines de votre
  fournisseur.
- L'état de la pièce après une phase vient de l'arbre de construction : une forme faite en plusieurs phases chez
  l'atelier apparaît dans la phase de son opération.
- Ces gammes n'ont pas encore été relues par un atelier ni par un assembleur.

## Dans le code

| Fichier | Rôle |
|---|---|
| `web/js/core/plan_doc.js` | la forme commune d'une gamme ; `finishPlan`, `planText`, `planDoc`, `planSummary`, `planKeys` |
| `web/js/cad/process_plan.js` | `processPlan(spec, built)` : gamme de fabrication ; `stateSpec` : la pièce après une phase |
| `web/js/core/asm_plan.js` | `assemblyOrder`, `assemblyPlan(asm, project)` : gamme d'assemblage |
| `web/js/pcba/assembly_plan.js` | `boardAssemblyPlan(board, lib)` : gamme d'assemblage d'une carte |
| `web/js/modules/plan_view.js` | l'écran commun : phases, notes, points, sorties, bouton IA |
| `web/js/modules/part_gamme.js`, `asm_gamme.js`, `pcba_out.js` | les trois onglets |
| `tests/node/plans.test.mjs` | les trois gammes, leurs textes et leurs documents |
