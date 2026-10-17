import { forwardRef, useRef, useState, type ReactElement, type ReactNode, type Ref } from 'react';
import Slide from '@mui/material/Slide';
import type { TransitionProps } from '@mui/material/transitions';
import Dialog from '@mui/material/Dialog';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import InputBase from '@mui/material/InputBase';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import { useTheme } from '@mui/material/styles';
import type { User } from '@supabase/supabase-js';
import { supabase, userDisplayName, userEmblem } from './supabase';
import type { EvaluatedAchievement } from './achievements';
import AchievementEmblem from './AchievementEmblem';
import NameEmblem from './NameEmblem';

// アカウントの設定。iOS アプリの「通知・ウィジェット」設定画面と同じく、下からせり上がるシートに
// グループ分けされた一覧(上にタイトルと「完了」)。上のバーを下へ引っ張っても閉じられる

const SlideUp = forwardRef(function SlideUp(props: TransitionProps & { children: ReactElement }, ref: Ref<unknown>) {
  return <Slide direction="up" ref={ref} {...props} easing={{ enter: 'cubic-bezier(0.2, 0.9, 0.25, 1)', exit: 'cubic-bezier(0.4, 0, 1, 1)' }} />;
});

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  user: User;
  dark: boolean;
  /** 取ったバッジ(名前の横に出すバッジの候補) */
  earnedBadges: EvaluatedAchievement[];
  onUserUpdated: (user: User) => void;
  onSignOut: () => void;
  onDeleteAccount: () => void;
}

const MAX_NAME = 30;

