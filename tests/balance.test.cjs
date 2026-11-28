const test = require("node:test");
const assert = require("node:assert/strict");
const { loadGame, trace } = require("./game-harness.cjs");

function sandbox() {
  const { game } = loadGame();
  game.start({ level: 2, noMonsters: true, ink: 500 });
  return game;
}
function cross(game, x, y, arm = 17, base = "blue") {
  assert.ok(trace(game, "red", [x - arm, y], [x + arm, y]));
  assert.ok(trace(game, base, [x, y - arm], [x, y + arm]));
}
function runWave(game) {
  assert.ok(game.startWave());
  for (let i = 0; i < 180; i++) {
    game.advance(0.5);
    game.collectDrops();
    const state = game.state();
    if (state.ended || state.phase === "plan") return state;
  }
  assert.fail("Wave did not finish within 90 seconds");
}

test("a splash waits until contact and does not lose its cooldown when another line is drawn", () => {
  const game = sandbox();
  cross(game, 101, 100);
  game.advance(8);
  assert.equal(game.state().combos[0].ready, true);
  const m = game.spawnMonster({ kind: "flyer", x: 101, y: 130, spd: 0, hp: 60 });
  game.advance(1 / 30);
  assert.equal(m.hp, 53);
  assert.equal(game.state().combos[0].ready, false);
  trace(game, "green", [220, 100], [280, 100]);
  assert.equal(game.state().combos[0].ready, false);
  game.advance(1);
  assert.equal(m.hp, 53);
  game.advance(2);
  assert.equal(m.hp, 46);
});

test("nearby crossings cannot pile splash damage onto the same monster, but a later trap can hit", () => {
  const game = sandbox();
  trace(game, "red", [59, 100], [153, 100]);
  trace(game, "blue", [91, 80], [91, 120]);
  trace(game, "blue", [121, 80], [121, 120]);
  cross(game, 250, 100);
  const m = game.spawnMonster({ kind: "flyer", x: 106, y: 130, spd: 0, hp: 60 });
  game.advance(1 / 30);
  assert.equal(m.hp, 53);
  assert.equal(game.state().monsters[0].soaked, true);
  assert.equal(game.state().combos.filter(c => !c.ready).length, 1);
  m.x = 250;
  game.advance(1);
  assert.equal(m.hp, 53);
  game.advance(2);
  assert.equal(m.hp, 46);
});

test("covering one spot with many doodles has a damage ceiling", () => {
  function damage(color, copies) {
    const game = sandbox();
    for (let i = 0; i < copies; i++) trace(game, color, [85, 100], [115, 100]);
    const m = game.spawnMonster({ x: 100, y: 110, spd: 0, hp: 100 });
    game.advance(0.5);
    return 100 - m.hp;
  }
  assert.ok(damage("red", 1) > damage("blue", 1) * 2);
  assert.ok(damage("red", 8) < damage("red", 2) * 1.6);
});

test("Waxbacks resist both red/blue effects and take extra thorn damage", () => {
  const game = sandbox();
  cross(game, 100, 100);
  const normal = game.spawnMonster({ x: 100, y: 139, kind: "scribble", spd: 0, hp: 60 });
  const wax = game.spawnMonster({ x: 100, y: 139, kind: "waxback", spd: 0, hp: 60 });
  game.advance(1 / 30);
  assert.equal(normal.hp, 46);
  assert.ok(wax.hp > 57);
  trace(game, "red", [220, 140], [300, 140]);
  trace(game, "green", [290, 115], [290, 205]);
  normal.x = wax.x = 312;
  normal.y = wax.y = 148;
  const normBefore = normal.hp, waxBefore = wax.hp;
  game.advance(0.15);
  assert.ok(waxBefore - wax.hp > normBefore - normal.hp);
  const slowGame = sandbox();
  trace(slowGame, "blue", [195, 108], [195, 242]);
  const slow = slowGame.spawnMonster({ x: 195, y: 130, kind: "scribble", spd: 25, hp: 60 });
  const glides = slowGame.spawnMonster({ x: 195, y: 130, kind: "waxback", spd: 25, hp: 60 });
  slowGame.advance(1);
  assert.ok(glides.y - 130 > (slow.y - 130) * 1.7);
});

