// Google sign-in, Drive client, project tree in Drive and the access list — all against fakes (no network).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createAuth, authMessage } from "../../web/js/google/auth.js";
import { createDrive, GoogleError, FOLDER, APP_KEY } from "../../web/js/google/drive.js";
import { createDriveFs, safeName, PROJECT_FILE } from "../../web/js/google/drive_fs.js";
import { accessHash, decide, approve, revoke, accessFileText, requestUrl, isHosted, isHash, shortHash, loadAccess } from "../../web/js/core/access.js";
import { CONFIG } from "../../web/js/config.js";

function fakeGoogle() {
  const g = { calls: [], revoked: [], accounts: { oauth2: {
    initTokenClient(cfg) { g.cfg = cfg; return { requestAccessToken(o) { g.calls.push(o); } }; },
    revoke(t, cb) { g.revoked.push(t); cb(); } } } };
  return g;
}

test("auth: token in memory, renewed before expiry, errors surfaced, revoked on sign-out", async () => {
  const g = fakeGoogle(); let t = 1_000_000;
  const auth = createAuth({ clientId: "id.apps.googleusercontent.com", scopes: "openid email", google: g, now: () => t });
  assert.equal(auth.signedIn(), false);
  await assert.rejects(auth.token(), /non-connecte/);
  const p = auth.signIn("someone@example.com");
  assert.deepEqual(g.calls[0], { prompt: "", login_hint: "someone@example.com" });
  assert.equal(g.cfg.scope, "openid email");
  g.cfg.callback({ access_token: "tok1", expires_in: 3600 });
  assert.equal(await p, "tok1");
  assert.equal(auth.signedIn(), true);
  assert.equal(await auth.token(), "tok1");
  t += 3600_000 - 4 * 60_000;                                   // 4 minutes before the end: renew silently
  const again = auth.token();
  assert.equal(g.calls.length, 2);
  g.cfg.callback({ access_token: "tok2", expires_in: 3600 });
  assert.equal(await again, "tok2");
  const denied = auth.chooseAccount();
  assert.deepEqual(g.calls[2], { prompt: "select_account" });
  g.cfg.callback({ error: "access_denied" });
  await assert.rejects(denied, /access_denied/);
  assert.match(authMessage(new Error("access_denied")), /pas autorisé/);
  auth.signOut();
  assert.deepEqual(g.revoked, ["tok2"]); assert.equal(auth.signedIn(), false);
  await assert.rejects(createAuth({ clientId: "", scopes: "x", google: g }).signIn(), /sans-client/);
  assert.match(authMessage(new Error("sans-client")), /docs\/GOOGLE\.md/);
});

test("drive client: bearer token, appProperties queries, multipart upload, Google errors", async () => {
  const seen = [];
  const fetch = async (url, init) => {
    seen.push({ url, init });
    if (url.includes("userinfo")) return { ok: true, status: 200, json: async () => ({ email: "A@B.c" }) };
    if (url.includes("boom")) return { ok: false, status: 403, json: async () => ({ error: { message: "Forbidden for this app" } }) };
    return { ok: true, status: 200, json: async () => ({ files: [{ id: "1", name: "x" }], id: "9", name: "n" }), text: async () => "{}" };
  };
  const d = createDrive({ token: async () => "TOK", fetch });
  assert.equal((await d.me()).email, "A@B.c");
  assert.equal(seen[0].init.headers.Authorization, "Bearer TOK");
  await d.find({ role: "project", props: { pid: "p'1" }, parent: "root" });
  const q = decodeURIComponent(seen[1].url.split("q=")[1].split("&")[0]);
  assert.match(q, new RegExp(`appProperties has \\{ key='${APP_KEY}' and value='project' \\}`));
  assert.ok(q.includes("value='p\\'1'"), "quotes are escaped in the query");
  assert.ok(q.includes("'root' in parents") && q.includes("trashed=false"));
  await d.upload({ name: "a.step", mime: "application/step", bytes: "ISO-10303-21;", parent: "f1", role: "artifact" });
  const up = seen[2];
  assert.match(up.url, /uploadType=multipart/); assert.match(up.init.headers["Content-Type"], /^multipart\/related; boundary=dw-/);
  const body = await up.init.body.text();
  assert.ok(body.includes('"name":"a.step"') && body.includes('"parents":["f1"]') && body.includes("ISO-10303-21;"));
  await assert.rejects(d.text("boom"), (e) => e instanceof GoogleError && e.status === 403 && /Forbidden/.test(e.message));
});

