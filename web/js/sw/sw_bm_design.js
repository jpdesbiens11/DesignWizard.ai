/* DynamiteOrbit — the software of the central BMS of the module BM 8s8p (architecture de JP, 21 novembre 2026 : « le BMS central interroge
   les cartes, juge et agit — contactors, état envoyé au véhicule : normal, dératé, urgence, arrêt (contactors ouverts) »). Drawn as objects one
   links, like any design of the Logiciel group ; its heart is a « Module state machine ». The thresholds are examples, to confirm — the derating
   current is the one the closed module carries for ever (95 A, demo/demo_bm_heat.js). What arrives from the chain of CORE boards — the highest
   cell voltage, the highest temperature, the silence of the chain — stands here as inputs of the bench, until the objects of the link exist. */

const OBJ = (id, kind, name, x, y, params = {}) => ({ id, kind, name, x, y, params, sure: [] });
const W = (pairs) => pairs.map(([from, to, delay]) => ({ from, to, ...(delay ? { delay: true } : {}) }));
/** counts of a 12-bit converter under 3.3 V for a voltage at its pin, in mV */
const counts = (mv) => Math.round((mv * 4095) / 3300);
/** the counts of the current sensor for a current in A : 1650 mV at 0 A, 400 A per volt (example) */
const amps = (a) => counts((a * 1000 + 660000) / 400);

/** The software of the module, new each time. */
export function moduleDesign(cpu = "tms570ls1224_pge") {
  return { id: "BM-SW", name: "Logiciel du BMS central — module BM 8s8p", cpu, period: 10,
    objects: [
      OBJ("adc_v", "pin_adc", "Banc : la plus haute tension de CORE (relue de la chaîne)", 20, 20, { channel: 0 }), OBJ("v_max", "analog_in", "Highest CORE voltage", 230, 10, { unit: "mV", num: 2, den: 1, lo: 2500, hi: 4500, n: 4 }),
      OBJ("ov", "limit", "Over-voltage", 470, 20, { unit: "mV", above: 1, trip: 4250, clear: 4150, delay: 100 }),
      OBJ("adc_t", "pin_adc", "Banc : la plus haute température (relue de la chaîne)", 20, 170, { channel: 1 }), OBJ("t_max", "analog_in", "Highest temperature", 230, 160, { unit: "0.1 °C", num: 1, den: 1, lo: 0, hi: 1500, n: 4 }),
      OBJ("hot", "limit", "Hot — derate", 470, 140, { unit: "0.1 °C", above: 1, trip: 600, clear: 550, delay: 1000 }), OBJ("ot", "limit", "Over-temperature", 470, 250, { unit: "0.1 °C", above: 1, trip: 750, clear: 700, delay: 500 }),
      OBJ("adc_i", "pin_adc", "Voie : courant du module (capteur de la barre de retour)", 20, 380, { channel: 2 }), OBJ("i_mod", "analog_in", "Module current", 230, 370, { unit: "mA", num: 400, den: 1, offset: -660000, lo: -500000, hi: 500000, n: 2 }),
      OBJ("over_i", "limit", "Above the sustained current — derate", 470, 380, { unit: "mA", above: 1, trip: 95000, clear: 90000, delay: 2000 }),
      OBJ("lost", "pin_din", "Banc : la chaîne des cartes se tait", 470, 500, { pin: 5 }),
      OBJ("latch", "fault_latch", "Fault latch", 700, 60), OBJ("module", "module_state", "Module state", 900, 260, { t_lost: 500, t_emerg: 1000 }),
      OBJ("k", "contactor", "Contactor", 1130, 260, { t_fb: 50 }), OBJ("k_fb", "pin_din", "Entrée : contact auxiliaire", 900, 450, { pin: 3 }), OBJ("k_drv", "pin_dout", "Sortie : bobine du contacteur", 1360, 270, { pin: 2 })],
    wires: W([["adc_v.counts", "v_max.counts"], ["v_max.value", "ov.value"], ["adc_t.counts", "t_max.counts"], ["t_max.value", "hot.value"], ["t_max.value", "ot.value"],
      ["adc_i.counts", "i_mod.counts"], ["i_mod.value", "over_i.value"], ["ov.trip", "latch.a"], ["ot.trip", "latch.b"], ["k.fault", "latch.c", 1],
      ["latch.fault", "module.fault"], ["lost.level", "module.lost"], ["hot.trip", "module.warn_a"], ["over_i.trip", "module.warn_b"],
      ["module.close", "k.request"], ["latch.fault", "k.inhibit"], ["k_fb.level", "k.feedback"], ["k.drive", "k_drv.level"]]),
    /* the bench : 50 A, then 150 A for 3.5 s (derated after 2 s), 50 A again ; at 5 s the chain falls silent : emergency after 0.5 s, stop after 1 s more */
    scenario: { steps: 800, pins: { adc_v: { points: [[0, counts(1950)]] }, adc_t: { points: [[0, counts(250)]] },
      adc_i: { points: [[0, amps(50)], [500, amps(150)], [4000, amps(50)]] }, lost: { points: [[0, 0], [5000, 1]] }, k_fb: { follows: "k_drv", delay: 20 } } },
    reqs: [], tests: [] };
}
