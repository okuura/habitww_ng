import { useMemo, useId } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import LinearProgress from '@mui/material/LinearProgress';
import { alpha, darken, lighten } from '@mui/material/styles';
import { keyframes } from '@emotion/react';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import type { Habit, HabitCompletion } from './supabase';

interface BadgesProps {
  habits: Habit[];
  completions: HabitCompletion[];
}

const TOTAL_MILESTONES = [50, 100, 250, 500, 1000, 2000, 5000];

// Trophy: constant golden halo, with the trophy itself flaring every 2s
const trophyGlow = keyframes`
  0%, 100% { filter: brightness(1) drop-shadow(0 0 4px rgba(255, 200, 0, 0.55)); }
  50%      { filter: brightness(1.28) drop-shadow(0 0 9px rgba(255, 215, 0, 0.9)); }
`;

function toLocalDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

interface MonthBadge {
  year: number;
  month: number; // 1-12
}

interface HabitBadges {
  habit: Habit;
  perfectMonths: MonthBadge[];
  /** Current month is still unbroken — days left until the badge */
  ongoingDaysLeft: number | null;
  currentStreak: number;
  bestStreak: number;
}

function computeHabitBadges(habit: Habit, dates: Set<string>, today: Date): HabitBadges {
  const todayStr = toLocalDateString(today);

  const created = new Date(habit.created_at);
  created.setHours(0, 0, 0, 0);

  const perfectMonths: MonthBadge[] = [];
  let ongoingDaysLeft: number | null = null;

  const cursor = new Date(created.getFullYear(), created.getMonth(), 1);
  while (cursor.getFullYear() < today.getFullYear()
    || (cursor.getFullYear() === today.getFullYear() && cursor.getMonth() <= today.getMonth())) {
    const y = cursor.getFullYear();
    const m = cursor.getMonth();
    const monthEnd = new Date(y, m + 1, 0); // last day of month
    const isCurrentMonth = y === today.getFullYear() && m === today.getMonth();

    // Strict rule: every single day of the calendar month must be done.
    // A month the habit was created mid-way can never earn the medal.
    if (created > cursor) {
      cursor.setMonth(cursor.getMonth() + 1);
      continue;
    }

    const judgeStart = cursor;
    const judgeEnd = isCurrentMonth ? today : monthEnd;

    let perfect = judgeStart <= judgeEnd;
    for (const d = new Date(judgeStart); d <= judgeEnd; d.setDate(d.getDate() + 1)) {
      if (!dates.has(toLocalDateString(d))) { perfect = false; break; }
    }
    // Today itself may simply not be done yet — don't break the run for that
    if (isCurrentMonth && !perfect) {
      let perfectUntilYesterday = judgeStart < judgeEnd;
      for (const d = new Date(judgeStart); d < judgeEnd; d.setDate(d.getDate() + 1)) {
        if (!dates.has(toLocalDateString(d))) { perfectUntilYesterday = false; break; }
      }
      perfect = perfectUntilYesterday;
    }

    if (perfect) {
      if (isCurrentMonth) {
        if (judgeEnd < monthEnd || !dates.has(todayStr)) {
          ongoingDaysLeft = Math.max(
            Math.round((monthEnd.getTime() - today.getTime()) / 86400000)
              + (dates.has(todayStr) ? 0 : 1),
            1,
          );
        } else {
          perfectMonths.push({ year: y, month: m + 1 }); // last day done — badge earned
        }
      } else {
        perfectMonths.push({ year: y, month: m + 1 });
      }
    }

    cursor.setMonth(cursor.getMonth() + 1);
  }

  // Streaks: current (ending today or yesterday) and all-time best
  const sortedDates = [...dates].sort();
  let bestStreak = 0;
  let run = 0;
  let prev: string | null = null;
  for (const ds of sortedDates) {
    if (prev !== null) {
      const p = new Date(prev + 'T00:00:00');
      p.setDate(p.getDate() + 1);
      run = toLocalDateString(p) === ds ? run + 1 : 1;
    } else {
      run = 1;
    }
    if (run > bestStreak) bestStreak = run;
    prev = ds;
  }

  let currentStreak = 0;
  const cur = new Date(today);
  if (!dates.has(toLocalDateString(cur))) cur.setDate(cur.getDate() - 1); // today not done yet is OK
  while (dates.has(toLocalDateString(cur))) {
    currentStreak++;
    cur.setDate(cur.getDate() - 1);
  }

  return { habit, perfectMonths, ongoingDaysLeft, currentStreak, bestStreak };
}

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

