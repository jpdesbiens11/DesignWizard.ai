/* DynamiteOrbit — RS-485 : what is published about the link, and what follows from it (demande de JP : « ajouter les
   composantes et la fonction "communication" RS-485 avec un exemple concret : pièce, connecteur, traces, signaux »).
   The standard itself — TIA/EIA-485-A — is sold, and was NOT read. What is here was read, page by page, in public
   application notes and data sheets of makers that restate it, and in the MODBUS over Serial Line specification :
   each value says where it is printed. Where two notes print different numbers, both are kept, and the tool says
   which one it uses. Maker and series are named in text, as references of compatibility : no logo, no drawing copied.
   Pure : no page. The block that uses it : pcba/blocks_control.js (« rs485 ») ; the frame and the driver : sw/rs485_link.js. */

import { eSeries } from "./blocks_util.js";

/** The documents read (each page opened, the numbers copied as printed). */
export const RS485_SOURCES = {
  slla272: { name: "Texas Instruments SLLA272D — The RS-485 Design Guide (2008, rév. 2021)", url: "https://www.ti.com/lit/an/slla272d/slla272d.pdf" },
  slla070: { name: "Texas Instruments SLLA070D — RS-422 and RS-485 Standards Overview and System Configurations (2002, rév. 2010)", url: "https://www.ti.com/lit/an/slla070d/slla070d.pdf" },
  slyt324: { name: "Texas Instruments SLYT324 — RS-485: Passive failsafe for an idle bus (Analog Applications Journal, 1Q 2009)", url: "https://www.ti.com/lit/an/slyt324/slyt324.pdf" },
  an1986: { name: "Renesas AN1986 — External Fail-Safe Biasing of RS-485 Networks, Rev. 1.00 (2017)", url: "https://www.renesas.com/en/document/apn/an1986-external-fail-safe-biasing-rs-485-networks" },
  slla292: { name: "Texas Instruments SLLA292A — Protecting RS-485 Interfaces Against Lethal Electrical Transients (2009, rév. 2011)", url: "https://www.ti.com/lit/an/slla292a/slla292a.pdf" },
  thvd: { name: "Texas Instruments THVD1410 / THVD1450 — data sheet SLLSEY3E (2018, rév. 2019)", url: "https://www.ti.com/lit/ds/symlink/thvd1450.pdf" },
  hvd3082: { name: "Texas Instruments SN65HVD3082E — data sheet SLLS562O (2009, rév. 2023)", url: "https://www.ti.com/lit/ds/symlink/sn65hvd3082e.pdf" },
  isl: { name: "Renesas ISL8483E / ISL8485E — data sheet FN6048 Rev. 13.00 (2018)", url: "https://www.renesas.com/en/document/dst/isl8483e-isl8485e-datasheet" },
  modbus: { name: "MODBUS over Serial Line — Specification and Implementation Guide V1.02 (2006)", url: "https://www.modbus.org/file/secure/modbusoverserial.pdf" },
};
/** The numbers of the electrical layer, as the notes restate the standard. */
export const RS485 = { vodMin: 1.5, testLoad: 54, rxThreshold: 0.2, cmMin: -7, cmMax: 12, unitLoad: 12000, unitLoads: 32, rcm: 375, z0: 120 };
/** What is printed, line by line : → [{ id, label, text, src (a key of RS485_SOURCES), where }] */
export const RS485_FACTS = [
  { id: "vod", label: "Sortie de l'émetteur", text: "au moins 1,5 V en différentiel sur une charge de 54 Ω", src: "slla272", where: "§ 4, p. 2" },
  { id: "rx", label: "Seuil du récepteur", text: "une entrée différentielle jusqu'à 200 mV est détectée (± 200 mV)", src: "slla272", where: "§ 4, p. 2" },
  { id: "cm", label: "Mode commun du bus", text: "de −7 V à +12 V", src: "slla272", where: "§ 2, p. 1" },
  { id: "ul", label: "Charge unitaire", text: "une charge unitaire vaut environ 12 kΩ ; un émetteur conforme en commande 32 (soit 375 Ω)", src: "slla272", where: "§ 8, p. 4" },
  { id: "z0", label: "Câble et terminaison", text: "paire torsadée de 120 Ω ; une résistance de 120 Ω à chaque bout du câble, nulle part ailleurs", src: "slla272", where: "§ 5 et § 6, p. 2-3" },
  { id: "stub", label: "Dérivation (stub)", text: "sa longueur électrique reste sous le dixième du temps de montée de l'émetteur : L ≤ (tr / 10) × v × c", src: "slla272", where: "§ 6, éq. 1, p. 3" },
  { id: "rate", label: "Débit et longueur", text: "deux règles de pouce imprimées : longueur [m] × débit [bit/s] < 10⁷ (SLLA272D, fig. 9-1) et ≤ 10⁸ (SLLA070D, § 2.1) — l'outil retient la plus prudente", src: "slla272", where: "fig. 9-1, note B, p. 5" },
  { id: "bias", label: "Polarisation du bus au repos", text: "RB = (VS / VAB + 1) / (1 / 375 Ω + 4 / Z0) ; avec Z0 = 120 Ω : (VS / VAB + 1) × 27,8 Ω", src: "an1986", where: "éq. 6, p. 4 — même forme dans SLYT324, éq. 6, p. 2" },
  { id: "tvs", label: "Protection des lignes", text: "trois écrêteurs (A – masse, B – masse, A – B), tension de veille de 12 V ou plus, au plus près du connecteur ; résistances série de 10 Ω à 20 Ω, tenant l'impulsion", src: "slla292", where: "§ 4 et § 5, p. 5-8" },
  { id: "en", label: "Broches de validation", text: "un rappel de 1 kΩ à 10 kΩ sur DE et RE : l'émetteur reste coupé tant que le microcontrôleur n'a pas démarré", src: "thvd", where: "§ 12.1, p. 29" },
  { id: "pins", label: "Brochage du boîtier 8 broches", text: "1 RO (R), 2 RE, 3 DE, 4 DI (D), 5 GND, 6 A, 7 B, 8 VCC — le même dans les quatre fiches lues ; un niveau haut sur DI met A au-dessus de B", src: "thvd", where: "p. 5 et § 9.4.1, p. 19 ; ISL8485E, p. 3" },
  { id: "modbus-pol", label: "MODBUS : polarisation et terminaison", text: "rappel vers 5 V sur D1, rappel vers le commun sur D0, entre 450 Ω et 650 Ω, à UN seul endroit du bus ; terminaison de 150 Ω, ou 120 Ω en série avec 1 nF quand la paire est polarisée", src: "modbus", where: "§ 3.4.5 et § 3.4.6, p. 27-28" },
  { id: "modbus-pin", label: "MODBUS : noms et connecteurs", text: "D1 est la ligne « B/B' », D0 la ligne « A/A' », plus un commun ; RJ45 : D1 = 4, D0 = 5, commun = 8 ; D-shell 9 : D1 = 5, D0 = 9, commun = 1", src: "modbus", where: "§ 3.3.2, p. 22 et § 3.5.1, p. 29" },
];
/** Series of half-duplex transceivers in an 8-pin package with the pinout above, named as references of compatibility (data sheets read ; the data sheet of the part bought prevails). */
export const RS485_SERIES = [
  { maker: "Texas Instruments", series: "THVD1410 / THVD1450", vcc: "3 V à 5,5 V", rate: "500 kbit/s / 50 Mbit/s", load: "1/8 de charge unitaire (256 nœuds)", src: "thvd" },
  { maker: "Texas Instruments", series: "SN65HVD3082E", vcc: "4,5 V à 5,5 V", rate: "200 kbit/s", load: "1/8 de charge unitaire (256 nœuds)", src: "hvd3082" },
  { maker: "Renesas", series: "ISL8483E / ISL8485E", vcc: "4,5 V à 5,5 V", rate: "250 kbit/s / 10 Mbit/s", load: "1 charge unitaire (32 nœuds)", src: "isl" },
];

