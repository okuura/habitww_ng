import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import { alpha } from '@mui/material/styles';
import { keyframes } from '@emotion/react';
import type { Rarity } from './habitStats';

// 習慣カードの「器」: レアリティの枠と光沢、今日の達成の光、表裏の 3D 回転。
// 中身(表面・裏面)は App から受け取る

const RAINBOW = 'linear-gradient(90deg, #ff5f6d, #ffc371, #f9f871, #7cf29c, #5ad1ff, #a18cff, #ff7ad9, #ff5f6d)';
const flow = keyframes`
  0%   { background-position: 0% 50%, 0% 50%; }
  100% { background-position: 0% 50%, 300% 50%; }
`;
const glowFlow = keyframes`
  0%   { background-position: 0% 50%; }
  100% { background-position: 300% 50%; }
`;

const FRAME: Record<Exclude<Rarity, 'normal'>, string> = {
  silver: 'linear-gradient(135deg, #f5f7fa 0%, #aab3c0 22%, #ffffff 42%, #8a95a5 68%, #e6eaf0 100%)',
  gold: 'linear-gradient(135deg, #fff6c8 0%, #d9a93a 22%, #fff3b0 42%, #a8790a 68%, #ffe27a 100%)',
  holo: RAINBOW,
};

const SHEEN: Record<Rarity, string | null> = {
  normal: null,
  silver: 'linear-gradient(115deg, transparent 38%, rgba(255,255,255,0.16) 47%, rgba(255,255,255,0.05) 53%, transparent 62%)',
  gold: 'linear-gradient(115deg, transparent 36%, rgba(255,236,170,0.22) 46%, rgba(255,255,255,0.08) 53%, transparent 64%)',
  holo: 'linear-gradient(115deg, transparent 22%, rgba(255,95,109,0.16) 32%, rgba(249,248,113,0.16) 40%, rgba(255,255,255,0.28) 47%, rgba(90,209,255,0.18) 55%, rgba(161,140,255,0.18) 63%, transparent 76%)',
};

const STAMP: Record<Exclude<Rarity, 'normal'>, { label: string; bg: string; color: string }> = {
  silver: { label: 'SILVER', bg: FRAME.silver, color: '#3d4652' },
  gold: { label: '★ GOLD', bg: FRAME.gold, color: '#5a3d00' },
  holo: { label: '✦ HOLO', bg: RAINBOW, color: '#ffffff' },
};

// ごく薄い紙の手触り(ノイズ)
const NOISE = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E")`;

const RADIUS = 14;

// スクロールに合わせて光沢を動かす(全カードで 1 つのリスナーを共有)
const shells = new Set<HTMLElement>();
let scrollListening = false;
function updateScrollSheen() {
  const vh = window.innerHeight || 1;
  for (const el of shells) {
    const top = el.getBoundingClientRect().top;
    el.style.setProperty('--sheen-scroll', String(Math.min(1, Math.max(0, top / vh))));
  }
}
function listenScroll() {
  if (scrollListening) return;
  scrollListening = true;
  let frame = 0;
  window.addEventListener('scroll', () => {
    if (!frame) frame = requestAnimationFrame(() => { frame = 0; updateScrollSheen(); });
  }, { passive: true });
}

interface HabitCardShellProps {
  rarity: Rarity;
  color: string;
  /** 今日の達成度(0=未実施, 1=達成, 2=ばっちり) */
  intensity: number;
  /** カードの地の色(ライト/ダークで変わる) */
  paperBg: string;
  flipped: boolean;
  onFlip: () => void;
  front: ReactNode;
  back: ReactNode;
  /** 一度でも裏返したか。まだなら裏面は描画しない(統計の計算を省く) */
  backMounted: boolean;
}

