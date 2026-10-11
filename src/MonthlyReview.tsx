import { useMemo, useState, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Dialog from '@mui/material/Dialog';
import ButtonBase from '@mui/material/ButtonBase';
import IconButton from '@mui/material/IconButton';
import { keyframes } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import type { AchievementContext, EvaluatedAchievement, NearGoal } from './achievements';
import { monthlyReview } from './records';
import AchievementEmblem from './AchievementEmblem';

// 月のふりかえり: 先月の記録を、1 枚ずつめくるストーリー形式で見せる。
// 月の初め(1〜7 日)は統計ページの上に大きく案内し、それ以外の日は小さな入口だけ出す

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

const rise = keyframes`
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const BACKGROUNDS = [
  'linear-gradient(160deg, #1d2b64, #5b3f9a 60%, #c94b8b)',
  'linear-gradient(160deg, #0f3443, #1f7a6d 60%, #34e89e)',
  'linear-gradient(160deg, #42275a, #734b6d)',
  'linear-gradient(160deg, #3a1c71, #d76d77 55%, #ffaf7b)',
  'linear-gradient(160deg, #141e30, #243b55 60%, #3d6a9e)',
  'linear-gradient(160deg, #232526, #414345 60%, #8e6c2e)',
];

interface Props {
  ctx: AchievementContext;
  evaluated: EvaluatedAchievement[];
  goals: NearGoal[];
}

export default function MonthlyReviewEntry({ ctx, evaluated, goals }: Props) {
  const target = new Date(ctx.today.getFullYear(), ctx.today.getMonth() - 1, 1);
  const year = target.getFullYear();
  const month = target.getMonth() + 1;
  const review = useMemo(() => monthlyReview(ctx, evaluated, year, month), [ctx, evaluated, year, month]);
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);

  if (review.total === 0) return null;
  const featured = ctx.today.getDate() <= 7;

  const slides: ReactNode[] = [
    <>
      <Typography sx={{ opacity: 0.8, fontWeight: 700, letterSpacing: '0.2em' }}>{year}</Typography>
      <Typography sx={{ fontSize: '3rem', fontWeight: 900, lineHeight: 1.1 }}>{month}月の<br />ふりかえり</Typography>
      <Typography sx={{ mt: 3, opacity: 0.75 }}>タップして進む</Typography>
    </>,
    <>
      <Typography sx={{ opacity: 0.85 }}>{month}月、あなたは</Typography>
      <Typography sx={{ fontSize: '4.5rem', fontWeight: 900, lineHeight: 1 }}>
        {review.total}<Box component="span" sx={{ fontSize: '1.5rem', ml: 0.5 }}>回</Box>
      </Typography>
      <Typography sx={{ opacity: 0.85 }}>積み上げました</Typography>
      <Typography sx={{ mt: 3, fontSize: '1.05rem' }}>
        {review.monthDays}日のうち <b>{review.activeDays}日</b> 、何かしら実施
      </Typography>
      {review.diffFromPrev !== null && (
        <Typography sx={{ mt: 1, opacity: 0.85 }}>
          {review.diffFromPrev > 0 ? `前の月より ${review.diffFromPrev}回 多い！` : review.diffFromPrev === 0 ? '前の月と同じペース' : `前の月より ${-review.diffFromPrev}回 少なめ`}
        </Typography>
      )}
    </>,
    review.best && (
      <>
        <Typography sx={{ opacity: 0.85 }}>一番がんばった習慣は</Typography>
        <Box sx={{ mt: 1.5, px: 2.5, py: 1, borderRadius: 3, bgcolor: review.best.habit.color, boxShadow: '0 8px 30px rgba(0,0,0,0.35)' }}>
          <Typography sx={{ fontSize: '1.8rem', fontWeight: 900, color: '#fff' }}>{review.best.habit.name}</Typography>
        </Box>
        <Typography sx={{ mt: 3, fontSize: '1.05rem' }}>
          <b>{review.best.count}回</b>・達成率 <b>{Math.round(review.best.rate * 100)}%</b>
        </Typography>
        {review.best.longestRun >= 2 && (
          <Typography sx={{ mt: 1, opacity: 0.85 }}>最長 {review.best.longestRun}日 続きました</Typography>
        )}
      </>
    ),
    <>
      <Typography sx={{ opacity: 0.85 }}>{month}月に取ったバッジ</Typography>
      {review.badges.length > 0 ? (
        <>
          <Typography sx={{ fontSize: '3.5rem', fontWeight: 900, lineHeight: 1.1 }}>{review.badges.length}<Box component="span" sx={{ fontSize: '1.4rem', ml: 0.5 }}>個</Box></Typography>
          <Box sx={{ mt: 2.5, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 2, maxWidth: 300 }}>
            {review.badges.slice(0, 8).map(a => (
              <Box key={a.id} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, width: 64 }}>
                <AchievementEmblem badge={a} earned size={56} />
                <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, lineHeight: 1.2 }}>{a.name}</Typography>
              </Box>
            ))}
          </Box>
        </>
      ) : (
        <Typography sx={{ mt: 2, fontSize: '1.2rem', fontWeight: 700 }}>今回はなし。<br />今月こそ 1 つ取りにいこう</Typography>
      )}
    </>,
    review.topWeekday && (
      <>
        <Typography sx={{ opacity: 0.85 }}>一番よく実施した曜日は</Typography>
        <Typography sx={{ fontSize: '4rem', fontWeight: 900, lineHeight: 1.1 }}>{WEEKDAYS[review.topWeekday.day]}曜日</Typography>
        <Typography sx={{ mt: 1, opacity: 0.85 }}>{review.topWeekday.count}回</Typography>
      </>
    ),
    <>
      <Typography sx={{ fontSize: '1.6rem', fontWeight: 900 }}>{ctx.today.getMonth() + 1}月の目標</Typography>
      {goals.length > 0 ? (
        <Box sx={{ mt: 2.5, display: 'flex', flexDirection: 'column', gap: 1.25, width: '100%', maxWidth: 320 }}>
          {goals.map(g => (
            <Box key={g.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.25, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.14)', textAlign: 'left' }}>
              <AchievementEmblem badge={g} earned size={38} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography noWrap sx={{ fontWeight: 700, fontSize: '0.85rem' }}>{g.title}</Typography>
                {g.habit && <Typography noWrap sx={{ fontSize: '0.7rem', opacity: 0.8 }}>{g.habit.name}</Typography>}
              </Box>
              <Typography sx={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>あと<b style={{ fontSize: '1.2rem' }}>{g.remaining}</b>{g.unit}</Typography>
            </Box>
          ))}
        </Box>
      ) : (
        <Typography sx={{ mt: 2, fontSize: '1.1rem' }}>今月も、一日ずつ積み上げよう</Typography>
      )}
      <Typography sx={{ mt: 3, opacity: 0.75 }}>タップで閉じる</Typography>
    </>,
  ].filter(Boolean);

  const last = slides.length - 1;
  const go = (delta: number) => {
    const next = page + delta;
    if (next > last) { setOpen(false); return; }
    setPage(Math.max(0, next));
  };

  return (
    <>
      {featured ? (
        <ButtonBase
          onClick={() => { setPage(0); setOpen(true); }}
          sx={{
            width: '100%', mb: 2, p: 2, borderRadius: 2, justifyContent: 'flex-start', gap: 1.5, textAlign: 'left', color: '#fff',
            background: BACKGROUNDS[0], boxShadow: '0 6px 20px rgba(91,63,154,0.35)',
          }}
        >
          <AutoStoriesIcon sx={{ fontSize: 32 }} />
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontWeight: 900, fontSize: '1.05rem' }}>{month}月のふりかえり</Typography>
            <Typography sx={{ fontSize: '0.75rem', opacity: 0.85 }}>{review.total}回の積み上げを振り返ろう</Typography>
          </Box>
          <ChevronRightIcon />
        </ButtonBase>
      ) : (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: -1, mb: 1.5 }}>
          <ButtonBase
            onClick={() => { setPage(0); setOpen(true); }}
            sx={{ px: 1, py: 0.5, borderRadius: 1, gap: 0.5, color: 'text.secondary', fontSize: '0.75rem' }}
          >
            <AutoStoriesIcon sx={{ fontSize: 16 }} />
            {month}月のふりかえりを見る
          </ButtonBase>
        </Box>
      )}

      <Dialog fullScreen open={open} onClose={() => setOpen(false)} PaperProps={{ sx: { background: BACKGROUNDS[page % BACKGROUNDS.length], color: '#fff', transition: 'background 400ms' } }}>
        {/* 進み具合 */}
        <Box sx={{ position: 'absolute', top: 'calc(env(safe-area-inset-top, 0px) + 10px)', left: 12, right: 12, display: 'flex', gap: 0.5, zIndex: 1 }}>
          {slides.map((_, i) => (
            <Box key={i} sx={{ flex: 1, height: 3, borderRadius: 2, bgcolor: i <= page ? '#fff' : 'rgba(255,255,255,0.3)', transition: 'background-color 200ms' }} />
          ))}
        </Box>
        <IconButton
          aria-label="閉じる"
          onClick={() => setOpen(false)}
          sx={{ position: 'absolute', top: 'calc(env(safe-area-inset-top, 0px) + 20px)', right: 8, color: '#fff', zIndex: 2 }}
        >
          <CloseIcon />
        </IconButton>

        {/* 左 3 割で戻る、残りで進む */}
        <Box
          onClick={e => {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            go(e.clientX - rect.left < rect.width * 0.3 ? -1 : 1);
          }}
          sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', userSelect: 'none', px: 3 }}
        >
          <Box
            key={page}
            sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', animation: `${rise} 450ms cubic-bezier(0.2, 0.8, 0.25, 1)` }}
          >
            {slides[page]}
          </Box>
        </Box>
      </Dialog>
    </>
  );
}
