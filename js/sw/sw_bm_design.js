/* DynamiteOrbit.ai — the software of the central BMS of the module BM 8s8p (architecture de JP, 21 novembre 2026 : « le BMS central juge et
   agit — contactors, état envoyé au véhicule : normal, dératé, urgence, arrêt (contactors ouverts) »). Drawn as objects one links, like any design
   of the Logiciel group ; its heart is a « Module state machine ». The thresholds are examples, to confirm — the derating current is the one the
   closed module carries for ever (95 A, demo/demo_bm_heat.js).
   THE TWO KINDS OF BOARDS (JP, 27 novembre 2026 : « 2 pcb types that speak to each other when powered with 12 V… the main might not send anything
   to the core pcb, just use monitoring to manage the BM overall states and functions… use the core pcb to feed all other functions using sensors
   from core + sensors from the main » ; choix par menu : un tour fixe — CORE 1 ouvre, chacun parle après le précédent ; chaque CORE équilibre
   seule au seuil ; sans 12 V, le principal veille sur le module) : the eight CORE boards SPEAK, the central board LISTENS — its transceiver held
   in receive (RS485_DE low, U11.PB1) ; it sends them nothing. What their round brings — the highest and the lowest CORE, the hottest probe, which
   one bleeds, the silence of the round — stands here as inputs of the bench, until the objects of the link exist ; what the central board reads
   itself has its pin. The balancing is each CORE board's own : the module on the bench runs its rule (plant.balance, sw/sw_balance.js). Without
   the 12 V the CORE boards do not speak — the isolated supply of their bus side takes the 12 V — : the central board watches the module with its
   own sensors, and a silent round is not an emergency then. */

import { missionProfiles } from "./sw_pack.js";
import { CORE_BALANCE } from "./sw_balance.js";

const OBJ = (id, kind, name, x, y, params = {}) => ({ id, kind, name, x, y, params, sure: [] });
/* a value the bench stands in for : what the CORE boards SAY in their round on the RS-485, not a pin of the central board */
const CHAIN = "dite par les 8 CORE boards dans leur slot du round-robin RS-485 (CORE-1S8P-PCBA : cell block voltage, 8 NTC, balancing) — CORE 1 ouvre le cycle, chaque CORE transmet après la précédente ; le BMS central écoute, il ne leur transmet rien ; sans 12 V, elles sont silent";
const BENCH = (o, why = CHAIN) => ({ ...o, bench: why });
/* a pin the central board has (demo/demo_bms3.js, the 3 in × 3 in board : U11 is its microcontroller) — JP, 27 novembre 2026 : « aligner le logiciel avec
   les 2 types de cartes, CORE × 8 + main » : AIN0 the module, AIN1 the shunt, AIN2 the output, AIN3 the NTC of the output terminal ; DIN1 the auxiliary
   contact, DIN2 ENABLE, DIN3 the presence, DIN4 the acknowledgement, DIN0 the 12 V (WAKE) ; DOUT0 the contactor, DOUT3 the pump, DOUT4 the fan, DOUT5
   the buzzer ; three LEDs. What a CORE board measures comes by its round (BENCH) ; the precharge and the pyrofuse are on the board, their blocks
   still to come. */
const HW = (o, net, pin) => ({ ...o, hw: { board: "BMS-CENTRAL-3X3", net, pin } });
const W = (pairs) => pairs.map(([from, to, delay]) => ({ from, to, ...(delay ? { delay: true } : {}) }));
/** counts of a 12-bit converter under 3.3 V for a voltage at its pin, in mV */
const counts = (mv) => Math.round((mv * 4095) / 3300);
/** the counts of the current sensor for a current in A : 1650 mV at 0 A, 400 A per volt (example) */
const amps = (a) => counts((a * 1000 + 660000) / 400);

