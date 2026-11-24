/* DynamiteOrbit.ai — the software of the central BMS of the module BM 8s8p (architecture de JP, 21 novembre 2026 : « le BMS central interroge
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
      OBJ("hvw", "limit", "High voltage — watch", 470, -60, { unit: "mV", above: 1, trip: 4180, clear: 4120, delay: 200 }),
      OBJ("ov", "limit", "Over-voltage", 470, 20, { unit: "mV", above: 1, trip: 4250, clear: 4150, delay: 100 }),
      OBJ("adc_vmin", "pin_adc", "Banc : la plus basse tension de CORE (relue de la chaîne)", 20, -150, { channel: 3 }), OBJ("v_min", "analog_in", "Lowest CORE voltage", 230, -160, { unit: "mV", num: 2, den: 1, lo: 2500, hi: 4500, n: 4 }),
      OBJ("lvw", "limit", "Low voltage — watch", 470, -220, { unit: "mV", above: 0, trip: 3100, clear: 3200, delay: 500 }),
      OBJ("uv", "limit", "Under-voltage", 470, -140, { unit: "mV", above: 0, trip: 2800, clear: 3000, delay: 200 }),
      OBJ("adc_t", "pin_adc", "Banc : la plus haute température (relue de la chaîne)", 20, 170, { channel: 1 }), OBJ("t_max", "analog_in", "Highest temperature", 230, 160, { unit: "0.1 °C", num: 1, den: 1, lo: 0, hi: 1500, n: 4 }),
      OBJ("hot", "limit", "Hot — derate", 470, 140, { unit: "0.1 °C", above: 1, trip: 600, clear: 550, delay: 1000 }), OBJ("ot", "limit", "Over-temperature", 470, 250, { unit: "0.1 °C", above: 1, trip: 750, clear: 700, delay: 500 }),
      OBJ("cool", "limit", "Cooling on — 45 °C", 470, 320, { unit: "0.1 °C", above: 1, trip: 450, clear: 380, delay: 500 }),
      OBJ("adc_i", "pin_adc", "Voie : courant du module (capteur de la barre de retour)", 20, 380, { channel: 2 }), OBJ("i_mod", "analog_in", "Module current", 230, 370, { unit: "mA", num: 400, den: 1, offset: -660000, lo: -500000, hi: 500000, n: 2 }),
      OBJ("over_i", "limit", "Above the sustained current — derate", 470, 380, { unit: "mA", above: 1, trip: 95000, clear: 90000, delay: 2000 }),
      OBJ("over_ic", "limit", "Charge current too high — derate", 470, 440, { unit: "mA", above: 0, trip: -95000, clear: -90000, delay: 2000 }),
      OBJ("i_watch", "logic", "Current to watch (discharge or charge)", 700, 400, { op: "OR" }),
      OBJ("lost", "pin_din", "Banc : la chaîne des cartes se tait", 470, 500, { pin: 5 }),
      OBJ("ack", "pin_din", "Bouton : acquitter le défaut", 470, 600, { pin: 6 }),
      OBJ("v_fault", "logic", "Voltage fault (over or under)", 700, -60, { op: "OR" }), OBJ("v_watch", "logic", "Voltage to watch (high or low)", 700, -200, { op: "OR" }),
      OBJ("watch", "logic", "To watch : voltage or temperature", 900, -100, { op: "OR" }),
      OBJ("latch", "fault_latch", "Fault latch", 700, 60), OBJ("module", "module_state", "Module state", 900, 260, { t_lost: 500, t_emerg: 1000 }),
      OBJ("k", "contactor", "Contactor", 1130, 260, { t_fb: 50 }), OBJ("k_fb", "pin_din", "Entrée : contact auxiliaire", 900, 450, { pin: 3 }), OBJ("k_drv", "pin_dout", "Sortie : bobine du contacteur", 1360, 270, { pin: 2 }),
      OBJ("lamp", "state_lamp", "General state lamp", 1130, 40),
      { ...OBJ("led_g", "pin_dout", "LED verte — état bon", 1360, -60, { pin: 7 }), device: "led" }, { ...OBJ("led_y", "pin_dout", "LED jaune — à surveiller", 1360, 20, { pin: 8 }), device: "led" },
      { ...OBJ("led_r", "pin_dout", "LED rouge — limite dépassée", 1360, 100, { pin: 9 }), device: "led" }, { ...OBJ("buzz", "pin_dout", "Buzzer — alarme", 1360, 180, { pin: 10 }), device: "buzzer" },
      { ...OBJ("pump", "pin_dout", "Pompe de refroidissement (WEG)", 1360, 360, { pin: 11 }), device: "pump" }],
    wires: W([["adc_v.counts", "v_max.counts"], ["v_max.value", "ov.value"], ["v_max.value", "hvw.value"], ["adc_vmin.counts", "v_min.counts"], ["v_min.value", "uv.value"], ["v_min.value", "lvw.value"],
      ["adc_t.counts", "t_max.counts"], ["t_max.value", "hot.value"], ["t_max.value", "ot.value"], ["t_max.value", "cool.value"], ["cool.trip", "pump.level"],
      ["adc_i.counts", "i_mod.counts"], ["i_mod.value", "over_i.value"], ["i_mod.value", "over_ic.value"], ["over_i.trip", "i_watch.a"], ["over_ic.trip", "i_watch.b"], ["ov.trip", "v_fault.a"], ["uv.trip", "v_fault.b"], ["v_fault.y", "latch.a"], ["ot.trip", "latch.b"], ["k.fault", "latch.c", 1],
      ["hvw.trip", "v_watch.a"], ["lvw.trip", "v_watch.b"], ["v_watch.y", "watch.a"], ["hot.trip", "watch.b"],
      ["latch.fault", "module.fault"], ["lost.level", "module.lost"], ["watch.y", "module.warn_a"], ["i_watch.y", "module.warn_b"], ["ack.level", "latch.reset"], ["ack.level", "module.reset"],
      ["module.close", "k.request"], ["latch.fault", "k.inhibit"], ["k_fb.level", "k.feedback"], ["k.drive", "k_drv.level"],
      ["module.state", "lamp.state"], ["lamp.green", "led_g.level"], ["lamp.yellow", "led_y.level"], ["lamp.red", "led_r.level"], ["lamp.red", "buzz.level"]]),
    /* the bench : 50 A, then 150 A for 3.5 s (derated after 2 s), 50 A again ; at 5 s the chain falls silent : emergency after 0.5 s, stop after 1 s more */
    scenario: { steps: 800, pins: { adc_v: { points: [[0, counts(1950)]] }, adc_vmin: { points: [[0, counts(1825)]] }, adc_t: { points: [[0, counts(250)]] },
      adc_i: { points: [[0, amps(50)], [500, amps(150)], [4000, amps(50)]] }, lost: { points: [[0, 0], [5000, 1]] }, ack: { points: [[0, 0]] }, k_fb: { follows: "k_drv", delay: 20 } } },
    profiles: [CHARGE, DISCHARGE], monitor: { title: "Monitoring du BM-SWAP" },
    reqs: [], tests: [] };
}

