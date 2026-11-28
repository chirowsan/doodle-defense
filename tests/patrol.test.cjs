const test = require("node:test");
const assert = require("node:assert/strict");
const { loadGame, trace } = require("./game-harness.cjs");

const stroke = (id, coords, closed = false) => ({ id, closed, pts: coords.map(([x,y]) => ({x,y})) });
const point = (x, y) => ({ clientX: x, clientY: y, pointerId: 1, preventDefault() {} });

function setup(opts = {}) {
  const { game, document } = loadGame(undefined, { boot: true });
  const el = id => document.getElementById(id);
  game.start({ level: 3, noMonsters: true, ink: 1000, ...opts });
  const tap = (x, y) => {
    el("field").emit("pointerdown", point(x, y));
    el("field").emit("pointerup", point(x, y));
  };
  const order = (x, y) => { el("btn-rally").click(); tap(x, y); };
  const erase = (x, y) => { game.setTool("eraser"); tap(x, y); };
  return { game, el, tap, order, erase };
}

test("routing crosses multiple connected strokes without cutting across a gap", () => {
  const { patrol } = loadGame();
  const a = stroke(1, [[0,20],[80,20]]);
  const b = stroke(2, [[70,0],[70,100]]);
  const c = stroke(3, [[60,80],[150,80]]);
  const gap = stroke(4, [[151,80],[190,80]]);
  const net = patrol.network([a,b,c,gap], {strokeId:3,at:80});
  assert.equal(net.joins.length, 2);
  assert.equal(net.route(4,20), null);
  const result = net.route(1,20);
  assert.equal(result.distance, 50+60+70);
  assert.deepEqual(Array.from(result.legs, l => [l.strokeId,l.length]), [[1,50],[2,0],[2,60],[3,0],[3,70]]);
});

test("nearest pin snaps onto a stroke and closed patrols choose the shorter arc", () => {
  const { patrol } = loadGame();
  const loop = stroke(1, [[0,0],[40,0],[40,40],[0,40],[0,0]], true);
  const hit = patrol.nearest([loop], 2, -4, 8);
  assert.equal(hit.at, 2);
  assert.equal(hit.y, 0);
  assert.equal(patrol.nearest([loop], 20, 20, 8), null);
  const path = patrol.network([loop], hit).route(1,155);
  assert.equal(path.distance,7);
  assert.equal(path.legs[0].dir,1);
});

test("Rally is hidden before Page 3 and invalid taps do not spend ink or draw", () => {
  const { game, el, tap } = setup({ level: 2 });
  assert.equal(el("btn-rally").hidden,true);
  el("btn-rally").click();
  assert.equal(game.state().rallyArmed,false);
  game.start({ level:3, noMonsters:true, ink:1000 });
  trace(game,"blue",[40,100],[260,100]);
  const ink = game.state().ink;
  el("btn-rally").click();
  assert.equal(el("btn-rally").getAttribute("aria-pressed"),"true");
  assert.match(el("hint").textContent,/Tap a red line.*4 ink/);
  tap(180,100);
  assert.equal(game.state().ink,ink);
  assert.equal(game.state().strokes.length,1);
  assert.equal(game.state().rally,null);
  assert.equal(game.state().rallyArmed,true);
  el("btn-buddy").click();
  assert.equal(game.state().rallyArmed,false);
});

test("Rally redirects a doodle around a corner while isolated lines patrol normally", () => {
  const { game, order } = setup();
  const a = trace(game,"red",[40,100],[170,100]);
  const b = trace(game,"red",[150,80],[150,170]);
  const gap = trace(game,"red",[180,155],[275,155]);
  const ink = game.state().ink;
  order(158,160);
  const assigned = game.state();
  assert.equal(assigned.ink,ink-4);
  assert.equal(assigned.rally.strokeId,b.id);
  assert.equal(assigned.rally.x,150);
  assert.equal(assigned.rally.joins.length,1);
  const moving = assigned.critters.find(c => c.strokeId === a.id);
  const read = () => game.state().critters.find(c => c.id === moving.id);
  assert.equal(moving.rallied,true);
  assert.equal(assigned.critters.find(c => c.strokeId === gap.id).rallied,false);
  game.advance(.23);
  assert.equal(read().strokeId,a.id);
  assert.equal(read().y,100);
  assert.ok(read().x > moving.x && read().x < 150);
  game.advance(2);
  assert.equal(read().strokeId,b.id);
  assert.equal(read().x,150);
  assert.ok(read().y >= 138 && read().y <= 170);
  order(150,160);
  assert.equal(game.state().rally,null);
  assert.equal(read().rallied,false);
});

test("moving the pin costs ink, clearing it does not, and there are at most three responders", () => {
  const { game, el, tap, order } = setup();
  const a = trace(game,"red",[30,100],[365,100]);
  trace(game,"red",[150,48],[150,174]);
  order(280,100);
  assert.equal(game.state().critters.filter(c => c.rallied).length,3);
  const balance = game.state().ink;
  order(60,100);
  assert.equal(game.state().rally.strokeId,a.id);
  assert.equal(game.state().rally.x,60);
  assert.equal(game.state().ink,balance-4);
  game.setInk(3);
  el("btn-rally").click();
  tap(300,100);
  assert.equal(game.state().rally.x,60);
  assert.equal(game.state().ink,3);
  assert.match(el("hint").textContent,/Need 4 ink/);
  tap(60,100);
  assert.equal(game.state().rally,null);
  assert.equal(game.state().ink,3);
});

test("erasing the connector breaks the route, and erasing the pinned line removes the flag", () => {
  const { game, order, erase } = setup();
  const a = trace(game,"red",[40,85],[180,85]);
  trace(game,"red",[150,60],[150,190]);
  const b = trace(game,"red",[110,175],[240,175]);
  order(225,175);
  assert.ok(game.state().critters.some(c => c.strokeId === a.id && c.rallied));
  erase(150,126);
  const cut = game.state();
  assert.equal(cut.rally.strokeId,b.id);
  assert.equal(cut.rally.joins.length,0);
  assert.ok(cut.critters.filter(c => c.strokeId === a.id).every(c => !c.rallied));
  erase(222,175);
  assert.equal(game.state().rally,null);
  assert.ok(game.state().critters.every(c => !c.rallied));
});

test("a page fold clears a covered pin and restarting clears rally state", () => {
  const { game, el, order } = setup({ level:13 });
  trace(game,"red",[35,110],[175,110]);
  order(55,110);
  assert.ok(game.state().rally);
  game.advance(9.1);
  assert.equal(game.state().fold.side,"left");
  assert.equal(game.state().rally,null);
  game.start({ level:3, noMonsters:true, ink:1000 });
  trace(game,"red",[35,110],[175,110]);
  order(55,110);
  assert.ok(game.state().rally);
  el("btn-pause").click();
  el("btn-restart").click();
  assert.equal(game.state().rally,null);
  assert.equal(game.state().rallyArmed,false);
});
