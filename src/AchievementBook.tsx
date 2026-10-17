import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Dialog from '@mui/material/Dialog';
import ButtonBase from '@mui/material/ButtonBase';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import Chip from '@mui/material/Chip';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import {
  CATEGORY_LABEL, TIER_LABEL, daysBetween, nextStep, seriesMembers,
  type AchievementCategory, type AchievementContext, type EvaluatedAchievement, type Tier,
} from './achievements';
import AchievementEmblem from './AchievementEmblem';
import { emblemColor, METAL } from './achievementIcons';
import { Medal } from './Badges';
import { alpha, keyframes, useTheme } from '@mui/material/styles';

// バッジ図鑑(実績ページ)。集めた数と最近のバッジ、その下にカテゴリごとの全部のバッジを並べる。
// 前回見たときから増えたバッジには NEW を付ける(見たバッジは端末に覚えておく)

const SEEN_KEY = 'habitww-seen-achievements';
/** 取りたてのメダル(月末から何日以内か)を光らせる */
const FRESH_MEDAL_DAYS = 7;

const medalGlow = keyframes`
  0%, 100% { filter: drop-shadow(0 2px 3px rgba(0,0,0,0.35)) drop-shadow(0 0 0 rgba(255,196,0,0)); }
  50% { filter: drop-shadow(0 2px 3px rgba(0,0,0,0.35)) drop-shadow(0 0 8px rgba(255,196,0,0.95)); }
`;
const TIERS: Tier[] = ['bronze', 'silver', 'gold', 'platinum'];

function readSeen(): Set<string> | null {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
}

const formatDate = (ds: string) => {
  const [y, m, d] = ds.split('-').map(Number);
  return `${y}年${m}月${d}日`;
};
const shortDate = (ds: string) => {
  const [, m, d] = ds.split('-').map(Number);
  return `${m}/${d}`;
};

interface Props {
  ctx: AchievementContext;
  achievements: EvaluatedAchievement[];
  /** おもちゃ箱を開く(取ったものが 1 つも無ければ undefined でボタンを出さない) */
  onOpenToyBox?: () => void;
}

export default function AchievementBook({ ctx, achievements, onOpenToyBox }: Props) {
  const earned = useMemo(() => achievements.filter(a => a.state.earned), [achievements]);
  const earnedKey = earned.map(a => a.id).join(',');

  // 開いた時点の「見たバッジ」と比べて NEW を決める(初めてなら全部見た扱い)
  const [seenAtOpen] = useState(readSeen);
  const newIds = useMemo(
    () => new Set(seenAtOpen ? earned.filter(a => !seenAtOpen.has(a.id)).map(a => a.id) : []),
    [earned, seenAtOpen],
  );
  useEffect(() => {
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify(earnedKey ? earnedKey.split(',') : []));
    } catch {
      // 覚えられなくても NEW が出ないだけ
    }
  }, [earnedKey]);

  // 新しいものを先に、あとは取った日の新しい順
  const recent = useMemo(
    () => [...earned]
      .sort((a, b) => Number(newIds.has(b.id)) - Number(newIds.has(a.id)) || (b.state.earnedDate ?? '').localeCompare(a.state.earnedDate ?? ''))
      .slice(0, 4),
    [earned, newIds],
  );
  // まだ 1 つも無いときは、取りやすいものを見せる
  const easiest = useMemo(
    () => achievements
      .filter(a => !a.state.earned && !a.hidden && a.state.target)
      .sort((a, b) => (b.state.current ?? 0) / b.state.target! - (a.state.current ?? 0) / a.state.target!)
      .slice(0, 4),
    [achievements],
  );

  const [selected, setSelected] = useState<EvaluatedAchievement | null>(null);

  return (
    <>
      <Header earned={earned.length} total={achievements.length} onOpenToyBox={onOpenToyBox} />
      <TierTally achievements={achievements} />

      <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mt: 2, mb: 1 }}>
        {recent.length > 0 ? '最近取ったバッジ' : '最初のバッジを取りにいこう'}
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
        {(recent.length > 0 ? recent : easiest).map(a => (
          <BadgeCell key={a.id} a={a} isNew={newIds.has(a.id)} onClick={() => setSelected(a)} caption={a.state.earnedDate ? shortDate(a.state.earnedDate) : undefined} />
        ))}
      </Box>

      <Box sx={{ borderTop: '1px solid', borderColor: 'divider', mt: 2.5 }} />
      <AllBadges ctx={ctx} achievements={achievements} newIds={newIds} onSelect={setSelected} />

      <Dialog
        open={!!selected}
        onClose={() => setSelected(null)}
        PaperProps={{ sx: { borderRadius: 4, width: 'calc(100% - 48px)', maxWidth: 340, m: 3 } }}
      >
        {selected && <Detail a={selected} all={achievements} ctx={ctx} isNew={newIds.has(selected.id)} onClose={() => setSelected(null)} />}
      </Dialog>
    </>
  );
}

