import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import CloseIcon from '@mui/icons-material/Close';
import VibrationIcon from '@mui/icons-material/Vibration';
import { keyframes } from '@emotion/react';
import type { Habit } from './supabase';
import type { EvaluatedAchievement } from './achievements';
import { SHAPE } from './achievementIcons';
import AchievementEmblem from './AchievementEmblem';
import { Medal } from './Badges';
import {
  addBody, createWorld, grab, impulseAll, moveHeld, pick, release, step, wakeAll,
  type Body, type Vec, type World,
} from './toyPhysics';

// おもちゃ箱: 取ったバッジとメダルが箱の中に落ちてきて、傾ける・振る・指ではじいて遊べる。
// 意味も記録も無い。物理は toyPhysics、ここは描画と入力だけ

export interface ToyMedal { habit: Habit; year: number; month: number }

interface Props {
  badges: EvaluatedAchievement[];
  medals: ToyMedal[];
  onClose: () => void;
}

interface Item { id: string; r: number; node: ReactNode }

const BADGE_SIZE = 56;
const MEDAL_WIDTH = 40;
/** 落ちてくる間隔(ms) */
const SPAWN_INTERVAL = 45;
/** これより強くぶつかったら振動 */
const HAPTIC_MIN = 260;
const HAPTIC_STRONG = 900;
/** 振ったと判断する加速度(重力抜き、m/s²) */
const SHAKE_ACCEL = 14;

const fadeIn = keyframes`
  from { opacity: 0; }
  to   { opacity: 1; }
`;

const vibrate = (pattern: number | number[]) => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(pattern);
};

