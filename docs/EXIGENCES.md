# Les exigences du produit, dans les trois branches

> Demande de JP, 25 novembre 2026 : « une page Exigences 1. dans Mécanique et Électronique… concevoir l'IA à partir des requis de
> DynamiteAgile, au format de DynamiteAgile ». 27 novembre : « une section requis à chacune des branches : mécanique, hardware puis
> logiciel… la même base des trois métiers, qui vient directement de la structure de DynamiteAgile… je vais loader en mode brouillon au
> début ; après, des itérations, on les envoie dans DynamiteAgile ; une fois terminés, on les exporte, on les ramène pour vraiment faire la
> structure du produit… commence avec une base qui ressemble au produit : ESS ».

## Une seule liste, trois pages

Le projet garde **une** liste d'exigences (`project.reqs`, `web/js/core/reqs.js`). Trois pages la montrent, chacune en tête de son groupe
de la barre du haut :

| Branche | Page | Ce qu'elle montre |
|---|---|---|
| Mécanique | `#/mreq` | les exigences allouées à la mécanique (M) |
| Électronique | `#/ereq` | celles de l'électronique (E) |
| Logiciel | `#/lreq` | celles du logiciel (L) — puis l'étape 1 du V, « Exigences du logiciel » (`#/swreq`) |

Une exigence peut être allouée à une, deux ou trois branches. Ce qui change sur une page change sur les deux autres : c'est la même liste.

## Le format : celui de DynamiteAgile

La liste se lit de l'export de Goldmine (« Exporter (.csv) ») **tel quel** : ses 28 colonnes, dans leur ordre (`AGILE_COLUMNS`). Elle
repart vers DynamiteAgile avec les mêmes colonnes ; l'outil ne remplit que « allocation » (`toAgileCsv`).

Une ligne sans `key` est **créée** par l'import de Goldmine, qui lui donne sa clé (ESS-1, ESS-2…) ; à la relecture, l'outil la retrouve par
son `external_id`. Goldmine exige qu'une exigence nomme un essai de la Test Base du Space (`test_ref`) : la base d'essai de l'ESS nomme
ceux de la Test Base dont chaque Space part (TST-FUN-01, TST-SW-01…).

## Brouillon, itérations, version finale

La maturité d'une ligne est son statut dans le « Requirement Workflow » de Goldmine (`maturityOf`) :

| Statut | Ici |
|---|---|
| Received, In Analysis, Customer Clarification (ou aucun statut) | **brouillon** |
| Accepted, Allocated, Implemented, In Verification, Verified | **acceptée** |
| Rejected, Obsolete | **écartée** — elle ne compte pour aucune branche |

La liste est un **brouillon** tant qu'une ligne en vigueur l'est (`stageOf`). En tête de chaque page, les trois temps :

1. **Brouillon ici** — la liste se lit, chaque métier y voit les siennes ; « Ébauche avec l'IA » donne une consigne qui l'*éprouve* (ce qui
   manque, ce qui se contredit, une valeur pour chaque TBD), sans fixer la structure du produit.
2. **Itérations dans DynamiteAgile** — « Vers DynamiteAgile (.csv) », puis Goldmine → Importer ; revue avec le client jusqu'à « Accepted ».
3. **Version finale** — exportée de Goldmine, relue ici : « Concevoir avec l'IA » conçoit la branche à partir de ses exigences.

Une valeur que personne n'a fixée s'écrit **TBD** (ou TBC) : la carte le montre, le guide la demande.

## Relire l'export de DynamiteAgile

« Relire l'export de DynamiteAgile… » ne remplace rien d'office : l'aperçu (`mergePlan`, `modules/reqs_merge_ui.js`) dit les lignes
ajoutées, modifiées colonne par colonne, retirées, et les clés données par DynamiteAgile ; « Appliquer » est une seule étape annulable
(`mergeReqs`). Une allocation confirmée ici est gardée quand le fichier n'en dit pas. L'heure, le tampon et `test_source` (écrit par
Goldmine) ne sont pas des changements. Chaque lecture s'inscrit dans « Les lectures de la liste » (`loads`).

## Du produit au logiciel

