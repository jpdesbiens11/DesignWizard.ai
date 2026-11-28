/* DynamiteOrbit.ai — Logiciel : START-UP, and what the software keeps in memory (demande de JP : « une fonction pour commencer à tester la
   routine de démarrage, d'initialisation, la mémoire logicielle »). What happens between power and the first step is said in order — what
   the CPU does on its own (read in its data sheet), then what the software does : hal_init, bms_init, and the step, object after object.
   The start-up TEST runs that very sequence on the model and checks what a start must guarantee : every signal at zero after the
   initialization, no output driven at the first step, and what moves when every input stays at rest for a second.
   The memory is read from the structures the files declare (sw/sw_c.js memoryPlan) : bytes of RAM and of constants, against what the CPU
   has. The size of the CODE is not known here — only a compiler for the CPU gives it — and it is said.
   Pure : no page. */

import { KINDS, portsOf } from "./sw_objects.js";
import { machine, order, liveWires, split } from "./sw_design.js";
import { memoryPlan } from "./sw_c.js";

const live = (d) => ((d && d.objects) || []).filter((o) => !o.off && KINDS[o.kind]);
const WHAT = { pin_adc: "lit une voie du convertisseur", pin_din: "lit une broche d'entrée", pin_dout: "écrit une broche de sortie", analog_in: "met la mesure à l'échelle et dit si elle est vraisemblable", energy_counter: "compte l'énergie", limit: "compare au seuil", fault_latch: "retient le défaut", contactor: "décide de fermer ou d'ouvrir, et relit le contact", state_lamp: "allume le témoin de l'état général" };

/** The sequence of a start, in the order it happens. cpu : a CPU sheet. → [{ who: "cpu" | "hal" | "app" | "step", title, text, page?, items? }] */
export function startSequence(d, cpu) {
  const O = Object.fromEntries(live(d).map((o) => [o.id, o])), ord = order(d), out = [];
  if (cpu && cpu.boot) out.push({ who: "cpu", title: "Le CPU se met en route tout seul", text: `Avant la première ligne du logiciel, le CPU compte ${cpu.boot.total} ${cpu.boot.unit} : il attend que son horloge soit stable, puis réveille sa mémoire.`, page: cpu.boot.page, items: cpu.boot.phases.map(([what, n]) => `${what} — ${n}`) });
  else out.push({ who: "cpu", title: "Le CPU se met en route tout seul", text: "Avant la première ligne du logiciel, un microcontrôleur attend que son alimentation et son horloge soient stables. Les durées se lisent dans sa fiche technique : aucune n'a été lue pour ce CPU." });
  out.push({ who: "hal", title: "hal_init() — préparer le CPU", text: "La première fonction que le logiciel appelle : régler les horloges, le convertisseur, le sens des broches. L'outil en écrit le squelette ; son contenu s'écrit avec les pilotes du fabricant.", items: (cpu && cpu.start) || [] });
  out.push({ who: "app", title: "bms_init() — mettre la mémoire à zéro", text: "Chaque objet reçoit sa mémoire de départ, et tous les signaux valent 0 : rien n'est commandé, aucun défaut n'est retenu." });
  out.push({ who: "step", title: `bms_step() — toutes les ${d.period || 10} ms`, text: "Ensuite le logiciel refait le même pas, sans fin : il lit les broches, calcule, décide, commande — toujours dans cet ordre, celui des fils.", items: ord.ids.map((id, i) => `${i + 1}. ${O[id].name} — ${WHAT[O[id].kind] || KINDS[O[id].kind].label}`) });
  return out;
}
/** The memory of the software against what the CPU has. → { objects, signals, ram, rom, cpuRam, cpuFlash (bytes, or null), ramShare, note } */
export function memoryReport(d, cpu) {
  const M = memoryPlan(d), cpuRam = cpu && cpu.ram ? cpu.ram * 1024 : null, cpuFlash = cpu && cpu.flash ? cpu.flash * 1024 : null;
  return { ...M, cpuRam, cpuFlash, ramShare: cpuRam ? M.ram / cpuRam : null, note: "Ces octets sont ceux des structures que les fichiers déclarent. La taille du CODE, elle, ne se connaît qu'une fois compilé pour le CPU : elle n'est pas donnée ici." };
}
/** The start-up test : the model started, and stepped with every input at rest. seconds : how long « at rest » lasts.
    → { checks: [{ id, ok (true | false | null : an observation), text, detail }], ok (no check failed), steps, first: { "obj.port": value } (the signals after the first step) } */
