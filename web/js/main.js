/* DesignWizard.ai by DynamiteAgile — entry point: registers the tools, wires the global helpers, starts the shell. */

import { app, start, go } from "./core/app.js";
import { store } from "./core/store.js";
import { linkHook } from "./core/links.js";
import { openPalette } from "./core/palette.js";
import { installImport, pickFile } from "./core/importer.js";
import "./modules/home.js";
import "./modules/shop.js";
import "./modules/interfaces.js";
import "./modules/parts.js";
import "./modules/extrusion.js";
import "./modules/pcb.js";
import "./modules/assembly.js";
import "./modules/physics.js";
import "./modules/creepage.js";
import "./modules/dfx.js";
import "./modules/drawings.js";
import "./modules/report.js";
import "./modules/onshape.js";
import "./modules/help.js";
import { connect, saveToDrive, openFromDrive } from "./modules/account.js";
import { gate } from "./core/gate.js";
import { session } from "./core/access.js";

store.hooks.push(linkHook);
app.openPalette = openPalette;
app.onImported = (r) => {
  if (!r) return;
  if (r.kind === "part" || r.kind === "step") { const p = store.part(r.id); go(`#/${p && p.family === "pcb" ? "pcb" : p && p.family === "extrusion" ? "extrusion" : "parts"}/${encodeURIComponent(r.id)}`); }
  else if (r.kind === "assembly") go(`#/assembly/${encodeURIComponent(r.id)}`);
  else if (r.kind === "project") go("#/home");
  else if (r.kind === "profile") { app.pendingProfile = r.profile; go("#/extrusion/new"); }
};
app.pickFile = () => pickFile(app.onImported);
app.connect = connect; app.saveToDrive = saveToDrive; app.openFromDrive = openFromDrive;
installImport(app.onImported);
// On this machine the application opens at once. Hosted: approved Google accounts only, and their own Google Drive is the store.
gate().then((who) => { if (who && !who.local && session.fs) store.useDrive(session.fs); return start(); });
