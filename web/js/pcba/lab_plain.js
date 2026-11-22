/* DynamiteOrbit — Labo, said plainly (demande de JP : « je ne comprends pas exactement comment faire les manips comme
   ingénieur mécanique ou étudiant : une partie est encore cryptique, sûrement pour un pro du domaine… simplifier et
   expliquer comme à un enfant de 16 ans… il semble y avoir des différences entre les mesures virtuelles du labo et ce
   qui est demandé dans le labo réel : expliquer pourquoi, comme à un enfant de 16 ans »).
   Three things, for someone who has never held a multimeter :
     - each step of the bench IN PLAIN WORDS — one or two short sentences, with the picture of water in a pipe where it
       helps (voltage is pressure, current is flow) ;
     - the WORDS of the bench a step uses, each explained in a sentence, and what a signal name stands for ;
     - WHY THE SCREEN AND THE BENCH DIFFER for a test : the screen is a simulation that knows everything at every instant,
       the bench is a real board read with one instrument — and how what the screen draws maps to what one does there.
   Nothing here changes a step or a value : it only says them simply. Pure : no page. */

import { eng } from "./lab_bench.js";

/** The words of the bench : → [{ id, word (as one says it), en (as the trade writes it : on the instruments, in the datasheets), re (what tells a text uses it), says }] */
export const WORDS = [
  { id: "tension", en: "voltage", word: "Tension (volts, V)", re: /tension|\bvolts?\b|\d\s?m?V\b/i, says: "La « pression » de l'électricité entre deux points, comme la pression de l'eau dans un tuyau. Elle se mesure toujours ENTRE deux points : c'est pour cela qu'il y a deux pointes." },
  { id: "courant", en: "current", word: "Courant (ampères, A)", re: /courant|\d\s?m?A\b/i, says: "Le « débit » d'électricité qui passe dans un fil, comme les litres par minute dans un tuyau. Trop de courant chauffe, et peut brûler une piste." },
  { id: "limite", en: "current limit", word: "Limite de courant", re: /limite de courant|limitation|\blimite\b/i, says: "Un robinet de sécurité sur l'alimentation : elle refuse de donner plus que ce que vous avez réglé. Si la carte a un défaut, c'est cette limite qui l'empêche de brûler." },
  { id: "court", en: "short circuit", word: "Court-circuit", re: /court-circuit/i, says: "Deux points qui ne devraient pas se toucher se touchent. L'électricité prend ce raccourci, et le courant devient énorme d'un coup." },
  { id: "continuite", en: "continuity", word: "Continuité", re: /continuité|sonner|sonne\b|bip/i, says: "Le multimètre vérifie si deux points sont reliés par du métal. Il fait « bip » quand ils le sont." },
  { id: "masse", en: "ground", word: "Masse (GND)", re: /\bmasse\b|\bGND\b/, says: "Le point « zéro » de la carte : toutes les tensions se mesurent par rapport à lui. C'est là que va le cordon noir, toujours en premier." },
  { id: "alim", en: "DC power supply", word: "Alimentation de laboratoire", re: /alimentation/i, says: "Une boîte qui fournit l'électricité à la carte, à la tension que vous choisissez. Deux cordons : le rouge (+) et le noir (−). Un bouton ouvre ou coupe sa sortie." },
  { id: "multimetre", en: "multimeter", word: "Multimètre", re: /multimètre|pointe/i, says: "L'appareil à tout mesurer : tension, résistance, continuité. Deux pointes, un chiffre à l'écran. Il ne change rien au circuit : il regarde." },
  { id: "oscillo", en: "oscilloscope, probe", word: "Oscilloscope et sonde", re: /oscilloscope|sonde|\bvoie\b/i, says: "Un appareil qui DESSINE la tension au fil du temps : il montre ce qui va trop vite pour un multimètre. La sonde est son crayon ; sa petite pince se met sur la masse." },
  { id: "generateur", en: "function generator", word: "Générateur de fonctions", re: /générateur/i, says: "Une boîte qui fabrique un signal d'essai — une tension qui monte et descend — pour voir comment le circuit y répond." },
  { id: "charge", en: "load", word: "Charge", re: /\bcharge\b/i, says: "Ce qui consomme l'électricité. Ici, une simple résistance : elle fait travailler le circuit comme le ferait le vrai appareil branché dessus." },
  { id: "esd", en: "ESD wrist strap", word: "Bracelet antistatique", re: /antistatique|décharge/i, says: "Votre corps accumule de l'électricité statique — le petit choc sur une poignée de porte. Le bracelet l'évacue doucement : sans lui, ce choc peut tuer une puce sans laisser de trace." },
  { id: "plage", en: "acceptance band", word: "Plage acceptée", re: /plage|accepté|fourchette/i, says: "Aucune mesure n'est exacte au millième : on accepte une fourchette autour de la valeur attendue. Dedans, on continue. Dehors, on s'arrête et on cherche pourquoi." },
  { id: "broche", en: "pin", word: "Broche, patte", re: /broche|patte/i, says: "Une des petites pattes de métal d'un composant ou d'un connecteur. Son numéro est imprimé sur la carte, ou se compte depuis le repère." },
  { id: "condensateur", en: "capacitor", word: "Condensateur", re: /condensateur/i, says: "Un petit réservoir d'électricité. Il se remplit à l'allumage — d'où un bref appel de courant — et reste plein un moment après la coupure." },
];
/** The words a text uses. */
export const wordsIn = (text) => WORDS.filter((w) => w.re.test(String(text || "")));
const SIGNALS = [[/^SW\d*\./i, "le bouton : on appuie dessus avec le doigt"], [/^BT\d*\./i, "la pile : la source de la carte"], [/^(GND|0|AGND|PGND)$/i, "la masse : le point zéro de la carte"], [/RST|RESET/i, "la remise à zéro : tant que ce fil reste bas, la puce attend sans rien faire"], [/^\+?\d+V\d*(_IN)?$|^V(DD|CC|IN|M|BUS|BAT|ISO)\w*$|^VDDA$/i, "un fil d'alimentation : il apporte l'énergie"], [/^VREF/i, "une tension de référence : une valeur fixe, qui sert de règle pour mesurer"],
  [/^V?OUT|_OUT$/i, "la sortie du circuit : ce qu'il fournit"], [/^IN$|_IN$|^AIN/i, "l'entrée du circuit : ce qu'on lui donne"], [/TXD?$|^DI$|MOSI/i, "les données qui partent"], [/RXD?$|^RO$|MISO/i, "les données qui arrivent"], [/^DE$|_DE$/i, "le fil par lequel la puce dit « c'est moi qui parle »"],
  [/^(A|B)$|RS485|CAN|LIN$/i, "un des fils du bus : la ligne sur laquelle les cartes se parlent"], [/SCL|SDA|SCK|CLK/i, "un fil d'horloge ou de données d'un bus entre puces"], [/LED/i, "le fil qui allume le témoin"], [/PWM/i, "une commande en créneaux : allumé, éteint, très vite"], [/^J\.|^P\d/i, "une broche du connecteur"]];
