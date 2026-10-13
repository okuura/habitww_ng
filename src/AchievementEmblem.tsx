import { useId } from 'react';
import Box from '@mui/material/Box';
import { alpha, darken, lighten, keyframes } from '@mui/material/styles';
import type { AchievementCategory, Tier } from './achievements';
import { ICONS, METAL, SHAPE, type BadgeShape } from './achievementIcons';
import { Trophy } from './Badges';
import { FINISH } from './cardFinish';
import type { Rarity } from './habitStats';

// バッジの絵。カテゴリで形が、難しさ(tier)で縁の金属が変わる。
// 取ったバッジは金属の縁にエナメルの面、金とプラチナは光が走る。
// まだのバッジは同じ形の点線のシルエット(縁の色だけで「何の金属か」がわかる)

export interface BadgeLook {
  category: AchievementCategory;
  tier: Tier;
  icon: string;
  mark?: string;
  hidden?: boolean;
}

const glow = keyframes`
  0%, 100% { filter: drop-shadow(0 2px 3px rgba(0,0,0,0.3)) drop-shadow(0 0 0 rgba(255,196,0,0)); }
  50% { filter: drop-shadow(0 2px 3px rgba(0,0,0,0.3)) drop-shadow(0 0 7px rgba(255,196,0,0.95)); }
`;

const poly = (cx: number, cy: number, n: number, radii: number[], rot = -90) =>
  Array.from({ length: n }, (_, i) => {
    const r = radii[i % radii.length];
    const a = ((rot + (360 / n) * i) * Math.PI) / 180;
    return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
  }).join(' ');

/** 形の輪郭(64×64)と、面の中心 */
const GEOMETRY: Record<Exclude<BadgeShape, 'trophy' | 'card'>, { d?: string; points?: string; circle?: [number, number, number]; cy: number }> = {
  coin: { circle: [32, 32, 29], cy: 32 },
  ribbon: { circle: [32, 27, 23], cy: 27 },
  shield: { d: 'M32 3 L57 11 V30 C57 46 46 56 32 62 C18 56 7 46 7 30 V11 Z', cy: 30 },
  hexagon: { points: poly(32, 32, 6, [30]), cy: 32 },
  rosette: { points: poly(32, 32, 24, [30, 26.5]), cy: 32 },
  gem: { d: 'M17 6 H47 L60 23 L32 61 L4 23 Z', cy: 26 },
  star: { points: poly(32, 34, 10, [31, 16.5]), cy: 35 },
};

function Outline({ g, ...rest }: { g: (typeof GEOMETRY)[keyof typeof GEOMETRY] } & React.SVGProps<SVGPathElement & SVGCircleElement & SVGPolygonElement>) {
  if (g.circle) return <circle cx={g.circle[0]} cy={g.circle[1]} r={g.circle[2]} {...rest} />;
  if (g.points) return <polygon points={g.points} {...rest} />;
  return <path d={g.d} {...rest} />;
}

interface EmblemProps {
  badge: BadgeLook;
  earned: boolean;
  size?: number;
  /** 新しく取った(光らせる) */
  isNew?: boolean;
}

