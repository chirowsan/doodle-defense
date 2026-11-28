const test = require("node:test");
const assert = require("node:assert/strict");
const { loadGame, trace } = require("./game-harness.cjs");

const KEY = "doodle-defense-v3";
function fastClear(game, level) {
  const page = game.levels.find(p => p.id === level);
  game.start({ level, waves: [[{ kind: "scribble", pack: 0 }]], starsHave: page.starsNeed });
  assert.ok(game.startWave());
  game.advance(3);
  const { id } = game.state().monsters[0];
  game.setMonsterHp(id, 0);
  game.advance(1 / 30);
  assert.equal(game.state().ended, "win");
}
function finishChapter(game, chapter) {
  for (let level = (chapter - 1) * 6 + 1; level <= chapter * 6; level++) fastClear(game, level);
}
function saveWith(chapters, crayons = {}) {
  return new Map([[KEY, JSON.stringify({
    unlocked: chapters * 6 + 1,
    wins: Object.fromEntries(Array.from({ length: chapters * 6 }, (_, i) => [i + 1, true])),
    crayons,
  })]]);
}
function click(document, id) {
  document.getElementById(id).click();
}
function text(document, id) {
  return document.getElementById(id).textContent;
}

test("a fresh game shows only three crayons plus Eraser and can preview recipes without buying", () => {
  const { game, document } = loadGame(undefined, { boot: true });
  click(document, "btn-mixer-menu");
  assert.equal(game.screen(), "mixer");
  assert.equal(text(document, "mix-ink"), "0 Mixing Ink");
  const colors = document.querySelectorAll("#mix-inputs button");
  colors.find(b => b.dataset.color === "red").click();
  colors.find(b => b.dataset.color === "blue").click();
  assert.equal(text(document, "mix-result-name"), "Purple Blink");
  assert.equal(document.getElementById("btn-mix-buy").disabled, true);
  assert.equal(game.mixCrayons("red", "blue"), null);
  game.start({ noMonsters: true, ink: 200 });
  const tools = document.querySelectorAll("#tools .tool");
  assert.deepEqual(tools.filter(b => !b.hidden).map(b => b.dataset.tool), ["blue", "red", "green", "eraser"]);
  assert.equal(trace(game, "cyan", [110, 122], [170, 122]), null);
  assert.equal(game.state().ink, 200);
});