function Header({ earned, total, onOpenToyBox }: { earned: number; total: number; onOpenToyBox?: () => void }) {
  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <WorkspacePremiumIcon sx={{ color: 'warning.main', fontSize: 20 }} />
        <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary', flex: 1 }}>バッジ図鑑</Typography>
        {/* おもちゃ箱: 取ったバッジとメダルで遊ぶ */}
        {onOpenToyBox && (
          <Box
            role="button"
            aria-label="おもちゃ箱"
            onClick={onOpenToyBox}
            sx={{
              display: 'flex', alignItems: 'center', gap: 0.5, height: 28, pl: 0.75, pr: 1.25, borderRadius: 999,
              fontSize: '0.75rem', fontWeight: 700, lineHeight: 1, cursor: 'pointer', userSelect: 'none',
              bgcolor: 'action.hover', color: 'text.primary',
              '&:active': { transform: 'scale(0.95)' },
            }}
          >
            <Box component="span" sx={{ fontSize: '1rem' }}>🪙</Box>
            おもちゃ箱
          </Box>
        )}
        <Typography sx={{ fontWeight: 800, fontSize: '0.95rem' }}>
          {earned}<Box component="span" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.75rem' }}> / {total}</Box>
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={(earned / total) * 100}
        sx={{ height: 6, borderRadius: 3, bgcolor: 'action.hover', mb: 1.5, '& .MuiLinearProgress-bar': { borderRadius: 3, bgcolor: 'warning.main' } }}
      />
    </>
  );
}