export default function ToyBox({ badges, medals, onClose }: Props) {
  const items = useMemo<Item[]>(() => [
    ...badges.map(b => ({
      id: `b-${b.id}`,
      r: SHAPE[b.category] === 'trophy' ? 32 : 28,
      node: <AchievementEmblem badge={b} earned size={BADGE_SIZE} />,
    })),
    ...medals.map(m => ({
      id: `m-${m.habit.id}-${m.year}-${m.month}`,
      r: 22,
      node: <Medal color={m.habit.color} value={String(m.month)} unit="月" year={String(m.year)} size={MEDAL_WIDTH} />,
    })),
  ], [badges, medals]);

  const boxRef = useRef<HTMLDivElement>(null);
  const elRefs = useRef(new Map<string, HTMLDivElement>());
  const worldRef = useRef<World | null>(null);
  const gravityRef = useRef<Vec>({ x: 0, y: 1 });
  const heldRef = useRef<{ body: Body; pointerId: number; last: number } | null>(null);
  const [hasSensors, setHasSensors] = useState(false);

  const shake = () => {
    const world = worldRef.current;
    if (!world) return;
    impulseAll(world, 650, gravityRef.current);
    vibrate([15, 30, 15]);
  };

  // 物理のループ。物体は時間差で上から落としていく
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const world = createWorld(box.clientWidth, box.clientHeight);
    worldRef.current = world;
    const start = performance.now();
    let last = start;
    let lastHaptic = 0;
    let spawnIdx = 0;
    let spawnAt = start + 150;
    let frame = 0;

    const loop = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      while (spawnIdx < items.length && now >= spawnAt) {
        const it = items[spawnIdx++];
        addBody(world, {
          id: it.id, r: it.r,
          x: it.r + Math.random() * Math.max(1, world.width - 2 * it.r), y: it.r + 1,
          vx: (Math.random() - 0.5) * 160, vy: 160, angle: Math.random() * Math.PI * 2,
        });
        spawnAt += SPAWN_INTERVAL;
      }
      let strongest = 0;
      for (let s = 0; s < 2; s++) {
        for (const hit of step(world, dt / 2, gravityRef.current)) if (hit.strength > strongest) strongest = hit.strength;
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

    // 箱の大きさが変わったら(回転など)壁を合わせる
    const ro = new ResizeObserver(() => {
      world.width = box.clientWidth;
      world.height = box.clientHeight;
      wakeAll(world);
    });
    ro.observe(box);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      worldRef.current = null;
    };
  }, [items]);

  // 端末の傾き(重力の向き)と、振り
  useEffect(() => {
    let lastShake = 0;
    let lastG: Vec = { x: 0, y: 1 };
    const rad = Math.PI / 180;
    const onOrient = (e: DeviceOrientationEvent) => {
      if (e.beta === null || e.gamma === null) return;
      // 縦持ち: 左右の傾き(gamma)で横に、前後の傾き(beta)で縦に重力がかかる
      const g = { x: Math.sin(e.gamma * rad), y: Math.sin(e.beta * rad) };
      setHasSensors(true);
      if (Math.hypot(g.x - lastG.x, g.y - lastG.y) > 0.12) {
        lastG = g;
        if (worldRef.current) wakeAll(worldRef.current);
      }
      gravityRef.current = g;
    };
    const onMotion = (e: DeviceMotionEvent) => {
      const a = e.acceleration;
      if (!a || a.x === null || a.y === null) return;
      const m = Math.hypot(a.x, a.y, a.z ?? 0);
      const now = performance.now();
      if (m > SHAKE_ACCEL && now - lastShake > 400) {
        lastShake = now;
        const world = worldRef.current;
        if (world) impulseAll(world, Math.min(1100, 400 + m * 30), gravityRef.current);
        vibrate([15, 30, 15]);
      }
    };
    window.addEventListener('deviceorientation', onOrient);
    window.addEventListener('devicemotion', onMotion);
    return () => {
      window.removeEventListener('deviceorientation', onOrient);
      window.removeEventListener('devicemotion', onMotion);
    };
  }, []);

  // 指でつまむ・はじく
  const localPos = (e: ReactPointerEvent) => {
    const r = boxRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const world = worldRef.current;
    if (!world || heldRef.current) return;
    const { x, y } = localPos(e);
    const body = pick(world, x, y);
    if (!body) return;
    grab(body);
    heldRef.current = { body, pointerId: e.pointerId, last: performance.now() };
    e.currentTarget.setPointerCapture(e.pointerId);
    vibrate(6);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const held = heldRef.current;
    const world = worldRef.current;
    if (!held || !world || held.pointerId !== e.pointerId) return;
    const now = performance.now();
    const { x, y } = localPos(e);
    moveHeld(world, held.body, x, y, (now - held.last) / 1000);
    held.last = now;
  };
  const onPointerEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    const held = heldRef.current;
    if (!held || held.pointerId !== e.pointerId) return;
    release(held.body);
    heldRef.current = null;
  };

  return (
    <Box
      role="dialog"
      aria-label="おもちゃ箱"
      sx={{
        position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', flexDirection: 'column',
        bgcolor: '#0c0c10', color: '#fff', animation: `${fadeIn} 200ms ease-out`,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', px: 2, pt: 'max(8px, env(safe-area-inset-top))', pb: 1 }}>
        <Typography sx={{ fontWeight: 800 }}>おもちゃ箱</Typography>
        <Typography variant="caption" sx={{ ml: 1, color: 'rgba(255,255,255,0.55)' }}>{items.length}個</Typography>
        <IconButton aria-label="閉じる" onClick={onClose} sx={{ ml: 'auto', color: '#fff' }}>
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
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, pt: 1.5, pb: 'max(14px, env(safe-area-inset-bottom))' }}>
        <Typography variant="caption" sx={{ flex: 1, color: 'rgba(255,255,255,0.6)' }}>
          {hasSensors ? '傾ける・振る・指でつまんではじく' : '指でつまんで、はじく'}
        </Typography>
        <Button
          variant="outlined"
          color="inherit"
          startIcon={<VibrationIcon />}
          onClick={shake}
          sx={{ borderRadius: 2, borderColor: 'rgba(255,255,255,0.35)', textTransform: 'none', fontWeight: 700 }}
        >
          ゆらす
        </Button>
      </Box>
    </Box>
  );
}
