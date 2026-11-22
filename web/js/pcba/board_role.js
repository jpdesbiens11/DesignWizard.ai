/* DesignWizard.ai — the ROLE of a board (point 6, JP, 20 novembre 2026 : « chaque carte a un rôle — "Produit" ou "Banc d'essai" — seules les
   premières entrent dans l'assemblage, l'isolation et le rapport »).
   A board of the product goes into the product : its mechanical twin is born and mounted, its copper is analysed for isolation, the review
   report carries it. A board of a TEST BENCH is a tool of the lab — an adapter, a load, a fixture that drives the product's board — : it is
   designed, simulated and tested like any other, but no twin is born for it, it is not in the isolation of the product, and the report lists
   it apart, as a tool. The usage followed : the bill of materials of a product leaves out its test equipment, which has its own. Pure. */

export const BOARD_ROLES = {
  product: { key: "product", label: "Product", fr: "Carte du produit", color: "#16a34a", icon: "chip", says: "Entre dans le produit : son jumeau mécanique naît et se monte, son cuivre passe à l'isolation, la revue la porte." },
  bench: { key: "bench", label: "Test bench", fr: "Carte de banc d'essai", color: "#7c3aed", icon: "sensor", says: "Un outil du laboratoire : elle se conçoit, se simule et s'essaie comme les autres, mais n'entre ni dans l'assemblage, ni dans l'isolation du produit ; le rapport la range à part." },
};
/** The role of a board : "bench" when it says so, "product" otherwise (a board made before roles is a board of the product). */
export const roleOf = (board) => (board && board.role === "bench" ? "bench" : "product");
export const isProductBoard = (board) => roleOf(board) === "product";
/** The boards of the product, and those of the bench. */
export const productBoards = (project) => ((project && project.boards) || []).filter(isProductBoard);
export const benchBoards = (project) => ((project && project.boards) || []).filter((b) => !isProductBoard(b));
/** A role set on a board (in a step of the store) : "product" is the default and is not written. */
export function setRole(board, role) { if (role === "bench") board.role = "bench"; else delete board.role; return board; }

/** What the guide says about the roles : a bench board whose twin is mounted in an assembly of the product. → [{ level, text, ref }] */
export function roleIssues(project) {
  const out = [], asms = (project && project.assemblies) || [];
  for (const b of benchBoards(project)) {
    if (!b.part) continue;
    const used = asms.filter((a) => (a.instances || []).some((i) => i && i.part === b.part)).map((a) => a.id);
    if (used.length) out.push({ level: "warn", text: `La carte ${b.id} est une carte de banc d'essai, mais son jumeau ${b.part} est monté dans ${used.join(", ")} : retirez-le de l'assemblage, ou passez la carte à « Produit ».`, ref: b.id });
  }
  return out;
}
