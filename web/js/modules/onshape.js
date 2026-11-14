import { el } from "../core/dom.js";
import { registerModule } from "../core/app.js";
registerModule({ key: "onshape", label: "onshape", icon: "part", hidden: true, render: (main) => { main.append(el("div", { class: "page" }, el("h1", null, "onshape"), el("p", { class: "muted" }, "En construction."))); } });
