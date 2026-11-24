/* DynamiteOrbit.ai by DynamiteAgile — entry point: registers the tools, wires the global helpers, starts the shell. */

import { app, start, go } from "./core/app.js";
import { store } from "./core/store.js";
import { linkHook } from "./core/links.js";
import { syncTwins } from "./pcba/twin.js";
import { followVariant } from "./core/variants.js";
import { followAsmVariant } from "./core/asm_live.js";
import { LIBRARY } from "./pcba/library.js";
import { openPalette } from "./core/palette.js";
import { installImport, pickFile } from "./core/importer.js";
import "./modules/home.js";
import "./modules/shop.js";
import "./modules/shop_special.js";
import "./modules/interfaces.js";
import "./modules/parts.js";
import "./modules/fab.js";
import "./modules/extrusion.js";
import "./modules/pcb.js";
import "./modules/pcba.js";
import "./modules/elab.js";
import "./modules/sw.js";
import "./modules/sw_req.js";
import "./modules/sw_verify.js";
import "./modules/assembly.js";
import "./modules/physics.js";
import "./modules/media.js";
import "./modules/fea.js";
import "./modules/creepage.js";
import "./modules/dfx.js";
import "./modules/drawings.js";
import "./modules/review.js";
import "./modules/mvp.js";
import "./modules/library.js";
import "./modules/levels_bar.js";
import "./modules/busbar.js";
import "./modules/flex.js";
import "./modules/labels.js";
import "./modules/render.js";
import "./modules/team.js";
import "./modules/plm.js";
import "./modules/history.js";
import "./modules/eco.js";
import "./modules/report.js";
import "./modules/onshape.js";
import "./modules/help.js";
import "./modules/start.js";
import { connect, saveToDrive, openFromDrive } from "./modules/account.js";
import { gate } from "./core/gate.js";
import { installHistoryAuto } from "./core/history_auto.js";
import { session } from "./core/access.js";

store.hooks.push(linkHook);
installHistoryAuto();      // a restore point is posed by itself after every answer of an AI that is applied (core/history_auto.js)
const followAll = (p) => { for (const x of p.parts || []) followVariant(x); for (const a of p.assemblies || []) followAsmVariant(a); };
store.hooks.push(followAll); store.loaders.push(followAll);      // the variant in use of a part or of an assembly is alive : it follows its tree, in the step that changes it (core/variants.js)
store.hooks.push((p, extra) => { if (extra && extra.board) syncTwins(p, LIBRARY, extra.board); });      // the mechanical twin of a board follows it, in the step that changes it (pcba/twin.js)
app.openPalette = openPalette;
app.onImported = (r) => {
  if (!r) return;
  if (r.kind === "part" || r.kind === "step") { const p = store.part(r.id); go(`#/${p && p.family === "pcb" ? "pcb" : p && p.family === "extrusion" ? "extrusion" : "parts"}/${encodeURIComponent(r.id)}`); }
  else if (r.kind === "assembly") go(`#/assembly/${encodeURIComponent(r.id)}`);
  else if (r.kind === "project") go(r.review ? "#/review" : "#/home");
  else if (r.kind === "profile") { app.pendingProfile = r.profile; go("#/extrusion/new"); }
};
app.pickFile = () => pickFile(app.onImported);
app.connect = connect; app.saveToDrive = saveToDrive; app.openFromDrive = openFromDrive;
app.firstDesign = (seed) => import("./modules/first_design.js").then((m) => m.openFirstDesign(seed));      // a detailed description, an interview led by an AI, a first complete design to review
app.aiLoop = (key, more) => import("./modules/ai_loop.js").then((m) => (key ? m.openAiLoopFor(key, more) : m.openCurrentAiLoop()));     // from any screen : the artefact it shows goes to an AI and comes back
installImport(app.onImported);
// On this machine the application opens at once. Hosted: approved Google accounts only, and their own Google Drive is the store.
gate().then((who) => { if (who && !who.local && session.fs) store.useDrive(session.fs); return start(); });
