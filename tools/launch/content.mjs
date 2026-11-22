/* DesignOrbit.ai — the launch kit : what the one-page sheet and the ready-to-post texts say, in French and in English (kit de
   lancement, demande de JP). One source for both : tools/launch_kit.mjs writes the files, tests/node/launch_kit.test.mjs holds the rules.
   The rules are those of the film (docs/VIDEO.md) : every sentence is something the tool does ; no time saved, no figure of gain —
   nobody measured one ; the project is said as it is, free software in active development ; no name of a living person, no brand of
   another product. The thread is the one of the film : a part begins with a question — what is it for ? — and the tool is the one
   that remembers the answer, from the first need to the order. Pure. */

export const LANGS = ["fr", "en"];
const L = (fr, en) => ({ fr, en });

export const LINKS = { site: "https://jpdesbiens11.github.io/DynamiteOrbit.ai/vitrine.html", demo: "https://jpdesbiens11.github.io/DynamiteOrbit.ai/", code: "https://github.com/jpdesbiens11/DynamiteOrbit.ai" };
export const BRAND_FOOT = L("DesignOrbit.ai™ by DynamiteAgile™ · Co-Intelligence WorkFlow™ — logiciel libre, licence MIT", "DesignOrbit.ai™ by DynamiteAgile™ · Co-Intelligence WorkFlow™ — free software, MIT licence");

/* ---------- the one-page sheet ---------- */
/** Its three groups — what one does with the tool — each with its colour ; each step a pictogram (an icon of the application), a short
    title and one line. */
