/* Doodle Defense pages: 3 worlds, 5 pages + a boss each. Design coords are 390x620.
   Each page has `ink` (the whole ink budget), `lanes` (the trails scribbles walk, first point = entrance)
   and `waves` written in a tiny code: S scribble, J hopper, E eraser-bug, P splitter, N sneaky,
   A armored, L healer, F flyer, X copycat, T digger, I ink-nib, K blotling, H cover-bug, D zipper, M drop-faker, Bs/Bn/Bh bosses. The digit is the lane; @n is the second it appears. */
(function (global) {
  "use strict";
  var MAP = { S: "scribble", J: "jumper", E: "eater", P: "splitter", N: "sneaky", A: "armored", L: "healer", F: "flyer", X: "adapt", T: "tunneler", I: "thief", K: "splatter", H: "shielder", D: "dasher", M: "mimic" };
  var BOSSES = { Bs: "smudge", Bn: "nibble", Bh: "hidey" };

  function wave(str) {
    var out = [];
    str.split(/\s+/).forEach(function (tok) {
      if (!tok) return;
      var m = /^(B[snh]|[SJEPNALFXTIKHDM])(\d)(?:@([\d.]+))?$/.exec(tok);
      if (!m) throw new Error("bad wave token " + tok);
      var it = { lane: +m[2] };
      if (BOSSES[m[1]]) { it.kind = "boss"; it.boss = BOSSES[m[1]]; } else it.kind = MAP[m[1]];
      if (m[3] != null) it.dt = +m[3];
      out.push(it);
    });
    return out;
  }
  function P(id, world, name, blurb, hint, o) {
    var lv = {
      id: id, world: world, name: name, blurb: blurb, hint: hint,
      goal: o.stars ? "stars" : "house",
      starsNeed: o.starsNeed || 0, boss: o.boss || null, adapt: !!o.adapt,
      house: { x: o.house[0], y: o.house[1], hp: 3 },
      ink: o.ink, lanes: o.lanes, ks: o.ks || null,
      puddles: o.puddles || [], stains: o.stains || [], blots: o.blots || [],
      stars: (o.stars || []).map(function (s) { return { x: s[0], y: s[1] }; }),
      wind: o.wind || null, fold: o.fold || null,
      waves: o.waves.map(wave),
    };
    return lv;
  }
  function pud(x, y, r, vx, vy) { return { x: x, y: y, r: r, vx: vx || 0, vy: vy || 0 }; }
  function area(x, y, r) { return { x: x, y: y, r: r }; }

  var LEVELS = [
    P(1, 1, "First Scribble", "Draw a line. Your doodles will walk it.",
      "Study the dotted trail, draw on it, then press Start.",
      { house: [195, 500], ink: 100,
        lanes: [[[195, 10], [195, 300], [195, 470]]],
        waves: ["S0 S0 S0", "S0 S0 S0 S0", "S0 S0 J0 S0 S0 J0 S0"] }),
    P(2, 1, "Loopy Guard", "A loop makes doodles walk in a circle.",
      "Three trails! A loop makes guards that circle.",
      { house: [195, 300], ink: 120,
        lanes: [[[195, 10], [195, 230]], [[10, 300], [130, 300]], [[380, 300], [260, 300]]],
        waves: ["S0 S1 S2", "S1 J2 S0 J1 S2 J0", "J0 S1 E2 J1 S2 E0 J2 S1"] }),
    P(3, 1, "Puddle Splash", "Draw through a puddle to make swimmers.",
      "Collect 5 stars and survive every wave. Your star route can guard too.",
      { house: [320, 520], ink: 190, stars: [[80, 200], [150, 240], [220, 310], [180, 390], [260, 180]], starsNeed: 5,
        puddles: [pud(150, 240, 62), pud(220, 310, 48)],
        lanes: [[[10, 60], [150, 200], [320, 440]], [[380, 200], [250, 300], [320, 440]]],
        waves: ["S0 S1 S0 J1", "S0 J1 A0 S1 J0 S1 J0", "A0 J1 S0 E1 A1 J0 D1 S0 J1 D0"] }),
    P(4, 1, "Vine Fence", "Green vines can block scribble monsters.",
      "Vines wear down. Hoppers will jump them at the end.",
      { house: [80, 400], ink: 110,
        puddles: [pud(260, 200, 44)],
        lanes: [[[380, 90], [250, 250], [130, 390]], [[380, 520], [250, 450], [130, 410]]],
        waves: ["S0 S1 J0 S1 S0", "S0 J1 A0 J1 D0 S1 S0 J0", "A0 J1 D1 S0 J1 A1 J0 S1 D0 J1 A0"] }),
    P(5, 1, "Star Parade", "Mix loops, puddles, and color crosses to grab the stars.",
      "Collect 7 stars and survive every wave. Plan the route first.",
      { house: [80, 110], ink: 310, starsNeed: 7,
        stars: [[240, 360], [200, 120], [320, 200], [70, 280], [300, 480], [150, 500], [340, 90]],
        puddles: [pud(240, 360, 70)],
        lanes: [[[380, 300], [250, 260], [120, 130]], [[200, 610], [200, 400], [100, 200], [90, 140]]],
        waves: ["S0 J1 S1 J0 S0", "J0 A1 S1 J1 A0 S0 D1 J0", "A0 J1 L1 S0 J1 D0 A1 S1 J0 L0"] }),
    P(6, 1, "Big Smudge", "A giant scribble is coming. Keep the house clean!",
      "Big Smudge has a shell at first. Use combos, then slow it down.",
      { house: [195, 440], ink: 180, boss: "smudge",
        lanes: [[[195, 10], [195, 250], [195, 410]], [[10, 120], [120, 260], [180, 400]], [[380, 120], [270, 260], [210, 400]]],
        waves: ["S0 J1 S2 S0 J1 S2 J0", "J0 A1 S2 A0 J1 D2 J0 A1", "Bs0 J1 S2 S1 J2"] }),

    P(7, 2, "Hopper Field", "These hoppers bounce right over vines.",
      "Hoppers ignore vines. Armored ones show up at the end.",
      { house: [195, 500], ink: 270,
        lanes: [[[70, 10], [110, 250], [180, 470]], [[195, 10], [195, 470]], [[320, 10], [280, 250], [210, 470]]],
        waves: ["J0 J1 J2 S1 J0 J1 J2 J0 J1 J2 D0 D1", "J0 J1 J2 A1 J0 J2 J1 A1 J0 J1 J2 A1 D0", "A0 A1 A2 J0 J1 J2 A1 J0 J2 A0 A1 A2 J0 D1", "A0 A1 A2 A1 J0 J1 J2 A0 A2 J1 A1 A0 A1 A2 A1 J0 A0 A2 A1"] }),
    P(8, 2, "Windy Page", "Eraser-bugs chew your lines, and the wind bends them.",
      "Eraser-bugs eat your lines. Give them decoys!",
      { house: [80, 320], ink: 320, wind: { ax: 0.9, ay: 0.25 },
        puddles: [pud(260, 420, 46)],
        lanes: [[[380, 60], [250, 200], [120, 300]], [[380, 560], [250, 420], [120, 340]]],
        waves: ["E0 S1 E1 S0 E0 E0 S1 I0", "E0 E1 A0 S1 E0 E1 J1 E0 E1 A0 I0 I1", "A0 E1 E0 A1 E0 E1 J0 S1 A0 E1 E0 A1 I0 I1", "A0 A1 E0 E1 E0 E1 J0 J1 A0 A1 A0 A1 E0 E1 E0 I0 I1"] }),
    P(9, 2, "Coffee Break", "Coffee stains make ink slow and thirsty.",
      "Collect 5 stars and survive. Drawing in a stain costs double.",
      { blots: [area(240, 160, 24)], house: [70, 80], ink: 350, starsNeed: 5,
        stars: [[200, 260], [300, 420], [120, 400], [320, 140], [80, 300]],
        stains: [area(200, 260, 70), area(300, 420, 54)],
        puddles: [pud(120, 400, 48, 22, 10)],
        lanes: [[[380, 200], [250, 200], [120, 100]], [[380, 560], [300, 400], [200, 260], [90, 110]]],
        waves: ["S0 S1 A0 S1 S0 S1", "A0 A1 S0 J1 A0 S1 A0 A1 S0", "A0 A1 A0 A1 J0 J1 S0 S1 A0 A1 A0 A1"] }),
    P(10, 2, "Split Decision", "Tickle a splitter and it becomes two little scribbles.",
      "Healers mend the others. Pop them first!",
      { house: [195, 480], ink: 270,
        puddles: [pud(80, 220, 44, 18, 16)],
        lanes: [[[40, 10], [120, 250], [185, 450]], [[350, 10], [270, 250], [205, 450]], [[195, 10], [195, 450]]],
        waves: ["P0 P1 S2 P2 P0 P1 H2", "P0 P1 P2 L2 P0 P1 L1 P0 P1 P2 H0", "P0 L1 P1 L0 P2 A2 P0 P1 A0 P0 L1 P1 L0 H2", "P0 P1 P2 L0 L1 L2 A0 A1 A2 P0 P1 P0 P1 P2 L0 L1 H0 H1"] }),
    P(11, 2, "Now You See It", "Sneaky scribbles stay hidden until they touch blue.",
      "Sneaky ones only show on blue, puddles, or splashes.",
      { house: [195, 500], ink: 220,
        puddles: [pud(300, 240, 40)],
        lanes: [[[60, 10], [130, 250], [185, 470]], [[330, 10], [260, 250], [205, 470]]],
        waves: ["N0 N1 S0 N1 N0 N0 N1 M0", "N0 N1 N0 N1 A0 N1 A1 N0 N1 N0 M0 M1", "N0 N1 A0 A1 N0 N1 J0 N1 A0 N0 N1 A0 A1 M0", "N0 N1 N0 N1 A0 A1 N0 N1 J0 J1 A0 A1 N0 N1 N0 N1 A0 A1 M0 M1"] }),
    P(12, 2, "Nibblewick", "This big nibbler chews up your lines.",
      "Nibblewick eats lines. It gets worse as it gets hurt.",
      { house: [195, 460], ink: 340, boss: "nibble",
        stains: [area(80, 200, 50)], puddles: [pud(310, 200, 40)],
        lanes: [[[195, 10], [195, 420]], [[20, 100], [130, 250], [180, 420]], [[370, 100], [260, 250], [210, 420]]],
        waves: ["E0 E1 E2 S0 S1 I0", "S0 P1 E2 A0 E1 E0 A2 S0 P1 E2 I1 T0", "A0 A1 E2 E0 E1 J1 L2 A0 A1 E2 T0 I2", "Bn0 E1 S2 E2 J1 A2 A1 E1 S2 A0 E2 I1"] }),

    P(13, 3, "Folded Note", "Part of the page folds over, then flips. Flyers soar in.",
      "Flyers fly over lines. Build a triangle launch pad!",
      { blots: [area(195, 250, 22)], house: [195, 430], ink: 270, fold: { start: "right", cover: 0.26, period: 9 }, ks: [0.8, 0.8],
        lanes: [[[60, 10], [130, 200], [185, 400]], [[330, 10], [260, 200], [205, 400]]],
        waves: ["S0 S1 S0 F1 F0 S0 S1", "F0 F1 S0 S1 F0 A1 F1 F0 F1 S0", "F0 F1 A0 A1 S0 F1 F0 S1 F0 F1 A0 A1 D0", "F0 F1 F0 F1 A0 A1 L0 L1 F0 F1 F0 F1 F0 F1 A0 D1"] }),
    P(14, 3, "Copycats", "These scribbles change to counter the lines you already drew.",
      "Copycats counter your colors. Mix your tools.",
      { house: [195, 480], ink: 440, adapt: true,
        puddles: [pud(60, 200, 36)],
        lanes: [[[40, 10], [120, 260], [185, 450]], [[350, 10], [270, 260], [205, 450]], [[195, 10], [195, 450]]],
        waves: ["X0 X1 X2 X0 X1 D0", "X0 X1 X2 X0 X1 X2 X0 X0 X1 X2 T1 H0", "X0 X1 X2 X0 X1 X2 X0 X1 X2 X0 X1 X2 X0 K1 M2", "X0 X1 X2 X0 X1 X2 X0 X1 X2 X0 X1 X2 X0 X1 X2 X0 X1 X2 D0 T1 H2 K0"] }),
    P(15, 3, "Desk Storm", "Wind, wandering puddles, and a mixed crowd.",
      "A mixed crowd. Read the preview and counter each type.",
      { house: [195, 500], ink: 340, wind: { ax: -0.7, ay: 0.35 },
        puddles: [pud(90, 220, 42, 20, 14), pud(300, 300, 38, -16, 18)],
        lanes: [[[30, 10], [100, 260], [180, 470]], [[360, 10], [290, 260], [210, 470]], [[195, 10], [195, 470]]],
        waves: ["J0 N1 P2 F2 J1 D0", "A0 L0 E1 F1 N2 J1 P0 E1 T0", "A0 A1 L2 F0 F1 N0 E2 P1 J0 A0 A1 L2 F0 H2 K0", "A0 A1 A2 L0 L1 F0 F1 F2 N0 E1 P2 J0 A0 A1 A2 L0 L1 F0 M1 H0 K2 D0 D1"] }),
    P(16, 3, "Star Vault", "Lots of stars, and not much ink if you scribble everywhere.",
      "Collect 8 stars and survive a mixed crowd. Budget carefully.",
      { blots: [area(130, 360, 26), area(260, 360, 26)], house: [195, 300], ink: 480, starsNeed: 8,
        stars: [[70, 80], [320, 80], [70, 240], [320, 240], [70, 420], [320, 420], [195, 160], [195, 480]],
        puddles: [pud(195, 160, 36, 14, 0)], stains: [area(195, 480, 58)],
        lanes: [[[10, 10], [100, 150], [170, 270]], [[380, 10], [290, 150], [220, 270]], [[195, 610], [195, 450], [195, 330]]],
        waves: ["S0 N1 J2 S0 P1 S0 D0 I1", "P0 E1 F2 A0 S1 P0 E1 F2 T0 M1", "A0 F1 F2 F0 L1 N0 F2 E1 A0 F1 F2 F0 H0 K2", "A0 F1 A2 F0 F1 F2 L0 F1 N2 A0 F1 A2 F0 D0 F2 K0 H2"] }),
    P(17, 3, "Full Toolbox", "Zap, Blink, folds, wind, and a little of everything.",
      "Collect 6 stars and survive. Folds and wind change your lines.",
      { house: [195, 520], ink: 380, starsNeed: 6, fold: { start: "right", cover: 0.24, period: 9 },
        wind: { ax: 0.4, ay: -0.15 }, ks: [0.8, 0.8],
        stars: [[150, 100], [240, 160], [150, 230], [240, 300], [150, 370], [240, 430]],
        puddles: [pud(200, 240, 40, 12, 10)],
        lanes: [[[40, 10], [120, 250], [185, 490]], [[350, 10], [270, 250], [205, 490]]],
        waves: ["N0 F1 J0 S1 N1 D0", "A0 L1 F0 P1 E0 N1 T0 I1", "A0 A1 F0 F1 L0 P1 N0 J1 E0 A0 A1 F0 F1 H0 K1", "A0 A1 A0 F0 F1 L0 L1 P0 N1 J0 E1 A0 A1 A0 F0 F1 D0 T1 K0 M1"] }),
    P(18, 3, "Hidey Storm", "The last boss hops, hides, and calls flyers.",
      "Hidey Storm hides, then calls flyers and a healer.",
      { house: [195, 500], ink: 320, boss: "hidey", wind: { ax: 0.35, ay: 0.2 },
        puddles: [pud(80, 240, 36, 14, 8), pud(310, 300, 36, -14, 10)],
        lanes: [[[30, 10], [110, 260], [180, 470]], [[360, 10], [280, 260], [210, 470]], [[195, 10], [195, 470]]],
        waves: ["J0 N1 F2 J1 N0 D0", "A0 L2 P0 F1 F0 A1 T0 I1", "A0 L1 F2 N0 J1 A2 F0 A0 L1 F2 K0 M1 D2", "Bh2 J0 N1 A0 F1 A1 J1 N0 A2 F0 D0 T1 K2"] }),
  ];

  var WORLDS = [
    { id: 1, name: "Sunny Sketchbook", pages: [1, 2, 3, 4, 5], boss: 6 },
    { id: 2, name: "The Messy Desk", pages: [7, 8, 9, 10, 11], boss: 12 },
    { id: 3, name: "Stormy Attic", pages: [13, 14, 15, 16, 17], boss: 18 },
  ];

  global.DD_LEVELS = LEVELS;
  global.DD_WORLDS = WORLDS;
})(window);