const K = (z0) => 1 / (1 / RS485.rcm + 4 / z0);
/** The bias resistor that holds an idle bus at vab (V) from a supply vs (V) : RB = (VS / VAB + 1) / (1 / 375 + 4 / Z0). → ohms */
export const biasResistor = (vs, vab = 0.25, z0 = RS485.z0) => (vs / vab + 1) * K(z0);
/** The idle voltage a pair of bias resistors rb holds on a bus terminated at both ends. → volts */
export const idleVoltage = (vs, rb, z0 = RS485.z0) => vs / (rb / K(z0) - 1);
/** How many unit loads are left for the transceivers once the bias network is on the bus : 12 kΩ × (1 / 375 − 1 / RB). */
export const unitLoadsLeft = (rb) => RS485.unitLoad * (1 / RS485.rcm - 1 / rb);
/** The whole network of a biased end. loads : the unit loads the transceivers of the bus need (0 : not counted).
    The formula gives the resistor that holds vab ; when that resistor would leave the bus fewer unit loads than its transceivers need — a
    low supply does that — the resistor is raised to what leaves them room, the idle voltage comes out lower than asked, and `short` says so.
    → { rb (by the formula), rbStd (E96 : the next lower value, or the next higher when raised), rt1 (the far end), rt2 (this end : rt2 ∥ 2·rb = z0), rt2Std,
        idle (V at vs, with the standard values), left (unit loads left for transceivers), short } */
