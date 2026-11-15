/* DesignWizard.ai — Isolation : the bodies of an assembly grouped by what they are for the analysis. Conductors come
   first, one group per potential in the order of the nets, with the colour of the net ; then the conductors that still
   wait for a potential, the floating metal, the insulators, and what is left out. Pure : the screen draws the groups. */

import { netColor } from "../cad/materials.js";

export const GROUP_COLORS = { noNet: "#e5484d", floating: "#c9a94f", insulator: "#94a3b8", ignore: "#cbd5e1" };
/** bodies : [{ id, name, kind: conductor | floating | insulator | ignore, net }] ; nets : [{ name }] in their order.
    → [{ key, title, hint, color, bodies }] — a group with no body is left out. */
export function bodyGroups(bodies, nets = []) {
  const list = bodies || [], order = [...nets.map((n) => n.name), ...new Set(list.filter((b) => b.kind === "conductor" && b.net).map((b) => b.net))].filter((n, i, a) => a.indexOf(n) === i);
  const groups = order.map((net) => ({ key: `net:${net}`, title: `Conducteurs — ${net}`, hint: "Portent ce potentiel : les distances se mesurent depuis leurs surfaces", color: netColor(net), net, bodies: list.filter((b) => b.kind === "conductor" && b.net === net) }));
  groups.push({ key: "noNet", title: "Conducteurs sans potentiel", hint: "À relier à un potentiel, ou à déclarer flottants", color: GROUP_COLORS.noNet, bodies: list.filter((b) => b.kind === "conductor" && !b.net) },
    { key: "floating", title: "Métal flottant", hint: "Conducteur à aucun potentiel : il raccourcit les distances qu'il traverse", color: GROUP_COLORS.floating, bodies: list.filter((b) => b.kind === "floating") },
    { key: "insulator", title: "Isolants", hint: "Les lignes de fuite courent sur leurs surfaces", color: GROUP_COLORS.insulator, bodies: list.filter((b) => b.kind === "insulator") },
    { key: "ignore", title: "Laissés hors de l'analyse", hint: "Ni obstacle ni chemin", color: GROUP_COLORS.ignore, bodies: list.filter((b) => b.kind === "ignore") });
  return groups.filter((g) => g.bodies.length);
}