test("wins award one Eraser, and the Pencil Case buys permanent tools without touching Mixing Ink", () => {
  const { game, document, saved } = loadGame(undefined, { boot: true });
  const visibleTools = () => document.querySelectorAll("#draw-tools .dtool").filter(b => !b.hidden);
  click(document, "btn-play");
  click(document, "btn-equipment-levels");
  assert.equal(game.screen(), "equipment");
  assert.equal(text(document, "equipment-balance"), "0 Erasers");
  assert.equal(document.getElementById("btn-buy-brush").disabled, true);
  click(document, "btn-equipment-back");
  assert.equal(game.screen(), "levels");
  game.start({ level: 1 });
  assert.deepEqual(visibleTools().map(b => b.dataset.draw), ["pen"]);
  assert.equal(game.setDrawTool("brush"), false);
  assert.equal(game.setDrawTool("highlighter"), false);
  assert.equal(trace(game, "green", [75, 100], [155, 100]).tool, "pen");
  game.start({ level: 1, houseHp: 0 });
  game.startWave();
  game.advance(1 / 30);
  assert.equal(game.state().ended, "lose");
  assert.equal(game.save().erasers, 0);
  assert.equal(document.getElementById("btn-end-equipment").hidden, true);

  fastClear(game, 1);
  assert.equal(game.save().erasers, 1);
  assert.match(text(document, "unlock-note"), /\+1 Eraser/);
  assert.equal(game.buyEquipment("brush"), false);
  fastClear(game, 2);
  assert.equal(game.save().erasers, 2);
  assert.equal(game.palette().mixingInk, 10);
  assert.match(text(document, "btn-end-equipment"), /Upgrade ready/);
  click(document, "btn-end-equipment");
  assert.equal(game.screen(), "equipment");
  assert.equal(text(document, "equipment-balance"), "2 Erasers");
  assert.equal(document.getElementById("btn-buy-highlighter").disabled, true);
  click(document, "btn-buy-brush");
  assert.equal(text(document, "equipment-balance"), "0 Erasers");
  assert.equal(text(document, "equipment-status"), "Brush unlocked!");
  assert.equal(game.buyEquipment("brush"), false);
  assert.equal(game.palette().mixingInk, 10);
  click(document, "btn-equipment-back");
  assert.equal(game.screen(), "play");
  assert.ok(document.getElementById("modal-end").classList.contains("on"));

  game.start({ level: 3 });
  assert.deepEqual(visibleTools().map(b => b.dataset.draw), ["pen", "brush"]);
  const thin = trace(game, "green", [75, 100], [155, 100]);
  visibleTools().find(b => b.dataset.draw === "brush").click();
  const thick = trace(game, "green", [75, 155], [155, 155]);
  assert.equal(thick.tool, "brush");
  assert.ok(thick.width > thin.width && thick.hp > thin.hp);

  for (const level of [3, 4, 5, 2]) fastClear(game, level);
  assert.equal(game.save().erasers, 4, "winning a replay should give an Eraser");
  assert.equal(game.palette().mixingInk, 25, "replays shouldn't give Mixing Ink");
  assert.ok(game.buyEquipment("highlighter"));
  const reloaded = loadGame(undefined, { saved, boot: true });
  reloaded.game.startEndless();
  assert.equal(reloaded.game.save().erasers, 0);
  assert.ok(reloaded.game.setDrawTool("brush"));
  assert.ok(reloaded.game.setDrawTool("highlighter"));
  assert.equal(trace(reloaded.game, "blue", [60, 95], [140, 95]).highlight, true);
  assert.equal(reloaded.game.buyEquipment("highlighter"), false);
});

test("existing campaigns receive credit for past clears once", () => {
  const saved = saveWith(1, { yellow: true });
  const { game } = loadGame(undefined, { saved });
  assert.equal(game.save().erasers, 6);
  assert.ok(game.buyEquipment("brush"));
  assert.ok(game.buyEquipment("highlighter"));
  const reload = loadGame(undefined, { saved }).game;
  assert.equal(reload.save().erasers, 0);
  assert.deepEqual({ ...reload.save().drawTools }, { brush: true, highlighter: true });
  assert.equal(reload.palette().crayons.yellow, true);
});

test("normal campaign clears fund one purchase per chapter and don't pay for replays or failures", () => {
  const { game, document, saved } = loadGame(undefined, { boot: true });
  game.start({ level: 1, houseHp: 0 });
  game.startWave();
  game.advance(1 / 30);
  assert.equal(game.state().ended, "lose");
  assert.equal(game.palette().mixingInk, 0);
  for (let level = 1; level <= 5; level++) fastClear(game, level);
  assert.equal(game.palette().mixingInk, 25);
  assert.equal(game.palette().open, false);
  fastClear(game, 6);
  assert.equal(game.palette().mixingInk, 45);
  assert.equal(game.palette().open, true);
  assert.equal(game.palette().crayons.yellow, false);
  assert.equal(document.getElementById("btn-end-mix").hidden, false);
  assert.match(text(document, "unlock-note"), /20 Mixing Ink.*Chapter 1 cleared/);
  click(document, "btn-end-mix");
  const recipes = document.querySelectorAll("#mix-recipes button");
  recipes.find(b => b.dataset.mix === "yellow").click();
  assert.equal(text(document, "mix-result-name"), "Yellow Zap");
  assert.equal(document.getElementById("btn-mix-buy").disabled, false);
  click(document, "btn-mix-buy");
  assert.equal(text(document, "mix-ink"), "0 Mixing Ink");
  assert.match(text(document, "mix-status"), /Yellow Zap is now in your toolbox/);
  assert.equal(game.mixCrayons("red", "blue"), null);
  assert.equal(game.mixCrayons("red", "green"), null);
  click(document, "btn-mixer-back");
  assert.equal(game.screen(), "levels");
  fastClear(game, 1);
  fastClear(game, 6);
  assert.equal(game.palette().mixingInk, 0);
  finishChapter(game, 2);
  assert.equal(game.palette().mixingInk, 45);
  assert.equal(game.mixCrayons("green", "blue"), "cyan");
  finishChapter(game, 3);
  assert.equal(game.palette().mixingInk, 45);
  assert.equal(game.mixCrayons("blue", "red"), "purple");
  assert.equal(game.mixCrayons("blue", "blue"), null);
  const reload = loadGame(undefined, { saved, boot: true });
  assert.equal(reload.game.palette().mixingInk, 0);
  assert.deepEqual({ ...reload.game.palette().crayons }, { yellow: true, purple: true, cyan: true });
  reload.game.start({ level: 7 });
  const tools = reload.document.querySelectorAll("#tools .tool");
  assert.equal(tools.filter(b => !b.hidden).length, 7);
});

