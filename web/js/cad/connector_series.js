/* DesignOrbit.ai — the dimensions of each series of connectors of the library, as its maker publishes them : what the
   generators of connector_models.js need to rebuild the series — its pitch, its rows, how its length grows with the number
   of circuits, its depth, its height, its pin, the hole in the board, its colour. Nothing is copied from a maker : no
   drawing, no model, no logo — numbers read on a data sheet, and a geometry of our own built from them.
   Each series says how its dimensions were checked (`dims`) and what exactly was read, where (`basis`) :
     "read"  — read on the maker's data sheet or drawing, opened and looked at ;
     "part"  — the pitch, the rows, the colour, the solder tail were read on the product page ; the body was typed from memory ;
     "typed" — typed from memory, of the right order of magnitude : good for a picture and a first layout, to be checked.
   The data sheet of the part actually bought always prevails. Lengths in millimetres. Pure. */

const NAT = "#f1ede2", IVORY = "#ece4cd", BEIGE = "#d8cdb0", BLACK = "#23262b", ORANGE = "#f08a24", GREY = "#8d9297", TYPED = "Enveloppe saisie de mémoire, de l'ordre de grandeur de la série : aucune cote relue sur la fiche. Bon pour un aperçu et une première implantation ; à remplacer par le modèle du fabricant avant de figer.";
const hv = (o) => ({ model: "hvheader", flangeT: 3, flangeE: 8, fix: 4.3, hvil: true, color: ORANGE, dims: "typed", basis: `${TYPED} Le calibre et la forme du contact (rond ou lame) viennent du nom de la série ; verrou, levier et tours : de mémoire.`, ...o });
const sealed = (o) => ({ model: "sealed", dims: "typed", basis: TYPED, ...o });

/** connector id (cad/elec_library.js) → the dimensions of its series. `ref` : the part family the model is built on ; `pkg` : the
    name of its land pattern on a board (« <pkg>-<n> ») ; the other keys are read by the generator named by `model`. */
