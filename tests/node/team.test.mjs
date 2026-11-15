/* Working together in mirrors : two members, each with their own copy ; what one changes reaches the other, what both change waits for a person. */
import test from "node:test";
import assert from "node:assert/strict";
import { teamOf, joinTeam, forkMirror, stampLocal, mergeMirror, resolveConflict, post, setDone, inbox, threads, pinsOf, artefacts, labelOf, isShared, cleanHandle, teamRows } from "../../web/js/core/team.js";
import { signature, approve } from "../../web/js/core/review.js";
import { toDwiz, fromDwiz } from "../../web/js/core/dwiz.js";

const P = (value) => ({ value, min: 1, max: 500, step: 1, unit: "mm", label: "x" });
const part = (id, L) => ({ dw: "part/1", id, name: id, family: "plate", process: "cnc_milling", material: "AL6061-T6", params: { L: P(L) }, interfaces: [], features: [{ op: "box", id: "b", size: ["L", 40, 5] }] });
const project = () => ({ dw: "project/1", id: "P", name: "Module", parts: [part("BASE", 100), part("CAPOT", 100)], assemblies: [{ dw: "assembly/1", id: "ASM", name: "Ensemble", instances: [{ id: "i1", part: "BASE", fixed: true }, { id: "i2", part: "CAPOT" }], mates: [] }], boards: [], physics: [], simulations: [] });
const D = (n) => new Date(Date.UTC(2026, 0, 1, 10, n)), send = (p, who, n) => { stampLocal(p, who, D(n)); return fromDwiz(toDwiz(p)); };     // a mirror travels as the file it is
const same = (a, b) => { const A = artefacts(a), B = artefacts(b); assert.deepEqual([...A.keys()].sort(), [...B.keys()].sort()); for (const [k, d] of A) assert.equal(signature(d), signature(B.get(k)), k); };
/** jp opens a project and invites ami, who starts from a copy of jp's mirror. */
function pair() {
  const jp = project(); joinTeam(jp, { handle: "jp", hash: "h-jp", mirror: "file-jp" }, D(0));
  const ami = forkMirror(send(jp, "jp", 0), { handle: "ami", hash: "h-ami", mirror: "file-ami" }, D(1));
  return { jp, ami };
}

test("each member changes their own part : every change reaches the other, nobody is asked anything", () => {
  const { jp, ami } = pair();
  let r = mergeMirror(jp, send(ami, "ami", 1), "jp", D(2)); assert.deepEqual([r.from, r.members, r.taken, r.conflicts], ["ami", ["ami"], [], []]); assert.equal(isShared(jp), true); assert.equal(jp.team.id, ami.team.id);
  jp.parts[0].params.L.value = 120; ami.parts[1].params.L.value = 90; ami.parts.push(part("PATTE", 30));
  r = mergeMirror(jp, send(ami, "ami", 3), "jp", D(4)); assert.deepEqual([r.taken, r.added, r.kept, r.conflicts], [["part:CAPOT"], ["part:PATTE"], ["part:BASE"], []]);
  r = mergeMirror(ami, send(jp, "jp", 4), "ami", D(5)); assert.deepEqual([r.taken, r.added, r.conflicts], [["part:BASE"], [], []]); same(jp, ami);
  assert.deepEqual([jp.team.stamps["part:CAPOT"].by, jp.team.stamps["part:BASE"].by, ami.team.stamps["part:BASE"].by], ["ami", "jp", "jp"], "each artefact remembers who changed it last");
  /* a part taken away on one side leaves the other */
  ami.parts = ami.parts.filter((p) => p.id !== "PATTE"); r = mergeMirror(jp, send(ami, "ami", 6), "jp", D(7)); assert.deepEqual(r.removed, ["part:PATTE"]); assert.equal(jp.parts.some((p) => p.id === "PATTE"), false);
  r = mergeMirror(ami, send(jp, "jp", 7), "ami", D(8)); assert.equal(r.nothing, true, "nothing new : the two mirrors agree"); same(jp, ami);
});