export const SHEET = {
  kicker: L("Logiciel libre · Licence MIT · Dans votre navigateur", "Free software · MIT licence · In your browser"),
  slogan: L(["On construit la fusée", "en volant."], ["We build the rocket", "in flight."]),
  promise: L("De l'intention à la pièce, de la pièce au système.", "From intent to part, from part to system."),
  story: L(
    ["Une pièce commence par une question : à quoi sert-elle ?", "Vous le savez — mais il faut le redire au modeleur, au calcul, au dessin, à la commande.", "DesignOrbit.ai retient la réponse une fois, et s'en sert partout."],
    ["A part begins with a question: what is it for?", "You know — yet you repeat it to the modeller, the solver, the drawing, the order.", "DesignOrbit.ai remembers the answer once, and uses it everywhere."]),
  shot: { img: "assemblage", caption: L("Un écran réel de l'outil : l'assemblage, ses accouplements et sa nomenclature.", "A real screen of the tool: the assembly, its mates and its bill of materials.") },
  groups: [
    { key: "design", color: "#0c66e4", title: L("Concevoir", "Design"), steps: [
      { icon: "intent", title: L("Intention", "Intent"), text: L("La pièce naît de ce qu'elle relie, de sa matière et de son procédé — sans esquisse.", "The part is born from what it connects, its material and its process — no sketch.") },
      { icon: "part", title: L("Pièce", "Part"), text: L("Des paramètres vivants ; les règles de fabrication se vérifient pendant que l'on conçoit.", "Live parameters; manufacturing rules are checked while you design.") },
      { icon: "assembly", title: L("Assemblage", "Assembly"), text: L("Les pièces s'accouplent par leurs interfaces. Une pièce change : l'assemblage suit.", "Parts mate through their interfaces. Change a part: the assembly follows.") },
      { icon: "chip", title: L("Carte électronique", "Circuit board"), text: L("Des fonctions aux fichiers de fabrication, dans le même projet que le boîtier.", "From functions to fabrication files, in the same project as the housing.") }] },
    { key: "check", color: "#c2410c", title: L("Vérifier", "Check"), steps: [
      { icon: "physics", title: L("Calcul", "Calculation"), text: L("Le calcul à la main et la simulation, côte à côte : l'outil dit quand ils divergent.", "Hand calculation and simulation, side by side: the tool says when they disagree.") },
      { icon: "creepage", title: L("Isolation", "Isolation"), text: L("Lignes de fuite et distances dans l'air, mesurées sur le modèle 3D.", "Creepage and clearance, measured on the 3D model.") },
      { icon: "info", title: L("Guide", "Guide"), text: L("Chaque écran dit ce qui manque ou cloche, et mène à l'endroit.", "Every screen says what is missing or wrong, and takes you there.") },
      { icon: "library", title: L("Sources", "Sources"), text: L("Chaque méthode dit ce qui a été lu, testé, ou repris de mémoire.", "Each method says what was read, tested, or taken from memory.") }] },
    { key: "deliver", color: "#0b7a75", title: L("Livrer", "Deliver"), steps: [
      { icon: "drawing", title: L("Dessins", "Drawings"), text: L("Vues, cotes, tolérances, cartouche : le dessin se trace, et suit la pièce.", "Views, dimensions, tolerances, title block: the drawing draws itself, and follows the part.") },
      { icon: "check", title: L("Revue et révisions", "Review and revisions"), text: L("Une revue dans l'outil ; chaque révision libérée est figée.", "A review in the tool; each released revision is frozen.") },
      { icon: "export", title: L("Commande", "Order"), text: L("La demande de prix et le dossier de l'atelier, en une archive.", "The request for quotation and the shop package, in one archive.") },
      { icon: "sparkle", title: L("Avec l'IA", "With AI"), text: L("Une tâche confiée comme à un technicien ; on relit avant d'accepter.", "A task handed over as to a technician; you review before you accept.") }] },
  ],
  out: { title: L("Ce qui sort s'ouvre ailleurs", "What comes out opens elsewhere"), items: ["STEP", "DXF", "STL", "PDF", "Word", "Excel", "Gerber", ".dwiz"] },
  status: { title: L("Où en est le projet", "Where the project stands"),
    text: L("En développement actif. Une démonstration est en ligne (accès sur demande), avec ses exemples complets. L'outil dit d'où viennent ses méthodes et ses valeurs — et ce qui n'a pas été vérifié.",
      "In active development. A demonstration is online (access on request), with its complete examples. The tool says where its methods and values come from — and what has not been verified.") },
  call: { title: L("Voir, essayer, contribuer", "See, try, contribute"), rows: [[L("La plateforme en vidéo", "The platform on video"), "site"], [L("La démonstration", "The demonstration"), "demo"], [L("Le code source", "The source code"), "code"]] },
};

