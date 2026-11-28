/* Arc-length routing between the actual crossings of red patrol strokes. */
(function (global) {
  "use strict";
  var EPS = 1e-6;
  function measure(st) {
    var at = 0, segments = [];
    for (var i = 1; i < st.pts.length; i++) {
      var a = st.pts[i - 1], b = st.pts[i];
      var dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
      if (len > EPS) {
        segments.push({ a: a, dx: dx, dy: dy, len: len, at: at,
          left: Math.min(a.x,b.x), right: Math.max(a.x,b.x), top: Math.min(a.y,b.y), bottom: Math.max(a.y,b.y) });
        at += len;
      }
    }
    return { id: st.id, length: at, closed: st.closed, segments: segments, ports: [] };
  }
  function intersect(a, b) {
    if (a.right + EPS < b.left || b.right + EPS < a.left || a.bottom + EPS < b.top || b.bottom + EPS < a.top) return null;
    var den = a.dx * b.dy - a.dy * b.dx;
    if (Math.abs(den) < EPS) return null;
    var x = b.a.x - a.a.x, y = b.a.y - a.a.y;
    var u = (x*b.dy - y*b.dx) / den, v = (x*a.dy - y*a.dx) / den;
    if (u < -EPS || u > 1+EPS || v < -EPS || v > 1+EPS) return null;
    return { x: a.a.x + a.dx*u, y: a.a.y + a.dy*u, a: a.at + a.len*u, b: b.at + b.len*v };
  }
  function nearest(strokes, x, y, maxDist) {
    var best = null, limit = maxDist * maxDist;
    strokes.forEach(function (st) {
      measure(st).segments.forEach(function (s) {
        var px = x-s.a.x, py = y-s.a.y;
        var u = Math.max(0, Math.min(1, (px*s.dx+py*s.dy)/(s.len*s.len)));
        var xx = s.a.x+s.dx*u, yy = s.a.y+s.dy*u;
        var d2 = (x-xx)**2+(y-yy)**2;
        if (d2 <= limit && (!best || d2 < best.d2)) best = { strokeId: st.id, at: s.at+s.len*u, x: xx, y: yy, d2: d2 };
      });
    });
    return best;
  }
  function arc(st, from, to) {
    var route = { strokeId: st.id, at: to, dir: to < from ? -1 : 1, length: Math.abs(to-from) };
    if (st.closed && st.length-route.length+EPS < route.length) {
      route.length = st.length-route.length;
      route.dir *= -1;
    }
    return route;
  }
  function network(strokes, flag) {
    var all = strokes.map(measure), byId = new Map();
    var ports = [], joins = [];
    all.forEach(function (st) { byId.set(st.id,st); });
    var goalStroke = byId.get(flag.strokeId);
    if (!goalStroke) return null;
    function port(st,t) {
      t = Math.max(0,Math.min(t,st.length));
      if (st.closed && st.length-t < EPS) t = 0;
      var known = st.ports.find(function (node) { return Math.abs(node.at-t) < EPS; });
      if (known) return known;
      var node = { st: st, at: t, edges: [], dist: Infinity, next: null, settled: false };
      st.ports.push(node);
      ports.push(node);
      return node;
    }
    function link(a,b,weight,dir) {
      a.edges.push({ node: b, length: weight, dir: dir });
      b.edges.push({ node: a, length: weight, dir: -dir });
    }
    var goal = port(goalStroke,flag.at);
    for (var i=0; i<all.length; i++) {
      var a = all[i];
      for (var j=i+1; j<all.length; j++) {
        var b = all[j], hits = [];
        a.segments.forEach(function (sa) {
          b.segments.forEach(function (sb) {
            var p = intersect(sa,sb);
            if (!p || hits.some(function (h) { return Math.abs(h.a-p.a) < 6 && Math.abs(h.b-p.b) < 6; })) return;
            hits.push(p);
            var na = port(a,p.a), nb = port(b,p.b);
            link(na,nb,0,1);
            joins.push({ x: p.x, y: p.y, node: na });
          });
        });
      }
    }
    all.forEach(function (st) {
      var nodes = st.ports.sort(function (a,b) { return a.at-b.at; });
      for (var i=1; i<nodes.length; i++) link(nodes[i-1],nodes[i],nodes[i].at-nodes[i-1].at,1);
      if (st.closed && nodes.length > 1) {
        var last = nodes[nodes.length-1], first = nodes[0];
        link(last,first,st.length-last.at+first.at,1);
      }
    });
    goal.dist = 0;
    for (;;) {
      var best = null;
      ports.forEach(function (n) { if (!n.settled && Number.isFinite(n.dist) && (!best || n.dist < best.dist)) best = n; });
      if (!best) break;
      best.settled = true;
      best.edges.forEach(function (e) {
        var candidate = e.length+best.dist, node = e.node;
        if (node.settled || candidate+EPS >= node.dist) return;
        node.dist = candidate;
        node.next = { node: best, length: e.length, dir: -e.dir };
      });
    }
    return {
      joins: joins.filter(function (j) { return Number.isFinite(j.node.dist); }).map(function (j) { return { x: j.x, y: j.y }; }),
      route: function (strokeId, at) {
        var start = byId.get(strokeId);
        if (!start) return null;
        var best = null, first = null, distance = Infinity;
        start.ports.forEach(function (p) {
          var leg = arc(start,at,p.at);
          var length = p.dist+leg.length;
          if (length+EPS < distance) { distance = length; best = p; first = leg; }
        });
        if (!best) return null;
        var legs = [first], node = best;
        while (node !== goal) {
          var next = node.next;
          node = next.node;
          legs.push({ strokeId: node.st.id, at: node.at, dir: next.dir, length: next.length });
        }
        return { distance: distance, legs: legs };
      }
    };
  }
  global.DDPatrol = { nearest: nearest, network: network };
})(window);