/* THE MISSION PROFILES of the module (demande de JP, 24 novembre 2026 : « un profil de charge et un de décharge avec des événements critiques pour
   les deux au fil du profil — comm, voltage, current, temperature — et un bouton pour passer de l'un à l'autre ; typiques d'un produit avec un
   ESS »). Each event says what happens to the module and what it puts on the bench, in the unit of each measure (mV of a CORE, mA, 0.1 °C) ;
   an acknowledgement is a button pressed 0.3 s (`pulse`). In each, a red case opens the contactor and someone acknowledges 2 s later — in a
   real module it would take milliseconds ; 2 s let one see it. The thresholds are examples, to confirm ; the times are shortened. */
const ACK = { ack: 300 };
const CHARGE = { id: "charge", name: "Charge", kind: "charge", events: [
  { t: 0, id: "plug", title: "Le chargeur est branché", says: "Le module est à moitié chargé : CORE entre 3,60 V et 3,70 V, 25 °C. Le chargeur pousse 60 A dans le module (courant négatif : il entre).", set: { adc_v: 3700, adc_vmin: 3600, adc_t: 250, adc_i: -60000 } },
  { t: 2000, id: "cc", title: "Charge à courant constant", says: "Les CORE montent : la plus haute à 3,95 V.", set: { adc_v: 3950, adc_vmin: 3850 } },
  { t: 4000, id: "fast", title: "Courant : charge rapide à 110 A", says: "Une borne rapide pousse 110 A — plus que les 95 A que le module tient en continu : après 2 s, il se dérate et le demande au chargeur.", set: { adc_i: -110000 } },
  { t: 8000, id: "fast-end", title: "Le chargeur revient à 60 A", says: "Le chargeur a lu la demande : 60 A.", set: { adc_i: -60000 } },
  { t: 10000, id: "warm", title: "Température : 50 °C", says: "La charge chauffe les cellules : 50 °C — la pompe eau-glycol démarre dès 45 °C.", set: { adc_t: 500 } },
  { t: 13000, id: "top", title: "Tension : fin de charge à 4,19 V", says: "La CORE la plus haute atteint 4,19 V : au-dessus du seuil à surveiller (4,18 V), sous la limite (4,25 V).", set: { adc_v: 4190, adc_vmin: 4100, adc_i: -20000 } },
  { t: 16000, id: "comm", title: "Comm : la chaîne des cartes se tait", says: "Un connecteur de la chaîne RS-485 décroche : le BMS central n'entend plus les cartes de CORE. Urgence après 0,5 s, arrêt après 1 s de plus.", set: { lost: 1 } },
  { t: 18000, id: "comm-back", title: "Comm : la chaîne répond de nouveau", says: "Le connecteur est remis : les cartes répondent. Le module reste arrêté jusqu'à l'acquittement.", set: { lost: 0 } },
  { t: 19500, id: "ack-comm", title: "Acquittement, 2 s après l'ouverture", says: "On acquitte : le module repart, la charge reprend.", set: {}, pulse: ACK },
  { t: 22000, id: "ov", title: "Cas extrême : surcharge à 4,30 V", says: "Le chargeur ne s'arrête pas : la CORE la plus haute passe 4,25 V — limite dépassée.", set: { adc_v: 4300, adc_i: -60000 } },
  { t: 22500, id: "ov-relax", title: "Contacteur ouvert : la CORE se repose", says: "Plus de courant : la CORE redescend à 4,10 V. Le défaut reste retenu.", set: { adc_v: 4100, adc_i: 0 } },
  { t: 24100, id: "ack-ov", title: "Acquittement, 2 s après l'ouverture", says: "On acquitte : plus aucun défaut.", set: {}, pulse: ACK },
  { t: 26000, id: "ot", title: "Cas extrême : 80 °C pendant la charge", says: "Une cellule chauffe : 80 °C, au-delà de la limite de 75 °C.", set: { adc_t: 800, adc_i: -30000 } },
  { t: 27000, id: "ot-cool", title: "Contacteur ouvert : le module refroidit", says: "Sans courant, la pompe refroidit : 40 °C (accéléré pour la démonstration).", set: { adc_t: 400, adc_i: 0 } },
  { t: 28500, id: "ack-ot", title: "Acquittement, 2 s après l'ouverture", says: "On acquitte : le module repart.", set: {}, pulse: ACK },
  { t: 31000, id: "full", title: "Fin de charge", says: "Le chargeur s'arrête : CORE à 4,15 V, 35 °C. Le module est plein.", set: { adc_v: 4150, adc_vmin: 4120, adc_t: 350, adc_i: 0 } },
  { t: 34000, id: "end", title: "Fin du profil de charge", says: "Rejouez-le, passez au profil de décharge, ou changez un instrument du banc.", set: {} }] };
