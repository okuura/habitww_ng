import { useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Dialog from '@mui/material/Dialog';
import ButtonBase from '@mui/material/ButtonBase';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import {
  CATEGORY_LABEL, TIER_LABEL,
  type AchievementCategory, type AchievementContext, type EvaluatedAchievement, type Tier,
} from './achievements';
import AchievementEmblem from './AchievementEmblem';
import { emblemColor, METAL } from './achievementIcons';
import { Medal } from './Badges';

// バッジ図鑑(実績ページ)。集めた数と最近のバッジ、その下にカテゴリごとの全部のバッジを並べる。
// 前回見たときから増えたバッジには NEW を付ける(見たバッジは端末に覚えておく)

const SEEN_KEY = 'habitww-seen-achievements';
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
}

export default function AchievementBook({ ctx, achievements }: Props) {
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
      <Header earned={earned.length} total={achievements.length} />
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
        {selected && <Detail a={selected} isNew={newIds.has(selected.id)} onClose={() => setSelected(null)} />}
      </Dialog>
    </>
  );
}

function Header({ earned, total }: { earned: number; total: number }) {
  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <WorkspacePremiumIcon sx={{ color: 'warning.main', fontSize: 20 }} />
        <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary', flex: 1 }}>バッジ図鑑</Typography>
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

  const medals = useMemo(
    () => ctx.habits
      .flatMap(h => h.perfectMonths.map(m => ({ habit: h.habit, ...m })))
      .sort((a, b) => b.year - a.year || b.month - a.month),
    [ctx],
  );

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

          {/* 月間パーフェクトで取ったメダル(習慣ごと・月ごと) */}
          {category === 'month' && medals.length > 0 && (
            <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', mt: 1.5, pb: 0.5 }}>
              {medals.map(m => (
                <Box key={`${m.habit.id}-${m.year}-${m.month}`} sx={{ lineHeight: 0, flexShrink: 0 }} title={`${m.habit.name} ${m.year}年${m.month}月`}>
                  <Medal color={m.habit.color} value={String(m.month)} unit="月" year={String(m.year)} />
                </Box>
              ))}
            </Box>
          )}
        </Box>
      ))}
    </>
  );
}

function Detail({ a, isNew, onClose }: { a: EvaluatedAchievement; isNew: boolean; onClose: () => void }) {
  const { earned, earnedDate, current, target, habit } = a.state;
  const secret = a.hidden && !earned;
  const m = METAL[a.tier];
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
        <Typography variant="body2" sx={{ mt: 2, fontWeight: 700 }}>{formatDate(earnedDate)}に獲得</Typography>
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
      <Button onClick={onClose} sx={{ mt: 2.5, borderRadius: 2 }}>閉じる</Button>
    </Box>
  );
}
