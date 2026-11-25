/* DynamiteOrbit.ai — Logiciel : the REFERENCES the software screens cite (demande de JP, 25 novembre 2026 : « mettre des sources pour le
   comportement et ajouter une section Références dans le bas du menu Logiciel afin de pointer efficacement vers ces références quand tu les
   cites » ; « s'aligner sur les façons de faire les plus à jour de l'industrie automobile et les citer — Tesla, Lucid ou autres »).
   Each line : what it is, who publishes it, where, how it was read — `how` takes the words of the platform's register (core/methods.js
   METHOD_HOW : lu, page lue, extrait, non lu) —, what THIS source says that the tool uses, in our words, numbers as printed with their place,
   and the screens that cite it. A screen cites a line by its id (`refCite`, modules/sw_refs_ui.js) : a number that opens this list on it.
   Nothing here was copied : paraphrase, and the place to read it. What no source read says is said as such (`gaps`). Pure : no page. */

export const REF_TOPICS = [
  { id: "balance", label: "Équilibrage des cellules", icon: "bolt", color: "#16a34a" },
  { id: "charge", label: "Charge d'une cellule Li-ion", icon: "power", color: "#d97706" },
  { id: "arch", label: "Architecture d'un BMS automobile", icon: "chip", color: "#2563eb" },
  { id: "cell", label: "La cellule du projet", icon: "sensor", color: "#7c3aed" },
  { id: "std", label: "Normes", icon: "report", color: "#475569" },
];
const R = (id, topic, how, title, by, url, date, says, cites = []) => ({ id, topic, how, title, by, url, date, says, cites });
export const REFS = [
  R("ti-bq76952-trm", "balance", "read", "BQ76952 Technical Reference Manual (SLUUBY2B)", "Texas Instruments", "https://www.ti.com/lit/ug/sluuby2b/sluuby2b.pdf", "sept. 2020, révisé mai 2022",
    ["§ 10.1 : l'équilibrage est passif — le courant des cellules choisies est dérivé — « pendant la charge ou au repos » ; en mode autonome, il s'autorise en charge, au repos, ou dans les deux cas.",
      "Il démarre quand la cellule la plus basse dépasse une tension minimale ET que l'écart max − min dépasse un écart minimal ; il s'arrête sous un écart d'arrêt (hystérésis) ; réévalué à chaque intervalle.",
      "§ 13.3.11, valeurs par défaut : tension minimale 3 900 mV, écart pour démarrer 40 mV, écart pour s'arrêter 20 mV, intervalle 20 s, une cellule à la fois.",
      "§ 10.1 : on ne mesure pas une cellule pendant qu'on l'équilibre — le circuit coupe brièvement son équilibrage pour la mesurer ; § 10.2 : ces coupures réduisent le courant moyen."],
    ["Bloc « Passive balancing »", "Charge et équilibrage"]),
  R("ti-sluaa81a", "balance", "read", "Cell Balancing With BQ769x2 Battery Monitors (SLUAA81A)", "Texas Instruments — M. Sunna", "https://www.ti.com/lit/an/sluaa81a/sluaa81a.pdf", "oct. 2020, révisé févr. 2022",
    ["§ 2.1 : par la résistance interne (25 Ω) et des résistances d'entrée de 20 Ω, environ 65 mA pour une cellule à 4,2 V ; environ 0,1 W dans la puce par cellule.",
      "§ 2.2, § 2.4 : avec un transistor externe, environ 96 à 102 mA ; plus de courant demande des composants externes."],
    ["Charge et équilibrage"]),
  R("digikey-ltc6813", "balance", "read", "LTC6813 Multi-Cell Battery Monitor — page produit", "Digi-Key, d'après Analog Devices (Linear Technology)", "https://www.digikey.com/en/product-highlight/l/linear-tech/ltc6813-multicell-battery-monitor", "",
    ["Équilibrage passif par cellule, en modulation, jusqu'à 200 mA.", "Jusqu'à 18 cellules en série par puce, erreur totale de mesure de moins de 2,2 mV.",
      "Liaison isoSPI : série isolée à 1 Mbit/s sur une paire torsadée, jusqu'à 100 m ; puces en chaîne vers un seul hôte, chaîne bidirectionnelle qui tolère une coupure."],
    ["Charge et équilibrage", "Carte du BMS central"]),
  R("bu-803a", "balance", "read", "BU-803a: Cell Matching and Balancing", "Battery University", "https://batteryuniversity.com/article/bu-803a-cell-matching-and-balancing", "mis à jour le 2 nov. 2021",
    ["L'équilibrage passif fait dissiper les cellules hautes dans une résistance pendant la charge, autour de 70 à 80 % d'état de charge."], ["Charge et équilibrage"]),
  R("eenews-active", "balance", "read", "Active Battery Cell Balancing", "eeNews Europe — C. Hammerschmidt", "https://www.eenewseurope.com/en/active-battery-cell-balancing/", "18 févr. 2021",
    ["Le passif dissipe l'excès en chaleur pendant la charge et n'allonge pas l'autonomie ; l'actif déplace la charge (jusqu'à 10 A cité), raccourcit la charge et chauffe moins."], ["Charge et équilibrage"]),
  R("ti-bq24610", "charge", "read", "BQ24610, BQ24617 — fiche technique (SLUS892D)", "Texas Instruments", "https://www.ti.com/lit/ds/symlink/bq24610.pdf", "déc. 2009, révisé déc. 2019",
    ["§ 9.3.4–9.3.5 : trois phases — précharge, courant constant, tension constante ; fin quand le courant tombe sous un seuil.",
      "Sous un seuil bas à la mise sous tension, courant de précharge « pour ranimer des cellules profondément déchargées » ; faute si le seuil n'est pas atteint en 30 min."],
    ["Charge et équilibrage", "Profil de charge"]),
  R("bu-409", "charge", "read", "BU-409: Charging Lithium-ion", "Battery University", "https://batteryuniversity.com/article/bu-409-charging-lithium-ion", "mis à jour le 25 oct. 2021",
    ["Courant constant puis tension constante, jusqu'à 4,20 V par cellule (± 50 mV) ; chargée quand la tension est atteinte et que le courant tombe à 3 à 5 % du courant nominal."],
    ["Charge et équilibrage"]),
  R("molicel-p45b", "cell", "read", "Cell Specifications of INR-21700-P45B (INR21700P45B-01, ver. 0.2)", "Molicel", "", "ver. 0.2",
    ["p. 3 : 4,5 Ah typ., 4,20 ± 0,05 V en fin de charge, 2,5 V en fin de décharge, ≤ 8 mΩ à 1 kHz, 9 A en charge continue, 45 A en décharge continue au plus."],
    ["Charge et équilibrage", "Profil de charge", "Projet BM"]),
  R("ed-peek-bms", "arch", "read", "A Peek Inside a Modern EV Battery-Management System", "Electronic Design — J. Morra", "https://www.electronicdesign.com/technologies/power/article/21276578/electronic-design-a-peek-inside-a-modern-ev-battery-management-system", "31 oct. 2023",
    ["Une plateforme de BMS de véhicule électrique d'un fabricant de semi-conducteurs : un circuit de surveillance par module (jusqu'à 12 cellules) mesure et équilibre en passif ; les modules en chaîne isolée, avec un mode en anneau qui tolère une panne.",
      "Un microcontrôleur central calcule l'état de charge et de santé ; pilotes de contacteurs côté haut et côté bas ; trois ports CAN FD."],
    ["Carte du BMS central"]),
  R("ti-slvaf35a", "arch", "read", "Livre blanc SLVAF35A, § 3 « Power-Up Sequence » (contacteurs de batterie haute tension)", "Texas Instruments", "https://www.ti.com/document-viewer/ja-jp/lit/html/SLVAF35/GUID-C085775C-2E48-4FBD-A54F-2AD18E308CB1", "févr. 2021 – juil. 2024",
    ["Séquence : fermer le contacteur négatif, puis le contacteur de précharge ; fermer le contacteur positif quand le condensateur du bus atteint 90 à 95 % de la tension du pack, puis ouvrir la précharge.",
      "Seule cette section a été lue ; le titre complet du document n'a pas été vu."],
    ["Carte du BMS central"]),
  R("tesla-sm-pyro", "arch", "read", "Model 3 Service Manual — Pyrotechnic Battery Disconnect (Remove and Replace)", "Tesla", "https://service.tesla.com/docs/Model3/ServiceManual/en-us/GUID-ECA1FB37-410B-4CFC-9071-27D0F55C33B4.html", "2017–2023",
    ["Document de Tesla : un « pyrotechnic battery disconnect » est boulonné sur les busbars de la batterie haute tension ; la procédure contrôle la résistance des joints, dont un joint au shunt — un indice d'une mesure de courant par shunt, que la page ne décrit pas."],
    ["Carte du BMS central"]),
  R("cleantechnica-m3", "arch", "read", "Tesla Model 3 Has « Most Advanced Large-Scale Lithium Battery Ever Produced », Battery Expert Notes", "CleanTechnica (d'après EVANNEX)", "https://cleantechnica.com/2018/07/09/tesla-model-3-has-most-advanced-large-scale-lithium-battery-ever-produced-battery-expert-notes/", "9 juil. 2018",
    ["Article de vulgarisation, pas un document de Tesla : un module central regroupe BMS, connecteurs, fusibles, contacteurs et un contrôleur haute tension ; chaque module a son circuit de surveillance des cellules ; le pyrofusible coupe le pack sur un signal de l'ordinateur de bord."],
    ["Carte du BMS central"]),
  R("iso-6469-1", "std", "page", "ISO 6469-1:2019 — Electrically propelled road vehicles, Safety specifications, Part 1 : RESS", "ISO (fiche de catalogue iTeh)", "https://standards.iteh.ai/catalog/standards/iso/f8205295-e0d0-4179-91a6-a525801d2518/iso-6469-1-2019", "15 avr. 2019",
    ["Fiche lue, pas le texte : exigences de sécurité du système de stockage d'énergie rechargeable d'un véhicule routier électrique, pour protéger les personnes ; remplace ISO 6469-1:2009 et ISO 12405-3:2014."],
    ["Carte du BMS central"]),
  R("iso-26262", "std", "unread", "ISO 26262 — Road vehicles, Functional safety", "ISO", "", "2018",
    ["Citée par sa désignation : la page de l'ISO a refusé la lecture ; le texte n'a pas été lu."], ["Carte du BMS central", "Architecture (ASIL)"]),
  R("iso-11898", "std", "unread", "ISO 11898-1 — Road vehicles, Controller area network (CAN), Part 1", "ISO", "", "",
    ["Citée par sa désignation (le CAN et le CAN FD) : la page de l'ISO a refusé la lecture ; le texte n'a pas été lu."], ["Carte du BMS central"]),
];
/** What no source read says — said, so that no one takes it for a reference. */
export const REF_GAPS = [
  "Le temps d'équilibrage d'une grosse cellule : aucune source lue ne le chiffre. La fenêtre « Charge et équilibrage » le calcule sur son modèle typique.",
  "Ralentir la charge pendant l'équilibrage : aucune source lue ne le demande ; c'est un réglage du projet.",
  "Une fin de charge à C/20 ou C/10 : aucune source lue ne la donne ; Battery University dit 3 à 5 % du courant nominal.",
  "L'architecture du BMS de Lucid : aucune source lue ne la décrit. Le wBMS de GM Ultium : la page du fabricant a refusé la lecture.",
];
export const refOf = (id) => REFS.find((r) => r.id === id) || null;
/** The number of a reference in the list, as cited on the screens : [n]. */
export const refNumber = (id) => REFS.findIndex((r) => r.id === id) + 1;
