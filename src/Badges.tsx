import { useId } from 'react';
import { alpha, darken, lighten } from '@mui/material/styles';

// 実績のバッジ図鑑と習慣カードの裏面で使う、メダルとトロフィーの絵

// --- Medal (SVG) -----------------------------------------------------------
// A ribbon-and-disc medal. `value`+`unit` engraved in the center, `year`
// stamped below it. `ongoing` renders a dashed "not yet earned" ghost.

interface MedalProps {
  color: string;
  value: string;
  unit: string;
  year?: string;
  ribbonColor?: string;
  ongoing?: boolean;
}

export function Medal({ color, value, unit, year, ribbonColor, ongoing }: MedalProps) {
  const gid = useId();
  const rim = darken(color, 0.35);
  const ribbon = ribbonColor ?? darken(color, 0.18);
  const ribbonLight = ribbonColor ? lighten(ribbonColor, 0.15) : darken(color, 0.05);
  const valueSize = value.length >= 4 ? 10.5 : value.length === 3 ? 12 : 14;

  return (
    <svg width={40} height={52} viewBox="0 0 48 62" aria-hidden focusable="false">
      {!ongoing && (
        <>
          {/* Ribbon straps */}
          <polygon points="13,0 22,0 27,24 18,27" fill={ribbon} />
          <polygon points="26,0 35,0 30,27 21,24" fill={ribbonLight} />
          <defs>
            <linearGradient id={`${gid}-m`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lighten(color, 0.3)} />
              <stop offset="55%" stopColor={color} />
              <stop offset="100%" stopColor={darken(color, 0.28)} />
            </linearGradient>
          </defs>
          {/* Disc */}
          <circle cx={24} cy={40} r={19} fill={`url(#${gid}-m)`} stroke={rim} strokeWidth={1.5} />
          {/* Engraved inner ring */}
          <circle cx={24} cy={40} r={15.5} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth={1} />
          {/* Gloss highlight */}
          <ellipse cx={17.5} cy={32} rx={9} ry={4.5} fill="rgba(255,255,255,0.22)" transform="rotate(-24 17.5 32)" />
          {/* Value */}
          <text x={24} y={41.5} textAnchor="middle" fontWeight={800} fontSize={valueSize} fill="#fff">
            {value}
            <tspan fontSize={7} fontWeight={700}>{unit}</tspan>
          </text>
          {year && (
            <text x={24} y={50} textAnchor="middle" fontWeight={600} fontSize={6} fill="rgba(255,255,255,0.85)" letterSpacing={0.5}>
              {year}
            </text>
          )}
        </>
      )}
      {ongoing && (
        <>
          <polygon points="13,0 22,0 27,24 18,27" fill={alpha(ribbon, 0.25)} />
          <polygon points="26,0 35,0 30,27 21,24" fill={alpha(ribbonLight, 0.25)} />
          <circle cx={24} cy={40} r={19} fill={alpha(color, 0.08)} stroke={alpha(color, 0.65)} strokeWidth={1.5} strokeDasharray="4 3" />
          <text x={24} y={41.5} textAnchor="middle" fontWeight={800} fontSize={valueSize} fill={color}>
            {value}
            <tspan fontSize={7} fontWeight={700}>{unit}</tspan>
          </text>
          {year && (
            <text x={24} y={50} textAnchor="middle" fontWeight={600} fontSize={6} fill={alpha(color, 0.8)} letterSpacing={0.5}>
              {year}
            </text>
          )}
        </>
      )}
    </svg>
  );
}

// --- Trophy (SVG) ----------------------------------------------------------
// Championship cup for cumulative milestones. Polished-metal gradients with
// cylindrical shading, S-curve handles, knopped stem, tiered base with a
// plaque, a breathing golden halo behind it, and a specular sweep across
// the bowl. All animation is SMIL (works on iOS).

export type TrophyTier = 'bronze' | 'silver' | 'gold' | 'platinum';

