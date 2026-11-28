/* The sketchbook bestiary. Each silhouette is shared by the board, scout cards,
   and bestiary, so its details stay recognizable at every size. */
(function (global) {
  "use strict";
  var line = "#453544";
  var milk = "#fff5db";
  var pupil = "#292134";
  function p(d, fill, stroke, width, motion) {
    return { d: d, fill: fill || "none", stroke: stroke || "none", width: width || 2.1, motion: motion || "" };
  }
  function body(d, fill, motion) {
    var stroke = p(d, fill, line, 1.95, motion);
    stroke.wash = true;
    return stroke;
  }
  function marks(d, color, width) { return p(d, "", color || line, width || 1.8); }
  function orb(x, y, rx, ry) {
    return "M" + (x - rx) + " " + y + "a" + rx + " " + ry + " 0 1 0 " + (rx * 2) + " 0a" + rx + " " + ry + " 0 1 0 " + (-rx * 2) + " 0Z";
  }
  function dot(x, y, r, fill) { return p(orb(x, y, r, r), fill); }
  function eyes(x1, x2, y, size, fill, glint) {
    return [
      p(orb(x1, y, size, size * 1.1) + orb(x2, y, size, size * 1.1), fill || milk),
      p(orb(x1 + 0.6, y + 0.4, size * 0.43, size * 0.56) + orb(x2 + 0.6, y + 0.4, size * 0.43, size * 0.56), glint || pupil),
    ];
  }
  function design(scale, box, caption, layers) {
    return { scale: scale, box: box, caption: caption, layers: layers.flat() };
  }

  var art = {
    scribble: design(1, [-19, -18, 38, 35], "A tangled pencil scribble with the original little face.", [
      p(orb(0, 0, 12, 12), "#766679"),
      p("M-13-7L9-13L14 4L-9 12L-15-1L11 9L13-5L-11-11L3 8L-2-2M-13 6L-10 10L-4 9M7-12L12-9L10-7", "", "#57505f", 2.3),
      p("M-11 5L12-1L7-13L-8-8L-15 1L-4 11L11 8L12 0M-9-10L7 10L11 5", "", "#695d70", 1.55),
      p(orb(0, 0, 8, 8), "#fff5de"),
      p(orb(-2.8, -1, 1.4, 1.4) + orb(2.8, -1, 1.4, 1.4), "#3a2a22"),
      marks("M-5-5L-2-3.5M5-5L2-3.5M-3 4Q0 0 3 4", "#3a2a22", 1.45),
    ]),
    jumper: design(1.03, [-22, -20, 44, 40], "A lime frog with bent spring legs.", [
      body("M-10 1Q-20 2-17 11L-11 13L-19 15L-18 17H-7L-4 9M10 1Q20 2 17 11L11 13L19 15L18 17H7L4 9", "#559845", "feet"),
      body("M-13 0Q-12-7-10-9Q-12-17-6-17Q-2-17 0-11Q4-18 10-15Q14-13 11-8Q16-3 15 3Q14 11 0 11Q-16 10-13 0Z", "#92cb48"),
      p("M-11 3Q0 0 12 3Q10 10 0 10Q-10 9-11 3Z", "#d7e88a"),
      eyes(-6, 7, -8, 3.4),
      marks("M-6 4Q1 9 8 4M-11 8L-14 6M11 8L14 6"),
    ]),
    eater: design(1.08, [-23, -19, 46, 38], "A coral eraser beetle with a row of white teeth.", [
      marks("M-13 4L-20 12L-17 16M-6 9L-10 16M7 8L11 15M15 5L20 12L19 15", "#7a3349", 3),
      body("M-18-6L-12-13L12-14L18-8L17 5L10 11L-13 11L-18 6Z", "#f27984"),
      p("M-17-7L-10-12L-5-12L-6 8H-12L-17 4Z", "#ffe2aa"),
      marks("M-7-11L-8 2", "#9f4950"),
      body("M-13-1Q0-4 15-2V6L8 10H-9L-14 6Z", "#763048"),
      p("M-10-1H12L10 3L7 1L4 5L1 2L-2 5L-5 1L-8 4Z", milk),
      eyes(-4, 8, -7, 2.7),
      marks("M11-13L14-17M3-14L4-17", "#7a3349"),
    ]),
    splitter: design(1.06, [-23, -17, 46, 34], "Two pink heads joined at a pinched middle.", [
      body("M-20 3Q-20-12-11-13Q-4-13 0-7Q4-13 12-13Q20-13 20 3Q20 13 11 13Q3 13 0 7Q-4 13-12 13Q-20 13-20 3Z", "#e692c5"),
      p("M0-6Q4-13 12-13Q20-13 20 3Q20 13 11 13Q3 13 0 7Z", "#b967be"),
      eyes(-13, -7, -2, 2.6),
      eyes(7, 13, -2, 2.6),
      marks("M0-5L-2-1L2 2L0 5M-14 5Q-10 8-7 5M7 5Q11 8 14 5", "#572a69"),
    ]),
    sneaky: design(1, [-19, -21, 38, 46], "A violet hood with a pale mask and a rippling tail.", [
      body("M-14 11Q-15 4-14-5Q-12-16 1-18Q13-16 14-7L15 7L10 19L4 14L-3 21L-9 14L-14 17Z", "#6960a7"),
      p("M-12 8Q-7 9 0 4Q4 15 10 17L4 13L-3 20L-8 13L-13 16Z", "#a48bd0"),
      body("M-10-5Q0-11 10-5L8 4L3 8L0 4L-3 8L-8 4Z", "#f6e9ff"),
      p("M-8-3L-2-1L-4 2L-7 1ZM8-3L2-1L4 2L7 1Z", pupil),
      marks("M0-13L0-15", "#c6bdf2", 2.3),
    ]),
    armored: design(1.22, [-26, -21, 52, 39], "A bulky steel helmet with two ivory horns.", [
      body("M-14-7Q-24-7-22-19Q-14-15-8-11ZM14-7Q24-7 22-19Q14-15 8-11Z", "#ffe0aa"),
      body("M-21 2L-14-1L-10 12L-20 13L-24 8ZM21 2L14-1L10 12L20 13L24 8Z", "#7d8ba6"),
      body("M-15-12L0-17L15-12L18 7L10 13H-10L-18 7Z", "#9faec5"),
      p("M-13-11L0-15L13-11L15-6H-15Z", "#d3e0ea"),
      body("M-14-4H14L12 5L5 7H-5L-12 5Z", "#3d4660"),
      p("M-10-2L-3 0L-5 3L-9 2ZM10-2L3 0L5 3L9 2Z", "#ffc16d"),
      marks("M0 7V11M-6 8V11M6 8V11", "#56627b"),
    ]),
    waxback: design(1.15, [-24, -19, 48, 39], "A shiny amber dome with black beetle legs.", [
      marks("M-15 3L-21 10L-18 15M-9 8L-12 16M15 3L21 10L18 15M9 8L12 16", "#613747", 3),
      body("M-11 4Q-11-2 0-3Q11-2 11 4L10 10Q1 17-10 10Z", "#874b41"),
      body("M-20 2Q-20-15-4-16Q14-18 19-6Q25 6 14 9H-14Q-20 9-20 2Z", "#e5a834"),
      p("M-15 1Q-16-11-4-13Q8-16 14-9Q10-12 3-9Q-8-8-10 1Z", "#ffe59a"),
      marks("M1-13Q8-7 9 6", "#a4632d"),
      dot(-11, -3, 1.5, "#fff5ce"), dot(-6, -7, 1.6, "#fff5ce"), dot(13, 0, 1.7, "#fff5ce"),
      eyes(-5, 5, 9, 2.4),
    ]),
    healer: design(1.01, [-23, -23, 46, 43], "A mint healer carrying a bright cross on its cap.", [
      body("M-13 8Q-23 12-18 16Q-13 19-7 13M13 8Q23 12 18 16Q13 19 7 13", "#78bd93"),
      body("M-13 10Q-19 3-15-4Q-12-11-4-12Q8-14 14-5Q19 2 14 10Q8 16 0 15Q-10 16-13 10Z", "#98d8a0"),
      body("M-13-5Q-13-16-3-17L0-21L4-17Q14-16 14-5Q2-1-13-5Z", "#318976"),
      p("M-2-16H3V-13H7V-9H3V-6H-2V-9H-6V-13H-2Z", "#f1ffe5"),
      eyes(-6, 6, 3, 3.2),
      marks("M-4 9Q0 12 4 9", "#31695e"),
    ]),
    flyer: design(1.02, [-30, -23, 60, 45], "A violet moth with broad scalloped wings.", [
      body("M-3-3Q-12-23-27-18Q-30-11-23-4Q-30 4-20 10Q-14 15-5 5Z", "#b08ce1", "wingL"),
      body("M3-3Q12-23 27-18Q30-11 23-4Q30 4 20 10Q14 15 5 5Z", "#b08ce1", "wingR"),
      p("M-8-3Q-16-14-24-13Q-21-7-16-4Q-24-4-22 4Q-15 8-8 2Z", "#f3b7db", null, null, "wingL"),
      p("M8-3Q16-14 24-13Q21-7 16-4Q24-4 22 4Q15 8 8 2Z", "#f3b7db", null, null, "wingR"),
      marks("M-3-9Q-8-18-11-17M3-9Q8-18 11-17"),
      body("M-7-8Q0-13 7-8L9 1L3 13L0 17L-5 11L-9 1Z", "#6d497e"),
      eyes(-3, 3, -3, 2.6),
      marks("M-4 6H4M-3 10H3", "#efabd6", 1.5),
    ]),
    tunneler: design(1.01, [-24, -20, 48, 39], "A chestnut mole with a striped drill cap and broad claws.", [
      body("M-12 2L-21 5L-21 12L-16 15L-7 9M12 2L21 5L21 12L16 15L7 9", "#be7951"),
      marks("M-19 8L-22 8M-17 11L-20 14M19 8L22 8M17 11L20 14", "#854e3a", 2),
      body("M-15 0Q-14-12 0-12Q14-12 15 0L12 10L5 14H-5L-12 10Z", "#ca9869"),
      body("M-12-7L-8-13L7-17L14-12L15-6L6-3Z", "#985346"),
      marks("M-6-12L-2-7M1-14L6-7M8-15L11-10", "#f0aa67", 1.9),
      eyes(-5, 5, 0, 2.8), dot(0, 7, 3, "#8e4553"),
    ]),
    thief: design(0.91, [-17, -23, 34, 45], "A narrow indigo pen nib with a hook above it.", [
      marks("M-8-8Q-17-13-14-18Q-12-22-8-19L-7-16M9 0L15 4L12 9", "#263d75", 2.8),
      body("M-9-14H9L14-3L11 8L1 19L-2 19L-12 8L-14-3Z", "#425aaa"),
      p("M-8-12L3-12L-4 8L-1 16L-9 8L-12-3Z", "#7e8ad6"),
      marks("M0 9V17", "#d4d9f8", 1.6),
      eyes(-5, 5, -4, 2.8), dot(0, 6, 2, "#e3e4ff"),
    ]),
    splatter: design(1.09, [-26, -20, 53, 39], "A flat black-ink blot with stray drops around it.", [
      dot(-23, 5, 2, "#4a305b"), dot(22, -1, 2.8, "#4a305b"), dot(14, -13, 2, "#4a305b"),
      body("M-21 8Q-23 2-13-1L-19-10L-8-7Q-4-13 2-12L6-17L9-9Q14-8 14-3L22 3L16 9L20 14L9 13L4 16L-3 13L-10 16L-13 11Z", "#493454"),
      p("M-17 7L-11 3L-7 6L-4 3Q7 5 12 0L17 4L14 9Q1 11-5 9Z", "#694e77"),
      eyes(-6, 5, 0, 3.2, "#f5bede"),
      marks("M-2 7L1 5L4 6", "#c4a0ce"),
    ]),
    shielder: design(1.18, [-23, -23, 46, 47], "A tall ivory shield with a gold rim and a star boss.", [
      body("M-17-12L0-20L17-12L20 2L13 15L0 21L-13 15L-20 2Z", "#8d5a43"),
      body("M-16-12L0-18L16-12L16 3L11 13L0 19L-11 13L-16 3Z", "#dca541"),
      body("M-11-8L0-13L11-8V2L7 10L0 14L-7 10L-11 2Z", "#fff0bb"),
      p("M0-9L2-3L8-2L3 2L5 8L0 5L-5 8L-3 2L-8-2L-2-3Z", "#805743"),
      dot(-13, -9, 1.4, "#fff4ca"), dot(13, -9, 1.4, "#fff4ca"),
    ]),
    dasher: design(0.76, [-24, -21, 48, 41], "A tiny orange zigzag with a pointed tail.", [
      marks("M-20 0L-15-1M-20 5L-13 4", "#b66a37", 2.5),
      body("M-15-2L0-17L5-8L15-12L12-3L20 0L8 12L-1 17L1 8L-11 10L-8 3Z", "#ff9d48"),
      p("M-8-1L1-12L4-4L12-6L8 0L3 4L0 0Z", "#ffe393"),
      eyes(-4, 6, 1, 3.2),
      marks("M0 7L3 5L6 6", "#a45532"),
    ]),
    flanker: design(1.01, [-25, -19, 50, 37], "A navy wedge with a long orange scarf.", [
      body("M8-2Q15-8 23-7L20-2L24 2Q15 4 9 7Z", "#f49a4f", "scarf"),
      marks("M-6 6L-11 12L-16 12M5 7L11 13L16 12", "#323953", 2.8),
      body("M-20 1L-7-13L6-14L16-6L13 8L2 11L-11 8Z", "#4b6a9e"),
      p("M-16 0L-7-11L4-12L11-7L-2-2Z", "#7799c0"),
      body("M-18 0L-5-5L11-5L11 1L-1 6L-12 5Z", "#263553"),
      p("M-12 0L-6-2L-6 1L-11 2ZM-1-2H5L4 0L0 1Z", "#ffe1a1"),
      marks("M1 7L6 5L9 6", "#f5a364", 2.6),
    ]),
    mimic: design(0.98, [-20, -24, 40, 45], "A blue drop with fins and a bite once unmasked.", [
      body("M-9 2L-16-1L-16 7L-10 11M9 2L16-1L16 7L10 11", "#7fcbd7"),
      body("M0-19Q6-11 11-4Q19 10 9 15Q0 20-10 14Q-19 8-11-4Z", "#388fbd"),
      p("M-9 2Q-9-3-3-8Q-6 0-4 4Z", "#b4ebef"),
      eyes(-5, 5, 2, 3.1),
      body("M-8 7Q0 11 8 7L5 13H-5Z", "#71394d"),
      p("M-6 8L-2 9L-4 11ZM6 8L2 9L4 11Z", milk),
    ]),
    adapt: design(1, [-22, -21, 44, 43], "A color-changing patchwork mask in the scout report.", [
      body("M-17-13L-5-16L1-20L8-15L18-13L17 2L10 14L0 18L-10 13L-18 3Z", "#8c69c9"),
      p("M-15-11L-4-13L0-17L1 14L-8 11L-15 2Z", "#ea8b83"),
      p("M6-12L15-11L15 2L9 12L2 14L6 5Z", "#82c9aa"),
      eyes(-6, 6, -2, 3.4),
      marks("M-4 8Q0 4 5 8M0-14L2-8", "#41314e"),
    ]),
    "boss:smudge": design(1.72, [-32, -27, 64, 53], "A giant plum bull with curved horns and a cracked shell.", [
      body("M-18-6Q-31-9-28-23Q-23-19-20-16L-9-13ZM18-6Q31-9 28-23Q23-19 20-16L9-13Z", "#f1d598"),
      body("M-18 6L-23 16L-18 22L-9 20L-6 11M18 6L23 16L18 22L9 20L6 11", "#6d4d89"),
      body("M-23 0Q-24-15-13-19L0-22L15-18Q25-14 23 0L19 10L10 17L-10 17L-20 10Z", "#9b6baf"),
      body("M-21-6L-15-17L0-21L15-17L21-7L13-4L10-7L0-5L-9-6L-12-4Z", "#654b88", "shell"),
      marks("M-3-18L-1-13L-6-9L-3-6M11-17L8-13L12-11", "#cdb6e1", 1.7),
      body("M-13 4Q0-2 13 4L11 11L2 14H-5L-12 10Z", "#684872"),
      eyes(-9, 8, -1, 3.4, "#ffd9af"),
      dot(-4, 7, 2, pupil), dot(4, 7, 2, pupil),
    ]),
    "boss:nibble": design(1.58, [-34, -25, 68, 51], "A wide coral monster with a chomping jaw.", [
      body("M-21-7Q-29-9-30-19Q-22-18-13-11M21-7Q29-9 30-19Q22-18 13-11", "#f6ae82"),
      body("M-27 2L-21-10L-12-19L8-20L23-11L27 2L23 12L12 16H-13L-22 12Z", "#df6b82"),
      p("M-16-14L-10-17L8-18L15-15L14-10L-16-9Z", "#f8a294"),
      body("M-24 3Q-2 0 24 3L23 13L15 20H-16L-23 14Z", "#71364e", "jaw"),
      p("M-21 4H21L18 11L13 7L8 13L4 7L0 13L-5 7L-9 13L-14 7L-18 11Z", "#fff0c7", null, null, "jaw"),
      p("M-16 16L-12 12L-8 17L-4 13L0 17L4 13L8 17L12 12L16 16Z", "#f9cea4", null, null, "jaw"),
      eyes(-9, 9, -5, 4),
      marks("M-12-14L-8-12M-4-16L-2-13M3-16L5-13M10-15L12-12", "#b74d67"),
    ]),
    "boss:hidey": design(1.63, [-28, -32, 56, 65], "A tall storm phantom with a lightning crown.", [
      body("M-23 9L-21-8L-17-14L-20-28L-8-19L0-29L8-19L20-29L17-13L21-7L23 10L17 22L10 18L2 29L-5 21L-13 26L-18 18Z", "#46517d"),
      p("M-22 6L-14 11L-6 20L2 15L10 19L20 11L17 20L10 16L2 27L-5 20L-13 24L-17 17Z", "#69699d"),
      body("M-14-5L0-13L14-5L10 8L0 15L-11 8Z", "#9bd9db"),
      p("M-11-4L-3-1L-5 5L-10 3ZM11-4L3-1L5 5L10 3Z", "#2e355e"),
      p("M0-21L5-21L2-15L6-15L-1-7L1-14L-4-14Z", "#ffdb79"),
      marks("M-23-7L-26-1L-23 0L-26 6M23-9L26-3L23-2L26 3", "#e6bc67", 2.1),
    ]),
  };

  // Broken-over pencil strokes make the silhouettes feel drawn, not sticker-flat.
  var hatch = {
    jumper: "M-12-2L-10 0L-12 2M8 8L10 5L11 8M-14 12L-17 14L-15 14",
    eater: "M-14-8L-11-9L-14-5M-12 8L-7 7L-10 10M15-10L17-9L15-7",
    splitter: "M-18-5L-16-8L-17-3M-17 8L-14 10L-14 7M16-8L17-5L19-3",
    sneaky: "M-12-10L-9-13L-9-10M12 1L10 5L13 7M-9 12L-10 10L-11 11",
    armored: "M-20-12L-19-10L-20-10M-14 8L-11 9L-12 11M10-13L12-11L14-10M18 4L21 5L20 9",
    waxback: "M-17 2L-14 4L-12 3M7-12L9-9L11-8M16 2L16 5L13 6",
    healer: "M-11-12L-8-15L-8-11M-12 8L-9 11L-7 10M9 10L12 8L11 12",
    flyer: "M-23-15L-20-16L-18-14L-21-13M20-10L24-12L22-9M-21 4L-19 7L-18 4M19 6L21 4L21 7",
    tunneler: "M-10-12L-8-10L-7-12M-12 7L-9 9L-7 9M11 10L13 6L10 7",
    thief: "M-10-8L-7-10L-8-5M10 4L9 8L7 9M-6 9L-3 13L-4 10",
    splatter: "M-12-2L-10-5L-13-4M7-12L5-8L8-8M-13 9L-10 12L-9 10M15 4L18 5L15 7",
    shielder: "M-13-10L-10-13L-9-12M-14 1L-12 5L-13 6M10 10L12 7L12 9",
    dasher: "M-8-4L-5-6L-7-2M12 2L14 1L11 4M5 12L3 14L4 10",
    flanker: "M-10-8L-6-10L-6-8M-9 5L-6 7L-5 6M14-4L18-5L17-4L21-5",
    mimic: "M-11-3L-7-8L-8-5M-11 9L-8 11L-7 10M10 9L13 7L11 13",
    adapt: "M-12-13L-9-11L-9-13M-13 2L-12 6L-10 4M12 7L13 4L14 4",
    "boss:smudge": "M-20-5L-17-8L-16-6M-17 10L-13 13L-11 11M17-5L19-7L18-2M12 14L15 12L15 14",
    "boss:nibble": "M-22-4L-20-8L-17-9L-18-6M19-7L21-6L23-1M-24 8L-21 11L-22 8",
    "boss:hidey": "M-19-3L-17-8L-17-4M19 1L20-3L17 0M-17 13L-14 17L-12 16M13 15L16 12L15 17",
  };
  Object.keys(hatch).forEach(function (id) {
    var texture = marks(hatch[id], "#453544", 1.05);
    texture.pencil = true;
    art[id].layers.push(texture);
  });

  function key(kind, boss) {
    var id = kind === "boss" ? "boss:" + (boss || "smudge") : kind;
    return Object.prototype.hasOwnProperty.call(art, id) ? id : "scribble";
  }
  function scale(kind, boss, tiny) {
    var a = art[key(kind, boss)];
    return a.scale * (tiny ? 0.72 : 1);
  }
  function draw(ctx, monster, t) {
    var a = art[key(monster.kind, monster.boss)];
    var phase = t * 16 + (monster.id || 0);
    a.layers.forEach(function (layer) {
      var effect = layer.motion;
      if (effect === "shell" && monster.phase > 1) return;
      if (!layer.path) layer.path = new Path2D(layer.d);
      if (effect) {
        ctx.save();
        if (effect === "wingL" || effect === "wingR") ctx.rotate((effect === "wingL" ? -1 : 1) * Math.sin(phase) * 0.23);
        else if (effect === "feet" && monster.hopping > 0) ctx.translate(0, 3);
        else if (effect === "scarf") ctx.rotate(Math.sin(phase) * (monster.detour ? 0.19 : 0.08));
        else if (effect === "jaw" && (monster.breaking || monster.compChewing || monster.chew > 0)) ctx.translate(0, 1 + Math.sin(phase * 1.6) * 2);
      }
      var alpha = ctx.globalAlpha;
      if (layer.fill !== "none") {
        ctx.fillStyle = layer.fill;
        if (layer.wash) ctx.globalAlpha = alpha * 0.70;
        ctx.fill(layer.path);
        ctx.globalAlpha = alpha;
      }
      if (layer.stroke !== "none") {
        ctx.strokeStyle = layer.stroke;
        ctx.lineWidth = layer.width;
        if (layer.pencil) ctx.globalAlpha = alpha * 0.64;
        ctx.stroke(layer.path);
        if (layer.wash) {
          ctx.save();
          ctx.translate(0.8, -0.5);
          ctx.globalAlpha = alpha * 0.39;
          ctx.lineWidth = 1.05;
          ctx.stroke(layer.path);
          ctx.restore();
        }
        ctx.globalAlpha = alpha;
      }
      if (effect) ctx.restore();
    });
  }
  function icon(id) {
    var a = art[Object.prototype.hasOwnProperty.call(art, id) ? id : "scribble"];
    return '<svg class="monster-icon" viewBox="' + a.box.join(" ") + '" aria-hidden="true" focusable="false" stroke-linecap="round" stroke-linejoin="round">' +
      a.layers.map(function (l) {
        var draw = '<path d="' + l.d + '" fill="' + l.fill + '" stroke="' + l.stroke + '" stroke-width="' + l.width + '"' +
          (l.wash ? ' fill-opacity=".70"' : l.pencil ? ' opacity=".64"' : '') + '/>';
        if (l.wash) draw += '<path d="' + l.d + '" fill="none" stroke="' + l.stroke +
          '" stroke-width="1.05" opacity=".39" transform="translate(.8 -.5)"/>';
        return draw;
      }).join("") + "</svg>";
  }
  function caption(id) { return (art[id] || art.scribble).caption; }

  global.DDMonsterArt = { key: key, scale: scale, draw: draw, icon: icon, caption: caption, keys: Object.keys(art) };
})(window);