/** What a signal name stands for, in a few words. */
export const signalSays = (name) => (SIGNALS.find(([re]) => re.test(String(name || ""))) || [null, "un fil du circuit, que la fiche nomme ainsi"])[1];

/** A step of the bench, in plain words. step : a step of pcba/lab_manip.js. */
export function plainStep(step) {
  const g = (step.gear && step.gear.kind) || "", id = step.id || "";
  if (step.kind === "safety") return "Avant tout, vous vous protégez et vous protégez la carte. Rien n'est branché, rien n'est allumé.";
  if (step.kind === "set" && g === "supply") return "Vous réglez l'alimentation LOIN de la carte, comme on règle un robinet avant d'y brancher le tuyau : la pression (les volts) et le débit maximal (la limite). Sa sortie reste fermée.";
  if (step.kind === "set" && g === "generator") return "Vous préparez le signal d'essai sans le brancher, et vous vérifiez qu'il a la bonne forme. Sa sortie reste fermée.";
  if (step.kind === "set" && g === "meter") return id === "meter" ? "Vous mettez le multimètre sur « bip », et vous vérifiez qu'il bipe quand ses deux pointes se touchent." : "Vous préparez le multimètre à mesurer des volts. C'est le seul réglage à faire : il servira pour toutes les tensions de cet essai, une à la fois.";
  if (step.kind === "set") return "Vous réglez l'écran de l'oscilloscope pour que la courbe tienne dedans : ni écrasée, ni hors du cadre.";
  if (step.float) return "Cas particulier, à lire deux fois : ici la tension se mesure entre deux points « vivants », dont aucun n'est la masse. La pince de masse habituelle est INTERDITE : elle ferait un court-circuit à travers l'oscilloscope.";
  if (step.kind === "connect" && (g === "supply" || g === "generator" || g === "load")) return "Vous posez les cordons aux endroits entourés sur l'image. Le noir d'abord, toujours : il va sur la masse. Rien n'est encore allumé.";
  if (step.kind === "connect") return "Vous posez les pointes de mesure aux endroits entourés. Elles ne changent rien au circuit : elles regardent.";
  if (step.kind === "guard" && id === "guard") return "Dernière vérification avant d'envoyer l'électricité : le multimètre ne doit PAS biper entre le + et le −. S'il bipe sans arrêt, quelque chose se touche — on n'allume pas.";
  if (step.kind === "guard") return "Vous relisez tout, comme un pilote relit sa liste avant de décoller. Une seconde paire d'yeux vaut de l'or.";
  if (step.kind === "power" && id === "cell-in") return "Ici, pas d'alimentation de laboratoire : la pile de la carte est la source. La glisser dans son support, c'est « allumer ». Regardez le « + » avant de pousser.";
  if (step.kind === "do" && id === "release") return "Vous lâchez le bouton : le circuit s'ouvre, la DEL doit s'éteindre tout de suite.";
  if (step.kind === "do") return "Un geste à la main, pas un appareil : vous appuyez sur le bouton montré et vous le gardez enfoncé. Tant qu'il est enfoncé, le circuit est fermé et le courant passe.";
  if (step.kind === "off" && id === "off" && /pile/i.test(step.title || "")) return "Vous retirez la pile : la carte n'a plus de source. Une pile bouton se range, hors de portée des enfants.";
  if (step.kind === "power") return "Vous ouvrez le robinet. Regardez le chiffre du courant pendant la première seconde : c'est lui qui dit si tout va bien. S'il reste bloqué au maximum, vous coupez.";
  if (step.kind === "read") return `${g === "scope" ? "Cette mesure va trop vite pour un multimètre : elle se lit sur l'écran de l'oscilloscope. " : g === "supply" ? "Rien à brancher : le chiffre est déjà sur l'afficheur de l'alimentation. " : ""}Vous lisez un chiffre et vous l'écrivez tel quel. Dans la fourchette : on continue. Hors de la fourchette : on coupe, et on cherche — on ne « corrige » jamais un chiffre.`;
  if (step.kind === "off") return "Vous fermez le robinet AVANT de retirer les cordons, puis vous laissez la carte se vider : un condensateur reste chargé un moment.";
  return "";
}
/** What a reading is, by its unit : a sentence for the one who writes the number down. */
export function plainReading(row) {
  const u = (row && row.unit) || "";
  return u === "V" ? "Une tension : la « pression » entre le point montré et la masse." : u === "A" ? "Un courant : le « débit » que l'alimentation fournit à la carte." : u === "Ω" ? "Une résistance : faible quand deux points sont bien reliés par du métal." : u === "s" ? "Une durée : le temps que met le circuit à réagir." : u === "Hz" ? "Une fréquence : combien de fois par seconde le signal recommence." : "Un nombre lu sur l'appareil.";
}
/** How what the screen draws maps to what one does at the bench, for a test. → [{ kind ("probe" | "end" | "hand" | "watch" | "amps" | "replay"), screen, bench, ch? (1 | 2 : the channel of the screen), value? (what one reads there) }]
    A curve the screen draws is : followed by a probe (a test with an oscilloscope) ; READ at its end with the multimeter (a row of the sheet, `end`) ;
    or what one turns by hand — the knob of the supply — when it still moves at its end. */
