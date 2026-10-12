import { useMemo, useState, type MouseEvent } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import Tooltip from '@mui/material/Tooltip';
import { alpha, useTheme } from '@mui/material/styles';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import CheckIcon from '@mui/icons-material/Check';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import StarIcon from '@mui/icons-material/Star';
import ActivityGrid from './ActivityGrid';
import { coworkDays, coworkStreak, earliestApproved, gridStart, type CoworkGroupView, type CoworkMemberView } from './cowork';
import { addDays } from './achievements';

// グループ 1 つのカード(表示だけ。データの取得や更新は CoworkPage が行う)

const WEEKS = 12;
const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

interface Props {
  view: CoworkGroupView;
  todayStr: string;
  onApprove: (memberId: string) => void;
  onReject: (memberId: string) => void;
  onMenu: (e: MouseEvent<HTMLElement>, view: CoworkGroupView) => void;
}

/** 頭文字の丸(今日達成なら塗り、まだなら輪郭) */
function MemberDot({ m, done, size = 34 }: { m: CoworkMemberView; done: boolean; size?: number }) {
  const initial = (m.member.display_name.trim()[0] ?? '?').toUpperCase();
  return (
    <Box
      sx={{
        width: size, height: size, borderRadius: '50%', position: 'relative', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        bgcolor: done ? m.color : 'transparent',
        border: '2px solid', borderColor: done ? m.color : alpha(m.color, 0.5),
        color: done ? '#fff' : m.color, fontWeight: 800, fontSize: size * 0.42,
      }}
    >
      {initial}
      {done && (
        <Box sx={{ position: 'absolute', right: -4, bottom: -4, width: 16, height: 16, borderRadius: '50%', bgcolor: 'background.paper', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CheckIcon sx={{ fontSize: 12, color: m.color }} />
        </Box>
      )}
    </Box>
  );
}

export default function CoworkGroupCard({ view, todayStr, onApprove, onReject, onMenu }: Props) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const { group, members, pending, canApprove } = view;

  const { days, streak, grid } = useMemo(() => {
    const from = earliestApproved(members, todayStr);
    const days = coworkDays(members, from, todayStr);
    const streak = coworkStreak(days, todayStr);
    const start = gridStart(todayStr, WEEKS);
    const byDate = new Map(days.map(d => [d.date, d]));
    const grid = Array.from({ length: WEEKS }, (_, w) =>
      Array.from({ length: 7 }, (_, i) => {
        const date = addDays(start, w * 7 + i);
        return { date, day: date > todayStr ? null : byDate.get(date) ?? null };
      }));
    return { days, streak, grid };
  }, [members, todayStr]);

  const allToday = days[days.length - 1]?.all ?? false;
  const everDone = days.some(d => d.all);

  return (
    <Card
      elevation={0}
      sx={{
        border: '1px solid', borderRadius: 2,
        borderColor: allToday ? alpha(theme.palette.warning.main, 0.6) : 'divider',
        boxShadow: allToday ? `0 0 0 3px ${alpha(theme.palette.warning.main, 0.15)}` : 'none',
      }}
    >
      <CardContent sx={{ pt: 1.5, px: 2, pb: 1.5, '&:last-child': { pb: 1.5 } }}>
        {/* 見出し */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography sx={{ fontWeight: 700, flex: 1, minWidth: 0 }} noWrap>{group.name}</Typography>
          {streak.current > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, color: '#ff5722', fontWeight: 800, fontSize: '0.8rem' }}>
              <LocalFireDepartmentIcon sx={{ fontSize: 16 }} />
              みんなで {streak.current}日連続
            </Box>
          )}
          <IconButton size="small" aria-label="グループのメニュー" onClick={e => onMenu(e, view)} sx={{ color: 'text.disabled', mr: -1 }}>
            <MoreVertIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* 承認待ち(承認できる人にだけ) */}
        {canApprove && pending.map(p => (
          <Box key={p.member.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1, p: 1, borderRadius: 1.5, bgcolor: alpha(theme.palette.warning.main, 0.1) }}>
            <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>
              <strong>{p.member.display_name}</strong>({p.habitName})が参加を申請中
            </Typography>
            <Button size="small" variant="contained" onClick={() => onApprove(p.member.id)} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, minWidth: 0 }}>承認</Button>
            <Button size="small" onClick={() => onReject(p.member.id)} sx={{ borderRadius: 2, textTransform: 'none', minWidth: 0, color: 'text.secondary' }}>断る</Button>
          </Box>
        ))}

        {/* 今日の状況 */}
        <Box sx={{ display: 'flex', gap: 1.5, mt: 1.5, overflowX: 'auto', pb: 0.5, scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}>
          {members.map(m => {
            const done = m.set.has(todayStr);
            return (
              <Box key={m.member.id} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, width: 60, flexShrink: 0 }}>
                <MemberDot m={m} done={done} />
                <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, lineHeight: 1.1, maxWidth: 60 }} noWrap>{m.member.display_name}</Typography>
                <Typography sx={{ fontSize: '0.6rem', color: 'text.secondary', lineHeight: 1.1, maxWidth: 60 }} noWrap>{m.habitName}</Typography>
              </Box>
            );
          })}
          {members.length < 2 && (
            <Typography variant="caption" sx={{ color: 'text.disabled', alignSelf: 'center', ml: 0.5 }}>
              仲間を招待すると「みんなで達成」が始まります
            </Typography>
          )}
        </Box>

        {/* 12 週のグリッド: ★ 全員達成 / 一部達成は人数の割合で濃さ */}
        <Box sx={{ display: 'flex', gap: '3px', mt: 1.25 }} role="img" aria-label="みんなで達成した日">
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '3px', mr: 0.25 }}>
            {DAY_LABELS.map((d, i) => (
              <Typography key={d} sx={{ fontSize: '0.5rem', lineHeight: '11px', height: 11, color: 'text.disabled', visibility: i % 2 === 1 ? 'visible' : 'hidden' }}>{d}</Typography>
            ))}
          </Box>
          {grid.map((week, w) => (
            <Box key={w} sx={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1 }}>
              {week.map(({ date, day }) => {
                const ratio = day && day.eligible > 0 ? day.done / day.eligible : 0;
                return (
                  <Tooltip key={date} title={day ? `${date}: ${day.done}/${day.eligible}人` : ''} disableInteractive enterDelay={400}>
                    <Box
                      sx={{
                        height: 11, borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        bgcolor: day === null ? 'transparent'
                          : day.all ? theme.palette.warning.main
                          : ratio > 0 ? alpha(theme.palette.primary.main, 0.2 + 0.6 * ratio)
                          : 'action.hover',
                      }}
                    >
                      {day?.all && <StarIcon sx={{ fontSize: 9, color: '#fff' }} />}
                    </Box>
                  </Tooltip>
                );
              })}
            </Box>
          ))}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.75 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', flex: 1 }}>
            {everDone ? `みんなで達成 ${days.filter(d => d.all).length}日・最長 ${streak.best}日連続` : 'みんなで達成した日はまだありません'}
          </Typography>
          <Button
            size="small"
            onClick={() => setOpen(v => !v)}
            endIcon={<ExpandMoreIcon sx={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />}
            sx={{ textTransform: 'none', color: 'text.secondary', minWidth: 0, px: 1 }}
          >
            メンバー
          </Button>
        </Box>

        {/* 各メンバーの草グラフ */}
        <Collapse in={open} unmountOnExit>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}>
            {members.map(m => (
              <Box key={m.member.id}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: m.color }} />
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{m.member.display_name}</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>{m.habitName}・計 {m.set.size}日</Typography>
                </Box>
                <ActivityGrid completionsByDate={m.dateMap} onTimeDates={m.onTime} habitColor={m.color} />
              </Box>
            ))}
          </Box>
        </Collapse>
      </CardContent>
    </Card>
  );
}
