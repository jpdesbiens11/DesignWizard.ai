import { el } from "../core/dom.js";
import { registerModule } from "../core/app.js";
registerModule({ key: "help", label: "help", icon: "part", hidden: true, render: (main) => { main.append(el("div", { class: "page" }, el("h1", null, "help"), el("p", { class: "muted" }, "En construction."))); } });
