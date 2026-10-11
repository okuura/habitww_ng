import { useMemo, useState, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import ButtonBase from '@mui/material/ButtonBase';
import { alpha } from '@mui/material/styles';
import ScheduleIcon from '@mui/icons-material/Schedule';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import type { AchievementContext } from './achievements';
import { clock, habitTimeProfiles, timedHabitIds, timeRange, type HabitTimeProfile } from './timeStats';

// 曜日ごとの実施時刻: 習慣を 1 つ選んで、曜日ごとの点と平均、最近の傾向(週ごとの平均)を見せる

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
const PERIODS = [
  { label: '30日', days: 30 },
  { label: '90日', days: 90 },
  { label: 'すべて', days: null },
] as const;

const pct = (m: number, r: { from: number; to: number }) => Math.min(100, Math.max(0, ((m - r.from) / (r.to - r.from)) * 100));
const ticksOf = (r: { from: number; to: number; step: number }) => {
  const out: number[] = [];
  for (let m = r.from; m <= r.to; m += r.step) out.push(m);
  return out;
};

export default function HabitTimes({ ctx }: { ctx: AchievementContext }) {
  const [period, setPeriod] = useState<number>(1);
  const profiles = useMemo(() => habitTimeProfiles(ctx, PERIODS[period].days), [ctx, period]);
  const choices = useMemo(() => {
    const ids = timedHabitIds(ctx);
    return profiles.filter(p => ids.has(p.habit.id));
  }, [ctx, profiles]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (choices.length === 0) return null;
  // 最初は記録の一番多い習慣
  const selected = choices.find(p => p.habit.id === selectedId)
    ?? [...choices].sort((a, b) => b.count - a.count)[0];

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
          <ScheduleIcon sx={{ color: 'primary.main', fontSize: 20 }} />
          <Typography variant="body2" noWrap sx={{ fontWeight: 600, color: 'text.secondary' }}>曜日ごとの実施時刻</Typography>
        </Box>
        <Box sx={{ display: 'flex', bgcolor: 'action.hover', borderRadius: 5, p: '2px', flexShrink: 0 }}>
          {PERIODS.map((p, i) => (
            <ButtonBase
              key={p.label}
              onClick={() => setPeriod(i)}
              sx={{
                px: 1, py: 0.25, borderRadius: 5, fontSize: '0.68rem', fontWeight: 700,
                color: i === period ? 'text.primary' : 'text.secondary',
                bgcolor: i === period ? 'background.paper' : 'transparent',
                boxShadow: i === period ? '0 1px 3px rgba(0,0,0,0.15)' : 'none',
              }}
            >
              {p.label}
            </ButtonBase>
          ))}
        </Box>
      </Box>

      {choices.length > 1 && (
        <Box sx={{ display: 'flex', gap: 0.75, overflowX: 'auto', pb: 0.5, mb: 1.5, mx: -0.5, px: 0.5, scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}>
          {choices.map(p => {
            const on = p.habit.id === selected.habit.id;
            return (
              <ButtonBase
                key={p.habit.id}
                onClick={() => setSelectedId(p.habit.id)}
                sx={{
                  flexShrink: 0, gap: 0.5, px: 1.25, py: 0.5, borderRadius: 5, fontSize: '0.75rem', fontWeight: 700,
                  border: '1px solid', borderColor: on ? p.habit.color : 'divider',
                  bgcolor: on ? alpha(p.habit.color, 0.14) : 'transparent',
                  color: on ? 'text.primary' : 'text.secondary',
                }}
              >
                <Box sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: p.habit.color }} />
                {p.habit.name}
              </ButtonBase>
            );
          })}
        </Box>
      )}

      <Profile p={selected} />
    </>
  );
}

