/* Reading the mirrors where they live (a reader is injected : no network), and the Google file picker against a double. */
import test from "node:test";
import assert from "node:assert/strict";
import { joinTeam, forkMirror, stampLocal, mergeMirror, artefacts } from "../../web/js/core/team.js";
import { parseMirror, linksOf, linkMirror, readMirrors, applyMirrors, bringsSomething } from "../../web/js/core/team_sync.js";
import { appIdOf, pickFile, loadPicker, pickerMessage } from "../../web/js/google/picker.js";
import { signature } from "../../web/js/core/review.js";
import { toDwiz } from "../../web/js/core/dwiz.js";
import { CONFIG } from "../../web/js/config.js";

const P = (value) => ({ value, min: 1, max: 500, step: 1, unit: "mm", label: "x" });
const part = (id, L) => ({ dw: "part/1", id, name: id, family: "plate", process: "cnc_milling", material: "AL6061-T6", params: { L: P(L) }, interfaces: [], features: [{ op: "box", id: "b", size: ["L", 40, 5] }] });
const project = () => ({ dw: "project/1", id: "P", name: "Module", parts: [part("BASE", 100), part("CAPOT", 100)], assemblies: [], boards: [], physics: [], simulations: [] });
const D = (n) => new Date(Date.UTC(2026, 0, 1, 10, n)), file = (p, who, n) => { stampLocal(p, who, D(n)); return toDwiz(p); };
const same = (a, b) => { for (const [k, d] of artefacts(a)) assert.equal(signature(d), signature(artefacts(b).get(k)), k); };

test("every mirror I know where to find is read in one go : a preview on a copy, then one application", async () => {
  const jp = project(); joinTeam(jp, { handle: "jp", mirror: "f-jp" }, D(0));
  const ami = forkMirror(parseMirror(file(jp, "jp", 0)), { handle: "ami", mirror: "f-ami" }, D(1)), zoe = forkMirror(parseMirror(file(jp, "jp", 0)), { handle: "zoe", mirror: "f-zoe" }, D(1));
  mergeMirror(jp, parseMirror(file(ami, "ami", 1)), "jp", D(2)); mergeMirror(jp, parseMirror(file(zoe, "zoe", 1)), "jp", D(2));
  assert.deepEqual(linksOf(jp, "jp"), [{ handle: "ami", id: "f-ami" }, { handle: "zoe", id: "f-zoe" }], "each member says where their mirror is ; it travels in the mirror");
  ami.parts[1].params.L.value = 90; zoe.parts.push(part("PATTE", 30)); jp.parts[0].params.L.value = 120;
  const drive = new Map([["f-ami", file(ami, "ami", 3)], ["f-zoe", file(zoe, "zoe", 3)]]), read = async (id) => { if (!drive.has(id)) throw Object.assign(new Error("File not found"), { status: 404 }); return drive.get(id); };
  const before = JSON.stringify(jp), { results, dry } = await readMirrors(jp, "jp", read, D(4));
  assert.equal(JSON.stringify(jp), before, "reading changes nothing");
  assert.deepEqual(results.map((r) => [r.handle, r.state, r.report.taken, r.report.added, r.report.kept]), [["ami", "ok", ["part:CAPOT"], [], ["part:BASE"]], ["zoe", "ok", [], ["part:PATTE"], ["part:BASE", "part:CAPOT"]]]);
  assert.equal(bringsSomething(results), true); assert.equal(dry.parts.length, 3);
  const reps = applyMirrors(jp, results, "jp", D(4)); assert.equal(reps.length, 2); same(dry, jp); assert.deepEqual([jp.parts[0].params.L.value, jp.parts[1].params.L.value, jp.parts.length], [120, 90, 3]);
  const again = await readMirrors(jp, "jp", read, D(5)); assert.equal(bringsSomething(again.results), false, "read again : nothing new");
});

test("a mirror that cannot be read is told apart : not allowed yet, someone else's file, not a mirror", async () => {
  const jp = project(); joinTeam(jp, { handle: "jp" }, D(0));
  const ami = forkMirror(parseMirror(file(jp, "jp", 0)), { handle: "ami" }, D(1)); mergeMirror(jp, parseMirror(file(ami, "ami", 1)), "jp", D(2));
  assert.deepEqual(linksOf(jp, "jp"), [], "no link yet : ami never said where her mirror is"); assert.equal(linkMirror(jp, "ami", "f-ami"), true); assert.equal(linkMirror(jp, "nobody", "x"), false);
  const one = async (read) => (await readMirrors(jp, "jp", read, D(3))).results[0];
  assert.equal((await one(async () => { throw Object.assign(new Error("File not found"), { status: 404 }); })).state, "denied", "drive.file hides a file until the person points at it");
  assert.equal((await one(async () => { throw Object.assign(new Error("quota"), { status: 429 }); })).state, "error");
  const r = await one(async () => file(jp, "jp", 3)); assert.equal(r.state, "other"); assert.match(r.error, /miroir de @jp, pas celui de @ami/);
  assert.equal((await one(async () => "bonjour")).state, "error"); assert.equal((await one(async () => toDwiz(project()))).state, "error");
  assert.throws(() => parseMirror("{ pas du json"), /ne se lit pas/); assert.equal(parseMirror(JSON.stringify(jp)).team.owner, "jp", "the JSON of the first versions is still read");
});