/* ---------- the ready-to-post texts ---------- */
/** Each one : where it goes, what to attach, the text in both languages ; `max` : the length the place allows (characters). */
export const POSTS = [
  { id: "annonce", where: L("Réseau professionnel — l'annonce", "Professional network — the announcement"), attach: L("La bande-annonce (30 s) et ses sous-titres .srt ; les liens en premier commentaire.", "The teaser (30 s) and its .srt subtitles; the links in the first comment."),
    fr: `Une pièce commence toujours par une question : à quoi doit-elle servir ?

Vous le savez. Mais il faut le redire — au modeleur, au logiciel de calcul, au dessin, au dossier de commande. À chaque logiciel, la même intention, réexpliquée.

DesignOrbit.ai part de l'autre bout. On dit une fois ce que la pièce relie, de quoi elle est faite et comment on la fabrique. L'outil s'en souvient, et s'en sert partout :
→ la forme, et sa gamme de fabrication ;
→ les règles de fabrication, vérifiées pendant que l'on conçoit ;
→ l'assemblage, où les pièces s'accouplent par leurs interfaces ;
→ la carte électronique, dans le même projet que son boîtier ;
→ le calcul à la main et la simulation, côte à côte ;
→ les dessins, la revue, le dossier de commande.

Et l'intelligence artificielle ? On lui confie une tâche comme à un technicien. Elle propose, on relit, et rien ne change sans accord.

C'est un logiciel libre (licence MIT), qui tourne dans le navigateur. Il est en développement actif : une démonstration est en ligne, et l'outil dit d'où viennent ses méthodes — et ce qui n'a pas été vérifié.

La bande-annonce est ci-dessous. La démonstration et le code sont en commentaire.

#conception #mécatronique #ingénierie #logiciellibre #CAO`,
    en: `Every part begins with a question: what is it for?

You know the answer. Yet you repeat it — to the modeller, to the solver, to the drawing, to the order package. One intent, explained again to every tool.

DesignOrbit.ai starts from the other end. You say once what the part connects, what it is made of and how it is made. The tool remembers, and uses it everywhere:
→ the shape, and its manufacturing routing;
→ the manufacturing rules, checked while you design;
→ the assembly, where parts mate through their interfaces;
→ the circuit board, in the same project as its housing;
→ hand calculation and simulation, side by side;
→ the drawings, the review, the order package.

And artificial intelligence? You hand it a task, as you would to a technician. It proposes, you review, and nothing changes without your say-so.

It is free software (MIT licence), and it runs in the browser. It is in active development: a demonstration is online, and the tool says where its methods come from — and what has not been verified.

The teaser is below. The demonstration and the code are in the comments.

#engineering #mechatronics #design #opensource #CAD` },
  { id: "liens", where: L("Premier commentaire — les liens", "First comment — the links"), attach: L("Rien : le texte seul.", "Nothing: the text alone."),
    fr: `La plateforme en vidéo (2 min 50) : ${LINKS.site}\nLa démonstration (accès sur demande) : ${LINKS.demo}\nLe code, sous licence MIT : ${LINKS.code}`,
    en: `The platform on video (2 min 50): ${LINKS.site}\nThe demonstration (access on request): ${LINKS.demo}\nThe code, under the MIT licence: ${LINKS.code}` },
  { id: "court", where: L("Réseau professionnel — le rappel, une semaine après", "Professional network — the reminder, a week later"), attach: L("La bande-annonce, ou une capture d'écran de l'assemblage.", "The teaser, or a screenshot of the assembly."),
    fr: `Une pièce commence par une question : à quoi sert-elle ?

DesignOrbit.ai la retient une fois, et s'en sert de la première forme au dossier de commande : la gamme, l'assemblage, le calcul, le dessin.

Logiciel libre, dans le navigateur. Trente secondes pour voir.`,
    en: `A part begins with a question: what is it for?

DesignOrbit.ai remembers it once, and uses it from the first shape to the order package: the routing, the assembly, the calculation, the drawing.

Free software, in the browser. Thirty seconds to see.` },
  { id: "bref", max: 280, where: L("Message court (280 caractères)", "Short message (280 characters)"), attach: L("La bande-annonce.", "The teaser."),
    fr: `Une pièce commence par une question : à quoi sert-elle ? DesignOrbit.ai retient la réponse, de la première forme au dossier de commande. Logiciel libre (MIT), dans le navigateur. ${LINKS.site}`,
    en: `A part begins with a question: what is it for? DesignOrbit.ai remembers the answer, from the first shape to the order package. Free software (MIT), in the browser. ${LINKS.site}` },
  { id: "communaute", where: L("Communauté technique, forum, discussions du dépôt", "Technical community, forum, repository discussions"), attach: L("Le lien du dépôt ; une capture d'écran au besoin.", "The link to the repository; a screenshot if needed."),
    fr: `DesignOrbit.ai — concevoir une pièce mécatronique à partir de son intention (logiciel libre, MIT)

L'idée : une pièce se décrit d'abord par ce qu'elle relie (ses interfaces), sa matière et son procédé. La géométrie, la gamme de fabrication, les règles de fabrication, l'assemblage, les dessins et le dossier de commande en découlent, et se mettent à jour ensemble.

Comment c'est fait :
- une application statique : des modules ES, aucun outil de construction, aucune dépendance npm ;
- un format texte, .dwiz, une instruction par ligne, lisible par un humain et par une IA ;
- un noyau géométrique dans le navigateur ; les exports sont des formats ouverts (STEP, DXF, STL, PDF) ;
- un registre des sources : chaque méthode dit ce qui a été lu, testé, ou repris de mémoire ;
- des tests à chaque brique.

Ce que nous cherchons : des mécaniciens, des électroniciens et des développeurs pour casser la démonstration et dire où — une règle de fabrication, un matériau, un modèle de calcul simple, un export qui manque.

Le dépôt : ${LINKS.code}`,
    en: `DesignOrbit.ai — designing a mechatronic part from its intent (free software, MIT)

The idea: a part is first described by what it connects (its interfaces), its material and its process. The geometry, the manufacturing routing, the manufacturing rules, the assembly, the drawings and the order package follow from that, and stay up to date together.

How it is built:
- a static application: ES modules, no build tool, no npm dependency;
- a text format, .dwiz, one instruction per line, readable by a person and by an AI;
- a geometry kernel in the browser; the exports are open formats (STEP, DXF, STL, PDF);
- a register of sources: each method says what was read, tested, or taken from memory;
- tests with every brick.

What we are looking for: mechanical engineers, electronics engineers and developers to break the demonstration and say where — a manufacturing rule, a material, a simple calculation model, a missing export.

The repository: ${LINKS.code}` },
  { id: "courriel", where: L("Courriel à un collègue — l'invitation à essayer", "E-mail to a colleague — the invitation to try"), attach: L("La fiche d'une page (PDF).", "The one-page sheet (PDF)."),
    fr: `Objet : Une heure pour essayer un outil de conception — ton avis m'intéresse

Bonjour,

Je travaille sur DesignOrbit.ai, un outil de conception mécatronique libre qui part de l'intention d'une pièce — ce qu'elle relie, sa matière, son procédé — plutôt que d'une esquisse. La fiche jointe le résume en une page.

J'aimerais ton regard de praticien : un parcours guidé d'une heure sur la démonstration, puis une fiche de retours — ce qui t'a arrêté, ce qui t'a semblé faux, ce qui manque. Je ne cherche pas des compliments, je cherche où ça accroche.

Si tu es partant, dis-moi quand, et je t'ouvre l'accès.

Merci,`,
    en: `Subject: One hour to try a design tool — I would value your opinion

Hello,

I am working on DesignOrbit.ai, a free mechatronic design tool that starts from the intent of a part — what it connects, its material, its process — rather than from a sketch. The attached sheet sums it up on one page.

I would like a practitioner's eye: a guided one-hour path on the demonstration, then a feedback sheet — what stopped you, what looked wrong, what is missing. I am not after compliments, I am after where it catches.

If you are in, tell me when, and I will open the access.

Thank you,` },
  { id: "alt", where: L("Texte de remplacement de la bande-annonce (accessibilité)", "Alternative text of the teaser (accessibility)"), attach: L("Se colle dans le champ « texte alternatif » de la vidéo.", "Goes in the “alternative text” field of the video."),
    fr: "Bande-annonce de trente secondes. Sur un papier quadrillé, une phrase : « Six logiciels autour d'une pièce. » Puis des écrans de l'outil DesignOrbit.ai se suivent : une pièce décrite par ses interfaces, un boîtier dont une cote change, un petit véhicule à quatre roues dont l'assemblage s'ouvre, une simulation en couleurs, un dessin coté. La marque DesignOrbit.ai clôt la séquence.",
    en: "A thirty-second teaser. On squared paper, a sentence: “Six tools around one part.” Then screens of the DesignOrbit.ai tool follow one another: a part described by its interfaces, a housing with a dimension changing, a small four-wheeled vehicle whose assembly opens, a simulation in colours, a dimensioned drawing. The DesignOrbit.ai mark closes the sequence." },
];
/** Lines to open or close a message with : the one of the film, then three of the same thread. */
export const TAGLINES = [
  L("On construit la fusée en volant.", "We build the rocket in flight."),
  L("Une pièce commence par une question.", "A part begins with a question."),
  L("L'outil qui retient le pourquoi.", "The tool that remembers why."),
  L("Dites-le une fois.", "Say it once."),
];
/** How to use the kit, and what it must not be made to say. */
export const USAGE = L(
  ["La bande-annonce se publie avec son fichier de sous-titres (.srt) : la plupart des fils la lisent sans le son.", "Les liens vont en premier commentaire : une annonce sans lien dans son texte est mieux montrée par les réseaux professionnels — usage courant, non vérifié ici.", "Aucun chiffre de gain : personne n'a mesuré de temps gagné. Ne pas en ajouter.", "Le projet est en développement actif : le dire tel quel. La démonstration s'ouvre sur demande.", "La voix de la bande-annonce est une voix de synthèse, faite sous un abonnement qui en permet la publication."],
  ["The teaser is published with its subtitle file (.srt): most feeds play it without sound.", "The links go in the first comment: an announcement without a link in its text is shown more by professional networks — common practice, not verified here.", "No figure of gain: nobody measured any time saved. Do not add one.", "The project is in active development: say it as it is. The demonstration opens on request.", "The voice of the teaser is a synthetic voice, made under a subscription that allows its publication."]);