export default function AchievementEmblem({ badge, earned, size = 56, isNew }: EmblemProps) {
  const shape = SHAPE[badge.category];
  const look = { position: 'relative', width: size, height: size, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' } as const;

  if (shape === 'trophy') {
    const value = badge.mark ?? '';
    return (
      <Box sx={{ ...look, animation: earned && isNew ? `${glow} 1.6s ease-in-out infinite` : undefined }}>
        <Trophy value={value} unit="回" tier={badge.tier} locked={!earned} size={size * 1.15} />
      </Box>
    );
  }
  if (shape === 'card') return <MiniCard badge={badge} earned={earned} size={size} isNew={isNew} />;
  return <Medallion badge={badge} shape={shape} earned={earned} size={size} isNew={isNew} />;
}

function Medallion({ badge, shape, earned, size, isNew }: { badge: BadgeLook; shape: keyof typeof GEOMETRY; earned: boolean; size: number; isNew?: boolean }) {
  const gid = useId();
  const g = GEOMETRY[shape];
  const metal = METAL[badge.tier];
  const { Icon, color } = ICONS[badge.icon] ?? ICONS.trophy;
  const shiny = badge.tier === 'gold' || badge.tier === 'platinum';
  const inner = `translate(32 ${g.cy}) scale(0.74) translate(-32 -${g.cy})`;
  const tails = shape === 'ribbon' && (
    <>
      <path d="M21 40 L14 62 L21.5 57.5 L26 63 L31 44 Z" fill={earned ? darken(color, 0.15) : 'none'} stroke={earned ? darken(color, 0.4) : alpha(metal.label, 0.5)} strokeWidth={1} strokeDasharray={earned ? undefined : '3 2'} />
      <path d="M43 40 L50 62 L42.5 57.5 L38 63 L33 44 Z" fill={earned ? color : 'none'} stroke={earned ? darken(color, 0.4) : alpha(metal.label, 0.5)} strokeWidth={1} strokeDasharray={earned ? undefined : '3 2'} />
    </>
  );

  return (
    <Box
      sx={{
        position: 'relative', width: size, height: size, flexShrink: 0,
        filter: earned ? 'drop-shadow(0 2px 3px rgba(0,0,0,0.3))' : undefined,
        animation: earned && isNew ? `${glow} 1.6s ease-in-out infinite` : undefined,
      }}
    >
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden focusable="false" style={{ overflow: 'visible' }}>
        {earned ? (
          <>
            <defs>
              <linearGradient id={`${gid}-m`} x1="0" y1="0" x2="1" y2="1">
                {metal.stops.map((c, i) => <stop key={i} offset={`${(i / (metal.stops.length - 1)) * 100}%`} stopColor={c} />)}
                {badge.tier === 'platinum' && (
                  <animateTransform attributeName="gradientTransform" type="rotate" from="0 .5 .5" to="360 .5 .5" dur="6s" repeatCount="indefinite" />
                )}
              </linearGradient>
              <radialGradient id={`${gid}-e`} cx="0.35" cy="0.3" r="0.8">
                <stop offset="0%" stopColor={lighten(color, 0.4)} />
                <stop offset="55%" stopColor={color} />
                <stop offset="100%" stopColor={darken(color, 0.4)} />
              </radialGradient>
              <linearGradient id={`${gid}-s`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="rgba(255,255,255,0)" />
                <stop offset="50%" stopColor="rgba(255,255,255,0.75)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0)" />
              </linearGradient>
              <clipPath id={`${gid}-c`}><Outline g={g} /></clipPath>
            </defs>
            {tails}
            {/* 金属の縁 */}
            <Outline g={g} fill={`url(#${gid}-m)`} stroke={metal.dark} strokeWidth={1.2} />
            {/* エナメルの面 */}
            <g transform={inner}>
              <Outline g={g} fill={`url(#${gid}-e)`} stroke={darken(color, 0.5)} strokeOpacity={0.6} strokeWidth={1.4} />
            </g>
            {shape === 'gem' && (
              <path d="M17 6 L24 23 L32 6 L40 23 L47 6 M4 23 H60 M24 23 L32 61 L40 23" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={0.8} />
            )}
            {/* 映り込み */}
            <g clipPath={`url(#${gid}-c)`}>
              <ellipse cx={22} cy={14} rx={22} ry={10} fill="rgba(255,255,255,0.28)" transform="rotate(-24 22 14)" />
              {shiny && (
                <g transform="skewX(-20)">
                  <rect y={-4} width={9} height={72} fill={`url(#${gid}-s)`}>
                    <animate attributeName="x" values="-20;90;90" keyTimes="0;0.35;1" dur={badge.tier === 'platinum' ? '2.6s' : '3.6s'} repeatCount="indefinite" />
                  </rect>
                </g>
              )}
            </g>
          </>
        ) : (
          <>
            {tails}
            <Outline g={g} fill="rgba(128,128,128,0.1)" stroke={alpha(metal.label, 0.6)} strokeWidth={1.6} strokeDasharray="4 3" />
          </>
        )}
      </svg>

      {/* 面の絵 */}
      <Box
        sx={{
          position: 'absolute', left: 0, right: 0, top: `${(g.cy / 64) * 100}%`, transform: 'translateY(-50%)',
          display: 'flex', justifyContent: 'center', color: earned ? '#fff' : 'text.disabled', lineHeight: 0,
        }}
      >
        {badge.hidden && !earned
          ? <Box component="span" sx={{ fontWeight: 900, fontSize: size * 0.34, lineHeight: 1 }}>?</Box>
          : <Icon sx={{ fontSize: size * 0.34, opacity: earned ? 1 : 0.55, filter: earned ? `drop-shadow(0 1px 0 ${darken(color, 0.5)})` : undefined }} />}
      </Box>

      {earned && badge.mark && (
        <Box
          component="span"
          sx={{
            position: 'absolute', bottom: -4, left: '50%', transform: 'translateX(-50%)',
            px: 0.6, borderRadius: 1, whiteSpace: 'nowrap',
            bgcolor: metal.dark, color: '#fff', border: `1px solid ${alpha('#fff', 0.35)}`,
            fontSize: Math.max(8.5, size * 0.16), fontWeight: 800, lineHeight: 1.4,
          }}
        >
          {badge.mark}
        </Box>
      )}
    </Box>
  );
}

const RANK_NAME: Record<string, string> = { bronze: 'BRONZE', silver: 'SILVER', gold: 'GOLD', platinum: 'PLATINUM', holo: 'HOLO' };
/** 刻む文字の大きさ(PLATINUM のような長い名前は小さく) */
const rankFont = (name: string, size: number) => size * (name.length > 6 ? 0.1 : 0.13);

/** カードランクのバッジ: 本物のカードと同じ金属の、小さなカード */
function MiniCard({ badge, earned, size, isNew }: { badge: BadgeLook; earned: boolean; size: number; isNew?: boolean }) {
  const rarity = badge.icon.replace('rank-', '') as Exclude<Rarity, 'normal'>;
  const finish = FINISH[rarity];
  const w = size * 0.7;
  const h = size * 0.96;
  if (!earned || !finish) {
    return (
      <Box sx={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Box sx={{ width: w, height: h, borderRadius: `${size * 0.09}px`, border: '1.6px dashed', borderColor: alpha(METAL[badge.tier].label, 0.6), bgcolor: 'rgba(128,128,128,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Box component="span" sx={{ fontSize: rankFont(RANK_NAME[rarity], size), fontWeight: 900, letterSpacing: '0.06em', color: 'text.disabled' }}>{RANK_NAME[rarity]}</Box>
        </Box>
      </Box>
    );
  }
  return (
    <Box sx={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Box
        sx={{
          position: 'relative', width: w, height: h, borderRadius: `${size * 0.09}px`, overflow: 'hidden',
          background: finish.background, backgroundBlendMode: finish.blend,
          boxShadow: '0 2px 5px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(255,255,255,0.45)',
          transform: 'rotate(-8deg)',
          animation: isNew ? `${glow} 1.6s ease-in-out infinite` : undefined,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          '&::before': {
            content: '""', position: 'absolute', inset: size * 0.05, borderRadius: `${size * 0.05}px`,
            border: `1px solid ${finish.line}`, boxShadow: `0 1px 0 ${finish.lineLight}`,
          },
        }}
      >
        <Box component="span" sx={{ fontSize: rankFont(RANK_NAME[rarity], size), fontWeight: 900, letterSpacing: '0.06em', color: finish.ink, textShadow: finish.engrave }}>
          {RANK_NAME[rarity]}
        </Box>
        <Box sx={{ width: '45%', height: 2, mt: 0.5, bgcolor: finish.line, boxShadow: `0 1px 0 ${finish.lineLight}` }} />
      </Box>
    </Box>
  );
}
