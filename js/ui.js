(function(){
const G = window.G, CFG = G.CFG, U = G.U;
const fmt = U.fmt, qs = U.qs, el = U.el;

const UI = {
  tab:'buildings',
  qty:1,
  updaters:[],
  modal:null,
  toasts:[],
  lastHud:0,
  lastBadge:0,
  hintClicks:0,
  dragging:false,

  init(){
    this.dom = {
      app:qs('#app'), count:qs('#count'), rate:qs('#rate'), bar:qs('#barfill'),
      progress:qs('#progress-label'), vision:qs('#vision'), chapter:qs('#chapter'),
      layerName:qs('#layer-name'), layerUnit:qs('#layer-unit'), combo:qs('#combo-chip'),
      chapterSub:qs('#chapter-sub'), tabs:qs('#tabs'), body:qs('#tab-body'),
      sheet:qs('#sheet'), toast:qs('#toasts'), modal:qs('#modal-root'),
      buffs:qs('#buffbar'), hint:qs('#hint'), cinema:qs('#cinema'), flash:qs('#flash'),
      sound:qs('#btn-sound'), menu:qs('#btn-menu'),
      handle:qs('#sheet-handle'), minimap:qs('#minimap'),
      mvLine:qs('#mv-line'), mvCount:qs('#mv-count'), mvMod:qs('#mv-mod')
    };
    this.bindChrome();
    this.buildTab(this.tab);
    this.updateChapter(true);
    this.buildModePill();
    this.updateMode();
  },

  buildModePill(){
    const p = el('div','modepill');
    p.innerHTML = '<i></i><span></span>';
    p.onclick = ()=>{ G.Econ.toggleMode(); };
    this.dom.app.appendChild(p);
    this.modePill = p;
  },

  updateMode(){
    if(!this.modePill) return;
    const S = G.S.data;
    const on = !!S.dark.d1;
    this.modePill.style.display = on ? 'flex' : 'none';
    if(!on) return;
    const dark = S.mode === 'extinguish';
    this.modePill.classList.toggle('on', dark);
    this.modePill.querySelector('span').textContent = dark
      ? ('熄灭模式 · ' + fmt(S.darkMatter) + ' 暗物质')
      : '观测模式';
    this.dom.app.classList.toggle('dark-mode', dark);
  },

  flashRed(){
    if(G.S.data.settings.reduceFx) return;
    const f = this.dom.flash;
    f.style.transition = 'none';
    f.style.background = '#d9364a';
    f.style.opacity = '.22';
    requestAnimationFrame(()=>{
      f.style.transition = 'opacity .7s ease';
      f.style.opacity = '0';
      setTimeout(()=>{ f.style.background = '#eaf2ff'; }, 700);
    });
  },

  bindChrome(){
    this.dom.tabs.addEventListener('click', (e)=>{
      const b = e.target.closest('.tab');
      if(!b) return;
      const t = b.dataset.tab;
      if(t === this.tab) { this.dom.sheet.classList.toggle('expanded'); return; }
      this.switchTab(t);
    });
    this.dom.menu.addEventListener('click', ()=>this.openMenu());
    if(this.dom.mvLine){
      this.dom.mvLine.addEventListener('click', ()=>{
        if(G.Econ.sealReady()) this.openSeal();
        else this.switchTab('archive');
      });
    }
    this.dom.modal.addEventListener('pointerdown', (e)=>{
      if(e.target === this.dom.modal) this.closeModal();
    });
    document.addEventListener('keydown', (e)=>{
      if(e.key === 'Escape' && this.modal) this.closeModal();
    });
    this.dom.sound.addEventListener('click', ()=>{
      const s = G.S.data.settings;
      s.music = !s.music;
      s.sound = s.music;
      G.Audio.setSfx(s.sound);
      G.Audio.setMusic(s.music);
      this.dom.sound.textContent = s.music ? '♪' : '♪̸';
      this.dom.sound.style.color = s.music ? 'var(--gold)' : '';
      this.toast(s.music ? '声音已开启' : '声音已关闭');
    });
    this.dom.sound.style.color = G.S.data.settings.music ? 'var(--gold)' : '';

    let startY = 0, startH = 0, dragId = null;
    const onMove = (e)=>{
      if(dragId === null || e.pointerId !== dragId) return;
      const dy = startY - e.clientY;
      const nh = U.clamp(startH + dy, this.dom.app.clientHeight*.34, this.dom.app.clientHeight*.9);
      this.dom.sheet.style.transition = 'none';
      this.dom.sheet.style.height = nh + 'px';
    };
    const onUp = (e)=>{
      if(dragId === null) return;
      if(e.type !== 'blur' && e.pointerId !== dragId) return;
      dragId = null;
      this.dragging = false;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('blur', onUp);
      const h = this.dom.sheet.getBoundingClientRect().height;
      this.dom.sheet.style.transition = '';
      this.dom.sheet.style.height = '';
      this.dom.sheet.classList.toggle('expanded', h > this.dom.app.clientHeight*.62);
    };
    const onDown = (e)=>{
      if(dragId !== null || (e.pointerType === 'mouse' && e.button !== 0)) return;
      dragId = e.pointerId;
      startY = e.clientY;
      startH = this.dom.sheet.getBoundingClientRect().height;
      this.dragging = true;
      this.dom.sheet.style.transition = 'none';
      try { this.dom.handle.setPointerCapture(e.pointerId); } catch(_){}
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
      window.addEventListener('blur', onUp);
    };
    this.dom.handle.addEventListener('pointerdown', onDown);
  },

  switchTab(t){
    this.tab = t;
    [...this.dom.tabs.children].forEach(b=>b.classList.toggle('active', b.dataset.tab === t));
    if(t === 'tech') this.dom.sheet.classList.add('expanded');
    else this.dom.sheet.classList.remove('expanded');
    this.buildTab(t);
  },

  buildTab(t){
    this.updaters = [];
    this.dom.body.scrollTop = 0;
    this.dom.body.innerHTML = '';
    if(t === 'buildings') this.buildBuildings();
    else if(t === 'upgrades') this.buildUpgrades();
    else if(t === 'tech') this.buildTech();
    else if(t === 'mega') this.buildMega();
    else if(t === 'archive') this.buildArchive();
  },

  sectionHead(title, sub){
    const d = el('div','section-head');
    d.innerHTML = '<h3>' + title + '</h3><span class="sub">' + (sub||'') + '</span>';
    this.dom.body.appendChild(d);
    return d;
  },

  buildBuildings(){
    const head = this.sectionHead('观测设施', '');
    const qtyWrap = el('div','qty');
    [1,10,100,'max'].forEach(q=>{
      const b = el('button', q === this.qty ? 'on' : '', q === 'max' ? '最大' : '×'+q);
      b.onclick = ()=>{
        this.qty = q;
        [...qtyWrap.children].forEach(c=>c.classList.remove('on'));
        b.classList.add('on');
        this.refreshRows();
      };
      qtyWrap.appendChild(b);
    });
    this.dom.body.appendChild(qtyWrap);
    const rows = [];
    for(const def of CFG.BUILDINGS){
      const row = el('div','row');
      row.innerHTML =
        '<div class="r-ico">' + def.icon + '</div>' +
        '<div class="r-main">' +
          '<div class="r-title"><span class="r-name">' + def.name + '</span><span class="r-count"></span></div>' +
          '<div class="r-desc">' + def.desc + '</div>' +
          '<div class="r-meta"></div>' +
        '</div>' +
        '<button class="buy"><span class="p"></span><em>购买</em></button>';
      const buy = row.querySelector('.buy');
      buy.onclick = (e)=>{
        e.stopPropagation();
        const ok = G.Econ.buyBuilding(def, this.qty);
        if(ok){
          G.Audio.buy();
          row.classList.add('flash');
          setTimeout(()=>row.classList.remove('flash'), 260);
        }
      };
      this.dom.body.appendChild(row);
      rows.push({def, row, count:row.querySelector('.r-count'), meta:row.querySelector('.r-meta'),
        buy, price:row.querySelector('.p')});
    }
    const upd = ()=>{
      const S = G.S.data, d = G.Econ.d;
      head.querySelector('.sub').textContent = fmt(d.dps) + '/秒';
      for(const r of rows){
        const owned = S.buildings[r.def.id] || 0;
        const unlocked = G.Econ.buildingUnlocked(r.def);
        const qty = this.qty === 'max' ? Math.max(1, G.Econ.maxAffordable(r.def)) : this.qty;
        const cost = G.Econ.price(r.def, owned, qty);
        r.count.textContent = owned ? '×' + owned : '';
        r.row.classList.toggle('locked', !unlocked);
        if(!unlocked){
          let need = '未解锁';
          if(r.def.tech && !S.tech[r.def.tech]){
            const t = CFG.TECH.find(x=>x.id===r.def.tech);
            need = '需要科技：' + (t ? t.name : r.def.tech);
          } else if(r.def.vision && S.vision < r.def.vision){
            need = '需要视野 ' + ['I','II','III','IV','V','VI'][r.def.vision-1];
          } else if(r.def.need && S.observed < r.def.need){
            need = '需观测 ' + fmt(r.def.need) + ' 颗';
          }
          r.meta.textContent = need;
          r.buy.disabled = true;
          r.buy.classList.remove('can');
          r.price.textContent = '—';
          continue;
        }
        r.buy.disabled = false;
        const per = (d.perBuilding[r.def.id] || 0);
        const unit = r.def.out * d.global;
        const payback = unit > 0 ? G.Econ.price(r.def, owned, 1) / unit : 0;
        r.meta.innerHTML = owned ? ('<b>' + fmt(per) + '</b> /秒 · 单个 ' + fmt(unit) + '/秒')
                                : ('<b>' + fmt(unit) + '</b> /秒 · 回本 ' + fmtTimeShort(payback));
        r.price.textContent = fmt(cost);
        const can = S.dust >= cost;
        r.buy.classList.toggle('can', can);
        r.row.classList.toggle('affordable', can);
      }
    };
    this.updaters.push(upd);
    upd();
  },

  buildUpgrades(){
    this.sectionHead('点击与暴击', '永久生效');
    const sum = el('div','tech-summary');
    this.dom.body.appendChild(sum);
    const rows = [];
    for(const def of CFG.CLICK_UPGRADES){
      const row = el('div','row');
      row.innerHTML =
        '<div class="r-ico">' + def.icon + '</div>' +
        '<div class="r-main"><div class="r-title"><span class="r-name">' + def.name + '</span>' +
          '<span class="r-count"></span></div><div class="r-desc">' + def.desc + '</div></div>' +
        '<button class="buy"><span class="p"></span><em>购买</em></button>';
      const buy = row.querySelector('.buy');
      buy.onclick = ()=>{
        if(G.Econ.buyUpgrade(def)){
          G.Audio.tech();
          G.Bus.emit('upgradeBought', def);
          upd();
        }
      };
      this.dom.body.appendChild(row);
      rows.push({def, row, price:row.querySelector('.p'), buy, count:row.querySelector('.r-count')});
    }
    const upd = ()=>{
      const S = G.S.data, d = G.Econ.d;
      sum.innerHTML = '<span>单次点击 <b>' + fmt(d.clickStars) + '</b></span>' +
        '<span>范围 ' + d.areaStars + ' 颗 · 弹射 ' + (d.bounceTimes ? (d.bounceTimes + ' × ' + d.bounceStars) : '未解锁') +
        ' · 点击倍率 ×' + d.chainMult.toFixed(2) + '</span>';
      for(const r of rows){
        const have = !!S.upgrades[r.def.id];
        r.row.style.opacity = have ? .5 : 1;
        r.count.textContent = have ? '已掌握' : '';
        r.count.style.color = have ? 'var(--green)' : '';
        r.buy.style.display = have ? 'none' : 'flex';
        r.price.textContent = fmt(r.def.cost);
        const can = !have && S.dust >= r.def.cost;
        r.buy.classList.toggle('can', can);
        r.buy.disabled = have;
      }
    };
    this.updaters.push(upd);
    upd();
    this.sectionHead('观星手记', '');
    const note = el('div','log-item');
    note.innerHTML = '<span class="no">提示</span>连击间隔小于 0.4 秒。暴击会让整片星域一起亮起来。';
    this.dom.body.appendChild(note);
  },

  buildTech(){
    const S = G.S.data;
    const head = this.sectionHead('观测科技树', '研究点 ' + fmt(S.research));
    const summary = el('div','tech-summary');
    summary.innerHTML = '<span>已掌握 <b>' + Object.keys(S.tech).length + '</b> / ' + CFG.TECH.length + '</span><span>视野 ' + ROMAN[S.vision-1] + '</span>';
    this.dom.body.appendChild(summary);

    const wrap = el('div','tech-tree');
    wrap.style.height = '568px';
    wrap.style.width = '100%';
    const inner = el('div');
    inner.style.cssText = 'position:relative;width:806px;height:568px;transform-origin:0 0';
    const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox','0 0 806 568');
    inner.appendChild(svg);
    const NODE_W = 108, NODE_H = 66, COL = 132, ROW = 92, OX = 6, OY = 8;
    const pos = (n)=>({x: OX + n.col*COL, y: OY + (5 - n.row)*ROW});
    for(const t of CFG.TECH){
      if(!t.req) continue;
      for(const rq of t.req){
        const a = CFG.TECH.find(x=>x.id===rq);
        if(!a) continue;
        const pa = pos(a), pb = pos(t);
        const path = document.createElementNS('http://www.w3.org/2000/svg','path');
        const x1 = pa.x + NODE_W, y1 = pa.y + NODE_H/2;
        const x2 = pb.x, y2 = pb.y + NODE_H/2;
        const mx = (x1+x2)/2;
        path.setAttribute('d', 'M' + x1 + ' ' + y1 + ' C' + mx + ' ' + y1 + ', ' + mx + ' ' + y2 + ', ' + x2 + ' ' + y2);
        path.setAttribute('fill','none');
        path.setAttribute('stroke','rgba(126,176,255,.16)');
        path.setAttribute('stroke-width','1.2');
        path.dataset.from = a.id; path.dataset.to = t.id;
        svg.appendChild(path);
      }
    }
    const nodes = [];
    for(const t of CFG.TECH){
      const p = pos(t);
      const n = el('div','node');
      n.style.left = p.x + 'px'; n.style.top = p.y + 'px';
      n.style.width = NODE_W + 'px';
      n.innerHTML = '<div class="n-name">' + t.name + '</div><div class="n-cost">研究 ' + t.cost + '</div>';
      n.onclick = ()=>this.openTech(t);
      inner.appendChild(n);
      nodes.push({t, n});
    }
    const scrollWrap = el('div');
    scrollWrap.style.cssText = 'overflow-x:auto;overflow-y:hidden;margin:0 -4px;padding:0 4px;-webkit-overflow-scrolling:touch';
    scrollWrap.appendChild(inner);
    wrap.appendChild(scrollWrap);
    this.dom.body.appendChild(wrap);
    this.dom.body.appendChild(el('div','log-item','拖动可横向浏览科技树'));

    const upd = ()=>{
      const S2 = G.S.data;
      head.querySelector('.sub').textContent = '研究点 ' + fmt(S2.research);
      summary.innerHTML = '<span>已掌握 <b>' + Object.keys(S2.tech).length + '</b> / ' + CFG.TECH.length + '</span><span>视野 ' + ROMAN[S2.vision-1] + '</span>';
      for(const {t,n} of nodes){
        const have = !!S2.tech[t.id];
        const avail = G.Econ.techAvailable(t);
        const afford = avail && S2.research >= G.Econ.techCost(t);
        n.classList.toggle('have', have);
        n.classList.toggle('avail', afford && !have);
        n.classList.toggle('locked', !have && !avail);
        n.querySelector('.n-cost').textContent = have ? '已掌握' : ('研究 ' + G.Econ.techCost(t));
      }
      svg.querySelectorAll('path').forEach(p=>{
        const on = S2.tech[p.dataset.to];
        p.setAttribute('stroke', on ? 'rgba(87,224,176,.4)' : 'rgba(126,176,255,.14)');
      });
    };
    this.updaters.push(upd);
    upd();

    if(G.S.data.darkUnlocked) this.buildDark();
  },

  buildDark(){
    const head = this.sectionHead('暗科技', '');
    const modeRow = el('div','row');
    modeRow.innerHTML = '<div class="r-ico" style="color:#ff8a9a">☄</div>' +
      '<div class="r-main"><div class="r-title"><span class="r-name">熄灭模式</span></div>' +
      '<div class="r-desc">开启后，点击改为熄灭恒星，获得暗物质（数值 ×5）</div></div>' +
      '<button class="buy"><span class="p"></span><em>切换</em></button>';
    const modeBtn = modeRow.querySelector('.buy');
    modeBtn.onclick = ()=>{ G.Econ.toggleMode(); updDark(); };
    this.dom.body.appendChild(modeRow);

    const cards = [];
    for(const def of CFG.DARK_TECH){
      const c = el('div','row');
      c.innerHTML = '<div class="r-ico" style="color:#ff8a9a">✦</div>' +
        '<div class="r-main"><div class="r-title"><span class="r-name">' + def.name + '</span></div>' +
        '<div class="r-desc">' + def.desc + '</div><div class="r-meta"></div></div>' +
        '<button class="buy"><span class="p"></span><em>研究</em></button>';
      const btn = c.querySelector('.buy');
      btn.onclick = ()=>{
        if(G.Econ.buyDarkTech(def)){
          G.Audio.tech();
          this.toast('暗科技掌握：' + def.name, 'red');
          if(def.id === 'd1') this.toast('点击左下角开关进入熄灭模式', 'red');
          if(def.id === 'd9') this.toast('熄灭的恒星已全部重燃', 'gold');
          updDark();
        } else this.toast('暗物质或碎片不足');
      };
      this.dom.body.appendChild(c);
      cards.push({def, c, btn, price:c.querySelector('.p'), meta:c.querySelector('.r-meta')});
    }
    const vac = el('div','row');
    vac.innerHTML = '<div class="r-ico" style="color:#ff8a9a">✹</div>' +
      '<div class="r-main"><div class="r-title"><span class="r-name">真空衰变</span></div>' +
      '<div class="r-desc">瞬间熄灭视野内 5% 的恒星（冷却 5 分钟）</div><div class="r-meta"></div></div>' +
      '<button class="buy"><span class="p">发动</span><em>技能</em></button>';
    const vacBtn = vac.querySelector('.buy');
    vacBtn.onclick = ()=>{
      const hit = G.Econ.vacuum();
      if(hit === false) this.toast('尚未掌握，或技能冷却中');
    };
    this.dom.body.appendChild(vac);
    const vacMeta = vac.querySelector('.r-meta');

    const updDark = ()=>{
      const S2 = G.S.data;
      head.querySelector('.sub').textContent = '暗物质 ' + fmt(S2.darkMatter) + ' · 碎片 ' + S2.fragments;
      modeBtn.querySelector('.p').textContent = S2.mode === 'extinguish' ? '熄灭中' : '观测中';
      modeBtn.classList.toggle('can', S2.mode !== 'extinguish');
      for(const r of cards){
        const have = !!S2.dark[r.def.id];
        const cost = r.def.cost;
        const afford = (cost.dm||0) <= S2.darkMatter && (cost.frag||0) <= S2.fragments;
        r.c.style.opacity = have ? .5 : 1;
        r.btn.style.display = have ? 'none' : 'flex';
        r.btn.classList.toggle('can', afford && !have);
        r.price.textContent = (cost.dm ? fmt(cost.dm) : '') + (cost.frag ? (cost.dm ? ' + ' : '') + cost.frag + ' 碎片' : '');
        r.meta.textContent = have ? '已掌握' : (afford ? '可以研究' : '资源不足');
        r.meta.style.color = have ? 'var(--green)' : (afford ? 'var(--gold)' : '');
      }
      const left = Math.max(0, (S2.vacuumAt||0) - Date.now());
      vacBtn.style.opacity = S2.dark.d8 ? 1 : .4;
      vacMeta.textContent = !S2.dark.d8 ? '需要「真空衰变」' : (left > 0 ? '冷却 ' + Math.ceil(left/1000) + ' 秒' : '可以发动');
      this.updateMode();
    };
    updDark();
    this.updaters.push(updDark);
  },

  buildMega(){
    this.sectionHead('巨构工程', '');
    const cards = [];
    for(const def of CFG.MEGAS){
      const c = el('div','mega-card');
      c.innerHTML = '<h4><span>' + def.icon + '</span>' + def.name + '</h4>' +
        '<p>' + def.desc + '</p>' +
        '<div class="mega-foot"><span class="mega-cost"></span><button class="mega-build">建造</button></div>';
      c.querySelector('.mega-build').onclick = ()=>{
        if(G.Econ.buyMega(def)){
          G.Audio.tech();
          G.Bus.emit('megaBought', def);
          upd();
        } else this.toast('星尘不足，或尚未解锁');
      };
      this.dom.body.appendChild(c);
      cards.push({def, c, cost:c.querySelector('.mega-cost'), btn:c.querySelector('.mega-build')});
    }
    const upd = ()=>{
      const S = G.S.data;
      for(const {def, c, cost, btn} of cards){
        const have = S.megas[def.id] || 0;
        const unlocked = G.Econ.megaUnlocked(def);
        c.classList.toggle('locked', !unlocked);
        const price = G.Econ.megaCost(def, have);
        cost.textContent = '×' + have + ' / ' + def.max + ' · ' + fmt(price) + ' 星尘';
        btn.textContent = have >= def.max ? '已满级' : '建造';
        btn.disabled = have >= def.max || !unlocked;
        btn.style.opacity = (!unlocked || have >= def.max) ? .35 : 1;
        btn.classList.toggle('can', unlocked && have < def.max && S.dust >= price);
      }
    };
    this.updaters.push(upd);
    upd();
  },

  buildArchive(){
    const S = G.S.data;
    this.sectionHead('档案馆', '收集加成 ×' + G.Econ.collectionBonus().toFixed(2));
    const grid = el('div','archive-grid');
    this.dom.body.appendChild(grid);
    const stats = el('div');
    this.dom.body.appendChild(stats);
    const updStats = ()=>{
      const S2 = G.S.data, d = G.Econ.d;
      const totalSectors = Uni.countUnlocked();
      const done = totalSectors - Uni.ensureIncomplete().length;
      grid.innerHTML =
        stat('历史总观测', fmt(S2.stats.totalObserved)) +
        stat('本轮观测', fmt(S2.observed)) +
        stat('星核', fmt(S2.cores), true) +
        stat('研究点', fmt(S2.research)) +
        stat('视野', ROMAN[S2.vision-1] + ' · ' + G.Econ.visionInfo().name) +
        stat('星区完成', done + ' / ' + totalSectors) +
        stat('收集加成', '×' + G.Econ.collectionBonus().toFixed(2), true) +
        stat('跃迁次数', String(S2.stats.prestiges)) +
        (S2.mv && S2.mv.on ? stat('宇宙', (S2.mv.lit||0) + ' / ' + G.Econ.mvRequirement(), true) : '') +
        (S2.mv && S2.mv.on ? stat('宇宙常数', '×' + (S2.mv.mult||1).toFixed(2), true) : '') +
        stat('宇宙总量', '2,000 亿 · 已观测 ' + (G.Econ.mvCoverage()*100).toFixed(3) + '%') +
        (S2.darkUnlocked ? stat('暗物质', fmt(S2.darkMatter)) : '') +
        (S2.darkUnlocked ? stat('禁忌碎片', String(S2.fragments)) : '') +
        (S2.darkUnlocked ? stat('熄灭比例', (Uni.destroyedRatio()*100).toFixed(2) + '%', true) : '');
    };
    updStats();
    this.updaters.push(updStats);

    const prestige = el('div','mega-card');
    prestige.style.borderColor = 'rgba(169,139,255,.35)';
    prestige.innerHTML = '<h4 id="pres-title">✦ 跃迁</h4><p id="pres-desc">把观测数据压缩成星核，带上一份经验重新出发。设施、星尘、升级清零，科技与视野保留，星核与收集保留。</p>' +
      '<div class="mega-foot"><span class="mega-cost" id="prestige-preview"></span><button class="mega-build" id="prestige-btn">跃迁</button></div>';
    this.dom.body.appendChild(prestige);
    const pv = prestige.querySelector('#prestige-preview');
    const pb = prestige.querySelector('#prestige-btn');
    const pTitle = prestige.querySelector('#pres-title');
    const pDesc = prestige.querySelector('#pres-desc');
    const updP = ()=>{
      const S2 = G.S.data, mv = S2.mv || {};
      if(S2.stats.prestiges === 0){
        const cores = G.Econ.coresFor(S2.observed);
        const ready = G.Econ.prestigeReady();
        pTitle.textContent = '✦ 跃迁';
        pDesc.textContent = '把观测数据压缩成星核，带上一份经验重新出发。设施、星尘、升级清零，科技与视野保留，星核与收集保留。';
        pv.textContent = ready ? ('可获得 ' + fmt(cores) + ' 星核') : ('需观测 ' + fmt(G.PRESTIGE_AT) + ' 颗');
        pb.textContent = '跃迁';
        pb.style.opacity = ready ? 1 : .35;
        pb.onclick = ()=>{ if(ready) this.openPrestige(); };
        return;
      }
      const req = G.Econ.mvRequirement();
      const seal = G.Econ.sealReady();
      const big = G.Econ.prestigeReady();
      pTitle.textContent = '✦ 多元宇宙';
      pDesc.textContent = '每闭合一个宇宙获得 1 枚星核，宇宙常数 ×1.15；点亮 ' + req + ' 个宇宙后可大坍缩。' +
        (mv.mod ? '当前修正：' + mv.mod.name + '（' + mv.mod.desc + '）' : '');
      pv.textContent = '宇宙 ' + (mv.lit||0) + ' / ' + req + ' · 本宇宙 ' + fmt(S2.observed) + ' / ' + fmt(G.Econ.mvTarget());
      pb.textContent = big ? '大坍缩' : (seal ? '闭合宇宙' : '尚未饱和');
      pb.style.opacity = (big || seal) ? 1 : .35;
      pb.onclick = ()=>{ if(big) this.openPrestige(); else if(seal) this.openSeal(); };
    };
    updP();
    this.updaters.push(updP);

    const coreHead = this.sectionHead('星核商店', '星核 ' + fmt(S.cores));
    const coreRows = [];
    for(const def of CFG.CORE_UPGRADES){
      const row = el('div','row');
      row.innerHTML = '<div class="r-ico">✦</div><div class="r-main"><div class="r-title"><span class="r-name">' +
        def.name + '</span></div><div class="r-desc">' + def.desc + '</div></div>' +
        '<button class="buy"><span class="p"></span><em>星核</em></button>';
      const btn = row.querySelector('.buy');
      btn.onclick = ()=>{
        if(G.Econ.buyCore(def.id)){ G.Audio.tech(); updCore(); this.toast('永久升级：' + def.name); }
      };
      this.dom.body.appendChild(row);
      coreRows.push({def, row, btn, price:row.querySelector('.p')});
    }
    const updCore = ()=>{
      const S2 = G.S.data;
      coreHead.querySelector('.sub').textContent = '星核 ' + fmt(S2.cores);
      for(const r of coreRows){
        const have = !!S2.coreUpgrades[r.def.id];
        r.row.style.opacity = have ? .5 : 1;
        r.price.textContent = have ? '已拥有' : String(r.def.cost);
        r.btn.disabled = have;
        r.btn.classList.toggle('can', !have && S2.cores >= r.def.cost);
      }
    };
    updCore();
    this.updaters.push(updCore);

    this.sectionHead('成就', Object.keys(S.achievements).length + ' / ' + CFG.ACHIEVEMENTS.length);
    const ag = el('div','ach-grid');
    this.dom.body.appendChild(ag);
    let achSig = '';
    const buildAch = ()=>{
      const sig = Object.keys(G.S.data.achievements).length + ':' + CFG.ACHIEVEMENTS.length;
      if(sig === achSig) return;
      achSig = sig;
      ag.innerHTML = '';
      for(const a of CFG.ACHIEVEMENTS){
        const got = !!G.S.data.achievements[a.id];
        const d = el('div','ach' + (got ? ' got' : ''), got ? '✦' : '·');
        d.title = got ? a.name + '：' + a.desc : '???';
        d.onclick = ()=>this.toast(got ? a.name + ' · ' + a.desc : '隐藏成就');
        ag.appendChild(d);
      }
    };
    buildAch();
    this.updaters.push(buildAch);

    this.sectionHead('观测日志', S.logs.length + ' / ' + CFG.LOGS.length);
    const logs = el('div');
    this.dom.body.appendChild(logs);
    let logSig = -1;
    const buildLogs = ()=>{
      if(logSig === G.S.data.logs.length) return;
      logSig = G.S.data.logs.length;
      const ids = [...G.S.data.logs].sort((a,b)=>b-a);
      logs.innerHTML = ids.length ? '' : '<div class="log-item">还没有日志。星空会自己说话。</div>';
      for(const id of ids){
        const L = CFG.LOGS.find(l=>l.id===id);
        if(!L) continue;
        const d = el('div','log-item');
        d.innerHTML = '<span class="no">LOG ' + String(L.id).padStart(3,'0') + '</span>' + L.text;
        logs.appendChild(d);
      }
    };
    buildLogs();
    this.updaters.push(buildLogs);
  },

  openTech(t){
    const S = G.S.data;
    const have = !!S.tech[t.id];
    const avail = G.Econ.techAvailable(t);
    const cost = G.Econ.techCost(t);
    const body = el('div');
    body.innerHTML = '<div class="stat-line"><span>效果</span><b>' + t.desc + '</b></div>' +
      '<div class="stat-line"><span>消耗</span><b>' + cost + ' 研究点</b></div>' +
      '<div class="stat-line"><span>前置</span><b>' + (t.req ? t.req.map(r=>CFG.TECH.find(x=>x.id===r).name).join(' / ') : '无') + '</b></div>' +
      (t.pres ? '<div class="stat-line"><span>跃迁要求</span><b>' + t.pres + ' 次（当前 ' + S.stats.prestiges + ' 次）</b></div>' : '');
    const actions = [];
    if(have) actions.push({label:'已掌握', cls:'', close:true});
    else if(t.pres && S.stats.prestiges < t.pres) actions.push({label:'需要先跃迁', cls:'', close:true});
    else if(!avail) actions.push({label:'尚未解锁', cls:'', close:true});
    else actions.push({label:'研究 · ' + cost, cls:'primary', onClick:()=>{
      if(G.Econ.buyTech(t)){
        G.Audio.tech();
        this.closeModal();
        this.buildTab(this.tab);
        this.toast('科技掌握：' + t.name);
        if(t.vis) G.Bus.emit('visionUp', G.S.data.vision);
      } else this.toast('研究点不足');
    }});
    actions.push({label:'关闭', close:true});
    this.openModal({title:t.name, sub:'观测科技', body, actions});
  },

  openSeal(){
    const S = G.S.data, mv = S.mv || {};
    const body = el('div');
    body.innerHTML =
      '<div class="stat-line"><span>闭合后宇宙</span><b>' + ((mv.lit||0) + 1) + ' / ' + G.Econ.mvRequirement() + '</b></div>' +
      '<div class="stat-line"><span>本宇宙观测</span><b>' + fmt(S.observed) + '</b></div>' +
      '<div class="stat-line"><span>宇宙常数</span><b>×' + (mv.mult||1).toFixed(2) + ' → ×' + ((mv.mult||1)*1.15).toFixed(2) + '</b></div>' +
      '<p style="margin-top:12px">闭合后，本宇宙的设施、星尘、星区与点击升级清空，<b>科技与视野保留</b>。<br>' +
      '获得 1 枚星核，并迎来一个全新的天空（随机纯增益修正）。</p>';
    this.openModal({title:'闭合宇宙', sub:'SEAL THIS UNIVERSE', body, actions:[
      {label:'再等等', close:true},
      {label:'闭合宇宙', cls:'primary', onClick:()=>{
        const res = G.Econ.sealUniverse();
        this.closeModal();
        this.buildTab(this.tab);
        this.updateChapter(true);
        G.Renderer.setVision();
        if(res){
          this.cinema({big:'宇 宙 闭 合', small:'第 ' + res.lit + ' 个 · 宇宙常数 ×' + res.mvMult.toFixed(2) + ' · ' + res.mod.name, dur:3600});
        }
        G.Audio.prestige();
      }}
    ]});
  },

  openPrestige(){
    const S = G.S.data;
    const first = S.stats.prestiges === 0;
    const cores = first ? G.Econ.coresFor(S.observed)
      : Math.max(3, Math.round(G.Econ.mvRequirement() * 2)) + Math.floor((S.mv.life || 0) * .5);
    const body = el('div');
    const facs = CFG.FACTIONS.filter(f=>!f.hidden);
    body.innerHTML =
      '<div class="stat-line"><span>本次获得</span><b>' + fmt(cores) + ' 星核</b></div>' +
      '<div class="stat-line"><span>星核总量</span><b>' + fmt(S.cores + cores) + '</b></div>' +
      '<div class="stat-line"><span>当前星核加成</span><b>+' + Math.round(S.cores * (S.coreUpgrades.u4?.08:.05) * 100) + '%</b></div>' +
      (first ? '' : '<div class="stat-line"><span>已点亮宇宙</span><b>' + (S.mv.life||0) + ' 个（本轮 ' + (S.mv.lit||0) + '）</b></div>') +
      (first ? '' : '<div class="stat-line"><span>宇宙常数</span><b>×' + (S.mv.mult||1).toFixed(2) + '</b></div>') +
      '<p style="margin-top:12px">下一次远征的流派：</p>' +
      '<div id="fac-list" style="display:flex;flex-direction:column;gap:6px"></div>';
    let chosen = S.faction || 'f1';
    const list = body.querySelector('#fac-list');
    const renderF = ()=>{
      list.innerHTML = '';
      for(const f of facs){
        const d = el('div','row');
        d.style.margin = '0';
        d.style.cursor = 'pointer';
        d.style.borderColor = chosen === f.id ? 'rgba(255,211,107,.45)' : '';
        d.innerHTML = '<div class="r-ico">' + f.icon + '</div><div class="r-main"><div class="r-title"><span class="r-name">' +
          f.name + '</span><span class="r-count" style="color:var(--ink-faint);font-size:9px">' + f.desc + '</span></div>' +
          '<div class="r-desc">' + f.bonus + ' · ' + f.cost + '</div></div>';
        d.onclick = ()=>{ chosen = f.id; renderF(); };
        list.appendChild(d);
      }
    };
    renderF();
    this.openModal({title: first ? '跃迁' : '大坍缩', sub: first ? 'STAR CORE COMPRESSION' : 'COSMIC COLLAPSE', body, actions:[
      {label:'放弃', close:true},
      {label: first ? '确认跃迁' : '确认坍缩', cls:'primary', onClick:()=>{
        const res = G.Econ.doPrestige(chosen);
        this.closeModal();
        this.buildTab(this.tab);
        this.updateChapter(true);
        G.Renderer.setVision();
        this.cinema({big: first ? '跃 迁' : '大 坍 缩', small:'获得 ' + fmt(res.cores) + ' 枚星核', dur:3600});
        G.Audio.prestige();
      }}
    ]});
  },

  openIntro(){
    const body = el('div');
    body.innerHTML =
      '<p style="font-size:12px;line-height:2;color:#cfdcf6">公元 2547 年，深空探测器「回声号」在柯伊伯带外缘截获了一段信号。<br>' +
      '人类只读懂了其中一句：</p>' +
      '<p style="text-align:center;color:var(--gold);font-size:13.5px;letter-spacing:.06em;margin:14px 0">' +
      '「完整记录宇宙者，可叩问门扉。」</p>' +
      '<p style="font-size:11.5px;line-height:2;color:#aebadb">你是全天星表计划的首席观测官。<br>' +
      '你的起点，是一台旧望远镜，和一片看不清的夜空。</p>' +
      '<div class="stat-line"><span>目标</span><b>记录 10²⁴ 颗恒星</b></div>' +
      '<div class="stat-line"><span>第一步</span><b>点击星图</b></div>';
    this.openModal({title:'观星者纪元', sub:'STARGAZER EPOCH', body, actions:[
      {label:'开始观测', cls:'primary', close:true, onClick:()=>{
        G.Audio.resume();
        const S = G.S.data;
        if(S.settings.music) G.Audio.startMusic();
        this.toast('点击星空，记录第一颗星', 'gold');
      }}
    ]});
  },

  openMenu(){
    const S = G.S.data;
    const body = el('div');
    body.innerHTML =
      '<div class="settings-row"><span>音效</span><div class="switch' + (S.settings.sound?' on':'') + '" id="sw-sfx"><i></i></div></div>' +
      '<div class="settings-row"><span>背景音乐</span><div class="switch' + (S.settings.music?' on':'') + '" id="sw-mus"><i></i></div></div>' +
      '<div class="settings-row"><span>减少动态效果</span><div class="switch' + (S.settings.reduceFx?' on':'') + '" id="sw-fx"><i></i></div></div>' +
      '<div class="settings-row"><span>自动采购设施</span><div class="switch' + (S.settings.autoBuy?' on':'') + '" id="sw-auto"><i></i></div></div>' +
      '<p style="margin-top:16px;font-size:10.5px;color:var(--ink-faint);line-height:1.7">观测日志会自动保存在本机。' +
      '当前版本：v0.9 竖屏原型。<br>玩法：点击星图观测，购买设施自动观测，积累研究点解锁科技与更远的视野。</p>';
    const toggle = (id, key, after)=>{
      body.querySelector('#'+id).onclick = ()=>{
        S.settings[key] = !S.settings[key];
        body.querySelector('#'+id).classList.toggle('on', S.settings[key]);
        if(after) after();
      };
    };
    toggle('sw-sfx','sound',()=>G.Audio.setSfx(S.settings.sound));
    toggle('sw-mus','music',()=>G.Audio.setMusic(S.settings.music));
    toggle('sw-fx','reduceFx');
    toggle('sw-auto','autoBuy');
    this.openModal({title:'设置', sub:'SETTINGS', body, actions:[
      {label:'玩法说明', onClick:()=>{ this.closeModal(); this.openHelp(); }},
      {label:'关闭', cls:'primary', close:true}
    ]});
  },

  openHelp(){
    const body = el('div');
    body.innerHTML = '<p>你被任命为全天星表计划的首席观测官。目标只有一个：数清可观测宇宙里的每一颗恒星。</p>' +
      '<p><b style="color:#cfe2ff">点击星图</b>观测恒星，点击处周围的星会被一起点亮，得到星尘。<br>' +
      '<b style="color:#cfe2ff">星尘</b>购买观测设施，它们会自动观测。<br>' +
      '<b style="color:#cfe2ff">星区完成</b>会产出研究点，用来解锁科技与视野。<br>' +
      '<b style="color:#cfe2ff">范围点亮 / 弹射观测</b>：科技树左下角的分支，点击会点亮一片星，并像光电一样弹射出去，连锁倍率相乘。<br>' +
      '<b style="color:#cfe2ff">连击</b>：一秒内点得越多（最高按 8 次/秒吃满）、连得越久，倍率越高（最高 ×10；科技「恒星心律」可解除上限，按对数继续增长）。断连后倍率会逐渐衰减，不会瞬间清零。<br>' +
      '<b style="color:#cfe2ff">五层视角</b>：星区 → 星座 → 旋臂 → 银河 → 宇宙。星区/星座层可以观测，越往外点一下记录的范围越大；旋臂以上只能看，点一下会自动飞近。<br>' +
      '<b style="color:#cfe2ff">视野</b>决定你能观测到多远——拖动星图，把边缘的黑暗点亮。<br>' +
      '<b style="color:#cfe2ff">跃迁</b>会在 10¹¹ 颗后解锁；之后进入多元宇宙：<br>' +
      '每次观测满 300 亿颗即可<b style="color:#cfe2ff">闭合宇宙</b>（+1 星核、宇宙常数 ×1.15，科技与视野保留），' +
      '点亮 10 个宇宙后可以<b style="color:#cfe2ff">大坍缩</b>。</p>' +
      '<p style="color:var(--red);font-size:11px">10¹³ 颗之后，你会收到一段不该存在的信号。' +
      '暗科技能让你熄灭恒星换取暗物质，代价是宇宙反噬，以及三种结局中的另外两种。</p>' +
      '<p style="color:var(--ink-faint)">拖动平移，滚轮或双指缩放。缩小看星域，放大看每一颗。</p>';
    this.openModal({title:'观测手册', sub:'HOW TO PLAY', body, actions:[{label:'开始观测', cls:'primary', close:true}]});
  },

  openModal({title, sub, body, actions}){
    const root = this.dom.modal;
    root.innerHTML = '';
    const m = el('div','modal');
    m.appendChild(el('h3', '', title));
    if(sub) m.appendChild(el('div','m-sub', sub));
    m.appendChild(body);
    const acts = el('div','m-actions');
    (actions||[]).forEach(a=>{
      const b = el('button', a.cls||'', a.label);
      b.onclick = ()=>{
        if(a.onClick) a.onClick();
        if(a.close !== false && a.close) this.closeModal();
        else if(!a.onClick) this.closeModal();
      };
      acts.appendChild(b);
    });
    m.appendChild(acts);
    root.appendChild(m);
    root.classList.add('on');
    this.modal = m;
  },
  closeModal(){
    this.dom.modal.classList.remove('on');
    this.dom.modal.innerHTML = '';
    this.modal = null;
  },

  toast(text, kind){
    this._q = this._q || [];
    this._q.push({text, kind});
    if(this._q.length > 6) this._q.shift();
    if(!this._ticking) this.drainToast();
  },
  drainToast(){
    this._q = this._q || [];
    if(!this._q.length){ this._ticking = false; return; }
    this._ticking = true;
    const {text, kind} = this._q.shift();
    const t = el('div','toast ' + (kind||''), text);
    this.dom.toast.appendChild(t);
    setTimeout(()=>{ if(t.parentNode) t.parentNode.removeChild(t); }, 2800);
    setTimeout(()=>this.drainToast(), 950);
  },

  flagToast(text, kind){
    const t = el('div','toast ' + (kind||''), text);
    this.dom.toast.appendChild(t);
    setTimeout(()=>{ if(t.parentNode) t.parentNode.removeChild(t); }, 3400);
  },

  cinema({big, small, dur}){
    const c = this.dom.cinema;
    c.innerHTML = '<div class="line"></div><div class="big fade-cycle">' + big + '</div>' +
      (small ? '<div class="small fade-cycle">' + small + '</div>' : '') + '<div class="line"></div>';
    c.classList.add('on');
    c.style.background = 'radial-gradient(circle at 50% 45%,rgba(20,32,66,.5),rgba(2,4,12,.86))';
    clearTimeout(this._cinemaT);
    this._cinemaT = setTimeout(()=>{
      c.style.transition = 'opacity .8s';
      c.style.opacity = '0';
      setTimeout(()=>{ c.classList.remove('on'); c.style.opacity=''; c.style.transition=''; }, 800);
    }, dur || 3200);
  },

  flash(){
    if(G.S.data.settings.reduceFx) return;
    const f = this.dom.flash;
    f.style.transition = 'none';
    f.style.opacity = '.38';
    requestAnimationFrame(()=>{
      f.style.transition = 'opacity .6s ease';
      f.style.opacity = '0';
    });
  },

  updateChapter(force){
    const S = G.S.data;
    const ci = G.Econ.chapterIndex();
    if(force || this._chapter !== ci){
      this._chapter = ci;
      const ch = CFG.CHAPTERS[ci];
      this.dom.chapter.textContent = ch.sub + ' · ' + ch.name;
      this.dom.chapter.classList.add('glow');
      setTimeout(()=>this.dom.chapter.classList.remove('glow'), 2600);
    }
    const ch = CFG.CHAPTERS[ci];
    this.dom.chapterSub.textContent = S.vision > 1 ? '全天星表计划 · 视野 ' + ROMAN[S.vision-1] : '全天星表计划';
  },

  update(dt){
    const S = G.S.data;
    if(!this.dom) return;
    const d = G.Econ.d;
    const now = performance.now();
    if(now - this.lastHud > 70){
      this.lastHud = now;
      this.dom.count.textContent = fmt(S.observed);
      this.dom.rate.textContent = fmt(d.dps);
      let next = null;
      for(const m of CFG.MILESTONES){ if(S.observed < m.n){ next = m; break; } }
      const capv = next ? next.n : CFG.MILESTONES[CFG.MILESTONES.length-1].n;
      const pct = U.clamp(S.observed / capv, 0, 1);
      const saturated = Uni.ensureIncomplete().length === 0;
      this.dom.bar.style.width = (saturated ? 100 : Math.max(.4, pct * 100)).toFixed(2) + '%';
      this.dom.bar.style.background = saturated
        ? 'linear-gradient(90deg,#ffb64d,#ffd36b)'
        : '';
      this.dom.progress.textContent = saturated ? '饱和' : ((pct * 100 < 10 && pct > 0 ? (pct*100).toFixed(1) : Math.floor(pct*100)) + '%');
      this.dom.progress.title = saturated ? '视野内星区已全部记录' : (next ? ('下一目标 ' + fmt(next.n) + ' 颗') : '全天星表完成');
      this.dom.vision.textContent = '视野 ' + ROMAN[S.vision-1] + ' · ' + G.Econ.visionInfo().name;
      const li = G.Renderer.layerInfo();
      this.dom.layerName.textContent = li.layer.name;
      this.dom.layerUnit.textContent = li.unit;
      const cv = S.comboVal || 1;
      if(this.dom.combo){
        if(cv > 1.05){
          const cps = (S.clickTimes || []).filter(x => U.now() - x < 1000).length;
          this.dom.combo.style.display = '';
          this.dom.combo.textContent = '连击 ×' + cv.toFixed(1) + (cps > 0 ? ' · ' + cps + '/秒' : '');
        } else {
          this.dom.combo.style.display = 'none';
        }
      }

      const mv = S.mv || {};
      if(mv.on){
        this.dom.mvLine.style.display = '';
        const req = G.Econ.mvRequirement();
        const ready = G.Econ.sealReady();
        this.dom.mvCount.textContent = '宇宙 ' + (mv.lit||0) + ' / ' + req;
        this.dom.mvLine.classList.toggle('ready', ready);
        this.dom.mvMod.textContent = ready ? '可闭合 · 点此' : (mv.mod ? (mv.mod.icon + ' ' + mv.mod.name) : '宇宙常数 ×' + (mv.mult||1).toFixed(2));
      } else {
        this.dom.mvLine.style.display = 'none';
      }

      const buffs = S.buffs.filter(b=>b.until > Date.now());
      this.dom.buffs.innerHTML = '';
      for(const b of buffs){
        const left = Math.max(0, Math.ceil((b.until - Date.now())/1000));
        this.dom.buffs.appendChild(el('span','buff', b.label + ' ' + left + 's'));
      }
      this.updateChapter(false);
      this.dom.minimap.style.display = (S.stats.clicks > 3 || S.observed > 500) ? '' : 'none';
    }
    if(now - this.lastBadge > 600){
      this.lastBadge = now;
      for(const t of this.updaters) t();
      this.checkBadges();
    }
  },

  checkBadges(){
    const S = G.S.data;
    const canUp = CFG.CLICK_UPGRADES.some(u=>!S.upgrades[u.id] && S.dust >= u.cost);
    const canTech = CFG.TECH.some(t=>G.Econ.techAvailable(t) && S.research >= G.Econ.techCost(t));
    const canBuild = CFG.BUILDINGS.some(b=>G.Econ.buildingUnlocked(b) && S.dust >= G.Econ.price(b, S.buildings[b.id]||0, 1));
    this.badge('buildings', canBuild);
    this.badge('upgrades', canUp);
    this.badge('tech', canTech);
  },
  badge(tab, on){
    const b = this.dom.tabs.querySelector('.tab[data-tab="' + tab + '"] .badge');
    if(b) b.classList.toggle('on', !!on);
  },

  onTapFeedback(result){
    this.hintClicks++;
    if(this.hintClicks > 3 && !this.dom.hint.classList.contains('gone')){
      this.dom.hint.classList.add('gone');
    }
  }
};

const ROMAN = ['I','II','III','IV','V','VI','VII','VIII'];
function stat(k, v, gold){
  return '<div class="a-stat"><div class="k">' + k + '</div><div class="v' + (gold?' gold':'') + '">' + v + '</div></div>';
}
function fmtTimeShort(sec){
  if(sec < 1) return '—';
  return U.fmtTime(sec);
}
const Uni = G.Universe;

G.UI = UI;
G.ROMAN = ROMAN;
})();
