import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import FlagIcon from '@mui/icons-material/Flag';
import type { NearGoal } from './achievements';
import AchievementEmblem from './AchievementEmblem';
import { emblemColor } from './achievementIcons';

// もうすぐ取れる目標(バッジ・カードランク・今月のパーフェクト)。
// 今日実施すれば届くものは先頭に、目立たせて出す

export default function NearGoals({ goals }: { goals: NearGoal[] }) {
  if (goals.length === 0) return null;
  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <FlagIcon sx={{ color: 'primary.main', fontSize: 20 }} />
        <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
          もうすぐ取れる
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {goals.map(g => {
          const color = emblemColor(g.icon);
          return (
            <Box
              key={g.id}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1.5, p: 1.25, borderRadius: 2,
                bgcolor: g.today ? alpha(color, 0.1) : 'action.hover',
                border: '1px solid', borderColor: g.today ? alpha(color, 0.45) : 'transparent',
              }}
            >
              <AchievementEmblem badge={g} earned size={40} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography noWrap sx={{ fontSize: '0.82rem', fontWeight: 700 }}>{g.title}</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
                  {g.habit && <Box sx={{ width: 7, height: 7, borderRadius: '2px', bgcolor: g.habit.color, flexShrink: 0 }} />}
                  <Typography noWrap sx={{ fontSize: '0.66rem', color: g.today ? color : 'text.secondary', fontWeight: g.today ? 700 : 400 }}>
                    {g.today ? `${g.habit ? `${g.habit.name}を` : ''}今日やれば達成！` : g.habit?.name ?? ''}
                  </Typography>
                </Box>
                <Box sx={{ mt: 0.75, height: 4, borderRadius: 2, bgcolor: 'action.hover', overflow: 'hidden' }}>
                  <Box sx={{ height: '100%', width: `${Math.min(1, g.progress) * 100}%`, bgcolor: color, borderRadius: 2 }} />
                </Box>
              </Box>
              <Typography sx={{ flexShrink: 0, fontSize: '0.72rem', color: 'text.secondary', whiteSpace: 'nowrap' }}>
                あと<Box component="span" sx={{ fontSize: '1.3rem', fontWeight: 800, color: 'text.primary', mx: 0.25 }}>{g.remaining}</Box>{g.unit}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </>
  );
}