export const SERIES = {
  /* ---- board-mounted, low voltage ---- */
  "jst-ph": { model: "shroud", ref: "B*B-PH-K-S (top entry, through-hole)", pkg: "JST-PH", pitch: 2.0, ends: 3.9, depth: 4.5, height: 6.0, y0: 1.7, wall: 0.5, floor: 1.2, slots: [0.3, 0.7], slotW: 0.9, pin: 0.5, tail: 3.4, pinUp: 4.6, drill: 0.7, ring: 0.25, color: NAT, dims: "read",
    basis: "Fiche JST de la série PH, embase droite traversante : pas 2,0 ; A = (n − 1) × 2,0 ; B = A + 3,9 ; profondeur 4,5, rangée à 1,7 d'un bord ; hauteur 6,0 ; picot carré 0,5, queue 3,4 ; trou Ø0,7 (+0,1) ; PA 66 naturel. Épaisseur des parois et fentes de verrouillage : non cotées, dessinées à l'œil." },
  "jst-xh": { model: "shroud", ref: "B*B-XH-A (top entry, through-hole)", pkg: "JST-XH", pitch: 2.5, ends: 4.9, depth: 5.75, height: 7.0, y0: 2.35, wall: 0.7, floor: 1.3, slots: [0.28, 0.72], slotW: 1.2, pin: 0.64, tail: 3.4, pinUp: 5.5, drill: 0.9, ring: 0.35, color: "#f3f0e6", dims: "read",
    basis: "Fiche JST de la série XH, embase droite traversante : pas 2,5 ; A = (n − 1) × 2,5 ; B = A + 4,9 ; profondeur 5,75, rangée à 2,35 d'un bord ; hauteur 7,0 ; picot carré 0,64, queue 3,4 ; trou Ø0,9 (+0,1) à partir de 3 circuits, Ø1,0 à 2 circuits ; PA 66 naturel. Parois et fentes : dessinées à l'œil." },
  "jst-gh": { model: "shroud", ref: "BM*B-GHS-TBT (top entry, SMT)", pkg: "JST-GH", pitch: 1.25, ends: 4.5, depth: 4.25, height: 4.05, wall: 0.45, floor: 0.8, front: 0.7, lead: [0.25, 1.0], pad: [0.6, 1.7], leadSide: 1, tab: [1.0, 2.8], color: IVORY, dims: "part",
    basis: "Fiche JST de la série GH : pas 1,25, 2 à 15 circuits, embase CMS à pattes de fixation, PA 9T naturel (ivoire) — lus. Les cotes ne s'affichent pas dans la copie consultée : B = A + 4,5 et la hauteur 4,05 viennent d'un extrait ; profondeur, plages et pattes sont saisies, à relire sur le motif recommandé." },
  "molex-picoblade": { model: "shroud", ref: "53047 (vertical, through-hole)", pkg: "PICOBLADE", pitch: 1.25, ends: 3.0, depth: 3.2, height: 4.2, wall: 0.4, floor: 0.9, slots: (n) => (n < 4 ? [0.5] : [0.3, 0.7]), slotW: 0.8, pin: 0.32, tail: 2.3, pinUp: 3.2, drill: 0.5, ring: 0.2, color: "#e6dcc0", dims: "read",
    basis: "Dessin client Molex 530470001-SD (PicoBlade 1.25, embase verticale traversante) : pas 1,25 ; longueur (n − 1) × 1,25 + 3,0 (4,25 à 2 circuits, 20,5 à 15) ; profondeur 3,2 ; hauteur 4,2 ; queue 2,3 ; picot 0,32 ; trou Ø0,5 ± 0,05 ; une fenêtre de verrouillage à 2 et 3 circuits, deux à partir de 4 ; polyamide chargé verre, naturel (beige). Épaisseur des parois : dessinée à l'œil." },
  "molex-microfit": { model: "shroud", ref: "43045 (vertical, dual row, through-hole, without peg)", pkg: "MICROFIT", pitch: 3.0, rows: 2, rowPitch: 3.0, byRow: true, ends: 6.65, depth: 7.1, height: 9.9, floor: 1.6, silos: 2.5, latch: [3.0, 1.0, 2.6, 7.3], pin: 0.64, tail: 3.18, pinUp: 7.5, drill: 1.02, ring: 0.4, color: BLACK, dims: "part",
    basis: "Page du produit Molex 43045 : pas 3,00, double rangée, verticale, queue 3,18, noir, hauteur accouplée 17,64 — lus. Longueur 3,00 × colonnes + 3,65, profondeur, hauteur du corps 9,9 et trou Ø1,02 : saisis de mémoire, non relus sur le dessin. Modèle sans pion de détrompage : la version à pion demande un trou de plus." },
  "molex-minifit": { model: "shroud", ref: "5566 (vertical, dual row, through-hole, without pegs)", pkg: "MINIFIT", pitch: 4.2, rows: 2, rowPitch: 5.5, byRow: true, ends: 5.4, depth: 9.6, y0: 1.85, height: 12.8, floor: 2.2, silos: 3.5, latch: [3.4, 1.4, 3.1, 9.7], pin: 1.07, tail: 3.5, pinUp: 9.5, drill: 1.4, ring: 0.5, color: "#f0ebdc", dims: "read",
    basis: "Dessin client Molex SD-5566-002 (embase verticale sans pions) : pas 4,20 ; rangées à 5,50 ; longueur (colonnes − 1) × 4,2 + 5,4 ; profondeur 9,6 ; hauteur 12,8 ; queue 3,5 ; trou Ø1,40 ; verrou de 3,4 de large ; circuits numérotés rangée par rangée ; nylon 6/6 naturel. Section du picot (1,07) : saisie." },
  "molex-nanofit": { model: "shroud", ref: "105310 (vertical, dual row, through-hole, kinked pins)", pkg: "NANOFIT", pitch: 2.5, rows: 2, rowPitch: 2.5, byRow: true, ends: 3.5, depth: 8.2, height: 6.66, floor: 1.3, silos: 2.0, latch: [2.4, 0.9, 2.0, 4.6], pin: 0.64, tail: 3.2, pinUp: 4.8, drill: 1.2, ring: 0.3, color: "#24272c", dims: "part",
    basis: "Page du produit Molex 105310 et brochure Nano-Fit : pas 2,50, double rangée, verticale, picots coudés, queue 3,20, LCP noir ; 6,0 de large et 6,66 de haut à 2 circuits — lus. Profondeur de la double rangée et trou : saisis, non relus sur le dessin." },
  "hirose-df13": { model: "shroud", ref: "DF13-nP-1.25DSA (straight, through-hole)", pkg: "DF13", pitch: 1.25, ends: 2.9, depth: 3.4, y0: 1.05, height: 4.3, wall: 0.4, floor: 0.9, slots: [0.5], slotW: 0.8, pin: 0.35, tail: 2.3, pinUp: 3.3, drill: 0.6, ring: 0.15, color: BEIGE, dims: "read",
    basis: "Catalogue Hirose DF13, embase droite traversante : pas 1,25 ; A = (n − 1) × 1,25 ; B = A + 2,9 ; profondeur 3,4, rangée à 2,35 d'un bord ; hauteur 4,3 ; queue 2,3 ; picot 0,35 × 0,35 ; trou Ø0,6 ± 0,03 ; polyamide beige." },
  "hirose-fh12": { model: "ffc", ref: "FH12-nS-0.5SH (0.5 mm, bottom contact)", pkg: "FH12", pitch: 0.5, length: (cols) => (cols - 1) * 0.5 + 4.6, depth: 5.6, height: 2.0, lead: [0.2, 0.8], pad: [0.3, 1.25], tab: [1.8, 2.2], color: "#e8e2d2", lock: "#3b3d42", dims: "read",
    basis: "Catalogue Hirose FH12, 0,5 mm, contact dessous : A = (n − 1) × 0,5 ; longueur hors tout A + 4,6 ; hauteur 2,0 ; profondeur 5,6 volet compris ; de 6 à 53 contacts. Plages de la carte, pattes de fixation et couleurs : saisies, à relire sur le motif recommandé." },
  "hirose-df40": { model: "mezz", ref: "DF40C (header, 0.4 mm)", pkg: "DF40", pitch: 0.4, rows: 2, length: (cols) => (cols - 1) * 0.4 + 3.4, depth: 2.2, height: 1.5, lead: [0.18, 0.5], pad: [0.23, 0.7], color: "#2a2c30", dims: "typed", basis: `${TYPED} Pas de 0,4 et hauteur d'empilage : ceux de la série.` },
  "phoenix-mstb": { model: "terminal", ref: "MSTBA 2,5/n-G-5,08 (header, horizontal)", pkg: "MSTB", pitch: 5.08, ends: 5.08, depth: 12.0, height: 8.6, y0: 8.0, wall: 1.0, floor: 1.2, pin: 1.0, tail: 3.5, pinUp: 4.0, drill: 1.4, ring: 0.6, color: "#4a9a52", dims: "typed",
    basis: "COMBICON MSTBA 2,5 : pas 5,08 vu en extrait ; longueur n × 5,08, largeur 12, hauteur 8,6, picot 1 × 1, trou Ø1,4 : saisis de mémoire — le site du fabricant a refusé la lecture automatique." },
  "samtec-tsw": { model: "strip", ref: "TSW (0.100\" strip, single row)", pkg: "TSW", pitch: 2.54, ends: 2.54, depth: 2.54, height: 2.54, pin: 0.64, tail: 3.0, pinUp: 8.38, drill: 1.02, ring: 0.34, color: "#1e2024", dims: "typed",
    basis: "Barrette au pas de 2,54 : isolant de 2,54 × 2,54 par broche, broche carrée 0,64, 5,84 au-dessus de l'isolant, trou Ø1,02 — valeurs d'usage du pas de 0,1 po, saisies ; la fiche donne les longueurs de broche de chaque variante." },
  "d-sub": { model: "dsub", ref: "DE-9 · DA-15 · DB-25 · DC-37 · DD-50 (vertical, through-hole)", pkg: "DSUB", sizes: { 9: [30.81, 24.99, 16.92], 15: [39.14, 33.32, 25.25], 25: [53.04, 47.04, 38.96], 37: [69.32, 63.5, 55.42], 50: [66.93, 61.11, 52.81] }, pitch: 2.77, rowPitch: 2.84, depth: 12.55, shell: 8.36, flange: 0.8, height: 6.8, fix: 3.1, pin: 1.0, tail: 3.0, drill: 1.1, color: "#22252a", dims: "typed",
    basis: "Cotes d'usage du D-subminiature (MIL-DTL-24308) : bride, entraxe des fixations et coquille par taille (DE-9 30,81 / 24,99 / 16,92 … DD-50 66,93 / 61,11 / 52,81), pas 2,77, rangées à 2,84 — saisies de mémoire, la norme n'a pas été relue." },
  /* ---- circular ---- */
  m8: { model: "circular", ref: "M8 panel receptacle", thread: 8, nut: 13, nutT: 3, nose: 7, body: 9, back: 10, circle: 3.2, pin: 1.0, color: "#2b2e34", dims: "typed", basis: `${TYPED} Filetage M8 × 1 : celui de la norme.` },
  "m12-a": { model: "circular", ref: "M12 A-coded panel receptacle", thread: 12, nut: 17, nutT: 3.5, nose: 9, body: 14, back: 12, circle: 5.0, pin: 1.0, color: "#2b2e34", dims: "typed", basis: `${TYPED} Filetage M12 × 1 : celui de la norme.` },
  d38999: { model: "circular", ref: "Series III wall-mount receptacle, shell size 13", flange: 28.6, holes: 23.0, flangeT: 2.4, fix: 3.2, thread: 18, nose: 13, body: 20, back: 16, circle: 9, pin: 1.0, color: "#3a3d33", shell: "#6d6b48", dims: "typed", basis: `${TYPED} Taille de boîtier 13, bride carrée, exemple de la série III.` },
  "d38999-power": { model: "circular", ref: "Series III wall-mount receptacle, shell size 25, power contacts", flange: 44.5, holes: 38.1, flangeT: 3.0, fix: 3.9, thread: 37, nose: 14, body: 40, back: 20, circle: 18, pin: 3.6, color: "#3a3d33", shell: "#6d6b48", dims: "typed", basis: `${TYPED} Taille de boîtier 25, contacts de taille 8, exemple de la série III.` },
  /* ---- harness housings ---- */
  "molex-mx150": sealed({ ref: "MX150 sealed receptacle", size: (cols, rows) => [cols * 3.5 + 8, rows * 3.5 + 9.5, 32], rowsOf: (n) => (n > 3 ? 2 : 1), cavity: 2.2, contact: 1.5, color: "#22252a", seal: "#5b8fa8" }),
  "te-superseal": sealed({ ref: "AMP Superseal 1.5 plug housing", size: (cols, rows) => [cols * 6 + 6, rows * 7.5 + 9, 38], rowsOf: (n) => (n === 6 ? 2 : 1), cavity: 3.6, contact: 1.5, color: "#1f2226", seal: "#2f8f5a" }),
  "te-deutsch-dt": sealed({ ref: "DT plug with wedgelock", size: (cols, rows) => [cols * 6.9 + 9, rows * 6.9 + 9.5, 42], rowsOf: (n) => (n > 3 ? 2 : 1), cavity: 3.4, contact: 1.6, color: GREY, wedge: "#e97c2c", seal: "#6f757c", basis: `${TYPED} Contact de taille 16 (Ø1,6) ; verrou de coin orange : couleur d'usage de la série.` }),
  "te-deutsch-dtm": sealed({ ref: "DTM plug with wedgelock", size: (cols, rows) => [cols * 4.6 + 8, rows * 5.6 + 8.5, 38], rowsOf: (n) => (n > 3 ? 2 : 1), cavity: 2.4, contact: 1.0, color: GREY, wedge: "#e97c2c", seal: "#6f757c", basis: `${TYPED} Contact de taille 20 (Ø1,0) ; verrou de coin orange : couleur d'usage de la série.` }),
  "aptiv-metripack150": sealed({ ref: "Metri-Pack 150 unsealed housing", size: (cols, rows) => [cols * 4.2 + 5, rows * 6 + 6, 24], rowsOf: (n) => (n > 4 ? 2 : 1), seal: false, cavity: 2.6, contact: 1.5, color: "#1e2125" }),
  "aptiv-weatherpack": sealed({ ref: "Weather Pack tower housing", size: (cols) => [cols * 8.4 + 4, 17, 30], rowsOf: () => 1, towers: 12, cavity: 3.6, contact: 2.0, color: "#1b1d21", seal: "#3f8e5a" }),
  /* ---- high voltage, shielded headers ---- */
  "te-hva280": hv({ ref: "HVA 280 header, 2 positions (2103124)", size: (n) => [31.4 + (n - 2) * 10.4, 26.6, 20, 15], pitch: 10.4, port: 7, contact: 2.8, blade: 0.8, flangeE: 7, cpa: "#e9e9e4", dims: "part",
    basis: "Pages des produits TE : embase 2 voies 2103124-1 — entraxe 10,4, 45,4 × 40,6 hors tout, languette de 2,8 ; fiche 5-2103177-1 — 51,25 × 32,9 × 26,4, PA GF orange — lus. Profondeur de l'embase et de son nez, verrou : saisis." }),
  "te-hva630": hv({ ref: "HVA 630 header, 2 positions (2141272)", size: (n) => [38 + (n - 2) * 9.4, 38, 30, 22], pitch: 9.4, port: 10, contact: 6.3, blade: 0.8, flangeE: 6, cpa: "#e9e9e4", dims: "part",
    basis: "Page du produit TE YHVA630-2PHM (boîtier 2 voies) : entraxe 9,4, 37,6 × 38,3 × 71,3, orange, languette de 6,3 — lus ; embase 2 voies de 50 × 50 hors tout : vue en extrait. Profondeur de l'embase, verrou : saisis." }),
  "te-hvp800": hv({ ref: "HVP 800 header", size: (n) => [n * 30 + 14, 42, 52, 28], port: 20, contact: 8, flangeE: 9, fix: 5.3, towers: true, lever: "#26282c" }),
  "te-hcstak25": hv({ ref: "HC-STAK 25 header", size: (n) => [n * 34 + 12, 36, 58, 26], port: 24, contact: 16, blade: 2.5, flangeE: 9, fix: 5.3, lever: "#26282c" }),
  "te-hcstak35": hv({ ref: "HC-STAK 35 header", size: (n) => [n * 42 + 14, 42, 68, 30], port: 32, contact: 22, blade: 3.5, flangeE: 10, fix: 6.4, lever: "#26282c" }),
  "amphenol-powerlok": hv({ ref: "PowerLok 300 receptacle", size: (n) => [n * 32 + 14, 44, 56, 30], port: 22, contact: 10, flangeE: 9, fix: 5.3, towers: true, cpa: "#26282c" }),
  "amphenol-hvsl282": hv({ ref: "HVSL 282 header", size: (n) => [n * 10 + 14, 20, 26, 14], port: 6.5, contact: 2.8, blade: 0.8, flangeE: 6, cpa: "#26282c" }),
  "amphenol-hvsl630": hv({ ref: "HVSL 630 header", size: (n) => [n * 13 + 16, 26, 32, 17], port: 9.5, contact: 6.3, blade: 0.8, cpa: "#26282c" }),
  "amphenol-hvsl800": hv({ ref: "HVSL 800 header", size: (n) => [n * 27 + 14, 38, 48, 26], port: 18, contact: 8, flangeE: 9, fix: 5.3, cpa: "#26282c" }),
  "amphenol-hvsl1000": hv({ ref: "HVSL 1000 header", size: (n) => [n * 31 + 14, 42, 52, 28], port: 21, contact: 10, flangeE: 9, fix: 5.3, towers: true, cpa: "#26282c" }),
  "amphenol-hvsl1200": hv({ ref: "HVSL 1200 header", size: (n) => [n * 36 + 16, 48, 58, 30], port: 25, contact: 12, flangeE: 10, fix: 6.4, towers: true, lever: "#26282c" }),
  "rosenberger-hvr200": hv({ ref: "HVR 200 header", size: (n) => [n * 26 + 12, 32, 46, 24], port: 17, contact: 6, hvil: false, cpa: "#e9e9e4" }),
  "molex-imperium": hv({ ref: "Imperium header", size: (n) => [n * 30 + 14, 40, 50, 28], port: 20, contact: 8, flangeE: 9, fix: 5.3, towers: true, cpa: "#e9e9e4" }),
  /* ---- power, one or two poles ---- */
  "amphenol-surlok-57": { model: "barrel", ref: "SurLok Plus 5.7 mm right-angle plug", barrel: 20, length: 46, contact: 5.7, elbow: 22, color: ORANGE, dims: "typed", basis: `${TYPED} Contact de 5,7 : celui de la série.` },
  "amphenol-surlok-8": { model: "barrel", ref: "SurLok Plus 8 mm right-angle plug", barrel: 26.2, length: 41.2, contact: 8, elbow: 60, color: ORANGE, dims: "part",
    basis: "Fiche Amphenol IDS-96-2 (SurLok Plus 8,0 mm) : fiche coudée A 26,2 · B 41,2 · C 86,2 · D 25,8 ; fiche droite 82,5 × 34,3 × 30,0 ; embase 25,15 · 22,85 · 2,5 · 23,5 — lus dans les tableaux. L'attribution des lettres aux cotes est lue sur de petites vues : à confirmer sur le dessin." },
  "amphenol-surlok-103": { model: "barrel", ref: "SurLok Plus 10.3 mm right-angle plug", barrel: 30, length: 62, contact: 10.3, elbow: 30, color: ORANGE, dims: "typed", basis: `${TYPED} Contact de 10,3 : celui de la série.` },
  "staubli-mc4": { model: "coupler", ref: "MC4 male cable coupler (PV-KST4)", d: 18.8, length: 61, contact: 4, color: "#17191c", dims: "read",
    basis: "Catalogue Stäubli, coupleurs MC4 : PV-KST4 d'environ 61 de long, PV-KBT4 d'environ 58, Ø18,8, contact Ø4 — lus. Manchon et écrou de câble : dessinés à l'œil." },
  "anderson-pp45": { model: "stack", ref: "Powerpole PP15/45 housing", block: [7.9, 7.9, 24.6], colors: ["#c62828", "#1b1c1f"], color: "#c62828", dims: "read", basis: "Catalogue Anderson Power, Powerpole : face de 7,9 × 7,9, boîtier de 24,6 de long, 41,2 accouplé — lus ; les boîtiers s'empilent en queue d'aronde. Rouge et noir : deux des couleurs du catalogue." },
  "anderson-pp75": { model: "stack", ref: "Powerpole PP75 housing", block: [15.9, 15.9, 47.9], colors: ["#c62828", "#1b1c1f"], color: "#c62828", dims: "read", basis: "Catalogue Anderson Power, Powerpole : face de 15,9 × 15,9, boîtier de 47,9 de long, 81,3 accouplé — lus ; les boîtiers s'empilent en queue d'aronde. Rouge et noir : deux des couleurs du catalogue." },
  "anderson-pp120": { model: "stack", ref: "Powerpole PP120 housing", block: [22.2, 22.2, 69.9], colors: ["#c62828", "#1b1c1f"], color: "#c62828", dims: "read", basis: "Catalogue Anderson Power, Powerpole : face de 22,2 × 22,2, boîtier de 69,9 de long, 117,5 accouplé — lus ; les boîtiers s'empilent en queue d'aronde. Rouge et noir : deux des couleurs du catalogue." },
  "anderson-pp180": { model: "stack", ref: "Powerpole PP180 housing", block: [28.6, 28.6, 82.6], colors: ["#c62828", "#1b1c1f"], color: "#c62828", dims: "read", basis: "Catalogue Anderson Power, Powerpole : face de 28,6 × 28,6, boîtier de 82,6 de long, 129,7 accouplé — lus ; les boîtiers s'empilent en queue d'aronde. Rouge et noir : deux des couleurs du catalogue." },
  "anderson-sb50": { model: "flat", ref: "SB50 housing", size: [48.0, 36.6, 15.7], holes: 22, fix: 4.6, color: GREY, dims: "typed", basis: `${TYPED} Couleur d'exemple : chez le fabricant, la couleur du boîtier est un détrompage.` },
  "anderson-sb175": { model: "flat", ref: "SB175 housing", size: [79.6, 55.6, 25.4], holes: 28.6, fix: 6.5, color: "#b9392e", dims: "read", basis: "Catalogue Anderson Power, SB175 : boîtier de 79,6 × 55,6 × 25,4, 133,4 accouplé, deux trous de fixation Ø6,5 — lus. La couleur est un détrompage de tension (rouge : 24 V au catalogue). Entraxe des trous : lu sur une petite vue, à confirmer." },
  "anderson-sb350": { model: "flat", ref: "SB350 housing", size: [107.9, 69.9, 33.3], holes: 34.9, fix: 6.6, color: "#2f5fa8", dims: "read", basis: "Catalogue Anderson Power, SB350 : boîtier de 107,9 × 69,9 × 33,3, 182,6 accouplé, deux trous de fixation Ø6,6 — lus. La couleur est un détrompage de tension (bleu au catalogue). Entraxe des trous : lu sur une petite vue, à confirmer." },
  "amass-xt60": { model: "flat", ref: "XT60H-M plug with cap", size: [23.8, 15.4, 9.2], gap: 7.2, pinD: 3.5, chamfer: 2.0, color: "#f0c22e", dims: "read", basis: "Fiche Amass XT60H-M (V1.2) : face de 15,40 × 9,20, contacts à 7,20, longueur 23,80 (20,50 sans le capot) — lus sur le dessin. Diamètre des contacts (3,5) et coin détrompeur : ceux de la série, non cotés." },
  "amass-xt90": { model: "flat", ref: "XT90H-M plug with cap", size: [30.7, 21.3, 10.7], pinD: 4.5, chamfer: 2.6, color: "#f0c22e", dims: "read", basis: "Fiche Amass XT90H-M : 21,30 × 10,70 × 30,70 avec le capot — lus sur le dessin. Entraxe et diamètre des contacts (4,5) : non cotés sur la vue, saisis." },
  "te-msd": { model: "disconnect", ref: "Manual Service Disconnect, base and plug", base: [110, 60, 45, 40], flangeT: 4, flangeE: 10, fix: 5.3, color: ORANGE, lever: "#26282c", dims: "typed", basis: TYPED },
};

