import { el } from "../core/dom.js";
import { registerModule } from "../core/app.js";
registerModule({ key: "drawings", label: "drawings", icon: "part", hidden: false, render: (main) => { main.append(el("div", { class: "page" }, el("h1", null, "drawings"), el("p", { class: "muted" }, "En construction."))); } });