/** A double of the google.picker namespace : records what the application asks of it. */
function fakePicker() {
  const log = [], chain = (name, self) => (...a) => { log.push([name, ...a]); return self; };
  class DocsView { constructor(id) { log.push(["view", id]); for (const k of ["setIncludeFolders", "setMode", "setFileIds", "setMimeTypes", "setOwnedByMe"]) this[k] = chain(k, this); } }
  class PickerBuilder { constructor() { for (const k of ["addView", "setOAuthToken", "setAppId", "setDeveloperKey", "setTitle", "setLocale"]) this[k] = chain(k, this); this.setCallback = (fn) => { this.cb = fn; return this; }; this.build = () => ({ setVisible: (v) => { log.push(["visible", v]); ns.fire = this.cb; } }); } }
  const ns = { log, DocsView, PickerBuilder, ViewId: { DOCS: "all" }, DocsViewMode: { LIST: "list" }, Action: { PICKED: "picked", CANCEL: "cancel" }, Response: { ACTION: "action", DOCUMENTS: "docs" } };
  return ns;
}

test("the file picker : asks for exactly what is needed, and gives back the file the person chose", async () => {
  assert.equal(appIdOf("123456789-abcdef.apps.googleusercontent.com"), "123456789"); assert.equal(appIdOf(""), ""); assert.match(appIdOf(CONFIG.clientId), /^\d{6,}$/, "the project number comes from the public client ID");
  assert.equal(CONFIG.pickerKey, "", "no API key is needed by default");
  let G = fakePicker(), p = pickFile({ picker: G, token: "TOK", appId: "42", title: "Le miroir de @ami", mine: false });
  const calls = (name) => G.log.filter((c) => c[0] === name).map((c) => c.slice(1));
  assert.deepEqual([calls("setOAuthToken"), calls("setAppId"), calls("setMimeTypes"), calls("setOwnedByMe"), calls("setMode"), calls("setIncludeFolders"), calls("setFileIds"), calls("setDeveloperKey"), calls("visible")],
    [[["TOK"]], [["42"]], [["text/plain"]], [[false]], [["list"]], [[false]], [], [], [[true]]], "the person's token, the project, text files shared with them, a list ; no key");
  G.fire({ action: "loaded" }); G.fire({ action: "picked", docs: [{ id: "f-ami", name: "Module.project.dwiz", mimeType: "text/plain" }] });
  assert.deepEqual(await p, { id: "f-ami", name: "Module.project.dwiz" });
  /* pointed at the very file a member said is theirs, with a key when one is configured ; closing gives nothing */
  G = fakePicker(); p = pickFile({ picker: G, token: "TOK", appId: "42", key: "KEY", fileIds: ["f-ami", "f-zoe"] });
  assert.deepEqual([G.log.filter((c) => c[0] === "setFileIds")[0][1], G.log.some((c) => c[0] === "setMimeTypes"), G.log.filter((c) => c[0] === "setDeveloperKey")[0][1]], ["f-ami,f-zoe", false, "KEY"]);
  G.fire({ action: "cancel" }); assert.equal(await p, null);
  await assert.rejects(pickFile({ picker: fakePicker(), token: "TOK", appId: "" }), /sans-projet/); assert.match(pickerMessage(new Error("sans-projet")), /identifiant client/); assert.match(pickerMessage(new Error("google-injoignable")), /injoignable/);
});

test("the picker library is loaded once, on first use, from Google's own address", async () => {
  const added = [], root = {}, doc = { createElement: () => ({}), head: { append: (s) => { added.push(s.src); root.gapi = { load: (what, o) => { root.asked = what; root.google = { picker: { ok: true } }; o.callback(); } }; s.onload(); } } };
  loadPicker.pending = null;
  const a = await loadPicker(doc, root), b = await loadPicker(doc, root);
  assert.deepEqual([added, root.asked, a.ok, b === a], [["https://apis.google.com/js/api.js"], "picker", true, true]);
  loadPicker.pending = null; const dead = { createElement: () => ({}), head: { append: (s) => s.onerror() } };
  await assert.rejects(loadPicker(dead, {}), /google-injoignable/); loadPicker.pending = null;
});
