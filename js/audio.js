(function(){
const G = window.G;

const Audio = {
  ctx:null, master:null, musicGain:null, sfxGain:null, started:false, musicStarted:false,
  lastChime:0,

  init(){
    if(this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = .75;
    this.master.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = .5;
    this.sfxGain.connect(this.master);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = .0;
    this.musicGain.connect(this.master);
    this.started = true;
  },
  resume(){
    this.init();
    if(this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },
  enabled(){
    return G.S.data && G.S.data.settings.sound !== false;
  },
  musicEnabled(){
    return G.S.data && G.S.data.settings.music !== false;
  },

  tone(freq, dur, type, vol, slideTo, delay){
    if(!this.started || !this.enabled()) return;
    const c = this.ctx, t0 = c.currentTime + (delay||0);
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if(slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol == null ? .18 : vol, t0 + .008);
    g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
    o.connect(g); g.connect(this.sfxGain);
    o.start(t0); o.stop(t0 + dur + .02);
  },
  noise(dur, vol, freq, q, delay){
    if(!this.started || !this.enabled()) return;
    const c = this.ctx, t0 = c.currentTime + (delay||0);
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for(let i=0;i<len;i++) d[i] = (Math.random()*2-1) * Math.pow(1 - i/len, 2);
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq || 1200; f.Q.value = q || 1;
    const g = c.createGain(); g.gain.value = vol == null ? .1 : vol;
    src.connect(f); f.connect(g); g.connect(this.sfxGain);
    src.start(t0);
  },

  click(combo){
    const n = Math.min(24, combo || 1);
    const base = 420 + n * 11;
    this.tone(base, .12, 'triangle', .13, base*1.7);
    this.noise(.04, .03, 2600, 2);
  },
  crit(){
    this.tone(90, .5, 'sine', .28, 45);
    this.tone(880, .3, 'sine', .12, 1760);
    this.noise(.2, .08, 1800, .8);
  },
  buy(){
    this.tone(220, .06, 'square', .06, 150);
    this.noise(.07, .06, 900, 1.5);
  },
  tech(){
    [523,659,784].forEach((f,i)=>this.tone(f, .5, 'sine', .07, null, i*.06));
  },
  milestone(){
    [392,494,587,784].forEach((f,i)=>this.tone(f, .9, 'sine', .075, null, i*.09));
    this.noise(.5, .04, 2600, .6);
  },
  sector(){
    const t = performance.now();
    if(t - this.lastChime < 220) return;
    this.lastChime = t;
    this.tone(1200 + Math.random()*300, .35, 'sine', .035, null, 0);
  },
  bounce(hop, delay){
    const d = (delay || 0) / 1000;
    const base = 660 + hop * 180;
    this.tone(base, .18, 'triangle', .09, base * 2.1, d);
    this.tone(base * 2, .1, 'sine', .045, base * 3, d + .02);
  },
  extinguish(){
    this.tone(160, .35, 'sawtooth', .07, 60);
    this.noise(.22, .07, 420, .7);
  },
  warn(stage){
    const f = 220 - Math.min(4, stage) * 22;
    this.tone(f, .8, 'sawtooth', .05, f * .7);
    this.noise(.5, .04, 300, .5);
  },
  meteor(){
    this.noise(.45, .08, 900, .5);
    this.tone(1400, .5, 'sine', .05, 500);
  },
  prestige(){
    [262,330,392,523,659,784,1046].forEach((f,i)=>this.tone(f, 1.6, 'sine', .06, null, i*.12));
  },

  startMusic(){
    if(!this.started || this.musicStarted) return;
    this.musicStarted = true;
    const c = this.ctx;
    const chord = [55, 82.5, 110, 164.8, 220];
    chord.forEach((f, i)=>{
      const o = c.createOscillator();
      o.type = i > 2 ? 'sine' : 'triangle';
      o.frequency.value = f * (i===4 ? 1.005 : 1);
      const g = c.createGain(); g.gain.value = i < 2 ? .045 : .018;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
      const lfo = c.createOscillator(); lfo.frequency.value = .03 + i*.013;
      const lg = c.createGain(); lg.gain.value = 260;
      lfo.connect(lg); lg.connect(lp.frequency);
      o.connect(lp); lp.connect(g); g.connect(this.musicGain);
      o.start(); lfo.start();
    });
    this.musicGain.gain.linearRampToValueAtTime(this.musicEnabled() ? .5 : 0, c.currentTime + 6);
  },
  setMusic(on){
    if(!this.started) return;
    this.musicGain.gain.linearRampToValueAtTime(on ? .5 : 0, this.ctx.currentTime + 1.2);
  },
  setSfx(on){
    if(!this.started) return;
    this.sfxGain.gain.linearRampToValueAtTime(on ? .5 : 0, this.ctx.currentTime + .4);
  }
};

G.Audio = Audio;
})();