Dans `#/lreq`, « Vers les exigences du logiciel (V) » fait passer les exigences du produit allouées au logiciel à l'étape 1 du V, sous
leurs clés (la même lecture que l'import de DynamiteAgile du Logiciel, `agileReqs`) : l'aperçu des blocs, puis « Poser les blocs ». Le même
geste existe dans l'étape 1 du V : « Depuis le produit (n) ». « Concevoir avec l'IA » y donne la consigne au format du Logiciel
(`dynamiteorbit/sw-requirements@1`) ; « Coller la réponse… » la relit.

## La base d'essai : un ESS

`web/js/demo/demo_ess_reqs.js` (la source) → `web/examples/exemple_exigences_ess.csv` (`node tools/ess_reqs_csv.mjs`, tenu égal par un
essai). 10 besoins et 52 exigences d'un ESS à battery modules 8s8p échangeables, calqué sur le projet BM 8s8p - 21700 : 64 cells Molicel
P45B, cell electronics sur chaque CORE en chaîne RS-485 isolée, BMS central, contactor, connecteur d'échange, poignée quart de tour.

- **En brouillon** : statut Received (In Analysis pour cinq lignes), chaque besoin une hypothèse (« Assumption »), révision 0.1.
- **Ses chiffres** viennent de la fiche de la cell (INR21700P45B-01 ver. 0.2, lue : 45 A et 9 A, 4,20 V et 2,5 V, 4,5 Ah, températures de
  surface) et du logiciel du BMS central (seuils d'exemple). Ce que personne n'a décidé est écrit TBD.
- **Les normes nommées n'ont pas été lues** (RTCA DO-160, DO-311A, DO-178C, UN 38.3, UL 94) : chaque ligne le dit dans son « Pourquoi ».
- Une ligne relève déjà un écart que le logiciel devra suivre : ESS-REQ-015 sépare la surchauffe en charge (65 °C, sous les 70 °C de surface
  de la fiche) et en décharge (75 °C), là où le logiciel du BMS central n'a qu'un seuil.

**Vérifié** (27 novembre 2026) : le fichier importé dans un DynamiteAgile local (Space neuf, Goldmine actif, Test Base de 34 essais) —
62 lignes créées, aucune refusée, aucun trou de trace (besoin inconnu, essai manquant) ; l'export rendu (clés ESS-1 à ESS-62) se relit ici
sans doublon. Non vérifié : l'import sur la démo en ligne de DynamiteAgile, une revue réelle avec un client.

Le projet BM 8s8p - 21700 de l'accueil s'ouvre avec cette liste chargée ; elle fait partie de la définition du produit, donc de chaque point
de son historique.

## Lue par la machine : ce que le banc doit montrer (v0.205.0)

> JP, 27 novembre 2026, par menu : « Requis lisibles + pointillés » ; « des missions tirées des requis » ; le cycle en V gardé au niveau
> Expert, rempli automatiquement.

Une exigence prouvée par **essai** (lettre T) qui parle d'une grandeur que le banc relève devient un **oracle** (`web/js/core/req_oracle.js`) :

| Genre | Ce qu'il dit | Exemple (ESS) |
|---|---|---|
| **bound** | la grandeur reste entre deux bornes tant que le contactor est fermé | ESS-REQ-002 : V bloc ≥ 2,80 V et ≤ 4,20 V |
| **envelope** | ce que les missions doivent atteindre — l'enveloppe à couvrir | ESS-REQ-003 : jusqu'à 360 A en décharge |
| **reaction** | la condition tient `hold`, la réponse vient avant `within` | ESS-REQ-013 : V bloc max > 4,25 V · 100 ms ⇒ contactor ouvert ≤ 150 ms |

L'outil **lit les tournures courantes** de l'énoncé (« dépasse… pendant plus de… », « , ou 65 °C en charge », « en N ms au plus », le critère
d'acceptation « en moins de 3 s » ou « entre 100 et 150 ms ») et **propose** ; une personne **confirme**, ou corrige les nombres, dans la marge
de droite (« Lue par la machine ») — une étape annulable. Ce qu'il ne sait pas lire est dit : prouvée autrement que par essai, valeur TBD,
ou aucune grandeur que le banc relève (la chaîne muette, le contact auxiliaire : à écrire quand le banc les enregistrera). Une lecture
confirmée suit son exigence quand DynamiteAgile lui donne sa clé ; si l'énoncé change, elle est proposée de nouveau.

**Sur la vue Mission** (Logiciel › Essayer), chaque limite d'une exigence est un **pointillé tagué de sa clé**, coloré par son verdict sur le
profil joué — vert tenue, rouge échoue, gris non exercée, ambre enveloppe non couverte ; trait fin : lecture à confirmer. Les seuils du
logiciel restent en jaune et rouge. Dessous, **le constat des exigences** de ce profil.

**Le verdict** se lit sur l'enregistrement du banc, **une ligne par seconde** : un dépassement de moins d'une seconde n'est pas jugé, et une
réponse est attendue au plus une ligne après son délai — le constat le dit. Le jugement suit l'exigence, pas le logiciel : c'est l'idée des
essais fondés sur les exigences (les normes elles-mêmes n'ont pas été lues).

**Premier constat sur l'ESS** (profils Charge et Décharge du BMS central, joués sans écran) :

- **ESS-REQ-015** (65 °C en charge) **échoue** : le logiciel n'a qu'un seuil, 75 °C.
- **ESS-REQ-002** (≤ 4,20 V en service) **échoue** en charge : le logiciel laisse monter à 4,25 V avant d'ouvrir — l'exigence 002 et
  l'exigence 013 (ouvrir à 4,25 V) ne s'accordent pas : à trancher dans DynamiteAgile.
- **ESS-REQ-024** (équilibrage) **échoue** : le logiciel n'équilibre jamais en décharge, l'exigence ne le dit pas.
- **ESS-REQ-003** (360 A) **non couverte** : les profils vont jusqu'à 109 A ; les missions tirées des exigences (phase suivante) iront.
- ESS-REQ-016 et ESS-REQ-047 tenues ; ESS-REQ-013 et 014 non exercées à une ligne par seconde.