/** What a model is called : English, as the trade names it — and its French word for the glossary. */
export const MODEL_WORDS = {
  shroud: { label: "Shrouded header", fr: "embase à jupe" }, strip: { label: "Pin header", fr: "barrette à broches" }, terminal: { label: "Pluggable terminal block header", fr: "embase de bornier débrochable" }, dsub: { label: "D-subminiature connector", fr: "connecteur D-subminiature" },
  ffc: { label: "FFC / FPC connector", fr: "connecteur de nappe à volet" }, mezz: { label: "Mezzanine connector", fr: "connecteur mezzanine" }, sealed: { label: "Harness housing", fr: "boîtier de faisceau" }, circular: { label: "Circular connector", fr: "connecteur circulaire" },
  hvheader: { label: "Shielded HV header", fr: "embase haute tension blindée" }, barrel: { label: "Single-pole power connector", fr: "connecteur de puissance unipolaire" }, stack: { label: "Stackable power housing", fr: "boîtier de puissance empilable" },
  flat: { label: "Two-pole power connector", fr: "connecteur de puissance bipolaire" }, coupler: { label: "Cable coupler", fr: "coupleur de câble" }, disconnect: { label: "Service disconnect", fr: "sectionneur de service" },
};
/** How the dimensions of a series were checked : the word shown, its colour class, what it means. */
export const DIMS_LEVELS = {
  read: { label: "cotes lues", tone: "ok", hint: "Cotes relevées sur la fiche ou le dessin du fabricant, ouvert et lu." },
  part: { label: "cotes lues en partie", tone: "info", hint: "Pas, rangées, couleur et queue lus sur la page du produit ; le corps est saisi de mémoire — à comparer au dessin avant de figer l'empreinte." },
  typed: { label: "cotes à vérifier", tone: "warn", hint: "Enveloppe saisie de mémoire, de l'ordre de grandeur de la série : bonne pour un aperçu et une première implantation, à vérifier sur la fiche." },
};
/* the maker's own site : where the official drawing and the official STEP of a part number are — the address of the site, no deep link that would go stale */
const SITES = { JST: "https://www.jst-mfg.com", Molex: "https://www.molex.com", "TE Connectivity": "https://www.te.com", Aptiv: "https://www.aptiv.com", Hirose: "https://www.hirose.com", "Phoenix Contact": "https://www.phoenixcontact.com", Samtec: "https://www.samtec.com",
  Amphenol: "https://www.amphenol.com", Rosenberger: "https://www.rosenberger.com", "Stäubli": "https://www.staubli.com", "Anderson Power": "https://www.andersonpower.com" };
export const makerSite = (maker) => SITES[maker] || null;

/** The dimensions of the series of a connector of the library, or null. */
export const seriesOf = (id) => SERIES[id] || null;
/** The series that sit on a board, by the name of their land pattern : { pkg : connector id }. */
export const SERIES_PACKAGES = Object.fromEntries(Object.entries(SERIES).filter(([, S]) => S.pkg).map(([id, S]) => [S.pkg, id]));
/** How many series stand at each level : { read, part, typed }. */
export const dimsCount = () => Object.values(SERIES).reduce((n, S) => { n[S.dims] = (n[S.dims] || 0) + 1; return n; }, {});
