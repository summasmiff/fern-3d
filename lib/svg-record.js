// p.saveCanvas exports the WEBGL canvas as a raster (PNG/JPG). It cannot export
// the underlying vector geometry. The projection here multiplies bent 3D verts by
// p5's own uMVMatrix / uPMatrix (read from p._renderer) so the recorded SVG matches
// the on-screen render exactly.

// p5 also has no built-in SVG path writer
window.Glade = window.Glade || {};

// Begin a recording session: w/h come from the current canvas.
Glade.beginSVGRecord = function (p) {
  return { w: p.width, h: p.height, paths: [] };
};

// Project one 3D vertex through model-view + projection matrices to 2D canvas space.
// Returns null if the vertex is behind the camera (w <= 0).
Glade.projectVertex = function (p, m, pj, v) {
  const ex = m[0] * v.x + m[4] * v.y + m[8] * v.z + m[12];
  const ey = m[1] * v.x + m[5] * v.y + m[9] * v.z + m[13];
  const ez = m[2] * v.x + m[6] * v.y + m[10] * v.z + m[14];
  const ew = m[3] * v.x + m[7] * v.y + m[11] * v.z + m[15];
  const cx = pj[0] * ex + pj[4] * ey + pj[8] * ez + pj[12] * ew;
  const cy = pj[1] * ex + pj[5] * ey + pj[9] * ez + pj[13] * ew;
  const cw = pj[3] * ex + pj[7] * ey + pj[11] * ez + pj[15] * ew;
  if (cw <= 0) return null;
  const nx = cx / cw,
    ny = cy / cw;
  return { x: (nx * 0.5 + 0.5) * p.width, y: (0.5 - ny * 0.5) * p.height };
};

// Append projected subpaths to the recording session as SVG path strings.
Glade.recordFrond = function (p, mvArr, pjArr, subs, rec) {
  for (const sub of subs) {
    if (sub.length < 2) continue;
    let d = "",
      started = false;
    for (const v of sub) {
      const s = Glade.projectVertex(p, mvArr, pjArr, v);
      if (!s) {
        if (started) {
          rec.paths.push(d.trim());
          d = "";
          started = false;
        }
        continue;
      }
      d +=
        (started ? "L" : "M") + s.x.toFixed(2) + " " + s.y.toFixed(2) + " ";
      started = true;
    }
    if (started) rec.paths.push(d.trim());
  }
};

// Export the recording session as a downloadable SVG file and free the session.
Glade.endSVGRecord = function (p, rec, filename) {
  const body = rec.paths
    .map(
      (d) => `  <path d="${d}" fill="none" stroke="black" stroke-width="1"/>`,
    )
    .join("\n");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${rec.w}" height="${rec.h}" viewBox="0 0 ${rec.w} ${rec.h}">\n${body}\n</svg>`;
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

// TODO: move to sketch.js

