/* DesignOrbit.ai — Logiciel : the path, STEP BY STEP (demande de JP : « mettre ça pas à pas, comme si la partie logiciel était faite pour
   un étudiant de 16 ans qui va apprendre à faire le logiciel »). Seven steps, in the order one makes software for a board : choose the CPU,
   put and link the objects, set their values, start, simulate live, read the code, load it. Each step says in plain words what one does
   and why, and whether it is done — read from the design, never ticked by hand. The words of the trade a step uses unfold under it.
   Also here : the inputs and outputs of an object, said one by one — where each comes from, where each goes, what it is worth.
   Pure : no page. */

import { KINDS, portsOf } from "./sw_objects.js";
import { liveWires, problems, unsure, ready, order, split } from "./sw_design.js";
import { liveReqs, trace, reqQuality } from "./sw_req.js";
import { stdOf, levelOf } from "./sw_std.js";

/** The PAGES of the screens (they were the seven steps before the V) : each belongs to a step of the V (VSTEPS below). plain : what the page is,
    for someone who learns ; do : what one does on the screen. */
export const STEPS = [
  { key: "cpu", n: 1, title: "CPU", long: "Choisir le CPU", icon: "chip", color: "#b45309",
    plain: "Le CPU (ou microcontrôleur) est le petit ordinateur soudé sur la carte : une seule puce, qui lit des tensions, allume des broches et fait tourner VOTRE programme, le même, sans fin. On le choisit d'abord, parce qu'il fixe ce que le logiciel peut lire et commander : combien de voies de mesure, combien de broches.",
    do: "Cliquez un CPU dans le volet de gauche. Sa fiche, au centre, dit ce qui a été lu dans le document de son fabricant — et à quelle page." },
  { key: "objects", n: 2, title: "Objets", long: "Poser et relier les objets", icon: "part", color: "#0891b2",
    plain: "Un logiciel embarqué fait toujours la même chose : il LIT (une tension, un contact), il DÉCIDE (est-ce trop ?), il COMMANDE (ouvrir un contactor). Ici, chaque chose est une tuile. Ce qui ENTRE dans une tuile est à gauche, ce qui en SORT est à droite. Un fil porte une sortie vers une entrée.",
    do: "Posez une tuile depuis le volet de gauche. Pour tirer un fil : un clic sur une sortie (à droite d'une tuile), puis un clic sur une entrée (à gauche d'une autre)." },
  { key: "values", n: 3, title: "Valeurs", long: "Régler les valeurs", icon: "param", color: "#7c3aed",
    plain: "Chaque tuile a ses réglages : un seuil, un délai, une échelle. L'outil en propose — ce sont des EXEMPLES, pas les vôtres. Tant qu'une valeur d'exemple n'est pas tapée ou confirmée, elle clignote, et le code ne s'écrit pas : on ne livre pas un logiciel dont personne n'a relu les seuils.",
    do: "La liste de gauche mène à chaque valeur à relire. Tapez la vôtre, ou confirmez celle proposée." },
  { key: "start", n: 4, title: "Démarrage", long: "Essayer le démarrage", icon: "power", color: "#16a34a",
    plain: "À la mise sous tension, rien ne doit bouger tout seul : toutes les sorties au repos, aucun défaut inventé. On regarde donc ce que fait le logiciel dans sa première seconde — sa mise à zéro, son premier pas — et la place qu'il prend dans la mémoire du CPU.",
    do: "Lisez la suite du démarrage, puis le résultat de l'essai : chaque ligne dit ce qui est vérifié." },
  { key: "live", n: 5, title: "Simulation", long: "Simuler en direct", icon: "play", color: "#dc2626",
    plain: "Le logiciel tourne ici comme sur la carte, un pas à la fois. Vous tenez le banc : faites monter la tension d'une cellule, demandez la fermeture, coincez un contact — et regardez les tuiles réagir. En pause, rien n'avance : on change une entrée, puis on fait un pas, pour comprendre.",
    do: "« Marche » lance le temps ; « Pause » l'arrête ; « Un pas » avance d'une période. Les réglages du banc sont dans le volet de droite." },
  { key: "code", n: 6, title: "Code", long: "Lire le code", icon: "code", color: "#475569",
    plain: "L'outil écrit le programme en langage C à partir de vos tuiles : un fichier par GENRE de tuile (la bibliothèque), une table par tuile posée (ses réglages), et le pas qui les appelle dans l'ordre des fils. Tout se lit ici, avant de télécharger quoi que ce soit.",
    do: "Cliquez un fichier dans le volet de gauche : il s'affiche au centre. Le bouton « Fichiers C (.zip) » télécharge le tout." },
  { key: "load", n: 7, title: "Chargement", long: "Charger dans le CPU", icon: "download", color: "#0f766e",
    plain: "Un fichier C ne tourne pas tout seul : on le compile — un autre programme le traduit en nombres que le CPU exécute —, puis on copie le résultat dans la mémoire du CPU par une sonde branchée en USB. C'est ce qu'on appelle « flasher ».",
    do: "Suivez les sept gestes. Ce que le fabricant du CPU publie sur chacun est donné avec l'endroit où cela a été lu." },
];
export const stepOf = (key) => STEPS.find((s) => s.key === key) || STEPS[0];

