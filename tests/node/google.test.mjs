// Google sign-in, Drive client, project tree in Drive and the access list — all against fakes (no network).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createAuth, authMessage } from "../../web/js/google/auth.js";
import { createDrive, GoogleError, FOLDER, APP_KEY } from "../../web/js/google/drive.js";
import { createDriveFs, safeName, itemFolderName, TREE } from "../../web/js/google/drive_fs.js";
import { accessHash, decide, approve, revoke, accessFileText, requestUrl, isHosted, isHash, shortHash, loadAccess, ROLES, accessRows, pendingAccess, setRole, editUrl, readNames, readDraft } from "../../web/js/core/access.js";
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
  /* sharing a file of mine with one person, to read : the address goes to Google only */
  await d.share("f 9", " ami@example.org ");
  const sh = seen.at(-1), sent = JSON.parse(typeof sh.init.body === "string" ? sh.init.body : await sh.init.body.text());
  assert.match(sh.url, /\/files\/f%209\/permissions\?sendNotificationEmail=true/); assert.equal(sh.init.method, "POST");
  assert.deepEqual(sent, { type: "user", role: "reader", emailAddress: "ami@example.org" });
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
    async rename(id, name) { this.log.push(`rename ${files.get(id).name} -> ${name}`); files.get(id).name = name; return files.get(id); },
    async move(id, to) { this.log.push(`move ${files.get(id).name}`); files.get(id).parents = [to]; return files.get(id); },
    async trash(id) { files.get(id).trashed = true; return files.get(id); },
    async text(id) { return files.get(id).content; },
    names(parentName) { const p = [...files.values()].find((f) => f.name === parentName && !f.trashed); return [...files.values()].filter((f) => p && f.parents[0] === p.id && !f.trashed).map((f) => f.name).sort(); } };
}

