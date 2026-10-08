import { useMemo, useState, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import LinearProgress from '@mui/material/LinearProgress';
import { alpha, type Theme } from '@mui/material/styles';
import type { Habit, HabitCompletion, HabitNote } from './supabase';
import { computeHabitBadges, habitStats, rarityOf } from './habitStats';
import { Medal } from './Badges';
import { FINISH, type CardFinish } from './cardFinish';

// 習慣カードの裏面: 理想の姿(本人だけのメモ)と、この習慣の記録・レアリティ・月間メダル。
// 表面と同じ大きさに収める。シルバー以上は金属の板に刻印した見た目

interface HabitCardBackProps {
  habit: Habit;
  /** この習慣の記録だけ */
  completions: HabitCompletion[];
  note: HabitNote | undefined;
  onSaveNote: (patch: { why?: string; ideal?: string }) => void;
  /** 表面と同じ見出し行(名前・↻・︙) */
  header: ReactNode;
}

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

/** タップで編集、フォーカスが外れたら保存。表示は 2 行まで。入力欄は 16px(iOS が拡大しないように) */
function EditableNote({ value, placeholder, headline, ink, onSave }: {
  value: string; placeholder: string;
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
        size="small"
        value={draft}
        placeholder={placeholder}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false);
          if (draft.trim() !== value) onSave(draft.trim());
        }}
        onKeyDown={e => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') { setDraft(value); setEditing(false); }
        }}
        inputProps={{ maxLength: 80, sx: { fontSize: '16px', color: ink.ink } }}
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
        display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden',
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
  const finish = FINISH[rarity.rarity];
  const ink = inkOf(finish);
  const metal = !!finish;
  // 新しい月から並べ、入りきらない古いメダルは右端で切れる
  const medals = [...badges.perfectMonths].reverse();

  return (
    <Box
      sx={{
        // 表面と同じ大きさに収める(スクロールしない)。理想の姿が伸び縮みして残りを下に詰める
        height: '100%', display: 'flex', flexDirection: 'column', gap: 1,
        px: 2.25, pt: 1.5, pb: 1.75, position: 'relative', color: ink.ink, overflow: 'hidden',
        ...(metal ? {
          // 見出し行(名前・↻・︙)も刻印の色に
          '& .MuiIconButton-root': { color: ink.sub },
          '& > :first-of-type .MuiTypography-root': { color: ink.ink, textShadow: ink.textShadow },
        } : {}),
      }}
    >
      {header}

      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center' }}>
        <Box sx={{ width: '100%' }}>
          <EditableNote
            headline
            ink={ink}
            value={note?.ideal ?? ''}
            placeholder="理想の姿は？(タップして書く)"
            onSave={ideal => onSaveNote({ ideal })}
          />
        </Box>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0.75, flexShrink: 0 }}>
        <StatTile
          ink={ink}
          label="始めた日"
          value={`${stats.startDate.getMonth() + 1}/${stats.startDate.getDate()}`}
          sub={`${stats.daysSinceStart}日目`}
        />
        <StatTile ink={ink} label="累計" value={`${stats.totalDays}日`} sub={rarity.label} />
        <StatTile ink={ink} label="今月" value={percent(stats.monthRate)} sub={`${stats.monthDone}/${stats.monthDays}日`} />
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexShrink: 0, height: 40 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <LinearProgress
            variant="determinate"
            value={rarity.progress * 100}
            sx={{
              height: 6, borderRadius: 3,
              ...(metal ? ink.panel : { bgcolor: 'action.hover' }),
              '& .MuiLinearProgress-bar': {
                borderRadius: 3,
                bgcolor: metal ? alpha(finish.ink, 0.7) : RARITY_COLOR[rarity.next?.rarity ?? rarity.rarity],
              },
            }}
          />
          {[
            rarity.next ? `${rarity.next.label}まで あと${rarity.daysToNext}日` : '最高レアリティ',
            badges.ongoingDaysLeft !== null ? `${today.getMonth() + 1}月のメダルまで あと${badges.ongoingDaysLeft}日` : null,
          ].filter(Boolean).map((line, i) => (
            <Typography
              key={i}
              noWrap
              sx={{ mt: i === 0 ? 0.5 : 0, lineHeight: 1.35, color: ink.sub, textShadow: ink.textShadow, fontSize: '0.62rem', fontWeight: 600 }}
            >
              {line}
            </Typography>
          ))}
        </Box>
        {(badges.ongoingDaysLeft !== null || medals.length > 0) && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, maxWidth: '55%', overflow: 'hidden', flexShrink: 0 }}>
            {badges.ongoingDaysLeft !== null && (
              <Box sx={{ width: 30, height: 39, flexShrink: 0, lineHeight: 0, '& svg': { width: 30, height: 39 } }}>
                <Medal color={habit.color} value={String(today.getMonth() + 1)} unit="月" year={String(today.getFullYear())} ongoing />
              </Box>
            )}
            {medals.map(b => (
              <Box key={`${b.year}-${b.month}`} sx={{ width: 30, height: 39, flexShrink: 0, lineHeight: 0, '& svg': { width: 30, height: 39 } }}>
                <Medal color={habit.color} value={String(b.month)} unit="月" year={String(b.year)} />
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}
