const test = require("node:test");
const assert = require("node:assert/strict");
const { loadGame, trace } = require("./game-harness.cjs");

test("How to Play opens on a visual primer that can be replayed", () => {
  const { game, document } = loadGame(undefined, { boot: true });
  const el = id => document.getElementById(id);
  el("btn-how").click();
  assert.equal(game.screen(), "how");
  const clip = el("how-demo");
  assert.equal(clip.getAttribute("data-clip"), "basics");
  assert.match(clip.innerHTML, /Draw a red line.*Tap Start.*Doodles defend the house/);
  const initial = clip.innerHTML;
  clip.innerHTML = "";
  el("how-demo-replay").click();
  assert.equal(clip.innerHTML, initial);
});

test("every guide entry switches to its own replayable visual with optional details", () => {
  const { game, document, demos } = loadGame(undefined, { boot: true });
  const el = id => document.getElementById(id);
  const variants = {
    colors: ["red", "blue", "green", "yellow", "purple", "cyan", "eraser"],
    tips: ["pen", "brush", "highlighter"],
    packets: ["inkwell", "decoy", "sharpener", "glue", "bumper", "reservoir"],
    combos: ["splash", "thorn", "bush", "launch", "loop", "rally"],
  };
  el("btn-how").click();
  el("btn-guide-how").click();
  assert.equal(game.screen(), "guide");
  assert.deepEqual(Array.from(demos.ids).sort(), ["basics", ...Object.values(variants).flat()].sort());
  for (const [tab, ids] of Object.entries(variants)) {
    el("guide-tab-" + tab).click();
    assert.equal(el("guide-tab-" + tab).getAttribute("aria-pressed"), "true");
    const buttons = el("guide-list").children;
    assert.deepEqual(buttons.map(b => b.getAttribute("data-testid")), ids.map(id => "guide-pick-" + id));
    for (const [i, id] of ids.entries()) {
      buttons[i].click();
      assert.equal(buttons[i].getAttribute("aria-pressed"), "true");
      assert.equal(el("guide-demo").getAttribute("data-clip"), id);
      assert.equal(el("guide-details").open, false);
      assert.match(el("guide-demo").innerHTML, /^<svg.*<(?:animate|set )/);
      const before = el("guide-demo").innerHTML;
      el("guide-demo").innerHTML = "";
      el("guide-demo-replay").click();
      assert.equal(el("guide-demo").innerHTML, before);
    }
  }
  const switchTo = (tab, index) => { el("guide-tab-" + tab).click(); el("guide-list").children[index].click(); };
  switchTo("packets", 0);
  assert.match(el("guide-demo").innerHTML, /Tap the drop for \+14 ink/);
  assert.match(el("guide-clip-try").textContent, /50% faster/);
  switchTo("tips", 1);
  assert.match(el("guide-demo").innerHTML, /Brush wall holds longer/);
  assert.match(el("guide-clip-detail").textContent, /55% more ink/);
  el("btn-guide-back").click();
  assert.equal(game.screen(), "how");
});

test("the guide pauses a battle and resumes the same drawing and packet state", () => {
  const { game, document } = loadGame(undefined, { boot: true });
  const el = id => document.getElementById(id);
  game.start({ level: 2 });
  trace(game, "red", [140, 240], [250, 245]);
  game.startWave();
  game.advance(2);
  game.setPlacing("inkwell");
  const state = game.state();
  el("btn-guide-play").click();
  assert.equal(game.screen(), "guide");
  assert.equal(el("guide-tab-packets").getAttribute("aria-pressed"), "true");
  game.advance(5);
  assert.equal(game.state().t, state.t);
  el("btn-guide-back").click();
  assert.equal(game.screen(), "play");
  assert.equal(game.state().placing, "inkwell");
  assert.deepEqual(game.state().strokes, state.strokes);
  game.advance(0.1);
  assert.ok(game.state().t > state.t);
});

test("a player can compare purchases and read packet instructions without losing their place", () => {
  const { game, document } = loadGame(undefined, { boot: true });
  const el = id => document.getElementById(id);
  el("btn-play").click();
  el("btn-equipment-levels").click();
  el("btn-guide-equipment").click();
  assert.equal(el("guide-tab-tips").getAttribute("aria-pressed"), "true");
  el("btn-guide-back").click();
  assert.equal(game.screen(), "equipment");
  assert.equal(el("equipment-balance").textContent, "0 Erasers");

  game.openLoadout(3);
  el("btn-guide-loadout").click();
  assert.equal(el("guide-tab-packets").getAttribute("aria-pressed"), "true");
  el("btn-guide-back").click();
  assert.equal(game.screen(), "loadout");
  assert.match(el("loadout-objective").textContent, /all 5 board stars/);
});
