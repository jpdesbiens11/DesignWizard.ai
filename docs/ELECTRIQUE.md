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

L'**enveloppe est indicative** : elle est tirée du pas, du nombre de pôles et du courant, pour réserver la place. Le
modèle 3D du fabricant la remplace quand la référence est choisie.

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

**`contact` — contact à lamelles.** Deux plages **planes** de conducteurs massifs pressées l'une sur l'autre : une
bande de lamelles estampées côté A (`n` points), une plage revêtue côté B. Dans la géométrie, un bossage par point tient
la hauteur comprimée (`gap`) ; le plan d'accouplement est sur leurs sommets. Paramètres : zone, nombre de points, effort
par point, usage (`power` ou `signal`), courant à porter, et :

| | Choix | Normes |
|---|---|---|
| **Revêtement** | argent (puissance), étain (économique, sensible au fretting), or dur sur nickel (signal), nickel | ASTM B700 / ISO 4521 ; ASTM B545 / ISO 2093 ; ASTM B488 / ISO 27874 ; ASTM B689 |
| **Ressort** | cuivre-béryllium C17200, cuivre-nickel-silicium C70250, bronze phosphoreux C51900 | ASTM B194 ; ASTM B422 ; ASTM B103 |
| **Essais** | résistance de contact, courant admissible et échauffement | IEC 60512-2-1, IEC 60512-5-2 |

L'estimation est du premier ordre (théorie de Holm) : rayon du point `a = √(F / πH)`, résistance de constriction
`R = ρ / 2a`, courant par point tel que la chute au contact reste au dixième de la tension de ramollissement du
revêtement, 80 % du total pour un partage inégal. Elle sert à dimensionner une première plage, jamais de valeur
assignée. La santé du joint signale : un revêtement inadapté au signal, trop de courant pour le nombre de points, une
pièce non conductrice, et **l'absence de serrage** — un contact à pression demande une vis ou un clip entre les deux
barres.

## Limites

- Pas encore de module pour dessiner un busbar plié, un busbar laminé, un circuit flexible, un pad thermique ou un
  remplissage de cavité ; le contact à lamelles se pose par l'Atelier ou le dialogue d'interface, pas encore à la souris
  dans un écran dédié.
- Les enveloppes des connecteurs sont indicatives ; aucune empreinte de carte ni modèle du fabricant n'est fourni.
- Les lignes marquées « extrait » sont à relire sur la fiche du fabricant ; les titres des documents LV 214 et LV 215
  (constructeurs allemands) ne sont pas publics.
- La polarité interne d'une cellule n'est pas modélisée ; pas de constructeur de pack (série, parallèle) encore.
- Les estimations de contact et de fil sont des ordres de grandeur : l'essai et la fiche du composant acheté prévalent.