const DISCHARGE = { id: "discharge", name: "Décharge", kind: "discharge", events: [
  { t: 0, id: "go", title: "Le véhicule démarre", says: "Module chargé : CORE entre 3,95 V et 4,05 V, 25 °C. Le véhicule tire 50 A.", set: { adc_v: 4050, adc_vmin: 3950, adc_t: 250, adc_i: 50000 } },
  { t: 2000, id: "climb", title: "Courant : montée à 150 A", says: "Une côte : le véhicule tire 150 A — plus que les 95 A tenus en continu. Après 2 s, le module se dérate.", set: { adc_i: 150000, adc_vmin: 3800 } },
  { t: 6000, id: "cruise", title: "Courant : retour à 60 A", says: "Sur le plat : 60 A.", set: { adc_i: 60000, adc_vmin: 3850 } },
  { t: 8000, id: "warm", title: "Température : 50 °C", says: "Les cellules chauffent : 50 °C — la pompe eau-glycol démarre.", set: { adc_t: 500 } },
  { t: 10000, id: "hot", title: "Température : 65 °C", says: "Longue côte au soleil : 65 °C, au-dessus de 60 °C — le module se dérate.", set: { adc_t: 650 } },
  { t: 13000, id: "hot-end", title: "Température : retour à 45 °C", says: "La pompe a fait son travail : 45 °C. Le module n'est plus dératé ; la pompe tourne encore.", set: { adc_t: 450 } },
  { t: 15000, id: "low", title: "Tension : batterie presque vide, 3,05 V", says: "La CORE la plus basse tombe à 3,05 V : sous le seuil à surveiller (3,10 V).", set: { adc_vmin: 3050, adc_v: 3200 } },
  { t: 18000, id: "comm", title: "Comm : la chaîne des cartes se tait", says: "La chaîne RS-485 se tait en roulant : urgence après 0,5 s — le véhicule a 1 s pour s'arrêter —, puis arrêt.", set: { lost: 1 } },
  { t: 20000, id: "comm-back", title: "Comm : la chaîne répond de nouveau", says: "Les cartes répondent. Le module reste arrêté jusqu'à l'acquittement.", set: { lost: 0, adc_i: 0 } },
  { t: 21500, id: "ack-comm", title: "Acquittement, 2 s après l'ouverture", says: "On acquitte : le module repart — toujours dératé, la CORE la plus basse est à 3,05 V.", set: {}, pulse: ACK },
  { t: 23000, id: "rest", title: "Au repos : la CORE remonte à 3,40 V", says: "Sans courant, la tension remonte : 3,40 V.", set: { adc_vmin: 3400 } },
  { t: 25000, id: "uv", title: "Cas extrême : décharge profonde à 2,70 V", says: "Le véhicule tire encore 80 A : la CORE la plus basse tombe à 2,70 V, sous la limite de 2,80 V.", set: { adc_vmin: 2700, adc_i: 80000 } },
  { t: 25800, id: "uv-relax", title: "Contacteur ouvert : la CORE remonte", says: "Sans charge, la CORE remonte à 3,25 V.", set: { adc_vmin: 3250, adc_i: 0 } },
  { t: 27200, id: "ack-uv", title: "Acquittement, 2 s après l'ouverture", says: "On acquitte : le module repart — à recharger sans tarder.", set: {}, pulse: ACK },
  { t: 29000, id: "ot", title: "Cas extrême : 80 °C", says: "Un point chaud : 80 °C, au-delà de la limite de 75 °C.", set: { adc_t: 800, adc_i: 40000 } },
  { t: 30000, id: "ot-cool", title: "Contacteur ouvert : le module refroidit", says: "Sans courant, la pompe refroidit : 40 °C (accéléré pour la démonstration).", set: { adc_t: 400, adc_i: 0 } },
  { t: 31500, id: "ack-ot", title: "Acquittement, 2 s après l'ouverture", says: "On acquitte : le module repart.", set: {}, pulse: ACK },
  { t: 34000, id: "end", title: "Fin du profil de décharge", says: "Rejouez-le, passez au profil de charge, ou changez un instrument du banc.", set: {} }] };