/* ---------- the V (choix cliqué de JP, 21 novembre 2026 : « Cycle en V ») ---------- */
/** The seven steps of the V, in the order of the top bar : the left branch defines and designs (requirements, architecture, design, simulation
    of the model), the bottom writes the code, the right branch proves and delivers (verification, release). Each step is a screen (mod) ; its
    pages are those above. pair : the step of the other branch made for it (the V-model pairs each phase of design with its phase of test). */
export const VSTEPS = [
  { key: "req", mod: "swreq", n: 1, title: "Exigences", en: "Requirements", long: "Écrire ce que le logiciel doit faire", icon: "report", color: "#2563eb", pages: [], pair: "verify",
    plain: "Avant de dessiner quoi que ce soit, on écrit ce que le logiciel DOIT faire : une phrase par exigence, avec un nombre quand c'est une performance ou une sécurité. Chaque exigence dit comment on la prouvera — un essai, une analyse, une revue — et quelles tuiles la réalisent. C'est elle que la vérification prouvera, à l'étape 6.",
    do: "Écrivez une exigence par ligne dans le volet de gauche ; sa fiche, à droite, dit son genre, sa preuve et les tuiles qui la réalisent. L'outil relit chaque phrase et signale un mot vague." },
  { key: "arch", mod: "swarch", n: 2, title: "Architecture", en: "Architecture", long: "Choisir la référence, le CPU, la cadence", icon: "chip", color: "#b45309", pages: ["cpu"], pair: "verify",
    plain: "L'architecture fixe ce qui ne bougera plus : la référence de sécurité que le projet suit (DO-178C pour un aéronef, ISO 26262 pour une auto) et son niveau, le CPU sur lequel le logiciel tourne, la cadence de son pas et les broches qu'il prend.",
    do: "Choisissez la référence et le niveau, puis le CPU. Sa fiche, au centre, dit ce que le logiciel lui prend — et chaque chiffre avec la page où il a été lu." },
  { key: "design", mod: "sw", n: 3, title: "Conception", en: "Detailed design", long: "Poser, relier et régler les tuiles", icon: "part", color: "#0891b2", pages: ["objects", "values"], pair: "sim",
    plain: "La conception détaillée : chaque fonction est une tuile qui LIT, DÉCIDE ou COMMANDE ; les fils disent d'où vient chaque entrée. Chaque tuile dit en une phrase ce qu'elle fait — ce sont les exigences de bas niveau, tirées du dessin.",
    do: "« Tuiles » : posez et reliez. « Valeurs » : relisez chaque valeur d'exemple, tapez la vôtre ou confirmez-la." },
  { key: "sim", mod: "swsim", n: 4, title: "Simulation", en: "Model-in-the-loop", long: "Faire tourner le modèle", icon: "play", color: "#dc2626", pages: ["live", "start"], pair: "design",
    plain: "Avant d'écrire une ligne de C, on fait tourner le modèle : le même pas que le C, une période à la fois, contre un banc que l'on tient à la main. On essaie aussi le démarrage : rien ne doit bouger tout seul.",
    do: "« En direct » : marche, pause, un pas ; changez une entrée et regardez les tuiles réagir. « Démarrage » : l'essai de la mise sous tension et la mémoire." },
  { key: "code", mod: "swcode", n: 5, title: "Code", en: "Code generation", long: "Lire le C que l'outil écrit", icon: "code", color: "#475569", pages: ["code"],
    plain: "Au fond du V, le code : l'outil écrit le C à partir des tuiles — une bibliothèque par genre, une table par tuile, le pas — et un programme d'essai qui doit imprimer ce que le modèle imprime (l'essai dos à dos).",
    do: "Cliquez un fichier : il s'affiche au centre, avec ses numéros de ligne." },
  { key: "verify", mod: "swtest", n: 6, title: "Vérification", en: "Verification", long: "Prouver chaque exigence", icon: "check", color: "#16a34a", pages: [], pair: "req",
    plain: "On remonte le V : chaque exigence vérifiée « par essai » doit avoir un essai qui la prouve — un scénario, ce que l'on attend, réussi. La matrice de traçabilité dit, d'un coup d'œil, ce qui est prouvé et ce qui ne l'est pas ; la couverture dit ce que les essais n'ont jamais fait bouger.",
    do: "Lancez les essais ; un clic sur un essai montre son scénario et ses attendus, à droite. Ce qui échoue, ou ce qui manque, est dans le guide." },
  { key: "release", mod: "swrel", n: 7, title: "Livraison", en: "Release", long: "Livrer le paquet et le charger", icon: "download", color: "#0f766e", pages: ["load"],
    plain: "En haut à droite du V : on livre. La liste de livraison dit si tout est prêt — exigences prouvées, valeurs confirmées, essais réussis —, puis le paquet part, et les sept gestes disent comment le charger dans le CPU.",
    do: "Lisez la liste de livraison ; téléchargez le paquet ; suivez les sept gestes du chargement." },
];
export const vstepOf = (key) => VSTEPS.find((s) => s.key === key) || VSTEPS[0];
/** The step of the V a page belongs to. */
export const vOfPage = (page) => VSTEPS.find((s) => s.pages.includes(page)) || null;
/** Where each step of the V stands. run : the tests run (sw/sw_test.js runAll) or null. → { [key]: { state: "done" | "todo" | "wait" | "info", text } } */
export function vStates(d, cpu, run = null) {
  const P = stepStates(d, cpu);
  if (!d) return Object.fromEntries(VSTEPS.map((s) => [s.key, { state: s.key === "req" ? "todo" : "wait", text: "Le logiciel n'existe pas encore." }]));
  const R = liveReqs(d), T = trace(d, run ? run.results : null), bad = R.filter((r) => reqQuality(r).some((q) => q.level !== "tip")), unsure0 = R.filter((r) => r.sure === false), noTile = T.rows.filter((x) => x.state === "untraced");
  const S = stdOf(d), L = levelOf(d), needTest = T.rows.filter((x) => x.req.verify === "test" && x.state !== "off"), proven = needTest.filter((x) => x.state === "verified"), failed = T.rows.filter((x) => x.state === "failed");
  return {
    req: { state: !R.length || bad.length || unsure0.length || noTile.length ? "todo" : "done", text: !R.length ? "Aucune exigence écrite." : bad.length ? `${bad.length} exigence${bad.length > 1 ? "s" : ""} à réécrire (mot vague, pas de « doit », pas de nombre).` : unsure0.length ? `${unsure0.length} exigence${unsure0.length > 1 ? "s" : ""} d'exemple à confirmer.` : noTile.length ? `${noTile.length} exigence${noTile.length > 1 ? "s" : ""} sans tuile.` : `${R.length} exigences écrites, allouées, confirmées.` },
    arch: { state: S && L && P.cpu.state === "done" ? "done" : "todo", text: !S ? "Référence de sécurité à choisir : DO-178C ou ISO 26262." : !L ? `${S.levelWord} à choisir.` : P.cpu.state !== "done" ? P.cpu.text : `${S.name} ${S.levelWord} ${L.id} · ${cpu.name} · pas de ${d.period || 10} ms.` },
    design: { state: P.objects.state === "done" && P.values.state === "done" ? "done" : P.objects.state === "todo" || P.values.state === "todo" ? "todo" : "wait", text: P.objects.state !== "done" ? P.objects.text : P.values.text },
    sim: { state: P.live.state, text: P.live.text },
    code: { state: P.code.state, text: P.code.text },
    verify: { state: !needTest.length && !R.length ? "wait" : failed.length ? "todo" : run && proven.length === needTest.length && needTest.length ? "done" : "todo", text: !R.length ? "D'abord des exigences." : failed.length ? `${failed.length} exigence${failed.length > 1 ? "s" : ""} dont un essai échoue.` : `${proven.length} sur ${needTest.length} exigences prouvées par essai.` },
    release: { state: "info", text: "La liste de livraison dit ce qui manque encore." },
  };
}
/** The step of the V to open first : the first that still asks for something. */
export function nextV(d, cpu, run = null) { const S = vStates(d, cpu, run); return (VSTEPS.find((s) => S[s.key].state === "todo") || VSTEPS.find((s) => s.key === "sim")).key; }