/** Every sentence the kit PUBLISHES in a language — the sheet, the texts, the taglines — for the tests. The usage notes are not
    published : they are the ones that say no figure is to be added. */
export function kitTexts(lang) {
  const S = SHEET, out = [S.kicker[lang], ...S.slogan[lang], S.promise[lang], ...S.story[lang], S.shot.caption[lang], S.out.title[lang], S.status.title[lang], S.status.text[lang], S.call.title[lang], ...S.call.rows.map((r) => r[0][lang]), BRAND_FOOT[lang]];
  for (const g of S.groups) { out.push(g.title[lang]); for (const s of g.steps) out.push(s.title[lang], s.text[lang]); }
  for (const p of POSTS) out.push(p.where[lang], p.attach[lang], p[lang]);
  for (const t of TAGLINES) out.push(t[lang]);
  return out;
}
/** What a text says of a gain, when it should say nothing : a percentage, « n fois plus », « faster », time saved… → the matches. */
const word = (inner) => new RegExp(`(?<![\\p{L}\\p{N}])(?:${inner})(?![\\p{L}\\p{N}])`, "giu");      // whole words, accents included
const GAIN = [/\d+\s*%/gu, word("\\d+\\s*(?:x|×|fois)"), word("fois plus|times (?:faster|quicker|more)"), word("plus (?:vite|rapide(?:ment)?)"), word("faster|quicker|speeds? up"),
  word("gains? de temps|temps gagné|heures? gagnées?|jours? gagnés?|économis[\\p{L}]+|time saved|saves? (?:time|hours|days)|productivit[\\p{L}]+")];
export const gainClaims = (text) => GAIN.flatMap((re) => String(text).match(re) || []);
/** The texts to post as Markdown, both languages, each under its title. */
export function postsMarkdown(date) {
  const out = [`# DesignOrbit.ai — textes de publication · ready-to-post texts`, "", `${date} · kit de lancement. Chaque texte : où il va, ce que l'on y joint, puis le français et l'anglais.`, "", "## Mode d'emploi · how to use", "", ...USAGE.fr.map((x) => `- ${x}`), "", ...USAGE.en.map((x) => `- ${x}`), ""];
  for (const p of POSTS) out.push(`## ${p.where.fr} · ${p.where.en}`, "", `_À joindre : ${p.attach.fr} · Attach: ${p.attach.en}_`, "", "### Français", "", "```text", p.fr, "```", "", "### English", "", "```text", p.en, "```", "");
  out.push("## Phrases d'accroche · taglines", "", "| Français | English |", "|---|---|", ...TAGLINES.map((t) => `| ${t.fr} | ${t.en} |`), "");
  return out.join("\n");
}
