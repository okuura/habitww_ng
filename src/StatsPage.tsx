import { useMemo } from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import { alpha, useTheme } from '@mui/material/styles';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import type { Habit, HabitCompletion } from './supabase';
import AchievementDots from './AchievementDots';
import Badges from './Badges';

interface StatsPageProps {
  habits: Habit[];
  completions: HabitCompletion[];
}

function toLocalDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const RING_RADIUS = 76;
const RING_STROKE = 16;
const SVG_PADDING = 4;
const SVG_SIZE = (RING_RADIUS + RING_STROKE / 2 + SVG_PADDING) * 2;
const CX = SVG_SIZE / 2;
const CY = SVG_SIZE / 2;
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const TIME_SLOTS = [
  { label: '深夜', range: '0〜5時', hours: new Set([0, 1, 2, 3, 4, 5]) },
  { label: '朝', range: '6〜11時', hours: new Set([6, 7, 8, 9, 10, 11]) },
  { label: '昼', range: '12〜17時', hours: new Set([12, 13, 14, 15, 16, 17]) },
  { label: '夜', range: '18〜23時', hours: new Set([18, 19, 20, 21, 22, 23]) },
];

export default function StatsPage({ habits, completions }: StatsPageProps) {
  const theme = useTheme();

  // --- This week (Sun–Sat) ring ---
  const weekData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Start of this week (Sunday)
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    // End of this week (Saturday)
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    // Collect all dates Sun–Sat (up to today for possible completions)
    const weekDates = new Set<string>();
    for (let i = 0; i <= 6; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      weekDates.add(toLocalDateString(d));
    }

    // Days elapsed this week (today counts, so dayOfWeek + 1)
    const daysElapsed = today.getDay() + 1;
    const totalPossible = habits.length * 7;
    const totalWeekDays = 7;
    if (totalPossible === 0) return { percent: 0, totalPossible: 0, totalDone: 0, perHabit: [], daysElapsed, totalWeekDays, weekStart, weekEnd };

    const perHabit = habits.map(habit => ({
      habit,
      count: completions.filter(c => c.habit_id === habit.id && weekDates.has(c.completed_date)).length,
    }));

    const totalDone = perHabit.reduce((s, h) => s + h.count, 0);
    const percent = Math.round((totalDone / totalPossible) * 100);
    return { percent, totalPossible, totalDone, perHabit, daysElapsed, totalWeekDays, weekStart, weekEnd };
  }, [habits, completions]);

  // --- Ring arc segments (rotate -90 so ring starts at top) ---
  const ringSegments = useMemo(() => {
    const { totalPossible, totalDone, perHabit } = weekData;
    if (totalPossible === 0) return [];

    const segs: { color: string; dashArray: string; dashOffset: number }[] = [];
    let cumLen = 0;

    for (const { habit, count } of perHabit) {
      if (count === 0) continue;
      const segLen = (count / totalPossible) * CIRCUMFERENCE;
      segs.push({
        color: habit.color,
        dashArray: `${segLen} ${CIRCUMFERENCE - segLen}`,
        dashOffset: -cumLen,
      });
      cumLen += segLen;
    }

    // Grey remainder
    const doneLen = (totalDone / totalPossible) * CIRCUMFERENCE;
    const remLen = CIRCUMFERENCE - doneLen;
    if (remLen > 0.5) {
      segs.push({
        color: theme.palette.mode === 'dark' ? theme.palette.grey[700] : theme.palette.grey[200],
        dashArray: `${remLen} ${CIRCUMFERENCE - remLen}`,
        dashOffset: -cumLen,
      });
    }

    return segs;
  }, [weekData, theme]);

  // --- Time of day ---
  const timeOfDay = useMemo(() => {
    const counts = TIME_SLOTS.map(slot => ({ ...slot, count: 0 }));
    for (const c of completions) {
      const hour = new Date(c.created_at).getHours();
      for (const slot of counts) {
        if (slot.hours.has(hour)) {
          slot.count++;
          break;
        }
      }
    }
    const max = Math.max(...counts.map(s => s.count), 1);
    return counts.map(s => ({ ...s, ratio: s.count / max }));
  }, [completions]);

  const peakSlot = useMemo(() => {
    if (completions.length === 0) return null;
    return timeOfDay.reduce((best, s) => s.count > best.count ? s : best, timeOfDay[0]);
  }, [timeOfDay, completions]);

  if (habits.length === 0) {
    return (
      <Container maxWidth="md" sx={{ py: { xs: 2, sm: 3 }, px: { xs: 1.5, sm: 3 } }}>
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <CalendarMonthIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1.5 }} />
          <Typography variant="body1" sx={{ color: 'text.secondary' }}>
            習慣を追加すると統計が表示されます
          </Typography>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: { xs: 1.5, sm: 3 }, px: { xs: 1.5, sm: 3 } }}>
      {/* 1. 7-day completion ring */}
      <Card
        elevation={0}
        sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, mb: 2, overflow: 'hidden' }}
      >
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary', mb: 2 }}>
            今週の完了率
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* Ring */}
            <Box sx={{ position: 'relative', width: SVG_SIZE, height: SVG_SIZE, flexShrink: 0 }}>
              <svg width={SVG_SIZE} height={SVG_SIZE}>
                {/* Background track */}
                <circle
                  cx={CX} cy={CY} r={RING_RADIUS}
                  fill="none"
                  stroke={theme.palette.mode === 'dark' ? theme.palette.grey[800] : theme.palette.grey[100]}
                  strokeWidth={RING_STROKE}
                />
                {/* Colored segments — rotate -90° so arc starts at 12 o'clock */}
                {ringSegments.map((seg, i) => (
                  <circle
                    key={i}
                    cx={CX} cy={CY} r={RING_RADIUS}
                    fill="none"
                    stroke={seg.color}
                    strokeWidth={RING_STROKE}
                    strokeDasharray={seg.dashArray}
                    strokeDashoffset={seg.dashOffset}
                    strokeLinecap="butt"
                    transform={`rotate(-90, ${CX}, ${CY})`}
                  />
                ))}
              </svg>

              {/* Center label */}
              <Box
                sx={{
                  position: 'absolute', inset: 0,
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  gap: 0,
                }}
              >
                <Typography
                  variant="h3"
                  sx={{ fontWeight: 800, lineHeight: 1, color: 'text.primary', fontSize: '2rem' }}
                >
                  {weekData.percent}%
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.25, fontSize: '0.7rem' }}>
                  今週
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.62rem' }}>
                  今週{weekData.totalDone}回 実施
                </Typography>
              </Box>
            </Box>

            {/* Legend */}
            <Box
              sx={{
                display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center', mt: 2,
                maxWidth: 360,
              }}
            >
              {weekData.perHabit.map(({ habit, count }) => (
                <Box
                  key={habit.id}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 0.75,
                    bgcolor: alpha(habit.color, count > 0 ? 0.08 : 0.04),
                    border: '1px solid',
                    borderColor: alpha(habit.color, count > 0 ? 0.25 : 0.1),
                    borderRadius: 5,
                    px: 1, py: 0.25,
                  }}
                >
                  <Box
                    sx={{
                      width: 8, height: 8, borderRadius: '2px', flexShrink: 0,
                      bgcolor: count > 0 ? habit.color : alpha(habit.color, 0.3),
                    }}
                  />
                  <Typography
                    variant="caption"
                    sx={{ color: count > 0 ? 'text.primary' : 'text.disabled', fontSize: '0.68rem', fontWeight: count > 0 ? 600 : 400 }}
                  >
                    {habit.name}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.68rem' }}>
                    {count}回
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* 2. Achievement badges — perfect months, streaks, milestones */}
      <Card
        elevation={0}
        sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, mb: 2 }}
      >
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <Badges habits={habits} completions={completions} />
        </CardContent>
      </Card>

      {/* 3. Total effort — dot visualisation */}
      <Card
        elevation={0}
        sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, mb: 2 }}
      >
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <AchievementDots habits={habits} completions={completions} />
        </CardContent>
      </Card>

      {/* 4. Time of day */}
      <Card
        elevation={0}
        sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, mb: 2 }}
      >
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AccessTimeIcon sx={{ color: 'primary.main', fontSize: 20 }} />
              <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                よく行う時間帯
              </Typography>
            </Box>
            {peakSlot && peakSlot.count > 0 && (
              <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 600 }}>
                {peakSlot.label}が最多
              </Typography>
            )}
          </Box>

          {completions.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'text.disabled', textAlign: 'center', py: 2 }}>
              記録がまだありません
            </Typography>
          ) : (
            <Stack spacing={1.25}>
              {timeOfDay.map(slot => {
                const isPeak = peakSlot?.label === slot.label && slot.count > 0;
                return (
                  <Box key={slot.label} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box sx={{ width: 52, flexShrink: 0 }}>
                      <Typography
                        variant="caption"
                        sx={{ fontWeight: isPeak ? 700 : 500, color: isPeak ? 'text.primary' : 'text.secondary', display: 'block', lineHeight: 1.2 }}
                      >
                        {slot.label}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.6rem' }}>
                        {slot.range}
                      </Typography>
                    </Box>

                    <Box
                      sx={{
                        flex: 1, height: 10, bgcolor: 'action.hover',
                        borderRadius: 1, overflow: 'hidden',
                      }}
                    >
                      <Box
                        sx={{
                          height: '100%',
                          width: `${slot.ratio * 100}%`,
                          bgcolor: isPeak ? 'primary.main' : alpha(theme.palette.primary.main, 0.45),
                          borderRadius: 1,
                          transition: theme.transitions.create('width', {
                            duration: theme.transitions.duration.standard,
                          }),
                        }}
                      />
                    </Box>

                    <Typography
                      variant="caption"
                      sx={{
                        color: isPeak ? 'text.primary' : 'text.secondary',
                        fontWeight: isPeak ? 700 : 400,
                        minWidth: 32,
                        textAlign: 'right',
                        fontSize: '0.72rem',
                      }}
                    >
                      {slot.count}回
                    </Typography>
                  </Box>
                );
              })}
            </Stack>
          )}
        </CardContent>
      </Card>
    </Container>
  );
}