/** In-memory Drive with the calls drive_fs.js uses. */
function fakeDrive() {
  const files = new Map(); let n = 0;
  const mk = (o) => { const f = { id: `id${++n}`, modifiedTime: `2026-01-01T00:00:${String(n).padStart(2, "0")}Z`, webViewLink: `https://drive.example/${n}`, ...o }; files.set(f.id, f); return f; };
  return { files, log: [],
    async find({ role, props, parent, name, mime }) { return [...files.values()].filter((f) => !f.trashed && (!role || f.appProperties[APP_KEY] === role) && Object.entries(props || {}).every(([k, v]) => f.appProperties[k] === v) && (!parent || f.parents[0] === parent) && (!name || f.name === name) && (!mime || f.mimeType === mime)); },
    async createFolder({ name, parent, role, props }) { this.log.push(`mkdir ${name}`); return mk({ name, mimeType: FOLDER, parents: [parent || "My Drive"], appProperties: { [APP_KEY]: role || "folder", ...(props || {}) } }); },
    async upload({ name, mime, bytes, parent, role, props }) { this.log.push(`upload ${name}`); return mk({ name, mimeType: mime, parents: [parent], content: bytes, appProperties: { [APP_KEY]: role, ...(props || {}) } }); },
    async replace(id, { bytes }) { this.log.push(`replace ${files.get(id).name}`); files.get(id).content = bytes; return files.get(id); },
    async rename(id, name) { files.get(id).name = name; return files.get(id); },
    async text(id) { return files.get(id).content; } };
}

test("drive tree: save, reopen, rename, publish artefacts without duplicates", async () => {
  const drive = fakeDrive(), fs = createDriveFs(drive, { root: "DesignWizard.ai" });
  const project = { dw: "project/1", id: "p1", name: "Variateur 400 V / essai", parts: [{ id: "DW-0001" }], assemblies: [] };
  const a = await fs.saveProject(project);
  assert.equal(a.folder.name, "Variateur 400 V essai", "the folder name is made safe");
  assert.deepEqual(drive.log, ["mkdir DesignWizard.ai", "mkdir Variateur 400 V essai", `upload ${PROJECT_FILE}`]);
  await fs.saveProject({ ...project, parts: [{ id: "DW-0001" }, { id: "DW-0002" }] });
  assert.equal(drive.log.at(-1), `replace ${PROJECT_FILE}`, "a second save replaces the file");
  assert.equal([...drive.files.values()].filter((f) => f.name === PROJECT_FILE).length, 1);
  const back = await fs.loadProject(a.folder.id);
  assert.equal(back.parts.length, 2);
  const fs2 = createDriveFs(drive);                              // a new session finds the same folders by their tags
  const renamed = await fs2.projectFolder({ ...project, name: "Variateur 400 V" });
  assert.equal(renamed.id, a.folder.id); assert.equal(renamed.name, "Variateur 400 V");
  const steps = [];
  const pub = await fs2.publish(project, [
    { path: ["01_Pieces", "DW-0001 Support"], name: "DW-0001.step", mime: "application/step", bytes: "S" },
    { path: ["01_Pieces", "DW-0001 Support"], name: "DW-0001.stl", mime: "model/stl", bytes: new Uint8Array(84) },
    { path: ["04_Rapports"], name: "rapport.html", mime: "text/html", bytes: "<p>" }], (i, n) => steps.push(`${i}/${n}`));
  assert.deepEqual(steps, ["1/3", "2/3", "3/3"]);
  assert.equal(drive.log.filter((l) => l === "mkdir 01_Pieces").length, 1); assert.equal(drive.log.filter((l) => l === "mkdir DW-0001 Support").length, 1);
  assert.ok(pub.files.every((f) => f.id && f.link));
  await fs2.publish(project, [{ path: ["01_Pieces", "DW-0001 Support"], name: "DW-0001.step", mime: "application/step", bytes: "S2" }]);
  assert.equal([...drive.files.values()].filter((f) => f.name === "DW-0001.step").length, 1);
  const tree = await fs2.tree(a.folder.id);
  assert.deepEqual(tree.map((t) => t.name), ["01_Pieces", "04_Rapports", PROJECT_FILE]);
  assert.deepEqual(tree[0].children[0].children.map((c) => c.name), ["DW-0001.step", "DW-0001.stl"]);
  assert.deepEqual((await fs2.listProjects()).map((p) => p.pid), ["p1"]);
  await assert.rejects(fs2.loadProject(tree[0].id), /projet\.dwiz/);
  assert.match(drive.files.get(a.file.id).content, /^dwiz project\/1 p1 "Variateur 400 V \/ essai"/, "the project is stored in the platform's own format");
  const old = await drive.createFolder({ name: "ancien", parent: "x", role: "project", props: { pid: "old" } });
  await drive.upload({ name: "projet.dwproject.json", mime: "application/json", bytes: JSON.stringify({ dw: "project/1", id: "old", name: "Ancien", parts: [], assemblies: [] }), parent: old.id, role: "project-file" });
  assert.equal((await fs2.loadProject(old.id)).name, "Ancien", "project files of the first versions (JSON) are still read");
  assert.equal(safeName('a/b:c*?"<>|d'), "a b c d"); assert.equal(safeName(""), "sans nom");
});

