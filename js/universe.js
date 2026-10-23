(function(){
const G = window.G, CFG = G.CFG, U = G.U;

const Bus = {
  map:{},
  on(ev, fn){ (this.map[ev] = this.map[ev] || []).push(fn); return fn; },
  emit(ev, data){ const a = this.map[ev]; if(a) for(let i=0;i<a.length;i++) a[i](data); }
};
G.Bus = Bus;

const SECTOR = 100;
const STAR_DENSITY = 118;
const MAX_R = 24;

const Universe = {
  sector: SECTOR,
  maxR: MAX_R,
  cache: new Map(),
  cacheOrder: [],
  visibleCap: 0,
  incomplete: null,
  incompleteAt: 0,

  ring(x, y){ return Math.ceil(Math.hypot(x, y) - 1e-9); },
  cap(x, y){ return CFG.sectorCap(this.ring(x, y)); },
  visionRing(){ return CFG.VISIONS[G.S.data.vision - 1].ring; },
  isUnlocked(x, y){ return this.ring(x, y) <= this.visionRing(); },
  layerOf(z){
    const L = CFG.LAYERS;
    for(let i=0;i<L.length;i++) if(z >= L[i].z) return L[i];
    return L[L.length-1];
  },
  layerAt(z){ return this.layerOf(z).id; },
  pointUnit(x, y){ return this.cap(x, y) / STAR_DENSITY; },
  layerUnitLabel(layer){
    const H = CFG.HIERARCHY, f = G.U.fmt;
    if(layer.id === 'sector') return '1 点 ≈ ' + f(Math.round(H.starsPerDot)) + ' 颗 · 1 星区 = ' + f(Math.round(H.starsPerSector)) + ' 颗';
    if(layer.id === 'const') return '1 星座 = 12 星区 ≈ ' + f(H.starsPerConst) + ' 颗';
    if(layer.id === 'arm') return '1 旋臂 = 625 星座 ≈ ' + f(H.starsPerArm) + ' 颗';
    if(layer.id === 'galaxy') return '1 银河 = 4 旋臂 ≈ ' + f(H.starsPerGalaxy) + ' 颗';
    return '1 宇宙 = 50 银河 · ' + f(CFG.UNIVERSE_STARS) + ' 颗';
  },
  key(x, y){ return x + ',' + y; },
  get(x, y){
    const v = G.S.data.sectors[this.key(x, y)];
    return v == null ? 0 : v;
  },
  progress(x, y){
    return U.clamp(this.get(x, y) / this.cap(x, y), 0, 1);
  },
  sectorAtWorld(wx, wy){
    return { x: Math.round(wx / SECTOR), y: Math.round(wy / SECTOR) };
  },
  countUnlocked(){
    const R = this.visionRing();
    let n = 0;
    for(let y=-MAX_R;y<=MAX_R;y++) for(let x=-MAX_R;x<=MAX_R;x++){
      if(this.ring(x,y) <= R) n++;
    }
    return n;
  },
  computeVisibleCap(){
    const R = this.visionRing();
    let total = 0;
    for(let y=-MAX_R;y<=MAX_R;y++) for(let x=-MAX_R;x<=MAX_R;x++){
      if(this.ring(x,y) <= R) total += CFG.sectorCap(this.ring(x,y));
    }
    this.visibleCap = total;
    return total;
  },
  rebuildIncomplete(){
    const R = this.visionRing();
    const out = [];
    for(let y=-MAX_R;y<=MAX_R;y++) for(let x=-MAX_R;x<=MAX_R;x++){
      const ring = this.ring(x,y);
      if(ring > R) continue;
      const cap = CFG.sectorCap(ring);
      if(this.get(x,y) < cap - 1e-6) out.push({x, y, ring, cap});
    }
    this.incomplete = out;
    this.incompleteAt = U.now();
    return out;
  },
  ensureIncomplete(){
    if(!this.incomplete || U.now() - this.incompleteAt > 700 || this.incomplete.length === 0){
      this.rebuildIncomplete();
    }
    return this.incomplete;
  },
  visibleObserved(){
    let total = 0;
    const s = G.S.data.sectors;
    for(const k in s) total += s[k];
    return total;
  },

  generate(x, y){
    const k = this.key(x, y);
    let arr = this.cache.get(k);
    if(arr) return arr;
    const ring = this.ring(x, y);
    const n = STAR_DENSITY;
    const rng = U.mulberry32((x * 73856093 ^ y * 19349663 ^ 0x9e3779b9) | 0);
    const clusters = 2 + Math.floor(rng() * 3);
    const cs = [];
    for(let c=0;c<clusters;c++){
      cs.push({x:(rng()-.5)*SECTOR*.82, y:(rng()-.5)*SECTOR*.82, s:SECTOR*(.10+rng()*.26), w:.5+rng()});
    }
    const types = CFG.STAR_TYPES;
    const weighted = [];
    types.forEach(t=>{ weighted.push(t); });
    arr = new Array(n);
    for(let i=0;i<n;i++){
      const useCluster = rng() < .72;
      let lx, ly;
      if(useCluster){
        const c = cs[Math.floor(rng()*cs.length)];
        const ang = rng()*Math.PI*2;
        const rad = Math.pow(rng(), 1.9) * c.s * 2.6;
        lx = c.x + Math.cos(ang)*rad;
        ly = c.y + Math.sin(ang)*rad;
        if(Math.abs(lx) > SECTOR*.5 || Math.abs(ly) > SECTOR*.5){
          lx = (rng()-.5)*SECTOR*.92; ly = (rng()-.5)*SECTOR*.92;
        }
      } else {
        lx = (rng()-.5)*SECTOR*.94;
        ly = (rng()-.5)*SECTOR*.94;
      }
      let r = rng(), ti = 0, acc = 0;
      for(let t=0;t<types.length;t++){ acc += types[t].w; if(r <= acc){ ti = t; break; } }
      arr[i] = {
        wx: x*SECTOR + lx,
        wy: y*SECTOR + ly,
        type: ti,
        t: (i + rng()*.85) / n,
        sz: .78 + rng()*.5,
        ph: rng()*Math.PI*2
      };
    }
    arr.sort((a,b)=>a.t-b.t);
    const cl = G.S.data.clickLit && G.S.data.clickLit[k];
    if(cl && cl.length){
      for(let n2=0;n2<cl.length;n2++){
        const i2 = cl[n2];
        if(arr[i2]) arr[i2].t = Math.min(arr[i2].t, 1e-4);
      }
    }
    const cd = G.S.data.clickDead && G.S.data.clickDead[k];
    if(cd && cd.length){
      for(let n2=0;n2<cd.length;n2++){
        const i2 = cd[n2];
        if(arr[i2]) arr[i2].dead = true;
      }
    }
    this.cache.set(k, arr);
    this.cacheOrder.push(k);
    if(this.cacheOrder.length > 460){
      const old = this.cacheOrder.shift();
      if(old !== k) this.cache.delete(old);
    }
    return arr;
  },

  observeAt(x, y, amount){
    if(!this.isUnlocked(x,y)) return {added:0, completed:false, overflow:amount};
    const S = G.S.data, k = this.key(x,y), cap = this.cap(x,y);
    let cur = S.sectors[k] || 0;
    if(cur >= cap) return {added:0, completed:false, capped:true, overflow:amount};
    const added = Math.min(amount, cap - cur);
    cur += added;
    S.sectors[k] = cur;
    S.observed += added;
    S.stats.totalObserved += added;
    let completed = false;
    if(cur >= cap - 1e-6){
      S.sectors[k] = cap;
      completed = true;
      const r = CFG.sectorResearch(this.ring(x,y));
      S.research += r;
      S.stats.researchEarned += r;
      Bus.emit('sectorComplete', {x, y, research:r, ring:this.ring(x,y)});
      this.incomplete = null;
    }
    return {added, completed, overflow: Math.max(0, amount - added)};
  },

  lightNear(wx, wy, count, radius, minD, target, widen){
    if(count <= 0) return [];
    const S = G.S.data;
    S.clickLit = S.clickLit || {};
    minD = minD || 0;
    target = target || 0;
    const c = this.sectorAtWorld(wx, wy);
    const collect = (r)=>{
      const cands = [];
      for(let oy=-1;oy<=1;oy++) for(let ox=-1;ox<=1;ox++){
        const x = c.x+ox, y = c.y+oy;
        if(!this.isUnlocked(x,y)) continue;
        const p = this.progress(x,y);
        if(p <= 1e-9) continue;
        const arr = this.generate(x,y);
        for(let i=0;i<arr.length;i++){
          const st = arr[i];
          if(st.dead) continue;
          if(st.t < p) continue;
          const d = Math.hypot(st.wx-wx, st.wy-wy);
          if(d > r || d < minD) continue;
          cands.push({x, y, i, st, d, p});
        }
      }
      return cands;
    };
    let cands = collect(radius);
    if(!cands.length && widen !== false){
      cands = collect(radius*1.9);
      if(!cands.length) cands = collect(radius*3.2);
    }
    if(!cands.length) return [];
    if(target > 0) cands.sort((a,b)=>Math.abs(a.d-target)-Math.abs(b.d-target));
    else cands.sort((a,b)=>a.d-b.d);
    const picked = [];
    for(const cd of cands){
      if(picked.length >= count) break;
      const ang = Math.atan2(cd.st.wy-wy, cd.st.wx-wx);
      let ok = true;
      for(let q=0;q<picked.length;q++){
        let dd = Math.abs(ang - picked[q].ang);
        if(dd > Math.PI) dd = Math.PI*2 - dd;
        if(dd < .5){ ok = false; break; }
      }
      if(!ok) continue;
      cd.ang = ang;
      picked.push(cd);
    }
    for(const cd of cands){
      if(picked.length >= count) break;
      if(picked.indexOf(cd) < 0) picked.push(cd);
    }
    const out = [];
    for(let k=0;k<picked.length;k++){
      const cd = picked[k];
      cd.st.t = Math.min(cd.st.t, Math.max(1e-9, cd.p * .97));
      cd.st.fx = (typeof performance !== 'undefined' ? performance.now() : Date.now()) + 700;
      const key = this.key(cd.x, cd.y);
      let list = S.clickLit[key];
      if(!list){ list = S.clickLit[key] = []; }
      if(list.length < 24 && list.indexOf(cd.i) < 0) list.push(cd.i);
      out.push({x:cd.st.wx, y:cd.st.wy, type:cd.st.type, d:cd.d});
    }
    const keys = Object.keys(S.clickLit);
    if(keys.length > 500) delete S.clickLit[keys[0]];
    return out;
  },

  getD(x, y){
    const v = G.S.data.sectorsD[this.key(x, y)];
    return v == null ? 0 : v;
  },
  destroyedTotal(){
    const s = G.S.data.sectorsD;
    let t = 0;
    for(const k in s) t += s[k];
    return t;
  },
  destroyedRatio(){
    return this.visibleCap > 0 ? U.clamp(this.destroyedTotal() / this.visibleCap, 0, 1) : 0;
  },
  deadRatio(x, y){
    return U.clamp(this.getD(x, y) / this.cap(x, y), 0, 1);
  },

  extinguishAt(x, y, amount){
    if(!this.isUnlocked(x,y)) return 0;
    const S = G.S.data, k = this.key(x,y), cap = this.cap(x,y);
    const o = this.get(x,y), d = this.getD(x,y);
    const room = Math.max(0, cap - d);
    const added = Math.min(amount, room, o);
    if(added <= 0) return 0;
    S.sectors[k] = o - added;
    S.sectorsD[k] = d + added;
    if(!S.dark.d6){
      S.observed = Math.max(0, S.observed - added);
    }
    return added;
  },

  extinguishNear(wx, wy, count, radius, minD, target){
    if(count <= 0) return [];
    const S = G.S.data;
    S.clickDead = S.clickDead || {};
    minD = minD || 0;
    target = target || 0;
    const c = this.sectorAtWorld(wx, wy);
    const cands = [];
    for(let oy=-1;oy<=1;oy++) for(let ox=-1;ox<=1;ox++){
      const x = c.x+ox, y = c.y+oy;
      if(!this.isUnlocked(x,y)) continue;
      const p = this.progress(x,y);
      if(p <= 1e-9) continue;
      const arr = this.generate(x,y);
      for(let i=0;i<arr.length;i++){
        const st = arr[i];
        if(st.dead) continue;
        if(st.t >= p) continue;
        const d = Math.hypot(st.wx-wx, st.wy-wy);
        if(d > radius || d < minD) continue;
        cands.push({x, y, i, st, d, p});
      }
    }
    if(!cands.length) return [];
    if(target > 0) cands.sort((a,b)=>Math.abs(a.d-target)-Math.abs(b.d-target));
    else cands.sort((a,b)=>a.d-b.d);
    const out = [];
    for(let k=0;k<cands.length && out.length<count;k++){
      const cd = cands[k];
      cd.st.dead = true;
      cd.st.fx = (typeof performance !== 'undefined' ? performance.now() : Date.now()) + 700;
      const key = this.key(cd.x, cd.y);
      let list = S.clickDead[key];
      if(!list){ list = S.clickDead[key] = []; }
      if(list.length < 30 && list.indexOf(cd.i) < 0) list.push(cd.i);
      out.push({x:cd.st.wx, y:cd.st.wy, type:cd.st.type, d:cd.d});
    }
    const keys = Object.keys(S.clickDead);
    if(keys.length > 500) delete S.clickDead[keys[0]];
    return out;
  },

  reviveAll(){
    const S = G.S.data;
    let restored = 0;
    for(const k in S.sectorsD){
      const v = S.sectorsD[k] || 0;
      if(!v) continue;
      const parts = k.split(',');
      const x = +parts[0], y = +parts[1];
      const cap = this.cap(x, y);
      const o = S.sectors[k] || 0;
      const give = Math.min(v, cap - o);
      if(give > 0){
        S.sectors[k] = o + give;
        restored += give;
      }
      delete S.sectorsD[k];
    }
    S.clickDead = {};
    S.observed += restored;
    S.stats.totalObserved += restored;
    this.cache.clear();
    this.cacheOrder.length = 0;
    return restored;
  },

  reviveSome(amount){
    const S = G.S.data;
    let left = amount, back = 0;
    for(const k in S.sectorsD){
      if(left <= 0) break;
      const v = S.sectorsD[k] || 0;
      if(!v) continue;
      const parts = k.split(',');
      const x = +parts[0], y = +parts[1];
      const give = Math.min(v, left);
      S.sectorsD[k] = v - give;
      if(S.sectorsD[k] <= 0) delete S.sectorsD[k];
      S.sectors[k] = (S.sectors[k] || 0) + give;
      left -= give; back += give;
    }
    S.observed += back;
    S.stats.totalObserved += back;
    this.cache.clear();
    this.cacheOrder.length = 0;
    return back;
  },

  starThreshold(x, y, i){
    return this.generate(x,y)[i] ? this.generate(x,y)[i].t : 1;
  },
  litCount(x, y){
    const arr = this.generate(x,y);
    const p = this.progress(x,y);
    if(p >= 1) return arr.length;
    return Math.ceil(p * arr.length);
  },

  allocate(dps, dt, cx, cy){
    if(dps <= 0 || dt <= 0) return {added:0, overflow:0, completions:[]};
    let budget = dps * dt;
    const wanted = budget;
    const cands = this.ensureIncomplete();
    const cc = this.sectorAtWorld(cx, cy);
    const picked = [];
    let radius = 5;
    while(picked.length < 7 && radius <= 30){
      picked.length = 0;
      for(let i=0;i<cands.length;i++){
        const c = cands[i];
        if(Math.abs(c.x - cc.x) <= radius && Math.abs(c.y - cc.y) <= radius) picked.push(c);
      }
      radius += 3;
    }
    if(picked.length === 0){
      for(let i=0;i<cands.length && i<8;i++) picked.push(cands[i]);
    }
    let wsum = 0;
    const ws = [];
    for(let i=0;i<picked.length;i++){
      const d = Math.hypot(picked[i].x - cc.x, picked[i].y - cc.y);
      const w = 1 / (1 + d * d * .55);
      ws.push(w); wsum += w;
    }
    const completions = [];
    let addedTotal = 0;
    for(let i=0;i<picked.length;i++){
      const share = budget * (ws[i]/wsum);
      const res = this.observeAt(picked[i].x, picked[i].y, share);
      addedTotal += res.added;
      if(res.completed) completions.push(res);
    }
    if(addedTotal < budget * .02 && cands.length === 0){ /* all full */ }
    return {added:addedTotal, overflow: Math.max(0, wanted - addedTotal), completions};
  },

  nearestStar(wx, wy, maxDist){
    const c = this.sectorAtWorld(wx, wy);
    let best = null, bd = maxDist || 26;
    for(let oy=-1;oy<=1;oy++) for(let ox=-1;ox<=1;ox++){
      const sx = c.x+ox, sy = c.y+oy;
      if(!this.isUnlocked(sx,sy)) continue;
      const arr = this.generate(sx,sy);
      for(let i=0;i<arr.length;i++){
        const st = arr[i];
        const d = Math.hypot(st.wx - wx, st.wy - wy);
        if(d < bd){ bd = d; best = {sx, sy, i, star:st, dist:d}; }
      }
    }
    return best;
  },

  randomLitStar(cx, cy, spread){
    spread = spread || 2;
    const c = this.sectorAtWorld(cx, cy);
    const pool = [];
    for(let oy=-spread;oy<=spread;oy++) for(let ox=-spread;ox<=spread;ox++){
      const x=c.x+ox, y=c.y+oy;
      if(!this.isUnlocked(x,y)) continue;
      const p = this.progress(x,y);
      if(p <= 0.02) continue;
      pool.push({x,y,p});
    }
    if(!pool.length) return null;
    const pick = pool[Math.floor(Math.random()*pool.length)];
    const arr = this.generate(pick.x, pick.y);
    const maxI = Math.max(1, Math.floor(pick.p * arr.length));
    const st = arr[Math.floor(Math.random()*maxI)];
    return {x:st.wx, y:st.wy, star:st, ring:this.ring(pick.x,pick.y)};
  },

  resetRun(){
    const S = G.S.data;
    S.observed = 0;
    S.dust = 0;
    S.research = 0;
    S.sectors = {};
    S.sectorsD = {};
    S.clickDead = {};
    S.darkMatter = 0;
    S.warnStage = 0;
    S.vision = 1;
    CFG.BUILDINGS.forEach(b=>S.buildings[b.id]=0);
    CFG.MEGAS.forEach(m=>S.megas[m.id]=0);
    S.upgrades = {};
    S.tech = {};
    S.anchors = [];
    S.buffs = [];
    S.combo = 0;
    S.comboT = 0;
    this.cache.clear(); this.cacheOrder.length = 0;
    this.computeVisibleCap();
    this.rebuildIncomplete();
  }
};

G.Universe = Universe;
})();