test("launch pads prioritize Flyers even with a ground enemy closer", () => {
  const game = sandbox();
  trace(game, "red", [145, 180], [210, 180], [180, 230], [145, 180]);
  assert.equal(game.state().pads.length, 1);
  game.spawnMonster({ x: 165, y: 148, spd: 0, hp: 100 });
  const flyer = game.spawnMonster({ x: 260, y: 178, kind: "flyer", spd: 0, hp: 60 });
  game.advance(0.8);
  assert.ok(flyer.hp < 60);
});

test("one imperfect red stroke can clear First Scribble without pickups or tool switching", () => {
  for (const [routeSeed, y, slope] of [[2, 411, 11], [17, 432, -9], [555, 452, 8], [36, 457, -14], [12, 442, 11], [4, 421, -7]]) {
    const { game } = loadGame();
    const initial = game.start({ level: 1, routeSeed });
    assert.equal(initial.tool, "red");
    assert.ok(initial.ink >= 80);
    assert.ok(trace(game, "red", [141, y], [244, y + slope]));
    assert.ok(game.state().critters.length >= 2);
    runWave(game);
    runWave(game);
    const result = runWave(game);
    assert.equal(result.ended, "win");
    assert.ok(result.leaks < initial.house.max);
  }
});

test("the lesson can be followed, and a loss without defending still lets you retry it", () => {
  const { game, document } = loadGame(undefined, { boot: true });
  game.start({ level: 1, routeSeed: 17 });
  const plan = document.getElementById("plan-text");
  assert.match(plan.innerHTML, /Draw one red line along the dashed guide/);
  const initialCost = game.cost("red");
  trace(game, "red", [134, 431], [256, 431]);
  assert.ok(game.startWave());
  game.advance(4);
  assert.equal(game.cost("red"), initialCost);
  for (let i = 0; i < 180 && game.state().phase === "wave"; i++) game.advance(0.5);
  assert.match(plan.innerHTML, /Tap Blue, then cross your red line/);
  assert.ok(trace(game, "blue", [195, 404], [195, 471]));
  assert.equal(game.state().combos[0].kind, "splash");
  runWave(game);
  assert.equal(runWave(game).leaks, 0);
  const retry = loadGame(undefined, { boot: true });
  retry.game.start({ level: 1, routeSeed: 17 });
  runWave(retry.game);
  assert.equal(runWave(retry.game).ended, "lose");
  retry.game.start({ level: 1, routeSeed: 17 });
  assert.match(retry.document.getElementById("plan-text").innerHTML, /dashed guide/);
});

test("a first clear stops teaching permanently while keeping battle feedback", () => {
  const { game, document, saved } = loadGame(undefined, { boot: true });
  const plan = document.getElementById("plan-text");
  const hint = document.getElementById("hint");
  game.start({ level: 1, routeSeed: 17 });
  assert.match(plan.innerHTML, /Practice wave 1 of 3/);
  trace(game, "red", [134, 431], [256, 431]);
  runWave(game);
  runWave(game);
  assert.equal(runWave(game).ended, "win");
  game.start({ level: 1, routeSeed: 17 });
  assert.doesNotMatch(plan.innerHTML, /Practice wave|practice-text|dashed guide/);
  assert.match(plan.innerHTML, /Wave 1 of 3/);
  assert.match(plan.innerHTML, /2× Scribbles/);
  cross(game, 195, 430);
  assert.equal(hint.classList.contains("on"), false);

  const reload = loadGame(undefined, { saved, boot: true });
  assert.equal(reload.document.getElementById("tutorial-setting").hidden, true);
  reload.game.start({ level: 1 });
  assert.doesNotMatch(reload.document.getElementById("plan-text").innerHTML, /practice-text/);
  const page = reload.game.start({ level: 2, routeSeed: 17 });
  const laterPlan = reload.document.getElementById("plan-text");
  const notice = reload.document.getElementById("hint");
  assert.match(laterPlan.innerHTML, /id="plan-icons"/);
  assert.doesNotMatch(laterPlan.innerHTML, /class="hint"|practice-text/);
  assert.equal(reload.game.place("inkwell", page.house.x, page.house.y), null);
  reload.game.advance(0.1);
  assert.equal(notice.classList.contains("on"), true);
  assert.match(notice.textContent, /Too close to the house/);
  reload.game.startEndless();
  assert.equal(notice.classList.contains("on"), false);
});

