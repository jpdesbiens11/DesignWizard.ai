/* DesignWizard.ai — the hardware / software interface of a link, READ FROM THE BOARD (demande de JP : « … signaux et
   contribution au code logiciel — on aura l'interface HW/SW »). For each RS-485 block of a board : which pin of the
   microcontroller carries which signal of the transceiver, under which name the software knows it, where the bus leaves
   the board, the times the software must hold, the frame, and the printed frames the driver is checked against.
   Nothing is typed twice : the pins come from the nets of the board, the times and the frame from the model of the link
   (sw/rs485_link.js), the electrical values from what was read (pcba/rs485.js). The sheet leaves as a Word or PDF document
   and, with the C driver, as a .zip (sw/rs485_c.js).
   Pure : no page. */

import { RTU, RTU_RULES, RTU_VECTORS, charTime, silences, replayVectors } from "./rs485_link.js";
import { RS485_FACTS, RS485_SOURCES, RS485_SERIES } from "../pcba/rs485.js";
import { cDriver } from "./rs485_c.js";

const fr = (x, d = 4) => String(+(+x).toPrecision(d)).replace(".", ","), us = (s) => `${fr(s * 1e6)} µs`, hex = (a) => a.map((b) => b.toString(16).toUpperCase().padStart(2, "0")).join(" ");
/* what the software calls each signal, and what it does with it */
const SIGNALS = [
  { pin: "DI", sw: "RS485_UART_TX", dir: "sortie du microcontrôleur", text: "Les octets à émettre : UART, 8 bits de données, parité paire, 1 bit de stop. Au repos : 1." },
  { pin: "RO", sw: "RS485_UART_RX", dir: "entrée du microcontrôleur", text: "Les octets reçus ; une interruption par octet appelle rs485_on_byte()." },
  { pin: "DE", sw: "RS485_DE", dir: "sortie du microcontrôleur", text: "1 : ce nœud émet (DE et RE sont reliés : le récepteur se tait pendant ce temps). Au démarrage : 0, tenu par le rappel de la carte." },
];
/** The RS-485 links of a board. → [{ block, name, ref (the transceiver), params, pins: [{ sw, signal, dir, net, mcu ("U2.PA9" or ""), text }], bus: [{ line, net, at ("J2.1"), parts }], calc, notes, problems: [text] }] */
export function rs485Links(board) {
  const parts = board.parts || [], nets = board.nets || [], byRef = new Map(parts.map((p) => [p.ref, p])), netOf = (pin) => nets.find((n) => (n.pins || []).includes(pin)) || null, isMcu = (ref) => /^U-MCU/.test((byRef.get(ref) || {}).comp || "");
  return (board.blocks || []).filter((b) => b.template === "rs485").map((b) => {
    const mine = parts.filter((p) => p.block === b.id), local = (id) => (mine.find((p) => p.local === id) || {}).ref || "", U = local("U"), J = local("J"), problems = [];
    const pins = SIGNALS.map((s) => { const n = U ? netOf(`${U}.${s.pin}`) : null, m = n ? (n.pins || []).find((x) => isMcu(x.split(".")[0])) : ""; if (!m) problems.push(`${s.pin} (${s.sw}) n'est relié à aucune broche d'un microcontrôleur de la carte.`); return { sw: s.sw, signal: s.pin, dir: s.dir, net: n ? n.name : "", mcu: m || "", text: s.text }; });
    const line = (name, chip, k) => { const inner = U ? netOf(`${U}.${chip}`) : null, at = J ? `${J}.${k}` : "", outer = at ? netOf(at) : inner, on = outer ? (outer.pins || []).map((x) => x.split(".")[0]).filter((r) => r !== U && r !== J) : []; return { line: name, net: outer ? outer.name : "", at, parts: [...new Set(on)].map((r) => { const p = byRef.get(r) || {}; return `${r}${p.value ? ` (${p.value})` : ""}`; }) }; };
    const bus = [line("A — D1 dans MODBUS", "A", 1), line("B — D0 dans MODBUS", "B", 2)]; if (J) bus.push({ line: "Commun", net: (netOf(`${J}.3`) || {}).name || "", at: `${J}.3`, parts: [] });
    if (!U) problems.push("L'émetteur-récepteur du bloc n'est pas sur la carte."); if (!J) problems.push("Pas de bornier dans ce bloc : le bus sort par un autre connecteur de la carte — nommez-y D1, D0 et le commun.");
    return { block: b.id, name: b.name || "Interface RS-485", ref: U, params: b.params || {}, pins, bus, problems };
  });
}
/** The times the software holds, from the model. → [[label, value, where]] */
export function linkTimes(baud = RTU.baud) {
  const S = silences(baud);
  return [["Débit", `${String(baud).replace(/(\d)(?=(\d{3})+$)/, "$1 ")} bit/s`, RTU_RULES.baud.where], ["Un caractère (11 bits)", us(charTime(baud)), RTU_RULES.char.where], ["Silence dans une trame, au plus (t1,5)", us(S.t15), RTU_RULES.silence.where], ["Silence entre deux trames, au moins (t3,5)", us(S.t35), RTU_RULES.silence.where],
    ["DE levée avant le premier bit", `${us(1 / baud)} (un bit)`, "choix du pilote : au moins le temps de validation de l'émetteur — voir la fiche du composant monté"], ["DE rendue", "dès que le dernier bit de stop est parti (« transmission terminée »)", "choix du pilote"], ["Trame la plus longue", `${RTU.max} octets, soit ${fr(RTU.max * charTime(baud) * 1000, 3)} ms`, RTU_RULES.frame.where]];
}
/** The sheet, as a document (core/docx.js, core/pdfdoc.js). o : { date, project, author } */
export function hwswDoc(board, o = {}) {
  const links = rs485Links(board), out = [], date = o.date || new Date(0), h1 = (t) => out.push({ type: "h1", text: t }), h2 = (t) => out.push({ type: "h2", text: t }), p = (t, style) => out.push({ type: "p", text: t, style }), list = (items) => out.push({ type: "list", items });
  let n = 0; const sec = (t) => h1(`${++n}. ${t}`), R = replayVectors();
  out.push({ type: "toc" }, { type: "pagebreak" });
  sec("À quoi sert cette fiche");
  p(`Elle dit, pour la carte ${board.id} « ${board.name || ""} », révision ${board.revision || "A"}, où le matériel et le logiciel se touchent sur la liaison RS-485 : quelle broche du microcontrôleur porte quel signal, sous quel nom le logiciel le connaît, quels temps il doit tenir, et ce qui doit se lire sur le bus. Elle est lue des nets de la carte : si la carte change, la fiche change.`);
  p("Le protocole est MODBUS RTU, pris comme EXEMPLE parce que sa spécification est publique et complète. Un produit qui en parle un autre garde la couche électrique et la commande de direction, et change la trame.", "muted");
  out.push({ type: "kv", rows: [["Carte", `${board.id} — ${board.name || ""}`], ["Révision", board.revision || "A"], ["Projet", (o.project && o.project.name) || "—"], ["Rédacteur", o.author || "—"], ["Date", date.toISOString().slice(0, 10)], ["Liaisons RS-485", String(links.length)]] });
  if (!links.length) { p("Cette carte n'a pas de bloc « Interface RS-485 » : ajoutez-en un dans le PCBA.", "warn"); }
  for (const L of links) {
    sec(`Les signaux — ${L.name} (${L.block}${L.ref ? `, ${L.ref}` : ""})`);
    out.push({ type: "table", head: ["Symbole du logiciel", "Broche du microcontrôleur", "Net", "Broche du transceiver", "Sens", "Ce que le logiciel en fait"], widths: [17, 13, 11, 10, 14, 35], rows: L.pins.map((x) => [x.sw, x.mcu || "non relié", x.net || "—", x.signal, x.dir, x.text]) });
    for (const t of L.problems) p(t, "warn");
    h2("Le bus sur la carte");
    out.push({ type: "table", head: ["Ligne", "Net", "Borne", "Ce qui est posé dessus"], widths: [26, 16, 12, 46], rows: L.bus.map((x) => [x.line, x.net || "—", x.at || "—", x.parts.join(", ") || "—"]) });
    list(["La broche A du circuit monte quand DI est à 1 : c'est la ligne D1 de MODBUS (« B » dans la norme), et la broche B est D0. Déduit de deux textes lus — la fiche du transceiver et la spécification MODBUS ; à vérifier sur le composant monté avant de croiser deux fils.", "Terminaison aux deux bouts du câble seulement ; polarisation à UN seul endroit du bus.", "A et B routées ensemble, de même longueur, au-dessus d'un plan de masse ; écrêteur et résistances série au plus près du bornier."]);
  }
  sec("Les temps que le logiciel tient");
  out.push({ type: "table", head: ["", "Valeur", "D'où elle vient"], widths: [34, 30, 36], rows: linkTimes() });
  p("Le piège le plus courant : rendre le bus sur « tampon vide » — le dernier octet vient d'entrer dans le registre de l'UART, il n'est pas encore sur le fil — au lieu de « transmission terminée ». Le dernier octet est alors tronqué. L'essai « Une trame sur le bus » du Labo le montre à l'oscilloscope : DE doit couvrir toute la trame.", "note");
  sec("La trame");
  out.push({ type: "table", head: ["Règle", "Ce que dit la spécification", "Où"], widths: [14, 62, 24], rows: [["Trame", RTU_RULES.frame.text, RTU_RULES.frame.where], ["Caractère", RTU_RULES.char.text, RTU_RULES.char.where], ["Silences", RTU_RULES.silence.text, RTU_RULES.silence.where], ["Débit", RTU_RULES.baud.text, RTU_RULES.baud.where], ["CRC", RTU_RULES.crc.text, RTU_RULES.crc.where], ["Adresses", RTU_RULES.address.text, RTU_RULES.address.where]] });
  sec("Le pilote que l'outil écrit");
  p("Quatre fichiers, en C99 sobre : pas d'allocation, types à largeur fixe, aucune bibliothèque de fabricant. C'est un SQUELETTE, écrit à partir du même modèle que cette fiche : il se relit, se teste et se revoit comme tout code livré.");
  out.push({ type: "table", head: ["Fichier", "Ce qu'il contient"], widths: [26, 74], rows: [["rs485_link.h", "Les constantes de la liaison (débit, t1,5, t3,5, avance de DE), l'interface du port — quatre fonctions à écrire pour votre microcontrôleur — et l'état d'un lien."], ["rs485_link.c", "Le CRC-16, la mise en trame et sa vérification, l'émission (DE d'abord, les octets un bit plus tard, le bus rendu sur « transmission terminée »), la réception octet par octet et la fin de trame par le silence."], ["rs485_link_test.c", "Un programme pour n'importe quel ordinateur : il rejoue les trames imprimées par d'autres et la séquence d'émission et de réception, et écrit ALL PASS."], ["rs485_vectors.txt", "Les trames de référence, avec leur source."]] });
  h2("Ce qui reste à écrire dans le projet");
  list(["de(on) : la broche RS485_DE.", "write(octets, n) : confier n octets à l'UART (8 bits, parité paire, 1 stop).", "tx_complete() : 1 quand le DERNIER bit de stop est parti.", "now_us() : un compteur de microsecondes."]);
  sec("Les trames de référence");
  p("Des trames IMPRIMÉES par d'autres, octets dans l'ordre du fil : le modèle de l'outil et le pilote C doivent tous deux les redonner.");
  out.push({ type: "table", head: ["Trame", "Octets sur le fil", "Imprimé par la source", "Source", "Retrouvée"], widths: [20, 24, 20, 26, 10], rows: RTU_VECTORS.map((v, i) => [v.title, hex(v.bytes), v.printed, `${v.source} — ${v.where}`, R[i].ok ? "oui" : "NON"]) });
  sec("La couche électrique : ce qui a été lu");
  p("La norme TIA/EIA-485-A est payante et n'a PAS été lue. Les valeurs viennent de notes d'application et de fiches publiques de fabricants qui la reprennent, lues page par page.", "muted");
  out.push({ type: "table", head: ["", "Valeur", "Lu dans"], widths: [20, 50, 30], rows: RS485_FACTS.map((f) => [f.label, f.text, `${RS485_SOURCES[f.src].name.split(" — ")[0]}, ${f.where}`]) });
  h2("Séries de transceivers au même brochage");
  out.push({ type: "table", head: ["Fabricant", "Série", "Alimentation", "Débit", "Charge sur le bus"], widths: [20, 24, 18, 18, 20], rows: RS485_SERIES.map((s) => [s.maker, s.series, s.vcc, s.rate, s.load]), caption: "Cités comme références de compatibilité ; la fiche du composant acheté fait foi." });
  sec("Ce qui est vérifié, ce qui ne l'est pas");
  list(["Vérifié : le modèle et le pilote C redonnent les quatre trames imprimées ; le C, compilé sur un ordinateur, écrit ce que le modèle annonce ; les formules de polarisation redonnent les exemples chiffrés des notes lues.", "Simulé, non mesuré : les niveaux du bus viennent d'un comportement TYPIQUE de transceiver — aucune carte réelle n'a été mesurée.", "Non vérifié : le pilote n'a tourné sur aucun microcontrôleur ; les quatre fonctions du port, les interruptions et les priorités sont à écrire et à essayer dans le projet.", "Non lu : TIA/EIA-485-A, RTCA DO-160 (un équipement embarqué y est qualifié — foudre, décharges, susceptibilité) et toute exigence de niveau de développement du logiciel."]);
  return { title: `Interface matériel / logiciel — ${board.id}`, subtitle: "Liaison RS-485", subject: "Interface matériel / logiciel", author: o.author || "", date, reference: `${board.id}-ICD-485`, revision: board.revision || "A", header: `${board.id} rév. ${board.revision || "A"} — Interface matériel / logiciel`, footer: "DesignWizard.ai", blocks: out, links };
}
/** The files of the driver for a board : its pins written in the header. → [{ name, text }] */
export function driverFiles(board) { const L = rs485Links(board)[0]; return cDriver({ board: board.id, pins: L ? L.pins : [] }); }
/** What the interface asks to be looked at, for a guide. → [{ level, text }] */
export function hwswGuide(board) { return rs485Links(board).flatMap((L) => L.problems.map((t) => ({ level: "warn", text: `${L.name} : ${t}` }))); }
