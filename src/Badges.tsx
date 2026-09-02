import { useMemo, useId } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import LinearProgress from '@mui/material/LinearProgress';
import { alpha, darken, lighten } from '@mui/material/styles';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import type { Habit, HabitCompletion } from './supabase';

interface BadgesProps {
  habits: Habit[];
  completions: HabitCompletion[];
}

const TOTAL_MILESTONES = [50, 100, 250, 500, 1000, 2000, 5000];


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
// Championship cup for cumulative milestones. Polished-metal gradients with
// cylindrical shading, S-curve handles, knopped stem, tiered base with a
// plaque, a breathing golden halo behind it, and a specular sweep across
// the bowl. All animation is SMIL (works on iOS).

function Trophy({ value, unit }: { value: string; unit: string }) {
  const gid = useId();
  const valueSize = value.length >= 4 ? 9.5 : value.length === 3 ? 11 : 13;
  const BOWL = 'M14 18 H42 V27 C42 39 35.5 45 28 45 C20.5 45 14 39 14 27 Z';

  return (
    <svg width={46} height={56} viewBox="0 0 56 68" aria-hidden focusable="false">
      <defs>
        {/* Polished gold: bright crown, deep amber core, dark foot */}
        <linearGradient id={`${gid}-v`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFF8DC" />
          <stop offset="22%" stopColor="#FFD54F" />
          <stop offset="55%" stopColor="#F0A500" />
          <stop offset="82%" stopColor="#C07F0C" />
          <stop offset="100%" stopColor="#8A5C08" />
        </linearGradient>
        {/* Mirror-band for lip / base tiers (light-dark-light polish) */}
        <linearGradient id={`${gid}-h`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#9A6B0A" />
          <stop offset="22%" stopColor="#FFE082" />
          <stop offset="50%" stopColor="#FFF3C4" />
          <stop offset="78%" stopColor="#E0A81A" />
          <stop offset="100%" stopColor="#8A5C08" />
        </linearGradient>
        {/* Halo behind the cup */}
        <radialGradient id={`${gid}-halo`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(255,215,64,0.55)" />
          <stop offset="55%" stopColor="rgba(255,200,40,0.22)" />
          <stop offset="100%" stopColor="rgba(255,200,40,0)" />
        </radialGradient>
        {/* Rays fade to nothing well inside the viewBox so rotation never clips */}
        <radialGradient id={`${gid}-ray`} gradientUnits="userSpaceOnUse" cx="28" cy="32" r="26">
          <stop offset="0%" stopColor="rgba(255,223,110,0.4)" />
          <stop offset="45%" stopColor="rgba(255,210,80,0.18)" />
          <stop offset="100%" stopColor="rgba(255,210,80,0)" />
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
      <circle cx={28} cy={32} r={25} fill={`url(#${gid}-halo)`}>
        <animate
          attributeName="opacity" values="0.65;0.9;0.65" dur="5s"
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
      <g opacity={0.7}>
        <g>
          <animateTransform
            attributeName="transform" type="rotate"
            from="0 28 32" to="360 28 32" dur="36s" repeatCount="indefinite"
          />
          {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => (
            <path
              key={deg}
              d={deg % 90 === 0 ? 'M28 32 L26.6 6.5 L29.4 6.5 Z' : 'M28 32 L26.9 12.5 L29.1 12.5 Z'}
              fill={`url(#${gid}-ray)`}
              transform={`rotate(${deg} 28 32)`}
            />
          ))}
        </g>
      </g>

      {/* Handles: S-curves with a bright inner accent */}
      <path d="M14 20 C3.5 20 2.5 34 15 36.5" fill="none" stroke={`url(#${gid}-v)`} strokeWidth={3.6} strokeLinecap="round" />
      <path d="M42 20 C52.5 20 53.5 34 41 36.5" fill="none" stroke={`url(#${gid}-v)`} strokeWidth={3.6} strokeLinecap="round" />
      <path d="M14 20 C5 20 4.5 33 15 35.5" fill="none" stroke="rgba(255,248,220,0.55)" strokeWidth={1} strokeLinecap="round" />
      <path d="M42 20 C51 20 51.5 33 41 35.5" fill="none" stroke="rgba(255,248,220,0.55)" strokeWidth={1} strokeLinecap="round" />

      {/* Bowl with cylindrical shading */}
      <path d={BOWL} fill={`url(#${gid}-v)`} stroke="#7A4F00" strokeWidth={1} />
      <g clipPath={`url(#${gid}-cl)`}>
        {/* left highlight column / right shade column */}
        <path d="M17 18 h5 v27 h-5 Z" fill="rgba(255,255,255,0.32)" />
        <path d="M36 18 h5 v27 h-5 Z" fill="rgba(90,50,0,0.22)" />
        {/* inner shadow under the lip */}
        <rect x={14} y={18} width={28} height={2.5} fill="rgba(90,50,0,0.28)" />
      </g>

      {/* Lip */}
      <rect x={11.5} y={13} width={33} height={5.5} rx={2.75} fill={`url(#${gid}-h)`} stroke="#7A4F00" strokeWidth={1} />

      {/* Engraved star above the number */}
      <polygon
        points="28,21.6 29.3,24.2 32.2,24.6 30.1,26.6 30.6,29.4 28,28.1 25.4,29.4 25.9,26.6 23.8,24.6 26.7,24.2"
        fill="rgba(255,253,231,0.9)" stroke="rgba(122,79,0,0.5)" strokeWidth={0.4}
      />

      {/* Value: engraved (dark offset under white face) */}
      <text x={28} y={39.2} textAnchor="middle" fontWeight={800} fontSize={valueSize} fill="rgba(110,65,0,0.8)">
        {value}<tspan fontSize={7} fontWeight={700}>{unit}</tspan>
      </text>
      <text x={28} y={38.5} textAnchor="middle" fontWeight={800} fontSize={valueSize} fill="#FFFFFF">
        {value}<tspan fontSize={7} fontWeight={700}>{unit}</tspan>
      </text>

      {/* Knopped stem */}
      <path d="M25.5 45 h5 v2.5 h-5 Z" fill={`url(#${gid}-v)`} stroke="#7A4F00" strokeWidth={0.7} />
      <ellipse cx={28} cy={49.8} rx={4.6} ry={2.4} fill={`url(#${gid}-v)`} stroke="#7A4F00" strokeWidth={0.7} />
      <path d="M25.5 51.8 h5 v3 h-5 Z" fill={`url(#${gid}-v)`} stroke="#7A4F00" strokeWidth={0.7} />

      {/* Tiered base + plaque */}
      <path d="M19 54.8 H37 L39.5 58.8 H16.5 Z" fill={`url(#${gid}-h)`} stroke="#7A4F00" strokeWidth={0.8} />
      <rect x={13.5} y={58.8} width={29} height={6.5} rx={1.5} fill={`url(#${gid}-h)`} stroke="#7A4F00" strokeWidth={0.8} />
      <rect x={20} y={60.3} width={16} height={3.6} rx={0.8} fill="#4E342E" stroke="#3E2723" strokeWidth={0.5} />
      <rect x={21} y={61} width={14} height={0.8} rx={0.4} fill="rgba(255,235,180,0.35)" />

      {/* Gentle specular sweep across the bowl (~1.3s glide, 4s cycle) */}
      <g clipPath={`url(#${gid}-cl)`}>
        <g transform="skewX(-18)">
          <rect y={16} width={11} height={32} fill={`url(#${gid}-sw)`}>
            <animate attributeName="x" values="-22;76;76" keyTimes="0;0.33;1" dur="4s" repeatCount="indefinite" />
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
            {milestones.achieved.map(m => (
              <Box key={m} sx={{ lineHeight: 0 }}>
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
