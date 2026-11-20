window.Glade = window.Glade || {};

Glade.cubicPts = function (p, p0, p1, p2, p3, n) {
  const o = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    o.push({
      x: p.bezierPoint(p0.x, p1.x, p2.x, p3.x, t),
      y: p.bezierPoint(p0.y, p1.y, p2.y, p3.y, t),
    });
  }
  return o;
};

Glade.quadPts = function (p, p0, p1, p2, n) {
  const c1 = {
    x: p0.x + (2 / 3) * (p1.x - p0.x),
    y: p0.y + (2 / 3) * (p1.y - p0.y),
  };
  const c2 = {
    x: p2.x + (2 / 3) * (p1.x - p2.x),
    y: p2.y + (2 / 3) * (p1.y - p2.y),
  };
  return Glade.cubicPts(p, p0, c1, c2, p2, n);
};

// Parse an SVG path's `d` attribute into an array of polyline subpaths.
Glade.parsePathD = function (p, d) {
  const toks = d.match(
    /([MmLlHhVvCcSsQqTtAaZz])|(-?\d*\.?\d+(?:[eE][+-]?\d+)?)/g,
  );
  if (!toks) return [];
  let i = 0,
    cx = 0,
    cy = 0,
    sx = 0,
    sy = 0,
    cmd = null,
    px = 0,
    py = 0;
  const subs = [];
  let cur0 = null;
  const newSub = () => {
    cur0 = [];
    subs.push(cur0);
  };
  const pushPt = (x, y) => {
    if (!cur0) newSub();
    cur0.push({ x, y });
  };
  const num = () => parseFloat(toks[i++]);
  while (i < toks.length) {
    const t = toks[i];
    if (/^[MmLlHhVvCcSsQqTtAaZz]$/.test(t)) {
      cmd = t;
      i++;
    }
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    switch (C) {
      case "M": {
        let x = num(),
          y = num();
        if (rel) {
          x += cx;
          y += cy;
        }
        sx = x;
        sy = y;
        newSub();
        pushPt(x, y);
        cx = x;
        cy = y;
        cmd = rel ? "l" : "L";
        px = x;
        py = y;
        break;
      }
      case "L": {
        let x = num(),
          y = num();
        if (rel) {
          x += cx;
          y += cy;
        }
        pushPt(x, y);
        cx = x;
        cy = y;
        px = x;
        py = y;
        break;
      }
      case "H": {
        let x = num();
        if (rel) x += cx;
        pushPt(x, cy);
        cx = x;
        px = x;
        py = cy;
        break;
      }
      case "V": {
        let y = num();
        if (rel) y += cy;
        pushPt(cx, y);
        cy = y;
        px = cx;
        py = y;
        break;
      }
      case "C": {
        let x1 = num(),
          y1 = num(),
          x2 = num(),
          y2 = num(),
          x = num(),
          y = num();
        if (rel) {
          x1 += cx;
          y1 += cy;
          x2 += cx;
          y2 += cy;
          x += cx;
          y += cy;
        }
        const pts = Glade.cubicPts(
          p,
          { x: cx, y: cy },
          { x: x1, y: y1 },
          { x: x2, y: y2 },
          { x, y },
          16,
        );
        for (let k = 1; k < pts.length; k++) pushPt(pts[k].x, pts[k].y);
        px = x2;
        py = y2;
        cx = x;
        cy = y;
        break;
      }
      case "S": {
        let x2 = num(),
          y2 = num(),
          x = num(),
          y = num();
        if (rel) {
          x2 += cx;
          y2 += cy;
          x += cx;
          y += cy;
        }
        const x1 = 2 * cx - px,
          y1 = 2 * cy - py;
        const pts = Glade.cubicPts(
          p,
          { x: cx, y: cy },
          { x: x1, y: y1 },
          { x: x2, y: y2 },
          { x, y },
          16,
        );
        for (let k = 1; k < pts.length; k++) pushPt(pts[k].x, pts[k].y);
        px = x2;
        py = y2;
        cx = x;
        cy = y;
        break;
      }
      case "Q": {
        let x1 = num(),
          y1 = num(),
          x = num(),
          y = num();
        if (rel) {
          x1 += cx;
          y1 += cy;
          x += cx;
          y += cy;
        }
        const pts = Glade.quadPts(p, { x: cx, y: cy }, { x: x1, y: y1 }, { x, y }, 12);
        for (let k = 1; k < pts.length; k++) pushPt(pts[k].x, pts[k].y);
        px = x1;
        py = y1;
        cx = x;
        cy = y;
        break;
      }
      case "T": {
        let x = num(),
          y = num();
        if (rel) {
          x += cx;
          y += cy;
        }
        const x1 = 2 * cx - px,
          y1 = 2 * cy - py;
        const pts = Glade.quadPts(p, { x: cx, y: cy }, { x: x1, y: y1 }, { x, y }, 12);
        for (let k = 1; k < pts.length; k++) pushPt(pts[k].x, pts[k].y);
        px = x1;
        py = y1;
        cx = x;
        cy = y;
        break;
      }
      case "A": {
        num();
        num();
        num();
        num();
        num();
        let x = num(),
          y = num();
        if (rel) {
          x += cx;
          y += cy;
        }
        pushPt(x, y);
        cx = x;
        cy = y;
        px = x;
        py = y;
        break;
      }
      case "Z": {
        if (cur0 && cur0.length) pushPt(sx, sy);
        cx = sx;
        cy = sy;
        cur0 = null;
        break;
      }
      default:
        i++;
    }
  }
  return subs.filter((s) => s.length > 0);
};

// Parse an SVG document string into { width, height, paths[] }.
// paths is an array of polyline subpaths (each a [{x,y}...]).
Glade.parseSVG = function (p, text) {
  const doc = new DOMParser().parseFromString(text, "image/svg+xml");
  const svg = doc.querySelector("svg");
  if (!svg) return null;
  let W = parseFloat(svg.getAttribute("width")) || 0;
  let H = parseFloat(svg.getAttribute("height")) || 0;
  const vb = svg.getAttribute("viewBox");
  if (vb) {
    const m = vb.split(/[\s,]+/).map(parseFloat);
    if (m.length === 4) {
      if (!W) W = m[2];
      if (!H) H = m[3];
    }
  }
  if (!W || !H) {
    W = 500;
    H = 500;
  }
  const paths = [];
  svg.querySelectorAll("path").forEach((el) => {
    const d = el.getAttribute("d");
    if (!d) return;
    Glade.parsePathD(p, d).forEach((s) => paths.push(s));
  });
  svg.querySelectorAll("line").forEach((el) => {
    paths.push([
      {
        x: parseFloat(el.getAttribute("x1")),
        y: parseFloat(el.getAttribute("y1")),
      },
      {
        x: parseFloat(el.getAttribute("x2")),
        y: parseFloat(el.getAttribute("y2")),
      },
    ]);
  });
  svg.querySelectorAll("polyline, polygon").forEach((el) => {
    const raw = (el.getAttribute("points") || "")
      .trim()
      .split(/[\s,]+/)
      .map(parseFloat);
    const arr = [];
    for (let i = 0; i + 1 < raw.length; i += 2)
      arr.push({ x: raw[i], y: raw[i + 1] });
    if (el.tagName.toLowerCase() === "polygon" && arr.length) arr.push(arr[0]);
    if (arr.length) paths.push(arr);
  });
  return { width: W, height: H, paths };
};
