/* DynamiteOrbit — the RS-485 link as the software sees it : the MODEL (demande de JP : « … signaux et contribution au code
   logiciel — on aura l'interface HW/SW »). One source for three things : what the Labo puts on the bus of the simulated
   board, the C driver the tool writes (sw/rs485_c.js), and the sheet of the hardware / software interface (sw/hwsw.js).
   The protocol is MODBUS RTU, chosen because its specification is public and complete : the frame, the character of
   11 bits, the silent intervals and the CRC are those of « MODBUS over Serial Line — Specification and Implementation
   Guide V1.02 » (pages read ; each constant says where it is printed). It is an EXAMPLE of a protocol on RS-485 : a
   product that speaks another one keeps the electrical layer and the direction control, and changes the frame.
   Pure : no page, typed numbers only — what the C does, this does. */

/** Where each rule is printed in the specification (PDF pages). */
export const RTU_RULES = {
  frame: { text: "adresse (1 octet), fonction (1 octet), données (0 à 252 octets), CRC (2 octets, l'octet faible d'abord) ; 256 octets au plus", where: "§ 2.5.1, fig. 12, p. 13" },
  char: { text: "11 bits par octet : 1 start, 8 données (le bit de poids faible d'abord), 1 parité, 1 stop ; parité paire d'office — sans parité, 2 bits de stop", where: "§ 2.5.1, p. 12" },
  silence: { text: "les trames sont séparées par un silence d'au moins 3,5 caractères ; plus de 1,5 caractère entre deux octets rend la trame incomplète ; au-delà de 19 200 bit/s : 750 µs et 1,750 ms, fixes", where: "§ 2.5.1.1, p. 13" },
  baud: { text: "9 600 et 19 200 bit/s exigés ; 19 200 bit/s d'office", where: "§ 3.2, p. 20" },
  crc: { text: "registre chargé à 0xFFFF ; chaque octet entre par un OU exclusif sur l'octet faible, puis 8 décalages à droite — quand le bit sorti vaut 1, OU exclusif avec 0xA001", where: "§ 6.2.2, p. 39" },
  address: { text: "0 : diffusion ; 1 à 247 : un esclave ; 248 à 255 : réservé", where: "§ 2.2, p. 8" },
};
export const RTU = { poly: 0xa001, init: 0xffff, bits: 11, baud: 19200, max: 256, t15Fixed: 750e-6, t35Fixed: 1750e-6, fixedAbove: 19200 };

/** CRC-16 of MODBUS over a list of bytes. → 0…65535 (its low byte goes first on the wire) */
export function crc16(bytes) { let crc = RTU.init; for (const b of bytes) { crc ^= b & 0xff; for (let k = 0; k < 8; k++) crc = crc & 1 ? (crc >>> 1) ^ RTU.poly : crc >>> 1; } return crc & 0xffff; }
/** A frame, ready for the wire : address, function, data, then the CRC — low byte first. → [bytes], or null when it cannot be one */
export function rtuFrame(addr, fn, data = []) {
  if (!Number.isInteger(addr) || addr < 0 || addr > 247 || !Number.isInteger(fn) || fn < 1 || fn > 127 || data.length > 252) return null;
  const body = [addr, fn, ...data.map((b) => b & 0xff)], crc = crc16(body); return [...body, crc & 0xff, crc >>> 8];
}
/** A frame received, read : → { ok, addr, fn, data, crc (computed), got (received) , why } */
export function rtuCheck(bytes) {
  if (!Array.isArray(bytes) || bytes.length < 4) return { ok: false, why: "moins de 4 octets : ce n'est pas une trame" }; if (bytes.length > RTU.max) return { ok: false, why: "plus de 256 octets" };
  const n = bytes.length, crc = crc16(bytes.slice(0, n - 2)), got = bytes[n - 2] | (bytes[n - 1] << 8);
  return { ok: crc === got, addr: bytes[0], fn: bytes[1], data: bytes.slice(2, n - 2), crc, got, why: crc === got ? "" : "le CRC reçu n'est pas celui de la trame" };
}
/** The 11 levels of one byte on the line, in order : start (0), 8 data bits least significant first, even parity, stop (1). */
export function charBits(byte) { const d = Array.from({ length: 8 }, (_, k) => (byte >> k) & 1); return [0, ...d, d.reduce((a, b) => a ^ b, 0), 1]; }
/** The levels of a whole frame, character after character (nothing between two characters : the line stays at 1). */
export const frameBits = (bytes) => bytes.flatMap(charBits);
/** How long one character lasts (s). */
export const charTime = (baud = RTU.baud) => RTU.bits / baud;
/** The two silent intervals (s) : 1,5 and 3,5 characters, fixed above 19 200 bit/s. → { t15, t35 } */
export const silences = (baud = RTU.baud) => (baud > RTU.fixedAbove ? { t15: RTU.t15Fixed, t35: RTU.t35Fixed } : { t15: 1.5 * charTime(baud), t35: 3.5 * charTime(baud) });
/** How long a frame of n bytes holds the bus (s), the driver enabled `lead` seconds before the first start bit. */
export const frameTime = (n, baud = RTU.baud, lead = 0) => lead + n * charTime(baud);

