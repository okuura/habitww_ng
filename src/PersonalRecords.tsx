import { useMemo, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import MilitaryTechIcon from '@mui/icons-material/MilitaryTech';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import type { AchievementContext } from './achievements';
import { compareHabits, crowns, type HabitCompare } from './compareStats';
import { personalBests } from './records';

// 自己ベスト(4 枚のタイル)と、習慣くらべ(行=指標、列=習慣の対決表。各行の一番に王冠)

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

export function HabitComparison({ ctx }: { ctx: AchievementContext }) {
  const rows = useMemo(() => compareHabits(ctx), [ctx]);
  const crown = useMemo(() => crowns(rows), [rows]);
  const dash = <Box component="span" sx={{ color: 'text.disabled' }}>—</Box>;
  const wd = (w: number | null) => (w === null ? dash : WEEKDAYS[w]);

  const metrics: { key: keyof typeof crown | 'bestWeekday' | 'worstWeekday' | 'meanTime'; label: string; cell: (r: HabitCompare) => ReactNode }[] = [
    { key: 'monthRate', label: '今月', cell: r => (r.monthRate === null ? dash : `${Math.round(r.monthRate * 100)}%`) },
    {
      key: 'momentum', label: '勢い(4週比)',
      cell: r => r.momentum === null ? dash : r.momentum === 0 ? '±0' : (
        <Box component="span" sx={{ color: r.momentum > 0 ? r.habit.color : 'text.secondary' }}>
          {r.momentum > 0 ? `▲+${r.momentum}` : `▼${r.momentum}`}
        </Box>
      ),
    },
    { key: 'recovery', label: '復帰の早さ', cell: r => (r.recovery === null ? dash : `${(Math.round(r.recovery * 10) / 10).toFixed(1)}日`) },
    { key: 'stability', label: '安定度', cell: r => (r.stability === null ? dash : '★'.repeat(r.stability)) },
    { key: 'bestWeekday', label: '得意な曜日', cell: r => wd(r.bestWeekday) },
    { key: 'worstWeekday', label: '苦手な曜日', cell: r => wd(r.worstWeekday) },
    { key: 'meanTime', label: '平均時刻', cell: r => r.meanTime ?? dash },
  ];

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <CompareArrowsIcon sx={{ color: 'primary.main', fontSize: 20 }} />
        <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary' }}>習慣くらべ</Typography>
      </Box>
      <Box
        sx={{
          overflowX: 'auto', mx: { xs: -2, sm: -3 }, px: { xs: 2, sm: 3 },
          scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' },
        }}
      >
        <Box
          component="table"
          sx={{
            borderCollapse: 'separate', borderSpacing: 0, width: '100%', minWidth: 64 + rows.length * 56,
            '& th, & td': { p: '5px 2px', textAlign: 'center', fontSize: '0.78rem', fontWeight: 600, whiteSpace: 'nowrap', minWidth: 56 },
            '& th:first-of-type, & td:first-of-type': {
              position: 'sticky', left: 0, bgcolor: 'background.paper', textAlign: 'left', width: 64, minWidth: 64, maxWidth: 64,
              fontSize: '0.62rem', fontWeight: 500, color: 'text.secondary', pl: 0,
            },
            '& tbody tr:nth-of-type(odd) td:not(:first-of-type)': { bgcolor: 'action.hover' },
            '& tbody tr td:not(:first-of-type):nth-of-type(2)': { borderRadius: '6px 0 0 6px' },
            '& tbody tr td:last-of-type': { borderRadius: '0 6px 6px 0' },
          }}
        >
          <thead>
            <tr>
              <th />
              {rows.map(r => (
                <th key={r.habit.id}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, minWidth: 0 }}>
                    <Box sx={{ width: 7, height: 7, borderRadius: '2px', bgcolor: r.habit.color, flexShrink: 0 }} />
                    <Typography noWrap sx={{ fontSize: '0.7rem', fontWeight: 700, maxWidth: 72 }}>{r.habit.name}</Typography>
                  </Box>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metrics.map(m => (
              <tr key={m.key}>
                <td>{m.label}</td>
                {rows.map(r => (
                  <td key={r.habit.id}>
                    <Box component="span" sx={{ position: 'relative', display: 'inline-block' }}>
                      {m.cell(r)}
                      {m.key in crown && crown[m.key as keyof typeof crown] === r.habit.id && (
                        <EmojiEventsIcon sx={{ position: 'absolute', top: -7, right: -13, fontSize: 12, color: 'warning.main' }} />
                      )}
                    </Box>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </Box>
      </Box>
    </>
  );
}
