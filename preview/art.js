/* =========================================================
   رەسىملەر (SVG) — بارلىق بۇيۇم، قۇتا، سىنبەلگە ۋە سالون رەسىملىرى
   ========================================================= */
(function(){
const DEFS = `
<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
 <linearGradient id="gGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff6c4"/><stop offset=".45" stop-color="#f5c84c"/><stop offset="1" stop-color="#b47a14"/></linearGradient>
 <linearGradient id="gGoldH" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#c98d1e"/><stop offset=".35" stop-color="#fff0a8"/><stop offset=".7" stop-color="#f2bd3e"/><stop offset="1" stop-color="#a86d10"/></linearGradient>
 <linearGradient id="gRose" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ff8fbc"/><stop offset=".4" stop-color="#ffd2e5"/><stop offset="1" stop-color="#f06aa3"/></linearGradient>
 <linearGradient id="gWhite" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e9d5e0"/><stop offset=".4" stop-color="#ffffff"/><stop offset="1" stop-color="#dcc3d2"/></linearGradient>
 <linearGradient id="gBlack" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2a1424"/><stop offset=".4" stop-color="#6b3a5c"/><stop offset="1" stop-color="#1e0d19"/></linearGradient>
 <linearGradient id="gRed" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b3122f"/><stop offset=".4" stop-color="#ff5a73"/><stop offset="1" stop-color="#9c0f28"/></linearGradient>
 <linearGradient id="gPinkB" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e0407a"/><stop offset=".4" stop-color="#ff9cc2"/><stop offset="1" stop-color="#c92f68"/></linearGradient>
 <linearGradient id="gLav" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f1e6ff"/><stop offset=".5" stop-color="#c3a6ff"/><stop offset="1" stop-color="#8a63e6"/></linearGradient>
 <linearGradient id="gLavB" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9a74f0"/><stop offset=".4" stop-color="#dccbff"/><stop offset="1" stop-color="#7f58dc"/></linearGradient>
 <linearGradient id="gPinkBox" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd6e8"/><stop offset=".55" stop-color="#ff8fbe"/><stop offset="1" stop-color="#e0558f"/></linearGradient>
 <linearGradient id="gGemBox" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e8fbff"/><stop offset=".55" stop-color="#7ed0ea"/><stop offset="1" stop-color="#2a7a96"/></linearGradient>
 <linearGradient id="gGlass" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffffff" stop-opacity=".55"/><stop offset=".3" stop-color="#ffffff" stop-opacity=".95"/><stop offset="1" stop-color="#f3dff0" stop-opacity=".6"/></linearGradient>
 <linearGradient id="gLiqPink" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb3d1"/><stop offset="1" stop-color="#f0609c"/></linearGradient>
 <linearGradient id="gLiqLav" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e3d2ff"/><stop offset="1" stop-color="#9b78f0"/></linearGradient>
 <linearGradient id="gLiqGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe9a6"/><stop offset="1" stop-color="#f0a83a"/></linearGradient>
 <linearGradient id="gLiqRed" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff7d8f"/><stop offset="1" stop-color="#c3163a"/></linearGradient>
 <radialGradient id="gGem" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#ffffff"/><stop offset=".3" stop-color="#9ff0ff"/><stop offset="1" stop-color="#2b8fd6"/></radialGradient>
 <radialGradient id="gRuby" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#ffffff"/><stop offset=".3" stop-color="#ff8fa8"/><stop offset="1" stop-color="#c0123c"/></radialGradient>
 <radialGradient id="gPuff" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#fff"/><stop offset=".6" stop-color="#ffd3e4"/><stop offset="1" stop-color="#f39ac0"/></radialGradient>
 <radialGradient id="gMirror" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#dff1ff"/><stop offset="1" stop-color="#a9cbe8"/></radialGradient>
 <radialGradient id="gBlush" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#ffd0dc"/><stop offset="1" stop-color="#f27a9c"/></radialGradient>
 <radialGradient id="gCoin" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff7c2"/><stop offset=".5" stop-color="#ffcf3f"/><stop offset="1" stop-color="#d48a0c"/></radialGradient>
 <linearGradient id="gStar" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd0ec"/><stop offset=".5" stop-color="#ff5fb4"/><stop offset="1" stop-color="#d42c8c"/></linearGradient>
 <linearGradient id="gBolt" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d9ffb0"/><stop offset=".5" stop-color="#8fe04a"/><stop offset="1" stop-color="#3f9e1c"/></linearGradient>
 <linearGradient id="gWood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1e6"/><stop offset="1" stop-color="#f1d3c0"/></linearGradient>
 <linearGradient id="gWall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe7f1"/><stop offset="1" stop-color="#ffd2e4"/></linearGradient>
 <linearGradient id="gFloor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6d9c8"/><stop offset="1" stop-color="#e9bfa8"/></linearGradient>
 <linearGradient id="gSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bfe6ff"/><stop offset="1" stop-color="#fff3d6"/></linearGradient>
 <linearGradient id="gCurtain" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ff9cc4"/><stop offset=".5" stop-color="#ffd6e7"/><stop offset="1" stop-color="#ff8fba"/></linearGradient>
 <linearGradient id="gGreen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9be27a"/><stop offset="1" stop-color="#4fae3a"/></linearGradient>
</defs></svg>`;

const svg = (body, vb='0 0 100 100') => `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
const shadow = (cx=50, cy=93, rx=26) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="4.5" fill="#7a2c5a" opacity=".13"/>`;
const star4 = (x,y,r,c='#fff') => `<path d="M${x} ${y-r}Q${x+r*.18} ${y-r*.18} ${x+r} ${y}Q${x+r*.18} ${y+r*.18} ${x} ${y+r}Q${x-r*.18} ${y+r*.18} ${x-r} ${y}Q${x-r*.18} ${y-r*.18} ${x} ${y-r}Z" fill="${c}"/>`;
const sparkles = () => star4(18,22,7,'#fff6b0') + star4(84,30,5,'#ffffff') + star4(80,74,4,'#fff6b0');
const crown = (x,y,s=1) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-14 0L-16 -14L-7 -6L0 -17L7 -6L16 -14L14 0Z" fill="url(#gGold)" stroke="#a86d10" stroke-width="1.2" stroke-linejoin="round"/><circle cx="0" cy="-17" r="2.4" fill="url(#gRuby)"/><circle cx="-16" cy="-14" r="2" fill="url(#gGem)"/><circle cx="16" cy="-14" r="2" fill="url(#gGem)"/><rect x="-14" y="-2" width="28" height="3" rx="1.2" fill="#e0a52a"/></g>`;
const shine = (x,y,w,h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${w/2}" fill="#fff" opacity=".55"/>`;

/* ---------------- لەۋ بوياق ---------------- */
function lipstick(x, y, s, tube, bullet, gem){
  return `<g transform="translate(${x} ${y}) scale(${s})">
   <rect x="-15" y="-36" width="30" height="36" rx="5" fill="url(#${tube})" stroke="#00000022"/>
   <rect x="-16.5" y="-41" width="33" height="7" rx="2.5" fill="url(#gGoldH)"/>
   <rect x="-11" y="-60" width="22" height="21" rx="2" fill="url(#gGoldH)"/>
   <path d="M-9 -60V-74Q-9 -85 9 -92V-60Z" fill="url(#${bullet})"/>
   <path d="M-6 -62V-75Q-5 -82 0 -85" stroke="#fff" stroke-width="2.5" fill="none" opacity=".5" stroke-linecap="round"/>
   ${shine(-11,-32,4.5,26)}
   ${gem ? `<path d="M0 -24L6 -18L0 -9L-6 -18Z" fill="url(#${gem})" stroke="#fff" stroke-width="1.2"/>` : ''}
  </g>`;
}
const LIP = [
  () => shadow(50,90,16) + lipstick(50,90,.62,'gRose','gPinkB'),
  () => shadow(50,92,19) + lipstick(50,92,.78,'gWhite','gPinkB'),
  () => shadow(50,93,21) + lipstick(50,93,.88,'gGoldH','gRed'),
  () => shadow(50,93,22) + lipstick(50,93,.9,'gBlack','gRed','gRuby'),
  () => shadow(50,93,32) + lipstick(34,93,.72,'gWhite','gPinkB') + lipstick(66,93,.72,'gGoldH','gRed') + lipstick(50,95,.8,'gBlack','gRed','gRuby'),
  () => shadow(50,93,24) + lipstick(50,93,.84,'gGoldH','gRed','gGem') + crown(50,22,.9) + sparkles(),
];

/* ---------------- ئەتىر ---------------- */
function perfumeBody(l){
  switch(l){
    case 0: return `<rect x="38" y="52" width="24" height="36" rx="11" fill="url(#gGlass)" stroke="#e7a8c7" stroke-width="1.5"/>
      <rect x="40.5" y="62" width="19" height="23.5" rx="9" fill="url(#gLiqPink)"/>
      <rect x="43" y="42" width="14" height="11" rx="3" fill="url(#gGoldH)"/>${shine(42,56,3.5,24)}`;
    case 1: return `<rect x="28" y="42" width="44" height="48" rx="8" fill="url(#gGlass)" stroke="#b89be8" stroke-width="1.5"/>
      <rect x="32" y="52" width="36" height="34" rx="6" fill="url(#gLiqLav)"/>
      <rect x="44" y="34" width="12" height="9" fill="url(#gGoldH)"/><rect x="38" y="20" width="24" height="15" rx="4" fill="url(#gLav)" stroke="#8a63e6" stroke-width="1"/>${shine(33,46,4,38)}`;
    case 2: return `<path d="M50 91C20 70 18 50 32 42C41 37 48 42 50 47C52 42 59 37 68 42C82 50 80 70 50 91Z" fill="url(#gGlass)" stroke="#ee8db8" stroke-width="1.6"/>
      <path d="M50 86C27 69 26 56 35 50C42 46 47 50 50 55C53 50 58 46 65 50C74 56 73 69 50 86Z" fill="url(#gLiqPink)"/>
      <rect x="44" y="30" width="12" height="11" rx="2" fill="url(#gGoldH)"/><ellipse cx="50" cy="26" rx="10" ry="6" fill="url(#gGold)"/>${shine(31,49,3.5,16)}`;
    case 3: return `<circle cx="46" cy="66" r="24" fill="url(#gGlass)" stroke="#ee8db8" stroke-width="1.6"/>
      <circle cx="46" cy="69" r="19" fill="url(#gLiqPink)"/>
      <rect x="40" y="34" width="12" height="9" fill="url(#gGoldH)"/>
      <path d="M52 37Q66 36 72 46" stroke="#d8a23a" stroke-width="2.5" fill="none"/>
      <ellipse cx="76" cy="54" rx="8" ry="10" fill="url(#gRose)" stroke="#e0558f"/>
      <path d="M76 64L74 76M76 64L78 76M76 64L76 77" stroke="#f5c84c" stroke-width="1.6"/>${shine(30,56,4,18)}`;
    default: return `<path d="M50 30L72 46L68 88H32L28 46Z" fill="url(#gGlass)" stroke="#e2b04c" stroke-width="1.6"/>
      <path d="M50 40L66 51L63 84H37L34 51Z" fill="url(#gLiqGold)"/>
      <path d="M50 30L50 88M28 46L68 88M72 46L32 88" stroke="#fff" stroke-width="1" opacity=".45"/>
      <path d="M42 30L50 14L58 30Z" fill="url(#gGold)" stroke="#a86d10" stroke-width="1"/>${shine(33,50,3.5,30)}`;
  }
}
const PER = [0,1,2,3,4].map(l => () => shadow(50,92,l?24:14) + perfumeBody(l));
PER.push(() => shadow(50,92,24) + perfumeBody(4) + `<path d="M50 40L66 51L63 84H37L34 51Z" fill="url(#gLiqPink)" opacity=".55"/>` + crown(50,15,.75) + sparkles());

/* ---------------- پاۋدىر / رەڭ تاختىسى ---------------- */
const CMP = [
  () => shadow(50,88,22) + `<circle cx="50" cy="60" r="26" fill="url(#gPuff)" stroke="#f08ab5" stroke-width="1.4"/>
      <path d="M30 52Q50 40 70 52" stroke="#ffffff" stroke-width="5" fill="none" opacity=".8"/>
      <path d="M44 38Q50 30 56 38Q50 44 44 38Z" fill="url(#gPinkB)"/>${star4(64,66,3)}`,
  () => shadow(50,90,30) + `<ellipse cx="50" cy="70" rx="32" ry="16" fill="url(#gGoldH)"/>
      <ellipse cx="50" cy="62" rx="32" ry="16" fill="url(#gPinkBox)" stroke="#d24b84" stroke-width="1.2"/>
      <path d="M44 58Q50 50 56 58Q50 64 44 58Z" fill="#fff" opacity=".9"/><ellipse cx="38" cy="56" rx="8" ry="3" fill="#fff" opacity=".5"/>`,
  () => shadow(50,92,30) + `<ellipse cx="50" cy="36" rx="30" ry="22" fill="url(#gGoldH)"/><ellipse cx="50" cy="36" rx="25" ry="18" fill="url(#gMirror)"/>
      <path d="M36 28L44 22" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
      <ellipse cx="50" cy="76" rx="32" ry="15" fill="url(#gGoldH)"/><ellipse cx="50" cy="72" rx="32" ry="14" fill="url(#gPinkBox)"/>
      <ellipse cx="50" cy="72" rx="21" ry="9" fill="url(#gBlush)"/><ellipse cx="44" cy="70" rx="6" ry="2" fill="#fff" opacity=".6"/>`,
  () => shadow(50,92,32) + `<ellipse cx="50" cy="34" rx="31" ry="23" fill="url(#gGold)"/><ellipse cx="50" cy="34" rx="25" ry="18" fill="url(#gMirror)"/>
      <path d="M36 26L44 20" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
      <ellipse cx="50" cy="76" rx="34" ry="16" fill="url(#gGold)"/><ellipse cx="50" cy="72" rx="34" ry="15" fill="#fff4f8"/>
      <ellipse cx="38" cy="72" rx="13" ry="8" fill="url(#gBlush)"/><ellipse cx="62" cy="72" rx="13" ry="8" fill="#e9b28f"/>
      <path d="M50 64L53 67L50 70L47 67Z" fill="url(#gGem)"/>`,
  () => shadow(50,90,36) + `<rect x="14" y="34" width="72" height="50" rx="8" fill="url(#gGoldH)"/><rect x="17" y="37" width="66" height="44" rx="6" fill="#fff4f8"/>
      ${['#ff9ab8','#f5c0a0','#c9a2ff','#ff6f91','#e8b04c','#8fc7ff'].map((c,i)=>`<circle cx="${29+(i%3)*21}" cy="${49+Math.floor(i/3)*20}" r="8" fill="${c}"/><ellipse cx="${27+(i%3)*21}" cy="${46+Math.floor(i/3)*20}" rx="3" ry="1.5" fill="#fff" opacity=".7"/>`).join('')}`,
  () => shadow(50,93,34) + `<path d="M50 90C14 66 12 40 30 32C40 28 47 34 50 40C53 34 60 28 70 32C88 40 86 66 50 90Z" fill="url(#gGold)" stroke="#a86d10" stroke-width="1.2"/>
      <path d="M50 82C22 63 22 44 33 39C41 36 47 41 50 47C53 41 59 36 67 39C78 44 78 63 50 82Z" fill="#fff4f8"/>
      <circle cx="38" cy="52" r="7" fill="#ff9ab8"/><circle cx="62" cy="52" r="7" fill="#c9a2ff"/><circle cx="50" cy="66" r="7" fill="#ff6f91"/>
      <path d="M50 42L54 46L50 51L46 46Z" fill="url(#gGem)"/>` + crown(50,24,.6) + sparkles(),
];

/* ---------------- تىرناق لاكى ---------------- */
function polish(x, y, s, liq, cap, extra=''){
  return `<g transform="translate(${x} ${y}) scale(${s})">
   <rect x="-16" y="-34" width="32" height="34" rx="9" fill="url(#gGlass)" stroke="#d99cbb" stroke-width="1.4"/>
   <rect x="-13" y="-28" width="26" height="25" rx="7" fill="url(#${liq})"/>${extra}
   <rect x="-7" y="-40" width="14" height="7" fill="#f2e3ea"/>
   <rect x="-8" y="-72" width="16" height="33" rx="4" fill="url(#${cap})"/>
   ${shine(-12,-30,4,22)}
  </g>`;
}
const glitter = [[-8,-20],[4,-14],[-3,-9],[7,-23],[-9,-12],[1,-24]].map(([a,b])=>`<circle cx="${a}" cy="${b}" r="1.4" fill="#fff"/>`).join('');
const NAIL = [
  () => shadow(50,90,15) + polish(50,90,.7,'gLiqPink','gWhite'),
  () => shadow(50,92,18) + polish(50,92,.85,'gLiqRed','gBlack'),
  () => shadow(50,93,19) + polish(50,93,.92,'gLiqPink','gGoldH'),
  () => shadow(50,93,19) + polish(50,93,.95,'gLiqLav','gGoldH',glitter),
  () => shadow(50,93,32) + polish(30,93,.7,'gLiqRed','gBlack') + polish(70,93,.7,'gLiqLav','gGoldH',glitter) + polish(50,95,.82,'gLiqPink','gGoldH'),
  () => shadow(50,93,20) + polish(50,93,.92,'gLiqRed','gGoldH',glitter) + `<path d="M50 6L62 18L50 34L38 18Z" fill="url(#gGem)" stroke="#fff" stroke-width="1.5"/><path d="M38 18H62M50 6V34" stroke="#fff" opacity=".6"/>` + sparkles(),
];

/* ---------------- سوۋغات قۇتىلىرى (گېنېراتور) ---------------- */
function giftBox(level, body, rib){
  const s = [.78,.9,1][level-1];
  return shadow(50,92,28*s) + `<g transform="translate(50 92) scale(${s})">
   <rect x="-30" y="-46" width="60" height="46" rx="6" fill="url(#${body})" stroke="#00000018"/>
   <rect x="-34" y="-58" width="68" height="15" rx="5" fill="url(#${body})" stroke="#00000022"/>
   <rect x="-6" y="-58" width="12" height="58" fill="url(#${rib})"/>
   <path d="M0 -58C-22 -80 -34 -60 -14 -58M0 -58C22 -80 34 -60 14 -58" stroke="url(#${rib})" stroke-width="7" fill="none" stroke-linecap="round"/>
   <circle cx="0" cy="-59" r="6" fill="url(#${rib})"/>
   ${shine(-26,-40,4,32)}
   ${level>=3 ? `<path d="M0 -30L5 -25L0 -18L-5 -25Z" fill="url(#gGem)" stroke="#fff"/>` : ''}
  </g>` + (level>=2 ? star4(18,30,5,'#fff6b0') : '') + (level>=3 ? star4(84,24,6,'#fff') : '');
}

/* ---------------- سىنبەلگىلەر ---------------- */
const ICON = {
  coin: svg(`<circle cx="50" cy="50" r="42" fill="url(#gCoin)" stroke="#c07a08" stroke-width="5"/><circle cx="50" cy="50" r="30" fill="none" stroke="#fff3b0" stroke-width="3" opacity=".7"/><path d="M50 70C30 56 30 42 40 38C46 36 49 40 50 43C51 40 54 36 60 38C70 42 70 56 50 70Z" fill="#e8a414"/>`),
  star: svg(`<path d="M50 6L62 36L94 38L69 58L78 90L50 72L22 90L31 58L6 38L38 36Z" fill="url(#gStar)" stroke="#b81f78" stroke-width="4" stroke-linejoin="round"/><path d="M40 30L48 14" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".7"/>`),
  bolt: svg(`<path d="M58 4L18 56H46L38 96L82 40H54Z" fill="url(#gBolt)" stroke="#2f7d12" stroke-width="5" stroke-linejoin="round"/><path d="M52 16L32 48" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".6"/>`),
  gift: svg(giftBox(3,'gPinkBox','gGoldH')),
  gem: svg(`<path d="M50 8L86 38L50 94L14 38Z" fill="url(#gGem)" stroke="#1e5a70" stroke-width="5" stroke-linejoin="round"/><path d="M50 8L64 38H36Z" fill="#fff" opacity=".55"/><path d="M14 38H86" stroke="#fff" stroke-width="3" opacity=".45"/>`),
  gemBox: svg(giftBox(3,'gGemBox','gGoldH') + `<g transform="translate(50 58) scale(.42)"><path d="M0 -28L24 0L0 36L-24 0Z" fill="#7ed0ea" stroke="#1e5a70" stroke-width="8" stroke-linejoin="round"/></g>`),

  tasks: svg(`<rect x="18" y="12" width="64" height="80" rx="10" fill="url(#gWhite)" stroke="#d24b84" stroke-width="5"/><rect x="34" y="4" width="32" height="16" rx="6" fill="url(#gGoldH)"/><path d="M30 42L38 50L52 36M30 68L38 76L52 62" stroke="#46c35a" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/><rect x="58" y="40" width="14" height="6" rx="3" fill="#f3a9c8"/><rect x="58" y="66" width="14" height="6" rx="3" fill="#f3a9c8"/>`),
  shop: svg(`<rect x="14" y="44" width="72" height="48" rx="6" fill="url(#gWood)" stroke="#c77a52" stroke-width="4"/><path d="M8 44L18 12H82L92 44Z" fill="#fff" stroke="#d24b84" stroke-width="4"/><path d="M18 12L14 44M34 12L32 44M50 12V44M66 12L68 44M82 12L86 44" stroke="#ff5fa2" stroke-width="9"/><rect x="38" y="60" width="24" height="32" rx="3" fill="#7fd3f0" stroke="#3a9ac2" stroke-width="3"/>`),
  salon: svg(`<path d="M50 8L92 40V90H8V40Z" fill="url(#gPinkBox)" stroke="#c93f7c" stroke-width="5" stroke-linejoin="round"/><ellipse cx="50" cy="56" rx="16" ry="20" fill="url(#gMirror)" stroke="url(#gGoldH)" stroke-width="5"/><rect x="26" y="78" width="48" height="8" rx="3" fill="url(#gGoldH)"/>`),
  book: svg(`<path d="M50 20C38 12 22 12 10 16V86C22 82 38 82 50 90C62 82 78 82 90 86V16C78 12 62 12 50 20Z" fill="url(#gLav)" stroke="#7f58dc" stroke-width="5" stroke-linejoin="round"/><path d="M50 20V90" stroke="#7f58dc" stroke-width="4"/><path d="M28 40C24 34 30 28 34 34C38 28 44 34 40 40L34 46Z" fill="#ff5fa2"/><rect x="58" y="34" width="22" height="5" rx="2" fill="#fff" opacity=".8"/><rect x="58" y="48" width="18" height="5" rx="2" fill="#fff" opacity=".8"/>`),
  crown: svg(crown(50,74,2.6)),
  gear: svg(`<path d="M50 8l8 10 12-4 2 13 13 2-4 12 10 8-10 8 4 12-13 2-2 13-12-4-8 10-8-10-12 4-2-13-13-2 4-12-10-8 10-8-4-12 13-2 2-13 12 4z" fill="url(#gLav)" stroke="#7f58dc" stroke-width="4" stroke-linejoin="round"/><circle cx="50" cy="50" r="14" fill="#fff" stroke="#7f58dc" stroke-width="4"/>`),
  letter: svg(`<rect x="8" y="26" width="84" height="58" rx="8" fill="url(#gWhite)" stroke="#d24b84" stroke-width="5"/><path d="M10 30L50 60L90 30" stroke="#d24b84" stroke-width="5" fill="none" stroke-linejoin="round"/><path d="M50 74C36 64 36 54 43 52C47 51 49 53 50 55C51 53 53 51 57 52C64 54 64 64 50 74Z" fill="#ff3f86" stroke="#fff" stroke-width="2"/>`),
  heart: svg(`<path d="M50 88C10 60 6 32 24 22C36 16 46 24 50 32C54 24 64 16 76 22C94 32 90 60 50 88Z" fill="url(#gStar)" stroke="#b81f78" stroke-width="5"/><path d="M26 34Q30 26 38 26" stroke="#fff" stroke-width="5" stroke-linecap="round" fill="none" opacity=".7"/>`),
  lock: svg(`<rect x="22" y="44" width="56" height="46" rx="10" fill="url(#gGold)" stroke="#a86d10" stroke-width="5"/><path d="M34 44V32a16 16 0 0 1 32 0V44" stroke="#a86d10" stroke-width="8" fill="none"/><circle cx="50" cy="64" r="6" fill="#a86d10"/><rect x="47" y="64" width="6" height="14" rx="3" fill="#a86d10"/>`),
  sound: svg(`<path d="M14 38H32L56 18V82L32 62H14Z" fill="url(#gLav)" stroke="#7f58dc" stroke-width="5" stroke-linejoin="round"/><path d="M68 34Q80 50 68 66M78 24Q96 50 78 76" stroke="#7f58dc" stroke-width="6" fill="none" stroke-linecap="round"/>`),
  music: svg(`<path d="M42 22V64A16 16 0 1 1 34 52V36H70V22Z" fill="url(#gLav)" stroke="#7f58dc" stroke-width="5" stroke-linejoin="round"/><circle cx="26" cy="72" r="14" fill="url(#gLav)" stroke="#7f58dc" stroke-width="5"/><circle cx="70" cy="64" r="12" fill="url(#gLav)" stroke="#7f58dc" stroke-width="5"/>`),
  vibrate: svg(`<rect x="30" y="12" width="40" height="76" rx="10" fill="url(#gLav)" stroke="#7f58dc" stroke-width="5"/><path d="M16 34V66M8 40V60M84 34V66M92 40V60" stroke="#7f58dc" stroke-width="6" stroke-linecap="round"/>`),
  globe: svg(`<circle cx="50" cy="50" r="40" fill="url(#gMirror)" stroke="#7f58dc" stroke-width="5"/><path d="M10 50H90M50 10C30 30 30 70 50 90M50 10C70 30 70 70 50 90" stroke="#7f58dc" stroke-width="4" fill="none"/>`),
  check: svg(`<circle cx="50" cy="50" r="44" fill="#46c35a" stroke="#fff" stroke-width="6"/><path d="M28 52L44 66L72 36" stroke="#fff" stroke-width="10" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`),
};

/* ---------------- سالون جاھازلىرى (0..100 رامكىدا سىزىلغان) ---------------- */
const DECO_ART = {
  rug:     `<ellipse cx="50" cy="50" rx="48" ry="40" fill="#ff9cc4"/><ellipse cx="50" cy="50" rx="40" ry="32" fill="#ffe0ee"/><ellipse cx="50" cy="50" rx="26" ry="20" fill="#ffb6d3"/><ellipse cx="50" cy="50" rx="12" ry="9" fill="#fff"/>`,
  curtain: `<rect x="0" y="0" width="100" height="8" rx="4" fill="url(#gGoldH)"/><path d="M2 6Q18 50 8 100H30Q22 50 26 6Z" fill="url(#gCurtain)"/><path d="M98 6Q82 50 92 100H70Q78 50 74 6Z" fill="url(#gCurtain)"/><path d="M0 6H100Q90 22 75 18Q62 26 50 18Q38 26 25 18Q10 22 0 6Z" fill="#ff8fba"/>`,
  table:   `<rect x="4" y="30" width="92" height="14" rx="4" fill="url(#gWhite)" stroke="#e7b6d0" stroke-width="2"/><rect x="10" y="44" width="34" height="32" rx="3" fill="url(#gWhite)" stroke="#e7b6d0" stroke-width="2"/><rect x="56" y="44" width="34" height="32" rx="3" fill="url(#gWhite)" stroke="#e7b6d0" stroke-width="2"/><circle cx="27" cy="56" r="3" fill="url(#gGold)"/><circle cx="73" cy="56" r="3" fill="url(#gGold)"/><rect x="12" y="76" width="6" height="24" fill="#f2d7e4"/><rect x="82" y="76" width="6" height="24" fill="#f2d7e4"/><rect x="20" y="16" width="8" height="14" rx="2" fill="url(#gPinkB)"/><rect x="32" y="20" width="10" height="10" rx="5" fill="url(#gLav)"/><rect x="66" y="14" width="10" height="16" rx="3" fill="url(#gGlass)" stroke="#e2b04c"/>`,
  mirror:  `<ellipse cx="50" cy="50" rx="44" ry="48" fill="url(#gGoldH)"/><ellipse cx="50" cy="50" rx="36" ry="40" fill="url(#gMirror)"/><path d="M28 28L44 16M30 44L52 26" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".8"/><circle cx="50" cy="3" r="5" fill="#ff8fba"/>`,
  shelf:   `<rect x="4" y="0" width="92" height="100" rx="6" fill="url(#gWhite)" stroke="#e7b6d0" stroke-width="3"/>${[24,52,80].map(y=>`<rect x="8" y="${y}" width="84" height="4" fill="#f2c9de"/>`).join('')}
            <rect x="14" y="8" width="10" height="16" rx="3" fill="url(#gPinkB)"/><rect x="28" y="12" width="12" height="12" rx="6" fill="url(#gLav)"/><rect x="46" y="6" width="10" height="18" rx="3" fill="url(#gGoldH)"/><rect x="62" y="10" width="14" height="14" rx="4" fill="url(#gGlass)" stroke="#e2b04c"/>
            <rect x="14" y="36" width="14" height="16" rx="7" fill="url(#gLiqPink)"/><rect x="34" y="34" width="10" height="18" rx="3" fill="url(#gRed)"/><rect x="52" y="38" width="16" height="14" rx="3" fill="url(#gLav)"/><rect x="74" y="36" width="10" height="16" rx="3" fill="url(#gPinkB)"/>
            <rect x="16" y="62" width="20" height="18" rx="4" fill="url(#gPinkBox)"/><rect x="44" y="66" width="12" height="14" rx="6" fill="url(#gLiqGold)"/><rect x="64" y="60" width="16" height="20" rx="4" fill="url(#gWhite)" stroke="#e7b6d0"/>`,
  chair:   `<path d="M18 8Q50 -4 82 8L80 52H20Z" fill="url(#gPinkBox)" stroke="#d24b84" stroke-width="2"/><path d="M28 14Q50 6 72 14" stroke="#fff" stroke-width="3" fill="none" opacity=".6"/><rect x="10" y="48" width="80" height="18" rx="8" fill="url(#gPinkBox)" stroke="#d24b84" stroke-width="2"/><rect x="46" y="66" width="8" height="22" fill="url(#gGoldH)"/><ellipse cx="50" cy="92" rx="30" ry="6" fill="url(#gGoldH)"/>`,
  lamp:    `<path d="M18 4H82L94 40H6Z" fill="url(#gCurtain)" stroke="#e0558f" stroke-width="2"/><rect x="46" y="40" width="8" height="52" fill="url(#gGoldH)"/><ellipse cx="50" cy="94" rx="26" ry="6" fill="url(#gGoldH)"/><ellipse cx="50" cy="40" rx="30" ry="6" fill="#fff6c4" opacity=".7"/>`,
  flowers: `<path d="M30 60H70L64 100H36Z" fill="url(#gWhite)" stroke="#e7b6d0" stroke-width="2"/><path d="M50 60V30M40 60L30 34M60 60L70 34" stroke="#4fae3a" stroke-width="3"/>${[[50,24,'#ff5f9e'],[30,30,'#ff9cc4'],[70,30,'#ffb6d3'],[40,14,'#ff8fba'],[62,14,'#ff5f9e']].map(([x,y,c])=>`<circle cx="${x}" cy="${y}" r="11" fill="${c}"/><circle cx="${x}" cy="${y}" r="4" fill="#ffe08a"/>`).join('')}`,
};
function roomSvg(owned, decos){
  let out = `<rect x="0" y="0" width="360" height="190" fill="url(#gWall)"/>
    ${Array.from({length:18},(_,i)=>`<rect x="${i*20+8}" y="0" width="4" height="190" fill="#fff" opacity=".45"/>`).join('')}
    <rect x="0" y="182" width="360" height="10" fill="#fff" opacity=".8"/>
    <rect x="0" y="190" width="360" height="80" fill="url(#gFloor)"/>
    ${Array.from({length:6},(_,i)=>`<rect x="0" y="${200+i*13}" width="360" height="1.5" fill="#d9a68c" opacity=".45"/>`).join('')}
    <rect x="222" y="34" width="96" height="112" rx="48" fill="url(#gSky)" stroke="#fff" stroke-width="8"/>
    <path d="M270 38V146M226 92H314" stroke="#fff" stroke-width="5"/>
    <circle cx="296" cy="64" r="9" fill="#fff6c4"/><path d="M226 130Q250 110 270 126Q290 112 314 128V146H226Z" fill="#a8dc8a"/>`;
  decos.forEach(d=>{
    if (!owned[d.id]) return;
    const [x,y,w,h] = d.at;
    out += `<g transform="translate(${x} ${y}) scale(${w/100} ${h/100})">${DECO_ART[d.id]}</g>`;
  });
  return svg(out, '0 0 360 270');
}

const ITEMS = {lip:LIP, per:PER, cmp:CMP, nail:NAIL};
/* ---------------- Illustrated raster sprites (Item Art v1) ----------------
   24 cosmetics (lip/per/cmp/nail 1-6) and 6 producer gift boxes (gen_pink/gen_lav 1-3) are now supplied PNGs.
   Call contracts are unchanged: ART.item(c,l) and ART.gen(type,l) still return HTML markup (an <img>) that the game
   puts in innerHTML. Identities map 1:1: item = c_l, producer = gen_<type>_<l>. Local files, 256/512/768 px via srcset.
   The single-file build defines window.ITEM_INLINE (data URIs of the @2x files) instead of referencing relative paths. */
const SPRITE_DIR = 'assets/sprites-v1/';
const SPRITE_IDS = [];
['lip','per','cmp','nail'].forEach(c => { for (let l = 1; l <= 6; l++) SPRITE_IDS.push(c + '_' + l); });
['pink','lav'].forEach(t => { for (let l = 1; l <= 3; l++) SPRITE_IDS.push('gen_' + t + '_' + l); });
/* Skincare Art v1 (installed, NOT activated: no family "skn" exists in the game rules yet). Explicit stable mapping, kept out of SPRITE_IDS (no preload). */
const SKINCARE_DIR = 'assets/skincare-v1/';
const SKINCARE_IDS = [1,2,3,4,5,6].map(l => 'skn_' + l).concat([1,2,3].map(l => 'gen_skn_' + l));
/* Makeup Atelier Art v1 (assets/atelier-v1/): brush/bag items (brs_1..6, bag_1..6), the Atelier Chest producer (gen_atl_1..3) and the station illustration.
   Kept out of SPRITE_IDS: loaded only when the Atelier is unlocked (or its locked preview is opened). */
const ATELIER_DIR = 'assets/atelier-v1/';
const ATELIER_IDS = [1,2,3,4,5,6].map(l => 'brs_' + l).concat([1,2,3,4,5,6].map(l => 'bag_' + l), [1,2,3].map(l => 'gen_atl_' + l));
/* Measured station layout (assets/atelier-v1/station/atelier-station-layout.json, coordinate space 340x220); verify/atelier-ui.js checks equality with that file. */
const ATELIER_STATION = {space: [340, 220], slots: [[50.887, 39.865, 66.174, 66.127], [136.512, 39.865, 66.174, 66.127], [223.14, 39.865, 66.174, 66.127]], plate: [148.343, 125.83, 43.314, 43.283]};
function spriteDir(id){
  if (/^gen_atl_[1-3]$/.test(id)) return ATELIER_DIR + 'generators/';
  if (/^(brs|bag)_[1-6]$/.test(id)) return ATELIER_DIR + 'items/';
  if (/^gen_skn_[1-3]$/.test(id)) return SKINCARE_DIR + 'generators/';
  if (/^skn_[1-6]$/.test(id)) return SKINCARE_DIR + 'items/';
  return SPRITE_DIR + (id.indexOf('gen_') === 0 ? 'generators/' : 'items/');
}
function spriteAttrs(id){
  const inl = window.ITEM_INLINE;
  if (inl && inl[id]) return {src: inl[id], srcset: ''};
  const f = spriteDir(id) + id;
  return {src: f + '.png', srcset: `${f}.png 1x, ${f}@2x.png 2x, ${f}@3x.png 3x`};
}
function atelierStationAttrs(){
  const inl = window.ITEM_INLINE;
  if (inl && inl['atelier-station']) return {src: inl['atelier-station'], srcset: ''};
  const f = ATELIER_DIR + 'station/atelier-station';
  return {src: f + '.png', srcset: `${f}.png 1x, ${f}@2x.png 2x, ${f}@3x.png 3x`};
}
function sprite(id){
  const a = spriteAttrs(id);
  // fixed width/height reserve the box (no layout shift); CSS sizes it with object-fit: contain
  return `<img class="sprite" data-art="${id}" src="${a.src}"${a.srcset ? ` srcset="${a.srcset}"` : ''} width="256" height="256" alt="" draggable="false" decoding="sync">`;
}

/* ---------------- Salon art (Salon Motion v1) ----------------
   An EMPTY painted room plus eight separate transparent props. A prop is only drawn when S.owned[id] is set.
   Positions are PRESENTATION coordinates in the 360x270 room frame (assets/salon-v1/layout.json): [x, y, w, h, z].
   They are not saved slots. Props keep their natural aspect ratio (object-fit: contain), never stretched.
   The single-file build defines window.SALON_INLINE (data URIs: base + the @2x prop files). The old vector room is kept as roomSvg. */
const SALON_DIR = 'assets/salon-v1/';
/* Studio slots remeasured to each prop's natural aspect ratio and to painted contact points
   (window rod/sill, vanity under the mirror, vase foot on the tabletop, floor feet). Boxes fill
   the sprite exactly, so object-fit:contain no longer letterboxes and “drops” props in mid-air. */
const SALON_LAYOUT = {rug:[79.56,189.94,200.88,75.08,0], curtain:[225.06,0,116.31,163,1], shelf:[3.98,32.07,74.09,184.97,2], mirror:[84.03,14.92,107.9,128.04,3],
  table:[82,121.25,150,96.75,4], lamp:[315,66.63,42.02,131.77,5], chair:[100,134.01,100.44,115.11,6], flowers:[188.28,88.03,40.03,45.25,7]};
/* Reception (Reception Art v1): own empty-room image + nine props. Measured layout from assets/reception/layout.json (natural aspect ratios; verify/salon-areas.js
   checks these numbers equal that file). The single-file build embeds the base + @2x props in window.SALON_INLINE under the same ids. */
const RECEPTION_DIR = 'assets/reception/';
const RECEPTION_LAYOUT = {rcprunner:[105.511,201,206.979,57,0], rcpdesk:[112,132.598,125,87.402,3], rcpsign:[211.801,182,26.398,62,4], rcpsofa:[239,162.197,105,72.803,3],
  rcpplant:[329,146.584,29,96.416,4], rcptea:[258.1,225,60.8,38,5], rcpwall:[110,38.262,138,75.738,1], rcplights:[123.219,0,89.563,60,6], rcpcase:[65,92.74,43,127.26,3]};
/* Spa Art v1 (assets/spa/): installed and verified but NOT ACTIVE — no gameplay, unlock, purchase UI or preload uses it yet (docs/salon/SPA_PLAN.md).
   Measured layout = docs/art/spa-v1/layout.json (verify/spa-art.js checks equality). Colour slots have <id>_rose|sage|lilac files; all other props are single files. */
const SPA_DIR = 'assets/spa/';
const SPA_LAYOUT = {sparug:[69,184,226,82.102,0], spadrape:[222,9,136,156.126,1], spashelf:[81,41,55,80.152,1], spabasin:[154,81,62,64.872,2], spatowels:[318,84,36,98.743,2],
  spascreen:[5,114,58,87.685,3], spabed:[104,135,139,87.056,3], spachair:[267,150,76,72.833,3], spafountain:[205,213,38,52.87,4], spalamp:[248,120,24,68.52,4], spaplant:[66,153,31,80.432,4],
  spaorchid:[18,207,35,46.265,4], spasteam:[106.375,202.354,36.25,53.231,5], spatrolley:[157,210,40,49.31,5], spapouf:[246,237,43,26.819,5], spacandles:[296,234,44,29.734,5]};
const SPA_VARIANT_SLOTS = ['spabed', 'spascreen', 'spachair', 'spadrape'], SPA_COLOURS = ['rose', 'sage', 'lilac'];
const SPA_DEFAULT_COLOUR = 'rose';
function spaSrc(id, colour){          // pure URL helper (no preload, no DOM); returns null for ids/colours that do not exist. The single-file build maps the same keys to data URIs.
  let key;
  if (id === 'base') key = 'spa-base';
  else if (!SPA_LAYOUT[id]) return null;
  else if (SPA_VARIANT_SLOTS.indexOf(id) >= 0){ if (SPA_COLOURS.indexOf(colour) < 0) return null; key = id + '_' + colour; }
  else key = id;
  const inl = window.SALON_INLINE; if (inl && inl[key]) return {src: inl[key], srcset: ''};
  if (key === 'spa-base') return {src: SPA_DIR + 'salon-spa-base.png', srcset: ''};
  return {src: `${SPA_DIR}${key}.png`, srcset: `${SPA_DIR}${key}.png 1x, ${SPA_DIR}${key}@2x.png 2x, ${SPA_DIR}${key}@3x.png 3x`};
}
/* Makeup Studio Art v1 (assets/makeup/): ACTIVE as the Makeup Studio room (registry salon-data.js); the files are requested only when that room, its selector card or a prop card is shown, never at startup.
   Measured layout = docs/art/makeup-v1/layout.json (measured against the generated base, NOT the planning-camera rectangles). Single files only (no colour variants). Static artwork, no lighting/animation. */
const MAKEUP_DIR = 'assets/makeup/';
const MAKEUP_LAYOUT = {mkrug:[44.96332,184.18984,256.15071,84.04945,0], mkmirror:[126.97695,45.67861,98.33892,82.20519,1], mkshelf:[58.56806,43.40232,46.95227,33.93035,1],
  mkgallery:[4.79535,60.98319,39.63582,49.98409,1], mksheers:[216.39648,19.24179,99.25124,154.92876,1], mkvanity:[119.03541,120.02989,118.94575,75.73499,2],
  mkcabinet:[46.25131,81.55518,54.92831,105.72668,2], mkplinth:[259.29107,118.0756,31.36261,75.03577,2], mkring:[96.18622,79.28014,31.63308,128.54079,4], mkchair:[149.83618,141.13452,55.8525,77.70782,5]};
function makeupSrc(id){               // pure URL helper (no preload, no DOM); null for unknown ids
  let key;
  if (id === 'base') key = 'makeup-base'; else if (MAKEUP_LAYOUT[id]) key = id; else return null;
  const inl = window.SALON_INLINE; if (inl && inl[key]) return {src: inl[key], srcset: ''};
  if (key === 'makeup-base') return {src: MAKEUP_DIR + 'salon-makeup-base.png', srcset: ''};
  return {src: `${MAKEUP_DIR}${key}.png`, srcset: `${MAKEUP_DIR}${key}.png 1x, ${MAKEUP_DIR}${key}@2x.png 2x, ${MAKEUP_DIR}${key}@3x.png 3x`};
}
const isReception = id => id === 'reception-base' || RECEPTION_LAYOUT[id] !== undefined;
function salonSrc(id, colour){
  if (id === 'spa-base') return spaSrc('base');
  if (id === 'makeup-base') return makeupSrc('base');
  if (MAKEUP_LAYOUT[id]) return makeupSrc(id);
  if (SPA_LAYOUT[id]) return spaSrc(id, colour || SPA_DEFAULT_COLOUR);
  const inl = window.SALON_INLINE;
  if (inl && inl[id]) return {src: inl[id], srcset: ''};
  if (id === 'base') return {src: SALON_DIR + 'salon-base.png', srcset: ''};
  if (id === 'reception-base') return {src: RECEPTION_DIR + 'salon-reception-base.png', srcset: ''};
  if (isReception(id)) return {src: RECEPTION_DIR + id + '.png', srcset: `${RECEPTION_DIR}${id}.png 1x, ${RECEPTION_DIR}${id}@2x.png 2x, ${RECEPTION_DIR}${id}@3x.png 3x`};
  return {src: SALON_DIR + id + '.png', srcset: `${SALON_DIR}${id}.png 1x, ${SALON_DIR}${id}@2x.png 2x, ${SALON_DIR}${id}@3x.png 3x`};
}
function salonImg(id, cls, style, colour){
  const a = salonSrc(id, colour);
  return `<img class="${cls}" data-art="${id}" src="${a.src}"${a.srcset ? ` srcset="${a.srcset}"` : ''} alt="" draggable="false" decoding="sync"${style ? ` style="${style}"` : ''}>`;
}
// owned: S.owned map; decos: ordered list of {id}; arrive: id of the prop that was JUST bought (one-shot class), or null
function room(owned, decos, arrive, area, colours){
  colours = colours || {};
  if (area === 'spa') return spaRoom(owned, decos, arrive, colours);
  if (area === 'makeup') return makeupRoom(owned, decos, arrive);
  const rcp = area === 'reception', lay = rcp ? RECEPTION_LAYOUT : SALON_LAYOUT;
  let out = `<div class="roomScene" data-area="${rcp ? 'reception' : 'studio'}">${salonImg(rcp ? 'reception-base' : 'base', 'roomBase')}`;
  decos.forEach(d => {
    if (!owned[d.id] || !lay[d.id]) return;
    const [x, y, w, h, z] = lay[d.id];
    out += salonImg(d.id, 'prop prop-' + d.id + (arrive === d.id ? ' arrive' : ''),
      `left:${(x/360*100).toFixed(3)}%;top:${(y/270*100).toFixed(3)}%;width:${(w/360*100).toFixed(3)}%;height:${(h/270*100).toFixed(3)}%;z-index:${z + 1}`);
  });
  return out + '</div>';
}
// Spa room: empty room + owned props, each colour slot drawn in its equipped colour (colours = {slot: colour}); natural aspect ratio, contain-fit rectangles from the measured layout
function spaRoom(owned, decos, arrive, colours){
  let out = `<div class="roomScene" data-area="spa">${salonImg('spa-base', 'roomBase')}`;
  decos.forEach(d => {
    if (!owned[d.id] || !SPA_LAYOUT[d.id]) return;
    const [x, y, w, h, z] = SPA_LAYOUT[d.id];
    out += salonImg(d.id, 'prop prop-' + d.id + (arrive === d.id ? ' arrive' : ''),
      `left:${(x/360*100).toFixed(3)}%;top:${(y/270*100).toFixed(3)}%;width:${(w/360*100).toFixed(3)}%;height:${(h/270*100).toFixed(3)}%;z-index:${z + 1}`, colours[d.id]);
  });
  return out + '</div>';
}
// Makeup room (validation path; area not registered): same structure as the Studio/Spa rooms, natural-aspect contain-fit rectangles from the measured layout
function makeupRoom(owned, decos, arrive){
  let out = `<div class="roomScene" data-area="makeup">${salonImg('makeup-base', 'roomBase')}`;
  decos.forEach(d => {
    if (!owned[d.id] || !MAKEUP_LAYOUT[d.id]) return;
    const [x, y, w, h, z] = MAKEUP_LAYOUT[d.id];
    out += salonImg(d.id, 'prop prop-' + d.id + (arrive === d.id ? ' arrive' : ''),
      `left:${(x/360*100).toFixed(3)}%;top:${(y/270*100).toFixed(3)}%;width:${(w/360*100).toFixed(3)}%;height:${(h/270*100).toFixed(3)}%;z-index:${z + 1}`);
  });
  return out + '</div>';
}
// every image the Spa view needs for the given equipped colours (used only when the Spa view is about to be shown)
const spaAssetList = colours => [spaSrc('base')].concat(Object.keys(SPA_LAYOUT).map(id => spaSrc(id, (colours && colours[id]) || SPA_DEFAULT_COLOUR)));
// the preload list of one room (empty room + every prop), used only when that room is about to be seen
const roomAssetIds = area => area === 'reception' ? ['reception-base'].concat(Object.keys(RECEPTION_LAYOUT)) : area === 'makeup' ? ['makeup-base'].concat(Object.keys(MAKEUP_LAYOUT)) : [];

window.ART = {
  DEFS,
  item: (c,l) => sprite(c + '_' + l),
  gen: (type,l) => sprite('gen_' + type + '_' + l),
  // the previous code-drawn vector versions are kept ONLY for reference/rollback; the game no longer calls them
  itemSvg: (c,l) => svg(ITEMS[c][l-1]()),
  genSvg: (type,l) => svg(giftBox(l, type==='pink'?'gPinkBox':'gLav', type==='pink'?'gGoldH':'gPinkB')),
  sprite, spriteAttrs, SPRITE_IDS, SKINCARE_IDS, ATELIER_IDS, ATELIER_STATION, atelierStationAttrs,
  icon: n => ICON[n],
  deco: (id, colour) => salonImg(id, 'sprite decoArt', '', colour),
  decoSvg: id => svg(DECO_ART[id]),
  room, roomSvg, SALON_LAYOUT, RECEPTION_LAYOUT, roomAssetIds, salonSrc, salonImg, spaAssetList, SPA_LAYOUT, SPA_VARIANT_SLOTS, SPA_COLOURS, spaSrc, MAKEUP_LAYOUT, makeupSrc,
};
})();
