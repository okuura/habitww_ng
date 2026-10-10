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
  /** 刻印の文字色。半透明にして、文字の中にも地のヘアラインが透けるようにする */
  ink: string;
  /** 刻印の補助文字色 */
  inkSub: string;
  /** 刻印らしく見せる影(上の縁に影、下の縁に光 = 金属に彫り込んだ形) */
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

function metal(base: string, rainbow = false) {
  const layers: [string, string][] = [
    ...(rainbow ? [[`${RAINBOW} 0 0 / 300% 100%`, 'overlay'] as [string, string]] : []),
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
  bronze: {
    metal: true,
    ...metal('linear-gradient(172deg, #7a4a22 0%, #b07440 14%, #dca06a 32%, #b5773f 50%, #d39560 68%, #a0652f 84%, #6f421d 100%)'),
    ink: 'rgba(62,30,6,0.62)',
    inkSub: 'rgba(62,30,6,0.5)',
    engrave: '0 -1px 0 rgba(45,20,0,0.45), 0 1px 0 rgba(255,214,175,0.7)',
    panelBg: 'rgba(80,40,10,0.12)',
    panelShadow: 'inset 0 1px 1px rgba(50,22,0,0.5), 0 1px 0 rgba(255,214,175,0.55)',
    line: 'rgba(60,28,4,0.5)',
    lineLight: 'rgba(255,214,175,0.6)',
    sheen: 'linear-gradient(115deg, transparent 36%, rgba(255,228,200,0.45) 47%, rgba(255,255,255,0.12) 53%, transparent 64%)',
  },
  silver: {
    metal: true,
    ...metal('linear-gradient(172deg, #9aa3ae 0%, #d9dde3 16%, #f4f6f8 34%, #c3c9d1 52%, #e9ecf0 70%, #a4adb8 100%)'),
    ink: 'rgba(40,48,60,0.55)',
    inkSub: 'rgba(40,48,60,0.45)',
    engrave: '0 -1px 0 rgba(20,26,36,0.35), 0 1px 0 rgba(255,255,255,0.85)',
    panelBg: 'rgba(60,70,85,0.1)',
    panelShadow: 'inset 0 1px 1px rgba(20,26,36,0.4), 0 1px 0 rgba(255,255,255,0.75)',
    line: 'rgba(40,48,60,0.42)',
    lineLight: 'rgba(255,255,255,0.75)',
    sheen: 'linear-gradient(115deg, transparent 36%, rgba(255,255,255,0.45) 47%, rgba(255,255,255,0.12) 53%, transparent 64%)',
  },
  gold: {
    metal: true,
    ...metal('linear-gradient(172deg, #a87508 0%, #d8a823 14%, #f4d659 32%, #d9ad26 50%, #efcc48 68%, #c8961b 84%, #9a6a05 100%)'),
    ink: 'rgba(92,58,0,0.55)',
    inkSub: 'rgba(92,58,0,0.45)',
    engrave: '0 -1px 0 rgba(70,40,0,0.55), 0 1px 0 rgba(255,244,190,0.9)',
    panelBg: 'rgba(110,78,8,0.12)',
    panelShadow: 'inset 0 1px 1px rgba(80,52,0,0.5), 0 1px 0 rgba(255,244,196,0.7)',
    line: 'rgba(84,56,0,0.5)',
    lineLight: 'rgba(255,246,200,0.75)',
    sheen: 'linear-gradient(115deg, transparent 36%, rgba(255,248,215,0.5) 47%, rgba(255,255,255,0.15) 53%, transparent 64%)',
  },
  holo: {
    metal: true,
    ...metal('linear-gradient(172deg, #a7aebb 0%, #e3e6ec 18%, #fafbfc 36%, #cfd4dc 54%, #eef0f4 72%, #aeb5c1 100%)', true),
    ink: 'rgba(40,32,90,0.55)',
    inkSub: 'rgba(40,32,90,0.45)',
    engrave: '0 -1px 0 rgba(30,22,70,0.35), 0 1px 0 rgba(255,255,255,0.85)',
    panelBg: 'rgba(70,60,130,0.1)',
    panelShadow: 'inset 0 1px 1px rgba(30,22,70,0.4), 0 1px 0 rgba(255,255,255,0.75)',
    line: 'rgba(40,32,90,0.42)',
    lineLight: 'rgba(255,255,255,0.75)',
    sheen: 'linear-gradient(115deg, transparent 22%, rgba(255,95,109,0.3) 32%, rgba(249,248,113,0.3) 40%, rgba(255,255,255,0.5) 47%, rgba(90,209,255,0.32) 55%, rgba(161,140,255,0.32) 63%, transparent 76%)',
  },
};
