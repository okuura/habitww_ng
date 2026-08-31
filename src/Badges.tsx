import { useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import LinearProgress from '@mui/material/LinearProgress';
import { alpha, useTheme } from '@mui/material/styles';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import MilitaryTechIcon from '@mui/icons-material/MilitaryTech';
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

  // Judge from the day the habit was created (never before it existed)
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

    const judgeStart = created > cursor ? created : cursor;
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

export default function Badges({ habits, completions }: BadgesProps) {
  const theme = useTheme();

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
  const monthLabel = (b: MonthBadge) =>
    b.year === currentYear ? `${b.month}月` : `${b.year}年${b.month}月`;

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

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
              {perfectMonths.map(b => (
                <Box
                  key={`${b.year}-${b.month}`}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 0.4,
                    px: 1, py: 0.4, borderRadius: 4,
                    bgcolor: alpha(habit.color, theme.palette.mode === 'dark' ? 0.18 : 0.1),
                    border: '1px solid', borderColor: alpha(habit.color, 0.45),
                  }}
                >
                  <WorkspacePremiumIcon sx={{ fontSize: 14, color: habit.color }} />
                  <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.68rem', color: 'text.primary', lineHeight: 1 }}>
                    {monthLabel(b)}
                  </Typography>
                </Box>
              ))}

              {ongoingDaysLeft !== null && (
                <Box
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 0.4,
                    px: 1, py: 0.4, borderRadius: 4,
                    border: '1.5px dashed', borderColor: alpha(habit.color, 0.6),
                  }}
                >
                  <WorkspacePremiumIcon sx={{ fontSize: 14, color: alpha(habit.color, 0.55) }} />
                  <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.68rem', color: 'text.secondary', lineHeight: 1 }}>
                    今月継続中・あと{ongoingDaysLeft}日
                  </Typography>
                </Box>
              )}

              {perfectMonths.length === 0 && ongoingDaysLeft === null && (
                <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.68rem' }}>
                  1か月休まず実施するとバッジ獲得
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
            <MilitaryTechIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
              累計マイルストーン
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: milestones.next ? 1 : 0 }}>
            {milestones.achieved.map(m => (
              <Box
                key={m}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 0.4,
                  px: 1, py: 0.4, borderRadius: 4,
                  bgcolor: alpha(theme.palette.warning.main, theme.palette.mode === 'dark' ? 0.2 : 0.12),
                  border: '1px solid', borderColor: alpha(theme.palette.warning.main, 0.5),
                }}
              >
                <MilitaryTechIcon sx={{ fontSize: 14, color: 'warning.main' }} />
                <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.68rem', color: 'text.primary', lineHeight: 1 }}>
                  {m}回
                </Typography>
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
