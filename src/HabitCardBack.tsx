import { useMemo, useState, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import LinearProgress from '@mui/material/LinearProgress';
import { alpha, type Theme } from '@mui/material/styles';
import FlagIcon from '@mui/icons-material/Flag';
import FavoriteIcon from '@mui/icons-material/Favorite';
import QueryStatsIcon from '@mui/icons-material/QueryStats';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import type { Habit, HabitCompletion, HabitNote } from './supabase';
import { HABIT_MILESTONES, computeHabitBadges, habitStats, rarityOf } from './habitStats';
import { Medal, Trophy } from './Badges';
import { FINISH, type CardFinish } from './cardFinish';

// 習慣カードの裏面: なぜやるのか・理想の姿(本人だけのメモ)と、この習慣だけの統計・バッジ。
// 表面と同じ大きさで、収まらないぶんは面の中でスクロールする。シルバー以上は金属の板に刻印した見た目

interface HabitCardBackProps {
  habit: Habit;
  /** この習慣の記録だけ */
  completions: HabitCompletion[];
  note: HabitNote | undefined;
  onSaveNote: (patch: { why?: string; ideal?: string }) => void;
  /** 表面と同じ見出し行(名前・↻・︙) */
  header: ReactNode;
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
const RARITY_COLOR = { normal: '#9e9e9e', silver: '#9aa5b4', gold: '#d9a93a', holo: '#a18cff' } as const;

/** 裏面の文字・彫り込み面の色。ノーマルは紙のまま(テーマの色) */
function inkOf(finish: CardFinish | null) {
  return {
    ink: finish?.ink ?? 'text.primary',
    sub: finish?.inkSub ?? 'text.secondary',
    faint: finish?.inkSub ?? 'text.disabled',
    textShadow: finish?.engrave ?? 'none',
    panel: finish
      ? { bgcolor: finish.panelBg, boxShadow: finish.panelShadow }
      : { bgcolor: (theme: Theme) => alpha(theme.palette.text.primary, 0.04) },
  };
}
type Ink = ReturnType<typeof inkOf>;

function Section({ icon, title, ink, children }: { icon: ReactNode; title: string; ink: Ink; children: ReactNode }) {
  return (
    <Box sx={{ mt: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.75, color: ink.sub, textShadow: ink.textShadow }}>
        {icon}
        <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 0.3 }}>{title}</Typography>
      </Box>
      {children}
    </Box>
  );
}

/** タップで編集、フォーカスが外れたら保存。入力欄は 16px(iOS が拡大しないように) */
function EditableNote({ value, placeholder, multiline, headline, ink, onSave }: {
  value: string; placeholder: string; multiline?: boolean;
  /** 理想の姿: 大きめの刻印として見せる */
  headline?: boolean;
  ink: Ink; onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (editing) {
    return (
      <TextField
        autoFocus
        fullWidth
        multiline={multiline}
        minRows={multiline ? 3 : undefined}
        maxRows={multiline ? 8 : undefined}
        size="small"
        value={draft}
        placeholder={placeholder}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false);
          if (draft.trim() !== value) onSave(draft.trim());
        }}
        onKeyDown={e => {
          if (!multiline && e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') { setDraft(value); setEditing(false); }
        }}
        inputProps={{ maxLength: multiline ? 1000 : 80, sx: { fontSize: '16px', color: ink.ink } }}
        sx={{ '& .MuiOutlinedInput-root': { ...ink.panel, borderRadius: 1.5 } }}
      />
    );
  }
  return (
    <Typography
      data-no-flip
      variant="body2"
      onClick={() => { setDraft(value); setEditing(true); }}
      sx={{
        cursor: 'text', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', lineHeight: 1.6,
        px: 1.25, py: 0.75, borderRadius: 1.5,
        ...ink.panel,
        color: value ? ink.ink : ink.faint,
        textShadow: ink.textShadow,
        fontStyle: value ? 'normal' : 'italic',
        ...(headline && value ? { fontSize: '1.05rem', fontWeight: 800, letterSpacing: '0.02em', lineHeight: 1.45 } : {}),
      }}
    >
      {value || placeholder}
    </Typography>
  );
}

