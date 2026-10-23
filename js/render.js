(function(){
const G = window.G, CFG = G.CFG, U = G.U, Uni = G.Universe;

const S = 100;

function mkTint(color, size){
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
  g.addColorStop(0, 'rgba(255,255,255,.95)');
  g.addColorStop(.18, U.rgba(color, .55));
  g.addColorStop(.5, U.rgba(color, .18));
  g.addColorStop(1, U.rgba(color, 0));
  x.fillStyle = g;
  x.fillRect(0,0,size,size);
  return c;
}

const Renderer = {
  canvas:null, ctx:null, w:0, h:0, dpr:1,
  cam:{x:0, y:0, zoom:.9},
  target:{x:0, y:0, zoom:.9},
  anim:null,
  ready:false,
  quality:1,
  time:0,
  chapter:-1,
  bg:null,
  sprites:{},
  sectorGlow:null,
  starsDrawn:0,
  visibleSectors:[],
  lastLit:new Map(),

  clickMarks:new Map(),
  effects:{ripples:[], sparks:[], floats:[], waves:[], dust:[], rings:[], bolts:[]},
  meteors:[],
  hover:null,
  drag:null,
  pointers:new Map(),
  pinch:null,
  scanT:0,
  lastAdd:0,
  minimap:null,
  minimapT:0,
  onTap:null,
  onMove:null,
  initialized:false,

  init(canvas){
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', {alpha:false});
    this.buildSprites();
    this.resize();
    this.bind();
    this.cam.zoom = this.target.zoom = this.fitZoom();
    this.initialized = true;
  },

  fitZoom(){
    const ring = CFG.VISIONS[G.S.data.vision - 1].ring;
    const r = (ring + .55) * S;
    const avail = Math.min(this.w * .5 - 16, this.h * .375 - 152, this.h * .215);
    return Math.max(.08, avail / r);
  },

  buildSprites(){
    const mk = (color, core, size, soft) => {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const x = c.getContext('2d');
      const g = x.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
      g.addColorStop(0, core);
      g.addColorStop(.12, color);
      g.addColorStop(.34, U.rgba(color, soft == null ? .34 : soft));
      g.addColorStop(1, U.rgba(color, 0));
      x.fillStyle = g;
      x.fillRect(0,0,size,size);
      return c;
    };
    CFG.STAR_TYPES.forEach(t=>{
      this.sprites[t.id] = mk(t.color, t.core, 64, t.id === 'black' ? .5 : .3);
    });
    this.sprites.dead = mk('#d9364a', '#4a0a12', 64, .45);
    this.sectorGlow = mk('#5fb4ff', '#ffffff', 128, .34);
    this.sunSprite = mk('#ffd36b', '#ffffff', 128, .42);
    this.ringSprite = mk('#ffd36b', '#fff4cf', 128, .2);
  },

  resize(){
    if(!this.canvas) return;
    const app = document.getElementById('app');
    this.w = app.clientWidth;
    this.h = app.clientHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.floor(this.w * this.dpr);
    this.canvas.height = Math.floor(this.h * this.dpr);
    this.canvas.style.width = this.w + 'px';
    this.canvas.style.height = this.h + 'px';
    this.buildBackground();
    if(this.initialized){
      this.cam.zoom = this.target.zoom = Math.min(this.cam.zoom, this.fitZoom() * 1.4);
    }
    this.cx = this.w/2;
    this.cy = this.h*0.375;
    this.minimap = document.getElementById('minimap-canvas');
  },

  buildBackground(){
    const w = Math.max(2, this.w), h = Math.max(2, this.h);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d');
    const ci = G.Econ ? G.Econ.chapterIndex() : 0;
    this.chapter = ci;
    const ch = CFG.CHAPTERS[ci];
    this.sectorGlow = mkTint(ch.tint, 128);
    this.sectorGlowRed = mkTint('#d9364a', 128);
    const g = x.createLinearGradient(0, 0, w*.3, h);
    g.addColorStop(0, ch.bg);
    g.addColorStop(.55, '#060a18');
    g.addColorStop(1, '#02030a');
    x.fillStyle = g; x.fillRect(0,0,w,h);

    const rng = U.mulberry32(1337 + ci * 97);
    const blobs = 7 + ci;
    for(let i=0;i<blobs;i++){
      const bx = rng()*w, by = rng()*h, br = (0.25 + rng()*.6) * Math.max(w,h);
      const col = ch.neb[i % ch.neb.length];
      const gr = x.createRadialGradient(bx, by, 0, bx, by, br);
      gr.addColorStop(0, U.rgba(col, .16 + rng()*.12));
      gr.addColorStop(.45, U.rgba(col, .05));
      gr.addColorStop(1, U.rgba(col, 0));
      x.fillStyle = gr;
      x.beginPath(); x.arc(bx, by, br, 0, Math.PI*2); x.fill();
    }

    if(ci >= 1){
      x.save();
      x.translate(w/2, h*.48);
      x.rotate(-.38 + ci*.05);
      const band = x.createLinearGradient(0, -h*.34, 0, h*.34);
      band.addColorStop(0, 'rgba(120,160,255,0)');
      band.addColorStop(.42, U.rgba(ch.neb[0], .24));
      band.addColorStop(.5, U.rgba('#dfe9ff', .22));
      band.addColorStop(.58, U.rgba(ch.neb[1], .24));
      band.addColorStop(1, 'rgba(120,160,255,0)');
      x.fillStyle = band;
      x.fillRect(-w, -h*.34, w*2, h*.68);
      for(let i=0;i<260;i++){
        const bx = (rng()-.5)*w*1.6, by = (rng()-.5)*h*.55;
        const a = .18 * (1 - Math.abs(by)/(h*.3)) * (0.4+rng());
        if(a <= 0) continue;
        x.fillStyle = 'rgba(230,240,255,' + a.toFixed(3) + ')';
        x.fillRect(bx, by, .8+rng()*1.4, .8+rng()*1.4);
      }
      x.restore();
    }

    const rng2 = U.mulberry32(4242 + ci*13);
    for(let i=0;i<900;i++){
      const bx = rng2()*w, by = rng2()*h;
      const a = .04 + Math.pow(rng2(), 2.4) * .5;
      const sz = rng2() < .96 ? .8 : 1.6;
      x.fillStyle = 'rgba(215,230,255,' + a.toFixed(3) + ')';
      x.fillRect(bx, by, sz, sz);
    }

    const vg = x.createRadialGradient(w*.5, h*.42, Math.min(w,h)*.12, w*.5, h*.5, Math.max(w,h)*.78);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,.55)');
    x.fillStyle = vg; x.fillRect(0,0,w,h);
    this.bg = c;
  },

  screen(wx, wy){
    return {x:(wx - this.cam.x) * this.cam.zoom + this.cx,
            y:(wy - this.cam.y) * this.cam.zoom + this.cy};
  },
  world(sx, sy){
    return {x:(sx - this.cx) / this.cam.zoom + this.cam.x,
            y:(sy - this.cy) / this.cam.zoom + this.cam.y};
  },

  visionRadius(){ return (CFG.VISIONS[G.S.data.vision - 1].ring + .55) * S; },
  layerInfo(){
    const l = Uni.layerOf(this.cam.zoom);
    return {layer:l, unit:Uni.layerUnitLabel(l)};
  },

  flyTo(x, y, zoom, dur){
    this.target.x = x; this.target.y = y; this.target.zoom = zoom;
    this.anim = {x0:this.cam.x, y0:this.cam.y, z0:this.cam.zoom,
                 x1:x, y1:y, z1:zoom, t0:U.now(), dur:dur||900};
  },
  followVision(dur){
    this.flyTo(0, 0, this.fitZoom(), dur || 1100);
  },

  clampCam(){
    const lim = (Uni.maxR - 2) * S;
    this.cam.x = U.clamp(this.cam.x, -lim, lim);
    this.cam.y = U.clamp(this.cam.y, -lim, lim);
    this.cam.zoom = U.clamp(this.cam.zoom, .085, 5.5);
  },

  tickCamera(dt){
    if(this.anim){
      const a = this.anim;
      const t = U.clamp((U.now() - a.t0) / a.dur, 0, 1);
      const e = U.easeInOutCubic(t);
      this.cam.x = U.lerp(a.x0, a.x1, e);
      this.cam.y = U.lerp(a.y0, a.y1, e);
      this.cam.zoom = Math.exp(U.lerp(Math.log(a.z0), Math.log(a.z1), e));
      if(t >= 1) this.anim = null;
      return;
    }
    if(!this.drag && !this.pinch){
      const k = 1 - Math.exp(-dt * 9);
      this.cam.x = U.lerp(this.cam.x, this.target.x, k);
      this.cam.y = U.lerp(this.cam.y, this.target.y, k);
      this.cam.zoom = Math.exp(U.lerp(Math.log(this.cam.zoom), Math.log(this.target.zoom), k));
    }
    this.clampCam();
  },

  bind(){
    const cv = this.canvas;
    const pos = (e)=>{
      const r = cv.getBoundingClientRect();
      return {x:e.clientX - r.left, y:e.clientY - r.top};
    };
    cv.addEventListener('pointerdown', (e)=>{
      if(e.button !== undefined && e.button !== 0) return;
      cv.setPointerCapture(e.pointerId);
      const p = pos(e);
      this.pointers.set(e.pointerId, p);
      G.Audio.resume();
      if(this.pointers.size === 1){
        this.drag = {sx:p.x, sy:p.y, cx:p.x, cy:p.y, moved:0, t:U.now(), camx:this.cam.x, camy:this.cam.y};
        this.target.x = this.cam.x; this.target.y = this.cam.y; this.target.zoom = this.cam.zoom;
      } else if(this.pointers.size === 2){
        const pts = [...this.pointers.values()];
        this.pinch = {d:Math.hypot(pts[0].x-pts[1].x, pts[0].y-pts[1].y),
                      z:this.cam.zoom, cx:(pts[0].x+pts[1].x)/2, cy:(pts[0].y+pts[1].y)/2};
        this.drag = null;
      }
    });
    cv.addEventListener('pointermove', (e)=>{
      const p = pos(e);
      this.hover = p;
      if(this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, p);
      if(this.pointers.size === 2 && this.pinch){
        const pts = [...this.pointers.values()];
        const d = Math.hypot(pts[0].x-pts[1].x, pts[0].y-pts[1].y);
        const z = U.clamp(this.pinch.z * (d / Math.max(1, this.pinch.d)), .085, 5.5);
        this.zoomAt((pts[0].x+pts[1].x)/2, (pts[0].y+pts[1].y)/2, z, true);
        return;
      }
      if(this.drag){
        const dx = p.x - this.drag.sx, dy = p.y - this.drag.sy;
        this.drag.moved = Math.max(this.drag.moved, Math.hypot(dx, dy));
        if(this.drag.moved > 7){
          this.cam.x = this.drag.camx - dx / this.cam.zoom;
          this.cam.y = this.drag.camy - dy / this.cam.zoom;
          this.target.x = this.cam.x; this.target.y = this.cam.y;
          this.clampCam();
        }
      }
    });
    const up = (e)=>{
      const p = pos(e);
      this.pointers.delete(e.pointerId);
      if(this.pointers.size < 2) this.pinch = null;
      if(this.drag){
        const d = this.drag;
        this.drag = null;
        if(d.moved < 8 && U.now() - d.t < 420){
          this.handleTap(p.x, p.y);
        }
      }
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', (e)=>{
      this.pointers.delete(e.pointerId);
      this.pinch = null; this.drag = null;
    });
    cv.addEventListener('wheel', (e)=>{
      e.preventDefault();
      const p = pos(e);
      const factor = Math.exp(-e.deltaY * .0016);
      this.zoomAt(p.x, p.y, this.cam.zoom * factor);
    }, {passive:false});
    cv.addEventListener('dblclick', (e)=>{
      const p = pos(e);
      const w = this.world(p.x, p.y);
      this.flyTo(w.x, w.y, U.clamp(this.cam.zoom * 1.9, .085, 5.5), 420);
    });
  },

  zoomAt(sx, sy, zoom, instant){
    zoom = U.clamp(zoom, .085, 5.5);
    const before = this.world(sx, sy);
    this.cam.zoom = zoom;
    this.target.zoom = zoom;
    const after = this.world(sx, sy);
    this.cam.x += before.x - after.x;
    this.cam.y += before.y - after.y;
    this.target.x = this.cam.x;
    this.target.y = this.cam.y;
    this.clampCam();
    this.target.x = this.cam.x; this.target.y = this.cam.y;
  },

  handleTap(sx, sy){
    const wp = this.world(sx, sy);
    const sec = Uni.sectorAtWorld(wp.x, wp.y);
    if(!Uni.isUnlocked(sec.x, sec.y)){ this.addFloat(sx, sy, '视野之外', '#7b8cb0', 11); return; }
    const near = Uni.nearestStar(wp.x, wp.y, 30 / this.cam.zoom);
    if(near){
      this.clickMarks.set(near.sx + ',' + near.sy + ',' + near.i, U.now());
      this.addSpark(this.screen(near.star.wx, near.star.wy), CFG.STAR_TYPES[near.star.type].color, 6);
    }
    if(this.onTap) this.onTap(wp.x, wp.y, sx, sy, near);
  },

  addRipple(sx, sy, color){
    this.effects.ripples.push({x:sx, y:sy, r:2, max:52 + Math.random()*26, life:0, maxLife:.55, color});
  },
  addShock(sx, sy, color, power){
    this.effects.waves.push({x:sx, y:sy, r:6, max:110 * (power||1), life:0, maxLife:.7, color});
  },
  addSpark(s, color, n){
    n = n || 4;
    if(G.S.data.settings.reduceFx) n = Math.max(1, Math.ceil(n*.5));
    for(let i=0;i<n;i++){
      const a = Math.random()*Math.PI*2, sp = 20 + Math.random()*90;
      this.effects.sparks.push({x:s.x, y:s.y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp - 20,
        life:0, maxLife:.45 + Math.random()*.5, color, size:1 + Math.random()*2});
    }
  },
  addFloat(sx, sy, text, color, size){
    if(this.effects.floats.length > 16) this.effects.floats.shift();
    this.effects.floats.push({x:sx + (Math.random()-.5)*10, y:sy, text, color:color||'#eaf2ff', size:size||14,
      life:0, maxLife:1.05, vy:-46 - Math.random()*18});
  },
  addBolt(wx1, wy1, wx2, wy2, delay, typeIdx, head, dead){
    if(this.effects.bolts.length > 46) this.effects.bolts.shift();
    const a = this.screen(wx1, wy1), b = this.screen(wx2, wy2);
    const type = CFG.STAR_TYPES[typeIdx || 0];
    this.effects.bolts.push({x1:a.x, y1:a.y, x2:b.x, y2:b.y, t0:U.now() + (delay||0),
      dur: head ? 380 : 260, color: dead ? '#d9364a' : type.color,
      sprite: dead ? 'dead' : type.id, rippled:false, head:!!head, dead:!!dead});
  },
  addRing(wx, wy, color, max){
    this.effects.rings.push({wx, wy, r:6, max:max||46, life:0, maxLife:.9, color:color||'#ffd36b'});
  },
  addSectorBurst(wx, wy, color){
    const s = this.screen(wx, wy);
    if(s.x < -80 || s.x > this.w + 80 || s.y < -80 || s.y > this.h + 80) return;
    this.addShock(s.x, s.y, color, .8);
    const nSpark = G.S.data.settings.reduceFx ? 6 : 14;
    for(let i=0;i<nSpark;i++){
      const a = Math.random()*Math.PI*2, sp = 30 + Math.random()*120;
      this.effects.sparks.push({x:s.x, y:s.y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp,
        life:0, maxLife:.5 + Math.random()*.6, color, size:1.4 + Math.random()*2});
    }
  },

  spawnMeteor(){
    const fromLeft = Math.random() < .55;
    const y0 = 196 + Math.random() * Math.max(60, this.h * .5 - 196);
    const speed = 330 + Math.random()*180;
    const ang = (fromLeft ? .12 : Math.PI - .12) + (Math.random()-.5)*.16;
    const gold = Math.random() < .22;
    const dark = !gold && Math.random() < .06;
    this.meteors.push({
      x: fromLeft ? -40 : this.w + 40,
      y: y0,
      vx: Math.cos(ang)*speed, vy: Math.sin(ang)*speed*.32,
      life:0, maxLife: 4, gold, dark,
      id: Math.random().toString(36).slice(2)
    });
    G.Audio.meteor();
  },
  hitMeteor(sx, sy){
    for(let i=this.meteors.length-1;i>=0;i--){
      const m = this.meteors[i];
      if(Math.hypot(m.x-sx, m.y-sy) < 46){
        this.meteors.splice(i,1);
        this.addShock(sx, sy, m.gold ? '#ffd36b' : '#9fd0ff', 1.3);
        for(let k=0;k<18;k++){
          const a = Math.random()*Math.PI*2, sp = 40+Math.random()*160;
          this.effects.sparks.push({x:sx,y:sy,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:0,
            maxLife:.6+Math.random()*.6,color:m.gold?'#ffd36b':'#9fd0ff',size:1.5+Math.random()*2});
        }
        return m;
      }
    }
    return null;
  },

  update(dt){
    this.tickCamera(dt);
    this.time += dt;
    const now = U.now();
    const E = this.effects;
    for(let i=E.ripples.length-1;i>=0;i--){
      const r = E.ripples[i];
      r.life += dt;
      r.r = U.lerp(2, r.max, U.easeOutCubic(r.life/r.maxLife));
      if(r.life >= r.maxLife) E.ripples.splice(i,1);
    }
    for(let i=E.waves.length-1;i>=0;i--){
      const r = E.waves[i];
      r.life += dt;
      r.r = U.lerp(6, r.max, U.easeOutCubic(r.life/r.maxLife));
      if(r.life >= r.maxLife) E.waves.splice(i,1);
    }
    for(let i=E.rings.length-1;i>=0;i--){
      const r = E.rings[i];
      r.life += dt;
      if(r.life >= r.maxLife) E.rings.splice(i,1);
    }
    for(let i=E.sparks.length-1;i>=0;i--){
      const p = E.sparks[i];
      p.life += dt;
      p.x += p.vx*dt; p.y += p.vy*dt;
      p.vy += 90*dt; p.vx *= .985;
      if(p.life >= p.maxLife) E.sparks.splice(i,1);
    }
    for(let i=E.floats.length-1;i>=0;i--){
      const f = E.floats[i];
      f.life += dt;
      f.y += f.vy*dt; f.vy *= .96;
      if(f.life >= f.maxLife) E.floats.splice(i,1);
    }
    for(let i=E.dust.length-1;i>=0;i--){
      const d = E.dust[i];
      d.life += dt;
      d.x += d.vx*dt; d.y += d.vy*dt;
      if(d.life >= d.maxLife) E.dust.splice(i,1);
    }
    for(let i=this.meteors.length-1;i>=0;i--){
      const m = this.meteors[i];
      m.life += dt;
      m.x += m.vx*dt; m.y += m.vy*dt;
      if(m.life > m.maxLife || m.x < -80 || m.x > this.w+80 || m.y > this.h+80) this.meteors.splice(i,1);
    }
    for(const [k,t] of this.clickMarks) if(now - t > 1400) this.clickMarks.delete(k);


    if(!G.S.data.settings.reduceFx && this.quality > .75 && Math.random() < Math.min(.5, Math.log10(1 + G.Econ.d.dps) * .035) * Math.min(1, dt*60)){
      const dens = G.Econ.d.dps;
      const n = dens > 1e9 ? 2 : 1;
      for(let i=0;i<n;i++) this.effects.dust.push({
        x: Math.random()*this.w, y: -6, vx:(Math.random()-.5)*10,
        vy: 14 + Math.random()*26, life:0, maxLife: 5+Math.random()*4,
        size: .6 + Math.random()*1.5, a: .18 + Math.random()*.4
      });
    }
  },

  frame(dt){
    if(!this.ctx) return;
    const ctx = this.ctx;
    ctx.setTransform(this.dpr,0,0,this.dpr,0,0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#02030a';
    ctx.fillRect(0,0,this.w,this.h);

    if(this.bg){
      const ci = G.Econ.chapterIndex();
      if(ci !== this.chapter) this.buildBackground();
      const par = .012;
      ctx.drawImage(this.bg, -this.w*.03 - this.cam.x*par, -this.h*.03 - this.cam.y*par, this.w*1.06, this.h*1.06);
    }

    this.drawGalaxy(ctx);
    this.drawUniverse(ctx);
    this.drawVisions(ctx);
    this.drawUniverseLabel(ctx);
    this.drawWarn(ctx);
    this.drawMeteors(ctx);
    this.drawEffects(ctx);
    this.drawDust(ctx);
    if(this.quality > .9 && !G.S.data.settings.reduceFx) this.drawScanline(ctx);
    this.drawMinimap();
  },

  buildGalaxy(){
    const pts = [];
    for(let arm=0; arm<3; arm++){
      const n = 430;
      for(let i=0;i<n;i++){
        const t = Math.pow(i/n, .72);
        const r = 70 + t * 2100;
        const a = arm * (Math.PI*2/3) + t * 4.4 + (U.hash2(i, arm, 3) - .5) * .6;
        const rr = r * (.86 + U.hash2(i, arm, 9) * .3);
        pts.push({x: Math.cos(a)*rr, y: Math.sin(a)*rr*1.02,
          s: .7 + U.hash2(i, arm, 11)*1.5, a: .16 + .52*(1-t)});
      }
    }
    for(let i=0;i<300;i++){
      const a = U.hash2(i, 7, 5)*Math.PI*2;
      const r = Math.pow(U.hash2(i, 7, 6), 1.7) * 330;
      pts.push({x: Math.cos(a)*r, y: Math.sin(a)*r, s: 1.2 + U.hash2(i,7,8)*3, a: .42});
    }
    this.galaxyPts = pts;

    const uni = [];
    for(let i=0;i<1900;i++){
      const a = U.hash2(i, 13, 21) * Math.PI * 2;
      const r = 900 + Math.pow(U.hash2(i, 13, 22), .62) * 4300;
      uni.push({x: Math.cos(a)*r, y: Math.sin(a)*r*.76,
        s: 8 + U.hash2(i,13,23)*26, a: .07 + U.hash2(i,13,24)*.26, rot: U.hash2(i,13,25)*Math.PI});
    }
    this.uniGalaxies = uni;
  },

  drawGalaxy(ctx){
    const z = this.cam.zoom;
    if(z >= .26) return;
    if(!this.galaxyPts) this.buildGalaxy();
    const k = U.clamp((.26 - z) / .11, 0, 1);
    const cam = this.cam, cx = this.cx, cy = this.cy;
    const px = (wx)=> wx*z + cx - cam.x*z;
    const py = (wy)=> wy*z + cy - cam.y*z;
    ctx.globalCompositeOperation = 'lighter';
    if(z < .13 && this.uniGalaxies){
      const uk = U.clamp((.13 - z) / .04, 0, 1);
      for(const g of this.uniGalaxies){
        const x = px(g.x), y = py(g.y);
        if(x < -90 || x > this.w+90 || y < -90 || y > this.h+90) continue;
        const s = Math.max(3, g.s * z * 9);
        ctx.globalAlpha = Math.min(.62, (.18 + g.a) * uk);
        ctx.drawImage(g.a > .26 ? this.ringSprite : this.sectorGlow, x - s/2, y - s/2, s, s);
        ctx.globalAlpha = Math.min(.6, (.18 + g.a * .8) * uk);
        ctx.fillStyle = g.a > .3 ? '#ffe6b8' : '#dcebff';
        ctx.beginPath(); ctx.ellipse(x, y, s*.8, s*.26, g.rot, 0, Math.PI*2); ctx.fill();
      }
    }
    const a0 = (.04 + .2*k) * U.clamp((z - .085) / .03, 0, 1);
    let lastA = -1;
    for(const p of this.galaxyPts){
      const x = px(p.x), y = py(p.y);
      if(x < -8 || x > this.w+8 || y < -8 || y > this.h+8) continue;
      const s = Math.max(1, p.s * Math.max(.7, z*7));
      const a = a0 * p.a;
      if(Math.abs(a - lastA) > .04){ ctx.globalAlpha = a; lastA = a; }
      ctx.fillStyle = '#9fc4ff';
      ctx.fillRect(x, y, s, s);
    }
    const c0 = this.screen(0,0);
    const cr = Math.max(44, 620*z);
    ctx.globalAlpha = .3 * k;
    ctx.drawImage(this.sunSprite, c0.x-cr/2, c0.y-cr/2, cr, cr);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  },

  drawUniverseLabel(ctx){
    const z = this.cam.zoom;
    if(z > .125) return;
    const k = U.clamp((.125 - z) / .04, 0, 1);
    const a = k * .9;
    if(a <= .01) return;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(206,224,255,.92)';
    ctx.font = '600 11px "PingFang SC","Microsoft YaHei",system-ui,sans-serif';
    ctx.fillText('本宇宙 · 2,000 亿颗', this.w/2, 246);
    ctx.globalAlpha = a * .55;
    ctx.font = '500 9px "PingFang SC","Microsoft YaHei",system-ui,sans-serif';
    ctx.fillText('已观测 ' + (G.Econ.mvCoverage()*100).toFixed(3) + '%', this.w/2, 262);
    ctx.restore();
  },

  drawUniverse(ctx){
    const cam = this.cam, z = cam.zoom, w = this.w, h = this.h;
    const left = cam.x - this.cx/z, right = cam.x + this.cx/z;
    const top = cam.y - this.cy/z, bot = cam.y + (h - this.cy)/z;
    const sx0 = Math.round(left/S) - 1, sx1 = Math.round(right/S) + 1;
    const sy0 = Math.round(top/S) - 1, sy1 = Math.round(bot/S) + 1;
    const R = Uni.visionRing();
    const tick = this.time;

    if(z < .30){
      this.heatFade = U.clamp((.30 - z) / .10, 0, 1);
      this.drawArms(ctx, z);
      this.drawHeat(ctx, R);
    }

    if(z >= .22){
      const maxStars = z > .9 ? 4200 : 5200;
      let drawn = 0;
      let litDrawn = 0;
      const step = z < .34 ? 4 : z < .5 ? 2 : 1;
      const nowMs = this.time * 1000;
      const arr = Uni.generate(0,0);
      const spriteCache = this.sprites;
      const level = z < .42 ? 0 : 1;
      const dim = this.quality < .8;
      ctx.globalCompositeOperation = 'lighter';
      for(let sy=sy0; sy<=sy1; sy++){
        for(let sx=sx0; sx<=sx1; sx++){
          if(Uni.ring(sx,sy) > R) continue;
          const stars = Uni.generate(sx,sy);
          const p = Uni.progress(sx,sy);
          const dr = Uni.deadRatio(sx,sy);
          const key = sx + ',' + sy;
          const prev = this.lastLit.get(key) || 0;
          let litN = 0;
          for(let i=0;i<stars.length;i+=step){
            const st = stars[i];
            const px = st.wx*z + this.cx - cam.x*z;
            const py = st.wy*z + this.cy - cam.y*z;
            const isLit = st.t < p;
            if(isLit) litN++;
            if(px < -8 || px > w+8 || py < -8 || py > h+8) continue;
            drawn++;
            const isActive = isLit && st.fx !== undefined && st.fx > nowMs;
            const type = CFG.STAR_TYPES[st.type];
            const dead = st.dead || (dr > 0.001 && st.t > 1 - dr);
            if(dead){
              const dsz = type.size * (.82 + Math.sqrt(z)*1.38) * st.sz;
              const gs = Math.max(3, dsz * 3.4);
              ctx.globalAlpha = .5;
              ctx.drawImage(this.sprites.dead, px - gs/2, py - gs/2, gs, gs);
              ctx.globalAlpha = .7;
              ctx.fillStyle = '#5a0d18';
              ctx.fillRect(px - .7, py - .7, 1.4, 1.4);
              if(st.fx !== undefined && st.fx > nowMs){
                const fx = (st.fx - nowMs) / 700;
                ctx.globalAlpha = .6 * fx;
                ctx.beginPath();
                ctx.arc(px, py, dsz * (1.5 + (1-fx) * 3.4), 0, Math.PI*2);
                ctx.strokeStyle = U.rgba('#d9364a', .7 * fx);
                ctx.lineWidth = .9;
                ctx.stroke();
              }
              ctx.globalAlpha = 1;
              continue;
            }
            if(!isLit){
              if(z > .3){
                ctx.globalAlpha = z > .62 ? .13 : .09;
                ctx.fillStyle = '#93a6c6';
                ctx.fillRect(px, py, .9, .9);
              }
              continue;
            }
            const tw = .84 + Math.sin(tick*1.7 + st.ph)*.16;
            const size = (type.size * (.82 + Math.sqrt(z)*1.38) * st.sz) * tw;
            if(z < .3 || dim || litDrawn > maxStars){
              ctx.globalAlpha = z < .3 ? .55 : .82;
              ctx.fillStyle = type.id === 'black' ? type.color : type.core;
              ctx.fillRect(px-size*.4, py-size*.4, Math.max(1, size*.8), Math.max(1, size*.8));
              litDrawn++;
              continue;
            }
            litDrawn++;
            const spr = spriteCache[type.id];
            const gs = size * (type.id === 'black' ? 6 : 4.2);
            ctx.globalAlpha = Math.min(.78, type.glow * (.55 + (isActive ? .3 : 0)));
            ctx.drawImage(spr, px - gs/2, py - gs/2, gs, gs);
            if(type.id !== 'black'){
              ctx.globalAlpha = .9;
              ctx.fillStyle = type.core;
              const cs = Math.max(.9, size*.5);
              ctx.fillRect(px - cs/2, py - cs/2, cs, cs);
            }
            ctx.globalAlpha = 1;
            if(type.id === 'pulsar'){
              ctx.strokeStyle = U.rgba(type.color, .5);
              ctx.lineWidth = .8;
              const rlen = size*4.2;
              ctx.beginPath();
              ctx.moveTo(px-rlen, py); ctx.lineTo(px+rlen, py);
              ctx.moveTo(px, py-rlen); ctx.lineTo(px, py+rlen);
              ctx.stroke();
            }
            if(isActive){
              const fx = U.clamp((st.fx - nowMs) / 700, 0, 1);
              ctx.globalAlpha = .55 * fx;
              ctx.beginPath();
              ctx.arc(px, py, size * (2.0 + (1 - fx) * 2.2), 0, Math.PI*2);
              ctx.strokeStyle = U.rgba(type.core, .55 * fx);
              ctx.lineWidth = .8;
              ctx.stroke();
            }
          }
          if(litN > prev && Math.random() < .6){
            const st = stars[Math.floor(Math.random()*stars.length)];
            const s = this.screen(st.wx, st.wy);
            if(s.x>0&&s.x<w&&s.y>0&&s.y<h) this.addSpark(s, CFG.STAR_TYPES[st.type].color, 1);
          }
          this.lastLit.set(key, litN);
        }
      }
      this.starsDrawn = drawn;
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    this.drawClickMarks(ctx, z);
    this.drawConstellations(ctx, z);
    this.drawSun(ctx, z);
    this.drawAnchors(ctx, z);
  },

  drawArms(ctx, z){
    if(z < .14 || z > .34) return;
    const k = U.clamp(1 - Math.abs(z - .21) / .13, 0, 1);
    if(k <= .01) return;
    const cam = this.cam;
    const px = (wx)=> wx*z + this.cx - cam.x*z;
    const py = (wy)=> wy*z + this.cy - cam.y*z;
    const tint = CFG.CHAPTERS[G.Econ.chapterIndex()].tint;
    ctx.globalCompositeOperation = 'lighter';
    for(let arm=0; arm<3; arm++){
      for(let pass=0; pass<2; pass++){
        ctx.beginPath();
        for(let i=0;i<=40;i++){
          const t = i/40;
          const r = 120 + t*2400;
          const a = arm*(Math.PI*2/3) + t*4.4;
          const x = px(Math.cos(a)*r), y = py(Math.sin(a)*r*1.02);
          if(i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = U.rgba(tint, (pass ? .022 : .045) * k);
        ctx.lineWidth = (pass ? 70 : 26) * Math.max(.6, Math.sqrt(z * 3.2));
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  },

  constCache:new Map(),
  constFigure(bx, by){
    const key = bx + ',' + by;
    const hit = this.constCache.get(key);
    if(hit) return hit;
    const rng = U.mulberry32((bx*374761393 ^ by*668265263 ^ 0x2f6b1a3)|0);
    const pts = [];
    for(let i=0;i<8;i++){
      const sx = bx*3 + (i % 3), sy = by*4 + (Math.floor(i/3) % 4);
      const arr = Uni.generate(sx, sy);
      const st = arr[Math.floor(rng()*arr.length)];
      if(st) pts.push({wx:st.wx, wy:st.wy, sx, sy, t:st.t, type:st.type});
    }
    const cx = (bx*3 + 1.5)*S, cy = (by*4 + 2)*S;
    pts.sort((a,b)=> Math.atan2(a.wy-cy, a.wx-cx) - Math.atan2(b.wy-cy, b.wx-cx));
    const v = {pts, cx, cy};
    if(this.constCache.size > 1200) this.constCache.clear();
    this.constCache.set(key, v);
    return v;
  },

  drawConstellations(ctx, z){
    if(z < .24 || z > .62) return;
    const k = U.clamp(Math.min((z - .24) / .05, (.62 - z) / .14), 0, 1);
    if(k <= .01) return;
    const cam = this.cam, w = this.w, h = this.h;
    const seen = new Set();
    let blocks = 0;
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    const lw = Math.max(.65, 1.3*Math.sqrt(z));
    for(const key in G.S.data.sectors){
      const ci = key.indexOf(',');
      const sx = +key.slice(0, ci), sy = +key.slice(ci+1);
      const bx = Math.floor(sx/3), by = Math.floor(sy/4);
      const bk = bx + ',' + by;
      if(seen.has(bk)) continue;
      seen.add(bk);
      const wx = (bx*3 + 1.5)*S, wy = (by*4 + 2)*S;
      const px = wx*z + this.cx - cam.x*z, py = wy*z + this.cy - cam.y*z;
      if(px < -120 || px > w+120 || py < -120 || py > h+120) continue;
      if(++blocks > 320) break;
      const fig = this.constFigure(bx, by);
      let sum = 0;
      for(const p of fig.pts) sum += Uni.progress(p.sx, p.sy);
      const avg = sum / Math.max(1, fig.pts.length);
      const sp = [];
      for(const f of fig.pts){
        const x = f.wx*z + this.cx - cam.x*z;
        const y = f.wy*z + this.cy - cam.y*z;
        sp.push({x, y, on: f.t < Uni.progress(f.sx, f.sy)});
      }
      ctx.lineWidth = lw;
      ctx.strokeStyle = '#9fd0ff';
      for(let i=1;i<sp.length;i++){
        const a = sp[i-1], b = sp[i];
        if(a.x < -20 || a.x > w+20 || a.y < -20 || a.y > h+20) continue;
        if(b.x < -20 || b.x > w+20 || b.y < -20 || b.y > h+20) continue;
        const on = a.on && b.on;
        ctx.globalAlpha = (on ? (.09 + .30*avg) : .03) * k;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      for(const f of sp){
        if(!f.on) continue;
        if(f.x < -20 || f.x > w+20 || f.y < -20 || f.y > h+20) continue;
        ctx.globalAlpha = (.28 + .45*avg) * k;
        ctx.fillStyle = '#dff0ff';
        ctx.beginPath(); ctx.arc(f.x, f.y, Math.max(.9, 1.4*Math.sqrt(z)), 0, Math.PI*2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineCap = 'butt';
  },

  drawHeat(ctx, R){
    const z = this.cam.zoom, cam = this.cam;
    const hf = this.heatFade == null ? 1 : this.heatFade;
    const G3 = 4;
    const maxG = Math.ceil((Uni.maxR + 1) / G3);
    const cells = [];
    for(let gy=-maxG; gy<=maxG; gy++){
      for(let gx=-maxG; gx<=maxG; gx++){
        let sum = 0, n = 0, dsum = 0;
        for(let oy=0; oy<G3; oy++) for(let ox=0; ox<G3; ox++){
          const x = gx*G3+ox, y = gy*G3+oy;
          if(Uni.ring(x,y) > R) continue;
          sum += Uni.progress(x,y); dsum += Uni.deadRatio(x,y); n++;
        }
        if(!n) continue;
        const p = sum / n;
        const dpp = dsum / n;
        if(p < .004 && dpp < .004) continue;
        const jx = (U.hash2(gx, gy, 7) - .5) * S * 2.2;
        const jy = (U.hash2(gx, gy, 19) - .5) * S * 2.2;
        const cxw = (gx*G3 + 1.5) * S + jx;
        const cyw = (gy*G3 + 1.5) * S + jy;
        cells.push({gx, gy, p, dp: dpp, px: cxw*z + this.cx - cam.x*z, py: cyw*z + this.cy - cam.y*z,
          gs: S * G3 * z * (.8 + U.hash2(gx,gy,23) * 1.7)});
      }
    }
    ctx.globalCompositeOperation = 'lighter';
    const key = (a,b)=>a + ',' + b;
    const map = new Map(cells.map(c=>[key(c.gx,c.gy), c]));
    ctx.lineCap = 'round';
    for(const c of cells){
      if(c.p < .45) continue;
      const nb = [map.get(key(c.gx+1,c.gy)), map.get(key(c.gx,c.gy+1))];
      for(const b of nb){
        if(!b || b.p < .45) continue;
        const a = Math.min(c.p, b.p);
        ctx.globalAlpha = Math.min(.16, a * .16) * hf;
        ctx.strokeStyle = CFG.CHAPTERS[G.Econ.chapterIndex()].tint;
        ctx.lineWidth = Math.max(1, 18 * z * a);
        ctx.beginPath(); ctx.moveTo(c.px, c.py); ctx.lineTo(b.px, b.py); ctx.stroke();
      }
    }
    for(const c of cells){
      if(c.px + c.gs < 0 || c.px - c.gs > this.w || c.py + c.gs < 0 || c.py - c.gs > this.h) continue;
      if(c.p > .004){
        ctx.globalAlpha = Math.min(.38, .02 + Math.pow(c.p, .62) * .46) * hf;
        ctx.drawImage(this.sectorGlow, c.px - c.gs/2, c.py - c.gs/2, c.gs, c.gs);
        if(c.p > .6){
          ctx.globalAlpha = (c.p - .6) * .5 * hf;
          const gs2 = c.gs * .5;
          ctx.drawImage(this.sectorGlow, c.px - gs2/2, c.py - gs2/2, gs2, gs2);
        }
      }
      if(c.dp > .004){
        ctx.globalAlpha = Math.min(.42, .03 + Math.pow(c.dp, .6) * .5) * hf;
        ctx.drawImage(this.sectorGlowRed, c.px - c.gs/2, c.py - c.gs/2, c.gs, c.gs);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineCap = 'butt';
  },

  drawClickMarks(ctx, z){
    if(this.clickMarks.size === 0) return;
    const now = U.now();
    ctx.globalCompositeOperation = 'lighter';
    for(const [k, t] of this.clickMarks){
      const late = (now - t) / 1400;
      const parts = k.split(',');
      const sx = +parts[0], sy = +parts[1], i = +parts[2];
      if(Uni.ring(sx,sy) > Uni.visionRing()) continue;
      const arr = Uni.generate(sx,sy);
      const st = arr[i];
      if(!st) continue;
      const px = st.wx*z + this.cx - this.cam.x*z;
      const py = st.wy*z + this.cy - this.cam.y*z;
      if(px < -20 || px > this.w+20 || py < -20 || py > this.h+20) continue;
      const type = CFG.STAR_TYPES[st.type];
      const size = (type.size * (1.1 + Math.sqrt(z)*1.6)) * (1 + late*.6);
      ctx.globalAlpha = (1 - late) * .7;
      const gs = size * 8;
      ctx.drawImage(this.sprites[type.id], px-gs/2, py-gs/2, gs, gs);
      ctx.globalAlpha = (1-late)*.6;
      ctx.strokeStyle = U.rgba('#ffffff', .5);
      ctx.lineWidth = .8;
      ctx.beginPath(); ctx.arc(px, py, size*(2.6+late*3), 0, Math.PI*2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  },

  drawSun(ctx, z){
    const s = this.screen(0,0);
    if(s.x < -60 || s.x > this.w+60 || s.y < -60 || s.y > this.h+60) return;
    const p = .8 + Math.sin(this.time*1.1)*.2;
    const size = Math.max(12, 13 + z*5);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = .42 * p;
    ctx.drawImage(this.sunSprite, s.x-size*1.5, s.y-size*1.5, size*3, size*3);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#fff8e0';
    ctx.beginPath(); ctx.arc(s.x, s.y, Math.max(1.6, size*.13), 0, Math.PI*2); ctx.fill();
    if(z > .34){
      ctx.font = '9px ui-monospace,monospace';
      ctx.fillStyle = 'rgba(255,226,160,.55)';
      ctx.textAlign = 'center';
      ctx.fillText('太阳', s.x, s.y + size*.9 + 11);
      ctx.textAlign = 'left';
    }
  },

  drawAnchors(ctx, z){
    const list = G.S.data.megaAnchors || G.S.data.anchors || [];
    if(!list.length) return;
    const tint = '#ffd36b';
    ctx.globalCompositeOperation = 'lighter';
    for(const a of list){
      const s = this.screen(a.x, a.y);
      if(s.x < -80 || s.x > this.w+80 || s.y < -80 || s.y > this.h+80) continue;
      const r = Math.max(10, 26 * Math.sqrt(z));
      const pulse = .7 + Math.sin(this.time*1.5 + a.x*.01)*.3;
      ctx.globalAlpha = .55 * pulse;
      ctx.strokeStyle = tint;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, Math.PI*2); ctx.stroke();
      ctx.globalAlpha = .22 * pulse;
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, Math.PI*2); ctx.stroke();
      ctx.globalAlpha = .5;
      ctx.fillStyle = '#ffe9b0';
      ctx.beginPath(); ctx.arc(s.x, s.y, 1.6, 0, Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  },

  drawVisions(ctx){
    const s = this.screen(0,0);
    const rad = this.visionRadius() * this.cam.zoom;
    const g = ctx.createRadialGradient(s.x, s.y, rad*.86, s.x, s.y, rad*1.10);
    if(rad < 2){ return; }
    g.addColorStop(0, 'rgba(2,4,12,0)');
    g.addColorStop(.55, 'rgba(2,4,12,.55)');
    g.addColorStop(1, 'rgba(2,4,12,.96)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.rect(0,0,this.w,this.h);
    ctx.arc(s.x, s.y, rad*1.10, 0, Math.PI*2, true);
    ctx.fill('evenodd');

    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(95,180,255,.10)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(s.x, s.y, rad, 0, Math.PI*2); ctx.stroke();
    ctx.setLineDash([2, 10]);
    ctx.strokeStyle = 'rgba(120,190,255,.16)';
    ctx.beginPath(); ctx.arc(s.x, s.y, rad*1.06, 0, Math.PI*2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalCompositeOperation = 'source-over';
  },

  drawEffects(ctx){
    const E = this.effects;
    ctx.globalCompositeOperation = 'lighter';
    for(const r of E.rings){
      const s = this.screen(r.wx, r.wy);
      if(s.x < -100 || s.x > this.w+100 || s.y < -100 || s.y > this.h+100) continue;
      const t = r.life / r.maxLife;
      const rad = U.lerp(6, r.max, U.easeOutCubic(t)) * Math.max(.35, Math.sqrt(this.cam.zoom));
      ctx.globalAlpha = (1-t) * .7;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 1.5 * (1-t) + .4;
      ctx.beginPath(); ctx.arc(s.x, s.y, rad, 0, Math.PI*2); ctx.stroke();
    }
    for(const r of E.waves){
      const t = r.life / r.maxLife;
      ctx.globalAlpha = (1-t) * .5;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 2.2 * (1-t) + .3;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI*2); ctx.stroke();
    }
    for(const r of E.ripples){
      const t = r.life / r.maxLife;
      ctx.globalAlpha = (1-t) * .55;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 1.4 * (1-t) + .25;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI*2); ctx.stroke();
    }
    const nowT = U.now();
    for(let i=E.bolts.length-1;i>=0;i--){
      const b = E.bolts[i];
      const tt = (nowT - b.t0) / b.dur;
      if(tt < 0) continue;
      const fade = 1 - U.clamp((tt - 1) / .5, 0, 1);
      if(fade <= 0){ E.bolts.splice(i,1); continue; }
      const e = U.easeOutCubic(U.clamp(tt,0,1));
      const hx = U.lerp(b.x1, b.x2, e), hy = U.lerp(b.y1, b.y2, e);
      const g = ctx.createLinearGradient(b.x1, b.y1, hx, hy);
      g.addColorStop(0, U.rgba(b.color, 0));
      g.addColorStop(.45, U.rgba(b.color, .38*fade));
      g.addColorStop(1, U.rgba(b.color, 1*fade));
      if(b.head){
        ctx.globalAlpha = .22 * fade;
        ctx.strokeStyle = b.color;
        ctx.lineWidth = 7 * fade + 1;
        ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(hx, hy); ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.strokeStyle = g;
      ctx.lineWidth = (b.head ? 3.2 : 2.1) * fade + .3;
      ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(hx, hy); ctx.stroke();
      ctx.strokeStyle = U.rgba('#ffffff', .6 * fade);
      ctx.lineWidth = (b.head ? 1.2 : .7) * fade + .2;
      ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(hx, hy); ctx.stroke();
      if(b.head && tt > .12 && tt < 1.15){
        ctx.globalAlpha = fade;
        const gs = 18;
        ctx.drawImage(this.sprites[b.sprite] || this.sprites.red, hx-gs/2, hy-gs/2, gs, gs);
        ctx.globalAlpha = 1;
      }
      if(b.head && !b.rippled && tt >= 1){
        b.rippled = true;
        this.effects.ripples.push({x:b.x2, y:b.y2, r:2, max:20, life:0, maxLife:.38, color:b.color});
      }
    }
    for(const p of E.sparks){
      const t = p.life / p.maxLife;
      ctx.globalAlpha = (1-t) * .9;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(.4, p.size*(1-t*.7)), 0, Math.PI*2); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    for(const f of E.floats){
      const t = f.life / f.maxLife;
      ctx.globalAlpha = t < .15 ? t/.15 : (1 - Math.pow(Math.max(0,(t-.55))/.45, 2));
      ctx.font = '700 ' + f.size + 'px "SF Mono",ui-monospace,Consolas,monospace';
      ctx.textAlign = 'center';
      ctx.shadowColor = U.rgba(f.color, .8);
      ctx.shadowBlur = 10;
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
      ctx.shadowBlur = 0;
      ctx.textAlign = 'left';
    }
    ctx.globalAlpha = 1;
  },

  drawDust(ctx){
    ctx.globalCompositeOperation = 'lighter';
    for(const d of this.effects.dust){
      const t = d.life / d.maxLife;
      ctx.globalAlpha = d.a * (t < .2 ? t/.2 : 1) * (1-t*.6);
      ctx.fillStyle = '#cfe3ff';
      ctx.fillRect(d.x, d.y, d.size, d.size*2.2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  },

  drawWarn(ctx){
    const stage = G.S.data.warnStage | 0;
    if(stage <= 0) return;
    const k = stage / 5;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(217,54,74,' + (0.015 + 0.045 * k).toFixed(3) + ')';
    ctx.fillRect(0, 0, this.w, this.h);
    if(stage >= 2){
      ctx.strokeStyle = 'rgba(217,54,74,' + (0.05 + 0.10 * k).toFixed(3) + ')';
      ctx.lineWidth = 1;
      const drift = this.time * 6;
      for(let i=0;i<5;i++){
        const x0 = ((U.hash2(i, 3, 11) * this.w) + drift) % this.w;
        ctx.beginPath();
        ctx.moveTo(x0, 0);
        for(let y=0; y<=this.h; y+=70){
          ctx.lineTo(x0 + (U.hash2(i, y|0, 5) - .5) * 34, y);
        }
        ctx.stroke();
      }
    }
    if(stage >= 3 && !G.S.data.settings.reduceFx){
      const t = this.time;
      const n = stage >= 4 ? 3 : 1;
      for(let i=0;i<n;i++){
        const seed = Math.floor(t * 3) + i * 7;
        if(U.hash2(seed, i, 31) > (stage >= 4 ? .35 : .12)){
          const y = U.hash2(seed, i, 41) * this.h;
          const hh = 6 + U.hash2(seed, i, 47) * 26;
          ctx.fillStyle = 'rgba(217,54,74,' + (.10 + .12*k).toFixed(3) + ')';
          ctx.fillRect(U.hash2(seed,i,53)*10 - 10, y, this.w + 20, hh);
        }
      }
    }
  },

  drawMeteors(ctx){
    for(const m of this.meteors){
      const tail = 90;
      const norm = Math.hypot(m.vx, m.vy) || 1;
      const tx = m.x - m.vx/norm*tail, ty = m.y - m.vy/norm*tail;
      const g = ctx.createLinearGradient(tx, ty, m.x, m.y);
      const col = m.dark ? '#d9364a' : (m.gold ? '#ffd36b' : '#9fd0ff');
      g.addColorStop(0, U.rgba(col, 0));
      g.addColorStop(.7, U.rgba(col, .35));
      g.addColorStop(1, U.rgba(col, .95));
      ctx.strokeStyle = g;
      ctx.lineWidth = m.gold ? 2.6 : 1.7;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(m.x, m.y); ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = .65;
      const gs = m.dark ? 40 : (m.gold ? 52 : 36);
      ctx.drawImage(this.sprites[m.dark ? 'dead' : (m.gold ? 'yellow' : 'blue')], m.x-gs/2, m.y-gs/2, gs, gs);
      ctx.globalAlpha = .35 + Math.sin(this.time*6)*.2;
      ctx.strokeStyle = m.dark ? '#d9364a' : (m.gold ? '#ffd36b' : '#9fd0ff');
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(m.x, m.y, 17, 0, Math.PI*2); ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.lineCap = 'butt';
  },

  drawScanline(ctx){
    const t = (this.time % 9) / 9;
    if(t > .045) return;
    const y = t/.045 * this.h;
    const g = ctx.createLinearGradient(0, y-16, 0, y+16);
    g.addColorStop(0, 'rgba(120,180,255,0)');
    g.addColorStop(.5, 'rgba(120,180,255,.05)');
    g.addColorStop(1, 'rgba(120,180,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, y-16, this.w, 32);
  },

  drawMinimap(){
    this.minimapT++;
    if(this.minimapT % 12 !== 0 || !this.minimap) return;
    const c = this.minimap, x = c.getContext('2d');
    const w = c.width, h = c.height;
    x.clearRect(0,0,w,h);
    x.fillStyle = 'rgba(6,10,22,.7)';
    x.fillRect(0,0,w,h);
    const R = Uni.visionRing();
    const span = (R + 1.6) * S;
    const sc = (Math.min(w,h)*.5 - 5) / span;
    const cx = w/2, cy = h/2;
    const tint = CFG.CHAPTERS[G.Econ.chapterIndex()].tint;
    const disc = x.createRadialGradient(cx, cy, 0, cx, cy, R*S*sc);
    disc.addColorStop(0, 'rgba(95,180,255,.07)');
    disc.addColorStop(1, 'rgba(95,180,255,0)');
    x.fillStyle = disc;
    x.beginPath(); x.arc(cx, cy, R*S*sc, 0, Math.PI*2); x.fill();
    for(const k in G.S.data.sectors){
      const parts = k.split(',');
      const sx = +parts[0], sy = +parts[1];
      if(Uni.ring(sx,sy) > R) continue;
      const p = Uni.progress(sx,sy);
      if(p <= .004) continue;
      const a = Math.min(.7, .08 + p*.7);
      x.fillStyle = U.rgba(tint, a);
      const sz = Math.max(1, S*sc*.6);
      x.fillRect(cx + sx*S*sc - sz/2, cy + sy*S*sc - sz/2, sz, sz);
    }
    x.strokeStyle = 'rgba(95,180,255,.25)';
    x.lineWidth = .8;
    x.beginPath(); x.arc(cx, cy, R*S*sc, 0, Math.PI*2); x.stroke();
    const halfW = (this.w/2/this.cam.zoom)*sc, halfH = (this.h/2/this.cam.zoom)*sc;
    x.strokeStyle = 'rgba(255,255,255,.35)';
    x.strokeRect(cx + this.cam.x*sc - halfW, cy + this.cam.y*sc - halfH, halfW*2, halfH*2);
    x.fillStyle = 'rgba(255,211,107,.9)';
    x.beginPath(); x.arc(cx, cy, 1.6, 0, Math.PI*2); x.fill();
  },

  setVision(){
    const z = this.fitZoom();
    this.flyTo(0, 0, z, 1500);
    this.buildBackground();
  }
};

G.Renderer = Renderer;
})();
