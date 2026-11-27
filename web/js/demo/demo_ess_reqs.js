/* DynamiteOrbit.ai — the REQUIREMENTS of an ESS, a test base in the format of DynamiteAgile (demande de JP, 27 novembre 2026 : « on va partir
   des requis qui vont venir de DynamiteAgile… la même base des trois métiers… je vais aller loader en mode brouillon au début ; après, des
   itérations, on les envoie dans DynamiteAgile ; une fois terminés, on les exporte, on les ramène pour vraiment faire la structure du produit…
   commence avec une base qui ressemble au produit : ESS »).
   A DRAFT : every line « Received » or « In Analysis » in the Requirement Workflow of Goldmine, every need an « Assumption », revision 0.1 —
   what one writes before a review with the customer. It resembles the product of the project BM 8s8p - 21700 : 8 cell blocks 1S8P of Molicel
   P45B in series, cell electronics on each CORE answering the central BMS by an isolated RS-485 chain, a contactor, a swap connector, a
   quarter-turn handle. Its numbers come from the sheet of the cell (INR21700P45B-01 ver. 0.2, read : cad/elec_library.js) and from the software
   of the central BMS (sw/sw_bm_design.js : thresholds that are examples, to confirm) ; what nobody has decided is written TBD, as a draft does.
   A standard named here was NOT read (RTCA DO-160, RTCA DO-311A, RTCA DO-178C, UN 38.3, UL 94) : the line says so.
   No key : DynamiteAgile gives one when it imports the file (Goldmine → Importer : a line without « key » is created, then found again by its
   « external_id »). Every requirement names a test of the Test Base every Space of DynamiteAgile starts with (« test_ref »), as Goldmine
   demands. The file web/examples/exemple_exigences_ess.csv is written from here (node tools/ess_reqs_csv.mjs) and held equal by a test. */

import { AGILE_COLUMNS } from "../core/reqs.js";

const REV = "0.1", DAY = "2026-11-27", M = "Mechanical", E = "Electronics", S = "Software";
const alloc = (...d) => d.join(", ");
const need = (n) => `ESS-BES-${String(n).padStart(2, "0")}`;
const NOT_READ = (std) => `${std} — norme nommée, NON LUE : article et catégorie à confirmer.`;

/* the needs : the why, each an assumption until the customer confirms it */
const NEEDS = [
  [1, "End User", "Functional", "Operation (Use)", "Échange rapide", "L'exploitant veut remplacer un battery module vide par un module chargé en quelques minutes, sans outil."],
  [2, "End User", "Performance", "Operation (Use)", "Énergie de la mission", "L'aéronef a besoin de l'énergie et de la puissance de sa mission, en décharge comme en recharge."],
  [3, "Health & Safety", "Safety", "Operation (Use)", "Aucune défaillance dangereuse", "Une défaillance d'une cell, d'un module ou du BMS ne doit mettre en danger ni l'aéronef ni ses occupants."],
  [4, "Production / Assemblers", "Personnel Safety", "Assembly (DFA)", "Rien de sous tension à toucher", "Personne ne doit pouvoir toucher une partie sous tension en assemblant, en manipulant ou en entretenant un module."],
  [5, "Integrator / Distributor", "Interface", "Installation & Integration", "Interfaces définies", "L'ESS doit s'intégrer à l'aéronef et à sa station de recharge par des interfaces mécanique, électrique et de données définies."],
  [6, "Standards Body / Regulator", "Standard / Regulatory", "Test & Verification (DFT)", "Qualifiable pour un aéronef", "L'ESS doit pouvoir être qualifié pour un aéronef : environnement, sécurité, logiciel."],
  [7, "Maintenance & Repair", "Functional", "Maintenance & Repair", "État lisible sans ouvrir", "L'entretien veut connaître l'état de chaque module — charge, santé, défauts, historique — sans l'ouvrir."],
  [8, "End User", "Environmental", "Operation (Use)", "Environnement d'un aéronef", "L'ESS doit fonctionner dans l'environnement d'un aéronef : froid, chaleur, vibrations, chocs, humidité, altitude."],
  [9, "Project Management", "Performance", "Design", "Chaque kilogramme compte", "Le module doit être aussi léger que sa sécurité le permet."],
  [10, "Recycling / End of Life", "Environmental", "End of Life (Disassembly, Recycling)", "Seconde vie et recyclage", "En fin de vie, un module doit se démonter pour la seconde vie ou le recyclage de ses cells."],
];

