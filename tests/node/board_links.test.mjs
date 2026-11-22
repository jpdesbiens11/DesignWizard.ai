// A board and its PCBA, attached : the steps down, the twin that follows its board, the names of the trade.
//   node --test tests/node/board_links.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stairOf, downOf } from "../../web/js/core/stairs.js";
import { syncTwins, boardOfPart, twinBlocks } from "../../web/js/pcba/twin.js";
import { LIBRARY } from "../../web/js/pcba/library.js";
import { demoBoard } from "../../web/js/demo/demo_pcba.js";
import { BOARD_NAME_SETS, tidyBoardNames, nameBoards, nameBoardsDeep, goodBoardWord, getBoardNames } from "../../web/js/core/board_names.js";
import { METHODS } from "../../web/js/core/methods.js";

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const pcb = (id) => ({ dw: "part/1", id, name: `Carte ${id}`, family: "pcb", process: "pcb", material: "FR4", params: {}, interfaces: [], pcb: { size: [60, 40], t: 1.6, components: [], zones: [], nets: {} }, features: [] });
const project = () => { const b = { ...demoBoard(false), id: "B1", name: "Carte de contrôle" }; delete b.part; return { id: "p", name: "P", parts: [{ dw: "part/1", id: "BRKT", name: "Support", process: "cnc_milling", features: [] }], assemblies: [{ id: "TOP", name: "Ensemble", instances: [{ id: "i1", part: "BRKT" }, { id: "i2", asm: "SUB" }] }, { id: "SUB", name: "Sous-ensemble", instances: [] }], boards: [b] }; };

test("the twin follows its board : made at the first placed component, updated when the board changes, left alone otherwise", () => {
  const p = project(), b = p.boards[0];
  assert.ok(b.parts.some((x) => x.at), "the demonstration board has placed components");
  const made = syncTwins(p, LIBRARY); assert.deepEqual(made, [{ board: "B1", part: "B1-PCB", made: true }]);
  const twin = p.parts.find((x) => x.id === "B1-PCB"); assert.equal(b.part, "B1-PCB"); assert.equal(twin.family, "pcb"); assert.equal(twin.pcb.components.length, twinBlocks(b, LIBRARY).components.length); assert.ok(twin.pcb.components.length > 40);
  assert.deepEqual(syncTwins(p, LIBRARY), [], "nothing changed : nothing is written");
  const q = b.parts.find((x) => x.at && twin.pcb.components.some((c) => c.ref === x.ref)); q.at = [q.at[0] + 5, q.at[1]];
  assert.deepEqual(syncTwins(p, LIBRARY, "B1"), [{ board: "B1", part: "B1-PCB", made: false }]); assert.equal(p.parts.find((x) => x.id === "B1-PCB").pcb.components.find((c) => c.ref === q.ref).at[0], Math.round(q.at[0] * 100) / 100);
  assert.deepEqual(syncTwins(p, LIBRARY, "OTHER"), [], "only the board that changed is looked at");
  // the part keeps what is its own : outline, zones, interfaces
  twin.pcb.zones = [{ side: "top", rect: [0, 0, 5, 5] }]; twin.interfaces = [{ id: "IF1", type: "bolt_pattern" }]; q.at = [q.at[0] + 1, q.at[1]]; syncTwins(p, LIBRARY);
  assert.equal(p.parts.find((x) => x.id === "B1-PCB").pcb.zones.length, 1); assert.equal(p.parts.find((x) => x.id === "B1-PCB").interfaces.length, 1);
  // a board with nothing placed gets no twin ; a board tied by hand to another kind of part is left alone ; a taken id is not reused
  const empty = { id: "p2", parts: [pcb("B2-PCB")], boards: [{ id: "B2", name: "Vide", parts: [], nets: [], board: { size: [30, 20] } }, { ...b, id: "B3", part: "BRKT" }, { ...b, id: "B2", part: undefined, parts: b.parts }] };
  empty.parts.push({ id: "BRKT", process: "cnc_milling" }); empty.boards[2] = { ...b, id: "B4", part: null }; empty.boards.push({ ...b, id: "B2x", part: null }); empty.boards[3].id = "B2";
  const r = syncTwins(empty, LIBRARY); assert.ok(!r.some((x) => x.board === "B3"), "tied to a part that is not a board : untouched");
  assert.ok(r.some((x) => x.board === "B2" && x.part === "B2-PCB-2"), `the id of an existing part is not taken (${JSON.stringify(r)})`);
  assert.equal(boardOfPart(p, "B1-PCB").id, "B1"); assert.equal(boardOfPart(p, "BRKT"), null);
  assert.match(read("web/js/main.js"), /store\.hooks\.push\(\(p, extra\) => \{ if \(extra && extra\.board\) syncTwins\(p, LIBRARY, extra\.board\); \}\)/);
});