function Profile({ p }: { p: HabitTimeProfile }) {
  const color = p.habit.color;
  if (p.count === 0) {
    return <Typography variant="body2" sx={{ color: 'text.disabled', textAlign: 'center', py: 2 }}>この期間の記録はありません</Typography>;
  }
  const points = p.weekdays.flatMap(w => w.points);
  const range = timeRange(p.scheduled !== null ? [...points, p.scheduled] : points);
  const ticks = ticksOf(range);

  return (
    <>
      {/* まとめ */}
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
        <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>平均</Typography>
        <Typography sx={{ fontSize: '1.6rem', fontWeight: 800, lineHeight: 1.1 }}>{p.mean !== null ? clock(p.mean) : '—'}</Typography>
        <Typography sx={{ fontSize: '0.68rem', color: 'text.disabled' }}>{p.count}回の記録から</Typography>
      </Box>
      <Trend p={p} />
      {p.earliest && p.latest && (
        <Typography sx={{ fontSize: '0.78rem', mt: 0.5 }}>
          <b>{WEEKDAYS[p.earliest.day]}曜</b>が一番早く({clock(p.earliest.mean)})、<b>{WEEKDAYS[p.latest.day]}曜</b>が一番遅い({clock(p.latest.mean)})
        </Typography>
      )}

      {/* 曜日ごとの点と平均 */}
      <Box sx={{ mt: 2, position: 'relative' }}>
        {p.weekdays.map(w => {
          const isEnd = w.day === p.earliest?.day || w.day === p.latest?.day;
          return (
            <Box key={w.day} sx={{ display: 'flex', alignItems: 'center', gap: 1, height: 24 }}>
              <Typography sx={{ width: 16, fontSize: '0.7rem', fontWeight: isEnd ? 800 : 500, color: w.day === 0 ? 'error.main' : w.day === 6 ? 'info.main' : 'text.secondary', textAlign: 'center' }}>
                {WEEKDAYS[w.day]}
              </Typography>
              <Box sx={{ flex: 1, position: 'relative', height: '100%' }}>
                {/* 目盛り線 */}
                {ticks.map(t => (
                  <Box key={t} sx={{ position: 'absolute', left: `${pct(t, range)}%`, top: 0, bottom: 0, borderLeft: '1px solid', borderColor: 'divider' }} />
                ))}
                {p.scheduled !== null && (
                  <Box sx={{ position: 'absolute', left: `${pct(p.scheduled, range)}%`, top: 0, bottom: 0, borderLeft: '2px dashed', borderColor: alpha(color, 0.6) }} />
                )}
                {w.points.map((m, i) => (
                  <Box key={i} sx={{ position: 'absolute', left: `${pct(m, range)}%`, top: '50%', width: 7, height: 7, borderRadius: '50%', bgcolor: alpha(color, 0.35), transform: 'translate(-50%, -50%)' }} />
                ))}
                {w.mean !== null && (
                  <Box sx={{ position: 'absolute', left: `${pct(w.mean, range)}%`, top: 3, bottom: 3, width: 4, borderRadius: 2, bgcolor: color, transform: 'translateX(-50%)' }} />
                )}
              </Box>
              <Typography sx={{ width: 38, fontSize: '0.7rem', fontWeight: isEnd ? 800 : 600, textAlign: 'right', color: w.mean !== null ? 'text.primary' : 'text.disabled' }}>
                {w.mean !== null ? clock(w.mean) : w.points.length === 1 ? clock(w.points[0]) : '—'}
              </Typography>
            </Box>
          );
        })}
        {/* 時刻の目盛り */}
        <Box sx={{ display: 'flex', gap: 1, mt: 0.25 }}>
          <Box sx={{ width: 16 }} />
          <Box sx={{ flex: 1, position: 'relative', height: 14 }}>
            {ticks.map(t => (
              <Typography key={t} sx={{ position: 'absolute', left: `${pct(t, range)}%`, transform: 'translateX(-50%)', fontSize: '0.6rem', color: 'text.disabled', whiteSpace: 'nowrap' }}>
                {clock(t)}
              </Typography>
            ))}
          </Box>
          <Box sx={{ width: 38 }} />
        </Box>
      </Box>
      <Box sx={{ display: 'flex', gap: 1.5, mt: 0.75, flexWrap: 'wrap' }}>
        <Legend swatch={<Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: alpha(color, 0.35) }} />} label="1回の実施" />
        <Legend swatch={<Box sx={{ width: 4, height: 11, borderRadius: 2, bgcolor: color }} />} label="平均(2回以上)" />
        {p.scheduled !== null && <Legend swatch={<Box sx={{ height: 11, borderLeft: '2px dashed', borderColor: alpha(color, 0.6) }} />} label={`予定 ${clock(p.scheduled)}`} />}
      </Box>

      <WeeklyChart p={p} />
    </>
  );
}