/* the requirements : [number, { the columns of Goldmine }] — d : the needs it derives from (numbers), a : its disciplines, t : its test */
const REQS = [
  // what the module is, what it gives
  [1, { title: "Architecture 8s8p", d: [2], cat: "Performance", lc: "Design", crit: "B", vm: "I", a: alloc(M, E), t: "TST-VER-01", st: "Battery module : 8 cell blocks 1S8P en série (8s8p), soit 64 cells 21700 Molicel INR-21700-P45B.",
    ac: "Nomenclature et dessin d'ensemble : 8 cell blocks de 8 cells en parallèle, en série.", why: "Architecture du projet BM 8s8p - 21700 (CORE 1S8P, 8 CORE en série)." }],
  [2, { title: "Plage de tension du module", d: [2], cat: "Performance", lc: "Operation (Use)", crit: "A", vm: "T", a: alloc(E, S), t: "TST-FUN-01", st: "La tension du module doit rester entre 22,4 V et 33,6 V en service : 2,80 V à 4,20 V par cell block, 28,8 V nominal.",
    ac: "Tension relevée en fin de charge et en fin de décharge sur le profil de mission.", why: "Fiche de la P45B, p. 3 (lue) : 4,20 ± 0,05 V en fin de charge, 2,5 V en fin de décharge, 3,6 V nominal. Le bas de la plage est le seuil de ESS-REQ-014." }],
  [3, { title: "Courant de décharge continu", d: [2], cat: "Performance", lc: "Operation (Use)", crit: "A", vm: "T", a: alloc(M, E, S), t: "TST-FUN-01, TST-ELE-03", st: "Un module doit fournir 360 A en continu en décharge : 8 cells en parallèle à 45 A chacune.",
    ac: "360 A pendant TBD s sans dépasser la température de cell de ESS-REQ-015.", why: "Fiche de la P45B, p. 3 (lue) : 45 A en décharge continue au plus. La durée tient à la mission : TBD." }],
  [4, { title: "Courant de charge", d: [2], cat: "Performance", lc: "Operation (Use)", crit: "B", vm: "T", a: alloc(E, S), t: "TST-FUN-01", st: "Un module doit accepter un courant de charge de 72 A au plus : 8 cells en parallèle à 9 A chacune.",
    ac: "Charge complète à 72 A sans défaut ni dératation sous 25 °C d'ambiante.", why: "Fiche de la P45B, p. 3 (lue) : 9 A en charge continue au plus." }],
  [5, { title: "Énergie d'un module", d: [2], cat: "Performance", lc: "Operation (Use)", crit: "B", vm: "AT", a: alloc(E, S), t: "TST-FUN-01, TST-VER-02", st: "Un module neuf doit stocker au moins 1,0 kWh : 28,8 V nominal × 36 Ah (8 × 4,5 Ah).",
    ac: "Énergie mesurée de la pleine charge à 22,4 V, à 1C, ≥ 1,0 kWh.", why: "Fiche de la P45B, p. 3 (lue) : 4,5 Ah typique, 4,35 Ah au minimum — au minimum, 1,0 kWh exactement : la marge est à discuter.", status: "In Analysis" }],
  [6, { title: "Énergie de l'ESS", d: [2], cat: "Performance", lc: "Operation (Use)", crit: "A", vm: "A", a: alloc(E, S), t: "TST-VER-02", st: "L'ESS doit fournir une énergie utile d'au moins TBD kWh en début de vie, en TBD modules.",
    ac: "Bilan d'énergie de la mission au dossier.", why: "Tient au profil de mission de l'aéronef : question posée au client.", status: "In Analysis" }],
  [7, { title: "Masse d'un module", d: [9], cat: "Performance", lc: "Design", crit: "B", vm: "I", a: alloc(M), t: "TST-VER-01", st: "La masse d'un module complet ne doit pas dépasser TBD kg.",
    ac: "Pesée de trois modules ; la plus grande valeur ≤ TBD kg.", why: "Les cells seules pèsent 4,48 kg (64 × 70 g, fiche p. 2) ; la cible du module vient du bilan de masse de l'aéronef." }],
  [8, { title: "Tenue thermique du module fermé", d: [2, 3], cat: "Performance", lc: "Operation (Use)", crit: "B", vm: "AT", a: alloc(M, E), t: "TST-VER-02, TST-ELE-03", st: "Un module fermé doit tenir 95 A en continu à 25 °C d'ambiante sans que la surface d'une cell dépasse 60 °C.",
    ac: "Analyse thermique au dossier, puis essai : 95 A pendant 2 h, thermistors sous 60 °C.", why: "Calcul de masse thermique du projet (95 A tenus dans l'air calme, optimiste) : à prouver par essai. 60 °C : le seuil de dératation de ESS-REQ-016." }],
  // what the BMS measures
  [10, { title: "Tension de chaque cell block", d: [3], cat: "Functional", lc: "Operation (Use)", crit: "A", vm: "T", a: alloc(E, S), t: "TST-FUN-02", st: "Le BMS doit mesurer la tension de chacun des 8 cell blocks à ± TBD mV, au moins toutes les 100 ms.",
    ac: "Écart à un multimètre de référence ≤ TBD mV sur 2,5–4,2 V ; période mesurée ≤ 100 ms.", why: "Les seuils de ESS-REQ-013 et ESS-REQ-014 en dépendent ; la précision vient du circuit de mesure choisi." }],
  [11, { title: "Température de chaque cell", d: [3], cat: "Functional", lc: "Operation (Use)", crit: "A", vm: "T", a: alloc(M, E, S), t: "TST-FUN-02", st: "Le BMS doit mesurer la température de chacune des 64 cells, par une thermistor (NTC) sous chaque cell.",
    ac: "64 températures lues ; chauffage local d'une cell vu par sa thermistor et par aucune autre.", why: "Architecture du projet : un flex sous les cells, une thermistor par cell (la mécanique la tient en place)." }],
  [12, { title: "Courant du module", d: [2, 3], cat: "Functional", lc: "Operation (Use)", crit: "A", vm: "T", a: alloc(E, S), t: "TST-FUN-02", st: "Le BMS doit mesurer le courant du module de −500 A à +500 A, en charge et en décharge, à ± TBD %.",
    ac: "Écart à une pince de référence ≤ TBD % de 10 A à 400 A, dans les deux sens.", why: "Capteur hors carte (le bloc isolé de l'outil s'arrête à 20 A). La plage est celle du logiciel du BMS central." }],
  // what the BMS does
  [13, { title: "Surtension d'un cell block", d: [3], cat: "Safety", lc: "Operation (Use)", crit: "A", vm: "T", a: alloc(E, S), t: "TST-SW-01, TST-ELE-04", st: "Le BMS doit ouvrir le contactor si un cell block dépasse 4,25 V pendant plus de 100 ms.",
    ac: "Tension injectée à 4,26 V : contactor ouvert entre 100 et 150 ms ; à 4,24 V, il reste fermé.", why: "4,20 ± 0,05 V en fin de charge (fiche p. 3) : 4,25 V est le haut de la tolérance. Seuil du logiciel du BMS central — exemple à confirmer." }],
  [14, { title: "Sous-tension d'un cell block", d: [3], cat: "Safety", lc: "Operation (Use)", crit: "A", vm: "T", a: alloc(E, S), t: "TST-SW-01", st: "Le BMS doit ouvrir le contactor si un cell block descend sous 2,80 V pendant plus de 200 ms.",
    ac: "Tension injectée à 2,79 V : contactor ouvert entre 200 et 250 ms.", why: "Au-dessus des 2,5 V de fin de décharge (fiche p. 3). Seuil du logiciel du BMS central — exemple à confirmer." }],
  [15, { title: "Surchauffe d'une cell", d: [3], cat: "Safety", lc: "Operation (Use)", crit: "A", vm: "T", a: alloc(E, S), t: "TST-SW-01, TST-ELE-04", st: "Le BMS doit ouvrir le contactor si une cell dépasse 75 °C en décharge, ou 65 °C en charge, pendant plus de 500 ms.",
    ac: "Thermistor chauffée au-delà du seuil : contactor ouvert en moins de 1 s, en charge et en décharge.", why: "Fiche p. 3 (lue) : surface de la cell −40–80 °C en décharge, 0–70 °C en charge. Le logiciel actuel n'a qu'un seuil (75 °C) : à séparer.", status: "In Analysis" }],
  [16, { title: "Dératation", d: [2, 3], cat: "Safety", lc: "Operation (Use)", crit: "B", vm: "T", a: alloc(S), t: "TST-SW-01", st: "Le BMS doit passer le module à l'état Derated au-dessus de 60 °C, ou au-dessus de 95 A pendant plus de 2 s, et le dire à l'aéronef.",
    ac: "Chaque cause, injectée seule, donne l'état Derated sur le bus en moins de 3 s ; retour à Normal sous 55 °C ou 90 A.", why: "95 A : le courant que le module fermé tient pour toujours (ESS-REQ-008). Seuils du logiciel du BMS central — exemples." }],
  [17, { title: "Chaîne des cell electronics muette", d: [3], cat: "Safety", lc: "Operation (Use)", crit: "A", vm: "T", a: alloc(E, S), t: "TST-SW-01", st: "Si plus aucune cell electronics ne répond, le BMS doit passer à l'état Emergency après 0,5 s, puis ouvrir le contactor 1 s plus tard.",
    ac: "Chaîne RS-485 coupée : Emergency à 0,5 s ± 50 ms, contactor ouvert à 1,5 s ± 50 ms.", why: "Sans mesure, le module vole à l'aveugle : l'aéronef est prévenu avant la coupure." }],
  [18, { title: "Pas de refermeture automatique", d: [3], cat: "Safety", lc: "Operation (Use)", crit: "A", vm: "T", a: alloc(S), t: "TST-SW-01", st: "Après un défaut, le contactor ne doit se refermer qu'après un acquittement explicite, une fois la cause disparue.",
    ac: "Cause retirée sans acquittement : contactor ouvert pendant 10 min ; acquitté : refermé.", why: "Une refermeture seule sur un défaut intermittent ferait battre le contactor." }],
  [19, { title: "Contactor vérifié", d: [3], cat: "Safety", lc: "Operation (Use)", crit: "A", vm: "T", a: alloc(E, S), t: "TST-SW-01, TST-ELE-04", st: "Le BMS doit vérifier par le contact auxiliaire que le contactor a suivi l'ordre en 50 ms au plus, et signaler un contactor collé.",
    ac: "Contact auxiliaire forcé à « fermé » contactor commandé ouvert : défaut « contactor collé » en moins de 100 ms.", why: "Un contactor soudé ne coupe plus rien : il faut le savoir." }],
  [20, { title: "Quatre états du module", d: [3, 5], cat: "Functional", lc: "Operation (Use)", crit: "A", vm: "T", a: alloc(S), t: "TST-SW-01", st: "Le module doit tenir quatre états, dits à l'aéronef : Normal, Derated, Emergency et Shutdown (contactor ouvert).",
    ac: "Chaque état atteint par son scénario d'essai, et lu sur le bus de l'aéronef.", why: "Architecture du BMS central du projet (normal, dératé, urgence, arrêt)." }],
  [21, { title: "Précharge", d: [3], cat: "Safety", lc: "Operation (Use)", crit: "B", vm: "AT", a: alloc(E, S), t: "TST-ELE-04, TST-VER-02", st: "La fermeture du contactor doit limiter le courant d'appel par une précharge : résistance, durée et seuil de fin TBD.",
    ac: "Courant d'appel ≤ TBD A sur la capacité d'entrée de l'aéronef (TBD µF).", why: "La capacité d'entrée de l'aéronef n'est pas connue : à demander.", status: "In Analysis" }],
  [22, { title: "Court-circuit externe", d: [3], cat: "Safety", lc: "Operation (Use)", crit: "A", vm: "AT", a: alloc(M, E), t: "TST-ELE-04, TST-VER-02", st: "Un court-circuit externe doit être interrompu par une protection propre au module (fusible ou pyrofuse, calibre TBD), sans propagation à un autre module.",
    ac: "Essai de court-circuit franc : coupure sans feu ni explosion, modules voisins intacts.", why: "Le contactor seul ne coupe pas un courant de court-circuit d'un pack Li-ion." }],
  [23, { title: "Propagation de l'emballement thermique", d: [3, 6], cat: "Safety", lc: "Operation (Use)", crit: "A", vm: "AT", a: alloc(M), t: "TST-VER-02, TST-CUS-01", st: "L'emballement thermique d'une cell ne doit pas se propager aux cells voisines ni sortir du module.",
    ac: "Essai de déclenchement d'une cell : aucune autre cell en emballement, aucune flamme hors du boîtier.", why: NOT_READ("RTCA DO-311A"), src: "Standard", doc: "RTCA DO-311A (non lue)" }],
  [24, { title: "Équilibrage passif", d: [2], cat: "Functional", lc: "Operation (Use)", crit: "C", vm: "T", a: alloc(E, S), t: "TST-FUN-03", st: "Le BMS doit équilibrer les cell blocks de façon passive : au-dessus de 3,90 V, un cell block à plus de 20 mV du plus bas est déchargé.",
    ac: "Écart de 100 mV au départ : sous 20 mV en fin de charge.", why: "Carte de CORE du projet : une résistance commandée par cell block, sur ordre du BMS central. Seuils d'exemple." }],
  // the people
  [30, { title: "Module retiré : rien à toucher", d: [4], cat: "Personnel Safety", lc: "Maintenance & Repair", crit: "A", vm: "I", a: alloc(M, E), t: "TST-ELE-01", st: "Un module retiré de sa cavité ne doit présenter aucune partie sous tension accessible au doigt d'essai.",
    ac: "Doigt d'essai rigide sur toutes les faces : aucun contact avec une pièce sous tension.", why: "Concept 4 du projet : faces planes, rien ne dépasse d'un CORE." }],
  [31, { title: "Contactor ouvert hors de la cavité", d: [4, 3], cat: "Personnel Safety", lc: "Maintenance & Repair", crit: "A", vm: "T", a: alloc(M, E, S), t: "TST-ELE-01, TST-SW-01", st: "Le contactor doit s'ouvrir dès que le module quitte sa cavité : ses bornes de puissance sont alors hors tension.",
    ac: "Module tiré de 5 mm : contactor ouvert avant la séparation des contacts de puissance.", why: "Le contact de présence du connecteur d'échange rompt le premier (ESS-REQ-043)." }],
  [32, { title: "Rigidité diélectrique", d: [4, 6], cat: "Personnel Safety", lc: "Test & Verification (DFT)", crit: "A", vm: "T", a: alloc(M, E), t: "TST-ELE-02", st: "L'isolement entre la chaîne de puissance et le boîtier doit tenir l'essai diélectrique (hipot) à TBD V pendant 60 s.",
    ac: "Courant de fuite ≤ TBD mA, aucun claquage.", why: "La tension d'essai tient à la tension de l'ESS en série : TBD." }],
  [33, { title: "Distances d'isolement", d: [4, 3], cat: "Safety", lc: "Design", crit: "B", vm: "A", a: alloc(M, E), t: "TST-VER-02", st: "Les lignes de fuite et les distances dans l'air (creepage, clearance) des cartes et des busbars doivent être tenues pour la tension de l'ESS.",
    ac: "Analyse d'isolation de chaque carte et de l'assemblage au dossier, sans paire refusée.", why: "DynamiteOrbit.ai le mesure : écran Isolation." }],
  // the interfaces
  [40, { title: "Glisser et verrouiller", d: [1, 5], cat: "Interface", lc: "Operation (Use)", crit: "B", vm: "D", a: alloc(M), t: "TST-USA-01", st: "Le module doit se glisser dans sa cavité et se verrouiller par une poignée quart de tour, sans outil.",
    ac: "Cinq personnes non formées : module posé et verrouillé du premier coup.", why: "Concept du projet : poignée quart de tour à came." }],
  [41, { title: "Temps d'échange", d: [1], cat: "Performance", lc: "Operation (Use)", crit: "B", vm: "D", a: alloc(M), t: "TST-USA-01", st: "Une personne seule doit remplacer un module en moins de 5 minutes.",
    ac: "Médiane de 10 échanges ≤ 5 min, chronomètre de l'ouverture de la trappe au module verrouillé.", why: "Le besoin ESS-BES-01 : la valeur est une hypothèse à faire confirmer." }],
  [42, { title: "Un connecteur d'échange", d: [1, 5], cat: "Interface", lc: "Installation & Integration", crit: "A", vm: "I", a: alloc(M, E), t: "TST-VER-01", st: "Le module doit se brancher à l'aéronef et à la station de recharge par un seul connecteur d'échange : puissance, alimentation basse tension et données.",
    ac: "Dessin d'interface au dossier ; un seul connecteur sur le module.", why: "Couvercle du fond actif du projet : le connecteur d'échange y est soudé." }],
  [43, { title: "Ordre des contacts", d: [4, 5], cat: "Interface", lc: "Operation (Use)", crit: "A", vm: "I", a: alloc(M, E, S), t: "TST-VER-01", st: "Le connecteur d'échange ne doit s'accoupler que dans un sens ; son contact de présence doit s'établir en dernier et rompre en premier.",
    ac: "Dessin du connecteur : détrompeur, contact de présence plus court de TBD mm.", why: "Le BMS lit la présence pour ouvrir le contactor avant que la puissance se sépare (ESS-REQ-031)." }],
  [44, { title: "Ce que le module dit à l'aéronef", d: [5, 7], cat: "Interface", lc: "Operation (Use)", crit: "B", vm: "T", a: alloc(E, S), t: "TST-SW-01", st: "Le BMS doit envoyer à l'aéronef par CAN, au moins 10 fois par seconde : l'état, la tension, le courant, la température la plus haute et l'état de charge.",
    ac: "Trames lues à l'analyseur : période ≤ 100 ms, chaque valeur dans sa tolérance.", why: "Le message et ses identifiants sont à définir avec l'intégrateur : TBD." }],
  [45, { title: "Chaîne RS-485 isolée", d: [3], cat: "Interface", lc: "Design", crit: "B", vm: "T", a: alloc(E, S), t: "TST-FUN-02", st: "Chaque cell electronics doit répondre au BMS central par une liaison RS-485 isolée en chaîne, chacune à son propre potentiel.",
    ac: "8 cartes interrogées en moins de 100 ms ; une carte débranchée nommée par le BMS.", why: "Architecture du projet : au 4e CORE, le mode commun −7…+12 V du RS-485 est dépassé — d'où l'isolation." }],
  [46, { title: "Réveil par le 12 V", d: [5], cat: "Interface", lc: "Operation (Use)", crit: "B", vm: "T", a: alloc(E, S), t: "TST-FUN-02", st: "Le BMS doit être alimenté par le 12 V de l'aéronef (plage TBD), contactor ouvert, pour se réveiller et mesurer avant de fermer.",
    ac: "12 V appliqué : BMS prêt et mesures envoyées en moins de TBD s, contactor toujours ouvert.", why: "Démarrage proposé au projet : diode idéale sur le 12 V, régulateur, mesure pack ouvert, précharge." }],
  [47, { title: "Refroidissement commandé", d: [2, 8], cat: "Functional", lc: "Operation (Use)", crit: "C", vm: "T", a: alloc(M, S), t: "TST-SW-01", st: "Le BMS doit demander le refroidissement (pompe du circuit liquide) au-dessus de 45 °C et l'arrêter sous 38 °C.",
    ac: "Sortie de la pompe active à 45 °C, coupée à 38 °C, sur le banc.", why: "Seuils du logiciel du BMS central. Le circuit liquide lui-même n'est pas encore conçu : le garder ?", status: "In Analysis" }],
  // the environment and the rules
  [50, { title: "Températures de service", d: [8], cat: "Environmental", lc: "Operation (Use)", crit: "B", vm: "T", a: alloc(M, E, S), t: "TST-ENV-01", st: "L'ESS doit fonctionner de −20 °C à +55 °C d'ambiante en décharge, et charger de 0 °C à +45 °C.",
    ac: "Profil de mission joué aux deux extrêmes, sans défaut ni dératation imprévue.", why: "Plus étroit que la fiche (−40–60 °C en décharge, 0–60 °C en charge, p. 3) : valeurs d'exemple, la plage de l'aéronef est TBD." }],
  [51, { title: "Vibrations et chocs", d: [8, 6], cat: "Environmental", lc: "Operation (Use)", crit: "A", vm: "T", a: alloc(M, E), t: "TST-ENV-03", st: "Le module doit tenir les vibrations et les chocs d'un aéronef, catégories TBD.",
    ac: "Fonctionnement normal et aucune pièce desserrée après l'essai.", why: NOT_READ("RTCA DO-160"), src: "Standard", doc: "RTCA DO-160 (non lue)" }],
  [52, { title: "Humidité et altitude", d: [8, 6], cat: "Environmental", lc: "Operation (Use)", crit: "B", vm: "T", a: alloc(M, E), t: "TST-ENV-02", st: "Le module doit fonctionner en air humide et à l'altitude de l'aéronef, catégories TBD.",
    ac: "Fonctionnement normal pendant et après l'essai ; aucune condensation sur les cartes.", why: NOT_READ("RTCA DO-160"), src: "Standard", doc: "RTCA DO-160 (non lue)" }],
  [53, { title: "Chute à la manipulation", d: [4, 8], cat: "Safety", lc: "Maintenance & Repair", crit: "B", vm: "T", a: alloc(M), t: "TST-MEC-01", st: "Un module doit tenir une chute de TBD m sur le béton pendant sa manipulation, sans fuite, feu ni court-circuit.",
    ac: "Six chutes, une par face : aucune fuite, aucune élévation de température après 1 h.", why: "Un module échangeable se manipule souvent : la hauteur tient à la station (TBD)." }],
  [54, { title: "Compatibilité électromagnétique", d: [6], cat: "Standard / Regulatory", lc: "Test & Verification (DFT)", crit: "B", vm: "T", a: alloc(E), t: "TST-EMC-01, TST-EMC-02", st: "Les émissions et la susceptibilité électromagnétiques du module doivent respecter les catégories TBD de l'aéronef.",
    ac: "Essais au laboratoire accrédité sous les limites.", why: NOT_READ("RTCA DO-160"), src: "Standard", doc: "RTCA DO-160 (non lue)" }],
  [55, { title: "Logiciel développé selon DO-178C", d: [6, 3], cat: "Standard / Regulatory", lc: "Design", crit: "A", vm: "I", a: alloc(S), t: "TST-VER-04", st: "Le logiciel du BMS doit être développé selon RTCA DO-178C, au niveau (DAL) TBD.",
    ac: "Plan de certification du logiciel et dossier de vérification au niveau retenu.", why: `${NOT_READ("RTCA DO-178C")} La référence se choisit dans le Logiciel de DynamiteOrbit.ai (DO-178C ou ISO 26262).`, src: "Standard", doc: "RTCA DO-178C (non lue)" }],
  [56, { title: "Plastiques V-0", d: [3], cat: "Safety", lc: "Design", crit: "B", vm: "I", a: alloc(M), t: "TST-MAT-02", st: "Les plastiques du module doivent être classés V-0.",
    ac: "Fiche de chaque matière au dossier, classée V-0 à son épaisseur.", why: NOT_READ("UL 94"), src: "Standard", doc: "UL 94 (non lue)" }],
  [57, { title: "Transport des cells au lithium", d: [6], cat: "Standard / Regulatory", lc: "Transport & Storage", crit: "B", vm: "I", a: alloc(M, E), t: "TST-VER-01", st: "Le module doit avoir passé les essais de transport des batteries au lithium.",
    ac: "Résumé d'essai au dossier.", why: `${NOT_READ("UN 38.3")} La fiche de la cell cite le manuel d'épreuves de l'ONU (p. 8).`, src: "Standard", doc: "UN 38.3 (non lue)" }],
  // maintenance, production, end of life
  [60, { title: "Journal des événements", d: [7], cat: "Functional", lc: "Maintenance & Repair", crit: "C", vm: "D", a: alloc(E, S), t: "TST-SW-01", st: "Le BMS doit garder un journal des défauts et des événements — date, valeurs, état — lisible par le connecteur d'échange.",
    ac: "100 événements joués, relus dans l'ordre après une coupure du 12 V.", why: "L'entretien lit le module sans l'ouvrir (ESS-BES-07)." }],
  [61, { title: "État de charge", d: [2, 7], cat: "Performance", lc: "Operation (Use)", crit: "B", vm: "T", a: alloc(S), t: "TST-SW-01", st: "Le BMS doit estimer l'état de charge (SOC) du module à ± TBD %.",
    ac: "SOC estimé comparé à la charge comptée au banc sur trois profils.", why: "La méthode (comptage, modèle) est à choisir." }],
  [62, { title: "Compteur d'énergie et santé", d: [7], cat: "Functional", lc: "Maintenance & Repair", crit: "C", vm: "T", a: alloc(E, S), t: "TST-SW-01", st: "Le BMS doit compter l'énergie et les cycles du module (energy flow counter) et en déduire son état de santé (SOH).",
    ac: "Énergie comptée à ± TBD % de celle du banc sur 10 cycles.", why: "Le compteur d'énergie est nommé par sa fonction au projet." }],
  [63, { title: "Témoin d'état", d: [7], cat: "Functional", lc: "Maintenance & Repair", crit: "C", vm: "D", a: alloc(M, E, S), t: "TST-USA-01", st: "Un témoin visible sur le module doit montrer son état : vert (Normal), jaune (Derated), rouge (Emergency ou Shutdown).",
    ac: "Chaque état vu de 2 m en plein jour.", why: "Témoin d'état du logiciel du BMS central ; la mécanique lui laisse une fenêtre." }],
  [64, { title: "Marquage", d: [4, 7], cat: "Personnel Safety", lc: "Maintenance & Repair", crit: "C", vm: "I", a: alloc(M), t: "TST-VER-01", st: "Chaque module doit porter un marquage lisible et durable : numéro de série, polarité, tension nominale, avertissements.",
    ac: "Marquage lisible après l'essai de frottement TBD.", why: "Marquage laser du projet." }],
  [65, { title: "Mise à jour du logiciel", d: [7], cat: "Functional", lc: "Maintenance & Repair", crit: "C", vm: "D", a: alloc(E, S), t: "TST-SW-01", st: "Le logiciel du BMS doit se mettre à jour par le connecteur d'échange, sans ouvrir le module, et refuser une image non signée.",
    ac: "Mise à jour faite, puis une image altérée refusée ; le module reste utilisable.", why: "La signature est une pratique courante : son procédé est TBD." }],
  [70, { title: "Essai de fin de ligne", d: [6], cat: "Functional", lc: "Test & Verification (DFT)", crit: "B", vm: "T", a: alloc(E, S), t: "TST-PRD-01", st: "Chaque carte de cell electronics doit passer un essai de fin de ligne automatique : mesures, liaison, équilibrage.",
    ac: "Banc de fin de ligne : verdict par carte en moins de TBD s, enregistré.", why: "Le plan de test fonctionnel du Labo en est la base." }],
  [71, { title: "Assemblage sans soudure à la main", d: [4], cat: "Functional", lc: "Assembly (DFA)", crit: "C", vm: "I", a: alloc(M), t: "TST-VER-01", st: "Les cells doivent être reliées par des soudures laser seulement : aucune soudure à la main sur une cell.",
    ac: "Gamme d'assemblage au dossier.", why: "Busbar laminé du projet, ses languettes soudées au laser." }],
  [80, { title: "Démontage en fin de vie", d: [10], cat: "Environmental", lc: "End of Life (Disassembly, Recycling)", crit: "D", vm: "D", a: alloc(M), t: "TST-VER-03", st: "Un module doit se démonter jusqu'au cell block avec des outils courants, pour la seconde vie ou le recyclage.",
    ac: "Démontage d'un module en moins de TBD min, cell blocks intacts.", why: "Le besoin ESS-BES-10." }],
];

