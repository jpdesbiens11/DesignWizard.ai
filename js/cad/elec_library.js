/* DynamiteOrbit.ai — the electrical library : connectors (low voltage and high voltage / power) and cylindrical Li-ion cells.
   Each connector entry names a real, widely used family of a major manufacturer, or a published standard, as a REFERENCE :
   maker and series are quoted to say what the part is compatible with — no logo, no copied drawing. The figures are the
   nominal ones published by the manufacturer (per contact, at the stated condition) ; they derate with the number of poles,
   the wire and the ambient. `seen` says how each row was checked : "read" (datasheet or product page opened), "excerpt"
   (seen only as an excerpt of that page). The datasheet of the part actually bought always prevails.
   a : amperes per contact, the figure used for sizing ; v : rated volts (null when the maker publishes none). */

const C = (id, maker, series, kind, o) => ({ id, maker, series, kind, ...o });

export const CONNECTOR_KINDS = { "wire-to-board": "Fil à carte", "wire-to-wire": "Fil à fil", "board-to-board": "Carte à carte", circular: "Circulaire", ffc: "Nappe FFC / FPC", "terminal-block": "Bornier", hv: "Haute tension blindé", power: "Puissance", msd: "Sectionneur de service" };

export const CONNECTORS = [
  /* ---- low voltage, signal and sensors ---- */
  C("jst-ph", "JST", "PH", "wire-to-board", { domain: "lv", pitch: 2.0, pos: "2–16", a: 2, v: 100, wire: "AWG 32–24", temp: "−40…+105 °C", seen: "read", use: "Capteurs, petits signaux" }),
  C("jst-xh", "JST", "XH", "wire-to-board", { domain: "lv", pitch: 2.5, pos: "1–16, 20", a: 3, v: 250, wire: "AWG 30–22", temp: "−25…+85 °C", seen: "read", use: "Équilibrage de cellules, capteurs" }),
  C("jst-gh", "JST", "GH", "wire-to-board", { domain: "lv", pitch: 1.25, pos: "2–15", a: 1, v: 50, wire: "AWG 30–26", temp: "−40…+105 °C", lock: true, seen: "read", use: "Signaux compacts, verrouillé" }),
  C("molex-picoblade", "Molex", "PicoBlade", "wire-to-board", { domain: "lv", pitch: 1.25, pos: "2–15", a: 1, v: 125, wire: "AWG 32–28", seen: "read", use: "Signaux compacts" }),
  C("molex-microfit", "Molex", "Micro-Fit 3.0", "wire-to-board", { domain: "lv", pitch: 3.0, pos: "2–24", a: 8.5, v: 600, wire: "AWG 30–22", lock: true, seen: "excerpt", note: "8,5 A au plus, selon la cosse", use: "Alimentation de carte, signaux" }),
  C("molex-minifit", "Molex", "Mini-Fit Jr.", "wire-to-board", { domain: "lv", pitch: 4.2, pos: "2–24", a: 9, v: 600, temp: "−40…+105 °C", lock: true, std: "UL, CSA", seen: "read", note: "9 A en AWG 16 sur 2 à 3 circuits, 6 A sur 12 à 24 circuits", use: "Alimentation de carte" }),
  C("molex-nanofit", "Molex", "Nano-Fit", "wire-to-board", { domain: "lv", pitch: 2.5, pos: "2–16", a: 6.5, v: 250, wire: "AWG 26–20", temp: "−40…+115 °C", lock: true, std: "UL, CSA", seen: "read", use: "Alimentation compacte" }),
  C("molex-mx150", "Molex", "MX150", "wire-to-wire", { domain: "lv", pitch: 3.5, a: 22, v: null, wire: "AWG 22–14", sealed: "étanche", temp: "−40…+125 °C", lock: true, std: "interface USCAR", seen: "read", use: "Faisceau étanche de véhicule" }),
  C("te-superseal", "TE Connectivity", "AMP Superseal 1.5", "wire-to-wire", { domain: "lv", pos: "1–6", a: 14, v: null, wire: "0,35–2,5 mm²", sealed: "IP67", temp: "−40…+125 °C", lock: true, std: "IEC 60529, LV 214, USCAR", seen: "read", note: "14 A à 80 °C", use: "Faisceau étanche" }),
  C("te-deutsch-dt", "TE Connectivity", "DEUTSCH DT", "wire-to-wire", { domain: "lv", contact: "taille 16", pos: "2, 3, 4, 6, 8, 12", a: 13, v: null, wire: "AWG 20–14", sealed: "IP68", temp: "−55…+125 °C", lock: true, seen: "read", note: "pas de tension assignée publiée ; tenue diélectrique 1500 V AC", use: "Milieu sévère" }),
  C("te-deutsch-dtm", "TE Connectivity", "DEUTSCH DTM", "wire-to-wire", { domain: "lv", contact: "taille 20", pos: "2, 3, 4, 6, 8, 12", a: 7.5, v: null, wire: "AWG 22–16", sealed: "IP68", temp: "−55…+125 °C", lock: true, seen: "read", use: "Signaux en milieu sévère" }),
  C("aptiv-metripack150", "Aptiv", "Metri-Pack 150", "wire-to-wire", { domain: "lv", a: 14, v: null, wire: "0,35–1,0 mm²", temp: "−40…+125 °C", seen: "read", use: "Faisceau de véhicule" }),
  C("aptiv-weatherpack", "Aptiv", "Weather Pack", "wire-to-wire", { domain: "lv", a: 20, v: null, wire: "0,35–3,0 mm²", sealed: "étanche", temp: "−40…+125 °C", seen: "read", use: "Faisceau étanche" }),
  C("m8", "IEC 61076-2-104", "M8", "circular", { domain: "lv", pos: "3, 4", a: 4, v: 60, sealed: "IP65 / IP67", std: "IEC 61076-2-104", seen: "read", use: "Capteurs industriels" }),
  C("m12-a", "IEC 61076-2-101", "M12 codage A", "circular", { domain: "lv", pos: "3, 4, 5, 8, 12", a: 4, v: 250, wire: "AWG 24–20", sealed: "IP67", std: "IEC 61076-2-101", seen: "read", note: "250 V à 4 pôles, 60 V à 5 pôles, 30 V à 8 et 12 pôles", use: "Capteurs, bus de terrain (RS-485, CAN)" }),
  C("d-sub", "MIL-DTL-24308", "D-subminiature", "wire-to-board", { domain: "lv", contact: "taille 20", pos: "9, 15, 25, 37, 50", a: 5, v: null, temp: "−55…+125 °C", std: "MIL-DTL-24308", seen: "excerpt", note: "5 A en version commerciale, 7,5 A selon la spécification militaire", use: "Signaux, bancs d'essai" }),
  C("d38999", "MIL-DTL-38999", "Circulaire série III", "circular", { domain: "lv", contact: "tailles 22D à 8", a: 13, v: null, sealed: "résistant à l'environnement", temp: "−65…+200 °C", std: "MIL-DTL-38999", seen: "read", note: "par contact : 22D 5 A · 20 7,5 A · 16 13 A · 12 23 A · 10 33 A · 8 46 A", use: "Aéronautique, milieu sévère" }),
  C("hirose-fh12", "Hirose", "FH12", "ffc", { domain: "lv", pitch: 0.5, pos: "6–53", a: 0.5, v: 50, temp: "−40…+85 °C", seen: "excerpt", note: "existe aussi au pas de 1,0 mm", use: "Circuit flexible ou nappe vers carte" }),
  C("hirose-df13", "Hirose", "DF13", "wire-to-board", { domain: "lv", pitch: 1.25, pos: "2–14", a: 1, v: 150, wire: "AWG 32–26", seen: "excerpt", use: "Signaux compacts" }),
  C("hirose-df40", "Hirose", "DF40", "board-to-board", { domain: "lv", pitch: 0.4, pos: "40–100", a: 0.3, v: 50, seen: "excerpt", note: "hauteur d'empilage 1,5 à 4,0 mm", use: "Carte sur carte, flex sur carte" }),
  C("phoenix-mstb", "Phoenix Contact", "COMBICON MSTB 2,5", "terminal-block", { domain: "lv", pitch: 5.08, a: 12, v: 320, wire: "0,2–2,5 mm²", seen: "excerpt", use: "Bornier débrochable" }),
  C("samtec-tsw", "Samtec", "TSW / SSW", "board-to-board", { domain: "lv", pitch: 2.54, a: 3, v: null, temp: "−55…+125 °C", seen: "read", note: "4,7 A une seule broche alimentée ; 3 A est une valeur prudente", use: "Barrettes au pas de 2,54 mm" }),
  /* ---- high voltage and power ---- */
  C("te-hva280", "TE Connectivity", "AMP+ HVA 280", "hv", { domain: "hv", contact: "2,8 mm", pos: "2–3", a: 40, v: 600, wire: "2–4 mm²", sealed: "IP67, IP6K9K", hvil: true, shielded: true, temp: "−40…+140 °C", std: "USCAR, LV 215-1", seen: "read", note: "40 A à 85 °C ; 750 V en câble multiconducteur", use: "Auxiliaires HV : chauffage, compresseur, chargeur" }),
  C("te-hva630", "TE Connectivity", "AMP+ HVA 630", "hv", { domain: "hv", contact: "6,3 mm", pos: "2, 5", a: 40, v: 850, wire: "4–6 mm²", sealed: "IP67, IP6K9K", hvil: true, shielded: true, temp: "−40…+140 °C", std: "LV 215-1", seen: "read", note: "40 A à 140 °C", use: "Auxiliaires HV" }),
  C("te-hvp800", "TE Connectivity", "AMP+ HVP 800", "hv", { domain: "hv", contact: "8 mm", pos: "1–3", a: 250, v: 1000, wire: "25–50 mm²", sealed: "IP67, IP6K9K", hvil: true, shielded: true, temp: "−40…+140 °C", std: "LV 215-1", seen: "read", note: "250 A à 85 °C sur 50 mm² ; versions 650, 850 et 1000 V", use: "Batterie, onduleur, moteur" }),
  C("te-hcstak25", "TE Connectivity", "HC-STAK 25", "hv", { domain: "hv", pos: "2", a: 247, v: 1000, wire: "25–50 mm²", sealed: "IP6K7, IP6K9K", hvil: true, shielded: true, temp: "−40…+125 °C", std: "USCAR-2", seen: "read", note: "247 A à 85 °C sur 50 mm²", use: "Batterie, onduleur" }),
  C("te-hcstak35", "TE Connectivity", "HC-STAK 35", "hv", { domain: "hv", pos: "2", a: 400, v: 1000, wire: "70–95 mm²", sealed: "IP67", shielded: true, temp: "−40…+125 °C", seen: "read", note: "400 A à 85 °C sur 95 mm²", use: "Forte puissance" }),
  C("amphenol-powerlok", "Amphenol", "PowerLok", "hv", { domain: "hv", pos: "1–3", a: 250, v: 1000, wire: "50–120 mm²", sealed: "IP67, IP6K9K", hvil: true, shielded: true, temp: "−40…+125 °C", std: "LV 214 (vibrations)", seen: "read", note: "série 300 : 200 A (50 mm²), 250 A (70 mm²) ; série 500 : jusqu'à 400 A (120 mm²)", use: "Batterie, onduleur, moteur" }),
  C("amphenol-hvsl282", "Amphenol", "Excel|Mate HVSL 282", "hv", { domain: "hv", contact: "2,8 mm", pos: "2", a: 32, v: 1000, wire: "2,5–4 mm²", sealed: "IP67, IP6K9K", hvil: true, shielded: true, temp: "−40…+125 °C", std: "USCAR-37", seen: "read", note: "32 A sur 4 mm²", use: "Auxiliaires HV" }),
  C("amphenol-hvsl630", "Amphenol", "Excel|Mate HVSL 630", "hv", { domain: "hv", contact: "6,3 mm", pos: "2", a: 40, v: 1000, wire: "4–6 mm²", sealed: "IP67, IP6K9K", hvil: true, shielded: true, temp: "−40…+125 °C", std: "LV 215", seen: "read", note: "40 A sur 6 mm²", use: "Auxiliaires HV" }),
  C("amphenol-hvsl800", "Amphenol", "Excel|Mate HVSL 800", "hv", { domain: "hv", contact: "8 mm", pos: "2–3", a: 200, v: 1000, wire: "25–50 mm²", sealed: "IP67, IP6K9K", hvil: true, shielded: true, temp: "−40…+125 °C", std: "USCAR-2, USCAR-37", seen: "read", note: "200 A à 70 °C", use: "Batterie, onduleur" }),
  C("amphenol-hvsl1000", "Amphenol", "Excel|Mate HVSL 1000", "hv", { domain: "hv", contact: "10 mm", pos: "1–3", a: 250, v: 1000, wire: "25–70 mm²", sealed: "IP67, IP6K9K", hvil: true, shielded: true, temp: "−40…+125 °C", std: "LV 215", seen: "read", note: "250 A à 70 °C", use: "Batterie, onduleur" }),
  C("amphenol-hvsl1200", "Amphenol", "Excel|Mate HVSL 1200", "hv", { domain: "hv", contact: "12 mm", pos: "1–2", a: 350, v: 1000, wire: "70–95 mm²", sealed: "IP67, IP6K9K", hvil: true, shielded: true, temp: "−40…+125 °C", std: "USCAR-37", seen: "read", note: "250 A sur 70 mm², 350 A sur 95 mm²", use: "Forte puissance" }),
  C("amphenol-surlok-57", "Amphenol", "SurLok Plus 5,7 mm", "power", { domain: "hv", contact: "5,7 mm", pos: "1", a: 120, v: 1000, sealed: "IP67", temp: "−40…+105 °C", std: "UL 1977, UL 4128", seen: "read", note: "100 à 120 A ; versions 1000 et 1500 V DC", use: "Stockage d'énergie, liaisons entre modules" }),
  C("amphenol-surlok-8", "Amphenol", "SurLok Plus 8 mm", "power", { domain: "hv", contact: "8 mm", pos: "1", a: 200, v: 1000, sealed: "IP67", temp: "−40…+105 °C", std: "UL 1977, UL 4128", seen: "read", note: "120 à 250 A selon le câble ; versions 1000 et 1500 V DC", use: "Stockage d'énergie, liaisons entre modules" }),
  C("amphenol-surlok-103", "Amphenol", "SurLok Plus 10,3 mm", "power", { domain: "hv", contact: "10,3 mm", pos: "1", a: 320, v: 1000, wire: "50–95 mm²", sealed: "IP67", temp: "−40…+105 °C", std: "UL 1977, UL 4128", seen: "read", note: "200 A (50 mm²), 250 A (70 mm²), 320 A (95 mm²)", use: "Stockage d'énergie" }),
  C("rosenberger-hvr200", "Rosenberger", "HVR 200", "hv", { domain: "hv", pos: "2", a: 200, v: 750, wire: "16–35 mm²", sealed: "IP6K9K, IPX8", hvil: true, shielded: true, temp: "−40…+140 °C", seen: "read", note: "200 A à 85 °C sur 35 mm² ; interverrouillage en option", use: "Batterie, onduleur" }),
  C("molex-imperium", "Molex", "Imperium", "hv", { domain: "hv", contact: "8 mm", a: 250, v: 1000, sealed: "IP6K9K", hvil: true, shielded: true, seen: "excerpt", use: "Véhicules lourds, forte puissance" }),
  C("staubli-mc4", "Stäubli", "MC4", "power", { domain: "hv", contact: "4 mm", pos: "1", a: 39, v: 1000, wire: "1,5–10 mm²", sealed: "IP65, IP68", temp: "−40…+85 °C", std: "IEC 62852, UL 6703", seen: "read", note: "à 85 °C : 22,5 A (2,5 mm²), 39 A (4 et 6 mm²), 45 A (10 mm²)", use: "Courant continu photovoltaïque, extérieur" }),
  C("anderson-pp45", "Anderson Power", "Powerpole PP15/45", "power", { domain: "hv", pos: "1, empilable", a: 45, v: 600, wire: "AWG 20–10", std: "UL 1977", seen: "read", note: "non étanche ; jusqu'à 55 A selon UL 1977", use: "Batterie basse tension, 48 V" }),
  C("anderson-pp75", "Anderson Power", "Powerpole PP75", "power", { domain: "hv", pos: "1, empilable", a: 70, v: 600, wire: "AWG 6 au plus", std: "UL 1977", seen: "read", note: "70 A selon CSA, 120 A selon UL 1977", use: "Batterie basse tension" }),
  C("anderson-pp120", "Anderson Power", "Powerpole PP120", "power", { domain: "hv", pos: "1, empilable", a: 155, v: 600, wire: "AWG 10–1/0", std: "UL 1977", seen: "read", note: "155 A selon CSA, 240 A selon UL 1977", use: "Batterie, chargeur" }),
  C("anderson-pp180", "Anderson Power", "Powerpole PP180", "power", { domain: "hv", pos: "1, empilable", a: 230, v: 600, std: "UL 1977", seen: "read", note: "230 A selon CSA, 350 A selon UL 1977", use: "Batterie, chargeur" }),
  C("anderson-sb50", "Anderson Power", "SB50", "power", { domain: "hv", pos: "2", a: 50, v: 600, std: "UL 1977", seen: "read", note: "50 A selon CSA, 120 A selon UL 1977 ; le nombre du nom n'est pas le courant UL", use: "Batterie basse tension, chariots" }),
  C("anderson-sb175", "Anderson Power", "SB175", "power", { domain: "hv", pos: "2", a: 175, v: 600, wire: "AWG 12–1/0", std: "UL 1977", seen: "read", note: "175 A selon CSA, 280 A selon UL 1977", use: "Batterie de traction basse tension" }),
  C("anderson-sb350", "Anderson Power", "SB350", "power", { domain: "hv", pos: "2", a: 350, v: 600, wire: "1/0–300 kcmil", std: "UL 1977", seen: "read", note: "350 A selon CSA, 450 A selon UL 1977", use: "Batterie de traction basse tension" }),
  C("amass-xt60", "Amass", "XT60", "power", { domain: "hv", pos: "2", a: 35, v: 80, wire: "AWG 12, à souder", temp: "−20…+120 °C", seen: "read", note: "35 A pour un échauffement de 85 K ; 80 V DC assignés", use: "Prototypes, drones, batteries basse tension" }),
  C("amass-xt90", "Amass", "XT90", "power", { domain: "hv", pos: "2", a: 45, v: 150, wire: "AWG 10, à souder", temp: "−20…+120 °C", seen: "read", note: "45 A pour un échauffement de 85 K ; 150 V DC assignés", use: "Prototypes, batteries basse tension" }),
  C("d38999-power", "MIL-DTL-38999", "Contacts de puissance 8 / 4 / 0", "circular", { domain: "hv", contact: "tailles 8, 4, 0", a: 80, v: null, temp: "−65…+200 °C", std: "MIL-DTL-38999", seen: "read", note: "par contact : taille 8 46 A · taille 4 80 A · taille 0 150 A", use: "Puissance en milieu sévère" }),
  C("te-msd", "TE Connectivity", "AMP+ Manual Service Disconnect", "msd", { domain: "hv", a: 240, v: 450, sealed: "IPX7, IP6K9K", hvil: true, temp: "−40…+65 °C", std: "USCAR-2, USCAR-37", seen: "read", note: "fusible 200, 250, 350 ou 630 A ; 450 V DC avec fusible, 1000 V DC en version shunt", use: "Coupure de service de la batterie" }),
];