test("drive tree: the product as an ergonomic folder — named, renamed, archived, never duplicated", async () => {
  const drive = fakeDrive(), fs = createDriveFs(drive, { root: "DynamiteOrbit.ai" });
  const part = (id, name) => ({ dw: "part/1", id, name, material: "AL6061-T6", features: [{ op: "box", size: [1, 1, 1] }] });
  const project = { dw: "project/1", id: "p1", name: "Variateur 400 V / essai", description: "Démonstration", parts: [part("DW-0001", "Support"), part("DW-0002", "Capot")], assemblies: [] };
  const a = await fs.saveProject(project);
  assert.equal(a.folder.name, "Variateur 400 V essai", "the folder name is made safe");
  assert.equal(a.file.name, "Variateur 400 V essai.project.dwiz", "the project file carries the name of the product");
  assert.deepEqual(drive.names("DynamiteOrbit.ai"), ["LISEZ-MOI.txt", "Variateur 400 V essai"]);
  assert.deepEqual(drive.names("Variateur 400 V essai"), ["LISEZ-MOI.txt", "Variateur 400 V essai.project.dwiz"]);
  assert.match(drive.files.get(a.file.id).content, /^dwiz project\/1 p1 "Variateur 400 V \/ essai"/, "stored in the platform's own format");
  const readme = [...drive.files.values()].find((f) => f.name === "LISEZ-MOI.txt" && f.parents[0] === a.folder.id).content;
  assert.ok(readme.includes("DW-0001 — Support (AL6061-T6)") && readme.includes("01_Pieces/") && readme.includes("05_Commandes/"), "a note explains the folder to whoever opens it");
  await fs.saveProject({ ...project, parts: [...project.parts, part("DW-0003", "Bride")] });
  assert.equal(drive.log.at(-1), "replace Variateur 400 V essai.project.dwiz", "a second save replaces the file");
  assert.equal([...drive.files.values()].filter((f) => /\.project\.dwiz$/.test(f.name)).length, 1);
  assert.equal((await fs.loadProject(a.folder.id)).parts.length, 3);

  const fs2 = createDriveFs(drive);                              // a new session finds everything by its tags, not by its names
  const renamed = { ...project, name: "Variateur 400 V" };
  const b = await fs2.saveProject(renamed);
  assert.equal(b.folder.id, a.folder.id); assert.equal(b.folder.name, "Variateur 400 V"); assert.equal(b.file.id, a.file.id); assert.equal(b.file.name, "Variateur 400 V.project.dwiz");
  assert.equal((await fs2.openProject("p1")).name, "Variateur 400 V");
  await assert.rejects(fs2.openProject("nope"), /introuvable dans Google Drive/);

  const steps = [];
  const pub = await fs2.publish(renamed, [
    { of: { kind: "part", id: "DW-0001", name: "Support" }, name: "DW-0001.step", mime: "application/step", bytes: "S" },
    { of: { kind: "part", id: "DW-0001", name: "Support" }, name: "DW-0001.stl", mime: "model/stl", bytes: new Uint8Array(84) },
    { of: { kind: "part", id: "DW-0002", name: "Capot" }, name: "DW-0002.step", mime: "application/step", bytes: "S" },
    { path: ["03_Analyses"], name: "physique.dwiz", mime: "text/plain", bytes: "dwiz analysis/1" }], (i, n) => steps.push(`${i}/${n}`));
  assert.deepEqual(steps, ["1/4", "2/4", "3/4", "4/4"]);
  assert.deepEqual(drive.names("01_Pieces"), ["DW-0001 — Support", "DW-0002 — Capot"], "one folder per part: number — name");
  assert.deepEqual(drive.names("DW-0001 — Support"), ["DW-0001.step", "DW-0001.stl"]);
  assert.ok(pub.files.every((f) => f.id && f.link)); assert.deepEqual(pub.archived, []);
  const later = { ...renamed, parts: [part("DW-0001", "Support de capteur")] };          // one part renamed, one removed
  const pub2 = await fs2.publish(later, [{ of: { kind: "part", id: "DW-0001", name: "Support de capteur" }, name: "DW-0001.step", mime: "application/step", bytes: "S2" }]);
  assert.deepEqual(drive.names("01_Pieces"), ["DW-0001 — Support de capteur"], "the folder follows the name of its part");
  assert.deepEqual(pub2.archived, ["DW-0002 — Capot"]); assert.deepEqual(drive.names("99_Archives"), ["DW-0002 — Capot"], "a removed part is archived, not deleted");
  assert.equal([...drive.files.values()].filter((f) => f.name === "DW-0001.step").length, 1, "publishing again replaces the file");

  const order = await fs2.saveOrder(later, { name: "DW-0001_commande.zip", bytes: new Uint8Array(22), rfq: "DEMANDE DE PRIX" }, { partId: "DW-0001", quantity: 4 }, new Date(2026, 10, 20));
  assert.equal(order.folder.name, "2026-11-20 DW-0001 ×4"); assert.deepEqual(drive.names("2026-11-20 DW-0001 ×4"), ["DW-0001_commande.zip", "demande_de_prix.txt"]);
  assert.deepEqual(drive.names("Variateur 400 V"), ["01_Pieces", "03_Analyses", "05_Commandes", "99_Archives", "LISEZ-MOI.txt", "Variateur 400 V.project.dwiz"]);
  const tree = await fs2.tree(a.folder.id);
  assert.deepEqual(tree.map((t) => t.name), ["01_Pieces", "03_Analyses", "05_Commandes", "99_Archives", "LISEZ-MOI.txt", "Variateur 400 V.project.dwiz"], "numbered folders first, in the order of the work");
  const list = await fs2.listProjects();
  assert.deepEqual(list.map((p) => [p.id, p.name, p.folder]), [["p1", "Variateur 400 V", a.folder.id]]);

  const old = await drive.createFolder({ name: "ancien", parent: "x", role: "project", props: { pid: "old" } });
  await drive.upload({ name: "projet.dwproject.json", mime: "application/json", bytes: JSON.stringify({ dw: "project/1", id: "old", name: "Ancien", parts: [], assemblies: [] }), parent: old.id, role: "file" });
  assert.equal((await fs2.loadProject(old.id)).name, "Ancien", "project files of the first versions (JSON) are still read");
  await assert.rejects(fs2.loadProject(tree[0].id), /fichier de projet/);
  await fs2.trashProject("p1");
  assert.deepEqual((await fs2.listProjects()).map((p) => p.id), ["old"], "a deleted project goes to the Drive bin");
  assert.equal(safeName('a/b:c*?"<>|d'), "a b c d"); assert.equal(safeName(""), "sans nom"); assert.equal(itemFolderName("DW-1", "DW-1"), "DW-1");
});

test("drive tree: each released revision has a folder of its own, named after its number and its revision", async () => {
  const { release, releaseFiles } = await import("../../web/js/core/plm.js"), { toDwiz, fromDwiz } = await import("../../web/js/core/dwiz.js");
  const drive = fakeDrive(), fs = createDriveFs(drive, { root: "DynamiteOrbit.ai" });
  const project = { dw: "project/1", id: "p-rev", name: "Variateur", parts: [{ dw: "part/1", id: "DW-0001", name: "Support", material: "AL6061-T6", features: [{ op: "box", size: [1, 1, 1] }] }], assemblies: [] };
  release(project, "part:DW-0001", { date: new Date(Date.UTC(2026, 0, 1, 12, 0)) }); project.parts[0].notes = ["Ébavurer."]; release(project, "part:DW-0001", { date: new Date(Date.UTC(2026, 0, 1, 12, 5)) });
  await fs.saveProject(project); const r = await fs.publish(project, releaseFiles(project, toDwiz, TREE.revisions));
  assert.equal(TREE.revisions, "06_Revisions"); assert.deepEqual(drive.names("06_Revisions"), ["PRT-46023-50000_A Support", "PRT-46023-50000_B Support"]);
  assert.deepEqual(drive.names("PRT-46023-50000_B Support"), ["PRT-46023-50000_B Support.dwiz"]); assert.equal(r.files.length, 2);
  const frozen = [...drive.files.values()].find((f) => f.name === "PRT-46023-50000_A Support.dwiz"); assert.equal(fromDwiz(frozen.content).notes, undefined, "revision A is the part as it was");
  await fs.publish(project, releaseFiles(project, toDwiz, TREE.revisions)); assert.equal(drive.names("06_Revisions").length, 2, "published again : the same folders, no twin");
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
  assert.match(CONFIG.clientId, /^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/, "a public OAuth client ID, never a client secret");
  assert.ok(!/GOCSPX|client_secret|refresh_token/i.test(readFileSync(new URL("../../web/js/config.js", import.meta.url), "utf8")));
});

