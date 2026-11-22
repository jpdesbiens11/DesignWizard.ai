/* DynamiteOrbit — DFx : the titles of the rules, in English, as the trade names what they check. A rule is written with
   its French title (dfx_rules_*.js, dfa_rules.js) ; `rule()` shows the English one and keeps the French word (`fr`) for the
   glossary of the Help. The limit, the reason and the fix of a rule stay in French : they are the explanation. Pure. */

export const RULE_TITLES = {
  /* CNC milling and turning */
  "Rayon intérieur des pockets": "Pocket inside radius", "Profondeur de pocket": "Pocket depth", "Profondeur de perçage": "Hole depth", "Ø de perçage standard": "Standard drill size", "Avant-trou de taraudage": "Tap drill size",
  "Longueur de filetage utile": "Useful thread length", "Fond de trou borgne": "Blind hole bottom", "Parois minces": "Thin walls", "Trou trop près d'un bord": "Hole too close to an edge", "Nombre de set-ups": "Number of set-ups",
  "Congés et chanfreins minuscules": "Tiny fillets and chamfers", "Brut (stock size)": "Stock size", "Élancement de la pièce tournée": "Turned part slenderness", "Pièce de révolution": "Part of revolution",
  "Angles vifs intérieurs du profil": "Sharp inside corners of the profile", "Barre standard": "Standard bar stock",
  /* sheet metal and laser cutting */
  "Pli pas trop serré": "Minimum bend radius", "Bord plié assez long": "Minimum flange length", "Trous loin des plis": "Hole-to-bend distance", "Trous loin des bords": "Hole-to-edge distance", "Matière entre les trous": "Hole-to-hole web",
  "Trous pas trop petits": "Minimum hole size", "Dégagements d'angle": "Bend reliefs", "Largeur des découpes": "Cut-out width", "Épaisseur en stock": "Stock thickness", "Pliage des plastiques": "Bending plastics",
  "Stratifié : pas de pliage": "Laminate: no bending", "Découpe traversante seulement": "Through cuts only", "Pièce plate, épaisseur découpable": "Flat part, cuttable thickness", "Stratifié : distance au bord": "Laminate: edge distance",
  "Stratifié : pas entre trous": "Laminate: hole pitch", "Rayon de fraise (router)": "Router bit radius", "Matière qui se découpe au laser": "Laser-cuttable material", "Épaisseur dans la plage du laser, par matière": "Thickness within the laser range, by material",
  "Plus petit détail découpé": "Smallest cut feature", "Pont de matière entre deux découpes": "Web between two cuts", "Angles rentrants arrondis (matières fragiles et feuilles minces)": "Rounded inside corners (brittle materials and thin sheets)",
  "État du bord coupé": "Cut edge condition",
  /* extrusion */
  "Bloc « extrusion » présent": "“extrusion” block present", "Paroi minimale": "Minimum wall thickness", "Parois uniformes": "Uniform walls", "Rapport de languette (tongue ratio)": "Tongue ratio", "Rayons sur tous les angles": "Radii on every corner",
  "Creux (hollows)": "Hollows", "Cercle circonscrit (CCD)": "Circumscribing circle diameter (CCD)", "Masse linéique": "Weight per metre", "Symétrie": "Symmetry", "Enveloppes intérieures / extérieures": "Inner and outer envelopes",
  "Longueur et barre standard": "Length and standard bar", "Tolérances d'extrusion": "Extrusion tolerances", "Plastique : pas de section massive": "Plastic: no thick section",
  /* molding and casting */
  "Paroi dans la plage matière": "Wall within the material range", "Bossages": "Bosses", "Rayons intérieurs": "Inside radii", "UL94 à l'épaisseur réelle": "UL94 at the actual thickness", "Longueur d'écoulement": "Flow length",
  "Clips élastiques": "Snap-fits", "Paroi dans la plage de l'alliage": "Wall within the alloy range", "Reprises d'usinage": "Machining allowances", "Trous venus de fonderie": "Cast-in holes", "Sections massives": "Thick sections",
  /* 3D printing */
  "Paroi au-dessus du minimum du process": "Wall above the process minimum", "Classe de flamme": "Flame rating", "Jeu avec le contenu / ajustements": "Clearance to the content / fits", "Tient dans la machine": "Fits in the build volume",
  "Trous": "Holes", "Orientation et supports": "Orientation and supports", "Jeu d'assemblage": "Assembly clearance", "Angles intérieurs arrondis": "Rounded inside corners", "Congé imprimable": "Printable fillet",
  "Matière et procédé d'impression accordés": "Material and printing process match", "Surplombs et supports": "Overhangs and supports", "Ce que la matière demande après l'impression": "Post-processing the material requires",
  "Sections massives (MJF)": "Thick sections (MJF)", "Cavités : la poudre ou la résine doit sortir": "Cavities: powder or resin must escape", "Paroi minimale (métal)": "Minimum wall thickness (metal)", "Trous et filetages (métal)": "Holes and threads (metal)",
  "Tient sur le plateau (métal)": "Fits on the build plate (metal)", "Surfaces fonctionnelles reprises en usinage (métal)": "Functional surfaces machined after printing (metal)",
  /* board */
  "Bloc « pcb » présent": "“pcb” block present", "Trou au bord de carte": "Hole at the board edge", "Couronne de tête de vis": "Screw head keep-out", "Rayon de détourage": "Routing radius", "Carte plane": "Flat board",
  "Épaisseur standard": "Standard thickness", "Composant au bord de carte": "Component at the board edge", "Composants superposés": "Overlapping components", "Zones et nets déclarés": "Declared zones and nets",
  "Espacement entre zones": "Zone-to-zone spacing", "Cuivre au bord de carte": "Copper at the board edge", "Zones sous tension et trous de fixation": "Live zones and mounting holes", "Accès aux connecteurs": "Connector access",
  "Composants près des trous de fixation": "Components near mounting holes",
  /* purchased parts, interfaces, general */
  "Utiliser tel quel": "Use as is", "Modèle simplifié": "Simplified model", "Visserie et aluminium": "Fasteners and aluminium", "Référence fournisseur": "Supplier part number", "Vis trop près du bord": "Screw too close to the edge",
  "Longueur de filet en prise": "Thread engagement length", "Élancement des colonnettes et bossages": "Standoff and boss slenderness", "Paroi autour des inserts": "Wall around inserts", "Jeu des trous de passage": "Clearance hole size",
  "Trous de passage sur pièce creuse": "Clearance holes on a hollow part", "Interface sans clé ni partenaire": "Interface without key or partner", "Matière connue": "Known material", "Process connu": "Known process",
  "Matière adaptée au process": "Material suits the process", "Budget de masse": "Mass budget", "Rôle électrique des pièces conductrices": "Electrical role of conductive parts", "Paramètres dans leur plage": "Parameters within range",
  "Erreur de construction": "Build error", "Avertissement de construction": "Build warning",
  /* assembly */
  "Aucune interférence": "No interference", "Pièces reliées à une pièce fixe": "Parts tied to a fixed part", "Interfaces toutes appariées": "All interfaces mated", "Interfaces liées identiques": "Linked interfaces identical",
  "Variété de la visserie": "Fastener variety", "Nombre de fixations": "Fastener count", "Nombre de pièces (minimum théorique)": "Part count (theoretical minimum)", "Directions d'assemblage": "Assembly directions",
  "Assemblage par le dessus (top-down)": "Top-down assembly", "Pièces lourdes et centrage": "Heavy parts and locating", "Détrompage (poka-yoke)": "Mistake-proofing (poka-yoke)", "Liaisons valides": "Valid mates",
  "Moteur de règles": "Rule engine", "Assemblage impossible à évaluer": "Assembly cannot be evaluated",
  /* board : design rules of the layout (DRC) */
  "Court-circuit": "Short circuit", "Isolement entre nets": "Net-to-net clearance", "Largeur de piste": "Trace width", "Connexions à router": "Unrouted connections", "Perçage trop petit": "Drill too small",
  "Couronne insuffisante": "Insufficient annular ring", "Trous trop proches": "Holes too close", "Via dans une pastille": "Via in pad", "Composant hors de la carte": "Component off the board", "Composant près du bord": "Component near the edge",
  "Sous la tête de vis": "Under the screw head", "Composant non placé": "Unplaced component", "Pont de vernis épargne": "Solder mask dam", "Composants des deux côtés": "Components on both sides", "Composants traversants": "Through-hole components",
  "Mires de placement": "Fiducials", "Orientation des composants polarisés": "Polarized component orientation", "Nomenclature": "Bill of materials", "Découplage éloigné": "Decoupling too far", "Accès de test": "Test access",
  "Épaisseur de carte": "Board thickness", "Quatre couches sans plan": "Four layers without a plane", "Cuivre épais et pistes fines": "Heavy copper with fine traces", "Grande carte": "Large board", "Trous de fixation": "Mounting holes",
  "Haute tension": "High voltage", "Vernis conseillé": "Conformal coating advised", "Masquage du vernis": "Coating masking", "Essais avant vernissage": "Tests before coating",
  /* board : electrical rules of the schematic (ERC) */
  "Alimentation sans source": "Power net without a source", "Bloc sans fonction": "Block without a function", "Broche non connectée": "Unconnected pin", "Circuit intégré sans découplage": "IC without decoupling",
  "Deux sources sur un même net": "Two sources on one net", "Définition incohérente": "Inconsistent definition", "Fonction sans solution": "Function without a solution", "Net à une seule broche": "Single-pin net",
  "Nom de net hors convention": "Net name off convention", "Tenue en tension insuffisante": "Insufficient voltage rating", "Valeur manquante": "Missing value",
};
/** The title a rule shows (English), from the title it was written with ; a title already in English comes back as it is. */
export const ruleTitle = (title) => RULE_TITLES[title] || title;
/** The French word of a rule title, for the glossary ; "" when the title was written in English. */
export const ruleTitleFr = (title) => (RULE_TITLES[title] ? title : "");