/** Standards a connection or a cell is designed and tested against. `seen` as for the connectors. */
export const ELEC_STANDARDS = [
  { id: "USCAR-2", title: "Performance Specification for Automotive Electrical Connector Systems", covers: "essais des connecteurs basse tension de véhicule", seen: "read" },
  { id: "USCAR-37", title: "High Voltage Connector Performance Supplement to SAE/USCAR-2", covers: "connecteurs haute tension de 60 à 600 V, avec USCAR-2", seen: "excerpt" },
  { id: "LV 215-1", title: "Electrical/Electronic Requirements of HV Connectors", covers: "exigences des constructeurs allemands pour les connecteurs HV ; LV 215-2 en est la spécification d'essai", seen: "excerpt" },
  { id: "LV 214", title: "Spécification d'essai des connecteurs de véhicule (constructeurs allemands)", covers: "connecteurs basse tension ; document non public", seen: "excerpt" },
  { id: "ISO 6469-3", title: "Electrically propelled road vehicles — Safety specifications — Part 3: Electrical safety", covers: "circuits de classe de tension B : protection contre le choc électrique", seen: "excerpt" },
  { id: "IEC 60664-1", title: "Insulation coordination for equipment within low-voltage supply systems — Part 1", covers: "distances dans l'air, lignes de fuite, isolation solide jusqu'à 1000 V AC / 1500 V DC", seen: "excerpt" },
  { id: "ISO 20653", title: "Road vehicles — Degrees of protection (IP code)", covers: "codes IP des véhicules, dont les codes K (IP6K9K)", seen: "excerpt" },
  { id: "IEC 61984", title: "Connectors — Safety requirements and tests", covers: "connecteurs de 50 à 1000 V et jusqu'à 125 A par contact", seen: "excerpt" },
  { id: "UL 1977", title: "Component Connectors for Use in Data, Signal, Control and Power Applications", covers: "connecteurs composants montés en usine", seen: "excerpt" },
  { id: "UL 4128", title: "Intercell and Intertier Connectors for Use in Electrochemical Battery System Applications", covers: "connecteurs entre cellules et entre étages de batterie", seen: "excerpt" },
  { id: "IEC 62852", title: "Connectors for DC-application in photovoltaic systems — Safety requirements and tests", covers: "connecteurs photovoltaïques jusqu'à 1500 V DC et 125 A", seen: "excerpt" },
  { id: "IEC 61076-2-101", title: "Circular connectors — Detail specification for M12 connectors with screw-locking", covers: "M12, 2 à 17 voies, jusqu'à 250 V et 4 A par contact", seen: "read" },
  { id: "IEC 61076-2-104", title: "Circular connectors — Detail specification for circular connectors with M8 screw-locking or snap-locking", covers: "M8", seen: "excerpt" },
  { id: "MIL-DTL-38999", title: "Connectors, Electrical, Circular, Miniature, High Density, Quick Disconnect, Environment Resistant", covers: "quatre séries, −65 à +200 °C", seen: "read" },
  { id: "IEC 62133-2", title: "Secondary cells and batteries — Safety requirements for portable sealed secondary lithium cells — Part 2: Lithium systems", covers: "sécurité des cellules et batteries au lithium portables", seen: "excerpt" },
  { id: "IEC 61960-3", title: "Secondary lithium cells and batteries for portable applications — Part 3: Prismatic and cylindrical lithium secondary cells", covers: "performances, désignation, marquage, dimensions", seen: "read" },
  { id: "UN 38.3", title: "UN Manual of Tests and Criteria, Part III, sub-section 38.3", covers: "essais de transport T.1 à T.8 des piles et batteries au lithium", seen: "excerpt" },
];

