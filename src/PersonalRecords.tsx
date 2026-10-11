import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import MilitaryTechIcon from '@mui/icons-material/MilitaryTech';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import type { Habit, HabitCompletion } from './supabase';
import type { AchievementContext } from './achievements';
import { habitStats } from './habitStats';
import { personalBests } from './records';

// 自己ベスト(4 枚のタイル)と、習慣くらべ(今月の達成率・ばっちり率・曜日のくせ)

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
const md = (ds: string) => { const [, m, d] = ds.split('-').map(Number); return `${m}/${d}`; };

function Tile({ label, value, unit, sub, color }: { label: string; value: ReactNode; unit?: string; sub?: ReactNode; color?: string }) {
  return (
    <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'action.hover', minWidth: 0 }}>
      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.66rem' }}>{label}</Typography>
      <Typography sx={{ fontWeight: 800, fontSize: '1.45rem', lineHeight: 1.2 }}>
        {value}
        {unit && <Box component="span" sx={{ fontSize: '0.75rem', fontWeight: 700, ml: 0.25 }}>{unit}</Box>}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0, mt: 0.25 }}>
        {color && <Box sx={{ width: 7, height: 7, borderRadius: '2px', bgcolor: color, flexShrink: 0 }} />}
        <Typography noWrap sx={{ fontSize: '0.62rem', color: 'text.secondary' }}>{sub ?? ' '}</Typography>
      </Box>
    </Box>
  );
}

export function PersonalBestTiles({ ctx }: { ctx: AchievementContext }) {
  const b = personalBests(ctx);
  if (!b.longestStreak) return null;
  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <MilitaryTechIcon sx={{ color: 'warning.main', fontSize: 20 }} />
        <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary' }}>自己ベスト</Typography>
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
        <Tile
          label="最長の連続" value={b.longestStreak.days} unit="日" color={b.longestStreak.habit.color}
          sub={`${b.longestStreak.habit.name}・${md(b.longestStreak.start)}〜${md(b.longestStreak.end)}`}
        />
        <Tile
          label="いま続いている" value={b.liveStreak?.days ?? 0} unit="日" color={b.liveStreak?.habit.color}
          sub={b.liveStreak ? b.liveStreak.habit.name : '今日からまた始めよう'}
        />
        <Tile
          label="一番多く実施した月" value={b.bestMonth?.count ?? 0} unit="回"
          sub={b.bestMonth ? `${b.bestMonth.year}年${b.bestMonth.month}月` : undefined}
        />
        <Tile
          label="一番早い実施" value={b.earliest ? `${b.earliest.hour}:${String(b.earliest.minute).padStart(2, '0')}` : '—'}
          color={b.earliest?.habit.color} sub={b.earliest ? `${b.earliest.habit.name}・${md(b.earliest.date)}` : '記録がまだありません'}
        />
      </Box>
    </>
  );
}

export function HabitComparison({ habits, completions }: { habits: Habit[]; completions: HabitCompletion[] }) {
  const today = new Date();
  const rows = habits.map(habit => ({ habit, stats: habitStats(habit, completions.filter(c => c.habit_id === habit.id), today) }));
  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <CompareArrowsIcon sx={{ color: 'primary.main', fontSize: 20 }} />
        <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary' }}>習慣くらべ</Typography>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75 }}>
        {rows.map(({ habit, stats }) => {
          const max = Math.max(...stats.weekdayCounts, 1);
          return (
            <Box key={habit.id}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: habit.color, flexShrink: 0 }} />
                <Typography noWrap sx={{ fontSize: '0.8rem', fontWeight: 700, flex: 1, minWidth: 0 }}>{habit.name}</Typography>
                <Typography sx={{ fontSize: '0.66rem', color: 'text.secondary', flexShrink: 0 }}>累計 {stats.totalDays}日</Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-end' }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Meter label="今月" value={stats.monthRate} color={habit.color} />
                  <Meter label="ばっちり" value={stats.bacchiriRate} color={habit.color} />
                </Box>
                {/* 曜日別の回数 */}
                <Box sx={{ display: 'flex', gap: '3px', alignItems: 'flex-end', flexShrink: 0 }} aria-label="曜日別の実施回数">
                  {stats.weekdayCounts.map((n, i) => (
                    <Box key={i} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                      <Box sx={{ width: 9, height: 28, display: 'flex', alignItems: 'flex-end', bgcolor: 'action.hover', borderRadius: '2px', overflow: 'hidden' }}>
                        <Box sx={{ width: '100%', height: `${(n / max) * 100}%`, bgcolor: n === max && n > 0 ? habit.color : alpha(habit.color, 0.45) }} />
                      </Box>
                      <Typography sx={{ fontSize: '0.5rem', color: 'text.disabled', lineHeight: 1 }}>{WEEKDAYS[i]}</Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            </Box>
          );
        })}
      </Box>
    </>
  );
}

function Meter({ label, value, color }: { label: string; value: number | null; color: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.5 }}>
      <Typography sx={{ fontSize: '0.6rem', color: 'text.secondary', width: 44, flexShrink: 0, whiteSpace: 'nowrap' }}>{label}</Typography>
      <Box sx={{ flex: 1, height: 6, borderRadius: 3, bgcolor: 'action.hover', overflow: 'hidden' }}>
        <Box sx={{ height: '100%', width: `${(value ?? 0) * 100}%`, bgcolor: color, borderRadius: 3 }} />
      </Box>
      <Typography sx={{ fontSize: '0.66rem', fontWeight: 700, width: 30, textAlign: 'right', flexShrink: 0 }}>
        {value === null ? '—' : `${Math.round(value * 100)}%`}
      </Typography>
    </Box>
  );
}