test("the same part changed on both sides is a conflict : mine stays, theirs waits, and a person decides — nothing is lost", () => {
  const { jp, ami } = pair(); mergeMirror(jp, send(ami, "ami", 1), "jp", D(2)); mergeMirror(ami, send(jp, "jp", 2), "ami", D(2));
  jp.parts[0].params.L.value = 120; ami.parts[0].params.L.value = 80;
  let r = mergeMirror(jp, send(ami, "ami", 3), "jp", D(4)); assert.deepEqual(r.conflicts, ["part:BASE"]); assert.equal(jp.parts[0].params.L.value, 120, "mine is untouched");
  assert.deepEqual([jp.team.conflicts[0].by, jp.team.conflicts[0].doc.params.L.value], ["ami", 80], "theirs is kept beside it, whole");
  r = mergeMirror(jp, send(ami, "ami", 3), "jp", D(5)); assert.equal(jp.team.conflicts.length, 1, "merging again does not pile the conflict up");
  assert.equal(resolveConflict(jp, "part:BASE", "ami", "mine", "jp", D(6)), true); assert.equal(jp.team.conflicts.length, 0); assert.equal(jp.parts[0].params.L.value, 120);
  r = mergeMirror(jp, send(ami, "ami", 3), "jp", D(7)); assert.deepEqual([r.conflicts, r.kept], [[], ["part:BASE"]], "theirs was seen and set aside : it does not come back");
  /* jp settled it : on the other side his choice arrives as a change to take, and the two mirrors agree */
  r = mergeMirror(ami, send(jp, "jp", 7), "ami", D(8)); assert.deepEqual([r.conflicts, r.taken], [[], ["part:BASE"]], "the first who settles, settles for both"); assert.equal(ami.parts[0].params.L.value, 120);
  r = mergeMirror(jp, send(ami, "ami", 9), "jp", D(10)); assert.equal(r.nothing, true); same(jp, ami);
  /* one removes what the other changed : a conflict too */
  jp.parts[1].params.L.value = 70; ami.parts = ami.parts.filter((p) => p.id !== "CAPOT"); ami.assemblies[0].instances = ami.assemblies[0].instances.filter((i) => i.part !== "CAPOT");
  r = mergeMirror(jp, send(ami, "ami", 11), "jp", D(12)); assert.deepEqual(r.conflicts, ["part:CAPOT"]); assert.equal(jp.team.conflicts.find((c) => c.key === "part:CAPOT").doc, null); assert.deepEqual(r.taken, ["assembly:ASM"]);
  resolveConflict(jp, "part:CAPOT", "ami", "theirs", "jp", D(13)); assert.equal(jp.parts.some((p) => p.id === "CAPOT"), false);
});

test("the first merge after an invitation : each side's own changes are told apart, although the inviter never merged before", () => {
  const { jp, ami } = pair();                                                                  // no merge yet : jp only gave his mirror
  ami.parts[1].params.L.value = 103; ami.parts[0].params.L.value = 104; jp.parts[0].params.L.value = 98; jp.assemblies[0].name = "Ensemble général";
  let r = mergeMirror(jp, send(ami, "ami", 3), "jp", D(4)); assert.deepEqual([r.taken, r.kept, r.conflicts, r.members], [["part:CAPOT"], ["assembly:ASM"], ["part:BASE"], ["ami"]], "hers alone is taken, his alone is kept, the one both changed waits");
  resolveConflict(jp, "part:BASE", "ami", "theirs", "jp", D(5)); r = mergeMirror(ami, send(jp, "jp", 6), "ami", D(7)); assert.deepEqual([r.taken, r.conflicts], [["assembly:ASM"], []]); same(jp, ami);
  /* one takes the other's version, then the other moves on : no false conflict */
  jp.parts[1].params.L.value = 111; r = mergeMirror(ami, send(jp, "jp", 8), "ami", D(9)); assert.deepEqual(r.taken, ["part:CAPOT"]);
  jp.parts[1].params.L.value = 112; r = mergeMirror(jp, send(ami, "ami", 10), "jp", D(11)); assert.deepEqual([r.kept, r.conflicts], [["part:CAPOT"], []], "she only holds what she took from him : his newer version stands");
  r = mergeMirror(ami, send(jp, "jp", 12), "ami", D(13)); assert.deepEqual(r.taken, ["part:CAPOT"]); same(jp, ami);
});