test("existing clears and the guide-off preference are respected", () => {
  for (const old of [{ wins: { 1: true } }, { settings: { tips: false } }]) {
    const saved = new Map([["doodle-defense-v3", JSON.stringify(old)]]);
    const { game, document } = loadGame(undefined, { saved, boot: true });
    game.start({ level: 1 });
    assert.doesNotMatch(document.getElementById("plan-text").innerHTML, /practice-text|dashed guide/);
  }
});

test("returning monsters get only a small stat bump in Loopy Guard", () => {
  for (const diff of ["easy", "normal", "hard", "nightmare"]) {
    for (const kind of ["scribble", "jumper"]) {
      const { game } = loadGame();
      const stats = [1, 2, 3].map(level => {
        game.start({ level, diff });
        return game.spawnMonster({ kind, x: 200, y: 160 });
      });
      const [lesson, bridge, puddle] = stats;
      assert.ok(bridge.max >= lesson.max && bridge.max <= lesson.max * 1.25, diff + " " + kind);
      assert.ok(bridge.spd > lesson.spd && bridge.spd < lesson.spd * 1.06);
      assert.ok(puddle.max > bridge.max);
    }
  }
});

test("Loopy Guard introduces a second direction without requiring many strokes", () => {
  for (const routeSeed of [2, 17, 36, 555, 3110]) {
    const { game } = loadGame();
    const opening = game.start({ level: 2, routeSeed });
    assert.equal(opening.house.max, 4);
    assert.equal(opening.ink, 85);
    assert.deepEqual(Array.from(game.levels[1].waves, w => w.length), [3, 4, 5]);
    assert.ok(trace(game, "red", [158, 266], [231, 269], [229, 334], [159, 337], [158, 268]));
    assert.ok(game.state().strokes[0].houseGuard);
    assert.ok(game.startWave());
    assert.equal(game.state().incoming.length, 1);
    for (let i = 0; i < 180 && game.state().phase === "wave"; i++) game.advance(0.5);
    assert.equal(game.state().phase, "plan");
    runWave(game);
    const result = runWave(game);
    assert.equal(result.ended, "win");
    assert.equal(result.leaks, 0);
  }
  const { game } = loadGame();
  game.start({ level: 2, routeSeed: 17 });
  runWave(game);
  assert.equal(runWave(game).ended, "lose");
});

test("the old red/blue grid loses against off-angle packs on Vine Fence", () => {
  const { game } = loadGame();
  game.start({ level: 4, routeSeed: 2 });
  game.place("inkwell", 45, 240);
  for (const y of [370, 395, 420]) trace(game, "red", [132, y], [195, y]);
  for (const x of [146, 169]) trace(game, "blue", [x, 358], [x, 431]);
  const first = runWave(game);
  assert.ok(first.leaks > 0);
  assert.ok(first.preview.some(m => m.kind === "waxback"));
  for (const x of [137, 156, 177, 197]) trace(game, "red", [x, 347], [x, 434]);
  assert.equal(runWave(game).ended, "lose");
});