// 金属ごとの色: v = 上から下への陰影, h = 縁の左右の磨き, stroke = 輪郭, glow = 後光(r,g,b)
const TROPHY_METAL: Record<TrophyTier | 'locked', { v: string[]; h: string[]; stroke: string; glow: string; engrave: string }> = {
  bronze: { v: ['#FDE3C8', '#E7A36B', '#B8743D', '#8A5228', '#5E3517'], h: ['#7A4A22', '#F0BF8F', '#FDE3C8', '#C88550', '#5E3517'], stroke: '#4D2A10', glow: '231,163,107', engrave: 'rgba(80,40,10,0.8)' },
  silver: { v: ['#FFFFFF', '#E3E8EE', '#B9C2CD', '#8A94A3', '#5F6977'], h: ['#6F7A88', '#DFE5EC', '#FFFFFF', '#B9C2CD', '#5F6977'], stroke: '#4A5260', glow: '200,215,235', engrave: 'rgba(50,60,75,0.8)' },
  gold: { v: ['#FFF8DC', '#FFD54F', '#F0A500', '#C07F0C', '#8A5C08'], h: ['#9A6B0A', '#FFE082', '#FFF3C4', '#E0A81A', '#8A5C08'], stroke: '#7A4F00', glow: '255,215,64', engrave: 'rgba(110,65,0,0.8)' },
  platinum: { v: ['#FFFFFF', '#F1EFFF', '#CFCBF7', '#A19BDB', '#6E68AD'], h: ['#6E68AD', '#E4E0FF', '#FFFFFF', '#B9B2F0', '#6E68AD'], stroke: '#4B4686', glow: '190,170,255', engrave: 'rgba(60,50,130,0.8)' },
  locked: { v: ['#d6d6d6', '#c4c4c4', '#b0b0b0', '#9e9e9e', '#8c8c8c'], h: ['#9e9e9e', '#c4c4c4', '#d6d6d6', '#b0b0b0', '#8c8c8c'], stroke: 'rgba(0,0,0,0.25)', glow: '0,0,0', engrave: 'rgba(0,0,0,0.25)' },
};