test("steps down : the exact reverse of the step up — a board to its PCBA, a PCBA to its Labo, a part to its drawing and its simulation", () => {
  const p = project(); syncTwins(p, LIBRARY);
  const board = downOf("pcb", ["B1-PCB"], p); assert.equal(board[0].hash, "#/pcba/B1"); assert.equal(board[0].icon, "chip"); assert.match(board[0].tip, /Descendre d'un niveau : le PCBA monté sur cette carte/);
  assert.deepEqual(board.slice(1).map((d) => d.hash), ["#/drawings/B1-PCB", "#/fea/B1-PCB"]);
  assert.deepEqual(downOf("pcba", ["B1"], p).map((d) => d.hash), ["#/elab/B1", "#/creepage/board/B1", "#/swreq"], "the Labo of the board, its isolation alone, and the software that runs on its CPU"); assert.equal(stairOf("swreq", [], p).hash, "#/pcba/B1", "the step up of the software leads back to that board");
  assert.deepEqual(downOf("parts", ["BRKT"], p).map((d) => d.hash), ["#/drawings/BRKT", "#/assembly/TOP", "#/fea/BRKT", "#/fab/BRKT"], "its drawing, the assembly it goes into (JP, 22 novembre), its simulation, its routing played in the fabrication shop");
  assert.deepEqual(downOf("assembly", ["TOP"], p).map((d) => d.hash), ["#/assembly/SUB", "#/creepage/TOP", "#/drawings/asm/TOP"]);
  assert.deepEqual(downOf("help", [], p), []); assert.deepEqual(downOf("pcba", [], null), []); assert.ok(downOf("assembly", ["TOP"], p).length <= 4);
  // up and down answer each other
  assert.equal(stairOf("pcba", ["B1"], p).hash, "#/pcb/B1-PCB"); assert.equal(stairOf("elab", ["B1"], p).hash, "#/pcba/B1");
  assert.equal(stairOf("fea", ["BRKT"], p).hash, "#/parts/BRKT"); assert.equal(stairOf("assembly", ["SUB"], p).hash, "#/assembly/TOP");
  // an assembly holds many parts : its step up does not lead back to one
  for (const [key, args] of [["pcb", ["B1-PCB"]], ["pcba", ["B1"]], ["parts", ["BRKT"]]]) for (const d of downOf(key, args, p).filter((x) => !x.hash.startsWith("#/assembly/"))) { const [k, ...a] = d.hash.replace(/^#\//, "").split("/"), up = stairOf(k, a, p); assert.ok(up && up.hash === `#/${key}/${args[0]}`, `${d.hash} leads back up to #/${key}/${args[0]} (${up && up.hash})`); }
  const ui = read("web/js/core/stairs_ui.js"); assert.match(ui, /stair-downs/); assert.match(ui, /e\.key !== "ArrowDown"/); assert.match(ui, /\.stair-btn:not\(\.down\)/, "the cleanup of the step up leaves the steps down alone");
  assert.match(read("web/css/nav.css"), /\.stair-btn\.down::after \{ content: "↓"/); assert.match(read("web/js/modules/pcb.js"), /data-twin-of/);
});

test("the names of the trade : one function maps every text, never an identifier, a file name or a blob", () => {
  assert.deepEqual(Object.keys(BOARD_NAME_SETS), ["pcb", "cca", "pwa", "own"]); assert.equal(getBoardNames().plain, true, "without a browser : PCB · PCBA");
  const cca = tidyBoardNames({ set: "cca" }); assert.deepEqual([cca.bare, cca.assy, cca.plain], ["PWB", "CCA", false]);
  assert.equal(nameBoards("Le PCBA est monté sur son PCB.", cca), "Le CCA est monté sur son PWB.");
  assert.equal(nameBoards("DRV-CTRL-PCBA · carte_PCB.step · PCB-01 · xPCB", cca), "DRV-CTRL-PCBA · carte_PCB.step · PCB-01 · xPCB", "identifiers and file names are data");
  assert.equal(nameBoards("(PCB), « PCBA » ; PCB/PCBA", cca), "(PWB), « CCA » ; PWB/CCA");
  assert.equal(nameBoards("data:image/png;base64,AAAA+PCB/AAAA", cca), "data:image/png;base64,AAAA+PCB/AAAA"); assert.equal(nameBoards("A".repeat(600) + "+PCB/", cca), "A".repeat(600) + "+PCB/");
  assert.equal(nameBoards("Le PCBA", tidyBoardNames({ set: "pcb" })), "Le PCBA"); assert.equal(nameBoards(42, cca), 42);
  const own = tidyBoardNames({ set: "own", bare: " ECB ", assy: "ECBA" }); assert.deepEqual([own.bare, own.assy, own.plain], ["ECB", "ECBA", false]); assert.equal(nameBoards("PCB et PCBA", own), "ECB et ECBA");
  assert.equal(tidyBoardNames({ set: "own", bare: "<b>", assy: "PCB assemblée" }).plain, true, "a word that is not plain, or that would be mapped again, is refused : the default stays");
  assert.ok(goodBoardWord("Carte nue", "PCB") && goodBoardWord("PCB", "PCB") && !goodBoardWord("PCB nu", "PCB") && !goodBoardWord("", "PCB") && !goodBoardWord("x".repeat(30), "PCB"));
  assert.equal(tidyBoardNames({ set: "nope" }).set, "pcb");
  // a document model : texts mapped, bytes and numbers kept
  const bytes = new Uint8Array([1, 2]), doc = nameBoardsDeep({ title: "Revue du PCBA", blocks: [{ type: "p", text: "Le PCB." }, { type: "image", data: bytes, w: 10 }] }, cca);
  assert.equal(doc.title, "Revue du CCA"); assert.equal(doc.blocks[0].text, "Le PWB."); assert.equal(doc.blocks[1].data, bytes); assert.equal(doc.blocks[1].w, 10);
  assert.match(read("web/js/core/pdfdoc.js"), /nameBoardsDeep\(model\)/); assert.match(read("web/js/core/docx.js"), /nameBoardsDeep\(model\)/);
  const ui = read("web/js/core/board_names_ui.js"); assert.match(ui, /MutationObserver/); assert.match(ui, /textarea, input, pre, code/); assert.match(read("web/js/core/app.js"), /installBoardNames\(\)/); assert.match(read("web/js/core/app.js"), /boardNamePicker\(\{ keep: true \}\)/);
  const m = METHODS.find((x) => x.id === "board-names"); assert.ok(m && m.how === "excerpt" && /IPC-T-50 n'a pas été lue/.test(m.check) && /ECB/.test(m.check), "the register says what was read of the names, and what was not");
});