const row = (o) => Object.fromEntries(AGILE_COLUMNS.map((h) => [h, o[h] ?? ""]));

/** The list, as a DynamiteAgile export reads : { head, rows } (core/reqs.js readAgile gives the same). */
export function essList() {
  const rows = [
    ...NEEDS.map(([n, who, cat, lc, title, st]) => row({ external_id: need(n), kind: "Need", stakeholder: who, title, statement: st, status: "Received", source: "Customer", category: cat, lifecycle: lc, need_status: "Assumption", revision: REV, received_at: DAY,
      rationale: "Besoin supposé, à faire confirmer par le client à la revue des exigences." })),
    ...REQS.map(([n, r]) => row({ external_id: `ESS-REQ-${String(n).padStart(3, "0")}`, kind: "Requirement", stakeholder: NEEDS.find((x) => x[0] === r.d[0])[1], derived_from: r.d.map(need).join(", "), title: r.title, statement: r.st, status: r.status || "Received",
      source: r.src || "Internal", source_doc: r.doc || "", category: r.cat, lifecycle: r.lc, criticality: r.crit, verification_method: r.vm, acceptance_criteria: r.ac, allocation: r.a, test_ref: r.t, revision: REV, received_at: DAY, rationale: r.why })),
  ];
  return { head: [...AGILE_COLUMNS], rows };
}
export const ESS_FILE = "exemple_exigences_ess.csv";
