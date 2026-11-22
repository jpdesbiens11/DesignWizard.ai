/* DesignOrbit.ai — Logiciel : from the files the tool writes to the microcontroller (demande de JP : « l'important, c'est de voir le
   package final, puis de savoir comment il serait téléchargé dans le microprocesseur choisi »). The chain is said step by step, for someone
   who learns : what one does, in plain words, and — for a CPU whose documents were opened — what its maker PUBLISHES about each step, with
   where it was read. Tools and kits of a maker are cited in text, as references of compatibility : no logo, none of their code.
   Nothing of this chain is done by the tool, and none of it was tried : the tool calls no other software, and the files it writes have
   run on no microcontroller. The screen and the file of the package say so.
   Pure : no page. */

import { FOOT_NOTE_ASCII } from "../core/brand.js";

/** What was opened to write the chain of the first CPU. */
export const LOAD_SOURCES = [
  { id: "kit", maker: "Texas Instruments", title: "LAUNCHXL2-TMS57012 — Hercules TMS570LS12x LaunchPad Development Kit, page du produit", url: "https://www.ti.com/tool/LAUNCHXL2-TMS57012", read: "Page lue le 20 novembre 2026." },
  { id: "halcogen", maker: "Texas Instruments", title: "HALCOGEN — Hardware Abstraction Layer Code Generator for Hercules MCUs, page du produit", url: "https://www.ti.com/tool/HALCOGEN", read: "Page lue le 20 novembre 2026." },
  { id: "uniflash", maker: "Texas Instruments", title: "UNIFLASH — UniFlash flash programming tool, page du produit", url: "https://www.ti.com/tool/UNIFLASH", read: "Page lue le 20 novembre 2026." },
  { id: "ccs", maker: "Texas Instruments", title: "CCSTUDIO — Code Composer Studio integrated development environment, page du produit", url: "https://www.ti.com/tool/CCSTUDIO", read: "Page lue le 20 novembre 2026." },
  { id: "ds", maker: "Texas Instruments", title: "TMS570LS1224 — data sheet SPNS190B", url: "https://www.ti.com/lit/ds/symlink/tms570ls1224.pdf", read: "Lue : 172 pages ; chaque valeur relue sur la page citée." },
];
const R = (text, src, where = "", en = "") => ({ text, src, where, en });
/* what the maker publishes, step by step, for the TMS570LS1224 — each line read on the page or in the data sheet it names */
const TMS = {
  hal: [R("L'outil du fabricant « HALCoGen » se dit « Hardware Abstraction Layer Code Generator for Hercules MCUs » : il fait configurer les périphériques, les interruptions et les horloges, puis écrit le code d'initialisation et les pilotes.", "halcogen", "", "The tool of the maker \"HALCoGen\" calls itself \"Hardware Abstraction Layer Code Generator for Hercules MCUs\" : one configures peripherals, interrupts and clocks, and it generates the initialization and driver code."),
    R("Au démarrage, le logiciel doit donner les mêmes valeurs aux registres des DEUX cœurs avant toute autre chose, sinon le comparateur signale une fausse erreur.", "ds", "p. 56", "At start-up the software must give the same values to the registers of BOTH cores before anything else, or the compare module raises a false error.")],
  project: [R("Le code que ce générateur écrit « can be imported into CCS, IAR Workbench, or Keil uVision » — trois ateliers logiciels.", "halcogen", "", "The code this generator writes \"can be imported into CCS, IAR Workbench, or Keil uVision\"."), R("« Code Composer Studio » se dit un atelier complet pour créer et déboguer les applications des microcontrôleurs du fabricant, dont cette famille.", "ccs", "", "\"Code Composer Studio\" calls itself a complete suite to create and debug the applications of the microcontrollers of the maker, this family included.")],
  build: [R("Le CPU range les octets d'un nombre du plus fort au plus faible : « word-invariant big-endian [BE32] ». Le C que l'outil écrit n'en dépend pas — il ne découpe aucun nombre en octets.", "ds", "p. 2", "The CPU is \"word-invariant big-endian [BE32]\". The C written by the tool does not depend on it : it never splits a number into bytes.")],
  wire: [R("Le kit d'évaluation de ce CPU a sa sonde sur la carte : « On board USB XDS110 debug » — un câble USB suffit. Il est alimenté par l'USB.", "kit", "", "The evaluation kit of this CPU has its probe on the board : \"On board USB XDS110 debug\" - a USB cable is enough. It is USB powered."), R("Le kit annonce aussi une prise pour une sonde externe : « 14-pin TI-JTAG header (not populated) ».", "kit", "", "The kit also announces a header for an external probe : \"14-pin TI-JTAG header (not populated)\"."),
    R("Sur une carte à soi, la sonde se branche sur les broches JTAG du CPU : TMS, TCK, TDI, TDO, nTRST et RTCK (boîtier PGE : broches 108, 112, 110, 111, 109 et 113).", "ds", "p. 20", "On a board of one's own the probe goes to the JTAG pins of the CPU : TMS, TCK, TDI, TDO, nTRST and RTCK (PGE package : pins 108, 112, 110, 111, 109 and 113).")],
  flash: [R("Le kit dit avoir une « on-board emulation for programming and debugging » : la séance de débogage de l'atelier écrit le programme dans la flash.", "kit", "", "The kit says it has an \"on-board emulation for programming and debugging\" : the debug session of the IDE writes the program into the flash."), R("« UniFlash » se dit un outil pour programmer la flash des microcontrôleurs du fabricant, avec une interface graphique et une ligne de commande ; la page du kit le cite parmi ses logiciels.", "uniflash", "", "\"UniFlash\" calls itself a tool for programming the on-chip flash of the microcontrollers of the maker, with a graphical and a command-line interface ; the page of the kit lists it among its software."),
    R("Écrire toute la flash de programme (1,25 Mo) prend au plus 13 s, sans compter le transfert des données ; effacer un secteur, 0,03 s d'ordinaire et 4 s au plus.", "ds", "tableau 6-23, p. 77", "Programming the whole program flash (1.25 MByte) takes 13 s at most, data transfer not counted ; erasing a sector, 0.03 s nominal and 4 s at most."),
    R("Un module de sécurité (AJSM) permet de verrouiller l'accès JTAG une fois le CPU programmé.", "ds", "p. 109", "A security module (AJSM) lets one lock the JTAG access once the CPU is programmed.")],
  check: [R("Le kit a une liaison série vers l'ordinateur : « On board SCI to PC serial communication » — de quoi faire imprimer au CPU ce que l'essai imprime sur l'ordinateur. Ce programme-là reste à écrire.", "kit", "", "The kit has a serial link to the computer : \"On board SCI to PC serial communication\" - enough to have the CPU print what the test prints on a computer. That program is still to be written."),
    R("La page du kit dit ce CPU « IEC 61508 SIL 3 and ISO 26262 ASIL D certified ». Le certificat lui-même n'a pas été lu ; la fiche technique, elle, ne cite aucune norme.", "kit", "", "The page of the kit calls this CPU \"IEC 61508 SIL 3 and ISO 26262 ASIL D certified\". The certificate itself was not read ; the data sheet names no standard.")],
};
const STEPS = [
  { key: "pack", icon: "download", title: "Télécharger le paquet", en: "Download the package",
    plain: "Le paquet est un dossier compressé (.zip) : les fichiers C que l'outil a écrits à partir de vos tuiles. C'est du texte — on peut tout lire avant de s'en servir.", does: "Bouton « Fichiers C (.zip) », en tête du volet de gauche. Il attend que toutes les valeurs d'exemple soient confirmées.",
    enText: "Unzip the package. Every file is plain text : read it before using it." },
  { key: "hal", icon: "chip", title: "Écrire ce qui touche le CPU", en: "Write what touches the CPU",
    plain: "Vos tuiles ne savent pas comment CE microcontrôleur lit une tension ou allume une broche. Quatre petites fonctions font le lien — hal_init, hal_adc_read, hal_gpio_read, hal_gpio_write. L'outil en écrit le squelette ; leur contenu s'écrit avec les pilotes du fabricant.",
    does: "Ouvrir hal/<cpu>/hal_<cpu>.c : chaque « TODO » dit quoi appeler. Les pilotes viennent de l'outil du fabricant — jamais copiés ici.", enText: "Fill hal/<cpu>/hal_<cpu>.c : four functions (hal_init, hal_adc_read, hal_gpio_read, hal_gpio_write), written with the drivers of the maker of the CPU." },
  { key: "project", icon: "folder", title: "Monter le projet dans l'atelier logiciel", en: "Set up the project in the IDE",
    plain: "Un atelier logiciel (IDE) est le programme où l'on range les fichiers, où on les compile et d'où on les envoie au CPU. On y crée un projet pour ce CPU, et on y ajoute les dossiers lib/, cfg/, io/, app/ et le fichier de hal/.",
    does: "Créer le projet, y ajouter les fichiers du paquet (sauf hal/host/ et test/, qui sont pour l'ordinateur), et dire au compilateur où sont les en-têtes.", enText: "Create a project for the CPU in its IDE ; add lib/, cfg/, io/, app/ and hal/<cpu>/ (hal/host/ and test/ are for a computer only) ; add the same include paths as the line of the README." },
  { key: "build", icon: "wizard", title: "Compiler", en: "Build",
    plain: "Compiler, c'est traduire le texte C en un fichier de nombres que le CPU sait exécuter. Le compilateur dit aussi tout ce qui cloche : une erreur arrête, un avertissement se lit.",
    does: "Lancer la construction. Appeler bms_init() une fois au démarrage, puis bms_step(BMS_PERIOD_MS) à chaque période — depuis une minuterie du CPU.", enText: "Build. Call bms_init() once at start-up, then bms_step(BMS_PERIOD_MS) every period, from a timer of the CPU." },
  { key: "wire", icon: "power", title: "Brancher la sonde", en: "Connect the debug probe",
    plain: "La sonde est un petit boîtier entre l'ordinateur (USB) et le CPU. Elle parle au CPU par quelques fils — la liaison JTAG — et sert à deux choses : y copier le programme, et le regarder tourner.",
    does: "Relier l'ordinateur à la carte par la sonde ; alimenter la carte.", enText: "Connect the computer to the board through the debug probe (JTAG) ; power the board." },
  { key: "flash", icon: "download", title: "Charger le programme", en: "Load the program",
    plain: "Charger (« flasher »), c'est copier le fichier compilé dans la mémoire flash du CPU. Cette mémoire garde son contenu sans courant : le programme redémarre tout seul à chaque mise sous tension.",
    does: "Depuis l'atelier logiciel, lancer « charger » (ou une séance de débogage) ; ou passer par l'outil de programmation du fabricant.", enText: "Load the built program into the flash of the CPU, from the IDE (a debug session) or with the flash tool of the maker." },
  { key: "check", icon: "check", title: "Vérifier qu'il fait ce que le dessin dit", en: "Check it does what the drawing says",
    plain: "Sur l'ordinateur, l'essai du paquet rejoue le scénario et doit imprimer exactement les nombres du modèle (test/expected.txt). Sur la carte, on refait les mêmes gestes au banc et on compare.",
    does: "D'abord sur l'ordinateur : la ligne « cc … » du README, puis comparer avec test/expected.txt. Ensuite sur la carte, entrée par entrée.", enText: "On a computer first : build test/bms_test.c with hal/host/ (the line of the README) and compare its output with test/expected.txt. Then on the board, input by input." },
];
/** The chain for a CPU sheet. → { steps: [{ n, key, icon, title, plain, does, read: [{ text, src, where }] }], sources, known (documents of this CPU were read), kit } */
export function loadChain(cpu) {
  const known = !!(cpu && /^tms570ls1224/.test(cpu.key || "")), T = known ? TMS : {};
  return { known, steps: STEPS.map((s, i) => ({ n: i + 1, key: s.key, icon: s.icon, title: s.title, plain: s.plain, does: s.does, read: T[s.key] || [] })), sources: known ? LOAD_SOURCES : [],
    kit: known ? "LAUNCHXL2-TMS57012" : "", note: known ? "Ce que le fabricant publie est rendu ici dans nos mots, avec la page où cela a été lu ; les passages entre guillemets sont les siens." : "Pour ce CPU, aucun document n'a été lu : la chaîne est celle de tout microcontrôleur. Les noms des outils, de la sonde et des broches se lisent dans la documentation de votre CPU." };
}
/** The same chain as a file of the package, in plain English. */
export function loadDoc(cpu, name = "the software") {
  const c = loadChain(cpu), src = (id) => (LOAD_SOURCES.find((s) => s.id === id) || {}).url || "";
  return [`# ${name} - from these files to the microcontroller`, "", FOOT_NOTE_ASCII, "", `CPU chosen : ${(cpu && cpu.name) || "generic CPU"}.`, "", "Nothing of this chain is done by the tool, and none of it was tried : these files have run on no microcontroller.", "",
    ...STEPS.flatMap((s, i) => [`## ${i + 1}. ${s.en}`, "", s.enText, "", ...(c.steps[i].read.length ? ["What the maker publishes (read by the tool's authors ; quoted words are the maker's) :", ...c.steps[i].read.map((r) => `- ${r.en || r.text} [${src(r.src)}${r.where ? `, ${r.where.replace("tableau", "table")}` : ""}]`), ""] : [])]),
    ...(c.known ? [] : ["No document of this CPU was read : the names of its tools, of its probe and of its pins are in its own documentation.", ""])].join("\n");
}
