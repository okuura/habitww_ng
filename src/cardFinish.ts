import type { Rarity } from './habitStats';

// 習慣カード裏面の素材(レアリティごと)。表面は習慣に集中できるよう素のままにして、
// 続けた証は裏面の金属の質感で見せる

export interface CardFinish {
  /** 金属の板か(ノーマルは紙のまま) */
  metal: boolean;
  /** 面の背景(複数レイヤー) */
  background: string;
  /** 刻印の文字色 */
  ink: string;
  /** 刻印の補助文字色 */
  inkSub: string;
  /** 刻印らしく見せる影(上に暗い線、下に光) */
  engrave: string;
  /** 一段彫り込んだ面(数字タイル・入力欄) */
  panelBg: string;
  panelShadow: string;
  /** 内側の彫り線の色 */
  line: string;
  /** 動く光沢 */
  sheen: string;
}

// 横方向のヘアライン(ブラッシュ仕上げ)。横に長く縦に細かいノイズ
const BRUSHED = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='300'%3E%3Cfilter id='b'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.002 1.4' numOctaves='2' seed='4' stitchTiles='stitch'/%3E%3CfeColorMatrix values='1 0 0 0 0  1 0 0 0 0  1 0 0 0 0  0 0 0 0 0.3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23b)'/%3E%3C/svg%3E")`;

const RAINBOW = 'linear-gradient(115deg, rgba(255,95,109,0.7), rgba(255,195,113,0.6), rgba(249,248,113,0.6), rgba(124,242,156,0.6), rgba(90,209,255,0.65), rgba(161,140,255,0.7), rgba(255,122,217,0.65), rgba(255,95,109,0.7))';

const metal = (base: string, extra: string[] = []) =>
  [...extra, `${BRUSHED} 0 0 / 600px 300px`, base].join(', ');

export const FINISH: Record<Rarity, CardFinish | null> = {
  normal: null,
  bronze: {
    metal: true,
    background: metal('linear-gradient(172deg, #7a4a22 0%, #b07440 14%, #dca06a 32%, #b5773f 50%, #d39560 68%, #a0652f 84%, #6f421d 100%)'),
    ink: '#3f230b',
    inkSub: 'rgba(63,35,11,0.75)',
    engrave: '0 1px 0 rgba(255,222,190,0.6), 0 -1px 0 rgba(50,25,5,0.3)',
    panelBg: 'rgba(80,40,10,0.08)',
    panelShadow: 'inset 1px 1px 1px rgba(60,30,5,0.4), inset -1px -1px 0 rgba(255,220,185,0.55)',
    line: 'rgba(70,38,10,0.5)',
    sheen: 'linear-gradient(115deg, transparent 36%, rgba(255,228,200,0.45) 47%, rgba(255,255,255,0.12) 53%, transparent 64%)',
  },
  silver: {
    metal: true,
    background: metal('linear-gradient(172deg, #9aa3ae 0%, #d9dde3 16%, #f4f6f8 34%, #c3c9d1 52%, #e9ecf0 70%, #a4adb8 100%)'),
    ink: '#3c4450',
    inkSub: 'rgba(60,68,80,0.72)',
    engrave: '0 1px 0 rgba(255,255,255,0.8), 0 -1px 0 rgba(30,36,44,0.18)',
    panelBg: 'rgba(60,70,85,0.06)',
    panelShadow: 'inset 1px 1px 1px rgba(30,36,44,0.3), inset -1px -1px 0 rgba(255,255,255,0.75)',
    line: 'rgba(60,68,80,0.42)',
    sheen: 'linear-gradient(115deg, transparent 36%, rgba(255,255,255,0.45) 47%, rgba(255,255,255,0.12) 53%, transparent 64%)',
  },
  gold: {
    metal: true,
    background: metal('linear-gradient(172deg, #b3841c 0%, #d3aa3a 14%, #ead068 32%, #d2ad40 50%, #e5c75c 68%, #c69a2e 84%, #a47718 100%)'),
    ink: '#5e430a',
    inkSub: 'rgba(94,67,10,0.75)',
    engrave: '0 1px 0 rgba(255,246,205,0.75), 0 -1px 0 rgba(80,55,0,0.25)',
    panelBg: 'rgba(110,78,8,0.07)',
    panelShadow: 'inset 1px 1px 1px rgba(90,62,0,0.38), inset -1px -1px 0 rgba(255,244,196,0.7)',
    line: 'rgba(100,70,8,0.5)',
    sheen: 'linear-gradient(115deg, transparent 36%, rgba(255,248,215,0.5) 47%, rgba(255,255,255,0.15) 53%, transparent 64%)',
  },
  holo: {
    metal: true,
    background: metal('linear-gradient(172deg, #a7aebb 0%, #e3e6ec 18%, #fafbfc 36%, #cfd4dc 54%, #eef0f4 72%, #aeb5c1 100%)', [RAINBOW]),
    ink: '#3a3466',
    inkSub: 'rgba(58,52,102,0.75)',
    engrave: '0 1px 0 rgba(255,255,255,0.8), 0 -1px 0 rgba(40,30,80,0.18)',
    panelBg: 'rgba(70,60,130,0.06)',
    panelShadow: 'inset 1px 1px 1px rgba(40,30,80,0.3), inset -1px -1px 0 rgba(255,255,255,0.75)',
    line: 'rgba(58,52,102,0.42)',
    sheen: 'linear-gradient(115deg, transparent 22%, rgba(255,95,109,0.3) 32%, rgba(249,248,113,0.3) 40%, rgba(255,255,255,0.5) 47%, rgba(90,209,255,0.32) 55%, rgba(161,140,255,0.32) 63%, transparent 76%)',
  },
};