export function screenToBench(sheet) {
  const scoped = (sheet.gearIds || []).includes("scope"), out = [], colour = { 1: "jaune", 2: "bleue" }, seen = new Set(), rows = sheet.rows || [];
  for (const l of (sheet.links || []).filter((x) => x.instr === "scope")) { if (seen.has(l.to)) continue; seen.add(l.to); const at = l.at ? `${l.at.ref}, broche ${l.at.pin}` : "un point à suivre sur le schéma", ch = l.ch || 1;
    const row = rows.find((r) => !r.optional && r.unit === "V" && (r.points || []).length === 1 && r.points[0].signal === l.to), fed = (sheet.links || []).some((x) => x.instr === "supply" && x.to === l.to);
    out.push({ ch, kind: scoped ? "probe" : row ? "end" : fed ? "hand" : "watch", screen: `La courbe ${colour[ch] || ""} (CH${ch}) : « ${l.to} » — ${signalSays(l.to)}`.replace("  ", " "), ...(row ? { value: eng(row.expected, "V") } : {}),
      bench: scoped ? `la sonde de la voie ${ch} de l'oscilloscope sur ${at} : vous voyez la même courbe` : row ? `la pointe rouge du multimètre sur ${at}, la noire sur la masse : vous lisez UN chiffre, ${eng(row.expected, "V")} — la fin de la courbe` : fed ? "le bouton de tension de l'alimentation : c'est VOUS qui la faites monter et descendre, à la main" : `la pointe rouge du multimètre sur ${at} : vous la surveillez pendant l'essai` }); }
  if (rows.some((r) => r.unit === "A")) out.push({ kind: "amps", screen: "Les pistes qui s'allument : le courant calculé dans chaque fil", bench: "l'afficheur de courant de l'alimentation : un seul chiffre, pour toute la carte" });
  if (!sheet.noSim && (sheet.result || {}).kind === "tran") out.push({ kind: "replay", screen: "Le curseur qui avance, « Rejouer », la vitesse", bench: "rien : c'est un magnétoscope pour l'écran. Au banc, le temps ne se rembobine pas" });
  return out;
}
/** Why the screen and the bench differ for a test, in plain words. → [{ id, title, text }] */
export function whyDifferent(sheet) {
  const out = [], gear = sheet.gearIds || [], scoped = gear.includes("scope"), R = sheet.result || {}, rows = sheet.rows || [], add = (id, title, text) => out.push({ id, title, text });
  if (sheet.noSim) { add("nosim", "Pour cet essai, l'écran ne montre aucune courbe", "La carte est éteinte : il n'y a ni tension ni courant à calculer, donc rien à dessiner. Au banc, vous vérifiez seulement que le métal relie bien les points, au multimètre."); return out; }
  const map = screenToBench(sheet);
  if (map.some((m) => m.kind === "hand")) add("hand", "À l'écran, la tension monte toute seule ; au banc, c'est vous", "L'écran fait monter puis redescendre la tension d'entrée en quelques centièmes de seconde. Au banc, c'est vous qui tournez le bouton de l'alimentation, lentement, par petits pas, en surveillant le multimètre. C'est la même expérience, à vitesse humaine.");
  if (map.some((m) => m.kind === "end")) add("curves", "À l'écran, des courbes ; au banc, un chiffre par courbe", "L'ordinateur connaît la tension de chaque fil à chaque instant : il peut donc toujours dessiner des courbes, comme le ferait un oscilloscope. Au vrai banc, cet essai n'a pas besoin de regarder si vite : un multimètre suffit. Il affiche UN chiffre — la valeur une fois que tout s'est calmé, c'est-à-dire la FIN de la courbe. Chaque courbe de l'écran a donc sa ligne dans les relevés.");
  if (R.kind === "tran" && R.t && R.t.length) add("slow", "L'écran rejoue au ralenti", `Ce que l'écran montre dure ${eng(R.t[R.t.length - 1] - R.t[0], "s")} en vrai — bien moins qu'un clignement d'œil. Il le rejoue au ralenti pour que vous ayez le temps de voir. Au banc, c'est déjà fini quand vous levez les yeux vers l'afficheur.`);
  if (R.kind === "ac") add("sweep", "L'écran trace toute la courbe d'un coup", "L'ordinateur calcule la réponse à toutes les fréquences en un instant. Au banc, vous la refaites point par point : une fréquence, une mesure, puis la suivante.");
  if (rows.some((r) => r.unit === "A")) add("amps", "Le courant : partout à l'écran, à un seul endroit au banc", "L'ordinateur calcule le courant dans chaque fil — c'est pour cela que les pistes s'allument. Au banc, on ne « voit » pas le courant dans une piste : on lit celui que l'alimentation fournit à toute la carte, sur son afficheur.");
  if (rows.some((r) => r.ceiling)) add("more", "Le vrai chiffre sera un peu plus haut", "La simulation laisse de côté la petite consommation de chaque puce au repos. La vraie carte consomme donc un peu plus. C'est pour cela que la fiche donne une fourchette, et non un chiffre exact.");
  if (rows.some((r) => r.scope)) add("scope", "Un temps très court ne se lit pas au multimètre", "L'écran montre QUAND chaque fil monte, au millième de seconde. Un multimètre met une demi-seconde à afficher un chiffre : il ne peut pas voir si vite. Pour cette ligne-là il faut un oscilloscope ; sans lui, on la passe — les autres relevés suffisent à dire que la carte démarre bien.");
  if (rows.some((r) => r.optional && !r.scope)) add("gear", "Une mesure demande un appareil que tous les bancs n'ont pas", "L'ordinateur peut tout mesurer, même ce qui demande au banc un appareil spécial. Si vous ne l'avez pas, vous passez cette ligne : la valeur est là pour comprendre, pas pour être vérifiée.");
  if (sheet.board) add("program", "Le programme de la puce ne tourne pas à l'écran", "L'écran simule les circuits AUTOUR du microcontrôleur, pas son programme. Sur la vraie carte, le programme tourne : des sorties bougent qui restent immobiles à l'écran.");
  add("typical", "Des puces « typiques », pas exactement les vôtres", "L'ordinateur n'a pas le plan intime de chaque puce : il les imite par leur comportement habituel. Deux puces de fabricants différents ne font pas tout à fait pareil. La fourchette acceptée couvre cet écart ; la fiche technique de la puce réellement montée a le dernier mot.");
  add("perfect", "L'écran est une carte parfaite", "Pas de soudure douteuse, pas de fil trop long, pas de parasites : la simulation est une carte idéale. Le banc montre la vraie. Un écart n'est pas une faute : c'est une information — on la note, et on cherche à l'expliquer.");
  return out;
}