export function biasNetwork({ vs = 3.3, vab = 0.25, z0 = RS485.z0, loads = 0 } = {}) {
  const rb = biasResistor(vs, vab, z0), floor = loads > 0 ? 1 / (1 / RS485.rcm - loads / RS485.unitLoad) : 0, raised = floor > rb;
  const rbStd = raised ? eSeries(floor, "E96", "up") : eSeries(rb, "E96", "down"), rt2 = (2 * rbStd * z0) / (2 * rbStd - z0), rt2Std = eSeries(rt2, "E96", "down"), idle = idleVoltage(vs, rbStd, z0);
  return { rb, rbStd, rt1: z0, rt2, rt2Std, idle, left: unitLoadsLeft(rbStd), short: idle < vab * 0.999 };
}
/** The longest stub for a driver rise time (s) on a cable of velocity factor v : L ≤ (tr / 10) × v × c. → metres */
export const stubMax = (rise, v = 0.78) => (rise / 10) * v * 299792458;
/** The highest rate (bit/s) for a cable length (m), by the two printed rules of thumb. → { careful (10⁷), loose (10⁸) } */
export const rateFor = (length) => ({ careful: 1e7 / Math.max(length, 1e-9), loose: 1e8 / Math.max(length, 1e-9) });
/** What a link asks to be looked at, for a guide. o : { vdd, bias, term, prot, nodes, share (unit load of one transceiver, 1 or 1/8), rate, length } → [{ level, text }] */
export function rs485Guide(o = {}) {
  const out = [], n = o.nodes || 2, share = o.share || 1 / 8, net = o.bias ? biasNetwork({ vs: o.vdd || 3.3 }) : null, left = net ? net.left : RS485.unitLoads;
  if (n * share > left) out.push({ level: "error", text: `${n} nœuds de ${share === 1 ? "1" : "1/8 de"} charge unitaire font ${String(+(n * share).toFixed(1)).replace(".", ",")} charges : le bus en porte ${String(+left.toFixed(1)).replace(".", ",")}${net ? " une fois la polarisation posée" : ""}.` });
  if (o.rate && o.length && o.rate > rateFor(o.length).careful) out.push({ level: o.rate > rateFor(o.length).loose ? "error" : "warn", text: `${Math.round(o.length)} m à ${Math.round(o.rate / 1000)} kbit/s dépasse la règle de pouce longueur × débit < 10⁷ : baissez le débit ou raccourcissez le câble.` });
  if (!o.term) out.push({ level: "info", text: "Sans terminaison sur cette carte : elle doit être l'un des nœuds du milieu — les deux résistances de 120 Ω sont aux deux bouts du câble." });
  if (!o.bias) out.push({ level: "info", text: "Sans polarisation ici : un autre nœud — d'habitude le maître — tient le bus au repos, à UN seul endroit." });
  if (!o.prot) out.push({ level: "warn", text: "Sans protection des lignes : un bus qui sort de la carte reçoit des décharges et des transitoires — écrêteurs au plus près du connecteur." });
  return out;
}