test("three members, read in any order : the lineage of each artefact tells which version is the newer, even between two who never met", () => {
  const { jp, ami } = pair(), zoe = forkMirror(send(jp, "jp", 1), { handle: "zoe", hash: "h-zoe" }, D(2));
  mergeMirror(jp, send(ami, "ami", 2), "jp", D(3)); mergeMirror(jp, send(zoe, "zoe", 3), "jp", D(4)); assert.equal(jp.team.members.length, 3);
  ami.parts[1].params.L.value = 90;
  let r = mergeMirror(jp, send(ami, "ami", 5), "jp", D(6)); assert.deepEqual(r.taken, ["part:CAPOT"]);
  r = mergeMirror(zoe, send(jp, "jp", 7), "zoe", D(8)); assert.deepEqual([r.taken, r.conflicts, r.members], [["part:CAPOT"], [], ["ami"]]); assert.equal(zoe.team.stamps["part:CAPOT"].by, "ami", "the change keeps its author on the way");
  zoe.parts[0].params.L.value = 130;                                                           // zoe and ami have never read each other
  r = mergeMirror(ami, send(zoe, "zoe", 9), "ami", D(10)); assert.deepEqual([r.taken, r.kept, r.conflicts, r.members], [["part:BASE"], [], [], ["zoe"]], "no false conflict on a first meeting");
  r = mergeMirror(jp, send(ami, "ami", 11), "jp", D(12)); assert.deepEqual(r.taken, ["part:BASE"], "zoe's change reaches jp through ami"); same(jp, ami); same(jp, zoe); assert.equal(jp.team.stamps["part:BASE"].by, "zoe");
  /* a change, then its undoing : the return to the old value is a newer version, not an old one */
  ami.parts[1].params.L.value = 95; mergeMirror(jp, send(ami, "ami", 13), "jp", D(14)); ami.parts[1].params.L.value = 90;
  r = mergeMirror(jp, send(ami, "ami", 15), "jp", D(16)); assert.deepEqual(r.taken, ["part:CAPOT"]); assert.equal(jp.parts[1].params.L.value, 90);
  /* a mirror that was not stamped before it left (a plain export) is read as changed by its owner */
  ami.parts[1].params.L.value = 88; r = mergeMirror(jp, fromDwiz(toDwiz(ami)), "jp", D(17)); assert.deepEqual([r.taken, r.conflicts], [["part:CAPOT"], []]);
  /* both settle the same conflict, each for the other's version : the later decision stands, on both sides */
  jp.parts[0].params.L.value = 140; ami.parts[0].params.L.value = 150; const mj = send(jp, "jp", 18), ma = send(ami, "ami", 18);
  assert.deepEqual([mergeMirror(jp, ma, "jp", D(19)).conflicts, mergeMirror(ami, mj, "ami", D(19)).conflicts], [["part:BASE"], ["part:BASE"]]);
  resolveConflict(jp, "part:BASE", "ami", "theirs", "jp", D(20)); resolveConflict(ami, "part:BASE", "jp", "theirs", "ami", D(21)); assert.deepEqual([jp.parts[0].params.L.value, ami.parts[0].params.L.value], [150, 140]);
  r = mergeMirror(jp, send(ami, "ami", 22), "jp", D(23)); assert.deepEqual([r.taken, r.conflicts], [["part:BASE"], []]); r = mergeMirror(ami, send(jp, "jp", 24), "ami", D(25)); assert.equal(r.nothing, true); same(jp, ami); assert.equal(jp.parts[0].params.L.value, 140);
  r = mergeMirror(zoe, send(jp, "jp", 26), "zoe", D(27)); assert.deepEqual([r.taken.sort(), r.conflicts], [["part:BASE", "part:CAPOT"], []]); same(jp, zoe);
  const back = fromDwiz(toDwiz(jp)); assert.deepEqual(back.team, jp.team, "the lineage survives the file"); assert.ok(jp.team.stamps["part:BASE"].was.length >= 3);
});

