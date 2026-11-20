/* DesignWizard.ai — the words of a battery system, as standards and authorities publish them (demande de JP : « si jamais
   ces acronymes sont de l'abus de langage comparativement aux normes en vigueur de l'industrie… recampons-nous sur les
   standards de l'industrie, les bons noms, et citons les normes en vigueur dans l'aéro pour les justifier »).
   The platform writes the established term ; a word of a house — CMB, BMU, BM, EFC… — stays in the glossary as an alias,
   with what was found about it. Each term says which published document defines or uses it, and where ; each document
   says how it was read. What a document says is given in our own words, with its clause : no text of a standard is copied.
   What was NOT read is said : RTCA DO-311A, the SAE reports (abstracts only), the body of the ISO and IEC standards (only
   their free previews, which show the clause of terms). No company's vocabulary is described here : only what is public.
   Pure : data. The glossary of the Help shows it (core/terms.js) ; the registry of sources points at it (core/methods.js). */

/** How a document was read. */
export const BATTERY_READ = {
  read: { label: "lu", text: "Le document public a été ouvert ; les passages cités ont été relus dans le fichier." },
  preview: { label: "aperçu lu", text: "Seul l'aperçu gratuit de l'éditeur a été lu : il montre l'article des termes et définitions, pas le corps de la norme." },
  abstract: { label: "résumé lu", text: "Seule la page de présentation (objet, résumé) a été lue." },
  unread: { label: "non lu", text: "Document payant ou inaccessible : cité par sa désignation, non lu." },
};
/** The documents. */
export const BATTERY_SOURCES = {
  faa184: { name: "FAA AC 20-184A — Guidance on Testing and Installation of Rechargeable Lithium Battery and Battery Systems on Aircraft", url: "https://www.faa.gov/documentLibrary/media/Advisory_Circular/AC-20-184A.pdf", read: "read" },
  cfr27: { name: "14 CFR § 27.1353 — Energy storage systems", url: "https://www.ecfr.gov/api/versioner/v1/full/2026-11-01/title-14.xml?part=27&section=27.1353", read: "read" },
  e19: { name: "EASA Special Condition SC E-19, Issue 1 (2021) — Electric / Hybrid Propulsion System", url: "https://www.easa.europa.eu/sites/default/files/dfu/sc_e-19_issue_1_electric_hybrid_propulsion_system_-_2021-04-07.pdf", read: "read" },
  moc3: { name: "EASA MOC-3 SC-VTOL, Issue 2 (2023)", url: "https://www.easa.europa.eu/en/downloads/136701/en", read: "read" },
  moc4: { name: "EASA MOC-4 SC-VTOL, Issue 2 (2025)", url: "https://www.easa.europa.eu/en/downloads/142242/en", read: "read" },
  cmt: { name: "ANAC · EASA · FAA · TCCA, Certification Management Team — Thermal runaway for propulsion battery, Issue 1 (2024)", url: "https://www.easa.europa.eu/en/downloads/140391/en", read: "read" },
  ntsb: { name: "NTSB/AIR-14/01 (2014) — rapport d'incident, batterie d'un avion de ligne", url: "https://www.ntsb.gov/investigations/accidentreports/reports/air1401.pdf", read: "read" },
  jsc: { name: "NASA JSC-20793 Rev. D (2017) — Crewed Space Vehicle Battery Safety Requirements", url: "https://ntrs.nasa.gov/api/citations/20170009182/downloads/20170009182.pdf", read: "read" },
  nasa: { name: "NASA NTRS 20240005892 et 20240003364 (2024) — avion expérimental électrique : intégration des systèmes, chaîne de traction", url: "https://ntrs.nasa.gov/api/citations/20240005892/downloads/20240005892%20FINAL.pdf", read: "read" },
  mil: { name: "MIL-PRF-29595A (2011) — Batteries and Cells, Lithium, Aircraft, Rechargeable", url: "https://everyspec.com/MIL-PRF/MIL-PRF-010000-29999/download.php?spec=MIL-PRF-29595A.032803.pdf", read: "read" },
  r100: { name: "Règlement ONU n° 100, séries 02 et 03 d'amendements (texte adopté ECE/TRANS/WP.29/2020/109 ; copie d'une administration)", url: "https://www.mlit.go.jp/jidosha/un/UN_R100.pdf", read: "read" },
  iec62619: { name: "IEC 62619:2022 — Safety requirements for secondary lithium cells and batteries, for use in industrial applications", url: "https://cdn.standards.iteh.ai/samples/102658/51f6834cb0d54da78c6bafbd8435b4f2/IEC-62619-2022.pdf", read: "preview" },
  iec62620: { name: "IEC 62620:2014 + AMD1:2023 — Secondary lithium cells and batteries for use in industrial applications", url: "https://cdn.standards.iteh.ai/samples/17079/fd0778aff65f445694dbe531020e9baf/IEC-62620-2014.pdf", read: "preview" },
  iso12405: { name: "ISO 12405-4:2018 — Electrically propelled road vehicles, test specification for lithium-ion traction battery packs and systems", url: "https://cdn.standards.iteh.ai/samples/71407/b5ce4ccf53c449a4a8f479d95c49c789/ISO-12405-4-2018.pdf", read: "preview" },
  iso6469: { name: "ISO 6469-1:2019 — Electrically propelled road vehicles, safety specifications, part 1 : RESS", url: "https://cdn.standards.iteh.ai/samples/68665/d01b89910b5845adb8e47ee05058c2d6/ISO-6469-1-2019.pdf", read: "preview" },
  air6897: { name: "SAE AIR6897 (2020) — Battery Management Systems for Rechargeable Lithium Batteries Used in Aerospace Standards", url: "https://saemobilus.sae.org/standards/air6897-battery-management-systems-rechargeable-lithium-batteries-used-aerospace-standards", read: "abstract" },
  do311: { name: "RTCA DO-311A (2017) — Minimum Operational Performance Standards for Rechargeable Lithium Batteries and Battery Systems", url: "", read: "unread" },
};
/** The groups a term belongs to : what stores, what watches and cuts, the whole. */
export const BATTERY_GROUPS = [{ id: "store", label: "Ce qui stocke", hint: "de la cellule au pack", icon: "block", color: "#3d86e6" }, { id: "watch", label: "Ce qui surveille et coupe", hint: "l'électronique et les appareils de coupure", icon: "chip", color: "#46b97c" }, { id: "whole", label: "Le système entier", hint: "le nom change avec le domaine", icon: "power", color: "#ee8a32" }];
/** The established terms : label (English, what the screens write), fr, what it is, and where it is defined or used ([source, where]). */
export const BATTERY_TERMS = {
  cell: { group: "store", label: "Cell", fr: "cellule (élément)", text: "L'unité électrochimique : une tension entre deux bornes.", src: [["faa184", "annexe B, B.1.3"], ["moc3", "MOC VTOL.2440, définitions (b)"]] },
  cellBlock: { group: "store", label: "Cell block", fr: "bloc de cellules", text: "Des cellules reliées en parallèle. La NASA dit « cell bank ».", src: [["iec62619", "art. 3.8"], ["iec62620", "art. 3.7"], ["jsc", "§ 3.2"]] },
  module: { group: "store", label: "Battery module", fr: "module de batterie", text: "Des cellules reliées en série ou en parallèle, dans une seule enveloppe : le sous-ensemble d'un pack.", src: [["moc3", "définitions (c)"], ["cmt", "§ 7"], ["faa184", "annexe D, D.5.1.1"], ["iec62619", "art. 3.9"]] },
  pack: { group: "store", label: "Battery pack", fr: "pack de batterie", text: "Des cellules ou des modules reliés, avec leur électronique. La circulaire de la FAA dit « battery » et « sub-pack ».", src: [["cmt", "§ 7"], ["iso12405", "art. 3.2"], ["jsc", "§ 3.2"]] },
  cellElectronics: { group: "watch", label: "Cell electronics", fr: "électronique de cellules (carte de mesure d'un module)", text: "Ce qui relève les tensions et les températures des cellules d'un module, et peut les équilibrer. C'est le seul nom défini par une norme pour cette carte ; un article de la NASA l'écrit en toutes lettres : « cell monitoring board ».", src: [["iso12405", "art. 3.5"], ["nasa", "20240005892, p. 3"]] },
  bms: { group: "watch", label: "Battery management system (BMS)", fr: "système de gestion de batterie", text: "L'électronique qui surveille et gère l'état de la batterie, et coupe en cas de surcharge, de surintensité, de décharge profonde ou de surchauffe. Le terme employé partout.", src: [["iec62619", "art. 3.12"], ["iec62620", "art. 3.11"], ["cmt", "§ 9"], ["faa184", "§ 1.6.2.2"], ["air6897", "objet"]] },
  ess: { group: "whole", label: "Energy storage system (ESS)", fr: "système de stockage d'énergie", text: "Pour un aéronef : les cellules, leur assemblage, et les circuits de protection, de surveillance et d'alerte.", src: [["cfr27", "§ 27.1353"], ["faa184", "annexe F, F.4.5"], ["cmt", "§ 7"], ["moc4", "p. 6"]] },
  propulsion: { group: "whole", label: "Propulsion battery", fr: "batterie de propulsion", text: "Dans les textes de l'EASA : la batterie, ou l'ensemble de batteries, qui alimente les moteurs électriques.", src: [["e19", "EHPS.15"], ["moc3", "définitions (e)"]] },
  system: { group: "whole", label: "Battery system", fr: "système batterie", text: "L'article que l'on qualifie et que l'on installe : une batterie et ce qui la gère.", src: [["faa184", "annexe B, B.1.2"], ["iec62619", "art. 3.11"], ["do311", "titre — non lu"]] },
  contactor: { group: "watch", label: "Contactor", fr: "contacteur", text: "L'appareil qui isole électriquement les cellules du reste du circuit.", src: [["iso12405", "art. 3.3, note 2"], ["ntsb", "p. 23"]] },
  autoDisconnect: { group: "watch", label: "Automatic disconnect", fr: "coupure automatique", text: "Véhicules routiers : le dispositif qui, déclenché, sépare la source du reste du circuit à haute tension. « Service disconnect » : celui que l'on ouvre pour l'entretien.", src: [["r100", "§ 2.3 (série 03) ; § 2.31 (série 02)"]] },
  reess: { group: "whole", label: "RESS / REESS", fr: "système rechargeable de stockage d'énergie", text: "Véhicules routiers seulement : RESS dans les normes ISO et SAE, REESS dans le règlement de l'ONU.", src: [["iso6469", "titre et objet"], ["r100", "§ 2.37"]] },
};
/** The words of a house, and what was found about each. use : a key of BATTERY_TERMS, or "" when nothing established fits. */
export const HOUSE_WORDS = [
  { word: "CMB", said: "cell monitoring board", found: "Aucune norme ne le définit : trouvé comme nom de produit d'un fabricant, et écrit en toutes lettres — sans sigle — dans un article de la NASA.", use: "cellElectronics" },
  { word: "CMU · CSC · CSU", said: "cell monitoring unit · cell supervision circuit · cell supervisor unit", found: "Listés ensemble comme « sigles courants de l'industrie » dans un livre blanc d'un fabricant de composants ; aucune norme lue ne les définit.", use: "cellElectronics" },
  { word: "BMU", said: "battery management unit", found: "Les normes IEC 62619 et IEC 62620 le donnent comme un autre nom du BMS. Mais un rapport du NTSB l'emploie pour « battery monitoring unit » : à écrire en toutes lettres.", use: "bms" },
  { word: "BCU", said: "battery control unit", found: "Défini par l'ISO 12405-4 (véhicules routiers). Mais le même rapport du NTSB l'emploie pour « battery charger unit » : à écrire en toutes lettres.", use: "bms" },
  { word: "BM", said: "battery module", found: "Trouvé nulle part comme sigle : les textes écrivent « battery module », ou « module ».", use: "module" },
  { word: "EFC", said: "energy flow counter", found: "Rien d'établi pour une partie d'un système de batterie : aucun document lu ne porte ce nom. Le projet dit (20 novembre 2026) « energy flow counter » — ce qui compte l'énergie qui entre dans le pack et celle qui en sort. Le seul autre sens trouvé — dans le glossaire d'un fournisseur, pas dans une norme — est « equivalent full cycles », un compteur de cycles. Une pièce se nomme par sa fonction : l'outil écrit « mesure du courant du pack » et « compteur d'énergie » (courant, charge en A·h, énergie en W·h).", use: "" },
  { word: "EESS", said: "electrical energy storage system", found: "Pour un aéronef : seulement dans un texte PROPOSÉ de l'EASA (MOC-2 SC-VTOL, 2021). L'IEC 62933-1 donne ce sigle à une installation reliée au réseau. Les textes récents des autorités écrivent ESS.", use: "ess" },
];
/** What public documents say about the buses of an aircraft battery — and what they do not. */
export const BATTERY_BUSES = [
  "Les textes des autorités lus (FAA AC 20-184A, EASA SC E-19, MOC SC-VTOL, 14 CFR § 27.1353) ne nomment aucun bus : ils exigent la fonction — surveiller, et indiquer l'état à l'équipage.",
  "Vers l'aéronef, dans les manuels publics de batteries d'avion certifiées qui ont été ouverts : ARINC 429, RS-232 et des signaux discrets.",
  "RS-485 : une seule mention normative trouvée — MIL-PRF-29595A, § 3.9.7, comme exemple de bus par lequel un essai intégré est commandé du dehors.",
  "Entre les modules et le contrôleur, un avion expérimental de la NASA décrit une liaison série en chaîne (son niveau physique n'est pas nommé) et, vers le reste de l'avion, un bus CAN.",
  "Rien de ce qui a été lu ne permet d'écrire que le RS-485 est le choix courant à l'intérieur d'une batterie d'aéronef, ni l'inverse : RTCA DO-311A et le texte de SAE AIR6897 n'ont pas été lus.",
];
/** A term, for a tip or a document : « Cell electronics — électronique de cellules… ». */
export const batteryTerm = (key) => { const t = BATTERY_TERMS[key]; return t ? `${t.label} — ${t.fr}` : ""; };
/** Each term with its sources spelled out : → [{ key, label, fr, text, sources: [{ name, where, read, url }] }] */
export function batteryGlossary() { return Object.entries(BATTERY_TERMS).map(([key, t]) => ({ key, label: t.label, fr: t.fr, text: t.text, sources: t.src.map(([s, where]) => ({ name: BATTERY_SOURCES[s].name, where, read: BATTERY_SOURCES[s].read, url: BATTERY_SOURCES[s].url })) })); }