/** A receiver, byte by byte, as the driver runs it : feed(byte, t) and poll(t) → a frame when the line has been silent for t3,5.
    A gap of more than t1,5 inside a frame throws it away (the frame is said incomplete). */
export function rtuReceiver(baud = RTU.baud) {
  const S = silences(baud); let buf = [], last = -Infinity, bad = false;
  return {
    feed(byte, t) { if (buf.length && t - last > S.t15) bad = true; if (buf.length < RTU.max) buf.push(byte & 0xff); else bad = true; last = t; },
    poll(t) { if (!buf.length || t - last < S.t35) return null; const out = bad ? { ok: false, why: "silence de plus de 1,5 caractère dans la trame, ou trame trop longue" } : rtuCheck(buf); buf = []; bad = false; return out; },
  };
}
const hex = (s) => s.trim().split(/\s+/).map((x) => parseInt(x, 16));
/** Frames PRINTED by others, bytes in the order of the wire — what the model and the C must both give back.
    read : "read" (the page was opened and the bytes copied as printed). */
export const RTU_VECTORS = [
  { id: "spec-02-07", title: "Esclave 2, fonction 07", bytes: hex("02 07 41 12"), printed: "The CRC 16 of the frame is then: 4112", source: "MODBUS over Serial Line — Specification and Implementation Guide V1.02", where: "§ 6.2.2, « Example of CRC calculation (frame 02 07) », p. 41", url: "https://www.modbus.org/file/secure/modbusoverserial.pdf", read: "read" },
  { id: "tuto-fc03-req", title: "Esclave 17 : lire 3 registres depuis 0x006B", bytes: hex("11 03 00 6B 00 03 76 87"), printed: "11 03 006B 0003 7687", source: "Simply Modbus — Read Holding Registers (FC03)", where: "« Request »", url: "https://simplymodbus.ca/learn-rtu-fc03.html", read: "read" },
  { id: "tuto-fc03-rsp", title: "La réponse : 6 octets de données", bytes: hex("11 03 06 AE 41 56 52 43 40 49 AD"), printed: "11 03 06 AE41 5652 4340 49AD", source: "Simply Modbus — Read Holding Registers (FC03)", where: "« Response »", url: "https://simplymodbus.ca/learn-rtu-fc03.html", read: "read" },
  { id: "tuto-fc06", title: "Esclave 17 : écrire 0x0003 dans le registre 0x0001", bytes: hex("11 06 00 01 00 03 9A 9B"), printed: "11 06 0001 0003 9A9B", source: "Simply Modbus — Write Single Register (FC06)", where: "« Request » et « Response » (écho)", url: "https://simplymodbus.ca/learn-rtu-fc06.html", read: "read" },
];
/** Replays the printed frames : → [{ id, ok, crc (computed, as on the wire "41 12"), printed }] */
export function replayVectors() { return RTU_VECTORS.map((v) => { const n = v.bytes.length, body = v.bytes.slice(0, n - 2), f = rtuFrame(body[0], body[1], body.slice(2)), same = !!f && f.length === n && f.every((b, i) => b === v.bytes[i]); return { id: v.id, ok: same && rtuCheck(v.bytes).ok, crc: f ? f.slice(-2).map((b) => b.toString(16).toUpperCase().padStart(2, "0")).join(" ") : "", printed: v.printed }; }); }
