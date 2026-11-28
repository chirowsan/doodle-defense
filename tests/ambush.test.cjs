const test = require("node:test");
const assert = require("node:assert/strict");
const { loadGame, trace } = require("./game-harness.cjs");

function expectEntry(game) {
  const before = game.state();
  const hint = before.incoming[0];
  assert.ok(hint.remaining > 2.7 && hint.remaining <= 2.8);
  const d = Math.hypot(hint.x - before.house.x, hint.y - before.house.y);
  assert.ok(d >= 210);
  game.advance(hint.remaining - 0.1);
  assert.equal(game.state().monsters.length, 0);
  game.advance(0.15);
  const monster = game.state().monsters[0];
  assert.ok(monster);
  assert.ok(Math.hypot(hint.x - monster.x, hint.y - monster.y) < 5);
}

test("the story scouts show types but hide all routes until Start", () => {
  const { game, document } = loadGame(undefined, { boot: true });
  const plan = game.start({ level: 4, routeSeed: 2 });
  assert.ok(plan.preview.some(x => x.kind === "scribble"));
  assert.ok(plan.preview.every(x => !("lane" in x) && !("pack" in x) && !("x" in x)));
  assert.equal("lanes" in plan, false);
  assert.equal(plan.incoming.length, 0);
  assert.match(document.getElementById("plan-text").innerHTML, /Approach unknown/);
  assert.equal(document.getElementById("ambush-alert").hidden, true);
  assert.ok(game.startWave());
  const alert = document.getElementById("ambush-alert");
  assert.match(alert.textContent, /Incoming/);
  assert.equal(alert.hidden, false);
  const warningInkCost = game.cost("red");
  expectEntry(game);
  assert.ok(game.cost("red") >= warningInkCost);
  game.advance(2);
  assert.ok(game.cost("red") > warningInkCost);
});

function sampleStarts(seed, opts = {}) {
  const { game } = loadGame();
  game.start({
    level: 2, routeSeed: seed, ...opts,
    waves: [[{ kind: "scribble", pack: 0, dt: 0 }, { kind: "jumper", pack: 1, dt: 0 }]],
  });
  game.startWave();
  return Array.from(game.state().incoming, a => [a.x, a.y, a.side]);
}

test("fresh route rolls vary between runs but keep related pack timing", () => {
  const a = sampleStarts(2), b = sampleStarts(17);
  assert.equal(a.length, 2);
  assert.notDeepEqual(a, b);
  assert.deepEqual(a, sampleStarts(2));
  assert.ok(Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]) > 130);
});

test("the first entry always leaves time to react across all story pages", () => {
  for (const seed of [2, 17, 555]) {
    const { game } = loadGame();
    for (const { id } of game.levels) {
      game.start({ level: id, routeSeed: seed });
      game.startWave();
      expectEntry(game);
    }
  }
});

test("entry markers stay on the accessible board at mobile layout dimensions", () => {
  const { game, document } = loadGame(undefined, { boot: true });
  document.getElementById("field").getBoundingClientRect = () => ({ left: 0, width: 360, top: 0, height: 580 });
  document.getElementById("hud").getBoundingClientRect = () => ({ bottom: 56 });
  document.getElementById("dock").getBoundingClientRect = () => ({ left: 0, width: 360, top: 580, height: 168 });
  game.start({ level: 2, routeSeed: 2 });
  game.startWave();
  const incoming = game.state().incoming[0];
  assert.ok(incoming.y / 620 * 580 > 56);
  assert.ok(incoming.y / 620 * 580 < 580 - 24);
});

test("Endless gives an alert before randomized packs enter too", () => {
  const { game } = loadGame();
  game.startEndless({ routeSeed: 17 });
  assert.equal(game.state().incoming.length, 0);
  game.advance(3);
  const first = game.state().incoming[0];
  assert.ok(first, "Endless started without an incoming warning");
  expectEntry(game);
  game.advance(0.5);
  assert.ok(game.state().monsters.some(m => Math.hypot(m.x - first.x, m.y - first.y) < 50));
});

test("Flankers reroute early even around reinforced walls that ordinary monsters chew", () => {
  const { game } = loadGame();
  game.start({ level: 4, noMonsters: true, ink: 500 });
  const wall = trace(game, "green", [59, 276], [155, 276]);
  trace(game, "red", [99, 250], [99, 308]);
  assert.equal(wall.reinforced, true);
  const flanker = game.spawnMonster({ kind: "flanker", x: 101, y: 190, spd: 32, hp: 175 });
  const scribble = game.spawnMonster({ kind: "scribble", x: 101, y: 190, spd: 32, hp: 175 });
  game.advance(0.25);
  assert.ok(flanker.detour);
  assert.equal(scribble.detour, null);
  game.advance(3.3);
  assert.ok(flanker.y > 276);
  assert.equal(flanker.breaking, false);
  assert.equal(scribble.breaking, true);
});

test("a sealed wall makes a Flanker chew instead of teleporting or getting stuck", () => {
  const { game } = loadGame();
  game.start({ level: 4, noMonsters: true, ink: 500 });
  const wall = trace(game, "green", [0, 276], [390, 276]);
  const flanker = game.spawnMonster({ kind: "flanker", x: 101, y: 190, spd: 32, hp: 150 });
  game.advance(3);
  assert.equal(flanker.detour, null);
  assert.equal(flanker.breaking, true);
  assert.ok(wall.hp < wall.maxHp);
  game.advance(14);
  assert.ok(wall.hp <= 0);
  assert.ok(flanker.y > 276);
});
