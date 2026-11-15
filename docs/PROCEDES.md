# Procédés spéciaux de l'Atelier

Quatre procédés où **la matière décide du dessin** : le moulage, l'extrusion, la découpe laser de précision et
l'impression 3D. Ils vivent tous dans l'Atelier (*Shop*) :

| Procédé | Où | Règles |
|---|---|---|
| Moulage (injection, fonderie) | Atelier → Intention d'abord → « Moulage » | [MOULAGE.md](MOULAGE.md) |
| Extrusion (aluminium, plastique) | Atelier → Intention d'abord → « Profilé sur mesure », et Atelier → **Profilés extrudés** (le studio, qui était un onglet du haut jusqu'à la v0.29) | [EXTRUSION.md](EXTRUSION.md) |
| Découpe laser de précision | Atelier → Intention d'abord → « Tôle ou feuille » | ce document |
| Impression 3D | Atelier → Intention d'abord → « Fabrication additive » | ce document |

L'écran **Atelier → Procédés spéciaux** (`#/process`) montre, pour chacun, ce qu'il demande matière par matière, d'où
viennent les valeurs, et ouvre « Intention d'abord » avec la matière et le procédé choisis.

## 1. Ce que fait la plateforme

- **La matière choisit le procédé.** Un papier aramide, un film ou un stratifié se découpe à plat au laser ; un alliage
  d'impression (AlSi10Mg) s'imprime ; un titane ou un alliage de nickel, qui s'usine aussi, s'imprime quand le concepteur
  choisit « Fabrication additive ».
- **La feuille prend une épaisseur du commerce de SA matière** : papier aramide de 0,05 à 0,76 mm, film polyimide de
  0,025 à 0,125 mm, FR-4 de 0,2 à 3,2 mm, tôle selon les épaisseurs de l'Atelier. Un isolant prend son épaisseur courante,
  ou celle que le concepteur choisit ; une tôle prend celle que ses fixations demandent.
- **La gamme dit le vrai geste** : « Découper le contour au laser UV », « Détendre sur le plateau, sous vide ou sous gaz
  neutre », « Pièce en fatigue : compaction isostatique à chaud », « Usiner les surfaces fonctionnelles ».
- **Le DFx vérifie** (règles `LAS-01` à `LAS-06`, `AM-10` à `AM-17`, en plus des règles de plaque et de boîtier imprimé).
- **Aller-retour IA** : la consigne « Affiner avec Claude » de l'Atelier porte la fiche du procédé pour la matière de la
  pièce ; l'écran des procédés copie la fiche complète d'un procédé, matière par matière, avec sa consigne. La pièce
  revient par « Entrevue avec Claude », avec l'aperçu des changements et la validation habituels.
- **Le rapport** liste les pièces découpées au laser ou imprimées, avec ce que leur procédé demande et ce qui se contrôle.

**Dans la démonstration** (« Variateur compact 400 V ») : `DRV-ISO`, un isolant en papier aramide de 0,25 mm découpé au
laser, posé sur le dissipateur dans la fenêtre thermique de la base et maté par son interface ; `DRV-BRACKET`, un étrier en
Ti-6Al-4V imprimé — une variante, présente dans le projet mais pas encore dans l'assemblage.