/** 金属ごとの集めた数(銅 3/9 のように) */
function TierTally({ achievements }: { achievements: EvaluatedAchievement[] }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0.75 }}>
      {TIERS.map(t => {
        const all = achievements.filter(a => a.tier === t);
        const got = all.filter(a => a.state.earned).length;
        const m = METAL[t];
        return (
          <Box key={t} sx={{ display: 'flex', alignItems: 'center', gap: 0.6, px: 0.75, py: 0.6, borderRadius: 1.5, bgcolor: 'action.hover', minWidth: 0 }}>
            <Box
              sx={{
                width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
                background: t === 'platinum'
                  ? `conic-gradient(${m.stops.join(', ')}, ${m.stops[0]})`
                  : `linear-gradient(135deg, ${m.stops.join(', ')})`,
                border: `1px solid ${m.dark}`, opacity: got > 0 ? 1 : 0.4,
              }}
            />
            <Typography noWrap sx={{ fontSize: '0.66rem', fontWeight: 700 }}>
              {got}<Box component="span" sx={{ color: 'text.secondary', fontWeight: 500 }}>/{all.length}</Box>
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}

function BadgeCell({ a, isNew, onClick, caption }: { a: EvaluatedAchievement; isNew: boolean; onClick: () => void; caption?: string }) {
  const { earned, current, target } = a.state;
  const secret = a.hidden && !earned;
  return (
    <ButtonBase onClick={onClick} sx={{ flexDirection: 'column', alignItems: 'center', gap: 0.75, borderRadius: 2, py: 0.75, minWidth: 0 }}>
      <Box sx={{ position: 'relative' }}>
        <AchievementEmblem badge={a} earned={earned} isNew={isNew} size={58} />
        {isNew && (
          <Box component="span" sx={{ position: 'absolute', top: -4, right: -8, px: 0.5, borderRadius: 1, bgcolor: 'error.main', color: '#fff', fontSize: '0.55rem', fontWeight: 800, lineHeight: 1.5 }}>
            NEW
          </Box>
        )}
      </Box>
      <Typography
        sx={{
          fontSize: '0.62rem', fontWeight: earned ? 700 : 500, lineHeight: 1.25, textAlign: 'center', width: '100%',
          color: earned ? 'text.primary' : 'text.secondary',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}
      >
        {secret ? '？？？' : a.name}
      </Typography>
      {caption && <Typography sx={{ fontSize: '0.56rem', color: 'text.disabled', mt: -0.5 }}>{caption}</Typography>}
      {!earned && !secret && current !== undefined && target && current > 0 && (
        <Box sx={{ width: 40, height: 3, borderRadius: 2, bgcolor: 'action.hover', overflow: 'hidden', mt: -0.25 }}>
          <Box sx={{ height: '100%', width: `${(current / target) * 100}%`, bgcolor: emblemColor(a.icon) }} />
        </Box>
      )}
    </ButtonBase>
  );
}

function AllBadges({ ctx, achievements, newIds, onSelect }: {
  ctx: AchievementContext; achievements: EvaluatedAchievement[]; newIds: Set<string>; onSelect: (a: EvaluatedAchievement) => void;
}) {
  const groups = useMemo(() => {
    const map = new Map<AchievementCategory, EvaluatedAchievement[]>();
    for (const a of achievements) {
      const list = map.get(a.category);
      if (list) list.push(a); else map.set(a.category, [a]);
    }
    return [...map.entries()];
  }, [achievements]);

  return (
    <>
      {groups.map(([category, list]) => (
        <Box key={category} sx={{ mt: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1 }}>
            <Typography sx={{ fontWeight: 800, fontSize: '0.85rem' }}>{CATEGORY_LABEL[category]}</Typography>
            <Typography variant="caption" sx={{ color: 'text.disabled' }}>
              {list.filter(a => a.state.earned).length}/{list.length}
            </Typography>
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))', gap: 1, rowGap: 1.5 }}>
            {list.map(a => <BadgeCell key={a.id} a={a} isNew={newIds.has(a.id)} onClick={() => onSelect(a)} />)}
          </Box>

          {/* 月間パーフェクトで取ったメダル(習慣ごと) */}
          {category === 'month' && <MedalCase ctx={ctx} />}
        </Box>
      ))}
    </>
  );
}

/** メダルの年間棚: 習慣ごとに 1〜12 月の 12 枠。取った月はメダル、今月は点線で「あと N日」 */
function MedalCase({ ctx }: { ctx: AchievementContext }) {
  const theme = useTheme();
  const gold = theme.palette.warning.main;
  const thisYear = ctx.today.getFullYear();
  const nowKey = thisYear * 12 + ctx.today.getMonth();
  const [year, setYear] = useState(thisYear);
  const minYear = Math.min(thisYear, ...ctx.habits.map(h => new Date(h.habit.created_at).getFullYear()));
  const years = Array.from({ length: thisYear - minYear + 1 }, (_, i) => minYear + i);
  const total = ctx.habits.reduce((n, h) => n + h.perfectMonths.length, 0);
  const rows = useMemo(
    () => ctx.habits
      .map(h => {
        const created = new Date(h.habit.created_at);
        // 月の途中で作った習慣は、その月のメダルは取れないので翌月から数える
        const createdKey = created.getFullYear() * 12 + created.getMonth() + (created.getDate() === 1 ? 0 : 1);
        return { h, createdKey, months: new Set(h.perfectMonths.filter(m => m.year === year).map(m => m.month)) };
      })
      .filter(r => r.createdKey <= year * 12 + 11)
      .sort((a, b) => b.months.size - a.months.size || a.h.habit.name.localeCompare(b.h.habit.name)),
    [ctx, year],
  );
  if (rows.length === 0) return null;
  const fresh = (y: number, m: number) => {
    const days = (ctx.today.getTime() - new Date(y, m, 0).getTime()) / 86400000;
    return days >= 0 && days <= FRESH_MEDAL_DAYS;
  };

  return (
    <Box
      sx={{
        mt: 1.5, p: 1.5, pb: 0.5, borderRadius: 2, border: '1px solid', borderColor: alpha(gold, 0.35),
        background: `linear-gradient(180deg, ${alpha(gold, 0.12)}, ${alpha(gold, 0.03)})`,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1 }}>
        <Typography sx={{ fontWeight: 800, fontSize: '0.8rem' }}>メダルケース</Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>月の1日から末日まで毎日続けた証</Typography>
        <Typography sx={{ ml: 'auto', fontWeight: 800, fontSize: '0.8rem', color: gold }}>計 {total}枚</Typography>
      </Box>
      {years.length > 1 && (
        <Box sx={{ display: 'flex', gap: 0.75, mb: 1.25, flexWrap: 'wrap' }}>
          {years.map(y => (
            <Chip
              key={y} label={`${y}年`} size="small" onClick={() => setYear(y)}
              sx={{ fontWeight: 700, fontSize: '0.7rem', bgcolor: y === year ? gold : 'action.hover', color: y === year ? '#1a1200' : 'text.secondary', '&:hover': { bgcolor: y === year ? gold : 'action.selected' } }}
            />
          ))}
        </Box>
      )}
      {rows.map(({ h, createdKey, months }) => {
        const complete = months.size === 12;
        return (
          <Box key={h.habit.id} sx={{ mb: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: h.habit.color, flexShrink: 0 }} />
              <Typography noWrap sx={{ fontSize: '0.78rem', fontWeight: 700, minWidth: 0 }}>{h.habit.name}</Typography>
              <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: complete ? gold : 'text.secondary', flexShrink: 0 }}>{months.size}/12</Typography>
              {complete && (
                <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography sx={{ fontSize: '0.62rem', fontWeight: 800, color: gold }}>年間パーフェクト</Typography>
                  <Box sx={{ lineHeight: 0, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.4))' }}>
                    <Medal color={gold} value={String(year)} unit="" ribbonColor="#c62828" size={28} shine />
                  </Box>
                </Box>
              )}
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', rowGap: 0.75, px: 0.25 }}>
              {/* 上の段(1〜6 月)が全部「作る前」なら、その段は出さない */}
              {Array.from({ length: 12 }, (_, i) => i + 1).filter(m => !(m <= 6 && year * 12 + 5 < createdKey)).map(m => {
                const key = year * 12 + (m - 1);
                const isNow = key === nowKey;
                let body: ReactNode = null;
                let caption: string | null = null;
                if (key < createdKey) {
                  body = null;
                } else if (months.has(m)) {
                  const isFresh = fresh(year, m);
                  body = (
                    <Box title={`${h.habit.name} ${year}年${m}月`} sx={{ lineHeight: 0, filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.35))', animation: isFresh ? `${medalGlow} 1.6s ease-in-out infinite` : undefined }}>
                      <Medal color={h.habit.color} value={String(m)} unit="月" year={String(year)} size={40} shine />
                    </Box>
                  );
                  if (isFresh) caption = 'NEW';
                } else if (isNow && h.ongoingDaysLeft !== null) {
                  body = <Medal color={h.habit.color} value={String(m)} unit="月" ongoing size={40} />;
                  caption = `あと${h.ongoingDaysLeft}日`;
                } else if (key <= nowKey) {
                  body = <EmptySlot month={m} strength={isNow ? 0.6 : 0.3} />;
                  if (isNow) caption = '来月から';
                } else {
                  body = <EmptySlot month={m} strength={0.15} />;
                }
                return (
                  <Box key={m} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: 60 }}>
                    {body}
                    {caption && (
                      <Typography sx={{ fontSize: '0.56rem', fontWeight: 800, lineHeight: 1, mt: '1px', color: caption === 'NEW' ? 'error.main' : h.habit.color }}>{caption}</Typography>
                    )}
                  </Box>
                );
              })}
            </Box>
            {/* 棚板 */}
            <Box sx={{ height: 4, borderRadius: 2, mt: 0.5, mx: 0.25, background: `linear-gradient(90deg, ${alpha(gold, 0.55)}, ${alpha(gold, 0.12)})`, boxShadow: `0 1px 0 ${alpha('#000', 0.25)}` }} />
          </Box>
        );
      })}
    </Box>
  );
}