function Legend({ swatch, label }: { swatch: ReactNode; label: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      {swatch}
      <Typography sx={{ fontSize: '0.6rem', color: 'text.secondary' }}>{label}</Typography>
    </Box>
  );
}

function Trend({ p }: { p: HabitTimeProfile }) {
  if (!p.trend) return null;
  const d = p.trend.diff;
  const flat = Math.abs(d) < 10;
  const Icon = flat ? TrendingFlatIcon : d > 0 ? TrendingUpIcon : TrendingDownIcon;
  const tone = flat ? 'text.secondary' : 'primary.main';
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <Icon sx={{ fontSize: 16, color: tone }} />
      <Typography sx={{ fontSize: '0.78rem' }}>
        {flat
          ? <>最近 30 日は、その前の 30 日と<b>ほぼ同じ</b>時刻</>
          : <>最近 30 日は、その前の 30 日より <Box component="b" sx={{ color: tone }}>{Math.abs(d)}分{d > 0 ? '遅め' : '早め'}</Box></>}
      </Typography>
    </Box>
  );
}

/** 直近 12 週の週ごとの平均。上が早い時刻、下が遅い時刻 */
function WeeklyChart({ p }: { p: HabitTimeProfile }) {
  const pts = p.weekly.filter((w): w is typeof w & { mean: number } => w.mean !== null);
  if (pts.length < 3) return null;
  const color = p.habit.color;
  const range = timeRange(pts.map(w => w.mean));
  const W = 300, H = 92, L = 34, R = 6, T = 8, B = 16;
  const x = (i: number) => L + ((W - L - R) * i) / (p.weekly.length - 1);
  const y = (m: number) => T + ((H - T - B) * pct(m, range)) / 100;
  const path = p.weekly
    .map((w, i) => (w.mean === null ? null : `${x(i).toFixed(1)},${y(w.mean).toFixed(1)}`))
    .filter(Boolean)
    .join(' ');
  const md = (ds: string) => `${Number(ds.slice(5, 7))}/${Number(ds.slice(8))}`;

  return (
    <Box sx={{ mt: 2.5 }}>
      <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: 'text.secondary', mb: 0.5 }}>
        週ごとの平均(直近12週・曜日の差はならしています)
      </Typography>
      {/* 目盛りと文字は currentColor(ライト・ダークの文字色に合わせる) */}
      <Box component="svg" sx={{ color: 'text.disabled', display: 'block' }} viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="週ごとの平均実施時刻">
        {ticksOf(range).map(t => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="currentColor" strokeOpacity={0.35} strokeWidth={1} />
            <text x={L - 4} y={y(t) + 3} fontSize={8} fill="currentColor" textAnchor="end">{clock(t)}</text>
          </g>
        ))}
        {p.scheduled !== null && p.scheduled >= range.from && p.scheduled <= range.to && (
          <line x1={L} x2={W - R} y1={y(p.scheduled)} y2={y(p.scheduled)} stroke={alpha(color, 0.6)} strokeWidth={1.5} strokeDasharray="4 3" />
        )}
        <polyline points={path} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {p.weekly.map((w, i) => w.mean !== null && (
          <circle key={w.week} cx={x(i)} cy={y(w.mean)} r={i === p.weekly.length - 1 ? 3.5 : 2.5} fill={color} />
        ))}
        <text x={x(0)} y={H - 3} fontSize={8} fill="currentColor" textAnchor="start">{md(p.weekly[0].week)}〜</text>
        <text x={x(p.weekly.length - 1)} y={H - 3} fontSize={8} fill="currentColor" textAnchor="end">今週</text>
      </Box>
    </Box>
  );
}