export default function SettingsDialog({ open, onClose, user, dark, earnedBadges, onUserUpdated, onSignOut, onDeleteAccount }: SettingsDialogProps) {
  const theme = useTheme();
  const savedName = userDisplayName(user) ?? '';
  const [name, setName] = useState(savedName);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [emblem, setEmblem] = useState<string | null>(userEmblem(user));
  const [emblemStatus, setEmblemStatus] = useState<'idle' | 'error'>('idle');

  // 開くたびに保存済みの名前から始める
  const reset = () => { setName(userDisplayName(user) ?? ''); setStatus('idle'); setEmblem(userEmblem(user)); setEmblemStatus('idle'); };

  // 名前の横のバッジ: アカウントに保存し、Cowork の自分の行にも書く(仲間に見えるように)
  const saveEmblem = async (id: string | null) => {
    if (id === emblem) return;
    setEmblem(id);
    const { data, error } = await supabase.auth.updateUser({ data: { emblem: id ?? '' } });
    if (error || !data.user) { setEmblemStatus('error'); return; }
    setEmblemStatus('idle');
    onUserUpdated(data.user);
    // 列がまだ無い(マイグレーション前)などで失敗しても、自分の表示には影響しない
    await supabase.from('cowork_members').update({ emblem: id }).eq('user_id', user.id);
  };

  const saveName = async () => {
    const trimmed = name.trim();
    if (!trimmed) { setName(savedName); return; }
    if (trimmed === savedName) return;
    setSaving(true);
    const { data, error } = await supabase.auth.updateUser({ data: { display_name: trimmed } });
    if (!error && data.user) {
      // すでにシェア中の習慣も新しい名前で見えるようにする
      await supabase.from('habit_shares').update({ sharer_name: trimmed }).eq('user_id', user.id);
      onUserUpdated(data.user);
      setName(trimmed);
      setStatus('saved');
    } else {
      setStatus('error');
    }
    setSaving(false);
  };

  const handleClose = async () => {
    await saveName();
    onClose();
  };

  // 上のバーを下へ引っ張って閉じる(iOS のシートと同じ)
  const paperRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; t: number; dy: number } | null>(null);
  const onDragStart = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    drag.current = { y: e.clientY, t: performance.now(), dy: 0 };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (paperRef.current) paperRef.current.style.transition = 'none';
  };
  const onDragMove = (e: React.PointerEvent) => {
    if (!drag.current || !paperRef.current) return;
    const dy = Math.max(0, e.clientY - drag.current.y);
    drag.current.dy = dy;
    paperRef.current.style.transform = `translateY(${dy}px)`;
  };
  const onDragEnd = () => {
    const d = drag.current;
    drag.current = null;
    const el = paperRef.current;
    if (!d || !el) return;
    const velocity = d.dy / Math.max(1, performance.now() - d.t);
    el.style.transition = 'transform 250ms cubic-bezier(0.2, 0.9, 0.25, 1)';
    if (d.dy > 120 || (d.dy > 30 && velocity > 0.6)) {
      el.style.transform = `translateY(${el.offsetHeight}px)`;
      setTimeout(() => { handleClose(); }, 200);
    } else {
      el.style.transform = '';
    }
  };

  // iOS のグループ一覧の配色
  // (シートの中なので、ダークは一段明るいグレーの地に、さらに明るいセル)
  const c = dark
    ? { bg: '#1c1c1e', cell: '#2c2c2e', sep: 'rgba(84,84,88,0.6)', sub: 'rgba(235,235,245,0.6)', glass: 'rgba(255,255,255,0.1)', glassEdge: 'rgba(255,255,255,0.14)' }
    : { bg: '#f2f2f7', cell: '#fff', sep: 'rgba(60,60,67,0.18)', sub: 'rgba(60,60,67,0.6)', glass: 'rgba(255,255,255,0.75)', glassEdge: 'rgba(0,0,0,0.06)' };
  const accent = theme.palette.primary.main;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      TransitionComponent={SlideUp}
      // 位置(transform)は Slide が開くたびに設定し直すので、ここでは名前だけ戻す
      TransitionProps={{ onEnter: reset }}
      fullWidth maxWidth={false}
      sx={{ '& .MuiDialog-container': { alignItems: 'flex-end' } }}
      PaperProps={{
        ref: paperRef,
        sx: {
          // iOS のシートと同じく左右を少し浮かせ、角を大きく丸める
          m: 0, mx: '6px', width: 'calc(100% - 12px)', maxWidth: 600,
          height: 'calc(100% - env(safe-area-inset-top, 0px) - 10px)', maxHeight: 'none',
          borderRadius: '34px 34px 0 0',
          boxShadow: '0 -4px 30px rgba(0,0,0,0.25)',
          bgcolor: c.bg, backgroundImage: 'none', overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        },
      }}
    >
      {/* ナビゲーションバー */}
      <Box
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerCancel={onDragEnd}
        sx={{
          touchAction: 'none',
          // 地と同じ色で、区切り線も無し(iOS のシートのナビゲーションバー)
          position: 'relative', flexShrink: 0, height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Typography sx={{ fontWeight: 700, fontSize: '1.125rem' }}>設定</Typography>
        {/* ガラスのカプセルのボタン */}
        <ButtonBase
          onClick={handleClose}
          sx={{
            position: 'absolute', right: 14, height: 44, px: 2.25, borderRadius: '22px',
            color: accent, fontWeight: 600, fontSize: '1.0625rem',
            bgcolor: c.glass, border: `0.5px solid ${c.glassEdge}`,
            boxShadow: dark ? 'inset 0 1px 0 rgba(255,255,255,0.08)' : '0 1px 4px rgba(0,0,0,0.08)',
            backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          }}
        >
          完了
        </ButtonBase>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', px: 2, pt: 0, pb: 'calc(24px + env(safe-area-inset-bottom, 0px))' }}>
        <Section
          c={c}
          header="プロフィール"
          footer={
            status === 'error'
              ? <Box component="span" sx={{ color: 'error.main' }}>名前を保存できませんでした。もう一度お試しください</Box>
              : status === 'saved'
                ? '保存しました。シェア中の習慣にも反映されます'
                : '習慣をシェアしたとき、相手に表示される名前です'
          }
        >
          <Row c={c}>
            <Typography sx={{ fontSize: '1.0625rem', flexShrink: 0 }}>ユーザー名</Typography>
            <InputBase
              value={name}
              onChange={e => { setName(e.target.value); setStatus('idle'); }}
              onBlur={saveName}
              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              placeholder="名前を入力"
              inputProps={{ maxLength: MAX_NAME, 'aria-label': 'ユーザー名', autoComplete: 'nickname', enterKeyHint: 'done' }}
              // 16px 以上(iOS がフォーカス時に拡大しないように)
              sx={{ flex: 1, ml: 2, fontSize: '1.0625rem', '& input': { textAlign: 'right', color: c.sub, p: 0 } }}
            />
            <NameEmblem id={emblem} size={20} />
            {saving && <CircularProgress size={14} sx={{ ml: 1, color: c.sub }} />}
          </Row>
          {user.email && (
            <Row c={c} divider>
              <Typography sx={{ fontSize: '1.0625rem', flexShrink: 0 }}>アカウント</Typography>
              <Typography noWrap sx={{ flex: 1, ml: 2, textAlign: 'right', fontSize: '1.0625rem', color: c.sub }}>{user.email}</Typography>
            </Row>
          )}
        </Section>

        <Section
          c={c}
          header="名前の横のバッジ"
          footer={
            emblemStatus === 'error'
              ? <Box component="span" sx={{ color: 'error.main' }}>バッジを保存できませんでした。もう一度お試しください</Box>
              : earnedBadges.length === 0
                ? 'バッジを取ると、ここから 1 つ選べるようになります'
                : '取ったバッジから 1 つ選ぶと、ユーザー名の横と Cowork の仲間に見えます'
          }
        >
          <Box sx={{ display: 'flex', gap: 1, px: 1.5, py: 1.5, overflowX: 'auto', scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}>
            <EmblemOption selected={emblem === null} accent={accent} label="なし" onClick={() => saveEmblem(null)}>
              <Box sx={{ width: 44, height: 44, borderRadius: '50%', border: `1.5px dashed ${c.sep}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', color: c.sub }}>なし</Box>
            </EmblemOption>
            {earnedBadges.map(b => (
              <EmblemOption key={b.id} selected={emblem === b.id} accent={accent} label={b.name} onClick={() => saveEmblem(b.id)}>
                <AchievementEmblem badge={b} earned size={44} />
              </EmblemOption>
            ))}
          </Box>
        </Section>

        <Section c={c}>
          <Row c={c} onClick={onSignOut}>
            <Typography sx={{ fontSize: '1.0625rem', color: accent }}>ログアウト</Typography>
          </Row>
        </Section>

        <Section c={c}>
          <Row c={c}>
            <Typography sx={{ fontSize: '1.0625rem', flexShrink: 0 }}>ビルド</Typography>
            <Typography noWrap sx={{ flex: 1, ml: 2, textAlign: 'right', fontSize: '1.0625rem', color: c.sub }}>{__BUILD_TIME__}</Typography>
          </Row>
        </Section>

        {/* 誤って押さないよう、一覧の外の一番下に小さく置く(押すと確認ダイアログ) */}
        <Box sx={{ mt: 6, display: 'flex', justifyContent: 'center' }}>
          <ButtonBase
            onClick={onDeleteAccount}
            sx={{ px: 1.5, py: 1, borderRadius: 1, fontSize: '0.75rem', color: c.sub, textDecoration: 'underline', textUnderlineOffset: '3px' }}
          >
            アカウントを削除
          </ButtonBase>
        </Box>
      </Box>
    </Dialog>
  );
}

type Palette = { cell: string; sep: string; sub: string };

/** 名前の横のバッジの選択肢(選んだものに輪) */
function EmblemOption({ selected, accent, label, onClick, children }: { selected: boolean; accent: string; label: string; onClick: () => void; children: ReactNode }) {
  return (
    <ButtonBase
      onClick={onClick}
      aria-pressed={selected}
      aria-label={label}
      sx={{
        flexDirection: 'column', gap: 0.5, p: 0.75, borderRadius: 2, width: 72, flexShrink: 0,
        boxShadow: selected ? `0 0 0 2px ${accent}` : 'none',
      }}
    >
      {children}
      <Typography noWrap sx={{ fontSize: '0.58rem', fontWeight: selected ? 800 : 500, width: '100%', textAlign: 'center' }}>{label}</Typography>
    </ButtonBase>
  );
}

function Section({ c, header, footer, children }: { c: Palette; header?: string; footer?: ReactNode; children: ReactNode }) {
  return (
    <Box sx={{ mt: header ? 1 : 3.5 }}>
      {header && (
        <Typography sx={{ px: 2, pb: 1, fontSize: '0.9375rem', fontWeight: 600, color: c.sub }}>{header}</Typography>
      )}
      <Box sx={{ bgcolor: c.cell, borderRadius: '24px', overflow: 'hidden' }}>{children}</Box>
      {footer && (
        <Typography sx={{ px: 2, pt: 0.75, fontSize: '0.8125rem', lineHeight: 1.4, color: c.sub }}>{footer}</Typography>
      )}
    </Box>
  );
}

function Row({ c, divider, onClick, children }: { c: Palette; divider?: boolean; onClick?: () => void; children: ReactNode }) {
  const content = (
    <Box
      sx={{
        position: 'relative', width: '100%', minHeight: 52, px: 2.5, py: 1.25, display: 'flex', alignItems: 'center',
        // 区切り線は左に余白を空ける(iOS の一覧と同じ)
        ...(divider ? { '&::before': { content: '""', position: 'absolute', top: 0, left: 20, right: 0, borderTop: `1px solid ${c.sep}` } } : {}),
      }}
    >
      {children}
    </Box>
  );
  return onClick
    ? <ButtonBase onClick={onClick} sx={{ width: '100%', display: 'block', textAlign: 'left', '&:active': { bgcolor: c.sep } }}>{content}</ButtonBase>
    : content;
}