/** まだメダルの無い月の枠(数字だけ) */
function EmptySlot({ month, strength }: { month: number; strength: number }) {
  return (
    <Box sx={{ width: 40, height: 52, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', pb: '3px' }}>
      <Box
        sx={{
          width: 32, height: 32, borderRadius: '50%', border: '1.5px dashed', borderColor: 'text.disabled', opacity: strength,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.66rem', fontWeight: 700, color: 'text.secondary',
        }}
      >
        {month}
      </Box>
    </Box>
  );
}

/** 取った習慣を出すカテゴリ(習慣ごとに数えるバッジ) */
const PER_HABIT: AchievementCategory[] = ['streak', 'rank', 'month'];

function Detail({ a, all, ctx, isNew, onClose }: { a: EvaluatedAchievement; all: EvaluatedAchievement[]; ctx: AchievementContext; isNew: boolean; onClose: () => void }) {
  const { earned, earnedDate, current, target, habit } = a.state;
  const secret = a.hidden && !earned;
  const m = METAL[a.tier];
  const series = secret ? [] : seriesMembers(all, a.id);
  const step = series.length > 1 ? nextStep(all, a.id) : null;
  const start = ctx.allCompletionDates[0];
  const dayNo = earned && earnedDate && start && earnedDate >= start ? daysBetween(start, earnedDate) + 1 : null;
  const story = [
    dayNo ? `記録を始めて${dayNo}日目` : null,
    habit && PER_HABIT.includes(a.category) ? `「${habit.name}」で達成` : null,
  ].filter(Boolean).join('・');
  return (
    <Box sx={{ p: 3, pb: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
      <AchievementEmblem badge={a} earned={earned} size={96} isNew={isNew} />
      <Box sx={{ mt: 2, display: 'flex', gap: 0.75, alignItems: 'center' }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>{CATEGORY_LABEL[a.category]}</Typography>
        <Box component="span" sx={{ px: 0.75, borderRadius: 1, fontSize: '0.62rem', fontWeight: 800, color: '#fff', bgcolor: m.label }}>
          {TIER_LABEL[a.tier]}
        </Box>
      </Box>
      <Typography sx={{ fontWeight: 800, fontSize: '1.15rem' }}>{secret ? '？？？' : a.name}</Typography>
      <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
        {secret ? 'ひみつのバッジ。取るとわかります' : a.hint}
      </Typography>

      {earned && earnedDate && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>{formatDate(earnedDate)}に獲得</Typography>
          {story && <Typography variant="caption" sx={{ color: 'text.secondary' }}>{story}</Typography>}
        </Box>
      )}
      {!earned && !secret && current !== undefined && target && (
        <Box sx={{ mt: 2, width: '100%' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>{habit ? habit.name : '進み具合'}</Typography>
            <Typography variant="caption" sx={{ fontWeight: 700 }}>{current} / {target}</Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={(current / target) * 100}
            sx={{ height: 8, borderRadius: 4, bgcolor: 'action.hover', '& .MuiLinearProgress-bar': { borderRadius: 4, bgcolor: emblemColor(a.icon) } }}
          />
        </Box>
      )}

      {/* 道のり: 同じ系列の梯子と、次の一歩 */}
      {series.length > 1 && (
        <Box sx={{ mt: 2, pt: 1.5, width: '100%', borderTop: '1px solid', borderColor: 'divider' }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>道のり</Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', gap: 0.5, mt: 0.75, flexWrap: 'wrap' }}>
            {series.map(s => (
              <Box
                key={s.id}
                sx={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.25, p: 0.5, borderRadius: 1.5, width: 44,
                  bgcolor: s.id === a.id ? alpha(m.label, 0.15) : 'transparent', boxShadow: s.id === a.id ? `0 0 0 1.5px ${m.label}` : 'none',
                }}
              >
                <AchievementEmblem badge={s} earned={s.state.earned} size={30} hideMark />
                <Typography noWrap sx={{ fontSize: '0.5rem', fontWeight: 700, width: '100%', color: s.state.earned ? 'text.primary' : 'text.disabled' }}>
                  {s.mark ?? s.name.replace('カード', '')}
                </Typography>
              </Box>
            ))}
          </Box>
          <Typography variant="caption" sx={{ display: 'block', mt: 0.75, fontWeight: 700, color: step ? 'text.secondary' : 'warning.main' }}>
            {step ? step.text : 'この系列はコンプリート！'}
          </Typography>
        </Box>
      )}
      <Button onClick={onClose} sx={{ mt: 2.5, borderRadius: 2 }}>閉じる</Button>
    </Box>
  );
}
