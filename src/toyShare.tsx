/* eslint-disable react-refresh/only-export-components -- ここの部品は画像(SVG 文字列)を作るためだけのもので、画面には出さない */
import { renderToStaticMarkup } from 'react-dom/server';
import { darken, lighten } from '@mui/material/styles';
import type { Habit } from './supabase';
import type { EvaluatedAchievement } from './achievements';
import { GEOMETRY, ICONS, METAL, SHAPE } from './achievementIcons';
import { Medal, Trophy } from './Badges';
import { FINISH } from './cardFinish';
import type { Rarity } from './habitStats';

// おもちゃ箱のシェア画像。箱の中の山をそのまま 1 枚の SVG に描き、canvas で PNG にする。
// 画面のバッジは HTML と SVG の混在なので、ここでは全部を SVG だけで描き直す
// (外部フォント・外部画像・foreignObject を使わない = Safari でも canvas に描ける)

export interface ToyMedal { habit: Habit; year: number; month: number }

export type ToyItem = { id: string; r: number } & (
  | { kind: 'badge'; badge: EvaluatedAchievement }
  | { kind: 'medal'; medal: ToyMedal }
);

export interface ToyCardInput {
  boxWidth: number;
  boxHeight: number;
  bodies: { item: ToyItem; x: number; y: number; angle: number }[];
  stats: { badges: number; totalBadges: number; medals: number };
  tower?: { score: number; best: number } | null;
  /** タワーの足場(箱の座標) */
  platform?: { x0: number; x1: number; y: number } | null;
}

export const CARD_W = 1080;
export const CARD_H = 1350;
export const SITE_URL = 'https://habitww.pacelong.life';

const BADGE_SIZE = 56;
const MEDAL_WIDTH = 40;
const FONT = "-apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Helvetica Neue', Arial, sans-serif";

/** ミニカードの金属(CSS の多層ブレンドは使えないので、近い色のグラデーションで) */
const CARD_STOPS: Record<Exclude<Rarity, 'normal'>, string[]> = {
  bronze: ['#4a2a12', '#b97a45', '#8e5a2e', '#40230f'],
  silver: ['#9aa3ae', '#f4f6f8', '#c3c9d1', '#a4adb8'],
  gold: ['#503a16', '#d9bf76', '#a3823c', '#473113'],
  platinum: ['#c4c5c3', '#ffffff', '#d8d9d7', '#b9bab8'],
  holo: ['#ffb3b8', '#fff6b0', '#b8f5d0', '#b8e6ff', '#d9ccff', '#ffc4ec'],
};

const safeId = (s: string) => s.replace(/[^a-zA-Z0-9]/g, '');

/** MUI のアイコンを SVG の中に入れる(path だけ取り出す) */
function iconPaths(Icon: (typeof ICONS)[string]['Icon']) {
  const markup = renderToStaticMarkup(<Icon />);
  const m = markup.match(/<svg[^>]*>([\s\S]*)<\/svg>/);
  return m ? m[1] : '';
}

function Shape({ g, ...rest }: { g: (typeof GEOMETRY)[keyof typeof GEOMETRY] } & React.SVGProps<SVGElement>) {
  const p = rest as React.SVGProps<SVGCircleElement> & React.SVGProps<SVGPolygonElement> & React.SVGProps<SVGPathElement>;
  if (g.circle) return <circle cx={g.circle[0]} cy={g.circle[1]} r={g.circle[2]} {...p} />;
  if (g.points) return <polygon points={g.points} {...p} />;
  return <path d={g.d} {...p} />;
}

