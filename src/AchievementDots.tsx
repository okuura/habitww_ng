import { useMemo, useRef, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import GlobalStyles from '@mui/material/GlobalStyles';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import { keyframes } from '@emotion/react';
import type { Habit, HabitCompletion } from './supabase';
// Party fonts: heavy display gothic + rounded pop. Both ship as unicode-range
// subsets, so only the glyph ranges actually rendered get downloaded.
import '@fontsource/dela-gothic-one';
import '@fontsource/mochiy-pop-one';

interface AchievementDotsProps {
  habits: Habit[];
  completions: HabitCompletion[];
}

const DOT_PX = 7;
const DOT_GAP = 2;
const PITCH = DOT_PX + DOT_GAP;
const STAGGER_MAX = 400;
const STAGGER_TOTAL_MS = 600;
const COMPRESS_THRESHOLD = 1000;

const RAINBOW = 'linear-gradient(90deg, #ff5f6d, #ffc371, #f9f871, #7cf29c, #5ad1ff, #a18cff, #ff7ad9, #ff5f6d)';

const rainbowShift = keyframes`
  0%   { background-position: 0% 50%; }
  100% { background-position: 300% 50%; }
`;

// One animated filter on the container makes every dot's hue rotate in
// lockstep — the cheapest way to sweep a rainbow across hundreds of dots.
const hueSpin = keyframes`
  from { filter: hue-rotate(0deg); }
  to   { filter: hue-rotate(360deg); }
`;

// --- Cheer motion patterns (picked at random per popup) ------------------
// All use --rot (tilt) and --dx (sideways drift) custom properties.
const cheerFloat = keyframes`
  0%   { transform: translate(-50%, 0) scale(0.4) rotate(var(--rot)); opacity: 0; }
  15%  { transform: translate(-50%, -10px) scale(1.18) rotate(var(--rot)); opacity: 1; }
  30%  { transform: translate(-50%, -16px) scale(1) rotate(var(--rot)); opacity: 1; }
  100% { transform: translate(calc(-50% + var(--dx)), -80px) scale(1) rotate(var(--rot)); opacity: 0; }
`;
const cheerPop = keyframes`
  0%   { transform: translate(-50%, 0) scale(0); opacity: 0; }
  20%  { transform: translate(-50%, 0) scale(1.45) rotate(var(--rot)); opacity: 1; }
  35%  { transform: translate(-50%, 0) scale(0.9) rotate(calc(var(--rot) * -1)); }
  50%  { transform: translate(-50%, 0) scale(1.1) rotate(var(--rot)); }
  80%  { transform: translate(-50%, -6px) scale(1) rotate(0deg); opacity: 1; }
  100% { transform: translate(-50%, -14px) scale(0.6); opacity: 0; }
`;
const cheerRocket = keyframes`
  0%   { transform: translate(-50%, 40px) scale(0.6) rotate(var(--rot)); opacity: 0; }
  10%  { opacity: 1; }
  60%  { transform: translate(calc(-50% + var(--dx)), -70px) scale(1.15) rotate(var(--rot)); opacity: 1; }
  100% { transform: translate(calc(-50% + var(--dx) * 1.5), -120px) scale(1.2) rotate(var(--rot)); opacity: 0; }
`;
const cheerArc = keyframes`
  0%   { transform: translate(-50%, 0) scale(0.5) rotate(0deg); opacity: 0; }
  20%  { transform: translate(calc(-50% + var(--dx) * 0.4), -30px) scale(1.2) rotate(var(--rot)); opacity: 1; }
  60%  { transform: translate(calc(-50% + var(--dx)), -40px) scale(1) rotate(calc(var(--rot) * 2)); opacity: 1; }
  100% { transform: translate(calc(-50% + var(--dx) * 1.4), 10px) scale(0.9) rotate(calc(var(--rot) * 3)); opacity: 0; }
`;
const cheerSpin = keyframes`
  0%   { transform: translate(-50%, 0) scale(0.2) rotate(-180deg); opacity: 0; }
  35%  { transform: translate(-50%, -12px) scale(1.3) rotate(10deg); opacity: 1; }
  55%  { transform: translate(-50%, -16px) scale(1) rotate(-6deg); }
  100% { transform: translate(-50%, -50px) scale(1) rotate(360deg); opacity: 0; }
`;
const cheerBoom = keyframes`
  0%   { transform: translate(-50%, 0) scale(2.6) rotate(var(--rot)); opacity: 0; filter: blur(2px); }
  25%  { transform: translate(-50%, 0) scale(1) rotate(0deg); opacity: 1; filter: blur(0); }
  40%  { transform: translate(-50%, 0) scale(1.15) rotate(0deg); }
  75%  { transform: translate(-50%, 0) scale(1) rotate(0deg); opacity: 1; }
  100% { transform: translate(-50%, -20px) scale(1.2) rotate(0deg); opacity: 0; }
`;
const cheerJelly = keyframes`
  0%   { transform: translate(-50%, 0) scale(0.6, 1.4); opacity: 0; }
  15%  { transform: translate(-50%, 0) scale(1.35, 0.75); opacity: 1; }
  30%  { transform: translate(-50%, 0) scale(0.85, 1.2); }
  45%  { transform: translate(-50%, 0) scale(1.12, 0.92); }
  60%  { transform: translate(-50%, 0) scale(0.97, 1.05); }
  75%  { transform: translate(-50%, 0) scale(1, 1); opacity: 1; }
  100% { transform: translate(-50%, -30px) scale(1, 1); opacity: 0; }
`;
const cheerDrop = keyframes`
  0%   { transform: translate(-50%, -70px) scale(0.8) rotate(var(--rot)); opacity: 0; }
  35%  { transform: translate(-50%, 8px) scale(1.1, 0.85) rotate(0deg); opacity: 1; }
  50%  { transform: translate(-50%, -14px) scale(0.95, 1.1) rotate(0deg); }
  65%  { transform: translate(-50%, 0) scale(1.05, 0.95) rotate(0deg); }
  80%  { transform: translate(-50%, -4px) scale(1) rotate(0deg); opacity: 1; }
  100% { transform: translate(calc(-50% + var(--dx)), -4px) scale(1) rotate(var(--rot)); opacity: 0; }
`;
const CHEER_PATTERNS = [
  { kf: cheerFloat,  ms: 1700 },
  { kf: cheerPop,    ms: 1500 },
  { kf: cheerRocket, ms: 1400 },
  { kf: cheerArc,    ms: 1800 },
  { kf: cheerSpin,   ms: 1600 },
  { kf: cheerBoom,   ms: 1500 },
  { kf: cheerJelly,  ms: 1600 },
  { kf: cheerDrop,   ms: 1700 },
];

const CHEER_WORDS = ['よくやった！', 'がんばった！', 'すごい！', 'えらい！', 'その調子！', '最高！', '継続は力！', '天才！', 'ナイス！', 'やるじゃん！', 'ブラボー！', 'キタ！', '神！', 'つよい！'];
const CHEER_EMOJI = [
  '🎉', '👏', '🔥', '✨', '💪', '🏆', '🌈', '⭐', '🎊', '🙌', '💯', '🚀', '🥳', '👑',
  '🕺', '💃', '🎈', '🎺', '🥁', '🎸', '🤩', '😆', '👍', '🎂', '🥇', '🏅', '🦄', '🍻',
  '🐱', '🐶', '🎯', '🌟', '💫', '🎵', '🕶️', '😎',
];
const CHEER_COLORS = ['#ff5f6d', '#ffb347', '#7cf29c', '#5ad1ff', '#a18cff', '#ff7ad9', '#f9d423'];
const CHEER_FONTS = [
  '"Dela Gothic One", "Hiragino Sans", "Noto Sans JP", sans-serif',
  '"Mochiy Pop One", "Hiragino Maru Gothic ProN", "Noto Sans JP", sans-serif',
];

const danceWiggle = keyframes`
  0%, 100% { transform: rotate(-12deg) scale(1); }
  25%      { transform: rotate(10deg) scale(1.12); }
  50%      { transform: rotate(-8deg) scale(1); }
  75%      { transform: rotate(12deg) scale(1.12); }
`;
const CHEER_INTERVAL_MS = 140;   // near-continuous gush
const CHEER_BURST_CHANCE = 0.5;  // half the ticks fire 4–7 at once
const CHEER_EMOJI_RATIO = 0.55;
const CHEER_GIANT_CHANCE = 0.1;  // occasional huge one
const CHEER_OPENING_BURST = 14;  // party starts with a salvo
const CHEER_MAX = 24;

function toLocalDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

interface Cheer {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  rot: number;
  dx: number;
  size: number;
  emoji: boolean;
  pattern: number;
  font: string;
}

// Words of praise and party emoji popping up at random spots, for as long
// as the card is on screen.
function CheerPopups() {
  const [items, setItems] = useState<Cheer[]>([]);

  useEffect(() => {
    let nextId = 0;
    const spawnOne = () => {
      const emoji = Math.random() < CHEER_EMOJI_RATIO;
      const pool = emoji ? CHEER_EMOJI : CHEER_WORDS;
      const pattern = Math.floor(Math.random() * CHEER_PATTERNS.length);
      // Sizes range from small confetti-like to the occasional giant
      const size = Math.random() < CHEER_GIANT_CHANCE
        ? 1.7 + Math.random() * 0.4
        : 0.65 + Math.random() * 0.85;
      const item: Cheer = {
        id: nextId++,
        x: 5 + Math.random() * 90,
        y: 5 + Math.random() * 88,
        text: pool[Math.floor(Math.random() * pool.length)],
        color: CHEER_COLORS[Math.floor(Math.random() * CHEER_COLORS.length)],
        rot: (Math.random() - 0.5) * 34,
        dx: (Math.random() - 0.5) * 120,
        size,
        emoji,
        pattern,
        font: CHEER_FONTS[Math.floor(Math.random() * CHEER_FONTS.length)],
      };
      setItems(prev => [...prev.slice(-(CHEER_MAX - 1)), item]);
      setTimeout(() => setItems(prev => prev.filter(p => p.id !== item.id)), CHEER_PATTERNS[pattern].ms);
    };
    const spawn = () => {
      // One or two; half the time a burst of 4–7 in quick succession
      const n = Math.random() < CHEER_BURST_CHANCE ? 4 + Math.floor(Math.random() * 4) : 1 + Math.floor(Math.random() * 2);
      for (let i = 0; i < n; i++) setTimeout(spawnOne, i * 40);
    };
    // Opening salvo, then the steady gush
    const opening: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i < CHEER_OPENING_BURST; i++) opening.push(setTimeout(spawnOne, 60 + i * 45));
    const timer = setInterval(spawn, CHEER_INTERVAL_MS);
    return () => { opening.forEach(clearTimeout); clearInterval(timer); };
  }, []);

  return (
    <Box sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible', zIndex: 5 }}>
      {items.map(it => (
        <Box
          key={it.id}
          sx={{
            position: 'absolute',
            left: `${it.x}%`,
            top: `${it.y}%`,
            '--rot': `${it.rot}deg`,
            '--dx': `${it.dx}px`,
            fontFamily: it.emoji ? undefined : it.font,
            fontWeight: 400, // display faces carry their own weight
            fontSize: `${(it.emoji ? 1.7 : 1.05) * it.size}rem`,
            lineHeight: 1,
            letterSpacing: it.emoji ? 0 : '0.02em',
            color: it.color,
            WebkitTextStroke: it.emoji ? undefined : '1.2px rgba(0,0,0,0.55)',
            paintOrder: 'stroke fill',
            textShadow: it.emoji
              ? '0 2px 6px rgba(0,0,0,0.25)'
              : '0 2px 0 rgba(0,0,0,0.35), 0 0 12px rgba(255,255,255,0.45)',
            whiteSpace: 'nowrap',
            animation: `${CHEER_PATTERNS[it.pattern].kf} ${CHEER_PATTERNS[it.pattern].ms}ms cubic-bezier(0.2, 0.8, 0.3, 1) forwards`,
            willChange: 'transform, opacity',
          } as object}
        >
          {it.text}
        </Box>
      ))}
    </Box>
  );
}