export function startupTest(d, cpu, seconds = 1) {
  const objs = live(d), O = Object.fromEntries(objs.map((o) => [o.id, o])), ord = order(d), checks = [], say = (id, ok, text, detail = "") => checks.push({ id, ok, text, detail });
  if (!objs.length) return { checks: [{ id: "empty", ok: false, text: "Le logiciel n'a aucun objet : rien à démarrer.", detail: "" }], ok: false, steps: 0, first: {} };
  say("order", !ord.loop.length, ord.loop.length ? "L'ordre du pas n'existe pas : des objets se suivent en boucle." : `Le pas a un ordre : ${ord.ids.length} objets, chacun après ce qui le nourrit.`, ord.loop.map((id) => O[id].name).join(", "));
  const m = machine(d), outs = objs.flatMap((o) => portsOf(o).out.map((p) => `${o.id}.${p.key}`)), bad0 = outs.filter((r) => m.last[r] !== 0);
  say("zero", !bad0.length, bad0.length ? "Après l'initialisation, des signaux ne valent pas 0." : `Après l'initialisation, les ${outs.length} signaux valent 0.`, bad0.join(", "));
  const rest = () => 0, douts = objs.filter((o) => KINDS[o.kind].pin === "dout"), name = (ref) => { const [id, key] = split(ref); return `${O[id] ? O[id].name : id} (${key})`; };
  m.step(rest); const first = { ...m.last }, driven = douts.filter((o) => m.last[`${o.id}.level`] !== 0);
  say("outputs", !driven.length, driven.length ? "Au premier pas, une sortie est déjà commandée alors que rien n'est demandé." : douts.length ? `Au premier pas, aucune des ${douts.length} sortie${douts.length > 1 ? "s" : ""} n'est commandée : ${douts.map((o) => o.name).join(", ")}.` : "Le logiciel ne commande aucune sortie.", driven.map((o) => o.name).join(", "));
  /* every input at rest (0 : nothing connected, nothing asked) for a while : what moves is said, not judged — a sensor that reads 0 is a broken wire */
  const steps = Math.max(1, Math.round(seconds * 1000 / m.dt)), bools = outs.filter((r) => { const [id, key] = split(r), p = portsOf(O[id]).out.find((x) => x.key === key); return p && p.unit === "0/1"; }), moved = [];
  let was = Object.fromEntries(bools.map((r) => [r, m.last[r]])), everDriven = new Set();
  for (let k = 1; k < steps; k++) { const t = m.step(rest); for (const r of bools) if (m.last[r] !== was[r]) { moved.push({ t, ref: r, to: m.last[r] }); was[r] = m.last[r]; } for (const o of douts) if (m.last[`${o.id}.level`]) everDriven.add(o.name); }
  say("rest", !everDriven.size, everDriven.size ? `Entrées au repos pendant ${seconds} s : une sortie finit par être commandée.` : `Entrées au repos pendant ${seconds} s : aucune sortie n'est jamais commandée.`, [...everDriven].join(", "));
  say("moves", null, moved.length ? `Pendant ce repos, ${moved.length} signal${moved.length > 1 ? "aux basculent" : " bascule"} : ${moved.slice(0, 4).map((e) => `${name(e.ref)} passe à ${e.to} à ${e.t} ms`).join(" ; ")}${moved.length > 4 ? "…" : ""}.` : "Pendant ce repos, aucun signal 0 / 1 ne bascule.",
    "Une entrée à 0 est une entrée où rien n'est branché : une mesure à 0 est dite non vraisemblable, ce qui est voulu.");
  const invalid = objs.filter((o) => o.kind === "analog_in" && first[`${o.id}.valid`] === 0).map((o) => o.name);
  if (objs.some((o) => o.kind === "analog_in")) say("valid", null, invalid.length ? `Rien de branché : ${invalid.length} mesure${invalid.length > 1 ? "s se disent" : " se dit"} « non vraisemblable » dès le premier pas (${invalid.slice(0, 3).join(", ")}${invalid.length > 3 ? "…" : ""}).` : "Avec des entrées à 0, toutes les mesures restent dans leur plage.", "Le drapeau « valid » d'une mesure dit si sa valeur tient dans la plage donnée.");
  const M = memoryReport(d, cpu);
  say("ram", M.cpuRam === null ? null : M.ram <= M.cpuRam, M.cpuRam === null ? `La mémoire de travail du logiciel tient en ${M.ram} octets ; la RAM de ce CPU n'est pas connue.` : `La mémoire de travail tient en ${M.ram} octets, sur les ${M.cpuRam} de la RAM du CPU.`, M.note);
  if (liveWires(d).some((w) => w.delay)) say("delay", null, "Un fil porte « la valeur du pas d'avant » : au tout premier pas, il porte 0.", "C'est ce qui ouvre une boucle ; le C fait de même.");
  return { checks, ok: !checks.some((c) => c.ok === false), steps, first };
}