/** 盾・コインなどのバッジ(AchievementEmblem の Medallion の SVG 版)。中心が (0,0) */
function MedallionSvg({ badge }: { badge: EvaluatedAchievement }) {
  const shape = SHAPE[badge.category] as keyof typeof GEOMETRY;
  const g = GEOMETRY[shape];
  const metal = METAL[badge.tier];
  const { Icon, color } = ICONS[badge.icon] ?? ICONS.trophy;
  const id = `e${safeId(badge.id)}`;
  const inner = `translate(32 ${g.cy}) scale(0.74) translate(-32 -${g.cy})`;
  const iconSize = 22;
  return (
    <svg x={-BADGE_SIZE / 2} y={-BADGE_SIZE / 2} width={BADGE_SIZE} height={BADGE_SIZE} viewBox="0 0 64 64" overflow="visible">
      <defs>
        <linearGradient id={`${id}-m`} x1="0" y1="0" x2="1" y2="1">
          {metal.stops.map((c, i) => <stop key={i} offset={`${(i / (metal.stops.length - 1)) * 100}%`} stopColor={c} />)}
        </linearGradient>
        <radialGradient id={`${id}-e`} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0%" stopColor={lighten(color, 0.4)} />
          <stop offset="55%" stopColor={color} />
          <stop offset="100%" stopColor={darken(color, 0.4)} />
        </radialGradient>
        <clipPath id={`${id}-c`}><Shape g={g} /></clipPath>
      </defs>
      {shape === 'ribbon' && (
        <>
          <path d="M21 40 L14 62 L21.5 57.5 L26 63 L31 44 Z" fill={darken(color, 0.15)} stroke={darken(color, 0.4)} strokeWidth={1} />
          <path d="M43 40 L50 62 L42.5 57.5 L38 63 L33 44 Z" fill={color} stroke={darken(color, 0.4)} strokeWidth={1} />
        </>
      )}
      <Shape g={g} fill={`url(#${id}-m)`} stroke={metal.dark} strokeWidth={1.2} />
      <g transform={inner}>
        <Shape g={g} fill={`url(#${id}-e)`} stroke={darken(color, 0.5)} strokeOpacity={0.6} strokeWidth={1.4} />
      </g>
      <g clipPath={`url(#${id}-c)`}>
        <ellipse cx={22} cy={14} rx={22} ry={10} fill="rgba(255,255,255,0.28)" transform="rotate(-24 22 14)" />
      </g>
      <svg x={32 - iconSize / 2} y={g.cy - iconSize / 2} width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="#fff" dangerouslySetInnerHTML={{ __html: iconPaths(Icon) }} />
      {badge.mark && (
        <g>
          <rect x={32 - (badge.mark.length * 5.2 + 8) / 2} y={55} width={badge.mark.length * 5.2 + 8} height={11} rx={3} fill={metal.dark} stroke="rgba(255,255,255,0.35)" strokeWidth={0.8} />
          <text x={32} y={63.2} textAnchor="middle" fontSize={8.5} fontWeight={800} fill="#fff" fontFamily={FONT}>{badge.mark}</text>
        </g>
      )}
    </svg>
  );
}

/** カードランクのミニカード。中心が (0,0) */
function MiniCardSvg({ badge }: { badge: EvaluatedAchievement }) {
  const rarity = badge.icon.replace('rank-', '') as Exclude<Rarity, 'normal'>;
  const stops = CARD_STOPS[rarity] ?? CARD_STOPS.bronze;
  const ink = FINISH[rarity]?.ink ?? '#333';
  const id = `c${safeId(badge.id)}`;
  const name = rarity.toUpperCase();
  const w = BADGE_SIZE * 0.7;
  const h = BADGE_SIZE * 0.96;
  return (
    <svg x={-BADGE_SIZE / 2} y={-BADGE_SIZE / 2} width={BADGE_SIZE} height={BADGE_SIZE} viewBox="0 0 56 56" overflow="visible">
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="0.35" y2="1">
          {stops.map((c, i) => <stop key={i} offset={`${(i / (stops.length - 1)) * 100}%`} stopColor={c} />)}
        </linearGradient>
      </defs>
      <g transform="rotate(-8 28 28)">
        <rect x={28 - w / 2} y={28 - h / 2} width={w} height={h} rx={5} fill={`url(#${id}-g)`} stroke="rgba(255,255,255,0.5)" strokeWidth={1} />
        <rect x={28 - w / 2 + 3} y={28 - h / 2 + 3} width={w - 6} height={h - 6} rx={3} fill="none" stroke={ink} strokeOpacity={0.45} strokeWidth={0.8} />
        <text x={28} y={30} textAnchor="middle" fontSize={name.length > 6 ? 5.6 : 7} fontWeight={900} fill={ink} letterSpacing={0.4} fontFamily={FONT}>{name}</text>
        <rect x={22} y={34} width={12} height={1.6} fill={ink} fillOpacity={0.6} />
      </g>
    </svg>
  );
}

