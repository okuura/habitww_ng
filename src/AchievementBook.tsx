import { useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Dialog from '@mui/material/Dialog';
import ButtonBase from '@mui/material/ButtonBase';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import { CATEGORY_LABEL, type AchievementCategory, type AchievementContext, type EvaluatedAchievement } from './achievements';
import AchievementEmblem from './AchievementEmblem';
import { emblemColor } from './achievementIcons';
import { Medal } from './Badges';

// バッジ図鑑: 取ったバッジ・まだのバッジをカテゴリごとに並べる。
// 前回見たときから増えたバッジには NEW を付ける(見たバッジは端末に覚えておく)

const SEEN_KEY = 'habitww-seen-achievements';

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

  const recent = useMemo(
    () => [...earned].sort((a, b) => (b.state.earnedDate ?? '').localeCompare(a.state.earnedDate ?? '')).slice(0, 3),
    [earned],
  );

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

  const [selected, setSelected] = useState<EvaluatedAchievement | null>(null);

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <WorkspacePremiumIcon sx={{ color: 'warning.main', fontSize: 20 }} />
        <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary', flex: 1 }}>
          バッジ図鑑
        </Typography>
        <Typography sx={{ fontWeight: 800, fontSize: '0.95rem' }}>
          {earned.length}
          <Box component="span" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.75rem' }}> / {achievements.length}</Box>
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={(earned.length / achievements.length) * 100}
        sx={{ height: 6, borderRadius: 3, bgcolor: 'action.hover', mb: 2, '& .MuiLinearProgress-bar': { borderRadius: 3, bgcolor: 'warning.main' } }}
      />

      {recent.length > 0 && (
        <Box sx={{ mb: 2.5 }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 1 }}>
            最近取ったバッジ
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {recent.map(a => (
              <ButtonBase
                key={a.id}
                onClick={() => setSelected(a)}
                sx={{
                  flex: 1, minWidth: 0, borderRadius: 2, px: 0.75, py: 1.25, gap: 0.75, flexDirection: 'column',
                  bgcolor: 'action.hover', textAlign: 'center',
                }}
              >
                <AchievementEmblem icon={a.icon} earned mark={a.mark} size={40} isNew={newIds.has(a.id)} />
                <Box sx={{ minWidth: 0, maxWidth: '100%' }}>
                  <Typography noWrap sx={{ fontSize: '0.68rem', fontWeight: 700 }}>{a.name}</Typography>
                  <Typography noWrap sx={{ fontSize: '0.6rem', color: newIds.has(a.id) ? 'error.main' : 'text.secondary', fontWeight: newIds.has(a.id) ? 800 : 400 }}>
                    {newIds.has(a.id) ? 'NEW!' : a.state.earnedDate ? shortDate(a.state.earnedDate) : ''}
                  </Typography>
                </Box>
              </ButtonBase>
            ))}
          </Box>
        </Box>
      )}

      {groups.map(([category, list]) => (
        <Box key={category} sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
              {CATEGORY_LABEL[category]}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.62rem' }}>
              {list.filter(a => a.state.earned).length}/{list.length}
            </Typography>
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(68px, 1fr))', gap: 1.25, rowGap: 1.75 }}>
            {list.map(a => {
              const { earned: got, current, target } = a.state;
              const secret = a.hidden && !got;
              return (
                <ButtonBase
                  key={a.id}
                  onClick={() => setSelected(a)}
                  sx={{ flexDirection: 'column', alignItems: 'center', gap: 0.75, borderRadius: 2, py: 0.5 }}
                >
                  <Box sx={{ position: 'relative' }}>
                    <AchievementEmblem icon={a.icon} earned={got} hidden={a.hidden} mark={a.mark} isNew={newIds.has(a.id)} />
                    {newIds.has(a.id) && (
                      <Box
                        component="span"
                        sx={{
                          position: 'absolute', top: -4, right: -10, px: 0.5, borderRadius: 1,
                          bgcolor: 'error.main', color: '#fff', fontSize: '0.55rem', fontWeight: 800, lineHeight: 1.5,
                        }}
                      >
                        NEW
                      </Box>
                    )}
                  </Box>
                  <Typography
                    sx={{
                      fontSize: '0.62rem', fontWeight: got ? 700 : 500, lineHeight: 1.25, textAlign: 'center',
                      color: got ? 'text.primary' : 'text.secondary',
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}
                  >
                    {secret ? '？？？' : a.name}
                  </Typography>
                  {!got && !secret && current !== undefined && target && current > 0 && (
                    <Box sx={{ width: 40, height: 3, borderRadius: 2, bgcolor: 'action.hover', overflow: 'hidden', mt: -0.25 }}>
                      <Box sx={{ height: '100%', width: `${(current / target) * 100}%`, bgcolor: emblemColor(a.icon) }} />
                    </Box>
                  )}
                </ButtonBase>
              );
            })}
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

function Detail({ a, isNew, onClose }: { a: EvaluatedAchievement; isNew: boolean; onClose: () => void }) {
  const { earned, earnedDate, current, target, habit } = a.state;
  const secret = a.hidden && !earned;
  return (
    <Box sx={{ p: 3, pb: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
      <AchievementEmblem icon={a.icon} earned={earned} hidden={a.hidden} mark={a.mark} size={84} isNew={isNew} />
      <Typography variant="caption" sx={{ mt: 2, color: 'text.secondary', fontWeight: 600 }}>
        {CATEGORY_LABEL[a.category]}
      </Typography>
      <Typography sx={{ fontWeight: 800, fontSize: '1.15rem' }}>{secret ? '？？？' : a.name}</Typography>
      <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
        {secret ? 'ひみつのバッジ。取るとわかります' : a.hint}
      </Typography>

      {earned && earnedDate && (
        <Typography variant="body2" sx={{ mt: 2, fontWeight: 700 }}>
          {formatDate(earnedDate)}に獲得
        </Typography>
      )}
      {!earned && !secret && current !== undefined && target && (
        <Box sx={{ mt: 2, width: '100%' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {habit ? habit.name : '進み具合'}
            </Typography>
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