test("messages follow the design : « @name » calls a member, the message travels with the mirror, and so does its answer", () => {
  const { jp, ami } = pair(); mergeMirror(jp, send(ami, "ami", 1), "jp", D(2));
  const m = post(jp, { by: "jp", on: "part:BASE", text: "@ami peux-tu épaissir la paroi à 3 mm ? @inconnu aussi.", date: D(3) }); assert.deepEqual(m.mentions, ["ami"], "only a member of the team can be called");
  post(jp, { by: "jp", on: "project", text: "Revue vendredi.", date: D(4) }); assert.throws(() => post(jp, { by: "jp", text: "  " }), /vide/);
  assert.deepEqual(inbox(jp, "ami").length, 1); assert.deepEqual(inbox(jp, "jp"), [], "one is not called by oneself");
  let r = mergeMirror(ami, send(jp, "jp", 5), "ami", D(6)); assert.equal(r.messages, 2); assert.deepEqual(inbox(ami, "ami").map((x) => [x.by, x.on]), [["jp", "part:BASE"]]);
  post(ami, { by: "ami", on: "part:BASE", text: "@jp fait, 3 mm.", date: D(7) }); setDone(ami, m.id, "ami", true, D(7));
  r = mergeMirror(jp, send(ami, "ami", 8), "jp", D(9)); assert.equal(r.messages, 1); assert.equal(jp.talk.find((x) => x.id === m.id).done.by, "ami", "closed there, closed here"); assert.equal(inbox(jp, "jp").length, 1);
  r = mergeMirror(jp, send(ami, "ami", 8), "jp", D(10)); assert.equal(r.messages, 0, "a message is never taken twice");
  const th = threads(jp); assert.deepEqual(th.map((t) => [t.on, t.items.length, t.open]), [["part:BASE", 2, 1], ["project", 1, 1]]); assert.equal(th[0].label, "Pièce BASE — BASE"); assert.equal(labelOf(jp, "project"), "Le projet");
  const rows = teamRows(jp); assert.deepEqual(rows.members.map((x) => x[0]), ["@jp", "@ami"]); assert.equal(rows.open.length, 2);
});

