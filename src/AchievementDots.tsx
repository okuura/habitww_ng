import { useMemo, useRef } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import GlobalStyles from '@mui/material/GlobalStyles';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import type { Habit, HabitCompletion } from './supabase';

interface AchievementDotsProps {
  habits: Habit[];
  completions: HabitCompletion[];
}

const DOT_PX = 7;
const STAGGER_MAX = 400;
const STAGGER_TOTAL_MS = 600;
const COMPRESS_THRESHOLD = 1000;

function toLocalDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// djb2 hash → [0, 1)
function seededRandom(seed: string): number {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) + h) ^ seed.charCodeAt(i);
    h = h | 0;
  }
  return (Math.abs(h) % 100000) / 100000;
}

type Effect = 'normal' | 'gold' | 'rainbow';

export default function AchievementDots({ habits, completions }: AchievementDotsProps) {
  const todayStr = toLocalDateString(new Date());
  const mountSeed = useRef(Math.random().toString()).current;

  // ~20% chance per tab visit: ALL dots go gold
  const goldMode = seededRandom(mountSeed) < 0.2;

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

  const effect = useMemo<Effect>(() => {
    if (totalCount === 0) return 'normal';

    let run = 0;
    let latestMilestoneDate: string | null = null;
    for (const c of sorted) {
      run++;
      if (run % 50 === 0) latestMilestoneDate = c.completed_date;
    }
    if (latestMilestoneDate === todayStr) return 'gold';

    const r = seededRandom(todayStr + '-achiev-v1');
    if (r < 0.03) return 'gold';
    if (r < 0.05) return 'rainbow';
    return 'normal';
  }, [sorted, totalCount, todayStr]);

  const compressRatio = totalCount > COMPRESS_THRESHOLD
    ? Math.ceil(totalCount / COMPRESS_THRESHOLD)
    : 1;

  const { dots, displayTotal } = useMemo(() => {
    let total = 0;
    for (const h of habits) {
      const n = sorted.filter(c => c.habit_id === h.id).length;
      total += Math.ceil(n / compressRatio);
    }

    const items: { habitColor: string; opacity: number; globalIdx: number; key: string }[] = [];
    let gi = 0;

    for (const habit of habits) {
      const hc = sorted.filter(c => c.habit_id === habit.id);
      if (!hc.length) continue;
      const n = Math.ceil(hc.length / compressRatio);
      for (let i = 0; i < n; i++) {
        items.push({ habitColor: habit.color, opacity: 1, globalIdx: gi, key: `${habit.id}-${i}` });
        gi++;
      }
    }
    return { dots: items, displayTotal: total };
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

  const isGoldActive = goldMode || effect === 'gold';
  const containerAnimation =
    effect === 'gold'    ? 'achieveGoldGlow 2s ease-in-out infinite' :
    effect === 'rainbow' ? 'achieveRainbow 4s linear infinite'       : undefined;

  return (
    <>
      <GlobalStyles styles={{
        '@keyframes achieveDotIn': {
          from: { opacity: 0, transform: 'scale(0.3)' },
          to:   { opacity: 1, transform: 'scale(1)' },
        },
        '@keyframes achieveGoldGlow': {
          '0%, 100%': { filter: 'brightness(1) saturate(1.2)' },
          '50%':      { filter: 'brightness(1.5) saturate(2)' },
        },
        // Metallic sweep: dark antique gold → rich gold → pale highlight → back
        '@keyframes achieveDotGoldShimmer': {
          '0%':   { backgroundColor: '#8B6914', boxShadow: '0 0 0px 0px rgba(255,200,0,0)' },
          '35%':  { backgroundColor: '#FFD700', boxShadow: '0 0 4px 1px rgba(255,220,0,0.65)' },
          '55%':  { backgroundColor: '#FFF59D', boxShadow: '0 0 7px 3px rgba(255,240,120,0.9)' },
          '75%':  { backgroundColor: '#FFD700', boxShadow: '0 0 4px 1px rgba(255,220,0,0.65)' },
          '100%': { backgroundColor: '#8B6914', boxShadow: '0 0 0px 0px rgba(255,200,0,0)' },
        },
        '@keyframes achieveRainbow': {
          from: { filter: 'hue-rotate(0deg)' },
          to:   { filter: 'hue-rotate(360deg)' },
        },
      }} />

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <EmojiEventsIcon sx={{ color: 'warning.main', fontSize: 20 }} />
        <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
          これまでの実績
        </Typography>
      </Box>

      <Box sx={{ mb: 0.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 0.5, mb: 0.5 }}>
          <Typography variant="body1" sx={{ color: 'text.primary', fontWeight: 500 }}>
            あなたは
          </Typography>
          <Typography variant="h3" sx={{ fontWeight: 800, color: 'primary.main', lineHeight: 1.1 }}>
            {totalDays}
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.primary', fontWeight: 500 }}>
            日間で
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 0.5 }}>
          <Typography variant="h3" sx={{ fontWeight: 800, color: 'primary.main', lineHeight: 1.1 }}>
            {totalCount}
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.primary', fontWeight: 500 }}>
            回の習慣を積み上げました
          </Typography>
        </Box>
      </Box>

      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '2px',
          mb: 1.5,
          animation: containerAnimation,
        }}
      >
        {dots.map((dot, i) => {
          const bgColor =
            isGoldActive         ? '#8B6914' :
            effect === 'rainbow' ? `hsl(${(dot.globalIdx / Math.max(displayTotal - 1, 1)) * 360}, 80%, 55%)` :
            dot.habitColor;

          // Stagger: wave travels from dot 0 to dot N-1 as one continuous pass
          const shimmerDelay = dot.globalIdx * (dots.length > 1 ? 1.5 / (dots.length - 1) : 0);
          const dotSx = isGoldActive
            ? { animation: `achieveDotGoldShimmer 2.2s ease-in-out ${shimmerDelay.toFixed(2)}s infinite` }
            : shouldStagger
              ? { animation: 'achieveDotIn 0.2s ease-out both', animationDelay: `${i * delayPerDot}ms` }
              : {};

          return (
            <Box key={dot.key} sx={{ opacity: dot.opacity, flexShrink: 0, lineHeight: 0 }}>
              <Box
                sx={{
                  width: DOT_PX,
                  height: DOT_PX,
                  borderRadius: '2px',
                  bgcolor: bgColor,
                  ...dotSx,
                }}
              />
            </Box>
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
    </>
  );
}