/** Where each step stands. → { [key]: { state: "done" | "todo" | "wait" | "info", text } } — « wait » : an earlier step must be done first. */
export function stepStates(d, cpu) {
  if (!d) return Object.fromEntries(STEPS.map((s) => [s.key, { state: s.key === "cpu" ? "todo" : "wait", text: "Le logiciel n'existe pas encore." }]));
  const P = problems(d, cpu), errs = P.filter((p) => p.level === "error"), n = unsure(d).length, has = ((d.objects || []).filter((o) => !o.off && KINDS[o.kind])).length, ok = ready(d, cpu);
  return {
    cpu: { state: d.cpu && d.cpu !== "generic" ? "done" : "todo", text: d.cpu && d.cpu !== "generic" ? `${cpu.name}` : "CPU générique : une fiche d'exemple, à remplacer par le vôtre." },
    objects: { state: !has ? "todo" : errs.length ? "todo" : "done", text: !has ? "Aucun objet posé." : errs.length ? `${errs.length} chose${errs.length > 1 ? "s" : ""} à corriger : ${errs[0].text}` : `${has} objets, ${liveWires(d).length} fils : tout est relié.` },
    values: { state: !has ? "wait" : n ? "todo" : "done", text: !has ? "D'abord des objets." : n ? `${n} valeur${n > 1 ? "s" : ""} d'exemple à taper ou à confirmer.` : "Toutes les valeurs ont été relues." },
    start: { state: !has || errs.length ? "wait" : "info", text: !has || errs.length ? "D'abord des objets reliés sans erreur." : "L'essai de démarrage se lit à cette étape." },
    live: { state: !has || errs.length ? "wait" : "info", text: !has || errs.length ? "D'abord des objets reliés sans erreur." : "Le banc est prêt : à vous de jouer." },
    code: { state: !has ? "wait" : ok ? "done" : "info", text: !has ? "D'abord des objets." : ok ? "Le paquet peut être téléchargé." : "Le code se lit déjà ; le téléchargement attend les valeurs confirmées." },
    load: { state: "info", text: "Sept gestes, du paquet au CPU." },
  };
}
/** The step to open first : the first one that still asks for something. */
export function nextStep(d, cpu) { const S = stepStates(d, cpu); return (STEPS.find((s) => S[s.key].state === "todo") || STEPS.find((s) => s.key === "live")).key; }

