(function(){
const G = window.G, CFG = G.CFG, U = G.U, Uni = G.Universe, Bus = G.Bus;

const AVG_VALUE = 2.6;
const PRESTIGE_AT = 1e11;
const B_MILESTONES = [12,30,60,110,170,240,320];

const Econ = {
  buyQty: 1,
  derived:null,
  lastMilestoneCheck:0,
  autoTimer:0,

  init(){
    const S = G.S.data;
    if(!S.milestones) S.milestones = {};
    if(!S.coreUpgrades) S.coreUpgrades = {};
    if(!S.anchors) S.anchors = [];
    this.recalc();
    Uni.computeVisibleCap();
    Uni.rebuildIncomplete();
  },

  buffMult(){
    const now = Date.now();
    let m = 1, click = 1;
    const S = G.S.data;
    S.buffs = S.buffs.filter(b=>b.until > now);
    for(const b of S.buffs){
      if(b.kind === 'mult') m *= b.value;
      if(b.kind === 'click') click *= b.value;
    }
    return {mult:m, click};
  },

  collectionBonus(){
    const S = G.S.data;
    const achs = Object.keys(S.achievements||{}).length;
    const logs = (S.logs||[]).length;
    return 1 + achs * 0.01 + logs * 0.004;
  },

  megaMult(){
    const S = G.S.data;
    let m = 1;
    for(const def of CFG.MEGAS){
      const c = S.megas[def.id] || 0;
      if(c) m *= Math.pow(def.mult, c);
    }
    return m;
  },

  faction(){
    return CFG.FACTIONS.find(f=>f.id === G.S.data.faction) || null;
  },

  visionInfo(){
    return CFG.VISIONS[G.S.data.vision - 1];
  },
  chapterIndex(){
    return CFG.VISIONS[G.S.data.vision - 1].chapter;
  },
  chapterName(){
    return CFG.CHAPTERS[this.chapterIndex()].name;
  },

  recalc(){
    const S = G.S.data;
    const techMult = CFG.TECH.reduce((m,t)=> S.tech[t.id] ? m * (t.g||1) : m, 1);
    const fac = this.faction();
    let facMult = 1, clickFaction = 1, valueMult = 1, critBonus = 0, offlineEff = .5, offlineHours = 2;
    if(fac){
      if(fac.id === 'f1') facMult *= 1.5;
      if(fac.id === 'f2'){ clickFaction *= 5; critBonus += .10; facMult *= .7; }
      if(fac.id === 'f3'){ offlineEff = 1; offlineHours = 24; clickFaction *= .5; }
    }
    if(S.tech.t3) valueMult *= 2;
    if(S.tech.t6){ offlineEff = .8; offlineHours = 8; }
    if(S.coreUpgrades.u9) offlineEff += .15;
    const buffs = this.buffMult();
    const coreRate = S.coreUpgrades.u4 ? .08 : .05;
    const coreMult = 1 + (S.cores||0) * coreRate;
    const vis = this.visionInfo();
    const dark = S.dark || {};
    const ratio = Uni.destroyedRatio();
    const backlashRed = dark.d2 ? .3 : 0;
    const penalty = U.clamp(ratio * .8 * (1 - backlashRed), 0, .9);
    const darkGlobal = dark.d7 ? 2 : 1;
    const mv = S.mv || {};
    const mvMod = (mv.mod && typeof mv.mod === 'object') ? mv.mod : {};
    const mvMult = mv.mult || 1;
    const global = techMult * facMult * coreMult * this.collectionBonus() * this.megaMult()
      * vis.scale * buffs.mult * (1 - penalty) * darkGlobal * mvMult * (mvMod.global || 1);

    let dps = 0;
    const perBuilding = {};
    for(const def of CFG.BUILDINGS){
      const c = S.buildings[def.id] || 0;
      if(!c){ perBuilding[def.id] = 0; continue; }
      let ms = 0;
      for(const th of B_MILESTONES) if(c >= th) ms++;
      const out = def.out * c * Math.pow(1.7, ms) * global;
      perBuilding[def.id] = out;
      dps += out;
    }
    dps *= (mvMod.build || 1);

    let clickMul = 1;
    let clickPct = 0;
    for(const up of CFG.CLICK_UPGRADES){
      if(!S.upgrades[up.id]) continue;
      if(up.mul) clickMul *= up.mul;
      if(up.pct) clickPct += up.pct;
      if(up.crit) critBonus += up.crit;
    }
    if(S.tech.t4) clickMul *= 5;
    if(S.tech.t14) clickMul *= 1.5;
    if(S.coreUpgrades.u1) clickMul *= 10;
    clickMul *= clickFaction * buffs.click * (mvMod.click || 1);
    critBonus += (mvMod.crit || 0);

    const clickStars = clickMul + clickPct * dps;
    const critChance = U.clamp(.02 + critBonus, 0, .85);

    const areaStars = S.tech.t14 ? 5 : 1;
    let bounceTimes = 0, bounceStars = 0;
    if(S.tech.t16){ bounceTimes = 2; bounceStars = 6; }
    else if(S.tech.t15){ bounceTimes = 1; bounceStars = 3; }
    if(dark.d5){ bounceTimes += 1; bounceStars += 3; }
    const resonance = !!S.tech.t17;
    let chainMult = 1 + 0.06 * Math.max(0, areaStars - 1);
    if(bounceTimes > 0){
      if(resonance){
        for(let i=0;i<bounceTimes;i++) chainMult *= (1 + 0.25 * bounceStars);
      } else {
        chainMult *= 1 + 0.18 * bounceStars * bounceTimes;
      }
    }

    this.derived = {
      dps, global, techMult, coreMult, collection: this.collectionBonus(), mega: this.megaMult(),
      visionScale: vis.scale, clickMul, clickPct, clickStars, critChance,
      valueMult, offlineEff, offlineHours, perBuilding, coreRate,
      areaStars, bounceTimes, bounceStars, resonance, chainMult,
      penalty, ratio, darkMatterMult: 5 * (dark.d7 ? 2 : 1) * (mvMod.dm || 1),
      dmEff: (dark.d3 ? 5 : 1) * (dark.d7 ? 3 : 1),
      darkGlobal, backlashRed,
      researchMul: (fac && fac.id === 'f1' ? 1.3 : 1) * (mvMod.research || 1)
    };
    return this.derived;
  },

  get d(){ return this.derived || this.recalc(); },

  price(def, owned, qty){
    let total = 0;
    for(let i=0;i<qty;i++) total += def.base * Math.pow(1.175, owned + i);
    return total;
  },
  maxAffordable(def){
    const S = G.S.data;
    let n = 0, total = 0;
    while(n < 1000){
      const p = def.base * Math.pow(1.175, S.buildings[def.id] + n);
      if(total + p > S.dust) break;
      total += p; n++;
    }
    return n;
  },
  buildingUnlocked(def){
    const S = G.S.data;
    if(def.tech && !S.tech[def.tech]) return false;
    if(def.vision && S.vision < def.vision) return false;
    if(def.need && S.observed < def.need && !(S.buildings[def.id] > 0)) return false;
    return true;
  },
  buyBuilding(def, qty){
    const S = G.S.data, owned = S.buildings[def.id] || 0;
    if(!this.buildingUnlocked(def)) return false;
    if(qty === 'max') qty = Math.max(1, this.maxAffordable(def));
    const cost = this.price(def, owned, qty);
    if(cost > S.dust) return false;
    S.dust -= cost;
    S.buildings[def.id] = owned + qty;
    S.stats.buildingsBuilt += qty;
    this.recalc();
    Bus.emit('buy', {type:'building', id:def.id, qty});
    return true;
  },

  buyUpgrade(def){
    const S = G.S.data;
    if(S.upgrades[def.id]) return false;
    if(S.dust < def.cost) return false;
    S.dust -= def.cost;
    S.upgrades[def.id] = true;
    this.recalc();
    Bus.emit('buy', {type:'upgrade', id:def.id});
    return true;
  },

  techAvailable(t){
    const S = G.S.data;
    if(S.tech[t.id]) return false;
    if(t.req && t.req.some(r=>!S.tech[r])) return false;
    if(t.pres && S.stats.prestiges < t.pres) return false;
    return true;
  },
  techCost(t){
    const S = G.S.data;
    return Math.ceil(t.cost * (this.faction() && this.faction().id === 'f1' ? .7 : 1));
  },
  buyTech(t){
    const S = G.S.data;
    if(!this.techAvailable(t)) return false;
    const cost = this.techCost(t);
    if(S.research < cost) return false;
    S.research -= cost;
    S.tech[t.id] = true;
    if(t.vis){
      S.vision = Math.min(CFG.VISIONS.length, S.vision + t.vis);
      Uni.computeVisibleCap();
      Uni.incomplete = null;
      Bus.emit('visionUp', S.vision);
    }
    this.recalc();
    Bus.emit('buy', {type:'tech', id:t.id});
    return true;
  },

  megaUnlocked(def){
    const S = G.S.data;
    if(def.tech && !S.tech[def.tech]) return false;
    if(def.req && !(S.megas[def.req] > 0)) return false;
    return true;
  },
  megaCost(def, count){ return def.cost * Math.pow(8, count); },
  buyMega(def){
    const S = G.S.data;
    if(!this.megaUnlocked(def)) return false;
    const c = S.megas[def.id] || 0;
    if(c >= def.max) return false;
    const cost = this.megaCost(def, c);
    if(S.dust < cost) return false;
    S.dust -= cost;
    S.megas[def.id] = c + 1;
    S.stats.megasBuilt++;
    const anchor = Uni.randomLitStar(this.cameraX || 0, this.cameraY || 0, 2) || {x:0,y:0};
    S.anchors.push({m:def.id, x:anchor.x, y:anchor.y, born:Date.now()});
    this.recalc();
    Bus.emit('megaBuilt', {def, x:anchor.x, y:anchor.y});
    return true;
  },

  comboTier(){
    const S = G.S.data;
    return (S.tech && S.tech.t18 ? 1 : 0) + (S.tech && S.tech.t19 ? 1 : 0) + (S.tech && S.tech.t20 ? 1 : 0);
  },
  comboUpdate(){
    const S = G.S.data, C = CFG.COMBO, tier = this.comboTier();
    const now = U.now();
    const gap = S.comboT ? Math.max(1, now - S.comboT) : 0;
    const win = C.window[tier];
    const maxStreak = (S.tech && S.tech.t21) ? 999999 : 999;
    S.clickTimes = (S.clickTimes || []).filter(x => now - x < 1000);
    S.clickTimes.push(now);
    if(S.clickTimes.length > 48) S.clickTimes.shift();
    const cps = S.clickTimes.length;
    if(gap > 0 && gap < win){
      S.combo = Math.min(maxStreak, (S.combo || 1) + 1);
      S.comboGap = S.comboGap ? S.comboGap * .7 + gap * .3 : gap;
      S.comboSpan = Math.min(C.durSec, (S.comboSpan || 0) + Math.min(gap, 600) / 1000);
    } else {
      S.combo = 1;
      S.comboGap = 0;
      S.comboSpan = 0;
    }
    S.comboT = now;
    if(S.combo > (S.stats.bestCombo || 0)) S.stats.bestCombo = S.combo;
    let top = C.cpsTop[tier];
    if((S.comboSpan || 0) >= C.durSec) top = Math.max(6, Math.round(top * .8));
    let target;
    if(cps <= 5){
      target = 1 + U.clamp((cps - 1) / 4, 0, 1);
    } else {
      target = 2 + U.clamp((cps - 5) / Math.max(1, top - 5), 0, 1) * (C.cap - 2);
    }
    if(S.tech && S.tech.t21 && cps > top){
      const streak = Math.max(0, (S.combo || 1) - 800) / 800;
      target = Math.min(99, target + (cps - top) / Math.max(1, top - 5) * (C.cap - 2)
        + 3 * Math.log10(1 + streak));
    }
    S.comboVal = Math.max(S.comboVal || 1, target);
    return S.comboVal;
  },
  tickCombo(dt){
    const S = G.S.data, C = CFG.COMBO, tier = this.comboTier();
    if(!S.comboVal || S.comboVal <= 1.0001) return;
    const idle = U.now() - (S.comboT || 0) - C.window[tier];
    if(idle <= 0) return;
    S.comboVal = Math.max(1, S.comboVal - C.decay[tier] * dt);
    S.comboSpan = Math.max(0, (S.comboSpan || 0) - dt * 2);
    if(idle > 2200){ S.combo = 0; S.comboGap = 0; S.comboSpan = 0; }
  },

  click(wx, wy){
    const S = G.S.data, d = this.d;
    S.stats.clicks++;
    const comboMult = this.comboUpdate();

    const crit = Math.random() < d.critChance;
    let stars = d.clickStars * comboMult * (crit ? 10 : 1) * d.chainMult;
    if(crit) S.stats.crits++;

    const sec = Uni.sectorAtWorld(wx, wy);
    if(!Uni.isUnlocked(sec.x, sec.y)){
      return {gain:0, crit, locked:true, combo:S.combo, comboMult, stars:0};
    }
    const layer = Uni.layerOf(G.Renderer ? G.Renderer.cam.zoom : .6);
    if(layer.id === 'arm' || layer.id === 'galaxy' || layer.id === 'universe'){
      return {gain:0, crit:false, readonly:true, layer:layer.id, combo:S.combo, comboMult,
        stars:0, chain:[], chainMult:1, x:sec.x, y:sec.y};
    }
    const res = layer.id === 'const'
      ? Uni.observeConstellation(sec.x, sec.y, stars)
      : Uni.observeAt(sec.x, sec.y, stars);
    if(res.added <= 0){
      this.recalc();
      return {gain:0, crit, locked:false, capped:true, combo:S.combo, comboMult, stars:0, dust:0,
        x:sec.x, y:sec.y, layer:layer.id, chain:[], chainMult:1};
    }
    const dustGain = res.added * AVG_VALUE * d.valueMult * (this.faction() && this.faction().id === 'f4' ? .5 : 1);
    S.dust += dustGain;
    if(res.completed) Bus.emit('sectorComplete', {x:sec.x, y:sec.y, research:CFG.sectorResearch(Uni.ring(sec.x,sec.y)), ring:Uni.ring(sec.x,sec.y)});

    const chain = [];
    const litCount = Math.min(14, d.areaStars * (crit ? 10 : 1)) * (layer.id === 'const' ? 2 : 1);
    const radius = layer.id === 'const' ? 190 : (crit ? 88 : 62);
    const area = Uni.lightNear(wx, wy, litCount, radius, 6, layer.id === 'const' ? 60 : 30, true);
    for(const pt of area) chain.push({fx:wx, fy:wy, x:pt.x, y:pt.y, type:pt.type, delay:0, hop:0});
    let wave = area;
    for(let h=1; h<=d.bounceTimes; h++){
      if(!wave.length) break;
      const origins = wave.slice(0, 3);
      const per = Math.max(1, Math.ceil(d.bounceStars / origins.length));
      const next = [];
      for(const o of origins){
        const pts = Uni.lightNear(o.x, o.y, per, 92, 34, 62, false);
        for(const pt of pts){
          chain.push({fx:o.x, fy:o.y, x:pt.x, y:pt.y, type:pt.type, delay:130*h, hop:h});
          next.push(pt);
        }
      }
      wave = next;
    }

    this.recalc();
    return {gain:res.added, crit, locked:false, combo:S.combo, comboMult, stars:res.added, dust:dustGain,
      x:sec.x, y:sec.y, layer:layer.id,
      overflow:res.overflow||0, chain, chainMult:d.chainMult};
  },

  toggleMode(){
    const S = G.S.data;
    if(!S.dark.d1) return false;
    S.mode = S.mode === 'extinguish' ? 'observe' : 'extinguish';
    this.recalc();
    Bus.emit('modeChange', S.mode);
    return true;
  },

  extinguishClick(wx, wy){
    const S = G.S.data, d = this.d;
    if(!S.dark.d1) return {locked:true};
    const sec = Uni.sectorAtWorld(wx, wy);
    if(!Uni.isUnlocked(sec.x, sec.y)) return {locked:true};
    S.stats.clicks++;
    const t = U.now();
    if(t - S.comboT < 420) S.combo = Math.min(300, (S.combo||0) + 1);
    else S.combo = 1;
    S.comboT = t;
    if(S.combo > S.stats.bestCombo) S.stats.bestCombo = S.combo;
    const comboBonus = 1 + Math.min(1, Math.floor(S.combo/10) * .05);

    const amount = d.clickStars * comboBonus * d.chainMult * d.dmEff;
    const applied = Uni.extinguishAt(sec.x, sec.y, amount);
    if(applied <= 0){
      this.recalc();
      return {gain:0, full:true, combo:S.combo, stars:0};
    }
    S.stats.extinguished = (S.stats.extinguished||0) + applied;
    const dm = applied * AVG_VALUE * d.darkMatterMult;
    S.darkMatter += dm;
    let dustGain = 0;
    if(S.dark.d4){
      dustGain = applied * AVG_VALUE * d.valueMult;
      S.dust += dustGain;
    }
    if(S.dark.d6){
      S.observed += applied;
      S.stats.totalObserved += applied;
    }

    const chain = [];
    const area = Uni.extinguishNear(wx, wy, d.areaStars + 2, 62, 0, 26);
    for(const pt of area) chain.push({fx:wx, fy:wy, x:pt.x, y:pt.y, type:pt.type, delay:0, hop:0, dead:true});
    let wave = area;
    for(let h=1; h<=d.bounceTimes; h++){
      if(!wave.length) break;
      const origins = wave.slice(0, 3);
      const per = Math.max(1, Math.ceil(d.bounceStars / origins.length));
      const next = [];
      for(const o of origins){
        const pts = Uni.extinguishNear(o.x, o.y, per, 96, 30, 60);
        for(const pt of pts){
          chain.push({fx:o.x, fy:o.y, x:pt.x, y:pt.y, type:pt.type, delay:130*h, hop:h, dead:true});
          next.push(pt);
        }
      }
      wave = next;
    }
    this.checkMilestones();
    this.checkEndings();
    this.recalc();
    return {gain:applied, dm, dust:dustGain, combo:S.combo, stars:amount, chain,
      chainMult:d.chainMult, x:sec.x, y:sec.y, extinguish:true};
  },

  darkAvailable(def){
    const S = G.S.data;
    if(!S.darkUnlocked) return false;
    if(S.dark[def.id]) return false;
    return true;
  },
  darkCost(def){
    return {dm:def.cost.dm||0, frag:def.cost.frag||0};
  },
  buyDarkTech(def){
    const S = G.S.data;
    if(!this.darkAvailable(def)) return false;
    const c = def.cost;
    if((c.dm||0) > S.darkMatter) return false;
    if((c.frag||0) > S.fragments) return false;
    S.darkMatter -= c.dm||0;
    S.fragments -= c.frag||0;
    S.dark[def.id] = true;
    if(def.id === 'd9') Uni.reviveAll();
    this.recalc();
    Bus.emit('buy', {type:'dark', id:def.id});
    return true;
  },

  checkEndings(){
    const S = G.S.data;
    const ratio = Uni.destroyedRatio();
    for(let i=0;i<CFG.WARN_STAGES.length;i++){
      const st = CFG.WARN_STAGES[i];
      if(ratio >= st.ratio && (S.warnStage|0) < i+1){
        S.warnStage = i+1;
        if(!S.logs.includes(st.log)) S.logs.push(st.log);
        Bus.emit('warnStage', {stage:i+1, info:st, ratio});
      }
    }
    if(S.observed >= 1e24 && ratio < .1 && !S.endings.door){
      S.endings.door = true;
      Bus.emit('ending', {kind:'door'});
    }
    if(S.dark.d10 && ratio >= .995 && !S.endings.zero && !S.endings.last && !S.finalPending){
      S.finalPending = true;
      Bus.emit('finalChoice');
    }
    if(S.endings.door && S.endings.zero && !S.endings.echo){
      S.endings.echo = true;
      if(!S.logs.includes(50)) S.logs.push(50);
      Bus.emit('trueEnding');
    }
  },

  resolveFinal(extinguish){
    const S = G.S.data;
    S.finalPending = false;
    if(extinguish){
      S.endings.zero = true;
      if(!S.logs.includes(48)) S.logs.push(48);
      Bus.emit('ending', {kind:'zero'});
    } else {
      S.endings.last = true;
      if(!S.logs.includes(49)) S.logs.push(49);
      Bus.emit('ending', {kind:'last'});
    }
    this.recalc();
  },

  vacuum(){
    const S = G.S.data, d = this.d;
    if(!S.dark.d8) return false;
    const now = Date.now();
    if(now < (S.vacuumAt || 0)) return false;
    S.vacuumAt = now + 300000;
    let left = Uni.visibleCap * .05, hit = 0;
    const R = Uni.visionRing();
    for(let y=-R;y<=R && left > 1e-6;y++){
      for(let x=-R;x<=R && left > 1e-6;x++){
        if(Uni.ring(x,y) > R) continue;
        const o = Uni.get(x,y);
        if(o <= 0) continue;
        const got = Uni.extinguishAt(x, y, Math.min(left, o));
        left -= got;
        hit += got;
      }
    }
    S.stats.extinguished = (S.stats.extinguished||0) + hit;
    S.darkMatter += hit * AVG_VALUE * d.darkMatterMult;
    Bus.emit('vacuum', {amount:hit});
    this.checkEndings();
    this.recalc();
    return hit;
  },

  tick(dt, camX, camY){
    const S = G.S.data;
    this.tickCombo(dt);
    this.recalcT = (this.recalcT || 0) + dt;
    if(this.recalcT > .5){ this.recalcT = 0; this.recalc(); }
    const d = this.d;
    const comboShare = 1 + ((S.comboVal || 1) - 1) * CFG.COMBO.dpsShare;
    const dps = d.dps * comboShare;
    let added = 0, overflow = 0;
    if(dps > 0){
      const res = Uni.allocate(dps, dt, camX, camY);
      added = res.added;
      overflow = res.overflow;
      for(const c of res.completions){
        Bus.emit('sectorComplete', {x:c.x, y:c.y, research:0, quiet:true});
      }
    }
    S.dust += dps * dt * AVG_VALUE * d.valueMult * (this.faction() && this.faction().id === 'f4' ? .5 : 1);
    S.stats.playTime += dt;
    if(U.now() - this.lastMilestoneCheck > 400){
      this.lastMilestoneCheck = U.now();
      this.checkMilestones();
      if(S.settings.autoBuy && S.coreUpgrades.u5) this.autoBuy(dt);
    }
    return {added, overflow};
  },

  autoBuy(dt){
    this.autoTimer += dt;
    if(this.autoTimer < 1.4) return;
    this.autoTimer = 0;
    const S = G.S.data;
    let best = null, bestScore = 0;
    for(const def of CFG.BUILDINGS){
      if(!this.buildingUnlocked(def)) continue;
      const owned = S.buildings[def.id] || 0;
      const price = this.price(def, owned, 1);
      if(S.dust < price) continue;
      const score = def.out * Math.pow(1.7, B_MILESTONES.filter(t=>owned>=t).length) / price;
      if(score > bestScore){ bestScore = score; best = def; }
    }
    if(best) this.buyBuilding(best, 1);
  },

  checkMilestones(){
    const S = G.S.data;
    S.milestones = S.milestones || {};
    for(const m of CFG.MILESTONES){
      if(S.observed >= m.n && !S.milestones[m.n]){
        S.milestones[m.n] = true;
        if(m.r){
          S.research += m.r;
          S.stats.researchEarned += m.r;
        }
        if(m.log && !S.logs.includes(m.log)) S.logs.push(m.log);
        Bus.emit('milestone', m);
        if(m.prestige) Bus.emit('prestigeUnlock', m);
      }
    }
  },

  coresFor(n){
    if(n < PRESTIGE_AT) return 0;
    return Math.floor(3 * Math.pow(n / PRESTIGE_AT, .5));
  },
  mvTarget(){
    return 3e10;
  },
  mvRequirement(){
    const mv = G.S.data.mv || {};
    return mv.req || 10;
  },
  sealReady(){
    const S = G.S.data;
    return !!(S.mv && S.mv.on) && S.observed >= this.mvTarget();
  },
  mvCoverage(){
    return U.clamp(G.S.data.observed / (CFG.UNIVERSE_STARS || 2e11), 0, 1);
  },
  prestigeReady(){
    const S = G.S.data;
    if(S.stats.prestiges === 0) return S.observed >= PRESTIGE_AT;
    return ((S.mv && S.mv.lit) || 0) >= this.mvRequirement();
  },
  rollMvMod(exclude){
    const mods = CFG.MV_MODS.filter(m=>!exclude || m.id !== exclude);
    return mods[Math.floor(Math.random()*mods.length)] || CFG.MV_MODS[0];
  },
  softReset(keepBuildings){
    const S = G.S.data;
    const keepTech = S.tech || {}, keepVision = S.vision || 1;
    Uni.resetRun();
    S.tech = keepTech;
    S.vision = keepVision;
    S.clickLit = {};
    S.observed = 0;
    S.dust = 0;
    S.research = 0;
    S.milestones = {};
    S.upgrades = {};
    S.buffs = [];
    S.anchors = [];
    S.megaAnchors = [];
    S.combo = 0; S.comboT = 0;
    S.dark = {};
    S.mode = 'observe';
    S.finalPending = false;
    S.buildings = {};
    CFG.BUILDINGS.forEach(b=>S.buildings[b.id]=0);
    S.megas = {};
    CFG.MEGAS.forEach(m=>S.megas[m.id]=0);
    if(keepBuildings){ S.buildings.b1 = 10; S.buildings.b2 = 5; }
    S.runStart = Date.now();
    Uni.computeVisibleCap();
    Uni.rebuildIncomplete();
    this.recalc();
  },
  sealUniverse(){
    const S = G.S.data;
    if(!this.sealReady()) return null;
    const mod = this.rollMvMod(S.mv.mod && S.mv.mod.id);
    S.mv.lit = (S.mv.lit || 0) + 1;
    S.mv.life = (S.mv.life || 0) + 1;
    S.mv.mult = (S.mv.mult || 1) * 1.15;
    S.cores += 1;
    this.softReset(false);
    S.mv.mod = mod;
    this.recalc();
    Bus.emit('universeSeal', {lit:S.mv.lit, mod});
    return {cores:1, mvMult:S.mv.mult, mod, lit:S.mv.lit, req:this.mvRequirement()};
  },

  doPrestige(factionId){
    const S = G.S.data;
    if(!this.prestigeReady()) return false;
    const first = S.stats.prestiges === 0;
    const cores = first ? this.coresFor(S.observed) : Math.max(3, Math.round(this.mvRequirement() * 2)) + Math.floor((S.mv.life || 0) * .5);
    S.cores += cores;
    S.stats.prestiges++;
    S.stats.runs++;
    if(factionId){ S.faction = factionId; S.stats.factionsUsed = S.stats.factionsUsed || {}; S.stats.factionsUsed[factionId] = true; }
    const keepLogs = S.logs, keepAch = S.achievements, keepStats = S.stats;
    const keepUpgrades = S.coreUpgrades, keepSettings = S.settings, keepFaction = S.faction;
    const keepTech = S.tech || {}, keepVision = S.vision || 1;
    const keepResearch = keepUpgrades.u6 ? Math.floor(S.research * .25) : 0;
    const keepMv = S.mv || {};
    this.softReset(false);
    S.logs = keepLogs;
    S.achievements = keepAch;
    S.stats = keepStats;
    S.coreUpgrades = keepUpgrades;
    S.settings = keepSettings;
    S.faction = keepFaction;
    S.tech = keepTech;
    S.vision = Math.max(keepVision, keepUpgrades.u3 ? 2 : 1);
    S.research = keepResearch;
    S.mv = keepMv;
    S.mv.on = true;
    S.mv.lit = 0;
    if(first){
      S.mv.req = 10;
    } else {
      S.mv.req = 10 * Math.pow(10, S.stats.prestiges - 1);
      S.mv.mult = (S.mv.mult || 1) * 2;
      S.mv.cycles = (S.mv.cycles || 0) + 1;
    }
    if(!S.mv.mod) S.mv.mod = this.rollMvMod();
    if(keepUpgrades.u2){ S.buildings.b1 = 10; S.buildings.b2 = 5; }
    if(keepUpgrades.u8){ S.megas.m1 = 1; S.anchors.push({m:'m1', x:0, y:0, born:Date.now()}); }
    Uni.computeVisibleCap();
    Uni.rebuildIncomplete();
    this.recalc();
    Bus.emit('prestige', {cores});
    return {cores};
  },

  buyCore(id){
    const S = G.S.data;
    const def = CFG.CORE_UPGRADES.find(u=>u.id===id);
    if(!def || S.coreUpgrades[id]) return false;
    if(S.cores < def.cost) return false;
    S.cores -= def.cost;
    S.coreUpgrades[id] = true;
    this.recalc();
    return true;
  },

  offlineEarnings(seconds){
    const d = this.d;
    const cap = d.offlineHours * 3600;
    const sec = Math.min(seconds, cap);
    const stars = d.dps * sec * d.offlineEff;
    const dust = stars * AVG_VALUE * d.valueMult;
    return {seconds:sec, stars, dust, capped: seconds > cap};
  },
  applyOffline(seconds){
    const S = G.S.data;
    const e = this.offlineEarnings(seconds);
    if(e.stars <= 0) return null;
    let left = e.stars;
    for(let i=0;i<48 && left > 1e-9;i++){
      const res = Uni.allocate(left/8, 1, 0, 0);
      left -= res.added;
      if(res.added <= 0) break;
    }
    S.dust += e.dust;
    this.checkMilestones();
    this.recalc();
    return e;
  }
};

G.Econ = Econ;
G.AVG_VALUE = AVG_VALUE;
G.PRESTIGE_AT = PRESTIGE_AT;
})();
