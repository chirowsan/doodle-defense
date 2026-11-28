/* Small, silent, vector clips for the optional field guide. Each plays once. */
(function (global) {
  "use strict";

  var LENGTH = 5.2;
  var INK = "#3a2a22", PAPER = "#fff8e6";
  var C = { red: "#db5746", blue: "#3d8fd8", green: "#40985a", yellow: "#d99615", purple: "#9558ce", cyan: "#249e9e" };
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function circle(x, y, r, fill, stroke, width) {
    return '<circle cx="'+x+'" cy="'+y+'" r="'+r+'" fill="'+fill+'" stroke="'+(stroke || "none")+'" stroke-width="'+(width || 1)+'"/>';
  }
  function rect(x,y,w,h,r,fill,stroke) {
    return '<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="'+r+'" fill="'+fill+'" stroke="'+(stroke || "none")+'" stroke-width="1.7"/>';
  }
  function path(d,fill,stroke,width,extra) {
    return '<path d="'+d+'" fill="'+fill+'" stroke="'+stroke+'" stroke-width="'+width+'" stroke-linecap="round" stroke-linejoin="round" '+(extra || "")+'/>';
  }
  function g(x,y,markup) {
    return '<g transform="translate('+x+' '+y+')">'+markup+'</g>';
  }
  function text(x,y,label,color,size) {
    return '<text x="'+x+'" y="'+y+'" text-anchor="middle" fill="'+(color || INK)+'" font-size="'+(size || 12)+'" font-weight="800">'+esc(label)+'</text>';
  }
  function show(markup, start, stop) {
    return '<g opacity="0"><set attributeName="opacity" to="1" begin="'+start+'s" '+
      (stop == null ? 'fill="freeze"' : 'dur="'+(stop-start).toFixed(2)+'s"')+'/>'+markup+'</g>';
  }
  function move(markup, points, times) {
    var coords = points.map(function (p) { return p.join(" "); });
    return '<g transform="translate('+coords[0]+')"><animateTransform attributeName="transform" type="translate" dur="'+LENGTH+
      's" values="'+coords.join(";")+'" keyTimes="'+times.join(";")+'" fill="freeze"/>'+markup+'</g>';
  }
  function penLine(d, color, width, start, duration, opacity) {
    return '<path d="'+d+'" fill="none" stroke="'+C[color]+'" stroke-width="'+(width || 7)+'" stroke-linecap="round" stroke-linejoin="round" '+
      'opacity="'+(opacity == null ? 0.91 : opacity)+'" pathLength="100" stroke-dasharray="100 100" stroke-dashoffset="100">'+
      '<animate attributeName="stroke-dashoffset" from="100" to="0" begin="'+(start || 0)+'s" dur="'+(duration || 0.75)+'s" fill="freeze"/></path>';
  }
  function readout(label, from, to, color, x, y) {
    x = x == null ? 160 : x; y = y == null ? 131 : y;
    var w = Math.max(52, Math.min(299, label.length * 6.4 + 18));
    return show(rect(x-w/2,y-15,w,21,8,"#fff8e6","#cfb98c")+text(x,y,label,color,11.5),from || 0,to);
  }
  function mob(kind, points, times, enter, leave) {
    var art = global.DDMonsterArt.icon(kind).replace('class="monster-icon"', 'x="-20" y="-21" width="40" height="40"');
    return show(move(art, points, times),enter || 0,leave);
  }
  function house(x,y) {
    return g(x,y,path("M-22 2 L0-20 22 2 M-17 0V23H17V0","#f3c981",INK,2.6)+
      rect(-5,8,10,15,2,"#c86a4a",INK)+rect(6,3,6,6,1,"#fff8e6",INK));
  }
  function doodle(x,y) {
    return g(x,y,circle(0,0,9,C.red,INK,1.8)+path("M-4 2Q0 6 4 2 M-4 8L-6 12 M4 8L6 12","none",INK,1.6)+circle(-3,-2,1.2,INK)+circle(3,-2,1.2,INK));
  }
  function tap(x,y,t) {
    return show(circle(x,y,13,"none","#8b613f",1.6)+circle(x,y,5,"#fff","#8b613f",1.6),t,t+0.34);
  }
  function spark(x,y,color,t,stop) {
    return show(g(x,y,path("M-14 0h7 M7 0h7 M0-14v7 M0 7v7 M-9-9l4 4 M9-9l-4 4 M9 9l-4-4 M-9 9l4-4","none",C[color] || color,2.7)),t,stop);
  }
  function drop(x,y) {
    return g(x,y,path("M0-12Q10 1 8 7C5 14-5 14-8 7Q-10 1 0-12Z",C.blue,"#245f96",1.8)+circle(-3,3,1.8,"#d0f2fd"));
  }
  function stars(x,y) {
    return g(x,y,path("M0-13L4-4 13-3 6 4 8 13 0 8-8 13-6 4-13-3-4-4Z","#ffd662","#9a7415",1.8));
  }
  function arrow(d) { return path(d,"none","#9b785c",1.8,'stroke-dasharray="3 4"'); }
  function inkBox(startValue, endValue, t) {
    return rect(231,15,76,28,9,PAPER,INK)+drop(246,28)+
      show(text(277,33,startValue,INK,13),0,t)+show(text(277,33,endValue,"#245f96",13),t);
  }
  function defeatDemo(intro) {
    return house(269,71)+arrow("M41 75H179 M174 71l5 4-5 4")+
      penLine("M205 37Q194 58 200 83T197 111","red",7,.20,.90)+
      show(doodle(199,64)+doodle(199,93),1.10)+
      mob("scribble",[[43,76],[43,76],[181,76],[188,76]],[0,intro ? .40 : .24,.68,1],intro ? 2.07 : 1.2,3.82)+
      spark(188,76,"red",3.34,3.68)+spark(183,73,"red",3.72,4.1)+
      (intro ? show(rect(80,84,65,26,9,"#ffe17a",INK)+text(112,101,"Start",INK,13),1.30,2.32)+tap(111,96,1.96)+
          readout("1  Draw a red line",.05,1.29)+readout("2  Tap Start",1.30,2.32)+readout("3  Doodles defend the house",2.33)
        : readout("Draw red",.05,1.3)+readout("Red doodles attack",1.32,4.17)+readout("Monster defeated",4.18));
  }
  function slowDemo(frost) {
    var color = frost ? "cyan" : "blue", kind = frost ? "flyer" : "scribble";
    return arrow("M45 75H272 M266 70l6 5-6 5")+
      penLine("M157 36L153 106",color,frost ? 12 : 9,.12,.6)+
      mob(kind,[[43,74],[43,74],[140,74],[171,74],[246,74]],[0,.17,.39,.80,1],.85)+
      show(circle(155,74,27,"none",C[color],2),2.06,4.22)+spark(158,49,color,2.2,3.9)+
      readout(frost ? "Draw Teal Frost" : "Draw blue",0,1.49)+
      readout(frost ? "Flyer slows over Frost" : "Ground monster slows near blue",1.5);
  }
  function wallDemo(brush) {
    var mono = "";
    if (brush) {
      mono = text(52,36,"Pen",INK,12)+text(56,94,"Brush",INK,12)+
        show(penLine("M151 13V54","green",5,0,.55),0,2.84)+
        penLine("M151 69V113","green",13,0,.65)+
        mob("scribble",[[86,32],[137,32],[137,32],[203,32]],[0,.33,.57,1],.1)+
        mob("scribble",[[86,89],[132,89],[132,89]],[0,.34,1],.1)+
        spark(148,32,"green",2.45,3.1)+spark(143,87,"green",3.67,4.02)+
        readout("Brush wall holds longer",1.97);
    } else mono = house(255,71)+penLine("M166 30Q157 62 165 109","green",10,.13,.72)+
        mob("scribble",[[52,72],[52,72],[149,72],[143,72],[148,72],[143,72]],[0,.18,.48,.62,.84,1],.9)+
        spark(161,71,"green",2.63,3.25)+spark(162,71,"green",4.19,4.69)+
        readout("Draw a green wall",0,1.25)+readout("Stops monsters until they chew through",1.26);
    return mono;
  }
  var SCENES = {
    basics: function () { return defeatDemo(true); },
    red: function () { return defeatDemo(false); },
    blue: function () { return slowDemo(false); },
    cyan: function () { return slowDemo(true); },
    green: function () { return wallDemo(false); },
    brush: function () { return wallDemo(true); },
    yellow: function () {
      var bolt = path("M181 26l-15 18h13l-13 16 27-22h-14l12-12Z","#ffe174","#9a7316",2);
      return penLine("M67 83H258","yellow",9,.2,.85)+
        mob("armored",[[133,74],[164,74],[174,74]],[0,.44,1],.5)+
        show(bolt,1.84,2.16)+show(bolt,3.02,3.35)+show(bolt,4.15,4.5)+
        show(rect(152,99,46,7,3,"#edd9a9",INK)+rect(154,100,42,4,2,C.green),.68,2.01)+
        show(rect(152,99,46,7,3,"#edd9a9",INK)+rect(154,100,27,4,2,C.yellow),2.02,3.21)+
        show(rect(152,99,46,7,3,"#edd9a9",INK)+rect(154,100,12,4,2,C.red),3.22)+
        readout("Zap damages armored monsters",.45);
    },
    purple: function () {
      return house(279,70)+penLine("M62 74Q142 58 212 75","purple",6,.15,.80)+
        show(circle(62,74,14,"#f1dffc",C.purple,3)+circle(212,75,14,"#f1dffc",C.purple,3),1.0)+
        mob("scribble",[[257,45],[257,45],[212,75],[212,75],[62,74],[79,74]],[0,.19,.48,.493,.494,1],1.0)+
        spark(62,74,"purple",2.51,2.96)+spark(212,75,"purple",2.54,3.05)+
        readout("Draw two linked portals",0,2.51)+readout("Touch one end → swap to the other",2.52);
    },
    eraser: function () {
      return show(penLine("M72 83Q162 43 248 81","red",8,.05,.55),0,2.45)+
        show(doodle(139,65)+doodle(202,66),.60,2.45)+
        show(move(rect(-17,-9,34,18,6,"#f2acbc",INK),[[246,61],[246,61],[156,64],[84,80],[84,80]],[0,.18,.36,.46,1]),.92,2.68)+
        spark(94,78,"red",2.4,2.8)+inkBox("36 ink","39 ink",2.45)+
        readout("Erase a line and its doodles",.78,2.44)+readout("Get a little ink back",2.45);
    },
    pen: function () {
      return show(stars(158,71),0,2.37)+
        penLine("M157 44Q195 39 206 64Q210 96 171 99Q127 104 113 75Q103 50 157 44","blue",5,.44,1.91)+
        spark(158,71,"yellow",2.36,3.1)+show(text(158,79,"✓","#22854f",27),2.91)+
        readout("Pen draws a thin, cheap loop",.3,2.45)+readout("Board star collected",2.46);
    },
    highlighter: function () {
      return penLine("M152 26V109","red",31,.14,.85,.37)+
        show(move('<g opacity=".23">'+global.DDMonsterArt.icon("sneaky").replace('class="monster-icon"', 'x="-20" y="-20" width="40" height="40"')+'</g>',
          [[53,72],[53,72],[137,72],[137,72]],[0,.23,.46,1]),0,2.39)+
        mob("sneaky",[[137,72],[137,72],[175,72],[195,72]],[0,.46,.80,1],2.39)+
        spark(153,46,"red",2.38,3.10)+readout("Draw a wide strip",.18,2.38)+readout("Hidden enemy becomes visible and slows",2.39);
    },
    inkwell: function () {
      var jar = rect(102,60,49,45,9,"#d8e7f6",INK)+rect(109,49,35,16,4,"#fff0d2",INK)+
        '<rect x="108" y="96" width="37" height="4" rx="4" fill="'+C.blue+'"><animate attributeName="y" from="96" to="68" begin="0.65s" dur="1.62s" fill="freeze"/><animate attributeName="height" from="4" to="32" begin="0.65s" dur="1.62s" fill="freeze"/></rect>';
      return show(jar,.55)+tap(125,87,.30)+penLine("M71 107Q89 92 111 108","blue",6,.84,.8)+
        show(drop(178,81),2.30,3.27)+tap(178,81,3.0)+spark(178,81,"blue",3.25,3.67)+
        inkBox("22 ink","36 ink",3.27)+readout("1  Place an Inkwell",0,1.17)+readout("2  It fills during waves",1.18,2.85)+readout("3  Tap the drop for +14 ink",2.86);
    },
    decoy: function () {
      return house(266,60)+arrow("M48 57H247 M240 53l7 4-7 4")+
        show(rect(157,84,40,25,7,"#f2ba83",INK)+text(177,101,"BAIT",INK,10),.80)+
        mob("scribble",[[42,57],[42,57],[120,60],[161,86],[166,89]],[0,.10,.40,.61,1],.2)+
        spark(173,85,"red",3.12,3.62)+readout("Decoy lures ground monsters",.35,3.05)+readout("They stop to chew it",3.06);
    },
    sharpener: function () {
      return rect(230,63,44,33,8,"#ecb19b",INK)+circle(247,77,7,"#fff8e6",INK,2)+
        penLine("M224 105H288","red",7,.20,.80)+
        mob("scribble",[[67,78],[122,78],[134,78],[139,78]],[0,.38,.74,1],.12,4.3)+
        show(move(g(0,0,path("M-12 0l10-4v8Z","#a35b29",INK,1)),[[231,77],[231,77],[115,77],[115,77]],[0,.30,.48,1]),1.56,2.50)+
        spark(124,76,"red",2.50,2.80)+spark(138,76,"red",4.1,4.43)+
        readout("Fires at ground monsters",.3,2.75)+readout("A red line speeds it up",2.76);
    },
    glue: function () {
      return show('<ellipse cx="157" cy="77" rx="36" ry="27" fill="#d8b4e3" stroke="#9965a8" stroke-width="2" stroke-dasharray="4 4"/>',.55)+
        mob("scribble",[[37,73],[108,73],[133,73],[169,73],[187,73],[187,73]],[0,.20,.34,.70,.88,1],.1)+
        spark(135,52,"purple",1.65,2.13)+readout("Ground monsters crawl through glue",.3,3.33)+readout("The pad dries up over time",3.34);
    },
    bumper: function () {
      return show(rect(165,53,25,49,10,"#eda5c3",INK)+path("M171 66l13 10-13 10","none",INK,2),.5)+
        mob("jumper",[[53,75],[53,75],[152,75],[152,75],[109,50],[105,53],[105,53]],[0,.10,.49,.50,.59,.66,1],.2)+
        spark(151,73,"red",2.54,3.04)+show(g(105,28,stars(0,0)),3.05,4.19)+
        readout("Bumper knocks enemies back",.48,3.05)+readout("Briefly stunned",3.06);
    },
    reservoir: function () {
      return show(rect(93,55,55,53,9,"#c5dfed",INK)+rect(105,45,31,15,4,PAPER,INK)+
        rect(99,78,43,25,5,"#62a8e0","none"),1.3)+tap(122,89,1.14)+
        readout("Ink limit 100",.2,1.29,"#245f96",243,34)+readout("Ink limit 150",1.30,null,"#245f96",243,34)+
        spark(150,62,"blue",1.32,1.84)+readout("Place a Reservoir",0,1.29)+readout("Room for +50 more ink",1.3);
    },
    splash: function () { return combo("blue","red","splash","Splash hits when enemies enter"); },
    thorn: function () { return combo("green","red","thorn","Thorns hurt armored enemies"); },
    bush: function () { return combo("green","blue","bush","Bouncy Bush pushes enemies away"); },
    launch: function () {
      return penLine("M112 97L159 39 199 97Z","red",6,.16,1.12)+
        mob("flyer",[[249,40],[249,40],[217,57],[219,58]],[0,.40,.69,1],.2,3.9)+
        show(move(doodle(0,0),[[159,69],[159,69],[218,52],[218,52]],[0,.49,.69,1]),1.28,3.91)+
        spark(221,54,"red",3.58,4.11)+readout("Draw a closed triangle",.12,1.29)+readout("A doodle launches at a Flyer",1.30);
    },
    rally: function () {
      var pin = path("M0 2l-3-28","none",INK,2)+path("M-3-24l22 4-6 5 6 6-21-2Z","#f7c959",INK,1.8);
      return penLine("M52 88H246","red",7,.10,.65)+penLine("M154 110V39","red",7,.72,.65)+
        show(path("M154 82l6 6-6 6-6-6Z","#ffedab","#735320",1.5),1.48)+
        show(g(154,41,pin),1.73)+tap(154,41,1.56)+
        show(move(doodle(0,0),[[66,88],[86,88],[104,88],[154,88],[154,41],[154,62],[154,47]],
          [0,.23,.38,.61,.83,.95,1]),.73)+
        readout("Cross two red lines",.15,1.48)+readout("Tap Rally, then tap a red line",1.49,2.60)+
        readout("Doodles turn at the junction",2.61);
    },
    loop: function () {
      return house(161,61)+penLine("M158 33Q201 32 208 62Q216 104 161 109Q117 108 113 77Q112 36 158 33","red",7,.15,1.9)+
        show(doodle(116,84)+doodle(205,81)+doodle(159,108),2.03)+
        readout("Close a red loop around the house",.1,2.04)+readout("Extra guards hatch",2.05);
    }
  };
  function combo(a,b,type,description) {
    var body = penLine("M72 73H249",a,8,.13,.7)+penLine("M160 33V110",b,8,.92,.68)+
      mob(type === "thorn" ? "armored" : "scribble",[[54,84],[54,84],[142,79],[158,79],[type === "bush" ? 121 : 165,84]],[0,.33,.58,.71,1],1.6);
    if (type === "splash") body += show(circle(157,75,24,"#c7e5ff",C.blue,2)+drop(156,66),2.86,3.57);
    if (type === "thorn") body += show(g(157,77,path("M-23 12L-16-9-8 12 0-14 8 12 15-9 23 12Z","#d4786a",INK,1.8)),1.61);
    if (type === "bush") body += show(circle(158,73,16,"#a9d39c","#2b693e",2)+path("M149 75l-20 3 5-6m-5 6 7 4","none",INK,2.2),2.80);
    return body + readout("Cross the two colors",0,1.63)+readout(description,1.64);
  }
  function markup(id, title) {
    if (!Object.prototype.hasOwnProperty.call(SCENES,id)) return "";
    var ruled = "";
    for (var i = 23; i < 140; i += 20) ruled += path("M0 "+i+"H320","none","#d9e3ee",.8);
    return '<svg class="lesson-scene" viewBox="0 0 320 144" role="img" aria-label="'+esc(title)+
      '" xmlns="http://www.w3.org/2000/svg" font-family="Trebuchet MS, sans-serif">'+
      '<rect width="320" height="144" fill="#fffaf0"/>'+ruled+path("M20 0V144","none","#efc5b8",.8)+SCENES[id]()+'</svg>';
  }
  global.DDDemos = { ids: Object.keys(SCENES), length: LENGTH, markup: markup };
})(window);