function ItemSvg({ item }: { item: ToyItem }) {
  if (item.kind === 'medal') {
    const h = MEDAL_WIDTH * 62 / 48;
    return (
      <svg x={-MEDAL_WIDTH / 2} y={-h / 2} width={MEDAL_WIDTH} height={h} viewBox={`0 0 ${MEDAL_WIDTH} ${h}`} overflow="visible">
        <Medal color={item.medal.habit.color} value={String(item.medal.month)} unit="月" year={String(item.medal.year)} size={MEDAL_WIDTH} />
      </svg>
    );
  }
  const shape = SHAPE[item.badge.category];
  if (shape === 'trophy') {
    const size = BADGE_SIZE * 1.15;
    const w = size * 46 / 56;
    return (
      <svg x={-w / 2} y={-size / 2} width={w} height={size} viewBox={`0 0 ${w} ${size}`} overflow="visible">
        <Trophy value={item.badge.mark ?? ''} unit="回" tier={item.badge.tier} size={size} />
      </svg>
    );
  }
  if (shape === 'card') return <MiniCardSvg badge={item.badge} />;
  return <MedallionSvg badge={item.badge} />;
}

function Pill({ x, y, label, value }: { x: number; y: number; label: string; value: string }) {
  const w = label.length * 30 + value.length * 22 + 60;
  return (
    <g>
      <rect x={x} y={y} width={w} height={64} rx={32} fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.14)" />
      <text x={x + 30} y={y + 43} fontSize={28} fill="rgba(255,255,255,0.7)" fontWeight={600} fontFamily={FONT}>{label}</text>
      <text x={x + 30 + label.length * 30 + 10} y={y + 44} fontSize={34} fill="#fff" fontWeight={800} fontFamily={FONT}>{value}</text>
    </g>
  );
}

