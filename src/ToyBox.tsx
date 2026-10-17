import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import CircularProgress from '@mui/material/CircularProgress';
import CloseIcon from '@mui/icons-material/Close';
import VibrationIcon from '@mui/icons-material/Vibration';
import GridViewIcon from '@mui/icons-material/GridView';
import IosShareIcon from '@mui/icons-material/IosShare';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import { keyframes } from '@emotion/react';
import type { EvaluatedAchievement } from './achievements';
import { SHAPE } from './achievementIcons';
import AchievementEmblem from './AchievementEmblem';
import { Medal } from './Badges';
import {
  addBody, clear, createWorld, grab, impulseAll, moveHeld, pick, release, shelfLayout, step, sweep, unpinAll, wakeAll,
  type Body, type Vec, type World,
} from './toyPhysics';
import {
  buildToyCardSvg, CARD_H, CARD_W, shareImage, shareText, svgToPngBlob, xIntentUrl,
  type ToyItem, type ToyMedal,
} from './toyShare';

// おもちゃ箱: 取ったバッジとメダルが棚のように整然と並んでいて(固定)、指でなぞった物体だけ外れて落ちる。
// 落ちた物体がぶつかった相手も外れるので、触れたところから順に崩れていく。「ゆらす」は全部一度に崩す。
// 外れた物体は指でつまんではじける。「積み上げタワー」は、足場の上に 1 つずつ落として何個積めるか。
// 箱の様子は画像にしてシェアできる。端末の傾き・振りのセンサーは使わない(iOS の許可ダイアログを出さない)。
// 物理は toyPhysics、画像は toyShare。ここは描画と入力

export type { ToyMedal } from './toyShare';

interface Props {
  badges: EvaluatedAchievement[];
  /** バッジの総数(シェア画像の「28/46」用) */
  totalBadges: number;
  medals: ToyMedal[];
  onClose: () => void;
}

type Mode = 'free' | 'tower';

const BADGE_SIZE = 56;
const MEDAL_WIDTH = 40;
/** これより強くぶつかったら振動 */
const HAPTIC_MIN = 260;
const HAPTIC_STRONG = 900;
/** なぞり始めの揺れを無視する距離(px)。これより動いたら物体を外し始める */
const SWEEP_START = 4;
/** なぞる速さの上限(px/s) */
const SWEEP_MAX = 1800;
/** 重力は常に下 */
const DOWN: Vec = { x: 0, y: 1 };
/** タワーの足場の幅と、底からの高さ */
const PLATFORM_WIDTH = 170;
const PLATFORM_LIFT = 110;
const BEST_KEY = 'habitww-toybox-tower-best';

const fadeIn = keyframes`
  from { opacity: 0; }
  to   { opacity: 1; }
`;
const pop = keyframes`
  0%   { transform: scale(0.7); opacity: 0; }
  60%  { transform: scale(1.06); opacity: 1; }
  100% { transform: scale(1); }
`;

const vibrate = (pattern: number | number[]) => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(pattern);
};

const readBest = () => {
  try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; }
};
const writeBest = (n: number) => {
  try { localStorage.setItem(BEST_KEY, String(n)); } catch { /* 覚えられなくても遊べる */ }
};

const shuffle = <T,>(arr: T[]) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

interface TowerState {
  queue: ToyItem[];
  /** いま指についてきている物体 */
  current: Body | null;
  aimX: number;
  nextAt: number;
  /** 最初に落ちた時刻(少し待ってから数える) */
  fallenAt: number | null;
  done: boolean;
}

