const test = require("node:test");
const assert = require("node:assert/strict");
const { loadGame } = require("./game-harness.cjs");

test("every story enemy has distinct vector art and a matching scout portrait", () => {
  const { game, monsterArt, document } = loadGame(undefined, { boot: true });
  const keys = new Set();
  for (const lv of game.levels) for (const wave of lv.waves) for (const item of wave) {
    const key = monsterArt.key(item.kind, item.boss);
    assert.equal(key, item.kind === "boss" ? "boss:" + item.boss : item.kind);
    keys.add(key);
  }
  const portraits = new Set(Array.from(keys, k => monsterArt.icon(k)));
  assert.equal(portraits.size, keys.size);
  assert.equal(keys.size, 20);
  game.start({ level: 4, waves: [[{ kind: "flanker" }, { kind: "armored" }, { kind: "waxback" }]] });
  const scout = document.getElementById("plan-text").innerHTML;
  for (const key of ["flanker", "armored", "waxback"]) assert.ok(scout.includes(monsterArt.icon(key)));
  assert.match(scout, /Approach unknown/);
  const mobCards = document.getElementById("codex-monster-list").children;
  const bossCards = document.getElementById("codex-boss-list").children;
  assert.equal(mobCards.length, 17);
  assert.equal(bossCards.length, 3);
  assert.ok(bossCards.every(c => c.innerHTML.includes('<svg class="monster-icon"')));
});

test("gameplay distinguishes sizes without changing monster HP or speed", () => {
  const { game } = loadGame();
  game.start({ noMonsters: true, level: 4 });
  const base = game.spawnMonster({ kind: "scribble", x: 90, y: 90 });
  const tiny = game.spawnMonster({ kind: "scribble", x: 90, y: 90, tiny: true });
  const zipper = game.spawnMonster({ kind: "dasher", x: 90, y: 90 });
  const armor = game.spawnMonster({ kind: "armored", x: 90, y: 90 });
  const boss = game.spawnMonster({ kind: "boss", boss: "smudge", x: 90, y: 90 });
  assert.ok(tiny.scale < base.scale);
  assert.deepEqual([tiny.hp, tiny.spd], [base.hp, base.spd]);
  assert.ok(zipper.scale < base.scale);
  assert.ok(base.scale < armor.scale && armor.scale < boss.scale);
  assert.deepEqual([base.hp, base.spd, armor.hp, armor.spd, zipper.spd], [23, 34, 38, 26, 58]);
});

test("every artwork renders to Canvas with reusable paths and balanced transforms", () => {
  const { monsterArt } = loadGame();
  let depth = 0;
  const paths = new Set();
  const ctx = {
    globalAlpha: 1,
    save() { depth++; }, restore() { depth--; },
    rotate() {}, translate() {},
    fill(p) { assert.match(p.d, /^M/); paths.add(p); },
    stroke(p) { assert.match(p.d, /^M/); paths.add(p); },
  };
  for (const id of monsterArt.keys) {
    const [kind, boss] = id.split(":");
    monsterArt.draw(ctx, { id: 17, kind, boss, phase: 1, hopping: 0.3, detour: {}, breaking: true }, 2);
    assert.equal(depth, 0);
  }
  const compiled = paths.size;
  assert.ok(compiled > 100);
  for (const id of monsterArt.keys) {
    const [kind, boss] = id.split(":");
    monsterArt.draw(ctx, { id: 19, kind, boss, phase: 2, hopping: 0, breaking: false }, 4);
    assert.equal(depth, 0);
  }
  assert.equal(paths.size, compiled, "rendering new frames should not allocate paths");
});