/** The software of the module, new each time. */
export function moduleDesign(cpu = "tms570ls1224_pge") {
  const d = { id: "BM-SW", name: "Logiciel du BMS central — module BM 8s8p", cpu, period: 10, board: "BMS-CENTRAL-3X3",      // it runs on the 3 in × 3 in board (sw/sw_blocks.js hostBoard)
    objects: [
      BENCH(OBJ("adc_v", "pin_adc", "Banc : la plus haute tension de CORE (relue de la chaîne)", 20, 20, { channel: 0 })), OBJ("v_max", "analog_in", "Highest CORE voltage", 230, 10, { unit: "mV", num: 2, den: 1, lo: 2500, hi: 4500, n: 4 }),
      OBJ("hvw", "limit", "High voltage — watch", 470, -60, { unit: "mV", above: 1, trip: 4180, clear: 4120, delay: 200 }),
      OBJ("ov", "limit", "Over-voltage", 470, 20, { unit: "mV", above: 1, trip: 4250, clear: 4150, delay: 100 }),
      BENCH(OBJ("adc_vmin", "pin_adc", "Banc : la plus basse tension de CORE (relue de la chaîne)", 20, -150, { channel: 3 })), OBJ("v_min", "analog_in", "Lowest CORE voltage", 230, -160, { unit: "mV", num: 2, den: 1, lo: 2500, hi: 4500, n: 4 }),
      OBJ("lvw", "limit", "Low voltage — watch", 470, -220, { unit: "mV", above: 0, trip: 3100, clear: 3200, delay: 500 }),
      OBJ("uv", "limit", "Under-voltage", 470, -140, { unit: "mV", above: 0, trip: 2800, clear: 3000, delay: 200 }),
      BENCH(OBJ("adc_t", "pin_adc", "Banc : la plus haute température (relue de la chaîne)", 20, 170, { channel: 1 })), OBJ("t_max", "analog_in", "Highest temperature", 230, 160, { unit: "0.1 °C", num: 1, den: 1, lo: 0, hi: 1500, n: 4 }),
      OBJ("hot", "limit", "Hot — derate", 470, 140, { unit: "0.1 °C", above: 1, trip: 600, clear: 550, delay: 1000 }), OBJ("ot", "limit", "Over-temperature", 470, 250, { unit: "0.1 °C", above: 1, trip: 750, clear: 700, delay: 500 }),
      OBJ("cool", "limit", "Cooling on — 45 °C", 470, 320, { unit: "0.1 °C", above: 1, trip: 450, clear: 380, delay: 500 }),
      HW(OBJ("adc_i", "pin_adc", "Voie : courant du module (capteur de la barre de retour)", 20, 380, { channel: 2 }), "AIN1", "U11.PA1"), OBJ("i_mod", "analog_in", "Module current", 230, 370, { unit: "mA", num: 400, den: 1, offset: -660000, lo: -500000, hi: 500000, n: 2 }),
      OBJ("over_i", "limit", "Above the sustained current — derate", 470, 380, { unit: "mA", above: 1, trip: 95000, clear: 90000, delay: 2000 }),
      OBJ("over_ic", "limit", "Charge current too high — derate", 470, 440, { unit: "mA", above: 0, trip: -95000, clear: -90000, delay: 2000 }),
      OBJ("i_watch", "logic", "Current to watch (discharge or charge)", 700, 400, { op: "OR" }),
      BENCH(OBJ("lost", "pin_din", "Banc : round-robin des CORE silent (timeout)", 470, 500, { pin: 5 }), "dit par la liaison RS-485 elle-même : timeout du round-robin ouvert par CORE 1"),
      HW(OBJ("ack", "pin_din", "Entrée : acquitter le défaut (véhicule ou service)", 470, 600, { pin: 6 }), "DIN4", "U11.PB13"),
      OBJ("v_fault", "logic", "Voltage fault (over or under)", 700, -60, { op: "OR" }), OBJ("v_watch", "logic", "Voltage to watch (high or low)", 700, -200, { op: "OR" }),
      OBJ("watch", "logic", "To watch : voltage or temperature", 900, -100, { op: "OR" }),
      OBJ("latch", "fault_latch", "Fault latch", 700, 60), OBJ("module", "module_state", "Module state", 900, 260, { t_lost: 500, t_emerg: 1000 }),
      OBJ("k", "contactor", "Contactor", 1130, 260, { t_fb: 50 }), HW(OBJ("k_fb", "pin_din", "Entrée : contact auxiliaire", 900, 450, { pin: 3 }), "DIN1", "U11.PC14"), HW(OBJ("k_drv", "pin_dout", "Sortie : bobine du contacteur", 1360, 270, { pin: 2 }), "DOUT0", "U11.PB3"),
      OBJ("lamp", "state_lamp", "General state lamp", 1130, 40),
      /* the balancing is each CORE board's (JP, 27 novembre 2026) : the central board only hears it, in their round, and passes it to the vehicle */
      { ...BENCH(OBJ("bal_in", "pin_din", "Banc : une CORE signale balancing actif (dans sa frame)", 1130, 640, { pin: 4 })), vehicle: "CAN FD", device: "balancing" },
      { ...HW(OBJ("led_g", "pin_dout", "LED verte — état bon", 1360, -60, { pin: 7 }), "LED_STATUS", "U11.PA15"), device: "led" }, { ...HW(OBJ("led_y", "pin_dout", "LED jaune — à surveiller", 1360, 20, { pin: 8 }), "LED_WARN", "U11.PB10"), device: "led" },
      { ...HW(OBJ("led_r", "pin_dout", "LED rouge — limite dépassée", 1360, 100, { pin: 9 }), "LED_FAULT", "U11.PB11"), device: "led" }, { ...HW(OBJ("buzz", "pin_dout", "Buzzer — alarme", 1360, 180, { pin: 10 }), "DOUT5", "U11.PB15"), device: "buzzer" },
      { ...HW(OBJ("pump", "pin_dout", "Pompe de refroidissement (WEG)", 1360, 360, { pin: 11 }), "DOUT3", "U11.PB2"), device: "pump" },
      /* JP, 27 novembre 2026 : « aligner le logiciel avec les 2 types de cartes, CORE × 8 + main… measure current, voltage, temperature at output,
         vehicle command, EFC, actuators (pump, fan) » — what the central board reads and drives besides the chain of the CORE boards */
      HW(OBJ("adc_vm", "pin_adc", "Voie : tension du module (prise B+)", 20, 720, { channel: 4 }), "AIN0", "U11.PA0"), OBJ("v_mod", "analog_in", "Module voltage", 230, 710, { unit: "mV", num: 147, den: 10, lo: 0, hi: 40000, n: 4 }),
      { ...OBJ("efc", "energy_counter", "Energy flow counter (EFC) → véhicule", 470, 720), vehicle: "CAN FD" },      // what it counts goes to the vehicle by the CAN FD : the block that writes the frame is still to come
      HW(OBJ("adc_vo", "pin_adc", "Voie : tension de sortie, après le contacteur", 20, 810, { channel: 5 }), "AIN2", "U11.PA2"), { ...OBJ("v_out", "analog_in", "Output voltage → véhicule", 230, 800, { unit: "mV", num: 147, den: 10, lo: 0, hi: 40000, n: 4 }), vehicle: "CAN FD" },      // with the precharge (to come) it is compared to the module
      HW(OBJ("adc_to", "pin_adc", "Voie : température de la borne de sortie (CTN)", 20, 900, { channel: 6 }), "AIN3", "U11.PA3"), OBJ("t_out", "analog_in", "Output terminal temperature", 230, 890, { unit: "0.1 °C", num: 1, den: 1, lo: 0, hi: 1500, n: 4 }),
      OBJ("tout_hot", "limit", "Output terminal hot — derate", 470, 900, { unit: "0.1 °C", above: 1, trip: 900, clear: 850, delay: 1000 }),
      OBJ("warn_all", "logic", "To watch : cells or output terminal", 1000, -100, { op: "OR" }),
      { ...HW(OBJ("fan", "pin_dout", "Ventilateur du radiateur", 1360, 440, { pin: 12 }), "DOUT4", "U11.PB14"), device: "fan" },
      HW(OBJ("veh_en", "pin_din", "Entrée : le véhicule autorise l'énergie (ENABLE)", 700, 540, { pin: 13 }), "DIN2", "U11.PC15"), HW(OBJ("pres", "pin_din", "Entrée : le module est dans sa cavité (présence)", 700, 600, { pin: 14 }), "DIN3", "U11.PB12"),
      /* without the 12 V the central board lives on the module and keeps watching it ; the contactor, whose coil is on the 12 V, stays open (JP, par menu) */
      HW(OBJ("wake", "pin_din", "Entrée : 12 V présent — véhicule ou charging station (WAKE)", 470, 560, { pin: 15 }), "DIN0", "U11.PC13"),
      OBJ("live", "logic", "12 V present and vehicle allows", 700, 480, { op: "AND" }),
      /* without the 12 V the CORE boards do not speak (JP, par menu : their bus side lives on the 12 V) : a silent round is an emergency only with it */
      OBJ("silent", "logic", "Round of the CORE silent, 12 V present", 700, 420, { op: "AND" }),
      OBJ("allow", "logic", "Vehicle allows and module present", 900, 560, { op: "AND" }), OBJ("req", "logic", "Close only when allowed", 1050, 330, { op: "AND" })],
    wires: W([["adc_v.counts", "v_max.counts"], ["v_max.value", "ov.value"], ["v_max.value", "hvw.value"], ["adc_vmin.counts", "v_min.counts"], ["v_min.value", "uv.value"], ["v_min.value", "lvw.value"],
      ["adc_t.counts", "t_max.counts"], ["t_max.value", "hot.value"], ["t_max.value", "ot.value"], ["t_max.value", "cool.value"], ["cool.trip", "pump.level"], ["cool.trip", "fan.level"], ["adc_vm.counts", "v_mod.counts"], ["v_mod.value", "efc.v"], ["i_mod.value", "efc.i"], ["adc_vo.counts", "v_out.counts"], ["adc_to.counts", "t_out.counts"], ["t_out.value", "tout_hot.value"],
      ["adc_i.counts", "i_mod.counts"], ["i_mod.value", "over_i.value"], ["i_mod.value", "over_ic.value"], ["over_i.trip", "i_watch.a"], ["over_ic.trip", "i_watch.b"], ["ov.trip", "v_fault.a"], ["uv.trip", "v_fault.b"], ["v_fault.y", "latch.a"], ["ot.trip", "latch.b"], ["k.fault", "latch.c", 1],
      ["hvw.trip", "v_watch.a"], ["lvw.trip", "v_watch.b"], ["v_watch.y", "watch.a"], ["hot.trip", "watch.b"],
      ["latch.fault", "module.fault"], ["lost.level", "silent.a"], ["wake.level", "silent.b"], ["silent.y", "module.lost"], ["watch.y", "warn_all.a"], ["tout_hot.trip", "warn_all.b"], ["warn_all.y", "module.warn_a"], ["i_watch.y", "module.warn_b"], ["ack.level", "latch.reset"], ["ack.level", "module.reset"],
      ["module.close", "req.a"], ["wake.level", "live.a"], ["veh_en.level", "live.b"], ["live.y", "allow.a"], ["pres.level", "allow.b"], ["allow.y", "req.b"], ["req.y", "k.request"], ["latch.fault", "k.inhibit"], ["k_fb.level", "k.feedback"], ["k.drive", "k_drv.level"],
      ["module.state", "lamp.state"], ["lamp.green", "led_g.level"], ["lamp.yellow", "led_y.level"], ["lamp.red", "led_r.level"], ["lamp.red", "buzz.level"]]),
    /* the bench : 50 A, then 150 A for 3.5 s (derated after 2 s), 50 A again ; at 5 s the chain falls silent : emergency after 0.5 s, stop after 1 s more */
    scenario: { steps: 800, pins: { adc_v: { points: [[0, counts(1950)]] }, adc_vmin: { points: [[0, counts(1825)]] }, adc_t: { points: [[0, counts(250)]] },
      adc_i: { points: [[0, amps(50)], [500, amps(150)], [4000, amps(50)]] }, lost: { points: [[0, 0], [5000, 1]] }, ack: { points: [[0, 0]] }, wake: { points: [[0, 1]] }, veh_en: { points: [[0, 1]] }, pres: { points: [[0, 1]] }, adc_to: { points: [[0, counts(250)]] }, k_fb: { follows: "k_drv", delay: 20 } } },
    profiles: [], monitor: { title: "Monitoring du BM-SWAP" },
    /* the module on the bench (sw/sw_pack.js) : the pins it drives, the outputs it obeys — and the charge and the discharge written from the thresholds */
    plant: { vmax: "adc_v", vmin: "adc_vmin", temp: "adc_t", current: "adc_i", vmod: "adc_vm", vout: "adc_vo", bleed: "bal_in", contactor: "k_drv.level", state: "module.state", pump: "pump.level", lost: "lost", ack: "ack", wake: "wake",
      balance: CORE_BALANCE },
    reqs: [], tests: [] };
  d.profiles = missionProfiles(d);
  return d;
}
