/* Doodle Defense — original local prototype. Not a lane or tower game. */
(function () {
  "use strict";

  var DESIGN_W = 390;
  var DESIGN_H = 844;
  var FIELD_W = 390;
  var FIELD_H = 620;
  var SAVE_KEY = "doodle-defense-v2";
  var SAVE_KEY_OLD = "doodle-defense-v1";
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
      if (s.unlocked) out.unlocked = s.unlocked;
      if (s.wins) out.wins = s.wins;
      if (s.stars) out.stars = s.stars;
      else if (s.wins) {
        Object.keys(s.wins).forEach(function (k) { if (s.wins[k]) out.stars[k] = 1; });
      }
      if (s.crayons) {
        out.crayons.yellow = !!s.crayons.yellow;
        out.crayons.purple = !!s.crayons.purple;
      }
      if (typeof s.endlessBest === "number") out.endlessBest = s.endlessBest;
      if (s.settings) {
        if (s.settings.diff === "easy" || s.settings.diff === "normal" || s.settings.diff === "hard") {
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
  function easy() { return play && play.diff === "easy"; }
  function hard() { return play && play.diff === "hard"; }

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

  /* ---------- play state ---------- */
  function beginLevel(id, opts) {
    opts = opts || {};
    var lv = LEVELS.find(function (x) { return x.id === id; }) || LEVELS[0];
    var diff = opts.diff || save.settings.diff || "normal";
    timeScale = opts.timeScale != null ? opts.timeScale : 1;
    var hpBonus = diff === "easy" ? 1 : diff === "hard" ? -1 : 0;
    var hp = opts.houseHp != null ? opts.houseHp : Math.max(3, lv.house.hp + hpBonus);
    var stars = (opts.stars || lv.stars || []).map(function (s) {
      return { x: sx(s.x), y: sy(s.y), taken: !!s.taken };
    });
    var fs = fieldSize();
    play = {
      id: lv.id,
      name: lv.name,
      blurb: lv.blurb,
      diff: diff,
      goal: lv.goal,
      boss: lv.boss || null,
      adapt: !!lv.adapt,
      endless: false,
      t: 0,
      ink: opts.ink != null ? opts.ink : 100,
      inkMax: 100,
      inkSlow: 0,
      tool: "blue",
      drawing: null,
      strokes: [],
      critters: [],
      monsters: [],
      parts: [],
      floats: [],
      combos: [],
      pads: [],
      house: { x: sx(lv.house.x), y: sy(lv.house.y), hp: hp, max: hp },
      puddles: (lv.puddles || []).map(function (p) {
        return {
          x: sx(p.x), y: sy(p.y),
          r: (p.r * (fs.w / FIELD_W + fs.h / FIELD_H)) / 2,
          vx: p.vx ? sx(p.vx) - sx(0) : 0,
          vy: p.vy ? sy(p.vy) - sy(0) : 0,
        };
      }),
      stains: (lv.stains || []).map(function (p) {
        return { x: sx(p.x), y: sy(p.y), r: (p.r * (fs.w / FIELD_W + fs.h / FIELD_H)) / 2 };
      }),
      wind: lv.wind ? { ax: lv.wind.ax, ay: lv.wind.ay } : null,
      fold: lv.fold ? { side: lv.fold.start || "right", cover: lv.fold.cover || 0.36, period: lv.fold.period || 8, t: 0, flipping: 0 } : null,
      stars: stars,
      starsNeed: opts.starsNeed != null ? opts.starsNeed : (lv.starsNeed || 0),
      starsHave: opts.starsHave || 0,
      spawns: (opts.spawns || (opts.noMonsters ? [] : lv.spawns) || []).map(function (s) {
        return { at: s.at, x: sx(s.x), y: sy(s.y), kind: s.kind || "scribble", boss: s.boss || null, wave: s.wave || 1, done: false };
      }),
      wave: 0,
      score: 0,
      houseHurt: false,
      zapT: 0,
      ended: null,
      endTimer: 0,
      rating: 0,
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

  function beginEndless(opts) {
    opts = opts || {};
    var diff = opts.diff || save.settings.diff || "normal";
    timeScale = opts.timeScale != null ? opts.timeScale : 1;
    var hp = opts.houseHp != null ? opts.houseHp : (diff === "easy" ? 7 : diff === "hard" ? 5 : 6);
    play = {
      id: 0,
      name: "Endless Sketch",
      blurb: "How long can you keep the page clean?",
      diff: diff,
      goal: "house",
      boss: null,
      adapt: true,
      endless: true,
      t: 0,
      ink: opts.ink != null ? opts.ink : 100,
      inkMax: 100,
      inkSlow: 0,
      tool: "blue",
      drawing: null,
      strokes: [],
      critters: [],
      monsters: [],
      parts: [],
      floats: [],
      combos: [],
      pads: [],
      house: { x: sx(195), y: sy(460), hp: hp, max: hp },
      puddles: [{ x: sx(80), y: sy(200), r: sx(40) - sx(0), vx: sx(16) - sx(0), vy: sy(8) - sy(0) }],
      stains: [],
      wind: null,
      fold: null,
      stars: [],
      starsNeed: 0,
      starsHave: 0,
      spawns: [],
      wave: 0,
      nextWaveAt: 3,
      score: 0,
      houseHurt: false,
      zapT: 0,
      ended: null,
      endTimer: 0,
      rating: 0,
      paused: false,
      firstDraw: false,
    };
    hint = "Draw a loop around the house, then mix your colors!";
    hintUntil = 8;
    if (save.crayons.yellow || save.crayons.purple) {
      hint = "Use every crayon you've unlocked. Waves keep coming!";
    }
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
      var d = save.settings.diff;
      if (d === "easy") tag.textContent = "Easy is on. Draw whatever you like.";
      else if (d === "hard") tag.textContent = "Hard is on. Plan your lines — ink comes back slowly.";
      else tag.textContent = "Normal is on. Little kids can switch to Easy.";
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
        var lv = LEVELS.find(function (x) { return x.id === id; });
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
  function updateHud() {
    if (!play) return;
    var ink = Math.max(0, Math.round(play.ink));
    document.getElementById("ink-count").textContent = String(ink);
    document.getElementById("ink-num").textContent = String(ink);
    document.getElementById("ink-fill").style.transform = "scaleX(" + (play.ink / play.inkMax) + ")";
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
    if (wc) wc.textContent = String(play.endless ? play.wave : waveN);
    if (play.ended === "win") wl.textContent = "What a doodle!";
    else if (play.ended === "lose") wl.textContent = play.endless ? "Sketch over" : "Smudged…";
    else if (play.endless) wl.textContent = "Wave " + Math.max(1, play.wave) + "  •  " + play.score;
    else if (play.goal === "stars") wl.textContent = "Collect " + play.starsNeed + " stars";
    else if (waveMax > 1) wl.textContent = "Wave " + Math.max(1, waveN) + " of " + waveMax;
    else wl.textContent = "Protect the house";
    var hintEl = document.getElementById("hint");
    if (hint && play.t < hintUntil && !play.ended && !play.paused) {
      hintEl.textContent = hint;
      hintEl.classList.add("on");
    } else hintEl.classList.remove("on");
  }
  function currentWave() {
    if (!play) return 0;
    if (play.endless) return play.wave;
    var n = 1;
    play.spawns.forEach(function (s) { if (s.done && (s.wave || 1) >= n) n = s.wave; });
    var pending = play.spawns.find(function (s) { return !s.done; });
    if (pending) n = pending.wave || n;
    return n;
  }
  function maxWave() {
    if (!play || play.endless) return 0;
    var m = 1;
    play.spawns.forEach(function (s) { if ((s.wave || 1) > m) m = s.wave; });
    return m;
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
  function inkCostPerPx() {
    var c = easy() ? 0.11 : hard() ? 0.19 : 0.15;
    if (play && (play.tool === "yellow" || (play.drawing && play.drawing.color === "yellow"))) c *= 1.12;
    return c;
  }
  function inkRefillPerSec() {
    var base = easy() ? 9 : hard() ? 4.5 : 6.2;
    var page = 1;
    if (play) page = play.endless ? (5 + play.wave) : (play.id || 1);
    var late = Math.max(0.5, 1 - (page - 1) * 0.025);
    if (play && play.inkSlow > 0) late *= 0.55;
    return base * late;
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
    if (play.ink < 4) {
      showHint("Need more ink!", 2);
      sfx("dry");
      return;
    }
    if (play.strokes.length >= 14) {
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
    if (play.wind) {
      p = { x: p.x + play.wind.ax * 16, y: p.y + play.wind.ay * 16 };
    }
    if (foldedAt(p.x, p.y)) {
      finishStroke();
      showHint("The fold stopped your line.", 2);
      return;
    }
    var pts = play.drawing.pts;
    var last = pts[pts.length - 1];
    var d = dist(last, p);
    if (d < 4) return;
    var costMul = inStain(p.x, p.y) ? 2 : 1;
    if (inStain(p.x, p.y)) play.inkSlow = 3;
    var cost = d * inkCostPerPx() * costMul;
    if (play.ink <= 0) {
      finishStroke();
      sfx("dry");
      showHint("Ink ran out!", 2);
      return;
    }
    if (cost > play.ink) {
      var allow = play.ink / (inkCostPerPx() * costMul);
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
      play.ink = Math.min(play.inkMax, play.ink + length * inkCostPerPx());
      return null;
    }
    var closed = isLoop(pts, length);
    if (closed) pts = pts.concat([pts[0]]);
    var through = strokeThroughPuddle(pts, play.puddles);
    var tri = closed && isTriangle(pts);
    var st = {
      id: seq++,
      color: color,
      pts: pts,
      closed: closed,
      triangle: tri,
      throughPuddle: through,
      length: polylineLen(pts),
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
      showHint("Launch pad!", 2.2);
      sfx("launch");
    } else if (closed) showHint("A loop! They'll walk in a circle.", 2.4);
    else if (through) showHint("Swimmers!", 2);
    else if (color === "yellow") showHint("Zap line! It ticks along the path.", 2.2);
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
        launch: 0,
        lvx: 0,
        lvy: 0,
        teleCd: 0,
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
        hits.forEach(function (p, k) {
          // de-dupe close hits
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
      fresh.forEach(function (c) {
        if (c.kind === "splash") { sfx("burst"); floatText(c.x, c.y - 10, "Splash!", "#245f96"); }
        if (c.kind === "bush") { sfx("bush"); floatText(c.x, c.y - 10, "Bush!", "#226c36"); }
        if (c.kind === "thorn") { sfx("thorn"); floatText(c.x, c.y - 10, "Thorns!", "#9a2e24"); }
        puff(c.x, c.y, c.kind === "splash" ? "#6eb7e8" : c.kind === "bush" ? "#7bc87a" : "#e05645", 8);
        if (play.endless) play.score += 15;
      });
      if (fresh[0].kind === "splash") showHint("Splash burst!", 2);
      else if (fresh[0].kind === "bush") showHint("Bouncy bush!", 2);
      else showHint("Thorn patch!", 2);
    }
    // drop pads whose stroke is gone
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
      var back = st.length * inkCostPerPx() * 0.25;
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
    play.t += dt;
    if (play.inkSlow > 0) play.inkSlow = Math.max(0, play.inkSlow - dt);
    if (!play.drawing) {
      play.ink = Math.min(play.inkMax, play.ink + inkRefillPerSec() * dt);
    }
    tickFold(dt);
    tickPuddles(dt);
    spawnMonsters();
    maybeEndlessWave();
    tickCritters(dt);
    tickCombos(dt);
    tickZap(dt);
    tickPads(dt);
    tickMonsters(dt);
    tickFx(dt);
    checkEnd();
    if (!play.firstDraw && play.t > 1) {
      hint = play.id === 1 ? "Pick a crayon, then draw a path." : (hint || "");
      hintUntil = play.t + 1;
    }
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

  function spawnMonsters() {
    play.spawns.forEach(function (s) {
      if (!s.done && play.t >= s.at) {
        s.done = true;
        var kind = s.kind === "adapt" ? adaptKind() : (s.kind || "scribble");
        spawnMonster({ x: s.x, y: s.y, kind: kind, boss: s.boss });
      }
    });
  }
  function adaptKind() {
    if (!play) return "scribble";
    if (easy() && Math.random() < 0.55) return "scribble";
    var greens = 0, blues = 0, reds = 0;
    play.strokes.forEach(function (s) {
      if (s.color === "green") greens++;
      else if (s.color === "blue") blues++;
      else if (s.color === "red") reds++;
    });
    var n = play.strokes.length;
    var picks = ["scribble"];
    if (greens >= 1) picks.push("jumper", "jumper");
    if (n >= 3) picks.push("eater");
    if (reds >= 2) picks.push("splitter");
    if (blues < 1) picks.push("sneaky", "sneaky");
    else picks.push("eater");
    if (hard()) {
      if (greens) picks.push("jumper");
      if (n >= 2) picks.push("eater");
    }
    return picks[Math.floor(Math.random() * picks.length)];
  }
  function maybeEndlessWave() {
    if (!play.endless) return;
    if (play.t < play.nextWaveAt) return;
    play.wave += 1;
    play.nextWaveAt = play.t + Math.max(6.5, 13 - play.wave * 0.35);
    var n = 2 + Math.floor((play.wave + 1) / 2);
    if (hard()) n += 1;
    if (easy()) n = Math.max(2, n - 1);
    if (n > 7) n = 7;
    var kinds = ["scribble"];
    if (play.wave >= 2) kinds.push("jumper");
    if (play.wave >= 3) kinds.push("splitter");
    if (play.wave >= 4) kinds.push("eater");
    if (play.wave >= 5) kinds.push("sneaky");
    var w = fieldSize().w;
    for (var i = 0; i < n; i++) {
      var kind = (play.adapt && play.wave >= 3 && Math.random() < 0.5) ? adaptKind() : kinds[i % kinds.length];
      var x = (w * (i + 1)) / (n + 1);
      spawnMonster({ x: x, y: sy(18), kind: kind });
    }
    if (play.wave % 6 === 0) {
      spawnMonster({ x: sx(195), y: sy(16), kind: "boss", boss: play.wave >= 12 ? "hidey" : (play.wave >= 6 ? "nibble" : "smudge") });
    }
    floatText(sx(195), sy(40), "Wave " + play.wave + "!", "#3a2a22");
    if (play.endless) play.score += 20;
  }

  function spawnMonster(opts) {
    opts = opts || {};
    var kind = opts.kind || "scribble";
    var boss = opts.boss || null;
    var hp = opts.hp;
    var spd = opts.spd;
    if (hp == null) {
      hp = easy() ? 14 : hard() ? 22 : 18;
      if (kind === "jumper") hp = Math.round(hp * 0.9);
      if (kind === "eater") hp = Math.round(hp * 1.15);
      if (kind === "splitter") hp = Math.round(hp * 1.05);
      if (kind === "sneaky") hp = Math.round(hp * 0.85);
      if (kind === "boss") {
        if (boss === "nibble") hp = easy() ? 90 : hard() ? 150 : 120;
        else if (boss === "hidey") hp = easy() ? 110 : hard() ? 180 : 150;
        else hp = easy() ? 80 : hard() ? 130 : 108;
      }
    }
    if (spd == null) {
      spd = easy() ? 28 : hard() ? 38 : 34;
      if (kind === "jumper") spd += 4;
      if (kind === "eater") spd -= 6;
      if (kind === "sneaky") spd += 2;
      if (kind === "boss") spd = easy() ? 20 : hard() ? 28 : 24;
    }
    var squiggle = [];
    var seed = seq * 17;
    var big = kind === "boss" ? 1.7 : (opts.tiny ? 0.7 : 1);
    for (var i = 0; i < 10; i++) {
      squiggle.push({
        x: Math.sin(seed * 0.7 + i * 1.7) * 10 * big,
        y: Math.cos(seed * 0.5 + i * 1.3) * 9 * big,
      });
    }
    var m = {
      id: seq++,
      kind: kind,
      boss: boss,
      x: opts.x,
      y: opts.y,
      hp: hp,
      max: hp,
      spd: spd,
      hurt: 0,
      nibbleCd: 0,
      squiggle: squiggle,
      hopping: 0,
      hopCd: 0.8 + Math.random(),
      chew: 0,
      chewTarget: null,
      chewsLeft: kind === "eater" || boss === "nibble" ? (hard() ? 2 : 1) : 0,
      hasSplit: !!opts.tiny,
      stealthed: kind === "sneaky",
      stealthT: 0,
      summonT: 0,
      tiny: !!opts.tiny,
      scale: big,
    };
    play.monsters.push(m);
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
          if (dist(c, m) < 26) hurtMonster(m, 18 * dt, "launch");
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
        if (m.hp <= 0 || (m.teleCd && m.teleCd > 0)) return;
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
        if (!pointInPoly(c.x, c.y, pad.pts) && dist(c, pad) > 22) return;
        var target = nearestMonster(c.x, c.y);
        if (!target) return;
        var ang = Math.atan2(target.y - c.y, target.x - c.x);
        c.lvx = Math.cos(ang) * 220;
        c.lvy = Math.sin(ang) * 220;
        c.launch = 0.55;
        pad.cd = 0.7;
        sfx("launch");
        puff(c.x, c.y, "#e8c130", 5);
      });
    });
  }
  function nearestMonster(x, y) {
    var best = null, bd = 9999;
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
          if (m.hp <= 0) return;
          if (dist(m, c) < 28) hurtMonster(m, 10 * dt, "thorn");
        });
      }
      if (c.kind === "bush") {
        play.monsters.forEach(function (m) {
          if (m.hp <= 0) return;
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
    play.strokes.forEach(function (st) {
      if (st.color !== "yellow" || strokeFolded(st)) return;
      play.monsters.forEach(function (m) {
        if (m.hp <= 0) return;
        if (nearStroke(st, m.x, m.y, 22)) {
          hurtMonster(m, 10, "zap");
          puff(m.x, m.y, "#ffe57a", 5);
          zapped = true;
        }
      });
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

  function tickMonsters(dt) {
    var house = play.house;
    play.monsters.forEach(function (m) {
      if (m.hp <= 0) { m.hurt -= dt; return; }
      if (m.hurt > 0) m.hurt -= dt;
      m.nibbleCd = Math.max(0, m.nibbleCd - dt);
      tickBoss(m, dt);
      if (m.kind === "jumper" || (m.kind === "boss" && (m.boss === "hidey" || m.boss === "smudge" && false))) {
        // hoppers and hidey hop
      }
      if (m.kind === "jumper" || m.boss === "hidey") {
        m.hopCd -= dt;
        if (m.hopping > 0) m.hopping -= dt;
        if (m.hopCd <= 0) {
          m.hopping = 0.55;
          m.hopCd = 2.2;
          sfx("jump");
        }
      }
      var visible = monsterVisible(m);
      // tickle
      var ticklers = 0;
      if (visible) {
        play.critters.forEach(function (c) {
          var r = 26 + (c.swim && inPuddle(m.x, m.y, play.puddles) ? 8 : 0);
          if (dist(c, m) < r) ticklers += 1;
        });
      }
      if (ticklers) {
        hurtMonster(m, ticklers * 8 * dt, "tickle");
        if (m.hp <= 0) return;
        if (Math.random() < dt * 6) sfx("tickle");
        puff(m.x, m.y, "#fff3a0", 1);
      }

      var target = house;
      var seekingLine = false;
      if ((m.kind === "eater" || m.boss === "nibble") && m.chewsLeft > 0) {
        var line = nearestChewStroke(m);
        if (line) {
          target = line.pt;
          m.chewTarget = line.st;
          seekingLine = true;
        }
      }
      var ang = Math.atan2(target.y - m.y, target.x - m.x);
      ang += Math.sin(play.t * 0.8 + m.id) * 0.35;
      var spd = m.spd;
      if (touchingColor(m, "blue", 16)) spd *= 0.45;
      if (inPuddle(m.x, m.y, play.puddles)) spd *= 0.7;
      if (m.hopping > 0) spd *= 1.55;
      var vx = Math.cos(ang) * spd;
      var vy = Math.sin(ang) * spd;
      var nx = m.x + vx * dt;
      var ny = m.y + vy * dt;
      var wall = (m.hopping > 0) ? null : vineHit(nx, ny, 13);
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
      if (seekingLine && m.chewTarget && nearStroke(m.chewTarget, m.x, m.y, 16)) {
        m.chew += dt;
        if (m.chew >= 1.3) {
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
      if (dist(m, house) < 30 && m.nibbleCd <= 0) {
        house.hp = Math.max(0, house.hp - 1);
        play.houseHurt = true;
        m.nibbleCd = 1.4;
        sfx("house");
        floatText(house.x, house.y - 28, "Smudge!", "#9a2e24");
        var b = Math.atan2(m.y - house.y, m.x - house.x);
        m.x += Math.cos(b) * 22;
        m.y += Math.sin(b) * 22;
      }
    });
    play.monsters = play.monsters.filter(function (m) { return m.hp > 0 || m.hurt > -0.5; });
  }

  function tickBoss(m, dt) {
    if (m.kind !== "boss") return;
    m.summonT += dt;
    if (m.boss === "smudge" && m.summonT >= 8) {
      m.summonT = 0;
      var adds = play.monsters.filter(function (x) { return x.kind === "scribble" && x.hp > 0; }).length;
      if (adds < 3) {
        spawnMonster({ x: m.x + 16, y: m.y + 8, kind: "scribble", tiny: true });
        floatText(m.x, m.y - 18, "A little one!", "#5a4a62");
      }
    }
    if (m.boss === "nibble" && !m.hasSplit && m.hp <= m.max * 0.5) {
      // split once but keep boss
      m.hasSplit = true;
      spawnMonster({ x: m.x + 22, y: m.y, kind: "eater", hp: Math.round(m.max * 0.35) });
      sfx("split");
      floatText(m.x, m.y - 16, "Two!", "#5a4a62");
    }
    if (m.boss === "hidey") {
      m.stealthT += dt;
      if (m.stealthed && m.stealthT >= 2.8) { m.stealthed = false; m.stealthT = 0; }
      else if (!m.stealthed && m.stealthT >= 5.5) { m.stealthed = true; m.stealthT = 0; }
      if (m.summonT >= 10) {
        m.summonT = 0;
        spawnMonster({ x: m.x, y: Math.max(20, m.y - 30), kind: "jumper", tiny: true });
        floatText(m.x, m.y - 18, "Hopper!", "#5a4a62");
      }
    }
  }

  function nearestChewStroke(m) {
    var best = null, bd = 9999;
    play.strokes.forEach(function (st) {
      if (strokeFolded(st)) return;
      var h = nearStroke(st, m.x, m.y, 999);
      if (!h) return;
      // prefer longer lines a bit
      var score = h.d - Math.min(40, st.length * 0.04);
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
    var best = null;
    for (var i = 0; i < play.strokes.length; i++) {
      var st = play.strokes[i];
      if (st.color !== "green") continue;
      var h = nearStroke(st, x, y, rad);
      if (h && (!best || h.d < best.d)) best = h;
    }
    return best;
  }

  function hurtMonster(m, dmg, reason) {
    if (!m || m.hp <= 0) return;
    if (!monsterVisible(m) && reason !== "splash") return;
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
    var hp = Math.max(8, Math.ceil(Math.max(m.hp, 1) * 0.75));
    var spd = m.spd * 1.15;
    var ox = m.x, oy = m.y;
    m.hp = 0;
    m.hurt = -0.05;
    spawnMonster({ kind: "scribble", x: ox - 14, y: oy, hp: hp, spd: spd, tiny: true });
    spawnMonster({ kind: "scribble", x: ox + 14, y: oy, hp: hp, spd: spd, tiny: true });
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
    play.ink = Math.min(play.inkMax, play.ink + 4);
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

  function ratePage() {
    var s = 1;
    if (play.ink >= play.inkMax * 0.28) s++;
    if (!play.houseHurt && play.house.hp >= play.house.max - 0.01) s++;
    return s;
  }

  function checkEnd() {
    if (play.ended) return;
    if (play.house.hp <= 0) {
      play.house.hp = 0;
      play.ended = "lose";
      play.endTimer = 0;
      if (play.endless && play.score > save.endlessBest) {
        save.endlessBest = play.score;
        persist();
      }
      sfx("lose");
      return;
    }
    if (play.endless) return;
    if (play.goal === "stars") {
      if (play.starsHave >= play.starsNeed) {
        play.ended = "win";
        play.rating = ratePage();
        play.endTimer = 0;
        sfx("win");
      }
      return;
    }
    var allOut = play.spawns.every(function (s) { return s.done; });
    var noneLeft = play.monsters.every(function (m) { return m.hp <= 0; });
    if (allOut && noneLeft && play.spawns.length) {
      play.ended = "win";
      play.rating = ratePage();
      play.endTimer = 0;
      sfx("win");
    }
  }

  function finishEnd() {
    var title = document.getElementById("end-title");
    var blurb = document.getElementById("end-blurb");
    var starsEl = document.getElementById("rating-stars");
    var unlockEl = document.getElementById("unlock-note");
    if (unlockEl) { unlockEl.hidden = true; unlockEl.textContent = ""; }
    if (play.ended === "win") {
      title.textContent = play.goal === "stars" ? "Starry work!" : "What a doodle!";
      var r = play.rating || ratePage();
      play.rating = r;
      blurb.textContent = r === 3 ? "Three stars! You planned that perfectly." :
        r === 2 ? "Two stars. Try keeping more ink, or protecting the house fully." :
        "You did it! Keep some ink and a clean house for more stars.";
      title.setAttribute("data-end", "win");
      if (starsEl) {
        starsEl.hidden = false;
        starsEl.setAttribute("data-stars", String(r));
        starsEl.innerHTML = [1, 2, 3].map(function (i) {
          return '<span class="' + (i <= r ? "on" : "off") + '">★</span>';
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
      title.textContent = play.endless ? "Sketch over!" : "The house got smudged!";
      if (play.endless) {
        var best = save.endlessBest || 0;
        blurb.textContent = "Score " + play.score + (best ? "  •  best " + best : "") + ". Draw a new loop and try for a higher one!";
      } else {
        blurb.textContent = "That's okay — draw a loop or a vine wall and try again.";
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
    drawHouse(ctx, 195, 760, 1, t, true);
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
    play.puddles.forEach(function (p) { drawPuddle(ctx, p, t); });
    if (play.wind) drawWind(ctx, w, h, t, play.wind);
    play.stars.forEach(function (s) { if (!s.taken) drawStar(ctx, s.x, s.y, t, false); });
    play.strokes.forEach(function (st) {
      var folded = strokeFolded(st);
      if (folded) ctx.globalAlpha = 0.28;
      crayonStroke(ctx, st.pts, st.color, st.color === "green" ? 11 : 9, st.id);
      if (st.color === "green") vineTicks(ctx, st);
      if (st.color === "yellow") zapTicks(ctx, st, t);
      if (st.color === "purple") purpleEnds(ctx, st, t);
      ctx.globalAlpha = 1;
    });
    play.combos.forEach(function (c) { drawCombo(ctx, c, t); });
    play.pads.forEach(function (p) { drawPad(ctx, p, t); });
    if (play.drawing && play.drawing.pts.length) {
      crayonStroke(ctx, play.drawing.pts, play.drawing.color, 9, 99);
    }
    drawHouse(ctx, play.house.x, play.house.y, play.house.hp / play.house.max, t, false);
    play.critters.forEach(function (c) {
      var inP = c.swim && inPuddle(c.x, c.y, play.puddles);
      drawCritter(ctx, c.x, c.y, c.color, t + c.bob, false, !!inP);
    });
    play.monsters.forEach(function (m) {
      var vis = monsterVisible(m);
      if (!vis) ctx.globalAlpha = 0.12;
      if (m.hp <= 0) ctx.globalAlpha = Math.max(0, 1 + m.hurt * 2);
      drawMonster(ctx, m.x, m.y, t, m);
      if (m.hp > 0 && vis) miniBar(ctx, m.x, m.y + 18 * (m.scale || 1), m.hp / m.max);
      ctx.globalAlpha = 1;
    });
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

  function drawHouse(ctx, x, y, hpFrac, t, tiny) {
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
    var hop = (m.hopping && m.hopping > 0) ? -10 * Math.sin((1 - Math.max(0, m.hopping) / 0.55) * Math.PI) : 0;
    ctx.translate(x, y + Math.sin(t * 3 + (m.id || 1)) * 1.2 + hop);
    ctx.scale(sc, sc);
    if (m.hurt > 0) ctx.globalAlpha = 0.7 + Math.sin(t * 30) * 0.3;
    var ink = "#5a5562";
    if (m.kind === "eater" || m.boss === "nibble") ink = "#c45a7a";
    if (m.kind === "jumper") ink = "#5a7a4a";
    if (m.kind === "splitter") ink = "#6a5a88";
    if (m.kind === "sneaky") ink = "#4a6a88";
    if (m.kind === "boss") ink = "#4a3a52";
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

  function designLine(x1, y1, x2, y2, n) {
    n = n || 16;
    var pts = [];
    for (var i = 0; i <= n; i++) {
      var t = i / n;
      pts.push({ x: sx(x1 + (x2 - x1) * t), y: sy(y1 + (y2 - y1) * t) });
    }
    return pts;
  }
  function designLoop(cx, cy, rx, ry, n) {
    n = n || 20;
    var pts = [];
    for (var i = 0; i <= n; i++) {
      var a = (i / n) * Math.PI * 2;
      pts.push({ x: sx(cx + Math.cos(a) * rx), y: sy(cy + Math.sin(a) * ry) });
    }
    return pts;
  }
  function designTriangle(cx, cy, r) {
    var pts = [];
    for (var i = 0; i <= 3; i++) {
      var a = -Math.PI / 2 + i * (Math.PI * 2 / 3);
      pts.push({ x: sx(cx + Math.cos(a) * r), y: sy(cy + Math.sin(a) * r) });
    }
    // densify edges so isLoop and corners work
    var dense = [];
    for (var k = 0; k < 3; k++) {
      var a2 = pts[k], b2 = pts[k + 1];
      for (var j = 0; j < 8; j++) {
        var t = j / 8;
        dense.push({ x: a2.x + (b2.x - a2.x) * t, y: a2.y + (b2.y - a2.y) * t });
      }
    }
    dense.push(pts[0]);
    return dense;
  }

  function solvePage() {
    if (!play) return false;
    if (play.id >= 7 || play.endless) save.crayons.yellow = true;
    if (play.id >= 13 || play.endless) save.crayons.purple = true;
    syncTools();
    play.ink = play.inkMax;
    var lv = LEVELS.find(function (x) { return x.id === play.id; });
    var hx = lv ? lv.house.x : 195;
    var hy = lv ? lv.house.y : 460;
    if (play.endless) { hx = 195; hy = 460; }
    // A green loop fences the house from every side (hoppers still need ticklers).
    commitStroke("green", designLoop(hx, hy, 118, 96, 26));
    commitStroke("red", designLoop(hx, hy, 86, 66, 24));
    commitStroke("blue", designLoop(hx, hy, 58, 44, 20));
    // Extra vines on sides where scribbles actually appear.
    var spawns = (lv && lv.spawns) || [];
    var fromTop = !spawns.length || spawns.some(function (s) { return s.y < hy - 40; });
    var fromBot = spawns.some(function (s) { return s.y > hy + 40; });
    var fromLeft = spawns.some(function (s) { return s.x < hx - 40; });
    var fromRight = spawns.some(function (s) { return s.x > hx + 40; });
    if (fromTop) commitStroke("green", designLine(Math.max(16, hx - 150), Math.max(20, hy - 130), Math.min(374, hx + 150), Math.max(20, hy - 130), 18));
    if (fromBot) commitStroke("green", designLine(Math.max(16, hx - 150), Math.min(600, hy + 130), Math.min(374, hx + 150), Math.min(600, hy + 130), 18));
    if (fromLeft) commitStroke("green", designLine(Math.max(16, hx - 130), Math.max(20, hy - 140), Math.max(16, hx - 130), Math.min(600, hy + 140), 18));
    if (fromRight) commitStroke("green", designLine(Math.min(374, hx + 130), Math.max(20, hy - 140), Math.min(374, hx + 130), Math.min(600, hy + 140), 18));
    // Thorns where the main approaches meet the fence.
    commitStroke("red", designLine(hx - 50, hy - 130, hx + 50, hy - 80, 10));
    if (fromRight) commitStroke("red", designLine(hx + 90, hy - 30, hx + 150, hy + 30, 8));
    if (fromLeft) commitStroke("red", designLine(hx - 150, hy - 30, hx - 90, hy + 30, 8));
    commitStroke("blue", designLine(40, 30, hx, hy - 60, 16));
    commitStroke("blue", designLine(350, 30, hx, hy - 60, 16));
    commitStroke("blue", designLine(30, 220, 360, 220, 14));
    if (save.crayons.yellow) {
      commitStroke("yellow", designLoop(hx, hy, 150, 130, 22));
      commitStroke("yellow", designLine(30, 140, 360, 140, 16));
    }
    if (save.crayons.purple && play.stars && play.stars.length) {
      var far = play.stars[0];
      commitStroke("purple", designLine(hx, hy, far.x * FIELD_W / fieldSize().w, far.y * FIELD_H / fieldSize().h, 16));
    } else if (save.crayons.purple) {
      commitStroke("purple", designLine(40, 80, hx, hy, 16));
    }
    if (lv && lv.stars) {
      lv.stars.forEach(function (s) {
        commitStroke("red", designLoop(s.x, s.y, 36, 32, 16));
      });
    }
    play.ink = Math.max(play.ink, 50);
    return true;
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
      endless: !!play.endless,
      wave: play.endless ? play.wave : currentWave(),
      score: play.score || 0,
      rating: play.rating || 0,
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
        return { id: s.id, color: s.color, closed: s.closed, triangle: !!s.triangle, throughPuddle: s.throughPuddle, length: s.length, n: s.pts.length };
      }),
      critters: play.critters.map(function (c) {
        return { id: c.id, color: c.color, strokeId: c.strokeId, t: c.t, x: c.x, y: c.y, launch: c.launch || 0 };
      }),
      monsters: play.monsters.map(function (m) {
        return {
          id: m.id, kind: m.kind, boss: m.boss || null, x: m.x, y: m.y, hp: m.hp,
          hopping: !!(m.hopping > 0), visible: monsterVisible(m), chew: m.chew || 0, tiny: !!m.tiny,
        };
      }),
    };
  }

  window.DD = {
    start: function (opts) {
      opts = opts || {};
      if (opts.endless) beginEndless(opts);
      else beginLevel(opts.level || 1, opts);
      return snapshot();
    },
    startEndless: function (opts) { beginEndless(opts || {}); return snapshot(); },
    screen: function () { return screen; },
    state: snapshot,
    setTool: function (id) { if (play && crayonUnlocked(id)) { play.tool = id; syncTools(); } },
    setInk: function (n) { if (play) { play.ink = clamp(n, 0, play.inkMax); updateHud(); } },
    setTimeScale: function (n) { timeScale = Math.max(0.1, n); },
    setHouseHp: function (n) { if (play) { play.house.hp = n; updateHud(); } },
    drawStroke: function (pts, color) {
      if (!play) return null;
      var mapped = pts.map(function (p) { return { x: p.x, y: p.y }; });
      var len = polylineLen(mapped);
      play.ink = Math.max(0, play.ink - len * inkCostPerPx());
      return commitStroke(color || play.tool, mapped);
    },
    spawnMonster: function (opts) { return play ? spawnMonster(opts) : null; },
    addStars: function (n) { if (play) { play.starsHave += n; updateHud(); } },
    unlockCrayon: function (name) {
      if (name === "yellow" || name === "purple") save.crayons[name] = true;
      persist();
      syncTools();
    },
    solve: function () { return solvePage(); },
    rating: function () { return play ? (play.rating || (play.ended === "win" ? ratePage() : 0)) : 0; },
    save: function () { return jsonCopy(save); },
    levels: LEVELS,
    worlds: WORLDS,
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
