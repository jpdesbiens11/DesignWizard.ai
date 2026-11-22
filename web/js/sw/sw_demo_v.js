/* DynamiteOrbit — Logiciel : the REQUIREMENTS and the TESTS of the example (cycle en V). Each is an EXAMPLE proposed by the tool (sure :
   false) — written so that a young engineer sees what a requirement and its test look like, to be read again and confirmed by the project.
   The tests run on the model of the example (sw/sw_design.js demoDesign) and pass ; tests/node/sw_v.test.mjs keeps them so. Pure data. */

const BENCH = { adc_cell: { points: [[0, 2420]] }, req: { points: [[0, 0]] }, k_fb: { follows: "k_drv", delay: 20 }, adc_i: { points: [[0, 2047]] }, adc_v: { points: [[0, 1986]] } };
const bench = (over) => ({ ...JSON.parse(JSON.stringify(BENCH)), ...over });
export const DEMO_REQS = [
  { id: "SWR-001", kind: "safety", verify: "test", objs: ["adc_cell", "cell_v", "ov", "latch", "k_pos", "k_drv"], text: "Le logiciel doit ouvrir le contactor K+ au plus 200 ms après que la tension d'une cellule a dépassé 4 250 mV." },
  { id: "SWR-002", kind: "functional", verify: "test", objs: ["req", "k_pos", "k_drv"], text: "Le logiciel doit fermer le contactor K+ sur une demande de fermeture quand aucun défaut n'est retenu." },
  { id: "SWR-003", kind: "safety", verify: "test", objs: ["k_fb", "k_pos", "latch"], text: "Le logiciel doit retenir un défaut quand le contact auxiliaire de K+ ne suit pas la commande pendant 50 ms." },
  { id: "SWR-004", kind: "functional", verify: "test", objs: ["adc_i", "i_pack", "adc_v", "v_pack", "efc"], text: "Le logiciel doit compter en mWh l'énergie qui sort du pack et celle qui y entre, à partir du courant et de la tension du pack." },
  { id: "SWR-005", kind: "robustness", verify: "test", objs: ["cell_v", "i_pack", "v_pack"], text: "Le logiciel doit déclarer non valide une mesure qui sort de sa plage vraisemblable." },
  { id: "SWR-006", kind: "performance", verify: "analysis", objs: [], text: "Le logiciel doit exécuter son pas toutes les 10 ms." },
].map((r) => ({ ...r, on: true, sure: false }));
export const DEMO_TESTS = [
  { id: "TC-001", name: "Surtension d'une cellule", reqs: ["SWR-001"], steps: 120, pins: bench({ adc_cell: { points: [[0, 2420], [500, 2680]] }, req: { points: [[0, 0], [50, 1]] } }),
    expect: [{ ref: "k_drv.level", at: 400, op: "==", value: 1 }, { ref: "k_drv.level", becomes: 0, within: [500, 700] }] },
  { id: "TC-002", name: "Fermeture sur demande", reqs: ["SWR-002"], steps: 40, pins: bench({ req: { points: [[0, 0], [50, 1]] } }),
    expect: [{ ref: "k_drv.level", at: 30, op: "==", value: 0 }, { ref: "k_drv.level", becomes: 1, within: [50, 100] }, { ref: "k_pos.fault", at: 390, op: "==", value: 0 }] },
  { id: "TC-003", name: "Contact auxiliaire soudé", reqs: ["SWR-003"], steps: 30, pins: bench({ k_fb: { points: [[0, 1]] } }),
    expect: [{ ref: "k_pos.fault", becomes: 1, within: [0, 100] }, { ref: "latch.fault", at: 200, op: "==", value: 1 }] },
  { id: "TC-004", name: "Énergie comptée en décharge", reqs: ["SWR-004"], steps: 120, pins: bench({ adc_i: { points: [[0, 2358]] } }),
    expect: [{ ref: "efc.e_out", at: 1190, op: ">=", value: 1 }, { ref: "efc.e_in", at: 1190, op: "==", value: 0 }] },
  { id: "TC-005", name: "Fil de mesure coupé", reqs: ["SWR-005"], steps: 20, pins: bench({ adc_cell: { points: [[0, 0]] } }),
    expect: [{ ref: "cell_v.valid", at: 100, op: "==", value: 0 }, { ref: "cell_v.valid", at: 190, op: "==", value: 0 }] },
].map((t) => ({ ...t, on: true, sure: false }));
