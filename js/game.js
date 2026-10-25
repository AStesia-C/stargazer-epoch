(function(){
const G = window.G, CFG = G.CFG, U = G.U, Uni = G.Universe, Econ = G.Econ, R = G.Renderer, UI = G.UI;

const Game = {
  last:0, acc:0, speed:1, meteorT:0, nextMeteor:70, eventT:0, nextEvent:180,
  achT:0, saveT:0, started:false, awayAt:0,

  boot(){
    const S = G.S.init();
    Uni.computeVisibleCap();
    Econ.init();
    R.init(document.getElementById('map'));
    UI.init();

    R.onTap = (wx, wy, sx, sy, near)=>this.tap(wx, wy, sx, sy, near);
    this.bindBus();
    this.offlineCheck();
    this.bindLifecycle();

    if(!S.intro){
      S.intro = true;
      setTimeout(()=>UI.openIntro(), 650);
    }

    this.last = performance.now();
    requestAnimationFrame(t=>this.loop(t));
    this.debugSetup();
    this.started = true;
  },

  bindBus(){
    G.Bus.on('warnStage', (w)=>{
      UI.toast('警告 · ' + w.info.text, 'red');
      UI.flashRed();
      G.Audio.warn(w.stage);
    });
    G.Bus.on('modeChange', (mode)=>{
      UI.toast(mode === 'extinguish' ? '熄灭模式' : '观测模式', mode === 'extinguish' ? 'red' : '');
      UI.updateMode();
    });
    G.Bus.on('vacuum', (v)=>{
      UI.toast('真空衰变 · 熄灭 ' + U.fmt(v.amount) + ' 颗恒星', 'red');
      UI.flashRed();
    });
    G.Bus.on('finalChoice', ()=>this.finalChoice());
    G.Bus.on('ending', (e)=>this.ending(e.kind));
    G.Bus.on('trueEnding', ()=>{
      UI.cinema({big:'回 声', small:'真结局 · 门后是上一轮的自己', dur:6000});
    });
    G.Bus.on('milestone', (m)=>{
      if(m.ending){
        UI.toast('里程碑 · 全天星表', 'gold');
        UI.flash();
        return;
      }
      const label = m.name;
      UI.toast(label + (m.r ? '  +' + m.r + ' 研究' : ''), 'gold');
      G.Audio.milestone();
      UI.flash();
      if(!m.prestige && [1e6,1e9,1e11,1e15,1e18,1e21].includes(m.n)){
        UI.cinema({big:m.name, small:fmtNum(m.n) + ' 颗恒星已记录', dur:3000});
      }
      if(m.prestige) UI.toast('跃迁解锁', 'gold');
    });
    G.Bus.on('sectorComplete', (c)=>{
      const now = U.now();
      if(!c.quiet && now - (this._lastSectorFx || 0) > 260){
        this._lastSectorFx = now;
        const wx = c.x*100, wy = c.y*100;
        R.addSectorBurst(wx, wy, '#ffd36b');
        R.addFloat((wx - R.cam.x)*R.cam.zoom + R.cx, (wy - R.cam.y)*R.cam.zoom + R.cy,
          '+' + c.research + ' 研究点', '#ffd36b', 12);
        G.Audio.sector();
      }
    });
    G.Bus.on('visionUp', ()=>{
      const S = G.S.data;
      UI.updateChapter(true);
      R.setVision();
      UI.flash();
      G.Audio.milestone();
      UI.cinema({big:'视野 ' + G.ROMAN[S.vision-1], small:Econ.visionInfo().name, dur:2400});
    });
    G.Bus.on('megaBuilt', (m)=>{
      const def = m.def;
      UI.cinema({big:def.name, small:'巨构工程 · 已建成', dur:3000});
      UI.flash();
      G.Audio.prestige();
      UI.toast('全局产出 ×' + def.mult, 'gold');
    });
    G.Bus.on('buy', (b)=>{ if(b.type === 'building') G.Audio.buy(); });
    G.Bus.on('prestigeUnlock', ()=>{});
  },

  tap(wx, wy, sx, sy, near){
    const S = G.S.data;
    if(!this.firstTouch){
      this.firstTouch = true;
      G.Audio.resume();
      if(S.settings.music) G.Audio.startMusic();
    }
    const met = R.hitMeteor(sx, sy);
    if(met){
      this.collectMeteor(met, sx, sy);
      return;
    }
    if(S.mode === 'extinguish' && S.dark.d1){
      this.extinguishTap(wx, wy, sx, sy);
      return;
    }
    const res = Econ.click(wx, wy);
    if(res.locked){
      R.addRipple(sx, sy, '#2f3a52');
      return;
    }
    if(res.readonly){
      R.addRipple(sx, sy, '#5b6b8c');
      R.flyTo(wx, wy, .5, 700);
      return;
    }
    if(res.capped){
      R.addRipple(sx, sy, '#5b6b8c');
      return;
    }
    const combo = res.combo || 1;
    const color = res.crit ? '#ffd36b' : (combo >= 50 ? '#d6b4ff' : combo >= 20 ? '#9fd0ff' : '#eaf2ff');
    R.addRipple(sx, sy, res.crit ? '#ffd36b' : '#9fd0ff');
    if(res.chain && res.chain.length){
      for(const c of res.chain){
        R.addBolt(c.fx, c.fy, c.x, c.y, c.delay, c.type, c.hop > 0);
        if(c.hop > 0) G.Audio.bounce(c.hop, c.delay);
      }
      if(res.chainMult > 1.02 && (res.crit || this.lastChain !== res.chainMult)){
        this.lastChain = res.chainMult;
        R.addFloat(sx, sy + (res.crit ? 56 : 30), '弹射 ×' + res.chainMult.toFixed(2), '#c8a6ff', 11);
      } else if(res.chainMult <= 1.02){
        this.lastChain = 0;
      }
    }
    if(res.crit){
      R.addShock(sx, sy, '#ffd36b', 1.5);
      R.addFloat(sx, sy - 6, '暴击 +' + U.fmt(res.stars), '#ffd36b', 20);
      G.Audio.crit();
      UI.flash();
    } else {
      R.addFloat(sx, sy - 4, '+' + U.fmt(res.stars), color, combo > 30 ? 15 : 13);
      G.Audio.click(combo);
    }
    if(combo > 0 && combo % 25 === 0){
      R.addFloat(sx, sy + (res.crit ? 34 : 18), combo + ' 连击', '#c8a6ff', 11);
    }
    const cm = res.comboMult || 1;
    if(cm > 1.35 && (res.crit || this.lastComboText !== Math.round(cm*10))){
      this.lastComboText = Math.round(cm*10);
      R.addFloat(sx + 34, sy + (res.crit ? 58 : 26), '连击 ×' + cm.toFixed(1), '#d6b4ff', 11);
    }
    if(near){
      const t = CFG.STAR_TYPES[near.star.type];
      if(t.value >= 1000 && Math.random() < .5){
        R.addFloat(sx + 10, sy + (res.crit ? 82 : 46), t.name + ' ×' + U.fmt(t.value), t.color, 10);
      }
    }
  },

  extinguishTap(wx, wy, sx, sy){
    const res = Econ.extinguishClick(wx, wy);
    if(res.locked){
      R.addRipple(sx, sy, '#2f3a52');
      return;
    }
    if(res.full){
      R.addRipple(sx, sy, '#5b6b8c');
      return;
    }
    R.addRipple(sx, sy, '#d9364a');
    R.addFloat(sx, sy - 4, '-' + U.fmt(res.gain) + ' 颗', '#ff8a9a', 13);
    R.addFloat(sx, sy + 24, '+' + U.fmt(res.dm) + ' 暗物质', '#d9364a', 12);
    if(res.chain && res.chain.length){
      for(const c of res.chain){
        R.addBolt(c.fx, c.fy, c.x, c.y, c.delay, c.type, c.hop > 0, true);
        if(c.hop > 0) G.Audio.bounce(c.hop, c.delay);
      }
    }
    G.Audio.extinguish();
  },

  collectMeteor(met, sx, sy){
    const S = G.S.data;
    S.stats.meteors++;
    G.Audio.meteor();
    if(met.dark){
      S.darkMatter += 5e5;
      if(S.darkUnlocked && Math.random() < .5){
        S.fragments++;
        UI.toast('暗红流星：获得 1 块禁忌碎片', 'red');
      } else {
        UI.toast('暗红流星：获得 50万 暗物质', 'red');
      }
      R.addFloat(sx, sy, '暗物质 +50万', '#d9364a', 14);
      G.Audio.extinguish();
    } else if(met.gold){
      S.buffs.push({kind:'mult', value:7, until:Date.now() + 77000, label:'金色流星 ×7'});
      R.addFloat(sx, sy, '×7 产出 · 77 秒', '#ffd36b', 15);
      UI.toast('金色流星：全局产出 ×7，持续 77 秒', 'gold');
    } else {
      S.buffs.push({kind:'mult', value:2, until:Date.now() + 60000, label:'流星 ×2'});
      R.addFloat(sx, sy, '×2 产出 · 60 秒', '#9fd0ff', 14);
      UI.toast('流星：全局产出 ×2，持续 60 秒');
    }
    Econ.recalc();
  },

  offlineCheck(){
    const S = G.S.data;
    const away = (Date.now() - (S.lastSeen || Date.now())) / 1000;
    if(away < 90) return;
    const d = Econ.d;
    if(d.dps <= 0) { return; }
    const e = Econ.offlineEarnings(away);
    Econ.applyOffline(away);
    UI.openModal({
      title:'观测舰队回来了',
      sub:'OFFLINE REPORT',
      body: (()=>{
        const b = document.createElement('div');
        b.innerHTML = '<div class="stat-line"><span>离开时长</span><b>' + U.fmtTime(away) + '</b></div>' +
          '<div class="stat-line"><span>记录恒星</span><b>' + U.fmt(e.stars) + '</b></div>' +
          '<div class="stat-line"><span>获得星尘</span><b>' + U.fmt(e.dust) + '</b></div>' +
          '<div class="stat-line"><span>效率</span><b>' + Math.round(0.0 + (e.stars / Math.max(1, d.dps * away)) * 100) + '%</b></div>' +
          (e.capped ? '<p style="margin-top:10px">离线收益已达到上限，升级「离线优化」可以记录更久。</p>' : '');
        return b;
      })(),
      actions:[{label:'继续观测', cls:'primary', close:true}]
    });
  },

  bindLifecycle(){
    document.addEventListener('visibilitychange', ()=>{
      if(document.hidden) G.S.save();
      else this.resumeFromAway();
    });
    window.addEventListener('pagehide', ()=>G.S.save());
    window.addEventListener('beforeunload', ()=>G.S.save());
    window.addEventListener('resize', ()=>{
      R.resize();
      if(G.S.data.vision) R.target.zoom = Math.min(R.target.zoom, R.fitZoom()*1.25);
    });
    document.addEventListener('keydown', (e)=>{
      if(e.key === '`' || e.key === '~'){
        const d = document.getElementById('debug');
        if(d) d.classList.toggle('on');
      }
    });
  },

  resumeFromAway(){
    const S = G.S.data;
    const away = (Date.now() - (S.lastSeen || Date.now())) / 1000;
    if(away > 90){
      Econ.applyOffline(away);
      UI.toast('离线 ' + U.fmtTime(away) + '，舰队记录了更多恒星', 'gold');
    }
    S.lastSeen = Date.now();
  },

  loop(now){
    let dt = (now - this.last) / 1000;
    this.last = now;
    if(!isFinite(dt)) dt = 0;
    dt = Math.min(.1, dt) * this.speed;

    this.acc += dt;
    let ticks = 0;
    while(this.acc >= .1 && ticks < 6){
      this.acc -= .1;
      this.tick(.1);
      ticks++;
    }
    R.update(dt);
    R.frame(dt);
    UI.update(dt);

    this.saveT += dt;
    if(this.saveT > 10){ this.saveT = 0; G.S.save(); }

    this.achT += dt;
    if(this.achT > 1){ this.achT = 0; this.checkAchievements(); }

    this.meteorT += dt;
    if(this.meteorT > this.nextMeteor){
      this.meteorT = 0;
      const metMult = (G.S.data.coreUpgrades.u7 ? 2 : 1) *
        (G.S.data.mv && G.S.data.mv.mod && G.S.data.mv.mod.meteor ? G.S.data.mv.mod.meteor : 1);
      this.nextMeteor = (55 + Math.random()*70) / metMult;
      if(G.S.data.stats.clicks > 4) R.spawnMeteor();
    }
    this.eventT += dt;
    if(this.eventT > this.nextEvent){
      this.eventT = 0;
      this.nextEvent = 200 + Math.random()*180;
      this.randomEvent();
    }
    requestAnimationFrame(t=>this.loop(t));
  },

  tick(dt){
    const S = G.S.data;
    Econ.tick(dt, R.cam.x, R.cam.y);
    S.lastSeen = Date.now();
    this.darkT = (this.darkT || 0) + dt;
    if(this.darkT > 3){
      this.darkT = 0;
      this.checkDarkUnlock();
      Econ.checkEndings();
    }
    this.satT = (this.satT || 0) + dt;
    if(this.satT > 6){
      this.satT = 0;
      const full = Uni.ensureIncomplete().length === 0;
      if(full && !this._sat){
        this._sat = true;
        if(Econ.sealReady()) UI.toast('本宇宙已饱和', 'gold');
        else if(Econ.prestigeReady()) UI.toast('星核已齐', 'gold');
        else UI.toast('视野已饱和', 'gold');
      } else if(!full){
        this._sat = false;
      }
    }
  },

  checkAchievements(){
    const S = G.S.data;
    for(const a of CFG.ACHIEVEMENTS){
      if(S.achievements[a.id]) continue;
      let ok = false;
      try{ ok = !!a.cond(S); }catch(e){}
      if(ok){
        S.achievements[a.id] = Date.now();
        G.Audio.tech();
        UI.toast('成就 · ' + a.name + '  (+1% 全局)', 'gold');
        Econ.recalc();
      }
    }
  },

  randomEvent(){
    const S = G.S.data;
    if(S.stats.clicks < 10) return;
    const pool = [
      {
        title:'未知信号', sub:'UNKNOWN SIGNAL',
        text:'一段重复的窄带信号从视野边缘传来。它不像是自然产生的。',
        a:{label:'深入调查', fn:()=>{
          if(Math.random() < .55){
            S.dust += Math.max(1e3, Econ.d.dps * 300) * 2.6;
            UI.toast('信号里藏着观测数据：获得大量星尘', 'gold');
          } else {
            const loss = Math.min(S.dust, Econ.d.dps * 120);
            S.dust -= loss;
            UI.toast('信号是诱饵，损失了一部分星尘', 'red');
          }
        }},
        b:{label:'仅做记录', fn:()=>{
          S.research += 4;
          UI.toast('+4 研究点', 'gold');
        }}
      },
      {
        title:'外星探测器残骸', sub:'WRECKAGE',
        text:'一块金属外壳漂浮在星区间，上面有陌生的编号体系。',
        a:{label:'拆解研究', fn:()=>{
          S.dust += Math.max(2e3, Econ.d.dps * 420) * 2.6;
          UI.toast('拆解完成，获得星尘', 'gold');
        }},
        b:{label:'记录并离开', fn:()=>{
          S.research += 6;
          UI.toast('+6 研究点', 'gold');
        }}
      },
      {
        title:'濒死的红巨星', sub:'DYING STAR',
        text:'它正在膨胀，最后的几千年里，它会亮得足以被整个星系看见。',
        a:{label:'观测最后时刻', fn:()=>{
          S.dust += Math.max(5e3, Econ.d.dps * 700) * 2.6;
          const id = 11;
          if(!S.logs.includes(id)) S.logs.push(id);
          UI.toast('记录完成，日志已归档', 'gold');
        }},
        b:{label:'继续巡天', fn:()=>{
          S.buffs.push({kind:'mult', value:3, until:Date.now()+45000, label:'红巨星余晖 ×3'});
          Econ.recalc();
          UI.toast('余晖照亮星图：×3 产出 45 秒', 'gold');
        }}
      }
    ];
    if(S.darkUnlocked){
      pool.push({
        title:'来自远方的警告', sub:'WARNING',
        text:'一段重复的窄带信号，用我们的语言翻译过来只有两个字：停下来。',
        a:{label:'停下来', fn:()=>{
          const back = G.Universe.reviveSome(G.Universe.destroyedTotal() * .15);
          G.Econ.recalc();
          UI.toast('反噬减轻，' + U.fmt(back) + ' 颗恒星重新亮起', 'gold');
        }},
        b:{label:'无视它', fn:()=>{
          S.fragments += 1;
          UI.toast('+1 禁忌碎片', 'red');
        }}
      });
    }
    const ev = pool[Math.floor(Math.random()*pool.length)];
    const body = document.createElement('div');
    body.innerHTML = '<p>' + ev.text + '</p>';
    UI.openModal({title:ev.title, sub:ev.sub, body, actions:[
      {label:ev.a.label, close:true, onClick:()=>{ ev.a.fn(); }},
      {label:ev.b.label, cls:'primary', close:true, onClick:()=>{ ev.b.fn(); }}
    ]});
  },

  statsBody(){
    const S = G.S.data;
    const b = document.createElement('div');
    b.innerHTML = '<div class="stat-line"><span>游戏时长</span><b>' + U.fmtTime(S.stats.playTime) + '</b></div>' +
      '<div class="stat-line"><span>总点击</span><b>' + U.fmt(S.stats.clicks) + '</b></div>' +
      '<div class="stat-line"><span>跃迁次数</span><b>' + S.stats.prestiges + '</b></div>' +
      '<div class="stat-line"><span>熄灭恒星</span><b>' + U.fmt(S.stats.extinguished||0) + '</b></div>';
    return b;
  },

  finalChoice(){
    UI.closeModal();
    const body = document.createElement('div');
    body.innerHTML = '<p style="line-height:2">宇宙只剩下最后一颗恒星。<br>它是太阳。</p>' +
      '<p style="color:var(--ink-faint);font-size:11px">它的行星上还有人。他们在看着天空。</p>';
    UI.openModal({
      title:'最后一颗', sub:'FINAL CHOICE',
      body,
      actions:[
        {label:'停下', cls:'primary', close:true, onClick:()=>Econ.resolveFinal(false)},
        {label:'熄灭它', cls:'danger', close:true, onClick:()=>Econ.resolveFinal(true)}
      ]
    });
  },

  ending(kind){
    UI.closeModal();
    const S = G.S.data;
    if(kind === 'door'){
      UI.cinema({big:'全 天 星 表', small:'10²⁴ · 门扉开启', dur:9000});
      G.Audio.prestige();
      setTimeout(()=>{
        UI.openModal({
          title:'门扉', sub:'ENDING · 观测者的回答',
          body: (()=>{
            const b = this.statsBody();
            b.innerHTML = '<p style="line-height:2">最后一颗恒星亮起。<br>整个可观测宇宙在你眼前同时发光，' +
              '它们开始互相连线，连成一个巨大的图案——一扇门。</p>' +
              '<p style="color:var(--gold);font-size:13px">「你记得每一颗星。所以你被允许记得我们。」</p>' + b.innerHTML;
            return b;
          })(),
          actions:[{label:'继续留在星图', cls:'primary', close:true}]
        });
      }, 4200);
    } else if(kind === 'zero'){
      UI.cinema({big:'归 零', small:'一片黑暗', dur:7000});
      G.Audio.extinguish();
      setTimeout(()=>{
        UI.openModal({
          title:'归零', sub:'HIDDEN ENDING',
          body: (()=>{
            const b = this.statsBody();
            b.innerHTML = '<p style="line-height:2">一片黑暗。计数器归零。<br>几秒之后，黑暗的中心出现一个光点——' +
              '大爆炸重新开始。</p>' +
              '<p style="color:var(--red);font-size:13px">「你成为了下一个回声。」</p>' + b.innerHTML;
            return b;
          })(),
          actions:[{label:'重新开始', cls:'primary', close:true}]
        });
      }, 3200);
    } else {
      UI.cinema({big:'至 少 还 剩 下 这 一 颗', small:'', dur:6000});
      setTimeout(()=>{
        UI.openModal({
          title:'最后一颗', sub:'ENDING',
          body: (()=>{
            const b = this.statsBody();
            b.innerHTML = '<p style="line-height:2">镜头停在孤零零的太阳上。<br>地球在它旁边转，很慢，很安静。</p>' +
              '<p style="color:var(--gold);font-size:13px">「至少，还剩下这一颗。」</p>' + b.innerHTML;
            return b;
          })(),
          actions:[{label:'继续观测', cls:'primary', close:true}]
        });
      }, 3000);
    }
  },

  checkDarkUnlock(){
    const S = G.S.data;
    if(S.darkUnlocked || S.darkEventShown) return;
    if(S.observed < 1e13) return;
    S.darkEventShown = true;
    S.darkUnlocked = true;
    S.fragments += 1;
    if(!S.logs.includes(44)) S.logs.push(44);
    G.Audio.warn(3);
    UI.updateMode();
    const body = document.createElement('div');
    body.innerHTML = '<p>一段不该存在的信号。它不像自然产生，也不像我们自己的回声。</p>' +
      '<p style="color:var(--red)">破译结果只有两个字：<b>熄灭</b>。</p>' +
      '<p style="font-size:11px;color:var(--ink-faint)">已解锁暗科技，并获得 1 块禁忌碎片。</p>';
    UI.openModal({
      title:'异常信号', sub:'FORBIDDEN SIGNAL',
      body,
      actions:[
        {label:'拆解信号', close:true, onClick:()=>this.darkBonus(0, 800)},
        {label:'上报总部', cls:'primary', close:true, onClick:()=>this.darkBonus(1, 0)}
      ]
    });
  },

  darkBonus(frag, dm){
    const S = G.S.data;
    S.fragments += frag;
    S.darkMatter += dm;
    UI.toast(frag ? ('额外获得 ' + frag + ' 块禁忌碎片') : ('额外获得 ' + U.fmt(dm) + ' 暗物质'), 'red');
    UI.updateMode();
    if(UI.tab === 'tech') UI.buildTab('tech');
  },

  debugSetup(){
    const d = document.createElement('div');
    d.id = 'debug';
    d.innerHTML = '<div style="opacity:.7">DEBUG ( ` )</div>' +
      '<button id="dbg-dust">+1e9 星尘</button>' +
      '<button id="dbg-res">+500 研究</button>' +
      '<button id="dbg-speed">速度 ×' + this.speed + '</button>' +
      '<button id="dbg-vis">视野 +1</button>' +
      '<button id="dbg-obs">观测 ×100</button>' +
      '<button id="dbg-wipe">清档</button>';
    document.getElementById('app').appendChild(d);
    d.querySelector('#dbg-dust').onclick = ()=>{ G.S.data.dust += 1e9; Econ.recalc(); };
    d.querySelector('#dbg-res').onclick = ()=>{ G.S.data.research += 500; };
    d.querySelector('#dbg-speed').onclick = (e)=>{
      this.speed = this.speed === 1 ? 10 : this.speed === 10 ? 100 : 1;
      e.target.textContent = '速度 ×' + this.speed;
    };
    d.querySelector('#dbg-vis').onclick = ()=>{
      const S = G.S.data;
      if(S.vision < CFG.VISIONS.length){
        S.vision++;
        Uni.computeVisibleCap(); Uni.incomplete = null;
        G.Bus.emit('visionUp', S.vision);
        UI.buildTab(UI.tab);
      }
    };
    d.querySelector('#dbg-obs').onclick = ()=>{
      const S = G.S.data;
      S.observed *= 100; S.stats.totalObserved += S.observed;
      Econ.checkMilestones();
    };
    d.querySelector('#dbg-wipe').onclick = ()=>{
      if(confirm('确定清空存档？')){ G.S.wipe(); location.reload(); }
    };
  }
};

function fmtNum(n){ return U.fmt(n); }

G.Game = Game;
window.addEventListener('DOMContentLoaded', ()=>Game.boot());
})();
