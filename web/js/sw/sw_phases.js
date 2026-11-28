/* DynamiteOrbit.ai — Logiciel : A MISSION BY PHASES (JP, 28 novembre 2026 : « la partie profil de mission ici est vraiment nice » — the phases of a
   power mission, as a mission planner lays them : a name, a power, a duration, one colour each). A phase asks the module a POWER (kW, + it gives,
   − it takes) for a time ; the 1.5D module (sw/sw_pack.js, mode « power ») finds the current, held to its limits. The phases become the events of a
   profile of the bench's bank, which the campaign plays with the others. A table copied from a spreadsheet (name, kW, min — tabs or semicolons)
   is read as it is. The example is the tool's : phases of a flight in the words of the trade, powers scaled to ONE module of the project — to
   replace by the project's own. Pure. */

/** The phase names of the trade, and a colour each (a phase of another name takes the colour of its power). */
export const PHASE_COLORS = { Taxi: "#94a3b8", Takeoff: "#dc2626", Climb: "#f97316", Cruise: "#16a34a", Descent: "#3b82f6", Landing: "#a855f7", Charge: "#15803d", Rest: "#64748b" };
export const phaseColor = (p) => PHASE_COLORS[p.name] || (p.kw < 0 ? "#15803d" : p.kw === 0 ? "#64748b" : "#f59e0b");
/** The example : a flight, powers scaled to the module (pPeak : its peak power, kW). */
export function examplePhases(pPeak = 10) {
  const k = (x) => +(x * pPeak).toFixed(2);
  return [{ name: "Taxi", kw: k(0.03), min: 5 }, { name: "Takeoff", kw: k(0.6), min: 1.5 }, { name: "Climb", kw: k(0.4), min: 5 }, { name: "Cruise", kw: k(0.15), min: 10 }, { name: "Descent", kw: k(0.05), min: 8 }, { name: "Landing", kw: k(0.25), min: 2 }];
}
/** A table pasted from a spreadsheet : one phase a line — name, kW, minutes (tabs, semicolons or commas between ; a decimal comma is read). → { phases, errors } */
export function parsePhases(text) {
  const phases = [], errors = [], num = (x) => Number(String(x).trim().replace(/\s/g, "").replace(",", "."));
  String(text || "").split(/\r?\n/).forEach((line, i) => { const t = line.trim(); if (!t || t.startsWith("#")) return; const c = t.includes("\t") ? t.split("\t") : t.split(/;/).length > 1 ? t.split(";") : t.split(/,(?=\s*-?\d)/);
    if (c.length < 3) { errors.push(`ligne ${i + 1} : trois colonnes attendues (nom, kW, min)`); return; } const kw = num(c[1]), min = num(c[2]);
    if (!Number.isFinite(kw) || !Number.isFinite(min) || min <= 0) { if (i === 0 && !Number.isFinite(kw)) return; errors.push(`ligne ${i + 1} : « ${t} » — une puissance en kW et une durée en minutes`); return; }
    phases.push({ name: c[0].trim() || `Phase ${phases.length + 1}`, kw, min }); });
  return { phases, errors };
}
/** What the phases ask : the time (min), the energy given and taken (kWh), the peak power. */
export function phaseSummary(phases) {
  const out = { min: 0, kwhOut: 0, kwhIn: 0, peak: 0 };
  for (const p of phases) { out.min += p.min; const e = (p.kw * p.min) / 60; if (e > 0) out.kwhOut += e; else out.kwhIn -= e; out.peak = Math.max(out.peak, Math.abs(p.kw)); }
  return out;
}
/** The phases as a profile of the bench's bank : one event per phase (the module in mode « power »), then the module at rest. start : the voltage of
    the CORE at rest at the start. → { id, name, kind, events } */
export function phaseProfile(phases, { id = "phases", name = "Mission par phases", start = 4.1 } = {}) {
  const events = []; let t = 0;
  phases.forEach((p, i) => { events.push({ t: Math.round(t * 60000), id: `ph${i + 1}`, title: `${p.name} : ${String(p.kw).replace(".", ",")} kW, ${String(p.min).replace(".", ",")} min`,
    says: p.kw > 0 ? `Le module donne ${String(p.kw).replace(".", ",")} kW pendant ${String(p.min).replace(".", ",")} min.` : p.kw < 0 ? `Le module reçoit ${String(-p.kw).replace(".", ",")} kW pendant ${String(p.min).replace(".", ",")} min.` : `Le module ne donne rien pendant ${String(p.min).replace(".", ",")} min.`,
    set: {}, plant: i === 0 ? { mode: "power", power: p.kw, start, heatTo: 0, cellHi: 0, cellLo: 0, push: 0, cvFail: 0 } : { mode: "power", power: p.kw }, phase: { name: p.name, color: phaseColor(p) } }); t += p.min; });
  events.push({ t: Math.round(t * 60000), id: "rest", title: "Fin des phases : au repos", says: "La mission est finie : le module ne donne plus rien.", set: {}, plant: { mode: "rest", power: 0 } });
  events.push({ t: Math.round(t * 60000) + 120000, id: "end", title: "Fin de la mission", says: "La mission est jouée.", set: {} });
  return { id, name, kind: "mission", phases: phases.map((p) => ({ ...p })), events };
}
