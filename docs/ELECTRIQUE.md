# La bibliothèque électrique et les joints électriques

Les connecteurs sont des composants clés d'un produit mécatronique. La bibliothèque (`Atelier → Bibliothèque
électrique`, ou menu Projet) les propose par ce que la liaison doit porter ; la pièce arrive dans le projet avec ses
conducteurs, ses potentiels et ses interfaces.

## Des familles réelles

Chaque ligne renvoie à une **famille standard d'un grand fabricant** ou à une **norme publiée** (`web/js/cad/elec_library.js`) :

- **basse tension** — capteurs, signaux, alimentation de carte : JST PH, XH, GH ; Molex PicoBlade, Micro-Fit 3.0,
  Mini-Fit Jr., Nano-Fit, MX150 ; TE AMP Superseal 1.5, DEUTSCH DT et DTM ; Aptiv Metri-Pack 150 et Weather Pack ;
  M8 et M12 (IEC 61076-2-104 et -101) ; D-sub (MIL-DTL-24308) ; circulaires MIL-DTL-38999 ; Hirose FH12, DF13, DF40 ;
  Phoenix Contact COMBICON ; barrettes Samtec ;
- **haute tension et puissance** — ce qui relie le produit à l'extérieur : TE AMP+ HVA 280, HVA 630, HVP 800,
  HC-STAK 25 et 35 ; Amphenol PowerLok, Excel|Mate HVSL 282 à 1200, SurLok Plus ; Rosenberger HVR 200 ; Molex
  Imperium ; Stäubli MC4 ; Anderson Powerpole et SB ; Amass XT60 et XT90 ; contacts de puissance MIL-DTL-38999 ;
  sectionneur de service TE ;
- **cellules Li-ion cylindriques** 18650 et 21700, avec leur désignation IEC 61960-3 (INR19/66, INR22/71).

Le fabricant et la série sont cités **en texte, comme référence de compatibilité** — aucun logo, aucun dessin copié.
Pour chaque famille : courant par contact, tension assignée, section de fil, étanchéité, interverrouillage (HVIL),
blindage, normes — les **valeurs nominales publiées**, à la condition indiquée. La colonne de droite dit comment la ligne
a été vérifiée : **« lu »** (fiche ou page du fabricant ouverte) ou **« extrait »** (vue en extrait seulement, à relire).
Elles se déclassent avec le nombre de pôles, le fil et la température : **la fiche de la référence achetée fait foi**.

Quelques corrections que la vérification a apportées aux chiffres « de mémoire » : HVA 280 est à 600 V (750 V en câble
multiconducteur) ; HVA 630 porte 40 A ; le MC4 d'origine est à 1000 V selon IEC 62852 ; XT60 et XT90 sont assignés à
80 et 150 V DC ; le nombre dans le nom d'un Anderson SB n'est pas son courant UL.

## De la famille à la pièce

« Ajouter » demande le nombre de pôles, le potentiel, le montage, et si le raccordement **sort du produit**.

| Ce qui est créé | |
|---|---|
| **Conducteurs** | un corps par pôle, en cuivre, avec son potentiel : `HV+` et `HV−` pour deux pôles haute tension ; un seul potentiel pour un connecteur de signaux. L'analyse d'isolement les voit tels quels |
| **Corps isolant** | bride, corps et nez (montage sur paroi), ou boîtier posé (montage sur carte) |
| **Interface de paroi** | un passage (`cutout`, côté B) avec ses vis : le boîtier la reprend |
| **Interface de raccordement** | vers le câble ou l'appareil ; **externe** par défaut en haute tension : elle entre au contrat du produit avec son environnement, aucune pièce du projet ne s'y accouple |
| **Référence** | `library` dans le fichier de la pièce : famille, courant, tension, normes, mode de vérification |

### La forme d'un connecteur : indicative, par genre

Chaque **genre** de connecteur a sa forme, pour qu'on le reconnaisse dans la bibliothèque comme dans l'assemblage :

| Genre | Forme indicative |
|---|---|
| Fil à carte | embase à picots : un fond, quatre parois, un picot par pôle, un verrou si la famille est verrouillée |
| Fil à fil | boîtier de faisceau : corps, joint arrière, verrou |
| Carte à carte | mezzanine : corps bas, fente, deux rangées de contacts |
| Nappe FFC / FPC | corps bas, volet, fente d'entrée de la nappe |
| Circulaire | corps cylindrique, écrou, nez fileté, presse-étoupe, contacts en cercle |
| Bornier | corps à rehausse, une vis et une entrée de fil par pôle |
| Haute tension blindé | bride à quatre trous, corps, un port rond par pôle avec son contact et son départ de câble, deux broches d'interverrouillage |
| Puissance | un bloc par pôle, sa lame |
| Sectionneur de service | bride, corps, levier |

La forme est écrite **une seule fois**, en boîtes et en cylindres (`web/js/core/connector_shapes.js`), et lue deux
fois : comme les opérations de la pièce — des expressions de `L`, `W`, `H` et `e`, de sorte que l'enveloppe se règle
encore sur la fiche du fabricant — et comme solides de l'**aperçu 3D**. La bibliothèque montre un aperçu par famille,
à la même échelle dans un genre (la plus grande famille remplit son image) ; le dialogue d'ajout montre la forme en 3D,
à tourner à la souris, et la redessine quand le nombre de pôles ou le montage changent. Un connecteur haute tension
arrive orange, un connecteur de signaux clair (c'est sa couleur à l'écran, pas une matière).

**Ce n'est pas le dessin du fabricant.** La forme et l'enveloppe sont **indicatives** : tirées du pas, du nombre de
pôles et du courant, pour distinguer les genres et réserver la place. Aucune cote ni aucun modèle de fabricant n'a été
repris : leurs pages refusent la lecture automatique, et leurs modèles leur appartiennent.

### Le modèle du fabricant, à la place

Quand la référence est choisie, la **fiche de la pièce** (studio des pièces, onglet « Fiche ») propose « Mettre le
modèle STEP… » : le fichier `.step` téléchargé chez le fabricant prend la place de la forme indicative. « Chercher chez
le fabricant » ouvre une recherche dans un nouvel onglet. La référence, les potentiels déclarés, les interfaces et les
notes sont gardés ; la forme indicative attend de côté (« Revenir à la forme indicative »). À vérifier ensuite : la
place des interfaces — le repère du fichier n'est pas celui de la forme indicative — et les corps conducteurs, qui
viennent alors du fichier. Le fichier reste dans votre projet : la plateforme ne le publie pas.

Une **cellule** est un cylindre à sa plus grande cote publiée, d'une matière homogénéisée qui donne sa masse, avec deux
bornes — des interfaces soudées, côté B — que la languette ou le busbar reprend.

## Deux joints électriques

`web/js/cad/interfaces_elec.js` ajoute deux types d'interface, traités comme les autres : registre des joints,
nomenclature, gamme, santé des accouplements.

**`weld` — joint soudé ou câblé par fils.** Une zone de `w × h` entre un côté mince (A : languette, bout de busbar,
départ des fils) et une borne (B). `process` : `laser`, `resistance`, `ultrasonic`, `wirebond`. La gamme écrit la
préparation, l'outillage et le contrôle de chaque procédé. Pour le **wirebonding**, les fils entrent dans la
nomenclature et leur **courant de fusion** est estimé (Preece, `I = K · d^1,5`) : le fil sert souvent de fusible de
cellule, ce courant se choisit.

**`contact` — contact à pression.** Deux plages **planes** de conducteurs massifs pressées l'une sur l'autre : les
points de contact côté A (`n` points), une plage revêtue côté B. Le plan d'accouplement est sur leurs sommets, à la
hauteur comprimée (`gap`). Le contact prend une de **trois formes** (`form`), que l'écran montre par leur coupe :

| Forme | Ce que c'est | Pour quoi | Dans la géométrie |
|---|---|---|---|
| **Bossages coniques** (`cone`) | des bossages **emboutis en pointe** dans la barre elle-même — rien à rapporter | une barre de 1 mm et plus | un cône par point : Ø de la série de l'ISO 8167 (type sphérique : Ø 1,6 à 8 mm, hauteur du quart du diamètre), sommet de 0,3 × Ø |
| **Lames à ressort** (`bridge`) | des lames **découpées et cambrées en pont** dans une barre mince : chacune fléchit | une barre de moins de 1 mm | une arche par point, avec le jour dessous ; `t` est l'épaisseur de la lame (celle de la barre) |
| **Bande de lamelles rapportée** (`band`) | une bande de lamelles en alliage à ressort, revêtue, posée entre les deux plages | les forts courants : beaucoup de points en parallèle | un plot par point, et la bande à la nomenclature |

Un contact enregistré avant les formes reste une bande. Une **option** (`weld: projection`) fait des bossages des
**bossages de soudage** : sous l'effort et le courant ils fondent, et les deux barres sont soudées. La liaison devient
permanente, et elle est à qualifier : l'ISO 8167 couvre les aciers, les inox et les alliages de nickel jusqu'à 3 mm,
**pas le cuivre ni l'aluminium**.

**Selon le courant et la tension.** La carte du contact dit ce que la plateforme choisirait — et pourquoi — pour le
courant, la tension de service (`u`) et l'épaisseur de la barre ; « Appliquer le conseil » prend la forme, le
revêtement et le nombre de points :

- la **forme** : bande au-delà de 150 A, lames sous 1 mm d'épaisseur, bossages sinon ;
- le **revêtement** : or dur sur nickel pour un signal, argent pour la puissance ;
- le **nombre de points** : le plus petit qui porte le courant, d'après l'estimation de Holm ;
- la **classe de tension** de l'ISO 6469-3 : A jusqu'à 60 V continu (30 V alternatif), B1 de 60 à 75 V, B2 de 75 à
  1500 V. En classe B, la plage nue doit être hors d'atteinte (capot, gaine à fenêtre) et les distances d'isolement se
  vérifient dans l'outil Isolation ; les normes à respecter changent (USCAR-37, LV 215-1 au lieu de USCAR-2, LV 214).

Les seuils de 150 A et de 1 mm sont des **repères de la plateforme** ; celui de 1 mm suit ce que l'ISO 8167 dit des
bossages sphériques (« recommandés à partir de 1 mm »).

**La lame à ressort**, au premier ordre, est une poutre encastrée à ses deux pieds et chargée au milieu : raideur
`k = 192 E I / L³`, contrainte `12 E t δ / L²` — huit fois celle d'une languette libre de même longueur. La carte donne
la **course élastique** de la lame (jusqu'où elle fléchit et revient) et l'effort à cette course ; au-delà, la lame se
met en place une fois pour toutes. Une lame formée dans le cuivre de la barre revient très peu (quelques centièmes) et
se relâche à chaud : la carte le dit, et propose un alliage à ressort ou une bande rapportée.

Paramètres communs : zone, nombre de points, effort par point, usage (`power` ou `signal`), courant, tension, et :

| | Choix | Normes |
|---|---|---|
| **Revêtement** | argent (puissance), étain (économique, sensible au fretting), or dur sur nickel (signal), nickel | ASTM B700 / ISO 4521 ; ASTM B545 / ISO 2093 ; ASTM B488 / ISO 27874 ; ASTM B689 |
| **Ressort** | cuivre-béryllium C17200, cuivre-nickel-silicium C70250, bronze phosphoreux C51900 — ou le cuivre de la barre, pour une forme faite dans la barre | ASTM B194 ; ASTM B422 ; ASTM B103 |
| **Essais** | résistance de contact, courant admissible et échauffement | IEC 60512-2-1, IEC 60512-5-2 |

L'estimation est du premier ordre (théorie de Holm) : rayon du point `a = √(F / πH)`, résistance de constriction
`R = ρ / 2a`, courant par point tel que la chute au contact reste au dixième de la tension de ramollissement du
revêtement, 80 % du total pour un partage inégal. Elle sert à dimensionner une première plage, jamais de valeur
assignée. La santé du joint signale : un revêtement inadapté au signal, trop de courant pour le nombre de points, une
pièce non conductrice, et **l'absence de serrage** — un contact à pression demande une vis ou un clip entre les deux
barres.

## Busbars : la bande pliée, ses bornes, ses contacts

Écran **Busbars** (`Atelier → Busbars`, ou menu Projet ; `web/js/core/busbar.js`, `web/js/modules/busbar.js`). Un
busbar est une **bande** découpée, poinçonnée puis pliée : sa définition reste dans la pièce (`busbar`), et la pièce est
réécrite à chaque changement.

- **La bande** : matière conductrice, revêtement (nu, étamé, argenté, nickelé), potentiel (`HV+`, `48V`, `RS485-A`…),
  courant, largeur, épaisseur, rayon de pli.
- **Les branches** : une longueur chacune, et le pli à 90° — vers le haut ou vers le bas — qui la précède. Les longueurs
  se prennent sur la fibre du milieu, d'un sommet de pli au suivant. Une seule branche : une barre droite, seulement
  découpée.
- **Les trous de passage** (`H1`, `H2`…) : un trou traversant qui n'est pas une interface — ronds (Ø) ou **oblongs**
  (une longueur plus grande que le diamètre, le long de la branche ou en travers). Sous une gaine, ils traversent la
  gaine aussi. L'écran signale ce qui reste de cuivre au droit du trou (repère de 5 A/mm²), moins d'une épaisseur de
  métal jusqu'au bord, moins de 1,5 × d du bout de la barre, un chevauchement — repères d'usage, sans source citée.
- **Les bornes** (`T1`, `T2`…) : un trou de passage pour une vis, une interface vissée que l'autre pièce reprend.
- **Les contacts à pression** (`CT1`, `CT2`…) : posés seulement sur une **face plane** d'une branche, hors des plis.
  Un contact neuf prend la forme que la barre appelle (bossages, lames ou bande) ; elle se change d'un clic sur sa
  coupe. Chacun garde son numéro pour toujours.

**À la souris et au clavier**, dans la vue 3D :

| Geste | Effet |
|---|---|
| Clic droit sur une face plane | « Poser un contact à pression ici », « Poser une borne vissée ici », ou « Déplacer CT1 ici » |
| Clic sur une face | y déplacer le raccordement choisi |
| ← → ↑ ↓ | le pousser de 1 mm le long de la branche ou en travers (Maj : 5 mm ; Alt : 0,1 mm) ; il reste sur le plat et dans la largeur |
| R · V | tourner le contact d'un quart de tour · l'envoyer sur l'autre face de la branche |
| + · − | un point de contact de plus, de moins |
| Tab · Suppr | raccordement suivant · retirer celui qui est choisi |

À droite, chaque raccordement se complète par des **listes déroulantes** : le côté que porte cette barre (les lamelles,
ou la plage plane — l'autre barre porte l'autre moitié, avec la même clé), l'usage (puissance, signal), le revêtement,
le ressort, puis la zone, le nombre de points, l'effort, la hauteur comprimée et le courant. L'estimation
(résistance, courant) se lit sur la carte, avec les normes du revêtement et du ressort.

**Ce que l'écran vérifie** : la section et la densité de courant (repère 2,5 A/mm² à l'air libre, 5 A/mm² au plus), le
rayon de pli au moins égal à l'épaisseur pour le cuivre, des branches assez longues entre leurs plis, des trous à
1,5 × d des bouts, un contact de puissance sur une plage revêtue. Il donne la résistance à 20 °C, les pertes, la chute de
tension et le **développé** (facteur K 0,4, à confirmer par le plieur) ; l'échauffement se vérifie dans l'écran Physique.
Les règles de tôlerie du bilan DFx lisent l'épaisseur que la bande déclare.

## Isolant, busbar laminé, pad thermique

**Un isolant sur un busbar massif.** Dans l'écran Busbars, « Isolant » habille la barre d'une gaine — poudre époxy
(0,3 mm), film polyester (0,19 mm) ou film polyimide (0,1 mm) : un corps à part, autour du métal, bords et bouts
compris. Elle s'ouvre par une **fenêtre** à chaque borne (des deux côtés : la tête de vis et la cosse) et à chaque
contact, avec 2 mm de marge : c'est là que le métal se touche, par la surface ou par l'interface vissée.

**Le busbar laminé** (bouton « Busbar laminé » de l'écran Busbars ; `web/js/core/busbar_lam.js`). Des conducteurs de
potentiels opposés posés l'un sur l'autre, un **papier aramide** entre eux sur toute l'épaisseur (0,05 à 0,76 mm), un
**film polymère** en enveloppe. Une pièce, **un corps par couche** : chaque conducteur avec son potentiel, chaque
isolant avec sa matière — l'écran Isolation les lit tels quels. L'isolant **déborde** les conducteurs tout autour : la
ligne de fuite entre deux voisins vaut deux débords plus l'épaisseur du papier. Chaque conducteur sort aux deux bouts
par sa propre patte, côte à côte dans la largeur, avec sa vis. Le dialogue vérifie avant de créer : la tenue du papier
(rigidité diélectrique × épaisseur) contre un essai de 2 U + 1000 V, la largeur des pattes pour leur vis, la densité de
courant de chaque conducteur.

**Son circuit de mesure** (option « Circuit de mesure » du même dialogue). Un busbar laminé peut porter un **circuit
flexible pris entre deux de ses plaques**, sous l'enveloppe : une couche de plus dans l'épaisseur, sans un micron de
plus — il se loge dans une **fente du papier**. Ce qu'il fait :

- une **prise de tension** sur chacune des deux plaques qu'il touche : celle du dessous par sa face inférieure, celle du
  dessus par sa face supérieure, chacune à travers une fenêtre de sa couverture ;
- zéro à trois **sondes de température** au cœur de l'empilage — là où une barre laminée évacue le moins bien sa chaleur.
  Une sonde est plus épaisse que le papier : elle se loge dans un petit **lamage** de la plaque du dessus ;
- une **queue** raidie qui sort par le côté, au-delà du débord de l'isolant, vers un connecteur de carte de la
  bibliothèque ; elle a son interface (`FQ`), qui s'accouple dans l'assemblage.

Chaque piste et chaque prise est un **corps conducteur avec son potentiel**, comme les plaques : l'écran Isolation voit
que les pistes des prises portent les potentiels du busbar jusque sur la queue. Les deux potentiels sont mis aux deux
bords du circuit, les sondes au milieu. Le dialogue refuse l'empilage si : le circuit est plus épais que le papier (il
ferait une bosse), sa couverture de polyimide ne tient pas l'essai diélectrique entre une piste et la plaque voisine,
ses pistes ne tiennent pas dans sa largeur, la plaque du dessus est trop mince pour le lamage d'une sonde. Il rappelle
de prévoir une résistance ou un fusible en série sur chaque prise, au plus près de la plaque.

**Le pad thermique** (Bibliothèque électrique → Interface thermique). Une plaque de silicone chargé entre deux faces
planes, dessinée **écrasée** de 20 %, avec sa résistance thermique : épaisseur / (k × surface).

## Remplir une cavité, comme en production

Écran Assemblage : choisissez le boîtier, puis **« Remplir sa cavité… »**. Le produit — composé thermique de
remplissage, résine époxy d'enrobage, silicone souple — se coule une fois tout en place et prend **la place qui
reste** (`web/js/cad/fill.js`) : la boîte du contenant jusqu'au niveau choisi, moins le contenant, moins toutes les
autres pièces posées. Seul le plus grand volume est gardé — ce que les parois enferment ; les copeaux d'air hors de
parois dépouillées ou arrondies sont écartés.

Le dialogue donne le volume (et celui de la cavité vide), la masse, la hauteur atteinte ; le niveau se règle en
pourcentage de la cavité. Le résultat devient une **pièce de l'assemblage** — géométrie exacte, masse, ligne de
nomenclature, isolant pour l'analyse d'isolement. Quand les pièces autour changent, « Recalculer » reprend le volume.

## Le circuit flexible

Écran **Circuits flexibles** (`Atelier → Circuits flexibles`, ou menu Projet ; `web/js/core/flex.js`,
`web/js/modules/flex.js`). Une bande de polyimide, pliée là où le produit le demande, qui porte **une piste par
fonction** et de petits **capteurs** le long de son trajet. Sa définition reste dans la pièce (`flex`), et la pièce est
réécrite à chaque changement — même squelette de branches et de plis que le busbar.

- **La bande** : largeur, épaisseur, cuivre (18, 35 ou 70 µm), simple ou double face, rayon de pli, espace entre pistes.
- **Les fonctions à relier** : pour chacune le signal ou le potentiel (`5V`, `GND`, `CAN-H`, `RS485-A`…), à quoi elle
  sert, la largeur de piste et le courant.
- **Les capteurs**, posés à la souris sur une face plane du film (clic droit ; clic pour déplacer, flèches, V pour le
  verso, Suppr) :
  - **sonde de température** (`TS1`…) : le composant est au dos, la face qui touche reste plane — une interface d'appui
    que la cellule, le busbar ou le dissipateur reprend ;
  - **prise de tension** (`VS1`…) : une patte de cuivre soudée (laser, résistance, ultrasons) sur un busbar ou une borne
    de cellule — une interface soudée, et un conducteur au potentiel qu'elle ramène.
  **Les pistes des capteurs s'ajoutent seules** : une par prise de tension, une par sonde, et un retour commun des sondes.
- **Le raccordement à la carte** : une queue raidie à 0,3 mm qui entre dans un connecteur de la bibliothèque (Hirose
  FH12, DF40…), ou une queue brasée. La pièce garde la référence du connecteur et le nombre de contacts.

Une pièce, **un corps par piste** : le film isolant, chaque piste en cuivre avec son potentiel, le raidisseur, les
capteurs. L'écran Isolation les lit tels quels — utile quand des prises de tension amènent côte à côte les potentiels
d'un pack.

**Ce que l'écran vérifie** : les pistes tiennent dans la largeur ; le rayon de pli vaut au moins 6 fois l'épaisseur en
simple face, 12 fois en double face, pour un circuit posé une fois (100 fois s'il fléchit en service) ; chaque piste
porte son courant (IPC-2221, piste couverte, échauffement de 20 K) ; largeur et espace d'au moins 0,1 mm ; les capteurs
restent sur le plat, à l'écart des plis ; le connecteur porte le courant de chaque contact.

**Avec une IA** : « Copier pour une IA » envoie la définition avec sa consigne (l'entrevue à mener, la réponse
attendue) ; « Réimporter » lit la définition revenue, **liste ce qui a changé**, et réécrit la pièce en une étape
annulable.

## Limites

- Busbars : plis à 90° dans un seul plan, largeur constante. Le busbar laminé est plat, sans pli ni fenêtre dans ses
  couches, et se règle à la création seulement. Son circuit de mesure est une géométrie de principe : il traverse la
  barre à mi-longueur, ne touche que les deux plaques qui l'encadrent (un seul circuit par busbar), ses pistes sont
  droites, et le scellement de l'enveloppe autour de la queue n'est pas dessiné.
- Circuit flexible : géométrie de principe — pistes droites au cœur du film, sans plages, fenêtres de vernis ni
  routage ; plis à 90° dans un seul plan ; il n'est pas relié à l'arbre fonctionnel d'une carte (brique PCBA). Le
  circuit pris dans un busbar laminé est décrit avec le busbar, pas dans l'écran Circuits flexibles.
- Le remplissage est une géométrie figée (STEP, lourde dans le fichier du projet) : il ne suit pas les pièces seul, il se
  recalcule. La gamme d'assemblage ne décrit pas encore la coulée.
- Les rigidités diélectriques et les indices de résistance au cheminement des films sont des valeurs typiques.
- Les enveloppes des connecteurs sont indicatives ; aucune empreinte de carte ni modèle du fabricant n'est fourni.
- Les lignes marquées « extrait » sont à relire sur la fiche du fabricant ; les titres des documents LV 214 et LV 215
  (constructeurs allemands) ne sont pas publics.
- La polarité interne d'une cellule n'est pas modélisée ; pas de constructeur de pack (série, parallèle) encore.
- Les estimations de contact et de fil sont des ordres de grandeur : l'essai et la fiche du composant acheté prévalent.
- Formes de contact — **lu** : l'extrait d'aperçu du projet final ISO/FDIS 8167:2021 (domaine d'application, types de
  bossages, tableau 1 des bossages sphériques) et celui du projet ISO/DIS 6469-3:2020 (tableau 1 des classes de
  tension). **Non lu** : le reste de ces deux normes. **Résumés de recherche seulement** : les bandes à lamelles des
  fabricants (leurs pages ont refusé la lecture) — aucun chiffre de fabricant n'est repris. Les modules et les limites
  élastiques des alliages à ressort sont des valeurs typiques, écrites de pratique, non relues sur une fiche. Aucune
  de ces formes n'a été confrontée à une pièce ni à un essai ; l'empreinte du poinçon au dos d'un bossage embouti
  n'est pas modélisée ; le FeatureScript écrit le bossage en cône et laisse la lame à former dans Onshape.