test("access: hashed addresses only, admin and approved rights, request without the address", async () => {
  const salt = "00ff", h = await accessHash("Someone@Example.com", salt, 1000);
  assert.ok(isHash(h));
  assert.equal(h, await accessHash("  someone@example.com ", salt, 1000), "case and spaces do not matter");
  assert.notEqual(h, await accessHash("someone@example.com", "00fe", 1000)); assert.notEqual(h, await accessHash("someone@example.org", salt, 1000));
  let list = { mode: "approved", salt, iterations: 1000, admins: [], approved: [] };
  assert.deepEqual(decide(list, h), { admin: false, approved: false });
  list = approve(list, h);
  assert.deepEqual(decide(list, h), { admin: false, approved: true });
  assert.equal(approve(list, h), list, "approving twice changes nothing");
  assert.deepEqual(decide(approve(list, h, true), h), { admin: true, approved: true });
  assert.deepEqual(decide(revoke(approve(list, h, true), h), h), { admin: false, approved: false });
  assert.deepEqual(decide({ ...list, approved: [], mode: "open" }, h), { admin: false, approved: true });
  assert.deepEqual(decide({ ...list, mode: "open" }, null), { admin: false, approved: false }, "open still needs a signed-in account");
  assert.throws(() => approve(list, "someone@example.com"), /Empreinte invalide/);
  const text = accessFileText(list), url = requestUrl(h, "o/r");
  assert.ok(!text.includes("@") && JSON.parse(text).approved[0] === h);
  assert.ok(url.startsWith("https://github.com/o/r/issues/new?") && decodeURIComponent(url).includes(h) && !decodeURIComponent(url).includes("someone@"));
  assert.equal(shortHash(h).length, 14);
  assert.equal(isHosted({ protocol: "https:", hostname: "example.github.io" }), true);
  for (const hostname of ["localhost", "127.0.0.1", "[::1]"]) assert.equal(isHosted({ protocol: "http:", hostname }), false);
  assert.equal(isHosted({ protocol: "file:", hostname: "" }), false);
  assert.equal(isHosted({ protocol: "http:", hostname: "essai.localhost" }), false);
  assert.equal(isHosted({ protocol: "http:", hostname: "127.0.0.1", search: "?porte" }), true, "« ?porte » previews the door locally");
  assert.equal(isHosted({ protocol: "http:", hostname: "127.0.0.1", search: "?portes=1" }), false);
  await assert.rejects(accessHash("a@b.c", "s", 10, null), /https-requis/);
  const missing = await loadAccess(async () => ({ ok: false }), "x");
  assert.equal(missing.missing, true); assert.deepEqual(decide(missing, h), { admin: false, approved: false }, "no list = closed");
});

test("the committed access list holds hashes only and one administrator; the config holds no secret", () => {
  const raw = readFileSync(new URL("../../web/acces.json", import.meta.url), "utf8"), list = JSON.parse(raw);
  assert.ok(!raw.includes("@"), "no e-mail address in the public file");
  assert.equal(list.mode, "approved"); assert.ok(list.salt.length >= 16 && list.iterations >= 100000);
  assert.ok(list.admins.length >= 1 && [...list.admins, ...list.approved].every(isHash));
  assert.match(CONFIG.scopes, /drive\.file/); assert.ok(!/drive(\s|$)|drive\.readonly/.test(CONFIG.scopes.replace("drive.file", "")), "only the per-file Drive scope");
  assert.ok(CONFIG.clientId === "" || /\.apps\.googleusercontent\.com$/.test(CONFIG.clientId));
});
