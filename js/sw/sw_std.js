/* DynamiteOrbit.ai — Logiciel : the REFERENCE a software follows, chosen by the project (choix cliqué de JP, 21 novembre 2026 : « au choix du
   projet » — DO-178C for aircraft, ISO 26262 for road vehicles). What the tool says of each comes from PUBLIC secondary pages, read on
   21 November 2026 (Wikipedia, CC BY-SA 4.0 : « DO-178C », « DO-178B », « ISO 26262 », « Modified condition/decision coverage », « V-model
   (software development) ») — the standards themselves are sold, and were NOT read. Every figure carries where it was read ; what those pages
   do not say is said not to be known here (the structural coverage DO-178C asks below level A, the methods ISO 26262 lists per ASIL).
   Nothing here makes a software compliant : a standard is met by a process, people, independent reviews and an authority — the tool helps
   to keep the traces those processes ask for. Pure. */

const WIKI = (t) => `https://en.wikipedia.org/wiki/${t}`;
export const STD_SOURCES = [
  { id: "wiki-do178c", title: "DO-178C — Wikipedia", url: WIKI("DO-178C"), read: "Lue le 21 novembre 2026 (page modifiée le 28 juillet 2026)", licence: "CC BY-SA 4.0" },
  { id: "wiki-do178b", title: "DO-178B — Wikipedia", url: WIKI("DO-178B"), read: "Lue le 21 novembre 2026 (page modifiée le 5 novembre 2026)", licence: "CC BY-SA 4.0" },
  { id: "wiki-iso26262", title: "ISO 26262 — Wikipedia", url: WIKI("ISO_26262"), read: "Lue le 21 novembre 2026 (première moitié lue mot à mot, le reste en résumé)", licence: "CC BY-SA 4.0" },
  { id: "wiki-mcdc", title: "Modified condition/decision coverage — Wikipedia", url: WIKI("Modified_condition/decision_coverage"), read: "Lue le 21 novembre 2026 (page modifiée le 11 mai 2026)", licence: "CC BY-SA 4.0" },
  { id: "wiki-vmodel", title: "V-model (software development) — Wikipedia", url: WIKI("V-model_(software_development)"), read: "Lue le 21 novembre 2026", licence: "CC BY-SA 4.0" },
];

/** The references. levels : from the most to the least demanding ; each level says what it answers to, the objectives and how many with
    independence when the page gives them, and the structural coverage when the page says it — null when it does not. */
export const STANDARDS = {
  do178c: { id: "do178c", name: "RTCA DO-178C", domain: "Aéronautique", what: "Software Considerations in Airborne Systems and Equipment Certification", levelWord: "DAL", levelFr: "niveau logiciel (Design Assurance Level)",
    reqWords: { high: "high-level requirements (HLR)", low: "low-level requirements (LLR)" }, source: "wiki-do178c",
    levels: [
      { id: "A", fr: "Catastrophic — catastrophique", objectives: 71, independence: 30, coverage: "MC/DC", coverageSource: "wiki-mcdc" },
      { id: "B", fr: "Hazardous — dangereux", objectives: 69, independence: 18, coverage: null },
      { id: "C", fr: "Major — majeur", objectives: 62, independence: 5, coverage: null },
      { id: "D", fr: "Minor — mineur", objectives: 26, independence: 2, coverage: null },
      { id: "E", fr: "No effect — sans effet sur la sécurité", objectives: 0, independence: 0, coverage: null, noTrace: true },
    ],
    says: ["Le niveau logiciel (A à E) suit la gravité de la défaillance à laquelle le logiciel peut contribuer ; il fixe le nombre d'objectifs à tenir, dont certains « avec indépendance » (quelqu'un d'autre que l'auteur vérifie).",
      "Des traces documentées dans les deux sens relient les artéfacts : une exigence de bas niveau à son exigence de haut niveau, au code et aux essais ; l'analyse de traçabilité vérifie que chaque exigence fonctionnelle est vérifiée par un essai. Le niveau E ne demande pas de traces.",
      "MC/DC (modified condition/decision coverage) sert à s'assurer que le logiciel le plus critique (niveau A) est assez essayé."],
    unknown: "La couverture structurelle demandée aux niveaux B, C et D n'est pas donnée par les pages lues : elle n'est pas affirmée ici." },
  iso26262: { id: "iso26262", name: "ISO 26262", domain: "Automobile", what: "Road vehicles — Functional safety (partie 6 : Product development at the software level)", levelWord: "ASIL", levelFr: "Automotive Safety Integrity Level",
    reqWords: { high: "software safety requirements", low: "software unit design" }, source: "wiki-iso26262",
    levels: [
      { id: "D", fr: "le plus haut niveau de risque", coverage: "MC/DC (« highly recommended », partie 6)", coverageSource: "wiki-mcdc" },
      { id: "C", fr: "", coverage: null }, { id: "B", fr: "", coverage: null }, { id: "A", fr: "le plus bas niveau de risque", coverage: null },
      { id: "QM", fr: "Quality Management — aucune pertinence de sécurité : la gestion de la qualité habituelle suffit", coverage: null, noTrace: false },
    ],
    says: ["L'ASIL exprime la réduction de risque demandée pour éviter un danger ; il résulte de l'analyse des dangers et des risques : gravité (S0 à S3), exposition (E0 à E4), contrôlabilité (C0 à C3). ASIL D est S3, E4, C3.",
      "La partie 6 couvre le développement au niveau du logiciel ; la partie 8 traite de la confiance dans les outils logiciels.",
      "MC/DC est dit « highly recommended » pour l'ASIL D dans la partie 6."],
    unknown: "Les méthodes et la couverture que la partie 6 recommande pour ASIL A, B et C ne sont pas données par les pages lues : elles ne sont pas affirmées ici." },
};
/** The V : each phase of development and the phase of test made for it, as the page on the V-model pairs them. */
export const V_PAIRS = [
  { dev: "Analyse des exigences", test: "Essai d'acceptation", says: "Les plans d'essai d'acceptation se font pendant l'analyse des exigences." },
  { dev: "Conception de l'architecture", test: "Essai d'intégration", says: "Les plans d'essai d'intégration se font pendant la conception de l'architecture." },
  { dev: "Conception des modules", test: "Essai unitaire", says: "Les plans d'essai unitaire se font pendant la conception des modules." },
];
export const stdOf = (d) => (d && d.std && STANDARDS[d.std.ref]) || null;
export const levelOf = (d) => { const S = stdOf(d); return S ? S.levels.find((l) => l.id === d.std.level) || null : null; };
/** What the choice of the project asks of the tool, in a few lines. → { std, level, trace (traces asked), coverage (text or null), lines } */
export function stdAsks(d) {
  const S = stdOf(d), L = levelOf(d); if (!S) return { std: null, level: null, trace: true, coverage: null, lines: ["Aucun référentiel choisi : choisissez DO-178C (aéro) ou ISO 26262 (auto), et le niveau du logiciel."] };
  const lines = [`${S.name} — ${S.domain}. ${L ? `${S.levelWord} ${L.id}${L.fr ? ` : ${L.fr}` : ""}.` : `${S.levelWord} à choisir.`}`];
  if (L && L.objectives !== undefined) lines.push(`${L.objectives} objectifs, dont ${L.independence} avec indépendance (source secondaire).`);
  lines.push(L && L.coverage ? `Couverture structurelle : ${L.coverage} — à mesurer sur le C compilé, avec un outil de couverture ; le modèle n'en donne pas.` : S.unknown);
  return { std: S, level: L, trace: !(L && L.noTrace), coverage: L ? L.coverage : null, lines };
}