function defendHouse(level, routeSeed) {
  const saved = new Map([["doodle-defense-v3", JSON.stringify({ wins: { 1: true, 2: true }, unlocked: 3 })]]);
  const { game } = loadGame(undefined, { saved });
  assert.ok(game.buyEquipment("brush"));
  const start = game.start({ level, routeSeed });
  const { x, y } = start.house;
  for (const st of start.stars) {
    trace(game, "blue", [st.x - 18, st.y - 18], [st.x + 18, st.y - 18], [st.x + 18, st.y + 18], [st.x - 18, st.y + 18], [st.x - 18, st.y - 18]);
  }
  const inkwell = level === 3 ? [210, 520] : level === 4 ? [45, 497] : [195, 545];
  assert.ok(game.place("inkwell", ...inkwell));
  if (level === 6) assert.ok(game.place("inkwell", 89, 522));
  const ring = Array.from({ length: 13 }, (_, i) => [x + 38 * Math.cos(i * Math.PI / 6), y + 38 * Math.sin(i * Math.PI / 6)]);
  trace(game, "red", ...ring);
  assert.ok(game.state().strokes.some(s => s.houseGuard));
  trace(game, "blue", [x - 45, y], [x + 45, y]);
  let addedBlue = false;
  let counterDraws = 0;
  for (let wave = 0; wave < start.waveCount; wave++) {
    const beforeWave = game.state();
    if (beforeWave.ended) break;
    if (wave > 0 && !beforeWave.comps.some(c => c.kind === "inkwell")) game.place("inkwell", ...inkwell);
    if (wave > 0 && beforeWave.ink > 57 && !beforeWave.comps.some(c => c.kind === "sharpener")) {
      game.place("sharpener", ...(level === 3 ? [249, 484] : level === 4 ? [138, 387] : [252, y + 34]));
    }
    if (level === 6 && wave === 2 && beforeWave.ink >= 58) {
      for (const point of [[93, 440], [297, 440]]) game.place("inkwell", ...point);
    }
    assert.ok(game.startWave());
    const responded = new Set();
    for (let step = 0; step < 350; step++) {
      const state = game.state();
      if (state.ended || state.phase === "plan") break;
      if (!addedBlue && state.ink >= 14) addedBlue = !!trace(game, "blue", [x, y - 46], [x, y + 46]);
      const threats = state.monsters.filter(m => m.hp > 0 && !responded.has(m.id) && ["armored", "waxback", "boss"].includes(m.kind));
      threats.sort((a, b) => Number(!!b.boss) - Number(!!a.boss));
      for (const m of threats) {
        const dx = m.x - x, dy = m.y - y, distance = Math.hypot(dx, dy);
        if (distance < 50 || distance > (m.boss ? 155 : 118)) continue;
        const u = dx / distance, v = dy / distance;
        if (m.boss && distance < 100 && game.state().ink > 28 && step % 16 === 0) {
          trace(game, "red", [m.x - 24, m.y + 20], [m.x + 21, m.y - 28], [m.x, m.y + 28], [m.x - 24, m.y + 20]);
        }
        if (m.boss ? game.state().ink < 63 : (game.state().ink < 24 || state.strokes.filter(s => s.color === "green").length >= 5)) continue;
        const radius = m.boss ? 102 : 57;
        const bx = x + u * radius, by = y + v * radius;
        const point = (across, along) => [bx - v * across + u * along, by + u * across + v * along];
        const span = m.boss ? 41 : 21;
        game.setDrawTool("brush");
        const wall = trace(game, "green", point(-span, 0), point(span, 0));
        game.setDrawTool("pen");
        if (wall && m.boss) trace(game, "red", point(-24, 20), point(-24, -17), point(0, -17), point(0, 20), point(24, 20), point(24, -17));
        else if (wall && game.state().ink >= 8) trace(game, "red", point(0, -30), point(0, 12));
        responded.add(m.id);
        if (wall) counterDraws += 1;
      }
      game.advance(0.25);
      game.collectDrops();
    }
  }
  return { result: game.state(), counterDraws };
}

test("guarding the house and reacting to hard targets can clear Vine Fence cleanly on multiple rolls", () => {
  for (const seed of [2, 17, 555]) {
    const { result, counterDraws } = defendHouse(4, seed);
    assert.equal(result.ended, "win");
    assert.equal(result.leaks, 0);
    assert.ok(counterDraws > 0);
  }
});

test("Puddle Splash can collect all five stars and defend the house on Normal", () => {
  const { result } = defendHouse(3, 17);
  assert.equal(result.starsHave, 5);
  assert.equal(result.ended, "win");
  assert.equal(result.leaks, 0);
});

test("Big Smudge and its hidden approaches can be beaten without leaking the boss or using mixed colors", () => {
  const { result, counterDraws } = defendHouse(6, 17);
  assert.equal(result.ended, "win");
  assert.equal(result.leaks, 0);
  assert.ok(counterDraws >= 2);
  assert.equal(result.crayons.yellow, false);
  assert.equal(result.mixingInk, 30); // Two prior clears plus the boss's reward.
});