test("a message can be pinned on the 3D : it keeps its point, is answered where it is, and travels with the mirror", () => {
  const { jp, ami } = pair(); mergeMirror(jp, send(ami, "ami", 1), "jp", D(2));
  const a = post(jp, { by: "jp", on: "part:BASE", text: "@ami ce bord coupe : un congé de 1 mm ?", date: D(3), pin: { at: [12.3456, 0, 5] } });
  const b = post(jp, { by: "jp", on: "assembly:ASM", text: "Jeu trop serré ici.", date: D(4), pin: { at: [50, 20, 5.004], inst: "i2" } });
  assert.deepEqual([a.pin, b.pin, a.mentions], [{ at: [12.35, 0, 5] }, { at: [50, 20, 5], inst: "i2" }, ["ami"]], "a point of the part, to the hundredth ; in an assembly, of which instance");
  assert.throws(() => post(jp, { by: "jp", on: "part:BASE", text: "x", pin: { at: [1, 2] } }), /demande un point/); assert.throws(() => post(jp, { by: "jp", text: "x", re: "nobody-1" }), /n'existe plus/);
  /* she receives it, sees it called for her, answers on the pin itself, and closes it */
  let r = mergeMirror(ami, send(jp, "jp", 5), "ami", D(6)); assert.equal(r.messages, 2); assert.deepEqual(inbox(ami, "ami").map((m) => m.id), [a.id]);
  const c = post(ami, { by: "ami", re: a.id, text: "@jp fait : congé R1.", date: D(7), on: "project", pin: { at: [0, 0, 0] } }); assert.deepEqual([c.on, c.re, c.pin], ["part:BASE", a.id, undefined], "an answer goes where its message is, and is not a pin of its own");
  setDone(ami, a.id, "ami", true, D(7)); post(ami, { by: "ami", on: "part:BASE", text: "Et ce trou ?", date: D(8), pin: { at: [30, 10, 5] } });
  r = mergeMirror(jp, send(ami, "ami", 9), "jp", D(10)); assert.equal(r.messages, 2);
  const pins = pinsOf(jp, "part:BASE"); assert.deepEqual(pins.map((x) => [x.n, x.msg.by, x.open, x.replies.map((q) => q.text)]), [[1, "jp", false, ["@jp fait : congé R1."]], [2, "ami", true, []]], "numbered in the order they were written, the same on both sides");
  assert.deepEqual(pinsOf(ami, "part:BASE").map((x) => x.msg.id), pins.map((x) => x.msg.id)); assert.equal(pinsOf(jp, "assembly:ASM")[0].msg.pin.inst, "i2"); assert.deepEqual(pinsOf(jp, "part:CAPOT"), []); assert.deepEqual(pinsOf(null, "x"), []);
  assert.equal(threads(jp).find((t) => t.on === "part:BASE").items.length, 3, "a pinned message is a message of the thread of its artefact"); assert.match(teamRows(jp).open.find((x) => x[3] === "Et ce trou ?")[2], /^Pièce BASE — BASE — épinglé sur le 3D$/);
  const back = fromDwiz(toDwiz(jp)); assert.deepEqual(back.talk, jp.talk, "the pin survives the file");
});

test("guard rails : whose mirror it is, which team it belongs to, the names, the reviews, the file", () => {
  const { jp, ami } = pair(); mergeMirror(jp, send(ami, "ami", 1), "jp", D(2));
  assert.throws(() => mergeMirror(jp, send(jp, "jp", 2), "jp", D(3)), /votre propre miroir/); assert.throws(() => mergeMirror(jp, project(), "jp", D(3)), /ne dit pas à qui il est/);
  const other = project(); joinTeam(other, { handle: "zed" }, D(0)); assert.throws(() => mergeMirror(jp, send(other, "zed", 1), "jp", D(3)), /autre équipe/);
  assert.equal(cleanHandle("Jean-Philippe D."), "jean-philipped."); assert.throws(() => joinTeam(jp, { handle: "x" }), /2 à 24 caractères/); assert.throws(() => joinTeam(jp, { handle: "ami", hash: "h-other" }), /déjà pris/);
  assert.equal(joinTeam(jp, { handle: "jp", hash: "h-jp", mirror: "file-jp-2" }).mirror, "file-jp-2", "a member updates their own entry"); assert.equal(jp.team.members.length, 2);
  /* a review made on one side is known on the other : the latest word stands */
  approve(ami, "part:CAPOT", { date: D(4) }); mergeMirror(jp, send(ami, "ami", 5), "jp", D(6)); assert.equal(jp.review.items["part:CAPOT"].state, "ok");
  const back = fromDwiz(toDwiz(jp)); assert.deepEqual(back.team, jp.team); assert.deepEqual(back.talk, jp.talk);
  assert.equal(teamOf({}).members.length, 0); assert.equal(isShared(project()), false);
});