test("access, said clearly to who administers it : a line per account, its role in words, what is published and what waits", async () => {
  const salt = "00ff", A = await accessHash("admin@example.com", salt, 1000), U = await accessHash("user@example.com", salt, 1000), N = await accessHash("new@example.com", salt, 1000);
  const published = { v: 1, mode: "approved", salt, iterations: 1000, admins: [A], approved: [U] };
  assert.deepEqual(accessRows(published, published, A, { [U]: "Testeur" }).map((r) => [r.role, r.state, r.you, r.name]), [["admin", "online", true, ""], ["user", "online", false, "Testeur"]], "administrators first ; a name of one's own ; « vous »");
  assert.equal(pendingAccess(published, published), 0); assert.equal(pendingAccess(published, null), 0);
  let draft = setRole(published, N, false); assert.deepEqual(accessRows(draft, published).map((r) => r.state), ["online", "online", "new"]); assert.equal(pendingAccess(draft, published), 1);
  draft = setRole(draft, U, true); assert.deepEqual([draft.admins, draft.approved], [[A, U], [N]], "one role only : promoted, it leaves the approved list");
  assert.deepEqual(accessRows(draft, published).find((r) => r.hash === U), { hash: U, role: "admin", was: "user", name: "", you: false, state: "changed" });
  draft = revoke(draft, A); const gone = accessRows(draft, published).find((r) => r.hash === A); assert.deepEqual([gone.state, gone.role, gone.was], ["removed", "admin", "admin"], "taken away here, it keeps its line until the list is published");
  assert.equal(pendingAccess(draft, published), 3); assert.equal(pendingAccess({ ...published, mode: "open" }, published), 1, "the opening mode counts as a change");
  assert.deepEqual(accessRows(revoke(setRole(published, N, false), N), published).map((r) => r.state), ["online", "online"], "added then removed : no trace");
  /* what a role allows is said in words, the same on the screen and in the documentation */
  assert.deepEqual(Object.keys(ROLES), ["user", "admin"]); assert.ok(ROLES.user.can.some((c) => /créer et enregistrer ses projets dans SON Google Drive/.test(c))); assert.equal(ROLES.admin.can.length, ROLES.user.can.length + 1); assert.match(ROLES.admin.can.at(-1), /approuver, retirer et nommer/);
  const doc = readFileSync(new URL("../../docs/GOOGLE.md", import.meta.url), "utf8"); assert.match(doc, /créer et enregistrer ses\s+projets dans \*\*son\*\* Google Drive/); assert.match(doc, /gardé \*\*dans son navigateur\s+seulement\*\*/);
  assert.equal(editUrl("o/r"), "https://github.com/o/r/edit/main/web/acces.json");
  /* the names live in the browser of the administrator : anything that is not a fingerprint and a name is dropped */
  assert.deepEqual(readNames(JSON.stringify({ [U]: "  Testeur ", nope: "x", [A]: 4, [N]: "" })), { [U]: "Testeur" }); for (const bad of ["", "{", "[1]", "null"]) assert.deepEqual(readNames(bad), {});
  assert.equal(readNames(JSON.stringify({ [U]: "x".repeat(200) }))[U].length, 80);
  /* a draft is kept only while it differs from what is published, and never across another salt */
  const kept = JSON.stringify({ salt, mode: "approved", admins: [A], approved: [U, N, "not-a-hash"] }); assert.deepEqual(readDraft(kept, published).approved, [U, N]); assert.ok(!kept.includes("@"));
  assert.equal(readDraft(JSON.stringify({ salt, mode: "approved", admins: [A], approved: [U] }), published), null, "once published, nothing is left to keep"); assert.equal(readDraft(JSON.stringify({ salt: "other", admins: [A], approved: [N] }), published), null); assert.equal(readDraft("{", published), null);
  /* the screen : names in the browser only, the draft kept, the steps said */
  const scr = readFileSync(new URL("../../web/js/modules/account_access.js", import.meta.url), "utf8");
  assert.match(scr, /"dw\.access\.names"/); assert.match(scr, /"dw\.access\.draft"/); assert.match(scr, /"data-access-row": r\.state/); assert.match(scr, /L'outil ne peut pas voir cette liste/); assert.match(scr, /editUrl\(\)/);
  assert.doesNotMatch(scr, /fetch\(|XMLHttpRequest/, "a name never leaves the browser"); assert.doesNotMatch(readFileSync(new URL("../../web/acces.json", import.meta.url), "utf8"), /@/, "no address in the published list");
});