export function Trophy({ value, unit, tier = 'gold', locked = false, size = 56 }: {
  value: string; unit: string; tier?: TrophyTier;
  /** まだ取っていない(灰色で、光らない) */
  locked?: boolean;
  /** 高さ(px) */
  size?: number;
}) {
  const gid = useId();
  const m = TROPHY_METAL[locked ? 'locked' : tier];
  const valueSize = value.length >= 4 ? 9.5 : value.length === 3 ? 11 : 13;
  const BOWL = 'M14 18 H42 V27 C42 39 35.5 45 28 45 C20.5 45 14 39 14 27 Z';

  return (
    <svg width={size * 46 / 56} height={size} viewBox="0 0 56 68" style={locked ? { opacity: 0.45 } : undefined} aria-hidden focusable="false">
      <defs>
        {/* Polished gold: bright crown, deep amber core, dark foot */}
        <linearGradient id={`${gid}-v`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={m.v[0]} />
          <stop offset="22%" stopColor={m.v[1]} />
          <stop offset="55%" stopColor={m.v[2]} />
          <stop offset="82%" stopColor={m.v[3]} />
          <stop offset="100%" stopColor={m.v[4]} />
        </linearGradient>
        {/* Mirror-band for lip / base tiers (light-dark-light polish) */}
        <linearGradient id={`${gid}-h`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={m.h[0]} />
          <stop offset="22%" stopColor={m.h[1]} />
          <stop offset="50%" stopColor={m.h[2]} />
          <stop offset="78%" stopColor={m.h[3]} />
          <stop offset="100%" stopColor={m.h[4]} />
        </linearGradient>
        {/* Halo behind the cup */}
        <radialGradient id={`${gid}-halo`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={`rgba(${m.glow},0.8)`} />
          <stop offset="55%" stopColor={`rgba(${m.glow},0.35)`} />
          <stop offset="100%" stopColor={`rgba(${m.glow},0)`} />
        </radialGradient>
        {/* Rays fade to nothing well inside the viewBox so rotation never clips */}
        <radialGradient id={`${gid}-ray`} gradientUnits="userSpaceOnUse" cx="28" cy="32" r="26">
          <stop offset="0%" stopColor={`rgba(${m.glow},0.75)`} />
          <stop offset="50%" stopColor={`rgba(${m.glow},0.4)`} />
          <stop offset="100%" stopColor={`rgba(${m.glow},0)`} />
        </radialGradient>
        <linearGradient id={`${gid}-sw`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(255,255,255,0)" />
          <stop offset="50%" stopColor="rgba(255,255,245,0.55)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
        <clipPath id={`${gid}-cl`}>
          <path d={BOWL} />
        </clipPath>
      </defs>

      {/* Soft breathing halo — the single source of the surrounding glow.
          4s cycle, spline-eased, gently swelling in size and brightness. */}
      {!locked && <>
      <circle cx={28} cy={32} r={25} fill={`url(#${gid}-halo)`}>
        <animate
          attributeName="opacity" values="0.75;1;0.75" dur="5s"
          calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1"
          repeatCount="indefinite"
        />
        <animate
          attributeName="r" values="24;27;24" dur="4s"
          calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1"
          repeatCount="indefinite"
        />
      </circle>

      {/* Radiance: faint tapered rays revolving imperceptibly slowly (36s/turn).
          Alternating long/short rays; the radial gradient melts them into air. */}
      <g opacity={0.9}>
        <g>
          <animateTransform
            attributeName="transform" type="rotate"
            from="0 28 32" to="360 28 32" dur="22s" repeatCount="indefinite"
          />
          {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => (
            <path
              key={deg}
              d={deg % 90 === 0 ? 'M28 32 L25.8 5.5 L30.2 5.5 Z' : 'M28 32 L26.4 11.5 L29.6 11.5 Z'}
              fill={`url(#${gid}-ray)`}
              transform={`rotate(${deg} 28 32)`}
            />
          ))}
        </g>
      </g>

      </>}

      {/* Handles: S-curves with a bright inner accent */}
      <path d="M14 20 C3.5 20 2.5 34 15 36.5" fill="none" stroke={`url(#${gid}-v)`} strokeWidth={3.6} strokeLinecap="round" />
      <path d="M42 20 C52.5 20 53.5 34 41 36.5" fill="none" stroke={`url(#${gid}-v)`} strokeWidth={3.6} strokeLinecap="round" />
      <path d="M14 20 C5 20 4.5 33 15 35.5" fill="none" stroke="rgba(255,248,220,0.55)" strokeWidth={1} strokeLinecap="round" />
      <path d="M42 20 C51 20 51.5 33 41 35.5" fill="none" stroke="rgba(255,248,220,0.55)" strokeWidth={1} strokeLinecap="round" />

      {/* Bowl with cylindrical shading */}
      <path d={BOWL} fill={`url(#${gid}-v)`} stroke={m.stroke} strokeWidth={1} />
      <g clipPath={`url(#${gid}-cl)`}>
        {/* left highlight column / right shade column */}
        <path d="M17 18 h5 v27 h-5 Z" fill="rgba(255,255,255,0.32)" />
        <path d="M36 18 h5 v27 h-5 Z" fill="rgba(90,50,0,0.22)" />
        {/* inner shadow under the lip */}
        <rect x={14} y={18} width={28} height={2.5} fill="rgba(90,50,0,0.28)" />
      </g>

      {/* Lip */}
      <rect x={11.5} y={13} width={33} height={5.5} rx={2.75} fill={`url(#${gid}-h)`} stroke={m.stroke} strokeWidth={1} />

      {/* Engraved star above the number */}
      <polygon
        points="28,21.6 29.3,24.2 32.2,24.6 30.1,26.6 30.6,29.4 28,28.1 25.4,29.4 25.9,26.6 23.8,24.6 26.7,24.2"
        fill="rgba(255,253,231,0.9)" stroke="rgba(122,79,0,0.5)" strokeWidth={0.4}
      />

      {/* Value: engraved (dark offset under white face) */}
      <text x={28} y={39.2} textAnchor="middle" fontWeight={800} fontSize={valueSize} fill={m.engrave}>
        {value}<tspan fontSize={7} fontWeight={700}>{unit}</tspan>
      </text>
      <text x={28} y={38.5} textAnchor="middle" fontWeight={800} fontSize={valueSize} fill="#FFFFFF">
        {value}<tspan fontSize={7} fontWeight={700}>{unit}</tspan>
      </text>

      {/* Knopped stem */}
      <path d="M25.5 45 h5 v2.5 h-5 Z" fill={`url(#${gid}-v)`} stroke={m.stroke} strokeWidth={0.7} />
      <ellipse cx={28} cy={49.8} rx={4.6} ry={2.4} fill={`url(#${gid}-v)`} stroke={m.stroke} strokeWidth={0.7} />
      <path d="M25.5 51.8 h5 v3 h-5 Z" fill={`url(#${gid}-v)`} stroke={m.stroke} strokeWidth={0.7} />

      {/* Tiered base + plaque */}
      <path d="M19 54.8 H37 L39.5 58.8 H16.5 Z" fill={`url(#${gid}-h)`} stroke={m.stroke} strokeWidth={0.8} />
      <rect x={13.5} y={58.8} width={29} height={6.5} rx={1.5} fill={`url(#${gid}-h)`} stroke={m.stroke} strokeWidth={0.8} />
      <rect x={20} y={60.3} width={16} height={3.6} rx={0.8} fill="#4E342E" stroke="#3E2723" strokeWidth={0.5} />
      <rect x={21} y={61} width={14} height={0.8} rx={0.4} fill="rgba(255,235,180,0.35)" />

      {/* Gentle specular sweep across the bowl (~1.3s glide, 4s cycle) */}
      {!locked && <g clipPath={`url(#${gid}-cl)`}>
        <g transform="skewX(-18)">
          <rect y={16} width={11} height={32} fill={`url(#${gid}-sw)`}>
            <animate attributeName="x" values="-22;76;76" keyTimes="0;0.33;1" dur="4s" repeatCount="indefinite" />
          </rect>
        </g>
      </g>}
    </svg>
  );
}
