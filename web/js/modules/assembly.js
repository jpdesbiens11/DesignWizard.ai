import { el } from "../core/dom.js";
import { registerModule } from "../core/app.js";
registerModule({ key: "assembly", label: "assembly", icon: "part", hidden: false, render: (main) => { main.append(el("div", { class: "page" }, el("h1", null, "assembly"), el("p", { class: "muted" }, "En construction."))); } });
