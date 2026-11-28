const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const vm = require("node:vm");

// The game exposes deterministic update hooks. The DOM and canvas are only
// stubbed here, so the simulation runs without browser or npm dependencies.
function loadGame(root = resolve(__dirname, ".."), { saved = new Map(), boot = false } = {}) {
  const elements = new Map();
  const noop = () => {};
  const labels = [];
  const ctx = new Proxy({
    getImageData: () => ({ data: [] }),
    fillText: label => labels.push(label),
  }, { get: (o, k) => o[k] ?? noop });
  function element() {
    const classes = new Set();
    const attrs = new Map();
    const events = new Map();
    let markup = "";
    return {
      style: { setProperty(k, v) { this[k] = v; } }, dataset: {}, children: [],
      classList: {
        add: x => classes.add(x), remove: x => classes.delete(x),
        contains: x => classes.has(x),
        toggle: (x, on = !classes.has(x)) => on ? classes.add(x) : classes.delete(x),
      },
      getContext: () => ctx,
      addEventListener(k, cb) { events.set(k, cb); },
      emit(k, ev) { events.get(k)?.(ev); },
      click() { if (!this.disabled) events.get("click")?.(); },
      appendChild(child) { this.children.push(child); },
      get innerHTML() { return markup; },
      set innerHTML(value) { markup = value; this.children.length = 0; },
      setAttribute: (k, v) => attrs.set(k, v),
      getAttribute: k => attrs.get(k),
      querySelector: () => null,
      querySelectorAll: () => [],
    };
  }
  const query = new Map();
  let onDOMContentLoaded;
  let scheduledFrame;
  const document = {
    readyState: "loading",
    addEventListener(k, cb) { if (k === "DOMContentLoaded") onDOMContentLoaded = cb; },
    documentElement: element(),
    body: element(),
    createElement: element,
    querySelector: () => null,
    querySelectorAll: selector => query.get(selector) || [],
    getElementById(id) {
      if (!elements.has(id)) {
        const el = element();
        if (id === "field") el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 390, height: 620 });
        elements.set(id, el);
      }
      return elements.get(id);
    },
  };
  if (boot) {
    const html = readFileSync(resolve(root, "index.html"), "utf8");
    for (const [id, selector] of [["tools", "#tools .tool"], ["draw-tools", "#draw-tools .dtool"], ["mix-inputs", "#mix-inputs button"], ["mix-recipes", "#mix-recipes button"]]) {
      const section = html.slice(html.indexOf(` id="${id}"`)).split("</div>")[0];
      query.set(selector, [...section.matchAll(/<button\b([^>]*)>(.*?)<\/button>/gs)].map(([, attrs, body]) => {
        const button = element();
        for (const [, key, value] of attrs.matchAll(/([\w-]+)="([^"]*)"/g)) {
          button.setAttribute(key, value);
          if (key.startsWith("data-")) button.dataset[key.slice(5)] = value;
        }
        button.hidden = /\bhidden\b/.test(attrs);
        button.disabled = /\bdisabled\b/.test(attrs);
        if (body.includes('class="recipe-state"')) {
          const state = element();
          button.querySelector = q => q === ".recipe-state" ? state : null;
        }
        return button;
      }));
    }
  }
  const sandbox = {
    document, navigator: {}, innerWidth: 390, innerHeight: 620, addEventListener: noop,
    requestAnimationFrame: cb => { scheduledFrame = cb; },
    Path2D: class { constructor(d) { this.d = d; } },
    localStorage: { getItem: k => saved.get(k), setItem: (k, v) => saved.set(k, v) },
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for (const file of ["src/levels.js", "src/monsters.js", "src/patrol.js", "src/demos.js", "src/game.js"]) {
    vm.runInContext(readFileSync(resolve(root, file), "utf8"), sandbox, { filename: file });
  }
  if (boot) onDOMContentLoaded();
  // Isolate simulation tests from the new modal. Dedicated encounter tests opt in.
  const game = sandbox.DD;
  const start = game.start, startEndless = game.startEndless;
  game.start = opts => start({ intros: false, ...opts });
  game.startEndless = opts => startEndless({ intros: false, ...opts });
  function renderLabels() {
    labels.length = 0;
    scheduledFrame(100);
    return labels.slice();
  }
  return { game, patrol: sandbox.DDPatrol, demos: sandbox.DDDemos, monsterArt: sandbox.DDMonsterArt, document, saved, renderLabels };
}

function trace(game, color, ...points) {
  return game.drawStroke(points.map(([x, y]) => ({ x, y })), color);
}

module.exports = { loadGame, trace };
