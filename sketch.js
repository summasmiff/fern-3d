// SVG parsing and SVG record/export live in lib/svg-parse.js and lib/svg-record.js.
new p5((p) => {
  const PHI = 1.61803398875;
  const FROND_FILES = [
    "fronds/simple-fern.svg",
    "fronds/fern-6.svg",
    "fronds/fern-7.svg",
    "fronds/cinnamon-fern.svg",
  ];

  // ---- state ----
  let fernFilenames = [];        // [{name, svg:{width,height,paths}}]
  let fernFilenameIndex = 0;
  let fernSVG = null;
  let fernFilename = "";
  let svgWidth = 0, svgHeight = 0;
  let recordSVG = false, savePreview = false, needsRebuild = true;
  let frondBendRadius = 600, spiralAngleDeg = 70;
  let frondNum = 11, maxFernDistance = 500, maxRingAngle = 360;
  let hudDiv = null;
  let frondGeom = null;
  let bentSubsCache = null;

  function selectFernByIndex(index) {
    if (fernFilenames.length === 0) return;
    fernFilenameIndex = ((index % fernFilenames.length) + fernFilenames.length) % fernFilenames.length;
    const nxt = fernFilenames[fernFilenameIndex];
    fernSVG = nxt.svg;
    fernFilename = nxt.name.slice(0, nxt.name.length - 4);
    svgWidth = fernSVG.width;
    svgHeight = fernSVG.height;
    needsRebuild = true;
  }

  function selectRandomFern() {
    if (fernFilenames.length === 0) return;
    selectFernByIndex(p.floor(p.random(fernFilenames.length)));
  }

  async function loadFrondFolder() {
    for (const url of FROND_FILES) {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("HTTP " + response.status);
        const text = await response.text();
        const svg = Glade.parseSVG(p, text);
        if (!svg) {
          console.warn("parse failed:", url);
          continue;
        }
        const name = url.split("/").pop();
        fernFilenames.push({ name, svg });
      } catch (e) {
        console.warn("fetch failed:", url, e.message);
      }
    }
    const loaded = fernFilenames.length;
    if (loaded > 0) selectFernByIndex(0);
    updateHUD();
    console.log(`Loaded ${loaded} fronds from ./fronds`);
  }

  function randomizeState() {
    frondBendRadius = p.random(500, 700);
    spiralAngleDeg = p.random(50, 90);
    maxFernDistance = p.random(300, 700);
    frondNum = p.floor(p.random(3, 16));
    maxRingAngle = p.floor(p.random(30, 1080));
    selectRandomFern();
    needsRebuild = true;
    updateHUD();
  }

  // ---- bend geometry into the spiral frond shape ----
  function buildBentFrond() {
    const subpaths = [];
    const gapThreshold = 200.0;
    for (const pathPts of fernSVG.paths) {
      if (!pathPts || pathPts.length === 0) continue;
      let prevBent = null;
      let cur = [];
      subpaths.push(cur);
      for (const v of pathPts) {
        const flippedY = svgHeight - v.y;
        const normalizedY = p.constrain(flippedY / svgHeight, 0.0, 1.0);
        const theta = normalizedY * p.radians(spiralAngleDeg);
        const centeredX = v.x - svgWidth / 2;
        const xFlare = 0.1;
        const r = frondBendRadius * p.pow(PHI, -theta / p.HALF_PI);
        const bentX = centeredX * (1 + xFlare * normalizedY);
        const bentY = r * p.sin(theta);
        const bentZ = frondBendRadius - r * p.cos(theta);
        if (
          prevBent &&
          p.dist(prevBent.x, prevBent.y, prevBent.z, bentX, bentY, bentZ) >
            gapThreshold
        ) {
          if (cur.length) {
            cur = [];
            subpaths.push(cur);
          }
        }
        cur.push({ x: bentX, y: bentY, z: bentZ });
        prevBent = { x: bentX, y: bentY, z: bentZ };
      }
    }
    return subpaths.filter((s) => s.length > 1);
  }

  function rebuildFrondCache() {
    if (!fernSVG) return;
    bentSubsCache = buildBentFrond();
    frondGeom = p.buildGeometry(() => {
      p.noFill();
      p.stroke(0);
      for (const sub of bentSubsCache) {
        if (sub.length < 2) continue;
        p.beginShape();
        for (const v of sub) p.vertex(v.x, v.y, v.z);
        p.endShape();
      }
    });
    console.log(
      `Rebuilt geom -> R:${p.nf(frondBendRadius, 0, 1)} S:${p.nf(spiralAngleDeg, 0, 1)} N:${frondNum}`,
    );
  }

  // ---- HUD ----
  function updateHUD() {
    if (!hudDiv) return;
    const t = hudDiv.querySelector("#hud-text");
    if (!t) return;
    t.textContent = `--- FERN CONTROLS ---
  [Q / A] Bend Radius: ${p.nf(frondBendRadius, 0, 1)}
  [W / S] Spiral Angle: ${p.nf(spiralAngleDeg, 0, 1)}
  [E / D] Frond Count:  ${frondNum}
  [T / G] Max Distance: ${p.nf(maxFernDistance, 0, 1)}
  [<- / ->] Ring Angle: ${p.nf(maxRingAngle, 0, 1)}
  [SPACE] Randomize All
  [F] Fern: ${fernFilename}
  [R] Record SVG
  [P] Save preview PNG`;
  }

  // ---- file input (drag/drop or pick a .svg) ----
  function handleFile(file) {
    const name = file.name || "";
    if (!name.toLowerCase().endsWith(".svg")) return;
    const native = file.file || file;
    const reader = new FileReader();
    reader.onload = (e) => {
      const svg = Glade.parseSVG(p, e.target.result);
      if (!svg) {
        console.log("Could not parse", name);
        return;
      }
      fernFilenames.push({ name, svg });
      selectFernByIndex(fernFilenames.length - 1);
      updateHUD();
      console.log("Loaded fern:", fernFilename);
    };
    reader.readAsText(native);
  }

  function generateFilename() {
    const d = new Date(),
      q = (n) => String(n).padStart(2, "0");
    return `glade-${q(d.getMonth() + 1)}-${q(d.getDate())}-${q(d.getHours())}-${q(d.getMinutes())}-${q(d.getSeconds())}.svg`;
  };

  p.setup = function () {
    p.createCanvas(800, 800, p.WEBGL);
    p.pixelDensity(1);
    hudDiv = document.getElementById("hud");
    const hudText = document.createElement("pre");
    hudText.id = "hud-text";
    hudText.style.fontFamily = "monospace";
    hudText.style.fontSize = "12px";
    hudText.style.margin = "0";
    hudDiv.appendChild(hudText);

    const fi = p.createFileInput(handleFile);
    fi.parent("file-btn");

    frondBendRadius = 600;
    spiralAngleDeg = 70;
    maxFernDistance = 500;
    frondNum = 11;
    maxRingAngle = 360;
    loadFrondFolder();
    updateHUD();
  };

  // TODO: Refactor following the Single Responsibility Principle
  p.draw = function () {
    if (needsRebuild) {
      rebuildFrondCache();
      needsRebuild = false;
    }
    if (!frondGeom) return;
    const rec = recordSVG;
    let recSession = null;
    if (rec) recSession = Glade.beginSVGRecord(p);
    p.background(255);
    p.noFill();
    p.stroke(0);
    p.strokeWeight(1);
    p.push();
    p.translate(0, p.height * 0.2, -300);
    p.rotateX(p.map(p.mouseY, 0, p.height, -p.PI, p.PI));
    p.rotateY(p.map(p.mouseX, 0, p.width, -p.PI, p.PI));
    p.scale(0.5);
    p.randomSeed(1234);
    const rR = [], rZ = [];
    for (let i = 0; i < frondNum; i++) {
      rR.push(p.random(p.radians(30)));
      rZ.push(p.random(maxFernDistance));
    }
    for (let i = 0; i < frondNum; i++) {
      const ringAngle = p.map(i, 0, frondNum, 0, p.radians(maxRingAngle));
      p.push();
      p.rotateY(ringAngle);
      p.rotateX(rR[i]);
      p.translate(0, 0, rZ[i]);
      let mvArr = null, pjArr = null;
      if (rec) {
        mvArr = p._renderer.uMVMatrix.mat4.slice();
        pjArr = p._renderer.uPMatrix.mat4.slice();
      }
      p.model(frondGeom);
      p.pop();
      if (rec) Glade.recordFrond(p, mvArr, pjArr, bentSubsCache, recSession);
    }
    p.pop();
    if (rec) {
      Glade.endSVGRecord(p, recSession, generateFilename());
      recordSVG = false;
      console.log("yay SVG exported!");
    }
    if (savePreview) {
      p.saveCanvas("preview", "png");
      savePreview = false;
      console.log("Saved preview.png");
    }
  };

  p.keyPressed = function () {
    let changed = false;
    const k = typeof p.key === "string" ? p.key.toLowerCase() : "";
    if (k === "r") recordSVG = true;
    else if (k === "p") savePreview = true;
    else if (k === "f") {
      if (fernFilenames.length > 0) {
        selectFernByIndex(fernFilenameIndex + 1);
        console.log("Loaded fern:", fernFilename);
      }
    } else if (p.key === " ") {
      randomizeState();
      changed = true;
    } else if (k === "q") { frondBendRadius += 20; changed = true; }
    else if (k === "a") { frondBendRadius -= 20; changed = true; }
    else if (k === "w") { spiralAngleDeg += 5; changed = true; }
    else if (k === "s") { spiralAngleDeg -= 5; changed = true; }
    else if (k === "e") { frondNum++; changed = true; }
    else if (k === "d") { frondNum = p.max(1, frondNum - 1); changed = true; }
    else if (k === "t") { maxFernDistance += 20; changed = true; }
    else if (k === "g") { maxFernDistance -= 20; changed = true; }
    if (p.keyCode === p.LEFT_ARROW) { maxRingAngle += 20; changed = true; }
    else if (p.keyCode === p.RIGHT_ARROW) { maxRingAngle -= 20; changed = true; }
    if (changed) needsRebuild = true;
    updateHUD();
  };
});