/** Cylindrical Li-ion cells : the envelope to design around (largest published dimensions) and the range of what makers publish.
    iec : the designation of IEC 61960-3 (largest dimensions rounded up) — « 18650 » and « 21700 » are trade names. */
export const CELLS = [
  { id: "18650", name: "Cellule Li-ion 18650", iec: "INR19/66", d: 18.6, L: 65.2, dNom: 18.4, LNom: 65.0, mass: [45, 49], capacity: [2.5, 3.5], vNom: 3.6, vMax: 4.2, vMin: 2.5, discharge: [10, 35], std: "IEC 62133-2, IEC 61960-3, UN 38.3", seen: "read" },
  { id: "21700", name: "Cellule Li-ion 21700", iec: "INR22/71", d: 21.7, L: 70.8, dNom: 21.4, LNom: 70.0, mass: [69, 70], capacity: [4.2, 4.9], vNom: 3.6, vMax: 4.2, vMin: 2.5, discharge: [10, 45], std: "IEC 62133-2, IEC 61960-3, UN 38.3", seen: "read" },
  /* A cell of one maker, its sheet read page by page (Molicel, « Cell Specifications of INR-21700-P45B », INR21700P45B-01, ver. 0.2) :
     p. 2 Ø 21,40 ± 0,15 × 70,00 ± 0,15 mm, 70,0 g au plus ; p. 3 4,5 Ah typ. / 4,35 Ah min., 3,6 V nominal, 4,20 ± 0,05 V en fin de charge, 2,5 V
     en fin de décharge, ≤ 8 mΩ (1 kHz, à l'expédition), 9 A en charge continue au plus, 45 A en décharge continue au plus, ambiante 0–60 °C en
     charge et −40–60 °C en décharge, surface de la cellule 0–70 °C et −40–80 °C ; p. 8 conformité (manuel d'épreuves de l'ONU, RoHS, UL 1642,
     IEC 62133) ; p. 13 conception d'un pack (barrière isolante entre cellule et PCBA recommandée). The envelope is the largest the tolerance allows. */
  { id: "21700-P45B", maker: "Molicel", model: "INR-21700-P45B", name: "Cellule Li-ion 21700 Molicel INR-21700-P45B", iec: "INR22/71", d: 21.55, L: 70.15, dNom: 21.4, LNom: 70.0, mass: [70, 70],
    capacity: [4.35, 4.5], vNom: 3.6, vMax: 4.2, vMin: 2.5, discharge: [45, 45], charge: 9, rAc: 8, envDis: [-40, 60], envChg: [0, 60], skinDis: [-40, 80], skinChg: [0, 70],
    std: "Manuel d'épreuves et de critères de l'ONU (transport), RoHS, UL 1642, IEC 62133", seen: "read",
    sheet: { title: "Cell Specifications of INR-21700-P45B", ref: "INR21700P45B-01", ver: "0.2", pages: "p. 2 (dimensions, masse), p. 3 (caractéristiques), p. 8 (conformité), p. 13 (conception d'un pack)" } },
];

export const connector = (id) => CONNECTORS.find((c) => c.id === id) || null;
export const cell = (id) => CELLS.find((c) => c.id === id) || null;
/** Families that carry a current under a voltage, the smallest first. need : { domain, amps, volts, sealed, hvil }. */
export function pickConnectors(need = {}) {
  return CONNECTORS.filter((c) => (!need.domain || c.domain === need.domain) && (!need.kind || c.kind === need.kind) && (!need.amps || c.a >= need.amps) && (!need.volts || (c.v !== null && c.v >= need.volts))
    && (!need.sealed || !!c.sealed) && (!need.hvil || !!c.hvil)).sort((p, q) => p.a - q.a || (p.v || 0) - (q.v || 0));
}