export default function HabitCardShell({ rarity, color, intensity, paperBg, flipped, onFlip, front, back, backMounted }: HabitCardShellProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const frontRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);
  const [heights, setHeights] = useState<{ front: number; back: number }>({ front: 0, back: 0 });

  // 表と裏は重ねて置き、器の高さは見えている面に合わせる(裏面は長いのでカードが伸びる)
  useLayoutEffect(() => {
    const measure = () => setHeights({
      front: frontRef.current?.offsetHeight ?? 0,
      back: backRef.current?.offsetHeight ?? 0,
    });
    measure();
    const ro = new ResizeObserver(measure);
    if (frontRef.current) ro.observe(frontRef.current);
    if (backRef.current) ro.observe(backRef.current);
    return () => ro.disconnect();
  }, [backMounted]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    shells.add(el);
    listenScroll();
    updateScrollSheen();
    return () => { shells.delete(el); };
  }, []);

  // ダブルタップで裏返す(iOS では dblclick が当てにならないので自前で判定)。
  // ボタン・入力欄・チップ・名前など、タップに役割がある場所では反応しない
  const handleTap = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, textarea, [data-no-flip], .MuiChip-root')) {
      lastTap.current = null;
      return;
    }
    const now = performance.now();
    const prev = lastTap.current;
    if (prev && now - prev.t < 300 && Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < 24) {
      lastTap.current = null;
      onFlip();
    } else {
      lastTap.current = { t: now, x: e.clientX, y: e.clientY };
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const el = rootRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--sheen-x', String((e.clientX - r.left) / r.width));
  };
  const handlePointerLeave = () => rootRef.current?.style.removeProperty('--sheen-x');

  const frame = rarity === 'normal' ? `linear-gradient(${alpha(color, 0.45)}, ${alpha(color, 0.45)})` : FRAME[rarity];
  const sheen = SHEEN[rarity];
  const visibleHeight = flipped ? heights.back : heights.front;

  const faceSx = {
    position: 'absolute' as const,
    top: 0, left: 0, right: 0,
    borderRadius: `${RADIUS}px`,
    border: '2px solid transparent',
    background: `linear-gradient(${paperBg}, ${paperBg}) padding-box, ${frame} border-box`,
    backgroundSize: '100% 100%, 300% 100%',
    ...(rarity === 'holo' ? { animation: `${flow} 6s linear infinite` } : {}),
    backfaceVisibility: 'hidden' as const,
    WebkitBackfaceVisibility: 'hidden' as const,
    // 面ごとに独立した 3D の層にする。これが無いと WebKit では、面の中の刻印や光沢(疑似要素)が
    // 裏返したあとも左右反転して透けて見える
    transform: 'rotateY(0deg)',
    // 紙の手触り
    '&::before': {
      content: '""', position: 'absolute', inset: 0, borderRadius: `${RADIUS - 2}px`, pointerEvents: 'none',
      backgroundImage: NOISE, opacity: 0.06, mixBlendMode: 'overlay' as const,
    },
    // 光沢(指の位置 → なければスクロール位置に合わせて動く)
    ...(sheen ? {
      '&::after': {
        content: '""', position: 'absolute', inset: 0, borderRadius: `${RADIUS - 2}px`, pointerEvents: 'none',
        backgroundImage: sheen, backgroundSize: '300% 100%',
        backgroundPosition: 'calc(var(--sheen-x, var(--sheen-scroll, 0.5)) * 100%) 50%',
        transition: 'background-position 120ms linear',
        zIndex: 2,
      },
    } : {}),
  };

  return (
    <Box
      ref={rootRef}
      className="habit-card-shell"
      onClick={handleTap}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      sx={{
        position: 'relative',
        borderRadius: `${RADIUS}px`,
        perspective: '1400px',
        transition: 'height 450ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        // 今日の達成は枠の外側の光で表す(枠はレアリティ用)
        ...(intensity === 1 ? { boxShadow: `0 0 0 1px ${alpha(color, 0.3)}, 0 0 14px ${alpha(color, 0.45)}` } : {}),
      }}
      style={{ height: visibleHeight || undefined }}
    >
      {intensity >= 2 && (
        <Box
          aria-hidden
          sx={{
            position: 'absolute', inset: -3, borderRadius: `${RADIUS + 3}px`, pointerEvents: 'none',
            background: RAINBOW, backgroundSize: '300% 100%', filter: 'blur(7px)', opacity: 0.75,
            animation: `${glowFlow} 3s linear infinite`,
          }}
        />
      )}
      <Box
        sx={{
          position: 'relative', height: '100%',
          transformStyle: 'preserve-3d',
          transition: 'transform 600ms cubic-bezier(0.3, 0.7, 0.2, 1)',
          transform: flipped ? 'rotateY(180deg)' : 'none',
        }}
      >
        <Box ref={frontRef} sx={{ ...faceSx, pointerEvents: flipped ? 'none' : 'auto' }} aria-hidden={flipped}>
          {rarity !== 'normal' && (
            <Box
              aria-hidden
              sx={{
                position: 'absolute', top: 0, right: 16, transform: 'translateY(-55%)', zIndex: 3,
                px: 0.9, py: '1px', borderRadius: '6px',
                background: STAMP[rarity].bg, backgroundSize: '200% 100%',
                color: STAMP[rarity].color, fontSize: '0.55rem', fontWeight: 900, letterSpacing: '0.08em',
                boxShadow: '0 1px 3px rgba(0,0,0,0.35)', textShadow: rarity === 'holo' ? '0 1px 1px rgba(0,0,0,0.45)' : 'none',
                pointerEvents: 'none', whiteSpace: 'nowrap',
                backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
              }}
            >
              {STAMP[rarity].label}
            </Box>
          )}
          {front}
        </Box>
        <Box
          ref={backRef}
          sx={{ ...faceSx, transform: 'rotateY(180deg)', pointerEvents: flipped ? 'auto' : 'none' }}
          aria-hidden={!flipped}
        >
          {backMounted && back}
        </Box>
      </Box>
    </Box>
  );
}