/** The words of the trade, said once each — the word, its name in English, one sentence. `re` : how a text shows the word. */
export const WORDS = [
  { id: "cpu", word: "CPU, microcontrôleur", en: "microcontroller (MCU)", re: /\bCPU\b|microcontr/i, says: "Une puce qui contient un processeur, sa mémoire et ses broches : un ordinateur entier, minuscule, qui ne fait tourner qu'un programme." },
  { id: "pin", word: "broche", en: "pin", re: /\bbroche/i, says: "Une patte de la puce. Le logiciel peut y LIRE une tension (entrée) ou y METTRE 0 ou 1 (sortie)." },
  { id: "adc", word: "convertisseur, voie, comptes", en: "analog-to-digital converter (ADC), channel, counts", re: /convertisseur|\bvoie\b|comptes|\bADC\b/i, says: "Le convertisseur transforme une tension en un nombre entier — des « comptes ». Sur 12 bits, il va de 0 à 4095 : 4095 veut dire « la tension de référence »." },
  { id: "step", word: "pas, période", en: "step, period", re: /\bpas\b|période/i, says: "Le logiciel refait le même calcul à intervalle fixe : c'est un pas. La période est le temps entre deux pas — ici quelques millisecondes." },
  { id: "io", word: "entrée, sortie", en: "input, output", re: /entrée|sortie/i, says: "Ce qu'une tuile reçoit pour travailler est une entrée ; ce qu'elle donne aux autres est une sortie. Un fil va toujours d'une sortie à une entrée." },
  { id: "limit", word: "seuil, délai, hystérésis", en: "threshold, delay, hysteresis", re: /seuil|délai|hystérésis/i, says: "Le seuil est la valeur à ne pas dépasser ; le délai, le temps qu'il faut la dépasser avant de réagir ; l'hystérésis, l'écart entre « je déclenche » et « je relâche », pour ne pas battre." },
  { id: "latch", word: "mémoire de défaut", en: "fault latch", re: /mémoire de défaut|retient|latch/i, says: "Un défaut que l'on RETIENT même quand sa cause a disparu : il faut un acquittement pour l'oublier. Sans cela, une surtension d'un instant passerait inaperçue." },
  { id: "contactor", word: "contactor, contact auxiliaire", en: "contactor, auxiliary contact", re: /contactor|contact auxiliaire/i, says: "Un gros interrupteur commandé par une bobine, qui relie ou coupe la batterie. Son contact auxiliaire est un petit contact qui dit au logiciel s'il a vraiment bougé." },
  { id: "ram", word: "RAM, flash", en: "RAM, flash memory", re: /\bRAM\b|\bflash\b/i, says: "La RAM est la mémoire de travail : elle s'efface quand le courant est coupé. La flash garde le programme et ses réglages, même sans courant." },
  { id: "c", word: "langage C, compiler", en: "C language, to compile (build)", re: /\bC\b|compil/i, says: "Le C est le langage dans lequel s'écrit presque tout logiciel embarqué. Compiler, c'est le traduire en nombres que le CPU exécute." },
  { id: "hal", word: "couche matérielle", en: "hardware abstraction layer (HAL)", re: /couche matérielle|\bhal_|\bHAL\b|pilotes/i, says: "Les quelques fonctions qui touchent vraiment la puce (lire une voie, écrire une broche). Tout le reste du logiciel passe par elles : changer de CPU, c'est ne réécrire que cela." },
  { id: "probe", word: "sonde, JTAG, flasher", en: "debug probe, JTAG, to flash", re: /sonde|JTAG|flasher|charger/i, says: "La sonde est un boîtier entre l'ordinateur et la puce ; JTAG est le nom des quelques fils par lesquels elle lui parle. Flasher, c'est y copier le programme." },
  { id: "req", word: "exigence", en: "requirement", re: /exigence/i, says: "Une phrase qui dit ce que le logiciel DOIT faire, assez précise pour qu'un essai dise oui ou non. « Rapidement » ne se vérifie pas ; « en moins de 200 ms » se vérifie." },
  { id: "trace", word: "traçabilité", en: "traceability", re: /tra[cç]abilit|\btrace/i, says: "Le fil qui relie une exigence aux tuiles qui la réalisent, au code, et aux essais qui la prouvent — dans les deux sens. Une tuile sans exigence est une fonction que personne n'a demandée." },
  { id: "vmodel", word: "cycle en V", en: "V-model", re: /cycle en V|\b(le|du|au) V\b/, says: "On descend la branche de gauche en définissant (exigences, architecture, conception), on écrit le code au fond, puis on remonte la branche de droite en prouvant : chaque étape de conception a son étape d'essai en face." },
  { id: "cover", word: "couverture", en: "coverage", re: /couverture/i, says: "La part de ce qui a été exercé par les essais. Celle du modèle dit si chaque décision a pris ses deux valeurs ; celle du code (instructions, décisions, MC/DC) se mesure sur le C compilé, avec un outil." },
  { id: "level", word: "niveau DAL, ASIL", en: "Design Assurance Level, Automotive Safety Integrity Level", re: /\bDAL\b|\bASIL\b|référence de sécurité/i, says: "Le niveau d'exigence que le projet doit tenir, selon la gravité de ce qu'une panne du logiciel peut causer : A à E en aéronautique (DO-178C), QM puis A à D en automobile (ISO 26262)." },
  { id: "lockstep", word: "deux cœurs en lockstep", en: "dual-core lockstep", re: /lockstep|deux cœurs/i, says: "Deux processeurs font exactement le même calcul en même temps ; un circuit compare leurs résultats. S'ils diffèrent, l'un des deux s'est trompé : la puce le signale." },
];
/** The words a text uses, in the order of the list. */
export const wordsIn = (text) => WORDS.filter((w) => w.re.test(String(text || "")));