function StatTile({ label, value, sub, ink }: { label: string; value: string; sub?: string; ink: Ink }) {
  return (
    <Box sx={{ px: 0.5, py: 0.75, borderRadius: 1.5, ...ink.panel, textAlign: 'center', textShadow: ink.textShadow }}>
      <Typography sx={{ fontSize: '0.6rem', color: ink.sub, fontWeight: 600 }}>{label}</Typography>
      <Typography sx={{ fontSize: '1rem', fontWeight: 800, lineHeight: 1.3, color: ink.ink }}>{value}</Typography>
      {sub && <Typography sx={{ fontSize: '0.56rem', color: ink.faint }}>{sub}</Typography>}
    </Box>
  );
}

const percent = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`);

export default function HabitCardBack({ habit, completions, note, onSaveNote, header }: HabitCardBackProps) {
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const stats = useMemo(() => habitStats(habit, completions, today), [habit, completions, today]);
  const badges = useMemo(
    () => computeHabitBadges(habit, new Set(completions.map(c => c.completed_date)), today),
    [habit, completions, today],
  );
  const rarity = rarityOf(stats.totalDays);
  const achieved = HABIT_MILESTONES.filter(m => stats.totalDays >= m);
  const nextMilestone = HABIT_MILESTONES.find(m => stats.totalDays < m) ?? null;
  const maxWeekday = Math.max(1, ...stats.weekdayCounts);

  const finish = FINISH[rarity.rarity];
  const ink = inkOf(finish);
  const metal = !!finish;

  return (
    <Box
      sx={{
        px: 2.25, pt: 1.75, pb: 2.25, position: 'relative', color: ink.ink,
        ...(metal ? {
          // 見出し行(名前・↻・︙)も刻印の色に
          '& .MuiIconButton-root': { color: ink.sub },
          '& > :first-of-type .MuiTypography-root': { color: ink.ink, textShadow: ink.textShadow },
        } : {}),
      }}
    >
      {header}

      <Section icon={<FlagIcon sx={{ fontSize: 15 }} />} title="理想の姿" ink={ink}>
        <EditableNote
          headline
          ink={ink}
          value={note?.ideal ?? ''}
          placeholder="この習慣を続けた先の、理想の自分は？"
          onSave={ideal => onSaveNote({ ideal })}
        />
      </Section>

      <Section icon={<QueryStatsIcon sx={{ fontSize: 15 }} />} title="この習慣の記録" ink={ink}>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0.75 }}>
          <StatTile
            ink={ink}
            label="始めた日"
            value={`${stats.startDate.getMonth() + 1}/${stats.startDate.getDate()}`}
            sub={`${stats.daysSinceStart}日目`}
          />
          <StatTile ink={ink} label="累計" value={`${stats.totalDays}日`} />
          <StatTile ink={ink} label="今月" value={percent(stats.monthRate)} sub={`${stats.monthDone}/${stats.monthDays}日`} />
          <StatTile ink={ink} label="ばっちり率" value={percent(stats.bacchiriRate)} />
          <StatTile ink={ink} label="疾風迅雷" value={`${stats.onTimeCount}回`} />
          <StatTile ink={ink} label="自己ベスト" value={`${stats.bestStreak}日`} sub={stats.currentStreak > 0 ? `いま${stats.currentStreak}日` : undefined} />
        </Box>
      </Section>

      <Section icon={<AutoAwesomeIcon sx={{ fontSize: 15 }} />} title="レアリティ" ink={ink}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography
            sx={{
              fontWeight: 900, fontSize: '0.85rem', minWidth: 64,
              color: metal ? ink.ink : RARITY_COLOR[rarity.rarity], textShadow: ink.textShadow,
            }}
          >
            {rarity.label}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={rarity.progress * 100}
            sx={{
              flex: 1, height: 8, borderRadius: 4,
              ...(metal ? ink.panel : { bgcolor: 'action.hover' }),
              '& .MuiLinearProgress-bar': {
                borderRadius: 4,
                bgcolor: metal ? alpha(finish.ink, 0.7) : RARITY_COLOR[rarity.next?.rarity ?? rarity.rarity],
              },
            }}
          />
        </Box>
        <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: ink.sub, textShadow: ink.textShadow, fontSize: '0.68rem' }}>
          {rarity.next
            ? `${rarity.next.label}まで あと${rarity.daysToNext}日(累計${rarity.next.min}日で昇格)`
            : '最高レアリティに到達！'}
        </Typography>
      </Section>

      <Section icon={<FavoriteIcon sx={{ fontSize: 15 }} />} title="なぜやるのか" ink={ink}>
        <EditableNote
          multiline
          ink={ink}
          value={note?.why ?? ''}
          placeholder="この習慣を始めた理由を書いておこう"
          onSave={why => onSaveNote({ why })}
        />
      </Section>

      <Section icon={<QueryStatsIcon sx={{ fontSize: 15 }} />} title="曜日ごとの回数" ink={ink}>
        <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 0.75, height: 64, px: 0.5 }}>
          {stats.weekdayCounts.map((n, i) => (
            <Box key={i} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.25 }}>
              <Typography sx={{ fontSize: '0.55rem', color: ink.sub, textShadow: ink.textShadow }}>{n}</Typography>
              <Box
                sx={{
                  width: '100%', maxWidth: 22, borderRadius: '4px 4px 1px 1px',
                  height: `${Math.max(3, (n / maxWeekday) * 34)}px`,
                  ...(metal
                    ? { bgcolor: alpha(finish.ink, n === maxWeekday && n > 0 ? 0.6 : 0.25), boxShadow: finish.panelShadow }
                    : { bgcolor: n === maxWeekday && n > 0 ? habit.color : alpha(habit.color, 0.45) }),
                }}
              />
              <Typography
                sx={{
                  fontSize: '0.6rem', textShadow: ink.textShadow,
                  color: metal ? ink.sub : i === 0 ? 'error.main' : i === 6 ? 'info.main' : 'text.secondary',
                }}
              >
                {WEEKDAYS[i]}
              </Typography>
            </Box>
          ))}
        </Box>
      </Section>

      <Section icon={<WorkspacePremiumIcon sx={{ fontSize: 15 }} />} title="バッジ" ink={ink}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 1 }}>
          {badges.perfectMonths.map(b => (
            <Box key={`${b.year}-${b.month}`} sx={{ lineHeight: 0 }}>
              <Medal color={habit.color} value={String(b.month)} unit="月" year={String(b.year)} />
            </Box>
          ))}
          {badges.ongoingDaysLeft !== null && (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.25 }}>
              <Box sx={{ lineHeight: 0 }}>
                <Medal color={habit.color} value={String(today.getMonth() + 1)} unit="月" year={String(today.getFullYear())} ongoing />
              </Box>
              <Typography sx={{ fontSize: '0.58rem', color: ink.sub, fontWeight: 600 }}>あと{badges.ongoingDaysLeft}日</Typography>
            </Box>
          )}
          {achieved.map(m => (
            <Box key={m} sx={{ lineHeight: 0 }}>
              <Trophy value={String(m)} unit="日" />
            </Box>
          ))}
          {nextMilestone !== null && (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.25, opacity: 0.35, filter: 'grayscale(1)' }}>
              <Box sx={{ lineHeight: 0 }}><Trophy value={String(nextMilestone)} unit="日" /></Box>
              <Typography sx={{ fontSize: '0.58rem', fontWeight: 700 }}>あと{nextMilestone - stats.totalDays}日</Typography>
            </Box>
          )}
        </Box>
        {badges.perfectMonths.length === 0 && badges.ongoingDaysLeft === null && achieved.length === 0 && (
          <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: ink.faint, textShadow: ink.textShadow, fontSize: '0.66rem' }}>
            月の1日〜末日まで毎日続けるとメダル、累計{HABIT_MILESTONES[0]}日でトロフィー
          </Typography>
        )}
      </Section>
    </Box>
  );
}
