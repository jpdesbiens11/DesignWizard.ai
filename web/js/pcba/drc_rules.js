/* DynamiteOrbit — PCBA: the rule book of an assembled board — copper, drilling, placement, assembly, test, coating.
   Same shape as the mechanical rule books (analysis/dfx_core.js), so the DFx screen lists it with the others.
   The limits quoted here are those of the capability class of the board (model.js FAB) and of its net classes. */

import { rule } from "../analysis/dfx_core.js";

const S = { ipc: "IPC-2221B (espacements, Table 6-1 ; courant des pistes)", fab: "Capacités des fabricants de PCB (rule of thumb)", asm: "Pratique d'assemblage (IPC-7351, IPC-A-610)", dft: "Pratique d'essai (DFT)", coat: "IPC-CC-830, IPC-A-610 (vernis de tropicalisation)", std: "DynamiteOrbit" };
const R = [
  rule("PCBA-01", "Court-circuit", "Deux nets différents ne se touchent sur aucune couche", "error", "La carte ne fonctionne pas, ou une alimentation est en court-circuit.", S.ipc, { group: "Cuivre" }),
  rule("PCBA-02", "Isolement entre nets", "Distance ≥ isolement de la classe, et ≥ IPC-2221B à la tension entre les nets", "error", "Pont de gravure, amorçage sous tension.", S.ipc, { group: "Cuivre" }),
  rule("PCBA-03", "Largeur de piste", "Largeur ≥ capacité du fabricant ; ≥ largeur IPC-2221 pour le courant du net (sauf l'entrée dans une petite pastille)", "error", "Piste coupée à la gravure, ou qui chauffe sous le courant.", S.ipc, { group: "Cuivre" }),
  rule("PCBA-04", "Connexions à router", "Chaque net est entièrement relié par du cuivre", "error", "Une liaison manquante est un circuit ouvert.", S.std, { group: "Cuivre" }),
  rule("PCBA-05", "Cuivre au bord de carte", "Cuivre à ≥ 0,3 mm du contour (0,25 mm en classe fine)", "error", "Cuivre arraché au détourage, court-circuit sur un guide-carte.", S.fab, { group: "Cuivre" }),
  rule("PCBA-10", "Perçage trop petit", "Perçage ≥ 0,3 mm (0,2 mm en classe fine)", "error", "Foret trop fin : casse, surcoût, délai.", S.fab, { group: "Perçage" }),
  rule("PCBA-11", "Couronne insuffisante", "(Pastille − perçage) / 2 ≥ 0,15 mm (0,125 mm en classe fine)", "error", "Le perçage décentré coupe la pastille.", S.fab, { group: "Perçage" }),
  rule("PCBA-12", "Trous trop proches", "Paroi à paroi ≥ 0,5 mm (0,4 mm en classe fine)", "error", "La matière casse entre deux perçages.", S.fab, { group: "Perçage" }),
  rule("PCBA-13", "Via dans une pastille", "Aucun via dans une pastille de composant monté en surface", "warn", "La brasure s'écoule dans le via : joint maigre.", S.asm, { group: "Perçage" }),
  rule("PCBA-20", "Composants superposés", "Les zones de garde de deux composants du même côté ne se recouvrent pas", "error", "Collision au placement, brasage impossible.", S.asm, { group: "Placement" }),
  rule("PCBA-21", "Composant hors de la carte", "Chaque composant tient sur la carte ; seul un connecteur de bord peut affleurer", "error", "Le composant ne peut pas être posé.", S.asm, { group: "Placement" }),
  rule("PCBA-22", "Composant près du bord", "Composant à ≥ 1 mm du bord, hors connecteurs", "warn", "Manutention, rails du convoyeur, dépanélisation.", S.asm, { group: "Placement" }),
  rule("PCBA-23", "Sous la tête de vis", "Ni composant ni cuivre d'un autre net sous la tête de vis (appui + 0,5 mm)", "error", "La vis écrase le composant ou court-circuite le cuivre au châssis.", S.asm, { group: "Placement" }),
  rule("PCBA-24", "Composant non placé", "Chaque composant a une position", "error", "Sans position, ni routage ni fichier de placement.", S.std, { group: "Placement" }),
  rule("PCBA-30", "Pont de vernis épargne", "Vernis entre deux pastilles voisines ≥ 0,1 mm", "warn", "Sans vernis entre elles, la brasure ponte les deux pastilles.", S.fab, { group: "Assemblage" }),
  rule("PCBA-31", "Composants des deux côtés", "Montage en surface d'un seul côté si possible", "info", "Un second passage au four : coût et délai.", S.asm, { group: "Assemblage" }),
  rule("PCBA-32", "Composants traversants", "Le moins possible de traversants, tous du même côté", "info", "Brasage manuel, sélectif ou à la vague en plus de la refusion.", S.asm, { group: "Assemblage" }),
  rule("PCBA-33", "Mires de placement", "Trois mires par face équipée de composants montés en surface", "warn", "Sans mire, la machine de placement n'a pas de référence.", S.asm, { group: "Assemblage" }),
  rule("PCBA-34", "Orientation des composants polarisés", "Au plus deux orientations par type de composant polarisé", "info", "Les erreurs de sens échappent au contrôle visuel.", S.asm, { group: "Assemblage" }),
  rule("PCBA-35", "Nomenclature", "Le moins possible de lignes ; valeurs voisines regroupées", "info", "Chaque ligne est un chargeur à monter et une référence à acheter.", S.asm, { group: "Assemblage" }),
  rule("PCBA-36", "Découplage éloigné", "Condensateur à moins de 4 mm de chaque broche d'alimentation d'un circuit intégré", "warn", "Trop loin, le condensateur ne découple plus les fronts rapides.", S.asm, { group: "Assemblage" }),
  rule("PCBA-40", "Accès de test", "Un point de test ou une pastille traversante sur chaque alimentation et chaque masse", "info", "Sans accès, ni mise au point ni essai en production.", S.dft, { group: "Test" }),
  rule("PCBA-50", "Épaisseur de carte", "0,8 · 1,0 · 1,2 · 1,6 · 2,0 · 2,4 mm", "warn", "Une autre épaisseur allonge le délai et le prix.", S.fab, { group: "Carte" }),
  rule("PCBA-51", "Quatre couches sans plan", "Sur quatre couches, les couches internes portent la masse et une alimentation", "info", "Sans plans, les quatre couches n'apportent ni retour de courant ni blindage.", S.asm, { group: "Carte" }),
  rule("PCBA-52", "Cuivre épais et pistes fines", "Au-delà de 35 µm de cuivre, pistes et isolements ≥ 0,2 mm", "warn", "La gravure latérale d'un cuivre épais mange les pistes fines.", S.fab, { group: "Carte" }),
  rule("PCBA-53", "Grande carte", "Jusqu'à 100 × 100 mm, le tarif prototype le plus bas", "info", "Au-delà, le prix change de palier chez la plupart des ateliers.", S.fab, { group: "Carte" }),
  rule("PCBA-54", "Trous de fixation", "Au moins deux trous de fixation ou d'outillage", "info", "La carte doit être tenue pour l'essai et dans le produit.", S.asm, { group: "Carte" }),
  rule("PCBA-60", "Haute tension", "Espacements selon IPC-2221B : colonne B2 carte nue, A5 carte vernie ; le vernis couvre les deux faces qui portent ce cuivre", "error", "Amorçage entre conducteurs sous tension.", S.ipc, { group: "Vernis" }),
  rule("PCBA-61", "Vernis conseillé", "Un vernis de tropicalisation réduit l'espacement exigé", "info", "Le vernis permet un cuivre plus serré à tension égale.", S.coat, { group: "Vernis" }),
  rule("PCBA-62", "Masquage du vernis", "Zone épargnée à ≥ 1 mm des composants à vernir", "info", "Un masque collé contre un composant laisse fuir le vernis.", S.coat, { group: "Vernis" }),
  rule("PCBA-63", "Essais avant vernissage", "Programmer et essayer la carte avant de la vernir", "info", "Le vernis recouvre les points de test.", S.coat, { group: "Vernis" }),
];
export const PCBA_RULES = Object.fromEntries(R.map((r) => [r.id, r]));
const STEPS = {
  Cuivre: ["Classer les nets : signal, puissance, masse, haute tension", "Donner à chaque net sa tension et son courant : largeur et isolement en découlent", "Router, puis relancer le contrôle après chaque retouche"],
  "Perçage": ["Vias de 0,6 / 0,3 mm pour les signaux, 0,8 / 0,4 mm pour la puissance", "Pas de via dans les pastilles"], Placement: ["Connecteurs au bord, sens d'enfichage dégagé", "Rien sous les têtes de vis", "Composants à 1 mm au moins des bords"],
  Assemblage: ["Tout d'un seul côté si possible", "Trois mires par face équipée", "Condensateurs de découplage contre les broches d'alimentation"], Test: ["Un point de test par alimentation et par masse", "Connecteur de programmation accessible"],
  Carte: ["1,6 mm, 35 µm, finition sans plomb", "Quatre couches dès qu'un microcontrôleur ou un étage de puissance le demande : masse et alimentation en plans"], Vernis: ["Choisir le vernis avant de fixer les espacements", "Épargner connecteurs, organes de commande, points de test et appuis de vis"],
};
/** The book, grouped the way the DFx screen prints it. */
export const PCBA_BOOK = Object.keys(STEPS).map((g) => ({ process: "pcba", category: `PCBA — ${g}`, steps: STEPS[g], rules: R.filter((r) => r.group === g) }));