/** The inputs and the outputs of an object, one line each (demande de JP : « ce n'est pas clair quels sont les entrées et les sorties des blocs ») :
    its name, its unit and range, where it comes from or where it goes, and what it is worth now. values : { "obj.port": value } or null.
    → { in: [{ key, label, unit, min, max, free, from (a name, or ""), value }], out: [{ key, label, unit, min, max, to: [names], value }] } */
export function ioRows(d, obj, values = null) {
  const O = Object.fromEntries(((d && d.objects) || []).map((o) => [o.id, o])), W = liveWires(d), P = portsOf(obj), val = (ref) => (values && values[ref] !== undefined ? values[ref] : null);
  const end = (ref) => { const [id, key] = split(ref), o = O[id]; return o ? `${o.name} · ${key}` : ref; };
  return { in: P.in.map((p) => { const w = W.find((x) => x.to === `${obj.id}.${p.key}`); return { key: p.key, label: p.label, unit: p.unit, min: p.min, max: p.max, free: !!p.free, from: w ? end(w.from) : "", delay: !!(w && w.delay), value: val(`${obj.id}.${p.key}`) }; }),
    out: P.out.map((p) => ({ key: p.key, label: p.label, unit: p.unit, min: p.min, max: p.max, to: W.filter((x) => x.from === `${obj.id}.${p.key}`).map((x) => end(x.to)), value: val(`${obj.id}.${p.key}`) })) };
}
/** A kind in three words for the palette : how many inputs, how many outputs. */
export const kindShape = (k) => { const K = KINDS[k], a = K.ports.in.length, b = K.ports.out.length; return `${a ? `${a} entrée${a > 1 ? "s" : ""}` : "lit le CPU"} → ${b ? `${b} sortie${b > 1 ? "s" : ""}` : "écrit le CPU"}`; };
/** The order of the step, as numbers on the tiles : { id: 1-based rank }. */
export const rankOf = (d) => Object.fromEntries(order(d).ids.map((id, i) => [id, i + 1]));
