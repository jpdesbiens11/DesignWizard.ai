/* DesignOrbit.ai — Logiciel : the CPU the software is written for, as a SHEET (demande de JP : « sachant… le CPU choisi » ; choix cliqué :
   un microcontrôleur de sécurité à double cœur d'abord). A sheet says what the design is checked against — how many analog channels, how many
   pins, the resolution of the converter — and what the skeleton of the hardware layer must say : what the CPU asks of its software.
   The first real sheet is a dual-core lockstep microcontroller of a large maker, cited in text as a reference of compatibility — no logo, no
   code of the maker. Every figure was READ in its public data sheet and says its page ; what the data sheet does NOT say is said too.
   The generic sheet is the one a project fills for its own CPU : its figures are examples.
   Pure : no page. */

/** What was read. */
export const CPU_SOURCES = [{ id: "spns190b", maker: "Texas Instruments", title: "TMS570LS1224 16- and 32-Bit RISC Flash Microcontroller — data sheet", doc: "SPNS190B, octobre 2012, révisée en février 2015", url: "https://www.ti.com/lit/ds/symlink/tms570ls1224.pdf",
  read: "Lue : 172 pages, téléchargée le 20 novembre 2026 ; chaque valeur reprise ici a été relue sur la page citée." }];
const F = (what, value, page) => ({ what, value, page });
const TMS = (key, pack, mhz, gio, irq) => ({ key, name: `TMS570LS1224 (${pack})`, maker: "Texas Instruments", family: "Hercules TMS570 — deux Arm Cortex-R4F en lockstep", source: "spns190b", lockstep: true, word: 32, clock: mhz, flash: 1280, ram: 192,
  adc: { bits: 12, channels: 24, modules: 2 }, gio, gioIrq: irq, can: 3, uart: 2, i2c: 1,
  /* what the device does on its own between power and the first instruction of the software — read in the data sheet */
  start: ["Donner les mêmes valeurs aux registres des DEUX cœurs avant toute autre chose : sinon le comparateur signale une fausse erreur (p. 56).", "Le chien de garde (p. 105) et la protection de la mémoire (p. 55) sont éteints à la mise sous tension : hal_init() allume ce que le projet décide d'employer."],      // what start-up asks, said on the screen
  boot: { page: "tableau 6-3, p. 52", unit: "cycles de l'oscillateur", total: 3497, phases: [["Démarrage de l'oscillateur et contrôle de sa validité", 1032], ["Lecture des réglages d'usine (eFuse autoload)", 1160], ["Mise en route de la pompe de la flash", 688], ["Mise en route de la mémoire flash", 617]] },
  facts: [F("Deux CPU en lockstep", "« Dual CPUs Running in Lockstep » ; les sorties des deux Cortex-R4F sont comparées par un module (CCM-R4)", "p. 1 et 55"), F("Fréquence maximale", `${mhz} MHz pour ce boîtier`, "tableau 3-1, p. 8"), F("Mémoire", "1 280 Ko de flash et 192 Ko de RAM, toutes deux avec ECC ; 64 Ko de flash pour une EEPROM émulée", "p. 1 et 8"),
    F("Convertisseur", "deux MibADC de 12 bits, 24 entrées en tout", "p. 3 et 8"), F("Broches logiques", `${gio} au plus, dont ${irq} capables d'interruption — des fonctions sont multiplexées : toutes ne sont pas libres à la fois`, "tableau 3-1 et sa note, p. 8"),
    F("Liaisons", "3 CAN (DCAN), 2 SCI (UART) dont un LIN, 3 MibSPI, 1 I2C", "p. 3 et 8"), F("Signalement d'erreur", "un module (ESM) qui tire une broche dédiée, nERROR ; l'écart entre les deux CPU y est le canal 2 du groupe 2", "p. 98 et 100"),
    F("Chien de garde", "fenêtré, numérique (DWWD), inactif à la mise sous tension", "p. 105"), F("Protection de la mémoire", "MPU de 12 régions, inactive à la mise sous tension", "p. 55"), F("Alimentations", "cœur 1,14 à 1,32 V ; entrées-sorties 3,0 à 3,6 V", "p. 1 et 8"), F("Température", "−40 à 125 °C (air ambiant)", "p. 8 et 42")],
  says: "La fiche technique le dit « for Safety-Critical Applications » et décrit son architecture de sécurité (lockstep, autotests, ECC). Elle ne cite AUCUNE norme : ni ISO 26262, ni IEC 61508, ni niveau ASIL ou SIL — ces mots n'y sont pas. Ce qu'un tel niveau demande se lit dans d'autres documents du fabricant, non lus ici.",
  notes: ["Two CPUs run the same code in lockstep : their outputs are compared by a module of the device (CCM-R4) ; a mismatch is signalled on the nERROR pin through the error signalling module (ESM). Nothing to write in the application for the compare itself.",
    "At start-up the software must initialize the registers of BOTH CPUs to the same values before anything else, or the compare module raises a false error (data sheet SPNS190B, p. 56).", "The windowed watchdog (DWWD), the memory protection unit (12 regions) and the ECC of the RAM are off at reset : hal_init() turns on what the project decides to use.",
    "The converter is 12 bits, two modules, 24 inputs in all : hal_adc_read() maps a channel of the design to an input of MibADC1 or MibADC2.", "The registers are those of the library of the maker : none of its code is copied here."] });
/** The sheets. adc.channels and gio are what a design is checked against. */
export const CPUS = {
  generic: { key: "generic", name: "CPU générique (fiche à remplir)", maker: "", family: "", source: "", lockstep: false, word: 32, clock: null, flash: null, ram: null, adc: { bits: 12, channels: 16, modules: 1 }, gio: 32, gioIrq: 0, can: 1, uart: 2, i2c: 1, boot: null, start: [], facts: [],
    says: "Une fiche d'exemple : 12 bits, 16 voies, 32 broches. Ses valeurs ne sont celles d'aucun composant — à remplacer par celles de la fiche technique du CPU du projet.", notes: ["A generic sheet : replace its figures by those of the data sheet of the CPU of the project."] },
  tms570ls1224_pge: TMS("tms570ls1224_pge", "LQFP 144 broches, PGE", 160, 64, 10),
  tms570ls1224_zwt: TMS("tms570ls1224_zwt", "BGA 337 billes, ZWT", 180, 101, 16),
};
/** The sheet of a design : the one it names, the generic one otherwise. */
export const cpuOf = (d) => CPUS[d && d.cpu] || CPUS.generic;
/** The sheets, the real ones first. */
export const cpuList = () => [CPUS.tms570ls1224_pge, CPUS.tms570ls1224_zwt, CPUS.generic];
