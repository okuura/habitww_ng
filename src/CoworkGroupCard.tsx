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
import NameEmblem from './NameEmblem';
import { cheersFor, coworkDays, coworkStreak, earliestApproved, gridStart, type CoworkGroupView, type CoworkMemberView } from './cowork';
import { addDays, parse } from './achievements';

// グループ 1 つのカード(表示だけ。データの取得や更新は CoworkPage が行う)

const WEEKS = 12;
const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];
/** 7 日間の表の 1 列の幅と、丸の大きさ */
const CELL = 28;
const DOT = 22;

interface Props {
  view: CoworkGroupView;
  todayStr: string;
  onApprove: (memberId: string) => void;
  onReject: (memberId: string) => void;
  onMenu: (e: MouseEvent<HTMLElement>, view: CoworkGroupView) => void;
  /** 仲間に 👏 を送る(もう一度で取り消し)。無ければ応援の機能を出さない(テーブル未作成) */
  onCheer?: (toUserId: string) => void;
}

/** 今日届いている 👏 を「okuura👏 みき👏 +2」の形で */
function CheerLine({ cheers, myUserId }: { cheers: { fromUserId: string; name: string }[]; myUserId: string | null }) {
  if (cheers.length === 0) return null;
  // 自分が送った分は先頭に(「+N」に隠れないように)
  const ordered = [...cheers].sort((a, b) => Number(b.fromUserId === myUserId) - Number(a.fromUserId === myUserId));
  // 名前の欄は狭いので、おおよその表示幅(全角 1、半角 0.6、👏 1.6)で 8 文字分まで並べ、残りは +N
  const widthOf = (name: string) => [...name].reduce((w, ch) => w + (ch.charCodeAt(0) < 0x2e80 ? 0.6 : 1), 0) + 1.6;
  const shown: typeof ordered = [];
  let used = 0;
  for (const c of ordered) {
    const w = widthOf(c.name) + (shown.length > 0 ? 0.5 : 0);
    if (shown.length > 0 && used + w > 8) break;
    shown.push(c);
    used += w;
  }
  const rest = cheers.length - shown.length;
  return (
    <Typography component="div" sx={{ fontSize: '0.62rem', lineHeight: 1.2, color: 'text.secondary', mt: '1px' }} noWrap>
      {shown.map((c, i) => (
        <Box key={c.fromUserId} component="span" sx={{ color: c.fromUserId === myUserId ? 'warning.main' : 'inherit', fontWeight: c.fromUserId === myUserId ? 800 : 500, mr: i < shown.length - 1 || rest > 0 ? 0.5 : 0 }}>
          {c.name}👏
        </Box>
      ))}
      {rest > 0 && <Box component="span">+{rest}</Box>}
    </Typography>
  );
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

export default function CoworkGroupCard({ view, todayStr, onApprove, onReject, onMenu, onCheer }: Props) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const { group, members, pending, canApprove, mine } = view;

  const { days, streak, grid, week, byDate } = useMemo(() => {
    const from = earliestApproved(members, todayStr);
    const days = coworkDays(members, from, todayStr);
    const streak = coworkStreak(days, todayStr);
    const byDate = new Map(days.map(d => [d.date, d]));
    // 今日で終わる 7 日間
    const week = Array.from({ length: 7 }, (_, i) => {
      const date = addDays(todayStr, i - 6);
      return { date, label: DAY_LABELS[parse(date).getDay()], isToday: date === todayStr };
    });
    // これまで: グループが始まった週から今週まで(最大 WEEKS 週)。左から古い順
    const start = gridStart(todayStr, WEEKS);
    const firstWeek = Math.max(0, Math.floor((parse(from).getTime() - parse(start).getTime()) / 86400000 / 7));
    const grid = Array.from({ length: WEEKS - firstWeek }, (_, w) =>
      Array.from({ length: 7 }, (_, i) => {
        const date = addDays(start, (firstWeek + w) * 7 + i);
        return { date, day: date > todayStr ? null : byDate.get(date) ?? null };
      }));
    return { days, streak, grid, week, byDate };
  }, [members, todayStr]);

  const today = days[days.length - 1];
  const allToday = today?.all ?? false;
  const everDone = days.some(d => d.all);
  // 今日のひとこと: 自分がまだなら背中を押し、自分が済んでいれば仲間を待つ
  const myDone = mine ? members.find(m => m.member.id === mine.id)?.set.has(todayStr) ?? true : true;
  const left = today ? today.eligible - today.done : 0;
  const myUserId = mine?.user_id ?? null;
  const sentAny = myUserId !== null && view.cheers.some(c => c.from_user_id === myUserId);
  const cheerHint = onCheer && members.length >= 2 && !sentAny ? '仲間の行をタップすると 👏 を送れます' : null;
  const cheer = allToday
    ? (streak.current >= 2 ? `今日もみんなで達成！${streak.current}日連続` : '今日はみんなで達成！')
    : !myDone && left === 1 ? 'あとはあなただけ！やれば今日は全員達成'
    : !myDone ? `今日はあと ${left}人。まずはあなたから`
    : left === 1 ? 'あと 1人！声をかけてみよう'
    : `あと ${left}人。先に済ませて待とう`;

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
            <Typography component="div" variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>
              <strong>{p.member.display_name}</strong><NameEmblem id={p.member.emblem} size={14} />({p.habitName})が参加を申請中
            </Typography>
            <Button size="small" variant="contained" onClick={() => onApprove(p.member.id)} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, minWidth: 0 }}>承認</Button>
            <Button size="small" onClick={() => onReject(p.member.id)} sx={{ borderRadius: 2, textTransform: 'none', minWidth: 0, color: 'text.secondary' }}>断る</Button>
          </Box>
        ))}

        {/* この 7 日間: 行がメンバー、列が日。誰がやったかが一目で分かり、今日の列で「あと何人」が見える */}
        <Box sx={{ mt: 1.5, display: 'grid', gridTemplateColumns: `minmax(0, 1fr) repeat(7, ${CELL}px)`, columnGap: '2px', rowGap: '6px', alignItems: 'center' }} role="table" aria-label="この 7 日間のみんなの記録">
          {/* 曜日の見出し */}
          <Box />
          {week.map(({ date, label, isToday }) => (
            <Typography key={date} sx={{ textAlign: 'center', fontSize: '0.62rem', fontWeight: isToday ? 800 : 600, color: isToday ? 'warning.main' : 'text.disabled', lineHeight: 1 }}>
              {isToday ? '今日' : label}
            </Typography>
          ))}

          {members.map(m => {
            const doneToday = m.set.has(todayStr);
            const isMe = m.member.user_id === myUserId;
            const cheerable = !!onCheer && !isMe;
            const received = onCheer ? cheersFor(view, m.member.user_id) : [];
            return (
              <Box key={m.member.id} sx={{ display: 'contents' }}>
                <Box
                  role={cheerable ? 'button' : undefined}
                  tabIndex={cheerable ? 0 : undefined}
                  aria-label={cheerable ? `${m.member.display_name} に 👏 を送る` : undefined}
                  onClick={cheerable ? () => onCheer!(m.member.user_id) : undefined}
                  onKeyDown={cheerable ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onCheer!(m.member.user_id); } } : undefined}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0, pr: 0.5, py: 0.25, pl: 0.25, ml: -0.25, borderRadius: 1.5,
                    cursor: cheerable ? 'pointer' : 'default', userSelect: 'none', WebkitTapHighlightColor: 'transparent',
                    transition: 'transform .12s, background-color .12s',
                    '&:active': cheerable ? { transform: 'scale(0.96)', bgcolor: 'action.hover' } : undefined,
                  }}
                >
                  <MemberDot m={m} done={doneToday} size={26} />
                  <Box sx={{ minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
                      <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, lineHeight: 1.15, minWidth: 0 }} noWrap>{m.member.display_name}</Typography>
                      <NameEmblem id={m.member.emblem} size={12} />
                    </Box>
                    <Typography sx={{ fontSize: '0.6rem', color: 'text.secondary', lineHeight: 1.15 }} noWrap>{m.habitName}</Typography>
                    <CheerLine cheers={received} myUserId={myUserId} />
                  </Box>
                </Box>
                {week.map(({ date, isToday }) => {
                  const eligible = m.approvedDate !== null && m.approvedDate <= date;
                  const done = m.set.has(date);
                  return (
                    <Box key={date} sx={{ display: 'flex', justifyContent: 'center', bgcolor: isToday ? alpha(theme.palette.warning.main, 0.08) : 'transparent', py: '3px', borderRadius: 1 }}>
                      <Box
                        aria-label={`${date} ${m.member.display_name}: ${done ? '達成' : eligible ? '未達成' : '参加前'}`}
                        sx={{
                          width: DOT, height: DOT, borderRadius: '50%',
                          bgcolor: done ? m.color : 'transparent',
                          border: done ? 'none' : eligible ? `1.5px ${isToday ? 'dashed' : 'solid'} ${alpha(m.color, isToday ? 0.7 : 0.25)}` : 'none',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          boxShadow: done && isToday ? `0 0 0 2px ${alpha(m.color, 0.25)}` : 'none',
                        }}
                      >
                        {done && <CheckIcon sx={{ fontSize: 12, color: '#fff' }} />}
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            );
          })}

          {/* みんなで: 全員達成の日は ★ */}
          {members.length >= 2 && (
            <>
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 800, color: 'text.secondary', pl: 0.25 }}>みんなで</Typography>
              {week.map(({ date, isToday }) => {
                const d = byDate.get(date);
                return (
                  <Box key={date} sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: DOT + 6, bgcolor: isToday ? alpha(theme.palette.warning.main, 0.08) : 'transparent', borderRadius: 1 }}>
                    {d?.all
                      ? <StarIcon sx={{ fontSize: 20, color: theme.palette.warning.main, filter: `drop-shadow(0 0 4px ${alpha(theme.palette.warning.main, 0.6)})` }} />
                      : d && d.eligible >= 2
                        ? <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: isToday ? 'warning.main' : 'text.disabled', lineHeight: 1 }}>{d.done}/{d.eligible}</Typography>
                        : null}
                  </Box>
                );
              })}
            </>
          )}
        </Box>

        {members.length < 2 && (
          <Typography variant="caption" sx={{ display: 'block', color: 'text.disabled', mt: 1 }}>
            仲間を招待すると「みんなで達成」が始まります
          </Typography>
        )}

        {/* 今日のひとこと */}
        {members.length >= 2 && (
          <Box
            sx={{
              mt: 1.25, px: 1.25, py: 0.75, borderRadius: 1.5,
              bgcolor: alpha(theme.palette.warning.main, allToday ? 0.16 : 0.08),
              display: 'flex', alignItems: 'center', gap: 0.75,
            }}
          >
            {allToday ? <StarIcon sx={{ fontSize: 18, color: theme.palette.warning.main }} /> : <LocalFireDepartmentIcon sx={{ fontSize: 18, color: alpha(theme.palette.warning.main, 0.8) }} />}
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, flex: 1, minWidth: 0 }}>{cheer}</Typography>
          </Box>
        )}

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', flex: 1, minWidth: 0 }} noWrap>
            {cheerHint ?? (everDone
              ? `みんなで達成 ${days.filter(d => d.all).length}日・最長 ${streak.best}日連続`
              : members.length >= 2 ? '全員がやった日に ★ が付きます' : '')}
          </Typography>
          <Button
            size="small"
            onClick={() => setOpen(v => !v)}
            endIcon={<ExpandMoreIcon sx={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />}
            sx={{ textTransform: 'none', color: 'text.secondary', minWidth: 0, px: 1 }}
          >
            これまで
          </Button>
        </Box>

        {/* これまで: みんなで達成した日のグリッド(グループが始まった週から)と、各メンバーの草グラフ */}
        <Collapse in={open} unmountOnExit>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}>
            {members.length >= 2 && grid.length > 0 && (
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 0.5 }}>みんなで達成した日</Typography>
                <Box sx={{ display: 'flex', gap: '3px' }} role="img" aria-label="みんなで達成した日">
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: '3px', mr: 0.25 }}>
                    {DAY_LABELS.map((d, i) => (
                      <Typography key={d} sx={{ fontSize: '0.5rem', lineHeight: '13px', height: 13, color: 'text.disabled', visibility: i % 2 === 1 ? 'visible' : 'hidden' }}>{d}</Typography>
                    ))}
                  </Box>
                  {grid.map((wk, w) => (
                    <Box key={w} sx={{ display: 'flex', flexDirection: 'column', gap: '3px', width: 13 }}>
                      {wk.map(({ date, day }) => (
                        <Tooltip key={date} title={day ? `${date}: ${day.done}/${day.eligible}人` : ''} disableInteractive enterDelay={400}>
                          <Box
                            sx={{
                              height: 13, borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              bgcolor: day === null ? 'transparent'
                                : day.all ? theme.palette.warning.main
                                : day.done > 0 ? alpha(theme.palette.text.primary, 0.08 + 0.22 * (day.done / Math.max(1, day.eligible)))
                                : 'action.hover',
                            }}
                          >
                            {day?.all && <StarIcon sx={{ fontSize: 10, color: '#fff' }} />}
                          </Box>
                        </Tooltip>
                      ))}
                    </Box>
                  ))}
                </Box>
              </Box>
            )}
            {members.map(m => (
              <Box key={m.member.id}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: m.color }} />
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{m.member.display_name}</Typography>
                  <NameEmblem id={m.member.emblem} size={16} />
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