function Medal({ color, value, unit, year, ribbonColor, ongoing }: MedalProps) {
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
// Gold cup for cumulative milestones: lip, bowl with handles, stem and
// two-tier base. A specular streak sweeps the bowl every 2s (SMIL).

function Trophy({ value, unit }: { value: string; unit: string }) {
  const gid = useId();
  const valueSize = value.length >= 4 ? 9 : value.length === 3 ? 10.5 : 12;
  const BOWL = 'M13 14 H35 V25 C35 34 30 39 24 39 C18 39 13 34 13 25 Z';

  return (
    <svg width={40} height={52} viewBox="0 0 48 62" aria-hidden focusable="false">
      <defs>
        <linearGradient id={`${gid}-g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFE082" />
          <stop offset="55%" stopColor="#E6B31E" />
          <stop offset="100%" stopColor="#8B6914" />
        </linearGradient>
        <linearGradient id={`${gid}-sh`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(255,255,255,0)" />
          <stop offset="50%" stopColor="rgba(255,255,240,0.8)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
        <clipPath id={`${gid}-cl`}>
          <path d={BOWL} />
        </clipPath>
      </defs>

      {/* Handles */}
      <path d="M13 16 C5 16 5 27 13.5 29" fill="none" stroke={`url(#${gid}-g)`} strokeWidth={3} strokeLinecap="round" />
      <path d="M35 16 C43 16 43 27 34.5 29" fill="none" stroke={`url(#${gid}-g)`} strokeWidth={3} strokeLinecap="round" />
      {/* Bowl + lip */}
      <path d={BOWL} fill={`url(#${gid}-g)`} stroke="#7A5C0E" strokeWidth={1} />
      <rect x={11} y={10} width={26} height={4.5} rx={2} fill={`url(#${gid}-g)`} stroke="#7A5C0E" strokeWidth={1} />
      {/* Gloss */}
      <ellipse cx={18.5} cy={20} rx={5.5} ry={2.8} fill="rgba(255,255,255,0.3)" transform="rotate(-22 18.5 20)" />
      {/* Stem + base */}
      <path d="M21.5 39 h5 l1.2 6.5 h-7.4 Z" fill={`url(#${gid}-g)`} stroke="#7A5C0E" strokeWidth={0.8} />
      <rect x={16} y={45.5} width={16} height={3.5} rx={1} fill={`url(#${gid}-g)`} stroke="#7A5C0E" strokeWidth={0.8} />
      <rect x={13} y={49} width={22} height={5} rx={1.5} fill={`url(#${gid}-g)`} stroke="#7A5C0E" strokeWidth={0.8} />
      {/* Value engraved on the bowl */}
      <text x={24} y={28} textAnchor="middle" fontWeight={800} fontSize={valueSize} fill="#fff">
        {value}
        <tspan fontSize={6.5} fontWeight={700}>{unit}</tspan>
      </text>
      {/* Specular sweep across the bowl, every 2s */}
      <g clipPath={`url(#${gid}-cl)`}>
        <g transform="skewX(-18)">
          <rect y={12} width={10} height={30} fill={`url(#${gid}-sh)`}>
            <animate attributeName="x" values="-20;68;68" keyTimes="0;0.45;1" dur="2s" repeatCount="indefinite" />
          </rect>
        </g>
      </g>
    </svg>
  );
}

export default function Badges({ habits, completions }: BadgesProps) {
  const habitBadges = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return habits.map(habit => {
      const dates = new Set(
        completions.filter(c => c.habit_id === habit.id).map(c => c.completed_date),
      );
      return computeHabitBadges(habit, dates, today);
    });
  }, [habits, completions]);

  const totalCount = completions.length;

  const milestones = useMemo(() => {
    const achieved = TOTAL_MILESTONES.filter(m => totalCount >= m);
    const next = TOTAL_MILESTONES.find(m => totalCount < m) ?? null;
    return { achieved, next };
  }, [totalCount]);

  const currentYear = new Date().getFullYear();

  if (habits.length === 0) return null;

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <WorkspacePremiumIcon sx={{ color: 'warning.main', fontSize: 20 }} />
        <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
          実績バッジ
        </Typography>
      </Box>

      {/* Perfect months + streaks, per habit */}
      <Stack spacing={1.75} sx={{ mb: 2.5 }}>
        {habitBadges.map(({ habit, perfectMonths, ongoingDaysLeft, currentStreak, bestStreak }) => (
          <Box key={habit.id}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75, flexWrap: 'wrap' }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: habit.color, flexShrink: 0 }} />
              <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.primary' }}>
                {habit.name}
              </Typography>
              {(currentStreak > 0 || bestStreak > 0) && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, ml: 'auto' }}>
                  <LocalFireDepartmentIcon sx={{ fontSize: 13, color: currentStreak >= bestStreak && currentStreak > 0 ? 'warning.main' : 'text.disabled' }} />
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.66rem' }}>
                    {currentStreak}日継続中
                    {bestStreak > currentStreak
                      ? `(自己ベスト ${bestStreak}日)`
                      : currentStreak > 0 ? '・自己ベスト更新中!' : ''}
                  </Typography>
                </Box>
              )}
            </Box>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 1 }}>
              {perfectMonths.map(b => (
                <Box key={`${b.year}-${b.month}`} sx={{ lineHeight: 0 }}>
                  <Medal color={habit.color} value={String(b.month)} unit="月" year={String(b.year)} />
                </Box>
              ))}

              {ongoingDaysLeft !== null && (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.25 }}>
                  <Box sx={{ lineHeight: 0 }}>
                    <Medal
                      color={habit.color}
                      value={String(new Date().getMonth() + 1)}
                      unit="月"
                      year={String(currentYear)}
                      ongoing
                    />
                  </Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.62rem', fontWeight: 600, lineHeight: 1 }}>
                    あと{ongoingDaysLeft}日
                  </Typography>
                </Box>
              )}

              {perfectMonths.length === 0 && ongoingDaysLeft === null && (
                <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.68rem' }}>
                  月の1日〜末日まで毎日実施するとメダル獲得
                </Typography>
              )}
            </Box>
          </Box>
        ))}
      </Stack>

      {/* Total milestones */}
      {totalCount > 0 && (
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75 }}>
            <EmojiEventsIcon sx={{ fontSize: 16, color: 'warning.main' }} />
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
              累計マイルストーン
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: milestones.next ? 1 : 0 }}>
            {milestones.achieved.map((m, i) => (
              <Box
                key={m}
                sx={{
                  lineHeight: 0,
                  animation: `${trophyGlow} 2s ease-in-out infinite`,
                  animationDelay: `${i * 0.3}s`,
                }}
              >
                <Trophy value={String(m)} unit="回" />
              </Box>
            ))}
          </Box>

          {milestones.next && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
              <LinearProgress
                variant="determinate"
                value={(totalCount / milestones.next) * 100}
                sx={{
                  flex: 1, height: 8, borderRadius: 4,
                  bgcolor: 'action.hover',
                  '& .MuiLinearProgress-bar': { borderRadius: 4, bgcolor: 'warning.main' },
                }}
              />
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.68rem', flexShrink: 0 }}>
                {milestones.next}回まであと{milestones.next - totalCount}回
              </Typography>
            </Box>
          )}
        </Box>
      )}
    </>
  );
}
