/* DynamiteOrbit.ai — thin access to the DFx rule engine (loaded on first use, so a screen never fails because of it). */

let mod;
async function load() {
  if (mod !== undefined) return mod;
  try {
    const [core, rules, dfa] = await Promise.all([import("./dfx_core.js"), import("./dfx_rules.js"), import("./dfa_rules.js").catch(() => null)]);
    mod = { core, rules, dfa };
  } catch (e) { console.warn("DFx engine not available:", e.message); mod = null; }
  return mod;
}
const failed = (e) => ({ findings: [{ id: "DFX-00", severity: "info", category: "DFx", title: "Rule engine", message: `Le moteur de règles a rencontré une erreur : ${e.message}. Les autres outils ne sont pas touchés.`, where: null, fix: null }],
  summary: { errors: 0, warnings: 0, infos: 1, score: null, status: "review" }, rules: [] });

/** DFM / DFx findings of one built part. */
export async function runDfx(spec, built) {
  const m = await load();
  if (!m) return { unavailable: true, findings: [], summary: null, rules: [] };
  try {
    const main = built.bodies.find((b) => b.name === built.main) || built.bodies[0];
    return m.rules.checkPart(spec, built, main ? { mesh: main.mesh } : undefined);
  } catch (e) { console.error(e); return failed(e); }
}
/** DFA findings of an assembly. ctx = {parts:{id:{spec, built}}, hardware, interference, placements}. */
export async function runDfa(asm, ctx) {
  const m = await load();
  if (!m || !m.dfa) return { unavailable: true, findings: [], summary: null, metrics: {} };
  try { return m.dfa.checkAssembly(asm, ctx); } catch (e) { console.error(e); return { ...failed(e), metrics: {} }; }
}
export async function rulebook() { const m = await load(); return m ? m.rules.RULEBOOK || [] : []; }
/** Apply the patch of a one-click fix to a part spec (returns the new spec). */
export function applyFix(spec, patch) {
  if (!mod) throw new Error("Moteur de règles non chargé.");
  return mod.core.applyPatch(spec, patch);
}
