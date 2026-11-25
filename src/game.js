/* Doodle Defense — original local prototype. Not a lane or tower game. */
(function () {
  "use strict";

  var DESIGN_W = 390;
  var DESIGN_H = 844;
  var FIELD_W = 390;
  var FIELD_H = 620;
  var SAVE_KEY = "doodle-defense-v1";
  var CRAYON = {
    blue: { fill: "#3d8fd8", dark: "#245f96", name: "Blue" },
    red: { fill: "#e05645", dark: "#9a2e24", name: "Red" },
    green: { fill: "#3ea15c", dark: "#226c36", name: "Green" },
  };

  var LEVELS = [
    {
      id: 1, name: "First Scribble",
      blurb: "Draw a line. Your doodles will walk it.",
      hint: "Pick a crayon, then draw a path.",
      goal: "house",
      house: { x: 200, y: 470, hp: 5 },
      puddles: [],
      stars: [],
      spawns: [
        { at: 5, x: 200, y: 20 },
        { at: 12, x: 20, y: 180 },
        { at: 20, x: 370, y: 160 },
        { at: 28, x: 80, y: 20 },
        { at: 38, x: 320, y: 30 },
      ],
    },
    {
      id: 2, name: "Loopy Guard",
      blurb: "A loop makes doodles walk in a circle.",
      hint: "Draw a loop around the house to guard it.",
      goal: "house",
      house: { x: 195, y: 300, hp: 5 },
      puddles: [],
      stars: [],
      spawns: [
        { at: 4, x: 195, y: 16 },
        { at: 8, x: 16, y: 300 },
        { at: 12, x: 374, y: 300 },
        { at: 18, x: 40, y: 16 },
        { at: 24, x: 350, y: 16 },
        { at: 32, x: 16, y: 500 },
        { at: 40, x: 374, y: 500 },
        { at: 50, x: 195, y: 16 },
      ],
    },
    {
      id: 3, name: "Puddle Splash",
      blurb: "Draw through a puddle to make swimmers.",
      hint: "Draw through the puddle to make swimmers.",
      goal: "stars",
      starsNeed: 5,
      house: { x: 320, y: 520, hp: 4 },
      puddles: [
        { x: 150, y: 240, r: 62 },
        { x: 220, y: 310, r: 48 },
      ],
      stars: [
        { x: 150, y: 240 },
        { x: 220, y: 310 },
        { x: 80, y: 200 },
        { x: 260, y: 180 },
        { x: 180, y: 390 },
      ],
      spawns: [
        { at: 6, x: 20, y: 80 },
        { at: 14, x: 200, y: 16 },
        { at: 24, x: 370, y: 200 },
        { at: 36, x: 20, y: 400 },
      ],
    },
    {
      id: 4, name: "Vine Fence",
      blurb: "Green vines can block scribble monsters.",
      hint: "Green vines can block the way.",
      goal: "house",
      house: { x: 80, y: 400, hp: 5 },
      puddles: [{ x: 260, y: 200, r: 44 }],
      stars: [],
      spawns: [
        { at: 4, x: 374, y: 80 },
        { at: 8, x: 374, y: 200 },
        { at: 12, x: 374, y: 340 },
        { at: 20, x: 374, y: 160 },
        { at: 26, x: 374, y: 420 },
        { at: 34, x: 374, y: 260 },
        { at: 44, x: 300, y: 16 },
        { at: 54, x: 374, y: 500 },
      ],
    },
    {
      id: 5, name: "Star Parade",
      blurb: "Mix loops, puddles, and vines to grab the stars.",
      hint: "Mix colors! Loops, puddles, and vines all help.",
      goal: "stars",
      starsNeed: 7,
      house: { x: 80, y: 110, hp: 4 },
      puddles: [{ x: 240, y: 360, r: 70 }],
      stars: [
        { x: 240, y: 360 },
        { x: 200, y: 120 },
        { x: 320, y: 200 },
        { x: 70, y: 280 },
        { x: 300, y: 480 },
        { x: 150, y: 500 },
        { x: 340, y: 90 },
      ],
      spawns: [
        { at: 5, x: 374, y: 300 },
        { at: 10, x: 200, y: 16 },
        { at: 16, x: 374, y: 500 },
        { at: 24, x: 20, y: 500 },
        { at: 34, x: 374, y: 160 },
        { at: 44, x: 160, y: 16 },
      ],
    },
  ];

  var DEFAULT_SAVE = {
    unlocked: 1,
    wins: {},
    settings: { diff: "easy", battery: "auto", sfx: true, music: true },
  };

  var save = loadSave();
  var screen = "menu";
  var play = null;
  var timeScale = 1;
  var lastDraw = 0;
  var hint = "";
  var hintUntil = 0;
  var lowBattery = false;
  var seq = 1;
  var menuT = 0;
  var paperTex = null;
  var scratchAcc = 0;

  function loadSave() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return jsonCopy(DEFAULT_SAVE);
      var s = JSON.parse(raw);
      var out = jsonCopy(DEFAULT_SAVE);
      if (s.unlocked) out.unlocked = s.unlocked;
      if (s.wins) out.wins = s.wins;
      if (s.settings) {
        if (s.settings.diff === "easy" || s.settings.diff === "normal") out.settings.diff = s.settings.diff;
        if (s.settings.battery) out.settings.battery = s.settings.battery;
        if (s.settings.sfx != null) out.settings.sfx = !!s.settings.sfx;
        if (s.settings.music != null) out.settings.music = !!s.settings.music;
      }
      return out;
    } catch (e) {
      return jsonCopy(DEFAULT_SAVE);
    }
  }
  function persist() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {}
  }
  function jsonCopy(o) { return JSON.parse(JSON.stringify(o)); }

  function applyAudioSettings() {
    if (window.DDAudio) window.DDAudio.setSettings({ sfx: save.settings.sfx, music: save.settings.music });
  }
  function fpsCap() {
    var mode = save.settings.battery;
    if (mode === "on") return 20;
    if (mode === "off") return 30;
    return lowBattery ? 20 : 30;
  }
  function dprCap() {
    var raw = window.devicePixelRatio || 1;
    var mode = save.settings.battery;
    if (mode === "on") return 1;
    if (mode === "off") return Math.min(2, raw);
    return Math.min(lowBattery ? 1 : 1.5, raw);
  }
  function saverOn() {
    return save.settings.battery === "on" || (save.settings.battery === "auto" && lowBattery);
  }
  function sfx(name) {
    if (window.DDAudio && window.DDAudio.sfx[name]) window.DDAudio.sfx[name]();
  }
  function easy() { return play && play.diff === "easy"; }

  function fitStage() {
    var stage = document.getElementById("stage");
    var s = Math.min(window.innerWidth / DESIGN_W, window.innerHeight / DESIGN_H);
    stage.style.transform = "translate(-50%, -50%) scale(" + s + ")";
  }
  function sizeCanvas(cv, cssW, cssH) {
    var dpr = dprCap();
    var w = Math.max(1, Math.round(cssW * dpr));
    var h = Math.max(1, Math.round(cssH * dpr));
    if (cv.width !== w || cv.height !== h) {
      cv.width = w;
      cv.height = h;
    }
    var ctx = cv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }
  function fieldSize() {
    var cv = document.getElementById("field");
    return { w: cv.clientWidth || FIELD_W, h: cv.clientHeight || FIELD_H };
  }
  function sx(x) { return x * fieldSize().w / FIELD_W; }
  function sy(y) { return y * fieldSize().h / FIELD_H; }
  function sxy(p) { return { x: sx(p.x), y: sy(p.y) }; }

  /* ---------- geometry ---------- */
  function dist(a, b) {
    var dx = a.x - b.x, dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function polylineLen(pts) {
    var L = 0;
    for (var i = 1; i < pts.length; i++) L += dist(pts[i - 1], pts[i]);
    return L;
  }
  function closedPts(pts) {
    if (pts.length < 2) return pts.slice();
    var a = pts[0], b = pts[pts.length - 1];
    if (Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5) return pts.slice();
    return pts.concat([a]);
  }
  function walk(pts, d) {
    if (!pts.length) return { x: 0, y: 0 };
    if (pts.length === 1 || d <= 0) return { x: pts[0].x, y: pts[0].y };
    var left = d;
    for (var i = 1; i < pts.length; i++) {
      var seg = dist(pts[i - 1], pts[i]);
      if (left <= seg || i === pts.length - 1) {
        var t = seg < 0.0001 ? 0 : clamp(left / seg, 0, 1);
        return { x: lerp(pts[i - 1].x, pts[i].x, t), y: lerp(pts[i - 1].y, pts[i].y, t) };
      }
      left -= seg;
    }
    var last = pts[pts.length - 1];
    return { x: last.x, y: last.y };
  }
  function pointAtStroke(st, d) {
    var pts = st.closed ? closedPts(st.pts) : st.pts;
    var L = polylineLen(pts);
    if (L < 1) return { x: st.pts[0].x, y: st.pts[0].y };
    if (st.closed) {
      d = ((d % L) + L) % L;
    } else {
      d = clamp(d, 0, L);
    }
    return walk(pts, d);
  }
  function segHit(px, py, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay;
    var l2 = dx * dx + dy * dy;
    var t = l2 < 0.0001 ? 0 : clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1);
    var x = ax + dx * t, y = ay + dy * t;
    var ddx = px - x, ddy = py - y;
    var d = Math.sqrt(ddx * ddx + ddy * ddy);
    var nx = 0, ny = -1;
    if (d > 0.0001) { nx = ddx / d; ny = ddy / d; }
    return { d: d, t: t, x: x, y: y, nx: nx, ny: ny };
  }
  function nearStroke(st, x, y, maxd) {
    var pts = st.closed ? closedPts(st.pts) : st.pts;
    var best = null;
    for (var i = 1; i < pts.length; i++) {
      var h = segHit(x, y, pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y);
      if (h.d <= maxd && (!best || h.d < best.d)) best = h;
    }
    return best;
  }
  function inPuddle(x, y, puddles) {
    for (var i = 0; i < puddles.length; i++) {
      var p = puddles[i];
      var dx = x - p.x, dy = y - p.y;
      if (dx * dx + dy * dy <= p.r * p.r) return p;
    }
    return null;
  }
  function strokeThroughPuddle(pts, puddles) {
    for (var i = 0; i < pts.length; i++) {
      if (inPuddle(pts[i].x, pts[i].y, puddles)) return true;
    }
    return false;
  }
  function isLoop(pts, length) {
    if (pts.length < 8 || length < 140) return false;
    return dist(pts[0], pts[pts.length - 1]) < 40;
  }

  /* ---------- play state ---------- */
  function beginLevel(id, opts) {
    opts = opts || {};
    var lv = LEVELS.find(function (x) { return x.id === id; }) || LEVELS[0];
    var diff = opts.diff || save.settings.diff || "easy";
    timeScale = opts.timeScale != null ? opts.timeScale : 1;
    var hp = opts.houseHp != null ? opts.houseHp : lv.house.hp + (diff === "easy" ? 1 : 0);
    var stars = (opts.stars || lv.stars || []).map(function (s) {
      return { x: sx(s.x), y: sy(s.y), taken: !!s.taken };
    });
    play = {
      id: lv.id,
      name: lv.name,
      blurb: lv.blurb,
      diff: diff,
      goal: lv.goal,
      t: 0,
      ink: opts.ink != null ? opts.ink : 100,
      inkMax: 100,
      tool: "blue",
      drawing: null,
      strokes: [],
      critters: [],
      monsters: [],
      parts: [],
      floats: [],
      house: { x: sx(lv.house.x), y: sy(lv.house.y), hp: hp, max: hp },
      puddles: (lv.puddles || []).map(function (p) {
        return { x: sx(p.x), y: sy(p.y), r: (p.r * (fieldSize().w / FIELD_W + fieldSize().h / FIELD_H)) / 2 };
      }),
      stars: stars,
      starsNeed: opts.starsNeed != null ? opts.starsNeed : (lv.starsNeed || 0),
      starsHave: opts.starsHave || 0,
      spawns: (opts.spawns || (opts.noMonsters ? [] : lv.spawns)).map(function (s) {
        return { at: s.at, x: sx(s.x), y: sy(s.y), done: false };
      }),
      spawnI: 0,
      ended: null,
      endTimer: 0,
      paused: false,
      firstDraw: false,
    };
    hint = lv.hint || "";
    hintUntil = 8;
    showScreen("play");
    closeModal("modal-pause");
    closeModal("modal-end");
    syncTools();
    updateHud();
    if (window.DDAudio) window.DDAudio.unlock();
  }

  function showScreen(name) {
    screen = name;
    ["menu", "levels", "how", "settings", "play"].forEach(function (s) {
      var el = document.getElementById("screen-" + s);
      if (el) el.classList.toggle("on", s === name);
    });
    if (name === "levels") renderLevels();
    if (name !== "play") {
      closeModal("modal-pause");
      closeModal("modal-end");
    }
  }
  function closeModal(id) {
    var el = document.getElementById(id);
    if (el) el.classList.remove("on");
  }
  function openModal(id) {
    var el = document.getElementById(id);
    if (el) el.classList.add("on");
  }
  function renderLevels() {
    var wrap = document.getElementById("level-list");
    wrap.innerHTML = "";
    LEVELS.forEach(function (lv) {
      var unlocked = save.unlocked >= lv.id;
      var b = document.createElement("button");
      b.className = "lvl" + (unlocked ? "" : " lock");
      b.setAttribute("data-testid", "level-" + lv.id);
      b.disabled = !unlocked;
      var won = !!save.wins[lv.id];
      var kind = lv.goal === "stars" ? "Collect stars" : "Protect the house";
      b.innerHTML = '<span class="num">' + (unlocked ? lv.id : "🔒") + '</span><span class="meta"><span class="name">' +
        lv.name + (won ? " ★" : "") + '</span><span class="sub">' +
        (unlocked ? kind + " — " + lv.blurb : "Finish the page before this one.") + "</span></span>";
      b.addEventListener("click", function () {
        if (!unlocked) return;
        sfx("tap");
        beginLevel(lv.id);
      });
      wrap.appendChild(b);
    });
  }
  function syncTools() {
    if (!play) return;
    Array.prototype.forEach.call(document.querySelectorAll("#tools .tool"), function (b) {
      b.classList.toggle("sel", b.getAttribute("data-tool") === play.tool);
    });
  }
  function showHint(msg, dur) {
    hint = msg;
    hintUntil = (play ? play.t : 0) + (dur || 2.5);
  }
  function updateHud() {
    if (!play) return;
    var ink = Math.max(0, Math.round(play.ink));
    document.getElementById("ink-count").textContent = String(ink);
    document.getElementById("ink-num").textContent = String(ink);
    document.getElementById("ink-fill").style.transform = "scaleX(" + (play.ink / play.inkMax) + ")";
    document.getElementById("level-name").textContent = play.name;
    document.getElementById("house-hp").textContent = String(Math.max(0, Math.ceil(play.house.hp)));
    document.getElementById("star-count").textContent = String(play.starsHave);
    var gi = document.getElementById("goal-icon");
    var gc = document.getElementById("goal-count");
    if (play.goal === "stars") {
      gi.textContent = "⭐";
      gc.textContent = play.starsHave + " / " + play.starsNeed;
    } else {
      gi.textContent = "🏠";
      gc.textContent = String(Math.max(0, Math.ceil(play.house.hp)));
    }
    var wl = document.getElementById("wave-label");
    if (play.ended === "win") wl.textContent = "What a doodle!";
    else if (play.ended === "lose") wl.textContent = "Smudged…";
    else if (play.goal === "stars") wl.textContent = "Collect " + play.starsNeed + " stars";
    else wl.textContent = "Protect the house";
    var hintEl = document.getElementById("hint");
    if (hint && play.t < hintUntil && !play.ended && !play.paused) {
      hintEl.textContent = hint;
      hintEl.classList.add("on");
    } else hintEl.classList.remove("on");
  }

  /* ---------- drawing input ---------- */
  function evPos(ev) {
    var cv = document.getElementById("field");
    var r = cv.getBoundingClientRect();
    if (!r.width || !r.height) return { x: 0, y: 0 };
    return {
      x: (ev.clientX - r.left) * (cv.clientWidth / r.width),
      y: (ev.clientY - r.top) * (cv.clientHeight / r.height),
    };
  }
  function inkCostPerPx() { return easy() ? 0.11 : 0.15; }
  function inkRefillPerSec() { return easy() ? 9 : 6.5; }

  function onFieldDown(ev) {
    if (!play || play.paused || play.ended) return;
    if (window.DDAudio) window.DDAudio.unlock();
    ev.preventDefault();
    var p = evPos(ev);
    if (play.tool === "eraser") {
      eraseAt(p.x, p.y);
      play.erasing = ev.pointerId;
      return;
    }
    if (play.ink < 4) {
      showHint("Need more ink!", 2);
      sfx("dry");
      return;
    }
    if (play.strokes.length >= 12) {
      showHint("That's a lot of doodles! Erase one first.", 2.4);
      return;
    }
    play.drawing = { color: play.tool, pts: [{ x: p.x, y: p.y }], pointerId: ev.pointerId };
    scratchAcc = 0;
    try { ev.currentTarget.setPointerCapture(ev.pointerId); } catch (e) {}
  }
  function onFieldMove(ev) {
    if (!play || play.paused || play.ended) return;
    var p = evPos(ev);
    if (play.erasing === ev.pointerId) {
      eraseAt(p.x, p.y);
      return;
    }
    if (!play.drawing || play.drawing.pointerId !== ev.pointerId) return;
    ev.preventDefault();
    var pts = play.drawing.pts;
    var last = pts[pts.length - 1];
    var d = dist(last, p);
    if (d < 4) return;
    var cost = d * inkCostPerPx();
    if (play.ink <= 0) {
      finishStroke();
      sfx("dry");
      showHint("Ink ran out!", 2);
      return;
    }
    if (cost > play.ink) {
      var allow = play.ink / inkCostPerPx();
      var t = allow / d;
      p = { x: last.x + (p.x - last.x) * t, y: last.y + (p.y - last.y) * t };
      d = dist(last, p);
      cost = play.ink;
    }
    play.ink = Math.max(0, play.ink - cost);
    pts.push(p);
    scratchAcc += d;
    if (scratchAcc > 36) { sfx("scratch"); scratchAcc = 0; }
    if (play.ink <= 0.01) finishStroke();
  }
  function onFieldUp(ev) {
    if (!play) return;
    if (play.erasing === ev.pointerId) play.erasing = null;
    if (play.drawing && (ev.pointerId == null || play.drawing.pointerId === ev.pointerId)) finishStroke();
  }

  function finishStroke() {
    if (!play || !play.drawing) return;
    var pts = play.drawing.pts;
    var color = play.drawing.color;
    play.drawing = null;
    commitStroke(color, pts);
  }

  function commitStroke(color, rawPts) {
    if (!play || play.ended) return null;
    var pts = simplify(rawPts, 3);
    var length = polylineLen(pts);
    if (pts.length < 2 || length < 28) {
      // refund tiny accidental marks
      play.ink = Math.min(play.inkMax, play.ink + length * inkCostPerPx());
      return null;
    }
    var closed = isLoop(pts, length);
    if (closed) pts = pts.concat([pts[0]]);
    var through = strokeThroughPuddle(pts, play.puddles);
    var st = {
      id: seq++,
      color: color,
      pts: pts,
      closed: closed,
      throughPuddle: through,
      length: polylineLen(pts),
    };
    play.strokes.push(st);
    play.firstDraw = true;
    sfx("drawEnd");
    if (through) sfx("splash");
    hatchCritters(st);
    if (closed) showHint("A loop! They'll walk in a circle.", 2.4);
    else if (through) showHint("Swimmers!", 2);
    return st;
  }

  function simplify(pts, minD) {
    if (pts.length <= 2) return pts.slice();
    var out = [pts[0]];
    for (var i = 1; i < pts.length; i++) {
      if (dist(out[out.length - 1], pts[i]) >= minD || i === pts.length - 1) out.push(pts[i]);
    }
    return out;
  }

  function hatchCritters(st) {
    var n = 1 + Math.floor(st.length / 140);
    if (n > 4) n = 4;
    var spd = 52;
    if (st.color === "red") spd = 88;
    if (st.color === "blue") spd = 48;
    if (st.color === "green") spd = 50;
    for (var i = 0; i < n; i++) {
      var t0 = st.length * ((i + 0.5) / n);
      var p = pointAtStroke(st, t0);
      play.critters.push({
        id: seq++,
        color: st.color,
        strokeId: st.id,
        t: t0,
        dir: 1,
        x: p.x,
        y: p.y,
        spd: spd,
        swim: st.throughPuddle,
        bob: Math.random() * 10,
      });
      puff(p.x, p.y, CRAYON[st.color].fill, 5);
    }
    sfx("hatch");
  }

  function eraseAt(x, y) {
    if (!play) return;
    var hit = null, hi = -1;
    for (var i = play.strokes.length - 1; i >= 0; i--) {
      var n = nearStroke(play.strokes[i], x, y, 22);
      if (n && (!hit || n.d < hit.d)) { hit = n; hi = i; }
    }
    if (hi < 0) return;
    var st = play.strokes[hi];
    var refund = st.length * inkCostPerPx() * 0.25;
    play.ink = Math.min(play.inkMax, play.ink + refund);
    play.critters.forEach(function (c) {
      if (c.strokeId === st.id) puff(c.x, c.y, "#f4a4b8", 4);
    });
    play.critters = play.critters.filter(function (c) { return c.strokeId !== st.id; });
    play.strokes.splice(hi, 1);
    sfx("erase");
    puff(x, y, "#f4d4c4", 6);
  }

  /* ---------- simulation ---------- */
  function updatePlay(dt) {
    if (!play || play.paused) return;
    if (play.ended) {
      play.endTimer += dt / Math.max(0.001, timeScale);
      if (play.endTimer > 0.7 && !document.getElementById("modal-end").classList.contains("on")) finishEnd();
      tickFx(dt);
      return;
    }
    play.t += dt;
    if (!play.drawing) {
      play.ink = Math.min(play.inkMax, play.ink + inkRefillPerSec() * dt);
    }
    spawnMonsters();
    tickCritters(dt);
    tickMonsters(dt);
    tickFx(dt);
    checkEnd();
    if (!play.firstDraw && play.t > 1) {
      hint = play.id === 1 ? "Pick a crayon, then draw a path." : (hint || "");
      hintUntil = play.t + 1;
    }
  }

  function spawnMonsters() {
    play.spawns.forEach(function (s) {
      if (!s.done && play.t >= s.at) {
        s.done = true;
        spawnMonster({ x: s.x, y: s.y });
      }
    });
  }

  function spawnMonster(opts) {
    opts = opts || {};
    var hp = opts.hp != null ? opts.hp : (easy() ? 14 : 18);
    var spd = opts.spd != null ? opts.spd : (easy() ? 28 : 34);
    var squiggle = [];
    var seed = seq * 17;
    for (var i = 0; i < 10; i++) {
      squiggle.push({
        x: Math.sin(seed * 0.7 + i * 1.7) * 10,
        y: Math.cos(seed * 0.5 + i * 1.3) * 9,
      });
    }
    var m = {
      id: seq++,
      x: opts.x,
      y: opts.y,
      hp: hp,
      max: hp,
      spd: spd,
      hurt: 0,
      nibbleCd: 0,
      squiggle: squiggle,
    };
    play.monsters.push(m);
    puff(m.x, m.y, "#6a6570", 4);
    return m;
  }

  function tickCritters(dt) {
    play.critters.forEach(function (c) {
      var st = play.strokes.find(function (s) { return s.id === c.strokeId; });
      if (!st) return;
      var spd = c.spd;
      if (c.swim && inPuddle(c.x, c.y, play.puddles)) spd *= 1.35;
      c.t += c.dir * spd * dt;
      if (st.closed) {
        var L = polylineLen(closedPts(st.pts));
        if (L < 1) return;
        c.t = ((c.t % L) + L) % L;
      } else {
        if (c.t >= st.length) { c.t = st.length; c.dir = -1; }
        if (c.t <= 0) { c.t = 0; c.dir = 1; }
      }
      var p = pointAtStroke(st, c.t);
      c.x = p.x;
      c.y = p.y;
      // collect stars
      play.stars.forEach(function (stt) {
        if (stt.taken) return;
        if (dist(c, stt) < 24) {
          stt.taken = true;
          play.starsHave += 1;
          sfx("star");
          floatText(stt.x, stt.y - 10, "Star!", "#c98910");
          puff(stt.x, stt.y, "#ffe57a", 8);
        }
      });
    });
  }

  function tickMonsters(dt) {
    var house = play.house;
    play.monsters.forEach(function (m) {
      if (m.hp <= 0) { m.hurt -= dt; return; }
      if (m.hurt > 0) m.hurt -= dt;
      m.nibbleCd = Math.max(0, m.nibbleCd - dt);
      // tickle from nearby critters
      var ticklers = 0;
      play.critters.forEach(function (c) {
        var r = 26 + (c.swim && inPuddle(m.x, m.y, play.puddles) ? 8 : 0);
        if (dist(c, m) < r) ticklers += 1;
      });
      if (ticklers) {
        m.hp -= ticklers * 8 * dt;
        m.hurt = 0.15;
        if (Math.random() < dt * 6) sfx("tickle");
        puff(m.x, m.y, "#fff3a0", 1);
        if (m.hp <= 0) {
          koMonster(m);
          return;
        }
      }
      var ang = Math.atan2(house.y - m.y, house.x - m.x);
      ang += Math.sin(play.t * 0.8 + m.id) * 0.35;
      var spd = m.spd;
      if (touchingColor(m, "blue", 16)) spd *= 0.45;
      if (inPuddle(m.x, m.y, play.puddles)) spd *= 0.7;
      var vx = Math.cos(ang) * spd;
      var vy = Math.sin(ang) * spd;
      var nx = m.x + vx * dt;
      var ny = m.y + vy * dt;
      var wall = vineHit(nx, ny, 13);
      if (wall) {
        m.x = wall.x + wall.nx * 14;
        m.y = wall.y + wall.ny * 14;
        var tx = -wall.ny, ty = wall.nx;
        var s = (vx * tx + vy * ty);
        s = s >= 0 ? 1 : -1;
        m.x += tx * s * spd * dt * 0.85;
        m.y += ty * s * spd * dt * 0.85;
      } else {
        m.x = nx;
        m.y = ny;
      }
      if (dist(m, house) < 30 && m.nibbleCd <= 0) {
        house.hp = Math.max(0, house.hp - 1);
        m.nibbleCd = 1.4;
        sfx("house");
        floatText(house.x, house.y - 28, "Smudge!", "#9a2e24");
        // bounce away a little
        var b = Math.atan2(m.y - house.y, m.x - house.x);
        m.x += Math.cos(b) * 22;
        m.y += Math.sin(b) * 22;
      }
    });
    play.monsters = play.monsters.filter(function (m) { return m.hp > 0 || m.hurt > -0.5; });
  }

  function touchingColor(m, color, rad) {
    for (var i = 0; i < play.strokes.length; i++) {
      var st = play.strokes[i];
      if (st.color !== color) continue;
      if (nearStroke(st, m.x, m.y, rad)) return true;
    }
    return false;
  }
  function vineHit(x, y, rad) {
    var best = null;
    for (var i = 0; i < play.strokes.length; i++) {
      var st = play.strokes[i];
      if (st.color !== "green") continue;
      var h = nearStroke(st, x, y, rad);
      if (h && (!best || h.d < best.d)) best = h;
    }
    return best;
  }
  function koMonster(m) {
    m.hp = 0;
    m.hurt = -0.01;
    puff(m.x, m.y, "#c8c0d0", 10);
    floatText(m.x, m.y - 12, "Dizzy!", "#5a4a62");
    sfx("pop");
    play.ink = Math.min(play.inkMax, play.ink + 4);
  }

  function puff(x, y, color, n) {
    if (!play) return;
    var cap = saverOn() ? 40 : 90;
    n = Math.min(n, cap - play.parts.length);
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2;
      var s = 18 + Math.random() * 40;
      play.parts.push({
        x: x, y: y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 8,
        life: 0.4 + Math.random() * 0.25,
        max: 0.65,
        color: color,
        size: 2.5 + Math.random() * 3,
      });
    }
  }
  function floatText(x, y, text, color) {
    play.floats.push({ x: x, y: y, text: text, color: color, life: 0.8 });
  }
  function tickFx(dt) {
    play.parts.forEach(function (p) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 36 * dt;
    });
    play.parts = play.parts.filter(function (p) { return p.life > 0; });
    play.floats.forEach(function (f) { f.life -= dt; f.y -= 20 * dt; });
    play.floats = play.floats.filter(function (f) { return f.life > 0; });
  }

  function checkEnd() {
    if (play.ended) return;
    if (play.house.hp <= 0) {
      play.house.hp = 0;
      play.ended = "lose";
      play.endTimer = 0;
      sfx("lose");
      return;
    }
    if (play.goal === "stars") {
      if (play.starsHave >= play.starsNeed) {
        play.ended = "win";
        play.endTimer = 0;
        sfx("win");
      }
      return;
    }
    var allOut = play.spawns.every(function (s) { return s.done; });
    var noneLeft = play.monsters.every(function (m) { return m.hp <= 0; });
    if (allOut && noneLeft && play.spawns.length) {
      play.ended = "win";
      play.endTimer = 0;
      sfx("win");
    }
  }

  function finishEnd() {
    var title = document.getElementById("end-title");
    var blurb = document.getElementById("end-blurb");
    if (play.ended === "win") {
      title.textContent = play.goal === "stars" ? "Starry work!" : "What a doodle!";
      blurb.textContent = "The page is safe and colorful. " + play.name + " is done.";
      title.setAttribute("data-end", "win");
      if (save.unlocked < play.id + 1 && play.id < 5) save.unlocked = play.id + 1;
      save.wins[play.id] = true;
      persist();
    } else {
      title.textContent = "The house got smudged!";
      blurb.textContent = "That's okay — draw a loop or a vine wall and try again.";
      title.setAttribute("data-end", "lose");
    }
    openModal("modal-end");
    updateHud();
  }

  /* ---------- drawing ---------- */
  function ensurePaper(w, h) {
    if (paperTex && paperTex.w === w && paperTex.h === h) return paperTex.cv;
    var cv = document.createElement("canvas");
    cv.width = w;
    cv.height = h;
    var ctx = cv.getContext("2d");
    ctx.fillStyle = "#f7edd4";
    ctx.fillRect(0, 0, w, h);
    var img = ctx.getImageData(0, 0, w, h);
    var d = img.data;
    for (var i = 0; i < d.length; i += 4) {
      var n = (Math.sin(i * 12.9898) * 43758.5453) % 1;
      if (n < 0) n += 1;
      var k = (n - 0.5) * 18;
      d[i] = clamp(d[i] + k, 0, 255);
      d[i + 1] = clamp(d[i + 1] + k * 0.9, 0, 255);
      d[i + 2] = clamp(d[i + 2] + k * 0.7, 0, 255);
    }
    ctx.putImageData(img, 0, 0);
    ctx.fillStyle = "rgba(180, 150, 110, 0.18)";
    for (var y = 14; y < h; y += 22) {
      for (var x = 12; x < w; x += 22) {
        ctx.beginPath();
        ctx.arc(x, y, 1.1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    paperTex = { cv: cv, w: w, h: h };
    return cv;
  }

  function paint() {
    var scene = document.getElementById("scene");
    var sctx = sizeCanvas(scene, DESIGN_W, DESIGN_H);
    if (screen === "play") {
      sctx.drawImage(ensurePaper(DESIGN_W, DESIGN_H), 0, 0);
      var field = document.getElementById("field");
      var fw = field.clientWidth || FIELD_W;
      var fh = field.clientHeight || FIELD_H;
      var fctx = sizeCanvas(field, fw, fh);
      drawField(fctx, fw, fh);
    } else {
      drawMenuScene(sctx, DESIGN_W, DESIGN_H, menuT);
    }
  }

  function drawMenuScene(ctx, w, h, t) {
    ctx.drawImage(ensurePaper(w, h), 0, 0);
    // decorative doodles behind the buttons
    crayonStroke(ctx, [
      { x: 40, y: 520 }, { x: 80, y: 470 }, { x: 140, y: 500 }, { x: 200, y: 430 },
      { x: 260, y: 490 }, { x: 330, y: 450 }, { x: 360, y: 510 },
    ], "red", 8, 1);
    crayonStroke(ctx, [
      { x: 50, y: 620 }, { x: 90, y: 680 }, { x: 160, y: 640 }, { x: 210, y: 720 },
      { x: 280, y: 660 }, { x: 340, y: 730 },
    ], "blue", 8, 2);
    crayonStroke(ctx, loopAround(195, 760, 70, 28), "green", 9, 3);
    drawHouse(ctx, 195, 760, 1, t, true);
    drawCritter(ctx, 90, 680, "blue", t, false, false);
    drawCritter(ctx, 250, 470, "red", t, false, false);
    drawCritter(ctx, 250, 730, "green", t, false, false);
    drawMonster(ctx, 330, 580, t, { squiggle: menuSquiggle, hurt: 0, hp: 1, max: 1 });
    // sun doodle
    ctx.save();
    ctx.translate(48, 46);
    ctx.strokeStyle = "#e6b43a";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.stroke();
    for (var i = 0; i < 8; i++) {
      var a = i * Math.PI / 4 + Math.sin(t) * 0.05;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 20, Math.sin(a) * 20);
      ctx.lineTo(Math.cos(a) * 28, Math.sin(a) * 28);
      ctx.stroke();
    }
    ctx.restore();
  }
  var menuSquiggle = [
    { x: -8, y: -4 }, { x: 6, y: -8 }, { x: 10, y: 3 }, { x: -4, y: 8 },
    { x: -10, y: 0 }, { x: 4, y: 6 }, { x: 8, y: -2 }, { x: -6, y: -6 }, { x: 2, y: 4 }, { x: 0, y: 0 },
  ];
  function loopAround(x, y, rx, ry) {
    var pts = [];
    for (var i = 0; i <= 16; i++) {
      var a = (i / 16) * Math.PI * 2;
      pts.push({ x: x + Math.cos(a) * rx, y: y + Math.sin(a) * ry });
    }
    return pts;
  }

  function drawField(ctx, w, h) {
    ctx.drawImage(ensurePaper(DESIGN_W, DESIGN_H), 0, 0, w, h);
    var t = play ? play.t : menuT;
    if (!play) return;
    // puddles first
    play.puddles.forEach(function (p) { drawPuddle(ctx, p, t); });
    // stars
    play.stars.forEach(function (s) { if (!s.taken) drawStar(ctx, s.x, s.y, t, false); });
    // finished strokes
    play.strokes.forEach(function (st) {
      crayonStroke(ctx, st.pts, st.color, st.color === "green" ? 11 : 9, st.id);
      if (st.color === "green") vineTicks(ctx, st);
    });
    // in-progress stroke
    if (play.drawing && play.drawing.pts.length) {
      crayonStroke(ctx, play.drawing.pts, play.drawing.color, 9, 99);
    }
    drawHouse(ctx, play.house.x, play.house.y, play.house.hp / play.house.max, t, false);
    play.critters.forEach(function (c) {
      var inP = c.swim && inPuddle(c.x, c.y, play.puddles);
      drawCritter(ctx, c.x, c.y, c.color, t + c.bob, false, !!inP);
    });
    play.monsters.forEach(function (m) {
      if (m.hp <= 0) ctx.globalAlpha = Math.max(0, 1 + m.hurt * 2);
      drawMonster(ctx, m.x, m.y, t, m);
      if (m.hp > 0) miniBar(ctx, m.x, m.y + 18, m.hp / m.max);
      ctx.globalAlpha = 1;
    });
    play.parts.forEach(function (p) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });
    play.floats.forEach(function (f) {
      ctx.globalAlpha = Math.max(0, f.life / 0.8);
      ctx.fillStyle = f.color;
      ctx.font = "800 13px Comic Sans MS, Trebuchet MS, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(f.text, f.x, f.y);
      ctx.globalAlpha = 1;
    });
  }

  function crayonStroke(ctx, pts, color, width, seed) {
    if (!pts || pts.length < 2) return;
    var pal = CRAYON[color] || CRAYON.blue;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    // waxy under-pass
    ctx.strokeStyle = pal.dark;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = width + 3;
    strokeWobble(ctx, pts, seed, 1.2);
    ctx.strokeStyle = pal.fill;
    ctx.globalAlpha = 0.92;
    ctx.lineWidth = width;
    strokeWobble(ctx, pts, seed + 3, 0.9);
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = "#fff8e6";
    ctx.lineWidth = Math.max(2, width * 0.28);
    strokeWobble(ctx, pts, seed + 7, 0.4, 0.6);
    ctx.restore();
  }
  function strokeWobble(ctx, pts, seed, amp, shift) {
    shift = shift || 0;
    ctx.beginPath();
    for (var i = 0; i < pts.length; i++) {
      var jx = (hash(i, seed) - 0.5) * amp * 2;
      var jy = (hash(i, seed + 9) - 0.5) * amp * 2;
      var x = pts[i].x + jx + shift;
      var y = pts[i].y + jy + shift;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  function hash(i, seed) {
    var x = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453;
    return x - Math.floor(x);
  }
  function vineTicks(ctx, st) {
    ctx.save();
    ctx.strokeStyle = "#2d7a3e";
    ctx.fillStyle = "#5fbf6e";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    var L = st.length;
    var step = 22;
    for (var d = 10; d < L; d += step) {
      var p = pointAtStroke(st, d);
      var q = pointAtStroke(st, Math.min(L, d + 6));
      var ang = Math.atan2(q.y - p.y, q.x - p.x) + Math.PI / 2;
      var side = (Math.floor(d / step) % 2) ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.quadraticCurveTo(
        p.x + Math.cos(ang) * 7 * side,
        p.y + Math.sin(ang) * 7 * side,
        p.x + Math.cos(ang) * 11 * side,
        p.y + Math.sin(ang) * 4 * side
      );
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(
        p.x + Math.cos(ang) * 11 * side,
        p.y + Math.sin(ang) * 4 * side,
        3.5, 2.2, ang, 0, Math.PI * 2
      );
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPuddle(ctx, p, t) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.sin(t * 0.4) * 0.03);
    ctx.fillStyle = "rgba(90, 170, 210, 0.35)";
    ctx.beginPath();
    ctx.ellipse(0, 0, p.r, p.r * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#3d8fd8";
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.ellipse(0, 0, p.r, p.r * 0.72, 0, 0.2, Math.PI * 1.6);
    ctx.stroke();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = "#fff8e6";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(-p.r * 0.25, -p.r * 0.2, p.r * 0.25, p.r * 0.1, -0.4, 0, Math.PI);
    ctx.stroke();
    ctx.restore();
  }

  function drawStar(ctx, x, y, t, small) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(t * 2 + x) * 0.15);
    var s = small ? 0.7 : 1;
    ctx.scale(s, s);
    ctx.fillStyle = "#ffd24a";
    ctx.strokeStyle = "#c98910";
    ctx.lineWidth = 2;
    starPath(ctx, 0, 0, 6, 13, 5);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  function starPath(ctx, x, y, r0, r1, n) {
    ctx.beginPath();
    for (var i = 0; i < n * 2; i++) {
      var r = i % 2 ? r0 : r1;
      var a = (i * Math.PI) / n - Math.PI / 2;
      if (i === 0) ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      else ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    ctx.closePath();
  }

  function drawHouse(ctx, x, y, hpFrac, t, tiny) {
    ctx.save();
    ctx.translate(x, y);
    var sc = tiny ? 0.85 : 1;
    ctx.scale(sc, sc);
    // tape
    ctx.fillStyle = "#f3e7a6";
    ctx.strokeStyle = "#d3c27a";
    ctx.lineWidth = 1;
    ctx.save();
    ctx.rotate(-0.4);
    ctx.fillRect(-28, -36, 16, 8);
    ctx.restore();
    ctx.save();
    ctx.rotate(0.5);
    ctx.fillRect(14, -34, 16, 8);
    ctx.restore();
    // sticker body
    ctx.fillStyle = "#fff8e6";
    ctx.strokeStyle = "#3a2a22";
    ctx.lineWidth = 3;
    roundish(ctx, -32, -22, 64, 48, 8);
    ctx.fill();
    ctx.stroke();
    // roof
    ctx.fillStyle = "#e05645";
    ctx.beginPath();
    ctx.moveTo(-38, -18);
    ctx.lineTo(0, -48 + Math.sin(t * 0.5) * 0.5);
    ctx.lineTo(38, -18);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // door
    ctx.fillStyle = "#c4894a";
    roundish(ctx, -8, -2, 16, 24, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffe17a";
    ctx.beginPath();
    ctx.arc(4, 10, 2, 0, Math.PI * 2);
    ctx.fill();
    // window
    ctx.fillStyle = "#8ec8f4";
    ctx.fillRect(12, -10, 12, 10);
    ctx.strokeRect(12, -10, 12, 10);
    // hearts
    var hearts = Math.max(0, Math.ceil(hpFrac * (tiny ? 3 : 5)));
    var maxH = tiny ? 3 : 5;
    if (hearts <= 0 && !tiny) {
      ctx.fillStyle = "#9a2e24";
      ctx.font = "800 11px Trebuchet MS, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("smudged", 0, 38);
    } else {
      for (var i = 0; i < maxH; i++) {
        miniHeart(ctx, (i - (maxH - 1) / 2) * 11, 34, i < hearts);
      }
    }
    ctx.restore();
  }
  function roundish(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
  }


  function miniHeart(ctx, x, y, on) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(0.85, 0.85);
    ctx.fillStyle = on ? "#e05645" : "rgba(58,42,34,0.18)";
    ctx.beginPath();
    ctx.moveTo(0, 5);
    ctx.bezierCurveTo(-7, 0, -6, -6, 0, -3);
    ctx.bezierCurveTo(6, -6, 7, 0, 0, 5);
    ctx.fill();
    ctx.restore();
  }
  function drawCritter(ctx, x, y, color, t, hurt, swim) {
    ctx.save();
    ctx.translate(x, y);
    var bob = Math.sin(t * 6) * 1.6;
    ctx.translate(0, bob);
    var pal = CRAYON[color] || CRAYON.blue;
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    ctx.beginPath();
    ctx.ellipse(0, 12, 10, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    if (hurt) ctx.globalAlpha = 0.75;
    ctx.fillStyle = pal.fill;
    ctx.strokeStyle = pal.dark;
    ctx.lineWidth = 2.2;
    if (color === "red") {
      ctx.beginPath();
      ctx.ellipse(0, 0, 13, 9, -0.2, 0, Math.PI * 2);
    } else if (color === "green") {
      ctx.beginPath();
      ctx.ellipse(0, 1, 11, 11, 0, 0, Math.PI * 2);
    } else {
      ctx.beginPath();
      ctx.ellipse(0, 1, 12, 10, 0, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.stroke();
    if (color === "green") {
      ctx.fillStyle = "#5fbf6e";
      ctx.beginPath();
      ctx.ellipse(-8, -10, 5, 3.5, -0.5, 0, Math.PI * 2);
      ctx.ellipse(8, -9, 5, 3.2, 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    if (color === "blue" && swim) {
      ctx.fillStyle = pal.dark;
      ctx.beginPath();
      ctx.ellipse(-12, 4, 5, 3, 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    if (color === "red") {
      ctx.strokeStyle = pal.dark;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-16, -2); ctx.lineTo(-22, -4);
      ctx.moveTo(-16, 3); ctx.lineTo(-21, 5);
      ctx.stroke();
    }
    // face
    ctx.fillStyle = "#3a2a22";
    ctx.beginPath();
    ctx.arc(-3.5, -1, 1.6, 0, Math.PI * 2);
    ctx.arc(3.5, -1, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f4b0c0";
    ctx.beginPath();
    ctx.ellipse(-6, 3, 2, 1.3, 0, 0, Math.PI * 2);
    ctx.ellipse(6, 3, 2, 1.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#3a2a22";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0, 3, 3, 0.15, Math.PI - 0.15);
    ctx.stroke();
    ctx.restore();
  }

  function drawMonster(ctx, x, y, t, m) {
    ctx.save();
    ctx.translate(x, y + Math.sin(t * 3 + (m.id || 1)) * 1.2);
    if (m.hurt > 0) ctx.globalAlpha = 0.7 + Math.sin(t * 30) * 0.3;
    ctx.strokeStyle = "#5a5562";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    var sq = m.squiggle || menuSquiggle;
    for (var i = 0; i < sq.length; i++) {
      var jx = sq[i].x, jy = sq[i].y;
      if (i === 0) ctx.moveTo(jx, jy);
      else ctx.lineTo(jx, jy);
    }
    ctx.stroke();
    ctx.fillStyle = "rgba(90, 85, 98, 0.25)";
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill();
    // face
    ctx.fillStyle = "#fff8e6";
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3a2a22";
    ctx.beginPath();
    ctx.arc(-2.8, -1, 1.4, 0, Math.PI * 2);
    ctx.arc(2.8, -1, 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#3a2a22";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-5, -5); ctx.lineTo(-2, -3.5);
    ctx.moveTo(5, -5); ctx.lineTo(2, -3.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 3.2, 3, Math.PI, 0, false);
    ctx.stroke();
    ctx.restore();
  }
  function miniBar(ctx, x, y, frac) {
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.fillRect(x - 12, y, 24, 3);
    ctx.fillStyle = "#7ad07a";
    ctx.fillRect(x - 12, y, 24 * Math.max(0, frac), 3);
  }

  /* ---------- loop / ui ---------- */
  function watchBattery() {
    if (!navigator.getBattery) return;
    navigator.getBattery().then(function (b) {
      function sync() { lowBattery = b.level <= 0.3 && !b.charging; }
      sync();
      b.addEventListener("levelchange", sync);
      b.addEventListener("chargingchange", sync);
    }).catch(function () {});
  }

  function frame(ts) {
    requestAnimationFrame(frame);
    var cap = fpsCap();
    if (lastDraw && ts - lastDraw < 1000 / cap - 1) return;
    var dt0 = Math.min(0.05, (ts - (lastDraw || ts)) / 1000);
    lastDraw = ts;
    if (document.hidden) return;
    menuT += dt0;
    if (play && !play.paused && screen === "play") {
      var steps = timeScale > 1 ? Math.min(8, Math.ceil(timeScale)) : 1;
      var sim = (dt0 * timeScale) / steps;
      for (var i = 0; i < steps; i++) updatePlay(sim);
      updateHud();
    } else if (play && screen === "play") updateHud();
    paint();
  }

  function bindUI() {
    document.getElementById("btn-play").addEventListener("click", function () {
      if (window.DDAudio) window.DDAudio.unlock();
      sfx("tap");
      showScreen("levels");
    });
    document.getElementById("btn-how").addEventListener("click", function () {
      if (window.DDAudio) window.DDAudio.unlock();
      sfx("tap");
      showScreen("how");
    });
    document.getElementById("btn-settings").addEventListener("click", function () {
      if (window.DDAudio) window.DDAudio.unlock();
      sfx("tap");
      syncSettingButtons();
      showScreen("settings");
    });
    document.getElementById("btn-levels-back").addEventListener("click", function () { sfx("tap"); showScreen("menu"); });
    document.getElementById("btn-how-back").addEventListener("click", function () { sfx("tap"); showScreen("menu"); });
    document.getElementById("btn-set-back").addEventListener("click", function () { sfx("tap"); showScreen("menu"); });
    document.getElementById("btn-pause").addEventListener("click", function () {
      if (!play || play.ended) return;
      play.paused = true;
      if (play.drawing) finishStroke();
      openModal("modal-pause");
      sfx("tap");
    });
    document.getElementById("btn-resume").addEventListener("click", function () {
      if (play) play.paused = false;
      closeModal("modal-pause");
      sfx("tap");
    });
    document.getElementById("btn-quit").addEventListener("click", function () {
      play = null;
      closeModal("modal-pause");
      sfx("tap");
      showScreen("levels");
    });
    document.getElementById("btn-again").addEventListener("click", function () {
      sfx("tap");
      if (play) beginLevel(play.id, { diff: play.diff });
    });
    document.getElementById("btn-end-levels").addEventListener("click", function () {
      sfx("tap");
      play = null;
      closeModal("modal-end");
      showScreen("levels");
    });
    Array.prototype.forEach.call(document.querySelectorAll("#tools .tool"), function (b) {
      b.addEventListener("click", function () {
        if (!play) return;
        play.tool = b.getAttribute("data-tool");
        sfx("select");
        syncTools();
      });
    });
    var field = document.getElementById("field");
    field.addEventListener("pointerdown", onFieldDown);
    field.addEventListener("pointermove", onFieldMove);
    field.addEventListener("pointerup", onFieldUp);
    field.addEventListener("pointercancel", onFieldUp);
    bindSeg("set-diff", function (v) { save.settings.diff = v; persist(); });
    bindSeg("set-bat", function (v) { save.settings.battery = v; persist(); });
    bindSeg("set-sfx", function (v) { save.settings.sfx = v === "on"; persist(); applyAudioSettings(); });
    bindSeg("set-mus", function (v) { save.settings.music = v === "on"; persist(); applyAudioSettings(); });
    document.addEventListener("pointerdown", function () {
      if (window.DDAudio) window.DDAudio.unlock();
    });
  }
  function bindSeg(id, fn) {
    var root = document.getElementById(id);
    Array.prototype.forEach.call(root.querySelectorAll("button"), function (b) {
      b.addEventListener("click", function () {
        Array.prototype.forEach.call(root.querySelectorAll("button"), function (x) { x.classList.remove("on"); });
        b.classList.add("on");
        fn(b.getAttribute("data-val"));
        sfx("tap");
      });
    });
  }
  function syncSettingButtons() {
    function set(id, val) {
      Array.prototype.forEach.call(document.getElementById(id).querySelectorAll("button"), function (b) {
        b.classList.toggle("on", b.getAttribute("data-val") === val);
      });
    }
    set("set-diff", save.settings.diff);
    set("set-bat", save.settings.battery);
    set("set-sfx", save.settings.sfx ? "on" : "off");
    set("set-mus", save.settings.music ? "on" : "off");
  }

  function snapshot() {
    if (!play) return { screen: screen, play: null };
    return {
      screen: screen,
      ended: play.ended,
      t: play.t,
      ink: play.ink,
      tool: play.tool,
      drawing: !!(play.drawing && play.drawing.pts.length),
      drawPts: play.drawing ? play.drawing.pts.length : 0,
      timeScale: timeScale,
      diff: play.diff,
      goal: play.goal,
      houseHp: play.house.hp,
      house: { x: play.house.x, y: play.house.y, hp: play.house.hp, max: play.house.max },
      stars: play.stars.map(function (s) { return { x: s.x, y: s.y, taken: !!s.taken }; }),
      starsHave: play.starsHave,
      starsNeed: play.starsNeed,
      strokes: play.strokes.map(function (s) {
        return { id: s.id, color: s.color, closed: s.closed, throughPuddle: s.throughPuddle, length: s.length, n: s.pts.length };
      }),
      critters: play.critters.map(function (c) {
        return { id: c.id, color: c.color, strokeId: c.strokeId, t: c.t, x: c.x, y: c.y };
      }),
      monsters: play.monsters.map(function (m) {
        return { id: m.id, x: m.x, y: m.y, hp: m.hp };
      }),
    };
  }

  window.DD = {
    start: function (opts) {
      opts = opts || {};
      beginLevel(opts.level || 1, opts);
      return snapshot();
    },
    screen: function () { return screen; },
    state: snapshot,
    setTool: function (id) { if (play) { play.tool = id; syncTools(); } },
    setInk: function (n) { if (play) { play.ink = clamp(n, 0, play.inkMax); updateHud(); } },
    setTimeScale: function (n) { timeScale = Math.max(0.1, n); },
    setHouseHp: function (n) { if (play) { play.house.hp = n; updateHud(); } },
    drawStroke: function (pts, color) {
      if (!play) return null;
      var mapped = pts.map(function (p) { return { x: p.x, y: p.y }; });
      var before = play.ink;
      var len = polylineLen(mapped);
      play.ink = Math.max(0, play.ink - len * inkCostPerPx());
      return commitStroke(color || play.tool, mapped);
    },
    spawnMonster: function (opts) { return play ? spawnMonster(opts) : null; },
    addStars: function (n) { if (play) { play.starsHave += n; updateHud(); } },
    levels: LEVELS,
  };

  function boot() {
    fitStage();
    window.addEventListener("resize", fitStage);
    applyAudioSettings();
    syncSettingButtons();
    bindUI();
    watchBattery();
    showScreen("menu");
    requestAnimationFrame(frame);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