Tout est dans `web/js/cad/special_processes.js` (données et fonctions pures), `web/js/analysis/dfx_rules_special.js`
(règles) et `web/js/modules/shop_special.js` (écran et carte de l'Atelier).

## 2. Découpe laser de précision, par matière en feuille

| Famille | Laser | Épaisseur | Ce qui lui est propre |
|---|---|---|---|
| Acier, inox | fibre ; azote (bord sans oxyde) ou oxygène (acier doux) | ≤ 20 mm | sur un bord coupé à l'oxygène, la peinture en poudre s'écaille |
| Aluminium | fibre, azote | ≤ 15 mm | bavure au dos |
| Cuivre, laiton | fibre (un laser CO2 est renvoyé par le métal) | ≤ 10 mm | conducteur : ébavurer avant d'isoler ou de laminer |
| Titane | fibre, argon | ≤ 6 mm (à confirmer) | bord coloré = air entré, couche fragile à retirer |
| FR-4, carte | UV (CO2 : bord carbonisé) | ≤ 1,6 mm | aucun effort sur la carte ; cuivre en retrait du trait de coupe |
| Papier aramide | CO2 | 0,05 à 0,76 mm | le bord brunit ; ponts larges, angles arrondis |
| Film polyimide, polyester | UV pour un bord net, CO2 plus rapide | ≤ 0,5 mm | trait de 0,03 mm (UV) à 0,12 mm (CO2) dans 0,125 mm |
| Acrylique | CO2 | ≤ 20 mm | bord brillant ; craquelures au contact d'un solvant |
| POM, polyester, polyamide, ABS | CO2 | ≤ 10 mm | bord fondu, précision moindre |
| Polycarbonate | à éviter | feuille mince | se décolore, bord jaune à brun |
| **PVC, PTFE, matières chlorées ou fluorées** | **jamais** | — | gaz toxiques et corrosifs (chlorure d'hydrogène pour le PVC) |

Règles vérifiées par le DFx :

- `LAS-01` matière qui se découpe au laser (erreur pour le PVC, avertissement pour le polycarbonate) ;
- `LAS-02` épaisseur dans la plage du laser pour la matière ;
- `LAS-03` plus petit détail : métaux, trou ≥ 0,5 × l'épaisseur et fente ≥ l'épaisseur et ≥ 1 mm (la règle `SM-06`, trou
  ≥ l'épaisseur, reste la plus prudente) ; feuilles minces, un minimum absolu par matière ;
- `LAS-04` pont de matière : métaux, ≥ l'épaisseur et ≥ 1,6 mm ; feuilles minces, minimum par matière ;
- `LAS-05` angles rentrants arrondis dans les matières fragiles et les feuilles minces (correctif en un clic) ;
- `LAS-06` état du bord : un isolant dont le chant est carbonisé ne compte pas dans une ligne de fuite ; un conducteur
  s'ébavure avant d'être isolé ; sur une carte, le cuivre reste en retrait du trait de coupe.

### Le chant découpé dans l'analyse d'Isolation

La règle `LAS-06` n'est pas qu'un rappel. Quand un assemblage contient un isolant en feuille découpé au laser (papier
aramide, film, stratifié), l'analyse d'Isolation traite son **chant** comme un conducteur flottant qui ferait le tour de
la feuille : le chemin de fuite le longe **sans rien compter**. Il ne reste que la distance du premier conducteur au bord,
et du bord au second. Deux conducteurs posés chacun à 2 mm du même bord, à 35 mm l'un de l'autre, ont ainsi une ligne
de fuite de 4 mm, pas de 35.

- Réglage dans « Conditions de l'analyse » : *Hors de la ligne de fuite (prudent)*, par défaut, ou *Compté comme une
  surface* quand un essai a montré que le bord n'est pas carbonisé.
- Le détail d'une paire dit quel chant le chemin a pris.
- Le chant se reconnaît à la géométrie : ce qui ne regarde pas dans le sens des deux grandes faces de la feuille.
- C'est une **prudence**, pas un fait mesuré : l'effet d'un bord bruni sur le papier aramide n'est publié nulle part
  (section 4). Moteur : `web/js/analysis/cc_creepage.js` ; quelles pièces : `charredEdge` dans
  `web/js/cad/special_processes.js`.

## 3. Impression 3D, par procédé et par matière

| Procédé | Matières de la bibliothèque | Paroi | Trou | Supports | Cavité |
|---|---|---|---|---|---|
| Dépôt de fil (FDM) | PEI 9085, PEKK, ABS, polycarbonate | ≥ 1 mm | ≥ Ø1,5 | sous 45°, pont ≤ 5 mm | — |
| Lit de poudre polymère (MJF / SLS) | PA12, PA11 | ≥ 0,9 mm | ≥ Ø1 | aucun | 2 ouvertures ≥ Ø5 |
| Résine (SLA) | résine rigide | ≥ 0,6 mm | ≥ Ø0,5 | sous 19°, débord ≤ 1 mm | ouverture ≥ Ø3,5 |
| Fusion laser sur lit de poudre métallique (LPBF) | AlSi10Mg, inox 316L et 17-4 PH, **Ti-6Al-4V**, **alliages de nickel 718 et 625** | ≥ 0,4 mm, 1 mm conseillé | ≥ Ø1 | sous 45° (55° pour le 316L), pont ≤ 2 mm, trou horizontal rond ≤ Ø8 | 2 ouvertures ≥ Ø3 |

Ce que chaque métal demande après la fusion (c'est dans la gamme de la pièce et dans la règle `AM-17`) :

| Matière | Norme | Suite |
|---|---|---|
| AlSi10Mg | ASTM F3318 | détente sur le plateau ; traitement selon le dessin |
| Inox 316L | ASTM F3184 | détente ; passivation si demandée ; compaction isostatique à chaud (CIC / HIP) pour la fatigue ou l'étanchéité |
| Inox 17-4 PH | aucune norme de pièce imprimée lue ici | détente ; mise en solution et vieillissement |
| **Ti-6Al-4V** | ASTM F2924 ; **ASTM F3001 pour la nuance ELI** (*extra low interstitial*) ; SAE AMS7028 (état compacté à chaud) | détente sous vide ou gaz neutre ; **CIC puis usinage des surfaces** pour la fatigue |
| **Alliage 718** | ASTM F3055 (UNS N07718) | détente ; mise en solution et vieillissement ; CIC prévue par la norme |
| **Alliage 625** | ASTM F3056 (UNS N06625) ; SAE AMS7000 (détendu, compacté à chaud, recuit) | détente ; CIC ; recuit de mise en solution |

« Très pur » : en aéronautique, le titane des pièces critiques est le **Ti-6Al-4V ELI** (grade 23), dont les éléments
interstitiels — l'oxygène surtout — sont abaissés. Ce n'est pas un titane pur, c'est le même alliage, plus tenace. La
poudre se recycle et se charge en oxygène : d'où l'exigence du certificat du lot de poudre.

Règles vérifiées par le DFx : `AM-10` matière et procédé accordés (correctif en un clic) ; `AM-11` paroi d'une pièce
métallique ; `AM-12` trous et filetages (un filet se taraude en reprise) ; `AM-13` surplombs et supports ; `AM-14`
cavités ouvertes ; `AM-15` volume d'une machine courante ; `AM-16` surfaces fonctionnelles reprises en usinage ;
`AM-17` ce que la matière demande après l'impression. Les règles de boîtier imprimé (`HSG-`) valent pour les polymères,
résine comprise.

## 4. D'où viennent les valeurs — ce qui a été lu, ce qui ne l'a pas été

Ce sont des **valeurs typiques** : elles donnent sa forme à une pièce, elles ne la qualifient pas. Le fournisseur et la
fiche de la matière font foi. Chaque famille et chaque procédé porte dans l'application une ligne « D'où viennent ces
valeurs ».

**Lu (document ou page) pendant l'écriture de cette bibliothèque :**

- Titres et objets des normes : ISO/ASTM 52900:2021, 52911-1:2019 et 52911-2:2019 ; ASTM F2924, F3001, F3055, F3056,
  F3184, F3318 ; SAE AMS7003A, AMS7000A, AMS7028. **Le texte des normes n'a pas été lu** (elles sont payantes) : seules
  leurs pages de présentation l'ont été.
- Impression métal : guides de Renishaw (*Design for metal AM – a beginner's guide*), Protolabs (*Designing for Metal 3D
  Printing*), Hubs, Xometry, Materialise — paroi, surplomb à 45° du plateau (55° pour le 316L), pont de 2 mm, trou
  horizontal de 8 à 10 mm, plus petit trou de 0,4 à 1,5 mm, ouvertures de 2 à 5 mm, tolérance de ± 0,1 à 0,2 mm,
  rugosité de 5 à 10 µm, détente sur le plateau, compaction pour les pièces aéronautiques très chargées.
- Impression polymère : Hubs, Xometry, Protolabs, Formlabs ; fiche du filament ULTEM AM9085F (FAR 25.853, OSU 65/65,
  UL 94 V-0 à 1,5 et 3 mm sur éprouvettes imprimées — valeurs typiques, pas une certification de pièce).
- Laser, métaux : TRUMPF (épaisseurs d'une machine de 6 kW : acier et inox 20 mm, aluminium 15 mm, cuivre et laiton
  10 mm ; coupe à l'azote sans bavure ni oxyde), Linde (gaz), TWI (métaux réfléchissants et laser à fibre), guide Xometry
  des tôles découpées (trait de 0,2 à 0,4 mm, détails ≥ 50 % de l'épaisseur, pont ≥ 1,6 mm ou l'épaisseur, fente
  ≥ 1 mm ou l'épaisseur, tolérance de ± 0,25 mm).
- Laser, cartes : publications de LPKF présentées à l'IPC — épaisseur jusqu'à 1,6 mm, aucun effort, carbonisation
  possible même au laser UV et son effet sur la résistance de surface et la tenue en tension, essais à 0,1 à 1,5 mm du
  cuivre ; trait de coupe mesuré dans un film polyimide de 0,125 mm (0,03 mm au laser UV, 0,12 mm au CO2).
- Laser, plastiques : Trotec (liste des matières découpables ; PVC, vinyle et PTFE interdits), Epilog (chlorure
  d'hydrogène et chlorure de vinyle du PVC ; polycarbonate décoloré), Xometry.

**Non vérifié — à confirmer avant de s'y fier :**

- une **surépaisseur d'usinage chiffrée** pour l'impression métal : aucun grand guide n'en publie, la règle dit donc
  « à convenir avec l'atelier » ;
- le **papier aramide** : trait de coupe, tolérance, plus petits détails, et surtout **l'effet d'un bord bruni sur la
  tenue diélectrique** — rien de publié trouvé ; la règle est une prudence (débord d'isolant, chant coupé hors de la
  ligne de fuite, essai diélectrique), pas un fait établi. Le choix du laser CO2 vient de résumés de pages non lues ;
- une **distance normalisée entre le cuivre et le trait de coupe** d'une carte : il n'y en a pas, seulement des essais ;
- le **titane au laser** : épaisseur maximale et couche fragilisée viennent de la connaissance métallurgique ;
- les plus petits trous, ponts et rayons des **stratifiés, films et plastiques** : ordres de grandeur d'atelier ;
- les **épaisseurs maximales des plastiques**, l'état de bord de l'acrylique, les **volumes de machine** (250 × 250 ×
  300 mm en métal, 145 × 145 × 185 mm en résine) ;
- le **PEKK**, les limites propres au **PA11**, une spécification SAE de pièces en alliage 718 ;
- les propriétés mécaniques des nouvelles matières (`web/js/analysis/physics/props.js`) : valeurs typiques de la famille,
  comme pour toutes les matières de la bibliothèque.

Ce que la version en ligne ne dit pas encore : aucune de ces règles n'a été confrontée à un devis ou à une pièce réelle.

## 5. Liens des sources

- https://www.protolabs.com/media/bn1dvyuy/pl_3dp_dmls_design_guide_en.pdf
- https://renishaw.com/resourcecentre/en/download/feature-article-design-for-metal-am-a-beginners-guide--111752
- https://www.hubs.com/knowledge-base/how-design-parts-metal-3d-printing/
- https://xometry.pro/en-eu/articles/dmls-design-tips/
- https://www.materialise.com/en/academy/industrial/design-am/titanium
- https://www.hubs.com/knowledge-base/how-design-parts-fdm-3d-printing/ ·
  https://www.hubs.com/knowledge-base/how-design-parts-sls-3d-printing/ ·
  https://www.hubs.com/knowledge-base/how-design-parts-sla-3d-printing/
- https://xometry.pro/wp-content/uploads/2024/05/EN-EU-MJF-Design-Guide.pdf
- https://formlabs.com/eu/support/Design-Specs/
- https://xometry.pro/wp-content/uploads/2023/07/EN-Sheet-Cutting-Design-Guide.pdf
- https://www.trumpf.com/en_GB/products/machines-systems/2d-laser-cutting-machines/trulaser-series-1000-lean-edition/
- https://www.linde-gas.com/processes/thermal-cutting/laser-cutting
- https://www.twi-global.com/technical-knowledge/job-knowledge/cutting-processes-laser-cutting-052
- https://www.electronics.org/system/files/technical_resource/E39%26S06_03%20-%20Ahne%20Oosterhof.pdf
- https://www.electronics.org/system/files/technical_resource/E41%26S06_01%20-%20Ahne%20Oostefhof.pdf
- https://www.electronics.org/system/files/technical_resource/E10%26S20_02.pdf
- https://www.troteclaser.com/static/images/knowledge/FAQs/lasercutting-engraving-marking-materials/2024-02-materials-for-laser-processing.pdf
- https://www.epiloglaser.com/how-it-works/faq/laser-machine-unsafe-materials
- Normes : https://store.astm.org (F2924, F3001, F3055, F3056, F3184, F3318) ; https://saemobilus.sae.org (AMS7000A,
  AMS7003A, AMS7028) ; ISO/ASTM 52900, 52911-1, 52911-2.

Fabricants et séries sont cités comme références, en texte, sans logo ni dessin copié.
