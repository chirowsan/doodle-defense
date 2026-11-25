/* Doodle Defense pages: 3 worlds, 5 pages + a boss each. Design coords are 390x620. */
(function (global) {
  "use strict";

  var LEVELS = [
    {
      id: 1, world: 1, name: "First Scribble",
      blurb: "Draw a line. Your doodles will walk it.",
      hint: "Pick a crayon, then draw a path.",
      goal: "house",
      house: { x: 200, y: 470, hp: 5 },
      puddles: [], stars: [],
      spawns: [
        { at: 5, x: 200, y: 20, kind: "scribble", wave: 1 },
        { at: 12, x: 20, y: 180, kind: "scribble", wave: 1 },
        { at: 20, x: 370, y: 160, kind: "scribble", wave: 2 },
        { at: 28, x: 80, y: 20, kind: "scribble", wave: 2 },
        { at: 38, x: 320, y: 30, kind: "scribble", wave: 3 }
      ]
    },
    {
      id: 2, world: 1, name: "Loopy Guard",
      blurb: "A loop makes doodles walk in a circle.",
      hint: "Draw a loop around the house to guard it.",
      goal: "house",
      house: { x: 195, y: 300, hp: 5 },
      puddles: [], stars: [],
      spawns: [
        { at: 4, x: 195, y: 16, kind: "scribble", wave: 1 },
        { at: 8, x: 16, y: 300, kind: "scribble", wave: 1 },
        { at: 12, x: 374, y: 300, kind: "scribble", wave: 1 },
        { at: 18, x: 40, y: 16, kind: "scribble", wave: 2 },
        { at: 24, x: 350, y: 16, kind: "scribble", wave: 2 },
        { at: 32, x: 16, y: 500, kind: "scribble", wave: 3 },
        { at: 40, x: 374, y: 500, kind: "scribble", wave: 3 },
        { at: 50, x: 195, y: 16, kind: "scribble", wave: 3 }
      ]
    },
    {
      id: 3, world: 1, name: "Puddle Splash",
      blurb: "Draw through a puddle to make swimmers.",
      hint: "Draw through the puddle, or loop a star to grab it.",
      goal: "stars",
      starsNeed: 5,
      house: { x: 320, y: 520, hp: 4 },
      puddles: [
        { x: 150, y: 240, r: 62 },
        { x: 220, y: 310, r: 48 }
      ],
      stars: [
        { x: 150, y: 240 }, { x: 220, y: 310 }, { x: 80, y: 200 },
        { x: 260, y: 180 }, { x: 180, y: 390 }
      ],
      spawns: [
        { at: 6, x: 20, y: 80, kind: "scribble", wave: 1 },
        { at: 14, x: 200, y: 16, kind: "scribble", wave: 1 },
        { at: 24, x: 370, y: 200, kind: "scribble", wave: 2 },
        { at: 36, x: 20, y: 400, kind: "scribble", wave: 2 }
      ]
    },
    {
      id: 4, world: 1, name: "Vine Fence",
      blurb: "Green vines can block scribble monsters.",
      hint: "Green vines can block the way. Try crossing red with green for thorns!",
      goal: "house",
      house: { x: 80, y: 400, hp: 5 },
      puddles: [{ x: 260, y: 200, r: 44 }],
      stars: [],
      spawns: [
        { at: 4, x: 374, y: 80, kind: "scribble", wave: 1 },
        { at: 8, x: 374, y: 200, kind: "scribble", wave: 1 },
        { at: 12, x: 374, y: 340, kind: "scribble", wave: 1 },
        { at: 20, x: 374, y: 160, kind: "scribble", wave: 2 },
        { at: 26, x: 374, y: 420, kind: "scribble", wave: 2 },
        { at: 34, x: 374, y: 260, kind: "scribble", wave: 2 },
        { at: 44, x: 300, y: 16, kind: "scribble", wave: 3 },
        { at: 54, x: 374, y: 500, kind: "jumper", wave: 3 }
      ]
    },
    {
      id: 5, world: 1, name: "Star Parade",
      blurb: "Mix loops, puddles, and color crosses to grab the stars.",
      hint: "Try crossing a red line with a blue one for a splash burst!",
      goal: "stars",
      starsNeed: 7,
      house: { x: 80, y: 110, hp: 4 },
      puddles: [{ x: 240, y: 360, r: 70 }],
      stars: [
        { x: 240, y: 360 }, { x: 200, y: 120 }, { x: 320, y: 200 },
        { x: 70, y: 280 }, { x: 300, y: 480 }, { x: 150, y: 500 }, { x: 340, y: 90 }
      ],
      spawns: [
        { at: 5, x: 374, y: 300, kind: "scribble", wave: 1 },
        { at: 10, x: 200, y: 16, kind: "scribble", wave: 1 },
        { at: 16, x: 374, y: 500, kind: "jumper", wave: 2 },
        { at: 24, x: 20, y: 500, kind: "scribble", wave: 2 },
        { at: 34, x: 374, y: 160, kind: "scribble", wave: 3 },
        { at: 44, x: 160, y: 16, kind: "jumper", wave: 3 }
      ]
    },
    {
      id: 6, world: 1, name: "Big Smudge",
      blurb: "A giant scribble is coming. Keep the house clean!",
      hint: "Loop the house and plant thorns. Big Smudge drops little scribbles.",
      goal: "house",
      boss: "smudge",
      house: { x: 195, y: 420, hp: 6 },
      puddles: [{ x: 80, y: 180, r: 40 }],
      stars: [],
      spawns: [
        { at: 5, x: 195, y: 20, kind: "boss", boss: "smudge", wave: 1 },
        { at: 16, x: 20, y: 80, kind: "scribble", wave: 2 },
        { at: 28, x: 370, y: 80, kind: "scribble", wave: 2 },
        { at: 42, x: 40, y: 20, kind: "jumper", wave: 3 }
      ]
    },
    {
      id: 7, world: 2, name: "Hopper Field",
      blurb: "These hoppers bounce right over vines.",
      hint: "Vines alone won't stop hoppers. Slow them with blue, or plant thorns.",
      goal: "house",
      house: { x: 195, y: 500, hp: 5 },
      puddles: [], stars: [],
      spawns: [
        { at: 4, x: 80, y: 16, kind: "jumper", wave: 1 },
        { at: 7, x: 300, y: 16, kind: "jumper", wave: 1 },
        { at: 14, x: 195, y: 16, kind: "jumper", wave: 2 },
        { at: 18, x: 40, y: 16, kind: "scribble", wave: 2 },
        { at: 22, x: 350, y: 16, kind: "jumper", wave: 2 },
        { at: 32, x: 120, y: 16, kind: "jumper", wave: 3 },
        { at: 36, x: 270, y: 16, kind: "jumper", wave: 3 },
        { at: 48, x: 195, y: 16, kind: "jumper", wave: 3 }
      ]
    },
    {
      id: 8, world: 2, name: "Windy Page",
      blurb: "A breeze bends lines as you draw them.",
      hint: "The wind tugs fresh lines. Draw a little into the breeze.",
      goal: "house",
      house: { x: 80, y: 320, hp: 5 },
      wind: { ax: 0.9, ay: 0.25 },
      puddles: [{ x: 260, y: 420, r: 46 }],
      stars: [],
      spawns: [
        { at: 5, x: 370, y: 80, kind: "scribble", wave: 1 },
        { at: 10, x: 370, y: 240, kind: "jumper", wave: 1 },
        { at: 18, x: 370, y: 400, kind: "scribble", wave: 2 },
        { at: 24, x: 300, y: 16, kind: "scribble", wave: 2 },
        { at: 34, x: 370, y: 160, kind: "jumper", wave: 3 },
        { at: 44, x: 370, y: 500, kind: "splitter", wave: 3 }
      ]
    },
    {
      id: 9, world: 2, name: "Coffee Break",
      blurb: "Coffee stains make ink slow and thirsty.",
      hint: "Drawing in a stain uses extra ink. A loop around a star still grabs it.",
      goal: "stars",
      starsNeed: 5,
      house: { x: 70, y: 80, hp: 4 },
      stains: [
        { x: 200, y: 260, r: 70 },
        { x: 300, y: 420, r: 54 }
      ],
      puddles: [{ x: 120, y: 400, r: 48, vx: 22, vy: 10 }],
      stars: [
        { x: 200, y: 260 }, { x: 300, y: 420 }, { x: 120, y: 400 },
        { x: 320, y: 140 }, { x: 80, y: 300 }
      ],
      spawns: [
        { at: 6, x: 370, y: 200, kind: "scribble", wave: 1 },
        { at: 14, x: 200, y: 16, kind: "jumper", wave: 1 },
        { at: 24, x: 370, y: 500, kind: "eater", wave: 2 },
        { at: 36, x: 370, y: 80, kind: "scribble", wave: 2 }
      ]
    },
    {
      id: 10, world: 2, name: "Split Decision",
      blurb: "Tickle a splitter and it becomes two little scribbles.",
      hint: "Leave room for two! Thorns and splashes catch both.",
      goal: "house",
      house: { x: 195, y: 480, hp: 5 },
      puddles: [{ x: 80, y: 220, r: 44, vx: 18, vy: 16 }],
      stars: [],
      spawns: [
        { at: 5, x: 40, y: 16, kind: "splitter", wave: 1 },
        { at: 9, x: 350, y: 16, kind: "splitter", wave: 1 },
        { at: 18, x: 195, y: 16, kind: "scribble", wave: 2 },
        { at: 24, x: 80, y: 16, kind: "splitter", wave: 2 },
        { at: 28, x: 310, y: 16, kind: "jumper", wave: 2 },
        { at: 40, x: 40, y: 16, kind: "splitter", wave: 3 },
        { at: 44, x: 350, y: 16, kind: "splitter", wave: 3 }
      ]
    },
    {
      id: 11, world: 2, name: "Now You See It",
      blurb: "Sneaky scribbles stay hidden until they touch blue.",
      hint: "Paint blue trails. Sneaky scribbles only show on blue, puddles, or splashes.",
      goal: "house",
      house: { x: 195, y: 500, hp: 5 },
      puddles: [{ x: 300, y: 240, r: 40 }],
      stars: [],
      spawns: [
        { at: 5, x: 60, y: 16, kind: "sneaky", wave: 1 },
        { at: 9, x: 330, y: 16, kind: "sneaky", wave: 1 },
        { at: 16, x: 195, y: 16, kind: "scribble", wave: 2 },
        { at: 22, x: 40, y: 16, kind: "sneaky", wave: 2 },
        { at: 26, x: 350, y: 16, kind: "sneaky", wave: 2 },
        { at: 36, x: 120, y: 16, kind: "jumper", wave: 3 },
        { at: 40, x: 270, y: 16, kind: "sneaky", wave: 3 },
        { at: 50, x: 195, y: 16, kind: "sneaky", wave: 3 }
      ]
    },
    {
      id: 12, world: 2, name: "Nibblewick",
      blurb: "This big nibbler chews up your thickest line.",
      hint: "Don't put all your ink in one line. Keep a backup loop around the house.",
      goal: "house",
      boss: "nibble",
      house: { x: 195, y: 460, hp: 6 },
      stains: [{ x: 80, y: 200, r: 50 }],
      puddles: [{ x: 310, y: 200, r: 40 }],
      stars: [],
      spawns: [
        { at: 5, x: 195, y: 20, kind: "boss", boss: "nibble", wave: 1 },
        { at: 18, x: 20, y: 100, kind: "eater", wave: 2 },
        { at: 30, x: 370, y: 100, kind: "splitter", wave: 2 },
        { at: 44, x: 40, y: 20, kind: "jumper", wave: 3 }
      ]
    },
    {
      id: 13, world: 3, name: "Folded Note",
      blurb: "Part of the page folds over, then flips.",
      hint: "You can't draw under the fold. Wait for it to flip, or work on the open side.",
      goal: "house",
      house: { x: 90, y: 400, hp: 5 },
      fold: { start: "right", cover: 0.38, period: 8 },
      puddles: [], stars: [],
      spawns: [
        { at: 5, x: 40, y: 16, kind: "scribble", wave: 1 },
        { at: 10, x: 160, y: 16, kind: "jumper", wave: 1 },
        { at: 18, x: 40, y: 16, kind: "splitter", wave: 2 },
        { at: 24, x: 200, y: 16, kind: "eater", wave: 2 },
        { at: 34, x: 80, y: 16, kind: "sneaky", wave: 3 },
        { at: 40, x: 180, y: 16, kind: "jumper", wave: 3 },
        { at: 52, x: 40, y: 16, kind: "scribble", wave: 3 }
      ]
    },
    {
      id: 14, world: 3, name: "Copycats",
      blurb: "These scribbles change to counter the lines you already drew.",
      hint: "Mix your colors. If you only use vines, hoppers will show up.",
      goal: "house",
      adapt: true,
      house: { x: 195, y: 480, hp: 5 },
      puddles: [{ x: 60, y: 200, r: 36 }],
      stars: [],
      spawns: [
        { at: 4, x: 40, y: 16, kind: "adapt", wave: 1 },
        { at: 8, x: 350, y: 16, kind: "adapt", wave: 1 },
        { at: 16, x: 195, y: 16, kind: "adapt", wave: 2 },
        { at: 20, x: 80, y: 16, kind: "adapt", wave: 2 },
        { at: 24, x: 310, y: 16, kind: "adapt", wave: 2 },
        { at: 34, x: 40, y: 16, kind: "adapt", wave: 3 },
        { at: 38, x: 195, y: 16, kind: "adapt", wave: 3 },
        { at: 42, x: 350, y: 16, kind: "adapt", wave: 3 },
        { at: 54, x: 120, y: 16, kind: "adapt", wave: 3 },
        { at: 58, x: 270, y: 16, kind: "adapt", wave: 3 }
      ]
    },
    {
      id: 15, world: 3, name: "Desk Storm",
      blurb: "Wind, wandering puddles, and a mixed crowd.",
      hint: "Plan short lines. Use Zap if you have it, and watch the puddles drift.",
      goal: "house",
      house: { x: 195, y: 500, hp: 5 },
      wind: { ax: -0.7, ay: 0.35 },
      puddles: [
        { x: 90, y: 220, r: 42, vx: 20, vy: 14 },
        { x: 300, y: 300, r: 38, vx: -16, vy: 18 }
      ],
      stars: [],
      spawns: [
        { at: 4, x: 40, y: 16, kind: "jumper", wave: 1 },
        { at: 8, x: 350, y: 16, kind: "sneaky", wave: 1 },
        { at: 16, x: 195, y: 16, kind: "splitter", wave: 2 },
        { at: 22, x: 80, y: 16, kind: "eater", wave: 2 },
        { at: 28, x: 310, y: 16, kind: "jumper", wave: 2 },
        { at: 40, x: 40, y: 16, kind: "sneaky", wave: 3 },
        { at: 46, x: 195, y: 16, kind: "splitter", wave: 3 },
        { at: 52, x: 350, y: 16, kind: "jumper", wave: 3 }
      ]
    },
    {
      id: 16, world: 3, name: "Star Vault",
      blurb: "Lots of stars, and not much leftover ink if you scribble everywhere.",
      hint: "Loop each star to grab it without walking the whole page.",
      goal: "stars",
      starsNeed: 8,
      house: { x: 195, y: 300, hp: 5 },
      puddles: [{ x: 195, y: 160, r: 36, vx: 14, vy: 0 }],
      stains: [{ x: 195, y: 480, r: 58 }],
      stars: [
        { x: 70, y: 80 }, { x: 320, y: 80 }, { x: 70, y: 240 }, { x: 320, y: 240 },
        { x: 70, y: 420 }, { x: 320, y: 420 }, { x: 195, y: 160 }, { x: 195, y: 480 }
      ],
      spawns: [
        { at: 5, x: 20, y: 16, kind: "jumper", wave: 1 },
        { at: 10, x: 370, y: 16, kind: "sneaky", wave: 1 },
        { at: 20, x: 20, y: 500, kind: "splitter", wave: 2 },
        { at: 26, x: 370, y: 500, kind: "eater", wave: 2 },
        { at: 38, x: 20, y: 200, kind: "scribble", wave: 3 },
        { at: 44, x: 370, y: 200, kind: "jumper", wave: 3 }
      ]
    },
    {
      id: 17, world: 3, name: "Full Toolbox",
      blurb: "Zap, Blink, folds, and a little of everything.",
      hint: "Blink can hop doodles to a far star. Zap ticks along a yellow line.",
      goal: "stars",
      starsNeed: 6,
      house: { x: 80, y: 500, hp: 5 },
      fold: { start: "right", cover: 0.32, period: 9 },
      wind: { ax: 0.4, ay: -0.15 },
      puddles: [{ x: 200, y: 240, r: 40, vx: 12, vy: 10 }],
      stars: [
        { x: 80, y: 120 }, { x: 200, y: 120 }, { x: 80, y: 280 },
        { x: 200, y: 280 }, { x: 80, y: 400 }, { x: 240, y: 500 }
      ],
      spawns: [
        { at: 5, x: 40, y: 16, kind: "sneaky", wave: 1 },
        { at: 10, x: 200, y: 16, kind: "jumper", wave: 1 },
        { at: 18, x: 80, y: 16, kind: "eater", wave: 2 },
        { at: 24, x: 200, y: 16, kind: "splitter", wave: 2 },
        { at: 36, x: 40, y: 16, kind: "sneaky", wave: 3 },
        { at: 44, x: 180, y: 16, kind: "jumper", wave: 3 }
      ]
    },
    {
      id: 18, world: 3, name: "Hidey Storm",
      blurb: "The last boss hops, hides, and calls hoppers.",
      hint: "Keep blue on the page so Hidey Storm can't vanish. Zap helps a lot.",
      goal: "house",
      boss: "hidey",
      house: { x: 195, y: 500, hp: 6 },
      wind: { ax: 0.35, ay: 0.2 },
      puddles: [
        { x: 80, y: 240, r: 36, vx: 14, vy: 8 },
        { x: 310, y: 300, r: 36, vx: -14, vy: 10 }
      ],
      stars: [],
      spawns: [
        { at: 5, x: 195, y: 20, kind: "boss", boss: "hidey", wave: 1 },
        { at: 16, x: 40, y: 16, kind: "jumper", wave: 2 },
        { at: 22, x: 350, y: 16, kind: "sneaky", wave: 2 },
        { at: 36, x: 80, y: 16, kind: "splitter", wave: 3 },
        { at: 44, x: 310, y: 16, kind: "jumper", wave: 3 }
      ]
    }
  ];

  var WORLDS = [
    { id: 1, name: "Sunny Sketchbook", pages: [1, 2, 3, 4, 5], boss: 6 },
    { id: 2, name: "The Messy Desk", pages: [7, 8, 9, 10, 11], boss: 12 },
    { id: 3, name: "Stormy Attic", pages: [13, 14, 15, 16, 17], boss: 18 }
  ];

  global.DD_LEVELS = LEVELS;
  global.DD_WORLDS = WORLDS;
})(window);
