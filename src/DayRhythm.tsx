import { useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import type { AchievementContext } from './achievements';
import { dayRhythm } from './timeStats';

// 一日のリズム: 全習慣をまとめた時刻の分布(24 時間の帯)と、ひとことの気づき

const pct = (r: number) => `${Math.round(r * 100)}%`;
const hm = (m: number) => {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return h > 0 ? `${h}時間${mm > 0 ? `${mm}分` : ''}` : `${mm}分`;
};

export default function DayRhythm({ ctx }: { ctx: AchievementContext }) {
  const r = useMemo(() => dayRhythm(ctx), [ctx]);
  const max = Math.max(1, ...r.cells.map(c => c.count));

  const typeText = (() => {
    const { morning, noon, night } = r.shares;
    switch (r.type) {
      case 'morning': return ['朝型', `記録の ${pct(morning)} が 12 時まで`];
      case 'noon': return ['昼型', `記録の ${pct(noon)} が 12〜18 時`];
      case 'night': return ['夜型', `記録の ${pct(night)} が 18 時以降`];
      default: return ['まんべんなく', `朝 ${pct(morning)}・昼 ${pct(noon)}・夜 ${pct(night)}`];
    }
  })();

  const shiftText = r.weekendShift === null ? null
    : Math.abs(r.weekendShift) < 10 ? '平日と休日で、ほぼ同じ時刻に実施しています'
    : `休日は平日より ${hm(Math.abs(r.weekendShift))} ${r.weekendShift > 0 ? '遅め' : '早め'}`;

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <AccessTimeIcon sx={{ color: 'primary.main', fontSize: 20 }} />
        <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary', flex: 1 }}>一日のリズム</Typography>
        {r.golden && (
          <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 600 }}>
            {r.golden.hour}〜{r.golden.hour + 2 <= 24 ? r.golden.hour + 2 : r.golden.hour - 22}時がピーク
          </Typography>
        )}
      </Box>

      {r.total < 5 ? (
        <Typography variant="body2" sx={{ color: 'text.disabled', textAlign: 'center', py: 2 }}>
          記録がまだありません
        </Typography>
      ) : (
        <>
          <Box
            role="img"
            aria-label="時刻ごとの記録数"
            sx={{ display: 'grid', gridTemplateColumns: 'repeat(24, 1fr)', gap: '1px', height: 18, borderRadius: 1, overflow: 'hidden' }}
          >
            {r.cells.map(c => (
              <Box
                key={c.hour}
                title={`${c.hour}時台: ${c.count}回`}
                sx={{ bgcolor: c.count === 0 || !c.color ? 'action.hover' : alpha(c.color, 0.15 + 0.85 * (c.count / max)) }}
              />
            ))}
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', mt: 0.25, mb: 1.25 }}>
            {[4, 8, 12, 16, 20, 0].map(h => (
              <Typography key={h} sx={{ fontSize: '0.6rem', color: 'text.disabled', lineHeight: 1 }}>{h}</Typography>
            ))}
          </Box>
          <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', lineHeight: 1.7 }}>
            <Box component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>{typeText[0]}</Box>
            {' — '}{typeText[1]}
          </Typography>
          {shiftText && (
            <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', lineHeight: 1.7 }}>{shiftText}</Typography>
          )}
        </>
      )}
    </>
  );
}
