/* Doodle Defense — original local prototype. Not a lane or tower game. */
(function () {
  "use strict";

  var DESIGN_W = 390;
  var DESIGN_H = 844;
  var FIELD_W = 390;
  var FIELD_H = 620;
  var SAVE_KEY = "doodle-defense-v3";
  var SAVE_KEY_OLD = "doodle-defense-v2";
  var MAX_STROKES = 22;
  var CRAYON = {
    blue: { fill: "#3d8fd8", dark: "#245f96", name: "Blue" },
    red: { fill: "#e05645", dark: "#9a2e24", name: "Red" },
    green: { fill: "#3ea15c", dark: "#226c36", name: "Green" },
    yellow: { fill: "#e8c130", dark: "#9a7a12", name: "Zap" },
    purple: { fill: "#8a5ad4", dark: "#55308a", name: "Blink" },
  };
  var LEVELS = window.DD_LEVELS || [];
  var WORLDS = window.DD_WORLDS || [];

  var DEFAULT_SAVE = {
    unlocked: 1,
    wins: {},
    stars: {},
    crayons: { yellow: false, purple: false },
    endlessBest: 0,
    nightmare: false,
    settings: { diff: "normal", battery: "auto", sfx: true, music: true },
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
      var migrated = false;
      if (!raw) {
        raw = localStorage.getItem(SAVE_KEY_OLD);
        migrated = !!raw;
      }
      if (!raw) return jsonCopy(DEFAULT_SAVE);
      var s = JSON.parse(raw);
      var out = jsonCopy(DEFAULT_SAVE);
      if (!migrated) {
        if (s.unlocked) out.unlocked = s.unlocked;
        if (s.wins) out.wins = s.wins;
        if (s.stars) out.stars = s.stars;
        if (s.crayons) {
          out.crayons.yellow = !!s.crayons.yellow;
          out.crayons.purple = !!s.crayons.purple;
        }
        if (typeof s.endlessBest === "number") out.endlessBest = s.endlessBest;
      }
      if (s.nightmare && !migrated) out.nightmare = true;
      if (s.settings) {
        if (s.settings.diff === "easy" || s.settings.diff === "normal" || s.settings.diff === "hard" || (s.settings.diff === "nightmare" && out.nightmare)) {
          out.settings.diff = s.settings.diff;
        } else if (migrated) {
          out.settings.diff = "normal";
        }
        if (s.settings.battery) out.settings.battery = s.settings.battery;
        if (s.settings.sfx != null) out.settings.sfx = !!s.settings.sfx;
        if (s.settings.music != null) out.settings.music = !!s.settings.music;
      } else if (migrated) {
        out.settings.diff = "normal";
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
    if (st.closed) d = ((d % L) + L) % L;
    else d = clamp(d, 0, L);
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
    if (!st || !st.pts) return null;
    var pts = st.closed ? closedPts(st.pts) : st.pts;
    var best = null;
    for (var i = 1; i < pts.length; i++) {
      var mid = { x: (pts[i - 1].x + pts[i].x) / 2, y: (pts[i - 1].y + pts[i].y) / 2 };
      if (foldedAt(mid.x, mid.y)) continue;
      var h = segHit(x, y, pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y);
      if (h.d <= maxd && (!best || h.d < best.d)) best = h;
    }
    return best;
  }
  function inPuddle(x, y, puddles) {
    puddles = puddles || (play ? play.puddles : []);
    for (var i = 0; i < puddles.length; i++) {
      var p = puddles[i];
      var dx = x - p.x, dy = y - p.y;
      if (dx * dx + dy * dy <= p.r * p.r) return p;
    }
    return null;
  }
  function inStain(x, y) {
    if (!play) return null;
    for (var i = 0; i < play.stains.length; i++) {
      var p = play.stains[i];
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
  function pointInPoly(x, y, pts) {
    var inside = false;
    for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      var xi = pts[i].x, yi = pts[i].y, xj = pts[j].x, yj = pts[j].y;
      var hit = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / ((yj - yi) || 0.0001) + xi);
      if (hit) inside = !inside;
    }
    return inside;
  }
  function segIntersect(a, b, c, d) {
    var rx = b.x - a.x, ry = b.y - a.y;
    var sx = d.x - c.x, syv = d.y - c.y;
    var den = rx * syv - ry * sx;
    if (Math.abs(den) < 1e-6) return null;
    var t = ((c.x - a.x) * syv - (c.y - a.y) * sx) / den;
    var u = ((c.x - a.x) * ry - (c.y - a.y) * rx) / den;
    if (t >= -0.001 && t <= 1.001 && u >= -0.001 && u <= 1.001) {
      return { x: a.x + t * rx, y: a.y + t * ry };
    }
    return null;
  }
  function strokeIntersections(a, b) {
    var hits = [];
    var pa = a.closed ? closedPts(a.pts) : a.pts;
    var pb = b.closed ? closedPts(b.pts) : b.pts;
    for (var i = 1; i < pa.length; i++) {
      for (var j = 1; j < pb.length; j++) {
        var p = segIntersect(pa[i - 1], pa[i], pb[j - 1], pb[j]);
        if (p) hits.push(p);
      }
    }
    return hits;
  }
  function comboKind(c1, c2) {
    var arr = [c1, c2].sort();
    var s = arr[0] + "x" + arr[1];
    if (s === "bluexred") return "splash";
    if (s === "bluexgreen") return "bush";
    if (s === "greenxred") return "thorn";
    return null;
  }
  function cornersOf(pts) {
    if (pts.length < 4) return [];
    var ring = closedPts(pts);
    var corners = [];
    for (var i = 1; i < ring.length - 1; i++) {
      var a = ring[i - 1], b = ring[i], c = ring[i + 1];
      var a1 = Math.atan2(b.y - a.y, b.x - a.x);
      var a2 = Math.atan2(c.y - b.y, c.x - b.x);
      var dang = a2 - a1;
      while (dang > Math.PI) dang -= Math.PI * 2;
      while (dang < -Math.PI) dang += Math.PI * 2;
      if (Math.abs(dang) > 0.7) {
        if (!corners.length || dist(corners[corners.length - 1], b) > 22) corners.push({ x: b.x, y: b.y });
        else corners[corners.length - 1] = b;
      }
    }
    if (corners.length > 1 && dist(corners[0], corners[corners.length - 1]) < 22) corners.pop();
    return corners;
  }
  function isTriangle(pts) {
    var c = cornersOf(pts);
    if (c.length !== 3) return false;
    var ab = dist(c[0], c[1]), bc = dist(c[1], c[2]), ca = dist(c[2], c[0]);
    if (ab < 36 || bc < 36 || ca < 36) return false;
    return true;
  }
  function triangleCentroid(pts) {
    var c = cornersOf(pts);
    if (c.length !== 3) return { x: pts[0].x, y: pts[0].y, corners: c };
    return { x: (c[0].x + c[1].x + c[2].x) / 3, y: (c[0].y + c[1].y + c[2].y) / 3, corners: c };
  }
  function foldedAt(x, y) {
    if (!play || !play.fold) return false;
    var f = play.fold;
    var w = fieldSize().w;
    var cover = f.cover * w;
    if (f.side === "right") return x > w - cover;
    return x < cover;
  }
  function strokeFolded(st) {
    if (!play || !play.fold) return false;
    var n = 0, hid = 0;
    for (var i = 0; i < st.pts.length; i += Math.max(1, Math.floor(st.pts.length / 6))) {
      n++;
      if (foldedAt(st.pts[i].x, st.pts[i].y)) hid++;
    }
    return n > 0 && hid >= n * 0.6;
  }

  /* ---------- tuning ---------- */
  var DIFF_ORDER = ["easy", "normal", "hard", "nightmare"];
  var DIFFS = {
    easy:      { lives: 5, ink: 1.5,  refill: 3.0,  hp: 0.8,  spd: 0.9,  kill: 3,   live: 1.0, bonus: 1.5, esc: 0 },
    normal:    { lives: 3, ink: 1.0,  refill: 0.12, hp: 1.25, spd: 1.0,  kill: 0.6, live: 1.5, bonus: 0.5, esc: 0.16 },
    hard:      { lives: 2, ink: 0.85, refill: 0,    hp: 1.5,  spd: 1.15, kill: 0.2, live: 1.8, bonus: 0.25, esc: 0.16 },
    nightmare: { lives: 1, ink: 0.7,  refill: 0,    hp: 1.9,  spd: 1.3,  kill: 0,   live: 2.2, bonus: 0.1, esc: 0.2 },
  };
  var BASE_COST = 0.14;
  var COLOR_COST = { blue: 0.8, red: 1.2, green: 1.4, yellow: 1.5, purple: 1.3 };
  var KIND_STATS = {
    scribble: { hp: 18, spd: 34 },
    jumper:   { hp: 16, spd: 38 },
    eater:    { hp: 21, spd: 28 },
    splitter: { hp: 19, spd: 32 },
    sneaky:   { hp: 15, spd: 36 },
    armored:  { hp: 30, spd: 26 },
    healer:   { hp: 14, spd: 24 },
    flyer:    { hp: 16, spd: 42 },
  };
  var BOSS_STATS = {
    smudge: { hp: 120, spd: 20, name: "Big Smudge" },
    nibble: { hp: 130, spd: 22, name: "Nibblewick" },
    hidey:  { hp: 140, spd: 24, name: "Hidey Storm" },
  };
  var KIND_NAME = {
    scribble: "Scribble", jumper: "Hopper", eater: "Eraser-bug", splitter: "Splitter",
    sneaky: "Sneaky", armored: "Armored", healer: "Healer", flyer: "Flyer", boss: "Boss",
  };
  var KIND_TIP = {
    armored: "Armored: tickles barely work. Use thorns, splashes, Zap, or a launch pad.",
    flyer: "Flyers soar over your lines. Use a triangle launch pad or a splash burst.",
    healer: "Healers mend the others. Pop them first with a splash or thorns.",
    sneaky: "Sneaky ones hide. Lay a blue line (or a splash) to reveal them.",
    eater: "Eraser-bugs eat lines. Give them a small decoy line to chew.",
    jumper: "Hoppers leap over vines. Loops, blue and thorns still work.",
    splitter: "Splitters become two. Keep damage coming so both pop.",
  };
  var rngState = 1;
  function seedRng(s) { rngState = (s >>> 0) || 1; }
  function rng() {
    rngState = (rngState + 0x6D2B79F5) | 0;
    var t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function D() {
    var d = play ? play.diff : (save && save.settings.diff);
    return DIFFS[d] || DIFFS.normal;
  }
  var manual = false;

  /* ---------- play state ---------- */
  function emptyPlay(o) {
    return {
      id: o.id, name: o.name, blurb: o.blurb || "", diff: o.diff, goal: o.goal,
      boss: o.boss || null, adapt: !!o.adapt, endless: !!o.endless,
      t: 0, ink: o.ink, inkMax: o.inkMax, inkSlow: 0, refill: o.refill,
      tool: "blue", drawing: null, strokes: [], critters: [], monsters: [], parts: [], floats: [],
      combos: [], pads: [],
      house: o.house, puddles: o.puddles || [], stains: o.stains || [], blots: o.blots || [],
      lanes: o.lanes || [], wind: o.wind || null, fold: o.fold || null,
      stars: o.stars || [], starsNeed: o.starsNeed || 0, starsHave: o.starsHave || 0,
      waves: o.waves || [], waveIdx: 0,
      phase: (o.waves && o.waves.length) ? "plan" : "free",
      waveClock: 0, pending: [], wave: 0, nextWaveAt: 0, autoStart: !!o.autoStart,
      score: 0, leaks: 0, houseHurt: false, usedCombo: false, zapT: 0,
      ended: null, endReason: "", endTimer: 0, rating: 0, rules: null,
      paused: false, firstDraw: false,
    };
  }

  function beginLevel(id, opts) {
    opts = opts || {};
    var lv = LEVELS.find(function (x) { return x.id === id; }) || LEVELS[0];
    var diff = opts.diff || save.settings.diff || "normal";
    if (!DIFFS[diff]) diff = "normal";
    var d = DIFFS[diff];
    seedRng(lv.id * 7919 + DIFF_ORDER.indexOf(diff) * 131 + 17);
    seq = 1;
    timeScale = opts.timeScale != null ? opts.timeScale : 1;
    var inkMax = opts.inkMax != null ? opts.inkMax : Math.round((lv.ink || 150) * d.ink);
    var ink = opts.ink != null ? opts.ink : inkMax;
    if (ink > inkMax) inkMax = ink;
    var lives = opts.houseHp != null ? opts.houseHp : d.lives;
    var fs = fieldSize();
    var scale = (fs.w / FIELD_W + fs.h / FIELD_H) / 2;
    var waves = opts.noMonsters ? [] : (opts.waves || lv.waves || []);
    play = emptyPlay({
      id: lv.id, name: lv.name, blurb: lv.blurb, diff: diff, goal: lv.goal,
      boss: lv.boss, adapt: lv.adapt, ink: ink, inkMax: inkMax, refill: d.refill,
      house: { x: sx(lv.house.x), y: sy(lv.house.y), hp: lives, max: lives },
      puddles: (lv.puddles || []).map(function (p) {
        return { x: sx(p.x), y: sy(p.y), r: p.r * scale, vx: p.vx ? sx(p.vx) - sx(0) : 0, vy: p.vy ? sy(p.vy) - sy(0) : 0 };
      }),
      stains: (lv.stains || []).map(function (p) { return { x: sx(p.x), y: sy(p.y), r: p.r * scale }; }),
      blots: (lv.blots || []).map(function (p) { return { x: sx(p.x), y: sy(p.y), r: p.r * scale }; }),
      lanes: (lv.lanes || []).map(function (L) { return L.map(function (p) { return { x: sx(p[0]), y: sy(p[1]) }; }); }),
      wind: lv.wind ? { ax: lv.wind.ax, ay: lv.wind.ay } : null,
      fold: lv.fold ? { side: lv.fold.start || "right", cover: lv.fold.cover || 0.3, period: lv.fold.period || 9, t: 0 } : null,
      stars: (opts.stars || lv.stars || []).map(function (s) { return { x: sx(s.x), y: sy(s.y), taken: !!s.taken }; }),
      starsNeed: opts.starsNeed != null ? opts.starsNeed : (lv.starsNeed || 0),
      starsHave: opts.starsHave || 0,
      waves: waves.map(function (w) { return w.map(function (it) { return { kind: it.kind, boss: it.boss || null, lane: it.lane, dt: it.dt }; }); }),
      autoStart: !!opts.autoStart,
    });
    hint = lv.hint || "";
    hintUntil = 8;
    showScreen("play");
    closeModal("modal-pause");
    closeModal("modal-end");
    syncTools();
    enterPlanIfNeeded();
    updateHud();
    if (window.DDAudio) window.DDAudio.unlock();
  }

  function beginEndless(opts) {
    opts = opts || {};
    var diff = opts.diff || save.settings.diff || "normal";
    if (!DIFFS[diff]) diff = "normal";
    var d = DIFFS[diff];
    seedRng(99991 + DIFF_ORDER.indexOf(diff));
    seq = 1;
    timeScale = opts.timeScale != null ? opts.timeScale : 1;
    var lives = opts.houseHp != null ? opts.houseHp : d.lives + 2;
    var inkMax = Math.round(130 * d.ink);
    var ink = opts.ink != null ? opts.ink : inkMax;
    if (ink > inkMax) inkMax = ink;
    var scale = (fieldSize().w / FIELD_W + fieldSize().h / FIELD_H) / 2;
    play = emptyPlay({
      id: 0, name: "Endless Sketch", blurb: "How long can you keep the page clean?",
      diff: diff, goal: "house", endless: true, adapt: true,
      ink: ink, inkMax: inkMax, refill: d.refill === 0 ? 0.5 : d.refill * 3.4,
      house: { x: sx(195), y: sy(460), hp: lives, max: lives },
      puddles: [{ x: sx(80), y: sy(200), r: 40 * scale, vx: sx(16) - sx(0), vy: sy(8) - sy(0) }],
    });
    play.nextWaveAt = 3;
    hint = save.crayons.yellow || save.crayons.purple ? "Use every crayon you've unlocked. Waves keep coming!" : "Draw a loop around the house, then mix your colors!";
    hintUntil = 8;
    showScreen("play");
    closeModal("modal-pause");
    closeModal("modal-end");
    syncTools();
    updateHud();
    if (window.DDAudio) window.DDAudio.unlock();
  }

  function waveSummary(items) {
    var counts = {};
    var order = [];
    items.forEach(function (it) {
      var k = it.kind === "boss" ? "boss:" + it.boss : it.kind;
      if (!counts[k]) { counts[k] = 0; order.push(k); }
      counts[k] += 1;
    });
    return order.map(function (k) {
      var n = counts[k];
      var nm = k.indexOf("boss:") === 0 ? BOSS_STATS[k.slice(5)].name : (KIND_NAME[k] || k);
      if (n > 1 && k.indexOf("boss:") !== 0) nm = nm.replace(/ug$/, "ug") + "s";
      return { key: k, n: n, name: nm };
    });
  }
  function enterPlanIfNeeded() {
    if (!play || play.phase !== "plan") return;
    if (play.autoStart) { startWave(); return; }
    var items = play.waves[play.waveIdx] || [];
    var tipKinds = [];
    items.forEach(function (it) {
      var k = it.kind === "adapt" ? null : it.kind;
      if (k && KIND_TIP[k] && tipKinds.indexOf(k) < 0) tipKinds.push(k);
    });
    hint = tipKinds.length ? KIND_TIP[tipKinds[tipKinds.length > 1 ? 1 : 0]] : "Plan your lines, then press Start.";
    if (tipKinds.length > 1 && play.waveIdx === 0) hint = KIND_TIP[tipKinds[0]];
    if (items.some(function (it) { return it.kind === "boss"; })) hint = "Boss wave! It changes tactics as it gets hurt.";
    hintUntil = play.t + 99999;
  }
  function startWave() {
    if (!play || play.phase !== "plan" || play.ended) return false;
    var items = play.waves[play.waveIdx];
    if (!items) return false;
    var clock = 0;
    play.pending = items.map(function (it) {
      var dt = it.dt != null ? it.dt : clock;
      clock = dt + 1.3;
      return { kind: it.kind, boss: it.boss, lane: it.lane, dt: dt, done: false };
    });
    play.waveIdx += 1;
    play.wave = play.waveIdx;
    play.phase = "wave";
    play.waveClock = 0;
    hintUntil = play.t;
    sfx("wave");
    floatText(sx(195), sy(36), "Wave " + play.waveIdx + "!", "#3a2a22");
    return true;
  }
  function currentWave() { return play ? (play.endless ? play.wave : Math.max(1, play.waveIdx)) : 0; }
  function maxWave() { return play && !play.endless ? play.waves.length : 0; }

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
  function crayonUnlocked(tool) {
    if (tool === "yellow") return !!save.crayons.yellow;
    if (tool === "purple") return !!save.crayons.purple;
    return true;
  }
  function renderLevels() {
    var wrap = document.getElementById("level-list");
    wrap.innerHTML = "";
    var tag = document.getElementById("levels-tag");
    if (tag) {
      var dn = save.settings.diff;
      if (dn === "easy") tag.textContent = "Easy is on. Lots of ink and extra hearts.";
      else if (dn === "hard") tag.textContent = "Hard is on. Less ink, 2 hearts, tougher scribbles.";
      else if (dn === "nightmare") tag.textContent = "Nightmare is on. One heart. Every line counts.";
      else tag.textContent = "Normal is on. A tight ink budget, so plan each line.";
    }
    WORLDS.forEach(function (w) {
      var card = document.createElement("div");
      card.className = "world";
      card.setAttribute("data-testid", "world-" + w.id);
      var h = document.createElement("h3");
      h.textContent = w.name;
      card.appendChild(h);
      var row = document.createElement("div");
      row.className = "world-pages";
      var ids = w.pages.concat([w.boss]);
      ids.forEach(function (id) {
        var unlocked = save.unlocked >= id;
        var b = document.createElement("button");
        var isBoss = id === w.boss;
        b.className = "pg" + (isBoss ? " boss" : "") + (unlocked ? "" : " lock");
        b.setAttribute("data-testid", "level-" + id);
        b.disabled = !unlocked;
        var stars = save.stars[id] || 0;
        var starTxt = stars ? "★".repeat(stars) + "☆".repeat(Math.max(0, 3 - stars)) : (save.wins[id] ? "★" : " ");
        b.innerHTML = '<span class="num">' + (unlocked ? (isBoss ? "♛" : String(id)) : "🔒") + '</span>' +
          '<span class="lab">' + (isBoss ? "Boss" : "Page") + '</span>' +
          '<span class="stars" data-testid="page-stars-' + id + '">' + (unlocked ? starTxt : "") + '</span>';
        b.addEventListener("click", function () {
          if (!unlocked) return;
          sfx("tap");
          beginLevel(id);
        });
        row.appendChild(b);
      });
      card.appendChild(row);
      wrap.appendChild(card);
    });
    var endBtn = document.createElement("button");
    endBtn.className = "btn lavender";
    endBtn.id = "btn-endless-levels";
    endBtn.setAttribute("data-testid", "btn-endless-levels");
    endBtn.textContent = "Endless Sketch" + (save.endlessBest ? "  •  best " + save.endlessBest : "");
    endBtn.addEventListener("click", function () { sfx("tap"); beginEndless(); });
    wrap.appendChild(endBtn);
  }
  function syncTools() {
    Array.prototype.forEach.call(document.querySelectorAll("#tools .tool"), function (b) {
      var tool = b.getAttribute("data-tool");
      var unlocked = crayonUnlocked(tool);
      b.classList.toggle("sel", !!(play && tool === play.tool));
      b.classList.toggle("lock", !unlocked);
      if (tool === "yellow" || tool === "purple") b.disabled = !unlocked;
    });
  }
  function showHint(msg, dur) {
    hint = msg;
    hintUntil = (play ? play.t : 0) + (dur || 2.5);
  }
  var planKey = "";
  function updateHud() {
    if (!play) return;
    var ink = Math.max(0, Math.round(play.ink));
    document.getElementById("ink-count").textContent = String(ink);
    document.getElementById("ink-num").textContent = ink + " / " + play.inkMax;
    document.getElementById("ink-fill").style.transform = "scaleX(" + (play.ink / play.inkMax) + ")";
    var lab = document.getElementById("ink-title");
    if (lab) {
      var liveOn = play.phase === "wave" && D().live > 1;
      lab.textContent = liveOn ? "Ink budget  (wave drawing costs ×" + D().live + ")" : "Ink budget";
    }
    document.getElementById("level-name").textContent = play.name;
    document.getElementById("house-hp").textContent = String(Math.max(0, Math.ceil(play.house.hp)));
    document.getElementById("star-count").textContent = String(play.starsHave);
    var sc = document.getElementById("score-count");
    if (sc) sc.textContent = String(play.score || 0);
    var gi = document.getElementById("goal-icon");
    var gc = document.getElementById("goal-count");
    if (play.endless) {
      gi.textContent = "🏆";
      gc.textContent = String(play.score || 0);
    } else if (play.goal === "stars") {
      gi.textContent = "⭐";
      gc.textContent = play.starsHave + " / " + play.starsNeed;
    } else {
      gi.textContent = "🏠";
      gc.textContent = String(Math.max(0, Math.ceil(play.house.hp)));
    }
    var wl = document.getElementById("wave-label");
    var waveN = currentWave();
    var waveMax = maxWave();
    var wc = document.getElementById("wave-count");
    if (wc) wc.textContent = String(play.endless ? play.wave : (play.phase === "plan" ? play.waveIdx + 1 : waveN));
    if (play.ended === "win") wl.textContent = "What a doodle!";
    else if (play.ended === "lose") wl.textContent = play.endless ? "Sketch over" : "Smudged…";
    else if (play.endless) wl.textContent = "Wave " + Math.max(1, play.wave) + "  •  " + play.score;
    else if (play.phase === "plan") wl.textContent = "Plan wave " + (play.waveIdx + 1) + " of " + waveMax;
    else if (waveMax > 0) wl.textContent = (play.goal === "stars" ? "⭐" + play.starsHave + "/" + play.starsNeed + "  " : "") + "Wave " + waveN + " of " + waveMax;
    else if (play.goal === "stars") wl.textContent = "Collect " + play.starsNeed + " stars";
    else wl.textContent = "Protect the house";
    updatePlanPanel();
    var hintEl = document.getElementById("hint");
    if (hint && play.t < hintUntil && !play.ended && !play.paused) {
      hintEl.textContent = hint;
      hintEl.classList.add("on");
    } else hintEl.classList.remove("on");
  }
  function updatePlanPanel() {
    var panel = document.getElementById("plan");
    var wrap = document.getElementById("field-wrap");
    if (!panel) return;
    var show = !!(play && play.phase === "plan" && !play.ended && !play.paused && !(play.autoStart));
    panel.hidden = !show;
    if (wrap) wrap.classList.toggle("planning", show);
    if (!show) { planKey = ""; return; }
    var items = play.waves[play.waveIdx] || [];
    var sum = waveSummary(items);
    var key = play.waveIdx + "|" + sum.map(function (s) { return s.key + s.n; }).join(",") + "|" + play.waves.length;
    if (key === planKey) return;
    planKey = key;
    var txt = document.getElementById("plan-text");
    txt.innerHTML = "<b>Wave " + (play.waveIdx + 1) + " of " + play.waves.length + " incoming:</b> " +
      sum.map(function (s) { return s.n + "× " + s.name; }).join(" · ");
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
  function liveMul() { return play && play.phase === "wave" ? D().live : 1; }
  function inkCostPerPx(color) {
    var c = color || (play && play.drawing ? play.drawing.color : play ? play.tool : "blue");
    return BASE_COST * (COLOR_COST[c] || 1) * liveMul();
  }
  function inBlot(x, y) {
    if (!play) return null;
    for (var i = 0; i < play.blots.length; i++) {
      var b = play.blots[i];
      var dx = x - b.x, dy = y - b.y;
      if (dx * dx + dy * dy <= b.r * b.r) return b;
    }
    return null;
  }

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
    if (foldedAt(p.x, p.y)) {
      showHint("The page is folded there!", 2);
      sfx("dry");
      return;
    }
    if (inBlot(p.x, p.y)) {
      showHint("Ink blot! You can't draw there.", 2);
      sfx("dry");
      return;
    }
    if (play.ink < 4) {
      showHint("Out of ink budget!", 2);
      sfx("dry");
      return;
    }
    if (play.strokes.length >= MAX_STROKES) {
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
    if (play.wind) p = { x: p.x + play.wind.ax * 16, y: p.y + play.wind.ay * 16 };
    if (foldedAt(p.x, p.y)) {
      finishStroke();
      showHint("The fold stopped your line.", 2);
      return;
    }
    if (inBlot(p.x, p.y)) {
      finishStroke();
      showHint("Ink blot! Your line stopped.", 2);
      return;
    }
    var pts = play.drawing.pts;
    var last = pts[pts.length - 1];
    var d = dist(last, p);
    if (d < 4) return;
    var perPx = inkCostPerPx(play.drawing.color) * (inStain(p.x, p.y) ? 2 : 1);
    if (inStain(p.x, p.y)) play.inkSlow = 3;
    if (play.ink <= 0) {
      finishStroke();
      sfx("dry");
      showHint("Ink budget used up!", 2);
      return;
    }
    var cost = d * perPx;
    if (cost > play.ink) {
      var allow = play.ink / perPx;
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
  function clipBlots(pts) {
    if (!play || !play.blots.length) return pts;
    var out = [];
    for (var i = 0; i < pts.length; i++) {
      if (inBlot(pts[i].x, pts[i].y)) break;
      out.push(pts[i]);
    }
    return out;
  }

  function commitStroke(color, rawPts) {
    if (!play || play.ended) return null;
    var pts = simplify(clipBlots(rawPts), 3);
    var length = polylineLen(pts);
    if (pts.length < 2 || length < 28) {
      play.ink = Math.min(play.inkMax, play.ink + length * inkCostPerPx(color));
      return null;
    }
    if (play.strokes.length >= MAX_STROKES) {
      play.ink = Math.min(play.inkMax, play.ink + length * inkCostPerPx(color));
      return null;
    }
    var closed = isLoop(pts, length);
    if (closed) pts = pts.concat([pts[0]]);
    var through = strokeThroughPuddle(pts, play.puddles);
    var tri = closed && isTriangle(pts);
    var len = polylineLen(pts);
    var st = {
      id: seq++, color: color, pts: pts, closed: closed, triangle: tri,
      throughPuddle: through, length: len,
      hp: color === "green" ? 20 + len * 0.3 : 0,
      charges: color === "yellow" ? 8 : 0,
    };
    play.strokes.push(st);
    play.firstDraw = true;
    sfx("drawEnd");
    if (through) sfx("splash");
    hatchCritters(st);
    if (closed) collectStarsInLoop(st);
    if (tri) {
      var cen = triangleCentroid(st.pts);
      play.pads.push({ id: st.id, pts: st.pts.slice(), x: cen.x, y: cen.y, cd: 0 });
      play.usedCombo = true;
      showHint("Launch pad! Critters on it fly at nearby scribbles.", 2.4);
      sfx("launch");
    } else if (closed) showHint("A loop! They'll walk in a circle.", 2.4);
    else if (through) showHint("Swimmers!", 2);
    else if (color === "yellow") showHint("Zap line! It zaps ground scribbles, then fizzles.", 2.4);
    else if (color === "purple") showHint("Blink line! Ends swap whoever touches them.", 2.3);
    rebuildCombos();
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
    if (st.color === "yellow" || st.color === "purple") n = Math.min(2, n);
    var spd = 52;
    if (st.color === "red") spd = 88;
    if (st.color === "blue") spd = 48;
    if (st.color === "green") spd = 50;
    if (st.color === "yellow") spd = 60;
    if (st.color === "purple") spd = 58;
    for (var i = 0; i < n; i++) {
      var t0 = st.length * ((i + 0.5) / n);
      var p = pointAtStroke(st, t0);
      play.critters.push({
        id: seq++, color: st.color, strokeId: st.id, t: t0, dir: 1, x: p.x, y: p.y, spd: spd,
        swim: st.throughPuddle, bob: Math.random() * 10, launch: 0, lvx: 0, lvy: 0, teleCd: 0,
      });
      puff(p.x, p.y, CRAYON[st.color].fill, 5);
    }
    sfx("hatch");
  }
  function collectStarsInLoop(st) {
    if (!st.closed) return;
    play.stars.forEach(function (stt) {
      if (stt.taken) return;
      if (pointInPoly(stt.x, stt.y, st.pts)) takeStar(stt);
    });
  }
  function takeStar(stt) {
    if (stt.taken) return;
    stt.taken = true;
    play.starsHave += 1;
    if (play.endless) play.score += 8;
    sfx("star");
    floatText(stt.x, stt.y - 10, "Star!", "#c98910");
    puff(stt.x, stt.y, "#ffe57a", 8);
  }
  function rebuildCombos() {
    if (!play) return;
    var next = [];
    for (var i = 0; i < play.strokes.length; i++) {
      for (var j = i + 1; j < play.strokes.length; j++) {
        var a = play.strokes[i], b = play.strokes[j];
        var kind = comboKind(a.color, b.color);
        if (!kind) continue;
        var hits = strokeIntersections(a, b);
        hits.forEach(function (p) {
          for (var u = 0; u < next.length; u++) {
            if (next[u].kind === kind && dist(next[u], p) < 16) return;
          }
          next.push({ kind: kind, x: p.x, y: p.y, a: a.id, b: b.id, t: 0, pulse: 0 });
        });
      }
    }
    var fresh = next.filter(function (c) {
      return !play.combos.some(function (o) { return o.kind === c.kind && dist(o, c) < 16; });
    });
    play.combos = next.map(function (c) {
      var old = play.combos.find(function (o) { return o.kind === c.kind && dist(o, c) < 16; });
      if (old) { c.t = old.t; c.pulse = old.pulse; }
      return c;
    });
    if (fresh.length) {
      play.usedCombo = true;
      fresh.forEach(function (c) {
        if (c.kind === "splash") { sfx("burst"); floatText(c.x, c.y - 10, "Splash!", "#245f96"); }
        if (c.kind === "bush") { sfx("bush"); floatText(c.x, c.y - 10, "Bush!", "#226c36"); }
        if (c.kind === "thorn") { sfx("thorn"); floatText(c.x, c.y - 10, "Thorns!", "#9a2e24"); }
        puff(c.x, c.y, c.kind === "splash" ? "#6eb7e8" : c.kind === "bush" ? "#7bc87a" : "#e05645", 8);
        if (play.endless) play.score += 15;
      });
      if (fresh[0].kind === "splash") showHint("Splash burst! Hurts everything nearby, even flyers.", 2.4);
      else if (fresh[0].kind === "bush") showHint("Bouncy bush!", 2);
      else showHint("Thorn patch! Hurts ground scribbles that stand in it.", 2.4);
    }
    play.pads = play.pads.filter(function (p) {
      return play.strokes.some(function (s) { return s.id === p.id; });
    });
  }
  function eraseAt(x, y) {
    if (!play) return;
    var hit = null, hi = -1;
    for (var i = play.strokes.length - 1; i >= 0; i--) {
      var n = nearStroke(play.strokes[i], x, y, 22);
      if (n && (!hit || n.d < hit.d)) { hit = n; hi = i; }
    }
    if (hi < 0) return;
    removeStrokeAt(hi, x, y, true);
  }
  function removeStrokeAt(hi, x, y, refund) {
    var st = play.strokes[hi];
    if (refund) {
      var back = st.length * inkCostPerPx(st.color) * 0.15;
      play.ink = Math.min(play.inkMax, play.ink + back);
    }
    play.critters.forEach(function (c) {
      if (c.strokeId === st.id) puff(c.x, c.y, "#f4a4b8", 4);
    });
    play.critters = play.critters.filter(function (c) { return c.strokeId !== st.id; });
    play.strokes.splice(hi, 1);
    sfx("erase");
    puff(x, y, "#f4d4c4", 6);
    rebuildCombos();
  }
  function eraseStroke(st) {
    var i = play.strokes.indexOf(st);
    if (i >= 0) removeStrokeAt(i, st.pts[0].x, st.pts[0].y, false);
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
    if (play.phase === "plan") { tickFx(dt); return; }
    play.t += dt;
    if (play.inkSlow > 0) play.inkSlow = Math.max(0, play.inkSlow - dt);
    if (!play.drawing) {
      play.ink = Math.min(play.inkMax, play.ink + play.refill * dt * (play.inkSlow > 0 ? 0.55 : 1));
    }
    tickFold(dt);
    tickPuddles(dt);
    spawnPending(dt);
    maybeEndlessWave();
    tickCritters(dt);
    tickCombos(dt);
    tickZap(dt);
    tickPads(dt);
    tickMonsters(dt);
    tickFx(dt);
    checkWaveClear();
    checkEnd();
  }

  function tickFold(dt) {
    if (!play.fold) return;
    var f = play.fold;
    f.t += dt;
    if (f.t >= f.period) {
      f.t = 0;
      f.side = f.side === "right" ? "left" : "right";
      sfx("fold");
      showHint("The page folded the other way!", 2);
    }
  }
  function tickPuddles(dt) {
    var w = fieldSize().w, h = fieldSize().h;
    play.puddles.forEach(function (p) {
      if (!p.vx && !p.vy) return;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.x < p.r) { p.x = p.r; p.vx = Math.abs(p.vx); }
      if (p.x > w - p.r) { p.x = w - p.r; p.vx = -Math.abs(p.vx); }
      if (p.y < p.r) { p.y = p.r; p.vy = Math.abs(p.vy); }
      if (p.y > h - p.r) { p.y = h - p.r; p.vy = -Math.abs(p.vy); }
    });
  }

  function spawnPending(dt) {
    if (play.phase !== "wave") return;
    play.waveClock += dt;
    play.pending.forEach(function (s) {
      if (s.done || play.waveClock < s.dt) return;
      s.done = true;
      var lane = play.lanes[s.lane] || play.lanes[0];
      var start = lane ? lane[0] : { x: play.house.x, y: 20 };
      var kind = s.kind === "adapt" ? adaptKind() : s.kind;
      spawnMonster({ x: start.x, y: start.y, kind: kind, boss: s.boss, lane: lane ? (play.lanes[s.lane] ? s.lane : 0) : -1 });
    });
  }
  function adaptKind() {
    if (!play) return "scribble";
    var greens = 0, blues = 0, reds = 0;
    play.strokes.forEach(function (s) {
      if (s.color === "green") greens++;
      else if (s.color === "blue") blues++;
      else if (s.color === "red") reds++;
    });
    var picks = ["scribble"];
    if (greens >= 1) picks.push("jumper", "jumper");
    if (play.strokes.length >= 3) picks.push("eater");
    if (reds >= 2) picks.push("splitter", "armored");
    if (greens >= 1 && reds >= 1) picks.push("armored");
    if (blues < 1) picks.push("sneaky", "sneaky");
    if (play.pads.length === 0 && play.strokes.length >= 2) picks.push("flyer", "flyer");
    if (play.combos.length >= 2) picks.push("healer");
    return picks[Math.floor(rng() * picks.length)];
  }
  function maybeEndlessWave() {
    if (!play.endless) return;
    if (play.t < play.nextWaveAt) return;
    play.wave += 1;
    play.nextWaveAt = play.t + Math.max(7, 14 - play.wave * 0.4);
    var n = 2 + Math.floor((play.wave + 1) / 2);
    if (play.diff === "hard") n += 1;
    if (play.diff === "nightmare") n += 2;
    if (play.diff === "easy") n = Math.max(2, n - 1);
    if (n > 8) n = 8;
    var kinds = ["scribble"];
    if (play.wave >= 2) kinds.push("jumper");
    if (play.wave >= 3) kinds.push("splitter", "armored");
    if (play.wave >= 4) kinds.push("eater");
    if (play.wave >= 5) kinds.push("sneaky", "flyer");
    if (play.wave >= 6) kinds.push("healer");
    var w = fieldSize().w;
    for (var i = 0; i < n; i++) {
      var kind = (play.wave >= 3 && rng() < 0.4) ? adaptKind() : kinds[Math.floor(rng() * kinds.length)];
      var x = (w * (i + 1)) / (n + 1);
      spawnMonster({ x: x, y: sy(18), kind: kind });
    }
    if (play.wave % 6 === 0) {
      spawnMonster({ x: sx(195), y: sy(16), kind: "boss", boss: play.wave >= 12 ? "hidey" : (play.wave >= 6 ? "nibble" : "smudge") });
    }
    floatText(sx(195), sy(40), "Wave " + play.wave + "!", "#3a2a22");
    play.score += 20;
  }

  function spawnMonster(opts) {
    opts = opts || {};
    var kind = opts.kind || "scribble";
    var boss = opts.boss || null;
    var d = D();
    var base = kind === "boss" ? (BOSS_STATS[boss || "smudge"] || BOSS_STATS.smudge) : (KIND_STATS[kind] || KIND_STATS.scribble);
    var hp = opts.hp != null ? opts.hp : Math.round(base.hp * d.hp * (1 + d.esc * Math.max(0, (play.endless ? 0 : play.waveIdx - 1))));
    var spd = opts.spd != null ? opts.spd : base.spd * d.spd;
    var squiggle = [];
    var seed = seq * 17;
    var big = kind === "boss" ? 1.7 : (opts.tiny ? 0.7 : 1);
    for (var i = 0; i < 10; i++) {
      squiggle.push({
        x: Math.sin(seed * 0.7 + i * 1.7) * 10 * big,
        y: Math.cos(seed * 0.5 + i * 1.3) * 9 * big,
      });
    }
    var path = (opts.path) ? opts.path : (opts.lane != null && opts.lane >= 0 && play.lanes[opts.lane] ? play.lanes[opts.lane] : null);
    var m = {
      id: seq++, kind: kind, boss: boss, x: opts.x, y: opts.y, hp: hp, max: hp, spd: spd, baseSpd: spd,
      hurt: 0, nibbleCd: 0, squiggle: squiggle, hopping: 0, hopCd: 0.4 + rng() * 0.8,
      chew: 0, chewTarget: null,
      chewsLeft: (kind === "eater" || boss === "nibble") ? 1 : 0,
      hasSplit: !!opts.tiny, stealthed: kind === "sneaky", stealthT: 0, summonT: 0,
      tiny: !!opts.tiny, scale: big, phase: 0, armor: false, teleCd: 0,
      path: path, pi: opts.pi != null ? opts.pi : 1, lane: opts.lane != null ? opts.lane : -1,
      canHop: kind === "jumper" || boss === "hidey", chewTime: boss === "nibble" ? 1.5 : 1.3, leaked: false,
    };
    play.monsters.push(m);
    if (kind === "boss") enterBossPhase(m, 1);
    puff(m.x, m.y, "#6a6570", 4);
    return m;
  }

  function tickCritters(dt) {
    play.critters.forEach(function (c) {
      var st = play.strokes.find(function (s) { return s.id === c.strokeId; });
      if (c.teleCd > 0) c.teleCd -= dt;
      if (c.launch > 0) {
        c.launch -= dt;
        c.x += c.lvx * dt;
        c.y += c.lvy * dt;
        play.monsters.forEach(function (m) {
          if (m.hp <= 0) return;
          if (dist(c, m) < 26) hurtMonster(m, 45 * dt, "launch");
        });
        if (c.launch <= 0 && st) {
          var p = pointAtStroke(st, c.t);
          c.x = p.x; c.y = p.y;
        }
        collectNear(c);
        return;
      }
      if (!st) return;
      if (strokeFolded(st)) return;
      var spd = c.spd;
      if (c.swim && inPuddle(c.x, c.y, play.puddles)) spd *= 1.35;
      play.combos.forEach(function (co) {
        if (co.kind === "bush" && dist(c, co) < 36) spd *= 1.4;
      });
      c.t += c.dir * spd * dt;
      var L = st.closed ? polylineLen(closedPts(st.pts)) : st.length;
      if (st.closed) {
        if (L < 1) return;
        c.t = ((c.t % L) + L) % L;
      } else if (st.color === "purple") {
        if (c.t >= st.length) { c.t = 0.01; if (c.teleCd <= 0) { sfx("tele"); puff(c.x, c.y, "#8a5ad4", 5); c.teleCd = 0.25; } }
        if (c.t <= 0) { c.t = st.length - 0.01; if (c.teleCd <= 0) { sfx("tele"); puff(c.x, c.y, "#8a5ad4", 5); c.teleCd = 0.25; } }
      } else {
        if (c.t >= st.length) { c.t = st.length; c.dir = -1; }
        if (c.t <= 0) { c.t = 0; c.dir = 1; }
      }
      var p2 = pointAtStroke(st, c.t);
      c.x = p2.x;
      c.y = p2.y;
      collectNear(c);
    });
    tickPurpleEnds(dt);
  }
  function collectNear(c) {
    play.stars.forEach(function (stt) {
      if (stt.taken) return;
      if (dist(c, stt) < 24) takeStar(stt);
    });
  }
  function tickPurpleEnds(dt) {
    play.strokes.forEach(function (st) {
      if (st.color !== "purple" || st.pts.length < 2) return;
      var a = st.pts[0], b = st.pts[st.pts.length - 1];
      play.monsters.forEach(function (m) {
        if (m.hp <= 0 || m.kind === "flyer" || (m.teleCd && m.teleCd > 0)) return;
        if (dist(m, a) < 18) {
          m.x = b.x; m.y = b.y; m.teleCd = 1.2;
          sfx("tele"); puff(a.x, a.y, "#8a5ad4", 6); puff(b.x, b.y, "#8a5ad4", 6);
        } else if (dist(m, b) < 18) {
          m.x = a.x; m.y = a.y; m.teleCd = 1.2;
          sfx("tele"); puff(a.x, a.y, "#8a5ad4", 6); puff(b.x, b.y, "#8a5ad4", 6);
        }
      });
    });
    play.monsters.forEach(function (m) { if (m.teleCd) m.teleCd = Math.max(0, m.teleCd - dt); });
  }
  function tickPads(dt) {
    play.pads.forEach(function (pad) {
      pad.cd = Math.max(0, pad.cd - dt);
      if (pad.cd > 0) return;
      play.critters.forEach(function (c) {
        if (c.launch > 0 || pad.cd > 0) return;
        if (c.strokeId !== pad.id) return;
        var target = nearestMonster(c.x, c.y, 175);
        if (!target) return;
        var ang = Math.atan2(target.y - c.y, target.x - c.x);
        c.lvx = Math.cos(ang) * 230;
        c.lvy = Math.sin(ang) * 230;
        c.launch = 0.6;
        pad.cd = 0.7;
        sfx("launch");
        puff(c.x, c.y, "#e8c130", 5);
      });
    });
  }
  function nearestMonster(x, y, maxd) {
    var best = null, bd = maxd || 9999;
    play.monsters.forEach(function (m) {
      if (m.hp <= 0) return;
      if (!monsterVisible(m)) return;
      var d = dist(m, { x: x, y: y });
      if (d < bd) { bd = d; best = m; }
    });
    return best;
  }
  function tickCombos(dt) {
    play.combos.forEach(function (c) {
      if (foldedAt(c.x, c.y)) return;
      c.t += dt;
      c.pulse += dt;
      if (c.kind === "splash" && c.t >= 1.8) {
        c.t = 0;
        sfx("burst");
        puff(c.x, c.y, "#6eb7e8", 10);
        play.monsters.forEach(function (m) {
          if (m.hp <= 0) return;
          if (dist(m, c) < 52) hurtMonster(m, 14, "splash");
        });
      }
      if (c.kind === "thorn") {
        play.monsters.forEach(function (m) {
          if (m.hp <= 0 || m.kind === "flyer" || m.hopping > 0) return;
          if (dist(m, c) < 28) hurtMonster(m, 10 * dt, "thorn");
        });
      }
      if (c.kind === "bush") {
        play.monsters.forEach(function (m) {
          if (m.hp <= 0 || m.kind === "flyer") return;
          if (dist(m, c) < 36) {
            var ang = Math.atan2(m.y - c.y, m.x - c.x);
            m.x += Math.cos(ang) * 40 * dt;
            m.y += Math.sin(ang) * 40 * dt;
          }
        });
      }
    });
  }
  function tickZap(dt) {
    play.zapT += dt;
    if (play.zapT < 1.4) return;
    play.zapT = 0;
    var zapped = false;
    play.strokes.slice().forEach(function (st) {
      if (st.color !== "yellow" || strokeFolded(st)) return;
      var hit = false;
      play.monsters.forEach(function (m) {
        if (m.hp <= 0 || m.kind === "flyer") return;
        if (nearStroke(st, m.x, m.y, 22)) {
          hurtMonster(m, 10, "zap");
          puff(m.x, m.y, "#ffe57a", 5);
          hit = true;
        }
      });
      if (hit) {
        zapped = true;
        st.charges -= 1;
        if (st.charges <= 0) {
          floatText(st.pts[0].x, st.pts[0].y - 10, "Fizzle!", "#9a7a12");
          eraseStroke(st);
        }
      }
    });
    if (zapped) sfx("zap");
  }

  function monsterVisible(m) {
    if (m.kind !== "sneaky" && !(m.kind === "boss" && m.stealthed)) return true;
    if (touchingColor(m, "blue", 22)) return true;
    if (inPuddle(m.x, m.y, play.puddles)) return true;
    for (var i = 0; i < play.combos.length; i++) {
      var c = play.combos[i];
      if (c.kind === "splash" && dist(m, c) < 52) return true;
    }
    return false;
  }

  function vineAhead(m, dx, dy) {
    var l = Math.sqrt(dx * dx + dy * dy) || 1;
    return vineHit(m.x + dx / l * 30, m.y + dy / l * 30, 14);
  }

  function tickMonsters(dt) {
    var house = play.house;
    var healers = play.monsters.filter(function (x) { return x.kind === "healer" && x.hp > 0; });
    play.monsters.forEach(function (m) {
      if (m.hp <= 0) { m.hurt -= dt; return; }
      if (m.hurt > 0) m.hurt -= dt;
      m.nibbleCd = Math.max(0, m.nibbleCd - dt);
      tickBoss(m, dt);
      var visible = monsterVisible(m);
      // tickle from nearby critters (ground monsters only)
      if (visible && m.kind !== "flyer") {
        var ticklers = 0;
        play.critters.forEach(function (c) {
          if (c.launch > 0) return;
          var r = 26 + (c.swim && inPuddle(m.x, m.y, play.puddles) ? 8 : 0);
          if (dist(c, m) < r) ticklers += 1;
        });
        if (ticklers) {
          hurtMonster(m, ticklers * 8 * dt, "tickle");
          if (m.hp <= 0) return;
          if (rng() < dt * 6) sfx("tickle");
          puff(m.x, m.y, "#fff3a0", 1);
        }
      }
      // healers mend others
      if (healers.length && m.kind !== "healer") {
        healers.forEach(function (h) {
          if (h.hp > 0 && dist(h, m) < 72 && m.hp < m.max) m.hp = Math.min(m.max, m.hp + 6 * dt);
        });
      }
      // target selection
      var target = house;
      var seekingLine = false;
      if (m.kind === "flyer") {
        target = house;
      } else {
        if (m.path && m.pi < m.path.length) {
          target = m.path[m.pi];
          if (dist(m, target) < 14) m.pi += 1;
        }
        if ((m.kind === "eater" || m.boss === "nibble") && m.chewsLeft > 0) {
          var line = nearestChewStroke(m);
          if (line) { target = line.pt; m.chewTarget = line.st; seekingLine = true; }
        }
      }
      var ddx = target.x - m.x, ddy = target.y - m.y;
      var ang = Math.atan2(ddy, ddx);
      ang += Math.sin(play.t * 0.8 + m.id) * (m.kind === "flyer" ? 0.12 : 0.22);
      var spd = m.spd;
      if (m.kind !== "flyer") {
        if (touchingColor(m, "blue", 16)) spd *= 0.45;
        if (inPuddle(m.x, m.y, play.puddles)) spd *= 0.7;
      }
      if (m.canHop && m.hopping <= 0) {
        m.hopCd -= dt;
        if (m.hopCd <= 0 && (vineAhead(m, ddx, ddy) || m.boss === "hidey")) {
          m.hopping = 0.55;
          m.hopCd = m.boss === "hidey" ? (m.phase >= 3 ? 1.4 : 2.2) : 1.4;
          sfx("jump");
        }
      }
      if (m.hopping > 0) { m.hopping -= dt; spd *= 1.55; }
      var vx = Math.cos(ang) * spd;
      var vy = Math.sin(ang) * spd;
      var nx = m.x + vx * dt;
      var ny = m.y + vy * dt;
      var wall = (m.hopping > 0 || m.kind === "flyer") ? null : vineHit(nx, ny, 13);
      if (wall) {
        m.x = wall.x + wall.nx * 14;
        m.y = wall.y + wall.ny * 14;
        var tx = -wall.ny, ty = wall.nx;
        var s = (vx * tx + vy * ty);
        s = s >= 0 ? 1 : -1;
        m.x += tx * s * spd * dt * 0.85;
        m.y += ty * s * spd * dt * 0.85;
        // pushing on a vine wears it down
        var vst = wall.st;
        if (vst && vst.hp > 0) {
          vst.hp -= 12 * dt * ((m.kind === "armored" || m.kind === "boss") ? 3 : 1);
          if (vst.hp <= 0) {
            floatText(wall.x, wall.y - 8, "Snap!", "#226c36");
            sfx("erase");
            eraseStroke(vst);
          }
        }
      } else {
        m.x = nx;
        m.y = ny;
      }
      if (seekingLine && m.chewTarget && nearStroke(m.chewTarget, m.x, m.y, 16)) {
        m.chew += dt;
        if (m.chew >= m.chewTime) {
          m.chew = 0;
          m.chewsLeft -= 1;
          floatText(m.x, m.y - 12, "Nibble!", "#9a2e24");
          sfx("chew");
          eraseStroke(m.chewTarget);
          m.chewTarget = null;
        }
      } else {
        m.chew = Math.max(0, m.chew - dt * 0.5);
      }
      if (dist(m, house) < 28) leak(m);
    });
    play.monsters = play.monsters.filter(function (m) { return m.hp > 0 || m.hurt > -0.5; });
  }
  function leak(m) {
    var cost = m.kind === "boss" ? 2 : 1;
    m.hp = 0;
    m.hurt = -0.01;
    m.leaked = true;
    play.house.hp = Math.max(0, play.house.hp - cost);
    play.leaks += cost;
    play.houseHurt = true;
    sfx("house");
    floatText(play.house.x, play.house.y - 30, "Smudge!", "#9a2e24");
    puff(play.house.x, play.house.y, "#9a8a7a", 6);
  }

  function enterBossPhase(m, p) {
    m.phase = p;
    m.summonT = 0;
    if (m.boss === "smudge") {
      m.armor = p === 1;
      m.spd = m.baseSpd * (p === 1 ? 1 : p === 2 ? 1.25 : 1.8);
    } else if (m.boss === "nibble") {
      m.chewsLeft = p === 1 ? 1 : p === 2 ? 2 : 3;
      m.chewTime = p === 3 ? 0.6 : 1.5;
      m.canHop = p === 3;
      m.spd = m.baseSpd * (p === 3 ? 1.5 : 1);
    } else if (m.boss === "hidey") {
      m.spd = m.baseSpd * (p === 3 ? 1.35 : 1);
    }
    if (p > 1) {
      floatText(m.x, m.y - 26, "Phase " + p + "!", "#9a2e24");
      sfx("phase");
      puff(m.x, m.y, "#e8c130", 10);
      if (play.phase !== "plan") showHint(bossPhaseHint(m), 3.2);
      if (m.boss === "nibble" && p === 2) {
        spawnMonster({ x: m.x + 22, y: m.y, kind: "eater", hp: Math.round(m.max * 0.22), tiny: true, path: m.path, pi: m.pi, lane: m.lane });
      }
      if (m.boss === "hidey" && p === 2) {
        spawnMonster({ x: m.x - 20, y: m.y, kind: "flyer", tiny: true });
        spawnMonster({ x: m.x + 20, y: m.y, kind: "flyer", tiny: true });
      }
      if (m.boss === "hidey" && p === 3) {
        spawnMonster({ x: m.x, y: m.y - 24, kind: "healer", tiny: true, path: m.path, pi: m.pi, lane: m.lane });
      }
    }
  }
  function bossPhaseHint(m) {
    if (m.boss === "smudge") return m.phase === 2 ? "Its shell cracked, and it calls little scribbles!" : "Rage! It's fast now. Slow it with blue or vines!";
    if (m.boss === "nibble") return m.phase === 2 ? "It eats two lines at a time and has a helper!" : "Ravenous! It chews fast and hops vines!";
    return m.phase === 2 ? "Hidey calls flyers! Use a launch pad or splash." : "Hidey brought a healer and hides longer!";
  }
  function bossPhaseFor(m) {
    var f = m.hp / m.max;
    return f > 0.66 ? 1 : f > 0.33 ? 2 : 3;
  }
  function tickBoss(m, dt) {
    if (m.kind !== "boss") return;
    var p = bossPhaseFor(m);
    if (p > m.phase) enterBossPhase(m, p);
    m.summonT += dt;
    if (m.boss === "smudge" && m.phase === 2 && m.summonT >= 6) {
      m.summonT = 0;
      var adds = play.monsters.filter(function (x) { return x.kind === "scribble" && x.hp > 0; }).length;
      if (adds < 4) {
        spawnMonster({ x: m.x + 16, y: m.y + 8, kind: "scribble", tiny: true, path: m.path, pi: m.pi, lane: m.lane });
        spawnMonster({ x: m.x - 16, y: m.y + 8, kind: "scribble", tiny: true, path: m.path, pi: m.pi, lane: m.lane });
        floatText(m.x, m.y - 18, "Little ones!", "#5a4a62");
      }
    }
    if (m.boss === "nibble" && m.summonT >= 9) {
      m.summonT = 0;
      m.chewsLeft = Math.min(m.phase + 1, m.chewsLeft + 1);
    }
    if (m.boss === "hidey") {
      m.stealthT += dt;
      var onT = m.phase === 3 ? 4.5 : 2.8;
      var offT = m.phase === 3 ? 1.5 : 5.5;
      if (m.stealthed && m.stealthT >= onT) { m.stealthed = false; m.stealthT = 0; }
      else if (!m.stealthed && m.stealthT >= offT) { m.stealthed = true; m.stealthT = 0; }
      if (m.phase === 2 && m.summonT >= 9) {
        m.summonT = 0;
        spawnMonster({ x: m.x, y: Math.max(20, m.y - 20), kind: "flyer", tiny: true });
        floatText(m.x, m.y - 18, "Flyer!", "#5a4a62");
      }
    }
  }
  function nearestChewStroke(m) {
    var best = null, bd = 99999;
    play.strokes.forEach(function (st) {
      if (strokeFolded(st)) return;
      var h = nearStroke(st, m.x, m.y, 999);
      if (!h) return;
      var score = h.d - Math.min(70, st.length * 0.22);
      if (score < bd) { bd = score; best = { st: st, pt: { x: h.x, y: h.y } }; }
    });
    return best;
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
    var best = null, bst = null;
    for (var i = 0; i < play.strokes.length; i++) {
      var st = play.strokes[i];
      if (st.color !== "green") continue;
      var h = nearStroke(st, x, y, rad);
      if (h && (!best || h.d < best.d)) { best = h; bst = st; }
    }
    if (best) best.st = bst;
    return best;
  }

  function hurtMonster(m, dmg, reason) {
    if (!m || m.hp <= 0) return;
    if (m.kind === "flyer" && reason !== "launch" && reason !== "splash") return;
    if (!monsterVisible(m) && reason !== "splash") return;
    if (reason === "tickle" && (m.kind === "armored" || m.armor)) dmg *= 0.15;
    if (reason === "splash" && (m.kind === "armored" || m.armor)) dmg *= 0.35;
    if (reason === "splash" && m.kind === "flyer") dmg *= 0.5;
    m.hp -= dmg;
    m.hurt = 0.15;
    if (m.kind === "splitter" && !m.hasSplit && m.hp <= m.max * 0.5 && m.hp > 0) {
      splitMonster(m);
      return;
    }
    if (m.hp <= 0) koMonster(m);
  }
  function splitMonster(m) {
    m.hasSplit = true;
    var hp = Math.max(8, Math.ceil(Math.max(m.hp, 1) * 0.8));
    var spd = m.spd * 1.15;
    var ox = m.x, oy = m.y;
    m.hp = 0;
    m.hurt = -0.05;
    spawnMonster({ kind: "scribble", x: ox - 14, y: oy, hp: hp, spd: spd, tiny: true, path: m.path, pi: m.pi, lane: m.lane });
    spawnMonster({ kind: "scribble", x: ox + 14, y: oy, hp: hp, spd: spd, tiny: true, path: m.path, pi: m.pi, lane: m.lane });
    sfx("split");
    floatText(ox, oy - 14, "Two!", "#5a4a62");
    puff(ox, oy, "#c8c0d0", 8);
    if (play.endless) play.score += 5;
  }
  function koMonster(m) {
    m.hp = 0;
    m.hurt = -0.01;
    puff(m.x, m.y, "#c8c0d0", 10);
    floatText(m.x, m.y - 12, "Dizzy!", "#5a4a62");
    sfx("pop");
    play.ink = Math.min(play.inkMax, play.ink + D().kill);
    if (play.endless) play.score += m.kind === "boss" ? 50 : 10;
  }

  function puff(x, y, color, n) {
    if (!play) return;
    var cap = saverOn() ? 40 : 90;
    n = Math.min(n, cap - play.parts.length);
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2;
      var s = 18 + Math.random() * 40;
      play.parts.push({
        x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 8,
        life: 0.4 + Math.random() * 0.25, max: 0.65, color: color, size: 2.5 + Math.random() * 3,
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

  function checkWaveClear() {
    if (play.phase !== "wave" || play.endless) return;
    if (!play.pending.every(function (s) { return s.done; })) return;
    if (!play.monsters.every(function (m) { return m.hp <= 0; })) return;
    if (play.house.hp <= 0) return;
    if (play.waveIdx < play.waves.length) {
      var bonus = Math.round(play.inkMax * 0.12 * D().bonus);
      play.ink = Math.min(play.inkMax, play.ink + bonus);
      play.phase = "plan";
      play.pending = [];
      sfx("wave");
      floatText(sx(195), sy(60), "Wave cleared! +" + bonus + " ink", "#226c36");
      planKey = "";
      enterPlanIfNeeded();
    } else {
      play.phase = "free";
    }
  }

  function evalRules() {
    var inkLeft = play.ink / play.inkMax;
    return [
      { id: "clear", text: "Clear the page", ok: true },
      { id: "clean", text: "No leaks (don't let a critter reach the house)", ok: play.leaks === 0 },
      { id: "ink", text: "Use a combo or launch pad and keep 35% of your ink", ok: inkLeft >= 0.35 && play.usedCombo },
    ];
  }
  function ratePage() {
    return evalRules().filter(function (r) { return r.ok; }).length;
  }

  function endLose(reason) {
    play.ended = "lose";
    play.endReason = reason || "leaks";
    play.endTimer = 0;
    if (play.endless && play.score > save.endlessBest) {
      save.endlessBest = play.score;
      persist();
    }
    sfx("lose");
  }
  function endWin() {
    play.rules = evalRules();
    play.rating = play.rules.filter(function (r) { return r.ok; }).length;
    play.ended = "win";
    play.endTimer = 0;
    sfx("win");
  }
  function checkEnd() {
    if (play.ended) return;
    if (play.house.hp <= 0) {
      play.house.hp = 0;
      endLose("leaks");
      return;
    }
    if (play.endless) return;
    if (play.goal === "stars") {
      var cleared = play.phase === "free" && play.monsters.every(function (m) { return m.hp <= 0; });
      if (play.starsHave >= play.starsNeed && (!play.waves.length || cleared)) { endWin(); return; }
      if (play.waves.length && cleared) endLose(play.ink < 5 ? "ink" : "stars");
      return;
    }
    if (play.waves.length && play.phase === "free" && play.monsters.every(function (m) { return m.hp <= 0; })) endWin();
  }

  function finishEnd() {
    var title = document.getElementById("end-title");
    var blurb = document.getElementById("end-blurb");
    var starsEl = document.getElementById("rating-stars");
    var rulesEl = document.getElementById("star-rules");
    var unlockEl = document.getElementById("unlock-note");
    if (unlockEl) { unlockEl.hidden = true; unlockEl.textContent = ""; }
    if (rulesEl) { rulesEl.hidden = true; rulesEl.innerHTML = ""; }
    if (play.ended === "win") {
      title.textContent = play.goal === "stars" ? "Starry work!" : "What a doodle!";
      var r = play.rating || ratePage();
      play.rating = r;
      blurb.textContent = r === 3 ? "Three stars! That was a real plan." :
        r === 2 ? "Two stars. Look at the star list for the third." :
        "You did it! Plan tighter for more stars.";
      title.setAttribute("data-end", "win");
      if (starsEl) {
        starsEl.hidden = false;
        starsEl.setAttribute("data-stars", String(r));
        starsEl.innerHTML = [1, 2, 3].map(function (i) {
          return '<span class="' + (i <= r ? "on" : "off") + '">★</span>';
        }).join("");
      }
      if (rulesEl) {
        rulesEl.hidden = false;
        rulesEl.innerHTML = (play.rules || evalRules()).map(function (ru) {
          return '<li data-rule="' + ru.id + '" data-ok="' + (ru.ok ? "1" : "0") + '">' + (ru.ok ? "★ " : "☆ ") + ru.text + "</li>";
        }).join("");
      }
      var notes = [];
      if (save.unlocked < play.id + 1 && play.id < 18) save.unlocked = play.id + 1;
      if (play.id === 6 && !save.crayons.yellow) {
        save.crayons.yellow = true;
        notes.push("Yellow Zap crayon unlocked!");
        sfx("unlock");
      }
      if (play.id === 12 && !save.crayons.purple) {
        save.crayons.purple = true;
        notes.push("Purple Blink crayon unlocked!");
        sfx("unlock");
      }
      if (play.id === 18 && (play.diff === "hard" || play.diff === "nightmare") && !save.nightmare) {
        save.nightmare = true;
        notes.push("Nightmare difficulty unlocked in Settings!");
        sfx("unlock");
      }
      var prev = save.stars[play.id] || 0;
      if (r > prev) save.stars[play.id] = r;
      save.wins[play.id] = true;
      persist();
      syncTools();
      if (unlockEl && notes.length) {
        unlockEl.hidden = false;
        unlockEl.textContent = notes.join(" ");
      }
    } else {
      var inkOut = play.endReason === "ink";
      title.textContent = play.endless ? "Sketch over!" : inkOut ? "Out of ink!" : "The house got smudged!";
      if (play.endless) {
        var best = save.endlessBest || 0;
        blurb.textContent = "Score " + play.score + (best ? "  •  best " + best : "") + ". Plan a tighter page and try again!";
      } else if (play.endReason === "stars") {
        blurb.textContent = "The wave is over but some stars got away. Plan your route so it also guards the house.";
      } else if (inkOut) {
        blurb.textContent = "The ink budget ran dry before the stars were collected. Plan a shorter route.";
      } else {
        blurb.textContent = "Too many scribbles slipped past. Use the scouting preview and plan your lines.";
      }
      title.setAttribute("data-end", "lose");
      if (starsEl) {
        starsEl.hidden = true;
        starsEl.setAttribute("data-stars", "0");
        starsEl.innerHTML = "";
      }
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
    crayonStroke(ctx, [
      { x: 40, y: 520 }, { x: 80, y: 470 }, { x: 140, y: 500 }, { x: 200, y: 430 },
      { x: 260, y: 490 }, { x: 330, y: 450 }, { x: 360, y: 510 },
    ], "red", 8, 1);
    crayonStroke(ctx, [
      { x: 50, y: 620 }, { x: 90, y: 680 }, { x: 160, y: 640 }, { x: 210, y: 720 },
      { x: 280, y: 660 }, { x: 340, y: 730 },
    ], "blue", 8, 2);
    crayonStroke(ctx, loopAround(195, 760, 70, 28), "green", 9, 3);
    drawHouse(ctx, 195, 760, 3, 3, t, true);
    drawCritter(ctx, 90, 680, "blue", t, false, false);
    drawCritter(ctx, 250, 470, "red", t, false, false);
    drawCritter(ctx, 250, 730, "green", t, false, false);
    drawMonster(ctx, 330, 580, t, { squiggle: menuSquiggle, hurt: 0, hp: 1, max: 1, kind: "scribble", scale: 1 });
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
    play.stains.forEach(function (s) { drawStain(ctx, s, t); });
    play.blots.forEach(function (b) { drawBlot(ctx, b, t); });
    drawLanes(ctx, t);
    play.puddles.forEach(function (p) { drawPuddle(ctx, p, t); });
    if (play.wind) drawWind(ctx, w, h, t, play.wind);
    play.stars.forEach(function (s) { if (!s.taken) drawStar(ctx, s.x, s.y, t, false); });
    play.strokes.forEach(function (st) {
      var folded = strokeFolded(st);
      if (folded) ctx.globalAlpha = 0.28;
      crayonStroke(ctx, st.pts, st.color, st.color === "green" ? 11 : 9, st.id);
      if (st.color === "green") { vineTicks(ctx, st); if (st.hp > 0 && st.hp < (20 + st.length * 0.3) * 0.5) vineCracks(ctx, st); }
      if (st.color === "yellow") zapTicks(ctx, st, t);
      if (st.color === "purple") purpleEnds(ctx, st, t);
      ctx.globalAlpha = 1;
    });
    play.combos.forEach(function (c) { drawCombo(ctx, c, t); });
    play.pads.forEach(function (p) { drawPad(ctx, p, t); });
    if (play.drawing && play.drawing.pts.length) {
      crayonStroke(ctx, play.drawing.pts, play.drawing.color, 9, 99);
    }
    drawHouse(ctx, play.house.x, play.house.y, play.house.hp, play.house.max, t, false);
    play.critters.forEach(function (c) {
      var inP = c.swim && inPuddle(c.x, c.y, play.puddles);
      drawCritter(ctx, c.x, c.y, c.color, t + c.bob, false, !!inP);
    });
    play.monsters.forEach(function (m) {
      var vis = monsterVisible(m);
      if (m.kind === "healer" && m.hp > 0) {
        ctx.save();
        ctx.strokeStyle = "rgba(80,190,120,0.55)";
        ctx.setLineDash([4, 5]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(m.x, m.y, 72, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      if (m.kind === "flyer" && m.hp > 0) {
        ctx.fillStyle = "rgba(0,0,0,0.12)";
        ctx.beginPath();
        ctx.ellipse(m.x, m.y + 18, 11, 4, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      if (!vis) ctx.globalAlpha = 0.12;
      if (m.hp <= 0) ctx.globalAlpha = Math.max(0, 1 + m.hurt * 2);
      drawMonster(ctx, m.x, m.y, t, m);
      if (m.hp > 0 && vis) miniBar(ctx, m.x, m.y + 18 * (m.scale || 1) + (m.kind === "flyer" ? 4 : 0), m.hp / m.max);
      ctx.globalAlpha = 1;
    });
    if (play.phase === "plan" && !play.ended) drawPreview(ctx, t, w, h);
    if (play.fold) drawFold(ctx, w, h, play.fold, t);
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

  function drawStain(ctx, s, t) {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(0.15);
    ctx.fillStyle = "rgba(120, 70, 36, 0.28)";
    ctx.beginPath();
    ctx.ellipse(0, 0, s.r, s.r * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(90, 50, 24, 0.18)";
    ctx.beginPath();
    ctx.ellipse(-s.r * 0.25, s.r * 0.1, s.r * 0.45, s.r * 0.35, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  function drawWind(ctx, w, h, t, wind) {
    ctx.save();
    ctx.strokeStyle = "rgba(90, 130, 180, 0.45)";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    var ang = Math.atan2(wind.ay, wind.ax);
    for (var row = 0; row < 6; row++) {
      for (var col = 0; col < 4; col++) {
        var x = 40 + col * 90 + (row % 2) * 20 + Math.sin(t * 2 + row) * 6;
        var y = 50 + row * 95 + (t * 30 * wind.ay) % 20;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(ang) * 22, y + Math.sin(ang) * 22);
        ctx.moveTo(x + Math.cos(ang) * 22, y + Math.sin(ang) * 22);
        ctx.lineTo(x + Math.cos(ang) * 14 - Math.sin(ang) * 5, y + Math.sin(ang) * 14 + Math.cos(ang) * 5);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  function drawFold(ctx, w, h, f, t) {
    var cover = f.cover * w;
    var x = f.side === "right" ? w - cover : 0;
    ctx.save();
    ctx.fillStyle = "rgba(210, 190, 150, 0.88)";
    ctx.fillRect(x, 0, cover, h);
    ctx.strokeStyle = "rgba(90, 70, 40, 0.45)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    if (f.side === "right") { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
    else { ctx.moveTo(x + cover, 0); ctx.lineTo(x + cover, h); }
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 248, 230, 0.35)";
    ctx.beginPath();
    if (f.side === "right") ctx.moveTo(x, 0), ctx.lineTo(x + 28, 0), ctx.lineTo(x, 50);
    else ctx.moveTo(x + cover, 0), ctx.lineTo(x + cover - 28, 0), ctx.lineTo(x + cover, 50);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(58,42,34,0.55)";
    ctx.font = "800 12px Comic Sans MS, Trebuchet MS, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("folded", x + cover / 2, 24);
    ctx.restore();
  }
  function drawCombo(ctx, c, t) {
    ctx.save();
    ctx.translate(c.x, c.y);
    if (c.kind === "splash") {
      ctx.strokeStyle = "#3d8fd8";
      ctx.globalAlpha = 0.55 + Math.sin(c.pulse * 6) * 0.15;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 16 + (c.pulse % 1.8) * 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.stroke();
    } else if (c.kind === "bush") {
      ctx.fillStyle = "#5fbf6e";
      ctx.strokeStyle = "#226c36";
      ctx.lineWidth = 2;
      for (var i = 0; i < 4; i++) {
        var a = i * Math.PI / 2 + t;
        ctx.beginPath();
        ctx.ellipse(Math.cos(a) * 8, Math.sin(a) * 6, 8, 5, a, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    } else {
      ctx.strokeStyle = "#9a2e24";
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      for (var j = 0; j < 6; j++) {
        var b = j * Math.PI / 3;
        ctx.beginPath();
        ctx.moveTo(Math.cos(b) * 4, Math.sin(b) * 4);
        ctx.lineTo(Math.cos(b) * 14, Math.sin(b) * 14);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  function drawPad(ctx, p, t) {
    ctx.save();
    ctx.strokeStyle = "#c98910";
    ctx.fillStyle = "rgba(255, 210, 74, 0.25)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    var corners = cornersOf(p.pts);
    if (corners.length === 3) {
      ctx.moveTo(corners[0].x, corners[0].y);
      ctx.lineTo(corners[1].x, corners[1].y);
      ctx.lineTo(corners[2].x, corners[2].y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }
  function zapTicks(ctx, st, t) {
    ctx.save();
    ctx.strokeStyle = "#fff8e6";
    ctx.lineWidth = 1.6;
    ctx.globalAlpha = 0.7;
    var L = st.length, step = 28;
    for (var d = 8; d < L; d += step) {
      var p = pointAtStroke(st, d);
      var flicker = Math.sin(t * 12 + d) * 4;
      ctx.beginPath();
      ctx.moveTo(p.x - 4, p.y + flicker);
      ctx.lineTo(p.x, p.y - 5 - flicker);
      ctx.lineTo(p.x + 3, p.y + 2);
      ctx.stroke();
    }
    ctx.restore();
  }
  function purpleEnds(ctx, st, t) {
    var a = st.pts[0], b = st.pts[st.pts.length - 1];
    [a, b].forEach(function (p, i) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.strokeStyle = "#8a5ad4";
      ctx.fillStyle = "rgba(138, 90, 212, 0.25)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 8 + Math.sin(t * 4 + i) * 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    });
  }

  function crayonStroke(ctx, pts, color, width, seed) {
    if (!pts || pts.length < 2) return;
    var pal = CRAYON[color] || CRAYON.blue;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
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

  function drawHouse(ctx, x, y, hp, max, t, tiny) {
    ctx.save();
    ctx.translate(x, y);
    var sc = tiny ? 0.85 : 1;
    ctx.scale(sc, sc);
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
    ctx.fillStyle = "#fff8e6";
    ctx.strokeStyle = "#3a2a22";
    ctx.lineWidth = 3;
    roundish(ctx, -32, -22, 64, 48, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#e05645";
    ctx.beginPath();
    ctx.moveTo(-38, -18);
    ctx.lineTo(0, -48 + Math.sin(t * 0.5) * 0.5);
    ctx.lineTo(38, -18);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#c4894a";
    roundish(ctx, -8, -2, 16, 24, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffe17a";
    ctx.beginPath();
    ctx.arc(4, 10, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#8ec8f4";
    ctx.fillRect(12, -10, 12, 10);
    ctx.strokeRect(12, -10, 12, 10);
    var maxH = tiny ? 3 : Math.max(1, max);
    var hearts = tiny ? 3 : Math.max(0, Math.ceil(hp));
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
    } else if (color === "yellow") {
      ctx.beginPath();
      ctx.ellipse(0, 0, 11, 10, 0.2, 0, Math.PI * 2);
    } else if (color === "purple") {
      ctx.beginPath();
      ctx.ellipse(0, 1, 10, 11, -0.15, 0, Math.PI * 2);
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
    if (color === "yellow") {
      ctx.strokeStyle = pal.dark;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(10, -8); ctx.lineTo(14, -14); ctx.lineTo(16, -6);
      ctx.stroke();
    }
    if (color === "purple") {
      ctx.strokeStyle = pal.dark;
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0.2, 1.2);
      ctx.stroke();
    }
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
    var sc = m.scale || 1;
    var fly = m.kind === "flyer" ? -14 + Math.sin(t * 7 + (m.id || 0)) * 3 : 0;
    var hop = (m.hopping && m.hopping > 0) ? -10 * Math.sin((1 - Math.max(0, m.hopping) / 0.55) * Math.PI) : 0;
    ctx.translate(x, y + Math.sin(t * 3 + (m.id || 1)) * 1.2 + hop + fly);
    ctx.scale(sc, sc);
    if (m.hurt > 0) ctx.globalAlpha = 0.7 + Math.sin(t * 30) * 0.3;
    var ink = "#5a5562";
    if (m.kind === "eater" || m.boss === "nibble") ink = "#c45a7a";
    if (m.kind === "jumper") ink = "#5a7a4a";
    if (m.kind === "splitter") ink = "#6a5a88";
    if (m.kind === "sneaky") ink = "#4a6a88";
    if (m.kind === "boss") ink = "#4a3a52";
    if (m.kind === "armored") ink = "#6a6a78";
    if (m.kind === "healer") ink = "#3a9a62";
    if (m.kind === "flyer") ink = "#b0689a";
    ctx.strokeStyle = ink;
    ctx.lineWidth = m.kind === "boss" ? 4 : 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    var sq = m.squiggle || menuSquiggle;
    for (var i = 0; i < sq.length; i++) {
      var jx = sq[i].x, jy = sq[i].y;
      if (i === 0) ctx.moveTo(jx, jy);
      else ctx.lineTo(jx, jy);
    }
    ctx.stroke();
    if (m.kind === "jumper") {
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-8, 8); ctx.quadraticCurveTo(-12, 16, -6, 18);
      ctx.moveTo(8, 8); ctx.quadraticCurveTo(12, 16, 6, 18);
      ctx.stroke();
    }
    if (m.kind === "eater" || m.boss === "nibble") {
      ctx.fillStyle = "#f4a4b8";
      ctx.beginPath();
      ctx.ellipse(0, 8, 8, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(90, 85, 98, 0.25)";
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill();
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
    if (m.kind === "flyer") {
      var flap = Math.sin(t * 18 + (m.id || 0)) * 0.5;
      ctx.fillStyle = "rgba(255,248,230,0.85)";
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.6;
      [-1, 1].forEach(function (sd) {
        ctx.save();
        ctx.scale(sd, 1);
        ctx.rotate(-0.5 + flap);
        ctx.beginPath();
        ctx.ellipse(15, -6, 11, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      });
    }
    if (m.kind === "armored" || (m.armor && m.kind === "boss")) {
      ctx.strokeStyle = "#8a8a9a";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, 15, Math.PI * 0.1, Math.PI * 1.9);
      ctx.stroke();
      ctx.strokeStyle = "#c8c8d4";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, 15, Math.PI * 1.1, Math.PI * 1.55);
      ctx.stroke();
    }
    if (m.kind === "healer") {
      ctx.fillStyle = "#6fd09a";
      ctx.strokeStyle = "#2f7a52";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.rect(-2.5, -20, 5, 12);
      ctx.rect(-6, -16.5, 12, 5);
      ctx.fill();
      ctx.stroke();
    }
    if (m.kind === "boss") {
      ctx.fillStyle = "#e8c130";
      ctx.strokeStyle = "#9a7a12";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-8, -10); ctx.lineTo(-5, -18); ctx.lineTo(-1, -11); ctx.lineTo(0, -20); ctx.lineTo(1, -11); ctx.lineTo(5, -18); ctx.lineTo(8, -10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
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
    if (play && !play.paused && screen === "play" && !manual) {
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
    var swBtn = document.getElementById("btn-start-wave");
    if (swBtn) swBtn.addEventListener("click", function () {
      if (window.DDAudio) window.DDAudio.unlock();
      startWave();
      updateHud();
    });
    var endBtn = document.getElementById("btn-endless");
    if (endBtn) endBtn.addEventListener("click", function () {
      if (window.DDAudio) window.DDAudio.unlock();
      sfx("tap");
      beginEndless();
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
      if (play && play.endless) beginEndless({ diff: play.diff });
      else if (play) beginLevel(play.id, { diff: play.diff });
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
        var tool = b.getAttribute("data-tool");
        if (!crayonUnlocked(tool)) {
          showHint(tool === "purple" ? "Beat the second boss to unlock Blink!" : "Beat the first boss to unlock Zap!", 2.4);
          sfx("dry");
          return;
        }
        play.tool = tool;
        sfx("select");
        syncTools();
      });
    });
    var field = document.getElementById("field");
    field.addEventListener("pointerdown", onFieldDown);
    field.addEventListener("pointermove", onFieldMove);
    field.addEventListener("pointerup", onFieldUp);
    field.addEventListener("pointercancel", onFieldUp);
    bindSeg("set-diff", function (v) {
      if (v === "nightmare" && !save.nightmare) return false;
      save.settings.diff = v; persist();
    });
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
        if (b.disabled) return;
        if (fn(b.getAttribute("data-val")) === false) return;
        Array.prototype.forEach.call(root.querySelectorAll("button"), function (x) { x.classList.remove("on"); });
        b.classList.add("on");
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
    var nb = document.querySelector('#set-diff [data-val="nightmare"]');
    if (nb) {
      nb.disabled = !save.nightmare;
      nb.textContent = save.nightmare ? "Nightmare" : "Nightmare 🔒";
    }
    set("set-bat", save.settings.battery);
    set("set-sfx", save.settings.sfx ? "on" : "off");
    set("set-mus", save.settings.music ? "on" : "off");
  }

  function laneAt(L, d) {
    return walk(L, d);
  }
  function drawLanes(ctx, t) {
    if (!play || !play.lanes.length) return;
    var strong = play.phase === "plan" ? 1 : 0.55;
    play.lanes.forEach(function (L) {
      if (L.length < 2) return;
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "rgba(120, 96, 70, " + (0.10 * strong) + ")";
      ctx.lineWidth = 22;
      ctx.beginPath();
      L.forEach(function (p, i) { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
      ctx.stroke();
      ctx.setLineDash([7, 9]);
      ctx.strokeStyle = "rgba(110, 84, 58, " + (0.42 * strong) + ")";
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.setLineDash([]);
      var total = polylineLen(L);
      ctx.strokeStyle = "rgba(110, 84, 58, " + (0.5 * strong) + ")";
      ctx.lineWidth = 2.5;
      for (var d = 36; d < total - 20; d += 70) {
        var p = walk(L, d), q = walk(L, d + 8);
        var a = Math.atan2(q.y - p.y, q.x - p.x);
        ctx.beginPath();
        ctx.moveTo(p.x - Math.cos(a - 0.6) * 8, p.y - Math.sin(a - 0.6) * 8);
        ctx.lineTo(p.x, p.y);
        ctx.lineTo(p.x - Math.cos(a + 0.6) * 8, p.y - Math.sin(a + 0.6) * 8);
        ctx.stroke();
      }
      ctx.restore();
    });
  }
  function drawBlot(ctx, b, t) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.fillStyle = "rgba(48, 40, 56, 0.55)";
    ctx.beginPath();
    for (var i = 0; i <= 12; i++) {
      var a = (i / 12) * Math.PI * 2;
      var r = b.r * (0.88 + 0.14 * Math.sin(i * 2.3 + b.x));
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(255,248,230,0.55)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-b.r * 0.35, -b.r * 0.35); ctx.lineTo(b.r * 0.35, b.r * 0.35);
    ctx.moveTo(b.r * 0.35, -b.r * 0.35); ctx.lineTo(-b.r * 0.35, b.r * 0.35);
    ctx.stroke();
    ctx.restore();
  }
  function vineCracks(ctx, st) {
    ctx.save();
    ctx.strokeStyle = "rgba(90,50,24,0.8)";
    ctx.lineWidth = 2;
    for (var d = 20; d < st.length; d += 46) {
      var p = pointAtStroke(st, d);
      ctx.beginPath();
      ctx.moveTo(p.x - 4, p.y - 4); ctx.lineTo(p.x + 1, p.y + 1); ctx.lineTo(p.x - 2, p.y + 5);
      ctx.stroke();
    }
    ctx.restore();
  }
  function drawPreview(ctx, t, w, h) {
    var items = play.waves[play.waveIdx] || [];
    if (!items.length) return;
    var byLane = {};
    items.forEach(function (it) {
      var li = play.lanes[it.lane] ? it.lane : 0;
      if (!byLane[li]) byLane[li] = {};
      var key = it.kind === "boss" ? "boss:" + it.boss : it.kind;
      byLane[li][key] = (byLane[li][key] || 0) + 1;
    });
    Object.keys(byLane).forEach(function (li) {
      var L = play.lanes[li];
      if (!L) return;
      var kinds = Object.keys(byLane[li]);
      var bw = 14 + kinds.length * 42;
      var ex = L[0].x, ey = L[0].y;
      var mx = clamp(ex, bw / 2 + 4, w - bw / 2 - 4);
      var my = clamp(ey < 60 ? ey + 34 : ey, 30, h - 30);
      if (ex < 30) mx = Math.max(mx, bw / 2 + 24);
      if (ex > w - 30) mx = Math.min(mx, w - bw / 2 - 24);
      ctx.save();
      ctx.fillStyle = "rgba(255,248,230,0.92)";
      ctx.strokeStyle = "#3a2a22";
      ctx.lineWidth = 2;
      roundish(ctx, mx - bw / 2, my - 18, bw, 36, 12);
      ctx.fill();
      ctx.stroke();
      kinds.forEach(function (k, i) {
        var cx = mx - bw / 2 + 28 + i * 42 - (kinds.length > 0 ? 6 : 0);
        var isBoss = k.indexOf("boss:") === 0;
        ctx.save();
        ctx.translate(cx, my - 1);
        ctx.scale(0.62, 0.62);
        drawMonster(ctx, 0, 0, t, {
          squiggle: menuSquiggle, hurt: 0, hp: 1, max: 1, id: i, kind: isBoss ? "boss" : k,
          boss: isBoss ? k.slice(5) : null, scale: 1, armor: false, hopping: 0,
        });
        ctx.restore();
        ctx.fillStyle = "#3a2a22";
        ctx.font = "800 12px Comic Sans MS, Trebuchet MS, sans-serif";
        ctx.textAlign = "left";
        ctx.fillText("×" + byLane[li][k], cx + 12, my + 5);
      });
      // entrance arrow
      var q = L[1] || L[0];
      var ang = Math.atan2(q.y - ey, q.x - ex);
      ctx.strokeStyle = "#c74538";
      ctx.lineWidth = 3;
      ctx.beginPath();
      var ax = clamp(ex, 14, w - 14) + Math.cos(ang) * 6, ay = clamp(ey, 10, h - 10) + Math.sin(ang) * 6;
      ctx.moveTo(ax, ay);
      ctx.lineTo(ax + Math.cos(ang) * 16, ay + Math.sin(ang) * 16);
      ctx.stroke();
      ctx.restore();
    });
  }

  function snapshot() {
    if (!play) return { screen: screen, play: null };
    var fs = fieldSize();
    var nextItems = (play.phase === "plan" && play.waves[play.waveIdx]) ? play.waves[play.waveIdx] : [];
    return {
      screen: screen,
      field: { w: fs.w, h: fs.h },
      ended: play.ended,
      endReason: play.endReason,
      t: play.t,
      ink: play.ink,
      inkMax: play.inkMax,
      tool: play.tool,
      phase: play.phase,
      drawing: !!(play.drawing && play.drawing.pts.length),
      drawPts: play.drawing ? play.drawing.pts.length : 0,
      timeScale: timeScale,
      diff: play.diff,
      goal: play.goal,
      endless: !!play.endless,
      wave: play.endless ? play.wave : currentWave(),
      waveIdx: play.waveIdx,
      waveCount: play.waves.length,
      preview: nextItems.map(function (it) { return { kind: it.kind, lane: it.lane, boss: it.boss || null }; }),
      lanes: play.lanes.map(function (L) { return L.map(function (p) { return { x: p.x, y: p.y }; }); }),
      blots: play.blots.map(function (b) { return { x: b.x, y: b.y, r: b.r }; }),
      stains: play.stains.map(function (b) { return { x: b.x, y: b.y, r: b.r }; }),
      puddles: play.puddles.map(function (b) { return { x: b.x, y: b.y, r: b.r }; }),
      fold: play.fold ? { side: play.fold.side, cover: play.fold.cover } : null,
      wind: play.wind ? { ax: play.wind.ax, ay: play.wind.ay } : null,
      score: play.score || 0,
      rating: play.rating || 0,
      rules: play.rules || null,
      leaks: play.leaks,
      usedCombo: !!play.usedCombo,
      lives: play.house.hp,
      houseHp: play.house.hp,
      houseHurt: !!play.houseHurt,
      house: { x: play.house.x, y: play.house.y, hp: play.house.hp, max: play.house.max },
      stars: play.stars.map(function (s) { return { x: s.x, y: s.y, taken: !!s.taken }; }),
      starsHave: play.starsHave,
      starsNeed: play.starsNeed,
      crayons: { yellow: !!save.crayons.yellow, purple: !!save.crayons.purple },
      combos: play.combos.map(function (c) { return { kind: c.kind, x: c.x, y: c.y }; }),
      pads: play.pads.map(function (p) { return { x: p.x, y: p.y, id: p.id }; }),
      strokes: play.strokes.map(function (s) {
        return { id: s.id, color: s.color, closed: s.closed, triangle: !!s.triangle, throughPuddle: s.throughPuddle, length: s.length, n: s.pts.length, hp: s.hp, charges: s.charges };
      }),
      critters: play.critters.map(function (c) {
        return { id: c.id, color: c.color, strokeId: c.strokeId, t: c.t, x: c.x, y: c.y, launch: c.launch || 0 };
      }),
      monsters: play.monsters.map(function (m) {
        return {
          id: m.id, kind: m.kind, boss: m.boss || null, x: m.x, y: m.y, hp: m.hp, max: m.max,
          phase: m.phase || 0, armor: !!m.armor, hopping: !!(m.hopping > 0), visible: monsterVisible(m),
          chew: m.chew || 0, tiny: !!m.tiny, leaked: !!m.leaked, lane: m.lane,
        };
      }),
    };
  }

  function advance(sec) {
    if (!play) return;
    var n = Math.max(1, Math.round(sec * 30));
    for (var i = 0; i < n; i++) {
      if (play.ended || play.paused) break;
      updatePlay(1 / 30);
    }
    if (play.ended && !document.getElementById("modal-end").classList.contains("on")) finishEnd();
    updateHud();
  }

  window.DD = {
    start: function (opts) {
      opts = opts || {};
      if (opts.endless) beginEndless(opts);
      else beginLevel(opts.level || 1, opts);
      return snapshot();
    },
    startEndless: function (opts) { beginEndless(opts || {}); return snapshot(); },
    startWave: function () { var ok = startWave(); updateHud(); return ok; },
    advance: advance,
    setManual: function (v) { manual = !!v; },
    screen: function () { return screen; },
    state: snapshot,
    setTool: function (id) { if (play && crayonUnlocked(id)) { play.tool = id; syncTools(); } },
    setInk: function (n) { if (play) { play.ink = clamp(n, 0, play.inkMax); updateHud(); } },
    setTimeScale: function (n) { timeScale = Math.max(0.1, n); },
    setHouseHp: function (n) { if (play) { play.house.hp = n; updateHud(); } },
    setMonsterHp: function (id, hp) { if (play) play.monsters.forEach(function (m) { if (m.id === id) m.hp = hp; }); },
    drawStroke: function (pts, color) {
      /* Test hook: same rules as a finger. Wind shift, fold and blots stop the line, stains cost double, ink runs out. */
      if (!play || play.ended || !pts || pts.length < 2) return null;
      var c = color || play.tool;
      var per = inkCostPerPx(c);
      var dense = [{ x: pts[0].x, y: pts[0].y }];
      for (var k = 1; k < pts.length; k++) {
        var a = pts[k - 1], b = pts[k], dd = dist(a, b), n = Math.max(1, Math.ceil(dd / 8));
        for (var s = 1; s <= n; s++) dense.push({ x: a.x + (b.x - a.x) * s / n, y: a.y + (b.y - a.y) * s / n });
      }
      var out = [];
      for (var q = 0; q < dense.length; q++) {
        var pt = dense[q];
        if (play.wind) pt = { x: pt.x + play.wind.ax * 16, y: pt.y + play.wind.ay * 16 };
        if (foldedAt(pt.x, pt.y) || inBlot(pt.x, pt.y)) break;
        if (out.length) {
          var last = out[out.length - 1];
          var d = dist(last, pt);
          var pp = per * (inStain(pt.x, pt.y) ? 2 : 1);
          if (play.ink <= 0) break;
          if (d * pp > play.ink) {
            var tt = play.ink / pp / d;
            pt = { x: last.x + (pt.x - last.x) * tt, y: last.y + (pt.y - last.y) * tt };
            d = dist(last, pt);
            play.ink = Math.max(0, play.ink - d * pp);
            out.push(pt);
            break;
          }
          play.ink = Math.max(0, play.ink - d * pp);
        }
        out.push(pt);
      }
      var st = commitStroke(c, out);
      updateHud();
      return st;
    },
    spawnMonster: function (opts) { return play ? spawnMonster(opts) : null; },
    addStars: function (n) { if (play) { play.starsHave += n; updateHud(); } },
    unlockCrayon: function (name) {
      if (name === "yellow" || name === "purple") save.crayons[name] = true;
      persist();
      syncTools();
    },
    unlockNightmare: function () { save.nightmare = true; persist(); syncSettingButtons(); },
    unlockAll: function () { save.unlocked = 18; save.crayons.yellow = true; save.crayons.purple = true; persist(); syncTools(); },
    rating: function () { return play ? (play.rating || (play.ended === "win" ? ratePage() : 0)) : 0; },
    save: function () { return jsonCopy(save); },
    cost: function (color) { return inkCostPerPx(color); },
    levels: LEVELS,
    worlds: WORLDS,
    diffs: DIFFS,
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
