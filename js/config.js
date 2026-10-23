(function(){
const G = window.G;

const STAR_TYPES = [
  {id:'red',   name:'红矮星', color:'#ff7a52', core:'#ffc9a8', w:.600, size:0.70, value:1,   glow:0.45},
  {id:'yellow',name:'黄矮星', color:'#ffd36b', core:'#fff6d8', w:.260, size:0.95, value:5,   glow:0.62},
  {id:'blue',  name:'蓝巨星', color:'#7fd4ff', core:'#e8fbff', w:.080, size:1.25, value:20,  glow:0.80},
  {id:'white', name:'白矮星', color:'#dfeaff', core:'#ffffff', w:.048, size:0.60, value:100, glow:0.70},
  {id:'black', name:'黑洞',   color:'#ff5b8a', core:'#2a0a14', w:.007, size:1.00, value:1000,glow:0.55},
  {id:'pulsar',name:'脉冲星', color:'#c8a6ff', core:'#ffffff', w:.005, size:0.85, value:10000,glow:0.90}
];

const BUILDINGS = [
  {id:'b1', name:'业余望远镜', icon:'🔭', base:3,     out:0.01,  desc:'后院里的一台旧折射镜'},
  {id:'b2', name:'天文台',     icon:'🏛️', base:20,    out:0.1,   desc:'圆顶下的专业设备'},
  {id:'b3', name:'巡天相机',   icon:'📷', base:220,   out:0.8,   desc:'一次拍下一整片天区'},
  {id:'b4', name:'射电阵列',   icon:'📡', base:2400,  out:4.7,   desc:'听见看不见的星光'},
  {id:'b5', name:'太空望远镜', icon:'🛰️', base:26000, out:26,    desc:'不再被大气层干扰', vision:2},
  {id:'b6', name:'轨道观测站', icon:'🌐', base:2.8e5, out:140,   desc:'二十四小时不停歇', need:1e5},
  {id:'b7', name:'AI 星表引擎',icon:'🧠', base:4e6,   out:780,   desc:'每秒识别上万颗恒星', tech:'t4'},
  {id:'b8', name:'星际探测器', icon:'🚀', base:6.6e7, out:4400,  desc:'飞向更远处的眼睛', need:1e9},
  {id:'b9', name:'引力透镜阵', icon:'🪞', base:1.02e9,out:26000, desc:'借星系的质量放大视野', tech:'t8'},
  {id:'b10',name:'量子观测网', icon:'🕸️', base:1.5e10,out:1.6e5, desc:'在所有地方同时观测', tech:'t11'},
  {id:'b11',name:'虫洞中继站', icon:'🌀', base:2e11,  out:1e6,   desc:'跨越宇宙尺度的数据通道', vision:5},
  {id:'b12',name:'视界之眼',   icon:'👁️', base:2.8e12,out:6.5e6, desc:'宇宙边缘的最后一座观测站', tech:'t13'}
];

const CLICK_UPGRADES = [
  {id:'c1', name:'校准目镜', icon:'◎', cost:60,    mul:2,   desc:'点击 ×2'},
  {id:'c2', name:'星图记忆', icon:'▤', cost:350,   mul:2.5, desc:'点击 ×2.5'},
  {id:'c3', name:'双手观测', icon:'✋', cost:3e3,   mul:3,   desc:'点击 ×3'},
  {id:'c4', name:'神经同步', icon:'⚡', cost:2e4,   pct:.03, desc:'点击 += 秒产出 3%'},
  {id:'c5', name:'意识扩展', icon:'◉', cost:2.5e5, mul:3.5, desc:'点击 ×3.5'},
  {id:'c6', name:'群星共鸣', icon:'✧', cost:3e6,   pct:.06, desc:'点击 += 秒产出 6%'},
  {id:'c7', name:'深空直觉', icon:'✺', cost:4e7,   mul:3.5, desc:'点击 ×3.5'},
  {id:'c8', name:'引力微调', icon:'⌖', cost:3e8,   crit:.03, desc:'暴击率 +3%'},
  {id:'c9', name:'概率云',   icon:'☁', cost:3e9,   mul:4,   desc:'点击 ×4'},
  {id:'c10',name:'群星低语', icon:'♪', cost:3e10,  pct:.12, desc:'点击 += 秒产出 12%'}
];

const TECH = [
  {id:'t1', name:'基础天文学', cost:1,    g:2,   desc:'全局产出 ×2', col:0, row:4},
  {id:'t2', name:'自适应光学', cost:10,   vis:1, desc:'视野扩展 · 星野', req:['t1'], col:1, row:3},
  {id:'t3', name:'光谱学',     cost:3,    value:2, desc:'恒星价值（星尘）×2', req:['t1'], col:2, row:4},
  {id:'t4', name:'机器视觉',   cost:8,    click:5, desc:'解锁 AI 星表引擎，点击 ×5', req:['t3'], col:3, row:3},
  {id:'t5', name:'星际中继',   cost:90,   vis:1, desc:'视野扩展 · 银河', req:['t2'], col:2, row:2},
  {id:'t6', name:'离线优化',   cost:20,   offline:.8, desc:'离线上限 8 小时，效率 80%', req:['t5'], col:3, row:5},
  {id:'t7', name:'巨构：戴森球', cost:50, mega:'ring', desc:'解锁戴森环与戴森球', req:['t4'], col:4, row:2},
  {id:'t8', name:'引力透镜望远镜', cost:80, vis:1, pres:1, desc:'视野扩展 · 本星系群（需跃迁 1 次）', req:['t5'], col:2, row:1},
  {id:'t9', name:'时间折叠',   cost:120,  g:4,   desc:'全局产出 ×4', req:['t8'], col:3, row:1},
  {id:'t10',name:'巨构：星系驯化', cost:250, mega:'galaxy', desc:'解锁星系驯化', req:['t9'], col:4, row:1},
  {id:'t11',name:'量子纠缠网络', cost:400, vis:1, pres:2, desc:'视野扩展 · 宇宙网（需跃迁 2 次）', req:['t10'], col:5, row:2},
  {id:'t12',name:'维度观测',   cost:800,  g:12,  desc:'全局产出 ×12', req:['t11'], col:5, row:1},
  {id:'t13',name:'视界展开',   cost:2000, vis:1, g:6, pres:3, desc:'视野扩展 · 门扉，全局 ×6（需跃迁 3 次）', req:['t12'], col:5, row:0},
  {id:'t14',name:'范围点亮',   cost:6,    area:5, click:1.5, desc:'点击时同时点亮周围 5 颗星，点击 ×1.5', col:0, row:2},
  {id:'t15',name:'弹射观测',   cost:25,   bounce:{times:1, stars:3}, desc:'点亮后向邻近恒星弹射 1 次，每次 3 颗', req:['t14'], col:1, row:1},
  {id:'t16',name:'弹射强化',   cost:120,  bounce:{times:2, stars:6}, desc:'弹射 2 次，每次 6 颗，点击产出大幅提升', req:['t15'], col:2, row:0},
  {id:'t17',name:'弹射共振',   cost:600,  resonance:true, desc:'每次弹射使本次点击产出 ×2.5 叠加（乘法）', req:['t16'], col:3, row:0},
  {id:'t18',name:'节拍器',     cost:15,   combo:1, desc:'连击更快吃满：18 次/秒即可到 ×10', req:['t14'], col:0, row:0},
  {id:'t19',name:'肌肉记忆',   cost:70,   combo:1, desc:'起算线降到 4 次/秒，16 次/秒吃满，断连衰减更慢', req:['t18'], col:1, row:0},
  {id:'t20',name:'恒星心跳',   cost:320,  combo:1, desc:'起算线 3 次/秒，15 次/秒吃满；持续 60 秒后要求再降 20%', req:['t19'], col:0, row:1},
  {id:'t21',name:'恒星心律',   cost:1200, combo:1, uncap:true, desc:'解除 ×10 上限：超过满值后按超出比例继续增长', req:['t20'], col:0, row:3}
];

const COMBO = {
  cap:10,
  window:[460, 620, 760, 820],
  cpsTop:[20, 18, 16, 15],
  durSec:60,
  decay:[.55, .42, .36, .32],
  dpsShare:.05
};

const VISIONS = [
  {ring:3,  name:'邻域',   chapter:0, scale:1},
  {ring:5,  name:'星野',   chapter:1, scale:14},
  {ring:8,  name:'银河',   chapter:1, scale:160},
  {ring:12, name:'本星系群',chapter:2, scale:1600},
  {ring:16, name:'宇宙网', chapter:3, scale:12000},
  {ring:24, name:'门扉',   chapter:4, scale:90000}
];

const CHAPTERS = [
  {name:'回声', sub:'第一章', ring:3,  bg:'#0a1030', neb:['#1b2f6b','#2a1b5e'], tint:'#7fb0ff'},
  {name:'银盘', sub:'第二章', ring:8,  bg:'#080d24', neb:['#243a7a','#6a2a5e'], tint:'#9fc4ff'},
  {name:'本星系群', sub:'第三章', ring:12, bg:'#070a20', neb:['#3b2a7a','#1d4a6b'], tint:'#b6a6ff'},
  {name:'纤维', sub:'第四章', ring:16, bg:'#06081a', neb:['#51246b','#1a3c5e'], tint:'#c9a6ff'},
  {name:'门扉', sub:'终章', ring:24, bg:'#04050f', neb:['#6b2140','#241a4a'], tint:'#ffb0c4'}
];

const MILESTONES = [
  {n:1,    name:'第一颗',      r:1,  log:1},
  {n:100,  name:'星表初成',    r:2,  log:2},
  {n:1e3,  name:'邻域概览',    r:3,  log:3},
  {n:1e4,  name:'万星之始',    r:4,  log:4},
  {n:1e5,  name:'百万人手',    r:5},
  {n:1e6,  name:'行星际测绘',  r:8,  log:6},
  {n:1e7,  name:'星野',        r:9},
  {n:1e8,  name:'亿星',        r:12, log:9},
  {n:1e9,  name:'旋臂边缘',    r:15, log:12},
  {n:1e10, name:'银河深处',    r:18},
  {n:1e11, name:'银河系完成',  r:30, log:16, prestige:true},
  {n:1e13, name:'仙女座的光',  r:40, log:20},
  {n:1e15, name:'本星系群',    r:55, log:24},
  {n:1e18, name:'宇宙网',      r:80, log:30},
  {n:1e21, name:'视界边缘',    r:120,log:36},
  {n:1e24, name:'全天星表',    r:200,log:42, ending:true}
];

const CORE_UPGRADES = [
  {id:'u1', name:'老练的眼睛', cost:2,   desc:'开局点击 ×10'},
  {id:'u2', name:'遗留设备',   cost:5,   desc:'开局赠送望远镜与天文台'},
  {id:'u3', name:'档案继承',   cost:12,  desc:'开局视野等级 2'},
  {id:'u4', name:'星核共振',   cost:30,  desc:'每个星核 +5% → +8%'},
  {id:'u5', name:'自动采购',   cost:60,  desc:'解锁设施自动购买'},
  {id:'u6', name:'研究传承',   cost:120, desc:'跃迁时保留 25% 研究点'},
  {id:'u7', name:'流星牵引',   cost:250, desc:'流星出现频率 ×2'},
  {id:'u8', name:'巨构蓝图',   cost:600, desc:'开局获得 1 座戴森环'},
  {id:'u9', name:'时间压缩',   cost:1500,desc:'离线效率 +15%'},
  {id:'u10',name:'第二视角',   cost:4000,desc:'跃迁后可选择两个流派'}
];

const FACTIONS = [
  {id:'f1', name:'观测学派', icon:'📘', desc:'稳健均衡', bonus:'全局 ×1.5，科技研究 -30%', cost:'无法使用暗科技'},
  {id:'f2', name:'加速主义', icon:'⚡', desc:'主动点击', bonus:'点击 ×5，暴击率 +10%', cost:'设施产出 ×0.7'},
  {id:'f3', name:'守夜人',   icon:'🌙', desc:'挂机离线', bonus:'离线效率 100%，上限 24h', cost:'点击产出 ×0.5'},
  {id:'f4', name:'熵之信徒', icon:'🔥', desc:'暗科技', bonus:'熄灭效率 ×3（本作未开放）', cost:'观测星尘 ×0.5', hidden:true}
];

const MEGAS = [
  {id:'m1', name:'戴森环', icon:'◯', cost:5e8,  mult:2,  max:5, tech:'t7',
    desc:'在任意黄矮星外围合一道细环，全局产出 ×2'},
  {id:'m2', name:'戴森球', icon:'⬤', cost:5e11, mult:4,  max:3, tech:'t7', req:'m1',
    desc:'把恒星整个包裹起来，全局产出 ×4'},
  {id:'m3', name:'环世界', icon:'◎', cost:5e14, mult:6,  max:2, tech:'t9',
    desc:'恒星周围的绿色光带，全局产出 ×6'},
  {id:'m4', name:'尼科尔森脑', icon:'⬢', cost:5e17, mult:10, max:2, tech:'t10',
    desc:'恒星化作发光的晶格，全局产出 ×10'},
  {id:'m5', name:'星系驯化', icon:'✷', cost:5e20, mult:25, max:2, tech:'t10', req:'m3',
    desc:'让整个星系为您旋转，全局产出 ×25'},
  {id:'m6', name:'宇宙弦引擎', icon:'⌇', cost:5e23, mult:60, max:1, tech:'t13',
    desc:'在两个星系之间拨动发光的弦，全局产出 ×60'}
];

const ACHIEVEMENTS = [
  {id:'a1', name:'起点', cond:s=>s.stats.totalObserved>=1, desc:'观测第一颗恒星'},
  {id:'a2', name:'星表管理员', cond:s=>s.stats.totalObserved>=1e6, desc:'累计观测 100 万颗'},
  {id:'a3', name:'银河的记录者', cond:s=>s.stats.totalObserved>=1e11, desc:'累计观测 1000 亿颗'},
  {id:'a4', name:'手动档', cond:s=>s.stats.clicks>=1000, desc:'点击 1000 次'},
  {id:'a5', name:'不知疲倦', cond:s=>s.stats.clicks>=50000, desc:'点击 5 万次'},
  {id:'a6', name:'连击大师', cond:s=>s.stats.bestCombo>=100, desc:'达成 100 连击'},
  {id:'a7', name:'后院天文学家', cond:s=>s.buildings.b1>=10, desc:'拥有 10 台业余望远镜'},
  {id:'a8', name:'观测帝国', cond:s=>s.stats.buildingsBuilt>=200, desc:'累计购买 200 座设施'},
  {id:'a9', name:'第一座奇迹', cond:s=>s.stats.megasBuilt>=1, desc:'建成第一座巨构'},
  {id:'a10',name:'戴森的梦', cond:s=>s.megas.m1>=3, desc:'建成 3 座戴森环'},
  {id:'a11',name:'许愿', cond:s=>s.stats.meteors>=1, desc:'捕捉第一颗流星'},
  {id:'a12',name:'流星猎人', cond:s=>s.stats.meteors>=25, desc:'捕捉 25 颗流星'},
  {id:'a13',name:'第二次开始', cond:s=>s.stats.prestiges>=1, desc:'完成第一次跃迁'},
  {id:'a14',name:'全能', cond:s=>Object.keys(s.stats.factionsUsed||{}).length>=1, desc:'完成一次选择流派的跃迁'},
  {id:'a15',name:'深夜观测者', cond:s=>{const h=new Date().getHours();return s.stats.totalObserved>1e6&&(h>=2&&h<4);}, desc:'凌晨两点后仍在观测'},
  {id:'a16',name:'一切', cond:s=>s.stats.totalObserved>=1e24, desc:'观测 10²⁴ 颗恒星'},
  {id:'a17',name:'手不必抖', cond:s=>s.stats.crits>=100, desc:'暴击 100 次'},
  {id:'a18',name:'越数越快', cond:s=>s.stats.prestiges>=3, desc:'完成三次跃迁'},
  {id:'a19',name:'熄灯人', cond:s=>s.stats.extinguished>=1e6, desc:'熄灭 100 万颗恒星'},
  {id:'a20',name:'黑暗森林', cond:s=>G.Universe.destroyedRatio()>=.5, desc:'让宇宙熄灭一半'},
  {id:'a21',name:'归零者', cond:s=>s.endings.zero, desc:'完成隐藏结局「归零」'},
  {id:'a22',name:'最后一颗', cond:s=>s.endings.last, desc:'在最后停下'},
  {id:'a23',name:'回声', cond:s=>s.endings.echo, desc:'完成两种结局'},
  {id:'a24',name:'另一个天空', cond:s=>s.mv && s.mv.life>=1, desc:'闭合第一个宇宙'},
  {id:'a25',name:'十重宇宙', cond:s=>s.mv && s.mv.life>=10, desc:'闭合 10 个宇宙'},
  {id:'a26',name:'坍缩', cond:s=>s.stats.prestiges>=2, desc:'完成一次大坍缩'},
  {id:'a27',name:'百宇', cond:s=>s.mv && s.mv.life>=100, desc:'闭合 100 个宇宙'}
];

const LOGS = [
  {id:1,  text:'第一颗。编号 SC-0000001。没什么特别的，但它是第一颗。'},
  {id:2,  text:'星表有了第一页。总部说，这将会是人类最厚的一本书。'},
  {id:3,  text:'邻居很安静。五十光年内，只有我们自己在说话。'},
  {id:4,  text:'一万颗。我把这个数字念出声，办公室里没有人抬头。'},
  {id:5,  text:'望远镜在自己工作了。我开始担心自己会失业。'},
  {id:6,  text:'太阳系已经没有死角。该出发了。'},
  {id:7,  text:'第一次离开黄道面。原来"上方"和"下方"都有星星。'},
  {id:8,  text:'半人马座比邻星，四光年外的一盏小灯。它也是恒星，它也被记录了。'},
  {id:9,  text:'一亿。数字开始脱离直觉。我数不清一亿个人，却数清了一亿颗太阳。'},
  {id:10, text:'有人问我，数完以后会怎样。我说，门会开。他们笑了。'},
  {id:11, text:'银河系有一千亿颗恒星。按现在的速度，需要三千年。需要更快。'},
  {id:12, text:'旋臂的边缘，尘埃很薄，星光很干净。'},
  {id:13, text:'第三个观测站发回了损坏的数据包。里面是空的星区，不是没有星，是星不见了。'},
  {id:14, text:'我把那片空白放大了一百倍。它还在。'},
  {id:15, text:'总部要求我删掉这段记录。我保留了副本。'},
  {id:16, text:'银河系完成。一千亿颗。我在椅子上坐了很久，什么也没做。'},
  {id:17, text:'星核装船了。下一支舰队会用我们的眼睛看天空。'},
  {id:18, text:'仙女座的光用了二百五十万年才到。我们只用了一秒就记下它。'},
  {id:19, text:'银河系之外，星星没有变少。宇宙不肯结束。'},
  {id:20, text:'两个星系之间什么都没有。除了更远的星系。'},
  {id:21, text:'我开始用"片"来称呼星空，而不是"颗"。'},
  {id:22, text:'数据流成了河。我负责站在河边点头。'},
  {id:23, text:'本星系群。我们住在一个小小的引力凹陷里。'},
  {id:24, text:'那些空洞开始连成线。像血管，像树根，像某种结构。'},
  {id:25, text:'宇宙网。不是比喻，真的是一张网。'},
  {id:26, text:'有人问：网的中心是什么？没有人回答。'},
  {id:27, text:'我开始做梦，梦里全是编号。'},
  {id:28, text:'航行日志：无异常。观测日志：无法解释。'},
  {id:29, text:'我听到回声。不是来自前方，是来自后面。'},
  {id:30, text:'可观测宇宙的边缘在四百六十五亿光年外。再往外，光还没走到我们这里。'},
  {id:31, text:'那些还没被照亮的地方，也许正在等我们。'},
  {id:32, text:'门。所有的记录里，"门"这个字出现了太多次。'},
  {id:33, text:'计数器快要没有数位了。'},
  {id:34, text:'最后一颗。编号 SC-1000000000000000000000000。'},
  {id:35, text:'如果宇宙真的可以被数清，那数它的意义是什么？'},
  {id:36, text:'完整记录宇宙者，可叩问门扉。'},
  {id:37, text:'我准备好了。'},
  {id:38, text:'门扉之后，是什么？'},
  {id:39, text:'门扉之后，是我们。'},
  {id:40, text:'这一次，我想慢一点数。'},
  {id:41, text:'宇宙没有变，是我变了。'},
  {id:42, text:'晚安，观星者。'},
  {id:43, text:'数据很干净。只是有点安静。'},
  {id:44, text:'我听到了回声。不是来自前方，是来自后面。'},
  {id:45, text:'有人来过这里。他们也是这样做的。'},
  {id:46, text:'门不是给记录者的。是给最后一个人的。'},
  {id:47, text:'快结束了。'},
  {id:48, text:'我把整片星空关了灯。'},
  {id:49, text:'至少，还剩下这一颗。'},
  {id:50, text:'这一次，我想慢一点数。'}
];

const DARK_TECH = [
  {id:'d1', name:'熄灭理论', cost:{frag:1},        desc:'解锁「熄灭」模式：点击改为熄灭恒星，获得暗物质'},
  {id:'d2', name:'寂静协议', cost:{dm:1e3},        desc:'宇宙反噬 -30%'},
  {id:'d3', name:'引力坍缩', cost:{dm:5e3},        desc:'熄灭效率 ×5'},
  {id:'d4', name:'暗能量提取', cost:{dm:5e4},      desc:'熄灭时同时获得等量星尘'},
  {id:'d5', name:'超新星诱导', cost:{dm:2e5, frag:2}, desc:'熄灭连锁范围大幅扩大，命中更多恒星'},
  {id:'d6', name:'因果断裂', cost:{dm:1e6, frag:3}, desc:'熄灭的恒星同时计入观测数'},
  {id:'d7', name:'巨构：黑洞引擎', cost:{dm:5e6, frag:3}, desc:'解锁暗巨构 · 熄灭效率 ×3，全局 ×2'},
  {id:'d8', name:'真空衰变', cost:{dm:5e7, frag:5}, desc:'主动技能：瞬间熄灭视野内 5% 的星（冷却 5 分钟）'},
  {id:'d9', name:'熵减装置', cost:{dm:2e8, frag:5}, desc:'已熄灭的恒星可以「重燃」，宇宙反噬回落'},
  {id:'d10',name:'归零协议', cost:{dm:1e9, frag:13}, desc:'开启隐藏结局路线'}
];

const WARN_STAGES = [
  {ratio:.10, log:43, text:'星空出现零星的空洞'},
  {ratio:.30, log:44, text:'背景开始出现裂痕'},
  {ratio:.50, log:45, text:'远方出现一片已经熄灭的古老星域'},
  {ratio:.70, log:46, text:'宇宙背景辐射变红'},
  {ratio:.90, log:47, text:'屏幕偶尔闪烁，UI 轻微错位'}
];

const SHOP_TECH_ORDER = ['t1','t2','t3','t4','t5','t6','t7','t8','t9','t10','t11','t12','t13'];

const UNIVERSE_STARS = 2e11;

const LAYERS = [
  {id:'sector',   name:'星区', sub:'单颗恒星可见', z:0.42},
  {id:'const',    name:'星座', sub:'12 星区',      z:0.26},
  {id:'arm',      name:'旋臂', sub:'625 星座',     z:0.16},
  {id:'galaxy',   name:'银河', sub:'4 旋臂',       z:0.105},
  {id:'universe', name:'宇宙', sub:'50 银河',      z:0}
];

const HIERARCHY = {
  dotsPerSector: 118,
  sectorsPerConst: 12,
  constsPerArm: 625,
  armsPerGalaxy: 4,
  galaxiesPerUniverse: 50
};
HIERARCHY.sectorsPerUniverse = HIERARCHY.galaxiesPerUniverse * HIERARCHY.armsPerGalaxy *
  HIERARCHY.constsPerArm * HIERARCHY.sectorsPerConst;
HIERARCHY.starsPerSector = UNIVERSE_STARS / HIERARCHY.sectorsPerUniverse;
HIERARCHY.starsPerDot = HIERARCHY.starsPerSector / HIERARCHY.dotsPerSector;
HIERARCHY.starsPerConst = HIERARCHY.starsPerSector * HIERARCHY.sectorsPerConst;
HIERARCHY.starsPerArm = HIERARCHY.starsPerConst * HIERARCHY.constsPerArm;
HIERARCHY.starsPerGalaxy = HIERARCHY.starsPerArm * HIERARCHY.armsPerGalaxy;


const MV_MODS = [
  {id:'mv1', name:'明亮的天空', icon:'✦', desc:'点击 ×3',            click:3},
  {id:'mv2', name:'稠密的星海', icon:'✷', desc:'设施产出 ×2',         build:2},
  {id:'mv3', name:'温和的常数', icon:'◈', desc:'全局产出 ×1.5',       global:1.5},
  {id:'mv4', name:'异常的研究', icon:'⌬', desc:'研究点 +50%',         research:1.5},
  {id:'mv5', name:'流星之雨',   icon:'☄', desc:'流星出现频率 ×2',     meteor:2},
  {id:'mv6', name:'暴烈的光',   icon:'✧', desc:'暴击率 +8%',          crit:.08}
];

function sectorCap(ring){
  return 120 * Math.pow(10, 0.95 * ring);
}
function sectorResearch(ring){
  return 1 + Math.floor(ring * 0.6);
}

G.CFG = {STAR_TYPES, BUILDINGS, CLICK_UPGRADES, TECH, VISIONS, CHAPTERS, MILESTONES,
  CORE_UPGRADES, FACTIONS, MEGAS, ACHIEVEMENTS, LOGS, sectorCap, sectorResearch, SHOP_TECH_ORDER,
  DARK_TECH, WARN_STAGES, MV_MODS, UNIVERSE_STARS, LAYERS, HIERARCHY, COMBO};
})();
