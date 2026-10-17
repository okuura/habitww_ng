import type { Rarity } from './habitStats';

// 習慣カード裏面の素材(レアリティごと)。表面は習慣に集中できるよう素のままにして、
// 続けた証は裏面の金属の質感で見せる

export interface CardFinish {
  /** 金属の板か(ノーマルは紙のまま) */
  metal: boolean;
  /** 面の背景(複数レイヤー) */
  background: string;
  /** background の各レイヤーの重ね方 */
  blend: string;
  /** background のレイヤー数(ホロの虹だけを流すアニメーション用) */
  layers: number;
  /** 刻印の文字色(小さな文字も滲まないよう、ほぼ不透明にする) */
  ink: string;
  /** 刻印の補助文字色 */
  inkSub: string;
  /** 刻印らしく見せる影(下の縁に薄い光だけ。上にも影を入れると文字が二重になって滲む) */
  engrave: string;
  /** 一段彫り込んだ面(進み具合のバー) */
  panelBg: string;
  panelShadow: string;
  /** 彫り込んだ線(枠・区切り)の色 */
  line: string;
  /** 彫り込んだ線の下側に入る光 */
  lineLight: string;
  /** 動く光沢 */
  sheen: string;
}

// w×h の大きさで描いて、表示は 1/3 に縮める(Retina でも筋が 1 画素の細さになる)
const svg = (body: string, w: number, h: number) =>
  `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${w * 3}' height='${h * 3}'>${body}</svg>`)}")`;

// 横方向のヘアライン(ブラッシュ仕上げ)。横に長く縦に細かいノイズを灰色の濃淡にして、
// overlay で重ねる(50% より明るい筋は光り、暗い筋は沈む)
const BRUSHED = svg(
  `<filter id='b'><feTurbulence type='fractalNoise' baseFrequency='0.0008 0.9' numOctaves='2' seed='4' stitchTiles='stitch'/>`
  + `<feColorMatrix values='1.6 0 0 0 -0.3  1.6 0 0 0 -0.3  1.6 0 0 0 -0.3  0 0 0 0 0.32'/></filter>`
  + `<rect width='100%' height='100%' filter='url(#b)'/>`,
  600, 300,
);
// 長い筋(ところどころ強く光る、引きずったような線)
const STREAKS = svg(
  `<filter id='s'><feTurbulence type='fractalNoise' baseFrequency='0.0003 0.12' numOctaves='2' seed='11' stitchTiles='stitch'/>`
  + `<feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  1 0 0 0 0'/>`
  + `<feComponentTransfer><feFuncA type='table' tableValues='0 0 0 0 0.22 0'/></feComponentTransfer></filter>`
  + `<rect width='100%' height='100%' filter='url(#s)'/>`,
  900, 300,
);
// くっきりした細いヘアライン(プラチナ用。BRUSHED より筋が細く、コントラストが強い)
const HAIRLINE = svg(
  `<filter id='h'><feTurbulence type='fractalNoise' baseFrequency='0.0004 1.6' numOctaves='3' seed='21' stitchTiles='stitch'/>`
  + `<feColorMatrix values='2.2 0 0 0 -0.6  2.2 0 0 0 -0.6  2.2 0 0 0 -0.6  0 0 0 0 0.5'/></filter>`
  + `<rect width='100%' height='100%' filter='url(#h)'/>`,
  900, 300,
);
// ごく細かい粒(金属の地のざらつき)
const GRAIN = svg(
  `<filter id='g'><feTurbulence type='fractalNoise' baseFrequency='0.6' numOctaves='1' seed='7' stitchTiles='stitch'/>`
  + `<feColorMatrix values='1.6 0 0 0 -0.3  1.6 0 0 0 -0.3  1.6 0 0 0 -0.3  0 0 0 0 0.25'/></filter>`
  + `<rect width='100%' height='100%' filter='url(#g)'/>`,
  200, 200,
);

// 照明: 斜めに入る明るい帯と、端の陰り(板が平らでなく、光を受けているように見せる)
const LIGHT = 'linear-gradient(103deg, rgba(0,0,0,0.3) 0%, rgba(255,255,255,0) 15%, rgba(255,255,255,0.7) 33%, rgba(255,255,255,0.15) 45%, rgba(0,0,0,0.14) 60%, rgba(255,255,255,0.4) 80%, rgba(0,0,0,0.28) 100%)';
const VIGNETTE = 'radial-gradient(130% 120% at 40% 45%, transparent 55%, rgba(0,0,0,0.16) 100%)';

const RAINBOW = 'linear-gradient(115deg, rgba(255,95,109,0.9), rgba(255,195,113,0.85), rgba(249,248,113,0.8), rgba(124,242,156,0.85), rgba(90,209,255,0.9), rgba(161,140,255,0.9), rgba(255,122,217,0.9), rgba(255,95,109,0.9))';

function metal(base: string, { rainbow = false, hairline = false } = {}) {
  const layers: [string, string][] = [
    ...(rainbow ? [[`${RAINBOW} 0 0 / 300% 100%`, 'overlay'] as [string, string]] : []),
    ...(hairline ? [[`${HAIRLINE} 0 0 / 900px 300px`, 'overlay'] as [string, string]] : []),
    [`${GRAIN} 0 0 / 200px 200px`, 'overlay'],
    [`${STREAKS} 0 0 / 900px 300px`, 'overlay'],
    [`${BRUSHED} 0 0 / 600px 300px`, 'overlay'],
    [VIGNETTE, 'multiply'],
    [LIGHT, 'soft-light'],
    [base, 'normal'],
  ];
  return {
    background: layers.map(l => l[0]).join(', '),
    blend: layers.map(l => l[1]).join(', '),
    layers: layers.length,
  };
}