export default function AchievementDots({ habits, completions }: AchievementDotsProps) {
  const todayStr = toLocalDateString(new Date());
  const gridRef = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(40);
  const [party, setParty] = useState(false);

  // Dots per row, so each row can carry the same left→right rainbow
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const update = () => setCols(Math.max(1, Math.floor((el.clientWidth + DOT_GAP) / PITCH)));
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const sorted = useMemo(() =>
    [...completions].sort((a, b) => {
      const d = a.completed_date.localeCompare(b.completed_date);
      return d !== 0 ? d : new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    }),
    [completions],
  );

  const totalCount = sorted.length;

  const totalDays = useMemo(() => {
    if (!sorted.length) return 0;
    const first = new Date(sorted[0].completed_date + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.floor((today.getTime() - first.getTime()) / 86400000) + 1;
  }, [sorted]);

  // Gold shimmer on the day a 50-completion milestone is crossed; rainbow otherwise
  const isGoldDay = useMemo(() => {
    let run = 0;
    let latestMilestoneDate: string | null = null;
    for (const c of sorted) {
      run++;
      if (run % 50 === 0) latestMilestoneDate = c.completed_date;
    }
    return latestMilestoneDate === todayStr;
  }, [sorted, todayStr]);

  const compressRatio = totalCount > COMPRESS_THRESHOLD
    ? Math.ceil(totalCount / COMPRESS_THRESHOLD)
    : 1;

  const dots = useMemo(() => {
    const items: { key: string; globalIdx: number; habitColor: string }[] = [];
    let gi = 0;
    for (const habit of habits) {
      const n = Math.ceil(sorted.filter(c => c.habit_id === habit.id).length / compressRatio);
      for (let i = 0; i < n; i++) {
        items.push({ key: `${habit.id}-${i}`, globalIdx: gi, habitColor: habit.color });
        gi++;
      }
    }
    return items;
  }, [habits, sorted, compressRatio]);

  const shouldStagger = dots.length <= STAGGER_MAX;
  const delayPerDot = shouldStagger ? Math.min(STAGGER_TOTAL_MS / Math.max(dots.length, 1), 8) : 0;

  const legend = useMemo(() =>
    habits
      .map(h => ({ habit: h, count: completions.filter(c => c.habit_id === h.id).length }))
      .filter(l => l.count > 0),
    [habits, completions],
  );

  if (totalCount === 0) return null;

  // Numbers: brand color normally, flowing rainbow while the party is on
  const numberSx = party
    ? {
        fontWeight: 900,
        lineHeight: 1.1,
        background: RAINBOW,
        backgroundSize: '300% 100%',
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        color: 'transparent',
        animation: `${rainbowShift} 3s linear infinite`,
      } as const
    : { fontWeight: 800, color: 'primary.main', lineHeight: 1.1 } as const;

  return (
    <Box sx={{ position: 'relative' }}>
      <GlobalStyles styles={{
        '@keyframes achieveDotIn': {
          from: { opacity: 0, transform: 'scale(0.3)' },
          to:   { opacity: 1, transform: 'scale(1)' },
        },
        '@keyframes achieveGoldGlow': {
          '0%, 100%': { filter: 'brightness(1) saturate(1.2)' },
          '50%':      { filter: 'brightness(1.5) saturate(2)' },
        },
        '@keyframes achieveDotGoldShimmer': {
          '0%':   { backgroundColor: '#8B6914', boxShadow: '0 0 0px 0px rgba(255,200,0,0)' },
          '35%':  { backgroundColor: '#FFD700', boxShadow: '0 0 4px 1px rgba(255,220,0,0.65)' },
          '55%':  { backgroundColor: '#FFF59D', boxShadow: '0 0 7px 3px rgba(255,240,120,0.9)' },
          '75%':  { backgroundColor: '#FFD700', boxShadow: '0 0 4px 1px rgba(255,220,0,0.65)' },
          '100%': { backgroundColor: '#8B6914', boxShadow: '0 0 0px 0px rgba(255,200,0,0)' },
        },
      }} />

      {party && <CheerPopups />}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <EmojiEventsIcon sx={{ color: 'warning.main', fontSize: 20 }} />
        <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
          これまでの実績
        </Typography>
        {/* Party switch: the dancing man starts / stops the cheer popups */}
        <Box
          role="button"
          aria-pressed={party}
          aria-label={party ? 'パーティーを止める' : 'パーティーを始める'}
          onClick={() => setParty(p => !p)}
          sx={{
            ml: 'auto',
            width: 36, height: 36, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.35rem', lineHeight: 1, cursor: 'pointer', userSelect: 'none',
            bgcolor: party ? 'rgba(255,200,60,0.28)' : 'action.hover',
            boxShadow: party ? '0 0 0 2px rgba(255,200,60,0.6), 0 0 14px rgba(255,200,60,0.55)' : 'none',
            transition: 'background-color 0.2s, box-shadow 0.2s',
            '& > span': {
              display: 'inline-block',
              animation: party ? `${danceWiggle} 0.45s ease-in-out infinite` : undefined,
            },
            '&:active': { transform: 'scale(0.92)' },
          }}
        >
          <span>🕺</span>
        </Box>
      </Box>

      <Box sx={{ mb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 0.5, mb: 0.5 }}>
          <Typography variant="body1" sx={{ color: 'text.primary', fontWeight: 500 }}>
            あなたは
          </Typography>
          <Typography variant="h3" sx={numberSx}>
            {totalDays}
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.primary', fontWeight: 500 }}>
            日間で
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 0.5 }}>
          <Typography variant="h3" sx={numberSx}>
            {totalCount}
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.primary', fontWeight: 500 }}>
            回の習慣を積み上げました
          </Typography>
        </Box>
      </Box>

      <Box
        ref={gridRef}
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: `${DOT_GAP}px`,
          mb: 1.5,
          animation: party
            ? `${hueSpin} 2.2s linear infinite`
            : isGoldDay
              ? 'achieveGoldGlow 2s ease-in-out infinite'
              : undefined,
        }}
      >
        {dots.map((dot, i) => {
          // Party: hue by column → every row shows the same left→right rainbow,
          // and the container's hue-rotate makes it flow sideways.
          const hue = ((dot.globalIdx % cols) / cols) * 360;
          const bg = party
            ? `hsl(${hue.toFixed(0)}, 88%, 58%)`
            : isGoldDay ? '#8B6914' : dot.habitColor;
          const shimmerDelay = dot.globalIdx * (dots.length > 1 ? 1.5 / (dots.length - 1) : 0);
          const dotSx = !party && isGoldDay
            ? { animation: `achieveDotGoldShimmer 2.2s ease-in-out ${shimmerDelay.toFixed(2)}s infinite` }
            : shouldStagger
              ? { animation: 'achieveDotIn 0.2s ease-out both', animationDelay: `${i * delayPerDot}ms` }
              : {};

          return (
            <Box
              key={dot.key}
              sx={{
                width: DOT_PX,
                height: DOT_PX,
                borderRadius: '2px',
                flexShrink: 0,
                bgcolor: bg,
                ...dotSx,
              }}
            />
          );
        })}
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {legend.map(({ habit, count }) => (
          <Box key={habit.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box
              sx={{
                width: 8, height: 8, borderRadius: '2px',
                bgcolor: habit.color, flexShrink: 0,
              }}
            />
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.68rem' }}>
              {habit.name}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.68rem' }}>
              {count}回
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