const HINT = {
  "PCBA-01": "Écartez les deux cuivres ou reroutez l'un des nets.", "PCBA-02": "Écartez les cuivres, réduisez la largeur de la piste si le courant le permet, ou choisissez un vernis de tropicalisation.",
  "PCBA-03": "Élargissez la piste, ou passez en classe fine si la largeur est imposée par le boîtier.", "PCBA-04": "Relancez le routage, déplacez les composants qui bouchent le passage, ou passez à quatre couches.",
  "PCBA-05": "Reculez le cuivre du bord.", "PCBA-10": "Agrandissez le perçage ou passez en classe fine.", "PCBA-11": "Agrandissez la pastille ou réduisez le perçage.", "PCBA-12": "Écartez les deux trous.",
  "PCBA-13": "Sortez le via de la pastille par une courte piste.", "PCBA-20": "Écartez les deux composants.", "PCBA-21": "Ramenez le composant sur la carte ou agrandissez la carte.", "PCBA-22": "Reculez le composant du bord.",
  "PCBA-23": "Dégagez l'appui de la vis.", "PCBA-24": "Lancez le placement.", "PCBA-30": "Passez en classe fine ou acceptez une ouverture de vernis commune pour ce boîtier.", "PCBA-33": "Ajoutez le bloc « Points de test et mires ».",
  "PCBA-36": "Rapprochez le condensateur de la broche qu'il sert.", "PCBA-40": "Ajoutez un point de test sur ce net.", "PCBA-50": "Choisissez une épaisseur standard.", "PCBA-51": "Déclarez la masse et une alimentation en plans sur les couches internes.",
  "PCBA-60": "Vernissez les deux faces, ou écartez le cuivre haute tension.", "PCBA-61": "Choisissez un vernis dans la carte nue : les espacements exigés diminuent.",
};
/** What to do about a finding. */
export const fixHints = (f) => HINT[f.rule] || "";