export const FINISH: Record<Rarity, CardFinish | null> = {
  normal: null,
  // 磨いた青銅: 深い茶に赤みのある銅の艶。端は暗く沈み、中央に温かい光が乗る。刻印は明るい色
  bronze: {
    metal: true,
    ...metal('linear-gradient(172deg, #4a2a12 0%, #7c4a24 14%, #b97a45 32%, #8e5a2e 50%, #ad6f3d 68%, #6e3f1d 84%, #40230f 100%)'),
    ink: 'rgba(255,236,212,0.94)',
    inkSub: 'rgba(255,236,212,0.74)',
    engrave: '0 1px 1px rgba(0,0,0,0.55)',
    panelBg: 'rgba(0,0,0,0.2)',
    panelShadow: 'inset 0 1px 1px rgba(0,0,0,0.55), 0 1px 0 rgba(255,220,180,0.2)',
    line: 'rgba(0,0,0,0.4)',
    lineLight: 'rgba(255,220,180,0.25)',
    sheen: 'linear-gradient(115deg, transparent 36%, rgba(255,222,190,0.38) 47%, rgba(255,255,255,0.1) 53%, transparent 64%)',
  },
  silver: {
    metal: true,
    ...metal('linear-gradient(172deg, #9aa3ae 0%, #d9dde3 16%, #f4f6f8 34%, #c3c9d1 52%, #e9ecf0 70%, #a4adb8 100%)'),
    ink: 'rgba(40,48,60,0.88)',
    inkSub: 'rgba(40,48,60,0.7)',
    engrave: '0 1px 0 rgba(255,255,255,0.55)',
    panelBg: 'rgba(60,70,85,0.1)',
    panelShadow: 'inset 0 1px 1px rgba(20,26,36,0.4), 0 1px 0 rgba(255,255,255,0.75)',
    line: 'rgba(40,48,60,0.42)',
    lineLight: 'rgba(255,255,255,0.75)',
    sheen: 'linear-gradient(115deg, transparent 36%, rgba(255,255,255,0.45) 47%, rgba(255,255,255,0.12) 53%, transparent 64%)',
  },
  // 上品な金: 彩度を抑えたシャンパンゴールド。縁は深いオリーブ寄りの金、中央は淡く光る
  gold: {
    metal: true,
    ...metal('linear-gradient(172deg, #503a16 0%, #8e6f2e 14%, #d9bf76 32%, #a3823c 50%, #c9a95c 68%, #836226 84%, #473113 100%)'),
    ink: 'rgba(52,40,10,0.92)',
    inkSub: 'rgba(52,40,10,0.74)',
    engrave: '0 1px 0 rgba(255,244,210,0.5)',
    panelBg: 'rgba(70,56,14,0.16)',
    panelShadow: 'inset 0 1px 1px rgba(50,40,8,0.5), 0 1px 0 rgba(255,244,210,0.6)',
    line: 'rgba(52,40,10,0.45)',
    lineLight: 'rgba(255,246,215,0.65)',
    sheen: 'linear-gradient(115deg, transparent 36%, rgba(255,248,220,0.5) 47%, rgba(255,255,255,0.14) 53%, transparent 64%)',
  },
  // プラチナ: 白に近い無彩色の板に、細いヘアラインがくっきり入る
  platinum: {
    metal: true,
    ...metal('linear-gradient(172deg, #c4c5c3 0%, #e9eae8 16%, #ffffff 34%, #d8d9d7 52%, #f6f6f5 70%, #e2e3e1 86%, #b9bab8 100%)', { hairline: true }),
    ink: 'rgba(44,46,52,0.9)',
    inkSub: 'rgba(44,46,52,0.7)',
    engrave: '0 1px 0 rgba(255,255,255,0.7)',
    panelBg: 'rgba(40,42,50,0.1)',
    panelShadow: 'inset 0 1px 1px rgba(20,22,28,0.4), 0 1px 0 rgba(255,255,255,0.85)',
    line: 'rgba(44,46,52,0.4)',
    lineLight: 'rgba(255,255,255,0.85)',
    sheen: 'linear-gradient(115deg, transparent 34%, rgba(255,255,255,0.55) 46%, rgba(220,225,235,0.25) 52%, transparent 64%)',
  },
  holo: {
    metal: true,
    ...metal('linear-gradient(172deg, #a7aebb 0%, #e3e6ec 18%, #fafbfc 36%, #cfd4dc 54%, #eef0f4 72%, #aeb5c1 100%)', { rainbow: true }),
    ink: 'rgba(40,32,90,0.88)',
    inkSub: 'rgba(40,32,90,0.7)',
    engrave: '0 1px 0 rgba(255,255,255,0.55)',
    panelBg: 'rgba(70,60,130,0.1)',
    panelShadow: 'inset 0 1px 1px rgba(30,22,70,0.4), 0 1px 0 rgba(255,255,255,0.75)',
    line: 'rgba(40,32,90,0.42)',
    lineLight: 'rgba(255,255,255,0.75)',
    sheen: 'linear-gradient(115deg, transparent 22%, rgba(255,95,109,0.3) 32%, rgba(249,248,113,0.3) 40%, rgba(255,255,255,0.5) 47%, rgba(90,209,255,0.32) 55%, rgba(161,140,255,0.32) 63%, transparent 76%)',
  },
};