test("legacy unlocks and completed chapters survive migration without double charging", () => {
  const saved = saveWith(2, { yellow: true, purple: true });
  const { game } = loadGame(undefined, { saved });
  assert.equal(game.palette().mixingInk, 90);
  assert.equal(game.mixCrayons("blue", "red"), null);
  assert.equal(game.mixCrayons("red", "green"), null);
  assert.equal(game.mixCrayons("blue", "green"), "cyan");
  assert.equal(game.palette().mixingInk, 45);
});

function unlockedGame(a, b) {
  const { game } = loadGame(undefined, { saved: saveWith(1) });
  assert.ok(game.mixCrayons(a, b));
  game.start({ noMonsters: true, ink: 200 });
  return game;
}

test("recipes unlock functioning tools without replacing battle crossings", () => {
  const blink = unlockedGame("red", "blue");
  assert.ok(trace(blink, "purple", [90, 100], [200, 175]));
  const monster = blink.spawnMonster({ x: 91, y: 101, spd: 0, hp: 100 });
  blink.advance(1 / 30);
  assert.deepEqual([monster.x, monster.y], [200, 175]);
  trace(blink, "blue", [250, 100], [250, 170]);
  trace(blink, "red", [220, 135], [280, 135]);
  assert.equal(blink.state().combos[0].kind, "splash");

  const zap = unlockedGame("red", "green");
  assert.ok(trace(zap, "yellow", [91, 99], [236, 99]));
  const armored = zap.spawnMonster({ kind: "armored", x: 200, y: 118, spd: 0, hp: 100 });
  zap.advance(1.6);
  assert.ok(armored.hp < 91);
  assert.equal(zap.state().strokes[0].charges, 7);
});

test("Frost slows Flyers and blocks Hopper takeoff on the line", () => {
  const frost = unlockedGame("blue", "green");
  assert.ok(trace(frost, "cyan", [195, 70], [195, 200]));
  const flyer = frost.spawnMonster({ kind: "flyer", x: 195, y: 90, spd: 32, hp: 100 });
  const plain = frost.spawnMonster({ kind: "flyer", x: 250, y: 90, spd: 32, hp: 100 });
  frost.advance(0.5);
  assert.ok(flyer.y - 90 < (plain.y - 90) * 0.6);
  assert.equal(frost.state().monsters[0].frosted, true);

  const hopperGame = unlockedGame("green", "blue");
  trace(hopperGame, "cyan", [180, 92], [212, 92]);
  trace(hopperGame, "green", [150, 123], [270, 123]);
  const chilled = hopperGame.spawnMonster({ kind: "jumper", x: 195, y: 92, spd: 0, hp: 100 });
  const control = hopperGame.spawnMonster({ kind: "jumper", x: 243, y: 92, spd: 0, hp: 100 });
  chilled.hopCd = control.hopCd = 0;
  hopperGame.advance(1 / 30);
  assert.ok(control.hopping > 0);
  assert.equal(chilled.hopping, 0);
});
