const test = require("node:test");
const assert = require("node:assert/strict");
const { loadGame, trace } = require("./game-harness.cjs");

function defense(diff = "normal") {
  const context = loadGame(undefined, { boot: true });
  const { game } = context;
  game.start({ level: 2, diff, noMonsters: true });
  assert.ok(trace(game, "red", [80, 120], [120, 120]));
  game.setInk(50);
  return context;
}

test("each knockout automatically gives whole ink, including on Nightmare", () => {
  for (const [diff, award] of [["easy", 3], ["normal", 2], ["hard", 1], ["nightmare", 1]]) {
    const { game, document, renderLabels } = defense(diff);
    const monster = game.spawnMonster({ x: 100, y: 120, hp: 0.01, spd: 0 });
    game.advance(1 / 30);
    assert.equal(monster.hp, 0);
    assert.equal(Math.round(game.state().ink), 50 + award);
    assert.equal(document.getElementById("ink-count").textContent, String(50 + award));
    assert.equal(document.getElementById("ink-pill").classList.contains("earned"), true);
    assert.deepEqual(renderLabels().filter(t => t.endsWith(" ink")), ["+" + award + " ink"]);
    game.advance(0.6);
    assert.equal(document.getElementById("ink-pill").classList.contains("earned"), false);
    assert.ok(game.state().ink < 50 + award * 2, "the same knockout was paid twice");
    assert.equal(game.state().mixingInk, 0);
  }
});

test("bosses pay more and tiny monsters are still worth ink", () => {
  const { game, renderLabels } = defense();
  const boss = game.spawnMonster({ kind: "boss", boss: "smudge", x: 100, y: 120, hp: 0.01, spd: 0 });
  const tiny = game.spawnMonster({ x: 100, y: 135, hp: 0.01, spd: 0, tiny: true });
  game.advance(1 / 30);
  assert.equal(boss.hp, 0);
  assert.equal(tiny.hp, 0);
  assert.equal(Math.round(game.state().ink), 59);
  assert.deepEqual(renderLabels().filter(t => t.endsWith(" ink")), ["+8 ink", "+1 ink"]);
});

test("reward feedback reports the ink that fits and never overfills the bar", () => {
  for (const room of [1, 0]) {
    const { game, renderLabels } = defense();
    const { inkMax } = game.state();
    game.setInk(inkMax - room);
    game.spawnMonster({ x: 100, y: 120, hp: 0.01, spd: 0 });
    game.advance(1 / 30);
    assert.equal(game.state().ink, inkMax);
    const labels = renderLabels();
    assert.ok(labels.includes(room ? "+1 ink" : "Ink full"));
    assert.ok(!labels.includes("+2 ink"));
  }
});

test("leaks and splits aren't counted as defeats, but traps pay the same as doodles", () => {
  const { game } = defense();
  const { x, y } = game.state().house;
  game.spawnMonster({ x, y, hp: 15, spd: 0 });
  const splitter = game.spawnMonster({ kind: "splitter", x: 100, y: 120, hp: 8, spd: 0 });
  game.advance(1 / 30);
  assert.equal(game.state().leaks, 1);
  assert.equal(Math.round(game.state().ink), 50);
  splitter.hp = 4;
  game.advance(1 / 30);
  assert.equal(splitter.hp, 0);
  assert.equal(game.state().monsters.filter(m => m.tiny).length, 2);
  assert.equal(Math.round(game.state().ink), 50);
  assert.ok(trace(game, "red", [205, 100], [265, 100]));
  assert.ok(trace(game, "blue", [235, 70], [235, 130]));
  game.setInk(50);
  const flyer = game.spawnMonster({ kind: "flyer", x: 235, y: 130, hp: 0.01, spd: 0 });
  game.advance(1 / 30);
  assert.equal(flyer.hp, 0);
  assert.equal(Math.round(game.state().ink), 52);
});
