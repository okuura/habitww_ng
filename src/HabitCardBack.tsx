import { useMemo, useState, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import LinearProgress from '@mui/material/LinearProgress';
import type { Habit, HabitCompletion, HabitNote } from './supabase';
import { computeHabitBadges, habitStats, rarityOf, type Rarity } from './habitStats';
import { Medal } from './Badges';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import { FINISH, type CardFinish } from './cardFinish';

// 習慣カードの裏面: 理想の姿(本人だけのメモ)と、この習慣の記録・月間メダル・次の目標。
// 表面と同じ大きさに収める。シルバー以上は金属の板に刻印した見た目

interface HabitCardBackProps {
  habit: Habit;
  /** この習慣の記録だけ */
  completions: HabitCompletion[];
  note: HabitNote | undefined;
  onSaveNote: (patch: { why?: string; ideal?: string }) => void;
  /** 見出し行の右端に置くボタン(↻・︙) */
  actions: ReactNode;
}

const RARITY_NAME: Record<Rarity, string> = { normal: 'NORMAL', bronze: 'BRONZE', silver: 'SILVER', gold: 'GOLD', holo: 'HOLO' };

/** 裏面の文字・区切り線の色。ノーマルは紙のまま(テーマの色) */
function inkOf(finish: CardFinish | null) {
  return {
    ink: finish?.ink ?? 'text.primary',
    sub: finish?.inkSub ?? 'text.secondary',
    faint: finish?.inkSub ?? 'text.disabled',
    textShadow: finish?.engrave ?? 'none',
    line: finish?.line ?? 'divider',
    lineLight: finish?.lineLight ?? 'transparent',
    track: finish?.panelBg ?? 'action.hover',
    trackShadow: finish?.panelShadow ?? 'none',
  };
}
type Ink = ReturnType<typeof inkOf>;

/** タップで編集、フォーカスが外れたら保存。表示は 1 行(あふれたら …)。入力欄は 16px(iOS が拡大しないように) */
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
        variant="standard"
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
        sx={{ '& .MuiInput-root': { color: ink.ink } }}
      />
    );
  }
  return (
    <Typography
      data-no-flip
      variant="body2"
      onClick={() => { setDraft(value); setEditing(true); }}
      sx={{
        cursor: 'text', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.5,
        color: value ? ink.ink : ink.faint,
        textShadow: ink.textShadow,
        fontStyle: value ? 'normal' : 'italic',
        ...(headline && value ? { fontSize: '0.92rem', fontWeight: 700, letterSpacing: '0.02em' } : {}),
      }}
    >
      {value || placeholder}
    </Typography>
  );
}

function Label({ ink, children }: { ink: Ink; children: ReactNode }) {
  return (
    <Typography noWrap sx={{ fontSize: '0.62rem', fontWeight: 700, color: ink.sub, textShadow: ink.textShadow, lineHeight: 1.4 }}>
      {children}
    </Typography>
  );
}

/** 数字を大きく、単位を小さく */
function Figure({ ink, value, unit, size }: { ink: Ink; value: string | number; unit: string; size: string }) {
  return (
    <Box component="span" sx={{ color: ink.ink, textShadow: ink.textShadow, whiteSpace: 'nowrap' }}>
      <Box component="span" sx={{ fontSize: size, fontWeight: 800, letterSpacing: '-0.02em' }}>{value}</Box>
      <Box component="span" sx={{ fontSize: '0.72rem', fontWeight: 700, ml: '2px' }}>{unit}</Box>
    </Box>
  );
}

function Goal({ ink, color, label, lead, value, progress }: {
  ink: Ink; color: string; label: string; lead: string; value: number | null; progress: number;
}) {
  return (
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Label ink={ink}>{label}</Label>
      <Typography
        noWrap
        sx={{ fontSize: '0.72rem', fontWeight: 700, color: ink.ink, textShadow: ink.textShadow, lineHeight: 1.3, height: 22, display: 'flex', alignItems: 'flex-end' }}
      >
        {lead}{value !== null && <> あと<Figure ink={ink} value={value} unit="日" size="1.05rem" /></>}
      </Typography>
      <LinearProgress
        variant="determinate"
        value={Math.min(100, Math.max(0, progress * 100))}
        sx={{
          mt: 0.5, height: 5, borderRadius: 3, bgcolor: ink.track, boxShadow: ink.trackShadow,
          '& .MuiLinearProgress-bar': { borderRadius: 3, bgcolor: color },
        }}
      />
    </Box>
  );
}

const pad = (n: number) => String(n).padStart(2, '0');

/** 刻印の影(text-shadow)を、アイコン用の drop-shadow に置き換える */
const engraveFilter = (ink: Ink) =>
  ink.textShadow === 'none'
    ? 'none'
    : ink.textShadow.split(/,(?![^(]*\))/).map(sh => `drop-shadow(${sh.trim()})`).join(' ');

/** 連続記録の炎。文字と同じ刻印の色で、途切れているときは薄く */
function FireMark({ ink, active }: { ink: Ink; active: boolean }) {
  return (
    <LocalFireDepartmentIcon
      sx={{ fontSize: '1.15rem', ml: '-3px', color: ink.ink, opacity: active ? 1 : 0.35, filter: engraveFilter(ink) }}
    />
  );
}

/** 速攻(疾風迅雷)の稲妻。草グラフのマークと同じ形 */
function BoltMark({ ink, active }: { ink: Ink; active: boolean }) {
  return (
    <Box
      component="svg"
      viewBox="0 0 24 24"
      sx={{
        width: 16, height: 16, display: 'block', flexShrink: 0, ml: '-1px',
        color: ink.ink, opacity: active ? 1 : 0.35, filter: engraveFilter(ink),
      }}
    >
      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" fill="currentColor" />
    </Box>
  );
}

