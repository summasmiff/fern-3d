new p5((p) => {
  const PHI = 1.61803398875;
  const FROND_FILES = [
    'fronds/simple-fern.svg',
    'fronds/fern-6.svg',
    'fronds/fern-7.svg',
    'fronds/cinnamon-fern.svg',
  ];
  let fernFilename = 'procedural-fern';
  let fernFilenames = [];          // [{name, svg:{width,height,paths}}]
  let fernFilenameIndex = 0;
  let fernSVG = null;
  let svgWidth = 0, svgHeight = 0;
  let recordSVG = false, savePreview = false, needsRebuild = true;
  let frondBendRadius = 600, spiralAngleDeg = 70;
  let frondNum = 11, maxFernDistance = 500, maxRingAngle = 360;
  let hudDiv = null, svgRec = null;

  async function loadFrondFolder(){
    for (const url of FROND_FILES){
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error('HTTP '+res.status);
        const text = await res.text();
        const svg = parseSVG(text);
        if (!svg){ console.warn('parse failed:', url); continue; }
        const name = url.split('/').pop();
        fernFilenames.push({ name, svg });
      } catch(e){ console.warn('fetch failed:', url, e.message); }
    }
const loaded = fernFilenames.length;
    if (loaded > 0){
      fernFilenameIndex = 0;
      const nxt = fernFilenames[fernFilenameIndex];
      fernSVG = nxt.svg;
      fernFilename = nxt.name.slice(0, nxt.name.length-4);
      svgWidth = fernSVG.width; svgHeight = fernSVG.height;
      needsRebuild = true;
    }
    updateHUD();
    console.log(`Loaded ${loaded} fronds from ./fronds`);
  }

  function generateFilename(){
    const d = new Date(), q = n => String(n).padStart(2,'0');
    return `fern-3d-${d.getFullYear()}${q(d.getMonth()+1)}${q(d.getDate())}-${q(d.getHours())}${q(d.getMinutes())}${q(d.getSeconds())}.svg`;
  }

  function randomizeState(){
    frondBendRadius   = p.random(500, 700);
    spiralAngleDeg    = p.random(50, 90);
    maxFernDistance   = p.random(300, 700);
    frondNum          = p.floor(p.random(3, 16));
    maxRingAngle      = p.floor(p.random(30, 1080));
    if (fernFilenames.length > 0){
      fernFilenameIndex = p.floor(p.random(fernFilenames.length));
      const nxt = fernFilenames[fernFilenameIndex];
      fernSVG    = nxt.svg;
      fernFilename = nxt.name.slice(0, nxt.name.length-4);
      svgWidth   = fernSVG.width;
      svgHeight  = fernSVG.height;
    }
    updateHUD();
  }

  // ---- SVG parsing ----
  function parseSVG(text){
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
    const svg = doc.querySelector('svg');
    if (!svg) return null;
    let W = parseFloat(svg.getAttribute('width'))||0;
    let H = parseFloat(svg.getAttribute('height'))||0;
    const vb = svg.getAttribute('viewBox');
    if (vb){ const m = vb.split(/[\s,]+/).map(parseFloat);
      if (m.length===4){ if(!W) W=m[2]; if(!H) H=m[3]; } }
    if (!W || !H){ W = 500; H = 500; }
    const paths = [];
    svg.querySelectorAll('path').forEach(el=>{
      const d = el.getAttribute('d'); if (!d) return;
      parsePathD(d).forEach(s => paths.push(s));
    });
    svg.querySelectorAll('line').forEach(el=>{
      paths.push([
        {x:parseFloat(el.getAttribute('x1')),y:parseFloat(el.getAttribute('y1'))},
        {x:parseFloat(el.getAttribute('x2')),y:parseFloat(el.getAttribute('y2'))}
      ]);
    });
    svg.querySelectorAll('polyline, polygon').forEach(el=>{
      const raw=(el.getAttribute('points')||'').trim().split(/[\s,]+/).map(parseFloat);
      const arr=[]; for (let i=0;i+1<raw.length;i+=2) arr.push({x:raw[i],y:raw[i+1]});
      if (el.tagName.toLowerCase()==='polygon' && arr.length) arr.push(arr[0]);
      if (arr.length) paths.push(arr);
    });
    return { width:W, height:H, paths };
  }

  function cubicPts(p0,p1,p2,p3,n){
    const o=[];
    for(let i=0;i<=n;i++){
      const t=i/n;
      o.push({ x: p.bezierPoint(p0.x,p1.x,p2.x,p3.x,t),
               y: p.bezierPoint(p0.y,p1.y,p2.y,p3.y,t) });
    }
    return o;
  }
  function quadPts(p0,p1,p2,n){
    const c1={ x: p0.x + (2/3)*(p1.x-p0.x), y: p0.y + (2/3)*(p1.y-p0.y) };
    const c2={ x: p2.x + (2/3)*(p1.x-p2.x), y: p2.y + (2/3)*(p1.y-p2.y) };
    return cubicPts(p0,c1,c2,p2,n);
  }
  function parsePathD(d){
    const toks = d.match(/([MmLlHhVvCcSsQqTtAaZz])|(-?\d*\.?\d+(?:[eE][+-]?\d+)?)/g);
    if (!toks) return [];
    let i=0, cx=0,cy=0, sx=0,sy=0, cmd=null, px=0,py=0;
    const subs=[], cur=null; let cur0=null;
    const newSub=()=>{cur0=[]; subs.push(cur0);};
    const pushPt=(x,y)=>{ if(!cur0) newSub(); cur0.push({x,y}); };
    const num=()=>parseFloat(toks[i++]);
    while (i<toks.length){
      const t=toks[i];
      if (/^[MmLlHhVvCcSsQqTtAaZz]$/.test(t)){ cmd=t; i++; }
      const rel = cmd===cmd.toLowerCase();
      const C = cmd.toUpperCase();
      switch(C){
        case 'M':{ let x=num(),y=num(); if(rel){x+=cx;y+=cy;}
          sx=x;sy=y; newSub(); pushPt(x,y); cx=x;cy=y; cmd=rel?'l':'L'; px=x;py=y; break; }
        case 'L':{ let x=num(),y=num(); if(rel){x+=cx;y+=cy;}
          pushPt(x,y); cx=x;cy=y; px=x;py=y; break; }
        case 'H':{ let x=num(); if(rel) x+=cx; pushPt(x,cy); cx=x; px=x;py=cy; break; }
        case 'V':{ let y=num(); if(rel) y+=cy; pushPt(cx,y); cy=y; px=cx;py=y; break; }
        case 'C':{ let x1=num(),y1=num(),x2=num(),y2=num(),x=num(),y=num();
          if(rel){x1+=cx;y1+=cy;x2+=cx;y2+=cy;x+=cx;y+=cy;}
          const pts=cubicPts({x:cx,y:cy},{x:x1,y:y1},{x:x2,y:y2},{x,y},16);
          for(let k=1;k<pts.length;k++) pushPt(pts[k].x,pts[k].y);
          px=x2;py=y2; cx=x;cy=y; break; }
        case 'S':{ let x2=num(),y2=num(),x=num(),y=num();
          if(rel){x2+=cx;y2+=cy;x+=cx;y+=cy;}
          const x1=2*cx-px, y1=2*cy-py;
          const pts=cubicPts({x:cx,y:cy},{x:x1,y:y1},{x:x2,y:y2},{x,y},16);
          for(let k=1;k<pts.length;k++) pushPt(pts[k].x,pts[k].y);
          px=x2;py=y2; cx=x;cy=y; break; }
        case 'Q':{ let x1=num(),y1=num(),x=num(),y=num();
          if(rel){x1+=cx;y1+=cy;x+=cx;y+=cy;}
          const pts=quadPts({x:cx,y:cy},{x:x1,y:y1},{x,y},12);
          for(let k=1;k<pts.length;k++) pushPt(pts[k].x,pts[k].y);
          px=x1;py=y1; cx=x;cy=y; break; }
        case 'T':{ let x=num(),y=num(); if(rel){x+=cx;y+=cy;}
          const x1=2*cx-px, y1=2*cy-py;
          const pts=quadPts({x:cx,y:cy},{x:x1,y:y1},{x,y},12);
          for(let k=1;k<pts.length;k++) pushPt(pts[k].x,pts[k].y);
          px=x1;py=y1; cx=x;cy=y; break; }
        case 'A':{ num();num();num();num();num(); let x=num(),y=num();
          if(rel){x+=cx;y+=cy;} pushPt(x,y); cx=x;cy=y; px=x;py=y; break; }
        case 'Z':{ if(cur0&&cur0.length) pushPt(sx,sy); cx=sx;cy=sy; cur0=null; break; }
        default: i++;
      }
    }
    return subs.filter(s=>s.length>0);
  }

  // ---- bend geometry into the spiral frond shape ----
  function buildBentFrond(){
    const subpaths=[]; const gapThreshold=200.0;
    for (const pathPts of fernSVG.paths){
      if (!pathPts || pathPts.length===0) continue;
      let prevBent=null; let cur=[]; subpaths.push(cur);
      for (const v of pathPts){
        const flippedY = svgHeight - v.y;
        const normalizedY = p.constrain(flippedY/svgHeight, 0.0, 1.0);
        const theta = normalizedY * p.radians(spiralAngleDeg);
        const centeredX = v.x - (svgWidth/2);
        const xFlare = 0.10;
        const r = frondBendRadius * p.pow(PHI, -theta/p.HALF_PI);
        const bentX = centeredX * (1 + xFlare*normalizedY);
        const bentY = r * p.sin(theta);
        const bentZ = frondBendRadius - r*p.cos(theta);
        if (prevBent && p.dist(prevBent.x,prevBent.y,prevBent.z,bentX,bentY,bentZ) > gapThreshold){
          if (cur.length){ cur=[]; subpaths.push(cur); }
        }
        cur.push({x:bentX,y:bentY,z:bentZ});
        prevBent={x:bentX,y:bentY,z:bentZ};
      }
    }
    return subpaths.filter(s=>s.length>1);
  }
  let frondGeom = null;
  let bentSubsCache = null;   // raw subpaths, for SVG export

  function rebuildFrondCache(){
    if (!fernSVG) return;
    bentSubsCache = buildBentFrond();
    frondGeom = p.buildGeometry(() => {
      p.noFill(); p.stroke(0);
      for (const sub of bentSubsCache){
        if (sub.length < 2) continue;
        p.beginShape();
        for (const v of sub) p.vertex(v.x, v.y, v.z);
        p.endShape();
      }
    });
    console.log(`Rebuilt geom -> R:${p.nf(frondBendRadius,0,1)} S:${p.nf(spiralAngleDeg,0,1)} N:${frondNum}`);
  }
  // ---- SVG record: project via p5's own WEBGL matrices ----
  function beginSVGRecord(){ svgRec={w:p.width,h:p.height,paths:[]}; }
  function projectVertex(m, pj, v){
    const ex=m[0]*v.x+m[4]*v.y+m[8]*v.z+m[12];
    const ey=m[1]*v.x+m[5]*v.y+m[9]*v.z+m[13];
    const ez=m[2]*v.x+m[6]*v.y+m[10]*v.z+m[14];
    const ew=m[3]*v.x+m[7]*v.y+m[11]*v.z+m[15];
    const cx=pj[0]*ex+pj[4]*ey+pj[8]*ez+pj[12]*ew;
    const cy=pj[1]*ex+pj[5]*ey+pj[9]*ez+pj[13]*ew;
    const cw=pj[3]*ex+pj[7]*ey+pj[11]*ez+pj[15]*ew;
    if (cw<=0) return null;
    const nx=cx/cw, ny=cy/cw;
    return { x:(nx*0.5+0.5)*p.width, y:(0.5-ny*0.5)*p.height };
  }
  function recordFrond(mvArr, pjArr, subs){
    for (const sub of subs){
      if (sub.length<2) continue;
      let d='', started=false;
      for (const v of sub){
        const s=projectVertex(mvArr,pjArr,v);
        if (!s){ if(started){svgRec.paths.push(d.trim()); d=''; started=false;} continue; }
        d += (started?'L':'M') + s.x.toFixed(2) + ' ' + s.y.toFixed(2) + ' ';
        started=true;
      }
      if (started) svgRec.paths.push(d.trim());
    }
  }
  function endSVGRecord(){
    const body = svgRec.paths.map(d=>`  <path d="${d}" fill="none" stroke="black" stroke-width="1"/>`).join('\n');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgRec.w}" height="${svgRec.h}" viewBox="0 0 ${svgRec.w} ${svgRec.h}">\n${body}\n</svg>`;
    const blob = new Blob([svg], {type:'image/svg+xml'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = generateFilename();
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    svgRec = null;
  }

  function updateHUD(){
    if (!hudDiv) return;
    const t = hudDiv.querySelector('#hud-text');
    if (!t) return;
    t.textContent =
  `--- FERN CONTROLS ---
  [Q / A] Bend Radius: ${p.nf(frondBendRadius,0,1)}
  [W / S] Spiral Angle: ${p.nf(spiralAngleDeg,0,1)}
  [E / D] Frond Count:  ${frondNum}
  [T / G] Max Distance: ${p.nf(maxFernDistance,0,1)}
  [<- / ->] Max Ring Angle: ${p.nf(maxRingAngle,0,1)}
  [SPACE] Randomize All
  [F] Fern: ${fernFilename}
  [R] Record SVG
  [P] Save preview PNG`;
  }

  function handleFile(file){
    const name = file.name || '';
    if (!name.toLowerCase().endsWith('.svg')) return;
    const native = file.file || file;
    const reader = new FileReader();
    reader.onload = e => {
      const svg = parseSVG(e.target.result);
      if (!svg){ console.log('Could not parse', name); return; }
      fernFilenames.push({name, svg});
      fernFilenameIndex = fernFilenames.length-1;
      fernSVG = svg;
      fernFilename = name.slice(0, name.length-4);
      svgWidth = svg.width; svgHeight = svg.height;
      needsRebuild = true;
      updateHUD();
      console.log('Loaded fern:', fernFilename);
    };
    reader.readAsText(native);
  }

p.setup = function(){
  p.createCanvas(800,800,p.WEBGL);
  p.pixelDensity(1);
  hudDiv = document.getElementById('hud');
  const hudText = document.createElement('pre');
  hudText.id = 'hud-text';
  hudText.style.fontFamily = 'monospace';
  hudText.style.fontSize   = '12px';
  hudText.style.margin     = '0';
  hudDiv.appendChild(hudText);

  const fi = p.createFileInput(handleFile);
  fi.parent('file-btn');

  frondBendRadius = 600;
  spiralAngleDeg  = 70;
  maxFernDistance = 500;
  frondNum        = 11;
  maxRingAngle    = 360;
  loadFrondFolder();
  updateHUD();
};

p.draw = function(){
  if (needsRebuild){ rebuildFrondCache(); needsRebuild=false; }
  if (!frondGeom) return;
  const rec = recordSVG;
  if (rec) beginSVGRecord();
  p.background(255);
  p.noFill(); p.stroke(0); p.strokeWeight(1);
  p.push();
  p.translate(0, p.height*0.2, -300);
  p.rotateX(p.map(p.mouseY,0,p.height,-p.PI,p.PI));
  p.rotateY(p.map(p.mouseX,0,p.width,-p.PI,p.PI));
  p.scale(0.5);
  p.randomSeed(1234);
  const rR=[], rZ=[];
  for (let i=0;i<frondNum;i++){ rR.push(p.random(p.radians(30))); rZ.push(p.random(maxFernDistance)); }
  for (let i=0;i<frondNum;i++){
    const ringAngle = p.map(i,0,frondNum,0,p.radians(maxRingAngle));
    p.push();
    p.rotateY(ringAngle);
    p.rotateX(rR[i]);
    p.translate(0,0,rZ[i]);
    let mvArr=null, pjArr=null;
    if (rec){
      mvArr = p._renderer.uMVMatrix.mat4.slice();
      pjArr = p._renderer.uPMatrix.mat4.slice();
    }
    p.model(frondGeom);
    p.pop();
    if (rec) recordFrond(mvArr, pjArr, bentSubsCache);
  }
  p.pop();
  if (rec){ endSVGRecord(); recordSVG=false; console.log('yay SVG exported!'); }
  if (savePreview){ p.saveCanvas('preview','png'); savePreview=false; console.log('Saved preview.png'); }
};

  p.keyPressed = function(){
    let changed=false;
    const k = (typeof p.key==='string') ? p.key.toLowerCase() : '';
    if (k==='r') recordSVG=true;
    else if (k==='p') savePreview=true;
    else if (k==='f'){
      if (fernFilenames.length>0){
        fernFilenameIndex=(fernFilenameIndex+1)%fernFilenames.length;
        const nxt=fernFilenames[fernFilenameIndex];
        fernSVG=nxt.svg; fernFilename=nxt.name.slice(0,nxt.name.length-4);
        svgWidth=fernSVG.width; svgHeight=fernSVG.height;
        needsRebuild=true; console.log('Loaded fern:', fernFilename);
      }
    }
    else if (p.key===' '){ randomizeState(); changed=true; }
    else if (k==='q'){ frondBendRadius+=20; changed=true; }
    else if (k==='a'){ frondBendRadius-=20; changed=true; }
    else if (k==='w'){ spiralAngleDeg+=5; changed=true; }
    else if (k==='s'){ spiralAngleDeg-=5; changed=true; }
    else if (k==='e'){ frondNum++; changed=true; }
    else if (k==='d'){ frondNum=p.max(1,frondNum-1); changed=true; }
    else if (k==='t'){ maxFernDistance+=20; changed=true; }
    else if (k==='g'){ maxFernDistance-=20; changed=true; }
    if (p.keyCode===p.LEFT_ARROW){ maxRingAngle+=20; changed=true; }
    else if (p.keyCode===p.RIGHT_ARROW){ maxRingAngle-=20; changed=true; }
    if (changed) needsRebuild=true;
    updateHUD();
  };
});
