(function(){
const G = window.G = window.G || {};

const UNITS = [
  {v:1e16, s:'', sci:true},
  {v:1e12, s:'万亿', d:2},
  {v:1e8,  s:'亿',   d:2},
  {v:1e4,  s:'万',   d:2}
];

function fmt(n, opts){
  opts = opts || {};
  if(!isFinite(n)) return '∞';
  if(n < 0) return '-' + fmt(-n, opts);
  if(n < 1 && n > 0) return n < 0.01 ? n.toFixed(3) : (Math.round(n*100)/100).toString();
  if(n < 1e4) return Math.floor(n).toLocaleString('en-US');
  if(n < 1e8) return trim(n/1e4, 2) + '万';
  if(n < 1e12) return trim(n/1e8, 2) + '亿';
  if(n < 1e16) return trim(n/1e12, 2) + '万亿';
  const e = Math.floor(Math.log10(n));
  const m = n / Math.pow(10, e);
  return trim(m, 2) + 'e' + e;
}
function trim(n, d){
  let s = n.toFixed(d);
  s = s.replace(/\.?0+$/, '');
  return s;
}
function fmtInt(n){
  if(n < 1e21) return Math.floor(n).toLocaleString('en-US');
  return fmt(n);
}
function fmtRate(n){
  if(n <= 0) return '0';
  return fmt(n, {rate:true});
}
function fmtTime(sec){
  sec = Math.max(0, Math.floor(sec));
  if(sec < 60) return sec + '秒';
  const m = Math.floor(sec/60), s = sec%60;
  if(m < 60) return m + '分' + (s ? s + '秒' : '');
  const h = Math.floor(m/60), mm = m%60;
  if(h < 24) return h + '小时' + (mm ? mm + '分' : '');
  const d = Math.floor(h/24), hh = h%24;
  return d + '天' + (hh ? hh + '小时' : '');
}
function clamp(v,a,b){ return v < a ? a : v > b ? b : v; }
function lerp(a,b,t){ return a + (b-a)*t; }
function smooth(t){ t = clamp(t,0,1); return t*t*(3-2*t); }
function easeOutCubic(t){ return 1 - Math.pow(1-clamp(t,0,1),3); }
function easeInOutCubic(t){ t = clamp(t,0,1); return t<.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2; }

function hash2(x, y, seed){
  let h = (x|0) * 374761393 + (y|0) * 668265263 + (seed|0) * 1442695041;
  h = (h ^ (h >> 13)) * 1274126177;
  h = h ^ (h >> 16);
  return (h >>> 0) / 4294967296;
}
function hash3(x, y, z, seed){
  let h = (x|0) * 374761393 + (y|0) * 668265263 + (z|0) * 2246822519 + (seed|0) * 1442695041;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}
function mulberry32(a){
  return function(){
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function pick(rng, arr){ return arr[Math.floor(rng()*arr.length)]; }
function rgba(hex, a){
  const h = hex.replace('#','');
  const n = parseInt(h.length===3 ? h.split('').map(c=>c+c).join('') : h, 16);
  return 'rgba(' + ((n>>16)&255) + ',' + ((n>>8)&255) + ',' + (n&255) + ',' + a + ')';
}
function mixHex(a, b, t){
  const pa = parseInt(a.slice(1),16), pb = parseInt(b.slice(1),16);
  const ar=(pa>>16)&255, ag=(pa>>8)&255, ab=pa&255;
  const br=(pb>>16)&255, bg=(pb>>8)&255, bb=pb&255;
  const r=Math.round(lerp(ar,br,t)), g=Math.round(lerp(ag,bg,t)), bl=Math.round(lerp(ab,bb,t));
  return '#' + ((1<<24) + (r<<16) + (g<<8) + bl).toString(16).slice(1);
}
function qs(sel){ return document.querySelector(sel); }
function el(tag, cls, html){
  const d = document.createElement(tag);
  if(cls) d.className = cls;
  if(html != null) d.innerHTML = html;
  return d;
}
function on(target, ev, fn, opts){ target.addEventListener(ev, fn, opts); return fn; }
function now(){ return performance.now(); }
function easeOutBack(t){
  t = clamp(t,0,1);
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3*Math.pow(t-1,3) + c1*Math.pow(t-1,2);
}

G.U = {fmt, fmtInt, fmtRate, fmtTime, clamp, lerp, smooth, easeOutCubic, easeInOutCubic,
  easeOutBack, hash2, hash3, mulberry32, pick, rgba, mixHex, qs, el, on, now};
})();