export default function ToyBox({ badges, totalBadges, medals, onClose }: Props) {
  const items = useMemo<(ToyItem & { node: ReactNode; top?: number })[]>(() => [
    ...badges.map(b => ({
      id: `b-${b.id}`, kind: 'badge' as const, badge: b,
      r: SHAPE[b.category] === 'trophy' ? 32 : 28,
      node: <AchievementEmblem badge={b} earned size={BADGE_SIZE} />,
    })),
    ...medals.map(m => ({
      id: `m-${m.habit.id}-${m.year}-${m.month}`, kind: 'medal' as const, medal: m, r: 22, top: 12,
      node: <Medal color={m.habit.color} value={String(m.month)} unit="月" year={String(m.year)} size={MEDAL_WIDTH} />,
    })),
  ], [badges, medals]);
  const itemById = useMemo(() => new Map(items.map(it => [it.id, it])), [items]);
  const stats = useMemo(() => ({ badges: badges.length, totalBadges, medals: medals.length }), [badges.length, totalBadges, medals.length]);

  const boxRef = useRef<HTMLDivElement>(null);
  const elRefs = useRef(new Map<string, HTMLDivElement>());
  const worldRef = useRef<World | null>(null);
  const heldRef = useRef<{ body: Body; pointerId: number; last: number } | null>(null);
  const modeRef = useRef<Mode>('free');
  /** 棚に並んだまま、まだ 1 つも外れていない(物理を止めている) */
  const shelvedRef = useRef(true);
  /** 棚を崩すなぞり(指を置いた位置と、直前の位置) */
  const sweepRef = useRef<{ pointerId: number; startX: number; startY: number; x: number; y: number; t: number } | null>(null);
  const towerRef = useRef<TowerState>({ queue: [], current: null, aimX: 0, nextAt: 0, fallenAt: null, done: false });

  const [mode, setMode] = useState<Mode>('free');
  const [shelved, setShelved] = useState(true);
  const [best, setBest] = useState(readBest);
  const [towerLive, setTowerLive] = useState(0);
  const [result, setResult] = useState<{ score: number; best: number; isBest: boolean } | null>(null);
  const [platform, setPlatform] = useState<{ left: number; top: number; width: number } | null>(null);
  const [sharing, setSharing] = useState(false);
  const [preview, setPreview] = useState<{ url: string; text: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const hideAll = () => {
    for (const el of elRefs.current.values()) el.style.transform = 'translate(-999px, -999px)';
  };

  /** 棚に並べる(全部を固定して置き直し、物理を止める) */
  const shelve = useCallback((world: World) => {
    heldRef.current = null;
    sweepRef.current = null;
    clear(world);
    for (const slot of shelfLayout(items, world.width, world.height)) {
      const it = itemById.get(slot.id)!;
      addBody(world, { id: it.id, r: it.r, x: slot.x, y: slot.y, pinned: true });
    }
    shelvedRef.current = true;
    setShelved(true);
  }, [items, itemById]);
  /** 最初の 1 つが外れた(物理を動かし始める) */
  const unshelve = () => {
    if (!shelvedRef.current) return;
    shelvedRef.current = false;
    setShelved(false);
  };

  const shake = () => {
    const world = worldRef.current;
    if (!world || modeRef.current !== 'free') return;
    unshelve();
    unpinAll(world);
    impulseAll(world, 650, DOWN);
    vibrate([15, 30, 15]);
  };
  const rearrange = () => {
    const world = worldRef.current;
    if (!world || modeRef.current !== 'free') return;
    hideAll();
    shelve(world);
    vibrate(10);
  };

  // 物理のループ。自由モードは棚に並べて止めておき、崩されたら動かす。タワーは 1 つずつ指で落とす
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const world = createWorld(box.clientWidth, box.clientHeight);
    worldRef.current = world;
    shelve(world);
    const start = performance.now();
    let last = start;
    let lastHaptic = 0;
    let lastLive = -1;
    let frame = 0;

    const loop = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;

      if (modeRef.current === 'tower') {
        const t = towerRef.current;
        if (!t.done) {
          if (!t.current && t.queue.length > 0 && now >= t.nextAt) {
            const it = t.queue.shift()!;
            const b = addBody(world, { id: it.id, r: it.r, x: Math.min(world.width - it.r, Math.max(it.r, t.aimX)), y: it.r + 12 });
            grab(b);
            t.current = b;
          }
          const floorY = world.height - 1;
          const fallen = world.bodies.some(b => !b.held && b.y + b.r >= floorY);
          if (fallen && t.fallenAt === null) {
            t.fallenAt = now;
            vibrate([30, 40, 30]);
          }
          const resting = world.bodies.filter(b => !b.held && b.y + b.r < floorY).length;
          if (resting !== lastLive) { lastLive = resting; setTowerLive(resting); }
          const everyoneStill = world.bodies.every(b => b.held || b.sleep >= 25);
          const finished = t.fallenAt !== null ? now - t.fallenAt > 1200 : (!t.current && t.queue.length === 0 && everyoneStill);
          if (finished) {
            t.done = true;
            const score = resting;
            const prev = readBest();
            const isBest = score > prev;
            if (isBest) { writeBest(score); setBest(score); }
            setResult({ score, best: Math.max(prev, score), isBest });
            vibrate(isBest ? [40, 60, 40, 60, 200] : 40);
          }
        }
      }

      // 棚に並んでいる間と、タワーが終わったあとは止める(点数とシェア画像が食い違わないように)
      const frozen = modeRef.current === 'free' ? shelvedRef.current : towerRef.current.done;
      let strongest = 0;
      if (!frozen) {
        for (let s = 0; s < 2; s++) {
          for (const hit of step(world, dt / 2, DOWN)) if (hit.strength > strongest) strongest = hit.strength;
        }
      }
      for (const b of world.bodies) {
        const el = elRefs.current.get(b.id);
        if (el) el.style.transform = `translate(${b.x - b.r}px, ${b.y - b.r}px) rotate(${b.angle}rad)`;
      }
      if (strongest > HAPTIC_MIN && now - lastHaptic > 60) {
        lastHaptic = now;
        vibrate(strongest > HAPTIC_STRONG ? 16 : 8);
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    const ro = new ResizeObserver(() => {
      world.width = box.clientWidth;
      world.height = box.clientHeight;
      if (world.platform) {
        world.platform = platformFor(world);
        setPlatform(platformBox(world));
      }
      if (modeRef.current === 'free' && shelvedRef.current) shelve(world);
      wakeAll(world);
    });
    ro.observe(box);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      worldRef.current = null;
    };
  }, [items, shelve]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);

  // --- タワー -----------------------------------------------------------------
  const platformFor = (world: World) => {
    const w = Math.min(PLATFORM_WIDTH, world.width - 40);
    return { x0: (world.width - w) / 2, x1: (world.width + w) / 2, y: world.height - PLATFORM_LIFT };
  };
  const platformBox = (world: World) => world.platform
    ? { left: world.platform.x0, top: world.platform.y, width: world.platform.x1 - world.platform.x0 }
    : null;

  const startTower = () => {
    const world = worldRef.current;
    if (!world) return;
    heldRef.current = null;
    sweepRef.current = null;
    clear(world);
    hideAll();
    world.platform = platformFor(world);
    setPlatform(platformBox(world));
    towerRef.current = { queue: shuffle(items), current: null, aimX: world.width / 2, nextAt: performance.now() + 350, fallenAt: null, done: false };
    modeRef.current = 'tower';
    setMode('tower');
    setResult(null);
    setTowerLive(0);
    vibrate(10);
  };

  const backToFree = () => {
    const world = worldRef.current;
    if (!world) return;
    hideAll();
    world.platform = null;
    setPlatform(null);
    modeRef.current = 'free';
    shelve(world);
    setMode('free');
    setResult(null);
  };

  // --- シェア -----------------------------------------------------------------
  const share = async () => {
    const world = worldRef.current;
    if (!world || sharing) return;
    setSharing(true);
    try {
      const tower = modeRef.current === 'tower' && result ? { score: result.score, best: result.best } : null;
      const svg = buildToyCardSvg({
        boxWidth: world.width, boxHeight: world.height, platform: world.platform,
        bodies: world.bodies.filter(b => !b.held).map(b => ({ item: itemById.get(b.id)!, x: b.x, y: b.y, angle: b.angle })).filter(b => b.item),
        stats, tower,
      });
      const blob = await svgToPngBlob(svg, CARD_W, CARD_H);
      const text = shareText(stats, tower);
      const outcome = await shareImage(blob, text);
      if (outcome === 'fallback') setPreview({ url: URL.createObjectURL(blob), text });
    } catch {
      setNotice('画像を作れませんでした');
      setTimeout(() => setNotice(null), 2500);
    } finally {
      setSharing(false);
    }
  };

  // --- 指 ----------------------------------------------------------------------
  const localPos = (e: ReactPointerEvent) => {
    const r = boxRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const aimTower = (x: number) => {
    const world = worldRef.current;
    const t = towerRef.current;
    if (!world) return;
    t.aimX = x;
    if (t.current) t.current.x = Math.min(world.width - t.current.r, Math.max(t.current.r, x));
  };
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const world = worldRef.current;
    if (!world) return;
    const { x, y } = localPos(e);
    if (modeRef.current === 'tower') {
      if (towerRef.current.done) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      heldRef.current = { body: towerRef.current.current as Body, pointerId: e.pointerId, last: performance.now() };
      aimTower(x);
      return;
    }
    if (heldRef.current || sweepRef.current) return;
    const body = pick(world, x, y);
    if (!body || body.pinned) {
      // 固定された物体や何も無いところから始めたら、なぞって崩す(触れた物体だけ外れる)
      e.currentTarget.setPointerCapture(e.pointerId);
      sweepRef.current = { pointerId: e.pointerId, startX: x, startY: y, x, y, t: performance.now() };
      return;
    }
    grab(body);
    heldRef.current = { body, pointerId: e.pointerId, last: performance.now() };
    e.currentTarget.setPointerCapture(e.pointerId);
    vibrate(6);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const world = worldRef.current;
    if (!world) return;
    const sw = sweepRef.current;
    if (sw && sw.pointerId === e.pointerId) {
      const { x, y } = localPos(e);
      const now = performance.now();
      const dt = Math.max(0.004, (now - sw.t) / 1000);
      if (Math.hypot(x - sw.startX, y - sw.startY) < SWEEP_START) return;
      const v = { x: (x - sw.x) / dt, y: (y - sw.y) / dt };
      const speed = Math.hypot(v.x, v.y);
      if (speed > SWEEP_MAX) { v.x *= SWEEP_MAX / speed; v.y *= SWEEP_MAX / speed; }
      const touched = sweep(world, { x: sw.x, y: sw.y }, { x, y }, v);
      sw.x = x; sw.y = y; sw.t = now;
      if (touched > 0 && shelvedRef.current) {
        unshelve();
        vibrate([10, 20, 10]);
      }
      return;
    }
    const held = heldRef.current;
    if (!held || held.pointerId !== e.pointerId) return;
    const { x, y } = localPos(e);
    if (modeRef.current === 'tower') { aimTower(x); return; }
    const now = performance.now();
    moveHeld(world, held.body, x, y, (now - held.last) / 1000);
    held.last = now;
  };
  const onPointerEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (sweepRef.current?.pointerId === e.pointerId) { sweepRef.current = null; return; }
    const held = heldRef.current;
    if (!held || held.pointerId !== e.pointerId) return;
    heldRef.current = null;
    if (modeRef.current === 'tower') {
      const t = towerRef.current;
      if (t.current && !t.done) {
        // 指を離したところから、まっすぐ落とす
        t.current.vx = 0;
        t.current.vy = 0;
        release(t.current);
        t.current.spin = 0;
        t.current = null;
        t.nextAt = performance.now() + 650;
        vibrate(6);
      }
      return;
    }
    release(held.body);
  };

  const towerPlaying = mode === 'tower' && !result;

  return (
    <Box
      role="dialog"
      aria-label="おもちゃ箱"
      sx={{
        position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', flexDirection: 'column',
        bgcolor: '#0c0c10', color: '#fff', animation: `${fadeIn} 200ms ease-out`,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', px: 2, pt: 'max(8px, env(safe-area-inset-top))', pb: 1, gap: 0.5 }}>
        <Typography sx={{ fontWeight: 800 }}>{mode === 'tower' ? '積み上げタワー' : 'おもちゃ箱'}</Typography>
        <Typography variant="caption" sx={{ ml: 0.5, color: 'rgba(255,255,255,0.55)' }}>
          {mode === 'tower' ? `最高 ${best}個` : `${items.length}個`}
        </Typography>
        <IconButton aria-label="画像でシェア" onClick={share} disabled={sharing || towerPlaying} sx={{ ml: 'auto', color: '#fff', '&.Mui-disabled': { color: 'rgba(255,255,255,0.3)' } }}>
          {sharing ? <CircularProgress size={20} color="inherit" /> : <IosShareIcon />}
        </IconButton>
        <IconButton aria-label="閉じる" onClick={onClose} sx={{ color: '#fff' }}>
          <CloseIcon />
        </IconButton>
      </Box>

      {/* 箱 */}
      <Box
        ref={boxRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        sx={{
          flex: 1, position: 'relative', overflow: 'hidden', touchAction: 'none', userSelect: 'none',
          mx: 1.5, borderRadius: 3,
          border: '1px solid rgba(255,255,255,0.14)',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.07))',
          boxShadow: 'inset 0 -28px 40px rgba(0,0,0,0.4), inset 0 2px 6px rgba(255,255,255,0.06)',
        }}
      >
        {platform && (
          <Box
            aria-hidden
            sx={{
              position: 'absolute', left: platform.left, top: platform.top, width: platform.width, height: 10, borderRadius: '5px',
              background: 'linear-gradient(180deg, #e8e8ea, #9a9aa0 60%, #5c5c64)',
              boxShadow: '0 4px 14px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.25)',
              '&::after': {
                content: '""', position: 'absolute', left: '50%', top: 10, width: 14, height: PLATFORM_LIFT - 10, transform: 'translateX(-50%)',
                background: 'linear-gradient(180deg, #6a6a72, #2a2a30)', borderRadius: '0 0 4px 4px',
              },
            }}
          />
        )}
        {items.map(it => (
          <Box
            key={it.id}
            ref={(el: HTMLDivElement | null) => {
              if (el) elRefs.current.set(it.id, el);
              else elRefs.current.delete(it.id);
            }}
            sx={{
              position: 'absolute', left: 0, top: 0, width: it.r * 2, height: it.r * 2,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transform: 'translate(-999px, -999px)', willChange: 'transform', pointerEvents: 'none',
            }}
          >
            {it.node}
          </Box>
        ))}

        {/* タワーの結果 */}
        {mode === 'tower' && result && (
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(0,0,0,0.45)' }}>
            <Box
              sx={{
                width: 'min(300px, 84%)', p: 3, borderRadius: 4, textAlign: 'center',
                bgcolor: 'rgba(24,24,30,0.96)', border: '1px solid rgba(255,255,255,0.14)', boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
                animation: `${pop} 500ms cubic-bezier(0.2, 0.8, 0.25, 1)`,
              }}
            >
              <EmojiEventsIcon sx={{ fontSize: 44, color: result.isBest ? '#ffd54f' : 'rgba(255,255,255,0.5)' }} />
              <Typography sx={{ fontSize: '2.2rem', fontWeight: 900, lineHeight: 1.1, mt: 0.5 }}>
                {result.score}<Box component="span" sx={{ fontSize: '1rem', ml: 0.5 }}>個 積めた！</Box>
              </Typography>
              <Typography variant="body2" sx={{ color: result.isBest ? '#ffd54f' : 'rgba(255,255,255,0.6)', fontWeight: 700, mt: 0.5 }}>
                {result.isBest ? '自己ベスト更新！' : `自己ベスト ${result.best}個`}
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 2.5 }}>
                <Button variant="contained" onClick={startTower} sx={{ borderRadius: 2, fontWeight: 700 }}>もう一度</Button>
                <Button variant="outlined" color="inherit" startIcon={<IosShareIcon />} onClick={share} disabled={sharing} sx={{ borderRadius: 2, borderColor: 'rgba(255,255,255,0.35)' }}>
                  画像でシェア
                </Button>
                <Button color="inherit" onClick={backToFree} sx={{ borderRadius: 2, color: 'rgba(255,255,255,0.7)' }}>自由に遊ぶ</Button>
              </Box>
            </Box>
          </Box>
        )}

        {notice && (
          <Typography sx={{ position: 'absolute', left: 0, right: 0, bottom: 16, textAlign: 'center', fontSize: '0.8rem', color: '#ffb4ab' }}>{notice}</Typography>
        )}
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, pt: 1.5, pb: 'max(14px, env(safe-area-inset-bottom))' }}>
        {mode === 'free' ? (
          <>
            <Typography variant="caption" sx={{ flex: 1, color: 'rgba(255,255,255,0.6)' }}>
              {shelved ? 'なぞると、触れたところから崩れる' : '指でつまんで、はじく'}
            </Typography>
            {!shelved && (
              <IconButton aria-label="並べ直す" onClick={rearrange} sx={{ color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.35)', borderRadius: 2, p: '5px' }}>
                <GridViewIcon fontSize="small" />
              </IconButton>
            )}
            <Button variant="outlined" color="inherit" startIcon={<VibrationIcon />} onClick={shake} sx={{ borderRadius: 2, borderColor: 'rgba(255,255,255,0.35)', textTransform: 'none', fontWeight: 700 }}>
              ゆらす
            </Button>
            <Button variant="contained" onClick={startTower} sx={{ borderRadius: 2, fontWeight: 700, bgcolor: '#ffb300', color: '#1a1200', '&:hover': { bgcolor: '#ffc233' } }}>
              タワー
            </Button>
          </>
        ) : (
          <>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 800, lineHeight: 1.2 }}>
                {towerLive}<Box component="span" sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.6)', ml: 0.5 }}>個 積めている</Box>
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.55)' }}>動かして離すと落ちる。足場の外に落ちたら終了</Typography>
            </Box>
            <Button color="inherit" onClick={backToFree} sx={{ borderRadius: 2, color: 'rgba(255,255,255,0.7)' }}>やめる</Button>
          </>
        )}
      </Box>

      {/* 共有シートが使えないとき: 画像を見せて保存してもらう */}
      <Dialog
        open={!!preview}
        onClose={() => setPreview(null)}
        PaperProps={{ sx: { borderRadius: 3, width: 'calc(100% - 32px)', maxWidth: 420, m: 2 } }}
        sx={{ zIndex: 2100 }}
      >
        {preview && (
          <Box sx={{ p: 2 }}>
            <Box component="img" src={preview.url} alt="おもちゃ箱のシェア画像" sx={{ width: '100%', borderRadius: 2, display: 'block' }} />
            <Typography variant="caption" sx={{ display: 'block', mt: 1.5, color: 'text.secondary' }}>
              画像を長押し(PC なら右クリック)で保存して、X の投稿に貼り付けてください
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mt: 1.5, justifyContent: 'flex-end' }}>
              <Button component="a" href={preview.url} download="habitww-toybox.png" sx={{ borderRadius: 2 }}>画像を保存</Button>
              <Button variant="contained" component="a" href={xIntentUrl(preview.text)} target="_blank" rel="noopener" sx={{ borderRadius: 2, fontWeight: 700 }}>
                X を開く
              </Button>
            </Box>
          </Box>
        )}
      </Dialog>
    </Box>
  );
}
