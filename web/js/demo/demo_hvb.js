/* DesignOrbit.ai — DEMO-HVB: the reference product of the Creepage & Clearance training (DynamiteAgile 0.50.9).
   Distances are known by construction, so the geometric engine can be checked against them:
   two HV busbars 6 mm apart with a 10 mm barrier rib, a 0.8 mm slot (narrower than X of PD2), a 3 mm groove,
   an LV sense terminal 8 mm from HV-, an aluminium floor at chassis potential, a PC cover 0.5 mm above the plate. */

const box = (x0, y0, z0, x1, y1, z1, extra = {}) => ({ op: "box", at: [x0, y0, z0], size: [x1 - x0, y1 - y0, z1 - z0], ...extra });

export const DEMO_HVB_PARTS = [
  { dw: "part/1", id: "HVB-FLOOR", name: "Housing floor", family: "plate", process: "cnc_milling", material: "AL6061-T6",
    function: "Plancher du boîtier, au potentiel du Chassis.", elec: { kind: "conductor", net: "Chassis" },
    features: [box(-5, -5, -3, 125, 65, 0)] },
  { dw: "part/1", id: "HVB-BASE", name: "Insulator base", family: "prismatic", process: "injection_molding", material: "PA66-GF30",
    function: "Plaque isolante qui porte les busbars, avec nervure barrière, fente et rainure.", elec: { kind: "insulator" }, mold: { pull: "+Z", gating: { kind: "edge", side: "-X" } },
    features: [box(0, 0, 0, 120, 60, 4), box(52, 8, 4, 54, 52, 14, { name: "Barrier rib" }),
      box(60, 39.6, 2, 100, 40.4, 4.2, { mode: "cut", name: "Narrow slot 0.8 mm" }), box(8, 14, 2, 50, 17, 4.2, { mode: "cut", name: "Wide groove 3 mm" })] },
  { dw: "part/1", id: "HVB-BB-PLUS", name: "Busbar HV+", family: "busbar", process: "laser_cut", material: "CU-C110",
    function: "Busbar HV+ (+400 V DC).", elec: { kind: "conductor", net: "HV+" }, features: [box(10, 24, 4, 50, 36, 7)] },
  { dw: "part/1", id: "HVB-BB-MINUS", name: "Busbar HV-", family: "busbar", process: "laser_cut", material: "CU-C110",
    function: "Busbar HV- (-400 V DC).", elec: { kind: "conductor", net: "HV-" }, features: [box(56, 24, 4, 96, 36, 7)] },
  { dw: "part/1", id: "HVB-LV", name: "Terminal LV sense", family: "prismatic", process: "cnc_milling", material: "BRASS-360",
    function: "Borne de mesure basse tension (12 V).", elec: { kind: "conductor", net: "LV sense" }, features: [box(80, 44, 4, 86, 48, 6)] },
  { dw: "part/1", id: "HVB-COVER", name: "Cover", family: "enclosure", process: "injection_molding", material: "PC",
    function: "Capot isolant tenu 0,5 mm au-dessus de la plaque.", elec: { kind: "insulator" }, mold: { pull: "-Z", gating: { kind: "pin", side: "+Z" } },
    features: [box(4, 4, 4.5, 104, 56, 20), box(6, 6, 4.3, 102, 54, 18, { mode: "cut" })] },
];

export const DEMO_HVB_ASSEMBLY = {
  dw: "assembly/1", id: "DEMO-HVB", name: "HV busbar demo",
  instances: DEMO_HVB_PARTS.map((p, i) => ({ id: `i${i + 1}`, part: p.id, fixed: true, placement: { t: [0, 0, 0], r: [0, 0, 0] } })),
  mates: [],
  isolation: {
    nets: [
      { name: "HV+", kind: "dc", voltage: 400 }, { name: "HV-", kind: "dc", voltage: -400 },
      { name: "Chassis", kind: "dc", voltage: 0 }, { name: "LV sense", kind: "dc", voltage: 12 },
    ],
    params: { pollution_degree: 2, altitude_m: 3000, ovc: "II", field: "A", level: "basic" },
    levels: { "HV+|LV sense": "reinforced", "HV-|LV sense": "reinforced" },
  },
};

/** Expected measurements (mm) from the training deck, PD2 (slot bridged). In PD1 the slot is followed: HV- / LV sense creepage = 12. */
export const DEMO_HVB_EXPECTED = {
  "HV+|HV-": { clearance: 16.56, creepage: 26 },
  "HV+|LV sense": { clearance: 37.4, creepage: 44.4 },
  "HV-|LV sense": { clearance: 8, creepage: 8, creepagePD1: 12 },
  "HV+|Chassis": { clearance: 14, creepage: 14 },
  "HV-|Chassis": { clearance: 28, creepage: 28 },
  "LV sense|Chassis": { clearance: 16, creepage: 16 },
};
