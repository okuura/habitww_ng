import { useEffect, useRef, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import { alpha } from '@mui/material/styles';
import { keyframes } from '@emotion/react';
import type { Rarity } from './habitStats';
import { FINISH } from './cardFinish';

// 習慣カードの「器」: 表裏の 3D 回転と、裏面の素材(レアリティ)。
// 表面は習慣に集中できるよう今までどおりの素のカード。続けた証は裏面の金属の質感で見せる。
// 中身(表面・裏面)は App から受け取る

const RAINBOW = 'linear-gradient(90deg, #ff5f6d, #ffc371, #f9f871, #7cf29c, #5ad1ff, #a18cff, #ff7ad9, #ff5f6d)';
const rainbowShift = keyframes`
  0%   { background-position: 0% 50%; }
  100% { background-position: 300% 50%; }
`;
// ホロの虹の層だけをゆっくり流す(下の 2 層は固定)
const holoFlow = (layers: number) => keyframes`
  0%   { background-position: 0% 50%${', 0 0'.repeat(layers - 1)}; }
  100% { background-position: 300% 50%${', 0 0'.repeat(layers - 1)}; }
`;

// 裏返した瞬間に光の帯が一度だけ板の上を走る
const sweep = keyframes`
  0%   { transform: translateX(-120%) skewX(-18deg); opacity: 0; }
  20%  { opacity: 1; }
  100% { transform: translateX(260%) skewX(-18deg); opacity: 0; }
`;

// テーマの borderRadius 12 × 2(元の Card と同じ)
const RADIUS = 24;

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
  dark: boolean;
  flipped: boolean;
  onFlip: () => void;
  front: ReactNode;
  back: ReactNode;
  /** 一度でも裏返したか。まだなら裏面は描画しない(統計の計算を省く) */
  backMounted: boolean;
}

export default function HabitCardShell({ rarity, color, intensity, paperBg, dark, flipped, onFlip, front, back, backMounted }: HabitCardShellProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);

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
    if (!el || !flipped) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--sheen-x', String((e.clientX - r.left) / r.width));
  };
  const handlePointerLeave = () => rootRef.current?.style.removeProperty('--sheen-x');

  const finish = FINISH[rarity];

  const faceBase = {
    borderRadius: `${RADIUS}px`,
    backfaceVisibility: 'hidden' as const,
    WebkitBackfaceVisibility: 'hidden' as const,
    // 面ごとに独立した 3D の層にする。これが無いと WebKit では、面の中身が
    // 裏返したあとも左右反転して透けて見える
    transform: 'rotateY(0deg)',
  };

  // 表面: 元の Card と同じ見た目。今日の達成で枠に色が付き、ばっちりは虹の枠
  const frontSx = {
    ...faceBase,
    position: 'relative' as const,
    bgcolor: paperBg,
    border: '1px solid',
    // ばっちり達成の虹枠(2px)に切り替わってもカードの大きさ・中身の位置が変わらないよう 1px 分を余白で確保
    p: '1px',
    borderColor: intensity === 0 ? 'divider' : alpha(color, 0.2 + intensity * 0.1),
    transition: 'border-color 200ms, box-shadow 200ms',
    boxShadow: intensity === 0 ? 'none' : `0 0 0 ${intensity + 1}px ${alpha(color, intensity * 0.08)}`,
    ...(intensity === 2 ? {
      border: '2px solid transparent',
      p: 0,
      background: `linear-gradient(${paperBg}, ${paperBg}) padding-box, ${RAINBOW} border-box`,
      backgroundSize: '100% 100%, 300% 100%',
      animation: `${rainbowShift} 3s linear infinite`,
      boxShadow: dark ? '0 0 14px rgba(255,255,255,0.14)' : '0 2px 14px rgba(0,0,0,0.14)',
    } : {}),
    pointerEvents: flipped ? 'none' as const : 'auto' as const,
  };

  // 裏面: 表と同じ大きさ(中身はその中に収める)
  const backSx = {
    ...faceBase,
    position: 'absolute' as const,
    inset: 0,
    transform: 'rotateY(180deg)',
    overflow: 'hidden',
    pointerEvents: flipped ? 'auto' as const : 'none' as const,
    ...(finish ? {
      background: finish.background,
      backgroundBlendMode: finish.blend,
      ...(rarity === 'holo' ? { animation: `${holoFlow(finish.layers)} 8s linear infinite` } : {}),
      color: finish.ink,
      // 板の縁の面取り
      boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.45), inset 0 -2px 4px rgba(60,40,0,0.25), inset 0 2px 3px rgba(255,255,255,0.35)',
      // 内側の彫り線(刻印の枠)
      '&::before': {
        content: '""', position: 'absolute', inset: 7, borderRadius: `${RADIUS - 7}px`, pointerEvents: 'none', zIndex: 1,
        // 彫り込んだ溝: 線の上側は影、下側(と内側の下)に光
        border: `2px solid ${finish.line}`,
        boxShadow: `0 1px 0 ${finish.lineLight}, inset 0 1px 0 ${finish.lineLight}, inset 0 2px 3px rgba(0,0,0,0.12)`,
      },
      // 光沢(指の位置 → なければスクロール位置に合わせて動く)
      '&::after': {
        content: '""', position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2,
        backgroundImage: finish.sheen, backgroundSize: '300% 100%',
        backgroundPosition: 'calc(var(--sheen-x, var(--sheen-scroll, 0.5)) * 100%) 50%',
        transition: 'background-position 120ms linear',
        mixBlendMode: 'soft-light' as const,
      },
    } : {
      bgcolor: paperBg,
      border: '1px solid',
      borderColor: 'divider',
    }),
  };

  return (
    <Box
      ref={rootRef}
      className="habit-card-shell"
      onClick={handleTap}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      sx={{ position: 'relative', borderRadius: `${RADIUS}px`, perspective: '1400px' }}
    >
      <Box
        sx={{
          position: 'relative',
          transformStyle: 'preserve-3d',
          transition: 'transform 600ms cubic-bezier(0.3, 0.7, 0.2, 1)',
          transform: flipped ? 'rotateY(180deg)' : 'none',
        }}
      >
        <Box sx={frontSx} aria-hidden={flipped}>
          {front}
        </Box>
        <Box sx={backSx} aria-hidden={!flipped}>
          {finish && flipped && (
            <Box
              aria-hidden
              sx={{
                position: 'absolute', top: 0, bottom: 0, left: 0, width: '45%', zIndex: 4, pointerEvents: 'none',
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.55) 50%, transparent)',
                mixBlendMode: 'soft-light',
                animation: `${sweep} 1.1s cubic-bezier(0.3, 0.6, 0.3, 1) 0.4s both`,
              }}
            />
          )}
          <Box sx={{ position: 'relative', zIndex: 3, height: '100%' }}>
            {backMounted && back}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
