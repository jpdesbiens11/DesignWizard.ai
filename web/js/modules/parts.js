/* DynamiteOrbit — Pièces: the part studio for every part of the project. */

import { registerModule } from "../core/app.js";
import { partStudio } from "./part_studio.js";

registerModule({ key: "parts", label: "Pièces", icon: "part", tip: "Part Studio : arbre de construction, paramètres, interfaces, DFx en direct",
  render: (main, args) => partStudio(main, args, { key: "parts", title: "Pièces", mark: "parts" }) });