export default function HabitCardBack({ habit, completions, note, onSaveNote, actions }: HabitCardBackProps) {
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const stats = useMemo(() => habitStats(habit, completions, today), [habit, completions, today]);
  const badges = useMemo(
    () => computeHabitBadges(habit, new Set(completions.map(c => c.completed_date)), today),
    [habit, completions, today],
  );
  const rarity = rarityOf(stats.totalDays);
  const finish = FINISH[rarity.rarity];
  const ink = inkOf(finish);
  // 直近 5 つ(新しい月から)
  const medals = badges.perfectMonths.slice(-5).reverse();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const start = stats.startDate;
  // 区切り線も板に彫り込んだ溝(右側に光)
  const vline = { width: '1px', alignSelf: 'stretch', bgcolor: ink.line, flexShrink: 0, boxShadow: `1px 0 0 ${ink.lineLight}` };

  return (
    <Box
      sx={{
        // 表面と同じ大きさに収める(スクロールしない)
        height: '100%', display: 'flex', flexDirection: 'column',
        px: 2.25, pt: 1.25, pb: 1.75, position: 'relative', color: ink.ink, overflow: 'hidden',
        ...(finish ? { '& .MuiIconButton-root': { color: ink.sub } } : {}),
      }}
    >
      {/* 見出し: 名前・レアリティ・↻・︙ */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: habit.color, flexShrink: 0 }} />
        <Typography noWrap sx={{ fontWeight: 800, fontSize: '1.1rem', flex: 1, minWidth: 0, color: ink.ink, textShadow: ink.textShadow }}>
          {habit.name}
        </Typography>
        <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.3em', color: ink.sub, textShadow: ink.textShadow, flexShrink: 0 }}>
          {RARITY_NAME[rarity.rarity]}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0, mr: -0.75 }}>{actions}</Box>
      </Box>

      {/* 理想の姿 */}
      <Box sx={{ mt: 0.25, minWidth: 0 }}>
        <EditableNote
          headline
          ink={ink}
          value={note?.ideal ?? ''}
          placeholder="理想の姿は？(タップして書く)"
          onSave={ideal => onSaveNote({ ideal })}
        />
      </Box>

      {/* 累計 | 連続・速攻 | 獲得メダル */}
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', gap: 1.25, py: 0.75 }}>
        <Box sx={{ flexShrink: 0 }}>
          <Label ink={ink}>累計実施</Label>
          <Box sx={{ lineHeight: 1.05 }}><Figure ink={ink} value={stats.totalDays} unit="回" size="1.95rem" /></Box>
          <Typography noWrap sx={{ fontSize: '0.6rem', fontWeight: 600, color: ink.sub, textShadow: ink.textShadow }}>
            始めた日 {start.getFullYear()}.{pad(start.getMonth() + 1)}.{pad(start.getDate())}
          </Typography>
        </Box>
        <Box sx={vline} />
        <Box sx={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Box>
            <Label ink={ink}>連続記録</Label>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, lineHeight: 1.1 }}>
              <FireMark ink={ink} active={stats.currentStreak > 0} />
              <Figure ink={ink} value={stats.currentStreak} unit="日" size="1.15rem" />
            </Box>
          </Box>
          <Box>
            <Label ink={ink}>速攻</Label>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, lineHeight: 1.1 }}>
              <BoltMark ink={ink} active={stats.onTimeCount > 0} />
              <Figure ink={ink} value={stats.onTimeCount} unit="回" size="1.15rem" />
            </Box>
          </Box>
        </Box>
        <Box sx={vline} />
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <Label ink={ink}>獲得メダル</Label>
          <Box sx={{ display: 'flex', gap: '3px', mt: 0.25, minHeight: 36 }}>
            {medals.length === 0 && (
              <Typography sx={{ fontSize: '0.6rem', color: ink.faint, textShadow: ink.textShadow, alignSelf: 'center' }}>
                まだありません
              </Typography>
            )}
            {medals.map(b => (
              <Box
                key={`${b.year}-${b.month}`}
                sx={{
                  width: 28, height: 36, flexShrink: 0, lineHeight: 0, '& svg': { width: 28, height: 36 },
                  filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.3))',
                }}
              >
                <Medal color={habit.color} value={String(b.month)} unit="月" year={String(b.year)} />
              </Box>
            ))}
          </Box>
        </Box>
      </Box>

      {/* 次の目標 */}
      <Box sx={{ height: '1px', bgcolor: ink.line, flexShrink: 0, boxShadow: `0 1px 0 ${ink.lineLight}` }} />
      <Box sx={{ display: 'flex', gap: 1.25, pt: 0.75, flexShrink: 0 }}>
        <Goal
          ink={ink}
          color={habit.color}
          label="次のカードランク"
          lead={rarity.next ? `${rarity.next.label}まで` : '最高ランクに到達！'}
          value={rarity.daysToNext}
          progress={rarity.next ? rarity.progress : 1}
        />
        <Box sx={vline} />
        {badges.ongoingDaysLeft !== null ? (
          <Goal
            ink={ink}
            color={habit.color}
            label="次のメダル"
            lead={`${today.getMonth() + 1}月`}
            value={badges.ongoingDaysLeft}
            progress={1 - badges.ongoingDaysLeft / daysInMonth}
          />
        ) : (
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Label ink={ink}>次のメダル</Label>
            <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: ink.sub, textShadow: ink.textShadow, lineHeight: 1.4 }}>
              来月1日から毎日続けると獲得
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}
