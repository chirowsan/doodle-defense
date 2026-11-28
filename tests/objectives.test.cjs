const test = require("node:test");
const assert = require("node:assert/strict");
const { loadGame, trace } = require("./game-harness.cjs");

test("Page 3 tells you to collect all five board stars and tracks them separately from house hearts", () => {
  const { game, document } = loadGame(undefined, { boot: true });
  const byId = id => document.getElementById(id);
  game.openLoadout(3);
  assert.equal(byId("loadout-objective").textContent, "Collect all 5 board stars and survive all 3 waves.");
  assert.equal(byId("loadout-star-help").hidden, false);
  const initial = game.start({ level: 3 });
  assert.match(byId("page-objective").textContent, /Board stars 0\/5.*Survive all 3 waves/);
  assert.equal(byId("goal-pill").getAttribute("aria-label"), "House hearts 3");
  const [star] = initial.stars;
  trace(game, "blue", [star.x - 20, star.y - 20], [star.x + 20, star.y - 20],
    [star.x + 20, star.y + 20], [star.x - 20, star.y + 20], [star.x - 20, star.y - 20]);
  assert.match(byId("page-objective").textContent, /Board stars 1\/5/);

  game.openLoadout(1);
  assert.match(byId("loadout-objective").textContent, /Keep the house standing through all 3 waves/);
  assert.equal(byId("loadout-star-help").hidden, true);
  game.openLoadout(0);
  assert.match(byId("loadout-objective").textContent, /no final wave/);
});

test("only meeting both objectives passes a star page", () => {
  for (const starsHave of [4, 5]) {
    const { game, document } = loadGame(undefined, { boot: true });
    game.start({ level: 3, starsHave, waves: [[{ kind: "scribble", pack: 0 }]] });
    game.advance(1);
    assert.equal(game.state().ended, null);
    assert.ok(game.startWave());
    game.advance(3);
    game.setMonsterHp(game.state().monsters[0].id, 0);
    game.advance(0.05);
    assert.equal(game.state().ended, starsHave === 5 ? "win" : "lose");
    if (starsHave === 4) {
      assert.equal(game.state().endReason, "stars");
      assert.match(document.getElementById("end-blurb").textContent, /Collected 4 of 5 required board stars/);
    } else assert.match(document.getElementById("end-blurb").textContent, /star rating/);
  }
});

test("first actual arrivals pause play, queue distinct species, and remember each Continue", () => {
  const { game, document, saved } = loadGame(undefined, { boot: true });
  const byId = id => document.getElementById(id);
  const waves = [[
    { kind: "scribble", pack: 0, dt: 0 },
    { kind: "scribble", pack: 1, dt: 0 },
    { kind: "jumper", pack: 0, dt: 0 },
    { kind: "eater", pack: 1, dt: 6 },
  ]];
  const opened = () => byId("modal-intro").classList.contains("on");
  const clickContinue = () => byId("btn-intro-continue").click();
  game.start({ level: 2, intros: true, waves, routeSeed: 17 });
  assert.equal(opened(), false);
  game.startWave();
  game.advance(2.6);
  assert.equal(opened(), false, "don't introduce monsters before they arrive");
  game.advance(0.4);
  assert.equal(byId("intro-name").textContent, "Scribble");
  assert.match(byId("intro-art").innerHTML, /<svg/);
  assert.equal(byId("screen-play").inert, true);
  const frozen = game.state();
  game.advance(10);
  assert.equal(game.state().t, frozen.t);
  assert.deepEqual(game.state().monsters, frozen.monsters);
  clickContinue();
  assert.equal(byId("intro-name").textContent, "Hopper");
  assert.match(byId("intro-text").textContent, /jump green walls/);
  assert.equal(game.save().introduced.hopper, undefined);
  assert.equal(opened(), true);
  clickContinue();
  assert.equal(opened(), false);
  assert.equal(byId("screen-play").inert, false);
  game.advance(0.5);
  assert.ok(game.state().t > frozen.t);
  game.advance(6);
  assert.equal(byId("intro-name").textContent, "Eraser-bug");
  assert.equal(opened(), true);

  const again = loadGame(undefined, { saved, boot: true });
  again.game.start({ level: 2, intros: true, waves, routeSeed: 17 });
  again.game.startWave();
  again.game.advance(3);
  assert.equal(again.document.getElementById("modal-intro").classList.contains("on"), false);
  again.game.advance(6);
  assert.equal(again.document.getElementById("intro-name").textContent, "Eraser-bug");
  assert.equal(again.document.getElementById("modal-intro").classList.contains("on"), true);
});

test("bosses and a newly summoned helper have their own introductions", () => {
  const { game, document } = loadGame(undefined, { boot: true });
  const byId = id => document.getElementById(id);
  game.start({ level: 18, intros: true, noMonsters: true });
  const boss = game.spawnMonster({ kind: "boss", boss: "hidey", x: 195, y: 240, spd: 0 });
  game.advance(0.05);
  assert.equal(byId("intro-type").textContent, "New boss");
  assert.equal(byId("intro-name").textContent, "Hidey Storm");
  byId("btn-intro-continue").click();
  game.setMonsterHp(boss.id, boss.max / 2);
  game.advance(0.05);
  assert.equal(byId("intro-type").textContent, "New monster");
  assert.equal(byId("intro-name").textContent, "Flyer");
  byId("btn-intro-continue").click();
  assert.equal(byId("modal-intro").classList.contains("on"), false);
  assert.equal(game.save().introduced["boss:hidey"], true);
  assert.equal(game.save().introduced.flyer, true);
});