/** シェア画像の SVG(1080×1350) */
export function buildToyCardSvg(input: ToyCardInput): string {
  const { boxWidth, boxHeight, bodies, stats, tower, platform } = input;
  // 山のあるところだけを切り出す(上の空きは詰める)
  const minY = bodies.length ? Math.min(...bodies.map(b => b.y - b.item.r)) : boxHeight - 240;
  const top = Math.max(0, Math.min(minY - 60, boxHeight - 260));
  const regionH = boxHeight - top;
  const areaTop = 330;
  const areaBottom = CARD_H - 130;
  const s = Math.min(CARD_W / boxWidth, (areaBottom - areaTop) / regionH);
  const drawW = boxWidth * s;
  const drawH = regionH * s;
  const ox = (CARD_W - drawW) / 2;
  const oy = areaBottom - drawH;
  const ordered = [...bodies].sort((a, b) => a.y - b.y);

  const svg = (
    <svg xmlns="http://www.w3.org/2000/svg" width={CARD_W} height={CARD_H} viewBox={`0 0 ${CARD_W} ${CARD_H}`} fontFamily={FONT}>
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#15151c" />
          <stop offset="100%" stopColor="#07070a" />
        </linearGradient>
        <radialGradient id="glow" cx="0.5" cy="0.95" r="0.7">
          <stop offset="0%" stopColor="rgba(255,196,80,0.28)" />
          <stop offset="100%" stopColor="rgba(255,196,80,0)" />
        </radialGradient>
        <linearGradient id="floorShade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.45)" />
        </linearGradient>
        <clipPath id="box"><rect x={ox} y={oy} width={drawW} height={drawH} rx={20} /></clipPath>
      </defs>
      <rect width={CARD_W} height={CARD_H} fill="url(#bg)" />
      <rect width={CARD_W} height={CARD_H} fill="url(#glow)" />

      <text x={60} y={118} fontSize={72} fontWeight={900} fill="#fff" letterSpacing={-1}>Habitww</text>
      <text x={372} y={118} fontSize={40} fontWeight={700} fill="rgba(255,255,255,0.6)">おもちゃ箱</text>
      <Pill x={60} y={170} label="バッジ" value={`${stats.badges}/${stats.totalBadges}`} />
      <Pill x={60 + 'バッジ'.length * 30 + `${stats.badges}/${stats.totalBadges}`.length * 22 + 80} y={170} label="メダル" value={`${stats.medals}枚`} />
      {tower && (
        <g>
          <text x={CARD_W - 60} y={112} textAnchor="end" fontSize={34} fontWeight={700} fill="rgba(255,255,255,0.65)">積み上げタワー</text>
          <text x={CARD_W - 60} y={200} textAnchor="end" fontSize={96} fontWeight={900} fill="#ffd54f">{tower.score}<tspan fontSize={40} fill="rgba(255,255,255,0.85)"> 個</tspan></text>
          <text x={CARD_W - 60} y={248} textAnchor="end" fontSize={28} fontWeight={700} fill="rgba(255,255,255,0.55)">
            {tower.score >= tower.best && tower.score > 0 ? '自己ベスト更新！' : `自己ベスト ${tower.best}個`}
          </text>
        </g>
      )}

      {/* 箱 */}
      <rect x={ox} y={oy} width={drawW} height={drawH} rx={20} fill="#1a1a21" />
      <g clipPath="url(#box)">
        {platform && (
          <g>
            <rect x={ox + (platform.x0 + platform.x1) / 2 * s - 7 * s} y={oy + (platform.y - top) * s} width={14 * s} height={(boxHeight - platform.y) * s} fill="#3a3a42" />
            <rect x={ox + platform.x0 * s} y={oy + (platform.y - top) * s} width={(platform.x1 - platform.x0) * s} height={10 * s} rx={5 * s} fill="#b9b9c0" stroke="rgba(255,255,255,0.4)" strokeWidth={s} />
          </g>
        )}
        {ordered.map(b => (
          <g key={b.item.id} transform={`translate(${ox + b.x * s} ${oy + (b.y - top) * s}) rotate(${(b.angle * 180) / Math.PI}) scale(${s})`}>
            <ItemSvg item={b.item} />
          </g>
        ))}
        <rect x={ox} y={oy + drawH - 60} width={drawW} height={60} fill="url(#floorShade)" />
      </g>
      <rect x={ox} y={oy} width={drawW} height={drawH} rx={20} fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth={3} />

      <text x={CARD_W / 2} y={CARD_H - 52} textAnchor="middle" fontSize={30} fontWeight={600} fill="rgba(255,255,255,0.45)">{SITE_URL.replace('https://', '')}</text>
    </svg>
  );
  return renderToStaticMarkup(svg);
}

/** SVG 文字列を PNG にする */
export async function svgToPngBlob(svg: string, width: number, height: number): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('svg load'));
      img.src = url;
    });
    if (typeof img.decode === 'function') await img.decode().catch(() => undefined);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas');
    ctx.drawImage(img, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export type ShareOutcome = 'shared' | 'cancelled' | 'fallback';

/** OS の共有シートで画像つきで共有する。できない環境なら 'fallback' */
export async function shareImage(blob: Blob, text: string): Promise<ShareOutcome> {
  const file = new File([blob], 'habitww-toybox.png', { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (typeof nav.share === 'function' && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], text });
      return 'shared';
    } catch (e) {
      return (e as Error).name === 'AbortError' ? 'cancelled' : 'fallback';
    }
  }
  return 'fallback';
}

export const xIntentUrl = (text: string) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;

export function shareText(stats: ToyCardInput['stats'], tower?: { score: number } | null) {
  const parts = [`バッジ ${stats.badges}/${stats.totalBadges}`, `メダル ${stats.medals}枚`];
  if (tower) parts.push(`積み上げタワー ${tower.score}個！`);
  return `Habitww のおもちゃ箱 🪙 ${parts.join('・')} #Habitww ${SITE_URL}`;
}
