(function(){
const G = window.G, CFG = G.CFG;
const SAVE_KEY = 'stargazer_epoch_save_v1';

function defaultState(){
  const buildings = {};
  CFG.BUILDINGS.forEach(b => buildings[b.id] = 0);
  const megas = {};
  CFG.MEGAS.forEach(m => megas[m.id] = 0);
  return {
    v:1,
    dust:0,
    observed:0,
    research:0,
    cores:0,
    fragments:0,
    buildings,
    upgrades:{},
    tech:{},
    vision:1,
    sectors:{},
    sectorsD:{},
    clickLit:{},
    clickDead:{},
    dark:{},
    darkMatter:0,
    fragments:0,
    darkUnlocked:false,
    mode:'observe',
    warnStage:0,
    endings:{},
    megas,
    anchors:[],
    buffs:[],
    faction:null,
    factionUses:{},
    mv:{on:false, lit:0, life:0, req:10, mult:1, mod:null, cycles:0},
    combo:0,
    comboT:0,
    comboVal:1,
    comboGap:0,
    comboSpan:0,
    stats:{
      totalObserved:0, clicks:0, crits:0, meteors:0, bestCombo:0,
      buildingsBuilt:0, megasBuilt:0, prestiges:0, playTime:0, runs:1,
      factionsUsed:{}, researchEarned:0
    },
    logs:[],
    achievements:{},
    settings:{sound:true, music:true, reduceFx:false, autoBuy:false},
    lastSeen:Date.now(),
    lastSave:Date.now(),
    runStart:Date.now(),
    intro:false
  };
}

const S = {
  data: null,
  init(){
    this.data = this.load() || defaultState();
    this.migrate(this.data);
    return this.data;
  },
  migrate(s){
    const d = defaultState();
    for(const k in d) if(!(k in s)) s[k] = d[k];
    for(const k in d.stats) if(!(k in s.stats)) s.stats[k] = d.stats[k];
    for(const k in d.settings) if(!(k in s.settings)) s.settings[k] = d.settings[k];
    CFG.BUILDINGS.forEach(b=>{ if(typeof s.buildings[b.id] !== 'number') s.buildings[b.id]=0; });
    CFG.MEGAS.forEach(m=>{ if(typeof s.megas[m.id] !== 'number') s.megas[m.id]=0; });
    Object.keys(s.sectors||{}).forEach(k=>{
      if(typeof s.sectors[k] !== 'number' || !isFinite(s.sectors[k])) delete s.sectors[k];
    });
    s.buffs = (s.buffs||[]).filter(b=>b && b.until > Date.now());
    if(!s.clickLit || typeof s.clickLit !== 'object') s.clickLit = {};
    if(!s.clickDead || typeof s.clickDead !== 'object') s.clickDead = {};
    if(!s.sectorsD || typeof s.sectorsD !== 'object') s.sectorsD = {};
    if(!s.dark || typeof s.dark !== 'object') s.dark = {};
    if(!s.endings || typeof s.endings !== 'object') s.endings = {};
    if(!s.mv || typeof s.mv !== 'object') s.mv = {on:false, lit:0, life:0, req:10, mult:1, mod:null, cycles:0};
    if(typeof s.mv.lit !== 'number') s.mv.lit = 0;
    if(typeof s.mv.life !== 'number') s.mv.life = 0;
    if(typeof s.mv.req !== 'number') s.mv.req = 10;
    if(typeof s.mv.mult !== 'number') s.mv.mult = 1;
    if(typeof s.mv.cycles !== 'number') s.mv.cycles = 0;
    if(s.stats.prestiges > 0) s.mv.on = true;
    if(s.mode !== 'extinguish') s.mode = 'observe';
    s.vision = G.U.clamp(s.vision|0, 1, CFG.VISIONS.length);
  },
  save(){
    if(!this.data) return;
    this.data.lastSeen = Date.now();
    this.data.lastSave = Date.now();
    try{
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
    }catch(e){ /* storage full or blocked */ }
  },
  load(){
    try{
      const raw = localStorage.getItem(SAVE_KEY);
      if(!raw) return null;
      const s = JSON.parse(raw);
      if(!s || s.v !== 1) return null;
      return s;
    }catch(e){ return null; }
  },
  wipe(){
    try{ localStorage.removeItem(SAVE_KEY); }catch(e){}
    this.data = defaultState();
  }
};

G.S = S;
G.defaultState = defaultState;
})();
